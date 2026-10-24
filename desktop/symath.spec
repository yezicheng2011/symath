# PyInstaller spec for the SyMath desktop app. Run from the repository root after `npm run build`:
#   pyinstaller desktop/symath.spec --noconfirm
# macOS: set SYMATH_TARGET_ARCH=universal2 with a universal2 python.org Python to get one arm64+x86_64 .app.
import os
import sys
from PyInstaller.utils.hooks import collect_submodules

ROOT = os.path.abspath(os.getcwd())
VERSION = os.environ.get('SYMATH_VERSION', '1.0.0')
TARGET_ARCH = os.environ.get('SYMATH_TARGET_ARCH') or None

hidden = collect_submodules('sympy') + collect_submodules('mpmath') + ['backend', 'backend.engine', 'backend.server']

a = Analysis(
    [os.path.join(ROOT, 'desktop', 'symath_desktop.py')],
    pathex=[ROOT],
    datas=[
        (os.path.join(ROOT, 'dist'), 'dist'),
        (os.path.join(ROOT, 'shared', 'operations.json'), 'shared'),
        (os.path.join(ROOT, 'LICENSE'), '.'),
        (os.path.join(ROOT, 'NOTICE'), '.'),
    ],
    hiddenimports=hidden,
    excludes=['tkinter', 'matplotlib', 'IPython', 'pytest', 'PyQt5', 'PyQt6', 'PySide2', 'PySide6', 'gi'],
    noarchive=False,
)
pyz = PYZ(a.pure)

if sys.platform == 'darwin':
    exe = EXE(pyz, a.scripts, [], exclude_binaries=True, name='SyMath', console=False,
              target_arch=TARGET_ARCH, codesign_identity=None, upx=False)
    coll = COLLECT(exe, a.binaries, a.datas, name='SyMath', upx=False)
    app = BUNDLE(coll, name='SyMath.app', icon=None, bundle_identifier='io.github.yezicheng2011.symath',
                 version=VERSION,
                 info_plist={'CFBundleShortVersionString': VERSION, 'CFBundleVersion': VERSION,
                             'CFBundleDisplayName': 'SyMath', 'NSHighResolutionCapable': True,
                             'LSMinimumSystemVersion': '11.0', 'NSHumanReadableCopyright': 'Copyright 2026 daniel.ye. Apache-2.0'})
else:
    # One self-contained SyMath.exe (onefile). Windows uses the system WebView2 runtime for the window.
    exe = EXE(pyz, a.scripts, a.binaries, a.datas, [], name='SyMath', console=False, upx=False,
              version=os.path.join(ROOT, 'build', 'win-version.txt') if os.path.exists(os.path.join(ROOT, 'build', 'win-version.txt')) else None)
