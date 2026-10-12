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

export const GROUND = -1.5;

export interface Eye {
  group: THREE.Group;
  look: THREE.Group;
  lidTop: THREE.Mesh;
  lidBottom: THREE.Mesh;
  lashTop: THREE.Mesh;
  cross: THREE.Group;
  brow: THREE.Mesh;
  x: number;
  y: number;
}

export interface Rig {
  scene: THREE.Scene;
  hopper: THREE.Group;
  head: THREE.Group;
  eyes: [Eye, Eye];
  tufts: [THREE.Group, THREE.Group];
  fluff: [THREE.Group, THREE.Group];
  ruff: THREE.Group;
  lowerBeak: THREE.Mesh;
  shadow: THREE.Mesh;
  glows: THREE.MeshBasicMaterial[];
  glowColor: THREE.Color;
  dots: THREE.Mesh[];
  zs: THREE.Sprite[];
  sparks: THREE.Sprite[];
  arcs: THREE.Mesh[];
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
  const extra: Array<{ dispose(): void }> = [];

  const plumage = (kind: keyof typeof mats, o: { map?: boolean; vertex?: boolean; sheen?: string } = {}) => {
    const m = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(colors[kind]),
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
  featherMat.map!.repeat.set(4, 3);
  const faceMat = plumage('face', { sheen: '#ffffff' });
  const leafFeather = plumage('feather', { vertex: true });
  const leafFace = plumage('face', { vertex: true, sheen: '#ffffff' });
  const leafAccent = plumage('accent', { vertex: true, sheen: '#ffb066' });
  const accentMat = plumage('accent', { sheen: '#ffb066' });

  const sphere = (r: number, sx: number, sy: number, sz: number, m: THREE.Material, w = 56, h = 40) => {
    const mesh = new THREE.Mesh(keep(new THREE.SphereGeometry(r, w, h)), m);
    mesh.scale.set(sx, sy, sz);
    return mesh;
  };
  const leaf = (len: number, wid: number, m: THREE.Material) => new THREE.Mesh(keep(featherGeometry(len, wid)), m);

  const hopper = new THREE.Group();
  scene.add(hopper);
  const head = new THREE.Group();
  hopper.add(head);

  /* ---------- skull, face ---------- */
  const RX = 1.15, RY = 1.0, RZ = 1.02;
  head.add(sphere(1, RX, RY, RZ, featherMat));
  for (const s of [-1, 1]) {
    const d = sphere(1, 0.5, 0.47, 0.22, faceMat);
    d.position.set(s * 0.47, 0.02, 0.84);
    d.rotation.z = s * 0.1;
    head.add(d);
  }
  const cheeks = sphere(1, 0.68, 0.44, 0.3, faceMat);
  cheeks.position.set(0, -0.3, 0.77);
  head.add(cheeks);

  /* side fluff, springy */
  const fluff: [THREE.Group, THREE.Group] = [new THREE.Group(), new THREE.Group()];
  [-1, 1].forEach((s, i) => {
    fluff[i].position.set(s * 1.0, 0.25, 0.05);
    for (let k = 0; k < 3; k++) {
      const f = leaf(0.62 - k * 0.06, 0.26, leafFeather);
      f.position.set(0, -k * 0.2, k * 0.03);
      f.rotation.set(0, s * 0.9, s * (0.3 + k * 0.28));
      fluff[i].add(f);
    }
    head.add(fluff[i]);
  });

  /* ruff: feathers fanned round the neck, cream at the front */
  const ruff = new THREE.Group();
  ruff.position.set(0, -0.78, 0);
  for (let k = 0; k < 14; k++) {
    const a = -Math.PI + (k / 14) * Math.PI * 2 + 0.2;
    const front = Math.cos(a) > 0.3;
    const f = leaf(front ? 0.95 : 1.0, 0.36, front ? leafFace : leafFeather);
    const holder = new THREE.Group();
    holder.rotation.y = a;
    f.position.set(0, 0, 0.8);
    f.rotation.x = 0.7;
    holder.add(f);
    ruff.add(holder);
  }
  head.add(ruff);

  /* beak */
  const beak = new THREE.Mesh(keep(new THREE.ConeGeometry(0.15, 0.4, 24)), accentMat);
  beak.scale.set(0.9, 1, 0.8);
  beak.rotation.x = Math.PI / 2 + 0.55;
  beak.position.set(0, -0.12, 1.02);
  head.add(beak);
  const lowerBeak = new THREE.Mesh(keep(new THREE.ConeGeometry(0.085, 0.2, 18)), accentMat);
  lowerBeak.position.set(0, -0.2, 1.0);
  lowerBeak.rotation.x = Math.PI / 2 + 0.85;
  head.add(lowerBeak);

  /* ---------- eyes ---------- */
  const black = disc('#0b0f2a');
  const amber = new THREE.MeshPhysicalMaterial({ color: '#ff8a0a', roughness: 0.2, clearcoat: 1, emissive: '#ff6a00', emissiveIntensity: 0.35 });
  const iris2 = new THREE.MeshPhysicalMaterial({ color: '#ffc25a', roughness: 0.2, clearcoat: 1, emissive: '#ff8a1a', emissiveIntensity: 0.25 });
  const pupilMat = new THREE.MeshPhysicalMaterial({ color: '#150a05', roughness: 0.1, clearcoat: 1 });
  const white = disc('#ffffff');
  const lashMat = disc('#0b0f2a');
  const redX = disc('#ff3b30');
  extra.push(black, amber, iris2, pupilMat, white, lashMat, redX);
  const browGeo = keep(new THREE.TorusGeometry(0.36, 0.032, 10, 28, Math.PI * 0.66));
  const browRot = Math.PI / 2 - (Math.PI * 0.66) / 2;

  const eyes = [-1, 1].map((s): Eye => {
    const x = s * 0.47;
    const y = 0.04;
    const group = new THREE.Group();
    group.position.set(x, y, 0.94);
    group.add(sphere(0.33, 1, 1, 0.36, black, 40, 24));
    const iris = sphere(0.29, 1, 1, 0.36, amber, 40, 24);
    iris.position.z = 0.035;
    const rim = sphere(0.22, 1, 1, 0.36, iris2, 40, 24);
    rim.position.z = 0.065;
    group.add(iris, rim);
    const look = new THREE.Group();
    look.position.z = 0.095;
    look.add(sphere(0.185, 1, 1, 0.4, pupilMat, 32, 20));
    const h1 = sphere(0.07, 1, 1, 0.4, white, 20, 12);
    h1.position.set(0.09, 0.1, 0.1);
    const h2 = sphere(0.035, 1, 1, 0.4, white, 16, 10);
    h2.position.set(-0.08, -0.08, 0.1);
    look.add(h1, h2);
    group.add(look);

    const lidTop = sphere(0.365, 1, 1, 0.17, faceMat, 32, 20);
    const lidBottom = sphere(0.365, 1, 1, 0.17, faceMat, 32, 20);
    lidTop.position.z = lidBottom.position.z = 0.14;
    const lashTop = new THREE.Mesh(keep(new THREE.TorusGeometry(0.25, 0.028, 8, 28, Math.PI)), lashMat);
    lashTop.rotation.z = Math.PI;
    lashTop.position.z = 0.2;
    const cross = new THREE.Group();
    for (const a of [Math.PI / 4, -Math.PI / 4]) {
      const bar = new THREE.Mesh(keep(new THREE.BoxGeometry(0.5, 0.075, 0.04)), redX);
      bar.rotation.z = a;
      cross.add(bar);
    }
    cross.position.z = 0.22;
    cross.visible = false;
    group.add(lidTop, lidBottom, lashTop, cross);
    head.add(group);

    const brow = new THREE.Mesh(browGeo, accentMat);
    brow.position.set(x, y + 0.31, 0.9);
    brow.rotation.z = browRot;
    head.add(brow);
    return { group, look, lidTop, lidBottom, lashTop, cross, brow, x, y };
  }) as [Eye, Eye];

  /* tufts */
  const tufts: [THREE.Group, THREE.Group] = [new THREE.Group(), new THREE.Group()];
  [-1, 1].forEach((s, i) => {
    const t = tufts[i];
    t.position.set(s * 0.66, 0.78, -0.02);
    const navy = leaf(1.05, 0.32, leafFeather);
    navy.rotation.set(0, s * 0.35, Math.PI - s * 0.5);
    const orange = leaf(0.86, 0.22, leafAccent);
    orange.position.set(s * 0.06, 0, 0.11);
    orange.rotation.set(-0.05, s * 0.45, Math.PI - s * 0.62);
    const orange2 = leaf(0.56, 0.15, leafAccent);
    orange2.position.set(s * 0.17, 0, 0.15);
    orange2.rotation.set(-0.05, s * 0.5, Math.PI - s * 0.95);
    t.add(navy, orange, orange2);
    head.add(t);
  });

  /* ---------- circuit lines, laid on the skull ---------- */
  const glows: THREE.MeshBasicMaterial[] = [];
  const gm = new THREE.MeshBasicMaterial({ color: colors.glow, toneMapped: false });
  glows.push(gm);
  const on = (az: number, el: number, lift = 1.012) =>
    new THREE.Vector3(RX * Math.cos(el) * Math.sin(az), RY * Math.sin(el), RZ * Math.cos(el) * Math.cos(az)).multiplyScalar(lift);
  const trace = (pts: THREE.Vector3[], node: 'ring' | 'dot') => {
    const tube = new THREE.Mesh(keep(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0), 28, 0.016, 6)), gm);
    head.add(tube);
    const end = pts[pts.length - 1];
    const n = new THREE.Mesh(keep(node === 'ring' ? new THREE.TorusGeometry(0.06, 0.016, 8, 20) : new THREE.SphereGeometry(0.04, 12, 8)), gm);
    n.position.copy(end);
    n.lookAt(end.clone().multiplyScalar(2));
    head.add(n);
  };
  for (const s of [-1, 1]) {
    trace([[1.0, 0.62], [1.2, 0.52], [1.36, 0.3], [1.44, 0.02]].map(([a, e]) => on(s * a, e)), 'ring');
    trace([[1.1, 0.12], [1.25, -0.1], [1.36, -0.12]].map(([a, e]) => on(s * a, e)), 'dot');
  }
  trace([[0, 0.74], [0, 0.98], [0.12, 1.08]].map(([a, e]) => on(a, e)), 'dot');

  /* ---------- state props, drawn above and beside the head ---------- */
  const glowMat = () => new THREE.MeshBasicMaterial({ color: colors.glow, toneMapped: false, transparent: true });
  const dots: THREE.Mesh[] = [-1, 0, 1].map((k) => {
    const m = glowMat();
    glows.push(m);
    const d = new THREE.Mesh(keep(new THREE.SphereGeometry(0.1, 16, 12)), m);
    d.position.set(k * 0.34, 2.2, 0.1);
    d.visible = false;
    hopper.add(d);
    return d;
  });
  const arcs: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    for (let k = 0; k < 2; k++) {
      const m = glowMat();
      glows.push(m);
      const a = new THREE.Mesh(keep(new THREE.TorusGeometry(0.42 + k * 0.28, 0.035, 8, 24, Math.PI * 0.7)), m);
      a.position.set(s * 1.5, 0.15, 0.1);
      a.rotation.z = s > 0 ? -Math.PI * 0.35 : Math.PI + -Math.PI * 0.35;
      a.visible = false;
      hopper.add(a);
      arcs.push(a);
    }
  }
  const spriteTex = (draw: (g: CanvasRenderingContext2D) => void) => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    draw(c.getContext('2d')!);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    extra.push(t);
    return t;
  };
  const zTex = spriteTex((g) => {
    g.font = '900 100px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 12;
    g.strokeStyle = '#13236b';
    g.strokeText('z', 64, 70);
    g.fillStyle = '#ffffff';
    g.fillText('z', 64, 70);
  });
  const starTex = spriteTex((g) => {
    g.fillStyle = '#fff2b0';
    g.beginPath();
    for (let i = 0; i < 8; i++) {
      const r = i % 2 ? 14 : 58;
      const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
      g.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r);
    }
    g.closePath();
    g.fill();
  });
  const sprite = (tex: THREE.Texture) => {
    const m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false });
    extra.push(m);
    const sp = new THREE.Sprite(m);
    sp.visible = false;
    hopper.add(sp);
    return sp;
  };
  const zs = [0, 1, 2].map(() => sprite(zTex));
  const sparks = [0, 1, 2, 3].map(() => sprite(starTex));

  /* ---------- floor shadow ---------- */
  const sc = document.createElement('canvas');
  sc.width = sc.height = 128;
  const sg = sc.getContext('2d')!;
  const rad = sg.createRadialGradient(64, 64, 4, 64, 64, 64);
  rad.addColorStop(0, 'rgba(10,15,50,.5)');
  rad.addColorStop(1, 'rgba(10,15,50,0)');
  sg.fillStyle = rad;
  sg.fillRect(0, 0, 128, 128);
  const shadowTex = new THREE.CanvasTexture(sc);
  const shadow = new THREE.Mesh(keep(new THREE.PlaneGeometry(3.2, 1.8)), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(0, GROUND, 0);
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

  return {
    scene, hopper, head, eyes, tufts, fluff, ruff, lowerBeak, shadow, glows, glowColor: new THREE.Color(colors.glow), dots, zs, sparks, arcs, mats,
    dispose() {
      geos.forEach((g) => g.dispose());
      extra.forEach((m) => m.dispose());
      [...mats.feather, ...mats.accent, ...mats.face].forEach((m) => m.dispose());
      glows.forEach((m) => m.dispose());
      shadowTex.dispose();
      (shadow.material as THREE.Material).dispose();
    },
  };
}

export function recolor(rig: Rig, c: OwlColors) {
  for (const k of ['feather', 'accent', 'face'] as const) rig.mats[k].forEach((m) => m.color.set(c[k]));
  rig.glowColor.set(c.glow);
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
