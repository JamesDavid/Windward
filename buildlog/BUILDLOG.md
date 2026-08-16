# Build Log: WINDWARD — Archipelago of the Gods

Genre: Tower Defense & Strategy

---

## Decisions locked so far

*Keep this list current. Re-read it at the start of every session. When a decision changes, edit it here AND note the change in that session's entry.*

### Scope
- Two factions only: Aeolus (player, air) and Poseidon (AI, sea). Gaia and Zeus are future state.
- One map **template** on a 12 × 20 portrait grid, nine islands, corner opposition — **deterministically generated per match from a seed** (spec §20A supersedes the earlier "one handcrafted map" decision; changed in Session 1). Free-form procedural maps remain cut; generation is zone-constrained and validated.
- Target session: ~7 minutes, nine waves.
- Single-player, portrait, Three.js, fully offline.

### Core systems
- Route pieces: hand of three, five shapes (short straight, long straight, L, S, T). Tap piece → tap socket → tap to cycle orientation → confirm. No dragging.
- Support graph: every segment must trace to an anchor. Loss of support causes progressive collapse from the exposed end inward, 3 s rescue window then one segment per 3 s.
- Structures are network **nodes, not caps** — routes and further structures build onward from their ports.
- Two placement contexts: network endpoints, and island plots (2 per island, 3 on a Temple).
- Influence gates all construction. Overlap is contested: buildable by both, Favor to neither.
- Islands are claimed by building a Temple. Priest must be present. Completing a Temple crumbles opposing connections from that island.
- Economy: Supply mined into a local stockpile, hauled home, credited on arrival. Islands deplete.
- Wind field: dot product with route direction sets speed. Drifts ±30°, never reverses. Air affected strongly, sea slightly.
- Ships have hull integrity, regenerate, and go **adrift** when their segment loses support.

### Constraints
- All own game code consolidated into a single readable, unminified `index.html`.
- Three.js under `/vendor`, relative paths, no CDN.
- All assets local. Audio synthesised at runtime with WebAudio (zero bytes, zero requests).
- ZIP ≤ 35 MB, `index.html` at root.
- **No numeric literals in system logic** — all tuning values live in one frozen `CONFIG` object at the top of `index.html`.
- No identifying information anywhere: code comments, metadata, repo URLs, filenames, page title.

### Art
- Mythic Hellenic bronzepunk. Aeolus warm ivory/gold, Poseidon cold teal/green.
- Airships are converted triremes: hull → gondola, oars → fins, sail → envelope.
- Fixed oblique camera, no free rotation.

### Cut / not building
Gaia, Zeus, earth and storm layers, throughput and congestion, route and terminal repair, in-match blessings, fog on terrain, multiplayer, procedural maps, worker entities.

---

### Submission artefacts status
- **Design Intent** (`docs/design-intent.docx`): refreshed 2026-08-15 to match the built game (scrolling seeded archipelago, roads-are-reach, raw-end exposure, lane-reach waves, exploration fog). 491 words, template's seven sections, regenerated with no author metadata anywhere in the file.
- **Build Log**: this file, updated with every commit.
- **Playable build**: `index.html` + `/vendor/three.min.js`, fully offline, all art procedural, all audio WebAudio-synthesised. Contest zip will be produced only when instructed.

## Session log

<!--
ENTRY TEMPLATE — copy for each session.

## Session N (YYYY-MM-DD): <short title>

**Tool(s):** 
**Commits:** `<first>`..`<last>`

### Prompts and commits
| # | Prompt (summary) | Commit | Result |
|---|---|---|---|
| 1 |  | `abc1234` |  |

**What I built:**
**Key decisions and why:**
**Pivots, and what changed my thinking:**
**What changed after playtesting:**
**Biggest problems, and how I solved them:**
**What I learned:**
**Where things stand / next:**
-->

## Session 0 (2026-08-15): setup

**Tool(s):** —
**Commits:** —

**What I built:** Repository initialised, spec finalised, build log started.

**Key decisions and why:** Locked the decisions above before writing code, so the agent has a stable reference and stops re-litigating settled choices between sessions.

**Where things stand / next:** Day 1–2 spikes — touch placement on a real phone, priest-tap feel, portrait air-vs-sea legibility, AI route feasibility. Any red flag means simplifying before adding systems.

## Session 1 (2026-08-15): scaffold, build pipeline, deterministic map generator

**Tool(s):** Claude Code (agent wrote all code from the spec; no hand-coding)
**Commits:** `ddd8dea`..`949c777`

### Prompts and commits
| # | Prompt (summary) | Commit | Result |
|---|---|---|---|
| 1 | Set up repo, commit spec + rules + build log scaffold | `ddd8dea` | chore: initial spec and build log scaffold |
| 2 | Build pipeline (src -> single index.html), CONFIG block, seeded PRNG, wind field, map generator with the 11 validation invariants + headless node tests | `949c777` | feat: build pipeline, CONFIG, wind field, deterministic map generator |
| 3 | Game state, route pieces + sockets + placement legality, support BFS with island conduction, progressive collapse + reconnection, headless tests | `c670ec3` | feat: game state, route network, support graph, progressive collapse |
| 4 | Renderer (islands, temples, sea, wind tells), tap placement UI with wind-multiplier ghost, portrait camera framing, first screenshots | `2760056` | feat: renderer, portrait scene, tap placement UI, main loop |
| 5 | All remaining systems: economy/hauling/adrift/priest, structures/claim, combat, 9 waves + AI powers, Poseidon AI, fog, player powers, WebAudio, tutorial/banners/win-lose. Player-directed: scrollable multi-screen map (CONFIG-sized), exploration shroud, "TAKE THE WIND" CTA, GitHub Pages hosting | `5880a6e` | feat: full game systems |
| 6 | Opaque shroud boxes, lighting rebalance, LICENSE, Pages, repo metadata | `c64ae95` | fix: shroud boxes prevent edge peek; lighting rebalance |
| 7 | Playtest-feedback round (live play on Pages): island-coast sockets, ghost+RAISE flow for structures, ROTATE button, socket beacons + hints, toasts to top, intro lore carousel, combat tracers, wind-ripple sea, allegiance-tinted island bases, pinch zoom + two-finger rotate, opaque fog, whitecap respawn fix. Systems: AI objective blacklist fix (livelock), scaled influence radii, win-reachability invariant 12, real-input Playwright test, win-path test | `4fc2d22` | feat: playtest UX round |
| 8 | Great Temple HP bars + edge threat warning; influence lifts the shroud (player couldn't build into fog they were entitled to build in); Wave 5 signature sequence verified end-to-end by test; fillers get standard plots | `cc22221` | feat: temple bars, influence-lit shroud, wave-5 gate test |
| 9a | Drift lines, fog-scaling zoom, README refresh, corridor wind motes | `10e3365`..`e773868` | small feature commits |
| 10 | **Two more player-directed rules:** (a) Poseidon's craft operate only in waters his lane network reaches — he must build toward you to strike you, and cutting his lanes literally pushes his reach back; (b) roads ARE reach — route pieces and endpoint towers are no longer influence-gated, so you can drive corridors into his waters to lift fog and get guns onto his infrastructure. Island emplacements, temples-for-income and fog-lift stay influence-bound. Fallout fixed: both economies stopped saving for temples once the influence gate stopped acting as an accidental piggy-bank (AI temple fund + script fix); wave-5 test gives Poseidon his realistic lanes. Legibility: quarry pits + headframes on ore islands, hit-shudder no longer levitates structures (Y accumulated per frame), Phong water with bump-mapped ripples and swell | *(this commit)* | feat: lane-reach warfare, roads-are-reach, watery water |
| 11 | Small rounds pushed live: fog-scaling zoom `10e3365`, README `34f3468`, drift lines `e773868`, lane-reach + roads-are-reach + water `a168820`, opening economy + tap-identify + currency colors `02a15e1`, design intent `1e74659`, README 8 `d5d4048` | (hashes inline) | several |
| 13 | Compact top banners; Poseidon theatre to intro `e6d86f2`; spec coverage matrix `6c10075`; gauntlet test `bf81791` | (inline) | several |
| 14 | **Player-directed batch:** 3×3-screen world (18×30 — chain bridging rewritten as greedy arm-growth after 98% failures on diagonal gaps); persistent wind-streak layer scaled to water area; realistic water (depth-tinted shallows, coastline foam, Phong bump ripples); guns may cut any unsheltered lane while craft stay raw-end-only (felt asymmetry fixed); stranded balloons slip their moorings and drift after a grace period; Cross piece (4-way, 7 supply); weapon placement shows every legal site + range ring from the ghost, taps snap within 1.35 cells; power/tech buttons explain themselves | *(this commit)* | feat: wide world, watery water, armed symmetry |
| 15 | Wide-world batch shipped | `182c630` | feat: 3x3 world, persistent wind map, realistic water |
| 17 | Thumb-side pieces + floating confirm `3440fdb`; prong-classed hand, thumb reroll, gem mines, AI attack lanes + cooldown fix, 100/100 start `10fe49d` | (inline) | several |
| 19 | **Mining by connection (player-directed):** any island your supported network touches that is neutral or yours mines automatically and haulers collect from it; a rival's claim shuts the quarry to you — claiming SECURES ore rather than enabling it. Context menu gains a compact balance line (⚇ · ✦) at its top | *(this commit)* | feat: connection mines, claims secure |
| 20 | Mining-by-connection `1fdd22a`; topsafe HUD fix `0b458ef`; reserves 500–1500 + delivery ching `07dd0e3`; hauler cargo ×4 `9f6cdfb`; favor-priced roads `eb6838a` | (inline) | several |
| 23 | **Hauler capacity sweep** (`test/opt_capacity.js`, hot-air value with hydrogen locked at 2×): {6,12,24,48,96} → scores {89,**103**,97,101,86}. 12 produced the best single match of any sweep (nine waves survived at 108 HP, 46 kills, 5 reconnections, balanced reserves). 24+ floods supply (600–1500 unspent) now that reserves are 500–1500 and any connected island mines. **Set 12/24 — deliberately walking back half of the earlier ×4 directive on the data**; player may override | *(this commit)* | tune: hauler capacity 12/24, sweep-derived |
| 24 | **Fair-play audit + lane legibility (player report: "Poseidon draws random paths near my islands unconnected to his network"):** new permanent `test/test_fairplay.js` independently re-walks his segment graph from his Great Temple every 2 sim-s across 3 full matches — zero orphans ever kept alive; every cut lane dies on its collapse timer. The report was a *readability* failure: his trunk lanes ran through unexplored shroud, so tips materialised parentless at the fog edge. Fixes: enemy lanes now ghost one segment beyond live vision (paths visibly continue somewhere), tapping any lane names it and its state (his: "TRACES HOME TO HIS TEMPLES", cut: "FRAYING/UNBINDING"), and a once-ever line states the law when his lane first nears your holdings | *(this commit)* | fix: lane fog legibility + fairplay test |
| 22 | **Favor income sweep** (`test/opt_income.js`, `opt_income2.js`): divisor-only sweep showed lean income causes death-spirals (lose temples → can't afford roads → segsA collapses to 10); pairing a leaner territory rate with a fatter territory-free baseline fixes it. Pairs [8,4] and [16,6] tie at 92; chose **divisor 16 + baseline 6/10s** because actives end at 24–31 Favor (every power cast competes with roads — the tension we wanted) vs 100+ spare at [8,4]. The baseline drip is rebuild insurance | *(this commit)* | tune: favor income 16-divisor + 6 baseline, sweep-derived |
| 21 | **Favor price sweep** (`test/opt_favor.js`): prices 1/2/3/5 score identically (avg 90 across 3 seeds) because temple-influence Favor income floods the price; at 5 active players end at 0 Favor (powers become unaffordable — the sim can't see this since the script never casts); at 8 networks starve on 2 of 3 seeds. **Chose 3**: quality identical to 1, reserves halved, price felt, powers budget preserved. Flagged follow-up: Favor *income* (hundreds per match from temple influence) is the real oversupply lever | *(this commit)* | tune: piece price 3 favor, sweep-derived |
| 18 | **Toast discipline (player-directed):** every transient line (tutorial, banner, ticker, codex) is tap-to-dismiss; story/tutorial lines show once EVER via localStorage (skip marks them all seen); codex long-press slowed to ~1s so it stops firing accidentally | *(this commit)* | fix: dismissible, once-only story toasts |
| 16 | **Player-directed: location-first building.** The piece palette is gone as an interaction: gold markers glow on every actionable spot; tapping one opens a context menu at the thumb with the held pieces that fit there plus every valid building (all explained). The hand is a read-out strip; tap-twice discards. Real-input test rewritten for the new flow | *(this commit)* | feat: map-first context building |
| 12 | **Player-directed: Poseidon's units are lane-bound.** His craft ride his lane network exactly like his haulers, halt on the lane within weapon range (stationary attackers while engaged), and go adrift if the lane is cut beneath them. Craft HP raised (42/62/112) because single-file approaches are easier to shell; transports get a 2.2 assault reach inland. With this, the naive scripted player now survives all nine waves — pressure comes from his expansion, exactly as directed. Also: unique art per structure type (rust vane drum with spinning arms, navy zeppelin battery, bronze shield pylon), burning states on wounded structures, muzzle flares, flying embers, attack sounds (throttled), self-explanatory build menus with one-line descriptions | *(this commit)* | feat: lane-bound assaults, unique unit art, combat noise |
| 9 | **Rules change (player-directed): paths are invulnerable along their length.** Only raw open ends (uncapped tips) and structures can be attacked; a tower caps its tip; islands moor their ends. Symmetric for Poseidon's lanes. Networks now erode from open tips, and the collapse drama comes from *inline* structures exploding (routes continued through a tower's ports) — which is exactly the §14.0 shape. Wave-5 test updated to the inline-battery shape and passes. Tidal Surge keeps its mid-corridor bite as the one divine exception | *(this commit)* | feat: raw-end exposure rule |

**Wave 5 gate (spec Day-10 gate) — PASSED by automated test:** scripted heavies target the most forward player structure, its death explodes the outward segment, the branch frays, a rescue link relights everything. The test also caught that an undefended Great Temple dies to wave-5 transports before the drama even lands — which is the game working, but worth knowing for tuning.

**Session 1 addendum — design changes directed mid-build:**
- Map no longer fits one screen. World is sized in portrait-screen tiles (`MAP_SIZE`, default 2×3 → 12×30 cells) and the camera pans by dragging. Island count scales with area: stepping-stone "filler" islands grow automatically wherever the island-hop chain stretches beyond hop range, plus scattered neutrals per extra area. Spec distance invariants scale from the 12×20 reference.
- Exploration shroud added (deviation from spec §14B "terrain is never fogged", by explicit direction): unexplored terrain is dark until the player's reach lifts it, one-way. Enemy-entity fog stays as specced on top of it.
- Favor income tightened: only island Temples mint Favor from influence; the Great Temple's own radius doesn't (raw §14.5.4 made Favor meaningless at ~50/10 s).
- Repo made public with an all-rights-reserved license; live build hosted on GitHub Pages per direction. Contest zip releases only on instruction.

**Session 1 addendum 2 — first live playtest feedback (the player actually played the Pages build):**
- *"Confusing to place a sky channel"* → whole coastlines of conducting islands are now sockets (a channel terminal may start anywhere an island touches — also a rules change the player asked for directly), sockets got beacons and pulse, single-socket cases auto-preview, step-by-step hint toasts, and an explicit TURN button beside CONFIRM.
- *"Built a mooring yard, nothing seemed to happen"* → structures now use the same ghost-then-confirm rhythm as pieces (menu arms a translucent ghost; RAISE builds), scaffold ring moved to ground level, Great Temple mesh shrunk so plot structures stop hiding behind it.
- *"No attacking animations"* → tracer fire: gold falling ballast for Aeolus, teal rising jets for Poseidon, impact sparks, throttled per gun.
- *"Fog should be opaque"* → shroud boxes fully opaque. *"Wind animations pool at the edges"* → whitecaps live a few seconds and respawn at random water instead of wrapping (the sheared wind ran edge-parallel and herded them).
- *"Ripple the water with the wind"* → generated tileable swell texture on the sea, streamed along the live wind vector. *"Backstory on the intro"* → five-line lore carousel above TAKE THE WIND.
- Balance found by simulation: Poseidon AI had a planning livelock (fixated on unreachable islands scored by influence overlap — blacklist + hard influence gate fixed it); after the fix he snowballed, so siphon DPS 8→6, transport DPS 5→4, wave strength per temple 0.2→0.15. Influence radii now scale with map size (leapfrog broke on larger maps) and validator invariant 12 guarantees the territorial win path exists on every map.
- New standing rule: the build log is updated with every change and committed with every commit (the row for a commit still lands one commit later, since a commit cannot cite its own hash).

**What I built:** Development skeleton the spec asks for (§33F.1): game logic in `src/*.js`, `build.js` concatenates into one readable unminified `index.html` with the frozen `CONFIG` block first. Three.js r147 (UMD build, works from `file://`) vendored under `/vendor`. Wind field (6×10 vector field, bilinear, ±30° drift). Deterministic map generator: zone-constrained island growth, mirror-then-perturb for the economic corners, all 11 validator invariants from §20A.5, re-roll with verified golden-seed fallback. Headless node test harness runs the pure game logic without a browser: determinism, convergence (200/200 random seeds resolve without fallback), golden seed verified.

**Key decisions and why:**
- Three.js r147 UMD instead of newer ES-module builds: judges may open `index.html` from `file://`, where module imports fail CORS. A script tag always works.
- Wind is a cross-map **shear front** (bearing rotates with perpendicular offset from the player's outbound axis), not uniform wind or a gyre. A gyre made winds perpendicular to radial corridors (useless); a shear front guarantees the §21A.6 requirement that outbound and return corridors ride different bearings.
- Invariant 3 ("every efficient route crosses ≥5 over-water cells") is checked on the straight monotone route (always a shortest path, since nothing obstructs air routes), with invariant 4's 1.4× ratio pricing safety. A literal "every shortest path" reading was uncheckable cheaply and over-strict on a 12×20 grid.
- The "exposed" interior island is usually the **chokepoint**, not a Sacred island: on a Manhattan grid, an island reachable by a monotone island-hop chain can never make the safe route 1.4× longer, so the exposed role migrates to the centre island where the hop chain must detour. Deviation from §20.2 noted deliberately.

**Pivots, and what changed my thinking:** Superseded the "one handcrafted map" locked decision — the spec itself (§20A) supersedes it. First generator attempt (free zone packing) converged 0% — island separation (min distance 3), hop gaps (exactly 2 water cells), influence radius (supply fully inside 8) and home-to-interior distance (8–12) interact so tightly on 12×20 that random placement almost never satisfies all of them.

**Biggest problems, and how I solved them:** Generator convergence. Three fixes: (1) grow islands under a "forbidden" halo so separation holds by construction, only mirror the two corner pairs; (2) pull chain islands toward their neighbours — the separation halo stops growth at exactly a two-cell water gap, which is one island hop; (3) a deterministic bridging pass that extends a chain island by one lobe cell when the hop is misaligned (a 2-water hop needs straight alignment; Chebyshev-close but diagonal pairs have no hop). Went from 0% to ~18% per attempt = effectively 100% of seeds within the 50-nonce re-roll budget.

**What I learned:** Constraint-packing on a small grid needs constructive guarantees, not rejection sampling. Also: measure per-invariant failure counts before tuning anything — the first three "fixes" I guessed at were aimed at invariants that weren't the bottleneck.

**Where things stand / next:** Renderer + portrait scene (islands, sea, wind tells) so the Day-3 legibility gate can be tested; then route pieces + support/collapse.
