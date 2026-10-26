/* Homepage: project cards open a README panel; publication "Cite" copies BibTeX.
 * Without JavaScript, cards link to /projects/<slug>/ and Cite does nothing harmful. */
(function () {
  'use strict';

  /* Cite → copy BibTeX ------------------------------------------------- */
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      var area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      try { document.execCommand('copy') ? resolve() : reject(); } catch (e) { reject(e); }
      document.body.removeChild(area);
    });
  }
  document.querySelectorAll('[data-copy]').forEach(function (button) {
    var label = button.textContent;
    button.addEventListener('click', function () {
      copyText(button.getAttribute('data-copy')).then(function () {
        button.textContent = 'BibTeX copied';
        button.classList.add('is-copied');
      }, function () {
        button.textContent = 'Copy failed';
      }).then(function () {
        window.setTimeout(function () { button.textContent = label; button.classList.remove('is-copied'); }, 2000);
      });
    });
  });

  /* Project cards → README panel --------------------------------------- */
  var drawer = document.getElementById('project-drawer');
  if (!drawer || typeof drawer.showModal !== 'function' || !window.fetch || !window.DOMParser) return;
  var body = drawer.querySelector('[data-drawer-body]');
  var cache = {};
  var opener = null;

  function show(card, html) {
    var link = card.querySelector('[data-project-open]');
    drawer.querySelector('[data-drawer-title]').textContent = link.textContent;
    drawer.querySelector('[data-drawer-repo]').textContent = card.querySelector('.card-project__repo').href.replace('https://github.com/', '');
    drawer.querySelector('[data-drawer-github]').href = card.querySelector('.card-project__repo').href;
    drawer.querySelector('[data-drawer-page]').href = link.href;
    body.innerHTML = html;
    body.scrollTop = 0;
    if (!drawer.open) drawer.showModal();
    body.focus({ preventScroll: true });
    if (history.replaceState) history.replaceState(null, '', '#project-' + card.getAttribute('data-project'));
  }
  function open(card) {
    var url = card.querySelector('[data-project-open]').href;
    opener = document.activeElement;
    if (cache[url]) { show(card, cache[url]); return; }
    card.setAttribute('aria-busy', 'true');
    fetch(url, { credentials: 'same-origin' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
      .then(function (text) {
        var doc = new DOMParser().parseFromString(text, 'text/html');
        var content = doc.querySelector('[data-project-content]');
        if (!content) throw new Error('no content');
        cache[url] = content.innerHTML;
        show(card, cache[url]);
      })
      .catch(function () { window.location.href = url; })
      .then(function () { card.removeAttribute('aria-busy'); });
  }

  document.querySelectorAll('.card-project').forEach(function (card) {
    card.addEventListener('click', function (event) {
      if (event.target.closest('.card-project__repo')) return;            // GitHub icon keeps its own link
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.button === 1) return; // new tab
      event.preventDefault();
      open(card);
    });
  });
  drawer.querySelector('[data-drawer-close]').addEventListener('click', function () { drawer.close(); });
  drawer.addEventListener('click', function (event) { if (event.target === drawer) drawer.close(); });
  drawer.addEventListener('close', function () {
    if (history.replaceState && /^#project-/.test(location.hash)) history.replaceState(null, '', '#projects');
    if (opener && opener.focus) opener.focus({ preventScroll: true });
  });

  // Deep link: /#project-<slug> opens that card, on load or when the hash changes.
  function openFromHash() {
    var match = /^#project-([\w-]+)$/.exec(location.hash);
    var card = match && document.querySelector('.card-project[data-project="' + match[1] + '"]');
    if (card && !drawer.open) open(card);
  }
  window.addEventListener('hashchange', openFromHash);
  openFromHash();
}());
