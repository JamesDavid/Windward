// ================================================================
// RENDERER, PART 2 — structures, ships, craft, the priest, effects,
// and fog-of-war presentation. One chassis per side (§14A.2):
// every Aeolus structure is a tethered balloon, every Poseidon
// structure a moored barge; four payloads each.
// ================================================================

R.fx = [];
R.islandBars = new Map();

// Every structure type gets its own silhouette and envelope colour, so
// nothing on the board is "another white balloon":
//   Chain Vane   — rust-red drum envelope, spinning vane arms
//   Bolt Battery — long navy zeppelin, gold barrel
//   Aegis Screen — no balloon at all: a bronze pylon bearing the arc
//   Siphon Mast  — his: barge with a tall teal pipe
const CHASSIS_STYLE = {
  vane: { color: 0xb4573f, sx: 1.0, sy: 1.05, r: 0.24 },
  bolt: { color: 0x39506e, sx: 1.9, sy: 0.8, r: 0.24 },
  default: { color: 0xd2bd91, sx: 1.25, sy: 1.0, r: 0.26 }
};

function makeChassis(side, onLand, type) {
  const grp = new THREE.Group();
  if (side === 'A') {
    if (type === 'shield') {
      // a grounded bronze pylon — the shield does not fly
      const pylon = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.12, 0.9, 7),
        new THREE.MeshLambertMaterial({ color: Palette.bronze }));
      pylon.position.y = 0.45;
      const crown = new THREE.Mesh(
        new THREE.SphereGeometry(0.09, 7, 6),
        new THREE.MeshLambertMaterial({ color: Palette.gold }));
      crown.position.y = 0.95;
      grp.add(pylon, crown);
      return grp;
    }
    const style = CHASSIS_STYLE[type] || CHASSIS_STYLE.default;
    const env = new THREE.Mesh(
      new THREE.SphereGeometry(style.r, 10, 8),
      new THREE.MeshLambertMaterial({ color: style.color }));
    env.scale.set(style.sx, style.sy, 1);
    env.position.y = 0.95;
    const gond = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.09, 0.12),
      new THREE.MeshLambertMaterial({ color: Palette.bronze }));
    gond.position.y = 0.62;
    const tether = new THREE.Mesh(
      new THREE.BoxGeometry(0.015, onLand ? 0.5 : 0.6, 0.015),
      new THREE.MeshBasicMaterial({ color: 0x9c8b6a }));
    tether.position.y = 0.3;
    grp.add(env, gond, tether);
    grp.userData.envelope = env;
  } else {
    const hull = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.1, 0.34),
      new THREE.MeshLambertMaterial({ color: 0x274046 }));
    hull.position.y = 0.07;
    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.05, 0.26),
      new THREE.MeshLambertMaterial({ color: 0x37585e }));
    deck.position.y = 0.14;
    grp.add(hull, deck);
  }
  return grp;
}

function makePayload(side, type, stats) {
  const grp = new THREE.Group();
  const trim = new THREE.MeshLambertMaterial({ color: side === 'A' ? Palette.gold : Palette.poseidonGlow });
  const dark = new THREE.MeshLambertMaterial({ color: Palette.bronze });
  const y = side === 'A' ? 0.62 : 0.2;
  switch (type) {
    case 'vane': {
      for (let i = 0; i < 4; i++) {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.03, 0.05), i % 2 ? trim : dark);
        arm.position.y = y + 0.1;
        arm.rotation.y = (i / 4) * Math.PI;
        grp.add(arm);
      }
      break;
    }
    case 'bolt': case 'mast': {
      const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 0.08), dark);
      barrel.position.set(0.14, y + 0.06, 0);
      grp.add(barrel);
      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.1), trim);
      tip.position.set(0.3, y + 0.06, 0);
      grp.add(tip);
      grp.userData.rotates = true;
      break;
    }
    case 'shield': {
      // a bound whirlwind (player-directed 360° ward): translucent vortex
      // bands around the pylon, with wisps that visibly orbit
      const glow = side === 'A' ? Palette.aeolusGlow : Palette.poseidonGlow;
      const whirl = new THREE.Group();
      for (let i = 0; i < 3; i++) {
        const band = new THREE.Mesh(
          new THREE.TorusGeometry(0.20 + i * 0.09, 0.032, 6, 18),
          new THREE.MeshLambertMaterial({ color: glow, transparent: true, opacity: 0.42 - i * 0.08 }));
        band.rotation.x = Math.PI / 2;
        band.position.y = y + 0.06 + i * 0.15;
        whirl.add(band);
        for (let w = 0; w < 3; w++) {
          const wisp = new THREE.Mesh(
            new THREE.SphereGeometry(0.045, 5, 4),
            new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 }));
          const a = (w / 3) * Math.PI * 2 + i * 0.8;
          wisp.position.set(Math.cos(a) * (0.20 + i * 0.09), y + 0.06 + i * 0.15, Math.sin(a) * (0.20 + i * 0.09));
          wisp.scale.set(2.2, 0.5, 0.5);
          whirl.add(wisp);
        }
      }
      grp.add(whirl);
      grp.userData.whirl = whirl;
      break;
    }
    case 'temple': {
      const stone = new THREE.MeshLambertMaterial({ color: side === 'A' ? Palette.ivory : Palette.poseidonStone });
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 0.1, 8), stone);
      base.position.y = 0.1;
      for (let i = 0; i < 5; i++) {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.3, 5), stone);
        const a = (i / 5) * Math.PI * 2;
        col.position.set(Math.cos(a) * 0.22, 0.3, Math.sin(a) * 0.22);
        grp.add(col);
      }
      const roof = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.2, 8), trim);
      roof.position.y = 0.52;
      grp.add(base, roof);
      break;
    }
    case 'yard': {
      // a working airfield: open hangar shed + mooring mast with pennant.
      // Fleet-status dots ride above the roof (synced live elsewhere).
      const floor = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.36), dark);
      floor.position.y = 0.05;
      for (const dz of [-0.16, 0.16]) {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.04), dark);
        wall.position.set(0, 0.15, dz);
        grp.add(wall);
      }
      const roof = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.2, 0.5, 10, 1, false, Math.PI, Math.PI), trim);
      roof.rotation.z = Math.PI / 2;
      roof.position.y = 0.23;
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.62, 6), dark);
      mast.position.set(0.36, 0.31, 0);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 5), trim);
      cap.position.set(0.36, 0.63, 0);
      const pennant = new THREE.Mesh(
        new THREE.PlaneGeometry(0.16, 0.07),
        new THREE.MeshBasicMaterial({ color: side === 'A' ? Palette.gold : Palette.poseidonGlow, side: THREE.DoubleSide }));
      pennant.position.set(0.46, 0.57, 0);
      grp.add(floor, roof, mast, cap, pennant);
      grp.userData.pennant = pennant;
      grp.scale.setScalar(1.35);   // a working airfield reads at map zoom
      break;
    }
  }
  return grp;
}

function structVisibleToPlayer(state, st) {
  if (st.owner === 'A') return 'full';
  const k = cellKey(st.cell[0], st.cell[1]);
  if (state.vision.A.has(k) || groundLifted(state, st.cell[0], st.cell[1])) return 'full';
  if (state.memory.A.has('st:' + st.id)) return 'dim';
  return 'hidden';
}

function syncStructures(state) {
  const seen = new Set();
  for (const st of state.structures) {
    if (st.hp <= 0) continue;
    seen.add(st.id);
    let rec = R.structMeshes.get(st.id);
    if (!rec) {
      const onLand = st.site === 'plot' || state.map.land.has(cellKey(st.cell[0], st.cell[1]));
      const grp = new THREE.Group();
      const chassis = st.type === 'temple' || st.type === 'yard' ? new THREE.Group() : makeChassis(st.owner, onLand, st.type);
      const payload = makePayload(st.owner, st.type, st);
      grp.add(chassis, payload);
      const baseY = onLand ? CONFIG.Render.ISLAND_HEIGHT : (st.owner === 'A' ? CONFIG.Render.AIR_ALTITUDE - 0.6 : 0);
      grp.position.set(worldX(st.cell[0]), baseY, worldZ(st.cell[1]));
      grp.userData.baseY = baseY;
      // scaffold ring at ground level while raising
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.42, 0.52, 20),
        new THREE.MeshBasicMaterial({ color: Palette.socket, transparent: true, opacity: 0.95, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.12;
      grp.add(ring);
      R.scene.add(grp);
      rec = { grp, payload, ring, chassis };
      R.structMeshes.set(st.id, rec);
    }
    const vis = structVisibleToPlayer(state, st);
    rec.grp.visible = vis !== 'hidden';
    const dim = vis === 'dim';
    rec.grp.traverse(o => {
      if (o.material) {
        o.material.transparent = true;
        o.material.opacity = dim ? 0.3 : (o.userData && o.userData.baseOpacity) || (st.buildProgress < 1 ? 0.6 : 1);
      }
    });
    if (rec.payload.userData.rotates) rec.payload.rotation.y = -st.facing;
    // vane arms spin — lazily when idle, furiously while firing
    if (st.type === 'vane') {
      const firing = state.time - (st.lastFired || -99) < 0.6;
      rec.payload.rotation.y = state.time * (firing ? 7 : 1.1);
    }
    // the Aegis whirlwind never stops turning
    if (st.type === 'shield' && rec.payload.userData.whirl) {
      rec.payload.userData.whirl.rotation.y = state.time * 2.4;
    }
    // mooring yard extras: fluttering pennant + fleet-status dots above
    // the roof — one dot per mooring the fleet cap allows, lit while a
    // hauler holds it (player's own yards only; his fleet stays foggy)
    if (st.type === 'yard' && rec.payload.userData.pennant) {
      rec.payload.userData.pennant.rotation.y = 0.4 * Math.sin(state.time * 3 + st.id);
    }
    if (st.type === 'yard' && st.owner === 'A' && st.buildProgress >= 1) {
      const cap = fleetCap(state, 'A');
      const alive = state.haulers.filter(h => h.owner === 'A' && h.state !== 'dead').length;
      const key = cap * 100 + alive;
      if (rec.dotKey !== key) {
        rec.dotKey = key;
        if (rec.dots) rec.grp.remove(rec.dots);
        const dots = new THREE.Group();
        for (let i = 0; i < cap; i++) {
          const lit = i < alive;
          const d = new THREE.Mesh(
            new THREE.SphereGeometry(0.035, 6, 5),
            new THREE.MeshBasicMaterial({ color: lit ? Palette.gold : 0x3a4148, transparent: true, opacity: lit ? 1 : 0.55 }));
          d.position.set((i - (cap - 1) / 2) * 0.1, 0.52, 0);
          dots.add(d);
        }
        rec.grp.add(dots);
        rec.dots = dots;
      }
    }
    // burning: a wounded structure smokes and burns until it dies
    const hurt = st.buildProgress >= 1 && st.hp < st.maxHp * 0.45;
    if (hurt && !rec.flames) {
      const flames = new THREE.Group();
      for (let i = 0; i < 2; i++) {
        const f = new THREE.Mesh(
          new THREE.ConeGeometry(0.07, 0.2, 5),
          new THREE.MeshBasicMaterial({ color: i ? 0xff7a2f : 0xffc16e, transparent: true, opacity: 0.9 }));
        f.position.set((i - 0.5) * 0.16, 0.45 + i * 0.12, 0);
        flames.add(f);
      }
      const smoke = new THREE.Mesh(
        new THREE.SphereGeometry(0.09, 6, 5),
        new THREE.MeshBasicMaterial({ color: 0x333333, transparent: true, opacity: 0.5 }));
      smoke.position.y = 0.85;
      flames.add(smoke);
      flames.userData.smoke = smoke;
      rec.grp.add(flames);
      rec.flames = flames;
    }
    if (rec.flames) {
      rec.flames.visible = hurt;
      if (hurt) {
        rec.flames.children.forEach((f, i) => {
          f.scale.setScalar(0.8 + 0.35 * Math.sin(state.time * (9 + i * 3) + st.id));
        });
        const smoke = rec.flames.userData.smoke;
        smoke.position.y = 0.85 + ((state.time * 0.4 + st.id) % 1) * 0.5;
        smoke.material.opacity = 0.5 * (1 - ((state.time * 0.4 + st.id) % 1));
      }
    }
    // building: ring shows progress; bob balloons in the wind
    rec.ring.visible = st.buildProgress < 1;
    if (st.buildProgress < 1) rec.ring.scale.setScalar(0.4 + st.buildProgress * 0.8);
    if (rec.chassis.userData && rec.chassis.userData.envelope) {
      const w = state.wind.at(st.cell[0], st.cell[1]);
      rec.chassis.rotation.z = -w.x * 0.12;
      rec.chassis.rotation.x = w.z * 0.12;
      rec.chassis.position.y = 0.03 * Math.sin(state.time * 1.7 + st.id);
    }
    // hit shudder — absolute, never accumulates
    const flash = state.time - st.lastHitAt < 0.18 ? Math.sin(state.time * 60) * 0.03 : 0;
    rec.grp.position.y = rec.grp.userData.baseY + flash;
  }
  for (const [id, rec] of R.structMeshes) {
    if (!seen.has(id)) {
      R.scene.remove(rec.grp);
      R.structMeshes.delete(id);
    }
  }
}

// ---- movers: haulers, priests, wave craft ----
function makeMoverMesh(m, hydrogen) {
  const grp = new THREE.Group();
  if (m.owner === 'A') {
    const isPriest = m.kind === 'priest';
    if (!isPriest && !hydrogen) {
      // hot-air hauler: a FREE BALLOON — round envelope, wicker basket
      // slung on cables, and a burner that flares as the air is heated
      const env = new THREE.Mesh(
        new THREE.SphereGeometry(0.19, 12, 10),
        new THREE.MeshLambertMaterial({ color: Palette.ivory }));
      env.scale.set(1, 1.18, 1);
      env.position.y = 0.4;
      const throat = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.05, 0.08, 8),
        new THREE.MeshLambertMaterial({ color: Palette.gold }));
      throat.position.y = 0.2;
      const basket = new THREE.Mesh(
        new THREE.BoxGeometry(0.11, 0.08, 0.11),
        new THREE.MeshLambertMaterial({ color: Palette.bronze }));
      basket.position.y = 0.04;
      for (const [cx, cz] of [[-0.045, -0.045], [0.045, -0.045], [-0.045, 0.045], [0.045, 0.045]]) {
        const cable = new THREE.Mesh(
          new THREE.CylinderGeometry(0.006, 0.006, 0.13, 3),
          new THREE.MeshBasicMaterial({ color: 0x6b5a3a }));
        cable.position.set(cx, 0.13, cz);
        grp.add(cable);
      }
      const burner = new THREE.Mesh(
        new THREE.ConeGeometry(0.045, 0.12, 6),
        new THREE.MeshBasicMaterial({ color: 0xffa63f, transparent: true, opacity: 0.15 }));
      burner.position.y = 0.14;
      const crate = new THREE.Mesh(
        new THREE.BoxGeometry(0.13, 0.1, 0.13),
        new THREE.MeshLambertMaterial({ color: Palette.gold }));
      crate.position.y = -0.09;
      crate.visible = false;
      grp.add(env, throat, basket, burner, crate);
      grp.userData.crate = crate;
      grp.userData.burner = burner;
      grp.userData.env = env;
      return grp;
    }
    const env = new THREE.Mesh(
      new THREE.SphereGeometry(isPriest ? 0.24 : 0.18, 10, 8),
      new THREE.MeshLambertMaterial({ color: isPriest ? Palette.gold : Palette.ivory }));
    env.scale.set(1.5, 0.9, 0.9);
    env.position.y = 0.22;
    const gond = new THREE.Mesh(
      new THREE.BoxGeometry(isPriest ? 0.3 : 0.24, 0.07, 0.1),
      new THREE.MeshLambertMaterial({ color: Palette.bronze }));
    gond.position.y = 0.02;
    grp.add(env, gond);
    if (!isPriest) {
      // hydrogen zeppelin: equator band + slung ore crate while carrying
      const band = new THREE.Mesh(
        new THREE.TorusGeometry(0.185, 0.02, 6, 14),
        new THREE.MeshLambertMaterial({ color: Palette.bronze }));
      band.rotation.x = Math.PI / 2;
      band.position.y = 0.22;
      band.scale.set(1.5, 0.9, 1);
      const crate = new THREE.Mesh(
        new THREE.BoxGeometry(0.13, 0.1, 0.13),
        new THREE.MeshLambertMaterial({ color: Palette.gold }));
      crate.position.y = -0.09;
      crate.visible = false;
      grp.add(band, crate);
      grp.userData.crate = crate;
    }
    if (isPriest) {
      const banner = new THREE.Mesh(
        new THREE.PlaneGeometry(0.3, 0.1),
        new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
      banner.position.set(-0.3, 0.28, 0);
      grp.add(banner);
    }
    grp.userData.env = env;
  } else {
    // sea craft: trireme silhouettes
    const big = m.kind === 'heavy';
    const hull = new THREE.Mesh(
      new THREE.BoxGeometry(big ? 0.6 : 0.42, 0.09, big ? 0.26 : 0.18),
      new THREE.MeshLambertMaterial({ color: m.kind === 'transport' ? 0x3a5b52 : 0x22454e }));
    hull.position.y = 0.06;
    const prow = new THREE.Mesh(
      new THREE.ConeGeometry(0.07, 0.2, 5),
      new THREE.MeshLambertMaterial({ color: Palette.bronze }));
    prow.rotation.z = -Math.PI / 2;
    prow.position.set(big ? 0.36 : 0.27, 0.08, 0);
    grp.add(hull, prow);
    if (m.kind === 'siphon' || m.kind === 'priest') {
      const pipe = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.05, 0.34, 6),
        new THREE.MeshLambertMaterial({ color: Palette.poseidonGlow }));
      pipe.position.y = 0.26;
      grp.add(pipe);
    }
  }
  return grp;
}

function moverY(m) {
  return m.owner === 'A' ? CONFIG.Render.AIR_ALTITUDE + 0.05 : 0.03;
}

function syncMovers(state) {
  const seen = new Set();
  const movers = [];
  for (const h of state.haulers) if (h.state !== 'dead') movers.push(h);
  for (const s of ['A', 'P']) {
    const p = state.priests[s];
    if (p && p.state !== 'dead') movers.push(p);
  }
  for (const c of state.craft) if (!c.dead) movers.push(c);

  for (const m of movers) {
    seen.add(m.id);
    const hyd = m.kind === 'hauler' && m.owner === 'A' && !!state.hydrogen.A;
    let rec = R.craftMeshes.get(m.id);
    if (rec && m.kind === 'hauler' && m.owner === 'A' && rec.hyd !== hyd) {
      // the hydrogen upgrade refits the whole fleet: rebuild the mesh
      R.scene.remove(rec.grp);
      if (rec.driftLine) R.scene.remove(rec.driftLine);
      R.craftMeshes.delete(m.id);
      rec = null;
    }
    if (!rec) {
      const grp = makeMoverMesh(m, hyd);
      R.scene.add(grp);
      rec = { grp, lastPos: m.pos.slice(), hyd };
      R.craftMeshes.set(m.id, rec);
    }
    // fog: enemy movers need live vision (§14B.2)
    const visible = m.owner === 'A' ||
      state.vision.A.has(cellKey(Math.round(m.pos[0]), Math.round(m.pos[1])));
    rec.grp.visible = visible;
    const dx = m.pos[0] - rec.lastPos[0], dz = m.pos[1] - rec.lastPos[1];
    if (Math.abs(dx) + Math.abs(dz) > 0.001) {
      rec.grp.rotation.y = -Math.atan2(dz, dx);
      rec.lastPos = m.pos.slice();
    }
    rec.grp.position.set(worldX(m.pos[0]), moverY(m), worldZ(m.pos[1]));
    if (m.state === 'adrift') {
      rec.grp.rotation.y += Math.sin(state.time * 3 + m.id) * 0.15;
      rec.grp.rotation.z = Math.sin(state.time * 2.2 + m.id) * 0.3;
      rec.grp.position.y += Math.sin(state.time * 4 + m.id) * 0.06;
      // predicted drift line (§33G.5): where the wind will carry it
      if (!rec.driftLine) {
        const mat = new THREE.LineDashedMaterial({ color: 0xd9534f, dashSize: 0.18, gapSize: 0.14, transparent: true, opacity: 0.85 });
        rec.driftLine = new THREE.Line(new THREE.BufferGeometry(), mat);
        R.scene.add(rec.driftLine);
      }
      const pts = [];
      let px = m.pos[0], pz = m.pos[1];
      for (let i = 0; i <= 8; i++) {
        pts.push(new THREE.Vector3(worldX(px), moverY(m), worldZ(pz)));
        const w = state.wind.at(px, pz);
        px += w.x * 0.5; pz += w.z * 0.5;
      }
      rec.driftLine.geometry.setFromPoints(pts);
      rec.driftLine.computeLineDistances();
      rec.driftLine.visible = true;
    } else {
      rec.grp.rotation.z = 0;
      if (rec.driftLine) rec.driftLine.visible = false;
    }
    // ore crate visible while carrying cargo (mining made legible)
    if (rec.grp.userData.crate) rec.grp.userData.crate.visible = (m.cargo || 0) > 0;
    // hot-air burner: periodic flares light the envelope from within as
    // fire heats the air — each ship on its own rhythm
    if (rec.grp.userData.burner) {
      const f = Math.pow(Math.max(0, Math.sin(state.time * 1.4 + m.id * 2.1)), 8);
      rec.grp.userData.burner.material.opacity = 0.12 + 0.85 * f;
      rec.grp.userData.burner.scale.setScalar(0.8 + 0.5 * f);
      rec.grp.userData.env.material.emissive.setRGB(0.55 * f, 0.3 * f, 0.08 * f);
    }
    // hydrogen fleets fly visibly larger envelopes (§33E)
    if (m.kind === 'hauler' && m.owner === 'A') {
      const scale = state.hydrogen.A ? 1.3 : 1.0;
      rec.grp.scale.setScalar(scale);
      // venting tell below threshold (§33C.5)
      if (rec.grp.userData !== undefined && m.hull < CONFIG.Airship.VENT_THRESHOLD) {
        rec.grp.children.forEach(ch => { if (ch.material && ch.material.color) ch.material.opacity = 0.6 + 0.3 * Math.sin(state.time * 10); });
      }
    }
  }
  for (const [id, rec] of R.craftMeshes) {
    if (!seen.has(id)) {
      R.scene.remove(rec.grp);
      if (rec.driftLine) R.scene.remove(rec.driftLine);
      R.craftMeshes.delete(id);
    }
  }
}

// ---- Great Temple health bars + threat warning (§30: temple threatened
// -> strong edge warning) ----
function syncGreatTemples(state) {
  if (!R.gtBars) {
    R.gtBars = {};
    for (const side of ['A', 'P']) {
      const gt = state.greatTemple[side];
      const back = new THREE.Mesh(
        new THREE.BoxGeometry(1.1, 0.09, 0.14),
        new THREE.MeshBasicMaterial({ color: 0x10151a, transparent: true, opacity: 0.7 }));
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(1.06, 0.1, 0.1),
        new THREE.MeshBasicMaterial({ color: side === 'A' ? Palette.gold : Palette.poseidonGlow }));
      back.position.set(worldX(gt.cell[0]), 1.7, worldZ(gt.cell[1]));
      bar.position.copy(back.position);
      R.scene.add(back, bar);
      R.gtBars[side] = { bar, back, max: gt.hp };
    }
  }
  for (const side of ['A', 'P']) {
    const gt = state.greatTemple[side];
    const rec = R.gtBars[side];
    const frac = clamp(gt.hp / rec.max, 0, 1);
    rec.bar.scale.x = Math.max(0.001, frac);
    rec.bar.visible = rec.back.visible = frac < 1;
    if (side === 'P') {
      // enemy bar obeys fog memory: show only if his temple was ever seen
      const seen = state.vision.A.has(cellKey(gt.cell[0], gt.cell[1])) || state.memory.A.has('gtP');
      if (state.vision.A.has(cellKey(gt.cell[0], gt.cell[1]))) state.memory.A.set('gtP', state.time);
      rec.bar.visible = rec.back.visible = rec.bar.visible && seen;
    }
  }
  // edge warning while the home temple is under recent fire
  const hud = document.getElementById('hud');
  if (hud) {
    const threatened = state.time - (state.gtaLastHit || -99) < 2.5;
    hud.style.boxShadow = threatened ? 'inset 0 0 60px 18px rgba(217,83,79,0.55)' : '';
  }
}

// ---- island economy indicators: reserve bar + stockpile heap ----
const ALLEGIANCE_BASE = { A: 0xc9a05e, P: 0x2e6b74, N: 0xd8c9a8 };
function syncIslandBars(state) {
  for (const isl of state.map.islands) {
    if (isl.beachMat) {
      isl.beachMat.color.setHex(ALLEGIANCE_BASE[isl.owner || 'N']);
    }
  }
  for (const isl of state.map.islands) {
    if (isl.role.startsWith('greatTemple')) continue;
    let rec = R.islandBars.get(isl.id);
    if (!rec) {
      const [hx, hz] = isl.cells[0];
      // the MINE: an unmistakable quarry pit with a bronze headframe on
      // every ore-bearing island — this is what the haulers come for
      const mine = new THREE.Group();
      const pit = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.36, 0.1, 8),
        new THREE.MeshLambertMaterial({ color: 0x2a2118 }));
      pit.position.y = 0.03;
      mine.add(pit);
      const frameMat = new THREE.MeshLambertMaterial({ color: Palette.bronze });
      for (const sx of [-0.22, 0.22]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.06), frameMat);
        leg.position.set(sx, 0.28, 0);
        leg.rotation.z = sx > 0 ? -0.35 : 0.35;
        mine.add(leg);
      }
      const cross = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.08), frameMat);
      cross.position.y = 0.5;
      mine.add(cross);
      const wheel = new THREE.Mesh(
        new THREE.TorusGeometry(0.09, 0.025, 6, 10),
        new THREE.MeshLambertMaterial({ color: Palette.gold }));
      wheel.position.y = 0.5;
      mine.add(wheel);
      // gems glitter in the pit while ore remains
      const gemColors = [0x9b6bd4, 0xffd977, 0x5fd6a5, 0x7fd4dd];
      const gems = [];
      for (let g = 0; g < 4; g++) {
        const gem = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.055 + (g % 2) * 0.02),
          new THREE.MeshBasicMaterial({ color: gemColors[g], transparent: true, opacity: 0.95 }));
        const a = (g / 4) * Math.PI * 2 + 0.6;
        gem.position.set(Math.cos(a) * 0.16, 0.14 + (g % 2) * 0.05, Math.sin(a) * 0.16);
        mine.add(gem);
        gems.push(gem);
      }
      mine.userData.gems = gems;
      mine.position.set(worldX(hx), CONFIG.Render.ISLAND_HEIGHT, worldZ(hz));
      const heap = new THREE.Mesh(
        new THREE.ConeGeometry(0.22, 0.3, 7),
        new THREE.MeshLambertMaterial({ color: Palette.gold }));
      heap.position.set(worldX(hx) + 0.45, CONFIG.Render.ISLAND_HEIGHT, worldZ(hz) + 0.2);
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.05, 0.08),
        new THREE.MeshBasicMaterial({ color: 0x76d09a }));
      bar.position.set(worldX(isl.center[0]), CONFIG.Render.ISLAND_HEIGHT + 0.7, worldZ(isl.center[1]));
      R.scene.add(mine, heap, bar);
      rec = { mine, pit, heap, bar, baseReserve: isl.reserve };
      R.islandBars.set(isl.id, rec);
    }
    rec.mine.visible = isl.reserve > 0 || isl.stockpile > 0.5;
    if (isl.minedOut && rec.pit) rec.pit.material.color.setHex(0x4a4237);
    // gems twinkle while ore remains; a worked-out pit goes dark
    if (rec.mine.userData.gems) {
      rec.mine.userData.gems.forEach((gem, g) => {
        gem.visible = isl.reserve > 0;
        if (gem.visible) {
          const tw = 0.55 + 0.45 * Math.abs(Math.sin(state.time * (2.2 + g * 0.7) + isl.id * 2 + g));
          gem.material.opacity = tw;
          gem.scale.setScalar(0.75 + tw * 0.45);
          gem.rotation.y = state.time * (0.8 + g * 0.3);
        }
      });
    }
    const stockScale = clamp(isl.stockpile / 40, 0.001, 1.4);
    rec.heap.scale.setScalar(stockScale);
    rec.heap.visible = isl.stockpile > 0.5;
    const frac = rec.baseReserve > 0 ? isl.reserve / rec.baseReserve : 0;
    rec.bar.scale.x = Math.max(0.02, frac);
    rec.bar.visible = !!isl.owner && !isl.minedOut;
    rec.bar.material.color.setHex(isl.owner === 'A' ? 0x76d09a : 0x4fb6c4);
  }
}

// ---- transient effects ----
function fxSpawn(state, kind, pos, data) {
  R.fx.push({ kind, pos: pos.slice(), t0: state.time, data: data || {} });
}

function initFxEvents(state) {
  // combat tracers: Aeolus drops ballast jars (gold, falling), Poseidon
  // throws the sea upward (teal, rising); impacts flash at the target
  const tracer = (payload, poseidon) => {
    const { from, to, targetSide, kind } = payload;
    const ya = poseidon ? 0.25 : 1.05;
    const yb = targetSide === 'A' ? (kind === 'segment' ? CONFIG.Render.AIR_ALTITUDE : 0.9) : 0.25;
    fxSpawn(state, 'tracer', from, { to: to.slice(), ya, yb, color: poseidon ? Palette.poseidonGlow : 0xffd977 });
  };
  Events.on('gunFired', (p) => tracer(p, p.side === 'P'));
  Events.on('craftFired', (p) => tracer(p, true));
  Events.on('structureDestroyed', ({ st }) => {
    fxSpawn(state, 'boom', st.cell);
    // burning debris flung outward
    const rng = mulberry32(st.id);
    for (let i = 0; i < 5; i++) {
      const a = rng() * Math.PI * 2;
      fxSpawn(state, 'ember', st.cell, {
        vx: Math.cos(a) * (0.8 + rng()), vy: 1.6 + rng() * 1.4, vz: Math.sin(a) * (0.8 + rng())
      });
    }
  });
  Events.on('segmentDestroyed', ({ seg, cause }) => {
    fxSpawn(state, cause === 'collapse' ? 'unravel' : 'boom', segMid(seg), { air: seg.owner === 'A' });
  });
  Events.on('convoyLost', ({ ent }) => fxSpawn(state, 'wreck', ent.pos));
  Events.on('tidalSurge', ({ center }) => fxSpawn(state, 'surge', center));
  Events.on('fogBank', ({ center }) => fxSpawn(state, 'fogbank', center));
  Events.on('windwall', ({ cell }) => fxSpawn(state, 'windwall', cell));
  Events.on('greatTempleHit', ({ side }) => {
    const gt = state.greatTemple[side];
    if (Math.random() < 0.05) fxSpawn(state, 'boom', gt.cell);
  });
  // money made visible: coins burst where a bounty is earned and where
  // cargo is credited at the Great Temple
  const coinBurst = (pos, n, y0) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      fxSpawn(state, 'coin', pos, { vx: Math.cos(a) * 0.5, vz: Math.sin(a) * 0.5, y0 });
    }
  };
  Events.on('bounty', (p) => { if (p.pos) coinBurst(p.pos, 4, 0.7); });
  Events.on('delivery', ({ side }) => {
    if (side === 'A') coinBurst(state.greatTemple.A.cell, 6, 0.9);
  });
}

function fxTick(state, dt) {
  for (const f of R.fx) {
    const age = state.time - f.t0;
    if (!f.mesh) {
      let mesh = null;
      if (f.kind === 'boom') {
        mesh = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6),
          new THREE.MeshBasicMaterial({ color: 0xffc16e, transparent: true, opacity: 0.9 }));
      } else if (f.kind === 'unravel') {
        mesh = new THREE.Mesh(new THREE.SphereGeometry(0.2, 6, 5),
          new THREE.MeshBasicMaterial({ color: f.data.air ? 0xf2e8cf : 0x7fd4dd, transparent: true, opacity: 0.7 }));
      } else if (f.kind === 'wreck') {
        mesh = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.05, 0.15),
          new THREE.MeshLambertMaterial({ color: 0x6b5b45 }));
      } else if (f.kind === 'surge') {
        mesh = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.9, 24),
          new THREE.MeshBasicMaterial({ color: 0x7fd4dd, transparent: true, opacity: 0.7, side: THREE.DoubleSide }));
        mesh.rotation.x = -Math.PI / 2;
      } else if (f.kind === 'fogbank') {
        mesh = new THREE.Mesh(new THREE.CylinderGeometry(CONFIG.Powers.FOG_BANK.RADIUS, CONFIG.Powers.FOG_BANK.RADIUS, 0.3, 20),
          new THREE.MeshBasicMaterial({ color: 0xb8c4c6, transparent: true, opacity: 0.25 }));
      } else if (f.kind === 'windwall') {
        mesh = new THREE.Mesh(new THREE.SphereGeometry(CONFIG.Powers.WIND_WALL.RADIUS, 14, 10),
          new THREE.MeshBasicMaterial({ color: 0xfff3cf, transparent: true, opacity: 0.18 }));
      } else if (f.kind === 'coin') {
        mesh = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5),
          new THREE.MeshBasicMaterial({ color: Palette.gold, transparent: true, opacity: 1 }));
        mesh.position.set(worldX(f.pos[0]), f.data.y0 || 0.6, worldZ(f.pos[1]));
      } else if (f.kind === 'tracer') {
        const d = f.data;
        const ax = worldX(f.pos[0]), az = worldZ(f.pos[1]);
        const bx = worldX(d.to[0]), bz = worldZ(d.to[1]);
        const dx = bx - ax, dy = d.yb - d.ya, dz = bz - az;
        const len = Math.max(0.01, Math.hypot(dx, dy, dz));
        mesh = new THREE.Mesh(
          new THREE.CylinderGeometry(0.022, 0.022, len, 5),
          new THREE.MeshBasicMaterial({ color: d.color, transparent: true, opacity: 0.85 }));
        mesh.position.set((ax + bx) / 2, (d.ya + d.yb) / 2, (az + bz) / 2);
        mesh.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          new THREE.Vector3(dx / len, dy / len, dz / len));
        // impact spark and muzzle flare
        const spark = new THREE.Mesh(new THREE.SphereGeometry(0.11, 6, 5),
          new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 }));
        spark.position.set(bx, d.yb, bz);
        const flare = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 5),
          new THREE.MeshBasicMaterial({ color: d.color, transparent: true, opacity: 0.95 }));
        flare.position.set(ax, d.ya, az);
        R.scene.add(spark, flare);
        f.spark = spark;
        f.flare = flare;
      } else if (f.kind === 'ember') {
        mesh = new THREE.Mesh(new THREE.SphereGeometry(0.05, 5, 4),
          new THREE.MeshBasicMaterial({ color: 0xff8c3f, transparent: true, opacity: 1 }));
        mesh.position.set(worldX(f.pos[0]), 0.6, worldZ(f.pos[1]));
      }
      const y = f.kind === 'wreck' || f.kind === 'surge' ? 0.04 : (f.data.air ? CONFIG.Render.AIR_ALTITUDE : 0.3);
      mesh.position.set(worldX(f.pos[0]), y, worldZ(f.pos[1]));
      R.scene.add(mesh);
      f.mesh = mesh;
    }
    const life = f.kind === 'wreck' ? 20 : f.kind === 'fogbank' ? CONFIG.Powers.FOG_BANK.DURATION
      : f.kind === 'windwall' ? CONFIG.Powers.WIND_WALL.DURATION : f.kind === 'surge' ? 1.4
      : f.kind === 'tracer' ? 0.2 : f.kind === 'ember' ? 0.9 : f.kind === 'coin' ? 0.8 : 0.8;
    if (age > life) {
      R.scene.remove(f.mesh);
      if (f.spark) R.scene.remove(f.spark);
      if (f.flare) R.scene.remove(f.flare);
      f.dead = true;
      continue;
    }
    if (f.kind === 'tracer') {
      f.mesh.material.opacity = 0.85 * (1 - age / life);
      if (f.spark) f.spark.material.opacity = 0.9 * (1 - age / life);
      if (f.flare) {
        f.flare.material.opacity = 0.95 * (1 - age / life);
        f.flare.scale.setScalar(1 + age * 8);
      }
      continue;
    }
    if (f.kind === 'ember') {
      const d = f.data;
      f.mesh.position.x += d.vx * dt;
      f.mesh.position.z += d.vz * dt;
      d.vy -= 6 * dt;
      f.mesh.position.y = Math.max(0.05, f.mesh.position.y + d.vy * dt);
      f.mesh.material.opacity = 1 - age / life;
      continue;
    }
    if (f.kind === 'coin') {
      const d = f.data;
      f.mesh.position.x += (d.vx || 0) * dt;
      f.mesh.position.z += (d.vz || 0) * dt;
      f.mesh.position.y += 0.9 * dt;
      f.mesh.material.opacity = 1 - age / life;
      continue;
    }
    if (f.kind === 'boom' || f.kind === 'unravel') {
      f.mesh.scale.setScalar(1 + age * 3);
      f.mesh.material.opacity = Math.max(0, 0.9 * (1 - age / life));
    } else if (f.kind === 'surge') {
      f.mesh.scale.setScalar(1 + age * 4);
      f.mesh.material.opacity = Math.max(0, 0.7 * (1 - age / life));
    } else if (f.kind === 'wreck') {
      f.mesh.rotation.y += dt * 0.3;
      f.mesh.material.opacity = 1;
    }
  }
  R.fx = R.fx.filter(f => !f.dead);
}

// ghost of a structure while the player decides (RAISE / cancel), with the
// weapon's range drawn from that exact spot
function showStructPreview(state, side, type, cell, facing) {
  R.previewGroup.clear();
  if (facing === undefined) facing = defaultFacing(state, side, cell);
  const onLand = !!islandAt(state, cell[0], cell[1]);
  const grp = new THREE.Group();
  const chassis = type === 'temple' || type === 'yard' ? new THREE.Group() : makeChassis(side, onLand, type);
  const payload = makePayload(side, type, null);
  if (type === 'bolt') payload.rotation.y = -facing;   // the turret shows its aim
  grp.add(chassis, payload);
  {
    const stats = structureStats(side, type);
    const r = type === 'temple' ? influenceRadius('temple')
      : type === 'shield' ? CONFIG.Structures.SHIELD_COVER_RADIUS
      : (stats.range || stats.radius || 0);
    if (r > 0) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(r - 0.06, r, 48),
        new THREE.MeshBasicMaterial({
          color: type === 'temple' ? Palette.gold : 0xffd977,
          transparent: true, opacity: 0.5, side: THREE.DoubleSide
        }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.07;
      const fill = new THREE.Mesh(
        new THREE.CircleGeometry(r, 48),
        new THREE.MeshBasicMaterial({ color: 0xffd977, transparent: true, opacity: 0.07, side: THREE.DoubleSide }));
      fill.rotation.x = -Math.PI / 2;
      fill.position.y = 0.065;
      grp.add(ring, fill);
      // the bolt is a TURRET: long reach but only a 90° sector at a time
      // (it traverses slowly). Show the wedge, not just the ring — the
      // vane's full circle and the bolt's slice must read differently.
      if (type === 'bolt' && stats.arc) {
        const wedge = new THREE.Mesh(
          new THREE.RingGeometry(0.35, r, 24, 1, -facing - stats.arc / 2, stats.arc),
          new THREE.MeshBasicMaterial({ color: 0xffd977, transparent: true, opacity: 0.22, side: THREE.DoubleSide }));
        wedge.rotation.x = -Math.PI / 2;
        wedge.position.y = 0.068;
        grp.add(wedge);
      }
    }
  }
  grp.traverse(o => {
    if (o.material) {
      o.material = o.material.clone();
      o.material.transparent = true;
      o.material.opacity = 0.45;
    }
  });
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.34, 0.46, 24),
    new THREE.MeshBasicMaterial({ color: Palette.socket, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.06;
  grp.add(ring);
  const baseY = onLand ? CONFIG.Render.ISLAND_HEIGHT : (side === 'A' ? CONFIG.Render.AIR_ALTITUDE - 0.6 : 0);
  grp.position.set(worldX(cell[0]), baseY, worldZ(cell[1]));
  R.previewGroup.add(grp);
}

// ---- exploration shroud: unexplored terrain is dark until the player's
// reach (structures, corridors, ships) lifts it. One-way. ----
R.shroud = new Map();

function buildShroud(state) {
  for (const m of R.shroud.values()) R.scene.remove(m);
  R.shroud.clear();
  const geo = new THREE.BoxGeometry(1.02, 1.7, 1.02);
  const opaque = CONFIG.Render.SHROUD_OPACITY >= 1;
  const mat = new THREE.MeshBasicMaterial({
    color: 0x060f14, transparent: !opaque, opacity: CONFIG.Render.SHROUD_OPACITY
  });
  for (let z = 0; z < CONFIG.Grid.HEIGHT; z++) {
    for (let x = 0; x < CONFIG.Grid.WIDTH; x++) {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(worldX(x), 0.85, worldZ(z));
      R.scene.add(m);
      R.shroud.set(cellKey(x, z), m);
    }
  }
}

function syncShroud(state) {
  const lift = (k) => {
    const m = R.shroud.get(k);
    if (m) {
      R.scene.remove(m);
      R.shroud.delete(k);
    }
  };
  // ground once seen stays lifted — and ground inside your influence is
  // always lifted, because influence is exactly where you may build
  if (state.explored) for (const k of state.explored) lift(k);
  for (const k of state.influence.A) lift(k);
}

// Enemy STATIC infrastructure obeys the same boundary as the ground
// (player-directed): wherever the shroud is lifted — explored ground or
// your influence — his lanes are drawn live. No weird ring of clear
// water hiding lanes that only pop in at close range. A lane whose
// neighbour is visible still ghosts one step into true murk, so his
// paths visibly continue somewhere. Moving craft still need live eyes.
function groundLifted(state, x, z) {
  const k = cellKey(x, z);
  return (state.explored && state.explored.has(k)) || state.influence.A.has(k);
}

function segmentVisibility(state, s) {
  if (s.owner === 'A') return 'full';
  const m = segMid(s);
  const mx = Math.round(m[0]), mz = Math.round(m[1]);
  if (state.vision.A.has(cellKey(mx, mz)) || groundLifted(state, mx, mz)) return 'full';
  if (state.memory.A.has('seg:' + s.key)) return 'dim';
  const touch = visibleLaneCells(state);
  if (touch.has(cellKey(s.a[0], s.a[1])) || touch.has(cellKey(s.b[0], s.b[1]))) return 'dim';
  return 'hidden';
}

// endpoint cells of his lanes currently in live vision, cached per frame
function visibleLaneCells(state) {
  const c = R.visLaneCache;
  if (c && c.t === state.time) return c.set;
  const set = new Set();
  for (const s of state.segments.values()) {
    if (s.owner !== 'P') continue;
    const m = segMid(s);
    const mx = Math.round(m[0]), mz = Math.round(m[1]);
    if (!state.vision.A.has(cellKey(mx, mz)) && !groundLifted(state, mx, mz)) continue;
    set.add(cellKey(s.a[0], s.a[1]));
    set.add(cellKey(s.b[0], s.b[1]));
  }
  R.visLaneCache = { t: state.time, set };
  return set;
}
