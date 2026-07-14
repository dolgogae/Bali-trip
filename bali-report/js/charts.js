/* Chart renderers — vanilla JS + SVG/HTML, follows the dataviz mark specs:
   thin marks (<=24px), 4px rounded data-end / square baseline, 2px lines,
   >=8px markers with 2px surface ring, hairline solid grid, tooltips never gate
   (every chart ships a table-view twin). */
(function () {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const fmt = n => n.toLocaleString('ko-KR');

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function svgEl(tag, attrs, parent) {
    const el = document.createElementNS(NS, tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(el);
    return el;
  }

  /* WCAG relative luminance + contrast — used to pick in-segment label ink */
  function relLum(hex) {
    const c = hex.replace('#', '');
    const [r, g, b] = [0, 2, 4].map(i => {
      let v = parseInt(c.slice(i, i + 2), 16) / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  function contrast(a, b) {
    const [l1, l2] = [relLum(a), relLum(b)].sort((x, y) => y - x);
    return (l1 + 0.05) / (l2 + 0.05);
  }
  function pickInk(fillHex) {
    return contrast(fillHex, '#ffffff') >= contrast(fillHex, '#0b0b0b') ? '#ffffff' : '#0b0b0b';
  }

  /* ---------------- tooltip singleton (textContent only — labels are untrusted) ---------------- */
  const tooltip = (() => {
    let el = null;
    function ensure() {
      if (!el) {
        el = document.createElement('div');
        el.id = 'viz-tooltip';
        document.body.appendChild(el);
      }
      return el;
    }
    function show(x, y, title, rows) {
      const t = ensure();
      t.replaceChildren();
      if (title) {
        const h = document.createElement('div');
        h.className = 'tt-title';
        h.textContent = title;
        t.appendChild(h);
      }
      rows.forEach(r => {
        const row = document.createElement('div');
        row.className = 'tt-row';
        if (r.color) {
          const k = document.createElement('span');
          k.className = 'tt-key';
          k.style.background = r.color;
          row.appendChild(k);
        }
        const v = document.createElement('span');
        v.className = 'tt-val';
        v.textContent = r.value;
        row.appendChild(v);
        if (r.name) {
          const n = document.createElement('span');
          n.className = 'tt-name';
          n.textContent = r.name;
          row.appendChild(n);
        }
        t.appendChild(row);
      });
      t.classList.add('show');
      move(x, y);
    }
    function move(x, y) {
      const t = ensure();
      const w = t.offsetWidth, h = t.offsetHeight;
      let left = x + 14, top = y - h - 10;
      if (left + w > window.innerWidth - 8) left = x - w - 14;
      if (top < 8) top = y + 16;
      t.style.left = left + 'px';
      t.style.top = top + 'px';
    }
    function hide() { if (el) el.classList.remove('show'); }
    return { show, move, hide };
  })();

  /* ---------------- table-view twin ---------------- */
  function buildTable(caption, headers, rows) {
    const details = document.createElement('details');
    details.className = 'chart-table';
    const summary = document.createElement('summary');
    summary.textContent = '표로 보기';
    details.appendChild(summary);
    const table = document.createElement('table');
    const cap = document.createElement('caption');
    cap.className = 'sr-only';
    cap.textContent = caption;
    table.appendChild(cap);
    const thead = document.createElement('thead');
    const trh = document.createElement('tr');
    headers.forEach(h => {
      const th = document.createElement('th');
      th.scope = 'col';
      th.textContent = h;
      trh.appendChild(th);
    });
    thead.appendChild(trh);
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    rows.forEach(r => {
      const tr = document.createElement('tr');
      r.forEach(cell => {
        const td = document.createElement('td');
        td.textContent = cell;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    details.appendChild(table);
    return details;
  }

  /* rounded-top column path: square baseline, 4px rounded data-end */
  function colPath(x, y, w, y0, r) {
    r = Math.min(r, w / 2, Math.max(0, y0 - y));
    return `M ${x} ${y0} L ${x} ${y + r} Q ${x} ${y} ${x + r} ${y} L ${x + w - r} ${y} Q ${x + w} ${y} ${x + w} ${y + r} L ${x + w} ${y0} Z`;
  }

  /* ---------------- 1. location column chart (emphasis form) ---------------- */
  function renderLocBar(container, locations) {
    container.replaceChildren();
    const W = Math.max(320, container.clientWidth);
    const M = { t: 30, r: 8, b: 26, l: 48 };
    const plotH = 220;
    const H = plotH + M.t + M.b;
    const innerW = W - M.l - M.r;

    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img',
      'aria-label': '지역별 게시물 수 컬럼 차트' }, container);

    const yMax = 16000, ticks = [0, 4000, 8000, 12000, 16000];
    const y = v => M.t + plotH - (v / yMax) * plotH;

    ticks.forEach(t => {
      if (t > 0) svgEl('line', { x1: M.l, x2: W - M.r, y1: y(t), y2: y(t), class: 'grid-line' }, svg);
      const lbl = svgEl('text', { x: M.l - 8, y: y(t) + 4, 'text-anchor': 'end', class: 'tick-label' }, svg);
      lbl.textContent = fmt(t);
    });
    svgEl('line', { x1: M.l, x2: W - M.r, y1: y(0), y2: y(0), class: 'axis-line' }, svg);

    const band = innerW / locations.length;
    const barW = Math.min(24, band * 0.5);
    const colors = { Canggu: cssVar('--c-canggu'), Seminyak: cssVar('--c-seminyak') };
    const deemph = cssVar('--deemph');

    locations.forEach((loc, i) => {
      const cx = M.l + band * i + band / 2;
      const x0 = cx - barW / 2;
      const topY = y(loc.posts);
      const fill = loc.focus ? colors[loc.key] : deemph;
      const bar = svgEl('path', { d: colPath(x0, topY, barW, y(0), 4), class: 'bar' }, svg);
      bar.style.fill = fill;

      if (loc.focus) { /* selective direct label: value on the cap, text token ink */
        const cap = svgEl('text', { x: cx, y: topY - 8, 'text-anchor': 'middle', class: 'direct-label' }, svg);
        cap.textContent = fmt(loc.posts);
      }
      const xl = svgEl('text', { x: cx, y: H - 8, 'text-anchor': 'middle' }, svg);
      xl.textContent = loc.ko;
      if (loc.focus) { xl.style.fill = cssVar('--ink-2'); xl.style.fontWeight = '600'; }

      /* hit target = full band, larger than the mark */
      const hit = svgEl('rect', { x: M.l + band * i, y: M.t, width: band, height: plotH + M.b,
        class: 'hit', tabindex: '0', role: 'img',
        'aria-label': `${loc.ko}: 게시물 ${fmt(loc.posts)}건, 평균 좋아요 ${fmt(loc.avg_likes)}개` }, svg);
      const showTip = (px, py) => {
        bar.classList.add('is-hover');
        tooltip.show(px, py, loc.ko, [
          { color: fill, value: fmt(loc.posts) + '건', name: '게시물' },
          { value: fmt(loc.avg_likes), name: '평균 좋아요' },
        ]);
      };
      hit.addEventListener('pointermove', e => showTip(e.clientX, e.clientY));
      hit.addEventListener('pointerleave', () => { bar.classList.remove('is-hover'); tooltip.hide(); });
      hit.addEventListener('focus', () => {
        const r = hit.getBoundingClientRect();
        showTip(r.left + r.width / 2, r.top + 20);
      });
      hit.addEventListener('blur', () => { bar.classList.remove('is-hover'); tooltip.hide(); });
    });

    container.appendChild(buildTable('지역별 게시물 수와 평균 반응',
      ['지역', '게시물 수', '평균 좋아요', '평균 댓글'],
      locations.map(l => [l.ko, fmt(l.posts), fmt(l.avg_likes), fmt(l.avg_comments)])));
  }

  /* ---------------- 2. monthly line chart (2 series) ---------------- */
  function renderMonthlyLine(container, monthly) {
    container.replaceChildren();
    const W = Math.max(320, container.clientWidth);
    const M = { t: 14, r: 64, b: 26, l: 46 };
    const plotH = 200;
    const H = plotH + M.t + M.b;
    const innerW = W - M.l - M.r;

    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', tabindex: '0',
      'aria-label': '짱구·스미냑 월별 게시물 수 라인 차트. 좌우 화살표 키로 월별 값 탐색' }, container);

    const months = monthly.months;
    const series = [
      { name: '짱구', vals: monthly.canggu, color: cssVar('--c-canggu') },
      { name: '스미냑', vals: monthly.seminyak, color: cssVar('--c-seminyak') },
    ];

    const dMin = Math.floor((monthly.min - 40) / 100) * 100;
    const dMax = Math.ceil((monthly.max + 40) / 100) * 100;
    const step = (dMax - dMin) / 100 <= 4 ? 100 : 200;
    const y = v => M.t + plotH - ((v - dMin) / (dMax - dMin)) * plotH;
    const x = i => M.l + (months.length === 1 ? innerW / 2 : (i / (months.length - 1)) * innerW);

    for (let t = dMin; t <= dMax; t += step) {
      svgEl('line', { x1: M.l, x2: W - M.r, y1: y(t), y2: y(t),
        class: t === dMin ? 'axis-line' : 'grid-line' }, svg);
      const lbl = svgEl('text', { x: M.l - 8, y: y(t) + 4, 'text-anchor': 'end', class: 'tick-label' }, svg);
      lbl.textContent = fmt(t);
    }
    months.forEach((m, i) => {
      if (i % 2 !== 0) return;
      const lbl = svgEl('text', { x: x(i), y: H - 8, 'text-anchor': 'middle', class: 'tick-label' }, svg);
      lbl.textContent = m.slice(2).replace('-', '.');
    });

    series.forEach(s => {
      const d = s.vals.map((v, i) => `${i ? 'L' : 'M'} ${x(i)} ${y(v)}`).join(' ');
      const path = svgEl('path', { d, class: 'series-line' }, svg);
      path.style.stroke = s.color;
      const last = s.vals.length - 1;
      const dot = svgEl('circle', { cx: x(last), cy: y(s.vals[last]), r: 4.5, class: 'end-dot' }, svg);
      dot.style.fill = s.color;
      s.endY = y(s.vals[last]);
    });

    /* direct end labels; nudge apart + leader lines if they collide */
    let [a, b] = series;
    let ya = a.endY, yb = b.endY;
    if (Math.abs(ya - yb) < 16) {
      const mid = (ya + yb) / 2;
      const [hi, lo] = ya <= yb ? [a, b] : [b, a];
      const hiY = mid - 9, loY = mid + 9;
      [[hi, hiY], [lo, loY]].forEach(([s, ly]) => {
        if (Math.abs(s.endY - ly) > 3) {
          svgEl('line', { x1: x(months.length - 1) + 6, y1: s.endY,
            x2: x(months.length - 1) + 12, y2: ly, class: 'grid-line' }, svg);
        }
        s.labelY = ly;
      });
    } else { a.labelY = ya; b.labelY = yb; }
    series.forEach(s => {
      const t = svgEl('text', { x: x(months.length - 1) + 14, y: s.labelY + 4, class: 'direct-label' }, svg);
      t.textContent = s.name;
    });

    /* crosshair + single tooltip listing every series at the X */
    const cross = svgEl('line', { y1: M.t, y2: M.t + plotH, class: 'crosshair', opacity: 0 }, svg);
    const hoverDots = series.map(s => {
      const c = svgEl('circle', { r: 4, class: 'end-dot', opacity: 0 }, svg);
      c.style.fill = s.color;
      return c;
    });
    const hit = svgEl('rect', { x: M.l, y: M.t, width: innerW, height: plotH, class: 'hit' }, svg);

    function showIndex(i, clientX, clientY) {
      const px = x(i);
      cross.setAttribute('x1', px); cross.setAttribute('x2', px);
      cross.setAttribute('opacity', 1);
      series.forEach((s, si) => {
        hoverDots[si].setAttribute('cx', px);
        hoverDots[si].setAttribute('cy', y(s.vals[i]));
        hoverDots[si].setAttribute('opacity', 1);
      });
      tooltip.show(clientX, clientY, months[i],
        series.map(s => ({ color: s.color, value: fmt(s.vals[i]) + '건', name: s.name })));
    }
    function clear() {
      cross.setAttribute('opacity', 0);
      hoverDots.forEach(d => d.setAttribute('opacity', 0));
      tooltip.hide();
    }
    hit.addEventListener('pointermove', e => {
      const rect = svg.getBoundingClientRect();
      const scale = W / rect.width;
      const mx = (e.clientX - rect.left) * scale;
      const i = Math.max(0, Math.min(months.length - 1,
        Math.round((mx - M.l) / (innerW / (months.length - 1)))));
      showIndex(i, e.clientX, e.clientY);
    });
    hit.addEventListener('pointerleave', clear);

    let kbIndex = -1;
    svg.addEventListener('keydown', e => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Escape') return;
      e.preventDefault();
      if (e.key === 'Escape') { kbIndex = -1; clear(); return; }
      kbIndex = kbIndex < 0 ? months.length - 1
        : Math.max(0, Math.min(months.length - 1, kbIndex + (e.key === 'ArrowRight' ? 1 : -1)));
      const rect = svg.getBoundingClientRect();
      const px = rect.left + (x(kbIndex) / W) * rect.width;
      showIndex(kbIndex, px, rect.top + M.t + 30);
    });
    svg.addEventListener('blur', () => { kbIndex = -1; clear(); });

    container.appendChild(buildTable('월별 게시물 수 (짱구·스미냑)',
      ['월', '짱구', '스미냑'],
      months.map((m, i) => [m, fmt(monthly.canggu[i]), fmt(monthly.seminyak[i])])));
  }

  /* ---------------- 3. media-type 100% stacked bars (HTML) ---------------- */
  function renderMediaStack(container, media) {
    container.replaceChildren();
    const colorOf = { image: cssVar('--c-image'), video: cssVar('--c-video'), carousel: cssVar('--c-carousel') };
    const rows = [
      { ko: '짱구', segs: media.canggu },
      { ko: '스미냑', segs: media.seminyak },
    ];
    rows.forEach(row => {
      const line = document.createElement('div');
      line.className = 'flex items-center gap-3 mt-3 first:mt-0';
      const name = document.createElement('div');
      name.className = 'w-14 text-xs shrink-0 text-right';
      name.style.color = 'var(--ink-2)';
      name.textContent = row.ko;
      line.appendChild(name);

      const track = document.createElement('div');
      /* 2px flex gap = the surface gap between touching fills */
      track.className = 'flex flex-1 h-6 gap-[2px]';
      row.segs.forEach((seg, i) => {
        const fill = colorOf[seg.key];
        const div = document.createElement('div');
        div.className = 'relative flex items-center justify-center transition-[filter] duration-100';
        div.style.width = seg.pct + '%';
        div.style.background = fill;
        /* square baseline (left), 4px rounded data-end (right) */
        if (i === row.segs.length - 1) div.style.borderRadius = '0 4px 4px 0';
        div.tabIndex = 0;
        div.setAttribute('role', 'img');
        div.setAttribute('aria-label',
          `${row.ko} ${media.labels[seg.key]} ${fmt(seg.count)}건 (${seg.pct}%)`);
        const lbl = document.createElement('span');
        lbl.className = 'text-[11px] font-semibold';
        lbl.style.color = pickInk(fill);
        lbl.textContent = seg.pct + '%';
        div.appendChild(lbl);
        const show = (px, py) => {
          div.style.filter = 'brightness(1.08)';
          tooltip.show(px, py, row.ko, [
            { color: fill, value: fmt(seg.count) + '건', name: `${media.labels[seg.key]} · ${seg.pct}%` },
          ]);
        };
        div.addEventListener('pointermove', e => show(e.clientX, e.clientY));
        div.addEventListener('pointerleave', () => { div.style.filter = ''; tooltip.hide(); });
        div.addEventListener('focus', () => {
          const r = div.getBoundingClientRect();
          show(r.left + r.width / 2, r.top);
        });
        div.addEventListener('blur', () => { div.style.filter = ''; tooltip.hide(); });
        track.appendChild(div);
      });
      line.appendChild(track);
      container.appendChild(line);
    });

    container.appendChild(buildTable('미디어 타입 구성비',
      ['지역', '이미지', '영상', '캐러셀'],
      rows.map(r => [r.ko, ...r.segs.map(s => `${fmt(s.count)}건 (${s.pct}%)`)])));
  }

  /* ---------------- 4. hashtag horizontal bars (HTML, one series per card) ---------------- */
  function renderHashtagBars(container, tags, colorVarName, totalPosts) {
    container.replaceChildren();
    const fill = cssVar(colorVarName);
    const max = Math.max(...tags.map(t => t.count));
    tags.forEach(t => {
      const row = document.createElement('div');
      row.className = 'grid items-center gap-2 mt-2 first:mt-0';
      row.style.gridTemplateColumns = '108px 1fr 52px';
      row.tabIndex = 0;
      row.setAttribute('role', 'img');
      const share = (t.count / totalPosts * 100).toFixed(1);
      row.setAttribute('aria-label', `${t.tag} ${fmt(t.count)}회 (게시물의 ${share}%)`);

      const name = document.createElement('div');
      name.className = 'text-xs truncate text-right';
      name.style.color = 'var(--ink-2)';
      name.textContent = t.tag;
      row.appendChild(name);

      const trackWrap = document.createElement('div');
      const bar = document.createElement('div');
      bar.className = 'h-3.5 transition-[filter] duration-100';
      bar.style.width = (t.count / max * 100) + '%';
      bar.style.background = fill;
      bar.style.borderRadius = '0 4px 4px 0'; /* data-end rounded, baseline square */
      trackWrap.appendChild(bar);
      row.appendChild(trackWrap);

      /* value at the tip — relief channel for sub-3:1 fills */
      const val = document.createElement('div');
      val.className = 'text-[11px] font-semibold';
      val.style.color = 'var(--ink-2)';
      val.style.fontVariantNumeric = 'tabular-nums';
      val.textContent = fmt(t.count);
      row.appendChild(val);

      const show = (px, py) => {
        bar.style.filter = 'brightness(1.08)';
        tooltip.show(px, py, t.tag, [
          { color: fill, value: fmt(t.count) + '회', name: `게시물의 ${share}%` },
        ]);
      };
      row.addEventListener('pointermove', e => show(e.clientX, e.clientY));
      row.addEventListener('pointerleave', () => { bar.style.filter = ''; tooltip.hide(); });
      row.addEventListener('focus', () => {
        const r = row.getBoundingClientRect();
        show(r.left + r.width / 2, r.top);
      });
      row.addEventListener('blur', () => { bar.style.filter = ''; tooltip.hide(); });
      container.appendChild(row);
    });
  }

  /* ---------------- 5. hidden-gem scatter: posts(x) vs engagement(y), 7 regions ---------------- */
  function renderHiddenScatter(container, hs) {
    container.replaceChildren();
    const W = Math.max(320, container.clientWidth);
    const M = { t: 26, r: 24, b: 34, l: 52 };
    const plotH = 210;
    const H = plotH + M.t + M.b;
    const innerW = W - M.l - M.r;

    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img',
      'aria-label': '지역별 게시물 수 대비 평균 반응 산점도 — 히든젬 신호 탐색' }, container);

    const xs = hs.points.map(p => p.posts), ys = hs.points.map(p => p.avg_eng);
    const xPad = Math.max(60, (Math.max(...xs) - Math.min(...xs)) * 0.25);
    const yPad = Math.max(12, (Math.max(...ys) - Math.min(...ys)) * 0.25);
    const x0 = Math.min(...xs) - xPad, x1 = Math.max(...xs) + xPad;
    const y0 = Math.min(...ys) - yPad, y1 = Math.max(...ys) + yPad;
    const X = v => M.l + ((v - x0) / (x1 - x0)) * innerW;
    const Y = v => M.t + plotH - ((v - y0) / (y1 - y0)) * plotH;

    /* median guides — the quadrant divider (hairline, solid) */
    svgEl('line', { x1: X(hs.posts_median), x2: X(hs.posts_median), y1: M.t, y2: M.t + plotH, class: 'grid-line' }, svg);
    svgEl('line', { x1: M.l, x2: W - M.r, y1: Y(hs.eng_median), y2: Y(hs.eng_median), class: 'grid-line' }, svg);
    const zone = svgEl('text', { x: M.l + 4, y: M.t + 12 }, svg);
    zone.textContent = '← 저빈도 · 고반응 = 히든젬 존';
    zone.style.fontSize = '10px';

    /* axes frame */
    svgEl('line', { x1: M.l, x2: W - M.r, y1: M.t + plotH, y2: M.t + plotH, class: 'axis-line' }, svg);
    const xl = svgEl('text', { x: M.l + innerW / 2, y: H - 6, 'text-anchor': 'middle' }, svg);
    xl.textContent = '게시물 수 (빈도) →';
    const yl = svgEl('text', { x: 12, y: M.t + plotH / 2, 'text-anchor': 'middle',
      transform: `rotate(-90 12 ${M.t + plotH / 2})` }, svg);
    yl.textContent = '평균 반응 →';

    const cC = cssVar('--c-canggu'), cS = cssVar('--c-seminyak'), cO = cssVar('--ink-3');
    hs.points.forEach(p => {
      const fill = p.key === 'Canggu' ? cC : p.key === 'Seminyak' ? cS : cO;
      const dot = svgEl('circle', { cx: X(p.posts), cy: Y(p.avg_eng), r: 5.5, class: 'end-dot' }, svg);
      dot.style.fill = fill;
      const lbl = svgEl('text', { x: X(p.posts), y: Y(p.avg_eng) - 10, 'text-anchor': 'middle',
        class: p.focus ? 'direct-label' : 'tick-label' }, svg);
      lbl.textContent = p.ko;

      const hit = svgEl('circle', { cx: X(p.posts), cy: Y(p.avg_eng), r: 16, class: 'hit',
        tabindex: '0', role: 'img',
        'aria-label': `${p.ko}: 게시물 ${fmt(p.posts)}건, 평균 반응 ${fmt(p.avg_eng)}` }, svg);
      const show = (px, py) => {
        tooltip.show(px, py, p.ko, [
          { color: fill, value: fmt(p.posts) + '건', name: '게시물 (빈도)' },
          { value: fmt(p.avg_eng), name: '평균 반응 (좋아요+댓글)' },
        ]);
      };
      hit.addEventListener('pointermove', e => show(e.clientX, e.clientY));
      hit.addEventListener('pointerleave', tooltip.hide);
      hit.addEventListener('focus', () => {
        const r = hit.getBoundingClientRect();
        show(r.left + r.width / 2, r.top);
      });
      hit.addEventListener('blur', tooltip.hide);
    });

    container.appendChild(buildTable('지역별 게시물 수와 평균 반응 (히든젬 신호 탐색)',
      ['지역', '게시물 수', '평균 반응'],
      hs.points.map(p => [p.ko, fmt(p.posts), fmt(p.avg_eng)])));
  }

  window.Charts = { renderLocBar, renderMonthlyLine, renderMediaStack, renderHashtagBars, renderHiddenScatter, buildTable, cssVar, fmt };
})();
