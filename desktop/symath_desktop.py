"""SyMath desktop launcher.

Starts the SymPy API on a random loopback port, serves the built front end from the same
origin and shows it in a native window (pywebview). If no native web view is available it
falls back to the default browser. Everything runs offline on this computer.
"""
import multiprocessing as mp
import os
import sys
import threading
import webbrowser


def resource_root():
    # PyInstaller unpacks/bundles data next to the executable (sys._MEIPASS).
    return getattr(sys, '_MEIPASS', os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def setup_logging():
    """Windowed builds have no console (sys.stdout is None): write a small log for troubleshooting."""
    path = os.environ.get('SYMATH_LOG')
    if not path and sys.stdout is not None and sys.stderr is not None:
        return
    import tempfile
    try:
        handle = open(path or os.path.join(tempfile.gettempdir(), 'SyMath.log'), 'a', encoding='utf-8', buffering=1)
    except OSError:
        return
    sys.stdout = sys.stderr = handle


def main():
    setup_logging()
    root = resource_root()
    if root not in sys.path:
        sys.path.insert(0, root)
    from backend import server as api

    static_dir = os.path.join(root, 'dist')
    if not os.path.isfile(os.path.join(static_dir, 'index.html')):
        sys.exit(f'SyMath: front end not found at {static_dir}; run `npm run build` first.')
    httpd = api.create_server(int(os.environ.get('SYMATH_DESKTOP_PORT', '0')), static_dir)
    url = f'http://127.0.0.1:{httpd.server_address[1]}/'
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    print(f'SyMath running at {url}', flush=True)

    if os.environ.get('SYMATH_NO_WINDOW') == '1':  # headless smoke tests
        threading.Event().wait()
        return
    try:
        import webview
        webview.create_window('SyMath · 符号数学工作站', url, width=1440, height=920, min_size=(960, 640))
        webview.start()
    except Exception as error:  # no WebView2 / WebKit available: use the default browser instead
        print(f'Native window unavailable ({error}); opening the default browser.', flush=True)
        webbrowser.open(url)
        try:
            threading.Event().wait()
        except KeyboardInterrupt:
            pass
    finally:
        httpd.shutdown()


if __name__ == '__main__':
    mp.freeze_support()  # required: calculations run in spawned worker processes
    try:
        main()
    except SystemExit:
        raise
    except BaseException:
        import traceback
        traceback.print_exc()
        raise
