// Browser checks for the built site.
// Usage: build the site, serve _site (e.g. python3 -m http.server 4100 -d _site),
// then: node tests/verify_site.js http://127.0.0.1:4100   (needs the `playwright` package)
const { chromium } = require('playwright');
const assert = require('assert');
const base = (process.argv[2] || 'http://127.0.0.1:4100').replace(/\/$/, '');
const SECTIONS = ['about-me', 'research-interest', 'news', 'education', 'experience', 'projects', 'honors-and-awards'];
const REPOS = ['https://github.com/csxq0605/Nexgent', 'https://github.com/csxq0605/pku-aiprogramming', 'https://github.com/csxq0605/where-is-my-codex'];

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
    assert.deepStrictEqual(await p.locator('.home__main h2').evaluateAll(hs => hs.map(h => h.id)), SECTIONS);
    assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'horizontal overflow at ' + width);
    assert.deepStrictEqual(await p.locator('a.repo-link').evaluateAll(as => as.map(a => a.href)), REPOS);
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
      assert.strictEqual(await p.locator('.compact-menu__sections a').count(), 7);
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

  // Explore: world notebook.
  {
    const p = await page(browser, 390);
    await p.goto(base + '/explore/', { waitUntil: 'networkidle' });
    assert.strictEqual(await p.locator('.pin').count(), 1);
    assert.deepStrictEqual(await texts(p, '[data-metrics] dd'), ['1', '1', '0.4%']);
    await p.getByRole('tab', { name: 'Visitors' }).click();
    assert.deepStrictEqual(await texts(p, '[data-metrics] dd'), ['—', '—']);
    assert.ok(await p.locator('[data-demo-badge]').isHidden());
    await p.locator('[data-demo]').click();
    assert.deepStrictEqual(await texts(p, '[data-metrics] dd'), ['689', '8']);
    assert.ok(await p.locator('[data-demo-badge]').isVisible());
    await p.locator('.chip').first().click();
    assert.match(await p.locator('[data-detail]').textContent(), /China · 312 visitors/);
    await p.getByRole('tab', { name: 'Visitors' }).press('ArrowLeft');
    assert.strictEqual(await p.getByRole('tab', { name: 'My footprints' }).getAttribute('aria-selected'), 'true');
    assert.ok(await p.locator('[data-demo-badge]').isHidden());
    assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.deepStrictEqual(p.errors, []);
    console.log('PASS explore: footprints, visitors off-state, labelled example data, keyboard tabs');
    await p.context().close();
  }

  // Explore: visitor data contract, with the endpoint mocked.
  for (const [label, status, body, expected] of [
    ['real data', 200, { regions: [{ name: 'China', code: 'CN', lat: 35.9, lng: 104.2, visits: 12 }], unlocated_visits: 3, updated_at: '2026-10-25T08:00:00Z', period_start: '2026-10-01' }, ['15', '1']],
    ['malformed rows dropped', 200, { regions: [{ name: 'X', code: 'XX', lat: 500, lng: 0, visits: 2 }] }, ['0', '0']],
    ['server error', 503, {}, ['—', '—']],
  ]) {
    const p = await page(browser, 1024);
    await p.route(u => u.pathname === '/explore/', async r => {
      const res = await r.fetch();
      const html = (await res.text()).replace('data-world', 'data-world data-visitors-url="' + base + '/fixture.json"');
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
    assert.strictEqual(await p.locator('.compact-menu__sections a').count(), 7);
    assert.strictEqual(await p.locator('.project').count(), 3);
    console.log('PASS no JavaScript: content and native menu');
    await p.context().close();
  }

  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
