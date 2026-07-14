/* Page orchestration: KPIs, charts, comparison table, research venue cards.
   All research-derived strings are inserted with textContent (untrusted data). */
(function () {
  'use strict';
  const R = window.REPORT;
  const C = window.Charts;
  const fmt = C.fmt;
  const $ = id => document.getElementById(id);

  /* ---------------- category / area config ---------------- */
  const CATS = [
    { id: 'spots', label: '여행지', icon: '🏝️',
      subs: { beach: '해변', beachclub: '비치클럽', cafe: '카페 · 맛집', attraction: '명소' } },
    { id: 'surf', label: '서핑캠프', icon: '🏄' },
    { id: 'run', label: '러닝클럽', icon: '🏃' },
    { id: 'wellness', label: '웰니스', icon: '🧘',
      subs: { yoga: '요가', crossfit: '크로스핏', gym: '헬스장 · 짐', boxing: '복싱 · 무에타이' } },
  ];
  const state = { cat: 'spots', area: 'all' };

  function areaGroup(area) {
    const a = (area || '').toLowerCase();
    if (/(canggu|berawa|batu bolong|echo beach|pererenan|nelayan|짱구)/.test(a)) return 'canggu';
    if (/(seminyak|petitenget|legian|스미냑)/.test(a)) return 'seminyak';
    return 'other';
  }
  const AREA_META = {
    canggu: { label: '짱구권', colorVar: '--c-canggu' },
    seminyak: { label: '스미냑권', colorVar: '--c-seminyak' },
    other: { label: '근교', colorVar: '--deemph' },
  };

  function topPickNames(res) {
    const names = [];
    if (res.top_pick && res.top_pick.name) names.push(res.top_pick.name);
    if (res.top_picks) Object.values(res.top_picks).forEach(p => p && p.name && names.push(p.name));
    /* pick names sometimes drop suffixes like "(CrossFit Wanderlust)" — match loosely */
    return {
      has: venueName => names.some(n => venueName === n || venueName.includes(n) || n.includes(venueName)),
    };
  }

  /* ---------------- KPI tiles ---------------- */
  function renderKPIs() {
    const canggu = R.locations.find(l => l.key === 'Canggu');
    const seminyak = R.locations.find(l => l.key === 'Seminyak');
    const avgLikes = Math.round((canggu.avg_likes + seminyak.avg_likes) / 2);
    const tiles = [
      { label: '전체 게시물', value: fmt(R.meta.total), sub: `7개 지역 · ${R.meta.date_min} ~ ${R.meta.date_max}` },
      { label: '짱구 게시물', value: fmt(canggu.posts), sub: `전체의 ${(canggu.posts / R.meta.total * 100).toFixed(1)}%`, dot: '--c-canggu' },
      { label: '스미냑 게시물', value: fmt(seminyak.posts), sub: `전체의 ${(seminyak.posts / R.meta.total * 100).toFixed(1)}%`, dot: '--c-seminyak' },
      { label: '평균 좋아요 (두 지역)', value: fmt(avgLikes), sub: `평균 댓글 ${fmt(Math.round((canggu.avg_comments + seminyak.avg_comments) / 2))}개` },
    ];
    const row = $('kpi-row');
    row.replaceChildren();
    tiles.forEach(t => {
      const card = document.createElement('div');
      card.className = 'card p-4';
      const lbl = document.createElement('div');
      lbl.className = 'stat-label flex items-center gap-1.5';
      if (t.dot) {
        const d = document.createElement('span');
        d.className = 'dot inline-block w-2 h-2 rounded-full';
        d.style.background = `var(${t.dot})`;
        lbl.appendChild(d);
      }
      lbl.appendChild(document.createTextNode(t.label));
      const val = document.createElement('div');
      val.className = 'stat-value mt-1';
      val.textContent = t.value;
      const sub = document.createElement('div');
      sub.className = 'stat-sub mt-0.5';
      sub.textContent = t.sub;
      card.append(lbl, val, sub);
      row.appendChild(card);
    });
  }

  /* ---------------- comparison table ---------------- */
  function renderCompare() {
    const rows = [
      ['게시물 수', c => fmt(c.posts) + '건'],
      ['평균 좋아요', c => fmt(c.avg_likes)],
      ['좋아요 중앙값', c => fmt(c.median_likes)],
      ['최고 좋아요', c => fmt(c.max_likes)],
      ['평균 댓글', c => fmt(c.avg_comments)],
      ['영상 비중', c => c.video_share + '%'],
    ];
    const tbody = $('compare-body');
    tbody.replaceChildren();
    rows.forEach(([label, f]) => {
      const tr = document.createElement('tr');
      const th = document.createElement('th');
      th.scope = 'row';
      th.className = 'text-left font-medium py-2 pr-3';
      th.style.color = 'var(--ink-3)';
      th.textContent = label;
      tr.appendChild(th);
      [R.compare.canggu, R.compare.seminyak].forEach(cmp => {
        const td = document.createElement('td');
        td.className = 'py-2 px-3 text-right';
        td.style.color = 'var(--ink-1)';
        td.style.fontVariantNumeric = 'tabular-nums';
        td.textContent = f(cmp);
        tr.appendChild(td);
      });
      const bordered = document.createElement('td');
      tbody.appendChild(tr);
      tr.style.borderBottom = '1px solid var(--grid)';
      void bordered;
    });
  }

  /* ---------------- charts ---------------- */
  function renderCharts() {
    C.renderLocBar($('chart-loc'), R.locations);
    C.renderMonthlyLine($('chart-monthly'), R.monthly);
    C.renderMediaStack($('chart-media'), R.media);
    const canggu = R.locations.find(l => l.key === 'Canggu');
    const seminyak = R.locations.find(l => l.key === 'Seminyak');
    C.renderHashtagBars($('chart-tags-canggu'), R.hashtags.canggu, '--c-canggu', canggu.posts);
    C.renderHashtagBars($('chart-tags-seminyak'), R.hashtags.seminyak, '--c-seminyak', seminyak.posts);
    if ($('chart-hidden') && R.hidden_stats) C.renderHiddenScatter($('chart-hidden'), R.hidden_stats);
  }

  /* ---------------- final picks summary ---------------- */
  function renderPicks() {
    const grid = $('picks-grid');
    grid.replaceChildren();
    CATS.forEach(cat => {
      const res = R.research[cat.id];
      const card = document.createElement('div');
      card.className = 'card p-5';
      const head = document.createElement('div');
      head.className = 'flex items-center gap-2 text-sm font-semibold';
      head.style.color = 'var(--ink-1)';
      head.textContent = `${cat.icon} ${cat.label}`;
      card.appendChild(head);

      if (!res) {
        const p = document.createElement('p');
        p.className = 'text-xs mt-2';
        p.style.color = 'var(--ink-3)';
        p.textContent = '리서치 데이터가 없습니다.';
        card.appendChild(p);
        grid.appendChild(card);
        return;
      }
      const picks = res.top_picks
        ? Object.entries(res.top_picks).map(([sub, p]) => ({ sub: (cat.subs || {})[sub] || sub, ...p }))
        : res.top_pick ? [{ sub: null, ...res.top_pick }] : [];
      picks.forEach(p => {
        if (!p || !p.name) return;
        const wrap = document.createElement('div');
        wrap.className = 'mt-3';
        const nameLine = document.createElement('div');
        nameLine.className = 'text-sm font-semibold flex items-baseline gap-2 flex-wrap';
        nameLine.style.color = 'var(--ink-1)';
        nameLine.appendChild(document.createTextNode(`⭐ ${p.name}`));
        if (p.sub) {
          const chip = document.createElement('span');
          chip.className = 'chip';
          chip.textContent = p.sub;
          nameLine.appendChild(chip);
        }
        const reason = document.createElement('p');
        reason.className = 'text-xs mt-1 leading-relaxed';
        reason.style.color = 'var(--ink-2)';
        reason.textContent = p.reason_ko || '';
        wrap.append(nameLine, reason);
        card.appendChild(wrap);
      });
      grid.appendChild(card);
    });
  }

  /* ---------------- city top 5 ---------------- */
  function renderCities() {
    const res = R.research.cities;
    const grid = $('cities-grid');
    const criteria = $('cities-criteria');
    const excluded = $('cities-excluded');
    if (!grid) return;
    grid.replaceChildren();
    if (!res) {
      criteria.textContent = '리서치 데이터가 아직 없습니다.';
      return;
    }
    criteria.textContent = res.criteria_ko || '';

    const dotVarOf = key =>
      key === 'Canggu' ? '--c-canggu' : key === 'Seminyak' ? '--c-seminyak' : '--deemph';

    (res.ranking || []).slice().sort((a, b) => a.rank - b.rank).forEach(city => {
      const card = document.createElement('article');
      card.className = 'card p-5 flex flex-col gap-2.5' + (city.rank === 1 ? ' md:col-span-2' : '');
      if (city.rank === 1) card.style.borderColor = 'var(--ink-2)';

      const head = document.createElement('div');
      head.className = 'flex items-center gap-2.5 flex-wrap';
      const rankBadge = document.createElement('span');
      rankBadge.className = 'inline-flex items-center justify-center text-xs font-bold px-2.5 py-1 rounded-full';
      if (city.rank === 1) {
        rankBadge.style.background = 'var(--ink-1)';
        rankBadge.style.color = 'var(--page)';
      } else {
        rankBadge.style.border = '1px solid var(--border)';
        rankBadge.style.color = 'var(--ink-2)';
      }
      rankBadge.textContent = `${city.rank}위`;
      head.appendChild(rankBadge);

      const dot = document.createElement('span');
      dot.className = 'inline-block w-2.5 h-2.5 rounded-full';
      dot.style.background = `var(${dotVarOf(city.name)})`;
      head.appendChild(dot);

      const nameEl = document.createElement('h3');
      nameEl.className = 'font-bold text-base';
      nameEl.style.color = 'var(--ink-1)';
      nameEl.textContent = city.name_ko;
      head.appendChild(nameEl);

      const en = document.createElement('span');
      en.className = 'text-xs';
      en.style.color = 'var(--ink-3)';
      en.textContent = city.name;
      head.appendChild(en);

      if (city.tagline_ko) {
        const tag = document.createElement('span');
        tag.className = 'chip';
        tag.textContent = city.tagline_ko;
        head.appendChild(tag);
      }
      card.appendChild(head);

      if (city.why_ko) {
        const why = document.createElement('p');
        why.className = 'text-[13px] leading-relaxed';
        why.style.color = 'var(--ink-2)';
        why.textContent = city.why_ko;
        card.appendChild(why);
      }

      if (Array.isArray(city.signature_ko) && city.signature_ko.length) {
        const sig = document.createElement('div');
        sig.className = 'flex flex-wrap gap-1.5';
        city.signature_ko.forEach(s => sig.appendChild(chipEl(s)));
        card.appendChild(sig);
      }

      const foot = document.createElement('div');
      foot.className = 'flex flex-wrap gap-x-3 gap-y-1 text-xs';
      foot.style.color = 'var(--ink-3)';
      if (city.best_for_ko) {
        const bf = document.createElement('span');
        bf.textContent = `👍 ${city.best_for_ko}`;
        foot.appendChild(bf);
      }
      const loc = R.locations.find(l => l.key === city.name);
      if (loc) {
        const cnt = document.createElement('span');
        cnt.textContent = `📊 데이터셋 게시물 ${fmt(loc.posts)}건`;
        foot.appendChild(cnt);
      }
      card.appendChild(foot);

      if (city.caution_ko) {
        const note = document.createElement('p');
        note.className = 'status-note text-xs px-2.5 py-1.5 rounded';
        note.style.color = 'var(--ink-2)';
        note.textContent = `⚠️ ${city.caution_ko}`;
        card.appendChild(note);
      }

      if (Array.isArray(city.sources) && city.sources.length) {
        const src = document.createElement('p');
        src.className = 'text-[11px] mt-auto pt-1';
        src.style.color = 'var(--ink-3)';
        src.appendChild(document.createTextNode('출처: '));
        city.sources.slice(0, 3).forEach((u, i) => {
          const url = safeUrl(u);
          if (!url) return;
          if (i > 0) src.appendChild(document.createTextNode(' · '));
          const a = document.createElement('a');
          a.className = 'src-link';
          a.href = url.href;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          a.textContent = url.hostname.replace(/^www\./, '');
          src.appendChild(a);
        });
        card.appendChild(src);
      }
      grid.appendChild(card);
    });

    if (Array.isArray(res.excluded) && res.excluded.length) {
      excluded.textContent = 'TOP 5 제외: ' +
        res.excluded.map(e => `${e.name_ko}(${e.name}) — ${e.reason_ko}`).join(' · ');
    }
  }

  /* ---------------- venue cards ---------------- */
  function chipEl(text, dotVar) {
    const chip = document.createElement('span');
    chip.className = 'chip';
    if (dotVar) {
      const d = document.createElement('span');
      d.className = 'dot';
      d.style.background = `var(${dotVar})`;
      chip.appendChild(d);
    }
    chip.appendChild(document.createTextNode(text));
    return chip;
  }

  function safeUrl(u) {
    try {
      const url = new URL(u);
      return (url.protocol === 'http:' || url.protocol === 'https:') ? url : null;
    } catch { return null; }
  }

  function venueCard(v, cat, isTopPick) {
    const card = document.createElement('article');
    card.className = 'card p-5 flex flex-col gap-2.5';
    if (isTopPick) card.style.borderColor = 'var(--ink-2)';

    const head = document.createElement('div');
    head.className = 'flex items-start justify-between gap-2';
    const nameWrap = document.createElement('div');
    const name = document.createElement('h4');
    name.className = 'font-semibold text-[15px] leading-snug';
    name.style.color = 'var(--ink-1)';
    name.textContent = v.name;
    nameWrap.appendChild(name);
    if (isTopPick) {
      const badge = document.createElement('span');
      badge.className = 'inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mt-1';
      badge.style.background = 'var(--ink-1)';
      badge.style.color = 'var(--page)';
      badge.textContent = '⭐ TOP PICK';
      nameWrap.appendChild(badge);
    }
    head.appendChild(nameWrap);
    const g = areaGroup(v.area);
    const areaText = v.area || AREA_META[g].label;
    const areaChip = chipEl('', AREA_META[g].colorVar);
    areaChip.classList.add('max-w-[45%]');
    const areaSpan = document.createElement('span');
    areaSpan.className = 'truncate min-w-0';
    areaSpan.title = areaText;
    areaSpan.textContent = areaText;
    areaChip.appendChild(areaSpan);
    head.appendChild(areaChip);
    card.appendChild(head);

    const meta = document.createElement('div');
    meta.className = 'flex flex-wrap items-center gap-x-3 gap-y-1 text-xs';
    meta.style.color = 'var(--ink-2)';
    const metaBits = [];
    if (typeof v.google_rating === 'number') metaBits.push({ text: `★ ${v.google_rating.toFixed(1)}` });
    if (v.korean_friendly) metaBits.push({ text: '🇰🇷 한국어 가능' });
    if (v.type_ko) metaBits.push({ text: v.type_ko });
    if (cat.subs && v.subcategory && cat.subs[v.subcategory]) metaBits.push({ text: cat.subs[v.subcategory] });
    if (v.schedule_ko) metaBits.push({ text: `🗓 ${v.schedule_ko}` });
    if (v.price_usd_ko) {
      metaBits.push({ text: `💰 ${v.price_usd_ko}`, title: v.price_hint_ko || '' });
    } else if (v.price_hint_ko) {
      metaBits.push({ text: `💰 ${v.price_hint_ko}` });
    }
    metaBits.forEach(b => {
      const s = document.createElement('span');
      s.textContent = b.text;
      if (b.title) s.title = b.title;
      meta.appendChild(s);
    });
    if (metaBits.length) card.appendChild(meta);

    if (Array.isArray(v.highlights_ko) && v.highlights_ko.length) {
      const hl = document.createElement('div');
      hl.className = 'flex flex-wrap gap-1.5';
      v.highlights_ko.forEach(h => hl.appendChild(chipEl(h)));
      card.appendChild(hl);
    }

    if (v.why_ko) {
      const why = document.createElement('p');
      why.className = 'text-[13px] leading-relaxed';
      why.style.color = 'var(--ink-2)';
      why.textContent = v.why_ko;
      card.appendChild(why);
    }

    if (v.why_hidden_ko) {
      const wh = document.createElement('p');
      wh.className = 'text-xs leading-relaxed px-2.5 py-1.5 rounded';
      wh.style.color = 'var(--ink-2)';
      wh.style.background = 'var(--grid)';
      wh.textContent = `🤫 왜 히든젬? ${v.why_hidden_ko}`;
      card.appendChild(wh);
    }

    const extras = [];
    if (v.best_for_ko) extras.push(`👍 이런 분께: ${v.best_for_ko}`);
    if (v.meeting_point_ko) extras.push(`📍 집결: ${v.meeting_point_ko}`);
    extras.forEach(t => {
      const p = document.createElement('p');
      p.className = 'text-xs';
      p.style.color = 'var(--ink-3)';
      p.textContent = t;
      card.appendChild(p);
    });

    if (v.status_note_ko) {
      const note = document.createElement('p');
      note.className = 'status-note text-xs px-2.5 py-1.5 rounded';
      note.style.color = 'var(--ink-2)';
      note.textContent = `⚠️ ${v.status_note_ko}`;
      card.appendChild(note);
    }

    /* quick external links: Google Maps search + official Instagram */
    const links = document.createElement('p');
    links.className = 'text-[11px] flex flex-wrap gap-x-3 gap-y-1';
    links.style.color = 'var(--ink-3)';
    const gmaps = document.createElement('a');
    gmaps.className = 'src-link';
    gmaps.href = 'https://www.google.com/maps/search/?api=1&query='
      + encodeURIComponent(`${v.name} Bali`);
    gmaps.target = '_blank';
    gmaps.rel = 'noopener noreferrer';
    gmaps.textContent = '🗺 구글지도';
    links.appendChild(gmaps);
    if (v.instagram && /^@?[A-Za-z0-9._]{1,30}$/.test(v.instagram)) {
      const ig = document.createElement('a');
      ig.className = 'src-link';
      ig.href = 'https://www.instagram.com/' + v.instagram.replace(/^@/, '') + '/';
      ig.target = '_blank';
      ig.rel = 'noopener noreferrer';
      ig.textContent = `📸 ${v.instagram}`;
      links.appendChild(ig);
    }
    card.appendChild(links);

    if (Array.isArray(v.sources) && v.sources.length) {
      const src = document.createElement('p');
      src.className = 'text-[11px] mt-auto pt-1';
      src.style.color = 'var(--ink-3)';
      src.appendChild(document.createTextNode('출처: '));
      v.sources.slice(0, 3).forEach((u, i) => {
        const url = safeUrl(u);
        if (!url) return;
        if (i > 0) src.appendChild(document.createTextNode(' · '));
        const a = document.createElement('a');
        a.className = 'src-link';
        a.href = url.href;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = url.hostname.replace(/^www\./, '');
        src.appendChild(a);
      });
      card.appendChild(src);
    }
    return card;
  }

  function renderVenues() {
    const cat = CATS.find(c => c.id === state.cat);
    const res = R.research[cat.id];
    const grid = $('venue-grid');
    const scene = $('scene-summary');
    const count = $('venue-count');
    grid.replaceChildren();
    scene.textContent = '';
    count.textContent = '';
    if (!res) {
      scene.textContent = '이 카테고리의 리서치 데이터가 아직 없습니다.';
      return;
    }
    scene.textContent = res.scene_summary_ko || '';
    const picks = topPickNames(res);
    const venues = (res.venues || []).filter(v => state.area === 'all' || areaGroup(v.area) === state.area);
    count.textContent = `${venues.length}곳 표시 중 (전체 ${res.venues.length}곳)`;

    const addCards = list => {
      const wrap = document.createElement('div');
      wrap.className = 'grid md:grid-cols-2 gap-4';
      list.sort((a, b) => (picks.has(b.name) ? 1 : 0) - (picks.has(a.name) ? 1 : 0));
      list.forEach(v => wrap.appendChild(venueCard(v, cat, picks.has(v.name))));
      grid.appendChild(wrap);
    };

    if (cat.subs) {
      Object.entries(cat.subs).forEach(([key, label]) => {
        const list = venues.filter(v => v.subcategory === key);
        if (!list.length) return;
        const h = document.createElement('h4');
        h.className = 'text-sm font-semibold mt-6 first:mt-0 mb-3';
        h.style.color = 'var(--ink-1)';
        h.textContent = label;
        grid.appendChild(h);
        addCards(list);
      });
      const rest = venues.filter(v => !cat.subs[v.subcategory]);
      if (rest.length) addCards(rest);
    } else if (venues.length) {
      addCards(venues);
    }
    if (!venues.length) {
      const empty = document.createElement('p');
      empty.className = 'text-sm py-8 text-center';
      empty.style.color = 'var(--ink-3)';
      empty.textContent = '선택한 지역에 해당하는 곳이 없습니다.';
      grid.appendChild(empty);
    }
  }

  /* ---------------- hidden gems section ---------------- */
  const HIDDEN_CAT = { id: 'hidden', subs: { beach: '한적한 해변', cafe: '로컬 카페 · 와룽', spot: '숨은 스팟' } };

  function renderHidden() {
    const grid = $('hidden-grid');
    const scene = $('hidden-scene');
    if (!grid) return;

    const recsBox = $('hidden-in-recs');
    if (recsBox && Array.isArray(R.hidden_in_recs)) {
      recsBox.replaceChildren();
      R.hidden_in_recs.forEach(item => {
        const row = document.createElement('div');
        row.className = 'flex items-start gap-2 text-[13px] leading-relaxed';
        const chip = chipEl(item.cat);
        chip.classList.add('shrink-0', 'mt-0.5');
        row.appendChild(chip);
        const body = document.createElement('p');
        body.style.color = 'var(--ink-2)';
        const strong = document.createElement('strong');
        strong.style.color = 'var(--ink-1)';
        strong.textContent = item.name;
        body.appendChild(strong);
        body.appendChild(document.createTextNode(` — ${item.reason}`));
        row.appendChild(body);
        recsBox.appendChild(row);
      });
    }

    grid.replaceChildren();
    const res = R.research.hidden;
    if (!res) {
      scene.textContent = '리서치 데이터가 아직 없습니다.';
      return;
    }
    scene.textContent = res.scene_summary_ko || '';
    const picks = topPickNames(res);
    const list = (res.venues || []).slice()
      .sort((a, b) => (picks.has(b.name) ? 1 : 0) - (picks.has(a.name) ? 1 : 0));
    list.forEach(v => grid.appendChild(venueCard(v, HIDDEN_CAT, picks.has(v.name))));
  }

  /* ---------------- recommendation map (Leaflet + OSM; validated all-pairs palette) ---------------- */
  const MAP_CATS = {
    spots: { label: '여행지', color: '#2a78d6' },
    surf: { label: '서핑캠프', color: '#eda100' },
    run: { label: '러닝', color: '#4a3aa7' },
    wellness: { label: '웰니스', color: '#008300' },
    hidden: { label: '나만 알고 싶은', color: '#e87ba4' },
  };

  function buildPopup(v, meta) {
    const div = document.createElement('div');
    div.style.fontFamily = 'inherit';
    const name = document.createElement('div');
    name.style.fontWeight = '700';
    name.style.marginBottom = '2px';
    name.textContent = v.name;
    div.appendChild(name);
    const sub = document.createElement('div');
    sub.style.fontSize = '11px';
    sub.style.color = '#52514e';
    sub.textContent = `${meta.label} · ${v.area || ''}` + (v.geo_precision === 'approx' ? ' · 위치 대략' : '');
    div.appendChild(sub);
    const row = document.createElement('div');
    row.style.marginTop = '6px';
    row.style.fontSize = '11px';
    const g = document.createElement('a');
    g.href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(`${v.name} Bali`);
    g.target = '_blank';
    g.rel = 'noopener noreferrer';
    g.textContent = '구글지도 열기';
    row.appendChild(g);
    if (v.instagram && /^@?[A-Za-z0-9._]{1,30}$/.test(v.instagram)) {
      row.appendChild(document.createTextNode('  ·  '));
      const ig = document.createElement('a');
      ig.href = 'https://www.instagram.com/' + v.instagram.replace(/^@/, '') + '/';
      ig.target = '_blank';
      ig.rel = 'noopener noreferrer';
      ig.textContent = '인스타그램';
      row.appendChild(ig);
    }
    div.appendChild(row);
    return div;
  }

  function initMap() {
    const el = $('map-canvas');
    if (!el) return;
    if (!window.L) {
      el.replaceChildren();
      const p = document.createElement('p');
      p.className = 'text-sm p-6 text-center';
      p.style.color = 'var(--ink-3)';
      p.textContent = '지도 라이브러리를 불러오지 못했습니다 (인터넷 연결 필요).';
      el.appendChild(p);
      return;
    }
    const map = L.map(el, { scrollWheelZoom: false });
    map.on('focus click', () => map.scrollWheelZoom.enable());
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors', maxZoom: 19,
    }).addTo(map);

    const chips = $('map-chips');
    chips.replaceChildren();
    const bounds = [];
    let shown = 0, missing = 0;
    Object.entries(MAP_CATS).forEach(([catId, meta]) => {
      const res = R.research[catId];
      if (!res) return;
      const picks = topPickNames(res);
      const group = L.layerGroup();
      let count = 0;
      (res.venues || []).forEach(v => {
        if (typeof v.lat !== 'number' || typeof v.lng !== 'number') { missing++; return; }
        const isPick = picks.has(v.name);
        const marker = L.circleMarker([v.lat, v.lng], {
          radius: isPick ? 9 : 6.5,
          color: '#ffffff', weight: 2,           /* 2px surface ring */
          fillColor: meta.color, fillOpacity: 0.95,
        });
        marker.bindPopup(buildPopup(v, meta));
        group.addLayer(marker);
        bounds.push([v.lat, v.lng]);
        count++; shown++;
      });
      group.addTo(map);

      const b = document.createElement('button');
      b.className = 'filter-btn active';
      const d = document.createElement('span');
      d.className = 'inline-block w-2 h-2 rounded-full mr-1.5 align-middle';
      d.style.background = meta.color;
      b.appendChild(d);
      b.appendChild(document.createTextNode(`${meta.label} ${count}`));
      b.addEventListener('click', () => {
        if (map.hasLayer(group)) { map.removeLayer(group); b.classList.remove('active'); }
        else { map.addLayer(group); b.classList.add('active'); }
      });
      chips.appendChild(b);
    });

    if (bounds.length) map.fitBounds(bounds, { padding: [28, 28] });
    else map.setView([-8.66, 115.15], 12);
    const note = $('map-count');
    note.textContent = `${shown}곳 표시` + (missing ? ` · 좌표 미확인 ${missing}곳은 카드의 구글지도 링크로 확인` : '');
  }

  /* ---------------- tabs & filters (one row, above the content they scope) ---------------- */
  function renderControls() {
    const tabs = $('cat-tabs');
    tabs.replaceChildren();
    CATS.forEach(cat => {
      const b = document.createElement('button');
      b.className = 'tab-btn' + (state.cat === cat.id ? ' active' : '');
      b.textContent = `${cat.icon} ${cat.label}`;
      b.addEventListener('click', () => { state.cat = cat.id; renderControls(); renderVenues(); });
      tabs.appendChild(b);
    });
    const chips = $('area-chips');
    chips.replaceChildren();
    [['all', '전체'], ['canggu', '짱구권'], ['seminyak', '스미냑권'], ['other', '근교']].forEach(([key, label]) => {
      const b = document.createElement('button');
      b.className = 'filter-btn' + (state.area === key ? ' active' : '');
      if (key === 'canggu' || key === 'seminyak') {
        const d = document.createElement('span');
        d.className = 'inline-block w-2 h-2 rounded-full mr-1.5 align-middle';
        d.style.background = `var(${AREA_META[key].colorVar})`;
        b.appendChild(d);
      }
      b.appendChild(document.createTextNode(label));
      b.addEventListener('click', () => { state.area = key; renderControls(); renderVenues(); });
      chips.appendChild(b);
    });
  }

  /* ---------------- boot ---------------- */
  function init() {
    const params = new URLSearchParams(location.search);
    const qCat = params.get('cat'), qArea = params.get('area');
    if (qCat && CATS.some(c => c.id === qCat)) state.cat = qCat;
    if (['all', 'canggu', 'seminyak', 'other'].includes(qArea || '')) state.area = qArea;
    renderKPIs();
    renderCompare();
    renderCharts();
    renderPicks();
    renderCities();
    renderHidden();
    renderControls();
    renderVenues();
    initMap();
    $('monthly-note').textContent = R.monthly.note;

    /* charts inside a closed <details> render at zero width — redraw on expand */
    document.querySelectorAll('details.section-fold').forEach(d => {
      d.addEventListener('toggle', () => { if (d.open) renderCharts(); });
    });

    /* nav anchors pointing into a folded section auto-expand it */
    function openFoldForHash() {
      const id = location.hash.slice(1);
      if (!id) return;
      const sec = document.getElementById(id);
      const fold = sec && sec.querySelector('details.section-fold');
      if (fold) fold.open = true;
    }
    window.addEventListener('hashchange', openFoldForHash);
    openFoldForHash();

    let t;
    window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(renderCharts, 150); });
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    if (mq.addEventListener) mq.addEventListener('change', () => { renderCharts(); });
  }
  document.addEventListener('DOMContentLoaded', init);
})();
