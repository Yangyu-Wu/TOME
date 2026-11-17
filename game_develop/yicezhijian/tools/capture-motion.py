#!/usr/bin/env python3
"""Capture a deterministic close-up from the polearm control-rig inspector."""
import argparse
import functools
import http.server
from pathlib import Path
import subprocess
import sys
import tempfile
import threading

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tests'))
from browser_cdp import BrowserPage

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--hero', choices=['guanyu', 'lvbu', 'zhaoyun'], default='guanyu')
    parser.add_argument('--phase', type=float, default=.53)
    parser.add_argument('--view', type=float, default=.55)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--inspect-bounds', action='store_true')
    parser.add_argument('--scene', choices=['solo', 'duel'], default='solo')
    args = parser.parse_args()
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    with tempfile.TemporaryDirectory(prefix='yice-motion-capture-') as profile:
        filename = 'impact-duel-showcase.html' if args.scene == 'duel' else 'polearm-motion-showcase.html'
        path = f'tests/{filename}?hero={args.hero}'
        process = subprocess.Popen(['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '--headless', '--enable-gpu', '--use-angle=metal', '--no-first-run', '--no-proxy-server', '--window-size=1120,860', '--user-data-dir='+profile, '--remote-debugging-port=0', f'http://127.0.0.1:{server.server_port}/{path}'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        page = None
        try:
            page = BrowserPage(profile, process)
            page.page_url = path
            # BrowserPage uses the screenshot argument to wait for the
            # inspector's ready marker; overwrite with the sampled pose below.
            page.wait_for_result(screenshot=args.output)
            page.evaluate(f'polearmShowcase.view({args.view});polearmShowcase.sample({max(0, min(.999, args.phase))})')
            page.wait_for_result(screenshot=args.output)
            error = page.evaluate("document.querySelector('#error').textContent")
            if error:
                raise RuntimeError(error)
            print(page.evaluate("document.querySelector('#status').textContent"))
            if args.inspect_bounds:
                print(page.evaluate("""(()=>{const root=polearmShowcase.layer.source,results={};root.updateMatrixWorld(true);for(const name of ['Head','thigh_l','calf_l','spine_03']){const bone=root.getObjectByName(name),min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];root.traverse(mesh=>{if(!mesh.isSkinnedMesh||mesh.material.name!=='MI_Superhero_Male')return;mesh.skeleton.update();const skin=mesh.geometry.attributes.skinIndex,weights=mesh.geometry.attributes.skinWeight;for(let i=0;i<skin.count;i++){let weight=0;for(let c=0;c<4;c++)if(mesh.skeleton.bones[skin.getComponent(i,c)]?.name===name)weight+=weights.getComponent(i,c);if(weight<.5)continue;const p=bone.worldToLocal(mesh.localToWorld(mesh.getVertexPosition(i,root.position.clone()))).toArray();for(let c=0;c<3;c++){min[c]=Math.min(min[c],p[c]);max[c]=Math.max(max[c],p[c]);}}});results[name]={min,max};}return JSON.stringify(results)})()"""))
            print(args.output)
        finally:
            if page:
                page.close()
            process.terminate()
            process.wait(timeout=10)
            server.shutdown()
            server.server_close()

if __name__ == '__main__':
    main()
