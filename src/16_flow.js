// ================================================================
// FLOW — onboarding (§23), wave banners (§25), win/lose/reset (§28),
// and the optional Codex (§27). Lore rides on instructions that
// already exist; nothing here interrupts play.
// ================================================================

// GUIDED first-play tutorial (player-directed: "show them where to
// touch"): a pointing hand marks the exact spot, each step advances on
// the REAL action, and the tide holds until the lesson is done. Runs
// once ever; SKIP TUTORIAL exits and releases the waves.
const TUT_STEPS = [
  {
    key: 'path', done: 'piecePlaced',
    text: () => 'Tap the glowing spot the hand points at. Pick a path piece from the menu, turn it if you like, then CONFIRM.',
    target: (state) => {
      const s = getSockets(state, 'A').find(k => k.kind === 'island');
      return s ? s.cell : null;
    }
  },
  {
    key: 'mine', done: 'delivery', timeout: 45,
    text: () => 'Every island your paths touch is mined for you — see the gems glitter. Your hauler carries the ore home; the coin ⚇ lands when it moors.',
    target: (state) => {
      const isl = state.map.islands.find(i => i.role === 'supplyA');
      return isl ? isl.cells[0] : null;
    }
  },
  {
    key: 'temple', done: 'consecrationStarted',
    text: () => 'Tap the far island and SEND PRIEST. When he lands, tap the island again and raise a TEMPLE — temples claim ground and earn Favor ✦.',
    target: (state) => {
      const isl = state.map.islands.find(i => i.role === 'supplyA');
      return isl ? [Math.round(isl.center[0]), Math.round(isl.center[1])] : null;
    }
  },
  {
    key: 'yard', done: 'yardBuilt',
    text: () => 'Tap any empty square on your home island and raise a ' + (R.themeSea ? 'SHIPYARD' : 'MOORING YARD') + ' — it moors two more haulers.',
    target: (state) => {
      const isl = state.gtA;
      const c = isl.cells.find(([x, z]) => !structureAt(state, x, z) && !plotBlockedByQuarry(isl, { x, z }));
      return c || null;
    }
  },
  {
    key: 'gun', done: 'gunBuilt',
    text: () => 'Now arm yourself: tap an open path end for a ' + (R.themeSea ? 'LANCE BATTERY' : 'BOLT BATTERY') + ' (aim it with TURN), or any island square for a ' + (R.themeSea ? 'STORM DRUM' : 'CHAIN VANE') + '.',
    target: (state) => {
      const e = getSockets(state, 'A').find(k => k.kind === 'end' && !structureAt(state, k.cell[0], k.cell[1]));
      if (e) return e.cell;
      const isl = state.gtA;
      const c = isl.cells.find(([x, z]) => !structureAt(state, x, z) && !plotBlockedByQuarry(isl, { x, z }));
      return c || null;
    }
  },
  {
    key: 'done', timeout: 7,
    text: () => 'You know the loop: paths, ore, temples, guns — and Favor for your god\'s aid in the thumb menu. The tide comes nine times, then his wrath until one temple falls. Strike first.',
    target: () => null
  }
];

// (Poseidon's tide titles and grievances retired from mid-match banners
// by player direction — his voice lives on the intro screen only.)

function initFlow(state) {
  state.flow = { skipped: false };
  const skipBtn = document.getElementById('skipbtn');
  const seenTut = seenLines().has('guidedTut');
  state.tut = { active: !seenTut, step: 0, stepAt: 0 };
  skipBtn.classList.toggle('hidden', !state.tut.active);
  const endTut = () => {
    state.tut.active = false;
    markSeen('guidedTut');
    hideTutorialLine();
    skipBtn.classList.add('hidden');
    const hand = document.getElementById('tuthand');
    if (hand) hand.style.display = 'none';
  };
  state.tut.end = endTut;
  skipBtn.onclick = endTut;

  // each step completes on the REAL action it teaches
  const advance = (doneKey) => {
    if (!state.tut.active) return;
    const step = TUT_STEPS[state.tut.step];
    if (step && step.done === doneKey) {
      state.tut.step++;
      state.tut.stepAt = state.time;
      if (state.tut.step >= TUT_STEPS.length) endTut();
    }
  };
  Events.on('piecePlaced', ({ side }) => { if (side === 'A') advance('piecePlaced'); });
  Events.on('delivery', ({ side }) => { if (side === 'A') advance('delivery'); });
  Events.on('consecrationStarted', ({ side }) => { if (side === 'A') advance('consecrationStarted'); });
  Events.on('structureBuilt', ({ st }) => {
    if (st.owner !== 'A') return;
    if (st.type === 'yard') advance('yardBuilt');
    if (st.type === 'vane' || st.type === 'bolt') advance('gunBuilt');
  });

  // No mid-match theatre (player-directed): Poseidon's grievance lives on
  // the intro screen only. Waves announce themselves through the HUD
  // countdown, the telegraph sound, and the camera's slow breath — no
  // banner. Claims speak through the board itself (island bases tint).
  Events.on('waveTelegraph', () => audioPlay('telegraph'));
  Events.on('ageOfWrath', () => flashTicker('THE AGE OF WRATH — EVERYTHING HITS HARDER'));
  Events.on('waveLaunched', ({ index }) => {
    if (index === CONFIG.Waves.COUNT) flashTicker('THE NINTH TIDE HAS PASSED — HIS WRATH HAS NOT');
  });
  // the wind law made waits real: say them out loud, sparingly
  Events.on('fleetWaits', ({ side }) => {
    if (side !== 'A' || state.time < (state.flow.windNoteAt || 0)) return;
    state.flow.windNoteAt = state.time + 30;
    flashTicker('THE WIND SETS AGAINST THE ROAD — THE FLEET WAITS');
  });
  Events.on('fleetTacks', ({ side }) => {
    if (side !== 'A' || state.time < (state.flow.tackNoteAt || 0)) return;
    state.flow.tackNoteAt = state.time + 30;
    flashTicker('NO FAIR WIND — THE FLEET CLAWS FORWARD');
  });
  Events.on('convoyLost', ({ ent }) => { if (ent.owner === 'A') flashTicker('CONVOY LOST'); });
  Events.on('priestDead', ({ side }) => {
    if (side === 'A') flashTicker('THE PRIEST IS LOST — A SUCCESSOR IS INVESTED');
  });
  Events.on('islandDepleted', ({ island }) => {
    if (island.owner === 'A') flashTicker('AN ISLAND RUNS DRY');
  });
}

function flowTick(state) {
  const f = state.flow;
  // ---- the guided tutorial: persistent instruction + pointing hand ----
  if (state.tut && state.tut.active) {
    const step = TUT_STEPS[state.tut.step];
    if (step) {
      if (step.timeout && state.time - state.tut.stepAt > step.timeout) {
        state.tut.step++;
        state.tut.stepAt = state.time;
        if (state.tut.step >= TUT_STEPS.length) state.tut.end();
      }
      const cur = TUT_STEPS[state.tut.step];
      if (cur) {
        // instruction stays up for the whole step (re-shown every frame)
        const el = document.getElementById('tutorial');
        if (el) { el.innerHTML = cur.text(); el.classList.add('show'); }
        // the pointing hand marks the exact spot to touch
        let hand = document.getElementById('tuthand');
        if (!hand) {
          hand = document.createElement('div');
          hand.id = 'tuthand';
          hand.innerHTML = '<div class="ring"></div><div class="finger">👆</div>';
          document.body.appendChild(hand);
        }
        const target = cur.target(state);
        if (target) {
          const v = new THREE.Vector3(worldX(target[0]), 0.5, worldZ(target[1])).project(R.camera);
          const px = (v.x + 1) / 2 * window.innerWidth;
          const py = (-v.y + 1) / 2 * window.innerHeight;
          const on = v.z < 1 && px > 10 && px < window.innerWidth - 10 && py > 60 && py < window.innerHeight - 60;
          hand.style.display = on ? 'block' : 'none';
          hand.style.left = (px - 26) + 'px';
          hand.style.top = (py - 26) + 'px';
        } else hand.style.display = 'none';
      }
    }
  }
  // the first time one of his lanes closes on your holdings, say the law
  // out loud once: his paths obey the same connection rules yours do
  if (!f.laneNoteShown && (!f.laneNoteAt || state.time > f.laneNoteAt + 2)) {
    f.laneNoteAt = state.time;
    outer:
    for (const s of state.segments.values()) {
      if (s.owner !== 'P') continue;
      for (const st of state.structures) {
        if (st.owner !== 'A' || st.hp <= 0) continue;
        if (dist2d(s.a[0], s.a[1], st.cell[0], st.cell[1]) <= 5 ||
            dist2d(s.b[0], s.b[1], st.cell[0], st.cell[1]) <= 5) {
          f.laneNoteShown = true;
          showTutorialLine('Enemy paths obey the same law as yours — every one traces home to a temple. Cut one anywhere behind its tip and everything beyond unbinds.', 5600, 'lanesTraceHome');
          break outer;
        }
      }
    }
  }

  // (wave-1 lore line removed with the rest of his mid-match voice)

  // Zeus's arbitration (set in wavesTick): the survivor's verdict
  if (state.over === 'arbitration' && !f.arbShown) {
    f.arbShown = true;
    const sea = state.theme === 'sea';
    endScreen('ZEUS RULES IN YOUR FAVOR',
      sea ? 'Victory. Nine tides of the sky and all its fury after — your lanes still stand. The matter is settled; the sky withdraws.'
          : 'Victory. Nine tides and his wrath behind them — your roads still stand. The matter is settled; the sea withdraws.', state);
    // the verdict may be refused (player-directed): fight to the end
    document.getElementById('fightonbtn').classList.remove('hidden');
    audioPlay('victory');
  }
  // win / lose (§28) — worded for whichever god you served
  if (!state.over) {
    const sea = state.theme === 'sea';
    if (state.greatTemple.P.hp <= 0) {
      state.over = 'win';
      endScreen('THE ARCHIPELAGO ACKNOWLEDGES YOUR GOD',
        sea ? 'The Guild’s temple is fallen. The tide has collected.'
            : 'Poseidon’s temple is fallen. The winds hold every road.', state);
      audioPlay('victory');
    } else if (state.greatTemple.A.hp <= 0) {
      state.over = 'lose';
      endScreen('YOUR TEMPLE HAS FALLEN',
        sea ? 'The sky remembers what the sea forgot.'
            : 'The sea remembers what the sky forgot.', state);
      audioPlay('defeat');
    }
  }
}

function endScreen(title, text, state) {
  document.getElementById('endtitle').textContent = title;
  document.getElementById('endtext').textContent = text;
  document.getElementById('endseed').textContent = state.seed;
  document.getElementById('fightonbtn').classList.add('hidden');   // arbitration unhides it
  document.getElementById('endscreen').classList.remove('hidden');
}

// ---- Codex (§27): REMOVED by player direction. The long-press trigger
// fired "Poseidon's Complaint" whenever a finger rested ~1s on open
// water (constantly, while pinching or thinking zoomed out) and the
// Temple entry on any island hold. His voice lives on the intro screen;
// the board explains itself through tap-to-identify instead. ----
function initCodex(state) { }
