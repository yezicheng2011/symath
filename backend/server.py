"""Loopback-only HTTP gateway; each mathematical job runs in a bounded process."""
import argparse
import json
import multiprocessing as mp
import os
import re
try:
    import resource  # POSIX only
except ImportError:  # Windows desktop build
    resource=None
import signal
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from backend import engine

LIMIT=30
MEMORY_LIMIT=int(os.environ.get('SYMATH_MEMORY_MB','1536'))*1024**2
# Browser origins allowed to POST to the API (comma separated). Same-origin requests from the
# desktop app are added at runtime. Configure your public origin via SYMATH_ALLOWED_ORIGINS.
ALLOWED_ORIGINS={o.strip() for o in os.environ.get('SYMATH_ALLOWED_ORIGINS','http://127.0.0.1:5173,http://localhost:5173').split(',') if o.strip()}
STATIC_ROOT=None
STATIC_TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8',
              '.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png',
              '.ico':'image/x-icon','.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf','.txt':'text/plain; charset=utf-8',
              '.wasm':'application/wasm','.map':'application/json'}
SLOTS=threading.BoundedSemaphore(4)
JOBS={}
LOCK=threading.Lock()
PROCESS=mp.get_context('spawn')

def execute_job(connection, action, payload):
    try:
        if resource is not None:
            try:resource.setrlimit(resource.RLIMIT_AS,(MEMORY_LIMIT,MEMORY_LIMIT))
            except (ValueError,OSError):pass  # e.g. macOS may refuse RLIMIT_AS; the parent still enforces the deadline
        if hasattr(signal,'SIGALRM'):
            signal.signal(signal.SIGALRM,lambda *_: (_ for _ in ()).throw(TimeoutError('计算超过 30 秒，已停止。')))
            signal.alarm(LIMIT)
        result=engine.plot(payload) if action=='plot' else engine.calculate(payload)
        connection.send({'result':result})
    except Exception as error:
        message=str(error)
        if isinstance(error,TimeoutError):message='计算超过 30 秒，已停止。请分步计算或降低规模。'
        elif not re.search('[\u4e00-\u9fff]',message):
            translations={'NonInvertibleMatrixError':'矩阵不可逆。','NonSquareMatrixError':'此运算需要方阵。',
                          'ShapeError':'矩阵维度不匹配。','PolynomialError':'需要关于所选变量的多项式。',
                          'NotImplementedError':'当前算法未实现此情形，保留原式或尝试其他方法。',
                          'ZeroDivisionError':'运算中出现除零或奇点。','MemoryError':'计算超过单任务内存限制。'}
            message=translations.get(type(error).__name__,'无法完成这项运算，请检查输入、变量和数学条件。')
        connection.send({'error':message[:1000],'code':type(error).__name__})
    finally:
        if hasattr(signal,'SIGALRM'):signal.alarm(0)
        connection.close()

class Handler(BaseHTTPRequestHandler):
    server_version='SyMath/2'
    def log_message(self,fmt,*args):
        # Do not persist mathematical requests or session data in the service log.
        if args and isinstance(args[0],str) and '/health' in args[0]:return
        super().log_message(fmt,*args)

    def send_json(self,data,status=200):
        encoded=json.dumps(data,ensure_ascii=False,allow_nan=False).encode()
        self.send_response(status);self.send_header('Content-Type','application/json; charset=utf-8')
        self.send_header('Content-Length',str(len(encoded)));self.send_header('Cache-Control','no-store')
        self.end_headers()
        try:self.wfile.write(encoded)
        except (BrokenPipeError,ConnectionResetError):pass

    def do_GET(self):
        if self.path=='/api/health':
            self.send_json({'ok':True,'engine':'SymPy','version':engine.s.__version__,'operations':len(engine.CATALOG),'concurrency':4,'timeout':LIMIT})
        elif self.path=='/api/catalog':self.send_json(engine.CATALOG)
        elif STATIC_ROOT and not self.path.startswith('/api/'):self.send_static()
        else:self.send_json({'error':'未找到接口。'},404)

    def send_static(self):
        """Serve the built front end (desktop builds / single-process deployments)."""
        from urllib.parse import unquote,urlsplit
        relative=unquote(urlsplit(self.path).path).lstrip('/') or 'index.html'
        root=os.path.realpath(STATIC_ROOT)
        target=os.path.realpath(os.path.join(root,relative))
        if os.path.commonpath([root,target])!=root or any(part.startswith('.') for part in relative.split('/')):
            self.send_json({'error':'未找到。'},404);return
        if os.path.isdir(target):target=os.path.join(target,'index.html')
        if not os.path.isfile(target):
            self.send_json({'error':'未找到。'},404);return
        with open(target,'rb') as handle:body=handle.read()
        self.send_response(200)
        self.send_header('Content-Type',STATIC_TYPES.get(os.path.splitext(target)[1].lower(),'application/octet-stream'))
        self.send_header('Content-Length',str(len(body)))
        self.send_header('X-Content-Type-Options','nosniff')
        self.send_header('Cache-Control','no-cache' if target.endswith('.html') else 'max-age=86400')
        self.end_headers()
        try:self.wfile.write(body)
        except (BrokenPipeError,ConnectionResetError):pass

    def do_POST(self):
        if self.path not in ('/api/calculate','/api/plot','/api/cancel'):
            self.send_json({'error':'未找到接口。'},404);return
        origin=self.headers.get('Origin')
        if origin and origin not in ALLOWED_ORIGINS:
            self.send_json({'error':'请求来源不允许。'},403);return
        try:
            size=int(self.headers.get('Content-Length','0'))
            if not 0<size<=400000:raise ValueError()
            payload=json.loads(self.rfile.read(size))
            if not isinstance(payload,dict):raise ValueError()
            identifier=payload.get('id','')
            if not isinstance(identifier,str) or not re.fullmatch(r'[A-Za-z0-9-]{16,64}',identifier):raise ValueError()
        except (ValueError,TypeError,json.JSONDecodeError):
            self.send_json({'error':'请求格式错误或请求体过大。'},400);return
        if self.path=='/api/cancel':
            with LOCK:
                job=JOBS.get(identifier)
                if job and job.is_alive():job.terminate()
            self.send_json({'cancelled':bool(job)});return
        if not SLOTS.acquire(blocking=False):
            self.send_json({'error':'计算队列繁忙，请稍后重试。'},503);return
        parent,child=PROCESS.Pipe(duplex=False)
        process=PROCESS.Process(target=execute_job,args=(child,self.path.rsplit('/',1)[-1],payload),daemon=True)
        try:
            with LOCK:
                if identifier in JOBS:
                    self.send_json({'error':'重复任务标识。'},409);return
                process.start();JOBS[identifier]=process
            child.close()
            deadline=time.monotonic()+LIMIT+5
            response=None
            while time.monotonic()<deadline:
                if parent.poll(.1):
                    try:response=parent.recv()
                    except EOFError:response={'error':'计算已取消或工作进程已停止。'}
                    break
                if not process.is_alive():break
            self.send_json(response or {'error':'计算已取消、超时，或超出资源限制。'})
        except Exception:
            self.send_json({'error':'计算服务暂时不可用。'},500)
        finally:
            with LOCK:
                if JOBS.get(identifier) is process:JOBS.pop(identifier,None)
            if process.pid:
                if process.is_alive():process.terminate()
                process.join(1)
            parent.close();child.close();SLOTS.release()

def create_server(port=8765,static_root=None):
    """Bind on loopback only. port=0 picks a free port (used by the desktop app)."""
    global STATIC_ROOT
    STATIC_ROOT=static_root
    server=ThreadingHTTPServer(('127.0.0.1',port),Handler)
    actual=server.server_address[1]
    ALLOWED_ORIGINS.update({f'http://127.0.0.1:{actual}',f'http://localhost:{actual}'})
    return server

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--port',type=int,default=int(os.environ.get('SYMATH_PORT','8765')))
    parser.add_argument('--static',default=os.environ.get('SYMATH_STATIC_DIR') or None,help='optional: serve the built front end (dist/) from this directory')
    args=parser.parse_args()
    server=create_server(args.port,args.static)
    print(f'SyMath API: http://127.0.0.1:{server.server_address[1]} — SymPy {engine.s.__version__}',flush=True)
    try:server.serve_forever()
    finally:server.server_close()

if __name__=='__main__':main()
