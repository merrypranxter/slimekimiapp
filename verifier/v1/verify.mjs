#!/usr/bin/env node
/**
 * Verifier v1 — see criteria.md. Serves ../../dist statically, drives it with
 * Playwright (global install), prints a PASS/FAIL table, exits non-zero on fail.
 * Every run appends a record to ../runs/<timestamp>.log
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, appendFileSync, mkdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire('/home/kimi/.npm-global/lib/node_modules/');
const { chromium } = require('playwright');

const ROOT = new URL('../../dist', import.meta.url).pathname;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };

const results = [];
const check = (id, ok, detail = '') => {
  results.push({ id, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}  ${detail}`);
};

// ---- static server ----
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p === '/') p = '/index.html';
    const file = join(ROOT, p);
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404); res.end('nf');
  }
});
await new Promise(r => server.listen(8099, '127.0.0.1', r));

const launchOpts = { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-sandbox'] };
const browser = await chromium.launch(launchOpts);

async function newPage(viewport) {
  const page = await browser.newPage({ viewport });
  const consoleErrors = [];
  const failedReqs = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', e => consoleErrors.push('pageerror: ' + e.message));
  page.on('requestfailed', r => failedReqs.push(r.url()));
  page.on('response', r => { if (r.status() >= 400) failedReqs.push(`${r.status()} ${r.url()}`); });
  return { page, consoleErrors, failedReqs };
}

try {
  // ---------- A. build ----------
  check('A1', existsSync(join(ROOT, 'index.html')), 'dist/index.html exists');

  // ---------- B/C/D/E/F desktop ----------
  const { page, consoleErrors, failedReqs } = await newPage({ width: 1280, height: 800 });
  await page.goto('http://127.0.0.1:8099/', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const webgl2 = await page.evaluate(() => {
    const c = document.createElement('canvas');
    return !!c.getContext('webgl2');
  });
  const hasProbe = await page.evaluate(() => typeof window.__probe !== 'undefined');
  check('B1', consoleErrors.length === 0, `console errors: ${JSON.stringify(consoleErrors.slice(0, 5))}`);
  check('B2', webgl2 && hasProbe, `webgl2=${webgl2} probe=${hasProbe}`);
  check('B3', failedReqs.length === 0, `failed reqs: ${JSON.stringify(failedReqs.slice(0, 5))}`);

  const shot = () => page.screenshot();
  const s1 = await shot();
  await page.waitForTimeout(1400);
  const s2 = await shot();
  // compare sizes differ? do pixel compare via canvas readback instead
  const anim = await page.evaluate(async () => {
    const c = document.querySelector('canvas');
    const a = document.createElement('canvas'); a.width = 64; a.height = 64;
    const ctx = a.getContext('2d'); ctx.drawImage(c, 0, 0, 64, 64);
    const d1 = ctx.getImageData(0, 0, 64, 64).data;
    await new Promise(r => setTimeout(r, 1200));
    ctx.drawImage(c, 0, 0, 64, 64);
    const d2 = ctx.getImageData(0, 0, 64, 64).data;
    let sum = 0; for (let i = 0; i < d1.length; i += 4) sum += Math.abs(d1[i] - d2[i]) + Math.abs(d1[i + 1] - d2[i + 1]) + Math.abs(d1[i + 2] - d2[i + 2]);
    return sum / (d1.length / 4) / 3;
  });
  check('C1', anim > 1.5, `mean pixel delta=${anim.toFixed(2)}`);

  const det = await page.evaluate(async () => {
    const p = window.__probe;
    // pause the rAF loop and step a FIXED number of substeps deterministically
    const btn = document.querySelector('[data-action="pause"],[data-action="play"]');
    if (btn?.getAttribute('data-action') === 'pause') btn.click();
    await new Promise(r => setTimeout(r, 100));
    p.reset(42); p.stepN(40);
    const c1 = p.checksum();
    p.reset(42); p.stepN(40);
    const c2 = p.checksum();
    p.reset(1337); p.stepN(40);
    const c3 = p.checksum();
    btn.click(); // resume play
    return { c1, c2, c3 };
  });
  check('D1', det.c1 === det.c2, `same seed: ${det.c1} vs ${det.c2}`);
  check('D2', det.c1 !== det.c3, `seed42=${det.c1} seed1337=${det.c3}`);

  const caus = await page.evaluate(async () => {
    const p = window.__probe;
    p.reset(7); await new Promise(r => setTimeout(r, 100));
    const before = p.checksum();
    p.setParam('trailDecay', Math.min(0.995, p.getParams().trailDecay + 0.03));
    await new Promise(r => setTimeout(r, 100));
    const after = p.checksum();
    return { before, after };
  });
  check('E1', caus.before !== caus.after, `${caus.before} -> ${caus.after}`);

  // F1 tabs
  const tabs = await page.evaluate(async () => {
    const btns = [...document.querySelectorAll('[data-tab]')];
    const out = [];
    for (const b of btns) {
      b.click(); await new Promise(r => setTimeout(r, 150));
      out.push({ tab: b.getAttribute('data-tab'), panels: document.querySelectorAll('[data-panel].tab-open').length });
    }
    return out;
  });
  check('F1', tabs.length === 5 && tabs.every(t => t.panels >= 1), JSON.stringify(tabs.map(t => t.tab)));

  const controls = await page.evaluate(async () => {
    const p = window.__probe;
    const seedBefore = p.getParams().seed;
    document.querySelector('[data-action="randomize"]')?.click();
    await new Promise(r => setTimeout(r, 150));
    const seedAfter = p.getParams().seed;
    p.reset(99);
    const paramsBefore = JSON.stringify(p.getParams());
    document.querySelector('[data-action="mutate"]')?.click();
    await new Promise(r => setTimeout(r, 150));
    const paramsAfter = JSON.stringify(p.getParams());
    const mutated = paramsBefore !== paramsAfter;
    const seedKept = p.getParams().seed === 99;
    const playBtn = document.querySelector('[data-action="pause"],[data-action="play"]');
    const actionBefore = playBtn?.getAttribute('data-action');
    playBtn?.click();
    await new Promise(r => setTimeout(r, 100));
    const pausedFrame = p.frame();
    await new Promise(r => setTimeout(r, 600));
    const pausedFrame2 = p.frame();
    const playBtn2 = document.querySelector('[data-action="pause"],[data-action="play"]');
    playBtn2?.click();  // same element, now re-labelled play
    // poll up to 6s: SwiftShader frames can take ~1s each
    let playedFrame = pausedFrame2;
    for (let i = 0; i < 24 && playedFrame <= pausedFrame2; i++) {
      await new Promise(r => setTimeout(r, 250));
      playedFrame = p.frame();
    }
    return { seedChanged: seedBefore !== seedAfter, mutated, seedKept, pauseHolds: pausedFrame === pausedFrame2, playResumes: playedFrame > pausedFrame2 };
  });
  check('F2', controls.seedChanged && controls.mutated && controls.seedKept && controls.pauseHolds && controls.playResumes, JSON.stringify(controls));

  const engine = await page.evaluate(async () => {
    const p = window.__probe;
    const errs = [];
    try {
      p.setEngine('ORBIA'); await new Promise(r => setTimeout(r, 600));
      const a = p.checksum();
      p.setEngine('MYXARIUM'); await new Promise(r => setTimeout(r, 600));
      const b = p.checksum();
      return { ok: true, a, b };
    } catch (e) { return { ok: false, err: String(e) }; }
  });
  check('F3', engine.ok && engine.a !== engine.b, JSON.stringify(engine));

  // console errors accumulated during all interaction
  check('B1b', consoleErrors.length === 0, `console errors after interaction: ${JSON.stringify(consoleErrors.slice(0, 5))}`);
  await page.close();

  // ---------- G. mobile ----------
  const m = await newPage({ width: 390, height: 844 });
  await m.page.goto('http://127.0.0.1:8099/', { waitUntil: 'load' });
  await m.page.waitForTimeout(2000);
  const mob = await m.page.evaluate(() => ({
    hOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    canvas: !!document.querySelector('canvas'),
    tabbar: !!document.querySelector('[data-tabbar]'),
  }));
  check('G1', !mob.hOverflow, `scrollWidth=${await m.page.evaluate(() => document.documentElement.scrollWidth)} clientWidth=${await m.page.evaluate(() => document.documentElement.clientWidth)}`);
  check('G2', mob.canvas && mob.tabbar, JSON.stringify(mob));
  check('B1c', m.consoleErrors.length === 0, JSON.stringify(m.consoleErrors.slice(0, 5)));
  await m.page.close();
} catch (e) {
  check('RUN', false, String(e && e.stack || e));
} finally {
  await browser.close();
  server.close();
}

const failed = results.filter(r => !r.ok);
const summary = `${new Date().toISOString()}  exit=${failed.length ? 1 : 0}  ${results.map(r => `${r.id}:${r.ok ? 'PASS' : 'FAIL'}`).join(' ')}`;
mkdirSync(new URL('../runs', import.meta.url).pathname, { recursive: true });
appendFileSync(join(new URL('../runs', import.meta.url).pathname, 'v1.log'), summary + '\n');
console.log('\n' + summary);
process.exit(failed.length ? 1 : 0);
