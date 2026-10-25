/* Explore page: world notebook and damped oscillator. */
(function () {
  'use strict';

  function $(root, selector) { return root.querySelector(selector); }
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  /* World notebook ------------------------------------------------------ */
  var world = document.querySelector('[data-world]');
  if (world) (function () {
    var data;
    try { data = JSON.parse($(world, '[data-world-data]').textContent); } catch (e) { return; }
    var tabs = Array.prototype.slice.call(world.querySelectorAll('[role="tab"]'));
    var panel = $(world, '[role="tabpanel"]');
    var pins = $(world, '[data-pins]');
    var chips = $(world, '[data-chips]');
    var metrics = $(world, '[data-metrics]');
    var note = $(world, '[data-note]');
    var detail = $(world, '[data-detail]');
    var caption = $(world, '[data-caption]');
    var badge = $(world, '[data-demo-badge]');
    var demoButton = $(world, '[data-demo]');
    var endpoint = world.getAttribute('data-visitors-url');
    var params = new URLSearchParams(window.location.search);
    var view = params.get('view') === 'visitors' ? 'visitors' : 'footprints';
    var demo = false;
    var visitors = { state: endpoint ? 'loading' : 'off', regions: [], unlocated: 0, updated: null };
    var WORLD_REGIONS = 249; // ISO 3166-1 countries and territories

    // Only these fields are read; anything malformed is dropped, never shown.
    function place(item, withVisits) {
      if (!item || typeof item.name !== 'string' || !item.name.trim() || item.name.length > 80) return null;
      var lat = Number(item.lat), lng = Number(item.lng);
      if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
      var code = typeof item.code === 'string' && /^[A-Z]{2}$/.test(item.code) ? item.code : null;
      var visits = Number(item.visits);
      if (withVisits && !(visits >= 0 && Math.floor(visits) === visits)) return null;
      return { name: item.name.trim(), country: item.country || '', code: code, lat: lat, lng: lng, year: item.year || null, visits: withVisits ? visits : null };
    }
    function places(list, withVisits) {
      return (Array.isArray(list) ? list : []).map(function (item) { return place(item, withVisits); }).filter(Boolean);
    }
    var home = place(data.home, false);
    var travel = places(data.travel, false);
    var examples = places(data.example_visitors, true);

    function project(p) {
      // Same equirectangular frame as world.svg: 180°W–180°E, 84°N–60°S.
      return { x: (p.lng + 180) / 360 * 100, y: Math.min(Math.max((84 - p.lat) / 144 * 100, 0), 100) };
    }
    function metric(label, value) {
      var row = el('div');
      row.appendChild(el('dt', '', label));
      row.appendChild(el('dd', '', value));
      metrics.appendChild(row);
    }
    function fmt(n) { return Number(n).toLocaleString('en-US'); }
    function select(item, label, buttons) {
      detail.textContent = label;
      world.querySelectorAll('[aria-pressed]').forEach(function (b) {
        if (b !== demoButton) b.setAttribute('aria-pressed', String(buttons.indexOf(b) !== -1));
      });
    }
    function add(item, label, chipValue, extraClass, size) {
      var pos = project(item);
      var pin = el('button', 'pin' + (extraClass ? ' ' + extraClass : ''));
      pin.type = 'button';
      pin.style.left = pos.x + '%';
      pin.style.top = pos.y + '%';
      if (size) pin.style.setProperty('--size', size + 'px');
      pin.setAttribute('aria-label', label);
      pin.setAttribute('aria-pressed', 'false');
      pin.title = label;
      var chip = el('button', 'chip', item.name);
      chip.type = 'button';
      chip.setAttribute('aria-pressed', 'false');
      chip.appendChild(el('span', '', chipValue));
      var pair = [pin, chip];
      pin.addEventListener('click', function () { select(item, label, pair); });
      chip.addEventListener('click', function () { select(item, label, pair); });
      pins.appendChild(pin);
      chips.appendChild(chip);
    }

    function render() {
      tabs.forEach(function (tab) {
        var on = tab.getAttribute('data-view') === view;
        tab.setAttribute('aria-selected', String(on));
        tab.tabIndex = on ? 0 : -1;
        if (on) panel.setAttribute('aria-labelledby', tab.id);
      });
      pins.textContent = chips.textContent = metrics.textContent = detail.textContent = '';
      var showDemo = view === 'visitors' && demo;
      badge.hidden = !showDemo;
      demoButton.hidden = view !== 'visitors' || visitors.state === 'ready';
      demoButton.textContent = demo ? 'Hide example data' : 'Preview with example data';
      demoButton.setAttribute('aria-pressed', String(demo));

      if (view === 'footprints') {
        var all = (home ? [home] : []).concat(travel);
        var codes = {};
        all.forEach(function (p) { if (p.code) codes[p.code] = true; });
        var count = Object.keys(codes).length;
        metric('Places', String(all.length));
        metric('Countries / regions', String(count));
        metric('Of the world', count ? (count / WORLD_REGIONS * 100).toFixed(1) + '%' : '—');
        note.textContent = travel.length ? 'Places I have lived in or travelled to.' : 'Based in Beijing. More pins as I travel.';
        caption.textContent = 'Markers sit at city centres. "Of the world" counts distinct countries and territories out of ' + WORLD_REGIONS + '.';
        if (home) add(home, home.name + (home.country ? ', ' + home.country : '') + ' · home base', 'Home', 'pin--home');
        travel.forEach(function (p) {
          add(p, p.name + (p.country ? ', ' + p.country : '') + (p.year ? ' · ' + p.year : ''), p.code || '', '');
        });
        return;
      }

      var list = demo ? examples : visitors.regions;
      var total = list.reduce(function (sum, r) { return sum + r.visits; }, 0) + (demo ? 0 : visitors.unlocated);
      var max = list.reduce(function (m, r) { return Math.max(m, r.visits); }, 1);
      var known = demo || visitors.state === 'ready';
      metric('Visitors', known ? fmt(total) : '—');
      metric('Countries / regions', known ? String(list.length) : '—');
      if (demo) {
        note.textContent = 'Made-up numbers, here only to preview the design.';
        caption.textContent = 'Example data — these are not real visits to this site.';
      } else if (visitors.state === 'ready') {
        note.textContent = total ? 'Hello to everyone who stopped by.' : 'No visits recorded yet.';
        caption.textContent = 'Unique visitors per country' + (visitors.since ? ' since ' + visitors.since : '') +
          (visitors.unlocated ? '; ' + fmt(visitors.unlocated) + ' without a known location' : '') +
          (visitors.updated ? '. Updated ' + visitors.updated + '.' : '.') + ' No IP addresses are stored or shown.';
      } else if (visitors.state === 'loading') {
        note.textContent = 'Loading visitor counts…';
        caption.textContent = 'Unique visitors per country. No IP addresses are stored or shown.';
      } else if (visitors.state === 'error') {
        note.textContent = 'Visitor counts are unavailable right now.';
        caption.textContent = 'Unique visitors per country. No IP addresses are stored or shown.';
      } else {
        note.textContent = 'Visitor counting is not switched on yet.';
        caption.textContent = 'When it is, this map will show unique visitors per country — never IP addresses.';
      }
      list.slice().sort(function (a, b) { return b.visits - a.visits; }).forEach(function (r) {
        var size = 7 + Math.round(9 * Math.sqrt(r.visits / max));
        add(r, r.name + ' · ' + fmt(r.visits) + ' visitor' + (r.visits === 1 ? '' : 's'), fmt(r.visits), '', size);
      });
    }

    tabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () { view = tab.getAttribute('data-view'); render(); });
      tab.addEventListener('keydown', function (event) {
        var next = null;
        if (event.key === 'ArrowRight') next = (i + 1) % tabs.length;
        if (event.key === 'ArrowLeft') next = (i + tabs.length - 1) % tabs.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = tabs.length - 1;
        if (next === null) return;
        event.preventDefault();
        view = tabs[next].getAttribute('data-view');
        render();
        tabs[next].focus();
      });
    });
    demoButton.addEventListener('click', function () { demo = !demo; render(); });
    render();

    if (endpoint) {
      var controller = window.AbortController ? new AbortController() : null;
      var timer = window.setTimeout(function () { if (controller) controller.abort(); }, 8000);
      fetch(endpoint, { credentials: 'omit', cache: 'no-cache', signal: controller ? controller.signal : undefined })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function (json) {
          visitors.regions = places(json.regions, true);
          visitors.unlocated = Number(json.unlocated_visits) >= 0 ? Math.floor(Number(json.unlocated_visits)) : 0;
          visitors.updated = typeof json.updated_at === 'string' ? json.updated_at.slice(0, 16).replace('T', ' ') + ' UTC' : null;
          visitors.since = typeof json.period_start === 'string' ? json.period_start.slice(0, 10) : null;
          visitors.state = 'ready';
          demo = false;
        })
        .catch(function () { visitors.state = 'error'; })
        .then(function () { window.clearTimeout(timer); render(); });
    }
  }());

  /* Damped oscillator --------------------------------------------------- */
  var lab = document.querySelector('[data-oscillator]');
  if (lab) (function () {
    var WN = Math.PI;          // natural frequency (rad/s): period 2 s
    var T_MAX = 8;
    var plot = { left: 40, right: 590, top: 12, bottom: 212, yMax: 1.1 };
    var zetaInput = $(lab, '[data-zeta]'), timeInput = $(lab, '[data-time]');
    var playButton = $(lab, '[data-play]');
    var playing = false, last = null, frame = null;

    function displacement(zeta, t) {
      if (zeta < 1 - 1e-9) {
        var wd = WN * Math.sqrt(1 - zeta * zeta);
        return Math.exp(-zeta * WN * t) * (Math.cos(wd * t) + zeta * WN / wd * Math.sin(wd * t));
      }
      if (zeta <= 1 + 1e-9) return Math.exp(-WN * t) * (1 + WN * t);
      var root = Math.sqrt(zeta * zeta - 1);
      var s1 = -WN * (zeta - root), s2 = -WN * (zeta + root);
      return (s2 * Math.exp(s1 * t) - s1 * Math.exp(s2 * t)) / (s2 - s1);
    }
    function regime(zeta) {
      if (zeta === 0) return 'Undamped: it rings forever';
      if (zeta < 1 - 1e-9) return 'Underdamped: it rings and decays';
      if (zeta <= 1 + 1e-9) return 'Critically damped: fastest return, no overshoot';
      return 'Overdamped: it creeps back';
    }
    function px(t) { return plot.left + t / T_MAX * (plot.right - plot.left); }
    function py(x) { return (plot.top + plot.bottom) / 2 - x / plot.yMax * (plot.bottom - plot.top) / 2; }
    function svg(tag, attrs, text) {
      var node = document.createElementNS('http://www.w3.org/2000/svg', tag);
      Object.keys(attrs).forEach(function (k) { node.setAttribute(k, attrs[k]); });
      if (text !== undefined) node.textContent = text;
      return node;
    }

    // Static axes and labels.
    var grid = $(lab, '[data-grid]');
    [-1, 0, 1].forEach(function (v) {
      grid.appendChild(svg('line', { class: v === 0 ? 'lab__axis' : 'lab__grid', x1: plot.left, x2: plot.right, y1: py(v), y2: py(v) }));
      grid.appendChild(svg('text', { x: plot.left - 8, y: py(v) + 4, 'text-anchor': 'end' }, v === 0 ? '0' : (v > 0 ? '+1' : '−1')));
    });
    for (var s = 0; s <= T_MAX; s += 2) {
      grid.appendChild(svg('text', { x: px(s), y: plot.bottom + 22, 'text-anchor': 'middle' }, s + ' s'));
    }

    function drawCurve(zeta) {
      var d = '', env = '';
      for (var i = 0; i <= 400; i++) {
        var t = i / 400 * T_MAX;
        d += (i ? 'L' : 'M') + px(t).toFixed(1) + ',' + py(displacement(zeta, t)).toFixed(1);
      }
      $(lab, '[data-curve]').setAttribute('d', d);
      if (zeta > 0 && zeta < 1 - 1e-9) {
        var a = 1 / Math.sqrt(1 - zeta * zeta);
        ['+', '-'].forEach(function (sign) {
          for (var j = 0; j <= 80; j++) {
            var tt = j / 80 * T_MAX, v = a * Math.exp(-zeta * WN * tt) * (sign === '+' ? 1 : -1);
            env += (j ? 'L' : 'M') + px(tt).toFixed(1) + ',' + py(Math.max(Math.min(v, plot.yMax), -plot.yMax)).toFixed(1);
          }
        });
      }
      $(lab, '[data-envelope]').setAttribute('d', env);
    }

    // Rig: wall on the left, mass slides horizontally around x0.
    var REST = 130, SCALE = 52, WALL = 20, MASS_W = 40;
    $(lab, '[data-rest]').setAttribute('x1', REST); $(lab, '[data-rest]').setAttribute('x2', REST);
    $(lab, '[data-rest-label]').setAttribute('x', REST);
    function drawRig(x) {
      var left = REST + x * SCALE - MASS_W / 2;
      $(lab, '[data-mass]').setAttribute('x', left.toFixed(1));
      var coils = 9, y = 82, amp = 9, start = WALL, end = left, pts = [start + ',' + y];
      var lead = 8, span = end - start - 2 * lead;
      pts.push((start + lead) + ',' + y);
      for (var i = 0; i < coils; i++) {
        pts.push((start + lead + span * (i + 0.5) / coils).toFixed(1) + ',' + (y + (i % 2 ? amp : -amp)));
      }
      pts.push((end - lead) + ',' + y, end + ',' + y);
      $(lab, '[data-spring]').setAttribute('points', pts.join(' '));
      var dy = 120, cupX = WALL + 30, rodEnd = left;
      $(lab, '[data-damper-cup]').setAttribute('d', 'M' + WALL + ',' + dy + 'H' + cupX + 'M' + cupX + ',' + (dy - 11) + 'V' + (dy + 11) + 'M' + cupX + ',' + (dy - 11) + 'H' + (cupX + 46) + 'M' + cupX + ',' + (dy + 11) + 'H' + (cupX + 46));
      var piston = Math.max(cupX + 6, Math.min(cupX + 40, left - 34));
      $(lab, '[data-damper-rod]').setAttribute('d', 'M' + piston + ',' + (dy - 8) + 'V' + (dy + 8) + 'M' + piston + ',' + dy + 'H' + rodEnd);
    }

    function update() {
      var zeta = Number(zetaInput.value), t = Number(timeInput.value);
      var x = displacement(zeta, t);
      $(lab, '[data-zeta-out]').textContent = zeta.toFixed(2);
      $(lab, '[data-time-out]').textContent = t.toFixed(2) + ' s';
      $(lab, '[data-x]').textContent = 'x = ' + (Math.abs(x) < 5e-4 ? 0 : x).toFixed(3);
      var label = regime(zeta);
      if ($(lab, '[data-regime]').textContent !== label) $(lab, '[data-regime]').textContent = label;
      var now = $(lab, '[data-now]');
      now.setAttribute('x1', px(t)); now.setAttribute('x2', px(t));
      var dot = $(lab, '[data-dot]');
      dot.setAttribute('cx', px(t)); dot.setAttribute('cy', py(x));
      drawRig(x);
    }
    function setPlaying(on) {
      playing = on;
      playButton.textContent = on ? 'Pause' : 'Play';
      playButton.setAttribute('aria-pressed', String(on));
      if (frame) window.cancelAnimationFrame(frame);
      frame = null; last = null;
      if (on) frame = window.requestAnimationFrame(step);
    }
    function step(stamp) {
      if (last !== null) {
        var t = Number(timeInput.value) + (stamp - last) / 1000;
        if (t >= T_MAX) { timeInput.value = T_MAX; update(); setPlaying(false); return; }
        timeInput.value = t;
        update();
      }
      last = stamp;
      frame = window.requestAnimationFrame(step);
    }

    zetaInput.addEventListener('input', function () { drawCurve(Number(zetaInput.value)); update(); });
    timeInput.addEventListener('input', function () { if (playing) setPlaying(false); update(); });
    playButton.addEventListener('click', function () {
      if (!playing && Number(timeInput.value) >= T_MAX) timeInput.value = 0;
      setPlaying(!playing);
    });
    $(lab, '[data-step]').addEventListener('click', function () {
      setPlaying(false);
      timeInput.value = Math.min(T_MAX, Math.round((Number(timeInput.value) + 0.25) * 100) / 100);
      update();
    });
    $(lab, '[data-reset]').addEventListener('click', function () {
      setPlaying(false);
      timeInput.value = 0;
      update();
    });
    document.addEventListener('visibilitychange', function () { if (document.hidden && playing) setPlaying(false); });

    drawCurve(Number(zetaInput.value));
    update();
  }());
}());
