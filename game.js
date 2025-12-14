/* ASYLUM FOG // vanilla JS, HTML5 Canvas, GitHub Pages ready */
(() => {
  "use strict";

  /***********************
   * DOM
   ***********************/
  const $ = (id) => document.getElementById(id);

  const UI = {
    canvas: $("c"),
    menu: $("menu"),
    startBtn: $("startBtn"),
    retryBtn: $("retryBtn"),
    menuBtn: $("menuBtn"),
    over: $("over"),
    overTitle: $("overTitle"),
    overBody: $("overBody"),

    hud: $("hud"),
    hpFill: $("hpFill"),
    sanFill: $("sanFill"),
    depthLabel: $("depthLabel"),
    modeLabel: $("modeLabel"),
    weaponLabel: $("weaponLabel"),
    hintLabel: $("hintLabel"),

    nameInput: $("nameInput"),
    spriteFiles: $("spriteFiles"),
    loadSpritesBtn: $("loadSpritesBtn"),
    assetDot: $("assetDot"),
    assetText: $("assetText"),

    toggleConfusion: $("toggleConfusion"),
    toggleFaces: $("toggleFaces"),
    toggleHardAudio: $("toggleHardAudio"),

    dialogue: $("dialogue"),
    dlgTitle: $("dlgTitle"),
    dlgSub: $("dlgSub"),
    dlgBody: $("dlgBody"),
    dlgChoices: $("dlgChoices"),
  };

  /***********************
   * Canvas (low-res buffer upscaled)
   ***********************/
  const canvas = UI.canvas;
  const ctx = canvas.getContext("2d", { alpha: false });
  ctx.imageSmoothingEnabled = false;

  const buf = document.createElement("canvas");
  const bctx = buf.getContext("2d", { alpha: false });
  bctx.imageSmoothingEnabled = false;

  let W = 0, H = 0;        // real pixels
  let RW = 384, RH = 216;  // internal render size

  function resize() {
    const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    W = canvas.width = Math.max(1, (innerWidth * dpr) | 0);
    H = canvas.height = Math.max(1, (innerHeight * dpr) | 0);

    const aspect = innerWidth / Math.max(1, innerHeight);
    RW = 384;
    RH = Math.max(216, Math.floor(RW / Math.max(0.62, aspect)));

    buf.width = RW;
    buf.height = RH;

    ctx.imageSmoothingEnabled = false;
    bctx.imageSmoothingEnabled = false;
  }
  window.addEventListener("resize", resize);
  resize();

  /***********************
   * Helpers
   ***********************/
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
  const randi = (a, b) => (a + (Math.random() * (b - a + 1) | 0));
  const chance = (p) => Math.random() < p;

  function aabb(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }
  function hypot(x, y) { return Math.hypot(x, y); }
  function norm(x, y) {
    const l = Math.hypot(x, y) || 1;
    return [x / l, y / l];
  }

  /***********************
   * Input (FIXED: never inverts unless explicitly enabled)
   ***********************/
  const Input = {
    keys: new Set(),
    mouse: { nx: 0.5, ny: 0.5, down: false },
    // optional confusion effect (OFF by default)
    confusionEnabled: false,
    confusionT: 0,
    isPaused: () => SceneStack.top()?.pausesGame === true,

    down(code) { return this.keys.has(code); },
    consume(code) { if (this.down(code)) { this.keys.delete(code); return true; } return false; },

    axisX() {
      const raw = (this.down("KeyD") ? 1 : 0) - (this.down("KeyA") ? 1 : 0);
      if (this.confusionEnabled && this.confusionT > 0) return -raw;
      return raw;
    },
    jump() { return this.down("KeyW"); },
    crouch() { return this.down("KeyS"); },
    interact() { return this.down("KeyE"); }
  };

  window.addEventListener("keydown", (e) => {
    if (["KeyW","KeyA","KeyS","KeyD","KeyE","Space","Digit1","Digit2","Digit3","Digit4"].includes(e.code)) e.preventDefault();
    Input.keys.add(e.code);
  }, { passive: false });

  window.addEventListener("keyup", (e) => Input.keys.delete(e.code));

  canvas.addEventListener("mousemove", (e) => {
    const r = canvas.getBoundingClientRect();
    Input.mouse.nx = clamp((e.clientX - r.left) / Math.max(1, r.width), 0, 1);
    Input.mouse.ny = clamp((e.clientY - r.top) / Math.max(1, r.height), 0, 1);
  });

  canvas.addEventListener("mousedown", () => Input.mouse.down = true);
  window.addEventListener("mouseup", () => Input.mouse.down = false);

  /***********************
   * Palette + Atmosphere
   ***********************/
  const PAL = {
    bg: "#050505",
    floor: "#09090d",
    wall: "#0f0f16",
    outline: "#2a2a3a",
    fog: "#0b0b12",
    light: "#eaeaf2",
    accent: "#7d3cff",
    danger: "#ff2a2a",
    sick: "#a2ffcf",
    rust: "#5a0b17",
    paper: "#f1f1ff",
    skin: "#c9c9d6",
  };

  /***********************
   * Assets + Animated sprites
   * - Supports sprite sheets: frames in a row
   ***********************/
  class Assets {
    constructor() {
      this.images = new Map();     // key -> Image or Canvas
      this.loaded = 0;
      this.failed = 0;

      // optional repo assets (no external URLs)
      this.manifest = {
        player: "assets/player.png",
        angel: "assets/angel.png",
        nurse: "assets/nurse.png",
        patient: "assets/patient.png",
        child: "assets/child.png",
        chest: "assets/chest.png",
        note: "assets/note.png",
        boss1: "assets/boss1.png",
        boss2: "assets/boss2.png",
        face1: "assets/face1.png",
        face2: "assets/face2.png",
      };
    }
    get(key) { return this.images.get(key) || null; }

    async tryLoadManifest() {
      const keys = Object.keys(this.manifest);
      await Promise.all(keys.map(k => this._loadOne(k, this.manifest[k], true)));
    }

    _loadOne(key, url, silent) {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => { this.images.set(key, img); this.loaded++; resolve(true); };
        img.onerror = () => { this.failed++; resolve(false); };
        img.src = url;
      });
    }

    async loadFromFiles(fileList) {
      const files = Array.from(fileList || []);
      for (const f of files) {
        if (!f.type.includes("png")) continue;
        const name = (f.name || "").toLowerCase();

        const key = (() => {
          if (name.includes("player")) return "player";
          if (name.includes("angel")) return "angel";
          if (name.includes("nurse")) return "nurse";
          if (name.includes("patient")) return "patient";
          if (name.includes("child") || name.includes("daughter")) return "child";
          if (name.includes("chest")) return "chest";
          if (name.includes("note")) return "note";
          if (name.includes("boss1")) return "boss1";
          if (name.includes("boss2")) return "boss2";
          if (name.includes("face1")) return "face1";
          if (name.includes("face2")) return "face2";
          return null;
        })();
        if (!key) continue;

        const dataUrl = await new Promise((resolve) => {
          const fr = new FileReader();
          fr.onload = () => resolve(fr.result);
          fr.readAsDataURL(f);
        });

        await new Promise((resolve) => {
          const img = new Image();
          img.onload = () => { this.images.set(key, img); resolve(true); };
          img.onerror = () => resolve(false);
          img.src = dataUrl;
        });
      }
    }
  }

  const assets = new Assets();

  // Animated sprite helper (sprite sheet: frames in a single row)
  class Sprite {
    constructor(img, frameW, frameH, frames, fps = 10) {
      this.img = img;
      this.fw = frameW;
      this.fh = frameH;
      this.frames = frames;
      this.fps = fps;
    }
    draw(ctx, x, y, t, flip = false, scale = 1, alpha = 1, frameOverride = null) {
      const f = frameOverride !== null ? frameOverride : (Math.floor(t * this.fps) % this.frames);
      const sx = f * this.fw;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(x | 0, y | 0);
      if (flip) { ctx.scale(-1, 1); ctx.translate(-this.fw * scale, 0); }
      ctx.drawImage(this.img, sx, 0, this.fw, this.fh, 0, 0, (this.fw * scale) | 0, (this.fh * scale) | 0);
      ctx.restore();
    }
  }

  /***********************
   * Procedural sprite sheets (professional-looking placeholders)
   * When no PNG exists, we generate an animated sheet on a canvas.
   ***********************/
  function makeSheet(key, fw, fh, frames, drawFrame) {
    const c = document.createElement("canvas");
    c.width = fw * frames;
    c.height = fh;
    const x = c.getContext("2d");
    x.imageSmoothingEnabled = false;

    for (let i = 0; i < frames; i++) {
      x.save();
      x.translate(i * fw, 0);
      drawFrame(x, i, frames);
      x.restore();
    }
    assets.images.set(key, c);
  }

  function ditherDots(ctx, w, h, density, color) {
    ctx.fillStyle = color;
    const n = Math.floor(w * h * density);
    for (let i = 0; i < n; i++) {
      const x = (Math.random() * w) | 0;
      const y = (Math.random() * h) | 0;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  function buildProceduralSprites() {
    // Player: 6 frames walk cycle
    makeSheet("player", 24, 36, 6, (x, i) => {
      x.clearRect(0,0,24,36);
      // silhouette base
      x.fillStyle = "#0a0a0f";
      x.fillRect(6, 8, 12, 22);
      // coat
      x.fillStyle = PAL.light;
      x.fillRect(7, 10, 10, 18);
      // head
      x.fillStyle = "#15151c";
      x.fillRect(8, 6, 8, 6);
      // eye glow
      x.fillStyle = PAL.accent;
      x.fillRect(14, 8, 2, 1);

      // legs animation
      const step = Math.sin((i/6)*Math.PI*2);
      x.fillStyle = "#111118";
      x.fillRect(8 + (step>0?1:0), 28, 3, 6);
      x.fillRect(13 + (step<0?1:0), 28, 3, 6);

      // rifle
      x.fillStyle = "#5f5f6e";
      x.fillRect(16, 16, 7, 2);
      x.fillRect(20, 15, 3, 1);

      // grime dithering
      ditherDots(x, 24, 36, 0.035, "#0c0c12");
      ditherDots(x, 24, 36, 0.02, "#ffffff10");
    });

    // Angel: 6 frames (wing flutter)
    makeSheet("angel", 28, 28, 6, (x, i) => {
      x.clearRect(0,0,28,28);
      const flap = Math.sin((i/6)*Math.PI*2);
      // wings
      x.fillStyle = PAL.danger;
      x.fillRect(2, 10, 8, 4 + ((flap*3)|0));
      x.fillRect(18, 10, 8, 4 + ((-flap*3)|0));
      // body
      x.fillStyle = "#2a0b10";
      x.fillRect(10, 7, 8, 14);
      // slit eye
      x.fillStyle = PAL.paper;
      x.fillRect(13, 12, 2, 1);
      // spikes
      x.strokeStyle = PAL.danger;
      x.beginPath();
      x.moveTo(14, 4); x.lineTo(14, 7);
      x.stroke();

      ditherDots(x, 28, 28, 0.06, "#00000022");
    });

    // Nurse: ambiguous NPC
    makeSheet("nurse", 24, 34, 6, (x,i)=> {
      x.clearRect(0,0,24,34);
      const sway = Math.sin((i/6)*Math.PI*2);
      x.fillStyle = "#0c0c12";
      x.fillRect(7, 7, 10, 24);
      x.fillStyle = "#dcdcea";
      x.fillRect(8, 9, 8, 18);
      // mask / bandage
      x.fillStyle = "#f1f1ff";
      x.fillRect(9, 7, 6, 4);
      x.fillStyle = PAL.accent;
      x.fillRect(14, 9, 1, 1);
      // syringe silhouette
      x.fillStyle = "#6e6e80";
      x.fillRect(3, 14 + ((sway*1)|0), 6, 2);
      ditherDots(x, 24, 34, 0.045, "#0b0b10");
    });

    // Patient: deranged wanderer
    makeSheet("patient", 24, 34, 6, (x,i)=> {
      x.clearRect(0,0,24,34);
      const twitch = (Math.random()*2-1)*0.3; // tiny static while generating
      x.fillStyle = "#09090f";
      x.fillRect(7, 7, 10, 24);
      x.fillStyle = "#b8b8c6";
      x.fillRect(8, 10, 8, 14);
      x.fillStyle = "#000";
      x.fillRect(9, 8, 6, 3);
      x.fillStyle = PAL.rust;
      x.fillRect(12, 16, 2, 2);
      // dragging limb
      const step = Math.sin((i/6)*Math.PI*2);
      x.fillStyle = "#101018";
      x.fillRect(8 + (step>0?1:0), 28, 3, 6);
      x.fillRect(13 + (step<0?1:0), 3, 1, 1); // micro glitch
      ditherDots(x, 24, 34, 0.05, "#00000022");
    });

    // Child (Patient 07)
    makeSheet("child", 22, 30, 4, (x,i)=> {
      x.clearRect(0,0,22,30);
      const bob = Math.sin((i/4)*Math.PI*2);
      x.fillStyle = PAL.sick;
      x.fillRect(9, 6 + ((bob*1)|0), 4, 4);
      x.beginPath();
      x.moveTo(11, 10);
      x.lineTo(18, 26);
      x.lineTo(4, 26);
      x.closePath();
      x.fill();
      // eyes
      x.fillStyle = "#003a22";
      x.fillRect(9, 9, 1, 1);
      x.fillRect(12, 9, 1, 1);
      ditherDots(x, 22, 30, 0.03, "#ffffff10");
    });

    // Chest
    makeSheet("chest", 26, 18, 4, (x,i)=> {
      x.clearRect(0,0,26,18);
      const pulse = Math.sin((i/4)*Math.PI*2);
      x.fillStyle = "#0b0b11";
      x.fillRect(3, 6, 20, 10);
      x.fillStyle = "#181820";
      x.fillRect(4, 7, 18, 4);
      x.fillStyle = "#ffb24a";
      x.fillRect(6, 11, 14, 2);
      // latch
      x.fillStyle = "#2a2a3a";
      x.fillRect(12, 10, 2, 3);
      // shimmer
      x.globalAlpha = 0.3 + pulse*0.2;
      x.fillStyle = "#ffb24a";
      x.fillRect(18, 6, 2, 2);
      x.globalAlpha = 1;
      ditherDots(x, 26, 18, 0.06, "#00000022");
    });

    // Note
    makeSheet("note", 14, 12, 2, (x,i)=> {
      x.clearRect(0,0,14,12);
      x.fillStyle = PAL.paper;
      x.fillRect(1,1,12,10);
      x.fillStyle = "#2a2a3a";
      x.fillRect(10,2,2,2);
      ditherDots(x, 14, 12, 0.08, "#00000014");
    });

    // Bosses placeholders
    makeSheet("boss1", 64, 64, 6, (x,i)=> {
      x.clearRect(0,0,64,64);
      const r = 10 + Math.sin((i/6)*Math.PI*2)*2;
      // core
      x.fillStyle = "#0d0d16";
      x.fillRect(16, 12, 32, 44);
      // halo blades
      x.strokeStyle = PAL.accent;
      x.beginPath();
      for(let k=0;k<10;k++){
        const a = k*(Math.PI*2/10) + i*0.25;
        const cx=32, cy=20;
        x.moveTo(cx,cy);
        x.lineTo(cx+Math.cos(a)*(14+r), cy+Math.sin(a)*10);
      }
      x.stroke();
      x.fillStyle = PAL.danger;
      x.fillRect(30, 28, 4, 10);
      ditherDots(x, 64, 64, 0.06, "#00000022");
    });

    makeSheet("boss2", 72, 56, 6, (x,i)=> {
      x.clearRect(0,0,72,56);
      const wob = Math.sin((i/6)*Math.PI*2);
      // chassis
      x.fillStyle = "#0b0b12";
      x.fillRect(14, 10, 44, 30);
      // core
      x.fillStyle = PAL.accent;
      x.fillRect(34, 22, 4, 4);
      // mouths/speakers
      x.fillStyle = PAL.danger;
      x.fillRect(18, 16, 6, 6);
      x.fillRect(48, 16, 6, 6);
      // dangling “wires”
      x.strokeStyle = "#3a3a55";
      x.beginPath();
      x.moveTo(36, 40); x.lineTo(28, 52 + ((wob*2)|0));
      x.moveTo(36, 40); x.lineTo(44, 52 + ((-wob*2)|0));
      x.stroke();
      ditherDots(x, 72, 56, 0.07, "#00000022");
    });
  }

  buildProceduralSprites();

  function updateAssetUI() {
    const count = assets.images.size;
    if (count > 0) {
      UI.assetDot.className = "dot ok";
      UI.assetText.textContent = `Sprites: ${count} loaded (PNG + procedural)`;
    } else {
      UI.assetDot.className = "dot warn";
      UI.assetText.textContent = "Sprites: procedural placeholders";
    }
  }
  updateAssetUI();

  /***********************
   * Procedural Audio (more abrasive)
   ***********************/
  const AudioSys = {
    ctx: null,
    master: null,
    started: false,
    // nodes
    droneOsc: null,
    droneGain: null,
    noiseSrc: null,
    noiseGain: null,
    filter: null,
    crunch: null,
    sirenOsc: null,
    sirenGain: null,
    hardMode: true,

    start() {
      if (this.started) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.22;
      this.master.connect(this.ctx.destination);

      // master filter (moves with intensity)
      this.filter = this.ctx.createBiquadFilter();
      this.filter.type = "lowpass";
      this.filter.frequency.value = 380;
      this.filter.Q.value = 0.9;
      this.filter.connect(this.master);

      // “crunch” waveshaper (abrasive)
      this.crunch = this.ctx.createWaveShaper();
      this.crunch.curve = this._makeDistortionCurve(220);
      this.crunch.oversample = "4x";
      this.crunch.connect(this.filter);

      // Drone (two oscillators, slight detune)
      const o1 = this.ctx.createOscillator();
      const o2 = this.ctx.createOscillator();
      o1.type = "sawtooth";
      o2.type = "triangle";
      o1.frequency.value = 44;
      o2.frequency.value = 56;
      o2.detune.value = -17;

      this.droneGain = this.ctx.createGain();
      this.droneGain.gain.value = 0.09;

      o1.connect(this.droneGain);
      o2.connect(this.droneGain);
      this.droneGain.connect(this.crunch);

      // Noise buffer
      const nlen = 2 * this.ctx.sampleRate;
      const bufN = this.ctx.createBuffer(1, nlen, this.ctx.sampleRate);
      const data = bufN.getChannelData(0);
      for (let i = 0; i < nlen; i++) {
        const white = (Math.random() * 2 - 1);
        // slightly “gritty” colored noise
        data[i] = white * (0.75 + 0.25 * Math.random());
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = bufN;
      noise.loop = true;

      this.noiseGain = this.ctx.createGain();
      this.noiseGain.gain.value = 0.02;

      const hp = this.ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 160;

      noise.connect(hp);
      hp.connect(this.noiseGain);
      this.noiseGain.connect(this.crunch);

      // Siren (only during frenetic/boss)
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = "sine";
      this.sirenOsc.frequency.value = 480;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0.0001;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.filter);

      o1.start();
      o2.start();
      noise.start();
      this.sirenOsc.start();

      this.started = true;
    },

    setHardMode(on) {
      this.hardMode = !!on;
      if (!this.started) return;
      const t = this.ctx.currentTime;
      this.master.gain.setTargetAtTime(this.hardMode ? 0.26 : 0.20, t, 0.08);
      this.crunch.curve = this._makeDistortionCurve(this.hardMode ? 280 : 120);
    },

    setIntensity(v, mode) {
      if (!this.started) return;
      const t = this.ctx.currentTime;
      const i = clamp(v, 0, 1);

      // more intensity = more noise + brighter filter
      this.filter.frequency.setTargetAtTime(260 + i * 2200, t, 0.12);
      this.noiseGain.gain.setTargetAtTime(0.01 + i * (this.hardMode ? 0.22 : 0.14), t, 0.12);
      this.droneGain.gain.setTargetAtTime(0.06 + i * 0.12, t, 0.12);

      // siren: only if frenetic/boss and hard mode toggle
      const sirenOn = (mode === "frenetic" || mode === "boss");
      const sirenTarget = (this.hardMode && sirenOn) ? (0.02 + i * 0.06) : 0.0001;
      this.sirenGain.gain.setTargetAtTime(sirenTarget, t, 0.12);

      if (sirenOn) {
        const f = 420 + Math.sin(performance.now() * 0.0012) * 180;
        this.sirenOsc.frequency.setTargetAtTime(f, t, 0.12);
      }
    },

    ping(kind = "shoot", amount = 1) {
      if (!this.started) return;
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.connect(g);
      g.connect(this.filter);

      g.gain.value = 0.0001;

      if (kind === "shoot") {
        o.type = "square";
        o.frequency.setValueAtTime(180, t);
        o.frequency.exponentialRampToValueAtTime(60, t + 0.09);
        g.gain.setValueAtTime(0.12 * amount, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.10);
        o.start(t); o.stop(t + 0.11);
      } else if (kind === "hit") {
        o.type = "sawtooth";
        o.frequency.setValueAtTime(110, t);
        o.frequency.exponentialRampToValueAtTime(14, t + 0.22);
        g.gain.setValueAtTime(0.18 * amount, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
        o.start(t); o.stop(t + 0.26);
      } else if (kind === "thump") {
        o.type = "sine";
        o.frequency.setValueAtTime(120, t);
        o.frequency.exponentialRampToValueAtTime(38, t + 0.16);
        g.gain.setValueAtTime(0.20 * amount, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
        o.start(t); o.stop(t + 0.24);
      } else if (kind === "boss") {
        o.type = "triangle";
        o.frequency.setValueAtTime(90, t);
        o.frequency.exponentialRampToValueAtTime(22, t + 0.35);
        g.gain.setValueAtTime(0.24 * amount, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
        o.start(t); o.stop(t + 0.48);
      }
    },

    _makeDistortionCurve(amount) {
      // standard waveshaper curve
      const n = 44100;
      const curve = new Float32Array(n);
      const k = typeof amount === "number" ? amount : 50;
      const deg = Math.PI / 180;
      for (let i = 0; i < n; i++) {
        const x = (i * 2) / n - 1;
        curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
      }
      return curve;
    }
  };

  /***********************
   * Scene stack
   ***********************/
  const SceneStack = {
    stack: [],
    push(scene){ this.stack.push(scene); scene.onEnter?.(); },
    pop(){ const s=this.stack.pop(); s?.onExit?.(); return s; },
    top(){ return this.stack[this.stack.length-1] || null; }
  };

  /***********************
   * Particles
   ***********************/
  class Particle {
    constructor(x, y, kind) {
      this.x = x; this.y = y;
      this.vx = rand(-90, 90);
      this.vy = rand(-160, 40);
      this.life = rand(0.18, 0.9);
      this.kind = kind; // blood|ash|spark
      this.s = rand(1, 3);
    }
    update(dt, g) {
      this.life -= dt;
      this.vy += g.world.gravity * dt * 0.55;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      if (this.y > g.world.groundY) {
        this.y = g.world.groundY;
        this.vx *= 0.35;
        this.vy *= -0.18;
      }
    }
    draw(ctx, cam) {
      const sx = (this.x - cam.x) | 0;
      const sy = (this.y - cam.y) | 0;
      if (this.kind === "blood") ctx.fillStyle = PAL.rust;
      else if (this.kind === "spark") ctx.fillStyle = PAL.paper;
      else ctx.fillStyle = "#3a3a44";
      ctx.fillRect(sx, sy, this.s, this.s);
    }
  }

  /***********************
   * World: asylum corridor chunks
   ***********************/
  class World {
    constructor() {
      this.gravity = 720;
      this.groundY = 170;
      this.cam = { x: 0, y: 0 };
      this.walls = [];     // obstacles (pillars, beds, carts)
      this.decor = [];     // background silhouettes
      this.thresholdX = 1100;
      this.length = 6000;
      this.reset();
    }

    reset() {
      this.cam.x = 0; this.cam.y = 0;
      this.walls.length = 0;
      this.decor.length = 0;

      // corridor props
      let x = 280;
      for (let i = 0; i < 260; i++) {
        if (chance(0.38)) {
          const h = randi(16, 60);
          const w = randi(20, 90);
          this.walls.push({ x, y: this.groundY - h, w, h, type: chance(0.5) ? "cart" : "pillar" });
        }
        if (chance(0.22)) {
          this.decor.push({ x: x + rand(-90, 90), type: chance(0.6) ? "bars" : "lamp", s: rand(0.7, 1.4) });
        }
        x += rand(70, 170);
      }
    }

    collide(body) {
      body.grounded = false;

      if (body.y + body.h >= this.groundY) {
        body.y = this.groundY - body.h;
        body.vy = 0;
        body.grounded = true;
      }

      for (const o of this.walls) {
        if (!aabb(body.x, body.y, body.w, body.h, o.x, o.y, o.w, o.h)) continue;

        const prevY = body.y - body.vy * (1/60);
        if (prevY + body.h <= o.y + 2) {
          body.y = o.y - body.h;
          body.vy = 0;
          body.grounded = true;
        } else {
          if (body.x + body.w/2 < o.x + o.w/2) body.x = o.x - body.w;
          else body.x = o.x + o.w;
          body.vx = 0;
        }
      }
    }

    draw(ctx, t) {
      // background
      ctx.fillStyle = PAL.bg;
      ctx.fillRect(0, 0, RW, RH);

      // far decor parallax
      for (const d of this.decor) {
        const sx = (d.x - this.cam.x * 0.5) | 0;
        if (sx < -120 || sx > RW + 120) continue;
        this.drawDecor(ctx, d, sx, t);
      }

      // corridor "ceiling" / wall tone
      ctx.globalAlpha = 0.65;
      ctx.fillStyle = PAL.wall;
      ctx.fillRect(0, 0, RW, this.groundY - 80);
      ctx.globalAlpha = 1;

      // floor
      ctx.fillStyle = PAL.floor;
      ctx.fillRect(0, this.groundY, RW, RH - this.groundY);

      // props / obstacles
      for (const o of this.walls) {
        const sx = (o.x - this.cam.x) | 0;
        if (sx + o.w < -60 || sx > RW + 60) continue;
        ctx.fillStyle = "#12121a";
        ctx.fillRect(sx, o.y, o.w, o.h);

        ctx.strokeStyle = "#0b0b10";
        ctx.strokeRect(sx + 0.5, o.y + 0.5, o.w - 1, o.h - 1);

        // detail: carts/pillars
        if (o.type === "cart") {
          ctx.fillStyle = "#0a0a10";
          ctx.fillRect(sx + 4, o.y + 4, o.w - 8, 3);
        } else {
          ctx.fillStyle = "#0a0a10";
          for (let i = 0; i < 3; i++) ctx.fillRect(sx + 3 + i*5, o.y + 3, 2, o.h - 6);
        }
      }

      // threshold glyph (wakes the asylum)
      const tx = (this.thresholdX - this.cam.x) | 0;
      if (tx > -40 && tx < RW + 40) {
        ctx.globalAlpha = 0.8;
        ctx.strokeStyle = PAL.accent;
        for (let i = 0; i < 7; i++) {
          const y0 = this.groundY - 92 + i * 14;
          ctx.beginPath();
          ctx.moveTo(tx, y0);
          ctx.lineTo(tx + (i % 2 ? 12 : -12), y0 + 10);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }

      // floating fog bands
      ctx.globalAlpha = 0.24;
      ctx.fillStyle = PAL.fog;
      for (let i = 0; i < 8; i++) {
        const yy = 10 + i * 18 + Math.sin(t * 0.85 + i + this.cam.x * 0.004) * 2;
        ctx.fillRect(0, yy, RW, 10);
      }
      ctx.globalAlpha = 1;
    }

    drawDecor(ctx, d, sx, t) {
      const y = this.groundY;
      ctx.lineWidth = 1;

      if (d.type === "bars") {
        ctx.globalAlpha = 0.55;
        ctx.strokeStyle = "#0b0b10";
        for (let i = 0; i < 7; i++) {
          const x = sx + i * 7;
          ctx.beginPath();
          ctx.moveTo(x, y - 120 * d.s);
          ctx.lineTo(x, y - 10);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      } else {
        // lamp: flicker
        const flick = 0.5 + 0.5 * Math.sin(t * 6 + sx * 0.02);
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = "#0b0b10";
        ctx.fillRect(sx, y - 130 * d.s, 8, 120 * d.s);
        ctx.globalAlpha = 0.10 + flick * 0.22;
        ctx.fillStyle = PAL.paper;
        ctx.fillRect(sx - 16, y - 130 * d.s, 40, 40);
        ctx.globalAlpha = 1;
      }
    }
  }

  /***********************
   * Entities
   ***********************/
  class Entity {
    constructor(x,y,w,h) {
      this.x=x; this.y=y; this.w=w; this.h=h;
      this.vx=0; this.vy=0;
      this.dead=false;
      this.grounded=false;
    }
    get cx(){ return this.x + this.w/2; }
    get cy(){ return this.y + this.h/2; }
  }

  class Bullet extends Entity {
    constructor(x,y,vx,vy,dmg, pierce, from) {
      super(x,y,4,4);
      this.vx=vx; this.vy=vy;
      this.dmg=dmg;
      this.pierce=pierce|0;
      this.from=from;
      this.life=1.2;
      this.hit=new Set();
    }
    update(dt, g) {
      this.life -= dt;
      if (this.life <= 0) { this.dead=true; return; }

      this.x += this.vx * dt;
      this.y += this.vy * dt;

      if (this.y > RH || this.y < -40) { this.dead=true; return; }
      if (this.y + this.h > g.world.groundY) { this.dead=true; g.fx(this.x,this.y,"spark",6); return; }

      for (const o of g.world.walls) {
        if (aabb(this.x,this.y,this.w,this.h, o.x,o.y,o.w,o.h)) {
          this.dead=true;
          g.fx(this.x,this.y,"spark",6);
          return;
        }
      }
    }
    draw(ctx, cam) {
      const sx=(this.x-
