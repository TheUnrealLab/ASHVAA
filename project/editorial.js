/* STRATUM — Issue Nº 14 · editorial.js
   Vanilla, no deps. Drives: scroll reveals, ticker, live board, intel-core
   counters, agent terminal, left-rail vine, countdown, small niceties. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fmt = function (n) { return n.toLocaleString('en-US'); };

  /* ───────────────── scroll reveals ───────────────── */
  (function () {
    var els = document.querySelectorAll('.rv:not(.in)');
    if (!('IntersectionObserver' in window)) {
      els.forEach(function (e) { e.classList.add('in'); });
      return;
    }
    var io = new IntersectionObserver(function (ents) {
      ents.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    els.forEach(function (e) { io.observe(e); });
  })();

  /* ───────────────── updated stamp ───────────────── */
  (function () {
    var el = $('#updated'); if (!el) return;
    var d = new Date();
    var days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    var hh = String(d.getUTCHours()).padStart(2, '0');
    el.textContent = 'Updated ' + days[d.getUTCDay()] + ' ' + hh + ':00 UTC';
  })();

  /* ───────────────── ticker ───────────────── */
  (function () {
    var track = $('#tickTrack'); if (!track) return;
    var items = [
      ['LIS', 'torvalds/linux',   'use-after-free · net/tls',      'CRITICAL'],
      ['MEX', 'vercel/next.js',   'SSRF · image optimizer',         'HIGH'],
      ['KEF', 'kubernetes/k8s',   'RBAC bypass · admission',        'CRITICAL'],
      ['SIN', 'facebook/react',   'XSS · server renderer',          'MED'],
      ['CPH', 'openssl/openssl',  'timing leak · rsa',              'HIGH'],
      ['RAK', 'redis/redis',      'OOB read · cluster',             'HIGH'],
      ['HND', 'nodejs/node',      'path traversal · fs',            'MED'],
      ['OAX', 'django/django',    'SQL injection · orm',            'CRITICAL'],
      ['EZE', 'rust-lang/cargo',  'supply-chain · registry',        'HIGH'],
      ['FCO', 'golang/go',        'race · net/http',                'MED']
    ];
    var one = items.map(function (it) {
      return '<span class="tk"><b>' + it[1] + '</b> ' + it[2] +
        ' <span class="sev">' + it[3] + '</span></span>';
    }).join('');
    track.innerHTML = one + one; // duplicate for seamless -50% loop
  })();

  /* ───────────────── live board ───────────────── */
  (function () {
    var rows = $('#boardRows'); if (!rows) return;
    var data = [
      ['02:14', 'torvalds/linux', 'net/tls · use-after-free', 'CVE-2026-0412', 'patched', 'Patched', '9.8', 'Critical'],
      ['04:39', 'vercel/next.js', 'image-opt · SSRF', 'CVE-2026-0533', 'hunting', 'Hunting', '8.1', 'High'],
      ['05:02', 'kubernetes/k8s', 'admission · RBAC bypass', 'CVE-2026-0274', 'triaged', 'Triaged', '9.1', 'Critical'],
      ['05:48', 'openssl/openssl', 'rsa · timing leak', 'CVE-2026-0611', 'open', 'Open', '7.4', 'High'],
      ['05:55', 'redis/redis', 'cluster · out-of-bounds read', 'CVE-2026-0588', 'patched', 'Patched', '7.9', 'High'],
      ['06:00', 'django/django', 'orm · SQL injection', 'CVE-2026-0590', 'hunting', 'Hunting', '9.3', 'Critical']
    ];
    rows.innerHTML = data.map(function (r) {
      return '<a class="board-row" href="#cta">' +
        '<span class="b-time">' + r[0] + '</span>' +
        '<div class="b-target"><b>' + r[1] + '</b><span>' + r[2] + '</span></div>' +
        '<span class="b-code">' + r[3] + '</span>' +
        '<span class="b-status st-' + r[4] + '">' + r[5] + '</span>' +
        '<span class="b-sev"><b>' + r[6] + '</b><span>' + r[7] + '</span></span>' +
        '</a>';
    }).join('');
  })();

  /* ───────────────── intel-core live counters ───────────────── */
  (function () {
    var defs = [
      ['#lv1', 1247, 4], ['#lv2', 84201, 60], ['#lv3', 12847, 18],
      ['#lv4', 4291, 30], ['#lv5', 156, 1]
    ];
    var state = defs.map(function (d) {
      var el = $(d[0]); return el ? { el: el, v: d[1], step: d[2] } : null;
    }).filter(Boolean);
    if (!state.length || reduce) return;
    setInterval(function () {
      state.forEach(function (s) {
        s.v += Math.floor(Math.random() * s.step) - Math.floor(s.step * 0.35);
        if (s.v < 1) s.v = 1;
        s.el.textContent = fmt(s.v);
      });
    }, 2200);
  })();

  /* ───────────────── agent terminal ───────────────── */
  (function () {
    var body = $('#tbody'); if (!body) return;
    var lines = [
      '<span class="tp">$</span> <span class="tu">stratum query</span> --repo acme/payments --severity high+',
      '<span class="tp">→ authenticating agent · session secured</span>',
      '<span class="tp">→ querying index · 84,201 repos · 12,847 findings / 24h</span>',
      '<div class="tblk"><span class="ta">⚠ 3 findings</span> matched in acme/payments<br>' +
        '&nbsp;• CWE-89&nbsp;&nbsp;SQL injection&nbsp;&nbsp;· src/db/query.ts:142&nbsp;&nbsp;· conf 0.96<br>' +
        '&nbsp;• CWE-79&nbsp;&nbsp;stored XSS&nbsp;&nbsp;&nbsp;&nbsp;· src/render/md.ts:88&nbsp;&nbsp;· conf 0.91<br>' +
        '&nbsp;• CWE-798 hardcoded key&nbsp;· src/lib/stripe.ts:12&nbsp;· conf 0.99</div>',
      '<span class="tf">✓ map returned · routing to fixer agent</span>',
      '<span class="tp">→ patch PRs drafted · awaiting human review</span>',
      '<span class="tu">stratum ❯ </span><span class="cur"></span>'
    ];
    var started = false;
    function run() {
      if (started) return; started = true;
      if (reduce) { body.innerHTML = lines.map(function (l) { return '<div>' + l + '</div>'; }).join(''); return; }
      var i = 0;
      (function next() {
        if (i >= lines.length) return;
        var div = document.createElement('div');
        div.innerHTML = lines[i];
        body.appendChild(div);
        i++;
        setTimeout(next, i === 4 ? 720 : 460);
      })();
    }
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (ents) {
        ents.forEach(function (e) { if (e.isIntersecting) { run(); io.disconnect(); } });
      }, { threshold: 0.3 });
      io.observe(body);
    } else { run(); }
  })();

  /* ───────────────── countdown ───────────────── */
  (function () {
    var el = $('#cd'); if (!el) return;
    var total = 47 * 3600; // seconds
    function tick() {
      var h = Math.floor(total / 3600);
      var m = Math.floor((total % 3600) / 60);
      var s = total % 60;
      el.textContent = String(h).padStart(2, '0') + ':' +
        String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
      if (total > 0) total--;
    }
    tick();
    if (!reduce) setInterval(tick, 1000);
  })();

  /* ───────────────── join waitlist nicety ───────────────── */
  (function () {
    var btn = $('#joinbtn'), inp = $('#ein'); if (!btn || !inp) return;
    btn.addEventListener('click', function () {
      var ok = /\S+@\S+\.\S+/.test(inp.value);
      if (!ok) { inp.focus(); inp.style.borderColor = 'var(--acc)'; return; }
      btn.textContent = '✓ On the list';
      btn.style.background = 'var(--accd)';
      inp.value = '';
    });
  })();

  /* ───────────────── "/" jumps to the board ───────────────── */
  document.addEventListener('keydown', function (e) {
    if (e.key !== '/' || /^(input|textarea)$/i.test((e.target.tagName || ''))) return;
    var b = $('.board'); if (!b) return;
    e.preventDefault();
    var y = b.getBoundingClientRect().top + window.pageYOffset - 90;
    window.scrollTo({ top: y, behavior: 'smooth' });
  });

  /* ───────────────── left-rail vine (scroll-drawn braid + curl loops) ───────────────── */
  (function () {
    var wrap = $('#vineWrap'), svg = $('#vineSvg'), bud = $('#vineBud');
    if (!wrap || !svg) return;

    var W = 210, vH = 0, startY = 0, leaves = [];

    var VINES = [
      { el: $('#vinePath'),  ghost: $('#vineGhost'),  ampF: 0.30, seg: 400, dir0:  1, loopMod: 3, loopOff: 1 },
      { el: $('#vinePath2'), ghost: $('#vineGhost2'), ampF: 0.30, seg: 400, dir0: -1, loopMod: 3, loopOff: 2 },
      { el: $('#vinePath3'), ghost: null,             ampF: 0.14, seg: 310, dir0:  1, loopMod: 5, loopOff: 0 }
    ];

    /* build one winding path with optional full curl-loops at apexes */
    function windPath(h, cx, amp, seg, dir0, loopMod, loopOff) {
      var d = 'M' + cx + ' ' + startY;
      var y = startY, dir = dir0, i = 0, nodes = [];
      while (y < h) {
        var ny = Math.min(y + seg, h);
        var ax = cx + dir * amp, ay = (y + ny) / 2;
        var doLoop = loopMod > 0 && (i % loopMod === loopOff) &&
                     ny < h - seg * 0.5 && y > startY + seg * 0.3;
        if (doLoop) {
          var r = amp * 0.52, k = 0.5523 * r, s = dir;
          var lx = ax, ly = ay;
          d += ' C' + (cx + dir*amp) + ' ' + (y + seg*0.28) + ',' +
                       lx + ' ' + (ly - r*1.6) + ',' +
                       lx + ' ' + (ly - r);
          d += ' C' + (lx+s*k) + ' ' + (ly-r)   + ',' + (lx+s*r) + ' ' + (ly-k) + ',' + (lx+s*r) + ' ' + ly;
          d += ' C' + (lx+s*r) + ' ' + (ly+k)   + ',' + (lx+s*k) + ' ' + (ly+r) + ',' + lx       + ' ' + (ly+r);
          d += ' C' + (lx-s*k) + ' ' + (ly+r)   + ',' + (lx-s*r) + ' ' + (ly+k) + ',' + (lx-s*r) + ' ' + ly;
          d += ' C' + (lx-s*r) + ' ' + (ly-k)   + ',' + (lx-s*k) + ' ' + (ly-r) + ',' + lx       + ' ' + (ly-r);
          d += ' C' + lx + ' ' + (ly+r*1.6) + ',' +
                       (cx + dir*amp) + ' ' + (ny - seg*0.28) + ',' +
                       cx + ' ' + ny;
        } else {
          d += ' C' + (cx+dir*amp) + ' ' + (y+seg*0.34) + ',' +
                       (cx+dir*amp) + ' ' + (ny-seg*0.34) + ',' +
                       cx + ' ' + ny;
        }
        nodes.push({ x: ax, y: ay, loop: doLoop });
        dir *= -1; y = ny; i++;
      }
      return { d: d, nodes: nodes };
    }

    function build() {
      if (getComputedStyle(wrap).display === 'none') return;
      vH = Math.max(document.body.scrollHeight, 800);
      var tk = document.querySelector('.ticker'), ms = document.querySelector('header.mast');
      startY = (tk ? tk.offsetHeight : 37) + (ms ? ms.offsetHeight : 58);
      var span = vH;

      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + vH);
      svg.setAttribute('width', W); svg.setAttribute('height', vH);

      var cx = W * 0.5, primaryNodes = [];
      VINES.forEach(function (v, idx) {
        if (!v.el) return;
        var amp = W * v.ampF;
        var res = windPath(span, cx, amp, v.seg, v.dir0, v.loopMod, v.loopOff);
        v.el.setAttribute('d', res.d);
        if (v.ghost) v.ghost.setAttribute('d', res.d);
        v.len = v.el.getTotalLength();
        v.el.style.strokeDasharray = v.len;
        v.el.style.strokeDashoffset = v.len;
        if (idx === 0) primaryNodes = res.nodes;
      });

      /* small ellipse buds at non-loop apexes */
      leaves.forEach(function (l) { if (l.el.parentNode) l.el.parentNode.removeChild(l.el); });
      leaves = [];
      primaryNodes.filter(function (n) { return !n.loop; }).forEach(function (n) {
        var c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        c.setAttribute('cx', n.x.toFixed(1));
        c.setAttribute('cy', n.y.toFixed(1));
        c.setAttribute('r', '4');
        c.setAttribute('class', 'leaf');
        svg.appendChild(c);
        leaves.push({ el: c, y: n.y });
      });
      update();
    }

    function update() {
      if (!VINES[0].len) return;
      var max = (document.documentElement.scrollHeight - window.innerHeight) || 1;
      var prog = Math.min(1, Math.max(0, window.pageYOffset / max));
      VINES.forEach(function (v) {
        if (v.len) v.el.style.strokeDashoffset = v.len * (1 - prog);
      });
      if (bud && VINES[0].len) {
        var drawn = VINES[0].len * prog;
        var pt = VINES[0].el.getPointAtLength(drawn);
        bud.style.left = pt.x + 'px';
        bud.style.top  = pt.y + 'px';
        bud.style.opacity = prog > 0.003 && prog < 0.997 ? '1' : '0';
      }
      var drawnY = startY + (vH - startY) * prog;
      leaves.forEach(function (l) {
        l.el.classList.toggle('lit', l.y <= drawnY);
      });
    }

    var raf = null;
    window.addEventListener('scroll', function () {
      if (raf) return;
      raf = requestAnimationFrame(function () { raf = null; update(); });
    }, { passive: true });
    window.addEventListener('resize', function () { setTimeout(build, 80); });
    window.addEventListener('load',   function () { setTimeout(build, 150); });
    window.__rebuildVine = build;
    build();
    setTimeout(build, 800);
  })();
})();
