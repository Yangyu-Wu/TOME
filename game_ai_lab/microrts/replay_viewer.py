"""Compact, standalone browser replays for MicroRTS experiments."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import numpy as np

from agent_core import decode_state


def snapshot(observation: np.ndarray, step: int, unit_names: list[str], **meta: Any) -> dict[str, Any]:
    """Convert a MicroRTS observation into a JSON-friendly board frame."""
    board = observation[0] if observation.ndim == 4 else observation
    state = decode_state(observation, step, unit_names)
    player = np.argmax(board[:, :, 10:13], axis=2)
    unit_type = np.argmax(board[:, :, 13 : 14 + len(unit_names)], axis=2)
    resources = np.argmax(board[:, :, 5:10], axis=2)
    units: list[dict[str, Any]] = []
    for y, x in np.argwhere(unit_type > 0):
        encoded = int(unit_type[y, x])
        if encoded - 1 >= len(unit_names):
            continue
        units.append({
            "x": int(x), "y": int(y), "owner": int(player[y, x]),
            "type": unit_names[encoded - 1],
        })
    frame: dict[str, Any] = {
        "step": int(step),
        "width": int(board.shape[1]),
        "height": int(board.shape[0]),
        "units": units,
        "resources": [[int(x), int(y), int(resources[y, x])] for y, x in np.argwhere(resources > 0)],
        "own_counts": state.own_units,
        "enemy_counts": state.enemy_units,
    }
    frame.update(meta)
    return frame


def write_replay_html(payload: dict[str, Any], output: Path) -> None:
    """Write a self-contained canvas replay with playback and frame stepping."""
    data = json.dumps(payload, ensure_ascii=True, separators=(",", ":"))
    output.parent.mkdir(parents=True, exist_ok=True)
    html = r'''<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>MicroRTS replay</title>
<style>
body{font-family:system-ui,sans-serif;margin:0;background:#10151c;color:#e8edf2}main{max-width:1100px;margin:auto;padding:20px}
h1{font-size:22px;margin:0 0 6px}#meta{color:#aab7c4;font-size:13px;margin-bottom:14px}.layout{display:grid;grid-template-columns:minmax(300px,720px) 1fr;gap:18px;align-items:start}
canvas{width:100%;aspect-ratio:1;border:1px solid #526273;background:#26313a;image-rendering:pixelated}.panel{background:#18212b;border:1px solid #344454;padding:14px;border-radius:6px}
button,select{background:#263747;color:#eef;border:1px solid #536b80;border-radius:4px;padding:7px 10px;cursor:pointer}button:hover{background:#34506a}
.controls{display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin-top:10px}input[type=range]{flex:1;min-width:180px}.stat{font-variant-numeric:tabular-nums;margin:8px 0}.legend{font-size:13px;line-height:1.7;color:#c5d1dc}.swatch{display:inline-block;width:11px;height:11px;border-radius:2px;margin-right:5px}
@media(max-width:760px){.layout{grid-template-columns:1fr}main{padding:12px}}
</style></head><body><main><h1 id="title">MicroRTS replay</h1><div id="meta"></div><div class="layout"><div><canvas id="board" width="640" height="640"></canvas><div class="controls"><button id="play">Play</button><button id="prev">&#9664;</button><button id="next">&#9654;</button><input id="scrub" type="range" min="0" value="0"><select id="speed"><option value="1200">0.5x</option><option value="600" selected>1x</option><option value="300">2x</option><option value="150">4x</option></select></div></div><aside class="panel"><div class="stat" id="step"></div><div id="details"></div><div class="legend"><span class="swatch" style="background:#52a7ff"></span>our units<br><span class="swatch" style="background:#ff6875"></span>opponent units<br><span class="swatch" style="background:#d5a84d"></span>resource</div></aside></div></main>
<script>
const data=__PAYLOAD__; const frames=data.frames||[]; let index=0, timer=null;
const canvas=document.querySelector('#board'), ctx=canvas.getContext('2d'), scrub=document.querySelector('#scrub'); scrub.max=Math.max(0,frames.length-1);
document.querySelector('#title').textContent=data.title||'MicroRTS replay'; document.querySelector('#meta').textContent=data.meta||'';
function draw(){const f=frames[index]||{width:10,height:10,units:[],resources:[]}; if(f.image){const img=new Image();img.onload=()=>{ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height)};img.src=f.image} const w=f.width||10,h=f.height||10, s=Math.min(canvas.width/w,canvas.height/h); if(f.image){document.querySelector('#step').textContent=`Frame ${index+1}/${frames.length} · step ${f.step??'-'}`;return} ctx.clearRect(0,0,canvas.width,canvas.height); ctx.fillStyle='#2b3943';ctx.fillRect(0,0,canvas.width,canvas.height);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){ctx.fillStyle=(x+y)%2?'#33434c':'#394b53';ctx.fillRect(x*s,y*s,s,s);ctx.strokeStyle='rgba(255,255,255,.06)';ctx.strokeRect(x*s,y*s,s,s)}
 for(const r of (f.resources||[])){ctx.fillStyle='#d5a84d';ctx.beginPath();ctx.arc((r[0]+.5)*s,(r[1]+.5)*s,s*.22,0,Math.PI*2);ctx.fill()}
 for(const u of (f.units||[])){ctx.fillStyle=u.owner===1?'#52a7ff':'#ff6875';ctx.fillRect(u.x*s+s*.12,u.y*s+s*.12,s*.76,s*.76);ctx.fillStyle='#10151c';ctx.font=`${Math.max(9,s*.24)}px system-ui`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText((u.type||'?')[0],(u.x+.5)*s,(u.y+.5)*s)}
 scrub.value=index; document.querySelector('#step').textContent=`Frame ${index+1}/${frames.length} · step ${f.step??'-'}`; const own=JSON.stringify(f.own_counts||{}), enemy=JSON.stringify(f.enemy_counts||{}); document.querySelector('#details').innerHTML=`<div>Our units: ${own}</div><div>Opponent: ${enemy}</div>`+(f.tactic?`<div style="margin-top:10px">Tactic: <b>${f.tactic}</b></div>`:'')+(f.prediction?`<div>Prediction: <b>${f.prediction.mode}</b>, pressure ${Number(f.prediction.attack_pressure||0).toFixed(2)}</div>`:'');}
function stop(){if(timer){clearInterval(timer);timer=null;document.querySelector('#play').textContent='Play'}} function advance(d){index=Math.max(0,Math.min(frames.length-1,index+d));draw()}
document.querySelector('#play').onclick=()=>{if(timer){stop()}else{document.querySelector('#play').textContent='Pause';timer=setInterval(()=>{if(index>=frames.length-1)stop();else advance(1)},Number(document.querySelector('#speed').value))}};
document.querySelector('#prev').onclick=()=>{stop();advance(-1)};document.querySelector('#next').onclick=()=>{stop();advance(1)};scrub.oninput=()=>{stop();index=Number(scrub.value);draw()};document.querySelector('#speed').onchange=()=>{if(timer){stop();document.querySelector('#play').click()}};draw();
</script></body></html>'''.replace("__PAYLOAD__", data)
    output.write_text(html, encoding="utf-8")
