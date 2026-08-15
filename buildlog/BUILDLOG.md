# Build Log: WINDWARD — Archipelago of the Gods

Genre: Tower Defense & Strategy

---

## Decisions locked so far

*Keep this list current. Re-read it at the start of every session. When a decision changes, edit it here AND note the change in that session's entry.*

### Scope
- Two factions only: Aeolus (player, air) and Poseidon (AI, sea). Gaia and Zeus are future state.
- One handcrafted 12 × 20 portrait map, nine islands, corner opposition. No procedural generation.
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

## Session 0 (YYYY-MM-DD): setup

**Tool(s):** —
**Commits:** —

**What I built:** Repository initialised, spec finalised, build log started.

**Key decisions and why:** Locked the decisions above before writing code, so the agent has a stable reference and stops re-litigating settled choices between sessions.

**Where things stand / next:** Day 1–2 spikes — touch placement on a real phone, priest-tap feel, portrait air-vs-sea legibility, AI route feasibility. Any red flag means simplifying before adding systems.
