// ================================================================
// FLOW — onboarding (§23), wave banners (§25), win/lose/reset (§28),
// and the optional Codex (§27). Lore rides on instructions that
// already exist; nothing here interrupts play.
// ================================================================

// A REAL first-play tutorial (player-directed): five plain lines that
// teach the whole loop — pathways, mining, temples, the two coins.
// Each shows once EVER; SKIP TUTORIAL silences the lot.
const TUTORIAL_SCRIPT = [
  { at: 1, key: 'tu1', text: 'Tap a glowing spot on your island and lay path pieces — pathways are how everything moves.' },
  { at: 10, key: 'tu2', text: 'Every island your pathways touch is mined. Haulers carry the ore home — that is your coin ⚇.' },
  { at: 20, key: 'tu3', text: 'Coin builds guns, shields, yards and ships. Send your priest to an island to consecrate a temple and claim it.' },
  { at: 30, key: 'tu4', text: 'Temples earn Favor ✦ — your god\'s regard. Favor lays pathways and buys divine aid: Tailwind, the Wind Wall.' },
  { at: 40, key: 'tu5', text: 'Cap open path ends with guns: severed paths unbind. The first tide is nearly here.' }
];

// (Poseidon's tide titles and grievances retired from mid-match banners
// by player direction — his voice lives on the intro screen only.)

function initFlow(state) {
  state.flow = { tutorialIdx: 0, skipped: false, waveOneAnnounced: false };
  const skipBtn = document.getElementById('skipbtn');
  skipBtn.classList.remove('hidden');
  skipBtn.onclick = () => {
    state.flow.skipped = true;
    state.flow.tutorialIdx = TUTORIAL_SCRIPT.length;
    for (const item of TUTORIAL_SCRIPT) markSeen(item.key);
    markSeen('wave1lore');
    hideTutorialLine();
    skipBtn.classList.add('hidden');
    try { localStorage.setItem('windward-skip', '1'); } catch (e) { }
  };
  if ((() => { try { return localStorage.getItem('windward-skip') === '1'; } catch (e) { return false; } })()) {
    state.flow.skipped = true;
    state.flow.tutorialIdx = TUTORIAL_SCRIPT.length;
    skipBtn.classList.add('hidden');
  }

  // No mid-match theatre (player-directed): Poseidon's grievance lives on
  // the intro screen only. Waves announce themselves through the HUD
  // countdown, the telegraph sound, and the camera's slow breath — no
  // banner. Claims speak through the board itself (island bases tint).
  Events.on('waveTelegraph', () => audioPlay('telegraph'));
  Events.on('ageOfWrath', () => flashTicker('THE AGE OF WRATH — EVERYTHING HITS HARDER'));
  Events.on('convoyLost', ({ ent }) => { if (ent.owner === 'A') flashTicker('CONVOY LOST'); });
  Events.on('priestDead', ({ side }) => {
    if (side === 'A') flashTicker('THE PRIEST IS LOST — A SUCCESSOR IS INVESTED');
  });
  Events.on('islandDepleted', ({ island }) => {
    if (island.owner === 'A') flashTicker('AN ISLAND RUNS DRY');
  });
}

function flowTick(state) {
  // tutorial lines on the clock, one at a time (§23)
  const f = state.flow;
  if (!f.skipped && f.tutorialIdx < TUTORIAL_SCRIPT.length) {
    const item = TUTORIAL_SCRIPT[f.tutorialIdx];
    if (state.time >= item.at) {
      showTutorialLine(item.text, 4200, item.key);   // shown once EVER
      f.tutorialIdx++;
      if (f.tutorialIdx === TUTORIAL_SCRIPT.length) {
        setTimeout(() => document.getElementById('skipbtn').classList.add('hidden'), 6000);
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
  document.getElementById('endscreen').classList.remove('hidden');
}

// ---- Codex (§27): REMOVED by player direction. The long-press trigger
// fired "Poseidon's Complaint" whenever a finger rested ~1s on open
// water (constantly, while pinching or thinking zoomed out) and the
// Temple entry on any island hold. His voice lives on the intro screen;
// the board explains itself through tap-to-identify instead. ----
function initCodex(state) { }
