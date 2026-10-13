import * as THREE from 'three';
import { CONFIG } from './config.js';

// ============================ yardımcılar ============================
const $ = (id) => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const turnTo = (cur, target, k) => {
  const d = ((((target - cur + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI;
  return cur + d * k;
};
const SRGB = THREE.SRGBColorSpace;

// ============================ ses ============================
let ac = null;
let muted = false;
function sfx(kind) {
  if (muted) return;
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    const seqs = {
      collect: [[660, 0.08], [880, 0.1]],
      hit: [[180, 0.16], [120, 0.2]],
      win: [[523, 0.12], [659, 0.12], [784, 0.12], [1046, 0.35]],
      lose: [[300, 0.2], [220, 0.3]],
      need: [[400, 0.1], [400, 0.1]]
    };
    let t = ac.currentTime;
    for (const [f, d] of seqs[kind]) {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = kind === 'hit' ? 'sawtooth' : 'triangle';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.16, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g);
      g.connect(ac.destination);
      o.start(t);
      o.stop(t + d + 0.03);
      t += d * 0.9;
    }
  } catch (e) { /* ses çalışmazsa sorun değil */ }
}

// ============================ sahne ============================
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = SRGB;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 250);
function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

const hemi = new THREE.HemisphereLight(0xffffff, 0x88aa66, 0.9);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -28, right: 28, top: 28, bottom: -28, near: 1, far: 120 });
sun.shadow.bias = -0.0005;
scene.add(sun, sun.target);

const THEMES = {
  gun:     { sky: 0x8fd3ff, ground: 0x6cc36a, hemi: [0xffffff, 0x88aa66, 0.95], sun: [0xfff3d6, 1.7], sparkle: 0xffffff },
  gunbati: { sky: 0xffa27a, ground: 0x7dad5b, hemi: [0xffd7b0, 0x7a6a4a, 0.85], sun: [0xff9f5a, 1.5], sparkle: 0xfff0a0 },
  gece:    { sky: 0x0a1030, ground: 0x2b4a3a, hemi: [0x7788cc, 0x223322, 0.65], sun: [0x8899ff, 0.55], sparkle: 0xffe58a, star: true }
};

// ============================ ortak malzemeler ============================
const stdMat = (color, rough = 0.8, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra });

const FLOWER_COLORS = [0xff5d8f, 0xffffff, 0xffb703, 0xc77dff, 0xff8fab, 0xff4d6d];
const petalMats = FLOWER_COLORS.map((c) => stdMat(c, 0.55));
const petalGeo = new THREE.SphereGeometry(0.22, 10, 8);
petalGeo.scale(1, 0.35, 1.5);
const centerGeo = new THREE.SphereGeometry(0.17, 12, 10);
const centerMat = stdMat(0xffd23f, 0.5, { emissive: 0x553300, emissiveIntensity: 0.4 });
const stemGeo = new THREE.CylinderGeometry(0.04, 0.05, 0.85, 6);
const stemMat = stdMat(0x3f9b46, 0.8);
const ringGeo = new THREE.RingGeometry(0.55, 0.8, 28).rotateX(-Math.PI / 2);

function makeFlowerHead(colorIdx, scale = 1) {
  const g = new THREE.Group();
  const pm = petalMats[colorIdx % petalMats.length];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const p = new THREE.Mesh(petalGeo, pm);
    p.position.set(Math.sin(a) * 0.27, 0, Math.cos(a) * 0.27);
    p.rotation.y = a;
    g.add(p);
  }
  const c = new THREE.Mesh(centerGeo, centerMat);
  c.position.y = 0.06;
  g.add(c);
  g.scale.setScalar(scale);
  return g;
}

function makeFlower(colorIdx) {
  const g = new THREE.Group();
  const stem = new THREE.Mesh(stemGeo, stemMat);
  stem.position.y = 0.42;
  stem.castShadow = true;
  g.add(stem);
  const head = makeFlowerHead(colorIdx, 1.15);
  head.position.y = 0.9;
  head.rotation.x = -0.35;
  g.add(head);
  const ringMat = new THREE.MeshBasicMaterial({ color: FLOWER_COLORS[colorIdx % FLOWER_COLORS.length], transparent: true, opacity: 0.45, depthWrite: false });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.y = 0.04;
  g.add(ring);
  g.userData = { head, ring };
  return g;
}

// ============================ yüz dokusu ============================
const faceCache = {};
function loadFace(url) {
  if (faceCache[url] !== undefined) return Promise.resolve(faceCache[url]);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const s = 256;
      const cv = document.createElement('canvas');
      cv.width = cv.height = s;
      const x = cv.getContext('2d');
      const m = Math.min(img.width, img.height);
      x.drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, s, s);
      x.globalCompositeOperation = 'destination-in';
      const gr = x.createRadialGradient(s / 2, s / 2, s * 0.33, s / 2, s / 2, s * 0.5);
      gr.addColorStop(0, 'rgba(0,0,0,1)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = gr;
      x.fillRect(0, 0, s, s);
      const t = new THREE.CanvasTexture(cv);
      t.colorSpace = SRGB;
      t.anisotropy = 4;
      faceCache[url] = t;
      resolve(t);
    };
    img.onerror = () => { faceCache[url] = null; resolve(null); };
    img.src = url;
  });
}

const photoCache = {};
function loadPhoto(url) {
  if (photoCache[url]) return photoCache[url];
  const t = new THREE.TextureLoader().load(url);
  t.colorSpace = SRGB;
  photoCache[url] = t;
  return t;
}

// ============================ karakter ============================
function makeCharacter(kind, faceTex) {
  const isGirl = kind === 'kiz';
  const jacket = 0x15151a;
  const pants = isGirl ? 0x5a463c : 0x23252b;
  const skin = 0xf0c3a0;
  const hair = isGirl ? 0x6b4a34 : 0x3b2a22;
  const root = new THREE.Group();   // konum + yön
  const body = new THREE.Group();   // zıplama / sallanma
  root.add(body);

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(isGirl ? 0.4 : 0.44, 0.55, 6, 14), stdMat(jacket, 0.6));
  torso.position.y = 1.35;
  torso.castShadow = true;
  body.add(torso);

  const legs = [];
  for (const s of [-1, 1]) {
    const p = new THREE.Group();
    p.position.set(s * 0.2, 0.85, 0);
    const l = new THREE.Mesh(new THREE.CapsuleGeometry(isGirl ? 0.2 : 0.16, 0.5, 4, 8), stdMat(pants, 0.9));
    l.position.y = -0.4;
    l.castShadow = true;
    p.add(l);
    body.add(p);
    legs.push(p);
  }

  const arms = [];
  for (const s of [-1, 1]) {
    const p = new THREE.Group();
    p.position.set(s * 0.56, 1.8, 0);
    const a = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.42, 4, 8), stdMat(jacket, 0.6));
    a.position.y = -0.34;
    a.castShadow = true;
    p.add(a);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), stdMat(skin, 0.7));
    hand.position.y = -0.74;
    p.add(hand);
    body.add(p);
    arms.push(p);
  }

  const head = new THREE.Group();
  head.position.y = 2.5;
  const R = 0.62;
  const skull = new THREE.Mesh(new THREE.SphereGeometry(R, 32, 24), stdMat(hair, 0.7));
  skull.castShadow = true;
  head.add(skull);
  if (isGirl) {
    const back = new THREE.Mesh(new THREE.SphereGeometry(0.68, 24, 18), stdMat(hair, 0.7));
    back.scale.set(1, 1.3, 0.85);
    back.position.set(0, -0.4, -0.22);
    back.castShadow = true;
    head.add(back);
  }
  if (faceTex) {
    const a = 0.8;
    const capGeo = new THREE.SphereGeometry(R * 1.006, 40, 32, Math.PI / 2 - a, a * 2, Math.PI / 2 - a, a * 2);
    const pos = capGeo.attributes.position;
    const uv = capGeo.attributes.uv;
    const Rf = R * Math.sin(a);
    for (let i = 0; i < pos.count; i++) {
      uv.setXY(i, 0.5 + pos.getX(i) / (2 * Rf), 0.5 + pos.getY(i) / (2 * Rf));
    }
    const cap = new THREE.Mesh(capGeo, new THREE.MeshBasicMaterial({ map: faceTex, transparent: true, color: 0xeeeeee }));
    head.add(cap);
  } else {
    // fotoğraf yüklenemezse basit yüz
    const face = new THREE.Mesh(new THREE.SphereGeometry(R * 1.004, 24, 18), stdMat(skin, 0.7));
    face.scale.set(0.85, 0.85, 0.9);
    face.position.z = 0.06;
    head.add(face);
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), stdMat(0x222222));
      e.position.set(s * 0.2, 0.08, 0.56);
      head.add(e);
    }
  }
  body.add(head);

  root.userData = { body, legs, arms, head, amp: 0, phase: 0 };
  return root;
}

// buket (çiçek sayısına göre büyür)
function makeBouquet() {
  const g = new THREE.Group();
  const paper = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.7, 12), stdMat(0xffc2d6, 0.7));
  paper.rotation.x = Math.PI;
  paper.position.y = -0.2;
  g.add(paper);
  const flowers = new THREE.Group();
  g.add(flowers);
  g.position.set(0, 1.55, 0.95);
  g.visible = false;
  g.userData.set = (n) => {
    while (flowers.children.length) flowers.remove(flowers.children[0]);
    const m = Math.min(n, 14);
    for (let i = 0; i < m; i++) {
      const a = i * 2.4;
      const r = 0.06 + 0.1 * Math.sqrt(i);
      const h = makeFlowerHead(i, 0.8);
      h.position.set(Math.cos(a) * r, 0.22 + Math.sin(i * 1.3) * 0.05 + 0.04 * (m - i) / m, Math.sin(a) * r);
      h.rotation.x = Math.sin(a) * 0.5;
      h.rotation.z = Math.cos(a) * 0.5;
      flowers.add(h);
    }
    g.visible = n > 0;
  };
  return g;
}

// ============================ arı ============================
const beeBodyGeo = new THREE.SphereGeometry(0.4, 14, 10).scale(1, 0.85, 1.3);
const beeYellow = stdMat(0xffd21f, 0.5, { emissive: 0x332200, emissiveIntensity: 0.4 });
const beeBlack = stdMat(0x1a1a1a, 0.6);
const beeStripeGeo = new THREE.TorusGeometry(0.34, 0.07, 8, 16);
const wingGeo = new THREE.PlaneGeometry(0.55, 0.32);
const wingMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, side: THREE.DoubleSide });
function makeBee() {
  const g = new THREE.Group();
  const b = new THREE.Mesh(beeBodyGeo, beeYellow);
  b.castShadow = true;
  g.add(b);
  for (const z of [-0.12, 0.2]) {
    const s = new THREE.Mesh(beeStripeGeo, beeBlack);
    s.position.z = z;
    s.scale.setScalar(z > 0 ? 0.9 : 1);
    g.add(s);
  }
  const eyes = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), beeBlack);
  eyes.position.set(0, 0.05, 0.5);
  g.add(eyes);
  const wings = [];
  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(wingGeo, wingMat);
    w.position.set(s * 0.32, 0.38, -0.05);
    w.rotation.x = Math.PI / 2;
    g.add(w);
    wings.push(w);
  }
  g.scale.setScalar(1.25);
  g.userData.wings = wings;
  return g;
}

// ============================ engeller ============================
const trunkGeo = new THREE.CylinderGeometry(0.25, 0.35, 1.6, 8);
const trunkMat = stdMat(0x7a5230, 0.9);
const leafGeoA = new THREE.ConeGeometry(1.4, 2.4, 10);
const leafGeoB = new THREE.ConeGeometry(1.05, 1.9, 10);
const leafMats = [stdMat(0x2f8f46, 0.8), stdMat(0x3aa356, 0.8), stdMat(0x287a3c, 0.8)];
const rockGeo = new THREE.DodecahedronGeometry(0.95, 0);
const rockMat = stdMat(0x8e949c, 0.95);
const bushGeo = new THREE.SphereGeometry(1, 14, 10);
const bushMat = stdMat(0x45a85a, 0.85);

function makeObstacle(type) {
  const g = new THREE.Group();
  if (type === 0) {
    const t = new THREE.Mesh(trunkGeo, trunkMat);
    t.position.y = 0.8;
    t.castShadow = true;
    g.add(t);
    const m = leafMats[Math.floor(Math.random() * leafMats.length)];
    const a = new THREE.Mesh(leafGeoA, m);
    a.position.y = 2.7;
    a.castShadow = true;
    g.add(a);
    const b = new THREE.Mesh(leafGeoB, m);
    b.position.y = 3.9;
    b.castShadow = true;
    g.add(b);
    g.userData.r = 0.9;
  } else if (type === 1) {
    const r = new THREE.Mesh(rockGeo, rockMat);
    r.scale.set(rand(0.9, 1.4), rand(0.7, 1.1), rand(0.9, 1.4));
    r.position.y = 0.55;
    r.rotation.y = rand(0, 6);
    r.castShadow = true;
    r.receiveShadow = true;
    g.add(r);
    g.userData.r = 1.2;
  } else {
    const b = new THREE.Mesh(bushGeo, bushMat);
    b.scale.set(1.2, 0.9, 1.2);
    b.position.y = 0.8;
    b.castShadow = true;
    g.add(b);
    g.userData.r = 1.2;
  }
  return g;
}

// ============================ kalp efekti ============================
function heartTexture(color) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  x.fillStyle = color;
  x.beginPath();
  x.moveTo(32, 58);
  x.bezierCurveTo(2, 36, 6, 6, 32, 22);
  x.bezierCurveTo(58, 6, 62, 36, 32, 58);
  x.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = SRGB;
  return t;
}
const heartTexPink = heartTexture('#ff4f7b');
const heartTexRed = heartTexture('#ff2d55');
const fx = [];
function spawnHearts(pos, n, power = 1) {
  for (let i = 0; i < n; i++) {
    const mat = new THREE.SpriteMaterial({ map: Math.random() < 0.5 ? heartTexPink : heartTexRed, transparent: true, depthWrite: false });
    const s = new THREE.Sprite(mat);
    s.position.copy(pos);
    s.scale.setScalar(rand(0.4, 0.8) * power);
    scene.add(s);
    const a = rand(0, Math.PI * 2);
    const sp = rand(1.5, 4) * power;
    fx.push({ s, v: new THREE.Vector3(Math.cos(a) * sp, rand(3, 6) * power, Math.sin(a) * sp), life: rand(1, 1.7), max: 1.7 });
  }
}
function updateFx(dt) {
  for (let i = fx.length - 1; i >= 0; i--) {
    const f = fx[i];
    f.s.position.addScaledVector(f.v, dt);
    f.v.y -= 6 * dt;
    f.v.x *= 0.98;
    f.v.z *= 0.98;
    f.life -= dt;
    f.s.material.opacity = clamp(f.life / 0.6, 0, 1);
    if (f.life <= 0) {
      scene.remove(f.s);
      f.s.material.dispose();
      fx.splice(i, 1);
    }
  }
}

// ============================ oyun durumu ============================
const S = {
  role: null, partnerRole: null,
  level: 0, state: 'menu', inGame: false,
  carrying: 0, need: 0, time: 0, invul: 0,
  world: 16, deliverT: 0, toastCd: 0, t: 0
};
let player = null, partner = null, bouquet = null, partnerBouquet = null, partnerHeart = null;
let levelGroup = null, arrow = null;
let flowers = [], bees = [], obstacles = [], sparkles = null, marker = null, partnerPos = new THREE.Vector3(), startPos = new THREE.Vector3();
const dummy = new THREE.Object3D();

const roleName = (r) => CONFIG[r].ad;
const fmt = (s) => s.replaceAll('{alan}', roleName(S.partnerRole)).replaceAll('{veren}', roleName(S.role));

// ============================ seviye kurma ============================
function clearLevel() {
  if (levelGroup) {
    scene.remove(levelGroup);
    levelGroup.traverse((o) => {
      if (o.userData && o.userData.dispose) o.userData.dispose();
    });
  }
  levelGroup = new THREE.Group();
  scene.add(levelGroup);
  flowers = []; bees = []; obstacles = [];
}

function makeStarGeo(R, r, depth) {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 ? r : R;
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    const x = Math.cos(a) * rad, y = Math.sin(a) * rad;
    if (i) s.lineTo(x, y); else s.moveTo(x, y);
  }
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelSize: 0.15, bevelThickness: 0.15, bevelSegments: 2 });
  g.center();
  return g;
}

function buildLevel(idx) {
  clearLevel();
  const L = CONFIG.seviyeler[idx];
  const th = THEMES[L.tema] || THEMES.gun;
  const W = L.dunya || 16;
  S.world = W;

  scene.background = new THREE.Color(th.sky);
  scene.fog = new THREE.Fog(th.sky, 38, 95);
  hemi.color.setHex(th.hemi[0]); hemi.groundColor.setHex(th.hemi[1]); hemi.intensity = th.hemi[2];
  sun.color.setHex(th.sun[0]); sun.intensity = th.sun[1];

  // zemin
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), stdMat(th.ground, 1));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.userData.dispose = () => { ground.geometry.dispose(); ground.material.dispose(); };
  levelGroup.add(ground);

  // çit
  const fenceMat = stdMat(0xf3e9d2, 0.8);
  const postPos = [];
  for (let x = -W; x <= W; x += 2) { postPos.push([x, -W], [x, W]); }
  for (let z = -W + 2; z <= W - 2; z += 2) { postPos.push([-W, z], [W, z]); }
  const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.26, 1.3, 0.26), fenceMat, postPos.length);
  postPos.forEach(([x, z], i) => { dummy.position.set(x, 0.65, z); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); posts.setMatrixAt(i, dummy.matrix); });
  posts.castShadow = true;
  levelGroup.add(posts);
  for (const [w, d, x, z] of [[2 * W, 0.1, 0, -W], [2 * W, 0.1, 0, W], [0.1, 2 * W, -W, 0], [0.1, 2 * W, W, 0]]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, d), fenceMat);
    rail.position.set(x, 0.95, z);
    levelGroup.add(rail);
  }

  // süs: çimen ve minik çiçekler
  const tufts = new THREE.InstancedMesh(new THREE.ConeGeometry(0.1, 0.5, 5), stdMat(0xffffff, 1), 260);
  const tuftColor = new THREE.Color();
  for (let i = 0; i < 260; i++) {
    dummy.position.set(rand(-W, W), 0.22, rand(-W, W));
    dummy.rotation.set(rand(-0.2, 0.2), rand(0, 6), rand(-0.2, 0.2));
    dummy.scale.setScalar(rand(0.7, 1.5));
    dummy.updateMatrix();
    tufts.setMatrixAt(i, dummy.matrix);
    tuftColor.setHSL(rand(0.27, 0.36), 0.55, L.tema === 'gece' ? 0.22 : rand(0.3, 0.42));
    tufts.setColorAt(i, tuftColor);
  }
  levelGroup.add(tufts);
  const dots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.1, 8, 6), stdMat(0xffffff, 0.7), 180);
  for (let i = 0; i < 180; i++) {
    dummy.position.set(rand(-W, W), 0.1, rand(-W, W));
    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(rand(0.8, 1.4));
    dummy.updateMatrix();
    dots.setMatrixAt(i, dummy.matrix);
    tuftColor.setHex(FLOWER_COLORS[Math.floor(Math.random() * FLOWER_COLORS.length)]);
    dots.setColorAt(i, tuftColor);
  }
  levelGroup.add(dots);

  // yerleşim
  partnerPos.set(rand(-W * 0.25, W * 0.25), 0, -W + 6);
  startPos.set(rand(-3, 3), 0, W - 4);

  // fotoğraf çerçeveleri (kuzey duvarı)
  const photos = CONFIG.fotolar || [];
  photos.slice(0, 2).forEach((url, i) => {
    const fr = new THREE.Group();
    const w = 3.15, h = 4.2;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, h + 0.4, 0.3), stdMat(0xd4a94a, 0.35, { metalness: 0.4 }));
    frame.position.y = h / 2 + 1.3;
    frame.castShadow = true;
    fr.add(frame);
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: loadPhoto(url) }));
    pic.position.set(0, h / 2 + 1.3, 0.16);
    fr.add(pic);
    for (const s of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.4, 8), stdMat(0x7a5230));
      post.position.set(s * 1.2, 0.7, -0.05);
      post.castShadow = true;
      fr.add(post);
    }
    fr.position.set((i === 0 ? -1 : 1) * W * 0.55, 0, -W + 1.2);
    fr.rotation.y = (i === 0 ? 1 : -1) * 0.18;
    levelGroup.add(fr);
  });

  // engeller
  const okObs = (x, z, rr) => {
    if (Math.hypot(x - startPos.x, z - startPos.z) < 6) return false;
    if (Math.hypot(x - partnerPos.x, z - partnerPos.z) < 6) return false;
    if (z < -W + 3.5) return false;
    for (const o of obstacles) if (Math.hypot(x - o.x, z - o.z) < o.r + rr + 1.6) return false;
    return true;
  };
  for (let i = 0; i < (L.engel || 0); i++) {
    const type = Math.random() < 0.5 ? 0 : Math.random() < 0.5 ? 1 : 2;
    const m = makeObstacle(type);
    const rr = m.userData.r;
    for (let k = 0; k < 120; k++) {
      const x = rand(-W + 2.5, W - 2.5), z = rand(-W + 2.5, W - 2.5);
      if (okObs(x, z, rr)) {
        m.position.set(x, 0, z);
        m.rotation.y = rand(0, 6);
        levelGroup.add(m);
        obstacles.push({ x, z, r: rr });
        break;
      }
    }
  }

  // çiçekler
  for (let i = 0; i < L.cicek; i++) {
    const f = makeFlower(i);
    const p = freeSpot();
    f.position.set(p.x, 0, p.z);
    f.userData.phase = rand(0, 6);
    f.userData.collected = false;
    levelGroup.add(f);
    flowers.push(f);
  }

  // arılar
  for (let i = 0; i < (L.ari || 0); i++) {
    const b = makeBee();
    let x = 0, z = 0;
    for (let k = 0; k < 60; k++) {
      x = rand(-W + 2, W - 2); z = rand(-W + 2, W - 2);
      if (Math.hypot(x - startPos.x, z - startPos.z) > 14) break;
    }
    b.position.set(x, 2, z);
    b.userData.target = new THREE.Vector3(x, 2, z);
    b.userData.phase = rand(0, 6);
    levelGroup.add(b);
    bees.push(b);
  }

  // partner işareti (yüzük)
  const mk = new THREE.Mesh(new THREE.RingGeometry(1.9, 2.3, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff7aa8, transparent: true, opacity: 0.8, depthWrite: false }));
  mk.position.set(partnerPos.x, 0.06, partnerPos.z);
  levelGroup.add(mk);
  marker = mk;

  // yıldızlı gece: büyük ışıklı yıldız
  if (th.star) {
    const starMat = stdMat(0xffc83d, 0.4, { emissive: 0xffa500, emissiveIntensity: 1.4 });
    const star = new THREE.Mesh(makeStarGeo(5.2, 2.3, 0.6), starMat);
    star.position.set(0, 8.5, -W + 1);
    star.castShadow = false;
    levelGroup.add(star);
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a1 = Math.PI / 2 + (i * Math.PI) / 5, a2 = Math.PI / 2 + ((i + 1) * Math.PI) / 5;
      const r1 = (i % 2 ? 2.3 : 5.2) + 0.5, r2 = ((i + 1) % 2 ? 2.3 : 5.2) + 0.5;
      for (let k = 0; k < 9; k++) {
        const t = k / 9;
        pts.push(
          (Math.cos(a1) * r1) * (1 - t) + (Math.cos(a2) * r2) * t,
          (Math.sin(a1) * r1) * (1 - t) + (Math.sin(a2) * r2) * t,
          0.6
        );
      }
    }
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const lights = new THREE.Points(lg, new THREE.PointsMaterial({ color: 0xfff1b8, size: 0.35, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    lights.position.copy(star.position);
    levelGroup.add(lights);
    const pl = new THREE.PointLight(0xffd27a, 90, 40, 2);
    pl.position.set(partnerPos.x, 6, partnerPos.z + 3);
    levelGroup.add(pl);
    // çit ışıkları
    const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.14, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe9a0 }), 60);
    for (let i = 0; i < 60; i++) {
      const x = -W + (i / 59) * 2 * W;
      dummy.position.set(x, 2.8 - Math.sin((i / 59) * Math.PI * 6) * 0.2 - 0.5 * Math.abs(Math.sin((i / 59) * Math.PI * 6)), -W);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      bulbs.setMatrixAt(i, dummy.matrix);
    }
    levelGroup.add(bulbs);
  }

  // parıltılar (uçuşan ışık / polen)
  const N = 150;
  const base = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { base[i * 3] = rand(-W, W); base[i * 3 + 1] = rand(0.5, 7); base[i * 3 + 2] = rand(-W, W); }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(base.slice(), 3));
  sparkles = new THREE.Points(sg, new THREE.PointsMaterial({ color: th.sparkle, size: 0.2, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
  sparkles.userData.base = base;
  sparkles.frustumCulled = false;
  levelGroup.add(sparkles);
}

function freeSpot() {
  const W = S.world;
  for (let k = 0; k < 250; k++) {
    const x = rand(-W + 2, W - 2), z = rand(-W + 2, W - 2);
    if (z < -W + 3.2) continue;
    if (Math.hypot(x - startPos.x, z - startPos.z) < 4.5) continue;
    if (Math.hypot(x - partnerPos.x, z - partnerPos.z) < 5) continue;
    let ok = true;
    for (const o of obstacles) if (Math.hypot(x - o.x, z - o.z) < o.r + 1.4) { ok = false; break; }
    if (ok) for (const f of flowers) if (f.userData.collected === false && Math.hypot(x - f.position.x, z - f.position.z) < 2) { ok = false; break; }
    if (ok) return { x, z };
  }
  return { x: 0, z: 0 };
}

// ============================ oyunu / seviyeyi başlat ============================
async function startRole(role) {
  S.role = role;
  S.partnerRole = role === 'kiz' ? 'erkek' : 'kiz';
  const [pt, qt] = await Promise.all([loadFace(CONFIG[role].yuz), loadFace(CONFIG[S.partnerRole].yuz)]);
  if (player) scene.remove(player);
  if (partner) scene.remove(partner);
  player = makeCharacter(role, pt);
  partner = makeCharacter(S.partnerRole, qt);
  bouquet = makeBouquet();
  player.userData.body.add(bouquet);
  partnerBouquet = makeBouquet();
  partner.userData.body.add(partnerBouquet);
  scene.add(player, partner);

  if (partnerHeart) scene.remove(partnerHeart);
  partnerHeart = new THREE.Sprite(new THREE.SpriteMaterial({ map: heartTexRed, transparent: true, depthWrite: false }));
  scene.add(partnerHeart);

  if (arrow) scene.remove(arrow);
  arrow = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.8, 10).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff4f7b }));
  scene.add(arrow);

  showLevelSelect();
}

function startLevel(idx) {
  S.level = idx;
  const L = CONFIG.seviyeler[idx];
  buildLevel(idx);
  S.need = L.cicek;
  S.carrying = 0;
  S.invul = 0;
  S.time = L.sure || 0;
  S.deliverT = 0;
  S.inGame = true;
  bouquet.userData.set(0);
  partnerBouquet.userData.set(0);
  player.visible = true;
  player.position.copy(startPos);
  player.rotation.y = Math.PI;
  partner.position.copy(partnerPos);
  partner.rotation.y = 0;
  partner.position.y = 0;
  camera.position.set(startPos.x, 12, startPos.z + 12);
  hideOverlay();
  $('hud').classList.remove('hidden');
  updateHud();
  S.state = 'play';
  toast(`Seviye ${idx + 1}: ${L.ad}<br><small>${L.cicek} çiçek topla, sonra ${roleName(S.partnerRole)}'a götür!${idx === 0 ? '<br>Ekrana basılı tutup sürükle ya da WASD / ok tuşlarını kullan.' : ''}</small>`, idx === 0 ? 5200 : 3200);
}

// ============================ HUD / ekranlar ============================
const ov = $('overlay');
function showOverlay(html) {
  ov.innerHTML = `<div class="card">${html}</div>`;
  ov.classList.remove('hidden');
}
function hideOverlay() { ov.classList.add('hidden'); }
let toastTimer = 0;
function toast(html, ms = 2200) {
  const t = $('toast');
  t.innerHTML = html;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}
function updateHud() {
  const L = CONFIG.seviyeler[S.level];
  $('hLevel').textContent = `Seviye ${S.level + 1} · ${L.ad}`;
  $('hFlowers').textContent = `🌸 ${S.carrying}/${S.need}`;
  const tp = $('hTime');
  if (L.sure) { tp.classList.remove('hidden'); tp.textContent = `⏱ ${Math.max(0, Math.ceil(S.time))}`; tp.classList.toggle('warn', S.time < 15); }
  else tp.classList.add('hidden');
}
function progKey() { return 'cicekler_ilerleme_' + S.role; }
function getProgress() { try { return parseInt(localStorage.getItem(progKey()) || '0', 10) || 0; } catch (e) { return 0; } }
function setProgress(n) { try { if (n > getProgress()) localStorage.setItem(progKey(), String(n)); } catch (e) { /* yok say */ } }

function showTitle() {
  S.state = 'menu';
  S.inGame = false;
  if (arrow) arrow.visible = false;
  $('hud').classList.add('hidden');
  showOverlay(`
    <h1>${CONFIG.baslik}</h1>
    <p class="sub">${CONFIG.altBaslik}</p>
    <p class="ask">Kim oynuyor?</p>
    <div class="chars">
      <button class="char" data-a="role" data-v="erkek"><img src="${CONFIG.erkek.yuz}" alt=""><span>${CONFIG.erkek.etiket}</span></button>
      <button class="char" data-a="role" data-v="kiz"><img src="${CONFIG.kiz.yuz}" alt=""><span>${CONFIG.kiz.etiket}</span></button>
    </div>
    <p class="hint">Oynayan kişinin yüzü karakterde görünür, çiçekleri diğerine götürür.</p>`);
}

function showLevelSelect() {
  const prog = getProgress();
  const btns = CONFIG.seviyeler.map((L, i) => {
    const locked = i > prog;
    return `<button class="lvl ${locked ? 'locked' : ''} ${i === prog ? 'current' : ''}" ${locked ? 'disabled' : ''} data-a="level" data-v="${i}"><b>${locked ? '🔒' : i + 1}</b><span>${L.ad}</span></button>`;
  }).join('');
  S.state = 'menu';
  showOverlay(`
    <div class="who"><img src="${CONFIG[S.role].yuz}" alt=""><span>→</span><img src="${CONFIG[S.partnerRole].yuz}" alt=""></div>
    <h2>Seviye seç</h2>
    <div class="lvls">${btns}</div>
    <div class="row">
      ${S.inGame ? '<button class="btn ghost" data-a="resume">Oyuna dön</button>' : ''}
      <button class="btn ghost" data-a="title">Karakteri değiştir</button>
    </div>`);
}

function showWin() {
  S.state = 'win';
  const L = CONFIG.seviyeler[S.level];
  const last = S.level >= CONFIG.seviyeler.length - 1;
  setProgress(S.level + 1);
  showOverlay(`
    <div class="burst">🎉</div>
    <h2>Seviye ${S.level + 1} tamam!</h2>
    <p class="msg">${fmt(L.mesaj)}</p>
    <div class="row">
      <button class="btn" data-a="${last ? 'final' : 'next'}">${last ? 'Sürprizi gör 💌' : 'Sonraki seviye ▶'}</button>
      <button class="btn ghost" data-a="again">Tekrar oyna</button>
    </div>`);
}

function showLose() {
  S.state = 'lose';
  sfx('lose');
  showOverlay(`
    <div class="burst">⏳</div>
    <h2>Süre doldu</h2>
    <p class="msg">Bir daha dene, bu sefer yapacaksın!</p>
    <div class="row">
      <button class="btn" data-a="again">Tekrar dene</button>
      <button class="btn ghost" data-a="levels">Seviyeler</button>
    </div>`);
}

function showFinal() {
  S.state = 'final';
  const ph = (CONFIG.fotolar || []).slice(0, 2).map((u, i) => `<figure class="polaroid p${i}"><img src="${u}" alt=""></figure>`).join('');
  showOverlay(`
    <div class="polas">${ph}</div>
    <h2>Hepsini topladın! 💐</h2>
    <p class="msg">${fmt(CONFIG.finalMesaj)}</p>
    <div class="row">
      <button class="btn" data-a="restart">Baştan oyna</button>
      <button class="btn ghost" data-a="title">Karakteri değiştir</button>
    </div>`);
  const pos = partner ? partner.position.clone().add(new THREE.Vector3(0, 3.5, 0)) : new THREE.Vector3();
  spawnHearts(pos, 30, 1.4);
}

const actions = {
  role: (r) => { startRole(r); },
  level: (i) => startLevel(parseInt(i, 10)),
  next: () => startLevel(S.level + 1),
  again: () => startLevel(S.level),
  levels: () => showLevelSelect(),
  title: () => showTitle(),
  final: () => showFinal(),
  restart: () => startLevel(0),
  resume: () => { hideOverlay(); S.state = 'play'; }
};
ov.addEventListener('click', (e) => {
  const b = e.target.closest('[data-a]');
  if (!b) return;
  const fn = actions[b.dataset.a];
  if (fn) fn(b.dataset.v);
});
$('bMenu').addEventListener('click', () => { if (S.inGame && (S.state === 'play')) showLevelSelect(); });
$('bMute').addEventListener('click', () => { muted = !muted; $('bMute').textContent = muted ? '🔇' : '🔊'; });

// ============================ kontroller ============================
const keys = {};
window.addEventListener('keydown', (e) => { keys[e.code] = true; if (e.code.startsWith('Arrow')) e.preventDefault(); });
window.addEventListener('keyup', (e) => { keys[e.code] = false; });
const drag = { id: null, sx: 0, sy: 0, x: 0, y: 0 };
const joyBase = $('joyBase'), joyKnob = $('joyKnob');
canvas.addEventListener('pointerdown', (e) => {
  if (S.state !== 'play') return;
  drag.id = e.pointerId; drag.sx = drag.x = e.clientX; drag.sy = drag.y = e.clientY;
  canvas.setPointerCapture(e.pointerId);
  joyBase.style.left = e.clientX + 'px'; joyBase.style.top = e.clientY + 'px';
  joyKnob.style.transform = 'translate(-50%,-50%)';
  joyBase.classList.add('on');
});
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerId !== drag.id) return;
  drag.x = e.clientX; drag.y = e.clientY;
  const dx = clamp(drag.x - drag.sx, -55, 55), dy = clamp(drag.y - drag.sy, -55, 55);
  joyKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
});
const endDrag = (e) => { if (e.pointerId === drag.id) { drag.id = null; joyBase.classList.remove('on'); } };
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

function readInput() {
  let ix = 0, iy = 0;
  if (keys.KeyA || keys.ArrowLeft) ix -= 1;
  if (keys.KeyD || keys.ArrowRight) ix += 1;
  if (keys.KeyW || keys.ArrowUp) iy -= 1;
  if (keys.KeyS || keys.ArrowDown) iy += 1;
  if (drag.id !== null) {
    const dx = drag.x - drag.sx, dy = drag.y - drag.sy;
    const len = Math.hypot(dx, dy);
    if (len > 8) { const k = Math.min(1, len / 55); ix += (dx / len) * k; iy += (dy / len) * k; }
  }
  const l = Math.hypot(ix, iy);
  if (l > 1) { ix /= l; iy /= l; }
  return { ix, iy, len: Math.min(1, l) };
}

// ============================ güncelleme ============================
function animateCharacter(c, dt, speedAmount, carrying, wave = false) {
  const u = c.userData;
  u.amp += (speedAmount - u.amp) * Math.min(1, dt * 10);
  u.phase += dt * (6 + 8 * speedAmount);
  const sw = Math.sin(u.phase) * 0.75 * u.amp;
  u.legs[0].rotation.x = sw;
  u.legs[1].rotation.x = -sw;
  if (carrying) {
    u.arms[0].rotation.x = -1.15; u.arms[1].rotation.x = -1.15;
    u.arms[0].rotation.z = 0.25; u.arms[1].rotation.z = -0.25;
  } else if (wave) {
    u.arms[0].rotation.x = 0; u.arms[0].rotation.z = 0;
    u.arms[1].rotation.x = 0; u.arms[1].rotation.z = 2.5 + Math.sin(S.t * 8) * 0.35;
  } else {
    u.arms[0].rotation.x = -sw; u.arms[1].rotation.x = sw;
    u.arms[0].rotation.z = 0; u.arms[1].rotation.z = 0;
  }
  u.body.position.y = Math.abs(Math.sin(u.phase)) * 0.09 * u.amp;
  u.head.rotation.z = Math.sin(u.phase * 0.5) * 0.06 * u.amp;
}

function collide(p) {
  const W = S.world - 1;
  p.x = clamp(p.x, -W, W);
  p.z = clamp(p.z, -W, W);
  for (const o of obstacles) {
    const dx = p.x - o.x, dz = p.z - o.z;
    const d = Math.hypot(dx, dz), min = o.r + 0.45;
    if (d < min && d > 0.0001) { p.x = o.x + (dx / d) * min; p.z = o.z + (dz / d) * min; }
  }
}

function dropFlower() {
  if (S.carrying <= 0) return;
  S.carrying--;
  bouquet.userData.set(S.carrying);
  const f = flowers.find((q) => q.userData.collected);
  if (f) {
    const p = freeSpot();
    f.position.set(p.x, 0, p.z);
    f.userData.collected = false;
    f.visible = true;
  }
  toast('Arı bir çiçeği düşürttü! 🐝', 1600);
  updateHud();
}

function update(dt) {
  S.t += dt;
  const t = S.t;

  // dünya animasyonları
  for (const f of flowers) {
    if (!f.visible) continue;
    f.userData.head.rotation.y = t * 1.2 + f.userData.phase;
    f.userData.head.position.y = 0.9 + Math.sin(t * 2.4 + f.userData.phase) * 0.06;
    f.userData.ring.material.opacity = 0.3 + 0.2 * Math.sin(t * 3 + f.userData.phase);
  }
  if (sparkles) {
    const pos = sparkles.geometry.attributes.position, base = sparkles.userData.base;
    for (let i = 0; i < pos.count; i++) {
      pos.setXYZ(i, base[i * 3] + Math.sin(t * 0.5 + i) * 0.8, base[i * 3 + 1] + Math.sin(t * 0.9 + i * 1.7) * 0.5, base[i * 3 + 2] + Math.cos(t * 0.4 + i) * 0.8);
    }
    pos.needsUpdate = true;
  }
  if (marker) {
    const ready = S.carrying >= S.need;
    const s = 1 + 0.08 * Math.sin(t * 4);
    marker.scale.set(s, 1, s);
    marker.material.color.setHex(ready ? 0xffd23f : 0xff7aa8);
  }
  if (partnerHeart && partner) {
    const ready = S.carrying >= S.need;
    const sc = (ready ? 1.4 : 1) + Math.sin(t * 4) * 0.12;
    partnerHeart.scale.setScalar(sc);
    partnerHeart.position.set(partner.position.x, 4.9 + Math.sin(t * 2.5) * 0.15 + partner.position.y, partner.position.z);
  }
  updateFx(dt);

  if (!player || !S.inGame) return;

  // arılar
  for (const b of bees) {
    const u = b.userData;
    const toP = new THREE.Vector3(player.position.x - b.position.x, 0, player.position.z - b.position.z);
    const dist = toP.length();
    const chasing = (S.state === 'play') && dist < 8;
    if (!chasing) {
      if (Math.hypot(u.target.x - b.position.x, u.target.z - b.position.z) < 0.8) {
        u.target.set(rand(-S.world + 2, S.world - 2), 2, rand(-S.world + 2, S.world - 2));
      }
    }
    const dir = chasing ? toP.clone().normalize() : new THREE.Vector3(u.target.x - b.position.x, 0, u.target.z - b.position.z).normalize();
    const sp = chasing ? 3.4 : 1.8;
    b.position.x += dir.x * sp * dt;
    b.position.z += dir.z * sp * dt;
    b.position.y = 1.8 + Math.sin(t * 3 + u.phase) * 0.3;
    b.rotation.y = turnTo(b.rotation.y, Math.atan2(dir.x, dir.z), 0.15);
    u.wings[0].rotation.z = 0.5 + Math.sin(t * 45) * 0.5;
    u.wings[1].rotation.z = -0.5 - Math.sin(t * 45) * 0.5;
  }

  const ud = player.userData;

  if (S.state === 'play') {
    const inp = readInput();
    if (inp.len > 0.05) {
      const speed = 6.4 * inp.len;
      player.position.x += (inp.ix / Math.max(inp.len, 0.001)) * speed * dt;
      player.position.z += (inp.iy / Math.max(inp.len, 0.001)) * speed * dt;
      player.rotation.y = turnTo(player.rotation.y, Math.atan2(inp.ix, inp.iy), Math.min(1, dt * 14));
    }
    collide(player.position);
    animateCharacter(player, dt, inp.len > 0.05 ? inp.len : 0, S.carrying > 0);

    // çiçek topla
    for (const f of flowers) {
      if (f.userData.collected) continue;
      if (Math.hypot(f.position.x - player.position.x, f.position.z - player.position.z) < 1.4) {
        f.userData.collected = true;
        f.visible = false;
        S.carrying++;
        bouquet.userData.set(S.carrying);
        spawnHearts(new THREE.Vector3(f.position.x, 1.2, f.position.z), 5, 0.6);
        sfx('collect');
        updateHud();
        if (S.carrying >= S.need) toast(`Hepsi tamam! Şimdi ${roleName(S.partnerRole)}'a git 💕`, 2600);
      }
    }

    // arı çarpması
    S.invul = Math.max(0, S.invul - dt);
    player.visible = S.invul <= 0 || Math.floor(S.t * 14) % 2 === 0;
    if (S.invul <= 0) {
      for (const b of bees) {
        if (Math.hypot(b.position.x - player.position.x, b.position.z - player.position.z) < 1.15) {
          S.invul = 1.6;
          const kx = player.position.x - b.position.x, kz = player.position.z - b.position.z;
          const kl = Math.hypot(kx, kz) || 1;
          player.position.x += (kx / kl) * 2.6;
          player.position.z += (kz / kl) * 2.6;
          collide(player.position);
          sfx('hit');
          dropFlower();
          break;
        }
      }
    }

    // partnerle buluşma
    const dp = Math.hypot(partner.position.x - player.position.x, partner.position.z - player.position.z);
    if (dp < 2.8) {
      if (S.carrying >= S.need) {
        S.state = 'deliver';
        S.deliverT = 0;
        player.visible = true;
        joyBase.classList.remove('on');
        drag.id = null;
        const dir = new THREE.Vector3(player.position.x - partner.position.x, 0, player.position.z - partner.position.z).normalize();
        S.deliverFrom = player.position.clone();
        S.deliverTo = partner.position.clone().addScaledVector(dir, 2.0);
        S.deliverDone = false;
      } else if (S.toastCd <= 0) {
        toast(`Biraz daha çiçek lazım! (${S.carrying}/${S.need}) 🌸`, 1800);
        sfx('need');
        S.toastCd = 2.5;
      }
    }
    S.toastCd -= dt;

    // süre
    const L = CONFIG.seviyeler[S.level];
    if (L.sure) {
      S.time -= dt;
      updateHud();
      if (S.time <= 0) { S.time = 0; updateHud(); showLose(); }
    }

    // partner bekler, el sallar, oyuncuya bakar
    partner.rotation.y = turnTo(partner.rotation.y, Math.atan2(player.position.x - partner.position.x, player.position.z - partner.position.z), 0.06);
    animateCharacter(partner, dt, 0, false, true);
  } else if (S.state === 'deliver') {
    S.deliverT += dt;
    const k = clamp(S.deliverT / 0.8, 0, 1);
    const e = k * k * (3 - 2 * k);
    player.position.lerpVectors(S.deliverFrom, S.deliverTo, e);
    const toPartner = Math.atan2(partner.position.x - player.position.x, partner.position.z - player.position.z);
    player.rotation.y = turnTo(player.rotation.y, toPartner, 0.25);
    partner.rotation.y = turnTo(partner.rotation.y, Math.atan2(player.position.x - partner.position.x, player.position.z - partner.position.z), 0.25);
    animateCharacter(player, dt, k < 1 ? 0.6 : 0, !S.deliverDone);
    if (S.deliverT > 0.9 && !S.deliverDone) {
      S.deliverDone = true;
      bouquet.userData.set(0);
      partnerBouquet.userData.set(S.need);
      spawnHearts(new THREE.Vector3(partner.position.x, 3, partner.position.z), 45, 1.2);
      sfx('win');
    }
    if (S.deliverDone) {
      const jt = S.deliverT - 0.9;
      partner.position.y = Math.abs(Math.sin(jt * 6)) * 0.7 * Math.max(0, 1 - jt / 2.2);
      animateCharacter(partner, dt, 0, true);
      if (Math.floor(jt * 3) !== Math.floor((jt - dt) * 3) && jt < 1.8) spawnHearts(new THREE.Vector3(partner.position.x, 3, partner.position.z), 6, 0.9);
    } else {
      animateCharacter(partner, dt, 0, false, true);
    }
    if (S.deliverT > 3.0) showWin();
  }

  // ok: hedefi göster
  if (arrow) {
    const showArrow = S.state === 'play';
    arrow.visible = showArrow;
    if (showArrow) {
      let target = partner.position;
      if (S.carrying < S.need) {
        let best = Infinity;
        for (const f of flowers) {
          if (f.userData.collected) continue;
          const d = Math.hypot(f.position.x - player.position.x, f.position.z - player.position.z);
          if (d < best) { best = d; target = f.position; }
        }
      }
      const a = Math.atan2(target.x - player.position.x, target.z - player.position.z);
      arrow.position.set(player.position.x + Math.sin(a) * 1.1, 4.5 + Math.sin(t * 5) * 0.1, player.position.z + Math.cos(a) * 1.1);
      arrow.rotation.y = a;
      arrow.material.color.setHex(S.carrying >= S.need ? 0xffd23f : 0xff4f7b);
    }
  }
}

// ============================ kamera + döngü ============================
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);

  const focus = player && S.inGame ? player.position : new THREE.Vector3(0, 0, 0);
  const portrait = camera.aspect < 1;
  const H = portrait ? 15 : 11.5, D = portrait ? 14 : 11.5;
  if (S.inGame) {
    let fx_ = focus.x, fz_ = focus.z;
    if (S.state === 'deliver' && partner) { fx_ = (focus.x + partner.position.x) / 2; fz_ = (focus.z + partner.position.z) / 2; }
    const k = 1 - Math.exp(-5 * dt);
    camera.position.x += (fx_ - camera.position.x) * k;
    camera.position.y += (H - camera.position.y) * k;
    camera.position.z += (fz_ + D - camera.position.z) * k;
    camera.lookAt(camera.position.x, 1.2, camera.position.z - D * 0.95);
    sun.target.position.set(focus.x, 0, focus.z);
    sun.position.set(focus.x + 18, 32, focus.z + 12);
  } else {
    // menüde sahne yavaşça dönsün
    const a = now * 0.0001;
    camera.position.set(Math.sin(a) * 24, 14, Math.cos(a) * 24);
    camera.lookAt(0, 1, 0);
  }
  renderer.render(scene, camera);
}

// ============================ başlangıç ============================
// menü arka planı için bir bahçe kur
(function boot() {
  S.world = 16;
  S.partnerRole = 'kiz';
  S.role = 'erkek';
  buildLevel(0);
  S.inGame = false;
  showTitle();
  requestAnimationFrame(frame);
})();
