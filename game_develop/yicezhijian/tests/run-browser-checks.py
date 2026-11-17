#!/usr/bin/env python3
"""Run the native browser tests without npm; optionally capture visual acceptance frames."""
import argparse
import concurrent.futures
import functools
import html
import http.server
import json
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import threading
from browser_cdp import BrowserPage


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--chrome', help='Chrome/Chromium executable')
    parser.add_argument('--screenshots', type=Path, help='Write acceptance PNGs to this directory')
    parser.add_argument('--only', help='Run just one test filename')
    parser.add_argument('--real-time', action='store_true', help='Compatibility flag; checks now always wait for actual results using the real clock')
    args = parser.parse_args()
    chrome = args.chrome or shutil.which('chromium') or shutil.which('google-chrome') or '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    if not Path(chrome).is_file():
        parser.error('Chrome not found; specify --chrome /path/to/chrome')
    root = Path(__file__).resolve().parents[1]
    handler = functools.partial(QuietHandler, directory=str(root))
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base = 'http://127.0.0.1:' + str(server.server_port) + '/'

    def browser(page, screenshot=None):
        with tempfile.TemporaryDirectory(prefix='yice-browser-check-') as profile:
            command = [chrome, '--headless', '--enable-gpu', '--use-angle=metal', '--no-first-run', '--no-default-browser-check', '--no-proxy-server', '--hide-scrollbars', '--window-size=960,680', '--user-data-dir=' + profile, '--remote-debugging-port=0']
            process = None
            client = None
            try:
                with tempfile.TemporaryFile() as browser_log:
                    process = subprocess.Popen(command + [base + page], stdout=browser_log, stderr=browser_log)
                    client = BrowserPage(profile, process)
                    client.page_url = base + page
                    dom = client.wait_for_result(home=page == 'index.html', screenshot=screenshot)
                if screenshot:
                    error = re.search(r'<pre id="error">(.*?)</pre>', dom, re.S)
                    return {'page': page, 'pass': screenshot.is_file() and 'data-ready="true"' in dom and bool(error) and not error.group(1), 'screenshot': str(screenshot), 'error': html.unescape(error.group(1)) if error else 'Missing ready/error indicator'}
                if page == 'index.html':
                    checks = {'title': '<title>一策之间 · 三国自走棋</title>' in dom, 'deployment': 'class="deployment test-deployment"' in dom, 'allHeroes': '59 / 59 位' in dom, 'soundToggle': 'id="sound-toggle"' in dom}
                    return {'page': page, 'pass': all(checks.values()), 'checks': checks}
                match = re.search(r'<pre id="result">(.*?)</pre>', dom, re.S)
                data = json.loads(html.unescape(match.group(1))) if match else {'pass': False, 'error': 'No test result'}
                return {'page': page, **data}
            except Exception as error:
                return {'page': page, 'pass': False, 'error': str(error)}
            finally:
                if client:
                    client.close()
                if process:
                    process.terminate()
                    try:
                        process.wait(timeout=5)
                    except subprocess.TimeoutExpired:
                        process.kill()
                        process.wait()

    try:
        pages = ['tests/' + args.only] if args.only else ['index.html'] + ['tests/' + p.name for p in sorted((root / 'tests').glob('*.test.html')) if p.name != 'battle-render.test.html']
        # WebGL tests allocate independent GPU contexts and large temporary
        # profiles. Serializing them avoids sporadic Chrome/CDP disconnects on
        # integrated GPUs while keeping each page's real-time checks intact.
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
            results = list(pool.map(browser, pages))
        for result in results:
            print(json.dumps(result, ensure_ascii=False), flush=True)
        if args.screenshots:
            args.screenshots.mkdir(parents=True, exist_ok=True)
            scenes = [(f'{hero}-{phase}', f'hero={hero}&scene={phase}') for hero in ['guanyu', 'zhouyu', 'zhugeliang'] for phase in ['cinematic', 'flight', 'impact']]
            scenes += [('airburst', 'hero=lvbu&scene=impact'), ('sonic', 'hero=zhaoyun&scene=impact'), ('tornado', 'hero=pangtong&scene=field'), ('night-fire', 'hero=zhouyu&scene=field&time=66')]
            scenes += [(name, 'scene=' + name) for name in ['boss', 'army', 'entry']]
            scenes += [(name, f'scene=environment&time={time}') for name, time in [('dawn', 0), ('day', 22), ('dusk', 44), ('night', 66)]]
            def capture(scene):
                name, query = scene
                return browser('tests/vfx-showcase.html?' + query, args.screenshots / (name + '.png'))
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                captures = list(pool.map(capture, scenes))
            results += captures
            for capture in captures:
                print(json.dumps(capture, ensure_ascii=False), flush=True)
            gpu_capture = browser('tests/gpu-hero-showcase.html', args.screenshots / 'gpu-heroes.png')
            results.append(gpu_capture)
            print(json.dumps(gpu_capture, ensure_ascii=False), flush=True)
        passed = sum(result['pass'] is True for result in results)
        print(json.dumps({'passed': passed, 'total': len(results)}))
        return 0 if passed == len(results) else 1
    finally:
        server.shutdown()
        server.server_close()


if __name__ == '__main__':
    raise SystemExit(main())
