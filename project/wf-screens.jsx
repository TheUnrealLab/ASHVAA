// wf-screens.jsx — STRATUM App Wireframes

const WF = {
  bg:   '#0c0c0e',
  pan:  '#141416',
  p2:   '#1c1c1f',
  p3:   '#232327',
  brd:  'rgba(255,255,255,0.09)',
  brd2: 'rgba(255,255,255,0.16)',
  t:    '#d4d4d8',
  mt:   '#71717a',
  dim:  '#3f3f46',
  gold: '#D4AF37',
  teal: '#7DD3FC',
  red:  '#E5645C',
  grn:  '#7DD389',
  amb:  '#F59E0B',
  ff:   "'Caveat', cursive",
};

// ── Primitives ─────────────────────────────────────────────────────

const Nav = ({ crumb }) => (
  <div style={{ height:52, background:WF.pan, borderBottom:`1px solid ${WF.brd}`,
    display:'flex', alignItems:'center', padding:'0 28px', flexShrink:0, fontFamily:WF.ff }}>
    <span style={{ color:WF.gold, fontSize:16, fontWeight:700, letterSpacing:2, marginRight:32 }}>⬡ STRATUM</span>
    {['Repositories','Bounties','Docs'].map(l => (
      <span key={l} style={{ color:WF.mt, fontSize:14, marginRight:22 }}>{l}</span>
    ))}
    {crumb && <>
      <span style={{ color:WF.dim, marginRight:8, marginLeft:8 }}>/</span>
      <span style={{ color:WF.t, fontSize:13 }}>{crumb}</span>
    </>}
    <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:10 }}>
      <div style={{ background:WF.gold, color:'#0c0c0e', padding:'5px 14px', fontSize:13, fontWeight:700 }}>+ Scan Repo</div>
      <div style={{ width:28, height:28, borderRadius:'50%', background:WF.p2,
        border:`1px solid ${WF.brd}`, display:'flex', alignItems:'center', justifyContent:'center',
        fontSize:11, color:WF.mt }}>IS</div>
    </div>
  </div>
);

const Sev = ({ s, n }) => {
  const c = { critical:WF.red, high:WF.amb, medium:WF.gold, low:WF.teal }[s];
  return <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'2px 8px',
    fontFamily:WF.ff, fontSize:12, background:`${c}18`, border:`1px solid ${c}40`, color:c }}>{n} {s}</span>;
};

const Chip = ({ t, on }) => (
  <span style={{ padding:'4px 12px', fontFamily:WF.ff, fontSize:13, cursor:'pointer',
    border:`1px solid ${on ? WF.gold : WF.brd}`,
    background: on ? `${WF.gold}12` : 'transparent',
    color: on ? WF.gold : WF.mt }}>{t}</span>
);

// ── Architecture Map SVG ──────────────────────────────────────────

const ArchMapSVG = () => {
  const nw = 148, nh = 42;
  const clusters = [
    { id:'c', label:'CLIENT',   x:10,  col:'#7DD3FC' },
    { id:'g', label:'GATEWAY',  x:212, col:'#7DD389' },
    { id:'s', label:'SERVICES', x:424, col:'#D4AF37' },
    { id:'d', label:'DATA',     x:638, col:'#F59E0B' },
    { id:'e', label:'EXTERNAL', x:852, col:'#E5645C' },
  ];
  const nodes = [
    { id:'app',   x:22,  y:28,  label:'App.tsx',      sub:'entry',        col:'#7DD3FC' },
    { id:'dash',  x:22,  y:88,  label:'Dashboard',    sub:'projects view',col:'#7DD3FC' },
    { id:'rpt',   x:22,  y:148, label:'ReportView',   sub:'3 tabs',       col:'#7DD3FC', crit:true },
    { id:'rest',  x:224, y:48,  label:'REST API',     sub:'/api/v1/*',    col:'#7DD389', crit:true },
    { id:'ws',    x:224, y:118, label:'WebSocket',    sub:'/ws/stream',   col:'#7DD389' },
    { id:'orch',  x:436, y:28,  label:'Orchestrator', sub:'scan pipeline',col:'#D4AF37', crit:true },
    { id:'bugd',  x:436, y:98,  label:'BugDetector',  sub:'AI analysis',  col:'#D4AF37', crit:true },
    { id:'emb',   x:436, y:168, label:'EmbedSearch',  sub:'vector index', col:'#D4AF37' },
    { id:'pg',    x:650, y:44,  label:'PostgreSQL',   sub:'issues store', col:'#F59E0B' },
    { id:'redis', x:650, y:114, label:'Redis',        sub:'queue/cache',  col:'#F59E0B' },
    { id:'vec',   x:650, y:184, label:'VectorDB',     sub:'embeddings',   col:'#F59E0B' },
    { id:'gh',    x:864, y:44,  label:'GitHub API',   sub:'repo fetch',   col:'#E5645C' },
    { id:'cl',    x:864, y:114, label:'Claude API',   sub:'analysis LLM', col:'#E5645C', crit:true },
    { id:'my',    x:864, y:184, label:'Mythos',       sub:'agent bus',    col:'#E5645C' },
  ];
  const ek = { crit:'#D4AF37', api:'#E5645C', db:'#F59E0B', norm:'rgba(255,255,255,0.18)' };
  const edges = [
    { f:'rpt',  t:'rest',  k:'crit' },
    { f:'dash', t:'rest',  k:'norm' },
    { f:'rest', t:'orch',  k:'crit' },
    { f:'ws',   t:'orch',  k:'norm' },
    { f:'orch', t:'bugd',  k:'crit' },
    { f:'bugd', t:'pg',    k:'db' },
    { f:'bugd', t:'cl',    k:'api' },
    { f:'bugd', t:'my',    k:'api' },
    { f:'orch', t:'gh',    k:'api' },
    { f:'emb',  t:'vec',   k:'db' },
    { f:'rest', t:'redis', k:'db' },
  ];
  const np = id => {
    const n = nodes.find(n => n.id === id);
    return n ? { rx: n.x + nw, lx: n.x, cy: n.y + nh / 2 } : null;
  };
  return (
    <svg viewBox="0 0 1058 248" style={{ width:'100%', height:'100%', display:'block' }}>
      {clusters.map(c => (
        <g key={c.id}>
          <rect x={c.x} y={8} width={188} height={232} rx={3}
            fill={`${c.col}05`} stroke={`${c.col}22`} strokeWidth={1} />
          <text x={c.x + 94} y={7} textAnchor="middle" fill={c.col}
            fontSize={9} fontFamily="Caveat" opacity={0.65}>{c.label}</text>
        </g>
      ))}
      {edges.map((e, i) => {
        const f = np(e.f), t = np(e.t);
        if (!f || !t) return null;
        const mx = (f.rx + t.lx) / 2;
        return (
          <path key={i}
            d={`M${f.rx} ${f.cy} C${mx} ${f.cy},${mx} ${t.cy},${t.lx} ${t.cy}`}
            fill="none" stroke={ek[e.k]}
            strokeWidth={e.k === 'crit' ? 1.8 : 1.2}
            strokeDasharray={e.k === 'norm' ? '4,3' : undefined}
            opacity={e.k === 'norm' ? 0.45 : 0.85} />
        );
      })}
      {nodes.map(n => (
        <g key={n.id}>
          <rect x={n.x} y={n.y} width={nw} height={nh} rx={2}
            fill={n.crit ? `${n.col}14` : WF.pan}
            stroke={n.crit ? n.col : `${n.col}45`}
            strokeWidth={n.crit ? 1.8 : 1.2} />
          <text x={n.x + nw / 2} y={n.y + 16} textAnchor="middle"
            fill={n.crit ? n.col : '#d4d4d8'} fontSize={12} fontFamily="Caveat"
            fontWeight={n.crit ? 600 : 400}>{n.label}</text>
          <text x={n.x + nw / 2} y={n.y + 31} textAnchor="middle"
            fill="#71717a" fontSize={9} fontFamily="Caveat">{n.sub}</text>
        </g>
      ))}
    </svg>
  );
};

// ── Code Graph SVG (radial) ───────────────────────────────────────

const CodeGraphSVG = () => {
  const nodes = [
    { id:'eng',  x:370, y:210, r:26, label:'ScanEngine', col:'#D4AF37', crit:true },
    { id:'orch', x:370, y:90,  r:19, label:'Orchestrator', col:'#7DD3FC' },
    { id:'scan', x:507, y:150, r:18, label:'Scanner',      col:'#7DD3FC' },
    { id:'bugd', x:507, y:270, r:21, label:'BugDetector',  col:'#E5645C', crit:true },
    { id:'rep',  x:370, y:330, r:17, label:'Reports',      col:'#7DD3FC' },
    { id:'auth', x:233, y:270, r:17, label:'AuthMgr',      col:'#7DD3FC' },
    { id:'ftch', x:233, y:150, r:19, label:'RepoFetch',    col:'#7DD3FC' },
    { id:'gh',   x:472, y:35,  r:15, label:'GitHub',       col:'#E5645C' },
    { id:'cl',   x:624, y:150, r:18, label:'Claude',       col:'#E5645C', crit:true },
    { id:'my',   x:624, y:270, r:14, label:'Mythos',       col:'#E5645C' },
    { id:'pg',   x:472, y:385, r:15, label:'Postgres',     col:'#F59E0B' },
    { id:'rds',  x:268, y:385, r:14, label:'Redis',        col:'#F59E0B' },
    { id:'vec',  x:115, y:270, r:13, label:'VectorDB',     col:'#F59E0B' },
  ];
  const edges = [
    { f:'eng', t:'orch', crit:true }, { f:'eng', t:'scan', crit:true },
    { f:'eng', t:'bugd', crit:true }, { f:'eng', t:'rep' },
    { f:'eng', t:'auth' },            { f:'eng', t:'ftch' },
    { f:'ftch',t:'gh',  api:true },   { f:'bugd',t:'cl',  api:true, crit:true },
    { f:'bugd',t:'my',  api:true },   { f:'scan',t:'pg',  db:true },
    { f:'rep', t:'pg',  db:true },    { f:'auth',t:'rds', db:true },
    { f:'bugd',t:'vec', db:true },    { f:'orch',t:'scan' },
  ];
  const gn = id => nodes.find(n => n.id === id);
  return (
    <svg viewBox="0 0 740 430" style={{ width:'100%', height:'100%', display:'block' }}>
      <circle cx={370} cy={210} r={132} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
      <circle cx={370} cy={210} r={222} fill="none" stroke="rgba(255,255,255,0.025)" strokeWidth={1} />
      {edges.map((e, i) => {
        const f = gn(e.f), t = gn(e.t);
        if (!f || !t) return null;
        const col = e.crit ? '#D4AF37' : e.api ? '#E5645C' : e.db ? '#F59E0B' : 'rgba(255,255,255,0.2)';
        return <line key={i} x1={f.x} y1={f.y} x2={t.x} y2={t.y}
          stroke={col} strokeWidth={e.crit ? 1.8 : 1}
          strokeOpacity={e.crit ? 0.8 : 0.4}
          strokeDasharray={!e.crit && !e.api && !e.db ? '3,2' : undefined} />;
      })}
      {nodes.map(n => (
        <g key={n.id}>
          {n.crit && <circle cx={n.x} cy={n.y} r={n.r + 7}
            fill={`${n.col}10`} stroke={`${n.col}28`} strokeWidth={1} />}
          <circle cx={n.x} cy={n.y} r={n.r}
            fill={n.crit ? `${n.col}20` : WF.pan}
            stroke={n.col} strokeWidth={n.crit ? 2 : 1.2} />
          <text x={n.x} y={n.y + 4} textAnchor="middle"
            fill={n.crit ? n.col : '#c4c4c8'} fontSize={9} fontFamily="Caveat">{n.label}</text>
        </g>
      ))}
    </svg>
  );
};

// ── Vulnerability Content ─────────────────────────────────────────

const VulnContent = ({ compact }) => {
  const sc = [
    { l:'Privacy',      v:42, c:WF.red },
    { l:'Auth & Access',v:67, c:WF.amb },
    { l:'Dependencies', v:38, c:WF.red },
    { l:'Compliance',   v:81, c:WF.grn },
  ];
  const iss = [
    { s:'critical', t:'JWT secret exposed in env fallback',   f:'src/auth/jwt.ts:142' },
    { s:'critical', t:'SQL injection in raw query builder',   f:'src/db/queries.ts:89' },
    { s:'high',     t:'Hardcoded API key in config file',     f:'config/app.ts:23' },
    { s:'high',     t:'Missing rate limit on /api/scan',      f:'src/routes/scan.ts:15' },
    { s:'medium',   t:'Outdated dependency: lodash@3.x',      f:'package.json:44' },
    { s:'medium',   t:'No input sanitization on repo URL',    f:'src/api/repos.ts:67' },
  ];
  const sc2 = { critical:WF.red, high:WF.amb, medium:WF.gold, low:WF.teal };
  const showIssues = compact ? iss.slice(0,4) : iss;
  return (
    <div style={{ fontFamily:WF.ff, padding: compact ? '14px 18px' : '20px 28px', overflow:'hidden' }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        {sc.map(s => (
          <div key={s.l} style={{ background:WF.p2, border:`1px solid ${WF.brd}`, padding:'14px' }}>
            <div style={{ fontSize:11, color:WF.mt, marginBottom:6 }}>{s.l}</div>
            <div style={{ display:'flex', alignItems:'baseline', gap:3 }}>
              <span style={{ fontSize:28, fontWeight:700, color:s.c }}>{s.v}</span>
              <span style={{ fontSize:12, color:WF.dim }}>/100</span>
            </div>
            <div style={{ height:3, background:WF.p3, borderRadius:2, marginTop:6 }}>
              <div style={{ width:`${s.v}%`, height:'100%', background:s.c, borderRadius:2 }} />
            </div>
          </div>
        ))}
      </div>
      <div style={{ background:WF.p2, border:`1px solid ${WF.brd}`, padding:'14px', marginBottom:16 }}>
        <div style={{ fontSize:11, color:WF.mt, marginBottom:10, letterSpacing:1 }}>SEVERITY BREAKDOWN — 47 issues</div>
        {[{ s:'critical',n:3,p:6 },{ s:'high',n:12,p:26 },{ s:'medium',n:22,p:47 },{ s:'low',n:10,p:21 }].map(r => (
          <div key={r.s} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:7 }}>
            <span style={{ width:64, fontSize:12, color:sc2[r.s], textAlign:'right' }}>{r.s}</span>
            <div style={{ flex:1, height:7, background:WF.p3, borderRadius:1 }}>
              <div style={{ width:`${r.p}%`, height:'100%', background:`${sc2[r.s]}70`, borderRadius:1 }} />
            </div>
            <span style={{ width:18, fontSize:12, color:WF.t }}>{r.n}</span>
          </div>
        ))}
      </div>
      <div style={{ fontSize:11, color:WF.mt, marginBottom:8, letterSpacing:1 }}>TOP ISSUES</div>
      {showIssues.map((iss, i) => (
        <div key={i} style={{ display:'flex', alignItems:'center', gap:10,
          padding:'9px 12px', marginBottom:4,
          background:WF.p2, border:`1px solid ${WF.brd}` }}>
          <span style={{ width:64, textAlign:'center', fontSize:11, padding:'2px 0',
            background:`${sc2[iss.s]}18`, border:`1px solid ${sc2[iss.s]}40`, color:sc2[iss.s] }}>{iss.s}</span>
          <span style={{ flex:1, fontSize:13, color:WF.t }}>{iss.t}</span>
          <span style={{ fontSize:11, color:WF.mt, fontFamily:'monospace' }}>{iss.f}</span>
          <span style={{ fontSize:12, color:WF.gold }}>Fix →</span>
        </div>
      ))}
    </div>
  );
};

// ── API Panel Content ─────────────────────────────────────────────

const ApiContent = () => {
  const eps = [
    { m:'POST', p:'/api/v1/scan',              d:'Submit repo for scan' },
    { m:'GET',  p:'/api/v1/repos',             d:'List scanned repos' },
    { m:'GET',  p:'/api/v1/repos/{id}/issues', d:'Get issues for repo' },
    { m:'GET',  p:'/api/v1/repos/{id}/report', d:'Full report JSON', on:true },
    { m:'WS',   p:'/ws/scan-stream',           d:'Live scan events' },
  ];
  const mc = { POST:WF.grn, GET:WF.teal, WS:WF.gold };
  const json = `{
  "repo": "github.com/acme/backend",
  "scanned_at": "2026-05-30T09:42Z",
  "summary": {
    "total": 47, "critical": 3,
    "high": 12,  "medium": 22, "low": 10
  },
  "issues": [{
    "id": "ISS-001",
    "severity": "critical",
    "file": "src/auth/jwt.ts:142",
    "title": "JWT secret exposed",
    "agent_prompt": "You are a security engineer...",
    "fix_available": true,
    "mcp_tool": "stratum_apply_fix"
  }]
}`;
  return (
    <div style={{ display:'flex', height:'100%', fontFamily:WF.ff }}>
      <div style={{ width:340, borderRight:`1px solid ${WF.brd}`, padding:'20px', flexShrink:0 }}>
        <div style={{ fontSize:11, color:WF.mt, letterSpacing:2, marginBottom:14 }}>ENDPOINTS</div>
        {eps.map((ep, i) => (
          <div key={i} style={{ padding:'11px', marginBottom:7,
            background: ep.on ? `${WF.gold}10` : WF.p2,
            border:`1px solid ${ep.on ? WF.gold + '40' : WF.brd}` }}>
            <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:3 }}>
              <span style={{ fontSize:11, color:mc[ep.m] || WF.teal, fontWeight:700 }}>{ep.m}</span>
              <code style={{ fontSize:11, color:WF.t, fontFamily:'monospace' }}>{ep.p}</code>
            </div>
            <div style={{ fontSize:12, color:WF.mt }}>{ep.d}</div>
          </div>
        ))}
        <div style={{ marginTop:16, padding:'12px', background:WF.p2, border:`1px solid ${WF.brd2}` }}>
          <div style={{ fontSize:11, color:WF.gold, marginBottom:6 }}>⚡ MCP / TOOL SCHEMA</div>
          <div style={{ fontSize:12, color:WF.mt, lineHeight:1.5 }}>Available as Claude MCP server. Agents can call <code style={{ color:WF.teal }}>stratum_scan</code> and <code style={{ color:WF.teal }}>stratum_apply_fix</code> directly.</div>
        </div>
      </div>
      <div style={{ flex:1, padding:'20px', overflow:'hidden' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
          <span style={{ fontSize:11, color:WF.mt, letterSpacing:1 }}>RESPONSE — GET /repos/{'{id}'}/report</span>
          <span style={{ fontSize:11, color:WF.gold, cursor:'pointer' }}>Copy ↗</span>
        </div>
        <pre style={{ fontFamily:'monospace', fontSize:12, color:WF.teal, background:WF.p2,
          border:`1px solid ${WF.brd}`, padding:'16px', margin:0, lineHeight:1.65,
          overflow:'hidden' }}>{json}</pre>
        <div style={{ marginTop:14, padding:'12px', background:WF.p2, border:`1px solid ${WF.brd}` }}>
          <div style={{ fontSize:11, color:WF.gold, marginBottom:6 }}>AGENT PROMPT TEMPLATE</div>
          <div style={{ fontSize:12, color:WF.mt, lineHeight:1.5 }}>
            Each issue ships an <code style={{ color:WF.teal, fontFamily:'monospace' }}>agent_prompt</code> field — a ready-made instruction
            for Claude, GPT-4, or Mythos to directly fix the vulnerability. Zero extra prompting needed.
          </div>
        </div>
      </div>
    </div>
  );
};

// ── SCREEN: Dashboard ─────────────────────────────────────────────

const WFDashboard = () => {
  const repos = [
    { n:'acme/backend',    l:'TypeScript', c:3, h:12, m:22, score:42, ago:'2h',  done:true },
    { n:'acme/frontend',   l:'React',      c:0, h:3,  m:8,  score:78, ago:'1d',  done:true },
    { n:'acme/ml-pipeline',l:'Python',     c:1, h:7,  m:11, score:61, ago:'4h',  done:true },
    { n:'acme/infra',      l:'Terraform',  scanning:true },
  ];
  const sc = s => s >= 70 ? WF.grn : s >= 45 ? WF.amb : WF.red;
  return (
    <div style={{ width:1440, height:820, background:WF.bg, display:'flex', flexDirection:'column', overflow:'hidden', fontFamily:WF.ff }}>
      <Nav active="Repositories" />
      <div style={{ padding:'28px 40px 20px', borderBottom:`1px solid ${WF.brd}`,
        display:'flex', alignItems:'flex-end', justifyContent:'space-between', flexShrink:0 }}>
        <div>
          <div style={{ fontSize:10, color:WF.mt, letterSpacing:3, marginBottom:6 }}>WORKSPACE</div>
          <div style={{ fontSize:28, color:WF.t, fontWeight:700 }}>Your Repositories</div>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <div style={{ padding:'8px 16px', background:WF.pan, border:`1px solid ${WF.brd}`, fontSize:13, color:WF.mt }}>🔍 Search repos…</div>
          <div style={{ padding:'8px 20px', background:WF.gold, color:'#0c0c0e', fontSize:13, fontWeight:700 }}>+ Scan New Repo</div>
        </div>
      </div>
      <div style={{ display:'flex', borderBottom:`1px solid ${WF.brd}`, flexShrink:0 }}>
        {[
          { l:'Repositories', v:'4' },
          { l:'Total Issues',  v:'71' },
          { l:'Critical',      v:'4',     c:WF.red },
          { l:'Last Scan',     v:'2h ago' },
        ].map((s, i) => (
          <div key={i} style={{ flex:1, padding:'13px 40px',
            borderRight: i < 3 ? `1px solid ${WF.brd}` : 'none' }}>
            <div style={{ fontSize:10, color:WF.mt, marginBottom:3 }}>{s.l}</div>
            <div style={{ fontSize:22, fontWeight:700, color:s.c || WF.t }}>{s.v}</div>
          </div>
        ))}
      </div>
      <div style={{ flex:1, padding:'28px 40px', display:'grid',
        gridTemplateColumns:'repeat(4,1fr)', gap:16, alignContent:'start', overflow:'hidden' }}>
        {repos.map((r, i) => (
          <div key={i} style={{ background:WF.pan, border:`1px solid ${WF.brd}`,
            padding:'20px', display:'flex', flexDirection:'column', gap:12, cursor:'pointer',
            transition:'border-color .15s' }}>
            {r.scanning ? (
              <>
                <div style={{ fontSize:15, color:WF.t, fontWeight:700 }}>{r.n}</div>
                <div style={{ padding:'12px', background:WF.p2, border:`1px dashed ${WF.brd2}`,
                  fontSize:12, color:WF.gold }}>◌ Scanning in progress…</div>
                <div style={{ height:3, background:WF.p3, borderRadius:2 }}>
                  <div style={{ width:'58%', height:'100%', background:`${WF.gold}70`, borderRadius:2 }} />
                </div>
                <div style={{ fontSize:11, color:WF.mt }}>Estimated 4 min remaining</div>
              </>
            ) : (
              <>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <div>
                    <div style={{ fontSize:15, color:WF.t, fontWeight:700, marginBottom:2 }}>{r.n}</div>
                    <div style={{ fontSize:11, color:WF.mt }}>{r.l}</div>
                  </div>
                  <div style={{ width:44, height:44, borderRadius:'50%',
                    border:`2.5px solid ${sc(r.score)}`,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:13, fontWeight:700, color:sc(r.score) }}>{r.score}</div>
                </div>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  {r.c > 0 && <Sev s="critical" n={r.c} />}
                  {r.h > 0 && <Sev s="high" n={r.h} />}
                  {r.m > 0 && <Sev s="medium" n={r.m} />}
                </div>
                <div style={{ fontSize:11, color:WF.dim }}>Scanned {r.ago} ago · View report →</div>
              </>
            )}
          </div>
        ))}
        <div style={{ border:`1px dashed ${WF.brd2}`, display:'flex',
          flexDirection:'column', alignItems:'center', justifyContent:'center',
          gap:10, cursor:'pointer', minHeight:148, fontFamily:WF.ff }}>
          <div style={{ fontSize:32, color:WF.dim }}>+</div>
          <div style={{ fontSize:13, color:WF.mt }}>Scan a repo</div>
        </div>
      </div>
    </div>
  );
};

// ── SCREEN: Submit Repo ───────────────────────────────────────────

const WFSubmitRepo = () => (
  <div style={{ width:800, height:620, background:WF.bg, display:'flex', flexDirection:'column', overflow:'hidden' }}>
    <Nav />
    <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:40 }}>
      <div style={{ width:520, background:WF.pan, border:`1px solid ${WF.brd}`, padding:'36px 40px', fontFamily:WF.ff }}>
        <div style={{ fontSize:10, color:WF.mt, letterSpacing:3, marginBottom:10 }}>NEW SCAN</div>
        <div style={{ fontSize:24, color:WF.t, fontWeight:700, marginBottom:28 }}>Scan a Repository</div>

        <div style={{ marginBottom:18 }}>
          <div style={{ fontSize:13, color:WF.mt, marginBottom:7 }}>GitHub Repository URL</div>
          <div style={{ padding:'10px 14px', background:WF.p2, border:`1px solid ${WF.brd2}`,
            fontSize:13, color:WF.dim }}>github.com/your-org/repo-name</div>
        </div>
        <div style={{ textAlign:'center', fontSize:12, color:WF.dim, margin:'8px 0' }}>— or paste a personal access token —</div>
        <div style={{ marginBottom:22 }}>
          <div style={{ padding:'10px 14px', background:WF.p2, border:`1px solid ${WF.brd}`,
            fontSize:13, color:WF.dim }}>ghp_••••••••••••••••••••</div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:22 }}>
          <div>
            <div style={{ fontSize:12, color:WF.mt, marginBottom:6 }}>Scan Depth</div>
            <div style={{ display:'flex', gap:0 }}>
              {['Surface','Deep','Full'].map((t,i) => (
                <div key={t} style={{ flex:1, padding:'7px 0', textAlign:'center', fontSize:12,
                  background: i===1 ? `${WF.gold}18` : WF.p2,
                  border:`1px solid ${i===1 ? WF.gold+'50' : WF.brd}`,
                  color: i===1 ? WF.gold : WF.mt, cursor:'pointer',
                  marginLeft: i>0 ? -1 : 0 }}>{t}</div>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize:12, color:WF.mt, marginBottom:6 }}>Focus Area</div>
            <div style={{ padding:'7px 10px', background:WF.p2, border:`1px solid ${WF.brd}`,
              fontSize:12, color:WF.t, display:'flex', justifyContent:'space-between' }}>
              <span>All Categories</span><span style={{ color:WF.mt }}>▾</span>
            </div>
          </div>
        </div>

        <div style={{ display:'flex', justifyContent:'space-between', padding:'12px 0',
          borderTop:`1px solid ${WF.brd}`, borderBottom:`1px solid ${WF.brd}`, marginBottom:20 }}>
          <div>
            <div style={{ fontSize:11, color:WF.mt }}>Est. files to scan</div>
            <div style={{ fontSize:16, color:WF.t, fontWeight:700 }}>~127 files</div>
          </div>
          <div>
            <div style={{ fontSize:11, color:WF.mt }}>Estimated cost</div>
            <div style={{ fontSize:16, color:WF.gold, fontWeight:700 }}>~$0.40</div>
          </div>
          <div>
            <div style={{ fontSize:11, color:WF.mt }}>Est. time</div>
            <div style={{ fontSize:16, color:WF.t, fontWeight:700 }}>~6 min</div>
          </div>
        </div>

        <div style={{ background:WF.gold, color:'#0c0c0e', padding:'12px',
          textAlign:'center', fontSize:14, fontWeight:700, cursor:'pointer' }}>
          Start Scan →
        </div>
      </div>
    </div>
  </div>
);

// ── VARIATION A: Left Navigation (Arch Map active) ────────────────

const WFReportA = () => {
  const tabs = [
    { icon:'⬡', label:'Architecture Map', on:true },
    { icon:'⊙', label:'Code Graph' },
    { icon:'⚠', label:'Vulnerabilities' },
    { icon:'⚡', label:'API / Export' },
  ];
  return (
    <div style={{ width:1440, height:900, background:WF.bg, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <Nav crumb="acme/backend" />
      <div style={{ flex:1, display:'flex', overflow:'hidden' }}>

        {/* Left sidebar */}
        <div style={{ width:232, background:WF.pan, borderRight:`1px solid ${WF.brd}`,
          display:'flex', flexDirection:'column', flexShrink:0 }}>
          <div style={{ padding:'22px 20px 18px', borderBottom:`1px solid ${WF.brd}`, fontFamily:WF.ff }}>
            <div style={{ fontSize:14, color:WF.t, fontWeight:700, marginBottom:3 }}>acme/backend</div>
            <div style={{ fontSize:11, color:WF.mt, marginBottom:14 }}>TypeScript · 127 files</div>
            <div style={{ width:52, height:52, borderRadius:'50%', border:`3px solid ${WF.red}`,
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:18, fontWeight:700, color:WF.red }}>42</div>
            <div style={{ fontSize:10, color:WF.mt, marginTop:6, letterSpacing:2 }}>HEALTH SCORE</div>
          </div>
          <div style={{ flex:1, paddingTop:10, fontFamily:WF.ff }}>
            {tabs.map(tab => (
              <div key={tab.label} style={{ padding:'10px 20px', fontSize:14,
                color: tab.on ? WF.t : WF.mt,
                background: tab.on ? WF.p2 : 'transparent',
                borderLeft: tab.on ? `2px solid ${WF.gold}` : '2px solid transparent',
                display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}>
                <span style={{ fontSize:13 }}>{tab.icon}</span>
                {tab.label}
              </div>
            ))}
          </div>
          <div style={{ padding:'16px 20px', borderTop:`1px solid ${WF.brd}`, fontFamily:WF.ff }}>
            {[{ l:'Critical',v:3,c:WF.red },{ l:'High',v:12,c:WF.amb },{ l:'Medium',v:22,c:WF.gold }].map(s => (
              <div key={s.l} style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                <span style={{ fontSize:12, color:WF.mt }}>{s.l}</span>
                <span style={{ fontSize:12, color:s.c, fontWeight:700 }}>{s.v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Main content */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
          <div style={{ padding:'13px 24px', borderBottom:`1px solid ${WF.brd}`,
            display:'flex', gap:8, alignItems:'center', flexShrink:0, fontFamily:WF.ff }}>
            <span style={{ fontSize:11, color:WF.mt, marginRight:6 }}>FILTER:</span>
            {['Overview','Auth','Scanner','Critical Path','All'].map((t,i) => (
              <Chip key={t} t={t} on={i===0} />
            ))}
            <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
              {['Fit ⊞','Export ↗'].map(b => (
                <div key={b} style={{ padding:'4px 11px', border:`1px solid ${WF.brd}`,
                  fontSize:12, color:WF.mt, fontFamily:WF.ff, cursor:'pointer' }}>{b}</div>
              ))}
            </div>
          </div>
          <div style={{ flex:1, padding:'18px 24px', position:'relative', overflow:'hidden' }}>
            <ArchMapSVG />
            {/* Legend */}
            <div style={{ position:'absolute', bottom:20, left:24, background:WF.pan,
              border:`1px solid ${WF.brd}`, padding:'8px 14px', fontFamily:WF.ff,
              display:'flex', gap:16 }}>
              {[{ col:WF.gold,l:'Critical path' },{ col:WF.red,l:'API call' },{ col:WF.amb,l:'DB op' },{ col:'rgba(255,255,255,0.3)',l:'Normal' }].map(l => (
                <div key={l.l} style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <div style={{ width:18, height:2, background:l.col }} />
                  <span style={{ fontSize:11, color:WF.mt }}>{l.l}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right detail panel */}
        <div style={{ width:272, background:WF.pan, borderLeft:`1px solid ${WF.brd}`,
          padding:'20px', flexShrink:0, fontFamily:WF.ff, overflow:'hidden' }}>
          <div style={{ fontSize:11, color:WF.mt, letterSpacing:2, marginBottom:14 }}>NODE DETAIL</div>
          <div style={{ padding:'12px', background:WF.p2, border:`1px solid ${WF.gold}38`, marginBottom:12 }}>
            <div style={{ fontSize:14, color:WF.gold, fontWeight:700, marginBottom:3 }}>BugDetector</div>
            <div style={{ fontSize:11, color:WF.mt, fontFamily:'monospace', marginBottom:8 }}>src/services/BugDetector.ts</div>
            <div style={{ fontSize:12, color:WF.t, lineHeight:1.5, marginBottom:10 }}>
              Core AI analysis service. Runs static + LLM scan per file chunk.
            </div>
            <div style={{ fontSize:11, color:WF.mt, marginBottom:3 }}>INCOMING</div>
            <div style={{ fontSize:12, color:WF.teal, marginBottom:8 }}>← Orchestrator (critical path)</div>
            <div style={{ fontSize:11, color:WF.mt, marginBottom:3 }}>OUTGOING</div>
            <div style={{ fontSize:12, color:WF.red }}>→ Claude API · analysis</div>
            <div style={{ fontSize:12, color:WF.amb }}>→ PostgreSQL · store</div>
          </div>
          <div style={{ padding:'10px 12px', background:`${WF.red}10`, border:`1px solid ${WF.red}28` }}>
            <div style={{ fontSize:11, color:WF.red, marginBottom:4 }}>2 OPEN ISSUES</div>
            <div style={{ fontSize:12, color:WF.t, lineHeight:1.5 }}>
              No error boundary on Claude timeout.<br />Token limit not enforced per file.
            </div>
          </div>
          <div style={{ marginTop:14, padding:'8px 12px', background:`${WF.gold}10`, border:`1px solid ${WF.gold}28` }}>
            <div style={{ fontSize:12, color:WF.gold }}>⚡ Send to agent for fix →</div>
          </div>
        </div>

      </div>
    </div>
  );
};

// ── VARIATION B: Top Tabs (Code Graph active) ─────────────────────

const WFReportB = () => {
  const tabs = ['Architecture Map','Code Graph','Vulnerabilities','API / Export'];
  return (
    <div style={{ width:1440, height:900, background:WF.bg, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <Nav crumb="acme/backend" />

      {/* Repo header */}
      <div style={{ padding:'14px 40px', background:WF.pan, borderBottom:`1px solid ${WF.brd}`,
        display:'flex', alignItems:'center', gap:20, flexShrink:0, fontFamily:WF.ff }}>
        <div>
          <div style={{ fontSize:16, color:WF.t, fontWeight:700 }}>acme / backend</div>
          <div style={{ fontSize:11, color:WF.mt }}>TypeScript · 127 files · scanned 2h ago</div>
        </div>
        <div style={{ display:'flex', gap:6, marginLeft:16 }}>
          <Sev s="critical" n={3} /><Sev s="high" n={12} /><Sev s="medium" n={22} />
        </div>
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:48, height:48, borderRadius:'50%', border:`2.5px solid ${WF.red}`,
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:15, fontWeight:700, color:WF.red }}>42</div>
          <div style={{ padding:'7px 16px', border:`1px solid ${WF.brd}`, fontSize:13, color:WF.mt }}>↺ Re-scan</div>
          <div style={{ padding:'7px 16px', background:WF.gold, color:'#0c0c0e', fontSize:13, fontWeight:700 }}>Download Report</div>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display:'flex', background:WF.pan, borderBottom:`1px solid ${WF.brd}`,
        padding:'0 40px', flexShrink:0, fontFamily:WF.ff }}>
        {tabs.map((t, i) => (
          <div key={t} style={{ padding:'12px 20px', fontSize:14,
            color: i===1 ? WF.t : WF.mt,
            borderBottom: i===1 ? `2px solid ${WF.gold}` : '2px solid transparent',
            marginBottom:-1, cursor:'pointer' }}>
            <span style={{ marginRight:6 }}>{['⬡','⊙','⚠','⚡'][i]}</span>{t}
          </div>
        ))}
      </div>

      {/* Filter row */}
      <div style={{ padding:'11px 40px', borderBottom:`1px solid ${WF.brd}`,
        display:'flex', gap:8, fontFamily:WF.ff, flexShrink:0, alignItems:'center' }}>
        <span style={{ fontSize:11, color:WF.mt, marginRight:4 }}>SHOW:</span>
        {['All connections','Dependencies','Call graph','Vuln overlay'].map((t,i) => (
          <Chip key={t} t={t} on={i===2} />
        ))}
        <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
          {['Fit view','Zoom +','Zoom −'].map(b => (
            <div key={b} style={{ padding:'4px 10px', border:`1px solid ${WF.brd}`,
              fontSize:12, color:WF.mt, fontFamily:WF.ff, cursor:'pointer' }}>{b}</div>
          ))}
        </div>
      </div>

      {/* Graph area */}
      <div style={{ flex:1, padding:'16px 40px', position:'relative', overflow:'hidden' }}>
        <CodeGraphSVG />
        {/* Floating node tooltip */}
        <div style={{ position:'absolute', right:40, top:16, background:WF.pan,
          border:`1px solid ${WF.brd2}`, padding:'16px', width:236, fontFamily:WF.ff }}>
          <div style={{ fontSize:13, color:WF.gold, fontWeight:700, marginBottom:5 }}>BugDetector</div>
          <div style={{ fontSize:11, color:WF.mt, fontFamily:'monospace', marginBottom:8 }}>services/BugDetector.ts</div>
          <div style={{ fontSize:12, color:WF.t, marginBottom:10, lineHeight:1.5 }}>AI analysis core. 2 open issues flagged.</div>
          <div style={{ display:'flex', gap:6 }}>
            <span style={{ padding:'3px 8px', background:`${WF.red}1a`, border:`1px solid ${WF.red}40`, color:WF.red, fontSize:11 }}>2 issues</span>
            <span style={{ padding:'3px 8px', background:`${WF.gold}14`, border:`1px solid ${WF.gold}40`, color:WF.gold, fontSize:11 }}>critical path</span>
          </div>
        </div>
        {/* Legend */}
        <div style={{ position:'absolute', bottom:20, left:40, background:WF.pan,
          border:`1px solid ${WF.brd}`, padding:'8px 14px',
          display:'flex', gap:16, fontFamily:WF.ff }}>
          {[{ col:WF.gold,l:'Critical path' },{ col:WF.red,l:'External API' },{ col:WF.amb,l:'Data layer' },{ col:'rgba(255,255,255,0.3)',l:'Internal' }].map(l => (
            <div key={l.l} style={{ display:'flex', alignItems:'center', gap:5 }}>
              <div style={{ width:16, height:1.5, background:l.col }} />
              <span style={{ fontSize:11, color:WF.mt }}>{l.l}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ── VARIATION C: Dense / Vuln Dashboard active ────────────────────

const WFReportC = () => {
  const tabs = ['Architecture Map','Code Graph','Vulnerabilities','API / Export'];
  return (
    <div style={{ width:1440, height:900, background:WF.bg, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <Nav crumb="acme/backend" />

      {/* Metrics strip */}
      <div style={{ display:'flex', background:WF.pan, borderBottom:`1px solid ${WF.brd}`,
        flexShrink:0, fontFamily:WF.ff }}>
        {[
          { l:'HEALTH',    v:'42',    sub:'Critical', c:WF.red },
          { l:'ISSUES',    v:'47',    sub:'total found', c:WF.t },
          { l:'CRITICAL',  v:'3',     sub:'act now', c:WF.red },
          { l:'HIGH',      v:'12',    sub:'fix soon', c:WF.amb },
          { l:'SCANNED',   v:'127',   sub:'TypeScript files', c:WF.teal },
          { l:'LAST SCAN', v:'2h ago',sub:'May 30 09:42', c:WF.mt },
        ].map((m, i) => (
          <div key={i} style={{ flex:1, padding:'11px 20px',
            borderRight: i < 5 ? `1px solid ${WF.brd}` : 'none' }}>
            <div style={{ fontSize:9, color:WF.dim, letterSpacing:2, marginBottom:2 }}>{m.l}</div>
            <div style={{ fontSize:21, fontWeight:700, color:m.c, lineHeight:1 }}>{m.v}</div>
            <div style={{ fontSize:10, color:WF.dim, marginTop:2 }}>{m.sub}</div>
          </div>
        ))}
      </div>

      {/* Tab bar with actions */}
      <div style={{ display:'flex', borderBottom:`1px solid ${WF.brd}`,
        padding:'0 28px', flexShrink:0, fontFamily:WF.ff, alignItems:'center' }}>
        {tabs.map((t, i) => (
          <div key={t} style={{ padding:'10px 18px', fontSize:13,
            color: i===2 ? WF.t : WF.mt,
            borderBottom: i===2 ? `2px solid ${WF.gold}` : '2px solid transparent',
            marginBottom:-1, cursor:'pointer' }}>
            <span style={{ marginRight:5 }}>{['⬡','⊙','⚠','⚡'][i]}</span>{t}
          </div>
        ))}
        <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
          <div style={{ padding:'5px 12px', border:`1px solid ${WF.brd}`, fontSize:11, color:WF.mt }}>↺ Re-scan</div>
          <div style={{ padding:'5px 12px', background:WF.gold, color:'#0c0c0e', fontSize:11, fontWeight:700 }}>Export Report</div>
        </div>
      </div>

      {/* Split content */}
      <div style={{ flex:1, display:'flex', overflow:'hidden' }}>
        {/* Left: Vulnerability content */}
        <div style={{ flex:'0 0 62%', overflow:'hidden', borderRight:`1px solid ${WF.brd}` }}>
          <VulnContent compact={true} />
        </div>
        {/* Right: Mini graph + AI suggestions */}
        <div style={{ flex:'0 0 38%', display:'flex', flexDirection:'column', overflow:'hidden', fontFamily:WF.ff }}>
          <div style={{ borderBottom:`1px solid ${WF.brd}`, padding:'14px 18px', flex:'0 0 auto' }}>
            <div style={{ fontSize:11, color:WF.mt, letterSpacing:2, marginBottom:8 }}>AFFECTED FILES — CODE GRAPH</div>
            <div style={{ height:168, overflow:'hidden' }}><CodeGraphSVG /></div>
          </div>
          <div style={{ flex:1, padding:'14px 18px', overflow:'hidden' }}>
            <div style={{ fontSize:11, color:WF.mt, letterSpacing:2, marginBottom:12 }}>AI FIX SUGGESTIONS</div>
            {[
              { t:'Fix JWT secret exposure', e:'5 min', ag:'Claude' },
              { t:'Parameterize SQL queries', e:'15 min', ag:'Claude' },
              { t:'Move API key to secrets manager', e:'10 min', ag:'Mythos' },
            ].map((s, i) => (
              <div key={i} style={{ padding:'10px 12px', marginBottom:8, background:WF.p2,
                border:`1px solid ${WF.brd}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ fontSize:13, color:WF.t, marginBottom:2 }}>{s.t}</div>
                  <div style={{ fontSize:11, color:WF.mt }}>via {s.ag} · ~{s.e}</div>
                </div>
                <div style={{ padding:'4px 10px', background:`${WF.gold}18`,
                  border:`1px solid ${WF.gold}40`, color:WF.gold, fontSize:12 }}>Fix →</div>
              </div>
            ))}
            <div style={{ marginTop:10, padding:'10px 12px', background:`${WF.teal}08`,
              border:`1px solid ${WF.teal}25` }}>
              <div style={{ fontSize:11, color:WF.teal, marginBottom:4 }}>⚡ AGENT HANDOFF</div>
              <div style={{ fontSize:12, color:WF.mt, lineHeight:1.4, marginBottom:10 }}>
                Batch all 3 fixes to Mythos. Est. 30 min fully automated.
              </div>
              <div style={{ padding:'6px 12px', background:WF.teal, color:'#0c0c0e',
                fontSize:12, fontWeight:700, display:'inline-block', cursor:'pointer' }}>
                Send to Agent →
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Export all screens to window
Object.assign(window, {
  WFDashboard,
  WFSubmitRepo,
  WFReportA,
  WFReportB,
  WFReportC,
});
