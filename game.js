/* ASYLUM FOG // vanilla JS, HTML5 Canvas, GitHub Pages ready
   - Difficulty rebalanced: i-frames, knockback, lower contact dmg, capped spawns, adaptive easing
   - Atmosphere variation: Zones (palette/fog/noise/decor feel) throughout depth
   - Main loop bug fixed (no double-update)
*/
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
    zoneLabel: $("zoneLabel"),
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
  const hypot = (x, y) => Math.hypot(x, y);

  function aabb(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }
  function norm(x, y) {
    const l = Math.hypot(x, y) || 1;
    return [x / l, y / l];
  }

  /***********************
   * Input
   ***********************/
  const Input = {
    keys: new Set(),
    mouse: { nx: 0.5, ny: 0.5, down: false },
    confusionEnabled: false,
    confusionT: 0,

    down(code) { return this.keys.has(code); },
    consume(code) { if (this.down(code)) { this.keys.delete(code); return true; } return false; },

    axisX() {
      const raw = (this.down("KeyD") ? 1 : 0) - (this.down("KeyA") ? 1 : 0);
      if (this.confusionEnabled && this.confusionT > 0) return -raw;
      return raw;
    },
    jump() { return this.down("KeyW"); },
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
   * Palette
   ***********************/
  const PAL = {
    bg: "#050505",
    floor: "#09090d",
    wall: "#0f0f16",
    fog: "#0b0b12",
    light: "#eaeaf2",
    accent: "#7d3cff",
    danger: "#ff2a2a",
    sick: "#a2ffcf",
    rust: "#5a0b17",
    paper: "#f1f1ff",
  };

  /***********************
   * Assets + Sprites
   ***********************/
  class Assets {
    constructor() {
      this.images = new Map();
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
      await Promise.all(keys.map(k => this._loadOne(k, this.manifest[k])));
    }

    _loadOne(key, url) {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => { this.images.set(key, img); resolve(true); };
        img.onerror = () => resolve(false);
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

  class Sprite {
    constructor(img, frameW, frameH, frames, fps = 10) {
      this.img = img;
      this.fw = frameW;
      this.fh = frameH;
      this.frames = frames;
      this.fps = fps;
    }
    draw(ctx, x, y, t, flip = false, scale = 1, alpha = 1, frameOverride = null) {
      if (!this.img) return;
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
   * Procedural sprite sheets (fallback)
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
      ctx.fillRect((Math.random() * w) | 0, (Math.random() * h) | 0, 1, 1);
    }
  }

  function buildProceduralSprites() {
    makeSheet("player", 24, 36, 6, (x, i) => {
      x.clearRect(0,0,24,36);
      x.fillStyle = "#0a0a0f"; x.fillRect(6, 8, 12, 22);
      x.fillStyle = PAL.light; x.fillRect(7, 10, 10, 18);
      x.fillStyle = "#15151c"; x.fillRect(8, 6, 8, 6);
      x.fillStyle = PAL.accent; x.fillRect(14, 8, 2, 1);

      const step = Math.sin((i/6)*Math.PI*2);
      x.fillStyle = "#111118";
      x.fillRect(8 + (step>0?1:0), 28, 3, 6);
      x.fillRect(13 + (step<0?1:0), 28, 3, 6);

      x.fillStyle = "#5f5f6e";
      x.fillRect(16, 16, 7, 2);
      ditherDots(x, 24, 36, 0.035, "#0c0c12");
      ditherDots(x, 24, 36, 0.02, "#ffffff10");
    });

    makeSheet("angel", 28, 28, 6, (x, i) => {
      x.clearRect(0,0,28,28);
      const flap = Math.sin((i/6)*Math.PI*2);
      x.fillStyle = PAL.danger;
      x.fillRect(2, 10, 8, 4 + ((flap*3)|0));
      x.fillRect(18, 10, 8, 4 + ((-flap*3)|0));
      x.fillStyle = "#2a0b10";
      x.fillRect(10, 7, 8, 14);
      x.fillStyle = PAL.paper;
      x.fillRect(13, 12, 2, 1);
      ditherDots(x, 28, 28, 0.06, "#00000022");
    });

    makeSheet("nurse", 24, 34, 6, (x,i)=> {
      x.clearRect(0,0,24,34);
      const sway = Math.sin((i/6)*Math.PI*2);
      x.fillStyle = "#0c0c12"; x.fillRect(7, 7, 10, 24);
      x.fillStyle = "#dcdcea"; x.fillRect(8, 9, 8, 18);
      x.fillStyle = "#f1f1ff"; x.fillRect(9, 7, 6, 4);
      x.fillStyle = PAL.accent; x.fillRect(14, 9, 1, 1);
      x.fillStyle = "#6e6e80"; x.fillRect(3, 14 + ((sway*1)|0), 6, 2);
      ditherDots(x, 24, 34, 0.045, "#0b0b10");
    });

    makeSheet("patient", 24, 34, 6, (x,i)=> {
      x.clearRect(0,0,24,34);
      x.fillStyle = "#09090f"; x.fillRect(7, 7, 10, 24);
      x.fillStyle = "#b8b8c6"; x.fillRect(8, 10, 8, 14);
      x.fillStyle = "#000"; x.fillRect(9, 8, 6, 3);
      x.fillStyle = PAL.rust; x.fillRect(12, 16, 2, 2);
      const step = Math.sin((i/6)*Math.PI*2);
      x.fillStyle = "#101018";
      x.fillRect(8 + (step>0?1:0), 28, 3, 6);
      ditherDots(x, 24, 34, 0.05, "#00000022");
    });

    makeSheet("child", 22, 30, 4, (x,i)=> {
      x.clearRect(0,0,22,30);
      const bob = Math.sin((i/4)*Math.PI*2);
      x.fillStyle = PAL.sick;
      x.fillRect(9, 6 + ((bob*1)|0), 4, 4);
      x.beginPath();
      x.moveTo(11, 10); x.lineTo(18, 26); x.lineTo(4, 26);
      x.closePath(); x.fill();
      x.fillStyle = "#003a22";
      x.fillRect(9, 9, 1, 1); x.fillRect(12, 9, 1, 1);
      ditherDots(x, 22, 30, 0.03, "#ffffff10");
    });

    makeSheet("chest", 26, 18, 4, (x,i)=> {
      x.clearRect(0,0,26,18);
      const pulse = Math.sin((i/4)*Math.PI*2);
      x.fillStyle = "#0b0b11"; x.fillRect(3, 6, 20, 10);
      x.fillStyle = "#181820"; x.fillRect(4, 7, 18, 4);
      x.fillStyle = "#ffb24a"; x.fillRect(6, 11, 14, 2);
      x.fillStyle = "#2a2a3a"; x.fillRect(12, 10, 2, 3);
      x.globalAlpha = 0.3 + pulse*0.2;
      x.fillStyle = "#ffb24a"; x.fillRect(18, 6, 2, 2);
      x.globalAlpha = 1;
      ditherDots(x, 26, 18, 0.06, "#00000022");
    });

    makeSheet("note", 14, 12, 2, (x,i)=> {
      x.clearRect(0,0,14,12);
      x.fillStyle = PAL.paper; x.fillRect(1,1,12,10);
      x.fillStyle = "#2a2a3a"; x.fillRect(10,2,2,2);
      ditherDots(x, 14, 12, 0.08, "#00000014");
    });

    makeSheet("boss1", 64, 64, 6, (x,i)=> {
      x.clearRect(0,0,64,64);
      const r = 10 + Math.sin((i/6)*Math.PI*2)*2;
      x.fillStyle = "#0d0d16"; x.fillRect(16, 12, 32, 44);
      x.strokeStyle = PAL.accent;
      x.beginPath();
      for(let k=0;k<10;k++){
        const a = k*(Math.PI*2/10) + i*0.25;
        const cx=32, cy=20;
        x.moveTo(cx,cy);
        x.lineTo(cx+Math.cos(a)*(14+r), cy+Math.sin(a)*10);
      }
      x.stroke();
      x.fillStyle = PAL.danger; x.fillRect(30, 28, 4, 10);
      ditherDots(x, 64, 64, 0.06, "#00000022");
    });

    makeSheet("boss2", 72, 56, 6, (x,i)=> {
      x.clearRect(0,0,72,56);
      const wob = Math.sin((i/6)*Math.PI*2);
      x.fillStyle = "#0b0b12"; x.fillRect(14, 10, 44, 30);
      x.fillStyle = PAL.accent; x.fillRect(34, 22, 4, 4);
      x.fillStyle = PAL.danger;
      x.fillRect(18, 16, 6, 6); x.fillRect(48, 16, 6, 6);
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
   * Procedural Audio
   ***********************/
  const AudioSys = {
    ctx: null,
    master: null,
    started: false,
    droneGain: null,
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

      this.filter = this.ctx.createBiquadFilter();
      this.filter.type = "lowpass";
      this.filter.frequency.value = 380;
      this.filter.Q.value = 0.9;
      this.filter.connect(this.master);

      this.crunch = this.ctx.createWaveShaper();
      this.crunch.curve = this._makeDistortionCurve(220);
      this.crunch.oversample = "4x";
      this.crunch.connect(this.filter);

      // Drone
      const o1 = this.ctx.createOscillator();
      const o2 = this.ctx.createOscillator();
      o1.type = "sawtooth"; o2.type = "triangle";
      o1.frequency.value = 44; o2.frequency.value = 56;
      o2.detune.value = -17;

      this.droneGain = this.ctx.createGain();
      this.droneGain.gain.value = 0.09;
      o1.connect(this.droneGain);
      o2.connect(this.droneGain);
      this.droneGain.connect(this.crunch);

      // Noise
      const nlen = 2 * this.ctx.sampleRate;
      const bufN = this.ctx.createBuffer(1, nlen, this.ctx.sampleRate);
      const data = bufN.getChannelData(0);
      for (let i = 0; i < nlen; i++) data[i] = (Math.random() * 2 - 1) * (0.75 + 0.25 * Math.random());
      const noise = this.ctx.createBufferSource();
      noise.buffer = bufN; noise.loop = true;

      this.noiseGain = this.ctx.createGain();
      this.noiseGain.gain.value = 0.02;

      const hp = this.ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 160;
      noise.connect(hp);
      hp.connect(this.noiseGain);
      this.noiseGain.connect(this.crunch);

      // Siren
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = "sine";
      this.sirenOsc.frequency.value = 480;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0.0001;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.filter);

      o1.start(); o2.start(); noise.start(); this.sirenOsc.start();
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

      this.filter.frequency.setTargetAtTime(260 + i * 2200, t, 0.12);
      this.noiseGain.gain.setTargetAtTime(0.01 + i * (this.hardMode ? 0.22 : 0.14), t, 0.12);
      this.droneGain.gain.setTargetAtTime(0.06 + i * 0.12, t, 0.12);

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
        g.gain.setValueAtTime(0.10 * amount, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.10);
        o.start(t); o.stop(t + 0.11);
      } else if (kind === "hit") {
        o.type = "sawtooth";
        o.frequency.setValueAtTime(110, t);
        o.frequency.exponentialRampToValueAtTime(14, t + 0.22);
        g.gain.setValueAtTime(0.16 * amount, t);
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
        g.gain.setValueAtTime(0.22 * amount, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
        o.start(t); o.stop(t + 0.48);
      }
    },

    _makeDistortionCurve(amount) {
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
   * Atmosphere Zones
   ***********************/
  class AtmosphereManager {
    constructor(){
      this.zoneIndex = 0;
      this.transitionT = 0;
      this.zones = [
        { depth:   0, name:"INTAKE",   tint:"#2a2a33", fog:1.05, noise:1.00, whisper:"The intake corridor smells like wet paper." },
        { depth: 180, name:"WARD A",   tint:"#1c2430", fog:1.20, noise:1.10, whisper:"Beds behind walls. Sheets move without wind." },
        { depth: 420, name:"SURGERY",  tint:"#2b1020", fog:1.12, noise:1.25, whisper:"The lights are too clean. That’s how you know it’s wrong." },
        { depth: 700, name:"BASEMENT", tint:"#0b1d16", fog:1.35, noise:1.35, whisper:"Water drips in patterns that resemble names." },
        { depth: 980, name:"CHAPEL",   tint:"#2a1b0a", fog:1.10, noise:1.45, whisper:"Something here wants witness, not worship." },
      ];
      this.zone = this.zones[0];
    }

    update(dt, g){
      const d = Math.floor(g.player.x / 10);
      let idx = this.zoneIndex;
      while (idx+1 < this.zones.length && d >= this.zones[idx+1].depth) idx++;
      if (idx !== this.zoneIndex) {
        this.zoneIndex = idx;
        this.zone = this.zones[idx];
        this.transitionT = 2.2;
        g.whisper(`[ZONE: ${this.zone.name}] ${this.zone.whisper}`, 2.8);
        AudioSys.ping("thump", 0.8);
      }
      this.transitionT = Math.max(0, this.transitionT - dt);
    }

    get fogMult(){ return this.zone.fog; }
    get noiseMult(){ return this.zone.noise; }
    get tint(){ return this.zone.tint; }
    get name(){ return this.zone.name; }
  }

  /***********************
   * Particles
   ***********************/
  class Particle {
    constructor(x, y, kind) {
      this.x = x; this.y = y;
      this.vx = rand(-90, 90);
      this.vy = rand(-160, 40);
      this.life = rand(0.18, 0.9);
      this.kind = kind;
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
   * World
   ***********************/
  class World {
    constructor() {
      this.gravity = 720;
      this.groundY = 170;
      this.cam = { x: 0, y: 0 };
      this.walls = [];
      this.decor = [];
      this.thresholdX = 1100;
      this.reset();
    }

    reset() {
      this.cam.x = 0; this.cam.y = 0;
      this.walls.length = 0;
      this.decor.length = 0;

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

    draw(ctx, t, atmo) {
      ctx.fillStyle = PAL.bg;
      ctx.fillRect(0, 0, RW, RH);

      // parallax decor
      for (const d of this.decor) {
        const sx = (d.x - this.cam.x * 0.5) | 0;
        if (sx < -120 || sx > RW + 120) continue;
        this.drawDecor(ctx, d, sx, t);
      }

      ctx.globalAlpha = 0.65;
      ctx.fillStyle = PAL.wall;
      ctx.fillRect(0, 0, RW, this.groundY - 80);
      ctx.globalAlpha = 1;

      ctx.fillStyle = PAL.floor;
      ctx.fillRect(0, this.groundY, RW, RH - this.groundY);

      // obstacles
      for (const o of this.walls) {
        const sx = (o.x - this.cam.x) | 0;
        if (sx + o.w < -60 || sx > RW + 60) continue;
        ctx.fillStyle = "#12121a";
        ctx.fillRect(sx, o.y, o.w, o.h);
        ctx.strokeStyle = "#0b0b10";
        ctx.strokeRect(sx + 0.5, o.y + 0.5, o.w - 1, o.h - 1);

        if (o.type === "cart") {
          ctx.fillStyle = "#0a0a10";
          ctx.fillRect(sx + 4, o.y + 4, o.w - 8, 3);
        } else {
          ctx.fillStyle = "#0a0a10";
          for (let i = 0; i < 3; i++) ctx.fillRect(sx + 3 + i*5, o.y + 3, 2, o.h - 6);
        }
      }

      // threshold glyph
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

      // zone tint wash
      if (atmo) {
        ctx.globalAlpha = 0.08 + (atmo.transitionT > 0 ? 0.06 : 0);
        ctx.fillStyle = atmo.tint;
        ctx.fillRect(0, 0, RW, RH);
        ctx.globalAlpha = 1;

        // zone-specific micro-details
        if (atmo.name === "SURGERY") {
          const flick = 0.05 + 0.05 * Math.sin(t * 9);
          ctx.globalAlpha = flick;
          ctx.fillStyle = "#fff";
          ctx.fillRect(0, 0, RW, 14);
          ctx.globalAlpha = 1;
        } else if (atmo.name === "BASEMENT") {
          ctx.globalAlpha = 0.12;
          ctx.fillStyle = "#0a0f0c";
          for (let i=0;i<10;i++){
            const x = (Math.sin(t*0.7+i)*0.5+0.5)*RW;
            ctx.fillRect(x|0, 0, 1, RH);
          }
          ctx.globalAlpha = 1;
        } else if (atmo.name === "CHAPEL") {
          ctx.globalAlpha = 0.09;
          ctx.strokeStyle = "#111";
          for (let i=0;i<4;i++){
            const x = 60 + i*80;
            ctx.beginPath();
            ctx.moveTo(x, 10); ctx.lineTo(x, 90);
            ctx.moveTo(x-8, 40); ctx.lineTo(x+8, 40);
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
        }
      }

      // fog bands
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
      const sx=(this.x-cam.x)|0, sy=(this.y-cam.y)|0;
      ctx.fillStyle="#ffe66a";
      ctx.fillRect(sx,sy,2,2);
      ctx.fillStyle="#fff";
      ctx.fillRect(sx+1,sy+1,1,1);
    }
  }

  class Player extends Entity {
    constructor(name, avi) {
      super(200, 0, 16, 32);
      this.name = name;
      this.avi = avi|0;

      this.hpMax=110; this.hp=110;
      this.sanMax=110; this.san=110;

      if (this.avi===1){ this.sanMax=150; this.san=150; }
      if (this.avi===2){ this.hpMax=180; this.hp=180; }

      this.facing=1;
      this.cool=0;
      this.hurtT=0;

      // NEW: survivability
      this.invulnT = 0;
      this.kbVx = 0;

      this.weaponIndex = 0;
      this.weapons = this._buildWeapons();
      this.weapon = this.weapons[this.weaponIndex];

      this.lantern=180;
      this.killCount=0;

      this.trust = 0;
      this.morality = 0;

      this.status = { jamT: 0, shiverT: 0 };
      this.animT = 0;
    }

    _buildWeapons() {
      if (this.avi===0) {
        return [
          {name:"RIFLE", rate:0.11, bullets:1, spread:0.02, pierce:0, dmg:12},
          {name:"CUTTER", rate:0.23, bullets:1, spread:0.00, pierce:0, dmg:20, melee:true},
          {name:"LANTERN-BOLT", rate:0.18, bullets:1, spread:0.04, pierce:1, dmg:9, sanityCost:1.0},
        ];
      }
      if (this.avi===1) {
        return [
          {name:"NEEDLE", rate:0.15, bullets:1, spread:0.01, pierce:2, dmg:9},
          {name:"SIGIL SHARD", rate:0.20, bullets:2, spread:0.12, pierce:0, dmg:7, sanityCost:0.7},
          {name:"SILENCE", rate:0.55, bullets:1, spread:0.00, pierce:0, dmg:1, special:"stun"},
        ];
      }
      return [
        {name:"SCATTER", rate:0.26, bullets:5, spread:0.20, pierce:0, dmg:7},
        {name:"HAMMER", rate:0.40, bullets:1, spread:0.00, pierce:0, dmg:28, melee:true},
        {name:"BOLT-CAGE", rate:0.22, bullets:1, spread:0.06, pierce:0, dmg:12},
      ];
    }

    switchWeapon(idx){
      this.weaponIndex = clamp(idx, 0, this.weapons.length-1);
      this.weapon = this.weapons[this.weaponIndex];
    }

    hurt(dmg, fromX = null){
      if (this.invulnT > 0) return;
      this.invulnT = 0.55; // i-frames
      this.hp = clamp(this.hp - dmg, 0, this.hpMax);
      this.san = clamp(this.san - dmg*0.20, 0, this.sanMax); // less sanity bleed
      this.hurtT = 0.22;

      if (fromX !== null) {
        const dir = (this.cx < fromX) ? -1 : 1;
        this.kbVx = dir * 240;
        this.vy = Math.min(this.vy, -120);
      }
    }

    heal(a){ this.hp = clamp(this.hp + a, 0, this.hpMax); }
    soothe(a){ this.san = clamp(this.san + a, 0, this.sanMax); }

    update(dt, g) {
      this.animT += dt;
      this.cool = Math.max(0, this.cool - dt);
      this.hurtT = Math.max(0, this.hurtT - dt);
      this.status.jamT = Math.max(0, this.status.jamT - dt);
      this.status.shiverT = Math.max(0, this.status.shiverT - dt);

      this.invulnT = Math.max(0, this.invulnT - dt);
      this.kbVx = lerp(this.kbVx, 0, 1 - Math.pow(0.001, dt));

      if (Input.consume("Digit1")) this.switchWeapon(0);
      if (Input.consume("Digit2")) this.switchWeapon(1);
      if (Input.consume("Digit3")) this.switchWeapon(2);

      const dir = Input.axisX();
      this.vx = dir * 190 + this.kbVx;
      if (dir !== 0) this.facing = dir > 0 ? 1 : -1;

      if (Input.jump() && this.grounded) {
        this.vy = -470;
        this.grounded = false;
        AudioSys.ping("thump", 0.6);
      }

      this.vy += g.world.gravity * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      g.world.collide(this);

      if (this.x < g.world.cam.x) this.x = g.world.cam.x;

      // sanity decay softened, also calmer in ATMOSPHERE zones
      const modeMul = (g.tension.mode === "frenetic") ? 1.0 : (g.tension.mode === "boss" ? 1.2 : 0.55);
      this.san = clamp(this.san - dt * (0.55 * modeMul), 0, this.sanMax);

      this.lantern = 70 + (this.san / this.sanMax) * 250;

      const mx = Input.mouse.nx * RW + g.world.cam.x;
      const my = Input.mouse.ny * RH;

      const drift = (1 - this.san / this.sanMax) * 14 + (this.status.shiverT>0 ? 10 : 0);
      const ax = mx + rand(-drift, drift);
      const ay = my + rand(-drift, drift);

      if (Input.mouse.down && this.cool <= 0) {
        const jamMul = (this.status.jamT > 0) ? 1.8 : 1.0;
        this.cool = this.weapon.rate * jamMul;
        g.shoot(this, ax, ay);
      }
    }

    draw(ctx, g) {
      const cam = g.world.cam;
      const sx = (this.x - cam.x) | 0;
      const sy = (this.y - cam.y) | 0;

      const img = assets.get("player");
      const sprite = new Sprite(img, 24, 36, 6, 10);

      const moving = Math.abs(this.vx) > 5;
      const frame = moving ? null : 0;

      sprite.draw(ctx, sx-4, sy-4, this.animT, this.facing < 0, 1, 1, frame);

      // invuln shimmer
      if (this.invulnT > 0) {
        ctx.globalAlpha = 0.14;
        ctx.fillStyle = "#fff";
        ctx.fillRect(sx-2, sy-2, 20, 34);
        ctx.globalAlpha = 1;
      }
    }
  }

  class EnemyAngel extends Entity {
    constructor(x,y, type="fly") {
      super(x,y, 18, 18);
      this.type = type;

      // REBALANCED
      this.hp = type==="fly" ? 18 : 34;
      this.touch = type==="fly" ? 6 : 9;

      this.cool = rand(0.2, 0.9);
      this.animT = rand(0, 10);
      this.trait = chance(0.5) ? "stare" : "mimic";
      this.stareT = 0;
    }

    update(dt, g) {
      this.animT += dt;
      const p = g.player;
      this.cool = Math.max(0, this.cool - dt);

      const dx = p.cx - this.cx;
      const dy = p.cy - this.cy;

      if (this.type === "fly") {
        if (this.trait==="stare") {
          this.stareT -= dt;
          if (this.stareT <= 0 && chance(0.010)) this.stareT = rand(0.5, 1.0);
        }
        if (this.stareT > 0) {
          this.vx *= 0.90; this.vy *= 0.90;
        } else {
          const [nx, ny] = norm(dx, dy + Math.sin(g.time*2 + this.x*0.01)*10);
          const sp = 85 + g.tension.heat*35;
          this.vx = nx * sp;
          this.vy = ny * sp;
        }
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.y = Math.min(this.y, g.world.groundY - 40);
      } else {
        const dir = dx>0?1:-1;
        this.vx = dir * (70 + g.tension.heat*45);
        this.vy += g.world.gravity * dt;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        g.world.collide(this);

        if (this.grounded && chance(0.018) && this.cool<=0) {
          this.vy = -rand(240, 330);
          this.cool = rand(0.7, 1.2);
        }
      }

      // contact (with cooldown + player i-frames)
      if (aabb(this.x,this.y,this.w,this.h, p.x,p.y,p.w,p.h) && this.cool<=0) {
        p.hurt(this.touch, this.cx);
        this.cool = 0.95;
        g.fx(p.cx,p.cy,"blood",10);
        AudioSys.ping("hit", 0.7);
      }

      if (this.x < g.world.cam.x - 240) this.dead=true;
    }

    hit(dmg, g) {
      this.hp -= dmg;
      g.fx(this.cx,this.cy,"blood",8);
      if (this.hp <= 0) {
        this.dead=true;
        g.fx(this.cx,this.cy,"ash",14);
        g.player.killCount++;

        // small sustain reward: makes runs survivable
        if (chance(0.30)) g.player.soothe(3);
        if (chance(0.18)) g.player.heal(2);
      }
    }

    draw(ctx, g) {
      const cam = g.world.cam;
      const sx = (this.x - cam.x) | 0;
      const sy = (this.y - cam.y) | 0;
      const img = assets.get("angel");
      const sprite = new Sprite(img, 28, 28, 6, 12);
      sprite.draw(ctx, sx-5, sy-6, this.animT, false, 1, 1);

      ctx.globalAlpha = 0.08;
      ctx.fillStyle = PAL.danger;
      ctx.fillRect(sx-8, sy-8, 30, 30);
      ctx.globalAlpha = 1;
    }
  }

  class AmbiguousNPC extends Entity {
    constructor(x, kind="nurse") {
      super(x, 0, 16, 30);
      this.kind = kind;
      this.animT = rand(0,10);
      this.vx = rand(-30,30);
      this.timer = rand(0.6, 1.6);
      this.hostile = false;
      this.dead = false;
      this.hp = 50;
      this.cool = rand(0.2, 0.9);
    }

    update(dt, g) {
      this.animT += dt;
      this.timer -= dt;
      this.cool = Math.max(0, this.cool - dt);

      if (this.timer <= 0) {
        this.vx = rand(-40,40);
        this.timer = rand(0.9,2.2);
        if (chance(0.35)) this.vx *= 0.2;
      }
      if (this.hostile) {
        const dir = Math.sign(g.player.cx - this.cx);
        this.vx = dir * (60 + g.tension.heat*20);
      }

      this.vy += g.world.gravity * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      g.world.collide(this);

      if (this.hostile && aabb(this.x,this.y,this.w,this.h, g.player.x,g.player.y,g.player.w,g.player.h) && this.cool<=0) {
        g.player.hurt(10, this.cx);
        this.cool = 1.0;
        g.fx(g.player.cx,g.player.cy,"blood",10);
        AudioSys.ping("hit", 0.7);
      }

      if (this.x < g.world.cam.x - 140) this.x = g.world.cam.x - 140;
    }

    hit(dmg, g) {
      this.hp -= dmg;
      g.fx(this.cx,this.cy,"blood",10);
      if (this.hp <= 0) this.dead = true;
    }

    draw(ctx, g) {
      const cam = g.world.cam;
      const sx = (this.x - cam.x) | 0;
      const sy = (this.y - cam.y) | 0;

      const key = this.kind === "nurse" ? "nurse" : "patient";
      const img = assets.get(key);
      const sprite = new Sprite(img, 24, 34, 6, 9);
      sprite.draw(ctx, sx-4, sy-4, this.animT, this.vx < 0, 1, 1);

      if (this.hostile) {
        ctx.globalAlpha = 0.06;
        ctx.fillStyle = PAL.danger;
        ctx.fillRect(sx-8, sy-8, 28, 40);
        ctx.globalAlpha = 1;
      }
    }
  }

  class Patient07 extends Entity {
    constructor(x) {
      super(x, 0, 14, 24);
      this.animT = rand(0,10);
      this.vx = rand(-35,35);
      this.timer = rand(0.8, 2.0);
      this.state = "wander";
      this.cowerT = 0;
    }
    update(dt, g) {
      this.animT += dt;
      this.timer -= dt;

      if (this.state === "cower") {
        this.vx = 0;
        this.cowerT -= dt;
        if (this.cowerT <= 0) this.state = "wander";
      } else {
        if (this.timer <= 0) {
          this.vx = rand(-40,40);
          this.timer = rand(1.0, 2.3);
        }
        for (const b of g.bullets) {
          if (hypot(b.x - this.x, b.y - this.y) < 80) {
            this.state="cower";
            this.cowerT = 1.2;
            break;
          }
        }
      }

      this.vy += g.world.gravity * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      g.world.collide(this);

      const left = g.world.cam.x + 12;
      const right = g.world.cam.x + RW - 32;
      if (this.x < left) this.vx = Math.abs(this.vx)+6;
      if (this.x > right) this.vx = -Math.abs(this.vx)-6;
    }
    draw(ctx, g) {
      const cam = g.world.cam;
      const sx=(this.x-cam.x)|0, sy=(this.y-cam.y)|0;
      const img = assets.get("child");
      const sprite = new Sprite(img, 22, 30, 4, 6);
      sprite.draw(ctx, sx-4, sy-6, this.animT, false, 1, 1);

      ctx.globalAlpha = 0.12;
      ctx.fillStyle = PAL.sick;
      ctx.fillRect(sx-10, sy-12, 34, 40);
      ctx.globalAlpha = 1;
    }
  }

  class NoteItem extends Entity {
    constructor(x, id) {
      super(x, 0, 10, 8);
      this.id = id;
      this.bob = rand(0,6.28);
    }
    update(dt, g) {
      this.bob += dt*2.2;
      this.y = g.world.groundY - 14 + Math.sin(this.bob)*2;
    }
    draw(ctx, g) {
      const cam = g.world.cam;
      const sx=(this.x-cam.x)|0, sy=(this.y-cam.y)|0;
      const img = assets.get("note");
      const sprite = new Sprite(img, 14, 12, 2, 2);
      sprite.draw(ctx, sx-2, sy-2, this.bob, false, 1, 1);
    }
  }

  class Chest extends Entity {
    constructor(x) {
      super(x, 0, 18, 14);
      this.opened=false;
      this.bob = rand(0,6.28);
    }
    update(dt, g) {
      this.bob += dt*2.0;
      this.y = g.world.groundY - 20 + Math.sin(this.bob)*1.8;
    }
    draw(ctx, g) {
      const cam = g.world.cam;
      const sx=(this.x-cam.x)|0, sy=(this.y-cam.y)|0;
      const img = assets.get("chest");
      const sprite = new Sprite(img, 26, 18, 4, 6);
      sprite.draw(ctx, sx-4, sy-4, this.bob, false, 1, 1, this.opened?2:null);
    }
  }

  /***********************
   * Bosses (kept, but player survivability improved by i-frames + lower bullet dmg)
   ***********************/
  class BossBase extends Entity {
    constructor(x,y,w,h) {
      super(x,y,w,h);
      this.maxHp=500;
      this.hp=500;
      this.phase=0;
      this.name="BOSS";
      this.cool=0.8;
      this.animT=0;
    }
    hit(dmg, g) {
      this.hp -= dmg;
      g.fx(this.cx,this.cy,"blood",12);
      if (this.hp <= 0) {
        this.dead = true;
        g.fx(this.cx,this.cy,"ash",48);
        AudioSys.ping("boss", 1.0);
      }
    }
  }

  class BossClinician extends BossBase {
    constructor(x, g) {
      super(x, g.world.groundY - 72, 38, 72);
      this.name = "SERAPH-CLINICIAN";
      this.maxHp = 520;
      this.hp = 520;
      this.lines = [];
    }
    update(dt, g) {
      this.animT += dt;
      this.cool = Math.max(0, this.cool - dt);

      const dx = g.player.cx - this.cx;
      this.vx = Math.sign(dx) * (35 + g.tension.heat*18);

      this.vy += g.world.gravity * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      g.world.collide(this);

      this.phase = (this.hp < this.maxHp*0.55) ? 1 : 0;

      if (this.cool <= 0) {
        this.cool = this.phase ? 1.25 : 1.65;

        const x0 = this.cx;
        const y0 = this.y + 18;
        const x1 = g.player.cx + rand(-30, 30);
        const y1 = g.player.cy + rand(-14, 14);
        this.lines.push({x0,y0,x1,y1,t: this.phase ? 1.05 : 0.90});
        AudioSys.ping("boss", 0.7);

        if (this.phase && chance(0.45)) {
          g.spawnBossBurst(this.cx, this.cy, g.player.cx, g.player.cy, 3, 0.14, 250, 7);
        }
      }

      for (const L of this.lines) {
        L.t -= dt;
        if (L.t > 0) {
          // small zone hazard, not instant death
          const d = pointLineDistance(g.player.cx, g.player.cy, L.x0, L.y0, L.x1, L.y1);
          if (d < 8 && chance(0.18)) g.player.hurt(1, this.cx);
        }
      }
      this.lines = this.lines.filter(L => L.t > 0);
    }
    draw(ctx, g) {
      const cam = g.world.cam;
      const sx=(this.x-cam.x)|0, sy=(this.y-cam.y)|0;
      const img = assets.get("boss1");
      const sprite = new Sprite(img, 64, 64, 6, 6);
      sprite.draw(ctx, sx-14, sy-10, this.animT, false, 1, 1);

      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = PAL.accent;
      for (const L of this.lines) {
        ctx.beginPath();
        ctx.moveTo((L.x0-cam.x)|0, (L.y0-cam.y)|0);
        ctx.lineTo((L.x1-cam.x)|0, (L.y1-cam.y)|0);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }

  class BossChoir extends BossBase {
    constructor(x, g) {
      super(x, g.world.groundY - 120, 54, 44);
      this.name = "CHOIR-ENGINE";
      this.maxHp = 450;
      this.hp = 450;
      this.wob = rand(0,6.28);
    }
    update(dt, g) {
      this.animT += dt;
      this.cool = Math.max(0, this.cool - dt);

      const dx = g.player.cx - this.cx;
      this.x += Math.sign(dx) * (60 + g.tension.heat*30) * dt;
      this.y = (g.world.groundY - 120) + Math.sin(g.time*2 + this.wob)*12;

      this.phase = (this.hp < this.maxHp*0.55) ? 1 : 0;

      if (this.cool <= 0) {
        this.cool = this.phase ? 0.65 : 0.95;
        const mx = Input.mouse.nx * RW + g.world.cam.x;
        const my = Input.mouse.ny * RH;
        g.spawnBossBurst(this.cx, this.cy, mx, my, this.phase?4:3, this.phase?0.11:0.14, 270, 7);

        if (this.phase && chance(0.35)) {
          g.enemies.push(new EnemyAngel(g.world.cam.x + RW + 40, g.world.groundY - randi(70,120), "fly"));
        }
        AudioSys.ping("boss", 0.6);
      }
    }
    draw(ctx, g) {
      const cam = g.world.cam;
      const sx=(this.x-cam.x)|0, sy=(this.y-cam.y)|0;
      const img = assets.get("boss2");
      const sprite = new Sprite(img, 72, 56, 6, 7);
      sprite.draw(ctx, sx-14, sy-10, this.animT, false, 1, 1);
    }
  }

  function pointLineDistance(px,py, x0,y0, x1,y1) {
    const A = px - x0, B = py - y0;
    const C = x1 - x0, D = y1 - y0;
    const dot = A*C + B*D;
    const lenSq = C*C + D*D || 1;
    let t = dot / lenSq;
    t = clamp(t, 0, 1);
    const xx = x0 + t*C;
    const yy = y0 + t*D;
    return Math.hypot(px-xx, py-yy);
  }

  /***********************
   * Tension + Visual FX
   ***********************/
  class Tension {
    constructor() {
      this.mode="atmosphere";
      this.heat=0;
      this.spawnT=0;
      this.depth=0;
      this.bossIndex=0;
    }
    update(dt, g) {
      this.depth = Math.floor(g.player.x/10);
      const target = (this.mode==="frenetic" || this.mode==="boss") ? 1 : 0;
      this.heat = lerp(this.heat, target, 1 - Math.pow(0.0009, dt));

      if (this.mode==="atmosphere") {
        if (g.player.x > g.world.thresholdX || g.flags.readNotes > 0 || g.flags.openedChests > 0 || g.flags.dilemmas > 0) {
          this.mode="frenetic";
          this.spawnT = 0.35;
          g.whisper("THE ASYLUM REMEMBERS YOU.", 2.2);
          AudioSys.ping("thump", 1.0);
        }
      }

      if (!g.boss && this.mode!=="boss") {
        const wantBoss =
          (this.bossIndex===0 && this.depth > 260) ||
          (this.bossIndex===1 && this.depth > 620);
        if (wantBoss) {
          this.mode="boss";
          g.startBoss(this.bossIndex);
          this.bossIndex++;
          return;
        }
      }

      if (this.mode==="frenetic" && !g.boss) {
        this.spawnT -= dt;
        if (this.spawnT <= 0) {
          const diff = g.difficulty();
          this.spawnT = rand(diff.spawnEvery * 0.75, diff.spawnEvery * 1.25);
          g.spawnWave();
        }
      }
    }
  }

  class VisualFX {
    constructor() {
      this.noise=0.18;
      this.scan=0.12;
      this.vign=0.55;

      this.faceFlashT=0;
      this.faceAlpha=0;
      this.faceKey="face1";
      this.allowFaces=true;

      this.glitchKick=0;
    }

    update(dt, g) {
      const sanity = g.player ? (g.player.san / g.player.sanMax) : 1;
      const heat = g.tension.heat;
      const stress = clamp((1-sanity)*0.95 + heat*0.65 + (g.boss?0.35:0), 0, 1);

      const zoneNoise = g.atmo ? g.atmo.noiseMult : 1.0;
      this.noise = lerp(this.noise, (0.10 + stress*0.65) * zoneNoise, 1 - Math.pow(0.001, dt));
      this.scan  = lerp(this.scan,  0.06 + stress*0.33, 1 - Math.pow(0.001, dt));
      this.vign  = lerp(this.vign,  0.30 + stress*0.72, 1 - Math.pow(0.001, dt));

      if (this.allowFaces && g.state==="play") {
        const pEvent = 0.001 + (1-sanity)*0.012 + heat*0.004 + (g.boss?0.006:0);
        if (chance(pEvent * dt * 60)) {
          this.faceFlashT = rand(0.7, 1.8);
          this.faceAlpha = rand(0.16, 0.34);
          this.faceKey = chance(0.5) ? "face1" : "face2";
          this.glitchKick = 0.25;
          g.whisper("A FACE THAT ISN'T YOURS BLINKS.", 1.8);
        }
      }

      this.faceFlashT = Math.max(0, this.faceFlashT - dt);
      if (this.faceFlashT <= 0) this.faceAlpha = lerp(this.faceAlpha, 0, 1 - Math.pow(0.0001, dt));
      this.glitchKick = Math.max(0, this.glitchKick - dt);
    }

    post(ctx, g) {
      const w = ctx.canvas.width, h = ctx.canvas.height;

      if (this.glitchKick > 0) {
        const k = this.glitchKick;
        const dx = (Math.sin(g.time*40)*2)*k;
        const dy = (Math.cos(g.time*27)*1)*k;
        ctx.globalAlpha = 0.7;
        ctx.drawImage(ctx.canvas, dx, dy);
        ctx.globalAlpha = 1;
      }

      // scanlines
      ctx.globalAlpha = this.scan;
      ctx.fillStyle = "#000";
      for (let y = 0; y < h; y += 2) ctx.fillRect(0, y, w, 1);
      ctx.globalAlpha = 1;

      // noise
      const dots = Math.floor(w*h*(0.008 + this.noise*0.055));
      ctx.globalAlpha = 0.10 + this.noise*0.22;
      ctx.fillStyle = "#fff";
      for (let i=0;i<dots;i++){
        ctx.fillRect((Math.random()*w)|0, (Math.random()*h)|0, 1, 1);
      }
      ctx.globalAlpha = 1;

      // vignette
      ctx.globalAlpha = 0.10 + this.vign*0.18;
      ctx.fillStyle = "#000";
      const b = 10;
      ctx.fillRect(0,0,w,b); ctx.fillRect(0,h-b,w,b);
      ctx.fillRect(0,0,b,h); ctx.fillRect(w-b,0,b,h);
      ctx.globalAlpha = 1;

      // sanity tint
      const sanity = g.player ? (g.player.san/g.player.sanMax) : 1;
      const wash = clamp(1-sanity, 0, 1);
      if (wash > 0.02) {
        ctx.globalAlpha = wash * 0.10;
        ctx.fillStyle = PAL.accent;
        ctx.fillRect(0,0,w,h);
        ctx.globalAlpha = 1;
      }

      // face overlay
      if (this.faceAlpha > 0.01) {
        const img = assets.get(this.faceKey);
        ctx.save();
        ctx.globalAlpha = this.faceAlpha;
        if (img) {
          const ox = (Math.sin(g.time*2)*6)|0;
          const oy = (Math.cos(g.time*1.7)*5)|0;
          ctx.globalCompositeOperation = "screen";
          ctx.drawImage(img, -12+ox, -12+oy, w+24, h+24);
          ctx.globalCompositeOperation = "source-over";
        }
        ctx.restore();
      }
    }
  }

  /***********************
   * Dialogue (minimal)
   ***********************/
  class DialogueScene {
    constructor(config) {
      this.pausesGame = true;
      this.cfg = config;
    }
    onEnter() {
      UI.dialogue.classList.remove("hidden");
      UI.dlgTitle.textContent = this.cfg.title;
      UI.dlgSub.textContent = this.cfg.sub || "";
      UI.dlgBody.textContent = this.cfg.body;

      UI.dlgChoices.innerHTML = "";
      this.cfg.choices.forEach((ch, idx) => {
        const b = document.createElement("button");
        b.className = "choiceBtn";
        b.innerHTML = `<b>${idx+1}) ${escapeHtml(ch.label)}</b><small>${escapeHtml(ch.hint || "")}</small>`;
        b.addEventListener("click", () => this.pick(idx));
        UI.dlgChoices.appendChild(b);
      });
    }
    onExit() {
      UI.dialogue.classList.add("hidden");
      UI.dlgChoices.innerHTML = "";
    }
    pick(idx) {
      const ch = this.cfg.choices[idx];
      if (!ch) return;
      ch.onPick?.();
      SceneStack.pop();
    }
    update() {
      if (Input.consume("Digit1")) this.pick(0);
      if (Input.consume("Digit2")) this.pick(1);
      if (Input.consume("Digit3")) this.pick(2);
      if (Input.consume("Digit4")) this.pick(3);
    }
  }

  function escapeHtml(s){
    return (s ?? "").toString().replace(/[&<>"']/g, (m)=>({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
    }[m]));
  }

  /***********************
   * Game Scene
   ***********************/
  class GameScene {
    constructor() {
      this.state = "play";
      this.world = new World();
      this.player = null;

      this.enemies = [];
      this.npcs = [];
      this.bullets = [];
      this.bossBullets = [];
      this.particles = [];

      this.child = null;
      this.notes = [];
      this.chests = [];

      this.boss = null;

      this.tension = new Tension();
      this.fxSys = new VisualFX();
      this.atmo = new AtmosphereManager();

      this.flags = { readNotes: 0, openedChests: 0, dilemmas: 0, metNurse: false, metPatient: false };

      this.time = 0;
      this.lastWhisper = { text:"", t:0 };
      this._hint = "";

      this._seedItems();
    }

    startRun(name, avi, settings) {
      this.state = "play";
      this.world.reset();
      this.player = new Player(name, avi);

      this.enemies.length = 0;
      this.npcs.length = 0;
      this.bullets.length = 0;
      this.bossBullets.length = 0;
      this.particles.length = 0;

      this.child = null;
      this.boss = null;

      this.tension = new Tension();
      this.fxSys = new VisualFX();
      this.atmo = new AtmosphereManager();
      this.fxSys.allowFaces = !!settings.allowFaces;

      this.flags.readNotes = 0;
      this.flags.openedChests = 0;
      this.flags.dilemmas = 0;
      this.flags.metNurse = false;
      this.flags.metPatient = false;

      Input.confusionEnabled = !!settings.allowConfusion;
      Input.confusionT = 0;

      AudioSys.setHardMode(!!settings.hardAudio);
      this._seedItems();
      this.whisper("FOG. BEDS BEHIND WALLS. NAMES REMOVED.", 2.2);
    }

    // NEW: difficulty pacing (cap spawns, adaptive)
    difficulty() {
      const d = Math.floor(this.player.x / 10);
      const stage = clamp(d / 650, 0, 1);
      const struggling = (this.player.hp / this.player.hpMax) < 0.35 || (this.player.san / this.player.sanMax) < 0.30;
      const assist = struggling ? 0.22 : 0;

      return {
        stage,
        spawnEvery: lerp(1.10, 0.62, stage) + assist,
        maxEnemies: Math.floor(4 + stage * 4), // 4..8
        flyerChance: lerp(0.28, 0.52, stage),
      };
    }

    _seedItems() {
      this.notes.length = 0;
      this.chests.length = 0;
      [520, 980, 1520, 2100, 2680].forEach((x,i)=> this.notes.push(new NoteItem(x + randi(-30,30), i)));
      [740, 1280, 1860, 2440, 3020].forEach((x)=> this.chests.push(new Chest(x + randi(-40,40))));
    }

    whisper(text, t=2.0) { this.lastWhisper.text = text; this.lastWhisper.t = t; }
    fx(x,y,kind,n) { for (let i=0;i<n;i++) this.particles.push(new Particle(x,y,kind)); }

    spawnWave() {
      const diff = this.difficulty();
      if (this.enemies.length >= diff.maxEnemies) return;

      const room = diff.maxEnemies - this.enemies.length;
      const count = Math.min(room, randi(1, 2 + Math.floor(diff.stage * 1.5)));

      for (let i=0;i<count;i++) {
        const type = chance(diff.flyerChance) ? "fly" : "walk";
        const x = this.world.cam.x + RW + randi(20,80);
        const y = (type==="fly") ? (this.world.groundY - randi(70,120)) : (this.world.groundY - 50);
        this.enemies.push(new EnemyAngel(x,y,type));
      }

      // rarer NPC spawns
      if (!this.flags.metNurse && chance(0.05)) { this.flags.metNurse = true; this.spawnNPC("nurse"); }
      if (!this.flags.metPatient && chance(0.05)) { this.flags.metPatient = true; this.spawnNPC("patient"); }

      // child rarer
      if (!this.child && chance(0.035)) {
        this.child = new Patient07(this.world.cam.x + RW - randi(50,90));
        this.whisper("PATIENT 07 ENTERS THE HALL.", 2.2);
        AudioSys.ping("thump", 0.9);
      }
    }

    spawnNPC(kind) {
      const npc = new AmbiguousNPC(this.world.cam.x + RW - randi(40, 90), kind);
      this.npcs.push(npc);
      this.whisper(kind==="nurse" ? "A NURSE WITHOUT EYES WAITS." : "A PATIENT HUMS A WRONG LULLABY.", 2.2);
      AudioSys.ping("thump", 0.7);
    }

    startBoss(index) {
      this.bullets.length = 0;
      this.bossBullets.length = 0;

      if (index === 0) {
        this.boss = new BossClinician(this.world.cam.x + RW + 90, this);
        this.whisper("SERAPH-CLINICIAN ARRIVES TO 'FIX' YOU.", 2.2);
      } else {
        this.boss = new BossChoir(this.world.cam.x + RW + 90, this);
        this.whisper("CHOIR-ENGINE HUNTS YOUR GAZE.", 2.2);
      }
      AudioSys.ping("boss", 1.0);
    }

    shoot(player, ax, ay) {
      AudioSys.ping("shoot", 0.7);

      // melee
      if (player.weapon.melee) {
        player.san = clamp(player.san - 0.2, 0, player.sanMax);
        const range = 30;
        const px = player.cx + player.facing*10;
        const py = player.cy;
        for (const e of this.enemies) {
          if (!e.dead && hypot(e.cx - px, e.cy - py) < range) e.hit(player.weapon.dmg, this);
        }
        for (const n of this.npcs) {
          if (!n.dead && n.hostile && hypot(n.cx - px, n.cy - py) < range) n.hit(player.weapon.dmg, this);
        }
        this.fx(px, py, "spark", 10);
        return;
      }

      const ox = player.x + (player.facing>0 ? player.w : 0);
      const oy = player.y + 14;

      const baseAng = Math.atan2(ay - oy, ax - ox);
      const sp = 620;

      const bullets = player.weapon.bullets || 1;
      const spread = player.weapon.spread || 0;

      for (let i=0;i<bullets;i++){
        const ang = baseAng + rand(-spread, spread);
        const vx = Math.cos(ang) * sp;
        const vy = Math.sin(ang) * sp;
        const b = new Bullet(ox, oy, vx, vy, player.weapon.dmg, player.weapon.pierce, "player");
        this.bullets.push(b);
      }

      const sc = player.weapon.sanityCost || 0.45;
      player.san = clamp(player.san - sc, 0, player.sanMax);
    }

    spawnBossBurst(x0,y0,x1,y1,count,spread,speed,dmg){
      const base = Math.atan2(y1-y0, x1-x0);
      for (let i=0;i<count;i++){
        const ang = base + rand(-spread, spread);
        const vx = Math.cos(ang)*speed;
        const vy = Math.sin(ang)*speed;
        const b = new Bullet(x0,y0,vx,vy,dmg,0,"boss");
        b.w=5; b.h=5;
        this.bossBullets.push(b);
      }
    }

    openChest(chest) {
      chest.opened = true;
      this.flags.openedChests++;
      this.whisper("THE CHEST OPENS LIKE A MOUTH.", 2.0);
      AudioSys.ping("thump", 0.8);

      const roll = Math.random();
      if (roll < 0.48) {
        this.player.heal(28);
        this.whisper("FLESH REMEMBERS HOW TO CLOSE.", 1.8);
      } else if (roll < 0.78) {
        this.player.soothe(34);
        this.whisper("THE LIGHT RETURNS (WRONG).", 1.8);
      } else {
        // power-down, but fair
        if (Input.confusionEnabled && chance(0.4)) {
          Input.confusionT = Math.max(Input.confusionT, rand(2.0, 3.6));
          this.whisper("CONFUSION: CONTROLS INVERTED (TEMP).", 2.0);
        } else {
          this.player.status.shiverT = Math.max(this.player.status.shiverT, rand(3.0, 6.0));
          this.whisper("YOUR AIM STARTS LISTENING TO SOMETHING ELSE.", 2.0);
        }
      }
    }

    update(dt) {
      if (this.state !== "play") return;

      this.time += dt;
      if (this.lastWhisper.t > 0) this.lastWhisper.t -= dt;

      Input.confusionT = Math.max(0, Input.confusionT - dt);

      // camera follow
      const targetX = this.player.x - RW * 0.33;
      this.world.cam.x = lerp(this.world.cam.x, targetX, 1 - Math.pow(0.00025, dt));
      this.world.cam.x = Math.max(0, this.world.cam.x);

      // zone + tension
      this.atmo.update(dt, this);
      this.tension.update(dt, this);
      AudioSys.setIntensity(this.tension.heat, this.tension.mode);

      // visuals
      this.fxSys.update(dt, this);

      // player
      this.player.update(dt, this);

      // items
      for (const n of this.notes) if (!n.dead) n.update(dt, this);
      for (const c of this.chests) c.update(dt, this);

      // child
      if (this.child) this.child.update(dt, this);

      // npcs/enemies/boss
      for (const n of this.npcs) n.update(dt, this);
      this.npcs = this.npcs.filter(n => !n.dead);

      for (const e of this.enemies) e.update(dt, this);
      this.enemies = this.enemies.filter(e => !e.dead);

      if (this.boss) {
        this.boss.update(dt, this);
        if (this.boss.dead) {
          this.boss = null;
          this.tension.mode = "frenetic";
          this.whisper("THE ROOM EXHALES.", 2.2);
        }
      }

      // bullets/particles
      for (const b of this.bullets) b.update(dt, this);
      for (const b of this.bossBullets) b.update(dt, this);
      this.bullets = this.bullets.filter(b => !b.dead);
      this.bossBullets = this.bossBullets.filter(b => !b.dead);

      for (const p of this.particles) p.update(dt, this);
      this.particles = this.particles.filter(p => p.life > 0);

      // interactions
      this._hint = "";
      if (Input.interact()) {
        for (const n of this.notes) {
          if (!n.dead && aabb(this.player.x,this.player.y,this.player.w,this.player.h, n.x-10,n.y-10, 30,30)) {
            n.dead = true;
            this.flags.readNotes++;
            this.whisper("PAPER THAT REMEMBERS YOUR HAND.", 2.0);
            AudioSys.ping("thump", 0.7);
            break;
          }
        }
        for (const c of this.chests) {
          if (!c.opened && aabb(this.player.x,this.player.y,this.player.w,this.player.h, c.x-10,c.y-10, 34,30)) {
            this.openChest(c);
            break;
          }
        }
      } else {
        if (this.notes.some(n => !n.dead && aabb(this.player.x,this.player.y,this.player.w,this.player.h, n.x-10,n.y-10, 30,30))) this._hint = "Press E to read note";
        if (this.chests.some(c => !c.opened && aabb(this.player.x,this.player.y,this.player.w,this.player.h, c.x-10,c.y-10, 34,30))) this._hint = "Press E to open chest";
      }

      this.resolveCombat();

      // lose
      if (this.player.hp <= 0) this.gameOver("PHYSICAL VESSEL DESTROYED\n\nThe asylum keeps walking without you.");
      if (this.player.san <= 0) this.gameOver("MIND FRACTURED\n\nThe fog learns your face and wears it.");
    }

    resolveCombat() {
      for (const b of this.bullets) {
        if (b.dead) continue;

        // child hit => bad ending
        if (this.child && aabb(b.x,b.y,b.w,b.h, this.child.x,this.child.y,this.child.w,this.child.h)) {
          b.dead = true;
          this.fx(this.child.cx, this.child.cy, "blood", 30);
          this.gameOver("YOU SHOT PATIENT 07.\n\nBad Ending:\nThe asylum stops pretending it needs you.", true);
          return;
        }

        for (const e of this.enemies) {
          if (e.dead) continue;
          if (aabb(b.x,b.y,b.w,b.h, e.x,e.y,e.w,e.h)) {
            if (b.hit.has(e)) continue;
            b.hit.add(e);
            e.hit(b.dmg, this);
            AudioSys.ping("hit", 0.55);
            if (b.pierce > 0) b.pierce--;
            else b.dead = true;
            break;
          }
        }

        if (this.boss && !this.boss.dead && aabb(b.x,b.y,b.w,b.h, this.boss.x,this.boss.y,this.boss.w,this.boss.h)) {
          this.boss.hit(b.dmg, this);
          AudioSys.ping("hit", 0.7);
          b.dead = true;
        }
      }

      for (const b of this.bossBullets) {
        if (b.dead) continue;

        if (aabb(b.x,b.y,b.w,b.h, this.player.x,this.player.y,this.player.w,this.player.h)) {
          b.dead = true;
          this.player.hurt(7, b.x); // REBALANCED (was harsher)
          this.fx(this.player.cx,this.player.cy,"blood",10);
          AudioSys.ping("hit", 0.9);
        }

        if (this.child && aabb(b.x,b.y,b.w,b.h, this.child.x,this.child.y,this.child.w,this.child.h)) {
          b.dead = true;
          this.fx(this.child.cx,this.child.cy,"blood",30);
          this.gameOver("THE SONG TOUCHED PATIENT 07.\n\nBad Ending:\nYou didn’t pull the trigger — but the asylum doesn't care.", true);
          return;
        }
      }
    }

    gameOver(text, bad=false) {
      this.state = "over";
      UI.over.classList.remove("hidden");
      UI.overTitle.textContent = bad ? "BAD ENDING" : "SIGNAL LOST";
      UI.overBody.textContent = text;
      UI.hud.classList.add("hidden");
      AudioSys.setIntensity(bad ? 0.95 : 0.55, "boss");
      AudioSys.ping(bad ? "boss" : "hit", 1.0);
    }

    draw() {
      const t = this.time;

      this.world.draw(bctx, t, this.atmo);

      // items
      for (const n of this.notes) if (!n.dead) n.draw(bctx, this);
      for (const c of this.chests) c.draw(bctx, this);

      if (this.child) this.child.draw(bctx, this);
      for (const n of this.npcs) n.draw(bctx, this);
      for (const e of this.enemies) e.draw(bctx, this);
      if (this.boss) this.boss.draw(bctx, this);

      for (const b of this.bossBullets) b.draw(bctx, this.world.cam);
      for (const b of this.bullets) b.draw(bctx, this.world.cam);

      if (this.player) this.player.draw(bctx, this);

      for (const p of this.particles) p.draw(bctx, this.world.cam);

      this.drawLighting(bctx);
      this.drawOverlayText(bctx);
      this.fxSys.post(bctx, this);

      ctx.fillStyle = "#000";
      ctx.fillRect(0,0,W,H);

      const scale = Math.max(1, Math.floor(Math.min(W/RW, H/RH)));
      const dw = RW*scale, dh = RH*scale;
      const dx = ((W-dw)/2)|0, dy=((H-dh)/2)|0;
      ctx.drawImage(buf, 0,0,RW,RH, dx,dy,dw,dh);
    }

    drawLighting(ctx) {
      const p = this.player;
      if (!p) return;

      const fogMult = this.atmo ? this.atmo.fogMult : 1.0;

      const px = (p.x - this.world.cam.x + p.w/2) | 0;
      const py = (p.y + p.h/2) | 0;
      const rad = p.lantern;

      const fog = ctx.createRadialGradient(px, py, rad*0.2, px, py, rad*1.65 * fogMult);
      fog.addColorStop(0, "rgba(0,0,0,0)");
      fog.addColorStop(0.55, "rgba(0,0,0,0.45)");
      fog.addColorStop(1, "rgba(0,0,0,0.98)");
      ctx.fillStyle = fog;
      ctx.fillRect(0,0,RW,RH);

      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = (0.12 + this.tension.heat*0.15) * fogMult;
      ctx.fillStyle = "#111";
      for (let i=0;i<10;i++){
        const mx = ((performance.now()/50 + i*210) % (RW + 420)) - 210;
        ctx.fillRect(mx, 0, 90, RH);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }

    drawOverlayText(ctx) {
      const mx = (Input.mouse.nx * RW) | 0;
      const my = (Input.mouse.ny * RH) | 0;
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = "#888";
      ctx.beginPath();
      ctx.moveTo(mx-4,my); ctx.lineTo(mx-1,my);
      ctx.moveTo(mx+1,my); ctx.lineTo(mx+4,my);
      ctx.moveTo(mx,my-4); ctx.lineTo(mx,my-1);
      ctx.moveTo(mx,my+1); ctx.lineTo(mx,my+4);
      ctx.stroke();
      ctx.globalAlpha = 1;

      if (this.lastWhisper.t > 0) {
        ctx.font = "10px ui-monospace, monospace";
        ctx.fillStyle = "#9a9aaa";
        ctx.globalAlpha = clamp(this.lastWhisper.t/2, 0, 1) * 0.9;
        ctx.fillText(this.lastWhisper.text, 8, RH - 10);
        ctx.globalAlpha = 1;
      }

      if (this._hint) {
        ctx.font = "10px ui-monospace, monospace";
        ctx.fillStyle = "#7f7f92";
        ctx.fillText(this._hint, 8, RH - 22);
      }
    }
  }

  /***********************
   * Boot + UI wiring
   ***********************/
  const game = new GameScene();

  function setAviSelection(idx) {
    document.querySelectorAll(".avi").forEach(b => b.classList.remove("sel"));
    const btn = document.querySelector(`.avi[data-avi="${idx}"]`);
    btn?.classList.add("sel");
  }

  let selectedAvi = 0;
  document.querySelectorAll(".avi").forEach(btn => {
    btn.addEventListener("click", () => {
      selectedAvi = parseInt(btn.dataset.avi, 10) || 0;
      setAviSelection(selectedAvi);
    });
  });
  setAviSelection(0);

  UI.loadSpritesBtn.addEventListener("click", () => UI.spriteFiles.click());
  UI.spriteFiles.addEventListener("change", async () => {
    await assets.loadFromFiles(UI.spriteFiles.files);
    updateAssetUI();
  });

  UI.startBtn.addEventListener("click", async () => {
    const name = (UI.nameInput.value || "SEEKER").trim().slice(0,18) || "SEEKER";
    UI.nameInput.value = name;

    await assets.tryLoadManifest();
    updateAssetUI();

    AudioSys.start();
    AudioSys.setHardMode(UI.toggleHardAudio.checked);

    const settings = {
      allowConfusion: UI.toggleConfusion.checked,
      allowFaces: UI.toggleFaces.checked,
      hardAudio: UI.toggleHardAudio.checked
    };

    UI.menu.classList.add("hidden");
    UI.over.classList.add("hidden");
    UI.hud.classList.remove("hidden");

    game.startRun(name, selectedAvi, settings);

    SceneStack.stack.length = 0;
    SceneStack.push(game);
  });

  UI.retryBtn.addEventListener("click", () => {
    UI.over.classList.add("hidden");
    UI.hud.classList.remove("hidden");
    const name = (game.player?.name || UI.nameInput.value || "SEEKER").trim().slice(0,18) || "SEEKER";

    const settings = {
      allowConfusion: UI.toggleConfusion.checked,
      allowFaces: UI.toggleFaces.checked,
      hardAudio: UI.toggleHardAudio.checked
    };
    game.startRun(name, game.player?.avi ?? selectedAvi, settings);
    SceneStack.stack.length = 0;
    SceneStack.push(game);
  });

  UI.menuBtn.addEventListener("click", () => {
    UI.over.classList.add("hidden");
    UI.hud.classList.add("hidden");
    UI.menu.classList.remove("hidden");
    SceneStack.stack.length = 0;
  });

  // FIXED main loop: no double-update
  let last = performance.now();
  function loop(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    const top = SceneStack.top();
    if (top) {
      // if top is a pause-scene (dialogue), update it; otherwise update game
      if (top !== game && top.pausesGame) top.update?.(dt);
      else game.update(dt);

      // always draw game behind overlays
      game.draw();

      // HUD updates
      if (game.player) {
        const p = game.player;
        UI.hpFill.style.width = `${(p.hp/p.hpMax*100)|0}%`;
        UI.sanFill.style.width = `${(p.san/p.sanMax*100)|0}%`;
        UI.weaponLabel.textContent = `Weapon: ${p.weapon.name}`;
        UI.depthLabel.textContent = `DEPTH: ${Math.floor(p.x/10)}m`;
        UI.modeLabel.textContent =
          game.tension.mode === "atmosphere" ? "ATMOSPHERE" :
          game.tension.mode === "boss" ? "BOSS" : "FRENETIC";
        UI.zoneLabel.textContent = `ZONE: ${game.atmo?.name || "—"}`;

        const conf = (Input.confusionEnabled && Input.confusionT > 0) ? "CONFUSION ACTIVE" : "";
        UI.hintLabel.textContent = conf || "";
      }
    }

    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // Start audio on any pointerdown
  canvas.addEventListener("pointerdown", () => AudioSys.start());

})();


