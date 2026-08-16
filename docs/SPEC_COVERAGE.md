# Spec Coverage — WINDWARD master spec → implementation

Status of every §43 submission-checklist item from `docs/WINDWARD_master_spec.md`,
with pointers to where each lives and every deliberate deviation. Deviations marked
**[player-directed]** were ordered during live playtesting and are logged in
`buildlog/BUILDLOG.md`.

**Legend:** ✅ done · 🔶 done with deviation · ⏳ pending (packaging/tuning window)

## Format & packaging
| Item | Status | Where |
|---|---|---|
| Tower Defense & Strategy, single-player, portrait, Three.js, fully offline | ✅ | whole build; no network calls anywhere; `vendor/three.min.js` only external file |
| Entrant code consolidated into readable unminified `index.html` | ✅ | `build.js` concatenates `src/*.js`; CONFIG block first |
| Three.js under `/vendor`, relative paths, all assets local | ✅ | all art is procedural geometry; all audio WebAudio-synthesised |
| Single zip ≤35 MB, `index.html` at root | ⏳ | produced only on instruction |
| Airplane-mode test | ⏳ | code audit clean (no fetch/XHR/CDN); formal test at packaging |
| Design Intent ≤500 words `.docx`, anonymous; Build Log `.md`; English | ✅ | `docs/design-intent.docx` (491 words, no metadata); `buildlog/BUILDLOG.md` |
| No identifying info in code/metadata/title | ✅ | title "WINDWARD"; comments clean (repo URL is not part of the submission zip) |

## Core systems
| Item | Status | Where |
|---|---|---|
| Route placement (hand of 3, five shapes, tap-socket-turn-confirm) | ✅ | `06_network.js`, `19_ui.js`; real-input Playwright test |
| Supported open endpoints stable; support graph to anchors | ✅ | `07_support.js`; `test_network.js` |
| Progressive collapse: 3 s rescue, one segment per 3 s from the severed edge | ✅ | `07_support.js`; ordered-collapse test |
| Reconnection cancels all decay instantly | ✅ | tests |
| Structure placement on endpoints and island plots; build times at half HP; pieces instant | ✅ | `10_structures.js` |
| Structures are nodes with ports; routes continue onward | ✅ | socket logic |
| Destroyed structure always breaks its outward adjacent segment | ✅ | `killStructure`; `test_wave5.js` |
| Supply + Favor; mining → stockpile → delivery credit; depletion | ✅ | `08_economy.js`, `09_haulers.js`; sim test |
| Favor from uncontested influence | 🔶 | island temples only mint Favor — the Great Temple's radius doesn't (raw rule made Favor meaningless at ~50/10 s) |
| Yards cap fleet; haulers purchased; opening not a dead start | 🔶 | hauler build time simplified to instant spawn; start supply tuned 12→32 [player-directed pacing] |
| Hydrogen unlock, fleet-wide, visible | ✅ | `buyHydrogen`; envelopes scale 1.3× |
| Hull integrity, regen, venting, adrift + rebound + drift line, both sides | ✅ | `09_haulers.js`, `18_render2.js` |
| Priest required for temples, one-tap travel, adrift, 25 s succession; Poseidon's priest identical | ✅ | `09_haulers.js`; `test_win.js` claims via priest |
| Temple claim crumbles rival connections; rival blocked; destroy → neutral | ✅ | `completeTempleClaim`; win-path test |
| Temple build visible, interruptible, audible | ✅ | scaffold ring, chant, priest presence gate |

## Combat & waves
| Item | Status | Where |
|---|---|---|
| Continuous combat, target priority, shields intercept 70% and pass friendly fire | ✅ | `11_combat.js` |
| Over-water rule (air) and lee-shore rule (sea) | ✅ | `makeSegment`, `enemySegments` |
| Corridors attackable | 🔶 | **[player-directed]** paths are invulnerable along their length; only raw open ends and structures can be hit — collapse drama moves to inline structures; Tidal Surge keeps mid-corridor bite |
| Bolt Battery damages sea network | 🔶 | within the raw-end rule (his lane tips + structures) |
| Nine authored waves, 8 s telegraph, banners, schedule fixed | ✅ | `12_waves.js`, `16_flow.js` |
| Waves from his nearest temple; strength scales with temples, floored | ✅ | `waveOrigin`, `waveStrength` |
| Poseidon's craft | 🔶 | **[player-directed]** lane-bound: they ride his network, halt in weapon range, go adrift when cut; HP retuned for single-file approaches |
| Wave 5 signature sequence reliable | ✅ | `test_wave5.js` end-to-end |
| Tidal Surge (W6), Fog Bank (W7), Age of Wrath (W8) | ✅ | `12_waves.js` |
| Tailwind, Wind Wall | 🔶 | Wind Wall aimed at an endpoint ✅; Tailwind fleet-wide rather than per-branch (phone UX simplification) |
| Three-mast gauntlet kills, gapped pair doesn't; Tailwind halves exposure | ⏳ | mechanics in place (regen gap math); dedicated tuning check pending |

## Territory, fog, AI, map
| Item | Status | Where |
|---|---|---|
| Influence gates construction | 🔶 | **[player-directed]** roads are reach: route pieces + endpoint towers exempt; island emplacements, temples and income stay influence-bound |
| Overlap buildable by both, Favor to neither | ✅ | `refreshInfluence`, economy |
| Fog: enemy craft need live vision; structures/lanes remembered; terrain never fogged | 🔶 | as specced, **plus** a player-directed exploration shroud lifted permanently by reach/influence |
| AI obeys the same vision rules | ✅ | `canSee` gates all targeting |
| Poseidon builds visibly, prefers sheltered lanes, reroutes after cuts with 20 s cooldown, contests influence with temples, raises masts | ✅ | `13_ai.js` (open-channel racing preference simplified into Dijkstra weights) |
| Deterministic seeded map, displayed + enterable, validated with re-roll + golden seed | ✅ | `04_mapgen.js`; `test_mapgen.js` (200/200 seeds) |
| All validation invariants | ✅ | 11 spec invariants + #12 (win-path reachability) added; distances scale with map size |
| Map size | 🔶 | **[player-directed]** world sized in portrait screens (`MAP_SIZE`, default 2×3 = 12×30); island count scales via stepping-stone fillers; spec's 12×20 remains the reference for scaling |
| Wind: strong on air, slight on sea, ±30° drift, visible tells, circuit out-earns spur | ✅ | shear-front field; whitecaps/trees/smoke/motes/ghost multiplier; validator invariant 6 |
| Win / lose / reset; capture achievable in ~7 min | 🔶 | win/lose/reset ✅ and win-path mechanically verified; human-pace timing still being tuned from playtests |
| Tutorial skippable; first-sever line; codex long-press | ✅ | `16_flow.js` |
| Dev tuning panel (§33F.3) | ⏳ | deferred: CONFIG is frozen (spec's stronger rule); tuning done via src + headless tests instead |

## Repository & process
- Repo established private as directed, then **made public by explicit direction** to host the live build on GitHub Pages (all-rights-reserved license added). Contest zip only on instruction.
- Build log updated with every commit (rows lag one commit so they can cite real hashes, per `BUILDLOG_INSTRUCTIONS.md` §1).
- README carries a feature log with portrait-phone screenshots for each feature.
