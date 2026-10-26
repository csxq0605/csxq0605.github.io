/* Homepage widgets. Everything is computed in the browser or read from data
 * baked into the page at build time — no third-party requests. */
(function () {
  'use strict';
  var TZ = 'Asia/Shanghai';
  var BEIJING = { lat: 39.9042, lng: 116.4074 };
  var DAY = 864e5;
  var dataEl = document.getElementById('widget-data');
  var data = {};
  try { data = JSON.parse(dataEl ? dataEl.textContent : '{}'); } catch (e) {}

  function $(root, sel) { return root ? root.querySelector(sel) : null; }
  function set(root, sel, text) { var el = $(root, sel); if (el) el.textContent = text; }
  // Beijing calendar date as YYYY-MM-DD and its parts.
  function beijingParts(date) {
    var p = {};
    new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
      .formatToParts(date).forEach(function (x) { p[x.type] = x.value; });
    return { iso: p.year + '-' + p.month + '-' + p.day, y: +p.year, m: +p.month, d: +p.day, h: +p.hour, min: +p.minute, s: +p.second };
  }
  function isoToUTC(iso) { var a = iso.split('-'); return Date.UTC(+a[0], +a[1] - 1, +a[2]); }
  function daysBetween(fromIso, toIso) { return Math.round((isoToUTC(toIso) - isoToUTC(fromIso)) / DAY); }

  /* Greeting by the visitor's own clock ------------------------------- */
  var greet = document.querySelector('[data-greeting]');
  if (greet) {
    var now = new Date();
    var h = now.getHours();
    var word = h < 5 ? ['Still up?', '夜深了'] : h < 11 ? ['Good morning', '早上好'] : h < 13 ? ['Good noon', '中午好'] : h < 18 ? ['Good afternoon', '下午好'] : ['Good evening', '晚上好'];
    var here = -now.getTimezoneOffset() / 60;
    var diff = here - 8;
    var where = diff === 0 ? 'Same time zone as Beijing.' :
      'You are ' + Math.abs(diff) + (Math.abs(diff) === 1 ? ' hour ' : ' hours ') + (diff < 0 ? 'behind' : 'ahead of') + ' Beijing.';
    greet.textContent = word[0] + ' · ' + word[1] + ' — ' + where;
    greet.hidden = false;
  }

  /* Today: Gregorian + lunar date, solar term, next festival, progress -- */
  var today = document.querySelector('[data-widget-today]');
  if (today && window.Intl) (function () {
    var cal = data.calendar || {};
    var LUNAR_DAYS = ['初一','初二','初三','初四','初五','初六','初七','初八','初九','初十','十一','十二','十三','十四','十五','十六','十七','十八','十九','二十','廿一','廿二','廿三','廿四','廿五','廿六','廿七','廿八','廿九','三十'];
    var ZODIAC = { 子: '鼠', 丑: '牛', 寅: '虎', 卯: '兔', 辰: '龙', 巳: '蛇', 午: '马', 未: '羊', 申: '猴', 酉: '鸡', 戌: '狗', 亥: '猪' };
    function render() {
      var now = new Date(), bj = beijingParts(now);
      set(today, '[data-day]', String(bj.d));
      set(today, '[data-month]', new Intl.DateTimeFormat('en-GB', { timeZone: TZ, month: 'short', year: 'numeric' }).format(now));
      set(today, '[data-weekday]', new Intl.DateTimeFormat('zh-CN', { timeZone: TZ, weekday: 'short' }).format(now));
      try {
        var parts = {};
        new Intl.DateTimeFormat('zh-CN-u-ca-chinese', { timeZone: TZ, year: 'numeric', month: 'long', day: 'numeric' })
          .formatToParts(now).forEach(function (x) { parts[x.type] = x.value; });
        var gz = parts.yearName || '';
        set(today, '[data-lunar]', '农历' + parts.month + (LUNAR_DAYS[+parts.day - 1] || parts.day) + ' · ' + gz + (ZODIAC[gz.charAt(1)] || '') + '年');
      } catch (e) { $(today, '[data-lunar]').hidden = true; }

      var terms = cal.solar_terms || [], current = null, next = null;
      for (var i = 0; i < terms.length; i++) {
        if (terms[i].date <= bj.iso) current = terms[i];
        else { next = terms[i]; break; }
      }
      if (current) {
        var into = daysBetween(current.date, bj.iso);
        set(today, '[data-term]', into === 0 ? current.name + ' · 今日交节' : current.name + ' · 第 ' + (into + 1) + ' 天' + (next ? '，' + daysBetween(bj.iso, next.date) + ' 天后' + next.name : ''));
      }
      // Next festival (lunar festivals plus 元旦 / 劳动节 / 国庆节).
      var events = (cal.festivals || []).slice();
      events = events.filter(function (e) { return e.date > bj.iso; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
      if (events[0]) set(today, '[data-next]', events[0].name + ' · ' + daysBetween(bj.iso, events[0].date) + ' 天后');
      else $(today, '[data-next]').parentNode.hidden = true;

      var yearStart = Date.UTC(bj.y, 0, 1), yearEnd = Date.UTC(bj.y + 1, 0, 1);
      var nowUTCasBJ = Date.UTC(bj.y, bj.m - 1, bj.d, bj.h, bj.min, bj.s);
      var yp = (nowUTCasBJ - yearStart) / (yearEnd - yearStart) * 100;
      var dp = (bj.h * 3600 + bj.min * 60 + bj.s) / 864;
      set(today, '[data-year-label]', bj.y + ' 已过');
      set(today, '[data-year-pct]', yp.toFixed(1) + '%');
      set(today, '[data-day-pct]', dp.toFixed(0) + '%');
      $(today, '[data-year-fill]').style.width = yp.toFixed(2) + '%';
      $(today, '[data-day-fill]').style.width = dp.toFixed(2) + '%';
    }
    render();
    window.setInterval(render, 60000);
  }());

  /* Poem: one per day, seasonal lines preferred; "换一句" for another --- */
  var poem = document.querySelector('[data-widget-poem]');
  if (poem && Array.isArray(data.poems) && data.poems.length) (function () {
    var poems = data.poems;
    var bj = beijingParts(new Date());
    var season = bj.m >= 3 && bj.m <= 5 ? 'spring' : bj.m >= 6 && bj.m <= 8 ? 'summer' : bj.m >= 9 && bj.m <= 11 ? 'autumn' : 'winter';
    var seasonal = poems.filter(function (p) { return p.season === season; });
    var dayNumber = Math.floor(isoToUTC(bj.iso) / DAY);
    // Every other day a seasonal line, otherwise any line; deterministic per day.
    var pool = seasonal.length && dayNumber % 2 === 0 ? seasonal : poems;
    var index = poems.indexOf(pool[dayNumber % pool.length]);
    function show(i) {
      var p = poems[i];
      set(poem, '[data-poem-text]', p.text);
      set(poem, '[data-poem-source]', p.author + '《' + p.title + '》');
    }
    show(index);
    var button = $(poem, '[data-poem-next]');
    button.hidden = false;
    button.addEventListener('click', function () {
      var next = index;
      while (next === index && poems.length > 1) next = Math.floor(Math.random() * poems.length);
      index = next;
      show(index);
    });
  }());

  /* Sky: moon phase and Beijing sunrise/sunset (SunCalc) ------------- */
  var sky = document.querySelector('[data-widget-sky]');
  if (sky && window.SunCalc) (function () {
    var fmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    function name(phase) {
      var names = ['新月', '蛾眉月', '上弦月', '盈凸月', '满月', '亏凸月', '下弦月', '残月'];
      return names[Math.round(phase * 8) % 8];
    }
    function moonPath(phase) {
      // Lit part of a disc of radius 46: outer half-circle + terminator ellipse.
      var r = 46, k = Math.cos(phase * 2 * Math.PI) * r;   // terminator x-radius (signed)
      var waxing = phase < 0.5;
      var outer = waxing ? 1 : 0;                           // lit limb on the right while waxing
      var gibbous = phase > 0.25 && phase < 0.75;           // terminator bulges away from the lit limb
      var inner = gibbous ? outer : 1 - outer;
      return 'M0,' + (-r) + ' A' + r + ',' + r + ' 0 0,' + outer + ' 0,' + r + ' A' + Math.abs(k).toFixed(2) + ',' + r + ' 0 0,' + inner + ' 0,' + (-r) + ' Z';
    }
    function render() {
      var now = new Date();
      var m = SunCalc.getMoonIllumination(now);
      $(sky, '[data-moon-lit]').setAttribute('d', moonPath(m.phase));
      set(sky, '[data-moon-name]', name(m.phase) + ' · 照亮 ' + Math.round(m.fraction * 100) + '%');
      var t = SunCalc.getTimes(now, BEIJING.lat, BEIJING.lng);
      set(sky, '[data-sunrise]', '日出 ' + fmt.format(t.sunrise));
      set(sky, '[data-sunset]', '日落 ' + fmt.format(t.sunset));
      var len = Math.round((t.sunset - t.sunrise) / 60000);
      set(sky, '[data-daylen]', '白昼 ' + Math.floor(len / 60) + ' 小时 ' + (len % 60) + ' 分');
    }
    render();
    window.setInterval(render, 10 * 60000);
  }());

  /* GitHub activity heatmap (data from the weekly workflow) ---------- */
  var heat = document.querySelector('[data-heatmap]');
  if (heat && data.activity && data.activity.days) (function () {
    var days = data.activity.days, end = data.activity.end;
    var WEEKS = 20;
    var endUTC = isoToUTC(end);
    var endDow = new Date(endUTC).getUTCDay();             // 0 = Sunday
    var startUTC = endUTC - ((WEEKS - 1) * 7 + endDow) * DAY;
    var counts = Object.keys(days).map(function (k) { return days[k]; }).sort(function (a, b) { return a - b; });
    function q(p) { return counts.length ? counts[Math.min(counts.length - 1, Math.floor(p * counts.length))] : 1; }
    var cuts = [q(0.25), q(0.5), q(0.75)];
    var frag = document.createDocumentFragment();
    for (var t = startUTC; t <= endUTC; t += DAY) {
      var iso = new Date(t).toISOString().slice(0, 10);
      var c = days[iso] || 0;
      var level = c === 0 ? 0 : c <= cuts[0] ? 1 : c <= cuts[1] ? 2 : c <= cuts[2] ? 3 : 4;
      var cell = document.createElement('span');
      cell.className = 'heatmap__cell l' + level;
      cell.title = iso + ' · ' + c + (c === 1 ? ' contribution' : ' contributions');
      frag.appendChild(cell);
    }
    heat.appendChild(frag);
  }());

  /* Tab title: a small wave when the visitor switches away ------------ */
  var title = document.title, timer = null;
  document.addEventListener('visibilitychange', function () {
    window.clearTimeout(timer);
    if (document.hidden) document.title = '👋 等你回来 · ' + title;
    else { document.title = '✨ 欢迎回来 · ' + title; timer = window.setTimeout(function () { document.title = title; }, 2000); }
  });

  /* Fish pond: click to drop food; pauses off-screen; still frame with reduced motion */
  var pond = document.querySelector('[data-pond]');
  if (pond) (function () {
    var canvas = $(pond, 'canvas'), ctx = canvas.getContext('2d');
    if (!ctx) return;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var W = 0, H = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
    var fish = [], food = [], running = false, visible = true, frame = null, last = 0;
    function colors() {
      var css = getComputedStyle(document.documentElement);
      return { fish: css.getPropertyValue('--accent').trim() || '#33607a', warm: '#c0603f', food: css.getPropertyValue('--muted').trim() || '#666', ripple: css.getPropertyValue('--line-strong').trim() || '#ccc' };
    }
    var col = colors();
    function resize() {
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function spawn() {
      fish = [];
      var n = Math.max(4, Math.min(9, Math.round(W / 140)));
      for (var i = 0; i < n; i++) {
        fish.push({ x: Math.random() * W, y: 12 + Math.random() * (H - 24), a: Math.random() * Math.PI * 2, v: 18 + Math.random() * 14, size: 6 + Math.random() * 5, warm: i % 4 === 0, wiggle: Math.random() * 6 });
      }
    }
    var ripples = [];
    function step(dt) {
      fish.forEach(function (f) {
        var target = null, best = 1e9;
        food.forEach(function (p) { var d = Math.hypot(p.x - f.x, p.y - f.y); if (d < best) { best = d; target = p; } });
        var desired = f.a + (Math.random() - 0.5) * 0.6 * dt * 4;
        var speed = f.v;
        if (target && best < 260) {
          desired = Math.atan2(target.y - f.y, target.x - f.x);
          speed = f.v * 2.2;
          if (best < f.size) { target.eaten = true; f.size = Math.min(f.size + 0.4, 13); }
        }
        // Steer smoothly and keep off the edges.
        if (f.x < 15) desired = 0; else if (f.x > W - 15) desired = Math.PI;
        if (f.y < 10) desired = Math.PI / 2; else if (f.y > H - 10) desired = -Math.PI / 2;
        var turn = Math.atan2(Math.sin(desired - f.a), Math.cos(desired - f.a));
        f.a += Math.max(-2.5 * dt, Math.min(2.5 * dt, turn));
        f.x += Math.cos(f.a) * speed * dt; f.y += Math.sin(f.a) * speed * dt;
        f.wiggle += dt * (speed / 4);
      });
      food = food.filter(function (p) { p.age += dt; p.y += dt * 4; return !p.eaten && p.age < 12; });
      ripples = ripples.filter(function (r) { r.r += dt * 40; return r.r < 40; });
    }
    function draw() {
      ctx.clearRect(0, 0, W, H);
      ripples.forEach(function (r) {
        ctx.globalAlpha = 1 - r.r / 40;
        ctx.strokeStyle = col.ripple; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(r.x, r.y, r.r, r.r * 0.45, 0, 0, Math.PI * 2); ctx.stroke();
      });
      ctx.globalAlpha = 1;
      ctx.fillStyle = col.food;
      food.forEach(function (p) { ctx.beginPath(); ctx.arc(p.x, p.y, 1.8, 0, Math.PI * 2); ctx.fill(); });
      fish.forEach(function (f) {
        ctx.save();
        ctx.translate(f.x, f.y); ctx.rotate(f.a);
        ctx.fillStyle = f.warm ? col.warm : col.fish;
        ctx.globalAlpha = 0.85;
        var s = f.size, tail = Math.sin(f.wiggle) * s * 0.35;
        ctx.beginPath(); ctx.ellipse(0, 0, s, s * 0.42, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-s * 0.8, 0); ctx.lineTo(-s * 1.6, -s * 0.5 + tail); ctx.lineTo(-s * 1.6, s * 0.5 + tail); ctx.closePath(); ctx.fill();
        ctx.restore();
      });
      ctx.globalAlpha = 1;
    }
    function loop(t) {
      var dt = Math.min(0.05, (t - last) / 1000 || 0.016);
      last = t;
      step(dt); draw();
      frame = running ? window.requestAnimationFrame(loop) : null;
    }
    function start() { if (!running && !reduce && visible && !document.hidden) { running = true; last = performance.now(); frame = window.requestAnimationFrame(loop); } }
    function stop() { running = false; if (frame) window.cancelAnimationFrame(frame); frame = null; }
    resize(); spawn(); draw();
    canvas.addEventListener('pointerdown', function (e) {
      var r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      for (var i = 0; i < 5; i++) food.push({ x: x + (Math.random() - 0.5) * 16, y: y + (Math.random() - 0.5) * 8, age: 0 });
      ripples.push({ x: x, y: y, r: 2 });
      if (reduce) { for (var k = 0; k < 40; k++) step(0.05); draw(); }
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) { visible = entries[0].isIntersecting; visible ? start() : stop(); }).observe(pond);
    } else start();
    document.addEventListener('visibilitychange', function () { document.hidden ? stop() : start(); });
    window.addEventListener('resize', function () { resize(); draw(); });
    new MutationObserver(function () { col = colors(); draw(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }());
}());
