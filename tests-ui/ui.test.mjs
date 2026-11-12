import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

// Synthetic public fixture only: never load the parent's live events.json.
export const fixture = {
  schemaVersion: 1, generatedAt: '2026-11-12T10:00:00Z', season: 2026, region: 'Mnichovice a okolí', events: [
    { id: 'fixture-b', title: 'Vánoční dílna', town: 'Mnichovice', venue: 'Klub', date: '2026-11-28', endDate: null, startTime: '16:00', endTime: null, category: 'tvoreni', price: '150 Kč', registration: 'Nutná rezervace', registrationUrl: 'https://example.cz/rezervace', description: 'Testovací dílna adventních věnců.', notes: ['Kapacita je omezená.'], audience: 'dospělí', status: 'confirmed', verifiedAt: '2026-11-12T10:00:00Z', sourceUrl: 'https://example.cz/dilna', location: { lat: 49.936, lon: 14.711, precision: 'town', label: 'Mnichovice', sourceUrl: 'https://example.cz/poloha' } },
    { id: 'fixture-a', title: 'Rozsvícení stromu', town: 'Říčany', venue: 'Náměstí', date: '2026-11-20', endDate: null, startTime: null, endTime: null, category: 'strom', price: null, registration: null, registrationUrl: null, description: 'Testovací slavnost.', notes: ['Přesný začátek zatím není uveden.'], audience: 'všichni', status: 'time-unconfirmed', verifiedAt: '2026-11-12T10:00:00Z', sourceUrl: 'https://example.cz/strom', location: { lat: 49.99, lon: 14.655, precision: 'venue', label: 'Náměstí', sourceUrl: 'https://example.cz/poloha' } },
    { id: 'fixture-c', title: '<img src=x onerror=alert(1)> Adventní setkání', town: 'Mnichovice', venue: 'Klub', date: '2026-12-05', endDate: null, startTime: '14:00', endTime: '17:00', category: 'setkani', price: 'Zdarma', registration: null, registrationUrl: 'javascript:alert(1)', description: '<script>window.injected=true</script>', notes: [], audience: 'senioři / omezené zaměření', status: 'confirmed', verifiedAt: '2026-11-12T10:00:00Z', sourceUrl: 'javascript:alert(1)', location: { lat: 49.936, lon: 14.711, precision: 'town', label: 'Mnichovice', sourceUrl: 'https://example.cz/poloha' } }
  ]
};
let browser, server, origin;
before(async () => {
  let executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || chromium.executablePath();
  if (!existsSync(executablePath) && !process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE) {
    const cache = join(homedir(), '.cache', 'ms-playwright');
    const installed = (await readdir(cache).catch(() => [])).filter(name => name.startsWith('chromium_headless_shell-')).sort((a, b) => b.localeCompare(a, 'en', { numeric: true }));
    for (const name of installed) {
      const candidate = join(cache, name, 'chrome-headless-shell-linux64', 'chrome-headless-shell');
      if (existsSync(candidate)) { executablePath = candidate; break; }
    }
  }
  browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
  server = createServer(async (req, res) => {
    let path = new URL(req.url, 'http://local').pathname.replace(/^\/advent-mnichovice\//, '/');
    if (path === '/') path = '/index.html';
    // An explicit asset allowlist prevents accidentally reading live data.
    if (!/^\/(index\.html|app\.js|helpers\.js|styles\.css|favicon\.svg|vendor\/leaflet\.(js|css))$/.test(path)) { res.writeHead(404).end(); return; }
    try {
      const data = await readFile(new URL(`../site${path}`, import.meta.url));
      res.setHeader('Content-Type', path.endsWith('.js') ? 'text/javascript' : path.endsWith('.css') ? 'text/css' : path.endsWith('.svg') ? 'image/svg+xml' : 'text/html; charset=utf-8');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://tile.openstreetmap.org; connect-src 'self'; object-src 'none'; base-uri 'self'");
      res.end(data);
    } catch { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><html lang="cs"><title>Missing frontend</title><body>Frontend not implemented</body></html>'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
});
async function app(run, { data = fixture, base = '/advent-mnichovice/', mobile = false, responseStatus = 200, delay = 0, libraryFail = false } = {}) {
  const context = await browser.newContext({ viewport: mobile ? { width: 393, height: 852 } : { width: 1440, height: 1000 }, timezoneId: 'America/Los_Angeles' });
  try {
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.install({ time: new Date('2026-11-12T12:00:00Z') });
    await page.route('**/events.json', async route => {
      if (delay) await new Promise(resolve => setTimeout(resolve, delay));
      await route.fulfill({ status: responseStatus, contentType: 'application/json', body: JSON.stringify(data) });
    });
    await page.route('https://tile.openstreetmap.org/**', route => route.abort());
    if (libraryFail) await page.route('**/vendor/leaflet.js', route => route.abort());
    await page.goto(origin + base);
    await run(page, errors);
  } finally { await context.close(); }
}

test('default mobile date and type labels have room for native select arrows', async () => {
  await app(async page => {
    await page.waitForSelector('.event-card');
    for (const width of [393, 320]) {
      await page.setViewportSize({ width, height: 852 });
      const clipped = await page.locator('select').evaluateAll(nodes => nodes.filter(node => {
        const style = getComputedStyle(node);
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        context.font = style.font;
        return context.measureText(node.selectedOptions[0].textContent).width + parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) + 12 > node.clientWidth;
      }).map(node => ({ id: node.id, width: node.clientWidth, font: getComputedStyle(node).font, text: node.selectedOptions[0].textContent })));
      assert.deepEqual(clipped, [], `clipped defaults at ${width}px`);
    }
  }, { mobile: true });
});

test('mobile fields avoid iPhone autozoom, masthead stays on one line and tablet reset remains touch-sized', async () => {
  await app(async page => {
    await page.waitForSelector('.event-card');
    const fontSizes = await page.locator('input, select').evaluateAll(nodes => nodes.map(n => parseFloat(getComputedStyle(n).fontSize)));
    assert(fontSizes.every(size => size >= 16), JSON.stringify(fontSizes));
    const wordmark = await page.locator('.wordmark span:first-child').boundingBox();
    assert(wordmark.height < 35, `wordmark height: ${wordmark.height}`);
    await page.keyboard.press('Tab');
    assert.equal(await page.locator('.skip-link').evaluate(node => node === document.activeElement), true);
    assert((await page.locator('.skip-link').boundingBox()).y >= 0);
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#results').evaluate(node => node === document.activeElement), true);
    await page.setViewportSize({ width: 900, height: 900 });
    assert((await page.locator('.reset-button').boundingBox()).height >= 44);
  }, { mobile: true });
});

test('loading, invalid data and retry states remain usable; missing map library never hides list', async () => {
  await app(async page => {
    assert.equal(await page.locator('#results').getAttribute('aria-busy'), 'true');
    assert.match(await page.locator('#results').innerText(), /Načítáme/);
    await page.waitForSelector('.event-card');
  }, { delay: 600 });
  await app(async page => {
    await page.waitForSelector('.load-error', { timeout: 3000 });
    assert.equal(await page.locator('#results').getAttribute('aria-busy'), 'false');
    await page.route('**/events.json', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(fixture) }));
    await page.getByRole('button', { name: 'Zkusit znovu' }).click();
    await page.waitForSelector('.event-card');
    assert.equal(await page.locator('.event-card').count(), 3);
  }, { data: { schemaVersion: 2, events: [] } });
  await app(async page => {
    await page.waitForSelector('.load-error');
    assert.match(await page.locator('#map-notice').innerText(), /přehled/);
  }, { responseStatus: 500 });
  await app(async (page, errors) => {
    await page.waitForSelector('.event-card');
    await page.waitForFunction(() => document.getElementById('map-notice').textContent.includes('Mapu se nepodařilo'));
    assert.equal(await page.locator('.event-card').count(), 3);
    await page.locator('#search').fill('stromu');
    assert.equal(await page.locator('.event-card').count(), 1);
    assert.deepEqual(errors, []);
  }, { libraryFail: true, base: '/' });
  await app(async page => {
    await page.waitForSelector('.empty-state');
    assert.equal(await page.locator('#results').getAttribute('aria-busy'), 'false');
  }, { data: { ...fixture, events: [] }, base: '/' });
});

test('individual calendar downloads contain the chosen event and navigation discloses town precision', async () => {
  await app(async page => {
    await page.waitForSelector('.event-card');
    const card = page.locator('[data-id="fixture-b"]');
    const downloadPromise = page.waitForEvent('download', { timeout: 3000 });
    await card.getByRole('button', { name: /Do kalendáře/ }).click({ timeout: 3000 });
    const download = await downloadPromise;
    assert.equal(download.suggestedFilename(), 'advent-fixture-b.ics');
    let text = '';
    for await (const part of await download.createReadStream()) text += part.toString('utf8');
    assert.match(text, /SUMMARY:Vánoční dílna/);
    assert.match(text.replace(/\r\n /g, ''), /konec orientační/);
    assert.equal((text.match(/BEGIN:VEVENT/g) || []).length, 1);
    const navigation = card.getByRole('link', { name: /Do obce/ });
    assert.match(await navigation.getAttribute('href'), /^https:\/\/www\.openstreetmap\.org\/directions\?/);
    assert.match(await navigation.getAttribute('href'), /49.936/);
  });
});

test('map groups shared places, selects a card and follows active filters even without tiles', async () => {
  await app(async (page, errors) => {
    await page.waitForSelector('.event-card');
    await page.waitForSelector('#map .leaflet-interactive', { timeout: 3000 });
    assert.equal(await page.locator('#map .leaflet-interactive').count(), 2);
    assert.match(await page.locator('#map-notice').innerText(), /podklad/);
    assert.match(await page.locator('.leaflet-control-attribution').innerText(), /OpenStreetMap/);
    const marker = page.locator('#map .leaflet-interactive[aria-label*="Mnichovice"]');
    await marker.focus();
    await marker.press('Enter');
    await page.waitForSelector('.popup-event');
    assert.equal(await page.locator('.popup-event').count(), 2);
    await page.locator('.popup-event').last().click();
    assert.equal(await page.locator('.event-card.selected').getAttribute('data-id'), 'fixture-c');
    assert.equal(await page.locator('.event-card.selected').evaluate(node => node === document.activeElement), true);
    await page.locator('#category').selectOption('strom');
    await page.waitForFunction(() => document.querySelectorAll('#map .leaflet-interactive').length === 1);
    assert.deepEqual(errors, []);
    await page.screenshot({ path: fileURLToPath(new URL('./desktop-fixture.png', import.meta.url)), fullPage: true });
  });
  await app(async page => {
    await page.waitForSelector('.event-card');
    await page.locator('#show-map').click();
    await page.waitForSelector('#map .leaflet-interactive');
    await page.locator('#map .leaflet-interactive[aria-label*="Mnichovice"]').click();
    await page.locator('.popup-event').first().click();
    assert.equal(await page.locator('#results').isVisible(), true);
    assert.equal(await page.locator('.event-card.selected').getAttribute('data-id'), 'fixture-b');
    await page.screenshot({ path: fileURLToPath(new URL('./mobile-fixture.png', import.meta.url)), fullPage: true });
  }, { mobile: true });
});

test('responsive list/map controls keep mobile targets usable without horizontal scrolling', async () => {
  await app(async page => {
    await page.waitForSelector('.event-card');
    assert.equal(await page.locator('#map-panel').isVisible(), false);
    await page.locator('#show-map').click();
    assert.equal(await page.locator('#map-panel').isVisible(), true);
    assert.equal(await page.locator('#results').isVisible(), false);
    assert.equal(await page.locator('#show-map').getAttribute('aria-pressed'), 'true');
    await page.locator('#show-list').click();
    assert.equal(await page.locator('#results').isVisible(), true);
    for (const width of [393, 320]) {
      await page.setViewportSize({ width, height: 700 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      const sizes = await page.locator('input, select, button, .event-actions a').evaluateAll(nodes => nodes.filter(n => n.getBoundingClientRect().width > 0).map(n => ({ name: n.textContent || n.id, height: n.getBoundingClientRect().height })));
      assert(sizes.every(size => size.height >= 44), JSON.stringify(sizes));
    }
    await page.addStyleTag({ content: 'html { font-size: 125%; }' });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.setViewportSize({ width: 1440, height: 1000 });
    assert.equal(await page.locator('#results').isVisible(), true);
    assert.equal(await page.locator('#map-panel').isVisible(), true);
    const listBox = await page.locator('#results').boundingBox();
    const mapBox = await page.locator('#map-panel').boundingBox();
    assert(mapBox.x > listBox.x + listBox.width);
  }, { mobile: true });
});

test('filters combine, announce empty results and reset to all season dates', async () => {
  await app(async page => {
    await page.waitForSelector('.event-card');
    await page.locator('#search').fill('vanocni');
    await page.waitForFunction(() => document.querySelectorAll('.event-card').length === 1);
    assert.equal(await page.locator('.event-card').getAttribute('data-id'), 'fixture-b');
    await page.locator('#town').selectOption('Říčany');
    await page.waitForSelector('.empty-state');
    assert.match(await page.locator('.empty-state').innerText(), /Žádná akce/);
    await page.getByRole('button', { name: 'Zrušit filtry', exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('.event-card').length === 3);
    await page.locator('#category').selectOption('strom');
    await page.waitForFunction(() => document.querySelectorAll('.event-card').length === 1);
    assert.equal(await page.locator('.event-card').getAttribute('data-id'), 'fixture-a');
    await page.getByRole('button', { name: 'Zrušit filtry', exact: true }).click();
    await page.clock.setFixedTime(new Date('2026-11-27T23:30:00Z'));
    await page.locator('#period').selectOption('today');
    await page.waitForFunction(() => document.querySelectorAll('.event-card').length === 1);
    assert.equal(await page.locator('.event-card').getAttribute('data-id'), 'fixture-b');
    await page.locator('#period').selectOption('weekend');
    assert.match(await page.locator('#result-count').innerText(), /28\. 11\./);
    await page.locator('#search').press('Enter');
    assert.equal(await page.locator('#period').inputValue(), 'weekend');
  });
});

test('season list loads chronologically with honest metadata and safe text', async () => {
  await app(async (page, errors) => {
    await page.waitForSelector('.event-card', { timeout: 3000 });
    assert.deepEqual(await page.locator('.event-card').evaluateAll(cards => cards.map(c => c.dataset.id)), ['fixture-a', 'fixture-b', 'fixture-c']);
    assert.equal(await page.locator('#period').inputValue(), 'all');
    assert.match(await page.locator('[data-id="fixture-a"]').innerText(), /Čas bude upřesněn/);
    assert.match(await page.locator('[data-id="fixture-b"]').innerText(), /150 Kč/);
    assert.match(await page.locator('[data-id="fixture-b"]').innerText(), /Dospělí/);
    assert.match(await page.locator('[data-id="fixture-c"]').innerText(), /Senioři/);
    assert.equal(await page.locator('.event-card img, .event-card script').count(), 0);
    assert.equal(await page.locator('a[href^="javascript:"]').count(), 0);
    assert.equal(await page.locator('.event-card').first().locator('a.source-link').getAttribute('href'), 'https://example.cz/strom');
    assert.match(await page.locator('.event-card').first().innerText(), /Ověřeno 12\. 11\. 2026/);
    assert.deepEqual(errors, []);
  });
});

test('review screenshots use synthetic display content and mobile map stays lazy until requested', async () => {
  const displayFixture = { ...fixture, events: fixture.events.map(event => event.id === 'fixture-c' ? { ...event, title: 'Adventní setkání pro seniory', description: 'Testovací předvánoční posezení v sousedském klubu.', sourceUrl: 'https://example.cz/setkani' } : event) };
  for (const mobile of [false, true]) {
    await app(async page => {
      await page.waitForSelector('.event-card');
      if (mobile) assert.equal(await page.locator('#map.leaflet-container').count(), 0);
      else await page.waitForSelector('#map .leaflet-interactive');
      await page.screenshot({ path: fileURLToPath(new URL(`./${mobile ? 'mobile' : 'desktop'}-fixture.png`, import.meta.url)), fullPage: false });
    }, { data: displayFixture, mobile });
  }
});
