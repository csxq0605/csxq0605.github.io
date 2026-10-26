// Browser checks for the built site.
// Usage: build the site, serve _site (e.g. python3 -m http.server 4100 -d _site),
// then: node tests/verify_site.js http://127.0.0.1:4100   (needs the `playwright` package)
const { chromium } = require('playwright');
const assert = require('assert');
const base = (process.argv[2] || 'http://127.0.0.1:4100').replace(/\/$/, '');
const SECTIONS = ['about-me', 'research-interest', 'news', 'education', 'experience', 'publications', 'projects', 'honors-and-awards'];
const REPOS = ['https://github.com/csxq0605/Nexgent', 'https://github.com/csxq0605/manyselves', 'https://github.com/csxq0605/pku-aiprogramming', 'https://github.com/csxq0605/where-is-my-codex'];

async function page(browser, width, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce', ...opts });
  // Keep the test offline: only the local site may load.
  await ctx.route('**/*', r => r.request().url().startsWith(base) ? r.continue() : r.abort());
  const p = await ctx.newPage();
  p.errors = [];
  p.on('pageerror', e => p.errors.push(e.message));
  return p;
}
const texts = async (p, sel) => p.locator(sel).allTextContents();

(async () => {
  const browser = await chromium.launch();

  for (const width of [1440, 1141, 1140, 1024, 761, 760, 390, 320]) {
    const p = await page(browser, width);
    await p.goto(base + '/', { waitUntil: 'networkidle' });
    assert.deepStrictEqual(await p.locator('.home__main > h2').evaluateAll(hs => hs.map(h => h.id)), SECTIONS);
    assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'horizontal overflow at ' + width);
    assert.deepStrictEqual(await p.locator('.card-project__repo').evaluateAll(as => as.map(a => a.href)), REPOS);
    assert.strictEqual(await p.locator('.pub').count(), 0);
    assert.strictEqual(await p.locator('.pub-empty').textContent(), 'No publications yet.');
    assert.strictEqual(await p.locator('script[data-goatcounter]').count(), 0);

    if (width > 1140) {
      await p.locator('.nav-menu summary').click();
      assert.deepStrictEqual(await p.locator('.nav-menu__panel a[target=_blank]').evaluateAll(as => as.map(a => a.href)), REPOS);
      await p.keyboard.press('Escape');
      assert.ok(!(await p.locator('.nav-menu').evaluate(d => d.open)));
      assert.ok(await p.locator('.nav-menu summary').evaluate(s => s === document.activeElement));
      await p.locator('.nav-menu summary').click();
      await p.locator('.nav-menu__overview').click();
    } else {
      await p.locator('.compact-menu summary').click();
      const box = await p.locator('.compact-menu__panel').boundingBox();
      assert.ok(box.x >= 0 && box.x + box.width <= width + 0.5, 'menu off screen at ' + width);
      assert.strictEqual(await p.locator('.compact-menu__sections a').count(), 8);
      assert.deepStrictEqual(await p.locator('.compact-menu__repos a').evaluateAll(as => as.map(a => a.href)), REPOS);
      await p.locator('.compact-menu__sections a[href="/#projects"]').click();
      assert.ok(!(await p.locator('.compact-menu').evaluate(d => d.open)));
    }
    await p.waitForFunction(() => location.hash === '#projects');
    await p.waitForFunction(() => document.querySelector('[data-section-link="projects"][aria-current]'));
    const header = await p.locator('.site-header').boundingBox();
    assert.ok((await p.locator('#projects').boundingBox()).y >= header.height, 'heading hidden under header');

    // Search: keyboard shortcut, filtering, Enter, Esc returns focus.
    await p.locator('[data-search-open]').click();
    await p.locator('#site-search-input').fill('nexgent');
    assert.strictEqual(await p.locator('[data-search-item]:visible').count(), 1);
    await p.keyboard.press('Escape');
    await p.waitForFunction(() => document.querySelector('[data-search-open]') === document.activeElement);
    await p.keyboard.press('Control+k');
    await p.locator('#site-search-input').fill('zzz-no-match');
    assert.ok(await p.locator('[data-search-empty]').isVisible());
    await p.locator('#site-search-input').fill('教育');
    await p.keyboard.press('Enter');
    await p.waitForFunction(() => location.hash === '#education');

    // Appearance persists.
    const before = await p.locator('html').getAttribute('data-theme');
    await p.locator('[data-theme-toggle]').click();
    await p.reload({ waitUntil: 'networkidle' });
    assert.notStrictEqual(await p.locator('html').getAttribute('data-theme'), before);
    assert.deepStrictEqual(p.errors, []);
    console.log(`PASS home ${width}px: order, links, menus, current section, search, theme`);
    await p.context().close();
  }

  // Project cards open a README panel; Cite copies BibTeX.
  for (const width of [1440, 390]) {
    const p = await page(browser, width, { permissions: ['clipboard-read', 'clipboard-write'] });
    await p.goto(base + '/#projects', { waitUntil: 'networkidle' });
    await p.locator('.card-project').nth(2).click();
    await p.waitForSelector('#project-drawer[open]');
    assert.strictEqual(await p.locator('[data-drawer-title]').textContent(), 'Tiny PyTorch');
    assert.ok(await p.locator('[data-drawer-body] .readme').count());
    assert.ok(await p.locator('[data-drawer-body] img').evaluateAll(imgs => imgs.length > 0 && imgs.every(i => i.getAttribute('src').startsWith('/assets/projects/'))));
    assert.match(p.url(), /#project-tiny-pytorch$/);
    const box = await p.locator('#project-drawer').boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= width + 0.5);
    await p.keyboard.press('Escape');
    await p.waitForFunction(() => !document.getElementById('project-drawer').open && location.hash === '#projects');
    await p.goto(base + '/#project-flow-rescue', { waitUntil: 'networkidle' });
    await p.waitForSelector('#project-drawer[open]');
    assert.strictEqual(await p.locator('[data-drawer-title]').textContent(), 'Where Is My Codex');
    await p.locator('[data-drawer-close]').click();
    assert.deepStrictEqual(p.errors, []);
    console.log(`PASS cards ${width}px: README panel, deep link, close`);
    await p.context().close();
  }

  // Widgets, with the clock frozen at 2026-10-26 16:00 Beijing time.
  for (const width of [1440, 390]) {
    const p = await page(browser, width, { timezoneId: 'Europe/London' });
    await p.clock.setFixedTime(new Date('2026-10-26T16:00:00+08:00'));
    await p.goto(base + '/', { waitUntil: 'networkidle' });
    const today = p.locator('[data-widget-today]');
    assert.strictEqual(await today.locator('[data-day]').textContent(), '26');
    assert.strictEqual(await today.locator('[data-lunar]').textContent(), '农历九月十七 · 丙午马年');
    assert.strictEqual(await today.locator('[data-term]').textContent(), '霜降 · 第 4 天，12 天后立冬');
    assert.strictEqual(await today.locator('[data-next]').textContent(), '元旦 · 67 天后');
    assert.strictEqual(await today.locator('[data-year-pct]').textContent(), '81.8%');
    assert.match(await p.locator('[data-greeting]').textContent(), /^Good morning · 早上好 — You are 8 hours behind Beijing\.$/);
    assert.ok((await p.locator('.heatmap__cell').count()) >= 134);
    assert.strictEqual(await p.locator('[data-widget-poem], [data-widget-sky]').count(), 0);
    // The world map lives on the homepage too.
    await p.locator('.widget--explore a[href="/#world"]').click();
    await p.waitForFunction(() => location.hash === '#world');
    await p.waitForSelector('#world [data-layer="world"] path');
    assert.deepStrictEqual(await p.locator('#world [data-layer="world"] path.is-visited').evaluateAll(ps => ps.map(x => x.dataset.id).sort()), ['BE', 'CH', 'CN', 'DE', 'ES', 'FR', 'GB', 'IT', 'JP', 'MY', 'NL', 'SG', 'US']);
    await p.getByRole('tab', { name: 'Visitors' }).click();
    await p.locator('#world [data-demo]').click();
    assert.deepStrictEqual(await p.locator('#world [data-metrics] dd').allTextContents(), ['689', '8']);
    const pond = await p.locator('.pond__canvas').boundingBox();
    assert.ok(pond.width > 200 && pond.height >= 80);
    await p.mouse.click(pond.x + pond.width / 2, pond.y + pond.height / 2);
    if (width === 390) {
      const w = await p.locator('.widgets').boundingBox();
      assert.ok(w.width > 330, 'widgets should span the phone width');
    }
    assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.deepStrictEqual(p.errors, []);
    console.log(`PASS widgets ${width}px: calendar, solar term, festival, greeting, heatmap, world map, pond`);
    await p.context().close();
  }

  // Education and experience timeline.
  {
    const p = await page(browser, 390);
    await p.goto(base + '/#experience', { waitUntil: 'networkidle' });
    const exp = p.locator('#experience + .timeline');
    assert.strictEqual(await exp.locator('.tl-item').count(), 3);
    assert.strictEqual(await exp.locator('.tl-item.is-current').count(), 2);
    const visibleDates = await exp.locator('.tl-date').evaluateAll(ps => ps.map(p => { const c = p.cloneNode(true); c.querySelectorAll('.visually-hidden').forEach(n => n.remove()); return c.textContent.replace(/\s+/g, ' ').trim(); }));
    assert.deepStrictEqual(visibleDates, ['Jun – Sep 2026', 'Mar 2026 – Present', 'May 2025 – Present']);
    const spokenDates = await exp.locator('.tl-date').evaluateAll(ps => ps.map(p => { const c = p.cloneNode(true); c.querySelectorAll('[aria-hidden]').forEach(n => n.remove()); return c.textContent.replace(/\s+/g, ' ').trim(); }));
    assert.deepStrictEqual(spokenDates, ['Jun to Sep 2026', 'Mar 2026 to Present', 'May 2025 to Present']);
    assert.strictEqual(await exp.locator('details.tl-more').count(), 0);
    // The ManySelves link in Experience opens its project card.
    await exp.locator('a[href="/#project-manyselves"]').click();
    await p.waitForSelector('#project-drawer[open]');
    assert.strictEqual(await p.locator('[data-drawer-title]').textContent(), 'ManySelves');
    assert.match(await p.locator('[data-drawer-body] .project-overview').textContent(), /recoverable local runtime for file-defined agent teams/);
    await p.locator('[data-drawer-close]').click();
    assert.match(await exp.locator('.tl-summary').nth(1).textContent(), /four layers/);
    assert.match(await exp.locator('.tl-people').first().textContent(), /^PIs: Prof\. Yunfeng Liang, Prof\. Songfang Huang$/);
    assert.strictEqual(await p.locator('#education + .timeline .tl-item').count(), 2);
    assert.strictEqual(await p.locator('#education + .timeline .is-current').count(), 0);
    const eduDates = await p.locator('#education + .timeline .tl-date').evaluateAll(ps => ps.map(p => { const c = p.cloneNode(true); c.querySelectorAll('.visually-hidden').forEach(n => n.remove()); return c.textContent.replace(/\s+/g, ' ').trim(); }));
    assert.deepStrictEqual(eduDates, ['Sep 2024 – 2027 (expected)', 'Sep 2023 – 2027 (expected)']);
    assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.deepStrictEqual(p.errors, []);
    console.log('PASS timeline: education and experience entries, dates, PIs, ManySelves link opens its card');
    await p.context().close();
  }

  // Explore: world notebook — world → China → province detail, and back.
  {
    const p = await page(browser, 390);
    await p.goto(base + '/explore/', { waitUntil: 'networkidle' });
    const crumbs = async () => (await p.locator('[data-crumbs]').innerText()).replace(/\s+/g, ' ').trim();
    const viewBox = async () => (await p.locator('[data-map]').getAttribute('viewBox')).split(' ').map(Number);
    await p.waitForSelector('[data-layer="world"] path');
    assert.deepStrictEqual(await texts(p, '[data-metrics] dd'), ['16', '22 / 34', '77', '6.4%']);
    assert.strictEqual(await crumbs(), 'World');
    const worldView = await viewBox();
    // Kashmir is drawn uncoloured; the South China Sea dashed line is present.
    assert.ok((await p.locator('[data-kashmir]').getAttribute('d')).length > 100);
    assert.ok((await p.locator('[data-dash]').getAttribute('d')).length > 100);
    // Keyboard: open China from its map shape.
    await p.locator('[data-layer="world"] path[data-id="CN"]').focus();
    await p.keyboard.press('Enter');
    await p.waitForSelector('[data-layer="country"] .atlas__region');
    assert.strictEqual(await p.locator('[data-layer="country"] .atlas__region').count(), 34);
    assert.strictEqual(await p.locator('[data-layer="country"] .atlas__region.is-visited').count(), 22);
    assert.strictEqual(await p.locator('[data-layer="country"] .atlas__region.is-home').count(), 1);
    assert.ok((await p.locator('[data-layer="country"] .atlas__dash').getAttribute('d')).length > 100);
    assert.strictEqual(await crumbs(), 'World › China');
    assert.ok((await viewBox())[2] < worldView[2] / 2, 'zoomed in to China');
    // Zoomed in, the detailed borders replace the world-view ones.
    await p.waitForFunction(() => document.querySelector('[data-layer="world"] path[data-id="JP"]').getAttribute('d').length > 3000);
    // Province detail with the Xinjiang cities.
    await p.locator('.chip', { hasText: 'Xinjiang' }).click();
    await p.waitForSelector('[data-inset-map] .atlas__part');
    assert.strictEqual(await crumbs(), 'World › China › Xinjiang');
    assert.deepStrictEqual(await p.locator('[data-inset-list] li').evaluateAll(ls => ls.map(l => l.firstChild.textContent)), ['Ürümqi', 'Turpan', 'Hami', 'Bayingolin', 'Aksu', 'Kashgar', 'Hotan', 'Ili', 'Tacheng', 'Altay', 'Shihezi']);
    assert.strictEqual(await p.locator('[data-inset-map] .atlas__part.is-visited').count(), 11);
    assert.strictEqual(await p.locator('[data-inset-map] .atlas__city').count(), 11);
    // City labels never overlap; any that cannot fit are left to the list.
    const boxes = await p.locator('[data-inset-map] .atlas__city-label').evaluateAll(ts => ts.map(t => t.getBBox()).map(b => [b.x, b.y, b.width, b.height]));
    assert.ok(boxes.length >= 8, 'most labels placed: ' + boxes.length);
    for (const [i, a] of boxes.entries()) for (const b of boxes.slice(i + 1)) assert.ok(a[0] + a[2] <= b[0] || b[0] + b[2] <= a[0] || a[1] + a[3] <= b[1] || b[1] + b[3] <= a[1], 'labels overlap');
    await p.keyboard.press('Escape');
    assert.ok(await p.locator('[data-inset]').isHidden());
    assert.strictEqual(await crumbs(), 'World › China');
    // A municipality is shaded as a whole.
    await p.locator('.chip', { hasText: 'Tianjin' }).click();
    await p.waitForSelector('[data-inset-map] .atlas__part');
    assert.strictEqual(await p.locator('[data-inset-note]').textContent(), 'Visited.');
    assert.strictEqual(await p.locator('[data-inset-map] .atlas__part:not(.is-visited)').count(), 0);
    // Taiwan's counties, including Matsu (Lienchiang), which is placed by coordinates.
    await p.locator('.chip', { hasText: 'Taiwan' }).click();
    await p.waitForFunction(() => document.querySelectorAll('[data-inset-list] li').length === 15);
    assert.strictEqual(await p.locator('[data-inset-map] .atlas__city').count(), 15);
    assert.strictEqual(await p.locator('[data-inset-map] .atlas__part.is-visited').count(), 14);
    const matsu = await p.locator('[data-inset-map] .atlas__city').last().evaluate(c => [+c.getAttribute('cx'), +c.getAttribute('cy')]);
    assert.ok(matsu[0] > 0 && matsu[0] < 400 && matsu[1] > 0 && matsu[1] < 300, 'Matsu inside the window');
    // Zoom buttons, then the breadcrumb back to the world.
    const before = await viewBox();
    await p.getByRole('button', { name: 'Zoom in' }).click();
    assert.ok((await viewBox())[2] < before[2]);
    await p.locator('[data-crumbs] button', { hasText: 'World' }).click();
    assert.ok(await p.locator('[data-inset]').isHidden());
    assert.strictEqual(await crumbs(), 'World');
    assert.deepStrictEqual(await viewBox(), worldView);
    // Hong Kong opens China with its detail; Japan is shaded by prefecture.
    await p.locator('.chip', { hasText: 'Hong Kong' }).click();
    await p.waitForSelector('[data-inset-map] .atlas__part');
    assert.strictEqual(await crumbs(), 'World › China › Hong Kong');
    await p.keyboard.press('Escape');
    await p.keyboard.press('Escape');
    assert.strictEqual(await crumbs(), 'World');
    await p.locator('.chip', { hasText: 'Japan' }).click();
    await p.waitForSelector('[data-layer="country"] .atlas__region');
    assert.strictEqual(await p.locator('[data-layer="country"] .atlas__region.is-visited').count(), 7);
    assert.strictEqual(await p.evaluate(() => document.activeElement.textContent), 'Japan', 'focus stays in the map after a chip redraw');
    assert.strictEqual(await p.locator('[data-layer="country"] .atlas__region.is-whole').count(), 0);
    await p.locator('.chip', { hasText: 'Osaka' }).click();
    assert.ok(await p.locator('[data-inset]').isHidden(), 'no city window outside China');
    // A country without divisions listed zooms to its mainland (France, not French Guiana).
    await p.locator('[data-crumbs] button', { hasText: 'World' }).click();
    await p.locator('.chip', { hasText: 'France' }).click();
    assert.strictEqual(await crumbs(), 'World › France');
    const fr = await viewBox();
    assert.ok(fr[0] > 400 && fr[2] < 120, 'framed on mainland France: ' + fr);
    assert.match(await p.locator('[data-note]').textContent(), /Visited France/);
    assert.strictEqual(await p.locator('[data-layer="world"] path[data-id="FR"]').count(), 1, 'one shape per country code');
    assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    // Visitors: switching tabs returns to the world view.
    await p.getByRole('tab', { name: 'Visitors' }).click();
    assert.strictEqual(await crumbs(), 'World');
    assert.strictEqual(await p.locator('[data-layer="country"] path').count(), 0);
    assert.deepStrictEqual(await texts(p, '[data-metrics] dd'), ['—', '—']);
    assert.ok(await p.locator('[data-demo-badge]').isHidden());
    await p.locator('[data-demo]').click();
    assert.deepStrictEqual(await texts(p, '[data-metrics] dd'), ['689', '8']);
    assert.ok(await p.locator('[data-demo-badge]').isVisible());
    assert.match(await p.locator('[data-layer="world"] path[data-id="CN"]').getAttribute('class'), /\bv4\b/);
    assert.strictEqual(await p.locator('[data-layer="world"] path.is-visited').count(), 0);
    assert.match(await p.locator('.chip').first().textContent(), /^China\s*312$/);
    await p.getByRole('tab', { name: 'Visitors' }).press('ArrowLeft');
    assert.strictEqual(await p.getByRole('tab', { name: 'My footprints' }).getAttribute('aria-selected'), 'true');
    assert.ok(await p.locator('[data-demo-badge]').isHidden());
    assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.deepStrictEqual(p.errors, []);
    console.log('PASS explore: world → China → Xinjiang cities, Esc and breadcrumb back, zoom, Tianjin and Taiwan windows, Japan prefectures, visitors tab');
    await p.context().close();
  }

  // Explore: visitor data contract, with the endpoint mocked.
  for (const [label, status, body, expected] of [
    ['real data', 200, { regions: [{ name: 'China', code: 'CN', lat: 35.9, lng: 104.2, visits: 12 }], unlocated_visits: 3, updated_at: '2026-10-25T08:00:00Z', period_start: '2026-10-01' }, ['15', '1']],
    ['malformed rows dropped', 200, { regions: [{ name: 'X', code: 'xx', visits: 2 }, { name: 'Y', code: 'YY', visits: -1 }, { name: 'Z', code: 'ZZ', visits: 1.5 }, { code: 'QQ', visits: 1 }] }, ['0', '0']],
    ['server error', 503, {}, ['—', '—']],
  ]) {
    const p = await page(browser, 1024);
    await p.route(u => u.pathname === '/explore/', async r => {
      const res = await r.fetch();
      const html = (await res.text()).replace('data-atlas', 'data-atlas data-visitors-url="' + base + '/fixture.json"');
      r.fulfill({ response: res, body: html });
    });
    await p.route(base + '/fixture.json', r => r.fulfill({ status, json: body }));
    await p.goto(base + '/explore/?view=visitors', { waitUntil: 'networkidle' });
    assert.deepStrictEqual(await texts(p, '[data-metrics] dd'), expected, label);
    assert.ok(await p.locator('[data-demo-badge]').isHidden());
    if (label === 'real data') {
      assert.ok(await p.locator('[data-demo]').isHidden());
      assert.match(await p.locator('[data-caption]').textContent(), /since 2026-10-01; 3 without a known location\. Updated 2026-10-25 08:00 UTC/);
    }
    if (label === 'server error') assert.match(await p.locator('[data-note]').textContent(), /unavailable/);
    console.log('PASS visitor endpoint:', label);
    await p.context().close();
  }

  // Explore: oscillator physics and controls.
  {
    const p = await page(browser, 1440);
    await p.goto(base + '/explore/#oscillator', { waitUntil: 'networkidle' });
    const set = (sel, v) => p.locator(sel).evaluate((e, v) => { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }, String(v));
    const x = async t => { await set('[data-time]', t); return Number((await p.locator('[data-x]').textContent()).split('=')[1]); };
    await set('[data-zeta]', 0);
    assert.ok(Math.abs(await x(1) + 1) < 2e-3, 'undamped half period');
    assert.ok(Math.abs(await x(2) - 1) < 2e-3, 'undamped full period');
    await set('[data-zeta]', 1);
    assert.ok(Math.abs(await x(1) - Math.exp(-Math.PI) * (1 + Math.PI)) < 2e-3, 'critical damping');
    assert.match(await p.locator('[data-regime]').textContent(), /Critically/);
    await set('[data-zeta]', 2);
    const xs = [];
    for (const t of [0, 0.5, 1, 2, 4, 8]) xs.push(await x(t));
    assert.ok(xs.every((v, i) => i === 0 || (v < xs[i - 1] && v >= 0)), 'overdamped decays monotonically');
    await set('[data-zeta]', 0.15);
    await p.locator('[data-reset]').click();
    await p.locator('[data-step]').click();
    assert.strictEqual(await p.locator('[data-time-out]').textContent(), '0.25 s');
    await p.locator('[data-play]').click();
    await p.waitForFunction(() => Number(document.querySelector('[data-time]').value) > 0.6);
    await p.locator('[data-play]').click();
    const frozen = await p.locator('[data-time-out]').textContent();
    await p.waitForTimeout(250);
    assert.strictEqual(await p.locator('[data-time-out]').textContent(), frozen);
    assert.deepStrictEqual(p.errors, []);
    console.log('PASS oscillator: known limits, monotone overdamping, step/play/pause');
    await p.context().close();
  }

  // CV language switch.
  {
    const p = await page(browser, 390);
    await p.goto(base + '/cv/', { waitUntil: 'domcontentloaded' });
    await p.getByRole('button', { name: '中文简历' }).click();
    assert.strictEqual(await p.locator('.cv-embed__frame').getAttribute('title'), 'Chinese CV PDF preview');
    assert.match(await p.locator('#cv-open-link').getAttribute('href'), /cv%E4%B8%AD%E6%96%87\.pdf/);
    assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    console.log('PASS CV: language switch');
    await p.context().close();
  }

  // Without JavaScript: all content and the native menu still work.
  {
    const p = await page(browser, 320, { javaScriptEnabled: false });
    await p.goto(base + '/', { waitUntil: 'networkidle' });
    await p.locator('.compact-menu summary').click();
    assert.strictEqual(await p.locator('.compact-menu__sections a').count(), 8);
    assert.strictEqual(await p.locator('.card-project').count(), 4);
    await p.locator('.card-project__name a').first().click();
    await p.waitForURL('**/projects/nexgent/');
    assert.ok(await p.locator('.readme').isVisible());
    console.log('PASS no JavaScript: content and native menu');
    await p.context().close();
  }

  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
