// The brain landing for jacobmetoyer.com/brain/. Procedural brain; destination stills are engine renders.
import { REGIONS, EYES } from './regions.js';

let THREE;
try { THREE = await import('./vendor/three.module.min.js'); }
catch (e) { THREE = await import('https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js'); }

const qs = new URLSearchParams(location.search);
const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
let reduceMotion = mqReduce.matches || qs.has('reduce');
const rmToggle = document.getElementById('rmToggle');
rmToggle.checked = reduceMotion;
rmToggle.addEventListener('change', () => { reduceMotion = rmToggle.checked; });

let hoverImpl = () => {}, diveImpl = id => openDest(id), stepOutImpl = () => { document.getElementById('dest').hidden = true; };
// ---------- plain list (works with or without WebGL) ----------
const ALL = [EYES.hamon, EYES.spire, ...REGIONS];
const byId = new Map(ALL.map(r => [r.id, r]));
const listEl = document.getElementById('regionList');
for (const a of listEl.querySelectorAll('a[data-id]')) { // static links written by build_static.mjs; enhanced here
  const id = +a.dataset.id;
  a.setAttribute('role', 'button');
  a.addEventListener('mouseenter', () => setHover(id));
  a.addEventListener('focus', () => setHover(id));
  a.addEventListener('mouseleave', () => setHover(0));
  a.addEventListener('click', e => { if (!renderer) return; e.preventDefault(); dive(id); });
}

// ---------- WebGL check / fallback ----------
const canvas = document.getElementById('gl');
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); }
catch (e) { document.body.classList.add('nogl'); }
const lowPower = qs.has('low') || (navigator.hardwareConcurrency || 8) <= 4 || matchMedia('(max-width: 760px)').matches;

// ---------- noise ----------
const P = new Uint8Array(512); { const p = [...Array(256).keys()]; let s = 1337; for (let i = 255; i > 0; i--) { s = (s * 16807) % 2147483647; const j = s % (i + 1); [p[i], p[j]] = [p[j], p[i]]; } for (let i = 0; i < 512; i++) P[i] = p[i & 255]; }
const G = [[1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],[1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],[0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]];
const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
function noise(x, y, z) {
  const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
  x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
  const u = fade(x), v = fade(y), w = fade(z);
  const g = (h, a, b, c) => { const q = G[h % 12]; return q[0] * a + q[1] * b + q[2] * c; };
  const A = P[X] + Y, AA = P[A] + Z, AB = P[A + 1] + Z, B = P[X + 1] + Y, BA = P[B] + Z, BB = P[B + 1] + Z;
  const L = (a, b, t) => a + t * (b - a);
  return L(L(L(g(P[AA], x, y, z), g(P[BA], x - 1, y, z), u), L(g(P[AB], x, y - 1, z), g(P[BB], x - 1, y - 1, z), u), v),
           L(L(g(P[AA + 1], x, y, z - 1), g(P[BA + 1], x - 1, y, z - 1), u), L(g(P[AB + 1], x, y - 1, z - 1), g(P[BB + 1], x - 1, y - 1, z - 1), u), v), w);
}
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---------- brain geometry ----------
function classify(x, y, z) { // hemisphere-local, x>=0 lateral
  const sylv = -0.02 + 0.42 * (z - 0.15);
  if (y < sylv && z > -0.55 && z < 0.80 && x > 0.18) return 3;          // temporal
  if (z > 0.10 - 0.38 * y) return 1;                                    // frontal (anterior to central sulcus)
  if (z < -0.58 + 0.15 * y) return 4;                                   // occipital
  return 2;                                                             // parietal
}
function hemisphere(side, seg) {
  const g = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.7));
  const pos = g.attributes.position, n = pos.count;
  const region = new Float32Array(n), cav = new Float32Array(n);
  const v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(pos, i);
    let x = v.x, y = v.y, z = v.z;
    // base shape (local: x lateral 0..)
    x = (x + 1) * 0.5;                    // 0..1, 0 = medial
    let lx = x < 0.25 ? 0.03 + x * 0.9 : 0.255 + (x - 0.25) * 0.86;     // flat medial wall
    let ly = y * 0.60, lz = z * 1.0;
    if (ly < 0) ly *= 0.62;                                              // flat base
    const tb = Math.exp(-((lz - 0.18) ** 2) / 0.12) * sstep(-0.05, -0.45, y) * sstep(0.3, 0.8, x);
    ly -= 0.20 * tb; lx += 0.05 * tb;                                    // temporal lobe bulge
    lz += 0.06 * Math.max(0, -z) * sstep(0.2, -0.4, y);                  // occipital point
    lx *= 1 - 0.05 * sstep(0.4, 1, z);                                   // narrower frontal pole
    const r = classify(lx, ly, lz);
    // gyri: domain-warped ridged noise
    const f = 4.6;
    const wx = noise(lx * 1.7 + 11, ly * 1.7, lz * 1.7) * 0.55, wy = noise(lx * 1.7, ly * 1.7 + 23, lz * 1.7) * 0.55, wz = noise(lx * 1.7, ly * 1.7, lz * 1.7 + 41) * 0.55;
    const nn = noise((lx + wx) * f, (ly + wy) * f, (lz + wz) * f);
    const nn2 = noise((lx - wy) * 9.0 + 5, (ly + wz) * 9.0, (lz - wx) * 9.0);
    let s = Math.exp(-Math.abs(nn) * 13.0);
    s = Math.max(s, 0.45 * Math.exp(-Math.abs(nn2) * 16.0) * sstep(0.3, 0.6, 1 - s));
    // major fissures: central sulcus + sylvian
    const cs = Math.abs(lz - (0.10 - 0.38 * ly) - 0.04 * noise(ly * 5, 3, lx * 5));
    s = Math.max(s, (1 - sstep(0.0, 0.028, cs)) * sstep(-0.1, 0.2, ly));
    const sy = Math.abs(ly - (-0.02 + 0.42 * (lz - 0.15)) - 0.05 * noise(lz * 4, 7, lx * 3) - 0.08 * sstep(0.1, -0.4, lz));
    s = Math.max(s, (1 - sstep(0.0, 0.035, sy)) * sstep(0.2, 0.5, lx) * sstep(-0.45, -0.25, lz) * sstep(0.75, 0.45, lz));
    const medial = sstep(0.12, 0.04, lx);
    const d = -0.065 * s * (1 - medial * 0.6) + 0.006 * noise(lx * 23, ly * 23, lz * 23);
    const len = Math.hypot(lx, ly, lz) || 1;
    lx += lx / len * d; ly += ly / len * d; lz += lz / len * d;
    pos.setXYZ(i, side * (lx + 0.012), ly, lz);
    region[i] = r; cav[i] = s;
  }
  g.setAttribute('region', new THREE.BufferAttribute(region, 1));
  g.setAttribute('cav', new THREE.BufferAttribute(cav, 1));
  if (side < 0) { const idx = g.index.array; for (let i = 0; i < idx.length; i += 3) { const t = idx[i]; idx[i] = idx[i + 1]; idx[i + 1] = t; } }
  g.computeVertexNormals();
  return g;
}
function cerebellum(seg) {
  const g = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.6));
  const pos = g.attributes.position, n = pos.count, region = new Float32Array(n).fill(5), cav = new Float32Array(n);
  const v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(pos, i);
    const folia = Math.abs(Math.sin((v.y * 0.9 + v.z * 0.5) * 26 + noise(v.x * 3, v.y * 3, v.z * 3) * 1.5));
    const s = 1 - sstep(0.0, 0.35, folia);
    const notch = Math.exp(-(v.x * v.x) / 0.01) * sstep(-0.2, 0.6, v.z) * 0.18;
    const k = 1 - 0.035 * s - notch;
    pos.setXYZ(i, v.x * 0.62 * k, v.y * 0.30 * k, v.z * 0.38 * k);
    cav[i] = s;
  }
  g.setAttribute('region', new THREE.BufferAttribute(region, 1));
  g.setAttribute('cav', new THREE.BufferAttribute(cav, 1));
  g.computeVertexNormals();
  return g;
}

const brainVS = `
attribute float region; attribute float cav;
varying vec3 vN; varying vec3 vW; varying float vR; varying float vC; varying vec3 vL;
void main(){ vR=region; vC=cav; vL=position; vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; vN=normalize(mat3(modelMatrix)*normal); gl_Position=projectionMatrix*viewMatrix*w; }`;
const brainFS = `
uniform float uHover; uniform float uSel; uniform float uTime; uniform vec3 uCam; uniform vec3 uCols[7]; uniform float uDim;
varying vec3 vN; varying vec3 vW; varying float vR; varying float vC; varying vec3 vL;
float hash(vec3 p){ return fract(sin(dot(p,vec3(12.9898,78.233,37.719)))*43758.5453); }
void main(){
  vec3 N=normalize(vN); vec3 V=normalize(uCam-vW);
  vec3 K=normalize(vec3(-0.55,0.75,0.55));               // single hard key, upper left front
  vec3 R=normalize(vec3(0.7,0.25,-0.9));                  // thin rim from behind right
  float diff=pow(max(dot(N,K),0.),1.3)*0.95;
  float wrap=pow(max(dot(N,K)*0.5+0.5,0.),4.)*0.22;       // cheap subsurface wrap
  float spec=pow(max(dot(N,normalize(K+V)),0.),60.)*0.55*(1.-vC);
  float rim=pow(1.-max(dot(N,V),0.),3.)*max(dot(N,R)+0.4,0.);
  vec3 tissue=0.8*mix(vec3(0.52,0.43,0.42),vec3(0.13,0.09,0.11),smoothstep(0.1,0.9,vC));   // desaturated cortex, darker sulci
  float ao=1.-0.75*smoothstep(0.05,0.9,vC);
  vec3 col=tissue*(diff+wrap)*ao*vec3(0.95,0.97,1.05) + vec3(0.75,0.85,1.0)*spec + vec3(0.45,0.55,0.85)*rim*0.6;
  col+=vec3(0.03,0.032,0.045);                               // floor so nothing is pure black
  int ri=int(vR+0.5);
  vec3 rc=uCols[ri<7?ri:0];
  float h=(abs(vR-uHover)<0.5)?1.:0.; float s=(abs(vR-uSel)<0.5)?1.:0.;
  // luminous sulci: light runs along the folds of the active region
  float pulse=0.55+0.45*sin(uTime*1.6+ (vL.z*7.+vL.y*5.));
  float vein=smoothstep(0.35,1.,vC)*pulse;
  float spark=step(0.9965,hash(floor(vL*90.)))*(0.5+0.5*sin(uTime*3.+hash(floor(vL*90.))*40.));
  col=mix(col,col*0.55,max(step(0.5,uHover),step(0.5,uSel))*(1.-max(h,s)));
  float veinA=smoothstep(0.55,1.,vC)*pulse;
  col+=rc*(h*0.9+s*1.4)*(0.05+veinA*1.2+spark*1.5)+rc*h*0.25*rim;
  col+=vec3(0.25,0.38,0.75)*vein*0.07;                      // faint idle glow everywhere
  col*=uDim;
  col=col/(1.+col*0.6); col=pow(col,vec3(1./1.1));
  gl_FragColor=vec4(col,1.);
}`;

const eyeFS = `
uniform float uHover; uniform float uSel; uniform float uTime; uniform vec3 uCam; uniform float uKind; uniform float uDim;
varying vec3 vN; varying vec3 vW; varying vec3 vL;
void main(){
  vec3 N=normalize(vN); vec3 V=normalize(uCam-vW); vec3 K=normalize(vec3(-0.55,0.75,0.55));
  vec3 d=normalize(vL); float a=acos(clamp(d.z,-1.,1.)); float ang=atan(d.y,d.x);
  vec3 sclera=vec3(0.80,0.77,0.76);
  vec3 col=sclera*(max(dot(N,K),0.)*0.8+0.12);
  float irisR=0.50, pupR=0.18;
  if(a<irisR){
    float t=a/irisR; vec3 ic;
    if(uKind<0.5){ // HAMON eye: steel iris with a wavy temper line (hamon) and one ember point
      float wave=0.62+0.06*sin(ang*7.)+0.03*sin(ang*17.+1.3);
      ic=mix(vec3(0.10,0.12,0.22),vec3(0.70,0.76,0.86),smoothstep(wave-0.05,wave+0.02,t));
      ic+=vec3(0.75,0.80,0.92)*0.25*pow(abs(sin(ang*40.+t*8.)),20.);
      float em=smoothstep(0.05,0.0,length(vec2(t*cos(ang),t*sin(ang))-vec2(0.38,-0.30)));
      ic+=vec3(1.0,0.45,0.15)*em*(1.6+0.6*sin(uTime*5.));
    } else {       // SPIRE eye (suggestion): brass-amber lamp iris, ink-dark limbal ring, one cyan "pale" glint (bible textures: brass, ink, cyan pale light)
      ic=mix(vec3(0.85,0.58,0.26),vec3(0.06,0.06,0.09),smoothstep(0.55,0.97,t));
      ic*=0.75+0.25*sin(ang*60.+sin(ang*7.)*3.);
      ic+=vec3(1.,0.8,0.5)*0.25*smoothstep(0.3,0.0,abs(t-0.55))*(0.5+0.5*sin(uTime*1.3));
      float pl=smoothstep(0.06,0.0,length(vec2(t*cos(ang),t*sin(ang))-vec2(-0.36,0.30)));
      ic+=vec3(0.45,0.95,1.0)*pl*(1.3+0.4*sin(uTime*2.3));
    }
    col=ic*(0.35+0.65*max(dot(N,K),0.)+0.25);
    if(a<pupR) col=vec3(0.02,0.02,0.03);
  }
  float spec=pow(max(dot(N,normalize(K+V)),0.),220.)*2.0;   // wet cornea
  float rim=pow(1.-max(dot(N,V),0.),3.)*0.25;
  col+=vec3(1.)*spec+vec3(0.5,0.6,0.9)*rim;
  float h=uHover*0.6+uSel;
  vec3 glow=uKind<0.5?vec3(0.75,0.85,1.0):vec3(1.0,0.75,0.45);
  col+=glow*h*0.35*(0.7+0.3*sin(uTime*2.));
  col+=vec3(0.03);
  col*=uDim;
  col=col/(1.+col*0.5);
  gl_FragColor=vec4(col,1.);
}`;
const eyeVS = `varying vec3 vN; varying vec3 vW; varying vec3 vL;
void main(){ vL=position; vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; vN=normalize(mat3(modelMatrix)*normal); gl_Position=projectionMatrix*viewMatrix*w; }`;

if (renderer) {
  renderer.setPixelRatio(Math.min(devicePixelRatio, lowPower ? 1.25 : 2));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07080b);
  scene.fog = new THREE.FogExp2(0x07080b, 0.08);
  const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 100);
  const cols = [[0, 0, 0], ...REGIONS.map(r => r.color)].map(c => new THREE.Vector3(...c));
  const uni = { uHover: { value: 0 }, uSel: { value: 0 }, uTime: { value: 0 }, uCam: { value: camera.position }, uCols: { value: cols }, uDim: { value: 1 } };
  const brainMat = new THREE.ShaderMaterial({ uniforms: uni, vertexShader: brainVS, fragmentShader: brainFS });
  const seg = lowPower ? 180 : 320;
  const brain = new THREE.Group(); scene.add(brain);
  const L = new THREE.Mesh(hemisphere(-1, seg), brainMat), R = new THREE.Mesh(hemisphere(1, seg), brainMat);
  brain.add(L, R);
  const cb = new THREE.Mesh(cerebellum(lowPower ? 120 : 220), brainMat); cb.position.set(0, -0.40, -0.66); brain.add(cb);
  // brainstem (region 6)
  const stemG = new THREE.CylinderGeometry(0.12, 0.07, 0.62, 48, 8);
  stemG.setAttribute('region', new THREE.BufferAttribute(new Float32Array(stemG.attributes.position.count).fill(6), 1));
  stemG.setAttribute('cav', new THREE.BufferAttribute(new Float32Array(stemG.attributes.position.count).fill(0.15), 1));
  const stem = new THREE.Mesh(stemG, brainMat); stem.position.set(0, -0.62, -0.30); stem.rotation.x = 0.30; brain.add(stem);
  // optic nerves + eyes. Positions are stylised, not anatomical.
  const eyes = {};
  const nerveMat = new THREE.ShaderMaterial({ uniforms: uni, vertexShader: brainVS, fragmentShader: brainFS });
  for (const [kind, side] of [['hamon', -1], ['spire', 1]]) { // side = screen side in the default front view (his right eye is screen-left)
    const e = EYES[kind];
    const eu = { uHover: { value: 0 }, uSel: { value: 0 }, uTime: uni.uTime, uCam: uni.uCam, uKind: { value: kind === 'hamon' ? 0 : 1 }, uDim: uni.uDim };
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.12, 96, 64), new THREE.ShaderMaterial({ uniforms: eu, vertexShader: eyeVS, fragmentShader: eyeFS }));
    m.position.set(side * 0.34, -0.50, 1.10); m.lookAt(side * 0.30, -0.42, 6);
    m.userData.id = e.id; m.userData.u = eu; brain.add(m); eyes[kind] = m;
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(side * 0.33, -0.51, 0.98), new THREE.Vector3(side * 0.22, -0.52, 0.80), new THREE.Vector3(side * 0.02, -0.46, 0.55), new THREE.Vector3(-side * 0.14, -0.44, 0.30)]);
    const tg = new THREE.TubeGeometry(curve, 40, 0.025, 16);
    tg.setAttribute('region', new THREE.BufferAttribute(new Float32Array(tg.attributes.position.count).fill(e.id), 1));
    tg.setAttribute('cav', new THREE.BufferAttribute(new Float32Array(tg.attributes.position.count).fill(0.25), 1));
    brain.add(new THREE.Mesh(tg, nerveMat));
  }
  // dust motes in the dark, for depth
  { const n = lowPower ? 300 : 900, p = new Float32Array(n * 3); for (let i = 0; i < n * 3; i++) p[i] = (Math.random() - 0.5) * 9;
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(p, 3));
    scene.add(new THREE.Points(pg, new THREE.PointsMaterial({ color: 0x4a5878, size: 0.012, transparent: true, opacity: 0.6, depthWrite: false }))); }

  // ---------- dive tunnel scene: neural tissue at synapse scale ----------
  const tunnel = new THREE.Scene(); tunnel.background = new THREE.Color(0x020203);
  const tcam = new THREE.PerspectiveCamera(60, 1, 0.01, 60);
  const tUni = { uTime: { value: 0 }, uA: { value: new THREE.Color(0.6, 0.8, 1) }, uB: { value: new THREE.Color(0.2, 0.3, 0.6) }, uFade: { value: 1 } };
  { const nNeur = lowPower ? 260 : 700, segs = [], cl = [];
    for (let k = 0; k < nNeur; k++) {
      const z0 = -Math.random() * 50, r0 = 0.25 + Math.random() * 2.2, a0 = Math.random() * Math.PI * 2;
      let p = new THREE.Vector3(Math.cos(a0) * r0, Math.sin(a0) * r0, z0);
      let dir = new THREE.Vector3().randomDirection(); const t = Math.random();
      for (let s = 0; s < 14; s++) { // dendrite: a jittered walk with an occasional branch
        dir.add(new THREE.Vector3().randomDirection().multiplyScalar(0.6)).normalize();
        const q = p.clone().addScaledVector(dir, 0.12 + Math.random() * 0.12);
        segs.push(p.x, p.y, p.z, q.x, q.y, q.z); cl.push(t, t);
        if (Math.random() < 0.18) { const b = q.clone().addScaledVector(new THREE.Vector3().randomDirection(), 0.25); segs.push(q.x, q.y, q.z, b.x, b.y, b.z); cl.push(t, t); }
        p = q;
      }
    }
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(segs, 3)); lg.setAttribute('t', new THREE.Float32BufferAttribute(cl, 1));
    const lm = new THREE.ShaderMaterial({ uniforms: tUni, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      vertexShader: `attribute float t; varying float vT; varying float vZ; void main(){ vT=t; vec4 mv=modelViewMatrix*vec4(position,1.); vZ=-mv.z; gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `uniform vec3 uA; uniform vec3 uB; uniform float uTime; uniform float uFade; varying float vT; varying float vZ;
        void main(){ float f=exp(-vZ*0.09)*smoothstep(0.,0.6,vZ); float fire=0.5+0.5*sin(uTime*9.+vT*60.); vec3 c=mix(uB,uA,fire*fire); gl_FragColor=vec4(c*f*0.9*uFade,1.); }` });
    tunnel.add(new THREE.LineSegments(lg, lm));
    const sp = new Float32Array((lowPower ? 400 : 1400) * 3); for (let i = 0; i < sp.length; i += 3) { const a = Math.random() * 6.283, r = 0.2 + Math.random() * 2; sp[i] = Math.cos(a) * r; sp[i + 1] = Math.sin(a) * r; sp[i + 2] = -Math.random() * 50; }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    const dot = document.createElement('canvas'); dot.width = dot.height = 32; { const c = dot.getContext('2d'), gr = c.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, 32, 32); }
    const sm = new THREE.PointsMaterial({ size: 0.03, map: new THREE.CanvasTexture(dot), color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.8 });
    tunnel.add(new THREE.Points(sg, sm)); tunnel.userData.sm = sm;
  }

  // ---------- camera: orbit-lite ----------
  const target = new THREE.Vector3(0, -0.12, 0.15);
  const orbit = { yaw: -0.85, pitch: 0.20, dist: 5.2, vy: 0, vp: 0 };
  let drag = null;
  canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, moved: 0 }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', e => {
    mouse.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); mouseIn = true;
    if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.moved += Math.abs(dx) + Math.abs(dy); drag.x = e.clientX; drag.y = e.clientY;
    orbit.vy = -dx * 0.004; orbit.vp = dy * 0.003;
  });
  canvas.addEventListener('pointerup', e => {
    const wasClick = drag && drag.moved < 6; drag = null;
    if (!wasClick || state !== 'brain') return;
    mouse.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    const id = pick();
    if (!id) return;
    if (e.pointerType === 'touch' && hover !== id) { setHover(id); return; }  // first tap highlights, second steps in
    dive(id);
  });
  canvas.addEventListener('pointerleave', () => { mouseIn = false; });
  canvas.addEventListener('wheel', e => { orbit.dist = Math.min(11, Math.max(3.2, orbit.dist + e.deltaY * 0.002)); e.preventDefault(); }, { passive: false });

  const ray = new THREE.Raycaster(), mouse = new THREE.Vector2(); let mouseIn = false;
  const pickables = [L, R, cb, stem, eyes.hamon, eyes.spire];
  function pick() {
    ray.setFromCamera(mouse, camera);
    const hit = ray.intersectObjects(pickables, false)[0];
    if (!hit) return 0;
    if (hit.object.userData.id) return hit.object.userData.id;
    const ra = hit.object.geometry.attributes.region; return Math.round(ra.getX(hit.face.a));
  }

  // ---------- state machine ----------
  let state = 'brain', hover = 0, sel = 0, t0 = 0, diveFrom = null, diveTo = null, diveCtl = null;
  const label = document.getElementById('label');
  const anchors = { 1: [0, 0.62, 0.75], 2: [0.35, 0.72, -0.25], 3: [0.72, -0.30, 0.25], 4: [0.35, 0.25, -0.92], 5: [0.45, -0.55, -0.70], 6: [0, -1.0, -0.38], 10: [-0.34, -0.50, 1.10], 11: [0.34, -0.50, 1.10] };
  function setHoverImpl(id) {
    hover = id; uni.uHover.value = id;
    eyes.hamon.userData.u.uHover.value = id === 10 ? 1 : 0; eyes.spire.userData.u.uHover.value = id === 11 ? 1 : 0;
    document.querySelectorAll('#regionList a').forEach(b => b.classList.toggle('on', +b.dataset.id === id));
    canvas.style.cursor = id ? 'pointer' : 'grab';
  }
  hoverImpl = setHoverImpl;

  function worldAnchor(id) { const a = anchors[id] || [0, 0, 0]; return new THREE.Vector3(...a).applyMatrix4(brain.matrixWorld); }
  diveImpl = (id) => {
    if (state !== 'brain') return;
    sel = id; setHoverImpl(id); uni.uSel.value = id;
    const r = byId.get(id);
    tUni.uA.value.setRGB(...r.color); tUni.uB.value.setRGB(...r.color.map(c => c * 0.3));
    if (id === 10) { tUni.uB.value.setRGB(0.12, 0.16, 0.38); }                       // indigo into steel
    if (id === 11) { tUni.uA.value.setRGB(1.0, 0.78, 0.50); tUni.uB.value.setRGB(0.20, 0.55, 0.62); } // cyan pale into brass lamp light
    diveFrom = camera.position.clone();
    const a = worldAnchor(id);
    if (id >= 10) { // eyes: swing round to face the eye, then go in through the pupil
      const gaze = new THREE.Vector3(0, 0, 1).applyQuaternion((id === 10 ? eyes.hamon : eyes.spire).getWorldQuaternion(new THREE.Quaternion()));
      diveCtl = a.clone().addScaledVector(gaze, 1.2).add(new THREE.Vector3(0, 0.15, 0)); diveTo = a.clone().addScaledVector(gaze, 0.13);
    } else { diveCtl = null; diveTo = a.clone().add(a.clone().sub(target).normalize().multiplyScalar(0.12)); }
    state = 'diving'; t0 = performance.now(); document.body.classList.add('away');
    label.style.opacity = 0;
  };
  stepOutImpl = () => {
    if (state !== 'inside') return;
    document.getElementById('dest').hidden = true;
    state = 'out'; t0 = performance.now();
    document.querySelector(`#regionList a[data-id="${sel}"]`)?.focus();
  };

  function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; tcam.aspect = w / h; camera.fov = w < h ? 46 : 32; orbit.dist = w < h ? Math.min(11, 5.2 * 1.25 * h / w * 0.75) : 5.2; camera.updateProjectionMatrix(); tcam.updateProjectionMatrix(); }
  addEventListener('resize', resize); resize();

  const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const orbitPos = () => new THREE.Vector3(Math.sin(orbit.yaw) * Math.cos(orbit.pitch), Math.sin(orbit.pitch), Math.cos(orbit.yaw) * Math.cos(orbit.pitch)).multiplyScalar(orbit.dist).add(target);
  const fixedT = qs.has('t') ? +qs.get('t') : null;
  function frame(now) {
    const time = fixedT ?? now / 1000; uni.uTime.value = time; tUni.uTime.value = time;
    if (state === 'brain') {
      if (!drag) { orbit.vy *= 0.93; orbit.vp *= 0.93; if (!reduceMotion && fixedT === null) orbit.yaw += 0.0006; }
      orbit.yaw += orbit.vy; orbit.pitch = Math.min(0.7, Math.max(-0.45, orbit.pitch + orbit.vp));
      camera.position.copy(orbitPos()); camera.lookAt(target);
      if (mouseIn && !drag) { const id = pick(); if (id !== hover) setHoverImpl(id); }
      if (hover) { const p = worldAnchor(hover).project(camera); const r = byId.get(hover);
        label.textContent = `${r.title} · ${r.name}`; label.style.setProperty('--c', `rgb(${r.color.map(c => c * 255 | 0).join(',')})`);
        label.style.left = `${(p.x * 0.5 + 0.5) * innerWidth + 14}px`; label.style.top = `${(-p.y * 0.5 + 0.5) * innerHeight - 10}px`; label.style.opacity = 1; }
      else label.style.opacity = 0;
      uni.uDim.value = 1;
      renderer.render(scene, camera);
    } else if (state === 'diving' || state === 'out') {
      const D = (reduceMotion ? 0.35 : 2.6) * (+qs.get('slow') || 1);
      let k = Math.min(1, (now - t0) / 1000 / D); const kk = state === 'out' ? 1 - k : k;
      if (reduceMotion) { // no camera flight: crossfade only
        uni.uDim.value = 1 - kk; camera.position.copy(orbitPos()); camera.lookAt(target); renderer.render(scene, camera);
      } else if (kk < 0.55) { // fly into the surface
        const q = ease(kk / 0.55);
        if (diveCtl) { const u = 1 - q; camera.position.set(0, 0, 0).addScaledVector(diveFrom, u * u).addScaledVector(diveCtl, 2 * u * q).addScaledVector(diveTo, q * q); }
        else camera.position.lerpVectors(diveFrom, diveTo, q); camera.lookAt(target.clone().lerp(worldAnchor(sel), q));
        uni.uDim.value = 1 - 0.6 * Math.max(0, (q - 0.6) / 0.4); renderer.render(scene, camera);
      } else {                // through the tissue
        const q = (kk - 0.55) / 0.45;
        tcam.position.set(Math.sin(time * 0.7) * 0.05, Math.cos(time * 0.5) * 0.05, -q * 40); tcam.lookAt(0, 0, -q * 40 - 5); tcam.rotation.z = q * 0.6;
        tUni.uFade.value = Math.min(1, (kk - 0.55) / 0.08) * (1 - sstep(0.85, 1, q));
        tunnel.userData.sm.opacity = tUni.uFade.value * 0.8;
        renderer.render(tunnel, tcam);
      }
      if (k >= 1) {
        if (state === 'diving') { state = 'inside'; openDest(sel); }
        else { state = 'brain'; sel = 0; document.body.classList.remove('away'); uni.uSel.value = 0; uni.uDim.value = 1; }
      }
    } else if (state === 'inside') {
      // destination is HTML/video; render nothing heavy
    }
    requestAnimationFrame(frame);
  }
  if (qs.has('hover')) setHoverImpl(+qs.get('hover'));
  requestAnimationFrame(frame);
  addEventListener('keydown', e => {
    if (e.key === 'Escape') stepOutImpl();
    if (state !== 'brain') return;
    const ids = ALL.map(r => r.id), i = ids.indexOf(hover);
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { setHoverImpl(ids[(i + 1) % ids.length]); e.preventDefault(); }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { setHoverImpl(ids[(i - 1 + ids.length) % ids.length]); e.preventDefault(); }
    if (e.key === 'Enter' && hover && document.activeElement === document.body) dive(hover);
  });
  window.__dive = id => diveImpl(id); window.__state = () => state;
}

function setHover(id) { hoverImpl(id); }
function dive(id) { diveImpl(id); }

function openDest(id) {
  const r = byId.get(id), d = document.getElementById('dest'), m = document.getElementById('destMedia');
  document.getElementById('destKicker').textContent = r.kicker;
  document.getElementById('destTitle').textContent = r.title;
  document.getElementById('destLead').textContent = r.lead;
  document.getElementById('destItems').innerHTML = r.items.map(([a, b]) => `<li><b>${a}</b>: ${b}</li>`).join('');
  document.getElementById('destNote').textContent = r.note;
  if (r.link) { const a = document.createElement('a'); a.href = r.link[0]; a.textContent = r.link[1]; a.className = 'destLink'; const li = document.createElement('li'); li.appendChild(a); document.getElementById('destItems').appendChild(li); }
  m.innerHTML = '';
  if (r.media) {
    // Swap point: when hamon-engine delivers the approach video, use
    // <video src="media/hamon-approach-1920.mp4" poster=... muted playsinline autoplay> and a still sequence for reduced motion.
    const img = new Image(); img.src = r.media; img.alt = r.mediaTag; m.appendChild(img);
    const tag = document.createElement('div'); tag.className = 'tag'; tag.textContent = r.mediaTag; m.appendChild(tag);
  } else {
    m.innerHTML = `<div class="tissue" style="background:radial-gradient(ellipse at 40% 45%, rgba(${r.color.map(c => c * 120 | 0).join(',')},0.55), #050507 70%)"></div>`;
  }
  d.hidden = false;
  document.getElementById('stepOut').focus();
}
document.getElementById('stepOut').addEventListener('click', () => stepOutImpl());
