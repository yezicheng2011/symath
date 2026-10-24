# SyMath · 符号数学工作站

[![CI](https://github.com/yezicheng2011/symath/actions/workflows/ci.yml/badge.svg)](https://github.com/yezicheng2011/symath/actions/workflows/ci.yml)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

SyMath 是一个面向数学公式输入的计算机代数系统（CAS）工作站：浏览器里用排版公式（MathLive）输入，服务器或本机上的 **SymPy 1.14 + mpmath** 做精确符号运算和高精度数值，配合二维/三维绘图、动态几何、数据工作表和计算流水线。

本项目原为线上服务“墨域 CAS”（cas.aeroandroid.com），现以 **Apache License 2.0** 开源。

- 在线版：<https://cas.aeroandroid.com/>
- 桌面版（macOS 通用 / Windows，离线运行）：见 [Releases](https://github.com/yezicheng2011/symath/releases)

## 产品范围

- **符号运算**：106 项注册运算，完整列表与参数见 `shared/operations.json`。包括多项式、Groebner 基、周期方程解集、非线性方程组、不等式、丢番图方程、ODE 及初始条件、递推方程、反常积分、单侧极限、Taylor/Laurent 级数、无穷和积、Laplace/Fourier 变换、多元微分、矩阵分解、数论、统计、回归、解析几何。
- **数学输入**：排版公式、数学模板、虚拟键盘、逐格矩阵与逐行方程组。结果可编辑、重算、继续计算、复制或保存为会话变量；支持用户函数。
- **图形**：多条二维函数曲线、参数曲线、极坐标、隐式曲线、可旋转和缩放的 WebGL 曲面，SVG/PNG 导出。参数区间与坐标范围分别设置。修改图形输入后会标记需要重新生成。
- **动态几何**：点、直线、线段、圆、三角形、多边形、关联中点及交点。拖动自由点会更新依赖构造。支持数值长度、面积、周长与坐标查看，并可把多边形送入精确符号运算。
- **数据工作表**：CSV 导入导出、多格粘贴、引用和安全公式解释器、循环引用检查、散点图、汇总统计，以及数据到精确统计、相关系数和最小二乘拟合的转换。
- **计算流水线**：可视化排列、移动、执行符号转换步骤，保留各步结果。
- **工作表**：多文档、本地自动保存、结果变更撤销、重命名、完整导入导出。v2 格式包含会话定义、表格、几何、流水线和图形配置；读取兼容第一版工作表。修改会话定义后，原计算单元标记为需要重算。

## 与 Xcas 的实际差异

目标是对标 Xcas 的专业使用体验和数学功能覆盖，但本项目**并非 Giac，尚未实现 Xcas 的全部算法和功能**。应用的“帮助 → Xcas 功能对照”公开当前范围。

主要缺口包括：Xcas 编程语言兼容、带分支循环的程序、三维关联几何、完整几何约束和轨迹、参数曲面和矢量场，以及 Giac 特有算法和命令的逐项兼容。SymPy 与 Giac 在算法、性能、特殊函数和某些数学情形上存在差异。不能以 106 项运算或模块数量宣称完全等价。

Giac/Xcas 采用 GPL-3.0；本项目**没有使用 Giac/Xcas 的任何代码**，只在功能上对标。

## 下载桌面版

到 [Releases](https://github.com/yezicheng2011/symath/releases) 下载：

- **macOS**（11 及以上，Apple 芯片与 Intel 通用）：`SyMath-<版本>-macOS-universal.dmg`，打开后把 SyMath 拖进“应用程序”。
- **Windows**（10/11 x64）：`SyMath-<版本>-Windows-x64.exe`，单文件，双击运行。窗口使用系统自带的 WebView2；若系统缺少 WebView2，会自动改用默认浏览器打开。

桌面版在本机启动只监听 `127.0.0.1` 的计算服务，前端与内核全部打包在应用内，**不联网、不上传任何数据**。

签名均为免费方式，首次打开会有提示（不会显示“已损坏”）：

- macOS 为 ad-hoc 签名，未经 Apple 公证：首次双击后，到“系统设置 → 隐私与安全性”点“仍要打开”（macOS 14 及更早也可按住 Control 点按 →“打开”）。
- Windows 为自签名证书：SmartScreen 提示“未知发布者”时点“更多信息 → 仍要运行”。

## 本地开发

要求 Node.js 22+、npm 10+、Python 3.12+。

```bash
python3 -m venv .venv
.venv/bin/pip install -r backend/requirements.txt
npm ci
```

两个终端分别运行：

```bash
npm run api  # 127.0.0.1:8765，仅监听回环地址
npm run dev  # 127.0.0.1:5173，/api 代理到 8765
```

也可以构建后用单进程同时提供界面和 API：

```bash
npm run build
.venv/bin/python -m backend.server --port 8765 --static dist
# 打开 http://127.0.0.1:8765/
```

本地运行桌面窗口（需要 `pip install -r desktop/requirements.txt`）：

```bash
.venv/bin/python desktop/symath_desktop.py
```

## 验证

```bash
npm test                    # 前端数据、几何、解析、导入测试 + Python 内核测试
npm run build               # 本地字体、前后端许可审计、类型检查、Vite 构建
npx playwright install chromium
node tests/browser.mjs      # 运行开发服务后测试真实界面和键盘输入
```

内核测试会把目录中全部 106 项示例通过真实 LaTeX 解析器转成 MathJSON，再执行对应运算，并额外核查精确性、解集、发散积分、矩阵、ODE 初值、用户函数、流水线、精度和安全输入。

## 服务架构

```text
Browser / MathLive / Compute Engine
  → validated MathJSON over HTTPS
  → Nginx /api/
  → loopback HTTP service (backend/server.py)
  → one bounded Python process per mathematical job
  → SymPy / mpmath
```

服务使用显式数学构造器白名单解码 MathJSON，不把用户输入交给 Python `eval`、`exec`、`sympify` 或字符串表达式解析器。数值绘图的 lambdify 只接收已验证的数学树和标识符。电子表格使用独立的受限解释器，不执行 JavaScript。

单任务 30 秒、单进程约 1.5 GiB 内存（Linux/macOS）、最多 4 个并发任务；主动取消会终止对应计算进程。工作表数据只保存在浏览器本地；服务不持久化计算请求。

### 运行时环境变量

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `SYMATH_ALLOWED_ORIGINS` | `http://127.0.0.1:5173,http://localhost:5173` | 允许调用 API 的浏览器来源，逗号分隔；部署时设为你的 `https://域名` |
| `SYMATH_PORT` | `8765` | API 端口（仅 127.0.0.1） |
| `SYMATH_STATIC_DIR` | 空 | 设置后同时提供 `dist/` 静态界面 |
| `SYMATH_MEMORY_MB` | `1536` | 单任务内存上限（POSIX） |

## 服务器部署（Nginx + systemd）

```bash
cp .env.example .env   # 填写 SYMATH_DOMAIN 等，不需要任何密钥
bash scripts/deploy.sh
```

`deploy/` 下是 Nginx、systemd 和证书续期钩子的模板（`__DOMAIN__` 等占位符由脚本按 `.env` 填写）。HTTPS 证书请先用 certbot 为你的域名申请（可先用 `deploy/nginx-http-bootstrap.conf.template` 完成 HTTP 验证）。脚本会测试、构建、发布带时间戳的版本目录，检查 API 健康后切换静态站点并 `nginx -t && reload`。

## 桌面版构建

桌面版用 PyInstaller 打包（`desktop/symath.spec`），窗口由 pywebview 提供。GitHub Actions（`.github/workflows/release.yml`）在推送 `v*` 标签时自动：

1. macOS：用 python.org 的 universal2 Python 构建 arm64+x86_64 通用 `SyMath.app`，逐个检查 Mach-O 均含两种架构，ad-hoc 签名并校验，打包 DMG；
2. Windows：构建单文件 `SyMath.exe`，用 CI 临时生成的自签名证书做 Authenticode 签名；
3. 两个平台都会实际启动应用做冒烟计算测试，然后发布到 GitHub Release。

## 数学与实现边界

- 没有任何通用 CAS 能解出所有数学问题。条件集合和未求值的积分、导数、和积等会保留原形并明确提示。
- 多元非线性求解的参数退化情形仍需结合原式判断。数值求根依赖初值，不保证找全全部根。代数变形继承原定义域和所选变量假设。
- 微分方程与递推支持可选初始位置、函数初值及一阶导数／下一项初值；更一般的边值问题尚未接入专门界面。
- 高精度计算支持 10–500 位目标有效数字。精度目标不等于对所有病态问题的误差保证。
- 图形和几何测量是数值可视化，不能代替连续性或几何命题证明。极点、未定义位置和采样分辨率可能影响图像。
- 数据表支持 500 行 × 26 列。矩阵内核入口支持 32 × 32，结构化编辑器支持 16 × 16。单条公式上限 15000 字符，导入结果上限 160000 字符，工作表导入上限 1000 个计算单元。

## 许可证

SyMath 以 [Apache License 2.0](LICENSE) 发布，见 [NOTICE](NOTICE)。

第三方依赖均为宽松许可证（MIT、BSD-3-Clause、Apache-2.0、ISC），与 Apache-2.0 兼容；`npm run licenses` 会校验许可白名单并生成 `public/THIRD_PARTY_NOTICES.txt`（随构建产物发布），清单见 `licenses/dependencies.json`。主要组件：SymPy、mpmath（BSD-3-Clause）、MathLive、Cortex Compute Engine、React、Three.js、KaTeX 字体（MIT）。

---

## English

**SyMath** is a computer-algebra workstation: structured math input (MathLive) in the browser, exact symbolic computation with **SymPy + mpmath** on a loopback-only Python service, plus 2D/3D plotting, dynamic geometry, data sheets and computation pipelines (106 registered operations, see `shared/operations.json`).

- Desktop builds (offline; macOS universal DMG, Windows x64 EXE) are on the [Releases](https://github.com/yezicheng2011/symath/releases) page. They are signed for free (macOS ad-hoc, Windows self-signed), so the first launch shows an "unverified developer"/SmartScreen prompt.
- Dev: `python3 -m venv .venv && .venv/bin/pip install -r backend/requirements.txt && npm ci`, then `npm run api` and `npm run dev`.
- Server deploy: copy `.env.example` to `.env`, then `bash scripts/deploy.sh`.
- Not a Giac/Xcas port and contains no GPL code. Licensed under Apache-2.0.
