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

**Session 1 addendum — design changes directed mid-build:**
- Map no longer fits one screen. World is sized in portrait-screen tiles (`MAP_SIZE`, default 2×3 → 12×30 cells) and the camera pans by dragging. Island count scales with area: stepping-stone "filler" islands grow automatically wherever the island-hop chain stretches beyond hop range, plus scattered neutrals per extra area. Spec distance invariants scale from the 12×20 reference.
- Exploration shroud added (deviation from spec §14B "terrain is never fogged", by explicit direction): unexplored terrain is dark until the player's reach lifts it, one-way. Enemy-entity fog stays as specced on top of it.
- Favor income tightened: only island Temples mint Favor from influence; the Great Temple's own radius doesn't (raw §14.5.4 made Favor meaningless at ~50/10 s).
- Repo made public with an all-rights-reserved license; live build hosted on GitHub Pages per direction. Contest zip releases only on instruction.

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
