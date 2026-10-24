#!/usr/bin/env bash
# Build, test and publish SyMath to a single Linux server (nginx + systemd).
# Settings come from .env (see .env.example). Requires passwordless sudo for the deploying user.
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -f .env ]; then set -a; . ./.env; set +a; fi
: "${SYMATH_DOMAIN:?set SYMATH_DOMAIN in .env}"
WEB_ROOT="${SYMATH_WEB_ROOT:-/var/www/symath}"
APP_ROOT="${SYMATH_APP_ROOT:-/opt/symath}"
SERVICE_USER="${SYMATH_SERVICE_USER:-symath}"
API_PORT="${SYMATH_API_PORT:-8766}"
render() {
  sed -e "s#__DOMAIN__#${SYMATH_DOMAIN}#g" -e "s#__WEB_ROOT__#${WEB_ROOT}#g" -e "s#__APP_ROOT__#${APP_ROOT}#g" \
      -e "s#__SERVICE_USER__#${SERVICE_USER}#g" -e "s#__API_PORT__#${API_PORT}#g" "$1"
}
if [ "${1:-}" != "--skip-checks" ]; then
  npm test
  npm run build
fi
test -f dist/index.html
tag="$(date -u +%Y%m%dT%H%M%SZ)"
release="$WEB_ROOT/releases/$tag"
api_release="$APP_ROOT/releases/$tag"
if ! getent passwd "$SERVICE_USER" > /dev/null; then
  sudo -n useradd --system --user-group --no-create-home --home-dir /nonexistent --shell /usr/sbin/nologin "$SERVICE_USER"
fi
sudo -n install -d -m 755 "$APP_ROOT" "$api_release"
if [ ! -x "$APP_ROOT/venv/bin/python" ]; then
  sudo -n python3 -m venv "$APP_ROOT/venv"
fi
if ! cmp -s backend/requirements.txt "$APP_ROOT/requirements.installed"; then
  sudo -n "$APP_ROOT/venv/bin/pip" install -r backend/requirements.txt
  sudo -n install -m 644 backend/requirements.txt "$APP_ROOT/requirements.installed"
fi
sudo -n cp -a backend shared "$api_release/"
sudo -n chmod -R a+rX "$api_release"
sudo -n ln -s "$api_release" "$APP_ROOT/current.next"
sudo -n mv -Tf "$APP_ROOT/current.next" "$APP_ROOT/current"
render deploy/symath.service.template | sudo -n tee /etc/systemd/system/symath.service > /dev/null
sudo -n systemctl daemon-reload
sudo -n systemctl enable symath.service
sudo -n systemctl restart symath.service
curl --fail --silent --show-error --retry 10 --retry-delay 1 --retry-connrefused --max-time 3 "http://127.0.0.1:${API_PORT}/api/health"
sudo -n install -d -m 755 "$release"
sudo -n cp -a dist/. "$release/"
sudo -n chmod -R a+rX "$release"
# Keep prior hashed assets available to browsers with an already open notebook.
if [ -d "$WEB_ROOT/current/assets" ]; then
  sudo -n cp -a --update=none "$WEB_ROOT/current/assets/." "$release/assets/"
fi
sudo -n ln -s "$release" "$WEB_ROOT/current.next"
sudo -n mv -Tf "$WEB_ROOT/current.next" "$WEB_ROOT/current"
render deploy/nginx-https.conf.template | sudo -n tee "/etc/nginx/sites-available/${SYMATH_DOMAIN}" > /dev/null
sudo -n nginx -t
sudo -n systemctl reload nginx
printf 'Published files at %s\n' "$release"
