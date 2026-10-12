import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/* The owl, built once from primitives: a feathered body and head (a scale
   texture gives them their plumage), extruded leaf feathers for the wings,
   tail, tufts and cheeks, glossy amber eyes with lids, and glowing circuit
   lines. `build()` returns the rig the animation moves. */

export interface OwlColors {
  /** the plumage */
  feather: string;
  /** tufts, brows, beak, talons, the wing's underlayer */
  accent: string;
  /** the face discs and belly */
  face: string;
  /** the circuit lines */
  glow: string;
}

export const GROUND = -1.4;

export interface Eye {
  group: THREE.Group;
  look: THREE.Group;
  lidTop: THREE.Mesh;
  lidBottom: THREE.Mesh;
  lashTop: THREE.Mesh;
  lashBottom: THREE.Mesh;
  highlights: THREE.Mesh[];
  brow: THREE.Mesh;
  x: number;
  y: number;
}

export interface Rig {
  scene: THREE.Scene;
  hopper: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  eyes: [Eye, Eye];
  tufts: [THREE.Group, THREE.Group];
  wings: [THREE.Group, THREE.Group];
  tail: THREE.Group;
  lowerBeak: THREE.Mesh;
  shadow: THREE.Mesh;
  glows: THREE.MeshBasicMaterial[];
  mats: { feather: THREE.MeshPhysicalMaterial[]; accent: THREE.MeshPhysicalMaterial[]; face: THREE.MeshPhysicalMaterial[] };
  dispose(): void;
}

let scales: THREE.CanvasTexture | null = null;

/* rows of overlapping scale-feathers, greyscale: it tints with the material colour and doubles as the bump map */
function scaleTexture(): THREE.CanvasTexture {
  if (scales) return scales;
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  g.fillStyle = '#7a7a7a';
  g.fillRect(0, 0, S, S);
  const rows = 8;
  const cols = 8;
  const rh = S / rows;
  const cw = S / cols;
  for (let r = rows; r >= -1; r--) {
    for (let k = -1; k <= cols; k++) {
      const x = (k + (r & 1 ? 0.5 : 0)) * cw;
      const y = r * rh;
      g.beginPath();
      g.moveTo(x - cw / 2, y);
      g.lineTo(x - cw / 2, y + rh * 0.55);
      g.quadraticCurveTo(x, y + rh * 1.55, x + cw / 2, y + rh * 0.55);
      g.lineTo(x + cw / 2, y);
      g.closePath();
      const grad = g.createLinearGradient(0, y, 0, y + rh * 1.2);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.65, '#d6d6d6');
      grad.addColorStop(1, '#a8a8a8');
      g.fillStyle = grad;
      g.fill();
      g.strokeStyle = 'rgba(30,30,30,.32)';
      g.lineWidth = 2.5;
      g.stroke();
      g.beginPath();
      g.moveTo(x, y + rh * 0.12);
      g.lineTo(x, y + rh * 1.0);
      g.strokeStyle = 'rgba(40,40,40,.22)';
      g.lineWidth = 1.2;
      g.stroke();
    }
  }
  scales = new THREE.CanvasTexture(c);
  scales.colorSpace = THREE.SRGBColorSpace;
  scales.wrapS = scales.wrapT = THREE.RepeatWrapping;
  scales.anisotropy = 4;
  return scales;
}

/* a leaf, base at the origin, tip at (0, -length), with a rounded bevel and a base-to-tip shade */
function featherGeometry(length: number, width: number): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(width, -length * 0.12, width * 0.95, -length * 0.62, 0, -length);
  s.bezierCurveTo(-width * 0.95, -length * 0.62, -width, -length * 0.12, 0, 0);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.02, bevelSegments: 3, curveSegments: 14 });
  geo.translate(0, 0, -0.006);
  const pos = geo.getAttribute('position');
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const t = Math.min(1, Math.max(0, -pos.getY(i) / length));
    const edge = Math.min(1, Math.abs(pos.getX(i)) / (width * 0.55));
    const v = 0.72 + 0.22 * t + 0.08 * edge;
    col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = Math.min(1, v);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return geo;
}

function disc(color: string): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color });
}

export function build(colors: OwlColors): Rig {
  const scene = new THREE.Scene();
  const geos: THREE.BufferGeometry[] = [];
  const keep = <T extends THREE.BufferGeometry>(g: T): T => (geos.push(g), g);
  const mats = { feather: [] as THREE.MeshPhysicalMaterial[], accent: [] as THREE.MeshPhysicalMaterial[], face: [] as THREE.MeshPhysicalMaterial[] };
  const extra: THREE.Material[] = [];

  const plumage = (kind: keyof typeof mats, o: { map?: boolean; tint?: number; vertex?: boolean; sheen?: string } = {}) => {
    const base = new THREE.Color(colors[kind]);
    const m = new THREE.MeshPhysicalMaterial({
      color: base,
      roughness: kind === 'accent' ? 0.38 : 0.52,
      metalness: 0,
      clearcoat: 0.5,
      clearcoatRoughness: 0.28,
      sheen: 0.35,
      sheenRoughness: 0.5,
      sheenColor: new THREE.Color(o.sheen ?? '#5b8dff'),
      vertexColors: !!o.vertex,
    });
    if (o.map) {
      const t = scaleTexture();
      m.map = t;
      m.bumpMap = t;
      m.bumpScale = 0.7;
    }
    mats[kind].push(m);
    return m;
  };

  const featherMat = plumage('feather', { map: true });
  const faceMat = plumage('face', { sheen: '#ffffff' });
  const leafFeather = plumage('feather', { vertex: true });
  const leafAccent = plumage('accent', { vertex: true, sheen: '#ffb066' });
  const leafBlue = new THREE.MeshPhysicalMaterial({ color: '#3d86ff', roughness: 0.3, clearcoat: 0.8, vertexColors: true, emissive: '#1b4fe0', emissiveIntensity: 0.35 });
  extra.push(leafBlue);
  const accentMat = plumage('accent', { sheen: '#ffb066' });
  const claw = new THREE.MeshPhysicalMaterial({ color: '#0d1450', roughness: 0.25, clearcoat: 1 });
  extra.push(claw);

  const sphere = (r: number, sx: number, sy: number, sz: number, m: THREE.Material, w = 56, h = 40) => {
    const mesh = new THREE.Mesh(keep(new THREE.SphereGeometry(r, w, h)), m);
    mesh.scale.set(sx, sy, sz);
    return mesh;
  };

  const leaf = (len: number, wid: number, m: THREE.Material) => new THREE.Mesh(keep(featherGeometry(len, wid)), m);

  /* ---------- rig ---------- */
  const hopper = new THREE.Group();
  const body = new THREE.Group();
  hopper.add(body);
  scene.add(hopper);

  /* ---------- body ---------- */
  const torso = sphere(1, 0.96, 1.12, 0.9, featherMat);
  torso.position.set(0, -0.15, 0);
  featherMat.map!.repeat.set(4, 3);
  body.add(torso);

  const belly = sphere(1, 0.66, 0.9, 0.46, faceMat);
  belly.position.set(0, -0.2, 0.52);
  body.add(belly);

  /* the blue chevron at the throat */
  for (const s of [-1, 1]) {
    const v = leaf(0.55, 0.17, leafBlue);
    v.position.set(s * 0.17, 0.5, 0.8);
    v.rotation.set(0.25, 0, s * 0.62);
    body.add(v);
  }

  /* tail */
  const tail = new THREE.Group();
  tail.position.set(0, -0.85, -0.55);
  [-0.3, 0, 0.3].forEach((a, i) => {
    const f = leaf(1.0 - Math.abs(a) * 0.4, 0.3, i === 1 ? leafAccent : leafFeather);
    f.rotation.set(0.95, 0, a);
    f.position.z = -i * 0.0;
    tail.add(f);
  });
  body.add(tail);

  /* wings */
  const wings: [THREE.Group, THREE.Group] = [new THREE.Group(), new THREE.Group()];
  const glows: THREE.MeshBasicMaterial[] = [];
  const rows: Array<{ n: number; len: number; w: number; a0: number; a1: number; z: number; mat: THREE.Material; span: number }> = [
    { n: 6, len: 1.7, w: 0.36, a0: 0.04, a1: 0.52, z: 0, mat: leafFeather, span: 0.5 },
    { n: 5, len: 1.3, w: 0.34, a0: 0.1, a1: 0.5, z: 0.035, mat: leafAccent, span: 0.42 },
    { n: 6, len: 1.05, w: 0.34, a0: 0.0, a1: 0.5, z: 0.07, mat: leafFeather, span: 0.46 },
    { n: 5, len: 0.7, w: 0.32, a0: -0.12, a1: 0.38, z: 0.105, mat: leafFeather, span: 0.4 },
  ];
  for (let i = 0; i < 2; i++) {
    const s = i === 0 ? -1 : 1;
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.7, 0.5, 0.1);
    const wing = new THREE.Group();
    wing.rotation.y = s * (Math.PI / 2 - 0.8);
    pivot.add(wing);
    for (const r of rows) {
      for (let k = 0; k < r.n; k++) {
        const t = k / (r.n - 1);
        const f = leaf(r.len * (1 - 0.1 * (1 - t)), r.w, r.mat);
        f.position.set(s * (t - 0.5) * r.span, -0.02 * k, r.z + k * 0.004);
        f.rotation.z = s * (r.a0 + (r.a1 - r.a0) * t);
        wing.add(f);
      }
    }
    /* a circuit trace across the covert feathers, ending in a ring node */
    const gm = new THREE.MeshBasicMaterial({ color: colors.glow, toneMapped: false });
    glows.push(gm);
    const pts = [[-0.12, -0.3], [0.1, -0.5], [0.34, -0.5], [0.5, -0.4]].map(([x, y]) => new THREE.Vector3(s * x, y, 0.15));
    const tube = new THREE.Mesh(keep(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0), 24, 0.014, 6)), gm);
    wing.add(tube);
    const ring = new THREE.Mesh(keep(new THREE.TorusGeometry(0.05, 0.014, 8, 20)), gm);
    ring.position.copy(pts[pts.length - 1]);
    wing.add(ring);
    body.add(pivot);
    wings[i] = pivot;
  }

  /* feet */
  for (const s of [-1, 1]) {
    const foot = new THREE.Group();
    foot.position.set(s * 0.34, -1.12, 0.34);
    const leg = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.075, 0.09, 0.3, 16)), accentMat);
    leg.position.y = 0.04;
    foot.add(leg);
    for (const a of [-0.5, 0, 0.5]) {
      const toe = new THREE.Group();
      toe.position.set(0, -0.12, 0.02);
      toe.rotation.y = a * s + (s > 0 ? 0 : 0);
      const t = new THREE.Mesh(keep(new THREE.CapsuleGeometry(0.052, 0.2, 6, 10)), accentMat);
      t.rotation.x = Math.PI / 2;
      t.position.z = 0.12;
      toe.add(t);
      const c = new THREE.Mesh(keep(new THREE.ConeGeometry(0.05, 0.17, 12)), claw);
      c.rotation.x = Math.PI / 2 + 0.5;
      c.position.set(0, -0.03, 0.27);
      toe.add(c);
      foot.add(toe);
    }
    body.add(foot);
  }

  /* ---------- head ---------- */
  const head = new THREE.Group();
  head.position.set(0, 1.15, 0.05);
  hopper.add(head);
  const skull = sphere(1, 1.08, 0.92, 0.95, featherMat);
  featherMat.map!.repeat.set(4, 3);
  head.add(skull);

  const faceDiscs = [-1, 1].map((s) => {
    const d = sphere(1, 0.46, 0.44, 0.2, faceMat);
    d.position.set(s * 0.45, 0.05, 0.78);
    d.rotation.z = s * 0.1;
    head.add(d);
    return d;
  });
  void faceDiscs;
  const cheeks = sphere(1, 0.6, 0.4, 0.28, faceMat);
  cheeks.position.set(0, -0.26, 0.72);
  head.add(cheeks);

  /* side fluff */
  for (const s of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      const f = leaf(0.55 - k * 0.06, 0.24, leafFeather);
      f.position.set(s * (0.98 - k * 0.02), 0.2 - k * 0.2, 0.0 + k * 0.03);
      f.rotation.set(0, s * 0.9, s * (0.35 + k * 0.28));
      head.add(f);
    }
  }

  /* beak */
  const beak = new THREE.Mesh(keep(new THREE.ConeGeometry(0.15, 0.4, 24)), accentMat);
  beak.scale.set(0.9, 1, 0.8);
  beak.rotation.x = Math.PI / 2 + 0.55;
  beak.position.set(0, -0.12, 0.98);
  head.add(beak);
  const lowerBeak = new THREE.Mesh(keep(new THREE.ConeGeometry(0.085, 0.2, 18)), accentMat);
  lowerBeak.position.set(0, -0.2, 0.96);
  lowerBeak.rotation.x = Math.PI / 2 + 0.85;
  head.add(lowerBeak);

  /* eyes */
  const black = disc('#0b0f2a');
  const amber = new THREE.MeshPhysicalMaterial({ color: '#ff8a0a', roughness: 0.2, clearcoat: 1, emissive: '#ff6a00', emissiveIntensity: 0.35 });
  const iris2 = new THREE.MeshPhysicalMaterial({ color: '#ffc25a', roughness: 0.2, clearcoat: 1, emissive: '#ff8a1a', emissiveIntensity: 0.25 });
  const pupilMat = new THREE.MeshPhysicalMaterial({ color: '#150a05', roughness: 0.1, clearcoat: 1 });
  const white = disc('#ffffff');
  const lashMat = disc('#0b0f2a');
  extra.push(black, amber, iris2, pupilMat, white, lashMat);
  const browGeo = keep(new THREE.TorusGeometry(0.36, 0.032, 10, 28, Math.PI * 0.66));

  const eyes = [-1, 1].map((s): Eye => {
    const x = s * 0.45;
    const y = 0.06;
    const group = new THREE.Group();
    group.position.set(x, y, 0.9);
    const ring = sphere(0.33, 1, 1, 0.36, black, 40, 24);
    const iris = sphere(0.29, 1, 1, 0.36, amber, 40, 24);
    iris.position.z = 0.035;
    const glowRim = sphere(0.22, 1, 1, 0.36, iris2, 40, 24);
    glowRim.position.z = 0.065;
    group.add(ring, iris, glowRim);
    const look = new THREE.Group();
    look.position.z = 0.095;
    const pupil = sphere(0.185, 1, 1, 0.4, pupilMat, 32, 20);
    look.add(pupil);
    const h1 = sphere(0.07, 1, 1, 0.4, white, 20, 12);
    h1.position.set(0.09, 0.1, 0.1);
    const h2 = sphere(0.035, 1, 1, 0.4, white, 16, 10);
    h2.position.set(-0.08, -0.08, 0.1);
    look.add(h1, h2);
    group.add(look);

    const lidTop = sphere(0.365, 1, 1, 0.17, faceMat, 32, 20);
    lidTop.position.z = 0.14;
    const lidBottom = sphere(0.365, 1, 1, 0.17, faceMat, 32, 20);
    lidBottom.position.z = 0.14;
    const lashTop = new THREE.Mesh(keep(new THREE.TorusGeometry(0.25, 0.028, 8, 28, Math.PI)), lashMat);
    lashTop.rotation.z = Math.PI;
    const lashBottom = sphere(0.33, 1, 0.05, 0.4, lashMat, 24, 8);
    lashTop.position.z = 0.2;
    lashBottom.position.z = 0.2;
    group.add(lidTop, lidBottom, lashTop, lashBottom);
    head.add(group);

    const brow = new THREE.Mesh(browGeo, accentMat);
    brow.position.set(x, y + 0.31, 0.87);
    brow.rotation.z = Math.PI / 2 - (Math.PI * 0.66) / 2;
    head.add(brow);
    return { group, look, lidTop, lidBottom, lashTop, lashBottom, highlights: [h1, h2], brow, x, y };
  }) as [Eye, Eye];

  /* tufts */
  const tufts: [THREE.Group, THREE.Group] = [new THREE.Group(), new THREE.Group()];
  [-1, 1].forEach((s, i) => {
    const t = tufts[i];
    t.position.set(s * 0.58, 0.72, -0.02);
    const navy = leaf(0.95, 0.3, leafFeather);
    navy.rotation.set(0, s * 0.35, Math.PI - s * 0.5);
    const orange = leaf(0.78, 0.2, leafAccent);
    orange.position.set(s * 0.06, 0, 0.1);
    orange.rotation.set(-0.05, s * 0.45, Math.PI - s * 0.62);
    const orange2 = leaf(0.52, 0.14, leafAccent);
    orange2.position.set(s * 0.16, 0, 0.14);
    orange2.rotation.set(-0.05, s * 0.5, Math.PI - s * 0.95);
    t.add(navy, orange, orange2);
    head.add(t);
  });

  /* ---------- floor shadow ---------- */
  const sc = document.createElement('canvas');
  sc.width = sc.height = 128;
  const sg = sc.getContext('2d')!;
  const rad = sg.createRadialGradient(64, 64, 4, 64, 64, 64);
  rad.addColorStop(0, 'rgba(10,15,50,.55)');
  rad.addColorStop(1, 'rgba(10,15,50,0)');
  sg.fillStyle = rad;
  sg.fillRect(0, 0, 128, 128);
  const shadowTex = new THREE.CanvasTexture(sc);
  const shadow = new THREE.Mesh(keep(new THREE.PlaneGeometry(3.6, 2.2)), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(0, GROUND, 0.1);
  shadow.renderOrder = -1;
  scene.add(shadow);

  /* ---------- lights ---------- */
  scene.add(new THREE.HemisphereLight('#cfe0ff', '#2a2250', 0.5));
  const key = new THREE.DirectionalLight('#fff1e0', 2.6);
  key.position.set(-3, 5, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight('#5a8bff', 2.4);
  rim.position.set(4, 3, -4);
  scene.add(rim);
  const fill = new THREE.DirectionalLight('#ffd8b0', 0.7);
  fill.position.set(4, 0, 4);
  scene.add(fill);

  const rig: Rig = {
    scene,
    hopper,
    body,
    head,
    eyes,
    tufts,
    wings,
    tail,
    lowerBeak,
    shadow,
    glows,
    mats,
    dispose() {
      geos.forEach((g) => g.dispose());
      extra.forEach((m) => m.dispose());
      [...mats.feather, ...mats.accent, ...mats.face].forEach((m) => m.dispose());
      glows.forEach((m) => m.dispose());
      shadowTex.dispose();
      (shadow.material as THREE.Material).dispose();
    },
  };
  return rig;
}

export function recolor(rig: Rig, c: OwlColors) {
  for (const k of ['feather', 'accent', 'face'] as const) rig.mats[k].forEach((m) => m.color.set(c[k]));
}

/* a studio environment for the clear-coat to reflect, built once per renderer */
export function environment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const pm = new THREE.PMREMGenerator(renderer);
  const env = new RoomEnvironment();
  const tex = pm.fromScene(env, 0.04).texture;
  env.dispose();
  pm.dispose();
  return tex;
}
