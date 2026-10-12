import { GROUND, type Rig } from './model';

export type OwlState = 'idle' | 'thinking' | 'searching' | 'listening' | 'speaking' | 'working' | 'happy' | 'error' | 'sleeping';

/* Every channel the owl is moved by. A state sets the target of each; the
   pose eases to it, so switching states is a smooth change of mood. */
interface Pose {
  yaw: number; pitch: number; roll: number; bodyYaw: number;
  lid: number; squint: number; browL: number; browR: number; browTilt: number;
  tuft: number; flare: number; flap: number; glow: number; beak: number;
  px: number; py: number; puff: number; eye: number; red: number;
}

const keys = ['yaw', 'pitch', 'roll', 'bodyYaw', 'lid', 'squint', 'browL', 'browR', 'browTilt', 'tuft', 'flare', 'flap', 'glow', 'beak', 'px', 'py', 'puff', 'eye', 'red'] as const;

const BODY_YAW = 0.5;

function rest(): Pose {
  return { yaw: 0, pitch: 0, roll: 0.14, bodyYaw: BODY_YAW, lid: 0, squint: 0, browL: 0, browR: 0, browTilt: 0, tuft: 0, flare: 0, flap: 0, glow: 0.7, beak: 0, px: 0, py: 0, puff: 1, eye: 1, red: 0 };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/* what each state asks for at time t */
function target(state: OwlState, t: number, ph: number, p: Pose): void {
  Object.assign(p, rest());
  const w = Math.sin(t * 0.7 + ph * 6);
  switch (state) {
    case 'idle':
      p.yaw = 0.32 * w + 0.14 * Math.sin(t * 1.9 + ph);
      p.roll = 0.14 + 0.06 * Math.sin(t * 0.5 + ph * 3);
      p.px = 0.35 * Math.sin(t * 0.9 + ph * 4);
      p.py = 0.2 * Math.sin(t * 0.6 + ph);
      p.glow = 0.55 + 0.25 * Math.sin(t * 2);
      p.tuft = 0.1 * Math.sin(t * 1.3);
      p.flap = 0.03 * Math.sin(t * 1.5);
      break;
    case 'thinking':
      p.pitch = -0.14;
      p.roll = 0.32 * Math.sin(t * 0.45 + ph * 6) + 0.1;
      p.yaw = 0.18 * Math.sin(t * 0.45 + ph * 6 + 1);
      p.px = -0.4;
      p.py = 0.55;
      p.browL = 0.4;
      p.browR = -0.08;
      p.squint = 0.12;
      p.tuft = 0.2 + 0.2 * Math.sin(t * 3);
      p.glow = 0.5 + 0.5 * Math.abs(Math.sin(t * 3.4));
      break;
    case 'searching':
      p.yaw = 0.85 * Math.sin(t * 1.3 + ph * 6);
      p.px = Math.sin(t * 1.3 + ph * 6 + 0.5) * 0.6;
      p.roll = 0.06;
      p.flare = 0.06;
      p.browL = p.browR = 0.2;
      p.eye = 1.08;
      p.tuft = 0.5;
      p.glow = 0.5 + 0.5 * Math.abs(Math.sin(t * 4.5));
      break;
    case 'listening':
      p.roll = 0.34 + 0.04 * Math.sin(t * 1.5);
      p.pitch = 0.04 * Math.sin(t * 3.2);
      p.eye = 1.1;
      p.browL = p.browR = 0.28;
      p.tuft = 1;
      p.glow = 0.9;
      p.px = 0.15;
      break;
    case 'speaking': {
      const m = Math.abs(Math.sin(t * 9) * 0.6 + Math.sin(t * 5.3 + ph) * 0.4);
      p.beak = m;
      p.pitch = 0.05 * Math.sin(t * 9);
      p.yaw = 0.15 * Math.sin(t * 1.4 + ph);
      p.roll = 0.1;
      p.browL = p.browR = 0.1 + 0.2 * m;
      p.glow = 0.7 + 0.3 * m;
      p.flap = 0.04 * m;
      p.tuft = 0.15;
      break;
    }
    case 'working':
      p.pitch = 0.28;
      p.roll = 0.04 + 0.03 * Math.sin(t * 6);
      p.py = -0.6;
      p.squint = 0.22;
      p.browTilt = 0.3;
      p.flare = 0.04 + 0.06 * Math.abs(Math.sin(t * 6));
      p.flap = 0.1 * Math.sin(t * 6);
      p.glow = 0.7 + 0.3 * Math.sin(t * 8);
      break;
    case 'happy':
      p.squint = 0.55;
      p.roll = 0.14 + 0.1 * Math.sin(t * 5);
      p.yaw = 0.2 * Math.sin(t * 2.5);
      p.browL = p.browR = 0.35;
      p.flare = 0.22 + 0.12 * Math.sin(t * 11);
      p.flap = 0.1;
      p.tuft = 0.8;
      p.beak = 0.25 + 0.2 * Math.sin(t * 5);
      p.glow = 1;
      p.puff = 1.04;
      break;
    case 'error':
      p.yaw = 0.42 * Math.sin(t * 13);
      p.roll = 0;
      p.browTilt = -0.4;
      p.eye = 0.95;
      p.puff = 1.08;
      p.tuft = 0.7;
      p.red = 1;
      p.glow = 0.5 + 0.5 * (Math.sin(t * 8) > 0 ? 1 : 0);
      break;
    case 'sleeping':
      p.lid = 1;
      p.pitch = 0.34;
      p.roll = 0.2;
      p.bodyYaw = BODY_YAW;
      p.puff = 1.06 + 0.012 * Math.sin(t * 1.4);
      p.glow = 0.08;
      p.tuft = -0.4;
      p.browL = p.browR = -0.12;
      p.eye = 0.9;
      break;
  }
}

/** The owl's still pose for a state, used for reduced motion and `paused`. */
export function restPose(state: OwlState): Pose {
  const p = rest();
  target(state, 0, 0.3, p);
  return p;
}

interface Spring { x: number; v: number }
const spring = (s: Spring, goal: number, k: number, c: number, dt: number) => {
  s.v += (k * (goal - s.x) - c * s.v) * dt;
  s.x += s.v * dt;
};

export class OwlSim {
  pose: Pose = rest();
  private goal: Pose = rest();
  private state: OwlState;
  private t: number;
  private blinkIn = 2;
  private blink = 0;
  private hopNext = 4;
  private y = 0;
  private vy = 0;
  private spin = { x: 0, v: 0 };
  private spinGoal = 0;
  private tuftSpring: [Spring, Spring] = [{ x: 0, v: 0 }, { x: 0, v: 0 }];
  private wingSpring: [Spring, Spring] = [{ x: 0, v: 0 }, { x: 0, v: 0 }];
  private lastYaw = 0;
  private yawV = 0;
  private startle = 0;
  /** where the pointer is from the owl's centre in px, or null */
  pointer: { x: number; y: number } | null = null;

  private seed: number;

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

  update(dt: number, apply: Rig): void {
    this.t += dt;
    const { t, seed } = this;
    target(this.state, t, seed, this.goal);
    const g = this.goal;
    const asleep = this.state === 'sleeping';

    /* the pointer overrides where the head and eyes look */
    if (this.pointer && !asleep && this.state !== 'error') {
      const nx = Math.max(-1, Math.min(1, this.pointer.x / 420));
      const ny = Math.max(-1, Math.min(1, this.pointer.y / 420));
      g.yaw = nx * 0.75;
      g.pitch = ny * 0.3;
      g.px = nx;
      g.py = -ny;
    }

    /* ease every channel toward its goal */
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
      if (this.state === 'idle') this.hop(3.6);
      this.hopNext = this.state === 'happy' ? 0.55 : 5 + Math.random() * 5;
      if (this.state === 'happy') this.hop(3.4);
    }
    this.vy -= 18 * dt;
    this.y += this.vy * dt;
    if (this.y < 0) { this.y = 0; this.vy = 0; }

    /* spin on a click */
    this.spin.v += (36 * (this.spinGoal - this.spin.x) - 9 * this.spin.v) * dt;
    this.spin.x += this.spin.v * dt;
    if (Math.abs(this.spinGoal - this.spin.x) < 0.01 && this.spinGoal > 6.2) { this.spin.x -= this.spinGoal; this.spinGoal = 0; }

    /* springy tufts and wings, kicked by the head's turn and by hops */
    const yaw = p.yaw;
    this.yawV = (yaw - this.lastYaw) / Math.max(dt, 1e-3);
    this.lastYaw = yaw;
    const kick = this.yawV * 0.06 + this.vy * 0.05 + this.startle * 6 * Math.sin(t * 40);
    this.startle = Math.max(0, this.startle - dt * 1.4);
    for (let i = 0; i < 2; i++) {
      spring(this.tuftSpring[i], 0, 90, 7, dt);
      this.tuftSpring[i].v += (i === 0 ? -1 : 1) * -kick * dt * 20 * 0.05;
      spring(this.wingSpring[i], 0, 60, 6, dt);
      this.wingSpring[i].v += -this.vy * dt * 0.8;
    }

    const wob = Math.sin(t * 1.6 + seed * 6);
    const breath = asleep ? 0.03 * Math.sin(t * 1.4) : 0.014 * Math.sin(t * 2.2);

    /* ---------- apply ---------- */
    const { hopper, body, head, eyes, tufts, wings, lowerBeak, shadow, tail, glows } = apply;
    const squash = 1 + (this.y > 0 ? 0.04 * Math.min(1, this.vy / 5) : 0) + breath;
    hopper.position.y = this.y;
    hopper.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));
    hopper.rotation.y = this.spin.x;

    body.rotation.y = p.bodyYaw;
    body.scale.setScalar(p.puff);
    head.rotation.set(p.pitch, p.yaw - p.bodyYaw * 0.55, p.roll);
    head.scale.setScalar(p.puff > 1 ? 1 + (p.puff - 1) * 0.5 : 1);
    tail.rotation.x = 0.04 * wob;

    const lid = Math.max(p.lid, blink);
    const sq = p.squint;
    eyes.forEach((e, i) => {
      const s = i === 0 ? -1 : 1;
      e.group.scale.setScalar(p.eye);
      const R = 0.365;
      /* top lid: an ellipse hanging from the eye's top edge */
      const kTop = Math.min(1, lid + sq * 0.12);
      e.lidTop.visible = kTop > 0.02;
      e.lidTop.scale.y = Math.max(0.001, kTop) * 1.0;
      e.lidTop.position.y = R - R * kTop;
      e.lashTop.visible = kTop > 0.7;
      e.lashTop.position.y = 0.06;
      /* bottom lid rising for a smile */
      const kBot = Math.min(1, sq * 0.95);
      e.lidBottom.visible = kBot > 0.02;
      e.lidBottom.scale.y = Math.max(0.001, kBot);
      e.lidBottom.position.y = -R + R * kBot;
      e.lashBottom.visible = false;
      e.lashBottom.position.y = -R + 2 * R * kBot;
      /* pupils slide inside the iris, and the lights stay put */
      e.look.position.x = p.px * 0.075;
      e.look.position.y = p.py * 0.075;
      const raise = i === 0 ? p.browL : p.browR;
      e.brow.position.y = e.y + 0.31 + raise * 0.1 + (lid > 0.5 ? -0.05 : 0);
      e.brow.rotation.z = Math.PI / 2 - (Math.PI * 0.66) / 2 + s * p.browTilt * 0.35 + (i === 0 ? 1 : -1) * 0.1;
      e.brow.rotation.y = s * 0.12;
    });

    /* tufts perk with `tuft` and flop with the spring */
    tufts.forEach((tu, i) => {
      const s = i === 0 ? -1 : 1;
      tu.rotation.z = s * (-0.08 + p.tuft * -0.18 + this.tuftSpring[i].x) ;
      tu.rotation.x = -0.1 - p.tuft * 0.06;
      tu.position.y = 0.72 + p.tuft * 0.05;
    });

    wings.forEach((w, i) => {
      const s = i === 0 ? -1 : 1;
      w.rotation.z = s * (p.flare + this.wingSpring[i].x * 0.4 + p.flap * Math.sin(t * 14 + i * 0.4));
      w.position.y = 0.5;
    });

    lowerBeak.rotation.x = Math.PI / 2 + 0.85 + p.beak * 0.5;
    lowerBeak.position.y = -0.2 - p.beak * 0.05;

    /* circuit lines: amber, or red when something is wrong */
    const glow = 0.25 + p.glow * 1.1;
    for (const m of glows) {
      m.color.setRGB(1.0, 0.55 - 0.5 * p.red, 0.08 - 0.05 * p.red).multiplyScalar(glow);
    }

    const h = this.y;
    shadow.scale.setScalar(1 - Math.min(0.35, h * 0.22));
    (shadow.material as { opacity: number }).opacity = 1 - Math.min(0.55, h * 0.4);
    shadow.position.y = GROUND;
  }
}
