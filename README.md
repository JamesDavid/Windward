# WINDWARD — Archipelago of the Gods

A portrait mobile web prototype for the Meta Horizon Creator Competition (Tower Defense & Strategy).

> You are the high priest of Aeolus. Build circuits of bound wind into a working logistics network across a Greek archipelago, cap its exposed ends with defenses, survive nine escalating waves from Poseidon's priesthood, watch severed infrastructure physically unravel — and race to reconnect it before the collapse reaches something you love.

**Tech:** Three.js / HTML5, single-player, portrait, fully offline. All entrant-authored code assembles into one readable `index.html`; Three.js lives under `/vendor`. All art is procedural Three.js geometry and all audio is runtime WebAudio synthesis — no external assets of any kind.

---

## Playing

Open `index.html` in a browser (portrait phone, or a narrow browser window). No server or network needed.

- **Tap a route piece** from your hand of three, tap a glowing socket, tap the preview to rotate, confirm.
- **Tap a network endpoint or island plot** to build a gun, shield, shipyard, or Temple.
- **Tap an island** to send your priest there; he must stand on an island for the 10 s a Temple takes to consecrate.
- Win by felling Poseidon's Great Temple. Lose if he fells yours. One-tap reset.

## Development

```
node build.js      # assemble src/*.js into index.html
node test/test_mapgen.js   # headless logic tests
```

Game logic lives in `src/*.js` (concatenated in filename order); every tunable number lives in the frozen `CONFIG` object at the top of the built file. `buildlog/BUILDLOG.md` is the running build log required by the competition.

---

## Feature log

Screenshots are portrait-phone captures (390×844) added as each feature lands.

### 1. Deterministic archipelago generation *(done)*

Every match generates its own nine-island archipelago from a seed shown on the start screen — type a seed back in to replay a map exactly. Generation is zone-constrained (corner opposition never varies, island positions and reserves do) and validated against 11 invariants: supply islands inside starting influence, 8–12 cell runs to the contested interior, a guaranteed over-water approach for Wave 5's scripted strike, a priced island-hop alternative, an open channel so Poseidon's lanes can always be reached, wind that rewards circuit routes over out-and-back spurs, and more. Failed seeds re-roll; a verified golden seed is the last-resort fallback.

*(screenshot pending renderer)*

