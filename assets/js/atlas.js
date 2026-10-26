/* World notebook: a layered map (world → country → province) for footprints,
 * and a country-level map of visitors. Map shapes are prebuilt SVG paths in
 * /assets/data/map/ (see scripts/map/build.mjs); nothing loads from elsewhere. */
(function () {
  'use strict';
  var root = document.querySelector('[data-atlas]');
  if (!root || !window.fetch) return;

  var SVGNS = 'http://www.w3.org/2000/svg';
  var base = root.getAttribute('data-map-base');
  var endpoint = root.getAttribute('data-visitors-url');
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var WORLD_REGIONS = 249;            // ISO 3166-1 countries and territories
  var LAYERS = { CN: 'cn', JP: 'jp', US: 'us', MY: 'my' };

  function $(sel) { return root.querySelector(sel); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function svg(tag, attrs) {
    var n = document.createElementNS(SVGNS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }
  // d3 geoMercator with the scale / translate stored in each province detail map.
  function mercator(p, lng, lat) {
    var r = Math.PI / 180;
    return [p.translate[0] + p.scale * lng * r, p.translate[1] - p.scale * Math.log(Math.tan(Math.PI / 4 + lat * r / 2))];
  }
  function fmt(n) { return Number(n).toLocaleString('en-US'); }
  var cache = {};
  function load(name) {
    if (!cache[name]) {
      cache[name] = fetch(base + name + '.json', { credentials: 'same-origin' }).then(function (r) {
        if (!r.ok) throw new Error(name + ': ' + r.status);
        return r.json();
      });
      cache[name].catch(function () { delete cache[name]; });
    }
    return cache[name];
  }

  var data;
  try { data = JSON.parse($('[data-atlas-data]').textContent); } catch (e) { return; }

  /* Footprints model --------------------------------------------------- */
  var trips = (data.footprints && data.footprints.countries) || [];
  var visitedCountries = {};            // world-map id → country entry
  var regionsByCountry = {};            // code → { regionId → region }
  var counted = {};                     // codes counted as countries / regions
  var cities = 0, cnProvinces = 0, home = null;
  trips.forEach(function (c) {
    visitedCountries[c.code] = c;
    counted[c.code] = c.name;
    var map = regionsByCountry[c.code] = {};
    (c.regions || []).forEach(function (r) {
      map[String(r.id)] = r;
      if (r.counts_as) counted[r.counts_as] = r.name;
      if (r.home) home = { country: c.code, region: String(r.id) };
      if (c.code === 'CN') cnProvinces++;
      // Cities: prefecture-level cities listed, or a division that is itself a city.
      cities += (r.cities || []).length || (r.city ? 1 : 0);
    });
  });
  var countedCodes = Object.keys(counted);

  /* Visitors model ----------------------------------------------------- */
  function cleanVisits(list) {
    return (Array.isArray(list) ? list : []).filter(function (r) {
      return r && typeof r.name === 'string' && /^[A-Z]{2}$/.test(r.code) && Number(r.visits) >= 0 && Math.floor(r.visits) === Number(r.visits);
    }).map(function (r) { return { name: r.name, code: r.code, visits: Number(r.visits) }; });
  }
  var examples = cleanVisits(data.examples);
  var visitors = { state: endpoint ? 'loading' : 'off', regions: [], unlocated: 0, updated: null, since: null };
  // Hong Kong, Macao and Taiwan visits are drawn inside China on the map.
  var MAP_ID = { HK: 'CN', MO: 'CN', TW: 'CN' };

  /* State and DOM ------------------------------------------------------ */
  var state = { tab: 'footprints', country: null, province: null, demo: false };
  var stage = $('[data-stage]'), map = $('[data-map]'), tip = $('[data-tip]');
  var gWorld = $('[data-layer="world"]'), gCountry = $('[data-layer="country"]'), gMarks = $('[data-layer="marks"]');
  var inset = $('[data-inset]'), insetMap = $('[data-inset-map]');
  var tabs = Array.prototype.slice.call(root.querySelectorAll('[role="tab"]'));
  var world = null, layer = null;
  var full = { x: 0, y: 0, w: 1000, h: 448 };     // the world drawing
  var ratio = full.h / full.w;                      // height / width of the map element
  var view = { x: 0, y: 0, w: 1000, h: 448 };
  var home_view = null;                             // what "reset" returns to; null = whole world

  // The whole world, letterboxed to the element's shape.
  function worldView() {
    var w = full.w, h = w * ratio;
    if (h < full.h) { h = full.h; w = h / ratio; }
    return { x: full.x + (full.w - w) / 2, y: full.y + (full.h - h) / 2, w: w, h: h };
  }

  /* View box: animate, clamp, pan, zoom -------------------------------- */
  var animation = null;
  function apply() {
    map.setAttribute('viewBox', [view.x, view.y, view.w, view.h].map(function (v) { return v.toFixed(2); }).join(' '));
    updateMarks();
    sharpen();
    sharpenMore();
  }
  // Once zoomed in past about 2x, swap in detailed borders (world-hi.json, loaded once).
  var detail = null;
  function sharpen() {
    if (detail || !world || view.w > full.w / 2) return;
    detail = 'loading';
    load('world-hi').then(function (hi) {
      hi.countries.forEach(function (c) { if (countryNodes[c.id] && !hd[c.id]) countryNodes[c.id].setAttribute('d', c.d); });
      if (hi.kashmir) $('[data-kashmir]').setAttribute('d', hi.kashmir);
      detail = 'done';
    }).catch(function () { detail = null; });
  }
  // Past about 16x, load the finest borders (hd/), one file per country or Chinese
  // province, only for what is on screen.
  var hd = {};
  function onScreen(b) { return !(b[2] < view.x || b[0] > view.x + view.w || b[3] < view.y || b[1] > view.y + view.h); }
  function fetchHd(key, use) {
    if (hd[key]) return;
    hd[key] = 'loading';
    load('hd/' + key).then(function (x) { hd[key] = 'done'; use(x); }).catch(function () { delete hd[key]; });
  }
  function setShape(group, id, d) {
    var node = group.querySelector('[data-id="' + id + '"]');
    if (node) node.setAttribute('d', d);
  }
  function sharpenMore() {
    if (!world || view.w > full.w / 16) return;
    world.countries.forEach(function (c) {
      if (onScreen(c.box)) fetchHd(c.id, function (x) { setShape(gWorld, c.id, x.d); });
    });
    var l = layer;
    if (!l || state.tab !== 'footprints') return;
    if (l.id === 'CN') {
      l.regions.forEach(function (r) {
        if (onScreen(r.box)) fetchHd('cn-' + r.id, function (x) { r.d = x.d; if (layer === l) setShape(gCountry, r.id, x.d); });
      });
    } else {
      fetchHd(l.id.toLowerCase(), function (x) {
        var byId = {};
        x.regions.forEach(function (r) { byId[r.id] = r.d; });
        l.regions.forEach(function (r) { if (byId[r.id]) { r.d = byId[r.id]; if (layer === l) setShape(gCountry, r.id, r.d); } });
      });
    }
  }
  function clamp(v) {
    // Zoom between the whole world and 1/400 of it; keep the centre over the drawing.
    var w = Math.min(Math.max(v.w, full.w / 400), worldView().w), h = w * ratio;
    var cx = Math.min(Math.max(v.x + v.w / 2, full.x), full.x + full.w);
    var cy = Math.min(Math.max(v.y + v.h / 2, full.y), full.y + full.h);
    return { x: cx - w / 2, y: cy - h / 2, w: w, h: h };
  }
  function animateTo(target) {
    target = clamp(target);
    if (animation) cancelAnimationFrame(animation);
    if (reduceMotion) { view = target; apply(); return; }
    var from = { x: view.x, y: view.y, w: view.w, h: view.h }, t0 = null;
    function step(t) {
      if (t0 === null) t0 = t;
      var k = Math.min(1, (t - t0) / 550), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      // Interpolate the zoom geometrically so it feels even.
      var w = from.w * Math.pow(target.w / from.w, e);
      var cx = from.x + from.w / 2 + (target.x + target.w / 2 - from.x - from.w / 2) * e;
      var cy = from.y + from.h / 2 + (target.y + target.h / 2 - from.y - from.h / 2) * e;
      var h = w * ratio;
      view = { x: cx - w / 2, y: cy - h / 2, w: w, h: h };
      apply();
      animation = k < 1 ? requestAnimationFrame(step) : null;
    }
    animation = requestAnimationFrame(step);
  }
  // Follow the element's shape (CSS sets a taller map on phones).
  function measure() {
    var r = map.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    var next = r.height / r.width;
    if (Math.abs(next - ratio) < 1e-3) return false;
    ratio = next;
    return true;
  }
  function fitBox(b, padding) {
    var p = padding || 0.12, bw = (b[2] - b[0]) || 1, bh = (b[3] - b[1]) || 1;
    var w = Math.max(bw * (1 + 2 * p), bh * (1 + 2 * p) / ratio, full.w / 40);
    var h = w * ratio;
    return { x: (b[0] + b[2]) / 2 - w / 2, y: (b[1] + b[3]) / 2 - h / 2, w: w, h: h };
  }
  function zoomAt(factor, px, py) {
    var nw = view.w / factor;
    var fx = px === undefined ? 0.5 : px, fy = py === undefined ? 0.5 : py;
    var target = { x: view.x + (view.w - nw) * fx, y: view.y + (view.h - nw * ratio) * fy, w: nw, h: nw * ratio };
    if (animation) cancelAnimationFrame(animation);
    view = clamp(target);
    apply();
  }
  function toSvg(clientX, clientY) {
    var r = map.getBoundingClientRect();
    // preserveAspectRatio meet: the drawing may be letterboxed inside the element.
    var scale = Math.min(r.width / view.w, r.height / view.h);
    var ox = (r.width - view.w * scale) / 2, oy = (r.height - view.h * scale) / 2;
    return { fx: (clientX - r.left - ox) / (view.w * scale), fy: (clientY - r.top - oy) / (view.h * scale), scale: scale };
  }

  // Pointer: drag to pan, two fingers to pinch. Vertical one-finger moves stay
  // with the page (touch-action: pan-y), so the map never traps scrolling.
  var pointers = {}, drag = null, moved = false;
  map.addEventListener('pointerdown', function (e) {
    pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    moved = false;
    var ids = Object.keys(pointers);
    if (ids.length === 1) drag = { x: e.clientX, y: e.clientY, view: { x: view.x, y: view.y, w: view.w, h: view.h } };
    if (ids.length === 2) {
      var a = pointers[ids[0]], b = pointers[ids[1]];
      drag = { pinch: Math.hypot(a.x - b.x, a.y - b.y), view: { x: view.x, y: view.y, w: view.w, h: view.h }, mid: toSvg((a.x + b.x) / 2, (a.y + b.y) / 2) };
    }
  });
  map.addEventListener('pointermove', function (e) {
    if (!pointers[e.pointerId] || !drag) return;
    pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    var ids = Object.keys(pointers);
    if (drag.pinch && ids.length === 2) {
      var a = pointers[ids[0]], b = pointers[ids[1]];
      var f = Math.hypot(a.x - b.x, a.y - b.y) / drag.pinch;
      var nw = drag.view.w / f, nh = nw * ratio;
      view = clamp({ x: drag.view.x + (drag.view.w - nw) * drag.mid.fx, y: drag.view.y + (drag.view.h - nh) * drag.mid.fy, w: nw, h: nh });
      apply(); moved = true;
      return;
    }
    var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!moved && Math.hypot(dx, dy) < 5) return;
    if (!moved) { moved = true; try { map.setPointerCapture(e.pointerId); } catch (err) {} }
    var s = toSvg(e.clientX, e.clientY).scale;
    view = clamp({ x: drag.view.x - dx / s, y: drag.view.y - dy / s, w: drag.view.w, h: drag.view.h });
    apply();
    hideTip();
  });
  function endPointer(e) { delete pointers[e.pointerId]; if (!Object.keys(pointers).length) drag = null; }
  map.addEventListener('pointerup', endPointer);
  map.addEventListener('pointercancel', endPointer);
  map.addEventListener('wheel', function (e) {
    if (!(e.ctrlKey || e.metaKey)) return;          // plain wheel scrolls the page
    e.preventDefault();
    var p = toSvg(e.clientX, e.clientY);
    zoomAt(Math.exp(-e.deltaY * 0.0025), p.fx, p.fy);
  }, { passive: false });
  root.querySelectorAll('[data-zoom]').forEach(function (b) {
    b.addEventListener('click', function () {
      var z = b.getAttribute('data-zoom');
      if (z === 'reset') animateTo(home_view ? fitBox(home_view.box, home_view.pad) : worldView());
      else zoomAt(z === 'in' ? 1.6 : 1 / 1.6);
    });
  });

  /* Tooltip -------------------------------------------------------------- */
  function showTip(text, clientX, clientY) {
    var r = stage.getBoundingClientRect();
    tip.textContent = text;
    tip.hidden = false;
    var x = Math.min(Math.max(clientX - r.left + 12, 8), r.width - tip.offsetWidth - 8);
    var y = Math.max(clientY - r.top - tip.offsetHeight - 10, 8);
    tip.style.transform = 'translate(' + x + 'px,' + y + 'px)';
  }
  function hideTip() { tip.hidden = true; }
  map.addEventListener('pointerleave', hideTip);

  /* Shapes ---------------------------------------------------------------- */
  function interactive(node, label, onActivate) {
    node.setAttribute('tabindex', '0');
    node.setAttribute('role', 'button');
    node.setAttribute('aria-label', label);
    node.addEventListener('click', function (e) { if (!moved) onActivate(e); });
    node.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onActivate(e); }
    });
  }
  function hover(node, textFn) {
    node.addEventListener('pointermove', function (e) { if (!drag) showTip(textFn(), e.clientX, e.clientY); });
  }

  var countryNodes = {};
  function drawWorld() {
    gWorld.textContent = '';
    countryNodes = {};
    world.countries.forEach(function (c) {
      var p = svg('path', { d: c.d, class: 'atlas__country', 'data-id': c.id });
      countryNodes[c.id] = p;
      hover(p, function () { return tipForCountry(c); });
      gWorld.appendChild(p);
    });
    $('[data-kashmir]').setAttribute('d', world.kashmir);
    $('[data-dash]').setAttribute('d', world.dash);
  }
  function tipForCountry(c) {
    if (state.tab === 'visitors') {
      var v = visitsByMapId()[c.id];
      return c.name + (v ? ' · ' + fmt(v) + ' visitor' + (v === 1 ? '' : 's') : '');
    }
    return c.name + (visitedCountries[c.id] ? (LAYERS[c.id] && state.country !== c.id ? ' · click to zoom in' : ' · visited') : '');
  }
  function visitsByMapId() {
    var list = state.demo ? examples : visitors.regions, out = {};
    list.forEach(function (r) { var id = MAP_ID[r.code] || r.code; out[id] = (out[id] || 0) + r.visits; });
    return out;
  }

  // Markers for visited places too small to see (e.g. Singapore, Hong Kong, Macao).
  function marker(cx, cy, label, onActivate, cls) {
    var g = svg('g', { class: 'atlas__mark' + (cls ? ' ' + cls : ''), transform: 'translate(' + cx + ',' + cy + ')' });
    g.appendChild(svg('circle', { r: 9, class: 'atlas__mark-hit' }));
    g.appendChild(svg('circle', { r: 3.2, class: 'atlas__mark-dot' }));
    interactive(g, label, onActivate);
    hover(g, function () { return label; });
    gMarks.appendChild(g);
    return g;
  }
  // Keep markers the same size on screen whatever the zoom.
  var markScale = 1;
  function updateMarks() {
    var r = map.getBoundingClientRect();
    var k = r.width ? view.w / r.width : 1;
    if (Math.abs(k - markScale) < 1e-4) return;
    markScale = k;
    gMarks.querySelectorAll('.atlas__mark').forEach(function (g) {
      g.setAttribute('transform', g.getAttribute('transform').replace(/ scale\([^)]*\)/, '') + ' scale(' + k.toFixed(4) + ')');
    });
  }

  /* Rendering per tab and level ------------------------------------------ */
  function render() {
    tabs.forEach(function (t) {
      var on = t.getAttribute('data-view') === state.tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
    });
    root.classList.toggle('is-visitors', state.tab === 'visitors');
    var visits = state.tab === 'visitors' ? visitsByMapId() : null;
    var max = 1;
    if (visits) Object.keys(visits).forEach(function (k) { max = Math.max(max, visits[k]); });
    world.countries.forEach(function (c) {
      var p = countryNodes[c.id];
      p.removeAttribute('tabindex'); p.removeAttribute('role'); p.removeAttribute('aria-label');
      p.classList.remove('is-visited', 'is-open', 'v1', 'v2', 'v3', 'v4');
      if (visits) {
        var v = visits[c.id];
        if (v) p.classList.add('v' + Math.min(4, 1 + Math.floor(Math.sqrt(v / max) * 3.999)));
      } else if (visitedCountries[c.id]) {
        p.classList.add('is-visited');
        if (state.country === c.id && layer) p.classList.add('is-open');
      }
    });
    world.countries.forEach(function (c) {
      var p = countryNodes[c.id];
      if (!visits && visitedCountries[c.id] && state.country !== c.id && !p._bound) {
        p._bound = true;
        p.addEventListener('click', function () { if (!moved && state.tab === 'footprints' && visitedCountries[c.id]) openCountry(c.id); });
      }
      if (!visits && visitedCountries[c.id] && state.country !== c.id) {
        p.setAttribute('tabindex', '0'); p.setAttribute('role', 'button');
        p.setAttribute('aria-label', c.name + ', visited' + (LAYERS[c.id] ? ' — open its provinces' : ''));
      }
    });
    // Redrawing removes the chip or shape that had focus; keep focus in the map.
    var hadFocus = root.contains(document.activeElement) && !inset.contains(document.activeElement);
    renderCountryLayer();
    renderMarks();
    renderCrumbs();
    renderSide();
    renderChips();
    if (hadFocus && !root.contains(document.activeElement)) $('[data-crumbs] .is-current').focus({ preventScroll: true });
  }
  // Keyboard for country paths (bound once).
  gWorld.addEventListener('keydown', function (e) {
    var id = e.target.getAttribute && e.target.getAttribute('data-id');
    if (id && (e.key === 'Enter' || e.key === ' ') && state.tab === 'footprints' && visitedCountries[id]) { e.preventDefault(); openCountry(id); }
  });

  function renderCountryLayer() {
    gCountry.textContent = '';
    root.classList.toggle('is-zoomed', !!(layer && state.country && state.tab === 'footprints'));
    if (!layer || state.tab !== 'footprints' || state.country !== layer.id) return;
    var visited = regionsByCountry[layer.id] || {};
    // A country listed without regions was visited as a whole: shade every region lightly.
    var whole = !Object.keys(visited).length;
    layer.regions.forEach(function (r) {
      var v = visited[r.id];
      var p = svg('path', { d: r.d, 'data-id': r.id, class: 'atlas__region' + (v ? ' is-visited' : '') + (whole ? ' is-whole' : '') + (v && v.home ? ' is-home' : '') + (state.province === r.id ? ' is-selected' : '') });
      var label = (v && v.name) || r.name;
      var both = r.zh && r.zh !== label ? label + ' ' + r.zh : label;
      hover(p, function () { return both + (v ? (v.home ? ' · home' : ' · visited') : ''); });
      if (layer.id === 'CN') interactive(p, both + (v ? ', visited' : '') + ' — show detail', function () { openProvince(r); });
      gCountry.appendChild(p);
    });
    if (layer.dash) gCountry.appendChild(svg('path', { d: layer.dash, class: 'atlas__dash' }));
  }
  function renderMarks() {
    gMarks.textContent = '';
    markScale = 0;
    if (state.tab !== 'footprints' || !world) return;
    if (!state.country) {
      // Small visited countries get a dot at world level.
      world.countries.forEach(function (c) {
        if (visitedCountries[c.id] && c.area < 60) marker(c.c[0], c.c[1], c.name + ', visited', function () { openCountry(c.id); });
      });
    } else if (layer && layer.id === state.country) {
      var visited = regionsByCountry[layer.id] || {};
      layer.regions.forEach(function (r) {
        var v = visited[r.id];
        var small = (r.box[2] - r.box[0]) * (r.box[3] - r.box[1]) < 0.6;
        if (v && (small || v.home)) {
          marker(r.c[0], r.c[1], (v.name || r.name) + (v.home ? ', home' : ', visited'), function () { openProvince(r); }, v.home ? 'is-home' : '');
        }
      });
    }
    updateMarks();
  }
  function renderCrumbs() {
    var nav = $('[data-crumbs]');
    nav.textContent = '';
    var parts = [{ label: 'World', go: closeCountry }];
    if (state.tab === 'footprints' && state.country) {
      var c = visitedCountries[state.country];
      parts.push({ label: c ? c.name : state.country, go: closeProvince });
      if (state.province && layer) {
        var r = layer.regions.filter(function (x) { return x.id === state.province; })[0];
        var v = (regionsByCountry[state.country] || {})[state.province];
        parts.push({ label: (v && v.name) || (r && r.name) || state.province });
      }
    }
    parts.forEach(function (p, i) {
      if (i) {
        var sep = el('span', 'atlas__crumb-sep', '›');
        sep.setAttribute('aria-hidden', 'true');
        nav.appendChild(sep);
      }
      if (i < parts.length - 1) {
        var b = el('button', 'atlas__crumb', p.label);
        b.type = 'button';
        b.addEventListener('click', p.go);
        nav.appendChild(b);
      } else {
        var s = el('span', 'atlas__crumb is-current', p.label);
        s.setAttribute('aria-current', 'location');
        s.tabIndex = -1;
        nav.appendChild(s);
      }
    });
  }
  function metric(label, value) {
    var row = el('div');
    row.appendChild(el('dt', '', label));
    row.appendChild(el('dd', '', value));
    $('[data-metrics]').appendChild(row);
  }
  function renderSide() {
    var metrics = $('[data-metrics]'), note = $('[data-note]'), caption = $('[data-caption]');
    var demoButton = $('[data-demo]'), badge = $('[data-demo-badge]');
    metrics.textContent = '';
    badge.hidden = !(state.tab === 'visitors' && state.demo);
    demoButton.hidden = state.tab !== 'visitors' || visitors.state === 'ready';
    demoButton.textContent = state.demo ? 'Hide example data' : 'Preview with example data';
    demoButton.setAttribute('aria-pressed', String(state.demo));
    if (state.tab === 'footprints') {
      metric('Countries / regions', String(countedCodes.length));
      metric('Chinese provinces', cnProvinces + ' / 34');
      metric('Cities in China', String(cities));
      metric('Of the world', (countedCodes.length / WORLD_REGIONS * 100).toFixed(1) + '%');
      var open = state.country && visitedCountries[state.country];
      if (!open) note.textContent = 'Based in Beijing. Click a highlighted country to zoom in.';
      else if (!(open.regions && open.regions.length)) note.textContent = 'Visited ' + open.name + '; places inside it are not noted separately.';
      else note.textContent = 'Shaded: provinces I have been to. Click one for the cities inside it.';
      caption.textContent = '"Countries / regions" counts Hong Kong, Macao and Taiwan separately; "of the world" is out of ' + WORLD_REGIONS + '. Drag to move; Ctrl / ⌘ + scroll or pinch to zoom.';
      return;
    }
    var list = state.demo ? examples : visitors.regions;
    var total = list.reduce(function (s, r) { return s + r.visits; }, 0) + (state.demo ? 0 : visitors.unlocated);
    var known = state.demo || visitors.state === 'ready';
    metric('Visitors', known ? fmt(total) : '—');
    metric('Countries / regions', known ? String(list.length) : '—');
    if (state.demo) {
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
    } else if (visitors.state === 'pending') {
      note.textContent = 'Counting has started; the first numbers appear after the next daily update.';
      caption.textContent = 'Unique visitors per country, updated once a day. No IP addresses are stored or shown.';
    } else if (visitors.state === 'error') {
      note.textContent = 'Visitor counts are unavailable right now.';
      caption.textContent = 'Unique visitors per country. No IP addresses are stored or shown.';
    } else {
      note.textContent = 'Visitor counting is not switched on yet.';
      caption.textContent = 'When it is, this map will show unique visitors per country — never IP addresses.';
    }
  }
  function chip(label, value, onClick, pressed) {
    var b = el('button', 'chip', label);
    b.type = 'button';
    if (value) b.appendChild(el('span', '', value));
    if (pressed !== undefined) b.setAttribute('aria-pressed', String(pressed));
    b.addEventListener('click', onClick);
    $('[data-chips]').appendChild(b);
  }
  function renderChips() {
    $('[data-chips]').textContent = '';
    if (state.tab === 'visitors') {
      (state.demo ? examples : visitors.regions).slice().sort(function (a, b) { return b.visits - a.visits; }).forEach(function (r) {
        chip(r.name, fmt(r.visits), function () {
          var c = world.countries.filter(function (x) { return x.id === (MAP_ID[r.code] || r.code); })[0];
          if (c) animateTo(fitBox(c.focus || c.box, 0.6));
        });
      });
      return;
    }
    if (!state.country) {
      trips.forEach(function (c) {
        chip(c.name, c.code, function () { openCountry(c.code); });
        (c.regions || []).forEach(function (r) {
          if (r.counts_as) chip(r.name, r.counts_as, function () { openCountry(c.code, String(r.id)); });
        });
      });
      return;
    }
    var entry = visitedCountries[state.country] || {};
    (entry.regions || []).forEach(function (r) {
      chip(r.name, r.home ? 'Home' : (r.cities && r.cities.length ? r.cities.length + (r.cities.length === 1 ? ' city' : ' cities') : ''), function () {
        var shape = layer && layer.regions.filter(function (x) { return x.id === String(r.id); })[0];
        if (!shape) return;
        // China's provinces open a city window; elsewhere, zoom to the state.
        if (layer.id === 'CN') openProvince(shape);
        else animateTo(fitBox(shape.box, 0.6));
      }, state.province === String(r.id));
    });
  }

  /* Navigation ----------------------------------------------------------- */
  function openCountry(code, provinceId) {
    if (state.tab !== 'footprints') return;
    var c = world.countries.filter(function (x) { return x.id === code; })[0];
    if (!c) return;
    state.country = code;
    state.province = null;
    closeInsetOnly();
    if (!LAYERS[code]) {
      layer = null;
      home_view = { box: c.focus || c.box, pad: 0.3 };
      animateTo(fitBox(home_view.box, 0.3));
      render();
      return;
    }
    $('[data-loading]').hidden = false;
    load(LAYERS[code]).then(function (l) {
      if (state.country !== code) return;
      layer = l;
      home_view = { box: l.box, pad: 0.06 };
      animateTo(fitBox(l.box, 0.06));
      render();
      if (provinceId) {
        var shape = l.regions.filter(function (x) { return x.id === provinceId; })[0];
        if (shape) openProvince(shape);
      }
    }).catch(function () {
      home_view = { box: c.focus || c.box, pad: 0.1 };
      animateTo(fitBox(home_view.box, 0.1));
      render();
    }).then(function () { $('[data-loading]').hidden = true; });
  }
  function closeCountry() {
    state.country = null;
    state.province = null;
    layer = null;
    closeInsetOnly();
    home_view = null;
    animateTo(worldView());
    render();
  }
  function closeInsetOnly() { inset.hidden = true; root.classList.remove('has-inset'); }
  function closeProvince() {
    var from = state.province, hadFocus = inset.contains(document.activeElement);
    state.province = null;
    closeInsetOnly();
    render();
    // Keep keyboard focus in the map: back on the province the window came from.
    var back = from && gCountry.querySelector('[data-id="' + from + '"]');
    if (hadFocus && back) back.focus({ preventScroll: true });
  }

  // Province detail: prefectures, visited cities shaded and labelled.
  function openProvince(shape) {
    if (!layer || layer.id !== 'CN') return;
    state.province = shape.id;
    render();
    var v = (regionsByCountry.CN || {})[shape.id];
    $('[data-inset-title]').textContent = ((v && v.name) || shape.name) + (shape.zh ? ' · ' + shape.zh : '');
    insetMap.textContent = '';
    $('[data-inset-list]').textContent = '';
    $('[data-inset-note]').textContent = 'Loading…';
    inset.hidden = false;
    root.classList.add('has-inset');
    // Put the detail window on the side away from the province.
    root.classList.toggle('inset-left', (shape.c[0] - view.x) / view.w > 0.5);
    load('cn-' + shape.id).then(function (detail) {
      if (state.province !== shape.id) return;
      var cityIds = {};
      ((v && v.cities) || []).forEach(function (c) { cityIds[String(c.id)] = c.name; });
      var whole = v && !Object.keys(cityIds).length;
      detail.parts.forEach(function (part) {
        var lit = whole || cityIds[part.id];
        var p = svg('path', { d: part.d, class: 'atlas__part' + (lit ? ' is-visited' : '') });
        var t = svg('title', {});
        t.textContent = (cityIds[part.id] ? cityIds[part.id] + ' ' : '') + part.zh;
        p.appendChild(t);
        insetMap.appendChild(p);
      });
      // Dots first, then labels placed where they do not overlap one another; a
      // label that fits nowhere is left out (the list below names every city).
      var placed = [], labels = [];
      ((v && v.cities) || []).forEach(function (city) {
        var part = detail.parts.filter(function (x) { return x.id === String(city.id); })[0];
        var at = part ? part.c : (detail.projection && city.lat != null ? mercator(detail.projection, city.lng, city.lat) : null);
        if (at) {
          insetMap.appendChild(svg('circle', { cx: at[0], cy: at[1], r: 5, class: 'atlas__city' }));
          labels.push({ at: at, name: city.name });
        }
        var li = el('li', '', city.name);
        li.appendChild(el('span', '', part ? part.zh : (city.zh || '')));
        $('[data-inset-list]').appendChild(li);
      });
      labels.forEach(function (l) {
        var text = svg('text', { class: 'atlas__city-label' });
        text.textContent = l.name;
        insetMap.appendChild(text);
        var w = text.getComputedTextLength ? text.getComputedTextLength() : l.name.length * 9;
        var spots = [[8, 6], [-8 - w, 6], [-w / 2, -10], [-w / 2, 22]];
        for (var i = 0; i < spots.length; i++) {
          text.setAttribute('x', (l.at[0] + spots[i][0]).toFixed(1));
          text.setAttribute('y', (l.at[1] + spots[i][1]).toFixed(1));
          var bb = text.getBBox(), b = { x: bb.x - 1, y: bb.y, w: bb.width + 2, h: bb.height };
          var inside = b.x >= 0 && b.y >= 0 && b.x + b.w <= detail.width && b.y + b.h <= detail.height;
          var clear = placed.every(function (o) { return b.x >= o.x + o.w || o.x >= b.x + b.w || b.y >= o.y + o.h || o.y >= b.y + b.h; });
          if (inside && clear) { placed.push(b); return; }
        }
        insetMap.removeChild(text);
      });
      var note = $('[data-inset-note]');
      if (!v) note.textContent = 'Not visited yet.';
      else if (v.home) note.textContent = 'Home — where I live and study.';
      else if (whole && !v.city) note.textContent = 'Visited. Cities not noted separately.';
      else if (v.city) note.textContent = 'Visited.';
      else note.textContent = v.cities.length + ' ' + (v.cities.length === 1 ? 'city' : 'cities') + ' visited:';
    }).catch(function () { $('[data-inset-note]').textContent = 'Detail map unavailable.'; });
    $('[data-inset-close]').focus({ preventScroll: true });
  }
  $('[data-inset-close]').addEventListener('click', closeProvince);
  root.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (state.province) { closeProvince(); e.stopPropagation(); }
    else if (state.country) { closeCountry(); e.stopPropagation(); }
  });

  tabs.forEach(function (tab, i) {
    function select(t) {
      state.tab = t.getAttribute('data-view');
      if (state.tab === 'visitors' && state.country) { state.country = null; state.province = null; layer = null; closeInsetOnly(); home_view = null; animateTo(worldView()); }
      render();
    }
    tab.addEventListener('click', function () { select(tab); });
    tab.addEventListener('keydown', function (e) {
      var next = null;
      if (e.key === 'ArrowRight') next = (i + 1) % tabs.length;
      if (e.key === 'ArrowLeft') next = (i + tabs.length - 1) % tabs.length;
      if (e.key === 'Home') next = 0;
      if (e.key === 'End') next = tabs.length - 1;
      if (next === null) return;
      e.preventDefault();
      select(tabs[next]);
      tabs[next].focus();
    });
  });
  $('[data-demo]').addEventListener('click', function () { state.demo = !state.demo; render(); });

  /* Start ------------------------------------------------------------------ */
  if (new URLSearchParams(location.search).get('view') === 'visitors') state.tab = 'visitors';
  $('[data-loading]').hidden = false;
  load('world').then(function (w) {
    world = w;
    full = { x: 0, y: 0, w: w.width, h: w.height };
    measure();
    view = worldView();
    drawWorld();
    apply();
    $('[data-loading]').hidden = true;
    render();
    window.addEventListener('resize', function () {
      // Keep the same centre and width when the element changes shape.
      if (measure()) view = (home_view || state.country) ? clamp(view) : worldView();
      apply();
    });
  }).catch(function () { $('[data-loading]').textContent = 'The map could not be loaded.'; });

  if (endpoint) {
    var controller = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (controller) controller.abort(); }, 8000);
    fetch(endpoint, { credentials: 'omit', cache: 'no-cache', signal: controller ? controller.signal : undefined })
      .then(function (r) {
        // No file yet: counting is on, but the daily export has not run.
        if (r.status === 404) { visitors.state = 'pending'; return null; }
        if (!r.ok) throw new Error(r.status);
        return r.json();
      })
      .then(function (json) {
        if (!json) return;
        visitors.regions = cleanVisits(json.regions);
        visitors.unlocated = Number(json.unlocated_visits) >= 0 ? Math.floor(Number(json.unlocated_visits)) : 0;
        visitors.updated = typeof json.updated_at === 'string' ? json.updated_at.slice(0, 16).replace('T', ' ') + ' UTC' : null;
        visitors.since = typeof json.period_start === 'string' ? json.period_start.slice(0, 10) : null;
        visitors.state = 'ready';
        state.demo = false;
      })
      .catch(function () { visitors.state = 'error'; })
      .then(function () { clearTimeout(timer); if (world) render(); });
  }
}());
