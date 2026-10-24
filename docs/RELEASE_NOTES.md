SyMath 桌面版：本机运行 SymPy 内核与完整界面，无需联网。

| 文件 | 平台 |
| --- | --- |
| `SyMath-<版本>-macOS-universal.dmg` | macOS 11+，Apple 芯片与 Intel 通用（arm64 + x86_64） |
| `SyMath-<版本>-Windows-x64.exe` | Windows 10/11 x64，单文件，直接运行 |
| `SyMath-self-signed-codesign.cer` | Windows 自签名证书公钥（可选导入） |
| `SHA256SUMS.txt` | 校验和 |

**签名说明（免费签名，没有付费证书）**

- macOS：ad-hoc 签名（`codesign -s -`），未经 Apple 公证。首次打开会提示“无法验证开发者”或“Apple 无法验证其是否包含恶意软件”，**不会**提示“已损坏”。打开方式：把 SyMath 拖到“应用程序”→ 双击一次 → 打开“系统设置 → 隐私与安全性”，点“仍要打开”。macOS 14 及更早也可以按住 Control 点按 →“打开”。
- Windows：自签名 Authenticode 证书。SmartScreen 会提示“Windows 已保护你的电脑 / 未知发布者”，点“更多信息 → 仍要运行”。

English: the macOS build is ad-hoc signed (not notarized) – use System Settings → Privacy & Security → *Open Anyway* on first launch. The Windows build is signed with a self-signed certificate – choose *More info → Run anyway* in SmartScreen.
