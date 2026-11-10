/* Цифрлы Қазақстан — 3D виртуалды әлем. Three.js r149 */
(function () {
'use strict';
var QS = location.search;
if (QS.indexOf('debug') >= 0) window.onerror = function (m, s, l) { var d = document.createElement('pre'); d.id = 'err'; d.style.cssText = 'position:fixed;left:0;top:0;z-index:99;background:#900;color:#fff;padding:6px'; d.textContent = 'ERR ' + m + ' @' + l; document.body.appendChild(d); };

if (THREE.ColorManagement) THREE.ColorManagement.legacyMode = false;

// ---------- мәтіндер ----------
function UI() { return D.ui; }
function ST(id) { return D.st[id]; }
var clickables = [];
function clk(o, key) { o.userData.info = key; clickables.push(o); return o; }

// ---------- карта проекциясы ----------
var K = 14, KX = K * 0.669;
function P(lon, lat) { return new THREE.Vector3((lon - 67) * KX, 0, -(lat - 48) * K); }
var POLY = KZ_BORDER.map(function (p) { return [(p[0] - 67) * KX, -(p[1] - 48) * K]; });
function inKZ(x, z) {
  var r = false;
  for (var i = 0, j = POLY.length - 1; i < POLY.length; j = i++) {
    var a = POLY[i], b = POLY[j];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) r = !r;
  }
  return r;
}
var seed = 7;
function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
function rr(a, b) { return a + rnd() * (b - a); }

// ---------- сахна ----------
var canvas = document.getElementById('c');
var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
var scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x8d8fd6, 170, 560);
var camera = new THREE.PerspectiveCamera(55, 1, 0.5, 1600);

function canvasTex(w, h, draw) {
  var c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
}
scene.background = canvasTex(16, 512, function (g, w, h) {
  var gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, '#0a1445'); gr.addColorStop(0.35, '#2b3f9e'); gr.addColorStop(0.62, '#8d8fd6'); gr.addColorStop(0.8, '#f3a6bd'); gr.addColorStop(1, '#ffd9a0');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
});

scene.add(new THREE.HemisphereLight(0xdfe9ff, 0x6a78a8, 1.0));
var sun = new THREE.DirectionalLight(0xfff0d8, 1.7);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
var sc = sun.shadow.camera; sc.left = -55; sc.right = 55; sc.top = 55; sc.bottom = -55; sc.near = 1; sc.far = 260;
sun.shadow.bias = -0.0006;
scene.add(sun); scene.add(sun.target);

var updaters = [];
function onTick(f) { updaters.push(f); }

// ---------- көмекші функциялар ----------
var matCache = {};
function mat(c, o) {
  if (!o && matCache[c]) return matCache[c];
  var m = new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.75, metalness: 0.05 }, o || {}));
  if (!o) matCache[c] = m; return m;
}
function glowMat(c, i) { return new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i == null ? 1.2 : i, roughness: 0.4 }); }
function mesh(geo, m, x, y, z, parent, noShadow) {
  var o = new THREE.Mesh(geo, m); o.position.set(x || 0, y || 0, z || 0);
  if (!noShadow) { o.castShadow = true; o.receiveShadow = true; }
  if (parent) parent.add(o); return o;
}
function box(w, h, d, m, x, y, z, p) { return mesh(new THREE.BoxGeometry(w, h, d), m, x, y, z, p); }
function cyl(rt, rb, h, m, x, y, z, p, seg) { return mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 18), m, x, y, z, p); }
function sph(r, m, x, y, z, p) { return mesh(new THREE.SphereGeometry(r, 20, 14), m, x, y, z, p); }
function grp(x, y, z, p) { var g = new THREE.Group(); g.position.set(x || 0, y || 0, z || 0); if (p) p.add(g); return g; }

var glowTex = canvasTex(128, 128, function (g) {
  var gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
});
function glow(color, size, x, y, z, p) {
  var s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
  s.scale.set(size, size, 1); s.position.set(x || 0, y || 0, z || 0); if (p) p.add(s); return s;
}
function textTex(text, o) {
  o = o || {};
  var fs = 72, pad = 26, c = document.createElement('canvas'), g = c.getContext('2d');
  var font = '800 ' + fs + 'px "Trebuchet MS","Segoe UI",system-ui,sans-serif';
  g.font = font; var w = Math.ceil(g.measureText(text).width) + pad * 2, h = fs + pad * 2;
  c.width = w; c.height = h; g.font = font; g.textBaseline = 'middle';
  if (o.bg !== null) {
    g.fillStyle = o.bg || 'rgba(12,20,60,.86)'; var r = h / 2;
    g.beginPath(); g.moveTo(r, 0); g.lineTo(w - r, 0); g.arc(w - r, r, r, -Math.PI / 2, Math.PI / 2); g.lineTo(r, h); g.arc(r, r, r, Math.PI / 2, Math.PI * 1.5); g.fill();
    g.lineWidth = 5; g.strokeStyle = o.border || 'rgba(120,220,255,.9)'; g.stroke();
  }
  g.fillStyle = o.color || '#fff'; g.fillText(text, pad, h / 2 + 4);
  var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.userData = { asp: w / h }; return t;
}
var labels = [];
function label(getText, hgt, x, y, z, p, o) {
  var s = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false }));
  s.position.set(x, y, z); if (p) p.add(s);
  var rec = { s: s, get: typeof getText === 'function' ? getText : function () { return getText; }, h: hgt, o: o };
  labels.push(rec); setLabel(rec); return s;
}
function setLabel(rec) {
  if (rec.s.material.map) rec.s.material.map.dispose();
  var t = textTex(rec.get(), rec.o); rec.s.material.map = t; rec.s.material.needsUpdate = true;
  rec.s.scale.set(rec.h * t.userData.asp, rec.h, 1);
}
function emoji(ch, size, x, y, z, p) {
  var t = canvasTex(128, 128, function (g) { g.font = '96px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, 64, 70); });
  var s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
  s.scale.set(size, size, 1); s.position.set(x || 0, y || 0, z || 0); if (p) p.add(s); return s;
}
var winTexs = [0, 1, 2].map(function (k) {
  var t = canvasTex(64, 128, function (g) {
    g.fillStyle = '#000'; g.fillRect(0, 0, 64, 128);
    for (var y = 0; y < 8; y++) for (var x = 0; x < 4; x++) {
      var v = rnd(); g.fillStyle = v > 0.45 ? (k === 1 ? '#ffe9a8' : (v > 0.8 ? '#ffe9a8' : '#8fe9ff')) : '#1a2440';
      g.fillRect(4 + x * 15, 5 + y * 15.4, 10, 10);
    }
  });
  return t;
});
function winMat(c, k) { return new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, metalness: 0.2, emissive: 0xffffff, emissiveIntensity: 0.85, emissiveMap: winTexs[k || 0] }); }
function ring(r, tube, color, x, y, z, p) { var o = mesh(new THREE.TorusGeometry(r, tube, 8, 48), glowMat(color, 1.6), x, y, z, p, true); o.rotation.x = Math.PI / 2; return o; }

// ---------- жер: Қазақстан картасы ----------
(function buildLand() {
  var shape = new THREE.Shape();
  POLY.forEach(function (p, i) { if (i) shape.lineTo(p[0], -p[1]); else shape.moveTo(p[0], -p[1]); });
  var geo = new THREE.ExtrudeGeometry(shape, { depth: 3, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2); geo.translate(0, -3, 0);
  var tex = canvasTex(1024, 564, function (g, w, h) {
    var gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#5fb86a'); gr.addColorStop(0.45, '#9ccb6c'); gr.addColorStop(0.8, '#d9cf7c'); gr.addColorStop(1, '#e6c77a');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    function blob(x, z, r, col) { var cx = (x / 400 + 0.5) * w, cy = (z / 220 + 0.5) * h, rg = g.createRadialGradient(cx, cy, 0, cx, cy, r); rg.addColorStop(0, col); rg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rg; g.fillRect(cx - r, cy - r, r * 2, r * 2); }
    blob(-110, 45, 260, 'rgba(236,205,130,.95)'); blob(-20, 50, 200, 'rgba(232,210,140,.7)'); blob(140, -20, 150, 'rgba(70,160,90,.7)'); blob(100, 70, 120, 'rgba(110,180,110,.7)'); blob(0, -90, 220, 'rgba(80,175,95,.6)');
    for (var i = 0; i < 260; i++) { g.fillStyle = 'rgba(' + (rnd() > 0.5 ? '255,255,220' : '40,90,50') + ',' + rr(0.03, 0.09) + ')'; g.beginPath(); g.arc(rnd() * w, rnd() * h, rr(4, 26), 0, 7); g.fill(); }
    g.strokeStyle = 'rgba(255,255,255,.10)'; g.lineWidth = 1;
    for (var x = 0; x < w; x += 25.6) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (var y = 0; y < h; y += 25.6) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  });
  tex.repeat.set(1 / 400, 1 / 220); tex.offset.set(0.5, 0.5); tex.anisotropy = 8;
  var land = new THREE.Mesh(geo, [new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }), mat(0xb98f55)]);
  land.receiveShadow = true; scene.add(land);
  // жарқыраған шекара
  var pts = POLY.map(function (p) { return new THREE.Vector3(p[0], 0.15, p[1]); }); pts.push(pts[0].clone());
  scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x7ff6ff, fog: false })));
  // «цифрлы теңіз»
  var sea = mesh(new THREE.PlaneGeometry(2400, 2400), new THREE.MeshStandardMaterial({ color: 0x16357e, roughness: 0.35, metalness: 0.4 }), 0, -1.6, 0, scene, true);
  sea.rotation.x = -Math.PI / 2; sea.receiveShadow = true;
  var grid = new THREE.GridHelper(2400, 120, 0x4fd8ff, 0x3a6fd0); grid.position.y = -1.5; grid.material.transparent = true; grid.material.opacity = 0.28; scene.add(grid);
  // көлдер
  var wm = new THREE.MeshStandardMaterial({ color: 0x2f8fe0, roughness: 0.2, metalness: 0.5, emissive: 0x0a3a80, emissiveIntensity: 0.5 });
  function lake(lon, lat, sx, sz, rot) { var p = P(lon, lat), m = mesh(new THREE.CircleGeometry(1, 28), wm, p.x, 0.07, p.z, scene, true); m.rotation.x = -Math.PI / 2; m.rotation.z = rot || 0; m.scale.set(sx, sz, 1); m.receiveShadow = true; return m; }
  clk(lake(60.0, 45.3, 7, 9), 'aral'); clk(lake(75.5, 46.3, 19, 3.6, 0.12), 'balkhash'); lake(83.9, 48.0, 6, 2.2, -0.3);
  clk(label(function () { return '🌊 ' + UI().cities.caspian; }, 3.4, P(50, 42.2).x, 3, P(50, 42.2).z, scene, { bg: 'rgba(10,40,100,.88)' }), 'caspian');
  clk(label(function () { return '💧 ' + UI().cities.balkhash; }, 2.2, P(75.5, 46.3).x, 2.6, P(75.5, 46.3).z, scene, { bg: 'rgba(10,40,100,.88)' }), 'balkhash');
  clk(label(function () { return '💧 ' + UI().cities.aral; }, 2.2, P(60, 45.3).x, 2.6, P(60, 45.3).z, scene, { bg: 'rgba(10,40,100,.88)' }), 'aral');
})();

// ---------- станциялар ----------
var A = P(71.43, 51.17);
var stations = [
  { id: 'ai', icon: '🔮', color: 0x33e1ff, pos: new THREE.Vector3(A.x, 0, A.z - 4), r: 9, camR: 23, camH: 13, lookY: 7, labelY: 18 },
  { id: 'super', icon: '🖥️', color: 0x76e000, pos: new THREE.Vector3(A.x - 32, 0, A.z + 6), r: 9, camR: 20, camH: 9, lookY: 3.5, labelY: 11 },
  { id: 'hub', icon: '🚀', color: 0xff8a3d, pos: new THREE.Vector3(A.x + 2, 0, A.z + 36), r: 9, camR: 21, camH: 10, lookY: 4, labelY: 12.5 },
  { id: 'internet', icon: '🌐', color: 0x4da3ff, pos: P(53.0, 44.0), r: 9, camR: 24, camH: 11, lookY: 3, labelY: 13.5 },
  { id: 'space', icon: '🛰️', color: 0xc48bff, pos: P(63.3, 45.96), r: 9, camR: 24, camH: 10, lookY: 5, labelY: 14 },
  { id: 'mining', icon: '⛏️', color: 0xffc928, pos: P(75.32, 51.72), r: 10, camR: 25, camH: 12, lookY: 3, labelY: 14.5 },
  { id: 'kazai', icon: '🗣️', color: 0xff6fb1, pos: P(79.6, 50.2), r: 8, camR: 20, camH: 9, lookY: 4, labelY: 12 },
  { id: 'smart', icon: '🏙️', color: 0x44f0c0, pos: P(77.0, 45.0), r: 18, camR: 38, camH: 22, lookY: 2, labelY: 17, open: true },
  { id: 'agro', icon: '🌾', color: 0xa8e04a, pos: P(63.8, 52.6), r: 11, camR: 26, camH: 12, lookY: 2, labelY: 11 },
  { id: 'school', icon: '🎓', color: 0xffe14d, pos: P(69.2, 42.9), r: 9, camR: 22, camH: 10, lookY: 4, labelY: 12.5 },
  { id: 'baiterek', icon: '🌟', color: 0xffc928, pos: new THREE.Vector3(A.x - 16, 0, A.z + 22), r: 5, camR: 24, camH: 12, lookY: 9, labelY: 19 }
];
var IN_SCALE = { ai: 0.6, super: 0.75, hub: 0.6, internet: 0.6, space: 0.62, mining: 0.6, kazai: 0.8, smart: 0.38, agro: 0.55, school: 0.6, baiterek: 0.62 };
var byId = {}; stations.forEach(function (s) { byId[s.id] = s; });
var done = {};
try { done = JSON.parse(localStorage.getItem('dkz_done') || '{}'); } catch (e) {}

var B = {}; // құрылысшылар

// 🔮 Alem.AI шары
B.ai = function (g, st) {
  cyl(6.2, 7, 1.6, mat(0x26335e), 0, 0.8, 0, g, 32);
  ring(6.4, 0.18, 0x33e1ff, 0, 1.65, 0, g);
  clk(label('alem.ai', 2.2, 0, 3.4, 7.4, g, { bg: 'rgba(6,30,60,.9)', color: '#7ff6ff' }), 'alemai');
  var S = grp(0, 8.4, 0, g);
  var glass = mesh(new THREE.SphereGeometry(6, 40, 28), new THREE.MeshStandardMaterial({ color: 0x66ddff, transparent: true, opacity: 0.2, roughness: 0.08, metalness: 0.4, emissive: 0x1a6fc0, emissiveIntensity: 0.6, depthWrite: false }), 0, 0, 0, S, true);
  var wire = new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(6.06, 2)), new THREE.LineBasicMaterial({ color: 0xbff6ff, transparent: true, opacity: 0.4 }));
  S.add(wire);
  var net = grp(0, 0, 0, S), pts = [], i, j;
  for (i = 0; i < 48; i++) { var v = new THREE.Vector3(rr(-1, 1), rr(-1, 1), rr(-1, 1)); if (v.length() > 1) { i--; continue; } pts.push(v.multiplyScalar(4.7)); }
  var seg = [];
  for (i = 0; i < pts.length; i++) for (j = i + 1; j < pts.length; j++) if (pts[i].distanceTo(pts[j]) < 2.7) seg.push(pts[i], pts[j]);
  var lm = new THREE.LineBasicMaterial({ color: 0x7ff6ff, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending });
  net.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(seg), lm));
  var pm = new THREE.PointsMaterial({ size: 1.3, map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: 0xffffff });
  net.add(new THREE.Points(new THREE.BufferGeometry().setFromPoints(pts), pm));
  var core = glow(0x66e0ff, 9, 0, 0, 0, S), halo = glow(0x4d7dff, 26, 0, 0, 0, S); halo.material.opacity = 0.35;
  var r1 = ring(7.6, 0.07, 0xff6fb1, 0, 0, 0, S), r2 = ring(8.3, 0.07, 0xffd23f, 0, 0, 0, S);
  var cubes = [], cols = [0x33e1ff, 0xffd23f, 0xff6fb1, 0x8cff7a];
  for (i = 0; i < 16; i++) cubes.push(box(0.7, 0.7, 0.7, glowMat(cols[i % 4], 0.9), 0, 0, 0, g));
  st.n = 0;
  onTick(function (t) {
    net.rotation.y = t * 0.25; net.rotation.x = Math.sin(t * 0.2) * 0.3; wire.rotation.y = -t * 0.05;
    r1.rotation.x = Math.PI / 2 + Math.sin(t * 0.5) * 0.5; r1.rotation.y = t * 0.4; r2.rotation.x = Math.PI / 2 + Math.cos(t * 0.4) * 0.6; r2.rotation.y = -t * 0.3;
    var lv = Math.min(st.n / 100, 1), pu = 1 + Math.sin(t * 2.2) * 0.12;
    core.scale.setScalar((7 + lv * 9) * pu); lm.opacity = 0.45 + lv * 0.5; pm.size = 1 + lv * 1.2;
    glass.material.emissiveIntensity = 0.5 + lv * 0.9;
    for (var i = 0; i < cubes.length; i++) {
      var p = (t * 0.14 + i / cubes.length) % 1, a = i * 2.4 + t * 0.5, rad = 15 * (1 - p) + 1.5, c = cubes[i];
      c.position.set(Math.cos(a) * rad, 1 + p * 7.4, Math.sin(a) * rad); c.rotation.set(t + i, t * 1.3, 0); c.scale.setScalar(1 - p * 0.75);
    }
  });
  st.action = function () {
    st.n = Math.min(st.n + 20, 120);
    var acc = [30, 52, 70, 83, 91, 96, 98][st.n / 20];
    return ST('ai').res.replace('{n}', st.n * 50).replace('{p}', acc);
  };
};

// 🖥️ Суперкомпьютер + NVIDIA GPU
B.super = function (g, st) {
  box(15, 0.3, 11, mat(0x1c2545), 0, 0.5, -1.5, g);
  var leds = [glowMat(0x76ff3d), glowMat(0x33e1ff), glowMat(0xffb23f), glowMat(0xff5fa8)], dark = mat(0x161b2e, { roughness: 0.4, metalness: 0.6 });
  for (var rz = 0; rz < 2; rz++) for (var i = -3; i <= 3; i++) {
    var x = i * 1.9, z = -3 - rz * 2.6;
    box(1.4, 3.6, 1.2, dark, x, 2.45, z, g);
    for (var k = 0; k < 6; k++) box(0.95, 0.12, 0.06, leds[(i + k + rz + 30) % 4], x, 1.1 + k * 0.52, z + 0.62, g).castShadow = false;
  }
  clk(label('alem.cloud', 1.5, 0, 5.4, -4.2, g, { bg: 'rgba(8,30,20,.9)', color: '#9dff6a', border: '#76e000' }), 'alemcloud');
  // алып видеокарта
  var card = clk(grp(0, 5.2, 3.2, g), 'nvidia');
  box(8.2, 3.3, 0.2, mat(0x0d3b22), 0, 0, -0.3, card);
  box(7.8, 3.0, 0.7, mat(0x23272f, { metalness: 0.7, roughness: 0.35 }), 0, 0, 0.15, card);
  var gm = glowMat(0x76e000, 1.4);
  box(7.8, 0.14, 0.76, gm, 0, 1.52, 0.15, card); box(7.8, 0.14, 0.76, gm, 0, -1.52, 0.15, card);
  box(3.4, 0.4, 0.1, mat(0xe2b23a, { metalness: 0.9, roughness: 0.3 }), -1.2, -1.85, -0.3, card);
  box(0.15, 3.5, 1.2, mat(0xc9d2de, { metalness: 0.9, roughness: 0.3 }), -4.15, 0, 0.1, card);
  var fans = [];
  [-2.5, 0, 2.5].forEach(function (fx) {
    var f = grp(fx, 0, 0.52, card);
    mesh(new THREE.TorusGeometry(1.15, 0.09, 8, 32), gm, fx, 0, 0.52, card, true);
    for (var b = 0; b < 5; b++) { var bl = box(1.0, 0.34, 0.05, mat(0x3a4150), 0, 0, 0, f); bl.geometry.translate(0.55, 0, 0); bl.rotation.z = b * Math.PI * 2 / 5; }
    cyl(0.25, 0.25, 0.1, gm, 0, 0, 0.03, f).rotation.x = Math.PI / 2; fans.push(f);
  });
  label('NVIDIA GPU', 1.3, 0, 2.6, 0.2, card, { bg: 'rgba(10,20,10,.9)', color: '#9dff6a', border: '#76e000' });
  st.boost = 0;
  onTick(function (t, dt) {
    st.boost = Math.max(0, st.boost - dt);
    var sp = st.boost > 0 ? 34 : 5, bl = st.boost > 0 ? 14 : 3;
    fans.forEach(function (f) { f.rotation.z -= sp * dt; });
    card.rotation.y = Math.sin(t * 0.45) * 0.55; card.position.y = 5.2 + Math.sin(t * 1.1) * 0.25;
    leds.forEach(function (m, i) { m.emissiveIntensity = 0.5 + Math.max(0, Math.sin(t * bl + i * 1.7)) * 1.6; });
    gm.emissiveIntensity = st.boost > 0 ? 2.6 : 1.3;
  });
  st.action = function () { st.boost = 7; return ST('super').res; };
};

// 🚀 Astana Hub + Higgsfield экраны
B.hub = function (g, st) {
  box(9.5, 6.4, 4.6, winMat(0x2c5fb5, 2), 0, 3.55, -4, g);
  box(9.9, 0.3, 5, mat(0xff8a3d), 0, 6.9, -4, g);
  clk(label('ASTANA HUB', 1.5, 0, 8.3, -4, g, { bg: 'rgba(60,20,0,.9)', color: '#ffd9a8', border: '#ff8a3d' }), 'astanahub');
  box(0.3, 2, 0.3, mat(0x333a55), -3, 1.3, 3, g); box(0.3, 2, 0.3, mat(0x333a55), 3, 1.3, 3, g);
  box(7.6, 4.4, 0.35, mat(0x141a30), 0, 4.3, 3, g);
  var cv = document.createElement('canvas'); cv.width = 512; cv.height = 288; var c2 = cv.getContext('2d');
  var tex = new THREE.CanvasTexture(cv); tex.encoding = THREE.sRGBEncoding;
  var scr = clk(mesh(new THREE.PlaneGeometry(7.2, 4.05), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }), 0, 4.3, 3.19, g, true), 'higgsfield');
  var back = mesh(new THREE.PlaneGeometry(7.2, 4.05), scr.material, 0, 4.3, 2.81, g, true); back.rotation.y = Math.PI;
  st.gen = -1; var fr = 0;
  onTick(function (t, dt) {
    if ((fr++) % 2) return;
    var w = 512, h = 288, k;
    if (st.gen >= 0 && st.gen < 3) {
      st.gen += dt * 2;
      c2.fillStyle = '#0b1030'; c2.fillRect(0, 0, w, h);
      c2.fillStyle = '#fff'; c2.font = '700 22px sans-serif'; c2.textAlign = 'center';
      c2.fillText('✍️ «Далада шауып келе жатқан ат»', w / 2, 100);
      c2.fillStyle = '#26315e'; c2.fillRect(96, 150, 320, 22); c2.fillStyle = '#33e1ff'; c2.fillRect(96, 150, 320 * Math.min(st.gen / 3, 1), 22);
      c2.fillStyle = '#a9bde0'; c2.font = '18px sans-serif'; c2.fillText('ЖИ видео жасап жатыр… ' + Math.round(Math.min(st.gen / 3, 1) * 100) + '%', w / 2, 210);
    } else {
      var gr = c2.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2b2a7a'); gr.addColorStop(0.55, '#ff7f6a'); gr.addColorStop(0.75, '#ffd28a');
      c2.fillStyle = gr; c2.fillRect(0, 0, w, h);
      c2.fillStyle = '#fff3c4'; c2.beginPath(); c2.arc(380, 150 + Math.sin(t * 0.3) * 8, 34, 0, 7); c2.fill();
      for (k = 0; k < 3; k++) {
        c2.fillStyle = ['#7b4a8a', '#5a8a4a', '#3f6e3a'][k]; c2.beginPath(); c2.moveTo(0, h);
        for (var x = 0; x <= w; x += 16) c2.lineTo(x, 190 + k * 26 + Math.sin((x + t * (40 + k * 60)) / (70 - k * 12)) * (16 - k * 4));
        c2.lineTo(w, h); c2.fill();
      }
      c2.font = '84px "Apple Color Emoji","Segoe UI Emoji",sans-serif'; c2.textAlign = 'center';
      c2.save(); c2.translate(230, 236 - Math.abs(Math.sin(t * 7)) * 20); c2.scale(-1, 1); c2.rotate(Math.sin(t * 7) * 0.12); c2.fillText('🐎', 0, 0); c2.restore();
      c2.fillStyle = '#000'; c2.fillRect(0, 0, w, 26); c2.fillRect(0, h - 26, w, 26);
      c2.fillStyle = '#fff'; c2.font = '700 15px sans-serif'; c2.textAlign = 'left'; c2.fillText('🎬 Higgsfield AI · video', 10, 18);
      c2.fillStyle = '#ff5a5a'; c2.beginPath(); c2.arc(w - 18, 13, 6, 0, 7); c2.fill();
    }
    tex.needsUpdate = true;
  });
  var cards = ['🎬 Higgsfield AI', '🧠 Cerebra', '🌾 Egistic', '💳 Kaspi.kz'].map(function (n, i) { return clk(label(n, 1.25, 0, 0, 0, g, { bg: 'rgba(40,14,60,.92)', border: '#ffb23f' }), ['higgsfield', 'cerebra', 'egistic', 'kaspi'][i]); });
  var rocket = emoji('🚀', 2.6, 6, 3, -1, g);
  onTick(function (t) {
    cards.forEach(function (c, i) { var a = t * 0.35 + i * Math.PI / 2; c.position.set(Math.cos(a) * 8, 10.5 + Math.sin(t + i) * 0.5, Math.sin(a) * 8 - 1); });
    var p = (t * 0.25) % 1; rocket.position.y = 2 + p * 12; rocket.material.opacity = 1 - p;
  });
  st.action = function () { st.gen = 0; return ST('hub').res; };
};

// 🌐 Интернет қақпасы (Ақтау)
B.internet = function (g, st) {
  box(5.5, 3, 4, winMat(0x3d6fd0, 0), -1.5, 1.9, 1.5, g); box(5.9, 0.3, 4.4, mat(0xffffff), -1.5, 3.55, 1.5, g);
  clk(label('Internet', 1.1, -1.5, 4.6, 1.5, g, { bg: 'rgba(6,20,60,.9)' }), 'provider');
  var d = clk(grp(4.5, 0.4, -2.5, g), 'dish'); cyl(0.3, 0.45, 3, mat(0x8894b5), 0, 1.5, 0, d);
  var dish = grp(0, 3.2, 0, d), bowl = mesh(new THREE.SphereGeometry(2.6, 28, 12, 0, Math.PI * 2, 0, 0.95), mat(0xf1f5ff, { side: THREE.DoubleSide }), 0, 0, 0, dish);
  bowl.rotation.x = Math.PI; bowl.position.y = 2.6; cyl(0.06, 0.06, 2.2, mat(0x555), 0, 1.1, 0, dish); sph(0.25, glowMat(0xff5a5a), 0, 2.2, 0, dish); dish.rotation.z = -0.7;
  var tw = clk(grp(-5.5, 0.4, -4, g), 'tower'); cyl(0.12, 0.3, 10, mat(0xd9412b), 0, 5, 0, tw, 6);
  for (var i = 1; i < 5; i++) box(1.4 - i * 0.2, 0.08, 1.4 - i * 0.2, mat(0xffffff), 0, i * 2, 0, tw);
  var tip = sph(0.3, glowMat(0xff3333, 2), 0, 10.2, 0, tw), waves = [0, 1, 2].map(function () { return ring(1, 0.06, 0x7ff6ff, 0, 9.4, 0, tw); });
  // теңіз түбіндегі кабель
  var curve = new THREE.CatmullRomCurve3(st.inside ? [new THREE.Vector3(-4, 0.6, 2.5), new THREE.Vector3(-9, 0.5, 5), new THREE.Vector3(-13, 0.4, 9), new THREE.Vector3(-17, 0.3, 13)] : [new THREE.Vector3(-4, 0.6, 2.5), new THREE.Vector3(-10, 0.5, 4), new THREE.Vector3(-17, -0.9, 9), new THREE.Vector3(-30, -1.2, 22), new THREE.Vector3(-52, -1.2, 44)]);
  clk(mesh(new THREE.TubeGeometry(curve, 50, 0.28, 8), glowMat(0xffa23f, 0.9), 0, 0, 0, g, true), 'cable');
  var pulses = [0, 1, 2, 3, 4].map(function () { var s = sph(0.42, glowMat(0xffffff, 3), 0, 0, 0, g); s.castShadow = false; glow(0xffc27a, 3.5, 0, 0, 0, s); return s; });
  var mail = emoji('✉️', 3.5, 0, -50, 0, st.inside ? g : scene), mg = glow(0xffffff, 9, 0, 0, 0, mail), route = [st.pos, P(51.9, 47.1), P(57.17, 50.28), P(63.63, 53.21), A].map(function (v) { return new THREE.Vector3(v.x, 5, v.z); });
  var rc = st.inside ? curve : new THREE.CatmullRomCurve3(route); st.send = -1;
  onTick(function (t, dt) {
    dish.rotation.y = t * 0.4; tip.material.emissiveIntensity = 1 + Math.sin(t * 5) * 1.5;
    waves.forEach(function (w, i) { var p = (t * 0.5 + i / 3) % 1; w.scale.setScalar(0.5 + p * 4); w.material.opacity = 1 - p; w.material.transparent = true; });
    pulses.forEach(function (s, i) { curve.getPoint(1 - ((t * 0.16 + i / 5) % 1), s.position); });
    if (st.send >= 0) { st.send += dt / 6; if (st.send > 1) { st.send = -1; mail.position.y = -50; } else { rc.getPoint(st.send, mail.position); mail.position.y = 5 + Math.sin(st.send * Math.PI) * 10; } }
  });
  st.action = function () { st.send = 0; return ST('internet').res; };
};

// 🛰️ Байқоңыр
B.space = function (g, st) {
  cyl(4.2, 4.6, 0.6, mat(0x8a93ad), 0, 0.6, 0, g, 24);
  var gan = mat(0xd9412b); box(0.5, 9, 0.5, gan, -2.3, 5, 0, g); box(0.5, 9, 0.5, gan, -3.3, 5, 0, g);
  for (var i = 0; i < 5; i++) box(1.5, 0.15, 0.5, gan, -2.8, 1.5 + i * 1.9, 0, g);
  box(1.6, 0.25, 0.4, mat(0xffffff), -1.5, 6.5, 0, g);
  box(5, 3, 4, mat(0xcfd6e6), -5, 1.9, -4.5, g); box(5.3, 0.3, 4.3, mat(0x3d6fd0), -5, 3.5, -4.5, g);
  var dd = grp(5.5, 0.4, 3.5, g); cyl(0.2, 0.3, 1.6, mat(0x8894b5), 0, 0.8, 0, dd);
  var bw = mesh(new THREE.SphereGeometry(1.6, 20, 10, 0, Math.PI * 2, 0, 0.95), mat(0xf1f5ff, { side: THREE.DoubleSide }), 0, 3.3, 0, dd); bw.rotation.x = Math.PI + 0.5;
  var R = clk(grp(0, 0.9, 0, g), 'rocket'), white = mat(0xf7f9ff);
  cyl(0.85, 0.85, 6, white, 0, 3, 0, R); mesh(new THREE.ConeGeometry(0.85, 2, 18), mat(0xff7a2f), 0, 7, 0, R);
  cyl(0.87, 0.87, 0.5, mat(0x00afca), 0, 4.6, 0, R); cyl(0.6, 0.9, 0.8, mat(0x444b60), 0, -0.2, 0, R);
  for (i = 0; i < 4; i++) { var a = i * Math.PI / 2; cyl(0.38, 0.38, 3, white, Math.cos(a) * 1.2, 1.5, Math.sin(a) * 1.2, R); mesh(new THREE.ConeGeometry(0.38, 0.9, 12), mat(0xff7a2f), Math.cos(a) * 1.2, 3.45, Math.sin(a) * 1.2, R); }
  var flame = mesh(new THREE.ConeGeometry(0.9, 4.5, 14), glowMat(0xffb22e, 3), 0, -2.8, 0, R, true); flame.rotation.x = Math.PI;
  var fg = glow(0xff9a3d, 14, 0, -2, 0, R); flame.visible = fg.visible = false;
  var smoke = []; for (i = 0; i < 10; i++) { var s = sph(1, new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 }), 0, 0, 0, g); s.castShadow = false; s.visible = false; smoke.push(s); }
  st.lt = -1; var wait = 14;
  onTick(function (t, dt) {
    if (st.lt < 0) { wait -= dt; if (wait < 0) st.lt = 0; return; }
    st.lt += dt; var q = st.lt;
    flame.visible = fg.visible = q < 9; flame.scale.y = 0.8 + Math.random() * 0.5;
    R.position.y = 0.9 + (q > 1 ? 2.6 * (q - 1) * (q - 1) : 0); R.position.x = Math.sin(q * 40) * 0.03;
    R.visible = q < 9;
    smoke.forEach(function (s, i) { var k = q - i * 0.12; s.visible = k > 0 && k < 4; if (s.visible) { var an = i * 0.63; s.position.set(Math.cos(an) * k * 1.9, 0.9 + k * 0.4, Math.sin(an) * k * 1.9); s.scale.setScalar(0.6 + k * 0.7); s.material.opacity = 0.8 * (1 - k / 4); } });
    if (q > 11) { st.lt = -1; wait = 40; R.position.y = 0.9; R.visible = true; flame.visible = fg.visible = false; }
  });
  st.action = function () { if (st.lt < 0 || st.lt > 9) { st.lt = 0; } return ST('space').res; };
};

// ⛏️ Майнинг фермасы (Екібастұз)
B.mining = function (g, st) {
  box(6.5, 3.6, 5, mat(0x8d99ae), -5, 2.2, -2.5, g); box(6.9, 0.3, 5.4, mat(0x5b6680), -5, 4.15, -2.5, g);
  clk(label('⚡ ГРЭС', 1.2, -5, 5.4, -0.5, g, { bg: 'rgba(50,40,0,.9)', border: '#ffc928' }), 'ekibastuz');
  var smoke = [];
  [-6.6, -3.4].forEach(function (cx) {
    cyl(0.6, 0.95, 10, mat(0xe6e9f2), cx, 5.4, -4.2, g); cyl(0.66, 0.7, 1, mat(0xd9412b), cx, 9.4, -4.2, g); cyl(0.74, 0.8, 1, mat(0xd9412b), cx, 6.6, -4.2, g);
    for (var i = 0; i < 6; i++) { var s = sph(1, new THREE.MeshStandardMaterial({ color: 0xdfe3ee, transparent: true, opacity: 0.7 }), cx, 11, -4.2, g); s.castShadow = false; s.userData = { cx: cx, ph: i / 6 }; smoke.push(s); }
  });
  var py = grp(-0.8, 0.4, 3.2, g); cyl(0.1, 0.25, 6, mat(0x8894b5), 0, 3, 0, py, 6); box(2.4, 0.12, 0.12, mat(0x8894b5), 0, 5.4, 0, py); box(1.6, 0.12, 0.12, mat(0x8894b5), 0, 4.5, 0, py);
  var wires = [new THREE.Vector3(-3, 4.3, -0.5), new THREE.Vector3(-0.8, 5.8, 3.2), new THREE.Vector3(2, 3.2, 1.5), new THREE.Vector3(5.2, 3.2, 1.5), new THREE.Vector3(8.2, 3.2, 1.5)];
  g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(wires), new THREE.LineBasicMaterial({ color: 0xffe36b })));
  var bolt = emoji('⚡', 3, -0.8, 8, 3.2, g);
  var fans = [], lm = glowMat(0x4dff88, 1.5);
  [0x2d7dd2, 0xf0a202, 0xd7263d].forEach(function (c, ci) {
    var x = 2 + ci * 3.1; box(2.5, 2.5, 6, mat(c, { roughness: 0.5, metalness: 0.3 }), x, 1.65, 1.5, g);
    for (var k = 0; k < 8; k++) box(0.06, 2.3, 0.12, mat(0x000000, { transparent: true, opacity: 0.25 }), x + 1.26, 1.65, -1.2 + k * 0.8, g).castShadow = false;
    box(0.5, 0.14, 0.05, lm, x - 0.7, 2.5, 4.52, g);
    [-1.9, 0, 1.9].forEach(function (fz) {
      cyl(0.95, 0.95, 0.16, mat(0x1a1f2e), x, 2.96, 1.5 + fz, g);
      var f = grp(x, 3.08, 1.5 + fz, g);
      for (var b = 0; b < 4; b++) { var bl = box(0.85, 0.05, 0.3, mat(0xcfd6e6), 0, 0, 0, f); bl.geometry.translate(0.45, 0, 0); bl.rotation.y = b * Math.PI / 2; }
      fans.push(f);
    });
  });
  var coinTex = canvasTex(128, 128, function (c) { c.fillStyle = '#ffc928'; c.beginPath(); c.arc(64, 64, 58, 0, 7); c.fill(); c.lineWidth = 8; c.strokeStyle = '#b07a00'; c.stroke(); c.fillStyle = '#7a4d00'; c.font = '800 84px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('₿', 64, 70); });
  var coins = []; for (var i = 0; i < 8; i++) { var s = new THREE.Sprite(new THREE.SpriteMaterial({ map: coinTex, transparent: true, depthWrite: false })); s.userData = { x: 2 + (i % 3) * 3.1, z: rr(-0.5, 3.5), ph: i / 8 }; g.add(s); coins.push(s); clk(s, 'bitcoin'); }
  st.level = 4;
  onTick(function (t, dt) {
    var lv = st.level;
    fans.forEach(function (f) { f.rotation.y += lv * 3.2 * dt; });
    smoke.forEach(function (s) { var p = (t * 0.22 + s.userData.ph) % 1; s.position.set(s.userData.cx + p * 3, 10.6 + p * 7, -4.2 - p * 1.5); s.scale.setScalar((0.4 + p * 1.6) * (0.5 + lv * 0.13)); s.material.opacity = 0.75 * (1 - p); });
    coins.forEach(function (s, i) { var p = (t * 0.3 + s.userData.ph) % 1; s.visible = i < lv; s.position.set(s.userData.x, 3.5 + p * 5, s.userData.z); s.scale.setScalar(0.9 * Math.sin(p * Math.PI) + 0.01); });
    bolt.scale.setScalar(1.6 + lv * 0.28 + Math.sin(t * 8) * 0.2); lm.emissiveIntensity = 1 + Math.sin(t * 10) * 0.8;
  });
  st.setLevel = function (n) { st.level = n; var mw = (n * 3.3).toFixed(1); return ST('mining').res.replace('{n}', n * 1000).replace('{mw}', mw).replace('{h}', (n * 6600).toLocaleString('ru-RU')); };
};

// 🗣️ Қазақша ЖИ (Семей)
B.kazai = function (g, st) {
  var white = mat(0xf4f7ff, { roughness: 0.35 }), blue = mat(0x00afca);
  var rb = grp(0, 0.4, 0, g);
  mesh(new THREE.CapsuleGeometry(1.35, 1.5, 6, 18), white, 0, 2.5, 0, rb); box(1.5, 1, 0.1, glowMat(0x33e1ff, 0.9), 0, 2.7, 1.32, rb);
  cyl(0.5, 0.6, 0.5, blue, -0.6, 0.25, 0, rb); cyl(0.5, 0.6, 0.5, blue, 0.6, 0.25, 0, rb);
  var head = grp(0, 5.1, 0, rb); sph(1.15, white, 0, 0, 0, head); box(1.7, 0.7, 0.4, mat(0x10183a, { roughness: 0.2 }), 0, 0.05, 0.85, head);
  var eyes = [sph(0.2, glowMat(0x7ff6ff, 2.5), -0.4, 0.1, 1.05, head), sph(0.2, glowMat(0x7ff6ff, 2.5), 0.4, 0.1, 1.05, head)];
  cyl(0.04, 0.04, 0.9, mat(0x8894b5), 0, 1.5, 0, head); var ant = sph(0.18, glowMat(0xff6fb1, 2), 0, 2, 0, head);
  var armL = grp(-1.6, 3.6, 0, rb), armR = grp(1.6, 3.6, 0, rb);
  [armL, armR].forEach(function (a) { var m = mesh(new THREE.CapsuleGeometry(0.28, 1.4, 4, 10), blue, 0, -0.9, 0, a); sph(0.36, white, 0, -1.9, 0, a); });
  var dom = grp(0.9, 2.4, 1.5, rb); var bd = sph(0.75, mat(0x9a5a2a, { roughness: 0.4 }), 0, 0, 0, dom); bd.scale.set(0.9, 1.15, 0.45); cyl(0.07, 0.09, 3, mat(0x6b3a17), 0, 2, 0, dom); box(0.4, 0.2, 0.15, mat(0x6b3a17), 0, 3.5, 0, dom); dom.rotation.z = 0.9;
  var bub = D.bubble.map(function (s) { return textTex(s, { bg: 'rgba(255,255,255,.96)', color: '#1b2a6b', border: '#ff6fb1' }); });
  var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: bub[0], transparent: true, depthWrite: false })); sp.position.set(0, 8.4, 0); g.add(sp);
  var rings = [0, 1, 2].map(function () { var r = mesh(new THREE.TorusGeometry(1, 0.05, 6, 32), glowMat(0xff6fb1, 1.5), 0, 5.2, 0, g, true); r.material.transparent = true; return r; });
  // киіз үй
  var y = clk(grp(-5.2, 0.4, -2.5, g), 'yurt'); cyl(2.6, 2.6, 1.9, mat(0xfaf5ea), 0, 0.95, 0, y, 24); mesh(new THREE.ConeGeometry(2.95, 1.7, 24), mat(0xf0e4c8), 0, 2.75, 0, y);
  cyl(2.64, 2.64, 0.3, mat(0xc0392b), 0, 1.6, 0, y, 24); cyl(0.5, 0.5, 0.2, mat(0xc0392b), 0, 3.6, 0, y); box(0.9, 1.4, 0.15, mat(0x8a4b1f), 0, 0.7, 2.58, y);
  var book = clk(emoji('📖', 2.6, 5, 2.4, 1.5, g), 'abai');
  var cur = 0, tm = 0; st.talk = -1;
  onTick(function (t, dt) {
    tm += dt; if (tm > 2.6) { tm = 0; cur = (cur + 1) % bub.length; sp.material.map = bub[cur]; sp.scale.set(1.5 * bub[cur].userData.asp, 1.5, 1); }
    if (!sp.scale.z || sp.scale.y !== 1.5) sp.scale.set(1.5 * bub[cur].userData.asp, 1.5, 1);
    sp.position.y = 8.4 + Math.sin(t * 2) * 0.15;
    armL.rotation.z = -0.5 + Math.sin(t * 4) * 0.5; armL.rotation.x = Math.PI; armR.rotation.x = -0.9 + Math.sin(t * 6) * 0.15;
    head.rotation.y = Math.sin(t * 0.8) * 0.4; head.rotation.z = Math.sin(t * 1.3) * 0.08; rb.position.y = 0.4 + Math.abs(Math.sin(t * 2)) * 0.15;
    var bl = (t % 3.2) < 0.15 ? 0.1 : 1; eyes.forEach(function (e) { e.scale.y = bl; }); ant.material.emissiveIntensity = 1.5 + Math.sin(t * 6);
    rings.forEach(function (r, i) { var p = (t * 0.6 + i / 3) % 1; r.position.z = 1.5 + p * 5; r.scale.setScalar(0.4 + p * 2.2); r.material.opacity = 1 - p; });
    book.position.y = 2.6 + Math.sin(t * 1.5) * 0.3;
  });
  st.action = function () { st.talk = (st.talk + 1) % D.talk.length; var p = D.talk[st.talk]; setTimeout(function () { speak(p[0]); }, 60); return '🇰🇿 ' + p[0] + '  →  🇬🇧 ' + p[1]; };
};

function makeCar(color, long) {
  var c = new THREE.Group(), len = long ? 4.2 : 2.3;
  box(1.2, long ? 1.3 : 0.55, len, mat(color, { roughness: 0.35, metalness: 0.4 }), 0, long ? 1.0 : 0.55, 0, c);
  if (!long) box(1.05, 0.5, 1.15, mat(0x1b2440, { roughness: 0.15 }), 0, 1.05, -0.1, c); else box(1.22, 0.45, len - 0.5, mat(0x1b2440, { roughness: 0.15 }), 0, 1.25, 0, c);
  var wm = mat(0x111111);
  [[-0.62, len / 2 - 0.5], [0.62, len / 2 - 0.5], [-0.62, -len / 2 + 0.5], [0.62, -len / 2 + 0.5]].forEach(function (p) { cyl(0.28, 0.28, 0.2, wm, p[0], 0.28, p[1], c, 10).rotation.z = Math.PI / 2; });
  var hl = glowMat(0xfff6c0, 2); box(0.25, 0.14, 0.05, hl, -0.4, 0.6, len / 2 + 0.01, c); box(0.25, 0.14, 0.05, hl, 0.4, 0.6, len / 2 + 0.01, c);
  return c;
}
function makePerson(color) {
  var p = new THREE.Group();
  mesh(new THREE.CapsuleGeometry(0.22, 0.5, 4, 8), mat(color), 0, 0.62, 0, p); sph(0.2, mat(0xf2c9a0), 0, 1.25, 0, p);
  return p;
}

// 🏙️ Ақылды қала
B.smart = function (g, st) {
  var road = mat(0x39425f), H = 11, i;
  box(36, 0.1, 36, mat(0x55618a), 0, 0.05, 0, g);
  box(2 * H + 3, 0.06, 3, road, 0, 0.13, -H, g); box(2 * H + 3, 0.06, 3, road, 0, 0.13, H, g); box(3, 0.06, 2 * H + 3, road, -H, 0.13, 0, g); box(3, 0.06, 2 * H + 3, road, H, 0.13, 0, g);
  box(2 * H, 0.06, 3, road, 0, 0.13, 0, g); box(3, 0.06, 2 * H, road, 0, 0.13, 0, g);
  var dash = mat(0xfff3a0);
  for (i = -10; i <= 10; i += 2) { if (Math.abs(i) < 2) continue; box(0.9, 0.02, 0.14, dash, i, 0.17, 0, g).castShadow = false; box(0.14, 0.02, 0.9, dash, 0, 0.17, i, g).castShadow = false; }
  var cols = [0x4d7dff, 0xff6fb1, 0x33c9b0, 0xffb23f, 0x8a6cff, 0x5fd0ff], spec = { 0: '🏥', 5: '🏛️', 10: '🏫', 15: '🔬' }, n = 0;
  [-1, 1].forEach(function (qx) { [-1, 1].forEach(function (qz) { [3.6, 7.4].forEach(function (ox) { [3.6, 7.4].forEach(function (oz) {
    var h = spec[n] ? 4.5 : rr(4, 11), x = qx * ox, z = qz * oz;
    box(2.7, h, 2.7, winMat(spec[n] ? 0xf4f7ff : cols[n % 6], n % 3), x, h / 2 + 0.1, z, g);
    box(2.9, 0.2, 2.9, mat(0xffffff), x, h + 0.2, z, g);
    if (spec[n]) clk(emoji(spec[n], 3, x, h + 2.4, z, g), { '🏥': 'med', '🏛️': 'egov', '🏫': 'edu', '🔬': 'sci' }[spec[n]]); else if (n % 4 === 1) { var sol = box(2, 0.08, 1.2, mat(0x1b3a8a, { metalness: 0.8, roughness: 0.2 }), x, h + 0.55, z, g); sol.rotation.x = -0.35; }
    n++;
  }); }); }); });
  clk(label('eGov', 1.1, -3.6, 8.6, 7.4, g, { bg: 'rgba(0,60,90,.92)' }), 'egov');
  // ағаштар мен шамдар
  for (i = 0; i < 28; i++) { var a = i / 28 * Math.PI * 2, tx = Math.cos(a) * 15.8, tz = Math.sin(a) * 15.8; if (i % 2) { cyl(0.12, 0.16, 0.9, mat(0x7a4a22), tx, 0.5, tz, g, 6); sph(0.85, mat(0x3fae5a), tx, 1.6, tz, g); } else { cyl(0.06, 0.06, 3, mat(0x8894b5), tx, 1.5, tz, g, 6); sph(0.22, glowMat(0xfff0b0, 2.5), tx, 3.1, tz, g).castShadow = false; } }
  // бағдаршамдар
  var lamps = [];
  [[1.9, -H - 1.9], [H + 1.9, 1.9], [-1.9, H + 1.9], [-H - 1.9, -1.9]].forEach(function (p) {
    cyl(0.08, 0.08, 3.2, mat(0x222a44), p[0], 1.6, p[1], g, 6); clk(box(0.5, 1.4, 0.5, mat(0x161b2e), p[0], 3.6, p[1], g), 'sergek');
    var set = [0xff3b3b, 0xffd23f, 0x3dff7a].map(function (c, k) { return sph(0.19, glowMat(c, 0.1), p[0], 4.05 - k * 0.42, p[1], g); });
    lamps.push(set);
    cyl(0.05, 0.05, 0.8, mat(0x222a44), p[0], 4.6, p[1], g, 6); clk(box(0.5, 0.25, 0.3, mat(0xf4f7ff), p[0], 5.05, p[1], g), 'sergek'); // «Сергек» камерасы
  });
  // көліктер
  function loop(s, o) { s = ((s % 88) + 88) % 88; var k = Math.floor(s / 22), u = s - k * 22 - 11;
    if (k === 0) o.position.set(u, 0.16, -H - 0.7), o.rotation.y = Math.PI / 2; else if (k === 1) o.position.set(H + 0.7, 0.16, u), o.rotation.y = 0; else if (k === 2) o.position.set(-u, 0.16, H + 0.7), o.rotation.y = -Math.PI / 2; else o.position.set(-H - 0.7, 0.16, -u), o.rotation.y = Math.PI; }
  var cars = [], cc = [0xff4d6d, 0xffd23f, 0x33e1ff, 0xffffff, 0x7bff8a, 0xff8a3d, 0xb38cff, 0x4d7dff, 0xf06, 0x0cf];
  for (i = 0; i < 10; i++) { var c = makeCar(cc[i]); c.userData.s = i * 8.8; g.add(c); cars.push(c); }
  var bus = clk(makeCar(0x00afca, true), 'transport'); g.add(bus); var bus2 = clk(makeCar(0xffc928, true), 'transport'); g.add(bus2);
  var ppl = []; for (i = 0; i < 14; i++) { var pr = makePerson(cc[i % 10]); pr.userData = { side: i % 4, ph: rnd() * 6, sp: rr(0.5, 1) }; g.add(pr); ppl.push(pr); }
  var dr = clk(grp(0, 12, 0, g), 'drone'); box(0.9, 0.25, 0.9, mat(0xf4f7ff), 0, 0, 0, dr); box(0.6, 0.5, 0.6, mat(0xb9793a), 0, -0.45, 0, dr); glow(0x33e1ff, 2.5, 0, 0.2, 0, dr);
  var rot = []; [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]].forEach(function (p) { rot.push(box(0.9, 0.04, 0.12, mat(0x333333), p[0], 0.2, p[1], dr)); });
  var waves = [0, 1, 2].map(function () { var r = ring(1, 0.05, 0x44f0c0, 0, 0.3, 0, g); r.material.transparent = true; return r; });
  st.aiOn = true; var flow = 1;
  onTick(function (t, dt) {
    flow += ((st.aiOn ? 1 : 0) - flow) * Math.min(1, dt * 2);
    cars.forEach(function (c, i) { var v = 7 * flow + (1 - flow) * 2.2 * Math.max(0, Math.sin(t * 1.4 + i * 0.6)); c.userData.s += v * dt; loop(c.userData.s, c); });
    var bx = Math.sin(t * 0.25) * 9; bus.position.set(bx, 0.16, 0.7); bus.rotation.y = Math.cos(t * 0.25) > 0 ? Math.PI / 2 : -Math.PI / 2;
    var bz = Math.sin(t * 0.21 + 1) * 9; bus2.position.set(-0.7, 0.16, bz); bus2.rotation.y = Math.cos(t * 0.21 + 1) > 0 ? 0 : Math.PI;
    ppl.forEach(function (p) { var u = Math.sin(t * 0.25 * p.userData.sp + p.userData.ph) * 12, d = 13.4, s = p.userData.side;
      if (s === 0) p.position.set(u, 0.1, -d); else if (s === 1) p.position.set(d, 0.1, u); else if (s === 2) p.position.set(u, 0.1, d); else p.position.set(-d, 0.1, u);
      p.position.y = 0.1 + Math.abs(Math.sin(t * 7 + p.userData.ph)) * 0.12; });
    var ph = st.aiOn ? (t % 6) : 0, on = st.aiOn ? (ph < 4 ? 2 : ph < 4.8 ? 1 : 0) : 0;
    lamps.forEach(function (set) { set.forEach(function (l, k) { l.material.emissiveIntensity = k === on ? (st.aiOn ? 3 : 1.5 + Math.sin(t * 8) * 1.5) : 0.08; }); });
    dr.position.set(Math.cos(t * 0.5) * 8, 12 + Math.sin(t * 2) * 0.4, Math.sin(t * 0.5) * 8); rot.forEach(function (r) { r.rotation.y += 40 * dt; });
    waves.forEach(function (w, i) { var p = (t * 0.3 + i / 3) % 1; w.scale.setScalar(1 + p * 16); w.material.opacity = (1 - p) * 0.8; });
  });
  st.action = function () { st.aiOn = !st.aiOn; return st.aiOn ? ST('smart').res : ST('smart').res2; };
};

// 🌾 Ақылды егістік (Қостанай)
B.agro = function (g, st) {
  box(18, 0.3, 12, mat(0xb98a3a), 0, 0.2, 1.5, g);
  var wg = new THREE.ConeGeometry(0.1, 1, 4), wm = mat(0xf4c842), N = 700, im = new THREE.InstancedMesh(wg, wm, N), d = new THREE.Object3D();
  for (var i = 0; i < N; i++) { d.position.set(rr(-8.6, 8.6), 0.85, rr(-4, 7)); d.scale.setScalar(rr(0.7, 1.3)); d.rotation.set(rr(-0.15, 0.15), rnd() * 6, rr(-0.15, 0.15)); d.updateMatrix(); im.setMatrixAt(i, d.matrix); }
  im.castShadow = true; g.add(im);
  var patches = [];
  for (var px = 0; px < 4; px++) for (var pz = 0; pz < 3; pz++) { var bad = (px * 3 + pz) % 4 === 1; var pm = mesh(new THREE.PlaneGeometry(4.1, 3.5), new THREE.MeshBasicMaterial({ color: bad ? 0xff3b3b : 0x3dff7a, transparent: true, opacity: 0, depthWrite: false }), -6.5 + px * 4.35, 1.5, -2.2 + pz * 3.7, g, true); pm.rotation.x = -Math.PI / 2; patches.push(pm); }
  var barn = grp(-6.5, 0.3, -7.5, g); box(4, 2.6, 3.2, mat(0xc0392b), 0, 1.3, 0, barn); var roof = mesh(new THREE.CylinderGeometry(0.01, 2.3, 1.5, 4, 1), mat(0xf4f7ff), 0, 3.3, 0, barn); roof.rotation.y = Math.PI / 4; roof.scale.set(1.3, 1, 1.05); box(1.2, 1.7, 0.1, mat(0xf4f7ff), 0, 0.85, 1.62, barn);
  cyl(1.1, 1.1, 4.4, mat(0xcfd6e6, { metalness: 0.7, roughness: 0.3 }), -2.6, 2.5, -7.5, g); sph(1.1, mat(0xcfd6e6, { metalness: 0.7, roughness: 0.3 }), -2.6, 4.7, -7.5, g);
  var tr = clk(grp(0, 0.35, 8.6, g), 'tractor'); box(1.4, 0.9, 2.4, mat(0x2fae4a), 0, 1.1, 0, tr); box(1.3, 1.1, 1.1, mat(0x1b2440, { roughness: 0.15 }), 0, 2, -0.5, tr);
  var wh = mat(0x151515); [[-0.85, -0.6, 0.75], [0.85, -0.6, 0.75], [-0.8, 0.85, 0.45], [0.8, 0.85, 0.45]].forEach(function (w) { cyl(w[2], w[2], 0.35, wh, w[0], w[2], w[1], tr, 14).rotation.z = Math.PI / 2; });
  emoji('📡', 1.2, 0, 3.3, -0.5, tr);
  var dr = clk(grp(0, 7, 0, g), 'agrodrone'); box(1, 0.25, 1, mat(0xf4f7ff), 0, 0, 0, dr); glow(0xa8e04a, 3, 0, 0, 0, dr);
  var rot = []; [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]].forEach(function (p) { rot.push(box(1, 0.04, 0.12, mat(0x333333), p[0], 0.2, p[1], dr)); });
  var cone = mesh(new THREE.ConeGeometry(3, 6, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0x8cff7a, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), 0, -3.1, 0, dr, true);
  st.scan = -1; st.shown = 0;
  onTick(function (t, dt) {
    var u = Math.sin(t * 0.3) * 7.5; tr.position.x = u; tr.rotation.y = Math.cos(t * 0.3) > 0 ? Math.PI / 2 : -Math.PI / 2;
    rot.forEach(function (r) { r.rotation.y += 40 * dt; });
    if (st.scan >= 0) { st.scan += dt / 5; var s = st.scan; dr.position.set(-7 + (s * 4 % 1) * 14 * (Math.floor(s * 4) % 2 ? -1 : 1) + (Math.floor(s * 4) % 2 ? 14 : 0), 7, -2 + Math.floor(s * 4) * 2.6); cone.material.opacity = 0.45; if (s >= 1) { st.scan = -1; st.shown = 1; } }
    else { dr.position.set(Math.cos(t * 0.6) * 5, 7 + Math.sin(t * 2) * 0.3, 1.5 + Math.sin(t * 0.6) * 4); cone.material.opacity = 0.12; }
    patches.forEach(function (p) { p.material.opacity += ((st.shown ? 0.5 : 0) - p.material.opacity) * Math.min(1, dt * 2); });
  });
  st.action = function () { st.scan = 0; st.shown = 0; return ST('agro').res; };
};

// 🎓 Болашақ мектебі (Шымкент)
B.school = function (g, st) {
  box(10.5, 4.2, 4.2, winMat(0xf6e7c1, 1), 0, 2.5, -3.5, g); box(11.1, 0.5, 4.8, mat(0xd9412b), 0, 4.85, -3.5, g);
  box(3, 5.4, 4.4, mat(0xfff6dd), 0, 3.1, -3.4, g); box(3.4, 0.5, 4.8, mat(0xd9412b), 0, 6.05, -3.4, g); box(1.5, 2.2, 0.15, mat(0x8a4b1f), 0, 1.5, -1.15, g);
  emoji('🏫', 0.01, 0, 0, 0, g);
  clk(label('AI-Sana', 1.2, 0, 7.4, -3.4, g, { bg: 'rgba(70,50,0,.92)', border: '#ffe14d' }), 'aisana');
  cyl(0.07, 0.07, 8, mat(0xcfd6e6), 6.3, 4.4, -1, g, 6);
  var ft = canvasTex(256, 128, function (c) { c.fillStyle = '#00afca'; c.fillRect(0, 0, 256, 128); c.fillStyle = '#fec50c'; c.beginPath(); c.arc(128, 54, 22, 0, 7); c.fill(); for (var i = 0; i < 24; i++) { var a = i / 24 * 6.283; c.fillRect(128 + Math.cos(a) * 28 - 2, 54 + Math.sin(a) * 28 - 2, 4, 4); } c.fillRect(84, 92, 88, 6); c.fillRect(12, 8, 10, 112); });
  var flag = mesh(new THREE.PlaneGeometry(2.8, 1.4, 8, 1), new THREE.MeshStandardMaterial({ map: ft, side: THREE.DoubleSide, roughness: 0.8 }), 0, 0, 0, null, true); flag.geometry.translate(1.4, 0, 0); flag.position.set(6.35, 7.5, -1); g.add(flag); clk(flag, 'flag');
  var kids = []; for (var i = 0; i < 6; i++) { var k = makePerson([0xff6fb1, 0x33e1ff, 0xffd23f, 0x7bff8a, 0xb38cff, 0xff8a3d][i]); k.position.set(-4 + i * 1.6, 0.4, 2 + (i % 2)); k.scale.setScalar(1.25); g.add(k); kids.push(k); }
  var em = ['👩‍💻', '🤖', '📊', '🛡️', '🎨', '🩺', '💬'].map(function (e) { return clk(emoji(e, 2.3, 0, 0, 0, g), 'profs'); });
  st.pick = -1; st.pt = 0;
  onTick(function (t, dt) {
    var pos = flag.geometry.attributes.position; for (var i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 2.2 - t * 5) * 0.16 * pos.getX(i)); pos.needsUpdate = true;
    kids.forEach(function (k, i) { k.position.y = 0.4 + Math.abs(Math.sin(t * 3 + i * 1.1)) * 0.6; });
    st.pt = Math.max(0, st.pt - dt);
    em.forEach(function (e, i) { var a = t * 0.4 + i * Math.PI * 2 / em.length; e.position.set(Math.cos(a) * 7, 8.6 + Math.sin(t * 1.5 + i) * 0.5, Math.sin(a) * 7 - 1); var s = (i === st.pick && st.pt > 0) ? 4.5 + Math.sin(t * 10) * 0.6 : 2.3; e.scale.set(s, s, 1); });
  });
  var order = [0, 2, 1, 3, 6, 5, 4];
  st.action = function () { var k = Math.floor(Math.random() * 7); st.pick = order[k]; st.pt = 5; return ST('school').res.replace('{p}', ST('school').profs[k]); };
};

// 🌟 Бәйтерек
B.baiterek = function (g, st) {
  var wm = mat(0xf4f7ff, { roughness: 0.4 });
  cyl(4.4, 4.8, 0.5, mat(0xe9e4d4), 0, 0.25, 0, g, 40);
  var pool = mesh(new THREE.CircleGeometry(3.3, 40), new THREE.MeshStandardMaterial({ color: 0x3fa0ff, emissive: 0x0a4aa0, emissiveIntensity: 0.6, roughness: 0.1, metalness: 0.5 }), 0, 0.53, 0, g, true); pool.rotation.x = -Math.PI / 2;
  cyl(0.55, 1.25, 12, wm, 0, 6.5, 0, g, 14);
  var crown = grp(0, 0, 0, g), K = 14;
  for (var k = 0; k < K; k++) {
    var a = k / K * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
    var c = new THREE.CatmullRomCurve3([new THREE.Vector3(ca * 0.5, 11.6, sa * 0.5), new THREE.Vector3(ca * 3, 14, sa * 3), new THREE.Vector3(ca * 2.5, 16.4, sa * 2.5), new THREE.Vector3(ca * 0.6, 17.7, sa * 0.6)]);
    mesh(new THREE.TubeGeometry(c, 20, 0.11, 6), wm, 0, 0, 0, crown);
  }
  var gold = new THREE.MeshStandardMaterial({ color: 0xffc928, emissive: 0xffa000, emissiveIntensity: 0.6, metalness: 0.85, roughness: 0.2 });
  sph(2.15, gold, 0, 14.6, 0, g);
  var gl = glow(0xffd24a, 11, 0, 14.6, 0, g);
  cyl(0.06, 0.12, 1.6, wm, 0, 18.5, 0, g, 6);
  st.boost = 0;
  onTick(function (t, dt) { st.boost = Math.max(0, st.boost - dt); var b = st.boost > 0 ? 1 : 0; gold.emissiveIntensity = 0.6 + b * 1.8 + Math.sin(t * 2) * 0.15; gl.scale.setScalar(11 + b * 14 + Math.sin(t * 2)); crown.rotation.y = t * 0.05; });
  st.action = function () { st.boost = 6; return ST('baiterek').res; };
};

// станцияларды тұрғызу
stations.forEach(function (st) {
  var g = grp(st.pos.x, 0, st.pos.z, scene); st.g = g; g.userData.station = st; clickables.push(g);
  if (!st.open) { cyl(st.r, st.r + 0.6, 0.4, mat(0x26335e), 0, 0.2, 0, g, 40); }
  st.ring = ring(st.r + 0.9, 0.16, st.color, 0, 0.35, 0, g);
  var beam = mesh(new THREE.CylinderGeometry(0.5, 0.5, 90, 12, 1, true), new THREE.MeshBasicMaterial({ color: st.color, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }), st.open ? st.r - 1 : 0, 45 + st.labelY + 2, st.open ? -st.r + 1 : 0, g, true);
  st.lab = label(function () { return st.icon + ' ' + ST(st.id).title + (done[st.id] ? ' ⭐' : ''); }, 2.3, st.open ? st.r - 1 : 0, st.labelY + 1.5, st.open ? -st.r + 1 : 0, g, { border: '#' + st.color.toString(16).padStart(6, '0') });
  B[st.id](g, st);
});

// ---------- әшекейлер ----------
function free(x, z, pad) { if (!inKZ(x, z)) return false; for (var i = 0; i < stations.length; i++) { var s = stations[i]; if (Math.hypot(x - s.pos.x, z - s.pos.z) < s.r + (pad || 5)) return false; } return true; }
(function decor() {
  var i, p, x, z;
  // таулар
  var mg = mat(0x7686ad, { flatShading: true }), snow = mat(0xffffff, { flatShading: true });
  function mount(lon, lat, s) { p = P(lon, lat); if (!free(p.x, p.z, 2)) return; var h = s * rr(1.3, 2); var m = mesh(new THREE.ConeGeometry(s, h, 6), mg, p.x, h / 2, p.z, scene); m.rotation.y = rnd() * 3; mesh(new THREE.ConeGeometry(s * 0.42, h * 0.42, 6), snow, p.x, h * 0.8, p.z, scene).rotation.y = m.rotation.y; }
  for (i = 0; i < 26; i++) mount(rr(73.8, 80.6), rr(42.75, 43.5), rr(3, 6.5));
  for (i = 0; i < 16; i++) mount(rr(82.5, 86.3), rr(48.6, 50.0), rr(3, 6));
  for (i = 0; i < 8; i++) mount(rr(79, 81.5), rr(44.9, 45.6), rr(2.5, 4.5));
  // ормандар
  var tg = new THREE.ConeGeometry(1, 3, 6), tm = mat(0x2f9150, { flatShading: true }), N = 420, im = new THREE.InstancedMesh(tg, tm, N), d = new THREE.Object3D(), n = 0, tries = 0;
  while (n < N && tries++ < 6000) { var lon = rr(52, 86), lat = rr(49.6, 55.2); if (lat < 51.5 && lon < 78) continue; p = P(lon, lat); if (!free(p.x, p.z, 16)) continue; d.position.set(p.x, 1.5, p.z); d.scale.setScalar(rr(0.6, 1.3)); d.updateMatrix(); im.setMatrixAt(n++, d.matrix); }
  im.count = n; im.castShadow = true; scene.add(im);
  // киіз үйлер
  for (i = 0; i < 12; i++) { p = P(rr(55, 80), rr(45, 50.5)); if (!free(p.x, p.z)) continue; var y = clk(grp(p.x, 0, p.z, scene), 'yurt'); cyl(1.5, 1.5, 1.1, mat(0xfaf5ea), 0, 0.55, 0, y, 16); mesh(new THREE.ConeGeometry(1.75, 1, 16), mat(0xf0e4c8), 0, 1.6, 0, y); cyl(1.53, 1.53, 0.18, mat(0xc0392b), 0, 0.95, 0, y, 16); }
  // түйелер
  var camels = [];
  for (i = 0; i < 9; i++) { p = P(rr(53, 64), rr(43.5, 47.5)); if (!free(p.x, p.z)) continue; var c = clk(grp(p.x, 0, p.z, scene), 'camel'), cm = mat(0xc49a5a); box(1.8, 0.8, 0.7, cm, 0, 1.5, 0, c); sph(0.4, cm, -0.4, 2.05, 0, c); sph(0.4, cm, 0.4, 2.05, 0, c); var nk = box(0.3, 1.1, 0.3, cm, 1.05, 2.1, 0, c); nk.rotation.z = -0.3; box(0.6, 0.35, 0.35, cm, 1.4, 2.65, 0, c); [[-0.7, 0.25], [-0.7, -0.25], [0.7, 0.25], [0.7, -0.25]].forEach(function (l) { box(0.18, 1.2, 0.18, cm, l[0], 0.6, l[1], c); }); c.rotation.y = rnd() * 6; c.userData.ph = rnd() * 6; camels.push(c); }
  // мұнай қондырғылары
  var pumps = [];
  for (i = 0; i < 6; i++) { p = P(rr(51.5, 55), rr(46.3, 48.2)); if (!free(p.x, p.z)) continue; var pj = clk(grp(p.x, 0, p.z, scene), 'oil'), dk = mat(0x2a3044); box(2.6, 0.3, 1, dk, 0, 0.15, 0, pj); box(0.25, 2.6, 0.25, mat(0xffb23f), 0, 1.5, 0, pj); var bm = grp(0, 2.9, 0, pj); box(3.4, 0.28, 0.28, mat(0xd9412b), 0, 0, 0, bm); box(0.5, 0.9, 0.4, dk, 1.7, -0.25, 0, bm); pj.rotation.y = rnd() * 6; pumps.push(bm); }
  // жел турбиналары (Ерейментау)
  var turb = [];
  for (i = 0; i < 5; i++) { p = P(72.9 + i * 0.28, 51.75 - (i % 2) * 0.3); var t = clk(grp(p.x, 0, p.z, scene), 'wind'); cyl(0.15, 0.3, 8, mat(0xf4f7ff), 0, 4, 0, t, 8); var hub = grp(0, 8, 0.3, t); for (var k = 0; k < 3; k++) { var bl = box(0.3, 3.4, 0.08, mat(0xffffff), 0, 0, 0, hub); bl.geometry.translate(0, 1.7, 0); bl.rotation.z = k * Math.PI * 2 / 3; } turb.push(hub); }
  // бұлттар
  var clouds = [], cmat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, roughness: 1 });
  for (i = 0; i < 16; i++) { var cl = grp(rr(-260, 260), rr(42, 60), rr(-140, 140), scene); for (k = 0; k < 4; k++) { var s = mesh(new THREE.SphereGeometry(rr(3, 6), 10, 8), cmat, k * 4.5 - 7, rr(-1, 1), rr(-2, 2), cl, true); s.scale.y = 0.55; } clouds.push(cl); }
  // жұлдыздар
  var sp = []; for (i = 0; i < 700; i++) { var a = rnd() * 6.283, e = rr(0.25, 1.5); sp.push(new THREE.Vector3(Math.cos(a) * Math.cos(e) * 900, Math.sin(e) * 900, Math.sin(a) * Math.cos(e) * 900)); }
  scene.add(new THREE.Points(new THREE.BufferGeometry().setFromPoints(sp), new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.8 })));
  // спутниктер
  var sats = [['KazSat-2', 150, 78, 0.05, 0], ['KazSat-3', 150, 86, 0.05, 3.1], ['Starlink', 110, 55, 0.22, 1], ['Starlink', 120, 58, 0.2, 4]].map(function (o) {
    var s = grp(0, 0, 0, scene); box(1.6, 1.6, 2.2, mat(0xe2b23a, { metalness: 0.8, roughness: 0.3 }), 0, 0, 0, s); var pn = mat(0x1b3a8a, { metalness: 0.7, roughness: 0.25 }); box(4.5, 0.1, 1.6, pn, -3.3, 0, 0, s); box(4.5, 0.1, 1.6, pn, 3.3, 0, 0, s); glow(0xffffff, 8, 0, 0, 0, s);
    label(o[0], 2.2, 0, 3.2, 0, s, { bg: 'rgba(30,10,60,.8)', border: '#c48bff' }); s.userData = o; clk(s, o[0] === 'KazSat-2' ? 'kazsat2' : o[0] === 'KazSat-3' ? 'kazsat3' : 'starlink'); s.traverse(function (m) { m.castShadow = false; }); return s; });
  onTick(function (t, dt) {
    camels.forEach(function (c) { c.position.y = Math.abs(Math.sin(t * 1.5 + c.userData.ph)) * 0.08; });
    pumps.forEach(function (b, i) { b.rotation.z = Math.sin(t * 1.6 + i) * 0.35; });
    turb.forEach(function (h, i) { h.rotation.z = t * 1.8 + i; });
    clouds.forEach(function (c) { c.position.x += dt * 1.6; if (c.position.x > 280) c.position.x = -280; });
    sats.forEach(function (s) { var o = s.userData, a = t * o[3] + o[4]; s.position.set(Math.cos(a) * o[1] * 1.3, o[2], Math.sin(a) * o[1] * 0.75); s.rotation.y = -a; });
  });
  // қалалар мен талшықты-оптикалық желі
  var C = { oral: [51.37, 51.23], atyrau: [51.9, 47.1], aktau: [53.0, 44.0], aktobe: [57.17, 50.28], kostanay: [63.8, 52.6], petro: [69.15, 54.6], astana: [71.43, 51.17], pavlodar: [76.95, 52.3], semey: [79.6, 50.2], oskemen: [82.6, 49.95], karaganda: [73.1, 49.8], almaty: [76.89, 43.5], smart: [77.0, 45.0], taraz: [71.37, 43.1], shymkent: [69.2, 42.9], kyzylorda: [65.5, 44.85], baikonur: [63.3, 45.96], ekib: [75.32, 51.72],
    xRu1: [50.2, 52.6], xRu2: [69.3, 56.4], xCn: [83.5, 44.6], xUz: [68.6, 40.2] };
  ['oral', 'atyrau', 'aktobe', 'petro', 'pavlodar', 'oskemen', 'karaganda', 'almaty', 'taraz', 'kyzylorda'].forEach(function (k) {
    p = P(C[k][0], C[k][1]); cyl(1.1, 1.3, 0.5, mat(0x26335e), p.x, 0.25, p.z, scene, 16); clk(sph(0.55, glowMat(0x7ff6ff, 1.5), p.x, 1, p.z, scene), k);
    for (var j = 0; j < 4; j++) { var h = rr(1.2, 3.2); clk(box(1, h, 1, winMat([0x6f8fd8, 0xd88fb0, 0x8fd8c0][j % 3], j % 3), p.x + [-1.9, 1.9, -1.6, 1.8][j], h / 2, p.z + [-1.5, -1.7, 1.8, 1.5][j], scene), k); }
    clk(label(function () { return UI().cities[k]; }, 1.5, p.x, 5, p.z, scene, { bg: 'rgba(12,20,60,.8)' }), k);
  });
  var E = [['oral', 'atyrau'], ['atyrau', 'aktau'], ['oral', 'aktobe'], ['atyrau', 'aktobe'], ['aktobe', 'kostanay'], ['kostanay', 'astana'], ['kostanay', 'petro'], ['petro', 'astana'], ['astana', 'ekib'], ['ekib', 'pavlodar'], ['pavlodar', 'semey'], ['semey', 'oskemen'], ['astana', 'karaganda'], ['karaganda', 'smart'], ['semey', 'smart'], ['smart', 'almaty'], ['almaty', 'taraz'], ['taraz', 'shymkent'], ['shymkent', 'kyzylorda'], ['kyzylorda', 'baikonur'], ['baikonur', 'aktobe'], ['oral', 'xRu1'], ['petro', 'xRu2'], ['smart', 'xCn'], ['shymkent', 'xUz']];
  var fm = glowMat(0x33e1ff, 1.1), pulses = [], pg = new THREE.SphereGeometry(0.45, 10, 8), pmat = glowMat(0xffffff, 3);
  E.forEach(function (e, ei) {
    var a = P(C[e[0]][0], C[e[0]][1]), b2 = P(C[e[1]][0], C[e[1]][1]); a.y = b2.y = 0.22;
    var len = a.distanceTo(b2), tube = mesh(new THREE.CylinderGeometry(0.13, 0.13, len, 6), fm, (a.x + b2.x) / 2, 0.22, (a.z + b2.z) / 2, scene, true);
    tube.lookAt(b2); tube.rotateX(Math.PI / 2);
    for (var q = 0; q < Math.max(1, Math.round(len / 45)); q++) { var s = mesh(pg, pmat, 0, 0, 0, scene, true); glow(0x7ff6ff, 3.2, 0, 0, 0, s); pulses.push({ s: s, a: a, b: b2, ph: rnd(), sp: 22 / len * (ei % 2 ? 1 : -1) }); }
  });
  onTick(function (t) { pulses.forEach(function (o) { var u = (((t * o.sp + o.ph) % 1) + 1) % 1; o.s.position.lerpVectors(o.a, o.b, u); }); });
})();

// ---------- ойыншы: Зерек робот-көлігі ----------
var player = grp(0, 0, 0, scene), pl = { x: A.x - 18, z: A.z + 40, h: Math.PI, v: 0, y: 0, fly: false };
(function () {
  var white = mat(0xffffff, { roughness: 0.3, metalness: 0.2 });
  var body = grp(0, 0, 0, player); pl.body = body;
  box(2.2, 0.8, 3.4, white, 0, 0.95, 0, body); box(2.3, 0.25, 3.5, mat(0x00afca), 0, 0.55, 0, body); box(2.25, 0.12, 3.45, glowMat(0xffc928, 0.8), 0, 1.38, 0, body);
  var dome = mesh(new THREE.SphereGeometry(0.95, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x8fe9ff, transparent: true, opacity: 0.55, roughness: 0.05, metalness: 0.5 }), 0, 1.4, -0.2, body);
  sph(0.45, white, 0, 1.75, -0.2, body); sph(0.1, glowMat(0x1b2a6b, 0.2), -0.17, 1.82, 0.2, body); sph(0.1, glowMat(0x1b2a6b, 0.2), 0.17, 1.82, 0.2, body);
  var em = glowMat(0x7ff6ff, 2.5); sph(0.24, em, -0.65, 0.98, 1.7, body); sph(0.24, em, 0.65, 0.98, 1.7, body);
  box(0.9, 0.12, 0.05, glowMat(0xff6fb1, 1.5), 0, 0.8, 1.72, body);
  box(0.5, 0.2, 0.06, glowMat(0xff3b3b, 1.6), -0.7, 0.98, -1.72, body); box(0.5, 0.2, 0.06, glowMat(0xff3b3b, 1.6), 0.7, 0.98, -1.72, body);
  cyl(0.03, 0.03, 1.3, mat(0x8894b5), 0.8, 2, -1.2, body, 6); pl.tip = sph(0.15, glowMat(0xffc928, 2), 0.8, 2.7, -1.2, body);
  pl.wheels = []; [[-1.15, 1.1], [1.15, 1.1], [-1.15, -1.1], [1.15, -1.1]].forEach(function (p) { var w = grp(p[0], 0.5, p[1], body); cyl(0.5, 0.5, 0.4, mat(0x16192a), 0, 0, 0, w, 16).rotation.z = Math.PI / 2; var hb = box(0.42, 0.7, 0.12, glowMat(0x33e1ff, 1.2), 0, 0, 0, w); pl.wheels.push(w); });
  pl.props = []; [[-1.5, 1.6], [1.5, 1.6], [-1.5, -1.6], [1.5, -1.6]].forEach(function (p) { var a = grp(p[0], 1.5, p[1], body); cyl(0.06, 0.06, 0.4, mat(0x8894b5), 0, -0.2, 0, a, 6); var b = box(1.7, 0.04, 0.16, glowMat(0x7ff6ff, 0.8), 0, 0, 0, a); pl.props.push(a); a.visible = false; });
  pl.under = glow(0x33e1ff, 7, 0, 0.3, 0, player); pl.under.material.opacity = 0.6; clk(body, 'zerek');
})();

// ---------- басқару ----------
var keys = {}, started = false, cur = null, near = null;
var cam = { yaw: 0, pitch: 0.42, dist: 17, drag: false, ea: 0, eR: 1, pos: new THREE.Vector3(pl.x, 30, pl.z + 40), look: new THREE.Vector3(pl.x, 0, pl.z) };
var joy = { x: 0, y: 0 };
addEventListener('keydown', function (e) {
  if (!started) { if (e.code === 'Enter') startGame(); return; }
  if (e.target && e.target.tagName === 'INPUT') return;
  keys[e.code] = true;
  if (e.code === 'Space') { if (!inside && !warp) toggleFly(); e.preventDefault(); }
  if (e.code === 'KeyE' || e.code === 'Enter') { if (!inside && !warp && near) openStation(near); }
  if (e.code === 'Escape') { if ($('modal').style.display !== 'none') $('modal').style.display = 'none'; else if (infoOpen) closeInfo(); else exitInside(); }
  if (/^Digit\d$/.test(e.code) && !inside && !warp) { var n = (+e.code.slice(5) + 9) % 10; teleport(stations[n]); }
  if (e.code.indexOf('Arrow') === 0) e.preventDefault();
});
addEventListener('keyup', function (e) { keys[e.code] = false; });
addEventListener('blur', function () { keys = {}; });
var lastP = null, downP = null, hoverT = 0;
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
canvas.addEventListener('pointerdown', function (e) { cam.drag = true; lastP = [e.clientX, e.clientY]; downP = [e.clientX, e.clientY]; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', function (e) {
  if (!cam.drag) { var now = performance.now(); if (started && now - hoverT > 90) { hoverT = now; canvas.style.cursor = pick(e.clientX, e.clientY) ? 'pointer' : 'grab'; } return; }
  var dx = e.clientX - lastP[0], dy = e.clientY - lastP[1]; lastP = [e.clientX, e.clientY];
  if (inside) { inCam.tyaw -= dx * 0.005; inCam.tpitch = clamp(inCam.tpitch + dy * 0.004, -0.55, 0.6); }
  else { cam.yaw -= dx * 0.006; cam.pitch = clamp(cam.pitch + dy * 0.004, 0.12, 1.3); }
});
canvas.addEventListener('pointerup', function (e) { cam.drag = false; if (downP && Math.hypot(e.clientX - downP[0], e.clientY - downP[1]) < 7) onClick(e.clientX, e.clientY); downP = null; });
canvas.addEventListener('pointercancel', function () { cam.drag = false; downP = null; });
canvas.addEventListener('wheel', function (e) { var k = e.deltaY > 0 ? 1.1 : 0.9; if (inside) inCam.tfov = clamp(inCam.tfov * k, 28, 80); else cam.dist = clamp(cam.dist * k, 8, 90); e.preventDefault(); }, { passive: false });
(function () {
  var j = $('joy'), knob = j.firstElementChild, id = null;
  function mv(e) { var r = j.getBoundingClientRect(), x = (e.clientX - r.left - 65) / 50, y = (e.clientY - r.top - 65) / 50, l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; } joy.x = x; joy.y = y; knob.style.transform = 'translate(' + x * 40 + 'px,' + y * 40 + 'px)'; }
  j.addEventListener('pointerdown', function (e) { id = e.pointerId; j.setPointerCapture(id); mv(e); });
  j.addEventListener('pointermove', function (e) { if (e.pointerId === id) mv(e); });
  function end() { id = null; joy.x = joy.y = 0; knob.style.transform = ''; }
  j.addEventListener('pointerup', end); j.addEventListener('pointercancel', end);
})();
function toggleFly() { pl.fly = !pl.fly; pl.props.forEach(function (p) { p.visible = pl.fly; }); refreshUI(); }
function teleport(st) {
  closeStation();
  var best = null;
  [Math.PI / 2, 1, 2.2, 0, Math.PI, -1, -2.2, -Math.PI / 2].some(function (a) { var x = st.pos.x + Math.cos(a) * (st.r + 7), z = st.pos.z + Math.sin(a) * (st.r + 7); if (inKZ(x, z)) { best = [x, z]; return true; } return false; });
  if (!best) best = [st.pos.x, st.pos.z + st.r + 7];
  pl.x = best[0]; pl.z = best[1]; pl.v = 0; pl.h = Math.atan2(st.pos.x - pl.x, st.pos.z - pl.z); cam.yaw = 0;
  beep(660, 0.08);
}

// ---------- дыбыс ----------
var actx = null;
function beep(f, d, type) { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); var o = actx.createOscillator(), g = actx.createGain(); o.type = type || 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0.08, actx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + d + 0.15); o.connect(g); g.connect(actx.destination); o.start(); o.stop(actx.currentTime + d + 0.16); } catch (e) {} }

// ---------- интерфейс ----------
function $(id) { return document.getElementById(id); }
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
function doneCount() { return stations.filter(function (s) { return done[s.id]; }).length; }
function refreshUI() {
  var u = UI();
  $('tTitle').textContent = u.title; $('stars').textContent = '⭐ ' + doneCount() + ' / ' + stations.length;
  $('bFly').textContent = pl.fly ? u.land : u.fly; $('bFly').classList.toggle('on', pl.fly);
  $('bAuthor').textContent = u.author; $('bGuide').textContent = guide ? u.guideOn : u.guideOff; $('bGuide').classList.toggle('on', guide); $('bExit').textContent = u.exit; $('bLesson').textContent = u.lesson;
  $('sTag').textContent = u.tag; $('sTitle').textContent = u.title; $('sSub').textContent = u.sub; $('bStart').textContent = u.start;
  $('sName').textContent = u.aName; $('sRole').textContent = u.aRole; $('sSchool').textContent = u.aSchool; $('sFest').textContent = u.aFest;
  $('k1').textContent = '🎮 ' + u.help1; $('k2').textContent = '✈️ ' + u.help2; $('k3').textContent = '🔎 ' + u.help3; $('k4').textContent = '🗺️ ' + u.help4;
  document.title = u.title + ' — 3D';
  if (near) $('bGo').innerHTML = '<kbd>E</kbd>' + esc(u.enter) + ': ' + esc(ST(near.id).title);
}
$('bGuide').onclick = function () { guide = !guide; try { localStorage.setItem('dkz_guide', guide ? '1' : '0'); } catch (e) {} if (!guide) stopSpeak(); refreshUI(); this.blur(); };
$('bExit').onclick = function () { exitInside(); this.blur(); };
$('bLesson').onclick = function () { if (cur) { $('panel').style.display = 'flex'; $('bLesson').style.display = 'none'; } this.blur(); };
$('iX').onclick = function () { closeInfo(); };
$('iSay').onclick = function () { var g0 = guide; guide = true; speak(infoSay); guide = g0; };
$('bFly').onclick = function () { toggleFly(); this.blur(); };
$('bStart').onclick = startGame;
$('bGo').onclick = function () { if (near) openStation(near); };
$('bAuthor').onclick = function () {
  var u = UI();
  $('modalBox').innerHTML = '<div class="auth" style="margin-top:0"><img src="assets/teacher.jpg" alt=""><div><b>' + esc(u.aName) + '</b>' + esc(u.aRole) + '<br>' + esc(u.aSchool) + '</div></div><div class="idea">🏆 ' + esc(u.aFest) + '</div><div class="idea">💡 ' + esc(u.aIdea) + '</div><button class="go" style="font-size:17px;padding:11px 26px;animation:none" id="mClose">' + esc(u.close) + '</button>';
  $('modal').style.display = 'flex'; $('mClose').onclick = function () { $('modal').style.display = 'none'; };
};
function startGame() {
  started = true; $('startOv').style.display = 'none'; $('hud').style.display = 'block'; beep(520, 0.1); setTimeout(function () { beep(780, 0.15); }, 120);
  $('hint').textContent = '🤖 ' + UI().hint0; setTimeout(function () { speak(UI().welcome); }, 400);
  setTimeout(function () { if (!inside) $('hint').style.opacity = 0; }, 12000);
}

var pv = { i: 0, quiz: false, res: '', fb: '', order: [0, 1, 2] };
function openStation(st) { if (warp || inside || exiting) return; closeInfo(); stopSpeak(); warp = { st: st, t: 0 }; $('warp').classList.add('on'); $('prompt').style.display = 'none'; beep(500, 0.25, 'triangle'); setTimeout(function () { beep(900, 0.3); }, 260); }
function closeStation() { exitInside(); }
function renderPanel() {
  var st = cur, d = ST(st.id), u = UI(), h = '', dst = (rooms[st.id] && rooms[st.id].dst) || st;
  h += '<div class="hd"><div class="ic">' + st.icon + '</div><div><h2>' + esc(d.title) + (done[st.id] ? ' ⭐' : '') + '</h2><div class="pl">📍 ' + esc(d.place) + '</div></div><button class="x" id="pX">' + esc(u.hide) + '</button></div>';
  h += '<div class="dots">' + d.slides.map(function (_, k) { return '<i class="' + (k <= pv.i ? 'a' : '') + '"></i>'; }).join('') + '<i class="' + (pv.quiz ? 'a' : '') + '" style="background:' + (pv.quiz ? '#ffd23f' : '') + '"></i></div>';
  if (!pv.quiz) {
    h += '<div class="card">' + esc(d.slides[pv.i]) + '<div><button class="say" id="pS">' + esc(u.listen) + '</button></div></div>';
    h += '<div class="nav"><button id="pP"' + (pv.i === 0 ? ' disabled' : '') + '>' + esc(u.prev) + '</button><button class="p" id="pN">' + esc(pv.i === d.slides.length - 1 ? u.toQuiz : u.next) + '</button></div>';
  } else {
    h += '<div class="card"><div class="q">❓ ' + esc(d.quiz.q) + ' <button class="say" id="pS" style="margin:0 0 0 6px">🔊</button></div>' + pv.order.map(function (k) { return '<button class="opt" data-k="' + k + '">' + esc(d.quiz.o[k]) + '</button>'; }).join('') + '</div><div class="fb" id="pF">' + esc(pv.fb) + '</div>';
    h += '<div class="nav"><button id="pP">' + esc(u.prev) + '</button></div>';
  }
  h += '<div class="lab"><h3>🧪 ' + esc(u.try) + '</h3>';
  if (st.id === 'mining') h += '<div>' + esc(d.act) + '</div><input type="range" id="pR" min="1" max="10" value="' + dst.level + '">';
  else h += '<button id="pA">' + esc(d.act) + '</button>';
  h += '<div class="res" id="pRes">' + esc(pv.res) + '</div></div>';
  var pn = $('panel'); pn.innerHTML = h; pn.style.borderColor = '#' + st.color.toString(16).padStart(6, '0');
  $('pX').onclick = function () { $('panel').style.display = 'none'; $('bLesson').style.display = 'inline-block'; };
  if ($('pS')) $('pS').onclick = function () { var g0 = guide; guide = true; speak(pv.quiz ? d.quiz.q : d.slides[pv.i]); guide = g0; };
  if ($('pP')) $('pP').onclick = function () { if (pv.quiz) pv.quiz = false; else pv.i = Math.max(0, pv.i - 1); pv.fb = ''; renderPanel(); beep(440, 0.05); speak(d.slides[pv.i]); };
  if ($('pN')) $('pN').onclick = function () { if (pv.i === d.slides.length - 1) pv.quiz = true; else pv.i++; renderPanel(); beep(560, 0.05); speak(pv.quiz ? d.quiz.q : d.slides[pv.i]); };
  if ($('pA')) $('pA').onclick = function () { pv.res = dst.action(); $('pRes').textContent = pv.res; beep(880, 0.12, 'triangle'); speak(pv.res); };
  if ($('pR')) { var f = function () { pv.res = dst.setLevel(+$('pR').value); $('pRes').textContent = pv.res; }; $('pR').oninput = f; if (!pv.res) f(); }
  Array.prototype.forEach.call(pn.querySelectorAll('.opt'), function (b) {
    b.onclick = function () {
      if (+b.dataset.k === 0) { b.classList.add('ok'); pv.fb = u.right; $('pF').textContent = pv.fb; $('pF').style.color = '#3ee08a'; win(st); setTimeout(function () { speak(u.right); }, 450); }
      else { b.classList.add('no'); pv.fb = u.wrong; $('pF').textContent = pv.fb; $('pF').style.color = '#ff6b7a'; beep(200, 0.2, 'sawtooth'); speak(u.wrong); }
    };
  });
}
function confetti(set) { for (var i = 0; i < 36; i++) { var e = document.createElement('div'); e.className = 'conf'; e.textContent = set[i % set.length]; e.style.left = Math.random() * 100 + 'vw'; e.style.animationDuration = 1.6 + Math.random() * 2 + 's'; e.style.animationDelay = Math.random() * 0.6 + 's'; document.body.appendChild(e); setTimeout(function (x) { x.remove(); }.bind(null, e), 4500); } }
function win(st) {
  [523, 659, 784, 1047].forEach(function (f, i) { setTimeout(function () { beep(f, 0.12, 'triangle'); }, i * 110); });
  confetti(['⭐', '✨', '🎉', '💙', '💛']);
  if (done[st.id]) return;
  done[st.id] = 1; try { localStorage.setItem('dkz_done', JSON.stringify(done)); } catch (e) {}
  labels.forEach(function (r) { if (r.s === st.lab) setLabel(r); }); refreshUI();
  if (doneCount() === stations.length) setTimeout(finale, 1600);
}
function finale() {
  var u = UI(); confetti(['🏆', '⭐', '🇰🇿', '🎉', '🤖']); speak(u.finS);
  $('modalBox').innerHTML = '<div style="font-size:70px">🏆</div><h1 style="font-size:40px">' + esc(u.finT) + '</h1><div class="sub">' + esc(u.finS) + '</div><div class="sub" style="color:#ffd23f;margin-top:14px">⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐</div><button class="go" id="mClose">' + esc(u.again) + '</button><div style="margin-top:14px"><button class="b" id="mReset">' + esc(u.reset) + '</button></div>';
  $('modal').style.display = 'flex'; $('mClose').onclick = function () { $('modal').style.display = 'none'; };
  $('mReset').onclick = function () { done = {}; try { localStorage.removeItem('dkz_done'); } catch (e) {} labels.forEach(setLabel); refreshUI(); $('modal').style.display = 'none'; };
}

// ---------- аудиогид (қазақша нейрондық дауыс) ----------
var AUD = window.AUDIO || {}, guide = true, aud = new Audio(), infoSay = '';
try { guide = localStorage.getItem('dkz_guide') !== '0'; } catch (e) {}
aud.addEventListener('ended', function () { $('bGuide').classList.remove('talk'); });
aud.addEventListener('pause', function () { $('bGuide').classList.remove('talk'); });
function stopSpeak() { try { aud.pause(); } catch (e) {} }
function speak(t) {
  stopSpeak(); if (!guide || !t) return;
  var f = AUD[t]; if (!f) return;
  aud.src = f;
  var pr = aud.play(); if (pr && pr.catch) pr.catch(function () {});
  $('bGuide').classList.add('talk');
}

// ---------- ақпарат картасы ----------
var infoOpen = false;
function showCard(icon, title, text, credit) {
  var el = $('info');
  el.querySelector('.ii').textContent = icon || 'ℹ️'; el.querySelector('b').textContent = title;
  el.querySelector('p').textContent = text; el.querySelector('small').textContent = credit || '';
  el.style.display = 'block'; requestAnimationFrame(function () { el.classList.add('show'); });
  infoOpen = true; infoSay = title + '. ' + text; speak(infoSay); beep(980, 0.06);
}
function showInfo(key) { var it = D.info[key]; if (it) showCard(it.i, it.t, it.x); }
function closeInfo() {
  if (!infoOpen) return;
  var el = $('info'); el.classList.remove('show'); infoOpen = false; stopSpeak();
  if (inside) inCam.tfov = 62;
  setTimeout(function () { if (!infoOpen) el.style.display = 'none'; }, 260);
}

// ---------- басу (raycast) ----------
var ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
function rootOf(o) { while (o.parent) { if (!o.visible) return null; o = o.parent; } return o; }
function pick(x, y) {
  var r = canvas.getBoundingClientRect();
  ndc.set((x - r.left) / r.width * 2 - 1, -(y - r.top) / r.height * 2 + 1);
  ray.setFromCamera(ndc, camera);
  var world = inside ? inScene : scene, hits = ray.intersectObjects(clickables, true);
  for (var i = 0; i < hits.length; i++) {
    var o = hits[i].object; if (rootOf(o) !== world) continue;
    for (; o; o = o.parent) {
      var u = o.userData;
      if (u.info) return { info: u.info };
      if (u.exhibit != null) return { ex: u.exhibit };
      if (u.exitDoor) return { exit: true };
      if (u.station && !inside) return { station: u.station };
    }
  }
  return null;
}
function onClick(x, y) {
  if (!started || warp || exiting) return;
  var h = pick(x, y); if (!h) return;
  if (h.info) showInfo(h.info);
  else if (h.ex != null) showExhibit(h.ex);
  else if (h.exit) exitInside();
  else if (h.station) openStation(h.station);
}

// ---------- станцияның ішкі әлемі (VR-зал) ----------
var inScene = new THREE.Scene();
inScene.background = new THREE.Color(0x040817);
inScene.fog = new THREE.Fog(0x040817, 28, 64);
inScene.add(new THREE.HemisphereLight(0xcfe0ff, 0x30305a, 0.95));
var inDir = new THREE.DirectionalLight(0xffffff, 0.9); inDir.position.set(6, 18, 10); inScene.add(inDir);
var rooms = {}, inside = null, warp = null, exiting = false;
var inCam = { yaw: 0, tyaw: 0, pitch: 0, tpitch: 0, fov: 62, tfov: 62, dolly: 0 };
var CAM_IN = new THREE.Vector3(0, 5.2, 3);
function hexStr(c) { return '#' + c.toString(16).padStart(6, '0'); }
function setFov(f) { if (Math.abs(camera.fov - f) > 0.01) { camera.fov = f; camera.updateProjectionMatrix(); } }

function wallTex(hex) {
  var t = canvasTex(1024, 512, function (g, w, h) {
    g.fillStyle = '#070d2a'; g.fillRect(0, 0, w, h);
    g.strokeStyle = hex; g.fillStyle = hex; g.lineCap = 'round';
    for (var i = 0; i < 60; i++) {
      var x = rnd() * w, y = rr(40, h - 40); g.globalAlpha = rr(0.25, 0.8); g.lineWidth = rr(1.5, 3.5);
      g.beginPath(); g.moveTo(x, y);
      for (var k = 0; k < 4; k++) { if (k % 2) y += rr(-70, 70); else x += rr(-120, 120); g.lineTo(x, y); }
      g.stroke(); g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill();
    }
    g.globalAlpha = 0.18; g.lineWidth = 1;
    for (var x2 = 0; x2 < w; x2 += 32) { g.beginPath(); g.moveTo(x2, 0); g.lineTo(x2, h); g.stroke(); }
    for (var y2 = 0; y2 < h; y2 += 32) { g.beginPath(); g.moveTo(0, y2); g.lineTo(w, y2); g.stroke(); }
    g.globalAlpha = 1;
    var gr = g.createLinearGradient(0, h, 0, h - 90); gr.addColorStop(0, hex); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = 0.55; g.fillStyle = gr; g.fillRect(0, h - 90, w, 90); g.globalAlpha = 1;
    g.fillStyle = hex; g.fillRect(0, 14, w, 4); g.fillRect(0, h - 10, w, 4);
  });
  t.wrapS = THREE.RepeatWrapping; t.repeat.set(4, 1); return t;
}
function floorTex(hex) {
  return canvasTex(1024, 1024, function (g, w, h) {
    g.fillStyle = '#060b22'; g.fillRect(0, 0, w, h);
    g.strokeStyle = hex; g.lineWidth = 3;
    for (var r = 40; r < 512; r += 46) { g.globalAlpha = 0.15 + (r % 92 ? 0 : 0.35); g.beginPath(); g.arc(512, 512, r, 0, 7); g.stroke(); }
    for (var a = 0; a < 48; a++) { g.globalAlpha = a % 4 ? 0.12 : 0.4; g.beginPath(); g.moveTo(512 + Math.cos(a / 48 * 6.283) * 60, 512 + Math.sin(a / 48 * 6.283) * 60); g.lineTo(512 + Math.cos(a / 48 * 6.283) * 512, 512 + Math.sin(a / 48 * 6.283) * 512); g.stroke(); }
    g.globalAlpha = 1;
  });
}

var IMGS = {};
function withImg(k, cb) {
  var im = IMGS[k];
  if (!im) { im = IMGS[k] = new Image(); im.src = PHOTOS[k]; }
  if (im.complete && im.naturalWidth) cb(im); else im.addEventListener('load', function () { cb(im); });
}
function ready(k) { var im = IMGS[k]; return im && im.complete && im.naturalWidth ? im : null; }
function rrect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function drawPhoto(g, im, x, y, w, h) {
  var s = Math.max(w / im.naturalWidth, h / im.naturalHeight), sw = w / s, sh = h / s;
  g.save(); g.globalAlpha = 0.28; g.drawImage(im, (im.naturalWidth - sw) / 2, (im.naturalHeight - sh) / 2, sw, sh, x, y, w, h); g.restore();
  var c = Math.min(w / im.naturalWidth, h / im.naturalHeight), dw = im.naturalWidth * c, dh = im.naturalHeight * c;
  g.save(); rrect(g, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh, 18); g.clip(); g.drawImage(im, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh); g.restore();
}
var EMO_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
function exhibitTex(e, hex) {
  var c = document.createElement('canvas'); c.width = 1024; c.height = 680; var g = c.getContext('2d');
  var tex = new THREE.CanvasTexture(c); tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 4;
  function draw() {
    var gr = g.createLinearGradient(0, 0, 0, 680); gr.addColorStop(0, '#111c4e'); gr.addColorStop(1, '#050a1e');
    g.fillStyle = gr; g.fillRect(0, 0, 1024, 680);
    g.globalAlpha = 0.16; g.strokeStyle = hex; g.lineWidth = 2;
    for (var x = 0; x < 1024; x += 48) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 680); g.stroke(); }
    for (var y = 0; y < 680; y += 48) { g.beginPath(); g.moveTo(0, y); g.lineTo(1024, y); g.stroke(); }
    g.globalAlpha = 1; g.textAlign = 'center'; g.textBaseline = 'middle';
    var X = 40, Y = 34, W = 944, H = 456;
    if (e.img === 'meet') {
      var a = ready('tokayev'), b = ready('durov');
      [[a, 150], [b, 594]].forEach(function (q) { if (!q[0]) return; g.save(); rrect(g, q[1], Y + 10, 280, 400, 22); g.clip(); var im = q[0], s = Math.max(280 / im.naturalWidth, 400 / im.naturalHeight); g.drawImage(im, (im.naturalWidth - 280 / s) / 2, 0, 280 / s, 400 / s, q[1], Y + 10, 280, 400); g.restore(); g.lineWidth = 6; g.strokeStyle = hex; rrect(g, q[1], Y + 10, 280, 400, 22); g.stroke(); });
      g.font = '130px ' + EMO_FONT; g.fillText('🤝', 512, Y + 210);
      g.font = '700 30px sans-serif'; g.fillStyle = '#fff'; g.fillText('Тоқаев', 290, Y + 438); g.fillText('Дуров', 734, Y + 438);
    } else if (e.img === 'diagram') {
      [['📊', 'Деректер'], ['🧠', 'Оқыту'], ['💬', 'Жауап']].forEach(function (q, i) {
        var bx = 70 + i * 320; g.fillStyle = 'rgba(255,255,255,.08)'; rrect(g, bx, 110, 240, 280, 26); g.fill(); g.lineWidth = 5; g.strokeStyle = hex; g.stroke();
        g.font = '120px ' + EMO_FONT; g.fillText(q[0], bx + 120, 210); g.font = '800 40px sans-serif'; g.fillStyle = '#fff'; g.fillText(q[1], bx + 120, 340);
        if (i < 2) { g.font = '800 70px sans-serif'; g.fillStyle = hex; g.fillText('➜', bx + 280, 250); }
      });
    } else if (e.img) {
      var im = ready(e.img); if (im) drawPhoto(g, im, X, Y, W, H);
      g.font = '600 22px sans-serif'; g.fillStyle = 'rgba(255,255,255,.7)'; g.textAlign = 'right'; g.fillText('Wikimedia Commons', 1004, Y + H - 14); g.textAlign = 'center';
    } else {
      var rg = g.createRadialGradient(512, 260, 10, 512, 260, 240); rg.addColorStop(0, hex); rg.addColorStop(1, 'rgba(0,0,0,0)');
      g.globalAlpha = 0.55; g.fillStyle = rg; g.fillRect(0, 0, 1024, 520); g.globalAlpha = 1;
      g.font = '250px ' + EMO_FONT; g.fillText(e.i || '💡', 512, 270);
    }
    g.fillStyle = hex; g.fillRect(0, 512, 1024, 7);
    var fs = 66; g.font = '800 ' + fs + 'px "Trebuchet MS",sans-serif'; while (g.measureText(e.t).width > 960 && fs > 30) { fs -= 3; g.font = '800 ' + fs + 'px "Trebuchet MS",sans-serif'; }
    g.fillStyle = '#fff'; g.fillText(e.t, 512, 588);
    g.font = '600 30px sans-serif'; g.fillStyle = '#a9bde0'; g.fillText('👆 Басып, тыңда 🔊', 512, 648);
    tex.needsUpdate = true;
  }
  draw();
  if (e.img === 'meet') { withImg('tokayev', draw); withImg('durov', draw); } else if (e.img && PHOTOS[e.img]) withImg(e.img, draw);
  return tex;
}

function buildRoom(st) {
  var hex = hexStr(st.color), g = new THREE.Group(); inScene.add(g);
  var wt = wallTex(hex), ft = floorTex(hex);
  mesh(new THREE.CylinderGeometry(24, 24, 18, 64, 1, true), new THREE.MeshStandardMaterial({ color: 0x1a2350, map: wt, emissive: 0xffffff, emissiveMap: wt, emissiveIntensity: 0.85, side: THREE.BackSide, roughness: 0.8 }), 0, 9, 0, g, true);
  var fl = mesh(new THREE.CircleGeometry(24, 72), new THREE.MeshStandardMaterial({ color: 0x1a2350, map: ft, emissive: 0xffffff, emissiveMap: ft, emissiveIntensity: 0.75, roughness: 0.35, metalness: 0.4 }), 0, 0, 0, g, true);
  fl.rotation.x = -Math.PI / 2;
  var ce = mesh(new THREE.CircleGeometry(24, 48), new THREE.MeshBasicMaterial({ color: 0x050a1e }), 0, 18, 0, g, true); ce.rotation.x = Math.PI / 2;
  [9, 16, 22].forEach(function (r, i) { ring(r, 0.12, st.color, 0, 17.4 - i * 0.3, 0, g); });
  var l1 = new THREE.PointLight(st.color, 1.6, 70); l1.position.set(0, 12, -10); g.add(l1);
  var l2 = new THREE.PointLight(0xffffff, 0.8, 60); l2.position.set(0, 14, 8); g.add(l2);
  var N = 420, pos = new Float32Array(N * 3);
  for (var i = 0; i < N; i++) { var a0 = rnd() * 6.283, r0 = Math.sqrt(rnd()) * 22; pos[i * 3] = Math.cos(a0) * r0; pos[i * 3 + 1] = rnd() * 17; pos[i * 3 + 2] = Math.sin(a0) * r0; }
  var pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.add(new THREE.Points(pg, new THREE.PointsMaterial({ color: st.color, size: 0.4, map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })));
  // ортадағы тұғыр және 3D модель
  var MZ = -10;
  cyl(6.2, 6.8, 1, mat(0x1c2550, { metalness: 0.6, roughness: 0.3 }), 0, 0.5, MZ, g, 48);
  ring(6.4, 0.12, st.color, 0, 1.05, MZ, g);
  var beam = mesh(new THREE.CylinderGeometry(5.8, 5.8, 16, 40, 1, true), new THREE.MeshBasicMaterial({ color: st.color, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), 0, 9, MZ, g, true);
  var holo = ring(7.3, 0.06, st.color, 0, 1.4, MZ, g);
  var model = grp(0, 1, MZ, g), dst = { id: st.id, pos: new THREE.Vector3(), r: st.r, inside: true, color: st.color };
  B[st.id](model, dst); model.scale.setScalar(IN_SCALE[st.id] || 0.6);
  label(st.icon + ' ' + ST(st.id).title, 1.6, 0, 15.4, MZ, g, { border: hex });
  // экспонаттар
  var ex = D.inside[st.id] || [], n = ex.length, R = 15.5, nr = Math.ceil(n / 2), nl = Math.max(1, n - nr), frames = [];
  ex.forEach(function (e, i) {
    var a = i < nr ? (38 + (i + 0.5) * 104 / nr) : (218 + (i - nr + 0.5) * 104 / nl); a = a * Math.PI / 180;
    var eg = grp(Math.sin(a) * R, 0, -Math.cos(a) * R, g); eg.lookAt(CAM_IN.x, 0, CAM_IN.z);
    cyl(0.9, 1.2, 0.5, mat(0x1c2550), 0, 0.25, 0, eg); cyl(0.18, 0.18, 2.6, mat(0x8894b5, { metalness: 0.7, roughness: 0.3 }), 0, 1.7, 0, eg, 10);
    var fr = grp(0, 5.6, 0, eg);
    box(7.7, 5.25, 0.2, glowMat(st.color, 1.1), 0, 0, -0.13, fr);
    mesh(new THREE.PlaneGeometry(7.36, 4.89), new THREE.MeshBasicMaterial({ map: exhibitTex(e, hex), toneMapped: false }), 0, 0, 0, fr, true);
    glow(st.color, 13, 0, 0, -0.7, fr).material.opacity = 0.35;
    label(String(i + 1), 0.9, 3.4, 2.4, 0.25, fr, { bg: 'rgba(5,10,30,.92)', border: hex });
    eg.userData.exhibit = i; clickables.push(eg);
    frames.push({ fr: fr, ph: rnd() * 6 });
  });
  // шығу есігі
  var door = grp(0, 0, 21.5, g); door.lookAt(0, 0, 0);
  mesh(new THREE.TorusGeometry(3.2, 0.2, 10, 48), glowMat(0xff6ba0, 1.8), 0, 4.2, 0, door, true);
  var dp = mesh(new THREE.CircleGeometry(3.1, 40), new THREE.MeshBasicMaterial({ color: 0xff9ac8, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }), 0, 4.2, 0, door, true);
  label(UI().exit, 1.2, 0, 8.2, 0, door, { bg: 'rgba(60,10,40,.9)', border: '#ff6ba0' });
  door.userData.exitDoor = true; clickables.push(door);
  onTick(function (t, dt) {
    if (!g.visible) return;
    var pa = pg.attributes.position;
    for (var i = 0; i < N; i++) { var y = pa.getY(i) + dt * 0.7; pa.setY(i, y > 17 ? 0 : y); }
    pa.needsUpdate = true;
    frames.forEach(function (f) { f.fr.position.y = 5.6 + Math.sin(t * 1.2 + f.ph) * 0.18; });
    holo.rotation.z = t * 0.5; holo.position.y = 1.4 + Math.sin(t * 1.5) * 0.3;
    beam.material.opacity = 0.06 + Math.sin(t * 2) * 0.02; dp.material.opacity = 0.2 + Math.sin(t * 3) * 0.1;
  });
  return { g: g, dst: dst, frames: frames };
}
function nearAngle(c, a) { while (a - c > Math.PI) a -= 2 * Math.PI; while (a - c < -Math.PI) a += 2 * Math.PI; return a; }
function showExhibit(i) {
  if (!inside) return;
  var room = rooms[inside.id], f = room.frames[i], e = D.inside[inside.id][i]; if (!f) return;
  var p = new THREE.Vector3(); f.fr.getWorldPosition(p);
  inCam.tyaw = nearAngle(inCam.yaw, Math.atan2(p.x - CAM_IN.x, -(p.z - CAM_IN.z)));
  inCam.tpitch = Math.atan2(p.y - CAM_IN.y, Math.hypot(p.x - CAM_IN.x, p.z - CAM_IN.z));
  inCam.tfov = 44;
  showCard(e.i || '📸', e.t, e.x, e.img && e.img !== 'diagram' ? UI().photo : '');
}
function enterInside(st) {
  if (!rooms[st.id]) rooms[st.id] = buildRoom(st);
  for (var k in rooms) rooms[k].g.visible = k === st.id;
  inside = st; cur = st;
  inCam.yaw = inCam.tyaw = innerWidth > 900 ? 0.22 : 0; inCam.pitch = inCam.tpitch = 0.03; inCam.fov = inCam.tfov = 62; inCam.dolly = 14;
  document.body.classList.add('inside');
  pv = { i: 0, quiz: false, res: '', fb: '', order: [0, 1, 2].sort(function () { return Math.random() - 0.5; }) };
  $('panel').style.display = 'flex'; $('bLesson').style.display = 'none'; renderPanel();
  $('hint').textContent = '🥽 ' + UI().insideHint; $('hint').style.opacity = 1;
  setTimeout(function () { if (inside) $('hint').style.opacity = 0; }, 7000);
  setTimeout(function () { $('warp').classList.remove('on'); }, 60);
  setTimeout(function () { if (inside === st) speak(ST(st.id).slides[0]); }, 800);
}
function exitInside() {
  if (!inside || exiting) return;
  exiting = true; closeInfo(); stopSpeak(); $('warp').classList.add('on'); beep(700, 0.2, 'triangle');
  setTimeout(function () {
    inside = null; cur = null; exiting = false;
    document.body.classList.remove('inside'); $('panel').style.display = 'none'; $('bLesson').style.display = 'none';
    setFov(55);
    var a = pl.h + Math.PI; cam.yaw = 0;
    cam.pos.set(pl.x + Math.sin(a) * 24, pl.y + 14, pl.z + Math.cos(a) * 24); cam.look.set(pl.x, pl.y + 2, pl.z);
    setTimeout(function () { $('warp').classList.remove('on'); }, 80);
  }, 520);
}
function stepInside(dt) {
  var ic = inCam;
  var kt = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + joy.x;
  var kp = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) - joy.y;
  if (kt) ic.tyaw += kt * dt * 1.5;
  if (kp) ic.tpitch = clamp(ic.tpitch + kp * dt, -0.55, 0.6);
  var k = Math.min(1, dt * 4);
  ic.yaw += (ic.tyaw - ic.yaw) * k; ic.pitch += (ic.tpitch - ic.pitch) * k; ic.fov += (ic.tfov - ic.fov) * k;
  ic.dolly += (0 - ic.dolly) * Math.min(1, dt * 1.6);
  camera.position.set(CAM_IN.x, CAM_IN.y, CAM_IN.z + ic.dolly);
  var cp = Math.cos(ic.pitch);
  tmpV.set(camera.position.x + Math.sin(ic.yaw) * cp, camera.position.y + Math.sin(ic.pitch), camera.position.z - Math.cos(ic.yaw) * cp);
  camera.lookAt(tmpV); setFov(ic.fov);
  renderer.render(inScene, camera);
}

// ---------- шағын карта ----------
var mm = $('mm'), mc = mm.getContext('2d'), MS = 1.35;
function mx(x) { return (x + 200) * MS; } function mz(z) { return (z + 115) * MS; }
function drawMini(t) {
  mc.clearRect(0, 0, 540, 312);
  mc.beginPath(); POLY.forEach(function (p, i) { if (i) mc.lineTo(mx(p[0]), mz(p[1])); else mc.moveTo(mx(p[0]), mz(p[1])); }); mc.closePath();
  mc.fillStyle = 'rgba(90,190,120,.55)'; mc.fill(); mc.lineWidth = 2.5; mc.strokeStyle = '#7ff6ff'; mc.stroke();
  mc.textAlign = 'center'; mc.textBaseline = 'middle';
  stations.forEach(function (s, i) {
    var x = mx(s.pos.x), y = mz(s.pos.z), c = '#' + s.color.toString(16).padStart(6, '0');
    mc.beginPath(); mc.arc(x, y, 13 + (s === near ? Math.sin(t * 6) * 3 : 0), 0, 7); mc.fillStyle = done[s.id] ? '#ffd23f' : c; mc.fill(); mc.lineWidth = 2.5; mc.strokeStyle = '#fff'; mc.stroke();
    mc.fillStyle = '#0b1230'; mc.font = '800 13px sans-serif'; mc.fillText(done[s.id] ? '★' : String(i + 1), x, y + 1);
  });
  mc.save(); mc.translate(mx(pl.x), mz(pl.z)); mc.rotate(-pl.h + Math.PI); mc.beginPath(); mc.moveTo(0, -13); mc.lineTo(9, 10); mc.lineTo(0, 5); mc.lineTo(-9, 10); mc.closePath(); mc.fillStyle = '#fff'; mc.fill(); mc.lineWidth = 2; mc.strokeStyle = '#ff3b6b'; mc.stroke(); mc.restore();
}
mm.addEventListener('click', function (e) {
  var r = mm.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * 540, y = (e.clientY - r.top) / r.height * 312, best = null, bd = 30;
  stations.forEach(function (s) { var d = Math.hypot(mx(s.pos.x) - x, mz(s.pos.z) - y); if (d < bd) { bd = d; best = s; } });
  if (best) teleport(best);
  else { var wx = x / MS - 200, wz = y / MS - 115; if (inKZ(wx, wz)) { closeStation(); pl.x = wx; pl.z = wz; pl.v = 0; } }
});

// ---------- негізгі цикл ----------
function resize() { var w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();
var clock = new THREE.Clock(), T = 0, frame = 0, tmpV = new THREE.Vector3();
function step(dt) {
  T += dt; frame++;
  for (var i = 0; i < updaters.length; i++) updaters[i](T, dt);
  // қозғалыс
  if (started && !cur && !warp) {
    var thr = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) - joy.y;
    var turn = (keys.KeyA || keys.ArrowLeft ? 1 : 0) - (keys.KeyD || keys.ArrowRight ? 1 : 0) - joy.x;
    thr = Math.max(-1, Math.min(1, thr)); turn = Math.max(-1, Math.min(1, turn));
    var vmax = (pl.fly ? 46 : 26) * (keys.ShiftLeft || keys.ShiftRight ? 1.7 : 1);
    pl.v += (thr * vmax - pl.v) * Math.min(1, dt * 2.6);
    pl.h += turn * dt * 2.1 * (pl.v < -1 ? -1 : 1);
    var nx = pl.x + Math.sin(pl.h) * pl.v * dt, nz = pl.z + Math.cos(pl.h) * pl.v * dt;
    if (pl.fly || pl.y > 3) { pl.x = Math.max(-230, Math.min(230, nx)); pl.z = Math.max(-135, Math.min(135, nz)); }
    else if (inKZ(nx, nz)) { pl.x = nx; pl.z = nz; } else if (inKZ(nx, pl.z)) pl.x = nx; else if (inKZ(pl.x, nz)) pl.z = nz; else pl.v *= 0.5;
    if (!pl.fly && pl.y < 3) stations.forEach(function (s) { if (s.open) return; var dx = pl.x - s.pos.x, dz = pl.z - s.pos.z, d = Math.hypot(dx, dz), m = s.r + 2.6; if (d < m && d > 0.01) { pl.x = s.pos.x + dx / d * m; pl.z = s.pos.z + dz / d * m; } });
  } else pl.v *= 0.9;
  var ty = pl.fly ? 15 : (inKZ(pl.x, pl.z) ? 0 : 3);
  pl.y += (ty - pl.y) * Math.min(1, dt * 2.5);
  player.position.set(pl.x, pl.y + (pl.fly ? Math.sin(T * 2.4) * 0.3 : 0), pl.z); player.rotation.y = pl.h;
  pl.body.rotation.x = pl.fly ? pl.v * 0.006 : 0; pl.body.rotation.z = 0;
  pl.wheels.forEach(function (w) { w.rotation.x += pl.v * dt * 2; });
  pl.props.forEach(function (p) { p.rotation.y += dt * 45; });
  pl.tip.material.emissiveIntensity = 1.5 + Math.sin(T * 6) * 1.2; pl.under.visible = pl.y < 4;
  // жақын станция
  var nb = null, nd = 1e9;
  stations.forEach(function (s) { var d = Math.hypot(pl.x - s.pos.x, pl.z - s.pos.z); s.ring.scale.setScalar(1 + Math.sin(T * 3) * 0.02); if (d < s.r + 9 && d < nd) { nd = d; nb = s; } });
  if (nb !== near) { near = nb; if (near && started && !cur) beep(740, 0.06); refreshUI(); }
  $('prompt').style.display = (near && started && !cur && !warp) ? 'block' : 'none';
  // камера
  if (inside) { stepInside(dt); return; }
  var tp = tmpV, look;
  if (warp) {
    warp.t += dt; var ws = warp.st, wq = Math.min(warp.t / 0.8, 1);
    look = new THREE.Vector3(ws.pos.x, ws.lookY, ws.pos.z);
    tp.copy(cam.pos).lerp(look, Math.min(1, dt * 3.4));
    setFov(55 + wq * wq * 50);
    if (warp.t >= 0.8) { warp = null; enterInside(ws); return; }
  } else {
    if (!cam.drag && Math.abs(pl.v) > 3) cam.yaw *= Math.pow(0.2, dt);
    var a = pl.h + Math.PI + cam.yaw, dd = cam.dist * (started ? 1 : 2.6);
    tp.set(pl.x + Math.sin(a) * dd * Math.cos(cam.pitch), pl.y + 2 + dd * Math.sin(cam.pitch), pl.z + Math.cos(a) * dd * Math.cos(cam.pitch));
    if (!started) { var oa = T * 0.08; tp.set(A.x + Math.sin(oa) * 70, 34, A.z + 10 + Math.cos(oa) * 70); look = new THREE.Vector3(A.x, 6, A.z + 6); }
    else look = new THREE.Vector3(pl.x, pl.y + 2.2, pl.z);
  }
  var k = 1 - Math.pow(0.002, dt);
  cam.pos.lerp(tp, k); cam.look.lerp(look, k);
  camera.position.copy(cam.pos); camera.lookAt(cam.look);
  var f = player.position;
  sun.target.position.set(f.x, 0, f.z); sun.position.set(f.x + 45, 80, f.z + 35);
  if (frame % 3 === 0) drawMini(T);
  renderer.render(scene, camera);
}
function loop() { requestAnimationFrame(loop); step(Math.min(clock.getDelta(), 0.05)); }

refreshUI();
// сынақ режимі: ?debug&go=smart
var mgo = /go=(\w+)/.exec(QS);
if (mgo) { startGame(); if (byId[mgo[1]]) { teleport(byId[mgo[1]]); if (QS.indexOf('open') >= 0) openStation(byId[mgo[1]]); } else if (mgo[1] === 'fly') { toggleFly(); cam.dist = 80; cam.pitch = 0.9; } for (var w = 0; w < 240; w++) { T += 0.05; for (var q = 0; q < updaters.length; q++) updaters[q](T, 0.05); } for (w = 0; w < 60; w++) step(0.05); }
var mex = /ex=(\d+)/.exec(QS); if (mex) { showExhibit(+mex[1]); for (var w2 = 0; w2 < 40; w2++) step(0.05); }
var minf = /info=(\w+)/.exec(QS); if (minf) showInfo(minf[1]);
loop();
})();
