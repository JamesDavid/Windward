# WINDWARD
## Archipelago of the Gods — Competition Prototype Master Spec

> *To be windward is to hold the weather gage — the decisive positional advantage in age-of-sail combat. The title names the game's central mechanic: alignment with the wind is speed, income, and survival.*

**Purpose:** Single source of truth for Codex or another coding agent.  
**Scope:** Three-week competition prototype, not the full future game.

---

# 0. Build Goal

Build one polished, genuinely playable core experience:

> **The player assembles a living logistics network from modular route pieces, caps exposed ends with defenses, survives escalating Poseidon attack waves, watches severed infrastructure physically unravel, and races to reconnect it before the branch collapses.**

Everything in this document exists to support that experience.

If a feature does not make **building, defending, severing, reconnecting, or capturing through the network** more interesting within the three-week build, cut it.

---

# 1. Competition Constraints

**Genre:** Tower Defense & Strategy  
**Format:** Portrait mobile web  
**Technology:** Three.js / HTML5  
**Mode:** Single-player vs AI  
**Runtime:** Fully offline; no external network requests  
**Target session:** ~7 minutes  
**Prototype match:** 9 waves

Submission constraints:

- Single `.zip`, maximum 35 MB
- `index.html` at ZIP root
- All entrant-authored game code consolidated into `index.html`
- Code readable and unminified
- Three.js and third-party libraries stored under `/vendor`
- All assets/fonts/audio/data local and referenced relatively
- No CDN or runtime external requests
- Explicit primary action
- Economy
- Defensive systems
- Escalation
- Real-time feedback
- Win state
- Lose state
- Reset state
- Anonymous Design Intent `.docx`, ≤500 words
- Build Log `.md`
- All submission text in English

---

# 2. Judge Pitch

> **You are the high priest of Aeolus. Your guild solved lift; your devotion won the rest — the currents aloft now carry your ships where you ask, because your god grants them. Poseidon takes this as the injury it is: every cargo that flies is a crossing that never asked him for calm water, and never thanked him for it after. Build circuits of bound wind into a working logistics network, raise shrines that spread Aeolus' influence across the archipelago and force Poseidon's back off it, and hold your roads together while his priesthood tears them open.**

Shorter form, if a single line is needed:

> **Serve the god of the air, build your empire on the currents he grants you, and push his influence across an archipelago whose sea god is passed over.**

The four beats a judge should take from it, in order:

1. **Alignment, not defiance.** Two faithful priesthoods, each serving its own god. The player has aligned with the air; Poseidon's own priesthood opposes them. Favor is standing with a patron, earned — not a mana bar, and never a god outwitted.
2. **The grievance is honour, not coin.** No one ever handed Poseidon money. What every crossing owed him was *timē* — the due portion: a sacrifice before sailing, a thank-offering for surviving. A wind corridor is the first road that gives him no occasion to be worshipped at all. **He is being forgotten, and he can feel it.**
3. **Circuits and influence.** Outbound on the prevailing wind, home on a different bearing (§21A.3). Temples project influence and cancel where they overlap, so ground is held by pushing his influence back, not merely by connecting to it (§14.5).
4. **Fragility.** Cut a circuit and the road unravels, the cargo strands, and the ships go adrift on the very wind that carried them (§33G).

**Genre gloss.** The pitch above is read by judges scoring against a Tower Defense & Strategy rubric (JR-1C), so it must be followed immediately by one plain line naming the play:

> The player places route pieces to grow a logistics circuit, mounts guns and shields on it, holds contested ground against escalating waves, and reconnects the network under fire when it breaks.

Never ship the fiction without that line.

Future-state pitch:

> Rival priesthoods build competing logistics networks across sky, sea, land, and the underworld — the lots the gods drew between them — while Zeus's weather falls on all of it, and the way those networks physically intersect determines control of a mythological Greek archipelago.

The prototype implements only:

- **Aeolus / Air**
- **Poseidon / Sea**
- one map template, deterministically generated per match (§20A)

Gaia/Earth, Hades/Underworld, and Zeus-as-weather remain future-state (§39).

---

# 3. Core Player Fantasy

You are the **Windwright** — high priest of Aeolus, master of the shipwright guild that learned to fly.

You are **not** the god. This matters:

- Aeolus speaks to the player in the imperative throughout onboarding (§23). A god issuing orders requires a mortal to receive them.
- The lose condition is the capture of your Temple. A god cannot be captured; a temple can.
- The guild solved **lift** themselves, in a foundry (§4). They did not solve **motion** — the winds are Aeolus' to grant, and he grants them to a priesthood that serves him. This is alignment, not a transaction and not defiance.
- Favor is therefore not a mana bar. It is accumulated standing with a god who must be **petitioned**.
- Placing individual route pieces and emplacements is a craftsman's work, not a deity's.

Poseidon's side is likewise commanded by his own high priest, equally devout. **Neither priesthood has forsaken its god.** The war is between two faithful orders serving rival patrons — not between clever mortals and the divine.

Nothing in the fiction should imply that the guild outgrew, outwitted, or worked around Aeolus. They earned him.

Mortals have learned to create hydrogen and use it to lift linen-and-bronze airships, but lift alone does not provide controlled travel.

> **Hydrogen is lift. Bound wind is motion.**

A gas bag may float anywhere, but it can only deliberately travel where Aeolus has bound the wind into a corridor.

The player therefore does not merely command airships.

The player **builds the roads of the sky**.

Poseidon controls the sea below. Air routes are the first transportation network between these islands that does not require his water — and therefore the first that never asks him for anything.

This is not about money. No Greek god was ever paid. What a crossing owed Poseidon was **honour**: a sacrifice before sailing, a thank-offering for having survived, a harbour that stayed open because someone remembered to ask. That is what a god lives on.

He has not been robbed of anything he owned.

> **He is being passed over — flown above, and left out of the offerings.**

That is his grievance, and it is not wounded pride. His priesthood is devout and his altars are tended; it is his **congregation** that is evaporating. Sailors who no longer need calm water no longer think of him at all. A god without worshippers is not insulted. He is diminished.

His priests can see it happening. That is why they fight.

---

# 4. Canonical Lore

## 4.1 The Opened Bag

Aeolus once gave Odysseus the winds tied inside a leather askos.

Within sight of home, Odysseus slept. His crew opened the bag, believing it contained treasure.

The winds escaped.

In this world, they never fully returned.

For generations they have tangled around the archipelago, snagging on headlands and rushing unpredictably through the straits.

Those escaped winds are the winds the player binds.

## 4.2 The Foundry

Lift was not given, and it was not stolen. It was **worked out**.

Iron filings and sour wine, sealed in a bronze retort, give off a light, biting air that will not stay down. The shipwrights found it in a foundry. No god was consulted, because none was needed — this is metallurgy, not theology.

**But lift is not travel.** A full envelope rises and then goes wherever the sky is going. To steer, a crew must find a wind and bind it, and the only winds loose in this archipelago are Aeolus' escaped ones (§4.1).

So the guild did what mortals do: they **took a patron**. They built him shrines, kept his rites, and earned his favour, and in return the currents aloft carry their ships where they ask.

> **This is alignment, not defiance. The guild serves Aeolus. Aeolus grants the winds. Neither has outwitted the other.**

## 4.2.1 Poseidon's grievance

**This is not about money.** No Greek god was ever paid. There are no tolls in this world, no harbour dues, no ransom, and nothing Poseidon is owed in coin.

What every sea crossing gave him was **honour** — *timē*, the due portion. A sacrifice before sailing. A thank-offering for having survived. A harbour that stayed open because someone remembered to ask. Gods live on being needed and being thanked for it.

A wind corridor is the first road between these islands that gives him **no occasion to be worshipped at all**. It doesn't cheat him. It doesn't even acknowledge him.

| God | Grievance | Role |
|---|---|---|
| **Poseidon** | He is **passed over** — flown above, and left out of the offerings. His priesthood is devout and his altars are tended; it is his *congregation* that is evaporating. Sailors who never touch his water never think of him. A god without worshippers is not insulted. He is diminished, and his priests can watch it happening. | prototype antagonist |
| **Gaia** | Every envelope costs iron. Her islands are dug and terraced to pay for a sky she has no part in. | future faction (§39.1) |
| **Hades** | Wealth pulled from under the islands was always his portion. Now it rises past him and is thanked to someone else. | future faction (§39.2) |
| **Zeus** | Mortals in his sky, in envelopes of something that burns. Icarus with a supply chain. He does not build; he answers with weather. | future environment (§39.3) |
| **Hephaestus** | The retorts and bronze ribs are forge-craft — his craft, spent on leaving the ground. Offended, or quietly complicit. | flavour only |

**The lots explain the roster.** Zeus took the sky, Poseidon the sea, Hades the underworld, and earth was left common ground (§39.2). Aeolus holds no lot at all — he was granted the winds, which is why a minor power is worth a mortal guild's devotion, and why Zeus tolerates traffic in his sky only so long as it stays humble.

**Why Aeolus fights.** He gains a priesthood that carries his name across an archipelago where he was previously a minor power — a keeper of a bag, a footnote in someone else's voyage. Poseidon's sea was the whole world here. Now it isn't. If Poseidon's priests win, Aeolus goes back to being a footnote.

*Historical note for tone: the iron-filings-and-acid route is the period-accurate one — Charles filled the first hydrogen balloon that way in 1783. Electrolysis is its industrial successor and belongs to a later age. This world uses the first.*

## 4.3 The Airships

The first airships are converted triremes.

The same shipyards, guilds, joinery, bronze fittings, and hull-building traditions are adapted for the air:

- hull becomes gondola
- oars become control surfaces
- sail becomes gas envelope
- bronze ribs hold linen aloft

The resulting craft should visually feel like:

> **an ancient Greek ship inverted, lightened, and lifted into the sky.**

Mooring yards smell of vinegar and hot iron.

No one strikes a spark.

## 4.4 Why Wind Corridors Unravel

A wind corridor is not a permanent physical road.

It is a **tamed wind continuously renewed from Aeolus's Temple**.

As long as the corridor remains supported, the binding holds.

When the network is cut, the disconnected wind remembers that it was free.

It begins unbinding backward from the severed edge.

This is the diegetic explanation for progressive network collapse.

The ships do not fall when the route disappears.

They simply lose the ability to travel deliberately.

---

# 5. Core Design Principle

> **The network is the army.**

The player does not micromanage conventional RTS units.

The player constructs the infrastructure through which:

- resources move
- assault forces move
- defenses receive support
- captured islands contribute
- territorial power is projected

Once constructed, most of the system operates automatically.

The player's main verbs are:

# CONNECT  
# FORTIFY  
# RECONNECT  
# CAPTURE

The opponent attacks the network itself.

---

# 6. Core Match Loop

```text
Draw 3 route pieces
        ↓
Extend the wind network
        ↓
Reach and capture an island
        ↓
Connected islands produce Supply / Favor
        ↓
Continue the route or cap an endpoint with a defense
        ↓
POSEIDON'S WAVE ARRIVES
        ↓
Defenses fight automatically
        ↓
A route or structure may be destroyed
        ↓
Unsupported branch begins to unravel
        ↓
Reconnect before collapse reaches something valuable
        ↓
Spend Favor / expand toward Poseidon's Temple
```

Repeat with increasing pressure for nine waves.

---

# 7. The Three Systems That Must Work

Everything else is secondary.

## 7.1 Modular Route Placement

The repeated primary action.

The twentieth placement must still feel good.

## 7.2 Support and Progressive Collapse

Every segment must trace back to a valid anchor.

Sever it and the orphaned branch visibly unravels from the break inward.

This is the prototype's defining mechanic.

## 7.3 Escalating Waves

Nine literal, numbered, telegraphed Poseidon assaults guarantee that the support/collapse system is repeatedly tested.

The prototype must not rely on emergent AI behavior to accidentally generate its best moments.

---

# 8. Route Piece System

The player always holds **three pieces**.

Prototype shapes:

| Piece | Supply Cost |
|---|---:|
| Short Straight | 2 |
| Long Straight | 3 |
| L-Turn | 3 |
| S-Bend | 3 |
| T-Junction | 5 |

Future-state pieces such as Cross, Fork, faction-specific shapes, or special pieces are cut.

One unwanted piece may be discarded for **1 Favor**.

## 8.1 Placement UX

Do not require precision dragging on a portrait phone.

Interaction:

```text
Tap a piece in hand
    ↓
Valid connection sockets illuminate
    ↓
Tap desired socket
    ↓
Piece previews in first legal orientation
    ↓
Tap preview to cycle legal orientations
    ↓
Tap CONFIRM
```

Cancel by tapping elsewhere.

This interaction must be tested on a real portrait phone immediately.

---

# 9. Grid and Connectivity

The world uses an invisible square grid.

Organic rendering hides the grid.

The route graph is mechanically discrete and data-driven.

Every active segment must trace to an **Anchor**.

Prototype anchors:

- Aeolus Temple
- connected controlled islands

Network states:

| State | Meaning | Presentation |
|---|---|---|
| **SUPPORTED** | Connected to an anchor | full brightness, traffic moving |
| **FRAYED** | Just lost support | desaturating, traffic stopped, timer |
| **COLLAPSING** | decay has reached segment | wind visibly unraveling |
| **GONE** | destroyed | removed |

## Important Rule

A **supported open endpoint is stable**.

It does not decay merely because the player has not extended or capped it.

Open ends are tactically vulnerable.

Progressive collapse begins only when **network support is lost**.

---

# 10. Progressive Collapse

When a branch loses support:

- **0 sec:** connection severed
- **0–3 sec:** FRAYED rescue warning
- **3 sec:** first unsupported segment begins collapsing
- **every ~3 sec thereafter:** collapse advances one segment inward

Timing should err on the generous side.

A long branch should give the player enough time to understand the problem and improvise a rescue path.

If the player reconnects any surviving portion of the branch to a supported route:

# NETWORK RESTORED

Immediately:

- decay stops
- surviving segments relight
- traffic resumes
- connected islands reactivate
- supported defenses resume operation

The desired emotional response is:

> **“I can still save this.”**

---

# 11. Economy

Exactly two resources.

## 11.1 Supply

Used for:

- route pieces
- structures
- limited repairs if needed

Produced by connected Supply islands.

## 11.2 Favor

Used for:

- divine powers
- piece rerolls

Produced by influence held (§14.5.4): 1 Favor per 10 s per 4 uncontested cells covered by a supported Temple.

## 11.3 Ownership Is Not Logistics

A disconnected island remains owned.

It contributes nothing while disconnected.

A disconnected Temple projects no influence and generates no Favor (§14.5.5).

A disconnected Supply island contributes no usable Supply.

This distinction is fundamental:

> **Territory without infrastructure is strategically useless.**

## Explicit Prototype Cuts

Do not implement:

- throughput
- capacity
- congestion
- saturation
- detailed transport accounting
- complex inventories
- production chains

Binary connection already carries the network-as-army concept.

---

# 12. Visible Logistics

Connected networks visibly live.

Small Aeolus airships travel wind corridors between controlled islands.

They visually represent:

- Supply
- reinforcements
- influence

Internal simulation may remain abstract.

The visual rule is simple:

> **Moving traffic = functioning network.**

> **Stopped traffic = something is wrong.**

---

# 13. Island Claim

*Full rules in §14.6; this is the summary.*

## 13.1 Temple-less Islands

**Any side may connect to an island with no Temple on it.** Both networks can touch the same island at once — neutral ground is genuinely open, and the first to consecrate takes it.

Send the priest along a supported route and found a Temple (10 s, priest present throughout, §14.8.1).

On completion:

# ISLAND CLAIMED

The island:

- changes allegiance
- becomes an anchor
- projects influence radius 5, extending buildable territory
- opens its plots for building
- begins mining into a local stockpile for collection (§33D)
- **crumbles every opposing connection to it**, from the island inward

## 13.2 Claimed Islands

An island with a standing Temple is closed. A rival cannot connect to it at all — placements are refused at its ports — until that Temple is destroyed.

Destroying it returns the island to neutral, open to whoever consecrates first.

There is no suppression, no garrison, no assault meter. The only way to take ground is to knock down the building and put up your own.

## 13.3 Why severing still matters most

A Temple goes dark the moment its route home is cut (§14.5.5): no influence, no Favor, and the territory it was holding open collapses back. An opponent who loses a corridor can lose the ability to build across a whole region without a single structure being destroyed.

> **Cutting the route can matter more than knocking down the building.**

---

# 13A. Offence and the Win Path

The loss condition in this document is specified across nine waves. The win condition is one sentence. This section closes that gap.

## 13A.1 The player never builds units

There are no assault units to construct, select, or command, and no assault pressure. **The player takes ground by founding Temples (§14.6) and removes the enemy's by shooting their structures.** Haulers and the priest travel the corridors; neither fights.

This keeps the primary action singular — the player only ever places pieces and structures.

## 13A.2 Capture — see §14.6

**The garrison and suppression model is removed.** Islands are claimed by building a Temple on them, and taken from an enemy by destroying theirs. There is no assault meter and no capture timer.

All offence in the game is directed at **structures and segments**, never at islands: guns damage enemy Temples, and a destroyed Temple returns its island to neutral.

## 13A.3 The player's offensive verb

Without this, the player has no way to attack Poseidon's network and §42's final learning beat is impossible.

> **A Bolt Battery in range of a hostile sea segment damages that segment, not only the craft travelling it.**

Poseidon's network obeys the same support and collapse rules as the player's. Cutting a Poseidon corridor near its source orphans everything beyond it and it unravels exactly as the player's does. This is the moment the game teaches its own thesis back to the player.

## 13A.4 Reaching the Great Temple

Winning requires reducing Poseidon's Great Temple to 0 HP. Since influence gates construction (§14.5.2), this means the player must first **push their influence all the way to his corner** — a chain of captured islands and Temples — before a gun can even be built within reach of it.

| Value | Starting number |
|---|---:|
| Great Temple HP | 200 |
| Sustained fire from one directional gun | 16 DPS |
| Time to fell it with one gun | ~13 s |
| Time with two | ~7 s |

The wall is not the HP. It is the **territorial approach**: the player must hold enough influence near his corner to place a gun there at all, and Poseidon's own Temples are pushing back the whole way.

Poseidon's Great Temple is defended by two authored structures, so the final approach is contested rather than a walk-in.

A player whose influence reaches his corner by Wave 7 can finish before Wave 9. Arriving during Wave 8 means racing the Age of Wrath, which is the intended drama.

---

# 14. Structures

A structure may be built in two places: on an **exposed supported endpoint** of the network, or on an authored **plot** of a controlled island (§14.4). There is no free placement — defensive power must be grown to.

## 14.0 Structures Are Network Nodes, Not Caps

**Supersedes the earlier "structure caps the network" model.**

A structure placed on an endpoint does not terminate the branch. It becomes a **node with outgoing ports**, and route pieces — or further structures — may be built onward from it.

| Structure | Outgoing ports |
|---|---:|
| Radial gun | 1 |
| Directional gun | 1 |
| Shield | 2 |
| Influence altar | 0 (island plots only) |

Three consequences, all intended:

1. **The cap-or-continue dilemma disappears.** The player never has to choose between defending here and expanding past here.
2. **Structures become inline.** A gun mid-branch means destroying it severs everything beyond it — which makes §33A.5 (explosion destroys one adjacent segment) dramatically more consequential and strengthens the Wave 5 sequence.
3. **Chaining structures as roads is uneconomical.** Structures cost 8–12 against 2–5 for route pieces, so building a wall of towers instead of a corridor is a losing trade. No extra rule is needed to prevent it.

When an inline structure explodes, the segment destroyed is the one on its **outward** side — away from the anchor. This is deterministic and must not be randomised.

## 14.1 Radial Gun — *Chain Vane* / *Churn Drum*

Short range, all targets in radius, low damage each.

Belongs at chokepoints and over crossings where craft bunch up. Weak against anything approaching alone.

## 14.2 Directional Gun — *Bolt Battery* / *Siphon Lance*

Long range, single target, high damage, fires along a facing arc.

Rotates to track, but slowly. Its reach is what makes it worth protecting — and its need for a clear line of fire is what makes the shield meaningful.

Both guns damage **craft and enemy route segments** alike (§13A.3).

## 14.3 Shield — *Aegis Screen* / *Bulwark Raft*

**Yes — this replaces the old Fortress Head, which was a passive self-buff and not a shield at all.**

A shield does not merely harden itself. While it stands, it **intercepts incoming damage aimed at friendly structures and segments behind it** within its facing arc, and it is **transparent to friendly fire** — a directional gun placed behind a shield fires straight through.

This is the spatial idiom the design was missing: a long-range gun is fragile and precious, and the correct answer is to build a shield in front of it and keep firing over it.

Shields have two outgoing ports because they are meant to sit inline.

## 14.5 Sensing — Removed as a Structure Type

**The dedicated Watch Beacon is cut.** It was the weakest slot on the roster and a whole structure spent on information.

Instead: **every structure is a sensor.** All guns, shields, and altars clear fog within their own radius, so pushing the network outward is what buys vision. See §14B.

Roster count is unchanged — four types before, four types now.

---

# 14A. Unit and Structure Roster

**Every role exists on both sides.** The two factions differ only in tuning and in the physical form the role takes — never in which roles they have. One implementation per row, two meshes and two number sets.

This is what makes the design buildable in three weeks: nine roles, not eighteen systems.

## 14A.1 Master roster

| Role | Aeolus (air) | Poseidon (sea) | Notes |
|---|---|---|---|
| Route segment | Wind corridor | Current lane | Both HP 40 |
| Hauler, tier 1 | Hot-air askos | Coastal hoy | Capacity 6 |
| Hauler, tier 2 | Hydrogen askos | Deep-water trireme | Capacity 12 |
| Structure chassis | **Tethered balloon** | **Moored barge** | Physical form all structures take |
| Radial gun | Chain Vane | Churn Drum | Short range, hits all in radius |
| Directional gun | Bolt Battery | Siphon Lance | Long range, single target, arc |
| Shield | Aegis Screen | Bulwark Raft | Intercepts for what is behind it |
| Influence / claim | Temple | Temple | Claims the island, projects influence |
| Sensor | *(every structure)* | *(every structure)* | Cut as a type — see §14B |
| Assault craft | *(automatic pressure)* | Light transport | See §14A.3 |
| Network attacker | *(via endpoint tower)* | Siphon craft | Attacks the enemy road |
| Heavy striker | *(none in prototype)* | Heavy strike craft | Wave 5+ |

## 14A.2 Endpoint towers

The endpoint tower is the signature structure of the whole design — a weapon that can only exist because a road reached that spot, and that dies when the road does.

**Tethered balloon (Aeolus)** — a captive envelope moored to the corridor, crew working from a slung gondola. Bobs visibly in the wind; leans harder as the field drifts.

**Moored barge (Poseidon)** — a flat anchored hull on a current lane, riding the swell.

These are **chassis**, not weapons. Every Aeolus structure is a tethered balloon carrying something; every Poseidon structure is a moored barge carrying something. One mesh per side, four payloads.

| | Aeolus | Poseidon |
|---|---|---|
| Radial gun | Chain Vane — 45 HP, 6 DPS, radius 2 | Churn Drum — 60 HP, 5 DPS, radius 2 |
| Directional gun | Bolt Battery — 50 HP, 16 DPS, range 6, 90° arc | Siphon Lance — 70 HP, 13 DPS, range 6, 90° arc |
| Shield | Aegis Screen — 130 HP, intercept 70 % | Bulwark Raft — 160 HP, intercept 70 % |
| Temple | 100 HP, radius 5 | 100 HP, radius 5 |

Aeolus is consistently glassier and hits harder; Poseidon absorbs more. That single axis is the entire faction difference across the whole roster, and it is enough.

## 14A.3 Two deliberate asymmetries

Symmetry of roles does not mean symmetry of play. Two roles are filled differently on purpose:

**The player has no commandable assault craft.** Ground is taken by founding a Temple, which is an act of construction rather than combat (§14.6). Poseidon uses visible light transports because he is the wave-sender and his attacks must be countable and killable. Same role — taking ground — different expression: his is an entity arriving, the player's is a building going up.

**The player's network attacker is the endpoint tower itself.** A tethered balloon damages sea segments in range (§13A.3). Poseidon needs a mobile version — siphon craft — because he must reach corridors the player builds anywhere on the map.

These are the only two places where the roster is not one-for-one, and both exist because Poseidon attacks on a wave schedule while the player attacks continuously from fixed positions.

## 14A.4 Temples and the contested middle

Both sides use the same Temple (§14.5.1) — same cost, HP, radius, and 10 s build with a priest present. There is no faction difference at this slot, because the claim rule (§14.6) must read identically from both sides or it becomes unteachable.

**AI rule:** Poseidon prioritises founding a Temple on any controlled island whose influence radius would overlap the player's, above building a second gun there. He is buying cancellation and buildable ground, not Favor.

---

# 14B. Fog and Vision

**Reverses the earlier "no fog of war" cut.** Fog now exists, but in a restricted form chosen to protect portrait legibility, which already carries a wind field, influence radii, over-water flags, and two network layers.

## 14B.1 What is and is not hidden

| Always visible | Requires vision |
|---|---|
| Islands, coastlines, terrain | Enemy craft |
| The wind field and its tells | Enemy route segments |
| Own network, own structures | Enemy structures |
| Island ownership | Enemy stockpiles and reserves |

Terrain is never fogged. The map is nine authored islands on a portrait screen; hiding geography helps nobody and costs readability.

## 14B.2 Memory, not re-fogging

Once seen, enemy **structures and segments remain drawn**, dimmed, at their last known state. Enemy **craft** require live vision and vanish when it is lost.

This preserves the pleasure of watching Poseidon's network grow and unravel — which is one of the most readable things on screen — while still making his wave approach something the player must earn sight of.

## 14B.3 Vision sources

| Source | Radius |
|---|---:|
| Any structure | 6 |
| Temple | 8 |
| Own haulers in transit | 4 |
| Own route segments | 2 |

Corridors therefore see a little way around themselves, and pushing forward is what buys warning. The old Watch Beacon's function is now a property of everything.

## 14B.4 Interaction with the telegraph

The 8-second wave telegraph (§16) still fires regardless of vision — it is a UI promise, not a scouting reward. What vision buys is **which approach** and **what composition**, not whether a wave is coming.

An unscouted player knows a wave is coming and not where. A player with forward structures sees it forming.

## 14B.5 The AI does not cheat

Poseidon obeys the same vision rules. He cannot target segments he has not seen. This matters: a corridor routed wide of his network is genuinely safer, which rewards the island-hopping alternative of §20.3 for a second reason.

---

# 14.4 Two Placement Contexts

Defenses may be built in **two** places. Same catalogue of three structures, different siting rules.

## 14.4.1 Endpoint structure

Placed on a raw supported network endpoint — anywhere the corridor reaches, including out over open water.

## 14.4.2 Island emplacement

Placed on a bare authored plot on a **controlled** island. The catalogue here is radial gun, directional gun, shield, **Temple** (§14.5) and **Mooring Yard** (§14.7.4).

| | Endpoint structure | Island emplacement |
|---|---|---|
| Placed on | raw supported network end | bare plot on a controlled island |
| Reach | wherever the network goes, including over water | fixed — plots are inland |
| Exposed to siphon fire and Tidal Surge | **yes** | **no** (§33B.1) |
| On destruction | explodes, destroys adjacent segment (§33A.5) | dies quietly, network unharmed |
| Count | unlimited if the player can afford the road | **2 per island, 3 on the Temple** |
| Supply cost | as §33A.3 | identical |

**Balancing is geometric, not statistical.** Range values are identical. An island plot simply sits farther from the water than a corridor end hanging out over a strait, so it cannot cover the crossings where transports actually pass. The map does the work; no special-casing in code.

## 14.4.3 The anchor invariant

> **Nothing fires without a supported connection — in either context.**

A controlled island stops being an anchor the moment its route to the Temple is cut. Every emplacement on it goes dark: no firing, no repair, no warning radius, until the connection is restored.

This is the single most important rule on this page. If disconnected islands keep shooting, severing stops mattering and the design silently degrades into an RTS with decorative roads.

## 14.4.4 Turtling

The obvious exploit is to capture three islands, stack six emplacements, and never build a forward branch — never triggering Wave 5 and never seeing the game's centerpiece.

The existing design already answers this, and the answer must not be "fixed" away:

- **Victory requires extending a supported corridor to Poseidon's Temple** (§13A.4). Turtling cannot win. It can only fail to lose.
- **The Age of Wrath (Wave 8)** makes failing-to-lose stop working.

Authoring requirement: island plots are placed **inland**, never on a shoreline that overlooks a main crossing (§20.1).

---

# 14.5 Temples, Influence, and Territory

**Supersedes the Shrine/Sea Altar model.** Influence is no longer only an income source. It is **where you are allowed to build**, which makes it the primary territorial resource in the game.

## 14.5.1 Two kinds of temple

| | Great Temple | Temple |
|---|---|---|
| Count | one per side, authored | built on any island plot |
| Role | home, ultimate objective | claims the island it stands on |
| Influence radius | 8 | 5 |
| HP | 200 | 100 |
| Cost | — | 14 Supply |
| Build time | — | 10 s |

Aeolus builds **wind temples** (open colonnades, banners streaming); Poseidon builds **tide temples** (low, sea-facing, salt-stained). One implementation, two meshes.

## 14.5.2 Influence gates construction

> **Nothing may be built on a cell you hold no influence over — no route piece, no structure, no temple.**

Expansion is therefore a leapfrog:

```text
Great Temple projects influence (radius 8)
        ↓
build route pieces within it, reach an island
        ↓
build a Temple on that island
        ↓
its radius 5 extends buildable territory outward
        ↓
reach the next island
```

**Authoring requirement:** the player's corner cluster must fall inside the Great Temple's starting radius, or the first thirty seconds are a dead start (§20).

## 14.5.3 Overlap is contested, and buildable by both

Where friendly and hostile influence overlap:

- **both sides may build there** — this is the warzone, and construction is how it is fought over
- **neither side earns Favor** from the contested cells

Contested ground therefore costs income and is exactly where the fight must happen. A player who wants Favor pushes the enemy's influence back rather than merely overlapping it.

## 14.5.4 Favor

Favor accrues at **1 per 10 s per 4 uncontested cells** of influence held. Unchanged from the previous model; only the contest rule now also gates building.

## 14.5.5 Anchor invariant applies

A disconnected island's Temple goes dark like every other structure (§14.4.3): no influence projected, no Favor, and territory it was holding open collapses back. Cutting a route can therefore strip an opponent's ability to build in a whole region without destroying a single structure.

---

# 14.6 Island Claim and the Temple Rule

**Supersedes the Garrison/suppression capture model of §13A.2.**

## 14.6.1 The rules

1. **Any side may connect to an island with no Temple on it.** Neutral islands are open ground, and both networks may touch the same one at once.
2. **Building a Temple on an island claims it.** No assault meter, no garrison, no timer beyond the 10 s build.
3. **The moment a Temple completes, every opposing connection to that island crumbles from the island inward** — the enemy branch loses its anchor there and unravels backward by the normal collapse rules (§36).
4. **A rival cannot reconnect to that island until the Temple is destroyed.** Attempted placements are refused at the island's ports.
5. **Destroying the Temple returns the island to neutral**, open to anyone again.

## 14.6.2 Why this is better than garrisons

- **One verb.** Claiming, expanding influence, and earning Favor are the same act. The player learns one thing.
- **Construction becomes offensive.** Completing a Temple actively severs an enemy network. That is a far more interesting attack than a meter filling.
- **It reuses the collapse system** rather than adding a capture subsystem — points 3 and 5 are existing code.
- **It creates a race.** Both sides can connect to the same neutral island; the first to finish a Temple takes it and cuts the other off mid-branch. That is a genuinely dramatic 10-second window.

## 14.6.3 The 10-second build is the counterplay

A Temple under construction is visible, vulnerable, and not yet claiming anything. Guns in range can stop it. This is the only interruptible action in the game and it should read loudly: scaffolding, a rising progress ring, and an audible chant that cuts off if destroyed.

---

# 14.7 Production — How Anything Gets Built

Three questions this section answers: where materials come from, what constrains placement, and where ships come from.

## 14.7.1 One material, held centrally

**Supply is the only construction material**, and it is a single global pool held at the Great Temple. Mined from island reserves, hauled home, credited on arrival (§33D).

There is deliberately **no per-site material delivery**. Building a gun on a distant island does not require freighting stone to it. That is a production-chain game and this is not one — the logistics already exist for a reason, and doubling them would bury the primary action.

## 14.7.2 What constrains placement

| Constraint | Rule |
|---|---|
| Territory | must sit inside your influence (§14.5.2) |
| Site | a network endpoint port (§14.0) or an island plot (§14.4.2) |
| Cost | paid from the global Supply pool at the moment of placement |
| Time | short build, interruptible — see below |

**No factory gates construction.** Influence already does that job spatially, and adding a second gate would mean two systems answering the same question. A yard exists in this design for ships only (§14.7.4).

## 14.7.3 Build times

All structures now take time to raise, and are destructible while raising.

| Structure | Build time |
|---|---:|
| Route piece | instant |
| Radial gun, directional gun, shield | 3 s |
| Mooring Yard | 5 s |
| Temple | 10 s |

Under construction, a structure has half its final HP, does not function, and shows scaffolding plus a progress ring. This makes forward building genuinely risky and gives the enemy something to interrupt — the same counterplay the Temple already had (§14.6.3), extended cheaply to everything.

Route pieces stay instant. That is the primary action and it must never feel gated.

## 14.7.4 Ships — the Mooring Yard / Slipway

**Supersedes "one hauler spawns free per captured island" (§33D.2).** Free haulers made islands strictly better with no tradeoff, and left fleet size outside the player's control.

| | Mooring Yard (Aeolus) | Slipway (Poseidon) |
|---|---|---|
| Site | island plot | island plot |
| Cost | 10 Supply | 10 Supply |
| HP | 70 | 90 |
| Supports | 2 haulers | 2 haulers |
| Hauler cost | 8 Supply, 6 s to build | 8 Supply, 6 s |

Yards build haulers; haulers then serve **any** controlled island, not only the one the yard stands on. Yard count therefore caps fleet size, and yard placement is about safety rather than proximity.

Destroying a yard does not destroy its haulers — it prevents replacement. Attrition against a player with no surviving yard is permanent, which makes yards a high-value target without being a one-shot crippling blow.

## 14.7.5 The decision this creates

Every island has **two plots** (§14.4.2). The choice on each one is now real:

| Combination | Character |
|---|---|
| Temple + Yard | productive, undefended |
| Temple + Gun | held, but adds no shipping |
| Temple + Temple | not permitted — one Temple per island |
| Yard + Gun | on an island already claimed by an adjacent Temple's influence |

An island cannot be productive *and* defended *and* claimed. That is the tension the plot limit exists to create, and free haulers were quietly dissolving it.

## 14.7.6 Bootstrapping

The Great Temple counts as a yard supporting **2 haulers**, and the player starts with **1 hauler already built**. Without this the opening is a dead start: no Supply to build a yard, and no yard to earn Supply.

---


# 14.8 The Priest

The player is the Windwright (§3). This section makes that literal: there is a single unit on the board that is *you*, and founding a Temple requires him to be standing there.

## 14.8.1 What requires his presence

| Action | Priest required |
|---|---|
| Route piece | no |
| Gun, shield, yard | no |
| Hauler | no |
| **Temple** | **yes — he must be on the island for the full 10 s** |

Everything else is placed remotely from influence and Supply. **Consecration is the only priestly act**, and it is already the pivotal move in the game: it claims the island, extends buildable territory, and crumbles the enemy's connection to it (§14.6).

This turns forward expansion from a purchase into a commitment.

## 14.8.2 Movement — one tap, no new verb

**The priest has no free movement.** Tap a controlled island; he boards and routes himself there along the player's own network, exactly as a hauler does — same transit code, same wind multipliers (§21A), same speed.

No steering, no pathing UI, no waypoints, no formations. One tap, and the existing transit system does the work.

If no supported route reaches the destination, the tap is refused. The priest cannot go anywhere the network has not already gone, which keeps the network primary.

## 14.8.3 He can go adrift

This is the point of the whole mechanic.

The priest rides corridors, so §33G applies to him unchanged. **Cut the corridor beneath him and he goes adrift** — tumbling downwind on a dying envelope, taking attrition, while the player scrambles to reconnect or to place a branch into his drift path.

| Value | Starting number |
|---|---:|
| Priest hull | 80 |
| Adrift attrition | 3 HP / s (as §33G.3) |
| Survival window adrift | ~27 s |
| Rebound | onto any supported friendly segment, as any hauler |

He is deliberately tougher than a hauler and drifts longer, because his loss must be recoverable-from and must feel like a rescue the player *could* have made.

**This is a stronger signature moment than the Wave 5 sequence**, and it costs nothing — every system it uses already exists.

## 14.8.4 Losing him: succession, not defeat

> **The priest is killed, not captured, and his death is not a lose condition.**

Capture would require a prisoner, a holding location, and a rescue mechanic. None of that fits three weeks.

On death:

| Effect | Value |
|---|---|
| No new Temples may be founded | until a successor is invested |
| Succession time | 25 s, at the Great Temple |
| Existing Temples | unaffected — influence and Favor continue |
| Successor appears at | the Great Temple, and must travel out again |

Twenty-five seconds plus the journey back out is a genuine tempo catastrophe in a seven-minute match — it can cost an entire expansion window — without a single unlucky sever ending the game.

**The Great Temple remains the sole win and lose condition.** Win and lose must mirror each other; a second, asymmetric death condition would muddy both.

## 14.8.5 Poseidon has one too

His high priest travels his sea lanes under identical rules and must be present to found a tide temple. He can be killed, he goes adrift when his lanes are cut, and his side suffers the same succession delay.

This gives the player a target that is **not** a structure — the only one in the game — and makes a well-timed cut against his network potentially devastating rather than merely expensive.

**AI rule:** Poseidon does not send his priest across water covered by a player gun if an alternative route exists. He risks it only when no expansion is otherwise possible.

## 14.8.6 Feedback

- the priest's askos is visually distinct — larger gondola, banners, a trailing escort of two decorative ships that are not entities
- a persistent HUD chip shows his location and state; tapping it centres the camera on him
- consecration plays a chant with a rising progress ring, audible from off-screen
- adrift state pulses the chip red and draws the predicted drift line (§33G.5)
- death is announced once and starts a visible succession timer

## 14.8.7 Risk and gate

**This is the first time the player commands a thing rather than places one.** Every other interaction in the game is placement. Tapping a destination is close to placement, but not identical, and the difference will show up on a phone.

**Gate: prototype the priest tap in the Day 1–2 spike window** alongside touch placement (§37). If it does not feel as good as placing a piece, cut it — Temples then found remotely, and §14.8 moves to future state with nothing else disturbed.

---


# 15. Structure Destruction

A destroyed structure fails violently.

```text
Structure destroyed
        ↓
Explosion
        ↓
Adjacent supporting segment heavily damaged
        ↓
Segment may break
        ↓
Branch beyond loses support
        ↓
FRAYED
        ↓
Progressive collapse begins
```

Explosion damage affects **only the adjacent segment**.

Do not implement unlimited instantaneous chain reactions.

Larger cascades occur only because normal connectivity has been broken.

This makes failure:

- dramatic
- bounded
- understandable
- recoverable

---

# 16. Poseidon Waves

Waves are literal and central to the prototype.

## Timing

Cadence itself escalates. Compressing the build window is free difficulty and requires no new systems.

| Waves | Interval | Build window after telegraph |
|---|---|---|
| 1 → 3 | 55 s | ~47 s |
| 4 → 6 | 45 s | ~37 s |
| 7 → 9 | 35 s | ~27 s |

Telegraph is **8 seconds** throughout.

Resulting schedule:

| Wave | Start |
|---|---|
| 1 | 0:45 |
| 2 | 1:40 |
| 3 | 2:35 |
| 4 | 3:20 |
| 5 | 4:05 |
| 6 | 4:50 |
| 7 | 5:25 |
| 8 | 6:00 |
| 9 | 6:35 |

Expected match resolution: **7:00–7:15**.

The early 55-second windows exist so the player can reach the exposed Sacred island and build the long forward branch that Wave 5 is authored to punish. Do not shorten them without re-checking that Wave 5 still has a target.

Between waves:

> Build and expand.

During waves:

> Defend, reconnect, use divine powers, and decide whether expansion can continue.

---

# 16A. Waves Originate From Territory

**Closes an asymmetry that would otherwise make the match unfair in Poseidon's favour.**

The player's only offensive path is territorial: push influence to his corner, build a gun in range, fell the Great Temple (§13A.4). As originally written, Poseidon's offence was gated by nothing — waves arrived on a timer no matter how thoroughly the player had beaten him back. Cutting his network hurt his economy and nothing else.

## 16A.1 The rule

> **Every wave launches from Poseidon's Temple nearest the player's forward holdings, and sails from there.**

Not from off-map. Not from his Great Temple by default. From whatever he actually holds.

Consequences:

- **Destroying a forward Temple pushes the next wave's origin back**, and the extra transit buys the player real preparation time.
- **Poseidon's aggression is now gated by the same thing that gates the player's** — territory. Both sides must build forward to strike.
- **Escalation becomes diegetic.** Waves grow because he is expanding, not because a timer says so. The Age of Wrath at Wave 8 reads as him reaching the middle.
- **Cutting his lanes is now trebly valuable**: it starves his economy, strands his haulers, and delays his next wave.

## 16A.2 Strength scales with holdings

| Value | Formula |
|---|---|
| Wave size multiplier | `0.6 + 0.2 × (his Temple count)`, clamped **0.6 – 1.4** |
| Baseline | 2 Temples = ×1.0, matching the authored table in §17 |

The **schedule stays authored** — waves arrive on the §16 cadence regardless, so a judge always sees escalating pressure and Wave 5 always fires. Only origin and strength respond to the board.

## 16A.3 The floor: he always attacks

If Poseidon holds no Temple beyond his Great Temple, waves launch from the Great Temple itself at the ×0.6 floor.

A dominant player therefore faces long-transit, weakened waves — never none. The game must not become unopposed, and the player must never be able to switch the threat off entirely. Winning should feel like the pressure receding, not vanishing.

## 16A.4 Why the player still gets no waves of their own

Giving Aeolus waves would mean both sides sending attack craft, which is no longer tower defense, and it would need a commandable-unit system the design has avoided everywhere else (§13A.1, §33B.4).

The player's equivalent of a wave is **expansion itself**. Founding a forward Temple crumbles his connections (§14.6), extends the influence that lets guns be built closer, and pushes his wave origin back. That is the player's offensive tempo, expressed through the primary action instead of through a second one.

## 16A.5 Feedback

- the telegraph names the origin: `TIDE RISING — FROM THE CHOKEPOINT`
- destroying a forward Temple announces the consequence once: `HIS TIDE MUST COME FURTHER NOW`
- wave strength shows as visible craft count, never as a number

---


# 17. Wave Progression

| Wave | Assault | Purpose |
|---|---|---|
| **1** | 2 light transports | Bolt Battery kills ships |
| **2** | 3 transports | One defense is insufficient |
| **3** | 4 transports from two approaches | Force coverage choice |
| **4** | Siphon craft begin flooding corridors over open water | Network itself becomes target |
| **5** | **Scripted heavy strike on the most forward structure** | Signature collapse/reconnection moment |
| **6** | Poseidon introduces Tidal Surge | Divine power escalation |
| **7** | Two-front assault + Fog Bank | Multiple simultaneous problems |
| **8** | **AGE OF WRATH** | Endgame accelerates |
| **9** | Full Temple assault | Win or lose |

By approximately Wave 7, a successful player should be capable of beginning an assault on Poseidon's Temple.

---

# 18. Signature Wave 5

This sequence is authored, not hoped for.

The map and economy should strongly encourage the player to build one long forward branch with a Bolt Battery before Wave 5.

Wave 5 deliberately attacks that branch.

```text
Poseidon siphon craft flood the corridor
        ↓
Forward Bolt Battery explodes
        ↓
Adjacent wind segment breaks
        ↓
Forward island + several segments lose support
        ↓
FRAYED warning
        ↓
Airship traffic stops
        ↓
Collapse starts advancing inward
        ↓
Player receives ~20 seconds
        ↓
Player uses current hand to reconnect branch
        ↓
NETWORK RESTORED
        ↓
Wind corridor relights
        ↓
Airships surge forward again
```

This single moment should communicate:

- building
- tower defense
- logistics
- destruction
- systemic failure
- real-time feedback
- spatial problem solving
- recovery

Build the prototype around making this sequence reliable and satisfying.

---

# 19. Divine Powers

## 19.1 Aeolus

### Tailwind — 3 Favor

Select one connected branch.

Temporarily:

- airship speed rises sharply
- assault reinforcement accelerates

### Wind Wall — 4 Favor

Protect one exposed endpoint temporarily.

Effects:

- reduces incoming damage
- buys time during dangerous waves
- helps preserve a vulnerable branch while rerouting

## 19.2 Poseidon

### Tidal Surge

Introduced Wave 6.

A supernatural wave damages exposed structures and route segments — over water only, and never anything sheltered by a coastline or an island (§33B.1, §33B.2a).

### Fog Bank

Introduced Wave 7.

Reduces Aeolus airship effectiveness in a region.

Two powers per side are enough.

---

# 20. Map

One map **template** on a **12 × 20 grid**, deterministically generated per match from a seed (§20A). The topology below is fixed; positions, reserves, wind and water vary.

## 20.1 Corner Opposition

Main islands occupy opposite corners; the remaining corners and the interior hold the resource and Sacred islands.

| Region | Contents | Role |
|---|---|---|
| Bottom-left | **Aeolus Temple** | Player home |
| Top-right | **Poseidon Temple** | Objective |
| Bottom-right | 1 Supply island + 1 neutral | Player's safe economy |
| Top-left | 1 Supply island + 1 neutral | Poseidon's safe economy |
| Interior diagonal | 2 Sacred islands + 1 chokepoint | Contested influence |

Nine islands.

**A "Sacred" island is a map role, not a structure.** It denotes an interior island whose position makes its influence radius cover contested ground — a Temple there is worth more than one in the corner. Any island can hold a Temple; Sacred islands are simply the ones worth fighting for.

**Temples are inset 2–3 cells from the true corner**, and the interior islands sit nearer the diagonal midpoint than the map centre, so that home-to-interior runs are **8–12 cells**. Corner-to-corner is ~24 cells; a hauler round trip at that distance would decouple income from action entirely (§33D.3).

## 20.2 Why corner opposition

The near-corner cluster is short-route, largely island-shielded, and safe — but Supply islands project no influence. The interior islands do.

A player can therefore survive indefinitely on their own corner and still lose, because victory requires reaching Poseidon's Temple and Favor requires holding the middle. **Turtling is defeated by geometry rather than by rule**, and no anti-turtling mechanic is needed.

The interior also gives the gauntlet (§33C) a natural home: interior approaches cross open water, corner approaches do not.

One interior Sacred island must be intentionally attractive but exposed, encouraging the long forward branch that Wave 5 later punishes.

**Corner roles are fixed.** Which corner belongs to whom never varies — that would break Wave 5 authoring and the tutorial's directional language. Everything else is generated (§20A).

## 20.3 Over-Water Authoring

Every grid cell carries an `overWater` boolean. Wind corridor segments are attackable only over water (§33B.1), so this flag is the map's primary balancing tool and must be authored deliberately, not derived from art.

Requirements:

- Every efficient route to the exposed Sacred island must cross a substantial over-water stretch. This is what gives Wave 5 a guaranteed target.
- At least one alternate route to the same Sacred island should island-hop — longer, more expensive in pieces and time, but largely protected. The player must be able to *discover* that safety costs Supply.
- The central chokepoint should be almost entirely over water, so contesting it is genuinely dangerous for both sides.
- Approaches to the Aeolus Temple should include at least one island-shielded segment, so a losing player has somewhere defensible to fall back to.
- **Island emplacement plots are authored inland** (§14.4.4), never on a shoreline overlooking a main crossing. Two plots per island, three on the Temple.

Generation is constrained and validated, not free-form — see §20A.

---

# 20A. Deterministic Map Generation

**Supersedes "one handcrafted map."** Every match generates its own archipelago from a seed, so no two plays are identical while the strategic shape stays constant.

## 20A.1 Seed

```text
seed = Date.now() nonce, reduced to a short base-36 string
PRNG = mulberry32(seed)      // never Math.random()
```

The seed is **displayed on the start and end screens and can be typed in** to replay a map exactly. This matters for three reasons: debugging a bad match, reproducing a bug for the build log, and pinning a known-good map for submission if generation proves unreliable.

Every random draw in generation comes from the seeded PRNG. Generation must be a pure function of the seed.

## 20A.2 What is fixed, and what varies

| Fixed — never generated | Generated per seed |
|---|---|
| 12 × 20 grid | exact island cells within their zones |
| Corner opposition, and which corner is whose | island reserves (±20 %) |
| Nine islands | which interior island is the *exposed* one |
| Island role counts (2 Supply, 2 Sacred, 2 neutral, 1 chokepoint, 2 Great Temples) | the `overWater` map |
| Plot counts (2 per island, 3 on a Temple) | wind base bearing and field shape |
| Wave schedule and composition | the extra third plot on one non-Temple island |

The player learns one game, not one map.

## 20A.3 Zone-constrained placement

The grid is divided into authored **zones**, one per island role. The generator places each island at a random legal cell *within its zone*, never across zones.

This is what keeps the general form constant. A Supply island always appears in the bottom-right region; only where in that region varies.

## 20A.4 Mirror-then-perturb

Generate the player's half, mirror it about the diagonal for Poseidon, then apply a **small asymmetry budget** — up to two cells of displacement and one reserve adjustment per side.

Perfect mirroring is dull; free asymmetry is unfair. This gives both.

## 20A.5 Validation invariants

After generation, all of the following must hold. **Any failure re-rolls the seed** (increment nonce, regenerate).

1. At least one Supply island lies fully inside each side's Great Temple influence radius, or the opening is a dead start (§14.5.2).
2. Shortest home→nearest-interior-island path is **8–12 cells** (§20.1).
3. At least one route to the exposed Sacred island crosses **≥5 contiguous over-water cells** — Wave 5 needs a guaranteed target.
4. At least one alternate route to that same island crosses **≤2 contiguous over-water cells** and is **≥1.4× longer** — safety must exist and must cost.
5. The central chokepoint is **≥80 % over water**.
6. No single wind bearing serves both legs of the home→interior→home trip; the dot products must differ by at least 0.5, or circuits are pointless (§21A.3).
7. Corner-to-corner shortest path is **≥18 cells**.
8. No two islands within **3 cells** of each other.
9. Total reserve within each side's near corner differs by **≤5 %**.
10. Both Great Temples have at least one island-shielded approach segment (§20.1).
11. At least one **open channel** of ≥4 contiguous cells more than 1 cell from any coastline connects the two corner regions. Without it Poseidon's network is entirely sheltered (§33B.2a) and the player has no offensive verb.

**Re-roll cap: 50 attempts.** On exhaustion, fall back to a baked golden seed shipped in `CONFIG`. A judge must never see a generation failure.

## 20A.6 Why this is worth the day it costs

- Replay value from one build, which is exactly what a prototype needs to survive more than one playthrough by a judge.
- It removes the single-map overfitting risk: a design tuned to one hand-placed layout can be accidentally solved rather than genuinely balanced.
- The validator is itself a design document — every invariant above is a statement about what makes this game work, made executable.

**Risk, stated plainly:** a bad seed is worse than a mediocre handcrafted map, because a judge plays once. The invariants above are the mitigation and they are not optional. If generation is not reliably producing good maps by Day 10, pin the golden seed and ship that.

---


# 21. Portrait Legibility

This is an early kill-gate risk.

Aeolus operates in elevated air corridors.

Poseidon operates on the sea surface.

They must remain instantly distinguishable on a portrait phone.

## Aeolus

- narrow luminous wind ribbons
- clearly elevated
- visible vertical separation from sea
- warm ivory/gold identity
- airships cast visual reference/shadow toward water

## Poseidon

- broad dark teal/green sea currents
- visually attached to water surface
- heavier visual mass
- triremes remain unmistakably naval

## Camera

- fixed oblique perspective
- portrait composition
- no free rotation

If the layers are not readable at a glance on a phone by Day 3, simplify before adding systems.

---

# 21A. The Wind Field

The map carries a continuous wind gradient. It is authored terrain that happens to be invisible until rendered, and it is the strongest routing pressure in the game.

## 21A.1 Model

A coarse **6 × 10 vector field** interpolated across the 12 × 20 grid. Each cell yields a unit direction and the interpolation is bilinear.

Segment speed multiplier is the dot product of segment direction with local wind, remapped:

```text
alignment = dot(segmentDirection, windVector)   # -1 .. +1
airMultiplier = lerp(0.70, 1.35, (alignment + 1) / 2)
seaMultiplier = lerp(0.92, 1.08, (alignment + 1) / 2)
```

Roughly twenty lines of code. Everything below is emergent from it.

## 21A.2 Air ≫ sea

Airships are carried by the wind; triremes are rowed. The asymmetry above is deliberate and is a faction identity, not a universal tax — Aeolus lives and dies by the wind, Poseidon barely notices it.

## 21A.3 The circuit, not the spur

This is the point of the whole system.

Out-and-back along one corridor means every hauler flies half its life against the wind. The correct answer is an **outbound corridor on the prevailing wind and a separate return corridor on a different bearing** — a circuit.

| Topology | Round trip, 10-cell island | Relative income |
|---|---:|---:|
| Spur, out-and-back on one road | ~21.7 s | 1.00× |
| Circuit, both legs favourable | ~14.8 s | **~1.45×** |

Loops therefore emerge from greed rather than from instruction, which the original design listed as the mark of an advanced player. They also double the infrastructure that must be defended, which is exactly the pressure the game wants.

## 21A.4 Drift

The field rotates slowly and **never reverses**.

| Value | Starting number |
|---|---:|
| Drift amplitude | ±30° from the authored bearing |
| Drift period | ~90 s per full oscillation |
| Coherence | whole field drifts together, no local swirls |

Consequences, all intended:

- Route speeds fluctuate gently rather than inverting. A good circuit stays good; it merely breathes.
- **Exposure time under a gauntlet rises and falls with the drift.** An established mast chain that a ship survives comfortably at one phase becomes lethal at another. Attrition acquires a rhythm the player can feel before they can name it.
- Nothing built early becomes worthless later. A ±180° shift would invalidate infrastructure and be read as unfairness; ±30° reads as weather.

Full rotation, and deliberate weather manipulation, are the natural future-state Zeus mechanic — his stated line is *"Your plan works until I change the weather."*

## 21A.5 Visibility is mandatory, and early

Wind that cannot be seen is invisible arithmetic that silently ruins the player's income. Required tells:

- **Water** — whitecap and swell direction, the primary readout
- **Islands** — tree lean and canopy motion
- **Buildings** — smoke plumes from temples and workshops
- **Corridors** — ribbon particle drift, faster where aligned
- **Placement ghost** — the candidate piece shows its resulting speed multiplier before commit

**Schedule requirement: the wind visuals ship in the Day 3–6 core build, not the Day 15–17 polish window.** If the wind is not legible, the mechanic is a hidden tax and the sooner that is discovered the better.

## 21A.6 Authoring

The authored base field must guarantee that:

- no single bearing serves both the outbound and return leg of any important route, or circuits are pointless
- the interior contested islands sit where the wind is least forgiving, so pushing to the middle costs speed as well as safety
- the player's corner cluster has a mildly favourable outbound bearing, so the first thirty seconds feel good

---

# 22. Mandatory Narrative Delivery Principle

> **Lore rides on instructions that already exist.**

Do not add cutscenes or additional narrative time.

Tutorial instructions teach both:

1. a mechanic
2. one story beat

Wave banners provide both:

1. threat telegraph
2. Poseidon's characterization

Anything else is optional Codex material.

---

# 23. Onboarding

The first ~30 seconds are scripted.

One line at a time.

Everything except the required action may be dimmed.

## Canonical Tutorial Lines

### 0:00

> **“The bag lifts them. Only bound air moves them. Take a wind.”**

Mechanic: tap a route piece.

Lore: hydrogen/lift exists independently; bound wind produces travel.

### 0:05

> **“Lay it toward the shrine. Nothing you build need touch the sea.”**

Mechanic: select a socket / confirm route.

Lore: the road never touches his sea.

### 0:12

> **“My ships move where you have bound the air. Favor follows.”**

Mechanic: visible traffic and Favor economy.

Lore: network = logistics.

### 0:20

> **“An open end is exposed. Cap it, or continue it.”**

Mechanic: structure placement.

Important: supported open ends are stable. They are vulnerable, not decaying.

### 0:28

Scripted onboarding ends. **Control is fully released here**, not at Wave 1 — the player must have free build time before the first threat arrives.

### 0:37

> **“They cross without asking him. He rises.”**

Mechanic: Wave 1 telegraph (8 seconds, as normal).

Lore: Poseidon's grievance.

This line is delivered by the standard telegraph system, not the tutorial system. It is the only Aeolus line that fires after control is released.

### 0:45

# WAVE 1

No dead interval: the player is building freely from 0:28, and the telegraph interrupts nothing.

## Skip Behavior

A **SKIP** affordance is visible from second zero.

One tap:

- ends scripted onboarding
- begins normal match
- remembers the choice locally for replay

Wave banners remain mandatory because they are gameplay telegraphs.

---

# 24. First Sever Tutorial Line

The first time a player branch becomes unsupported, Aeolus says:

> **“The binding is cut. Take another path before the wind remembers.”**

This introduces progressive decay at the exact moment the mechanic becomes relevant.

Do not teach decay before the player sees a severed branch.

---

# 25. Poseidon Wave Banners

Every wave already requires an 8-second telegraph.

Poseidon's voice rides on that UI.

He never directly addresses the player.

He speaks to the sea, and the player overhears.

| Wave | Banner |
|---|---|
| **1** | **THE FIRST TIDE** — “Something is above my water.” |
| **2** | **THE SECOND TIDE** — “It has not come down.” |
| **3** | **THE THIRD TIDE** — “They no longer sail. They no longer pay. They no longer ask.” |
| **4** | **THE FOURTH TIDE** — “Then break the road, not the ships.” |
| **5** | **THE FIFTH TIDE** — “Cut it where it reaches farthest.” |
| **6** | **THE SIXTH TIDE** — “They made a sky out of rocks and sour wine. Drown it.” |
| **7** | **THE SEVENTH TIDE** — “Everywhere at once.” |
| **8** | **THE AGE OF WRATH** — “Three generations I have waited to be needed again.” |
| **9** | **THE LAST TIDE** — “Come down.” |

Narrative function:

- Wave 4 tells the player the network itself has become the target.
- Wave 5 announces the scripted attack intentionally.
- Wave 6 reinforces the hydrogen premise when Tidal Surge appears.
- Wave 9 reduces Poseidon's entire grievance to two words.

---

# 26. Voice Rules

## Aeolus

- brief
- imperative
- treats player as competent
- never explains twice
- proprietary about the winds
- indifferent to the engineering of the ships

## Poseidon

- never addresses player directly
- addresses the sea
- line appears only through wave telegraphs
- resentment is dignified, not cartoon villainy

## Mortals

No named mortal protagonist.

No captain character.

No portraits.

No dialogue trees.

No companion NPC.

---

# 27. Optional Codex

Codex is optional and never interrupts play.

Long-press an object to open a short entry.

Maximum target: **40 words per entry**.

No notification badge.

No tutorial prompt to open it.

The entire game must be understandable without ever viewing Codex.

Suggested entries:

## Askos

Linen over bronze ribs. A trireme turned over and lightened until it left the water. The guilds still build them in the same yards, to the same joinery, for a different element.

## The Light Air

Iron filings and sour wine in a sealed retort give off an air that will not stay down. Discovered in a foundry. No god was consulted, because none was needed.

## Why No One Strikes a Spark

The light air burns. Mooring yards keep no lamps, no forges, and no impatient men.

## Bound Wind

Lift is not travel. A full envelope rises and then goes where the sky goes. A crew that wants a destination must find a wind and bind it.

## Wind Corridor

Bound air, renewed from the Temple. Severed, it does not fall. It remembers, and unbinds itself backward from the cut.

## Why the Guild Serves Aeolus

They solved lift alone. They never solved motion. The only winds loose in these islands are the ones his own bag lost, and he grants them to an order that keeps his rites.

## Temple

Where mortals thank the wind for not killing them. Consecrated by the priest in person, and the island is his god's from that moment. Favor accumulates only over ground no rival god also claims.

## Bolt Battery

It fires nothing. It drops ballast jars — bronze, heavy, full of seawater — into the lanes below, where they sink and foul them. Every gun in this war points at water.

## Siphon Craft

Bronze pumps that throw the sea upward. They do not hole the envelopes. Wet air will not hold a binding, and a drowned wind is no road at all.

## Poseidon's Complaint

Every crossing once owed him honour — a sacrifice before sailing, a thank-offering for having survived. The sky asks him for nothing, so it thanks him for nothing. There is no rite for being forgotten.

## The Opened Bag

Odysseus slept within sight of Ithaca. His crew thought the bag held gold. Everything since is consequence.

Ten entries are enough for the prototype.

Codex is polish-window work only.

---

# 28. Win / Lose / Reset

## Win

Extend a **supported assault route** to Poseidon's Temple and maintain it until capture completes.

Display:

# THE ARCHIPELAGO ACKNOWLEDGES YOUR GOD

## Lose

Poseidon's forces capture Aeolus's Temple.

Display:

# YOUR TEMPLE HAS FALLEN

## Reset

Immediate one-tap restart.

No required return to menu.

---

# 29. AI

Do not build a general-purpose route-solving strategy AI.

## Construction

At map-authoring time:

1. define legal Poseidon route skeletons toward important objectives
2. define one or more alternates
3. give AI curated pieces that fit the chosen skeleton
4. animate AI placement visibly one piece at a time

It must **look** like Poseidon obeys the same construction language.

It does not need to solve the general puzzle.

## Strategic Target Selection

Simple scoring:

- island value
- influence value — uncontested ground the island's Temple would cover
- proximity
- defense level
- distance to player's Temple

## Reroute Behavior

Defining alternate skeletons at authoring time is not enough; the switch must have a trigger. Without one, cutting Poseidon's network produces no visible response and the player never learns the lesson §42 promises.

```text
Poseidon segment destroyed
        ↓
recalculate Poseidon support (same algorithm as player)
        ↓
orphaned Poseidon branches FRAY and collapse identically
        ↓
if a scored objective has lost its connection:
        wait 2 s (readable pause)
        select highest-scoring precomputed alternate that avoids the destroyed cell
        place one piece every 1.5 s along it, visibly
        ↓
if no alternate is viable:
        abandon that objective
        redirect to next-highest-scoring target
```

**Reroute cooldown: 20 seconds.** Poseidon may not immediately undo a successful cut. The player must be allowed to win a cut for a meaningful stretch, or the offensive verb feels inert.

Poseidon's collapse should be as visually loud as the player's. Watching an enemy corridor unravel is the reward for the whole lesson.

## Wave AI

Wave assaults are authored independently.

This makes them:

- predictable enough to tune
- reliable enough to demonstrate mechanics
- dramatic enough for judging

---

# 30. Real-Time Feedback

| Event | Feedback |
|---|---|
| Piece placed | wind corridor physically forms |
| Connection made | airship traffic begins |
| Wave incoming | banner + direction + rising water |
| Structure firing | obvious projectile + impact |
| Structure destroyed | explosion + adjacent segment cracks |
| Support lost | color drains + traffic stops + timer |
| Collapse | wind segments unravel sequentially |
| Reconnection | branch relights + traffic surge + chord |
| Island captured | banner + ownership transformation |
| Temple threatened | strong edge warning |

No spreadsheet should be required to understand game state.

---

# 31. Visual Direction

# MYTHIC HELLENIC BRONZEPUNK

Not strict historical Greece.

World:

- white limestone islands
- turquoise Aegean sea
- marble temples
- giant statuary
- bronze machinery
- wooden triremes
- supernatural tides
- brilliant Mediterranean light

Aeolus technology:

- linen gas envelopes
- bronze ribs
- wooden gondolas
- Greek geometric ornament
- control fins derived from oars/sails
- glowing divine wind effects

The look should communicate:

> **Greek civilization discovered lighter-than-air technology through mortal engineering and divine infrastructure.**

---

# 32. Audio

Prefer runtime WebAudio synthesis.

Create:

- wind
- waves
- thunder
- construction thunk
- route activation
- warning tones
- severing tone
- structure destruction
- reconnection chord
- Temple capture
- victory/defeat sting

Advantages:

- tiny package
- no network
- no sourcing/licensing task
- highly parameterized feedback

---

# 33. Technical Architecture

Recommended development modules:

```text
GameState
Grid
NetworkGraph
PieceSystem
SupportSystem
DecaySystem
ResourceSystem
StructureSystem
WaveSystem
CombatSystem
AIController
Renderer
UIController
Tutorial
Codex
AudioSystem
```

Develop separately if convenient.

Final entrant-authored code must be concatenated into readable, unminified `index.html`.

Third-party libraries remain external under `/vendor`.

---

# 33A. Combat Resolution and Starting Values

`CombatSystem` appears in the module list above; this is its specification.

**Every number below is a starting point, not a balance claim.** They exist so a coding agent does not invent its own, and so Days 20–21 are spent tuning rather than discovering. All values assume a distance unit of one grid cell and a time unit of one second.

## 33A.1 Combat resolution

Continuous, not turn-based. Each second, every gun with a valid target in range applies its damage to one target, preferring: hostile craft > hostile structure > hostile segment. Radial guns instead apply their damage to **every** valid target in radius. No accuracy roll, no armour types, no damage multipliers. Craft in contact with a structure apply their damage to it. A shield in the line of fire absorbs 70 % before the target takes the rest (§14.3).

## 33A.2 Economy

Resources are **not** granted by connection. They are mined into a local stockpile, loaded onto a hauler over a dwell time, and only credited when that hauler reaches the home Temple. See §33D.

| Value | Starting number |
|---|---:|
| Starting Supply | 12 |
| Starting Favor | 0 |
| Temple baseline income | +2 Supply, +1 Favor per 10 s (never depletes) |
| Piece reroll | 1 Favor |

All other income arrives by delivery.

## 33A.3 Structures

Full roster and naming in §14A. Aeolus values left, Poseidon right.

| Structure | Cost | HP (A / P) | Damage/s (A / P) | Range |
|---|---:|---:|---:|---:|
| Wind corridor segment | 2–5 (§8) | 40 | — | — |
| Sea lane segment | 2–5 | 55 | — | — |
| Radial gun — Chain Vane / Churn Drum | 7 | 45 / 60 | 6 / 5 | radius 2 |
| Directional gun — Bolt Battery / Siphon Lance | 10 | 50 / 70 | 16 / 13 | 6, 90° arc |
| Shield — Aegis Screen / Bulwark Raft | 12 | 130 / 160 | — | 120° arc, 70 % intercept |
| Temple | 14 | 100 | — | influence 5 |
| Great Temple | — | 200 | — | influence 8 |
| Mooring Yard / Slipway | 10 | 70 / 90 | — | — |
| Hauler | 8 | 60 | — | — |
| Priest | — | 80 | — | — |

Shields intercept 70 % of damage aimed at friendly structures and segments behind them, and pass friendly fire (§14.3). Every structure also grants vision radius 6 (§14B.3).

## 33A.4 Poseidon craft

| Craft | HP | Damage/s | Range | Target preference |
|---|---:|---:|---:|---|
| Light transport | 30 | 5 | contact | Temples and structures on islands |
| Siphon craft | 45 | 8 | 3 | **segments and structures, over open water only** |
| Heavy strike craft (W5+) | 80 | 14 | 3 | structures |

A Bolt Battery kills a light transport in 2.5 s and a siphon craft in ~4 s. One battery handles Wave 1 comfortably and Wave 2 barely — which is the intended lesson.

Siphon craft cannot damage any segment that crosses an island (§33B.1). Authored waves must therefore approach along over-water stretches, and the map must guarantee at least one such stretch on any efficient route to the exposed interior island (§20A.5).

## 33A.5 Structure destruction — deterministic

> **A destroyed structure always destroys its single adjacent segment, on the outward side (§14.0).**

Destruction damage is fixed at 50, above the 40 HP of a wind segment and below the 55 HP of a sea lane — so an Aeolus break is guaranteed and a Poseidon break needs the segment already damaged. This is deliberate: it removes all tuning risk from the Wave 5 signature sequence, makes the rule teachable in one sentence, and guarantees every judge sees the collapse. Damage does not propagate past that one segment.

## 33A.6 Collapse

| Value | Starting number |
|---|---:|
| Rescue window before first collapse | 3 s |
| Interval between subsequent collapses | 3 s |
| Reconnection effect | immediate, cancels all decay on newly supported segments |

## 33A.7 Claim

**The garrison and assault-pressure model is removed (§14.6).** Islands are claimed by founding a Temple with the priest present, and taken by destroying the standing Temple.

| Value | Starting number |
|---|---:|
| Temple build time (priest present throughout) | 10 s |
| Temple HP | 100 |
| Great Temple HP | 200 |
| Time to fell a Temple, one directional gun | ~6 s |
| Time to fell a Great Temple, one directional gun | ~13 s |
| Priest succession after death | 25 s |

The barrier to victory is territorial, not numerical: influence gates construction, so a gun cannot be built within reach of the Great Temple until a chain of Temples has pushed influence to his corner (§13A.4).

## 33A.8 Divine powers

| Power | Cost | Duration | Effect |
|---|---:|---:|---|
| Tailwind | 3 Favor | 15 s | ×2 speed on one branch — haulers deliver faster, the priest arrives sooner, and exposure time under a gauntlet halves (§33C.7) |
| Wind Wall | 4 Favor | 12 s | damage to one endpoint reduced 75 % |
| Tidal Surge (AI) | — | instant | 40 damage to all player structures within 3 cells of water |
| Fog Bank (AI) | — | 20 s | player gun range and damage halved in region |

## 33A.9 Age of Wrath (Wave 8)

| Modifier | Value |
|---|---|
| Favor generation | +50 % |
| Structure damage both sides | +25 % |
| Poseidon craft damage | +25 % |
| Wave interval | already 35 s (see §16) |

---

# 33B. Cross-Layer Attack — How the Two Layers Reach Each Other

Neither side attacks the other's vessels. **Both sides attack the other's road.** Poseidon's own Wave 4 banner states the design rule: *"Then break the road, not the ships."*

## 33B.1 Poseidon reaching up — siphon craft

The craft previously called *bombard craft* are **siphon craft**: bronze pumps throwing seawater upward into a wind corridor.

They are not trying to hole an envelope. Wet, cold, heavy air will not hold a binding. Poseidon drowns the wind and the road ceases to exist.

### The over-water rule

> **A wind corridor segment is attackable only where it passes over open water.**

Segments crossing an island are out of reach and take no damage from any Poseidon source, including Tidal Surge.

Implementation: one boolean per grid cell (`overWater`), authored with the map. Cost is trivial; the strategic payoff is large. Routing becomes a real decision rather than a shortest-path exercise:

- the direct line across the strait is exposed along its entire length
- the island-hopping line is safe but costs more pieces, more Supply, and more time
- the exposed Sacred island of §20 must sit at the end of a heavily over-water approach, which is precisely what makes Wave 5's authored strike land

Structures on over-water endpoints are attackable. Structures on endpoints over an island are not — so a shield on an island endpoint is genuinely safe, and correspondingly less useful.

## 33B.2 Aeolus reaching down — ballast jars

Bolt Batteries do not fire projectiles at ships in any conventional sense. They **drop ballast jars**: bronze vessels full of seawater, released into the currents below, where they sink into the lane and foul it.

Mechanically this is the anti-segment damage of §13A.3. Diegetically it is the insult that makes Poseidon's grievance personal — the crews are pouring his own sea back onto him — and it cashes the Codex line that every gun in this war points at water.

Ballast jars damage sea segments, Poseidon structures, and craft alike. No separate ammunition or targeting system.

## 33B.2a The lee-shore rule — sheltered sea

**Mirrors the over-water rule of §33B.1, and exists to fix a real asymmetry.**

Sea lanes are by definition always over water, so without this rule Poseidon's entire network is permanently exposed while the player's can be made nearly immune by island-hopping. Combined with the player's longer gun range (6 vs 3), that let the player snipe his lanes from outside his reach with no equivalent counter. That is not asymmetry, it is a one-way rule.

> **A sea segment within 1 cell of a coastline is sheltered and cannot be damaged.**

Harbours and lee shores are real, this reads instantly on the map, and it gives Poseidon exactly the routing decision the player has:

| | Aeolus | Poseidon |
|---|---|---|
| Safe routing | over islands | hugging coastlines |
| Cost of safety | longer, more pieces, more time | longer, more pieces, more time |
| Fast routing | straight over open water | straight through open channel |
| Cost of speed | exposed to siphon fire | exposed to ballast jars |

**AI routing preference.** Poseidon prefers sheltered lanes when the detour is under 1.5× the direct route, and runs the open channel when speed matters more — during a wave push, or when racing the player to a neutral island. This makes his coastal routing read as deliberate seamanship rather than pathfinding noise, and it costs one comparison.

**Generator obligation (§20A.5).** The validator must guarantee at least one substantially open channel between the two corners, or Poseidon's whole network becomes untouchable and the player loses their offensive verb entirely. Added as invariant 11.

## 33B.2b Segment durability is not symmetric

| Segment | HP |
|---|---:|
| Wind corridor | 40 |
| Sea lane | 55 |

A thread of bound air is easier to foul than a broad current. This softens the player's range advantage without removing it — a directional gun still out-reaches everything Poseidon has, it simply takes longer to cut with.

## 33B.3 Player airships are attritable, not commandable

*This supersedes an earlier draft in which airships had no HP. That version removed the only pressure Poseidon could apply to traffic, and made the over-water rule a binary instead of a gradient. See §33C.*

Airships have hull integrity and can be destroyed. What they do **not** have is agency:

- the player cannot select, steer, retreat, or reinforce them
- they have no attack of any kind
- they follow the corridor they are given, at the speed the corridor allows

The player's response to losing ships is therefore never tactical. It is **architectural** — reroute the corridor, shorten the exposed run, or destroy the guns covering it. That is the thesis of the whole game, restated as a combat system.

---

# 33C. Hull Integrity, Regeneration, and the Gauntlet

## 33C.1 The principle

An airship is not killed by a single weapon. It is killed by **unbroken coverage** — a chain of guns whose fields of fire overlap enough that the ship never gets a gap in which to recover.

Poseidon's skill expression is continuity. The player's counter is finding or manufacturing a gap.

## 33C.2 Values

| Value | Starting number |
|---|---:|
| Airship hull integrity | 60 |
| Transit speed | 1 cell / s base, × wind multiplier (§21A.1) |
| Regeneration | 6 HP/s |
| Regeneration delay after taking fire | 2 s |
| Mooring regeneration (over friendly island) | 15 HP/s, no delay |
| Venting threshold | below 20 HP |

## 33C.3 The gauntlet math

A gun covering 3 cells applies roughly 3 seconds of fire to a passing ship.

| Arrangement | Damage taken | Outcome |
|---|---|---|
| One gun | ~24 | survives comfortably |
| Two guns with a gap between | 24, regen, 24 | survives |
| Two guns with overlapping cover | ~48 unbroken | survives, venting |
| Three guns, continuous | ~72 | **destroyed** |

The gap is the whole game. Tune gun DPS only — hold **base** transit speed and gun range as constants, or three interacting dials will make this untunable in the Day 20–21 window.

**Wind drift modulates this table.** Transit speed is wind-multiplied (§21A.1) and the field drifts ±30° on a ~90 s cycle, so time-under-fire rises and falls with it. A mast chain a ship survives at one phase can kill at another. This is intended rhythm, not noise — but it means gauntlet tuning must be checked at both drift extremes, not only at the authored bearing.

## 33C.4 What a loss costs

A destroyed airship does **not** destroy the segment it was on.

- the cargo of that delivery is lost (Supply or Favor)
- if the ship was carrying the priest, see §14.8.4 — otherwise only cargo is lost
- the corridor itself is untouched

Sustained gauntlet fire is therefore an **income throttle**, not a network collapse. Punishing, diagnosable, and recoverable.

## 33C.5 Feedback requirements

Non-negotiable. If the player cannot connect falling income to a specific stretch of water, this system is noise.

- envelope visibly deflates, ship loses altitude and settles into the sea
- a persistent wreck marker remains at the loss location for ~20 s
- `CONVOY LOST` ticker naming the branch
- venting ships (below 20 HP) trail gas visibly — this is also the Zeus ignition tell (§40)

## 33C.6 Poseidon's gauntlet piece — the Siphon Mast

Siphon craft are mobile and wave-bound. Gauntlets require permanence.

| Structure | HP | Damage/s | Range | Notes |
|---|---:|---:|---:|---|
| Siphon Mast | 50 | 8 | 3 | moored, AI-built, targets airships and air segments |

The AI builds masts along contested straits between waves. They give Poseidon genuine tower presence, give Bolt Batteries a target worth shooting, and make the central chokepoint properly dangerous.

Masts cannot reach corridor segments crossing an island (§33B.1), and cannot damage ships over islands either — so islands are regeneration waypoints, and the island-hopping route earns a second reason to exist.

## 33C.7 Interactions that come for free

**Tailwind halves exposure.** Doubling transit speed halves the seconds spent under every gun. A ship that dies in a gauntlet survives it under Tailwind. An existing power silently becomes a tactical answer, with no new code.

**Mooring Yards.** Already in the roster (§14.7.4); if the design expands, letting them also regenerate hulls turns held islands into staging posts.

**Zeus, later.** The venting state below 20 HP is the ignition condition in §40. Poseidon grinds; Zeus finishes. Do not remove the venting threshold even though nothing uses it yet in the prototype.

## 33C.8 Build cost and gate

Roughly one day in the Day 7–10 window. It competes with the rest of §37.1.

**Gate: this ships only if the Wave 5 signature sequence already works.** If Day 10 arrives and the collapse-and-reconnect loop is not solid, airships stay decorative and this section moves to future state. Nothing else in the design depends on it.

---

## 33B.4 The deliberate asymmetry

Poseidon's craft **are** entities and **are** targetable, because they are the waves — that is the tower defense. He has units; the player has towers. His counterplay is not to out-shoot the player but to break the infrastructure those towers hang from.

That asymmetry is the game.

**But the two attack rules must mirror.** Each side has terrain it cannot be hit on — islands for Aeolus (§33B.1), coastlines for Poseidon (§33B.2a) — and each pays the same currency for using it: length. Any future change to one rule must be applied to the other, or the side without shelter loses by geometry rather than by play.

## 33B.5 Target matrix

| Source | Craft | Segments | Structures | Islands |
|---|---|---|---|---|
| Bolt Battery (directional) | yes | yes — sea, **open water only**, within 6 | yes | — |
| Siphon craft | **yes — airships, over water only** | yes — air **over water only**, within 3 | yes | — |
| Light transport | — | — | — | yes (capture pressure) |
| Heavy strike craft | — | — | yes | — |
| Siphon Mast | **yes — airships, over water only** | yes — air, over water only, within 3 | yes | — |
| Player airships | — | — | — | — |
| Tidal Surge | — | yes — over water only | yes | — |
| Ballast jars | — | (this *is* the Bolt Battery attack) | — | — |

---

# 33D. Mining, Hauling, and Depletion

Replaces abstract "connected island contributes" income. Distance, exposure, and depletion now do the balancing that a throughput/capacity system would otherwise have to do in code.

## 33D.1 The cycle

```text
Island mines into a LOCAL STOCKPILE (only while controlled)
        ↓
Hauler arrives, dwells, loads to capacity or to stockpile empty
        ↓
Hauler flies the corridor home
        ↓
Arrival at Temple CREDITS the cargo
        ↓
Hauler returns
        ↓
... until the island's RESERVE is exhausted
```

Nothing is credited in transit. A hauler shot down mid-route loses its whole load (§33C.4).

## 33D.2 Haulers

Both sides use the same model. Aeolus flies **askoi**; Poseidon sails **cargo triremes**. One implementation, two meshes.

**Haulers are built at Mooring Yards and cost Supply (§14.7.4).** They are then assigned automatically to whichever controlled island most needs collection; the player never selects, routes, or manages an individual ship. Fleet size is a purchasing decision, and a direct visual readout of how much the player has invested in shipping.

When an island's reserve is exhausted its hauler completes its final run and retires.

## 33D.3 Values

| Value | Starting number |
|---|---:|
| Hauler capacity | 10 |
| Dwell / load time | 4 s |
| Unload time at Temple | 2 s |
| Transit speed | 1 cell / s base, × wind multiplier (§21A.1) |
| Mining rate into stockpile | 2 per s while controlled |
| Corner Supply island reserve | 80 |
| Interior island reserve | 140 |
| Temple reserve | infinite |

An 8–12 cell island therefore yields roughly **24 Supply per minute** and runs dry after about three minutes of uninterrupted hauling. A 20-cell island yields closer to 14 per minute — the distance penalty is emergent, not a coded modifier.

## 33D.4 Why depletion matters

Depletion is the escalation engine. A player cannot hold two islands and win; they must keep pushing outward as reserves run down, and the richest reserves are in the contested interior (§20).

A depleted island is **not** worthless — it remains an anchor, still holds plots, and still projects its Temple's influence (§14.5). It stops producing, not mattering.

## 33D.5 Symmetry cuts both ways

Poseidon's economy runs on identical rules. Cutting his corridors starves him exactly as cutting the player's starves them, which finally gives the player's offensive verb (§13A.3) an **economic** payoff rather than a merely tactical one.

## 33D.6 Feedback requirements

Falling income must be traceable to a cause, or this system is invisible arithmetic.

- Each controlled island shows a **reserve bar**; spoil heaps visibly shrink as it drains
- A stockpile that is filling with no hauler collecting it visibly **piles up** — this is what a severed route looks like
- Delivery credits pulse the Supply counter
- Hauler retirement on depletion is announced once

---

# 33E. Lift Technology and Ship Scale

Two hull tiers, one unlock, no tech tree. This is the session's visible growth curve (JR-8D) and it is historically literal — hot air came first in 1783, hydrogen followed within months.

## 33E.1 The fork, not the ladder

Hydrogen is **not** a straight upgrade. A larger envelope carries more and presents a larger target.

| | Hot-air askos (start) | Hydrogen askos (unlocked) |
|---|---|---|
| Capacity | 6 | **12** |
| Hull integrity | 60 | 60 |
| Damage taken | ×1.0 | **×1.25** (larger envelope) |
| Can vent / ignite | no | **yes**, below 20 HP (§33C.2) |
| Visual scale | small, bronze brazier glowing beneath | noticeably larger envelope |

A player who unlocks hydrogen doubles income per trip and becomes materially more fragile in a gauntlet. That is the decision.

**Coupling note:** this tradeoff depends on §33C shipping. If hull integrity is cut, tiers trade capacity against unlock cost only, and the vulnerability column is dropped.

## 33E.2 The unlock

| Value | Starting number |
|---|---:|
| Cost | 25 Supply + 6 Favor |
| Effect | fleet-wide and instant — every existing and future hauler is retrofitted |
| Availability | from match start; priced to land around 3:00–3:30 for a typical player |

No per-ship selection, no build queue, no partial fleets. One purchase, whole fleet, immediate visual change.

## 33E.3 Why the timing matters

Priced to complete just before **Wave 5**. The player's fleet visibly doubles in scale, income jumps — and then the authored strike lands on the newly expanded operation. The upgrade is what makes the loss hurt.

It also lands Poseidon's Wave 6 banner at the exact moment it becomes true:

> *"They made a sky out of rocks and sour wine. Drown it."*

Until the unlock, they had not. The narrative reveal and the mechanical unlock coincide, at no cost.

## 33E.4 Lore adjustment

The foundry discovery (§4) moves from backstory to mid-match event. The guild began with fire under a bag — obvious, cheap, feeble. Iron filings and sour wine came later, and in this match the player is the one who commissions it.

Poseidon's cargo triremes have no equivalent tier. His hulls are already mature; that is part of what makes him the incumbent.

## 33E.5 Future state

A third tier — rigid bronze-framed hulls, capacity 20, genuine Faraday shielding, structurally vulnerable to weather (§40) — belongs to the Zeus expansion, not the prototype.

---

# 33F. Configuration Constants

**Rule: no numeric literal may appear in system logic.** Every tunable value lives in a single frozen `CONFIG` object. Systems read from it; nothing else defines a number.

This exists because the Day 20–21 tuning window is unusable otherwise. Asking an agent to change one value means rebuilding context across the codebase, over-planning, editing lines nobody asked it to edit, and running regressions — for a number that should take two seconds to type.

## 33F.1 Development vs submission

JR-5 requires all entrant-authored code consolidated into a readable, unminified `index.html`. A config *directory* therefore cannot survive submission — but it should exist during development.

```text
development:   /config/wind.js, /config/economy.js, /config/combat.js, ...
                        ↓ concatenate at build
submission:    index.html, CONFIG block first, systems below
```

Placing the CONFIG block at the **top** of `index.html` also serves the judges: the first thing a reader encounters is a legible parameter list rather than engine plumbing.

## 33F.2 The object

```javascript
const CONFIG = Object.freeze({

  Grid:      { WIDTH: 12, HEIGHT: 20, CELL_SECONDS: 1.0 },

  MapGen: {
    USE_TIME_NONCE: true,
    OPEN_CHANNEL_MIN_CELLS: 4,
    AI_SHELTER_DETOUR_MAX: 1.5,
    GOLDEN_SEED: "wndwrd1",     // fallback if validation exhausts
    MAX_REROLLS: 50,
    RESERVE_VARIANCE: 0.20,
    ASYMMETRY_CELLS: 2,
    MIN_ISLAND_SEPARATION: 3,
    HOME_TO_INTERIOR_MIN: 8, HOME_TO_INTERIOR_MAX: 12,
    EXPOSED_OVERWATER_MIN: 5,
    SAFE_ROUTE_OVERWATER_MAX: 2, SAFE_ROUTE_LENGTH_MULT: 1.4,
    CHOKEPOINT_OVERWATER_FRACTION: 0.80,
    CIRCUIT_DOT_SEPARATION: 0.5,
    CORNER_TO_CORNER_MIN: 18
  },

  Wind: {
    FIELD_W: 6, FIELD_H: 10,
    AIR_MIN: 0.70, AIR_MAX: 1.35,
    SEA_MIN: 0.92, SEA_MAX: 1.08,
    DRIFT_DEGREES: 30, DRIFT_PERIOD: 90.0
  },

  Economy: {
    START_SUPPLY: 12, START_FAVOR: 0,
    TEMPLE_SUPPLY_PER_10S: 2, TEMPLE_FAVOR_PER_10S: 1,
    REROLL_FAVOR: 1
  },

  Mining: {
    RATE_PER_SECOND: 2,
    RESERVE_CORNER: 80, RESERVE_INTERIOR: 140
  },

  Hauler: {
    DWELL_SECONDS: 4.0, UNLOAD_SECONDS: 2.0,
    HOTAIR_CAPACITY: 6, HYDROGEN_CAPACITY: 12,
    COST: 8, BUILD_SECONDS: 6,
    START_COUNT: 1
  },

  Yard: {
    COST: 10, HP_AEOLUS: 70, HP_POSEIDON: 90,
    BUILD_SECONDS: 5, SUPPORTS: 2,
    GREAT_TEMPLE_SUPPORTS: 2
  },

  BuildTimes: {
    ROUTE_PIECE: 0, GUN: 3.0, SHIELD: 3.0, YARD: 5.0, TEMPLE: 10.0,
    UNDER_CONSTRUCTION_HP_FRACTION: 0.5
  },

  Airship: {
    HULL: 60, REGEN_PER_SECOND: 6, REGEN_DELAY: 2.0,
    MOORING_REGEN: 15, VENT_THRESHOLD: 20,
    HYDROGEN_DAMAGE_MULT: 1.25
  },

  Tech: { HYDROGEN_COST_SUPPLY: 25, HYDROGEN_COST_FAVOR: 6 },

  Pieces: {
    HAND_SIZE: 3,
    COST_SHORT: 2, COST_LONG: 3, COST_L: 3, COST_S: 3, COST_T: 5
  },

  Structures: {
    TEMPLE:   { COST: 14, HP: 100, RADIUS: 5, BUILD_SECONDS: 10 },
    VANE:     { COST: 7,  HP: 45,  DPS: 6,  RADIUS: 2 },
    DRUM:     { COST: 7,  HP: 60,  DPS: 5,  RADIUS: 2 },
    BOLT_DIR: { COST: 10, HP: 50,  DPS: 16, RANGE: 6, ARC_DEG: 90, TURN_DEG_S: 45 },
    LANCE:    { COST: 10, HP: 70,  DPS: 13, RANGE: 6, ARC_DEG: 90, TURN_DEG_S: 45 },
    AEGIS:    { COST: 12, HP: 130, INTERCEPT: 0.70, ARC_DEG: 120 },
    BULWARK:  { COST: 12, HP: 160, INTERCEPT: 0.70, ARC_DEG: 120 },
    PORTS_GUN: 1, PORTS_SHIELD: 2, PORTS_ALTAR: 0,
    PLOTS_PER_ISLAND: 2, PLOTS_PER_TEMPLE: 3,
    DESTRUCTION_DAMAGE: 50
  },

  Segments: { AIR_HP: 40, SEA_HP: 55, LEE_SHORE_CELLS: 1 },

  Vision: {
    STRUCTURE: 6, TEMPLE: 8, HAULER: 4, SEGMENT: 2,
    REMEMBER_STRUCTURES: true, REMEMBER_CRAFT: false
  },

  Craft: {
    TRANSPORT:  { HP: 30, DPS: 5,  RANGE: 0 },
    SIPHON:     { HP: 45, DPS: 8,  RANGE: 3 },
    HEAVY:      { HP: 80, DPS: 14, RANGE: 3 },
    SIPHON_MAST:{ HP: 50, DPS: 8,  RANGE: 3 }
  },

  Collapse: { RESCUE_WINDOW: 3.0, SEGMENT_INTERVAL: 3.0 },

  Adrift: {
    SPEED: 0.4, SEA_BEARING_MULT: 0.35,
    ATTRITION_PER_SECOND: 3, REBOUND_RADIUS: 1.0,
    FALLBACK_TIMER: 20.0        // used only if §33C is cut
  },

  Influence: {
    GREAT_TEMPLE_RADIUS: 8,
    TEMPLE_RADIUS: 5,
    FAVOR_PER_10S_PER_4_CELLS: 1,
    GATES_CONSTRUCTION: true,
    OVERLAP_BUILDABLE_BY_BOTH: true,
    OVERLAP_YIELDS_FAVOR: false
  },

  Priest: {
    HULL: 80, REQUIRED_FOR_TEMPLE: true,
    SUCCESSION_SECONDS: 25,
    FREE_MOVEMENT: false
  },

  Claim: {
    GREAT_TEMPLE_HP: 200,
    TEMPLE_BUILD_SECONDS: 10,
    NEUTRAL_OPEN_TO_ALL: true,
    RIVAL_CONNECT_BLOCKED_WHILE_TEMPLE_STANDS: true
  },

  Powers: {
    TAILWIND:  { FAVOR: 3, DURATION: 15, SPEED_MULT: 2.0, ASSAULT_MULT: 2.0 },
    WIND_WALL: { FAVOR: 4, DURATION: 12, DAMAGE_REDUCTION: 0.75 },
    TIDAL_SURGE: { DAMAGE: 40, RADIUS: 3 },
    FOG_BANK:    { DURATION: 20, BOLT_PENALTY: 0.5 }
  },

  Waves: {
    ORIGIN_FROM_NEAREST_TEMPLE: true,
    STRENGTH_BASE: 0.6, STRENGTH_PER_TEMPLE: 0.2,
    STRENGTH_MIN: 0.6, STRENGTH_MAX: 1.4,
    FIRST_AT: 45.0, TELEGRAPH: 8.0,
    INTERVAL_EARLY: 55.0, INTERVAL_MID: 45.0, INTERVAL_LATE: 35.0,
    AI_REROUTE_DELAY: 2.0, AI_REROUTE_COOLDOWN: 20.0
  },

  Wrath: { FAVOR_MULT: 1.5, ASSAULT_MULT: 1.25, DAMAGE_MULT: 1.25 },

  Tutorial: { RELEASE_AT: 28.0 }

});
```

## 33F.3 Dev tuning panel

A hidden overlay (toggled by a key or a long-press on the version string) that live-edits `CONFIG` and reports current wind bearing, per-branch transit times, and time-under-fire at both drift extremes.

This is the only practical way to satisfy the §33C requirement that gauntlet balance be checked at both ends of the drift cycle. Hide it for submission; there is no need to strip it.

---

# 33G. Adrift

What happens to a ship whose road stops existing beneath it.

## 33G.1 The rule

A hauler on a segment that loses support does not vanish, teleport home, or freeze. It goes **ADRIFT**.

```text
Segment loses support (or is destroyed) beneath a hauler
        ↓
hauler enters ADRIFT
        ↓
it is carried along the local wind vector (air) or surface drift (sea)
        ↓
it takes attrition damage continuously — it is outside a bound corridor
        ↓
   ┌──────────────┴───────────────┐
   ↓                              ↓
touches any SUPPORTED         hull reaches 0, or it
friendly segment              leaves the map
   ↓                              ↓
REBOUND — resumes transit,    DESTROYED — cargo lost
cargo intact, damage stops
```

## 33G.2 Why this is the right answer

**It is the lore, stated as physics.** A corridor is bound wind. Off it, the wind is feral — the very thing the guild stole is what tears an unbound askos apart. Nothing needs inventing.

**It makes severance legible at a glance.** A cut branch currently shows as stalled traffic and a piling stockpile. Now it also shows as ships visibly tumbling downwind, which reads instantly on a portrait screen.

**It creates a second rescue window.** The player already races to reconnect a decaying branch (§33C, §36). Now the reconnection also saves the fleet and its cargo. Same action, two payoffs, no new verb.

**Drift direction is predictable**, because the player can already see the wind (§21A.5). Where a stranded ship will go is readable, not random — so pushing a reconnection toward its drift path is a real tactical decision.

## 33G.3 Values

| Value | Starting number |
|---|---:|
| Drift speed | 0.4 cell / s |
| Drift bearing (air) | local wind vector (§21A) |
| Drift bearing (sea) | local wind vector × 0.35 — surface drift |
| Attrition | 3 HP / s |
| Rebound radius | 1.0 cell from any supported friendly segment |
| Survival window at full hull | ~20 s |

Twenty seconds is deliberately close to the branch-collapse rescue window. One reconnection either saves both the road and the fleet or arrives too late for both.

## 33G.4 Interactions

**Adrift ships are still targetable.** A sever near a mast chain is doubly punishing — the ship loses its road *and* drifts helplessly through fire. This is correct; it is why forward branches through contested water are a gamble.

**Poseidon suffers identically.** Cutting his lanes strands his triremes on the same rules, which gives the player's offensive verb a visible, satisfying consequence beyond a falling number.

**Rebounding onto a different corridor is allowed and encouraged.** A ship that blows onto an unrelated friendly branch simply joins it and routes home from there. Redundant loops (§21A.3) therefore quietly double as a recovery net — a second reason the circuit topology is correct.

**Coupling note:** this depends on hull integrity (§33C). If §33C is cut per §37.1, adrift ships instead expire on a flat 20 s timer with no attrition bar, and the rest of this section stands unchanged.

## 33G.5 Feedback

- envelope slackens, ship rotates off-heading and tumbles with the wind
- a dotted predicted-drift line renders from the ship for ~4 cells
- `ADRIFT ×3` counter in the HUD while any ship is stranded
- rebound plays the same rising chord as network reconnection

---

# 34. Core Internal Models

## Segment

```text
Segment
- id
- owner
- layer
- geometry
- rotation
- connections
- supportState
- durability
- decayTimer
- overWater        # air segments: attackable only if true (§33B.1)
- windAlignment    # cached dot product, refreshed on drift tick (§21A.1)
```

## Structure

```text
Structure
- id
- owner
- type              # radialGun | directionalGun | shield | temple | yard
- site              # endpointPort | islandPlot
- attachedSegment   # null when on an island plot
- health
- buildProgress     # §14.7.3 — half HP and non-functional while raising
- ports             # outgoing connections: gun 1, shield 2, temple 0, yard 0
- facing            # directional guns and shields only
- range / radius
- influenceRadius   # temples only
- destructionDamage # 50, outward segment only (§33A.5)
```

## Island

```text
Island
- id
- owner
- type
- anchorActive
- resourceType
- temple            # null | {owner, hp, buildProgress}
- plots[]            # 2, or 3 on a Temple (§14.4.2)
- reserve            # remaining minable resource (§33D.3)
- stockpile          # mined, awaiting collection
- hauler             # assigned on capture, retires on depletion
- influenceRadius    # active only while its Temple stands and is supported (§14.5)
```

## Hauler

```text
Hauler
- id
- owner
- homeIsland
- cargo
- capacity
- hullIntegrity      # §33C.2
- state              # transiting | dwelling | unloading | adrift | retired
```

---

# 35. Support Recalculation

After:

- route placement
- route destruction
- structure destruction
- island capture
- reconnection

perform:

1. start from all valid friendly anchors
2. graph-traverse friendly segments
3. mark reachable segments SUPPORTED
4. mark previously supported but now unreachable segments FRAYED
5. stop logistics on unsupported branches
6. start/update decay
7. recalculate connected islands
8. reactivate anything restored by reconnection

---

# 36. Collapse Algorithm

Conceptual behavior:

```text
if branch loses support:
    mark branch FRAYED
    start rescueTimer

after rescueTimer:
    choose unsupported segment nearest severed/open collapse edge
    collapse it
    expose next segment
    repeat on interval

if any surviving segment reconnects to anchor:
    cancel decay for all newly supported segments
```

Collapse should visually move through topology rather than deleting a whole branch simultaneously.

---

# 37. Three-Week Schedule

| Days | Work | Gate |
|---|---|---|
| **1–2** | Touch placement spike, **priest-tap spike (§14.8.7)**, portrait layer test, AI route spike | any major red flag → simplify |
| **3–6** | Grid, pieces, placement, support, collapse, map generator + validator | placement is fun by Day 6 |
| **7–10** | Structures, waves, combat, claim — build in the §37.1 order | Wave 5 works end-to-end |
| **11–14** | AI construction, divine powers, win/lose, endgame | full match playable |
| **15–17** | Tutorial, lore strings, feedback, visual pass, WebAudio, optional Codex | stranger plays without help |
| **18–19** | Packaging, offline validation, Design Intent, Build Log | airplane-mode test passes |
| **20–21** | Tuning and buffer | submission-ready |

## 37.1 Day 7–10 Is Oversubscribed

Read this before starting Day 7. The window originally held structures, waves, combat, and claim. It has since accumulated the gauntlet (§33C), influence radii (§14.5), hauling and depletion (§33D), and lift tiers (§33E). That is more than fits.

Build in this order and stop when the window ends:

1. **Hauling and depletion (§33D)** — replaces abstract income rather than adding to it; the judge pitch depends on it
2. **Influence radii (§14.5)** — cheap, and the only thing that makes the contested middle worth taking
3. **Lift tiers (§33E)** — cheap, and the session's visible growth curve
4. **Hull integrity and the gauntlet (§33C)** — most expensive, most tuning risk, and the only one nothing else depends on

**§33C is the designated cut.** It is already gated on Wave 5 working; treat it as the release valve for the whole window rather than as a feature to protect. If it goes, drop the vulnerability column from §33E.1 as well.

## Hard Gates

### Day 3

If air-vs-sea visual layering is not readable on a portrait phone, simplify immediately.

### Day 6

If placing route pieces is not fun, rethink the core interaction.

### Day 10

If Wave 5 sever/reconnect does not work, stop adding features and fix it.

### Day 14

If a full match cannot be played start-to-finish, cut systems.

---

# 38. Explicit Prototype Cuts

Do not implement for the competition:

- Gaia
- Zeus
- Earth layer
- Storm layer
- four-way counter ring
- throughput
- congestion
- saturation
- island structure sockets
- large repair system
- blessing trees
- Cross or Fork pieces
- faction selection
- free-form procedural maps (constrained generation IS in scope — §20A)
- multiplayer
- diplomacy
- heroes
- unit micromanagement
- dialogue
- cinematics
- named mortal characters
- complex economy
- large tech tree
- online features
- telemetry
- leaderboards

---

# 39. Future-State Pantheon

**Revised: storm is not a substrate.**

A substrate has to be *persistent, positional, and buildable*. Air, sea, and earth all are. Storm is transient and mobile by nature — a storm network that decays fast and drifts is not infrastructure, it is a weapon wearing a network's clothes. Making Zeus a buildable faction would break the grammar that everything else in this design rests on: **the network is territory**.

So Zeus does not get a layer. He gets the weather, and it falls on everyone.

## 39.1 Three substrates

| | Aeolus / Air | Poseidon / Sea | Gaia / Earth |
|---|---|---|---|
| Fantasy | *"I can go anywhere."* | *"You cannot cross my water."* | *"I reshape the map."* |
| Route | Wind corridors | Currents and lanes | Causeways and bridges |
| Wind effect | **strong** (0.70–1.35×) | slight (0.92–1.08×) | **none** |
| Speed | fastest | medium | slow |
| Durability | lowest | medium | highest |
| Decay when unsupported | fast | medium | slowest |
| Strength | mobility | denial | permanence |

**Gaia is the proof that wind is a faction mechanic, not a universal tax.** She plays the same game with the circuit optimisation removed entirely — no outbound/return bearing puzzle, no drift modulation, no Tailwind equivalent. Her routing question is purely spatial. That is a genuinely different feel from one shared codebase, and it is the strongest argument for building her third.

Her signature is physical: **a causeway blocks a sea lane.** Earth is the only substrate that occupies the surface, so Gaia alone can deny another faction's routes by existing rather than by shooting.

## 39.2 Hades as the fourth substrate

If a fourth is wanted, it is **Hades, not Zeus** — and the mythology already says so. The three brothers divided the world by lot: Zeus took the sky, Poseidon the sea, Hades the underworld. Earth was left common ground. **The lots are the layers.**

| | Hades / Underworld |
|---|---|
| Fantasy | *"You never saw me coming."* |
| Route | Chthonic passages, the underworld rivers |
| Wind effect | none |
| Speed | fast |
| Durability | high — nothing above ground can reach it |

Three properties make it a real substrate rather than a reskin:

**It is invisible from the surface.** Underworld routes do not appear on any enemy's map without a specific counter. This plugs straight into the vision system of §14B and is an entirely new strategic axis — the other three factions fight over ground they can all see.

**It surfaces only at portals.** Passages emerge at caves, chasms, and springs — a limited, generated set of points (§20A). Hades therefore has the fastest network in the game and the fewest exits from it. He is a shortcut, not a road.

**He is wealth.** Hades is *Plouton*, "the rich one" — the mineral wealth of the underground is his, which is where the name Pluto comes from. He does not haul from island reserves the way the others do; he draws from beneath them, including from islands another faction has claimed. His economic conflict is with everyone at once.

His counter is the counter to invisibility, not to firepower: Gaia's grounded structures sense him, Poseidon's springs and wells reveal his portals.

## 39.3 Zeus as weather, not a faction

Zeus becomes an **environmental system affecting all four substrates simultaneously**, escalating over a match:

- storm fronts drift across the map and unmake corridors through shear and downdraft (§40)
- lightning washes harmlessly over healthy bronze-framed hulls — the Faraday bluff
- but ignites any airship already venting, and takes its corridor with it
- rough water slows sea lanes; nothing much troubles earth

This preserves every hook already protected in §40 while removing the design problem. It also gives the full game a neutral pressure that pushes four rival networks toward each other, which is exactly what a four-way match needs.

## 39.4 Revised interaction ring

The old ring was `STORM → AIR → WATER → EARTH → STORM`, which only closed because storm was forced into it.

The honest structure is not a ring:

```text
AIR      over everything, reaches everywhere, fragile everywhere
SEA      denies the surface, cannot reach the sky or below it
EARTH    blocks the sea, anchors against everything, slow
UNDER    unseen by all three, but can only surface where portals allow

ZEUS     falls on all of them
```

Every relationship should be spatial and visible — a causeway physically obstructing a lane, a passage surfacing behind a defended line — never an arbitrary damage bonus.

## 39.5 Build order, if this is ever built

1. **Gaia third.** Cheapest to add (same graph, no wind term, one new blocking interaction) and it validates that the substrate system generalises.
2. **Zeus as weather fourth.** No new network code at all, only an environmental layer.
3. **Hades last.** The most novel and the most expensive — hidden networks require a whole vision counter-system and portal generation.

**None of this is prototype scope.** The three-week build ships Aeolus versus Poseidon.

---

# 40. Protected Future-State Lore Hooks

Grievances are catalogued in §4.2.1 and the faction roster in §39. This section protects the one hook that constrains prototype code: **do not write lore or code that contradicts it.**

## Zeus — weather, not a faction

Zeus does not build a network (§39.3). Storm is transient and mobile and cannot be a substrate. He becomes an environmental system falling on all four layers at once.

### The bluff: lightning is not the threat

Real rigid airships handled lightning extremely well. A metal-framed hull is a Faraday cage: strikes travel around the outside and off again, and hydrogen sealed inside a cell cannot burn because there is no oxygen in there. The *Graf Zeppelin* flew roughly a million miles, was struck repeatedly, and was never harmed by it. The *Hindenburg* was not struck at all — the leading explanation is a static discharge igniting hydrogen already venting from a damaged cell.

The askoi of this world are bronze-ribbed. **Canonically they are Faraday cages too**, and Zeus's lightning should visibly wash over a healthy ship and do nothing. Establish this early and let the player feel safe.

### The real threat: the air, not the electricity

What actually destroyed airships was weather. *Shenandoah* was torn apart by a squall line in 1925. *Akron* was driven into the sea by a downdraft in 1933, killing 73 — still the worst airship disaster. *Macon* failed structurally in weather in 1935. Vertical air and shear, every time.

So Zeus is not a unit-killer. He is an **infrastructure-killer**:

- downdrafts shove ships out of their corridor
- shear breaks the binding itself
- his storm fronts unmake roads rather than destroying vessels

Which is the game this project is actually about.

### The conditional fire

Ignition stays available, but only as a finisher, and it hooks directly into the gauntlet system of §33C:

> **An Arc Pylon does nothing to a healthy askos. Against one already venting — hull integrity below threshold — it ignites. The ship is destroyed and the corridor it occupied is destroyed with it.**

Poseidon's masts grind a ship down; Zeus finishes it catastrophically. Two hostile gods combining into an effect neither can produce alone is a rare thing to get for free, and the physics hands it over.

Storm-vs-Air should eventually become one of the most feared interactions in the game — but through weather and conditional ignition, not through lightning bolts hitting healthy hulls.

## Gaia

Every airship consumes iron and material taken from the Earth to escape the Earth.

## Hephaestus

The chemistry and bronze work are mortal applications of forge craft used for a purpose the forge god may not have intended.

Whether Hephaestus is offended or quietly complicit should remain unresolved.

## Prometheus

The thematic echo should remain implicit:

mortals use a dangerous stolen-like technological gift to rise above their station.

Do not explicitly explain this in game.

---

# 41. Narrative Things Not to Build

No:

- opening cinematic
- narrator
- named protagonist
- admiral/captain character
- dialogue tree
- between-wave conversation
- lore progression system
- collectible lore fragments
- cutscene
- mandatory Codex
- exposition wall

The wave banner is already the story beat.

The tutorial instruction is already the lore delivery.

---

# 42. Prototype Learning Curve

Within **15 seconds**:

> “I build my network with route pieces.”

Within **30 seconds**:

> “The airships travel only where I have bound the wind.”

Within **60 seconds**:

> “My defenses only exist where the network reaches.”

Within **90 seconds**:

> “Poseidon is attacking the network itself.”

By **Wave 5**:

> “That whole branch is coming apart.”

Seconds later:

> “I can save it by reconnecting.”

By the end:

> “I need to cut his network while protecting mine.”

If those realizations happen naturally, the prototype works.

---

# 42A. Design Intent Document Guidance

Maximum 500 words, `.docx`, text only, anonymous, unscored but read by judges. It provides context; it is not a lore vehicle.

Suggested budget:

| Section | Words | Content |
|---|---:|---|
| What the game is | ~100 | The judge pitch from §2, expanded |
| Who the players are | ~75 | Strategy and tower-defense players who like systems; mobile sessions |
| What the prototype contains | ~200 | The feature list actually built — network placement, structures, waves, collapse, reconnection, temple claim, AI, win/lose |
| Future-state vision | ~125 | Four gods, four physical layers, the counter ring, and one line on storms unmaking corridors and igniting already-venting ships |

Lore gets **one sentence**, not a section:

> *Players serve Aeolus as high priest, flying cargo along winds their god grants them, against a sea god whose worshippers no longer need him.*

Anonymity applies to this file's metadata as well as its text — check document properties for author name before export.

---

# 43. Submission Checklist

- [ ] Category: Tower Defense & Strategy
- [ ] Single-player
- [ ] Portrait orientation
- [ ] Three.js / HTML5
- [ ] Fully offline
- [ ] No external runtime network calls
- [ ] `index.html` at ZIP root
- [ ] Entrant-authored game code consolidated into `index.html`
- [ ] Code readable and unminified
- [ ] Three.js under `/vendor`
- [ ] All assets local
- [ ] ZIP ≤35 MB
- [ ] Route placement works
- [ ] Supported/open endpoint rule implemented
- [ ] Structure placement works, on endpoints and island plots
- [ ] Structure destruction destroys its outward adjacent segment
- [ ] Unsupported branch collapse works
- [ ] Reconnection cancels collapse
- [ ] Supply works
- [ ] Favor works
- [ ] Island capture works
- [ ] 9-wave escalation works
- [ ] Wave 5 signature sequence works reliably
- [ ] Divine powers work
- [ ] Bolt Battery can damage Poseidon sea segments
- [ ] Over-water rule enforced: island-crossing segments are immune
- [ ] Lee-shore rule enforced: sea segments within 1 cell of coast are immune
- [ ] Generator guarantees an open channel between corners
- [ ] AI prefers sheltered lanes below a 1.5x detour, open channel when racing
- [ ] Emplacements can be built on controlled-island plots as well as network endpoints
- [ ] Influence gates all construction; nothing builds outside it
- [ ] Overlapping influence is buildable by both sides and yields Favor to neither
- [ ] Any side may connect to a temple-less island
- [ ] Completing a Temple claims the island and crumbles opposing connections from it
- [ ] A rival cannot reconnect until that Temple is destroyed
- [ ] Destroying a Temple returns the island to neutral
- [ ] A Temple under construction is visible, interruptible, and audibly distinct
- [ ] All structures build over time at half HP and can be interrupted
- [ ] Route pieces remain instant
- [ ] Haulers are purchased at yards, not spawned free
- [ ] Yard count caps fleet size; destroying a yard prevents replacement only
- [ ] Opening is not a dead start: Great Temple supports 2 haulers, 1 starts built
- [ ] Founding a Temple requires the priest present for the full build
- [ ] Priest moves by one tap along the existing network, and nowhere else
- [ ] Priest goes adrift and can be rescued by reconnection
- [ ] Priest death blocks new Temples for 25 s but is not a lose condition
- [ ] Poseidon's priest obeys identical rules and is targetable
- [ ] Poseidon builds Temples to contest player influence
- [ ] Every roster role exists on both sides (§14A.1)
- [ ] Routes and structures can be built onward from a structure's ports
- [ ] A shield intercepts for what is behind it and passes friendly fire
- [ ] Destroying an inline structure severs the branch beyond it
- [ ] Fog hides enemy craft and network but never terrain
- [ ] Seen enemy structures stay drawn; enemy craft do not
- [ ] The AI obeys the same vision rules
- [ ] Ships go adrift when their segment loses support
- [ ] Adrift ships rebound onto any supported friendly segment
- [ ] Adrift drift bearing follows the visible wind
- [ ] Poseidon's ships go adrift on the same rules
- [ ] Map generates deterministically from a seed; same seed gives the same map
- [ ] Seed is displayed and can be entered
- [ ] All ten validation invariants enforced, with re-roll and golden-seed fallback
- [ ] Wind field affects air speed strongly and sea speed slightly
- [ ] Wind is visible in water, trees, smoke, and the placement ghost
- [ ] Wind drifts ±30° and never reverses
- [ ] A circuit measurably out-earns an out-and-back spur
- [ ] Hot-air start; hydrogen unlock retrofits the whole fleet visibly
- [ ] Hydrogen unlock lands before Wave 5 for a typical player
- [ ] All tunable values live in a single frozen CONFIG block, no literals in system logic
- [ ] CONFIG block appears at the top of `index.html`
- [ ] Resources are mined to a local stockpile and credited only on delivery
- [ ] Islands deplete; haulers retire when their island runs dry
- [ ] A severed route visibly piles up stockpile at the stranded island
- [ ] A disconnected island's emplacements go dark until reconnected
- [ ] Airship hull integrity, regeneration, and destruction work
- [ ] A three-mast gauntlet reliably kills a ship; a gapped pair does not
- [ ] Convoy loss is legible: wreck marker, ticker, visible venting
- [ ] Tailwind measurably improves survival through a gauntlet
- [ ] Poseidon's network collapses under the same rules
- [ ] AI reroutes after a successful cut, with cooldown
- [ ] Waves launch from Poseidon's nearest Temple, not from off-map
- [ ] Destroying a forward Temple pushes the next wave's origin back
- [ ] Wave strength scales with his Temple count, floored so he always attacks
- [ ] Wave schedule stays fixed regardless of strength
- [ ] Temple capture is achievable within a 7-minute match
- [ ] AI builds visibly
- [ ] Win works
- [ ] Lose works
- [ ] Reset works
- [ ] Real-time feedback is legible
- [ ] Tutorial can be skipped
- [ ] Air-vs-sea layers readable on a real phone
- [ ] Airplane-mode test passes
- [ ] Design Intent ≤500 words, `.docx`, anonymous
- [ ] Build Log `.md`
- [ ] All submission text English
- [ ] No identifying information in code comments, metadata, repository URLs, filenames, or page title

---

# 44. Final Design Rule

Before adding anything, ask:

> **Does this make building, defending, severing, or reconnecting the network more interesting within the next three weeks?**

If not:

# CUT IT.

The competition build is not trying to prove a full RTS.

It is trying to prove one memorable idea:

> **Infrastructure is territory. Logistics is power. When the network fails, the battlefield physically unravels—and the player can still save it.**
