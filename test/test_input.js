// Real-input interaction test (needs playwright; run with NODE_PATH set
// to a node_modules containing it). Covers the placement flow, panning,
// and the ghost-pointer trap: a missed pointerup must never wedge the
// game out of tap mode (player report: "stuck in a pan tilt zoom input
// mode and couldn't get back to issuing commands").
'use strict';
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true
  });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const url = 'file:///' + path.resolve(__dirname, '..', 'index.html').replace(/\\/g, '/');
  await page.goto(url);
  await page.fill('#seedinput', 'wndwrd1');
  await page.click('#startbtn');
  await page.waitForTimeout(1600);

  const tapNearestMarker = async () => {
    const pt = await page.evaluate(() => {
      let best = null, bd = Infinity;
      for (const m of R.actionGroup.children) {
        const v = m.position.clone().project(R.camera);
        const x = (v.x + 1) / 2 * innerWidth, y = (-v.y + 1) / 2 * innerHeight;
        const d = Math.hypot(x - innerWidth / 2, y - innerHeight / 2);
        if (y > 120 && y < innerHeight - 260 && d < bd) { bd = d; best = [x, y]; }
      }
      return best;
    });
    if (!pt) throw new Error('no on-screen marker to tap');
    await page.touchscreen.tap(pt[0], pt[1]);
    await page.waitForTimeout(400);
  };

  // 1. markers glow; a tap opens the thumb menu
  const markerCount = await page.evaluate(() => R.actionGroup.children.length);
  if (markerCount < 3) throw new Error('no actionable markers on the map: ' + markerCount);
  await tapNearestMarker();
  const chipCount = await page.evaluate(() => document.querySelectorAll('#buildmenu .piecechip').length);
  if (chipCount < 1) throw new Error('no piece chips in the context menu');

  // 2. choose a piece, confirm a placement
  await page.click('#buildmenu .piecechip');
  await page.waitForTimeout(300);
  const previewCount = await page.evaluate(() => R.previewGroup.children.length);
  if (previewCount < 1) throw new Error('no preview after choosing a piece');
  const segsBefore = await page.evaluate(() => window.WD.state.segments.size);
  await page.click('#btn-confirm');
  await page.waitForTimeout(200);
  const segsAfter = await page.evaluate(() => window.WD.state.segments.size);
  if (segsAfter <= segsBefore) throw new Error('confirm placed nothing');

  // 3. drag to pan still works
  const camBefore = await page.evaluate(() => ({ ...R.camTarget }));
  await page.mouse.move(195, 400);
  await page.mouse.down();
  for (let i = 0; i < 8; i++) await page.mouse.move(195, 400 - i * 20);
  await page.mouse.up();
  await page.waitForTimeout(200);
  const camAfter = await page.evaluate(() => ({ ...R.camTarget }));
  if (Math.abs(camAfter.z - camBefore.z) < 0.3) throw new Error('drag did not pan the camera');

  // 4. THE TRAP: inject a pointerdown that never gets a pointerup (what a
  // stolen browser gesture leaves behind), then prove a real tap still
  // opens the menu instead of being eaten by a phantom multi-touch mode
  await page.evaluate(() => {
    const canvas = R.renderer.domElement;
    canvas.dispatchEvent(new PointerEvent('pointerdown', {
      pointerId: 991, pointerType: 'touch', isPrimary: false,
      clientX: 120, clientY: 300, bubbles: true
    }));
    canvas.dispatchEvent(new PointerEvent('pointerdown', {
      pointerId: 992, pointerType: 'touch', isPrimary: false,
      clientX: 260, clientY: 500, bubbles: true
    }));
  });
  await page.waitForTimeout(150);
  await tapNearestMarker();
  const menuAfterGhost = await page.evaluate(() =>
    !document.getElementById('buildmenu').classList.contains('hidden'));
  if (!menuAfterGhost) throw new Error('ghost pointers wedged the input: tap opened no menu');

  if (errors.length) throw new Error('page errors: ' + errors.join(' | '));
  console.log('input: placement, pan, and ghost-pointer recovery all ok; segments now', segsAfter);
  await browser.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
