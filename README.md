# SyMath · Symbolic Mathematics Workstation

[![CI](https://github.com/yezicheng2011/symath/actions/workflows/ci.yml/badge.svg)](https://github.com/yezicheng2011/symath/actions/workflows/ci.yml)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

SyMath is a computer-algebra system (CAS) workstation built for mathematical formula input. You enter typeset formulas (MathLive) in the browser. **SymPy 1.14 + mpmath**, running on a server or on the local machine, does exact symbolic computation and high-precision numerics, together with 2D/3D plotting, dynamic geometry, data sheets, and computation pipelines.

This project was originally the online service “墨域 CAS” (Moyu CAS) at cas.aeroandroid.com. It is now open source under the **Apache License 2.0**.

- Online: <https://cas.aeroandroid.com/>
- Desktop (universal macOS / Windows, runs offline): see [Releases](https://github.com/yezicheng2011/symath/releases)

## Product scope

- **Symbolic computation**: 106 registered operations. The full list and parameters are in `shared/operations.json`. Coverage includes polynomials, Gröbner bases, solution sets of periodic equations, nonlinear systems, inequalities, Diophantine equations, ODEs with initial conditions, recurrence relations, improper integrals, one-sided limits, Taylor/Laurent series, infinite sums and products, Laplace/Fourier transforms, multivariable differentiation, matrix factorizations, number theory, statistics, regression, and analytic geometry.
- **Math input**: typeset formulas, math templates, a virtual keyboard, cell-by-cell matrices, and row-by-row systems of equations. A result can be edited, recomputed, used as the input for a further calculation, copied, or saved as a session variable. User-defined functions are supported.
- **Graphics**: multiple 2D function curves, parametric curves, polar plots, implicit curves, and WebGL surfaces that can be rotated and zoomed, with SVG/PNG export. Parameter intervals and coordinate ranges are set separately. Changing a plot’s input marks that plot as needing to be regenerated.
- **Dynamic geometry**: points, lines, segments, circles, triangles, polygons, and dependent midpoints and intersections. Dragging a free point updates the constructions that depend on it. Numeric length, area, perimeter, and coordinates can be inspected, and a polygon can be sent into exact symbolic computation.
- **Data sheets**: CSV import and export, multi-cell paste, cell references, a restricted formula interpreter, circular-reference checks, scatter plots, summary statistics, and conversion of sheet data into exact statistics, correlation coefficients, and least-squares fits.
- **Computation pipelines**: visually arrange, reorder, and run symbolic transformation steps, keeping the result of each step.
- **Worksheets**: multiple documents, local autosave, undo of result changes, rename, and full import and export. The v2 format stores session definitions, tables, geometry, pipelines, and plot configuration. Reading remains compatible with first-version worksheets. After a session definition changes, the existing compute cells are marked as needing recomputation.

## How this differs from Xcas

The goal is parity with Xcas in professional use and in mathematical coverage, but this project **is not Giac and does not yet implement every Xcas algorithm or feature**. The in-app menu **帮助 → Xcas 功能对照** (Help → “Xcas feature comparison”) states the current scope.

The main gaps are Xcas programming-language compatibility, programs with branching and loops, three-dimensional dependent geometry, full geometric constraints and loci, parametric surfaces and vector fields, and item-by-item compatibility with Giac-specific algorithms and commands. SymPy and Giac differ in algorithms, performance, special functions, and some mathematical cases. Neither the count of 106 operations nor the number of modules is a claim of full equivalence.

Giac/Xcas is licensed under GPL-3.0. This project **does not use any Giac/Xcas code**. It only aims at comparable functionality.

## Download the desktop app

Download from [Releases](https://github.com/yezicheng2011/symath/releases):

- **macOS** (11 and later, universal Apple silicon and Intel): `SyMath-<version>-macOS-universal.dmg`. Open it, then drag SyMath into “应用程序” (Applications).
- **Windows** (10/11 x64): `SyMath-<version>-Windows-x64.exe`, a single file. Double-click to run it. The window uses the WebView2 runtime that ships with the system. If WebView2 is missing, the app opens in the default browser instead.

The desktop app starts a compute service on the local machine that listens only on `127.0.0.1`. The frontend and the kernel are both packaged inside the app. **It does not connect to the network and does not upload any data.**

Both platforms are signed by a free method. The first launch shows a prompt. It does **not** show “已损坏” (damaged):

- macOS is ad-hoc signed and has not been notarized by Apple. After the first double-click, open “系统设置 → 隐私与安全性” (System Settings → Privacy & Security) and click “仍要打开” (Open Anyway). On macOS 14 and earlier you can also hold Control, click the app, and choose “打开” (Open).
- Windows uses a self-signed certificate. When SmartScreen reports “未知发布者” (Unknown publisher), click “更多信息 → 仍要运行” (More info → Run anyway).

## Local development

Requires Node.js 22+, npm 10+, and Python 3.12+.

```bash
python3 -m venv .venv
.venv/bin/pip install -r backend/requirements.txt
npm ci
```

Run these in two separate terminals:

```bash
npm run api  # 127.0.0.1:8765, loopback only
npm run dev  # 127.0.0.1:5173, proxies /api to 8765
```

After a build, one process can serve both the UI and the API:

```bash
npm run build
.venv/bin/python -m backend.server --port 8765 --static dist
# Open http://127.0.0.1:8765/
```

Run the desktop window locally (this needs `pip install -r desktop/requirements.txt`):

```bash
.venv/bin/python desktop/symath_desktop.py
```

## Verification

```bash
npm test                    # frontend data, geometry, parsing, and import tests, plus Python kernel tests
npm run build               # local fonts, frontend and backend license audit, typecheck, and Vite build
npx playwright install chromium
node tests/browser.mjs      # with the dev server running, exercises the real UI and keyboard input
```

The kernel tests take all 106 examples in the catalog, convert them to MathJSON with the real LaTeX parser, run the matching operation, and also check exactness, solution sets, divergent integrals, matrices, ODE initial values, user-defined functions, pipelines, precision, and input safety.

## Service architecture

```text
Browser / MathLive / Compute Engine
  → validated MathJSON over HTTPS
  → Nginx /api/
  → loopback HTTP service (backend/server.py)
  → one bounded Python process per mathematical job
  → SymPy / mpmath
```

The service decodes MathJSON with an explicit allowlist of mathematical constructors. User input is not passed to Python `eval`, `exec`, `sympify`, or a string expression parser. `lambdify` for numeric plots receives only a validated mathematical tree and validated identifiers. The spreadsheet uses its own restricted interpreter and does not execute JavaScript.

Each job is limited to 30 seconds and about 1.5 GiB of memory per process (Linux/macOS), with at most 4 jobs at once. Cancelling a job terminates that compute process. Worksheet data stays in the browser only. The service does not persist computation requests.

### Runtime environment variables

| Variable | Default | Description |
| --- | --- | --- |
| `SYMATH_ALLOWED_ORIGINS` | `http://127.0.0.1:5173,http://localhost:5173` | Browser origins allowed to call the API, comma-separated. When deploying, set this to your `https://<domain>`. |
| `SYMATH_PORT` | `8765` | API port (127.0.0.1 only) |
| `SYMATH_STATIC_DIR` | empty | When set, also serves the `dist/` static UI |
| `SYMATH_MEMORY_MB` | `1536` | Per-job memory limit (POSIX) |

## Server deployment (Nginx + systemd)

```bash
cp .env.example .env   # set SYMATH_DOMAIN and the other values; no secrets are required
bash scripts/deploy.sh
```

`deploy/` holds the Nginx, systemd, and certificate-renewal hook templates (`__DOMAIN__` and the other placeholders are filled from `.env` by the script). Request the HTTPS certificate for your domain with certbot first. The HTTP challenge can be completed with `deploy/nginx-http-bootstrap.conf.template`. The script tests, builds, and publishes a timestamped version directory, checks that the API is healthy, switches the static site, and runs `nginx -t && reload`.

## Desktop builds

The desktop app is packaged with PyInstaller (`desktop/symath.spec`). The window is provided by pywebview. GitHub Actions (`.github/workflows/release.yml`) runs when a `v*` tag is pushed:

1. macOS: build a universal arm64+x86_64 `SyMath.app` with the universal2 Python from python.org, check that every Mach-O binary contains both architectures, ad-hoc sign and verify it, and pack a DMG.
2. Windows: build a single-file `SyMath.exe` and Authenticode-sign it with a self-signed certificate generated for that CI run.
3. Both platforms launch the app and run a smoke computation, then publish a GitHub Release.

## Mathematical and implementation limits

- No general-purpose CAS can solve every mathematical problem. Condition sets, and unevaluated integrals, derivatives, sums, products, and similar objects, stay in their original form and are called out explicitly.
- For multivariable nonlinear solving, parameter-degenerate cases still have to be checked against the original equations. Numeric root-finding depends on the initial value and does not guarantee that every root is found. Algebraic rewrites inherit the original domain and the assumptions on the selected variables.
- Differential equations and recurrences accept an optional initial point, an initial value of the function, and an initial value of the first derivative or of the next term. More general boundary-value problems do not yet have a dedicated interface.
- High-precision computation supports a target of 10–500 significant digits. A precision target is not an error guarantee for every ill-conditioned problem.
- Plots and geometric measurements are numeric visualizations. They do not replace a proof of continuity or of a geometric statement. Poles, undefined positions, and the sampling resolution can change the picture.
- Data sheets support 500 rows × 26 columns. The matrix kernel entry point supports 32 × 32, and the structured editor supports 16 × 16. One formula is limited to 15000 characters, an imported result to 160000 characters, and a worksheet import to 1000 compute cells.

## License

SyMath is released under the [Apache License 2.0](LICENSE). See [NOTICE](NOTICE).

Third-party dependencies use permissive licenses (MIT, BSD-3-Clause, Apache-2.0, and ISC) that are compatible with Apache-2.0. `npm run licenses` checks the license allowlist and writes `public/THIRD_PARTY_NOTICES.txt`, which is published with the build output. The inventory is `licenses/dependencies.json`. The main components are SymPy and mpmath (BSD-3-Clause), and MathLive, Cortex Compute Engine, React, Three.js, and the KaTeX fonts (MIT).
