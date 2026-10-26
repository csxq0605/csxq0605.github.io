/* Site-wide behaviour: appearance, menus, Beijing clock, current section, search.
 * Every feature is an enhancement; the pages read and navigate without it. */
(function () {
  'use strict';
  var root = document.documentElement;

  /* Appearance ---------------------------------------------------------- */
  var themeButton = document.querySelector('[data-theme-toggle]');
  var themeColor = document.querySelector('meta[name="theme-color"]');
  function syncTheme() {
    var dark = root.getAttribute('data-theme') === 'dark';
    if (themeButton) {
      themeButton.setAttribute('aria-pressed', String(dark));
      themeButton.setAttribute('aria-label', dark ? 'Switch to light appearance' : 'Switch to dark appearance');
    }
    if (themeColor) themeColor.setAttribute('content', dark ? '#191e21' : '#fbfaf7');
  }
  if (themeButton) {
    themeButton.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('site-theme', next); } catch (e) {}
      syncTheme();
    });
  }
  syncTheme();

  /* Menus: one open at a time; close on outside click, link choice or Esc. */
  var menus = Array.prototype.slice.call(document.querySelectorAll('[data-menu]'));
  menus.forEach(function (menu) {
    menu.addEventListener('toggle', function () {
      if (!menu.open) return;
      menus.forEach(function (other) { if (other !== menu) other.open = false; });
    });
    menu.addEventListener('click', function (event) {
      if (event.target.closest('a')) menu.open = false;
    });
  });
  document.addEventListener('click', function (event) {
    menus.forEach(function (menu) { if (menu.open && !menu.contains(event.target)) menu.open = false; });
  });
  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;
    menus.forEach(function (menu) {
      if (!menu.open) return;
      menu.open = false;
      menu.querySelector('summary').focus();
    });
  });

  /* Beijing clock ------------------------------------------------------- */
  var clock = document.querySelector('[data-clock]');
  if (clock && window.Intl) {
    var format = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    var tick = function () {
      var now = new Date();
      clock.textContent = format.format(now) + ' UTC+8';
      clock.setAttribute('datetime', now.toISOString());
    };
    tick();
    window.setInterval(tick, 20000);
  }

  /* Current homepage section ------------------------------------------- */
  var headings = Array.prototype.slice.call(document.querySelectorAll('.home__main > h2[id]'));
  var sectionLinks = Array.prototype.slice.call(document.querySelectorAll('[data-section-link]'));
  if (headings.length && sectionLinks.length) {
    var current = null, queued = false;
    var update = function () {
      queued = false;
      var offset = document.querySelector('.site-header').offsetHeight + 80;
      var id = headings[0].id;
      headings.forEach(function (h) { if (h.getBoundingClientRect().top <= offset) id = h.id; });
      // The last section may be too short to reach the top: use it at the page end.
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) id = headings[headings.length - 1].id;
      if (id === current) return;
      current = id;
      sectionLinks.forEach(function (link) {
        if (link.getAttribute('data-section-link') === id) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    };
    window.addEventListener('scroll', function () {
      if (!queued) { queued = true; window.requestAnimationFrame(update); }
    }, { passive: true });
    window.addEventListener('resize', update);
    update();
  }

  /* Back to top keeps keyboard focus with the scroll position. */
  var back = document.querySelector('[data-back-to-top]');
  if (back) {
    back.addEventListener('click', function (event) {
      event.preventDefault();
      window.scrollTo(0, 0);
      var brand = document.querySelector('.site-brand');
      if (brand) brand.focus({ preventScroll: true });
    });
  }

  /* Search -------------------------------------------------------------- */
  var dialog = document.getElementById('site-search');
  var openButton = document.querySelector('[data-search-open]');
  if (!dialog || typeof dialog.showModal !== 'function' || !openButton) return;
  var input = document.getElementById('site-search-input');
  var items = Array.prototype.slice.call(dialog.querySelectorAll('[data-search-item]'));
  var labels = Array.prototype.slice.call(dialog.querySelectorAll('.search__results .eyebrow'));
  var empty = dialog.querySelector('[data-search-empty]');
  var opener = null;
  openButton.hidden = false;

  function normalize(text) { return text.toLowerCase().replace(/\s+/g, ' ').trim(); }
  function visible() { return items.filter(function (item) { return !item.hidden; }); }
  function mark(item) {
    items.forEach(function (other) { other.classList.toggle('is-active', other === item); });
  }
  function filter() {
    var terms = normalize(input.value).split(' ').filter(Boolean);
    items.forEach(function (item) {
      var hay = normalize(item.textContent + ' ' + (item.getAttribute('data-keywords') || ''));
      item.hidden = !terms.every(function (term) { return hay.indexOf(term) !== -1; });
    });
    labels.forEach(function (label) {
      var node = label.nextElementSibling, any = false;
      while (node && !node.classList.contains('eyebrow')) {
        if (node.hasAttribute('data-search-item') && !node.hidden) any = true;
        node = node.nextElementSibling;
      }
      label.hidden = !any;
    });
    var shown = visible();
    empty.hidden = shown.length > 0;
    mark(terms.length ? shown[0] : null);
  }
  function open() {
    if (dialog.open) return;
    opener = document.activeElement;
    menus.forEach(function (menu) { menu.open = false; });
    input.value = '';
    filter();
    dialog.showModal();
    input.focus();
  }
  dialog.addEventListener('close', function () {
    if (opener && opener.focus) opener.focus();
  });
  dialog.addEventListener('click', function (event) {
    if (event.target === dialog) dialog.close();          // backdrop
    else if (event.target.closest('[data-search-item]')) dialog.close();
  });
  openButton.addEventListener('click', open);
  input.addEventListener('input', filter);
  dialog.addEventListener('keydown', function (event) {
    var shown = visible();
    var index = shown.indexOf(document.activeElement);
    if (event.key === 'Escape') {
      // A search input would otherwise spend the first Esc clearing its text.
      event.preventDefault();
      dialog.close();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!shown.length) return;
      var next = event.key === 'ArrowDown' ? index + 1 : index - 1;
      if (next < 0) { input.focus(); mark(null); return; }
      var target = shown[Math.min(next, shown.length - 1)];
      mark(target);
      target.focus();
    } else if (event.key === 'Enter' && document.activeElement === input) {
      event.preventDefault();
      var first = dialog.querySelector('[data-search-item].is-active') || shown[0];
      if (first) { dialog.close(); first.click(); }
    }
  });
  document.addEventListener('keydown', function (event) {
    var typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) || document.activeElement.isContentEditable;
    if ((event.key === 'k' || event.key === 'K') && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      if (dialog.open) dialog.close(); else open();
    } else if (event.key === '/' && !typing && !dialog.open) {
      event.preventDefault();
      open();
    }
  });
}());
