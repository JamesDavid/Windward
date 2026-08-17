# WINDWARD — The Age of Air

## Inspiration

Two loves collided: the classic 90s bridge-network RTS where your roads *were* your army, and Greek mythology's pettiest grudge — a god who is owed honour and not paid. When the shipwrights of a Greek archipelago discover lift, the Air Guild turns to Aeolus, keeper of the winds, who binds Odysseus' lost gales into roads across the sky. Cargo starts crossing without paying the sea. Poseidon is passed over — and his tide comes nine times to collect.

The design bet: **one road, five jobs**. A single system — the bound-wind road — is simultaneously your movement, your income, your map reach, your attack surface, and your drama. Everything else in the game exists to make that one system matter more.

## What it does

A portrait, one-thumb tower-defense/strategy prototype in three.js. You lay paths of bound air island to island, hang defenses and aimed gun batteries on their open ends, claim islands with your priest, and run an ore economy on haulers that ride your own roads — while nine escalating tides, then Poseidon's endless wrath, try to cut them. Roads are invulnerable along their length; the raw ends are the joints. Sever a branch and it visibly unbinds segment by segment while you race to reconnect it.

The wind is a law, not a decoration: fleets route only on wind-favorable channels, a road built into the teeth of the prevailing wind runs on the god's held current at reduced speed, and building a loop makes the airflow *become* a loop. Every match ends in a verdict — assault, defeat, or Zeus weighing the whole board (temples, roads, fleets, treasury) and ruling for the stronger claim. You can refuse his ruling and fight to the death.

## How we built it

**Entirely by prompting an AI agent** (Claude Code). Every system — deterministic map generation with 12 validated invariants, the support-graph collapse mechanic, the wind field, procedural ships and temples, WebAudio-synthesized sound — was prompt-built, with an 84-row build log recording every prompt-to-commit step.

The distinctive part: **the game balances and plays itself**. Ten headless parameter-sweep harnesses priced every constant in the config (starting currency, wind-law fractions, bounties, difficulty) by scoring hundreds of simulated matches. Then we went further and used **genetic algorithms** (~2,000 headless matches): first evolving a champion strategy for the player's side — which exposed that the demo AI wasn't dumb, it was *disarmed*, missing the actions needed to win — then evolving **Poseidon himself** against that champion, grading the evolved population into a four-tier difficulty ladder (CALM → STERN → ANGRY → ENRAGED). In-game, Zeus's own arbitration scales silently move Poseidon up and down that ladder every wave, his temper reads out live in the HUD, and he *remembers you* between sessions. The WATCH A MATCH mode is the evolved champion playing the real UI — every button lights as it presses it — as a wordless tutorial.

## Challenges we ran into

- **The wind law nearly killed the game.** A strict "no flying against the wind" rule starved the reference economy for an entire match (headless proof: a road home whose legs never opened under wind drift). The fix became the best mechanic: your own bound channels hold a minimum current, routing prefers true tailwinds, and loops circulate.
- **Stalemates.** A census showed half of all matches fizzling after the ninth wave. Wrath tides plus the weighed Zeus verdict made every match end with a screen, never a shrug.
- **Headless ≠ live.** The round-2 evolved champion (6-for-6 kills headless) *collapsed* when piped through the demo's one-action-at-a-time menu theatre — different act rates are different games. The demo keeps the round-1 doctrine that fits its tempo.
- **Trust the phone, not the emulator.** Software-rendered screenshots hid a GPU shader bug (a GLSL variable shadowing a builtin) and a frozen-water NaN that only live-device debugging caught.

## What we learned

Every mechanics change re-prices every tuned number — so make retuning cheap and automatic. Evolution finds what you didn't design (the hard tiers attack with *faster* waves, not bigger ones). And an AI agent can carry a genuinely large build if you make it keep the receipts: the build log, the test battery, and the sweep harnesses were as important as the game code.

## What's next

The full pantheon: four priesthoods building networks across the lots the gods drew — sky, sea, land, underworld — under Zeus's weather.
