// ================================================================
// FLOW — onboarding (§23), wave banners (§25), win/lose/reset (§28),
// and the optional Codex (§27). Lore rides on instructions that
// already exist; nothing here interrupts play.
// ================================================================

const TUTORIAL_SCRIPT = [
  { at: 0.5, text: '“The bag lifts them. Only bound air moves them. Take a wind.”' },
  { at: 5, text: '“Lay it toward the shrine. Nothing you build need touch the sea.”' },
  { at: 12, text: '“My ships move where you have bound the air. Favor follows.”' },
  { at: 20, text: '“An open end is exposed. Cap it, or continue it.”' }
];

const POSEIDON_BANNERS = [
  ['THE FIRST TIDE', '“Something is above my water.”'],
  ['THE SECOND TIDE', '“It has not come down.”'],
  ['THE THIRD TIDE', '“They no longer sail. They no longer pay. They no longer ask.”'],
  ['THE FOURTH TIDE', '“Then break the road, not the ships.”'],
  ['THE FIFTH TIDE', '“Cut it where it reaches farthest.”'],
  ['THE SIXTH TIDE', '“They made a sky out of rocks and sour wine. Drown it.”'],
  ['THE SEVENTH TIDE', '“Everywhere at once.”'],
  ['THE AGE OF WRATH', '“Three generations I have waited to be needed again.”'],
  ['THE LAST TIDE', '“Come down.”']
];

const ORIGIN_NAMES = {
  greatTempleP: 'HIS TEMPLE', supplyP: 'HIS HARBOURS', neutralP: 'THE WESTERN SHALLOWS',
  sacredA: 'THE WESTERN SHRINE', sacredP: 'THE EASTERN SHRINE',
  chokepoint: 'THE CHOKEPOINT', neutralA: 'THE EASTERN SHALLOWS',
  supplyA: 'YOUR OWN WATERS', greatTempleA: 'YOUR DOORSTEP'
};

function initFlow(state) {
  state.flow = { tutorialIdx: 0, skipped: false, waveOneAnnounced: false };
  const skipBtn = document.getElementById('skipbtn');
  skipBtn.classList.remove('hidden');
  skipBtn.onclick = () => {
    state.flow.skipped = true;
    state.flow.tutorialIdx = TUTORIAL_SCRIPT.length;
    hideTutorialLine();
    skipBtn.classList.add('hidden');
    try { localStorage.setItem('windward-skip', '1'); } catch (e) { }
  };
  if ((() => { try { return localStorage.getItem('windward-skip') === '1'; } catch (e) { return false; } })()) {
    state.flow.skipped = true;
    state.flow.tutorialIdx = TUTORIAL_SCRIPT.length;
    skipBtn.classList.add('hidden');
  }

  // In-game telegraphs are compact and high: the wave title and where it
  // comes from — no theatre. Poseidon's grievance lives on the intro screen.
  Events.on('waveTelegraph', ({ index, origin }) => {
    const [title] = POSEIDON_BANNERS[index];
    const name = ORIGIN_NAMES[origin.island.role] || 'THE DEEP';
    showBanner('WAVE ' + (index + 1) + ' · ' + title, 'from ' + name.toLowerCase(), true);
    audioPlay('telegraph');
  });
  Events.on('templeFallen', ({ island, side }) => {
    if (side === 'P') flashTicker('HIS TIDE MUST COME FURTHER NOW');
  });
  Events.on('islandClaimed', ({ island, side }) => {
    showBanner('ISLAND CLAIMED', side === 'A' ? 'The wind holds this ground now.' : 'The sea has taken ground.', side === 'P');
  });
  Events.on('ageOfWrath', () => showBanner('THE AGE OF WRATH', 'everything hits harder now', true));
  Events.on('convoyLost', ({ ent }) => { if (ent.owner === 'A') flashTicker('CONVOY LOST'); });
  Events.on('priestDead', ({ side }) => {
    if (side === 'A') showBanner('THE PRIEST IS LOST', 'A successor is invested at the Temple.');
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
      showTutorialLine(item.text, 5500);
      f.tutorialIdx++;
      if (f.tutorialIdx === TUTORIAL_SCRIPT.length) {
        setTimeout(() => document.getElementById('skipbtn').classList.add('hidden'), 6000);
      }
    }
  }
  // Wave 1's telegraph line is delivered by the telegraph system itself;
  // this is the only Aeolus line after control releases (§23)
  if (!f.waveOneAnnounced && state.time >= CONFIG.Waves.FIRST_AT - CONFIG.Waves.TELEGRAPH) {
    f.waveOneAnnounced = true;
    if (!f.skipped) showTutorialLine('“They cross without asking him. He rises.”', 5000);
  }

  // win / lose (§28)
  if (!state.over) {
    if (state.greatTemple.P.hp <= 0) {
      state.over = 'win';
      endScreen('THE ARCHIPELAGO ACKNOWLEDGES YOUR GOD',
        'Poseidon’s temple is fallen. The winds hold every road.', state);
      audioPlay('victory');
    } else if (state.greatTemple.A.hp <= 0) {
      state.over = 'lose';
      endScreen('YOUR TEMPLE HAS FALLEN',
        'The sea remembers what the sky forgot.', state);
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

// ---- Codex (§27): long-press an island or structure ----
const CODEX = {
  askos: ['Askos', 'Linen over bronze ribs. A trireme turned over and lightened until it left the water.'],
  lightair: ['The Light Air', 'Iron filings and sour wine in a sealed retort give off an air that will not stay down. No god was consulted, because none was needed.'],
  corridor: ['Wind Corridor', 'Bound air, renewed from the Temple. Severed, it does not fall. It remembers, and unbinds itself backward from the cut.'],
  temple: ['Temple', 'Where mortals thank the wind for not killing them. Favor accumulates only over ground no rival god also claims.'],
  bolt: ['Bolt Battery', 'It fires nothing. It drops ballast jars — bronze, heavy, full of seawater — into the lanes below. Every gun in this war points at water.'],
  siphon: ['Siphon Craft', 'Bronze pumps that throw the sea upward. Wet air will not hold a binding, and a drowned wind is no road at all.'],
  poseidon: ['Poseidon’s Complaint', 'Every crossing once owed him honour. The sky asks him for nothing, so it thanks him for nothing. There is no rite for being forgotten.'],
  bag: ['The Opened Bag', 'Odysseus slept within sight of Ithaca. His crew thought the bag held gold. Everything since is consequence.']
};

let codexTimer = null;
function initCodex(state) {
  const canvas = R.renderer.domElement;
  const codexEl = document.getElementById('codex');
  const open = (entry) => {
    const [title, body] = CODEX[entry];
    codexEl.innerHTML = '<h3>' + title + '</h3>' + body;
    codexEl.classList.remove('hidden');
    setTimeout(() => codexEl.classList.add('hidden'), 6000);
  };
  canvas.addEventListener('pointerdown', (e) => {
    const cell = pickCell(e.clientX, e.clientY);
    codexTimer = setTimeout(() => {
      if (!cell) { open('bag'); return; }
      const st = structureAt(state, cell[0], cell[1]);
      if (st) { open(st.type === 'bolt' ? 'bolt' : st.type === 'temple' ? 'temple' : 'askos'); return; }
      const isl = islandAt(state, cell[0], cell[1]);
      if (isl) { open('temple'); return; }
      const onSeg = [...state.segments.values()].some(s => s.owner === 'A' &&
        Math.abs((s.a[0] + s.b[0]) / 2 - cell[0]) < 1 && Math.abs((s.a[1] + s.b[1]) / 2 - cell[1]) < 1);
      open(onSeg ? 'corridor' : 'poseidon');
    }, 650);
  });
  canvas.addEventListener('pointerup', () => clearTimeout(codexTimer));
  canvas.addEventListener('pointermove', () => clearTimeout(codexTimer));
}
