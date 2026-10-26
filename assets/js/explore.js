/* Explore page: damped oscillator. (The world notebook lives in atlas.js.) */
(function () {
  'use strict';

  function $(root, selector) { return root.querySelector(selector); }

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
