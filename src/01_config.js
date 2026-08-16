// ================================================================
// CONFIG — every tunable value in the game lives here, frozen.
// No numeric literal may appear in system logic; systems read CONFIG.
// ================================================================
'use strict';

// The world is sized in portrait screens: COLS x ROWS tiles of roughly
// CELLS_X x CELLS_Z grid cells each. Bigger maps generate extra neutral
// stepping-stone islands automatically.
const MAP_SIZE = { SCREEN_COLS: 3, SCREEN_ROWS: 3, CELLS_X: 6, CELLS_Z: 10 };

const CONFIG = Object.freeze({

  Grid: {
    WIDTH: MAP_SIZE.SCREEN_COLS * MAP_SIZE.CELLS_X,
    HEIGHT: MAP_SIZE.SCREEN_ROWS * MAP_SIZE.CELLS_Z,
    CELL_SECONDS: 1.0,
    REF_WIDTH: 12, REF_HEIGHT: 20   // the spec's reference map; distances scale from it
  },

  MapGen: {
    USE_TIME_NONCE: true,
    OPEN_CHANNEL_MIN_CELLS: 4,
    AI_SHELTER_DETOUR_MAX: 1.5,
    GOLDEN_SEED: "wndwrd1",     // fallback if validation exhausts; replaced by a verified seed
    MAX_REROLLS: 50,
    RESERVE_VARIANCE: 0.20,
    ASYMMETRY_CELLS: 2,
    MIN_ISLAND_SEPARATION: 3,
    HOME_TO_INTERIOR_MIN: 8, HOME_TO_INTERIOR_MAX: 12,
    EXPOSED_OVERWATER_MIN: 5,
    SAFE_ROUTE_OVERWATER_MAX: 2, SAFE_ROUTE_LENGTH_MULT: 1.4,
    CHOKEPOINT_OVERWATER_FRACTION: 0.80,
    CHOKEPOINT_REGION_RADIUS: 3,
    CIRCUIT_DOT_SEPARATION: 0.5,
    CIRCUIT_MIN_ALIGNMENT: 0.15,
    CORNER_TO_CORNER_MIN: 18,
    ISLAND_SIZE_MIN: 5, ISLAND_SIZE_MAX: 8,
    TEMPLE_ISLAND_SIZE_MIN: 8, TEMPLE_ISLAND_SIZE_MAX: 10,
    SHIELD_ISLAND_MAX_DIST: 6,
    WIND_NOISE_DEGREES: 15,
    WIND_SHEAR_DEG_PER_CELL: 30,
    WIND_SHEAR_CLAMP_DEG: 150,
    FILLER_GAP_MAX: 4,           // chain gaps wider than this grow a stepping stone
    FILLER_SIZE_LO: 3, FILLER_SIZE_HI: 4,
    FILLER_RESERVE_MULT: 0.5,
    SCATTER_PER_CELLS: 90        // one extra scattered neutral per this many cells beyond the reference map
  },

  Wind: {
    FIELD_W: 6, FIELD_H: 10,
    AIR_MIN: 0.70, AIR_MAX: 1.35,
    SEA_MIN: 0.92, SEA_MAX: 1.08,
    DRIFT_DEGREES: 30, DRIFT_PERIOD: 90.0
  },

  Economy: {
    START_SUPPLY: 100, START_FAVOR: 100,
    TEMPLE_SUPPLY_PER_10S: 3, TEMPLE_FAVOR_PER_10S: 6,   // sweep-derived floor: rebuild insurance when territory is lost
    INCOME_TICK_SECONDS: 10.0,
    REROLL_FAVOR: 1
  },

  // NetStorm-style reclamation and blood money (player-directed)
  Salvage: {
    STRUCTURE_REFUND: 0.5,   // fraction of build cost returned, in Supply
    SEGMENT_FAVOR: 1         // Favor returned per unbuilt route segment
  },
  Bounty: {                  // death pleases the gods: paid to the killer's side
    CRAFT_FAVOR: { transport: 2, siphon: 3, heavy: 5 },
    STRUCTURE_SUPPLY_FRACTION: 0.25
  },

  Mining: {
    RATE_PER_SECOND: 2,
    RESERVE_MIN: 500, RESERVE_MAX: 1500   // every ore island draws in this band
  },

  Hauler: {
    DWELL_SECONDS: 4.0, UNLOAD_SECONDS: 2.0,
    HOTAIR_CAPACITY: 12, HYDROGEN_CAPACITY: 24,   // sweep-optimized (test/opt_capacity.js): 24+ floods supply with 500-1500 reserves
    COST: 5, BUILD_SECONDS: 6,   // sweep-optimized (test/opt_costs.js): cheap haulers = more logistics on the board, better on every seed
    START_COUNT: 1,
    SPEED: 1.0                    // cells per second, base, x wind multiplier
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
    FAVOR_COST: 3   // flat per piece; sweep-optimized (test/opt_favor.js): 1-5 play identically, 3 makes the price felt while leaving budget for powers
  },

  Structures: {
    TEMPLE:   { COST: 14, HP: 100, RADIUS: 5, BUILD_SECONDS: 10 },
    VANE:     { COST: 7,  HP: 45,  DPS: 6,  RADIUS: 2 },
    DRUM:     { COST: 7,  HP: 60,  DPS: 5,  RADIUS: 2 },
    BOLT_DIR: { COST: 10, HP: 50,  DPS: 16, RANGE: 6, ARC_DEG: 90, TURN_DEG_S: 45 },
    LANCE:    { COST: 10, HP: 70,  DPS: 13, RANGE: 6, ARC_DEG: 90, TURN_DEG_S: 45 },
    AEGIS:    { COST: 12, HP: 130, INTERCEPT: 0.70, ARC_DEG: 120 },
    BULWARK:  { COST: 12, HP: 160, INTERCEPT: 0.70, ARC_DEG: 120 },
    // player-directed: defenses are solid — they cap a route dead, accept
    // no onward attachment, and block transit (ships/priests can't pass)
    PORTS_GUN: 0, PORTS_SHIELD: 0, PORTS_ALTAR: 0,
    SHIELD_COVER_RADIUS: 2.5,
    PORTS_YARD: 0, PORTS_GREAT_TEMPLE: 4, PORTS_ISLAND_TEMPLE: 4,
    PLOTS_PER_ISLAND: 2, PLOTS_PER_TEMPLE: 3,
    DESTRUCTION_DAMAGE: 50,
    GUN_VS_SEGMENT_MULT: 0.45   // guns cut lanes, but slowly - no single-gun blockade; sweep-validated (opt_difficulty.js): beats 0.3 and 0.65 at every difficulty
  },

  Segments: { AIR_HP: 40, SEA_HP: 55, LEE_SHORE_CELLS: 1 },

  Vision: {
    STRUCTURE: 6, TEMPLE: 8, HAULER: 4, SEGMENT: 2,
    REMEMBER_STRUCTURES: true, REMEMBER_CRAFT: false
  },

  Craft: {
    REACH_FROM_LANES: 3.0,   // his craft operate only in waters his network reaches
    TRANSPORT:  { HP: 42, DPS: 4,  RANGE: 2.2, SPEED: 0.9 },   // assault parties reach a short way inland
    SIPHON:     { HP: 62, DPS: 6,  RANGE: 3, SPEED: 0.8 },
    HEAVY:      { HP: 112, DPS: 14, RANGE: 3, SPEED: 0.65 },
    SIPHON_MAST:{ HP: 50, DPS: 8,  RANGE: 3 }
  },

  // SEGMENT_INTERVAL is macro-insensitive in sim (test/opt_collapse.js:
  // identical matches from 1.5 to 900) — set by feel: severed enemy
  // branches should clear fast enough that the board never reads unfair
  Collapse: { RESCUE_WINDOW: 3.0, SEGMENT_INTERVAL: 2.0 },

  Adrift: {
    SPEED: 0.4, SEA_BEARING_MULT: 0.35,
    ATTRITION_PER_SECOND: 3, REBOUND_RADIUS: 1.0,
    STRAND_GRACE: 4.0,           // idle on a dark island this long -> the mooring slips
    FALLBACK_TIMER: 20.0
  },

  Influence: {
    GREAT_TEMPLE_RADIUS: 8,
    TEMPLE_RADIUS: 5,
    FAVOR_PER_10S_PER_4_CELLS: 1,
    FAVOR_CELL_DIVISOR: 16,   // sweep-derived: territory favor is lean, so every cast competes with roads
    GATES_CONSTRUCTION: true,
    OVERLAP_BUILDABLE_BY_BOTH: true,
    OVERLAP_YIELDS_FAVOR: false
  },

  Priest: {
    HULL: 80, REQUIRED_FOR_TEMPLE: true,
    SUCCESSION_SECONDS: 25,
    FREE_MOVEMENT: false,
    SPEED: 1.0
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
    TIDAL_SURGE: { DAMAGE: 40, RADIUS: 3, COOLDOWN: 30.0 },
    FOG_BANK:    { DURATION: 20, BOLT_PENALTY: 0.5, RADIUS: 5, COOLDOWN: 40.0 }
  },

  Waves: {
    ORIGIN_FROM_NEAREST_TEMPLE: true,
    STRENGTH_BASE: 0.6, STRENGTH_PER_TEMPLE: 0.15,   // sweep-validated (test/opt_difficulty.js): 0.15/1.4 beats steeper and softer ramps
    STRENGTH_MIN: 0.6, STRENGTH_MAX: 1.4,
    FIRST_AT: 45.0, TELEGRAPH: 8.0,   // sweep-validated (test/opt_pacing.js): x0.8 starves his buildup, x1.25 makes waves toothless
    INTERVAL_EARLY: 55.0, INTERVAL_MID: 45.0, INTERVAL_LATE: 35.0,
    MID_FROM_WAVE: 4, LATE_FROM_WAVE: 7,
    COUNT: 9,
    AI_REROUTE_DELAY: 2.0, AI_REROUTE_COOLDOWN: 20.0,
    // authored composition per wave: [transports, siphons, heavies]
    COMPOSITION: [
      [2, 0, 0],
      [3, 0, 0],
      [4, 0, 0],
      [3, 2, 0],
      [2, 3, 1],   // wave 5: scripted heavy strike on most forward structure
      [3, 3, 1],
      [4, 3, 1],
      [4, 4, 2],   // AGE OF WRATH
      [5, 4, 2]
    ],
    TWO_FRONT_FROM_WAVE: 3
  },

  Wrath: { WAVE: 8, FAVOR_MULT: 1.5, ASSAULT_MULT: 1.25, DAMAGE_MULT: 1.25 },

  AI: {
    PLACE_INTERVAL: 1.5,          // seconds between visible AI piece placements
    SHELTER_DETOUR_MAX: 1.5,      // prefers sheltered lanes below this detour factor
    MAST_INTERVAL: 30.0,          // tries to raise a siphon mast this often
    TEMPLE_PRIORITY_OVERLAP: true,
    DECISION_INTERVAL: 2.0,
    PRIEST_AVOIDS_GUNS: true
  },

  Tutorial: { RELEASE_AT: 28.0 },

  Render: {
    AIR_ALTITUDE: 1.15, SEA_ALTITUDE: 0.04, ISLAND_HEIGHT: 0.34,
    CAM_HEIGHT: 13.8, CAM_BACK: 6.1, CAM_FOV: 46,
    PAN_MARGIN: 1.0,
    TAP_DRAG_THRESHOLD_PX: 10,
    TAP_SNAP_CELLS: 1.35,        // taps snap to the nearest socket/site within this
    SHROUD_OPACITY: 1.0,
    WHITECAP_PER_CELLS: 1.6,   // one wind streak per this many water cells
    RIBBON_PARTICLES: 4,
    FOAM_OPACITY: 0.5,
    FRAYED_DESAT: 0.45
  }

});
