# SyMath · Symbolic Mathematics Workstation

[![CI](https://github.com/yezicheng2011/symath/actions/workflows/ci.yml/badge.svg)](https://github.com/yezicheng2011/symath/actions/workflows/ci.yml)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

SyMath is a computer-algebra system (CAS) workstation built around entering mathematical formulas. You type typeset formulas with MathLive in the browser. **SymPy 1.14 + mpmath**, on a server or on your own machine, does the exact symbolic work and the high-precision numerics, together with 2D and 3D plots, dynamic geometry, data worksheets, and computation pipelines.

This project began as the online service Moyu CAS (墨域 CAS, cas.aeroandroid.com). It is now open source under the **Apache License 2.0**.

- Online edition: <https://cas.aeroandroid.com/>
- Desktop edition (universal macOS / Windows, runs offline): see [Releases](https://github.com/yezicheng2011/symath/releases)

## Product scope

- **Symbolic computation.** 106 registered operations. The full list and parameters are in `shared/operations.json`. They cover polynomials, Gröbner bases, solution sets of periodic equations, nonlinear systems, inequalities, Diophantine equations, ODEs with initial conditions, recurrence relations, improper integrals, one-sided limits, Taylor and Laurent series, infinite sums and products, Laplace and Fourier transforms, multivariable differentiation, matrix factorizations, number theory, statistics, regression, and analytic geometry.
- **Math input.** Typeset formulas, math templates, a virtual keyboard, cell-by-cell matrices, and line-by-line systems of equations. A result can be edited, recomputed, used in a further calculation, copied, or saved as a session variable. User-defined functions are supported.
- **Graphics.** Several 2D function curves, parametric curves, polar plots, implicit curves, and a WebGL surface you can rotate and zoom, with SVG and PNG export. Parameter intervals and coordinate ranges are set separately. Changing a plot's input marks it as needing to be regenerated.
- **Dynamic geometry.** Points, lines, segments, circles, triangles, polygons, and dependent midpoints and intersections. Dragging a free point updates the constructions that depend on it. You can inspect numeric length, area, perimeter, and coordinates, and send a polygon into exact symbolic computation.
- **Data worksheet.** CSV import and export, multi-cell paste, a safe formula interpreter with cell references, circular-reference checks, scatter plots, summary statistics, and a path from the data into exact statistics, correlation coefficients, and least-squares fits.
- **Computation pipeline.** Arrange, move, and run symbolic transformation steps visually, and keep each step's result.
- **Worksheets.** Several documents, local autosave, undo of result changes, rename, and full import and export. The v2 format stores session definitions, tables, geometry, pipelines, and plot configuration. Reading still accepts first-version worksheets. After a session definition changes, the existing computation cells are marked as needing to be recomputed.

## How this differs from Xcas

The aim is to match Xcas in day-to-day professional use and in the range of mathematical features. This project **is not Giac, and it does not yet implement every Xcas algorithm and feature**. The in-app item **Help → Xcas feature comparison** (帮助 → Xcas 功能对照) states the current scope.

The main gaps are Xcas programming-language compatibility, programs with branches and loops, three-dimensional dependent geometry, a full set of geometric constraints and loci, parametric surfaces and vector fields, and command-by-command compatibility with the algorithms and commands that are specific to Giac. SymPy and Giac differ in algorithms, performance, special functions, and some mathematical cases. A count of 106 operations, or of modules, is not a claim that the two are fully equivalent.

Giac/Xcas is licensed under GPL-3.0. This project **uses none of the Giac/Xcas code**. It only aims at the same kinds of features.

## Download the desktop edition

Download from [Releases](https://github.com/yezicheng2011/symath/releases):

- **macOS** (11 and later, universal for Apple silicon and Intel): `SyMath-<version>-macOS-universal.dmg`. Open it and drag SyMath into Applications.
- **Windows** (10/11 x64): `SyMath-<version>-Windows-x64.exe`, one file. Double-click to run. The window uses the system's WebView2. If WebView2 is missing, the app opens in the default browser instead.

The desktop edition starts a compute service on this machine that listens only on `127.0.0.1`. The front end and the kernel are both packaged inside the app. **It does not go online, and it does not upload any data.**

Signing uses the free methods. The first launch shows a prompt. It does not say the file is damaged (已损坏):

- macOS is ad-hoc signed and is not notarized by Apple. After the first double-click, go to **System Settings → Privacy & Security** and click **Open Anyway** (仍要打开). On macOS 14 and earlier you can also Control-click and choose **Open** (打开).
- Windows uses a self-signed certificate. When SmartScreen says the publisher is unknown (未知发布者), click **More info → Run anyway** (更多信息 → 仍要运行).

## Local development

Requires Node.js 22+, npm 10+, and Python 3.12+.

```bash
python3 -m venv .venv
.venv/bin/pip install -r backend/requirements.txt
npm ci
```

Run these in two terminals:

```bash
npm run api  # 127.0.0.1:8765, loopback only
npm run dev  # 127.0.0.1:5173, /api proxied to 8765
```

You can also build, then serve the UI and the API from one process:

```bash
npm run build
.venv/bin/python -m backend.server --port 8765 --static dist
# open http://127.0.0.1:8765/
```

To run the desktop window locally (`pip install -r desktop/requirements.txt` first):

```bash
.venv/bin/python desktop/symath_desktop.py
```

## Verification

```bash
npm test                    # front-end tests for data, geometry, parsing, and import, plus Python kernel tests
npm run build               # local fonts, front-end and back-end license audit, type checking, and the Vite build
npx playwright install chromium
node tests/browser.mjs      # with the dev server running, tests the real interface and keyboard input
```

The kernel tests send every one of the 106 catalog examples through the real LaTeX parser into MathJSON, run the matching operation, and also check exactness, solution sets, divergent integrals, matrices, ODE initial values, user functions, pipelines, precision, and input safety.

## Service architecture

```text
Browser / MathLive / Compute Engine
  → validated MathJSON over HTTPS
  → Nginx /api/
  → loopback HTTP service (backend/server.py)
  → one bounded Python process per mathematical job
  → SymPy / mpmath
```

The service decodes MathJSON with an explicit allow-list of mathematical constructors. It does not hand user input to Python `eval`, `exec`, `sympify`, or a string expression parser. Numeric plotting's `lambdify` receives only a validated math tree and identifiers. The spreadsheet uses its own restricted interpreter and does not run JavaScript.

One job is limited to 30 seconds and about 1.5 GiB of memory per process (Linux and macOS), with at most 4 jobs at once. Cancelling a job stops that compute process. Worksheet data stays only in the browser. The service does not persist computation requests.

### Runtime environment variables

| Variable | Default | Description |
| --- | --- | --- |
| `SYMATH_ALLOWED_ORIGINS` | `http://127.0.0.1:5173,http://localhost:5173` | Browser origins allowed to call the API, separated by commas. When you deploy, set this to your `https://your-domain` |
| `SYMATH_PORT` | `8765` | API port (127.0.0.1 only) |
| `SYMATH_STATIC_DIR` | empty | When set, the server also serves the static UI from `dist/` |
| `SYMATH_MEMORY_MB` | `1536` | Memory limit for one job (POSIX) |

## Server deployment (Nginx + systemd)

```bash
cp .env.example .env   # fill in SYMATH_DOMAIN and the rest; no secrets are required
bash scripts/deploy.sh
```

`deploy/` holds templates for Nginx, systemd, and the certificate-renewal hook. The script fills placeholders such as `__DOMAIN__` from `.env`. Request the HTTPS certificate for your domain with certbot first. `deploy/nginx-http-bootstrap.conf.template` can complete the HTTP validation. The script tests, builds, and publishes a timestamped version directory. After the API health check, it switches the static site and runs `nginx -t && reload`.

## Desktop builds

The desktop edition is packaged with PyInstaller (`desktop/symath.spec`). pywebview provides the window. GitHub Actions (`.github/workflows/release.yml`) runs when a `v*` tag is pushed:

1. macOS: build a universal arm64 and x86_64 `SyMath.app` with python.org's universal2 Python, check that every Mach-O contains both architectures, ad-hoc sign and verify it, and package a DMG.
2. Windows: build a single-file `SyMath.exe` and Authenticode-sign it with a self-signed certificate generated for that CI run.
3. Both platforms launch the app and run a smoke computation, then publish a GitHub Release.

## Mathematical and implementation limits

- No general CAS solves every mathematical problem. Conditional sets, and integrals, derivatives, sums, and products that stay unevaluated, are kept in their original form and called out explicitly.
- For multivariable nonlinear solving, degenerate parameter cases still have to be judged against the original expression. Numeric root finding depends on the initial value and does not guarantee that every root is found. Algebraic rewriting inherits the original domain and the assumptions chosen for the variables.
- Differential equations and recurrences can take an optional initial position, an initial function value, and an initial first derivative or an initial value for the next term. More general boundary-value problems do not yet have a dedicated screen.
- High-precision calculation supports a target of 10–500 significant digits. A precision target is not an error guarantee for every ill-conditioned problem.
- Plots and geometric measurements are numeric visualizations. They cannot stand in for a proof of continuity or of a geometric claim. Poles, undefined positions, and sampling resolution can change the picture.
- The data sheet supports 500 rows by 26 columns. The matrix kernel accepts 32 by 32, and the structured editor supports 16 by 16. One formula is limited to 15000 characters, an imported result to 160000 characters, and a worksheet import to 1000 computation cells.

## License

SyMath is released under the [Apache License 2.0](LICENSE). See [NOTICE](NOTICE).

Third-party dependencies use permissive licenses (MIT, BSD-3-Clause, Apache-2.0, ISC) that are compatible with Apache-2.0. `npm run licenses` checks the license allow-list and writes `public/THIRD_PARTY_NOTICES.txt`, which is published with the build output. The inventory is `licenses/dependencies.json`. The main components are SymPy and mpmath (BSD-3-Clause), MathLive, Cortex Compute Engine, React, Three.js, and the KaTeX fonts (MIT).
