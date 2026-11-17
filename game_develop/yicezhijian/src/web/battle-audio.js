// Short synthesized air-pressure booms and rising casts; no downloaded audio assets.
export class BattleAudio {
  constructor(){this.enabled=true;this.context=null;this.events=null;this.cursor=0;}
  unlock(){
    if(!this.enabled)return;
    try{const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;this.context||=new Audio();this.context.resume().catch(()=>{});}catch{/* Audio is optional when a host denies access. */}
  }
  toggle(){this.enabled=!this.enabled;if(this.enabled)this.unlock();return this.enabled;}
  sync(state){
    if(this.events!==state.events){this.events=state.events;this.cursor=0;}
    const pending=(state.events||[]).slice(this.cursor);this.cursor=(state.events||[]).length;
    if(!this.enabled||this.context?.state!=='running')return;
    for(const e of pending){if(e.type==='ultimate-cinematic')this.tone(110,440,.45,.035);else if(e.type==='ultimate-impact'){this.tone(e.heroId==='zhugeliang'?210:85,28,.5,e.heroId==='zhugeliang'?.04:.075);this.noise(.24,.035);}}
  }
  tone(from,to,duration,volume){const c=this.context,osc=c.createOscillator(),gain=c.createGain(),now=c.currentTime;osc.type='sine';osc.frequency.setValueAtTime(from,now);osc.frequency.exponentialRampToValueAtTime(to,now+duration);gain.gain.setValueAtTime(volume,now);gain.gain.exponentialRampToValueAtTime(.001,now+duration);osc.connect(gain).connect(c.destination);osc.start(now);osc.stop(now+duration);osc.onended=()=>{osc.disconnect();gain.disconnect();};}
  noise(duration,volume){const c=this.context,buffer=c.createBuffer(1,Math.ceil(c.sampleRate*duration),c.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*(1-i/data.length);const source=c.createBufferSource(),filter=c.createBiquadFilter(),gain=c.createGain();source.buffer=buffer;filter.type='lowpass';filter.frequency.value=700;gain.gain.value=volume;source.connect(filter).connect(gain).connect(c.destination);source.start();source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};}
}
