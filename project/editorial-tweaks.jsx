/* ═══════════ STRATUM EDITORIAL — Tweaks ═══════════ */
function StratumTweaks(){
  const [t, setTweak] = useTweaks(/*EDITMODE-BEGIN*/{
    "accent": "#FF362E",
    "tickerSpeed": 60,
    "density": "regular",
    "vine": true
  }/*EDITMODE-END*/);

  const accents = {
    "#FF362E": "#C21E18", // arterial red (default)
    "#C2F84F": "#8FBF2E", // acid lime (skiper)
    "#7DD3FC": "#3DA9E0", // ice blue
    "#D4AF37": "#A8842A", // soft gold
  };

  React.useEffect(()=>{
    const root = document.documentElement.style;
    root.setProperty('--acc', t.accent);
    root.setProperty('--accd', accents[t.accent] || '#C21E18');
    const c = t.accent;
    const rgb = c.replace('#','').match(/.{2}/g).map(x=>parseInt(x,16));
    root.setProperty('--accg', `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.14)`);
    // refresh vine glow color
    const vp = document.getElementById('vinePath');
    if(vp) vp.style.filter = `drop-shadow(0 0 5px rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.65))`;
  }, [t.accent]);

  React.useEffect(()=>{
    const tr = document.getElementById('tickTrack');
    if(tr) tr.style.animationDuration = t.tickerSpeed + 's';
  }, [t.tickerSpeed]);

  React.useEffect(()=>{
    const w = document.getElementById('vineWrap');
    if(w) w.style.display = t.vine ? '' : 'none';
    if(t.vine && window.__rebuildVine) window.__rebuildVine();
  }, [t.vine]);

  React.useEffect(()=>{
    const map = { compact:'clamp(56px,8vw,104px)', regular:'clamp(80px,11vw,150px)', spacious:'clamp(110px,15vw,210px)' };
    document.querySelectorAll('section.band').forEach(s=>{ s.style.paddingTop=''; s.style.paddingBottom=''; });
    const pad = map[t.density];
    const sheetId='__density'; let st=document.getElementById(sheetId);
    if(!st){ st=document.createElement('style'); st.id=sheetId; document.head.appendChild(st); }
    st.textContent = `section.band{padding-top:${pad};padding-bottom:${pad};}`;
  }, [t.density]);

  return (
    <TweaksPanel title="Tweaks">
      <TweakSection label="Accent" />
      <TweakColor
        title="Drawing line + accent"
        subtitle="Red · Lime · Ice · Gold"
        options={Object.keys(accents)}
        value={t.accent}
        onChange={(v)=>setTweak('accent', v)}
      />
      <TweakToggle label="Scroll vine" value={t.vine} onChange={(v)=>setTweak('vine', v)} />
      <TweakSection label="Rhythm" />
      <TweakRadio label="Section spacing" value={t.density}
        options={['compact','regular','spacious']}
        onChange={(v)=>setTweak('density', v)} />
      <TweakSlider label="Ticker speed" value={t.tickerSpeed} min={20} max={120} step={5} unit="s"
        onChange={(v)=>setTweak('tickerSpeed', v)} />
    </TweaksPanel>
  );
}

(function mount(){
  const root = document.getElementById('tweaks-root');
  if(!root || !window.useTweaks){ setTimeout(mount, 60); return; }
  ReactDOM.createRoot(root).render(<StratumTweaks />);
})();
