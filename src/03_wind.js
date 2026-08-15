// ================================================================
// WIND FIELD — a coarse vector field interpolated across the grid.
// Air routes are carried by it strongly, sea lanes barely (§21A).
// The whole field drifts +/-30 degrees on a ~90 s cycle, never reversing.
// ================================================================

class WindField {
  // baseAngles: FIELD_W x FIELD_H array of radians, generated with the map.
  constructor(baseAngles) {
    this.baseAngles = baseAngles;
    this.time = 0;
  }

  driftAngle() {
    const W = CONFIG.Wind;
    return (W.DRIFT_DEGREES * Math.PI / 180) * Math.sin((this.time * 2 * Math.PI) / W.DRIFT_PERIOD);
  }

  // Unit wind vector at grid position (x, z) — bilinear over field nodes,
  // then rotated coherently by the current drift.
  at(x, z) {
    const W = CONFIG.Wind, G = CONFIG.Grid;
    const fx = clamp(x / (G.WIDTH - 1), 0, 1) * (W.FIELD_W - 1);
    const fz = clamp(z / (G.HEIGHT - 1), 0, 1) * (W.FIELD_H - 1);
    const x0 = Math.floor(fx), z0 = Math.floor(fz);
    const x1 = Math.min(x0 + 1, W.FIELD_W - 1), z1 = Math.min(z0 + 1, W.FIELD_H - 1);
    const tx = fx - x0, tz = fz - z0;
    // Interpolate as vectors to avoid angle-wrap artifacts.
    const a00 = this.baseAngles[z0][x0], a10 = this.baseAngles[z0][x1];
    const a01 = this.baseAngles[z1][x0], a11 = this.baseAngles[z1][x1];
    const vx = lerp(lerp(Math.cos(a00), Math.cos(a10), tx), lerp(Math.cos(a01), Math.cos(a11), tx), tz);
    const vz = lerp(lerp(Math.sin(a00), Math.sin(a10), tx), lerp(Math.sin(a01), Math.sin(a11), tx), tz);
    const drift = this.driftAngle();
    const c = Math.cos(drift), s = Math.sin(drift);
    const rx = vx * c - vz * s, rz = vx * s + vz * c;
    const len = Math.hypot(rx, rz) || 1;
    return { x: rx / len, z: rz / len };
  }

  // Speed multiplier for a segment direction (unit dx,dz) at (x,z).
  multiplier(x, z, dx, dz, isAir) {
    const w = this.at(x, z);
    const alignment = dx * w.x + dz * w.z;              // -1 .. +1
    const t = (alignment + 1) / 2;
    const W = CONFIG.Wind;
    return isAir ? lerp(W.AIR_MIN, W.AIR_MAX, t) : lerp(W.SEA_MIN, W.SEA_MAX, t);
  }

  tick(dt) { this.time += dt; }
}
