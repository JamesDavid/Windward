// Save/resume round-trip: play, background the tab, reload, resume,
// verify the world came back and keeps living.
'use strict';
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.goto('file:///' + require('path').resolve(__dirname, '..', 'index.html').replace(/\\\\/g, '/'));
  await page.waitForTimeout(1000);
  // play 130 sim-seconds on a fixed seed
  await page.evaluate(() => {
    document.getElementById('seedinput').value = 'resume1';
    document.getElementById('startbtn').click();
    const S = window.WD.state;
    if (S.tut && S.tut.active) S.tut.end();
    const dt = 0.05;
    for (let t = 0; t < 130; t += dt) {
      S.time += dt;
      S.wind.tick(dt);
      economyTick(S, dt); structuresTick(S, dt); updateTransit(S, dt);
      combatTick(S, dt); wavesTick(S, dt); aiTick(S, dt); fogTick(S, dt); collapseTick(S);
    }
  });
  const before = await page.evaluate(() => {
    const S = window.WD.state;
    return {
      time: Math.round(S.time), wave: S.wave.index,
      segsA: [...S.segments.values()].filter(s => s.owner === 'A').length,
      segsP: [...S.segments.values()].filter(s => s.owner === 'P').length,
      structs: S.structures.length,
      supply: Math.round(S.res.A.supply), favor: Math.round(S.res.A.favor),
      stockTotal: Math.round(S.map.islands.reduce((n, i) => n + i.stockpile, 0))
    };
  });
  // life happens: the tab goes hidden
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { get: () => true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const saved = await page.evaluate(() => !!localStorage.getItem('windward-resume'));
  console.log('saved on hide:', saved);

  // next visit
  await page.goto('file:///' + require('path').resolve(__dirname, '..', 'index.html').replace(/\\\\/g, '/'));
  await page.waitForTimeout(1200);
  const btnText = await page.evaluate(() => {
    const b = document.getElementById('resumebtn');
    return b.classList.contains('hidden') ? null : b.textContent;
  });
  console.log('resume offer:', btnText);
  await page.click('#resumebtn');
  await page.waitForTimeout(120);   // the LIVE frame loop is already playing
  const after = await page.evaluate(() => {
    const S = window.WD.state;
    return {
      time: Math.round(S.time), wave: S.wave.index,
      segsA: [...S.segments.values()].filter(s => s.owner === 'A').length,
      segsP: [...S.segments.values()].filter(s => s.owner === 'P').length,
      structs: S.structures.length,
      supply: Math.round(S.res.A.supply), favor: Math.round(S.res.A.favor),
      stockTotal: Math.round(S.map.islands.reduce((n, i) => n + i.stockpile, 0))
    };
  });
  console.log('before:', JSON.stringify(before));
  console.log('after: ', JSON.stringify(after));
  // let the resumed match run to prove it's alive
  await page.evaluate(() => {
    const S = window.WD.state;
    const dt = 0.05;
    for (let t = 0; t < 30; t += dt) {
      S.time += dt;
      S.wind.tick(dt);
      economyTick(S, dt); structuresTick(S, dt); updateTransit(S, dt);
      combatTick(S, dt); wavesTick(S, dt); aiTick(S, dt); fogTick(S, dt); collapseTick(S);
    }
  });
  const living = await page.evaluate(() => Math.round(window.WD.state.time));
  console.log('resumed match advanced to t=' + living);
  console.log('page errors:', errs.length ? errs.slice(0, 4) : 'none');
  // the resumed match runs live between click and read: exact on the
  // slow-changing fields, tolerant on the ones the game ticks per-second
  const ok = before.wave === after.wave && before.segsA === after.segsA &&
    before.structs === after.structs &&
    Math.abs(before.supply - after.supply) <= 5 && Math.abs(before.favor - after.favor) <= 5 &&
    Math.abs(before.segsP - after.segsP) <= 3 && Math.abs(before.time - after.time) <= 2 &&
    living > after.time && !errs.length;
  console.log(ok ? 'RESUME TEST PASSED' : 'RESUME TEST FAILED');
  await browser.close();
  if (!ok) process.exit(1);
})().catch(e => { console.error(e); process.exit(1); });
