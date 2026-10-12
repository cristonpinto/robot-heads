import { forwardRef, useEffect, useId, useImperativeHandle, useRef, type CSSProperties, type HTMLAttributes, type MouseEvent } from 'react';
import * as THREE from 'three';
import { build, environment, recolor, type OwlColors, type Rig } from './model';
import { OwlSim, restPose, type OwlState } from './anim';
import { subscribe, pointer } from '../ticker';

export type { OwlState };

export const owlHeadStates: OwlState[] = ['idle', 'thinking', 'searching', 'listening', 'speaking', 'working', 'happy', 'error', 'sleeping'];

export interface OwlHeadProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'color'> {
  /** What it is doing. Default `idle`. */
  state?: OwlState;
  /** The box the owl rests in, in px; hops and the tufts reach past it. Default `200`. */
  size?: number;
  /** Plumage. Default a deep navy. */
  color?: string;
  /** Tufts, brows, beak and talons. Default orange. */
  accentColor?: string;
  /** The face discs and belly. Default cream. */
  faceColor?: string;
  /** The circuit lines on the wings. Default amber. */
  glowColor?: string;
  /** Multiplier on every animation's speed. Default `1`. */
  speed?: number;
  /** Hold the state's still pose. */
  paused?: boolean;
  /** Follow the pointer, and hop and spin on a click. Default `true`. */
  interactive?: boolean;
  /** Draw the soft shadow on the floor. Default `true`. */
  floorShadow?: boolean;
  /** 0–1, offsets the motion so a row of owls does not move in unison. */
  seed?: number;
  className?: string;
  style?: CSSProperties;
}

const labels = new Set<string>(owlHeadStates);

/* world units the owl at rest spans, and the room around it */
const OWL_H = 3.3;
const OWL_CY = 0.2;
const PAD = { side: 0.3, top: 0.25, bottom: 0.1 };
const FOV = 24;

function hashSeed(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return ((h >>> 0) % 1000) / 1000;
}

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * A cute feathered owl head: glossy navy plumage, big amber eyes, orange
 * ear tufts and brows, and glowing circuit lines, in real 3D. Like
 * `RobotHead` it shows what an agent is doing: thinking dots, sleeping z's,
 * listening waves, X eyes for errors.
 *
 * The element is a `size` × `size` box with the owl at rest centred in it;
 * its canvas reaches past the box, so hops and props draw outside without
 * taking part in layout. Each owl owns a WebGL context, so keep the count
 * to a handful on one page.
 */
export const OwlHead = forwardRef<HTMLCanvasElement, OwlHeadProps>(function OwlHead(
  {
    state = 'idle',
    size = 200,
    color = '#13236b',
    accentColor = '#ff7a14',
    faceColor = '#f7ecdc',
    glowColor = '#ffa21f',
    speed = 1,
    paused = false,
    interactive = true,
    floorShadow = true,
    seed,
    className,
    style,
    onClick,
    'aria-label': ariaLabel,
    ...rest
  },
  ref
) {
  const boxRef = useRef<HTMLSpanElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useImperativeHandle(ref, () => canvasRef.current as HTMLCanvasElement);
  const reactId = useId();
  const stateKey: OwlState = labels.has(state) ? state : 'idle';
  const seedValue = Math.min(1, Math.max(0, seed ?? hashSeed(reactId)));
  const still = paused || !(speed > 0);

  const colors: OwlColors = { feather: color, accent: accentColor, face: faceColor, glow: glowColor };
  const colorsRef = useRef(colors);
  colorsRef.current = colors;
  const sim = useRef<OwlSim | null>(null);
  if (!sim.current) sim.current = new OwlSim(seedValue, stateKey);
  sim.current.setState(stateKey);
  const stateRef = useRef(stateKey);
  stateRef.current = stateKey;
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const interactiveRef = useRef(interactive);
  interactiveRef.current = interactive;
  const shadowRef = useRef(floorShadow);
  shadowRef.current = floorShadow;
  const rigRef = useRef<Rig | null>(null);

  const unitsH = OWL_H * (1 + 0) + (PAD.top + PAD.bottom) * OWL_H;
  const scalePx = size / OWL_H;
  const canvasW = size + 2 * PAD.side * size;
  const canvasH = Math.round(unitsH * scalePx);
  const padTop = PAD.top * size;
  const padSide = PAD.side * size;

  /* one renderer and rig per owl, rebuilt only when the size changes */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
    } catch {
      return; /* no WebGL: the box stays empty */
    }
    const dpr = Math.min(2, (typeof devicePixelRatio === 'number' && devicePixelRatio) || 1);
    renderer.setPixelRatio(dpr);
    renderer.setSize(canvasW, canvasH, false);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const rig = build(colorsRef.current);
    rigRef.current = rig;
    rig.scene.environment = environment(renderer);
    rig.scene.environmentIntensity = 0.55;

    const camera = new THREE.PerspectiveCamera(FOV, canvasW / canvasH, 0.1, 100);
    const dist = (unitsH / 2) / Math.tan((FOV / 2) * (Math.PI / 180));
    const centre = OWL_CY + ((PAD.top - PAD.bottom) / 2) * OWL_H;
    camera.position.set(0, centre + 0.3, dist);
    camera.lookAt(0, centre, 0);

    const s = sim.current!;
    const draw = () => {
      rig.shadow.visible = shadowRef.current;
      renderer.render(rig.scene, camera);
    };

    let unsub: (() => void) | undefined;
    if (still || reducedMotion()) {
      s.pose = { ...restPose(stateRef.current) };
      s.update(0, rig);
      draw();
    } else {
      unsub = subscribe((dt) => {
        const el = boxRef.current;
        if (el && interactiveRef.current && Number.isFinite(pointer.x)) {
          const box = el.getBoundingClientRect();
          const dx = pointer.x - (box.left + box.width / 2);
          const dy = pointer.y - (box.top + box.height * 0.3);
          s.pointer = Math.hypot(dx, dy) < 700 ? { x: dx, y: dy } : null;
        } else s.pointer = null;
        s.update(dt * speedRef.current, rig);
        draw();
      });
    }
    return () => {
      unsub?.();
      rigRef.current = null;
      rig.dispose();
      (rig.scene.environment as THREE.Texture | null)?.dispose();
      renderer.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [still, size, still ? stateKey : '']);

  useEffect(() => {
    if (rigRef.current) recolor(rigRef.current, colors);
  }, [color, accentColor, faceColor, glowColor]);

  const click = (e: MouseEvent<HTMLSpanElement>) => {
    if (interactive && !still) sim.current?.poke();
    onClick?.(e);
  };

  return (
    <span
      ref={boxRef}
      role="img"
      aria-label={ariaLabel ?? `Owl, ${stateKey}`}
      className={className}
      onClick={click}
      style={{ position: 'relative', display: 'block', flex: 'none', width: size, height: size, cursor: interactive ? 'pointer' : undefined, ...style }}
      {...rest}
    >
      <canvas
        ref={canvasRef}
        aria-hidden
        style={{ position: 'absolute', left: -padSide, top: -padTop, width: canvasW, height: canvasH, display: 'block', pointerEvents: 'none' }}
      />
    </span>
  );
});
