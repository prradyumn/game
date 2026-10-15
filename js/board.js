/* Board geometry + rendering.
   Internal board space: W x 1000 units (W = 1000 x the board's aspect), 10 x 10 cells.
   Cells are 100 units tall and W/10 wide: landscape uses a wider board to fill the screen,
   portrait a square one. Sprites (tokens, heads, tags) are sized in units and never stretch.
   Rows 0-4 (land, top half)  hold +41..+50 down to +1..+10.
   Rows 5-9 (sea, bottom half) hold −1..−10 down to −41..−50.
   Zero is the jetty sitting on the shoreline just left of the board.
   Numbering snakes back and forth (boustrophedon) away from the shoreline in both directions. */
(function (ISL) {
  'use strict';
  const A = ISL.assets;
  const CELL = 100;                 // cell height (and width on a square board)
  let BW = 1000, CW = CELL;         // board width and cell width in units — set from the layout's aspect
  function setAspect(r) { BW = Math.round(1000 * r); CW = BW / 10; }
  const MIN = -50, MAX = 50;

  // Ladders go up (bottom -> top). Snakes go down (head -> tail).
  const LADDERS = [
    { from: -42, to: -23, deco: 'weed' },
    { from: -34, to: -13, deco: 'crab' },
    { from: -3,  to: 19 },
    { from: 10,  to: 30 },
    { from: 16,  to: 37 },
    { from: 27,  to: 47 }
  ];
  const SNAKES = [
    // the big one: from the summit side all the way to the deep, winding down the left edge
    // (via = waypoints in cell coordinates [col, row], centre of a cell = +0.5)
    { from: 43,  to: -40, kind: 'python',
      via: [[1.75, 1.25], [0.85, 1.95], [0.42, 2.9], [0.8, 3.85], [0.38, 4.8], [0.8, 5.75], [0.38, 6.7], [0.72, 7.6]] },
    { from: 35,  to: 15,  kind: 'tree-snake', bend: -1 },
    { from: 13,  to: -7,  kind: 'tree-snake', bend: 1 },
    { from: -5,  to: -26, kind: 'sea-krait',  bend: -1 },
    { from: -29, to: -49, kind: 'sea-krait',  bend: 1 }
  ];
  const SNAKE_STYLE = {
    'python':     { w: 42, base: '#5fae2e', dark: '#25591a', belly: '#f4e3a0', line: '#14240c', head: 84 },
    'tree-snake': { w: 34, base: '#7fd23e', dark: '#3f9426', belly: '#f7f0c4', line: '#14240c', head: 74 },
    'sea-krait':  { w: 34, base: '#1d2a5c', dark: '#1d2a5c', belly: '#efe6c8', line: '#0b1030', head: 76 }
  };

  /* ---------- geometry ---------- */
  function cellOf(n) {
    if (n === 0) return null;
    const k = Math.abs(n);
    const r = Math.floor((k - 1) / 10);          // band away from the shore (0..4)
    const idx = (k - 1) % 10;
    const col = r % 2 === 0 ? idx : 9 - idx;
    const row = n > 0 ? 4 - r : 5 + r;
    return { col, row };
  }
  const JETTY = { x: -46, y: 500, w: 104 };      // jetty centre (board units); deck height ≈ y+8
  function center(n) {
    if (n === 0) return { x: JETTY.x, y: JETTY.y };
    const c = cellOf(n);
    return { x: c.col * CW + CW / 2, y: c.row * CELL + CELL / 2 };
  }
  /** Where a token's feet stand for number n. `slot` -1 / +1 when two tokens share a spot. */
  function anchor(n, slot = 0) {
    const c = center(n);
    if (n === 0) return { x: c.x + slot * 22, y: c.y + 8 };
    return { x: c.x + slot * 20, y: c.y + 34 };
  }
  const fmt = n => n > 0 ? '+' + n : n < 0 ? '−' + Math.abs(n) : '0';
  const label = n => n < 0 ? '−' + Math.abs(n) : String(n);

  /* ---------- paths ---------- */
  function cubic(p0, p1, p2, p3, t) {
    const u = 1 - t;
    return {
      x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
      y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y
    };
  }
  /** Catmull-Rom spline through waypoints (used by long winding snakes). */
  function splinePoints(P, perSeg = 40) {
    const pts = [];
    for (let i = 0; i < P.length - 1; i++) {
      const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
      for (let j = 0; j < perSeg; j++) {
        const t = j / perSeg, t2 = t * t, t3 = t2 * t;
        pts.push({
          x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
          y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3)
        });
      }
    }
    pts.push({ x: P[P.length - 1].x, y: P[P.length - 1].y });
    return pts;
  }
  /** Arc length + unit normals along a sampled path (in place). */
  function measure(pts) {
    let acc = 0;
    const N = pts.length - 1;
    pts.forEach((p, i) => {
      if (i) acc += Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y);
      p.s = acc;
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(N, i + 1)];
      const tx = b.x - a.x, ty = b.y - a.y, tl = Math.hypot(tx, ty) || 1;
      p.tx = tx / tl; p.ty = ty / tl; p.nx = -p.ty; p.ny = p.tx;
    });
    pts.total = acc;
    return pts;
  }
  function snakeCurve(s) {
    const h = center(s.from), t = center(s.to);
    const p0 = { x: h.x, y: h.y + 8 };             // neck, hidden under the chin
    const p3 = { x: t.x, y: t.y + 6 };
    if (s.via) return measure(splinePoints([p0, ...s.via.map(([c, r]) => ({ x: c * CW, y: r * CELL })), p3]));
    const dx = p3.x - p0.x, dy = p3.y - p0.y, L = Math.hypot(dx, dy);
    const nx = -dy / L, ny = dx / L;
    const amp = Math.min(L * 0.26, 74) * s.bend;
    // leave the head straight downward (front-facing head), then S-curve to the tail
    const p1 = { x: p0.x + dx * 0.1 + nx * amp * 1.1, y: p0.y + Math.max(L * 0.34, 80) };
    const p2 = { x: p0.x + dx * 0.72 - nx * amp, y: p0.y + dy * 0.72 - ny * amp };
    const N = 160, pts = [];
    for (let i = 0; i <= N; i++) pts.push(cubic(p0, p1, p2, p3, i / N));
    // arc length + normals
    let acc = 0;
    pts.forEach((p, i) => {
      if (i) acc += Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y);
      p.s = acc;
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(N, i + 1)];
      const tx = b.x - a.x, ty = b.y - a.y, tl = Math.hypot(tx, ty) || 1;
      p.tx = tx / tl; p.ty = ty / tl; p.nx = -p.ty; p.ny = p.tx;
    });
    pts.total = acc;
    return pts;
  }
  function ladderEnds(l) {
    const b = center(l.from), t = center(l.to);
    const dx = t.x - b.x, dy = t.y - b.y, L = Math.hypot(dx, dy);
    const ux = dx / L, uy = dy / L;
    return { b: { x: b.x - ux * 26, y: b.y - uy * 26 }, t: { x: t.x + ux * 22, y: t.y + uy * 22 }, ux, uy, cb: b, ct: t };
  }
  /** Sample along a polyline/curve at fraction f (0..1) of its arc length. */
  function along(pts, f) {
    const target = f * pts.total;
    let i = 1; while (i < pts.length - 1 && pts[i].s < target) i++;
    const a = pts[i - 1], b = pts[i];
    const k = (target - a.s) / ((b.s - a.s) || 1);
    return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, nx: a.nx, ny: a.ny };
  }

  /* ---------- drawing: grid + labels ---------- */
  function drawGrid() {
    const cv = document.getElementById('board-grid'), ctx = cv.getContext('2d');
    cv.width = Math.round(2 * BW); cv.height = 2000;
    const k = cv.height / 1000;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.clearRect(0, 0, BW, 1000);
    for (let r = 0; r < 10; r++) for (let c = 0; c < 10; c++) {
      // (no alternating square shading — the grid lines alone mark the squares)
    }
    ctx.strokeStyle = 'rgba(24,42,86,0.18)'; ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let i = 0; i <= 10; i++) { ctx.moveTo(i * CW, 0); ctx.lineTo(i * CW, 1000); ctx.moveTo(0, i * CELL); ctx.lineTo(BW, i * CELL); }
    ctx.stroke();
    // shoreline accent (zero line)
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 3; ctx.setLineDash([10, 8]);
    ctx.beginPath(); ctx.moveTo(0, 500); ctx.lineTo(BW, 500); ctx.stroke(); ctx.setLineDash([]);
  }
  function buildLabels() {
    const box = document.getElementById('board-labels');
    box.innerHTML = '';
    for (let n = MIN; n <= MAX; n++) {
      if (n === 0) continue;
      const c = cellOf(n);
      const el = document.createElement('span');
      el.className = 'cell-label ' + (n > 0 ? 'pos' : 'neg') + (n % 10 === 0 ? ' mark' : '');
      el.textContent = label(n);
      el.style.left = (c.col * CW + 4) + 'px';
      el.style.top = (c.row * CELL + 4) + 'px';
      el.dataset.n = n;
      box.appendChild(el);
    }
  }

  /* ---------- drawing: ladders ---------- */
  function drawLadder(ctx, l) {
    const e = ladderEnds(l);
    paintLadder(ctx, e.b, e.t, l.from < 0);
  }
  /** Paint a ladder from bottom point b to top point t (any canvas, any units). */
  function paintLadder(ctx, b, t, wet, GAP = 46, RW = 15, STEP = 30, RUNG_H = 17) {
    const set = wet ? 'ladders/wet/' : 'ladders/dry/';
    const len = Math.hypot(t.x - b.x, t.y - b.y);
    const ux = (t.x - b.x) / len, uy = (t.y - b.y) / len;
    const theta = Math.atan2(ux, -uy);
    const rail = A.img(set + 'rail');
    // source rects use the file's real pixels (the shipped file may be smaller than the logical size)
    const [rw, rh] = rail && rail.naturalWidth ? [rail.naturalWidth, rail.naturalHeight] : A.size(set + 'rail');
    ctx.save();
    ctx.translate(b.x, b.y); ctx.rotate(theta);
    ctx.shadowColor = 'rgba(10,20,40,0.35)'; ctx.shadowOffsetX = 6; ctx.shadowOffsetY = 8; ctx.shadowBlur = 6;
    // rungs first, rails on top hide the rung ends
    const rungKeys = ['rung-01', 'rung-02', 'rung-03'];
    let i = 0;
    for (let y = -STEP * 0.53; y > -len + STEP * 0.4; y -= STEP, i++) {
      const im = A.img(set + rungKeys[i % 3]);
      const w = GAP + RW;
      if (im) ctx.drawImage(im, -w / 2, y - RUNG_H / 2, w, RUNG_H);
    }
    // rails as 3-slice: caps keep their aspect, middle stretches
    const capPx = Math.round(rh * 0.12);
    const capH = capPx * RW / rw;
    [-GAP / 2, GAP / 2].forEach(x => {
      if (!rail) return;
      ctx.drawImage(rail, 0, 0, rw, capPx, x - RW / 2, -len, RW, capH);
      ctx.drawImage(rail, 0, capPx, rw, rh - capPx * 2, x - RW / 2, -len + capH, RW, len - capH * 2);
      ctx.drawImage(rail, 0, rh - capPx, rw, capPx, x - RW / 2, -capH, RW, capH);
    });
    ctx.restore();
  }

  /* ---------- drawing: snakes ---------- */
  function snakePolygon(pts, W) {
    const L = [], R = [];
    pts.forEach(p => {
      const t = p.s / pts.total;
      const hw = (W / 2) * (1 - 0.78 * Math.pow(t, 1.7));
      p.hw = hw;
      L.push({ x: p.x + p.nx * hw, y: p.y + p.ny * hw });
      R.push({ x: p.x - p.nx * hw, y: p.y - p.ny * hw });
    });
    return { L, R };
  }
  function tracePoly(ctx, poly, pts) {
    const { L, R } = poly;
    const end = pts[pts.length - 1], start = pts[0];
    ctx.beginPath();
    ctx.moveTo(L[0].x, L[0].y);
    L.forEach(p => ctx.lineTo(p.x, p.y));
    // rounded tail tip
    ctx.arc(end.x, end.y, end.hw, Math.atan2(end.ny, end.nx), Math.atan2(-end.ny, -end.nx), false);
    for (let i = R.length - 1; i >= 0; i--) ctx.lineTo(R[i].x, R[i].y);
    // rounded neck (hidden by head anyway)
    ctx.arc(start.x, start.y, start.hw, Math.atan2(-start.ny, -start.nx), Math.atan2(start.ny, start.nx), false);
    ctx.closePath();
  }
  function offsetLine(ctx, pts, k, from = 0, to = 1) {
    ctx.beginPath();
    let first = true;
    pts.forEach(p => {
      const t = p.s / pts.total; if (t < from || t > to) return;
      const x = p.x + p.nx * p.hw * k, y = p.y + p.ny * p.hw * k;
      first ? ctx.moveTo(x, y) : ctx.lineTo(x, y); first = false;
    });
  }
  function drawSnake(ctx, s) {
    const st = SNAKE_STYLE[s.kind];
    const pts = s.pts;
    const poly = snakePolygon(pts, st.w);
    ctx.save();
    // drop shadow
    ctx.save(); ctx.translate(6, 9); tracePoly(ctx, poly, pts); ctx.fillStyle = 'rgba(8,18,40,0.28)'; ctx.fill(); ctx.restore();
    // outline + base
    tracePoly(ctx, poly, pts);
    ctx.lineJoin = 'round'; ctx.lineWidth = 7; ctx.strokeStyle = st.line; ctx.stroke();
    ctx.fillStyle = st.base; ctx.fill();
    // details clipped to the body
    ctx.save(); tracePoly(ctx, poly, pts); ctx.clip();
    if (s.kind === 'sea-krait') {
      ctx.fillStyle = st.belly;
      for (let d = 22; d < pts.total - 6; d += 24) {
        const a = along(pts, d / pts.total), b = along(pts, Math.min(1, (d + 11) / pts.total));
        const ha = 40;
        ctx.beginPath();
        ctx.moveTo(a.x + a.nx * ha, a.y + a.ny * ha); ctx.lineTo(b.x + b.nx * ha, b.y + b.ny * ha);
        ctx.lineTo(b.x - b.nx * ha, b.y - b.ny * ha); ctx.lineTo(a.x - a.nx * ha, a.y - a.ny * ha);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(11,16,48,0.55)'; ctx.lineWidth = 1.6; ctx.stroke();
      }
    } else {
      // belly stripe on one side
      ctx.beginPath();
      pts.forEach((p, i) => { const x = p.x - p.nx * p.hw * 0.4, y = p.y - p.ny * p.hw * 0.4; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; ctx.lineTo(p.x - p.nx * p.hw * 1.2, p.y - p.ny * p.hw * 1.2); }
      ctx.closePath(); ctx.fillStyle = st.belly; ctx.fill();
      // belly scutes
      ctx.strokeStyle = 'rgba(150,110,40,0.35)'; ctx.lineWidth = 1.3;
      for (let d = 8; d < pts.total - 8; d += 8) {
        const p = along(pts, d / pts.total), hw = (st.w / 2) * (1 - 0.8 * Math.pow(d / pts.total, 1.7));
        ctx.beginPath(); ctx.moveTo(p.x - p.nx * hw * 0.45, p.y - p.ny * hw * 0.45); ctx.lineTo(p.x - p.nx * hw * 1.1, p.y - p.ny * hw * 1.1); ctx.stroke();
      }
      offsetLine(ctx, pts, -0.4); ctx.strokeStyle = 'rgba(20,36,12,0.5)'; ctx.lineWidth = 1.8; ctx.stroke();
      // blotches / spots on the back
      ctx.fillStyle = st.dark;
      const step = s.kind === 'python' ? 26 : 20;
      let j = 0;
      for (let d = 18; d < pts.total - 14; d += step, j++) {
        const p = along(pts, d / pts.total);
        const hw = (st.w / 2) * (1 - 0.8 * Math.pow(d / pts.total, 1.7));
        const off = (j % 2 ? 0.5 : 0.1) * hw;
        const rx = s.kind === 'python' ? hw * 0.62 : hw * 0.34, ry = s.kind === 'python' ? hw * 0.38 : hw * 0.3;
        ctx.save(); ctx.translate(p.x + p.nx * off, p.y + p.ny * off); ctx.rotate(Math.atan2(p.ny, p.nx) + Math.PI / 2);
        ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
    }
    // cel shade on the back edge + glossy highlight
    offsetLine(ctx, pts, 0.85, 0, 1);
    ctx.strokeStyle = 'rgba(8,20,30,0.28)'; ctx.lineWidth = st.w * 0.22; ctx.lineCap = 'round'; ctx.stroke();
    offsetLine(ctx, pts, 0.45, 0.03, 0.85);
    ctx.strokeStyle = 'rgba(255,255,255,0.33)'; ctx.lineWidth = 3.4; ctx.lineCap = 'round'; ctx.stroke();
    ctx.restore();
    // crisp outline again on top
    tracePoly(ctx, poly, pts); ctx.lineWidth = 3.2; ctx.strokeStyle = st.line; ctx.stroke();
    ctx.restore();
  }

  /* ---------- DOM pieces ---------- */
  function sizedImg(key, w, cls) {
    const im = document.createElement('img');
    im.src = A.url(key); im.alt = ''; im.className = cls || '';
    im.style.width = w + 'px'; im.style.height = A.hForW(key, w) + 'px';
    im.dataset.key = key;
    return im;
  }
  function place(el, x, y, w, h) { Object.assign(el.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' }); }

  function buildDecor() {
    const decor = document.getElementById('board-decor');
    decor.innerHTML = '';
    // Jetty (zero)
    const jw = JETTY.w, jh = A.hForW('board-pieces/zero-jetty', jw);
    const jetty = sizedImg('board-pieces/zero-jetty', jw, 'decor jetty');
    place(jetty, JETTY.x - jw / 2, JETTY.y - jh * 0.42, jw, jh);
    decor.appendChild(jetty);
    const chipW = 40;
    const chip = sizedImg('board-pieces/zero-chip', chipW, 'decor zero-chip');
    place(chip, JETTY.x - chipW / 2, JETTY.y - jh * 0.42 + jh + 2, chipW, A.hForW('board-pieces/zero-chip', chipW));
    decor.appendChild(chip);
    // Summit flag at +50
    const c50 = center(MAX);
    const poleH = 92, poleW = A.wForH('board-pieces/summit-pole', poleH);
    const pole = sizedImg('board-pieces/summit-pole', poleW, 'decor pole');
    const poleX = c50.x + 26, poleBottom = c50.y + 40;
    place(pole, poleX - poleW / 2, poleBottom - poleH, poleW, poleH);
    const clothW = 50, clothH = A.hForW('board-pieces/summit-flag-cloth', clothW);
    const cloth = sizedImg('board-pieces/summit-flag-cloth', clothW, 'decor flag-cloth');
    place(cloth, poleX + 2, poleBottom - poleH + 10, clothW, clothH);
    decor.appendChild(cloth); decor.appendChild(pole);
    // Anchor at −50
    const cm = center(MIN);
    const aw = 50, ah = A.hForW('board-pieces/anchor', aw);
    const anc = sizedImg('board-pieces/anchor', aw, 'decor');
    place(anc, cm.x + 2, cm.y + 46 - ah, aw, ah);
    decor.appendChild(anc);
    // Ladder decorations
    LADDERS.forEach(l => {
      if (!l.deco) return;
      const e = ladderEnds(l);
      if (l.deco === 'crab') {
        const w = 40, h = A.hForW('ladders/wet/crab', w);
        const el = sizedImg('ladders/wet/crab', w, 'decor crab');
        place(el, e.b.x + 22, e.b.y - h + 6, w, h); decor.appendChild(el);
      } else {
        const w = 26, h = A.hForW('ladders/wet/weed', w);
        const el = sizedImg('ladders/wet/weed', w, 'decor weed');
        place(el, e.b.x - 40, e.b.y - h + 8, w, h); decor.appendChild(el);
      }
    });
    // Destination target rings (hidden until used)
    ['coral', 'violet'].forEach(c => {
      const w = 64, h = A.hForW('board-pieces/target-' + c, w);
      const el = sizedImg('board-pieces/target-' + c, w, 'decor target');
      el.id = 'target-' + c; place(el, -w / 2, -h / 2, w, h); el.style.opacity = 0;
      decor.appendChild(el);
    });
  }

  /* ---------- value tags ----------
     Each tag sits where the decision happens — just past a snake's head, or at a ladder's foot —
     and is nudged along the piece until it covers no square number, snake head or other tag. */
  function labelBox(n) {
    const c = cellOf(n), big = n % 10 === 0;
    const w = (label(n).length * (big ? 25 : 22)) + 16, h = big ? 50 : 44;
    return { x: c.col * CW + 2, y: c.row * CELL + 2, w, h };
  }
  const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  /** First spot along `pointAt(d)` (d = distance from the start, in units) that is free. */
  function placeTag(pointAt, maxD, tw, th, blocked) {
    let best = null;
    for (let d = 0; d <= maxD; d += 6) {
      const p = pointAt(d), box = { x: p.x - tw / 2, y: p.y - th / 2, w: tw, h: th };
      const inside = box.x >= 4 && box.y >= 4 && box.x + box.w <= BW - 4 && box.y + box.h <= 996;
      if (inside && !blocked.some(b => hit(box, b))) { best = box; break; }
      if (!best && inside) best = box;            // fallback: nearest in-bounds spot
    }
    blocked.push(best);
    return best;
  }

  function buildSnakeHeadsAndTags() {
    const tags = document.getElementById('board-tags');
    tags.innerHTML = '';
    const blocked = [];
    for (let n = MIN; n <= MAX; n++) if (n) blocked.push(labelBox(n));
    SNAKES.forEach((s, i) => {
      const st = SNAKE_STYLE[s.kind];
      const c = center(s.from);
      // head (complete illustrated head, swapped between content/alert)
      const key = `snakes/${s.kind}/head-content`;
      const w = st.head, h = A.hForW(key, w);
      const wrap = document.createElement('div');
      wrap.className = 'snake-head'; wrap.id = 'snake-head-' + i;
      place(wrap, c.x - w / 2, c.y - h / 2 - 4, w, h);
      const img = sizedImg(key, w, 'head-img'); img.style.width = '100%'; img.style.height = '100%';
      wrap.appendChild(img);
      tags.appendChild(wrap);
      s.headEl = wrap; s.headImg = img;
      blocked.push({ x: c.x - w / 2, y: c.y - h / 2 - 4, w, h });
    });
    // snake tags just below the head, ladder tags at the foot
    SNAKES.forEach(s => {
      const tk = `snakes/${s.kind}/value-tag`;
      const tw = 72, th = A.hForW(tk, tw);
      const start = Math.min(s.pts.total * 0.4, 70);
      const box = placeTag(d => along(s.pts, Math.min(1, (start + d) / s.pts.total)), Math.max(0, s.pts.total * 0.6 - start), tw, th, blocked);
      const tag = document.createElement('div');
      tag.className = 'value-tag snake-tag';
      place(tag, box.x, box.y, tw, th);
      tag.innerHTML = `<img src="${A.url(tk)}" alt=""><span>${fmt(s.to - s.from)}</span>`;
      tags.appendChild(tag); s.tagEl = tag;
    });
    LADDERS.forEach(l => {
      const e = ladderEnds(l);
      const tk = l.from < 0 ? 'ladders/wet/value-tag' : 'ladders/dry/value-tag';
      const tw = l.from < 0 ? 63 : 53, th = A.hForW(tk, tw);
      const L = Math.hypot(e.ct.x - e.cb.x, e.ct.y - e.cb.y);
      const box = placeTag(d => ({ x: e.cb.x + e.ux * (d + 10), y: e.cb.y + e.uy * (d + 10) }), L * 0.6, tw, th, blocked);
      const tag = document.createElement('div');
      tag.className = 'value-tag ladder-tag' + (l.from < 0 ? ' wet' : ' dry');
      place(tag, box.x, box.y, tw, th);
      tag.innerHTML = `<img src="${A.url(tk)}" alt=""><span>${fmt(l.to - l.from)}</span>`;
      tags.appendChild(tag); l.tagEl = tag;
    });
  }

  function drawPieces() {
    const cv = document.getElementById('board-pieces'), ctx = cv.getContext('2d');
    cv.width = Math.round(2.4 * BW); cv.height = 2400;
    const k = cv.height / 1000;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.clearRect(0, 0, BW, 1000);
    LADDERS.forEach(l => drawLadder(ctx, l));
    SNAKES.forEach(s => drawSnake(ctx, s));
  }

  /* ---------- validation (used by QA + console) ---------- */
  function validate() {
    const used = new Map(), problems = [];
    const mark = (n, what) => {
      if (n === 0 || n === MIN || n === MAX) problems.push(`${what} uses reserved square ${n}`);
      if (used.has(n)) problems.push(`${what} shares square ${n} with ${used.get(n)}`);
      used.set(n, what);
    };
    LADDERS.forEach((l, i) => { mark(l.from, 'ladder' + i); mark(l.to, 'ladder' + i + ' top'); if (l.to <= l.from) problems.push('ladder' + i + ' not upward'); if (cellOf(l.to).row >= cellOf(l.from).row) problems.push('ladder' + i + ' top not on a higher row'); });
    SNAKES.forEach((s, i) => { mark(s.from, 'snake' + i); mark(s.to, 'snake' + i + ' tail'); if (s.to >= s.from) problems.push('snake' + i + ' not downward'); if (cellOf(s.to).row <= cellOf(s.from).row) problems.push('snake' + i + ' tail not on a lower row'); });
    // numbering sanity: every number maps to a unique cell, adjacent numbers are adjacent cells
    const seen = new Set();
    for (let n = MIN; n <= MAX; n++) {
      if (!n) continue;
      const c = cellOf(n), key = c.col + ',' + c.row;
      if (seen.has(key)) problems.push('duplicate cell for ' + n); seen.add(key);
      const nx = n + 1;
      if (nx !== 0 && nx <= MAX && n !== -1) {
        const d = cellOf(nx); if (Math.abs(d.col - c.col) + Math.abs(d.row - c.row) !== 1) problems.push(`${n}->${nx} not adjacent`);
      }
    }
    return problems;
  }

  const Board = {
    CELL, MIN, MAX, LADDERS, SNAKES, cellOf, center, anchor, fmt, label, along, paintLadder,
    /** Square number under board point (u, v) in board units; 0 for the jetty; null if off the board. */
    numberAt(u, v) {
      if (u < 0) return (u > JETTY.x - JETTY.w * 0.75 && Math.abs(v - JETTY.y) < 80) ? 0 : null;
      if (u >= BW || v < 0 || v >= 1000) return null;
      const col = Math.floor(u / CW), row = Math.floor(v / CELL);
      const band = row <= 4 ? 4 - row : row - 5;
      const idx = band % 2 === 0 ? col : 9 - col;
      const k = band * 10 + idx + 1;
      return row <= 4 ? k : -k;
    },
    snakeAt: n => SNAKES.find(s => s.from === n),
    ladderAt: n => LADDERS.find(l => l.from === n),
    ladderPath(l) {
      const a = center(l.from), b = center(l.to);
      const pts = [];
      const N = 40;
      for (let i = 0; i <= N; i++) pts.push({ x: a.x + (b.x - a.x) * i / N, y: a.y + (b.y - a.y) * i / N });
      let acc = 0; pts.forEach((p, i) => { if (i) acc += Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y); p.s = acc; }); pts.total = acc;
      return pts;
    },
    setHead(s, state) {
      const key = `snakes/${s.kind}/head-${state}`;
      s.headImg.src = A.url(key);
    },
    get W() { return BW; },
    setAspect,
    build() {
      const r = ISL.layout.rect('board-wrap');
      setAspect(r.w / r.h);
      const board = document.getElementById('board');
      [board, ...board.children].forEach(el => { el.style.width = BW + 'px'; });
      SNAKES.forEach(s => { s.pts = snakeCurve(s); });
      drawGrid();
      buildLabels();
      drawPieces();
      buildDecor();
      buildSnakeHeadsAndTags();
      const p = validate();
      if (p.length) console.warn('[board] layout problems:', p); else console.info('[board] layout OK');
      return p;
    },
    validate
  };
  ISL.board = Board;
})(window.ISL);
