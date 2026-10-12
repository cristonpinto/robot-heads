import * as THREE from 'three';
import { GROUND, type Rig } from './model';

export type OwlState = 'idle' | 'thinking' | 'searching' | 'listening' | 'speaking' | 'working' | 'happy' | 'error' | 'sleeping';

/* Every channel the owl is moved by. A state sets the target of each; the
   pose eases to it, so switching states is a smooth change of mood. */
interface Pose {
  yaw: number; pitch: number; roll: number;
  lid: number; squint: number; browL: number; browR: number; browTilt: number;
  tuft: number; glow: number; beak: number; px: number; py: number; puff: number; eye: number; red: number;
  dots: number; zs: number; sparks: number; arcs: number; cross: number;
}

const keys = ['yaw', 'pitch', 'roll', 'lid', 'squint', 'browL', 'browR', 'browTilt', 'tuft', 'glow', 'beak', 'px', 'py', 'puff', 'eye', 'red', 'dots', 'zs', 'sparks', 'arcs', 'cross'] as const;

const BASE_YAW = 0.14;

function rest(): Pose {
  return { yaw: 0, pitch: 0, roll: 0.1, lid: 0, squint: 0, browL: 0, browR: 0, browTilt: 0, tuft: 0, glow: 0.7, beak: 0, px: -0.2, py: 0, puff: 1, eye: 1.1, red: 0, dots: 0, zs: 0, sparks: 0, arcs: 0, cross: 0 };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/* what each state asks for at time t */
function target(state: OwlState, t: number, ph: number, p: Pose): void {
  Object.assign(p, rest());
  const w = Math.sin(t * 0.7 + ph * 6);
  switch (state) {
    case 'idle':
      p.yaw = 0.4 * w + 0.15 * Math.sin(t * 1.9 + ph);
      p.roll = 0.1 + 0.07 * Math.sin(t * 0.5 + ph * 3);
      p.px = 0.4 * Math.sin(t * 0.9 + ph * 4);
      p.py = 0.2 * Math.sin(t * 0.6 + ph);
      p.glow = 0.55 + 0.25 * Math.sin(t * 2);
      p.tuft = 0.1 * Math.sin(t * 1.3);
      break;
    case 'thinking':
      p.pitch = -0.16;
      p.roll = 0.3 * Math.sin(t * 0.45 + ph * 6) + 0.05;
      p.yaw = 0.2 * Math.sin(t * 0.45 + ph * 6 + 1);
      p.px = -0.45;
      p.py = 0.6;
      p.browL = 0.45;
      p.browR = -0.1;
      p.squint = 0.12;
      p.tuft = 0.2 + 0.2 * Math.sin(t * 3);
      p.glow = 0.5 + 0.5 * Math.abs(Math.sin(t * 3.4));
      p.dots = 1;
      break;
    case 'searching':
      p.yaw = 0.9 * Math.sin(t * 1.3 + ph * 6);
      p.px = Math.sin(t * 1.3 + ph * 6 + 0.5) * 0.7;
      p.roll = 0.04;
      p.browL = p.browR = 0.2;
      p.eye = 1.18;
      p.tuft = 0.5;
      p.glow = 0.5 + 0.5 * Math.abs(Math.sin(t * 4.5));
      break;
    case 'listening':
      p.roll = 0.36 + 0.04 * Math.sin(t * 1.5);
      p.pitch = 0.04 * Math.sin(t * 3.2);
      p.eye = 1.2;
      p.browL = p.browR = 0.3;
      p.tuft = 1;
      p.glow = 0.9;
      p.arcs = 1;
      p.px = 0.1;
      break;
    case 'speaking': {
      const m = Math.abs(Math.sin(t * 9) * 0.6 + Math.sin(t * 5.3 + ph) * 0.4);
      p.beak = m;
      p.pitch = 0.05 * Math.sin(t * 9);
      p.yaw = 0.2 * Math.sin(t * 1.4 + ph);
      p.roll = 0.08;
      p.browL = p.browR = 0.1 + 0.2 * m;
      p.glow = 0.7 + 0.3 * m;
      p.tuft = 0.15;
      break;
    }
    case 'working':
      p.pitch = 0.3;
      p.roll = 0.04 + 0.03 * Math.sin(t * 6);
      p.py = -0.65;
      p.squint = 0.25;
      p.browTilt = 0.3;
      p.glow = 0.55 + 0.45 * Math.abs(Math.sin(t * 5));
      break;
    case 'happy':
      p.squint = 0.42;
      p.roll = 0.1 + 0.12 * Math.sin(t * 5);
      p.yaw = 0.25 * Math.sin(t * 2.5);
      p.browL = p.browR = 0.4;
      p.tuft = 0.8;
      p.beak = 0.25 + 0.2 * Math.sin(t * 5);
      p.glow = 1;
      p.sparks = 1;
      break;
    case 'error':
      p.yaw = 0.45 * Math.sin(t * 13);
      p.roll = 0;
      p.lid = 1;
      p.cross = 1;
      p.browTilt = -0.4;
      p.puff = 1.05;
      p.tuft = 0.7;
      p.red = 1;
      p.glow = 0.4 + 0.6 * (Math.sin(t * 8) > 0 ? 1 : 0);
      break;
    case 'sleeping':
      p.lid = 1;
      p.pitch = 0.36;
      p.roll = 0.2;
      p.puff = 1.04 + 0.012 * Math.sin(t * 1.4);
      p.glow = 0.08;
      p.tuft = -0.4;
      p.browL = p.browR = -0.12;
      p.eye = 1;
      p.zs = 1;
      break;
  }
}

/** The owl's still pose for a state, used for reduced motion and `paused`. */
export function restPose(state: OwlState): Pose {
  const p = rest();
  target(state, 0.8, 0.3, p);
  return p;
}

interface Spring { x: number; v: number }
const spring = (s: Spring, goal: number, k: number, c: number, dt: number) => {
  s.v += (k * (goal - s.x) - c * s.v) * dt;
  s.x += s.v * dt;
};

const tmp = new THREE.Color();

export class OwlSim {
  pose: Pose = rest();
  private goal: Pose = rest();
  private state: OwlState;
  private seed: number;
  private t: number;
  private blinkIn = 2;
  private blink = 0;
  private hopNext = 4;
  private y = 0;
  private vy = 0;
  private spin: Spring = { x: 0, v: 0 };
  private spinGoal = 0;
  private tuftSpring: [Spring, Spring] = [{ x: 0, v: 0 }, { x: 0, v: 0 }];
  private fluffSpring: [Spring, Spring] = [{ x: 0, v: 0 }, { x: 0, v: 0 }];
  private lastYaw = 0;
  private startle = 0;
  /** where the pointer is from the owl's centre in px, or null */
  pointer: { x: number; y: number } | null = null;

  constructor(seed: number, state: OwlState) {
    this.seed = seed;
    this.state = state;
    this.t = seed * 40;
    target(state, this.t, seed, this.goal);
    this.pose = { ...this.goal };
  }

  setState(state: OwlState) {
    if (state === this.state) return;
    this.state = state;
    if (state === 'happy') this.hop(4.6);
    if (state === 'error') this.startle = 1;
  }

  hop(v: number) {
    if (this.y <= 0.001) this.vy = v;
  }

  poke() {
    this.hop(5.4);
    this.spinGoal += Math.PI * 2;
    this.setState('happy');
  }

  update(dt: number, rig: Rig): void {
    this.t += dt;
    const { t, seed } = this;
    target(this.state, t, seed, this.goal);
    const g = this.goal;
    const asleep = this.state === 'sleeping';

    /* the pointer overrides where the head and eyes look */
    if (this.pointer && !asleep && this.state !== 'error') {
      const nx = Math.max(-1, Math.min(1, this.pointer.x / 420));
      const ny = Math.max(-1, Math.min(1, this.pointer.y / 420));
      g.yaw = nx * 0.8;
      g.pitch = ny * 0.3;
      g.px = nx;
      g.py = -ny;
    }

    const k = 1 - Math.exp(-dt * 6);
    const p = this.pose as unknown as Record<string, number>;
    const gg = g as unknown as Record<string, number>;
    for (const key of keys) p[key] = lerp(p[key], gg[key], key === 'yaw' || key === 'lid' ? Math.min(1, k * 1.4) : k);

    /* blinks */
    this.blinkIn -= dt;
    if (this.blinkIn <= 0 && !asleep) {
      this.blink = 0.001;
      this.blinkIn = 2.2 + Math.random() * 3.2;
    }
    let blink = 0;
    if (this.blink > 0) {
      this.blink += dt;
      const u = this.blink / 0.2;
      blink = u >= 1 ? 0 : Math.sin(u * Math.PI);
      if (u >= 1) this.blink = 0;
    }

    /* hops: now and then when idle, always when happy */
    this.hopNext -= dt;
    if (this.hopNext <= 0) {
      if (this.state === 'idle') this.hop(3.4);
      if (this.state === 'happy') this.hop(3.4);
      this.hopNext = this.state === 'happy' ? 0.55 : 5 + Math.random() * 5;
    }
    this.vy -= 18 * dt;
    this.y += this.vy * dt;
    if (this.y < 0) { this.y = 0; this.vy = 0; }

    /* a click's spin */
    this.spin.v += (36 * (this.spinGoal - this.spin.x) - 9 * this.spin.v) * dt;
    this.spin.x += this.spin.v * dt;
    if (Math.abs(this.spinGoal - this.spin.x) < 0.01 && this.spinGoal > 6.2) { this.spin.x -= this.spinGoal; this.spinGoal = 0; }

    /* springy tufts and side fluff, kicked by the head's turn and by hops */
    const yawV = (p.yaw - this.lastYaw) / Math.max(dt, 1e-3);
    this.lastYaw = p.yaw;
    const kick = yawV * 0.05 + this.vy * 0.05 + this.startle * 5 * Math.sin(t * 40);
    this.startle = Math.max(0, this.startle - dt * 1.4);
    for (let i = 0; i < 2; i++) {
      spring(this.tuftSpring[i], 0, 90, 7, dt);
      this.tuftSpring[i].v += kick * dt * 1.2 * (i === 0 ? 1 : -1);
      spring(this.fluffSpring[i], 0, 70, 6, dt);
      this.fluffSpring[i].v += Math.abs(kick) * dt * 1.5;
    }

    /* ---------- apply ---------- */
    const { hopper, head, eyes, tufts, fluff, ruff, lowerBeak, shadow } = rig;
    const breath = (asleep ? 0.03 : 0.012) * Math.sin(t * (asleep ? 1.4 : 2.2));
    const squash = 1 + (this.y > 0 ? 0.04 * Math.min(1, this.vy / 5) : 0) + breath;
    hopper.position.y = this.y;
    hopper.rotation.y = this.spin.x;
    head.scale.set(p.puff / Math.sqrt(squash), p.puff * squash, p.puff / Math.sqrt(squash));
    head.rotation.set(p.pitch, p.yaw + BASE_YAW, p.roll);
    ruff.rotation.y = 0;
    ruff.children.forEach((h, i) => {
      const f = h.children[0];
      f.rotation.x = 0.7 + 0.05 * Math.sin(t * 1.8 + i) + 0.2 * (p.puff - 1) * 4;
    });

    const lid = Math.max(p.lid, blink);
    const sq = p.squint;
    const R = 0.365;
    eyes.forEach((e, i) => {
      const s = i === 0 ? -1 : 1;
      e.group.scale.setScalar(p.eye);
      const kTop = Math.min(1, lid + sq * 0.12);
      e.lidTop.visible = kTop > 0.02;
      e.lidTop.scale.y = Math.max(0.001, kTop);
      e.lidTop.position.y = R - R * kTop;
      e.lashTop.visible = kTop > 0.7 && p.cross < 0.5;
      e.lashTop.position.y = 0.06;
      const kBot = Math.min(1, sq * 0.95);
      e.lidBottom.visible = kBot > 0.02;
      e.lidBottom.scale.y = Math.max(0.001, kBot);
      e.lidBottom.position.y = -R + R * kBot;
      e.cross.visible = p.cross > 0.5;
      e.look.position.x = p.px * 0.075;
      e.look.position.y = p.py * 0.075;
      const raise = i === 0 ? p.browL : p.browR;
      e.brow.position.y = e.y + 0.31 + raise * 0.1 + (lid > 0.5 ? -0.05 : 0);
      e.brow.rotation.z = Math.PI / 2 - (Math.PI * 0.66) / 2 + s * p.browTilt * 0.35 + (i === 0 ? 1 : -1) * 0.1;
      e.brow.rotation.y = s * 0.12;
    });

    tufts.forEach((tu, i) => {
      const s = i === 0 ? -1 : 1;
      tu.rotation.z = s * (-0.08 + p.tuft * -0.18 + this.tuftSpring[i].x);
      tu.rotation.x = -0.1 - p.tuft * 0.06;
      tu.position.y = 0.78 + p.tuft * 0.05;
    });
    fluff.forEach((f, i) => {
      const s = i === 0 ? -1 : 1;
      f.rotation.z = s * (this.fluffSpring[i].x * 0.5 + 0.04 * Math.sin(t * 1.7 + i));
    });

    lowerBeak.rotation.x = Math.PI / 2 + 0.85 + p.beak * 0.5;
    lowerBeak.position.y = -0.2 - p.beak * 0.05;

    /* circuit lines in the chosen glow colour, red when something is wrong */
    const lum = 0.25 + p.glow * 1.1;
    tmp.copy(rig.glowColor).lerp(new THREE.Color(1, 0.12, 0.06), p.red);
    for (const m of rig.glows) m.color.copy(tmp).multiplyScalar(lum);

    /* props: thinking dots, listening arcs, sleeping z's, happy sparkles */
    rig.dots.forEach((d, i) => {
      d.visible = p.dots > 0.05;
      const pulse = 0.5 + 0.5 * Math.sin(t * 5 - i * 1.1);
      d.scale.setScalar(p.dots * (0.6 + 0.6 * pulse));
      d.position.y = 2.2 + 0.06 * Math.sin(t * 5 - i * 1.1);
    });
    rig.arcs.forEach((a, i) => {
      a.visible = p.arcs > 0.05;
      const ph = (t * 1.6 - (i % 2) * 0.35) % 1;
      (a.material as THREE.MeshBasicMaterial).opacity = p.arcs * (1 - Math.abs(ph - 0.5) * 2) * 0.9;
    });
    rig.zs.forEach((z, i) => {
      const ph = ((t * 0.35 + i / 3) % 1 + 1) % 1;
      z.visible = p.zs > 0.05;
      const sc = (0.3 + 0.35 * ph) * p.zs;
      z.scale.set(sc, sc, 1);
      z.position.set(1.0 + ph * 0.7, 1.0 + ph * 1.0, 0.4);
      (z.material as THREE.SpriteMaterial).opacity = p.zs * Math.sin(ph * Math.PI);
    });
    rig.sparks.forEach((sp, i) => {
      sp.visible = p.sparks > 0.05;
      const a = t * 0.9 + (i / 4) * Math.PI * 2;
      const tw = 0.5 + 0.5 * Math.sin(t * 6 + i * 1.7);
      sp.position.set(Math.cos(a) * 1.55, 0.2 + Math.sin(a * 1.3) * 0.9, 0.6);
      const sc = (0.16 + 0.14 * tw) * p.sparks;
      sp.scale.set(sc, sc, 1);
    });

    const h = this.y;
    shadow.scale.setScalar(1 - Math.min(0.35, h * 0.22));
    (shadow.material as { opacity: number }).opacity = 1 - Math.min(0.55, h * 0.4);
    shadow.position.y = GROUND;
  }
}
