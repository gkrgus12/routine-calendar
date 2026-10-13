#!/usr/bin/env python3
"""tests/t-*.html 을 헤드리스 Chrome 으로 돌려 PASS/FAIL 을 모은다.

사용: python tests/run.py [--only 이름조각] [--verbose] [--timeout 초]
- 저장소 루트를 임시 로컬 HTTP 서버로 서빙하고, 하네스마다 새 프로필의 헤드리스 Chrome 을 띄워
  --force-prefers-reduced-motion + 가상 시간으로 열고 --dump-dom 결과에서 <pre id="RESULT"> JSON 을 읽는다
- 파일 첫 줄의 <!-- variants: s=A s=B@600x800 --> 로 변형(쿼리, 창 크기)을 여러 번 연다. 기본 창 1400x900
- 실패(FAIL/EXCEPTION/결과 없음)가 하나라도 있으면 종료 코드 1
- Chrome 경로: 환경변수 CHROME, 아니면 PATH·기본 설치 위치
"""
import argparse, functools, glob, html, json, os, re, shutil, subprocess, sys, tempfile, threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TESTS = os.path.join(ROOT, 'tests')
if hasattr(sys.stdout, 'reconfigure'):  # Windows 콘솔 기본 cp949 로는 한글·특수문자 출력이 깨지거나 실패한다
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')


def find_chrome():
    cands = [os.environ.get('CHROME'), shutil.which('chrome'), shutil.which('google-chrome'), shutil.which('chromium'),
             shutil.which('chromium-browser'),
             r'C:\Program Files\Google\Chrome\Application\chrome.exe',
             r'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
             os.path.join(os.environ.get('LOCALAPPDATA', ''), 'Google', 'Chrome', 'Application', 'chrome.exe'),
             '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
    for c in cands:
        if c and os.path.isfile(c):
            return c
    sys.exit('Chrome 을 찾지 못했어요. 환경변수 CHROME 에 실행 파일 경로를 넣으세요')


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def serve():
    srv = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=ROOT))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


def variants(path):
    with open(path, encoding='utf-8') as f:
        head = f.read(2000)
    m = re.search(r'<!--\s*variants:\s*(.*?)-->', head)
    out = []
    for tok in (m.group(1).split() if m else ['']):
        q, _, wh = tok.partition('@')
        out.append((q.lstrip('?'), wh or '1400x900'))
    return out


def run_one(chrome, url, wh, timeout):
    profile = tempfile.mkdtemp(prefix='rc-test-')
    args = [chrome, '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
            '--user-data-dir=' + profile, '--force-prefers-reduced-motion', '--virtual-time-budget=60000',
            '--window-size=' + wh.replace('x', ','), '--enable-logging=stderr', '--v=0', '--dump-dom', url]
    console = ''
    try:
        p = subprocess.run(args, capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=timeout)
        out, err = p.stdout, p.stderr
    except subprocess.TimeoutExpired as e:
        out, err = '', (e.stderr.decode('utf-8', 'replace') if isinstance(e.stderr, bytes) else (e.stderr or ''))
        console = '\n'.join(l for l in err.splitlines() if 'CONSOLE' in l)[-1500:]
        return None, 'timeout (%ds)\n%s' % (timeout, console)
    finally:
        shutil.rmtree(profile, ignore_errors=True)
    m = re.search(r'<pre id="RESULT">(.*?)</pre>', out, re.S)
    if not m:
        console = '\n'.join(l for l in err.splitlines() if 'CONSOLE' in l)[-1500:]
        return None, (out[-800:] + '\n' + console)
    return json.loads(html.unescape(m.group(1))), None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', default='', help='파일 이름에 이 조각이 들어간 하네스만')
    ap.add_argument('--verbose', action='store_true', help='하네스의 log 도 출력')
    ap.add_argument('--timeout', type=int, default=120)
    a = ap.parse_args()
    chrome = find_chrome()
    files = sorted(f for f in glob.glob(os.path.join(TESTS, 't-*.html')) if a.only in os.path.basename(f))
    if not files:
        sys.exit('돌릴 하네스가 없어요 (tests/t-*.html)')
    srv = serve()
    base = 'http://127.0.0.1:%d/tests/' % srv.server_address[1]
    passed = failed = runs = 0
    try:
        for f in files:
            name = os.path.basename(f)
            for q, wh in variants(f):
                runs += 1
                url = base + name + ('?' + q if q else '')
                print('== %s%s  (%s)' % (name, ' ?' + q if q else '', wh))
                res, err = run_one(chrome, url, wh, a.timeout)
                if res is None:
                    failed += 1
                    print('  FAIL (RESULT 없음) ::', (err or '').strip()[:1200].replace('\n', '\n      '))
                    continue
                for line in res.get('checks', []):
                    ok = line.startswith('PASS')
                    passed += ok
                    failed += (not ok)
                    print('  ' + line)
                if a.verbose:
                    for l in res.get('log', []):
                        print('    log:', l)
    finally:
        srv.shutdown()
    print('\n결과: 통과 %d · 실패 %d · 실행 %d회 (%d파일)' % (passed, failed, runs, len(files)))
    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main()
