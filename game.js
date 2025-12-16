/* game.js — LO-FI ANGELS: ASYLUM PROTOCOL (full rewrite)
   - Vanilla JS, no external URLs, GitHub Pages ready
   - Uses procedural pixel sprites, optional PNG sprites from local /assets/
*/

(() => {
  "use strict";

  /********************************************************************
   * Small helpers
   ********************************************************************/
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const randi = (a, b) => (a + Math.floor(Math.random() * (b - a + 1)));
  const rand = (a, b) => a + Math.random() * (b - a);
  const chance = (p) => Math.random() < p;

  function aabb(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  function dist(ax, ay, bx, by) {
    return Math.hypot(ax - bx, ay - by);
  }

  function nowS() { return performance.now() / 1000; }

  /********************************************************************
   * Canvas + internal resolution
   ********************************************************************/
  const canvas = document.getElementById("game") || (() => {
    const c = document.createElement("canvas");
    c.id = "game";
    document.body.appendChild(c);
    return c;
  })();

  // Internal “game” resolution: pixelated look.
  const RW = 480;
  const RH = 270;
  const buf = document.createElement("canvas");
  buf.width = RW;
  buf.height = RH;
  const bctx = buf.getContext("2d", { alpha: false });
  const ctx = canvas.getContext("2d", { alpha: false });

  let W = 0, H = 0, SCALE = 1, DX = 0, DY = 0;

  function resize() {
    W = canvas.width = Math.floor(window.innerWidth);
    H = canvas.height = Math.floor(window.innerHeight);
    SCALE = Math.max(1, Math.floor(Math.min(W / RW, H / RH)));
    const dw = RW * SCALE;
    const dh = RH * SCALE;
    DX = ((W - dw) / 2) | 0;
    DY = ((H - dh) / 2) | 0;
    ctx.imageSmoothingEnabled = false;
    bctx.imageSmoothingEnabled = false;
  }
  window.addEventListener("resize", resize);
  resize();

  /********************************************************************
   * Palette system (changes atmosphere)
   ********************************************************************/
  const PALETTES = {
    ward: {
      bg: "#050506",
      fog: "rgba(0,0,0,0.92)",
      ground: "#0b0b0f",
      solid: "#15151b",
      ui: "#cfcfe6",
      accent: "#7d3cff",
      danger: "#ff2a2a",
      child: "#00ffaa",
      blood: "#b0122a",
      goreDark: "#4a0b18",
      glass: "#7de7ff",
      sick: "#a5ff5a",
      textDim: "#8d8da6",
    },
    chapel: {
      bg: "#030304",
      fog: "rgba(0,0,0,0.95)",
      ground: "#08080b",
      solid: "#13131a",
      ui: "#e2e2ea",
      accent: "#ffcc00",
      danger: "#ff3355",
      child: "#00ffaa",
      blood: "#b0122a",
      goreDark: "#4a0b18",
      glass: "#9bf2ff",
      sick: "#e5ff7a",
      textDim: "#9a9ab6",
    },
    meltdown: {
      bg: "#040307",
      fog: "rgba(0,0,0,0.90)",
      ground: "#090812",
      solid: "#190f2c",
      ui: "#f0e9ff",
      accent: "#ff3cff",
      danger: "#ff2a2a",
      child: "#00ffaa",
      blood: "#c10f33",
      goreDark: "#59061a",
      glass: "#b6f6ff",
      sick: "#b9ff6a",
      textDim: "#b2a6c9",
    }
  };

  /********************************************************************
   * UI injection (so you don’t depend on existing HTML)
   ********************************************************************/
  function injectBaseCSS() {
    const css = `
      html,body{margin:0;height:100%;background:#000;overflow:hidden;font-family:ui-monospace,Menlo,Consolas,monospace}
      #game{position:fixed;inset:0;width:100%;height:100%;image-rendering:pixelated;display:block;background:#000}
      .gOverlay{position:fixed;inset:0;display:grid;place-items:center;z-index:50;background:rgba(0,0,0,.86)}
      .gPanel{width:min(900px,92vw);background:#0f0f14;border:1px solid #2b2b35;box-shadow:0 0 32px rgba(0,0,0,.6);padding:18px 18px 16px;position:relative}
      .gTitle{color:#e9e9f3;letter-spacing:3px;text-transform:uppercase;font-size:18px;margin:0 0 10px}
      .gSub{color:#8a8aa2;font-size:12px;line-height:1.6;margin:0 0 12px}
      .gRow{display:grid;grid-template-columns:1fr 1fr;gap:14px}
      .gRow3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}
      .gField{display:grid;gap:6px}
      .gLabel{color:#8d8da8;font-size:11px;letter-spacing:1px}
      .gInput,.gSelect{background:#000;border:1px solid #333;color:#fff;padding:10px;font:inherit;outline:none}
      .gInput:focus,.gSelect:focus{border-color:#7d3cff;box-shadow:0 0 0 2px rgba(125,60,255,.15)}
      .gBtn{background:#000;border:1px solid #333;color:#e9e9f3;padding:10px 14px;font:inherit;cursor:pointer;text-transform:uppercase;letter-spacing:1px}
      .gBtn:hover{border-color:#7d3cff;box-shadow:0 0 14px rgba(125,60,255,.25)}
      .gBtnDanger:hover{border-color:#ff2a2a;box-shadow:0 0 14px rgba(255,42,42,.25)}
      .gCard{border:1px solid #2b2b35;background:#0a0a0f;padding:10px;cursor:pointer;opacity:.75}
      .gCard:hover{opacity:1}
      .gCard.sel{border-color:#7d3cff;opacity:1;background:#130c1f}
      .gTiny{color:#7f7f98;font-size:11px;line-height:1.6}
      .gHud{position:fixed;left:12px;right:12px;top:10px;z-index:40;display:flex;justify-content:space-between;pointer-events:none;mix-blend-mode:difference}
      .gBars{display:grid;gap:6px}
      .gStat{color:#fff;font-size:10px;letter-spacing:1px;text-transform:uppercase}
      .gBar{width:120px;height:5px;background:#2a2a33;position:relative}
      .gFill{height:100%;width:100%}
      .gRight{text-align:right}
      .gFade{opacity:.75}
      .gDialog{white-space:pre-wrap;color:#d7d7e5;font-size:13px;line-height:1.6;border-left:2px solid #7d3cff;padding-left:12px;margin-top:10px}
      .gChoice{display:grid;gap:8px;margin-top:12px}
      .gChoice button{pointer-events:auto}
      .gCrt{position:fixed;inset:0;z-index:35;pointer-events:none;
        background:
          linear-gradient(rgba(18,16,16,0) 50%, rgba(0,0,0,0.22) 50%),
          linear-gradient(90deg, rgba(255,0,0,0.05), rgba(0,255,0,0.02), rgba(0,0,255,0.05));
        background-size:100% 2px, 3px 100%;
        box-shadow:inset 0 0 90px rgba(0,0,0,.7);
        opacity:.9;
      }
    `;
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
  }

  function makeUI() {
    injectBaseCSS();

    const crt = document.createElement("div");
    crt.className = "gCrt";
    document.body.appendChild(crt);

    const hud = document.createElement("div");
    hud.className = "gHud";
    hud.innerHTML = `
      <div class="gBars">
        <div>
          <div class="gStat">HP</div>
          <div class="gBar"><div id="uiHp" class="gFill" style="background:#ff2a2a"></div></div>
        </div>
        <div>
          <div class="gStat">SANITY</div>
          <div class="gBar"><div id="uiSan" class="gFill" style="background:#7d3cff"></div></div>
        </div>
        <div class="gStat gFade" id="uiStatus"></div>
      </div>
      <div class="gRight">
        <div class="gStat" id="uiMission"></div>
        <div class="gStat" id="uiTimer"></div>
        <div class="gStat gFade" id="uiMode"></div>
      </div>
    `;
    document.body.appendChild(hud);

    const menu = document.createElement("div");
    menu.className = "gOverlay";
    menu.id = "menu";
    menu.innerHTML = `
      <div class="gPanel">
        <h1 class="gTitle">LO-FI ANGELS // ASYLUM PROTOCOL</h1>
        <p class="gSub">
          WASD move, SPACE jump, Mouse aim, Click shoot. E interact. Q weapon swap.
          <br><span style="color:#ff2a2a">Rule:</span> Do not shoot the Daughter. Touch her to save her (mission-dependent).
        </p>
        <div class="gRow">
          <div class="gField">
            <div class="gLabel">IDENTITY</div>
            <input id="inName" class="gInput" maxlength="14" value="SEEKER" />
            <div class="gTiny">
              <b>Experimental effects</b> are applied as timed status effects (no random control flipping every frame).
            </div>
          </div>
          <div class="gField">
            <div class="gLabel">AVATAR</div>
            <div class="gRow3" id="aviRow"></div>
          </div>
        </div>

        <div style="height:10px"></div>

        <div class="gRow">
          <div class="gField">
            <div class="gLabel">MISSION</div>
            <select id="inMission" class="gSelect">
              <option value="SURVIVE_120">Survive 2:00</option>
              <option value="SAVE_CHILD">Save the Daughter (touch her)</option>
              <option value="REACH_EXIT">Reach the Exit</option>
            </select>
            <div class="gTiny">
              Difficulty is tuned to be winnable. Enemy damage scales gently, with mercy spawns (HP/SAN) when you struggle.
            </div>
          </div>
          <div class="gField">
            <div class="gLabel">SETTINGS</div>
            <label class="gTiny"><input id="optImages" type="checkbox" checked> Allow local PNG sprites (optional)</label><br>
            <label class="gTiny"><input id="optConfusion" type="checkbox" checked> Allow confusion effects</label><br>
            <label class="gTiny"><input id="optHardAudio" type="checkbox" checked> Abrasive audio</label>
          </div>
        </div>

        <div style="height:12px"></div>

        <div style="display:flex;gap:10px;justify-content:flex-end">
          <button id="btnStart" class="gBtn">INITIATE</button>
          <button id="btnMute" class="gBtn gBtnDanger">AUDIO: OFF</button>
        </div>
      </div>
    `;
    document.body.appendChild(menu);

    const dialog = document.createElement("div");
    dialog.className = "gOverlay";
    dialog.id = "dialog";
    dialog.style.display = "none";
    dialog.innerHTML = `
      <div class="gPanel">
        <h1 class="gTitle" id="dlgTitle">ENCOUNTER</h1>
        <div class="gDialog" id="dlgBody"></div>
        <div class="gChoice" id="dlgChoices"></div>
        <div style="margin-top:10px" class="gTiny">Press SPACE to pick the first choice quickly.</div>
      </div>
    `;
    document.body.appendChild(dialog);

    const end = document.createElement("div");
    end.className = "gOverlay";
    end.id = "end";
    end.style.display = "none";
    end.innerHTML = `
      <div class="gPanel" style="text-align:center">
        <h1 class="gTitle" id="endTitle">SIGNAL LOST</h1>
        <div class="gDialog" id="endBody" style="border:none;padding-left:0"></div>
        <div style="margin-top:16px;display:flex;gap:10px;justify-content:center">
          <button class="gBtn" id="btnRestart">REBOOT</button>
        </div>
      </div>
    `;
    document.body.appendChild(end);

    // Avatar cards
    const avatars = [
      { id: 0, name: "Vanguard", desc: "Balanced. Reliable recoil control." },
      { id: 1, name: "Occultist", desc: "Higher sanity. Stranger visions." },
      { id: 2, name: "Heavy", desc: "More HP. Slower, sturdier." },
    ];
    const aviRow = menu.querySelector("#aviRow");
    let selAvi = 0;
    avatars.forEach(a => {
      const card = document.createElement("div");
      card.className = "gCard" + (a.id === 0 ? " sel" : "");
      card.innerHTML = `<div style="color:#fff;font-weight:700">${a.name}</div><div class="gTiny">${a.desc}</div>`;
      card.onclick = () => {
        selAvi = a.id;
        [...aviRow.children].forEach(c => c.classList.remove("sel"));
        card.classList.add("sel");
      };
      aviRow.appendChild(card);
    });

    return {
      crt,
      hud,
      menu,
      dialog,
      end,
      inName: menu.querySelector("#inName"),
      inMission: menu.querySelector("#inMission"),
      optImages: menu.querySelector("#optImages"),
      optConfusion: menu.querySelector("#optConfusion"),
      optHardAudio: menu.querySelector("#optHardAudio"),
      btnStart: menu.querySelector("#btnStart"),
      btnMute: menu.querySelector("#btnMute"),
      uiHp: hud.querySelector("#uiHp"),
      uiSan: hud.querySelector("#uiSan"),
      uiStatus: hud.querySelector("#uiStatus"),
      uiMission: hud.querySelector("#uiMission"),
      uiTimer: hud.querySelector("#uiTimer"),
      uiMode: hud.querySelector("#uiMode"),
      dlgTitle: dialog.querySelector("#dlgTitle"),
      dlgBody: dialog.querySelector("#dlgBody"),
      dlgChoices: dialog.querySelector("#dlgChoices"),
      endTitle: end.querySelector("#endTitle"),
      endBody: end.querySelector("#endBody"),
      btnRestart: end.querySelector("#btnRestart"),
      getSelectedAvatar: () => selAvi
    };
  }

  const UI = makeUI();

  /********************************************************************
   * Input (NO “random left/right flip per frame” — only timed effects)
   ********************************************************************/
  const Input = {
    keys: Object.create(null),
    mouse: { x: 0, y: 0, down: false },
    // “confusion” effect: invert left/right + drift aim, but stable for its duration
    confusionEnabled: true,
    confusionT: 0,
    // snap for one-press actions
    _pressed: Object.create(null),
    _justPressed(code) {
      const v = !!this.keys[code];
      const was = !!this._pressed[code];
      this._pressed[code] = v;
      return v && !was;
    },
    readDir() {
      // base
      let left = !!this.keys["KeyA"];
      let right = !!this.keys["KeyD"];
      // timed confusion: invert left/right (consistently)
      if (this.confusionEnabled && this.confusionT > 0) {
        const tmp = left; left = right; right = tmp;
      }
      return (right ? 1 : 0) - (left ? 1 : 0);
    },
    wantJump() { return this._justPressed("Space") || this._justPressed("KeyW"); },
    wantInteract() { return this._justPressed("KeyE"); },
    wantSwap() { return this._justPressed("KeyQ"); },
  };

  window.addEventListener("keydown", (e) => { Input.keys[e.code] = true; });
  window.addEventListener("keyup", (e) => { Input.keys[e.code] = false; });

  window.addEventListener("mousemove", (e) => {
    const r = canvas.getBoundingClientRect();
    const mx = (e.clientX - r.left) / Math.max(1, r.width);
    const my = (e.clientY - r.top) / Math.max(1, r.height);
    // map to internal buffer space
    Input.mouse.x = clamp(mx, 0, 1) * RW;
    Input.mouse.y = clamp(my, 0, 1) * RH;
  });

  window.addEventListener("mousedown", () => { Input.mouse.down = true; });
  window.addEventListener("mouseup", () => { Input.mouse.down = false; });

  /********************************************************************
   * Audio engine (procedural abrasive horror)
   ********************************************************************/
  const AudioSys = {
    ctx: null,
    master: null,
    hard: true,
    muted: true,
    intensity: 0.25,
    mode: "atmosphere",
    _nodes: null,

    async init() {
      if (this.ctx) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.0;
      this.master.connect(this.ctx.destination);

      // build noise + drone + pulses
      const noiseBuf = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.8;

      const noise = this.ctx.createBufferSource();
      noise.buffer = noiseBuf;
      noise.loop = true;

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.value = 0.0;

      const drone1 = this.ctx.createOscillator();
      drone1.type = "sawtooth";
      drone1.frequency.value = 52;

      const drone2 = this.ctx.createOscillator();
      drone2.type = "triangle";
      drone2.frequency.value = 104;

      const droneGain = this.ctx.createGain();
      droneGain.gain.value = 0.0;

      const lp = this.ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 200;

      const hp = this.ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 40;

      // harsh pulse
      const pulse = this.ctx.createOscillator();
      pulse.type = "square";
      pulse.frequency.value = 2;

      const pulseGain = this.ctx.createGain();
      pulseGain.gain.value = 0.0;

      // LFO wobble
      const lfo = this.ctx.createOscillator();
      lfo.type = "sine";
      lfo.frequency.value = 0.15;

      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 45;

      lfo.connect(lfoGain);
      lfoGain.connect(lp.frequency);

      noise.connect(hp).connect(noiseGain).connect(lp).connect(this.master);
      drone1.connect(droneGain).connect(lp);
      drone2.connect(droneGain).connect(lp);
      pulse.connect(pulseGain).connect(this.master);

      noise.start();
      drone1.start();
      drone2.start();
      pulse.start();
      lfo.start();

      this._nodes = { noiseGain, droneGain, pulseGain, lp };

      this.setMuted(true);
    },

    setMuted(m) {
      this.muted = m;
      if (!this.master) return;
      const t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setTargetAtTime(m ? 0.0 : 0.28, t, 0.04);
    },

    setHard(v) { this.hard = v; },

    setIntensity(v, mode) {
      this.intensity = clamp(v, 0, 1);
      this.mode = mode || this.mode;
      if (!this._nodes) return;

      const t = this.ctx.currentTime;
      const { noiseGain, droneGain, pulseGain, lp } = this._nodes;

      const base = this.muted ? 0 : 1;
      const hard = this.hard ? 1 : 0.55;

      // Drone grows with intensity
      droneGain.gain.setTargetAtTime(base * (0.05 + this.intensity * 0.14) * hard, t, 0.06);

      // Noise presence depends on mode
      const noiseTarget =
        this.mode === "atmosphere"
          ? (0.02 + this.intensity * 0.06)
          : (0.05 + this.intensity * 0.18);

      noiseGain.gain.setTargetAtTime(base * noiseTarget * hard, t, 0.05);

      // Pulse: subtle in atmosphere, aggressive in frenetic
      const pulseTarget =
        this.mode === "atmosphere"
          ? (0.00 + this.intensity * 0.03)
          : (0.03 + this.intensity * 0.12);

      pulseGain.gain.setTargetAtTime(base * pulseTarget * hard, t, 0.05);

      // Filter opens more in frenetic
      const f = this.mode === "atmosphere" ? 160 + this.intensity * 120 : 250 + this.intensity * 900;
      lp.frequency.setTargetAtTime(f, t, 0.09);
    },

    ping(type = "shoot", amp = 0.7) {
      if (!this.ctx || this.muted) return;
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      const f = this.ctx.createBiquadFilter();

      f.type = "bandpass";
      f.frequency.value = (type === "hit") ? 120 : (type === "laser" ? 900 : 260);

      o.type = (type === "hit") ? "sawtooth" : (type === "laser" ? "square" : "triangle");
      o.frequency.setValueAtTime(type === "hit" ? 85 : (type === "laser" ? 420 : 180), t);

      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.12 * amp, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + (type === "hit" ? 0.18 : 0.10));

      o.connect(f).connect(g).connect(this.master);
      o.start(t);
      o.stop(t + 0.2);
    }
  };

  /********************************************************************
   * Assets (optional local PNGs)
   ********************************************************************/
  class Assets {
    constructor() {
      this.allowImages = true;
      this.img = new Map();
      this.ready = false;
    }
    loadList(list) {
      const promises = list.map(path => this.load(path));
      return Promise.allSettled(promises).then(() => { this.ready = true; });
    }
    load(path) {
      return new Promise((res) => {
        const im = new Image();
        im.onload = () => { this.img.set(path, im); res(true); };
        im.onerror = () => { this.img.set(path, null); res(false); };
        im.src = path;
      });
    }
    get(path) {
      if (!this.allowImages) return null;
      return this.img.get(path) || null;
    }
  }

  const ASSETS = new Assets();

  // If you create these local files, they will be used automatically:
  const OPTIONAL_ASSET_LIST = [
    "assets/player.png",
    "assets/angel.png",
    "assets/fiend.png",
    "assets/golem.png",
    "assets/crazy.png",
    "assets/wailer.png",
    "assets/daughter.png",
    "assets/face1.png",
    "assets/face2.png",
    "assets/face3.png",
  ];

  /********************************************************************
   * Pixel sprite renderer (procedural, animated)
   ********************************************************************/
  function drawPixelSprite(ctx, x, y, frame, kind, pal) {
    // All sprites are small “pixel art” built from rectangles (not monoblocks).
    // x,y are top-left in internal buffer space.
    // frame animates limbs/eyes/glitch offsets.

    const t = frame;
    const wob = Math.sin(t * 0.35) * 1.2;

    const px = (v) => (x + v) | 0;
    const py = (v) => (y + v) | 0;

    function eye(cx, cy, angry = false) {
      ctx.fillStyle = "#111";
      ctx.fillRect(px(cx), py(cy), 3, 2);
      ctx.fillStyle = "#ff3344";
      ctx.fillRect(px(cx + 1), py(cy + 1), 1, 1);
      if (angry) {
        ctx.strokeStyle = "#ff3344";
        ctx.beginPath();
        ctx.moveTo(px(cx - 1), py(cy - 1));
        ctx.lineTo(px(cx + 3), py(cy));
        ctx.stroke();
      }
    }

    if (kind === "player") {
      // coat + mask + gun arm
      ctx.fillStyle = "#1b1b22";
      ctx.fillRect(px(4), py(6), 10, 18);
      ctx.fillStyle = "#2a2a36";
      ctx.fillRect(px(5), py(7), 8, 16);

      // head
      ctx.fillStyle = "#d8d8e2";
      ctx.fillRect(px(6), py(2), 6, 5);
      ctx.fillStyle = "#111";
      ctx.fillRect(px(6), py(4), 6, 2);

      // “lens”
      ctx.fillStyle = "#7de7ff";
      ctx.fillRect(px(9), py(4), 2, 1);

      // legs
      ctx.fillStyle = "#0e0e13";
      const step = (Math.sin(t * 0.6) * 2) | 0;
      ctx.fillRect(px(5), py(24), 3, 5);
      ctx.fillRect(px(10 + step), py(24), 3, 5);

      // gun
      ctx.fillStyle = "#4b4b5a";
      ctx.fillRect(px(14), py(12), 6, 2);
      ctx.fillStyle = pal.accent;
      ctx.fillRect(px(16), py(13), 2, 1);
      return;
    }

    if (kind === "daughter") {
      // ghost dress
      ctx.fillStyle = "rgba(0,255,170,0.12)";
      ctx.beginPath();
      ctx.arc(px(8), py(10), 13, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = pal.child;
      ctx.beginPath();
      ctx.moveTo(px(8), py(2));
      ctx.lineTo(px(14), py(26));
      ctx.lineTo(px(2), py(26));
      ctx.fill();

      ctx.fillStyle = "#0b3324";
      ctx.fillRect(px(5), py(8), 2, 2);
      ctx.fillRect(px(9), py(8), 2, 2);
      return;
    }

    if (kind === "angel") {
      // hunched torso
      ctx.fillStyle = "#2a0a12";
      ctx.fillRect(px(4), py(8), 12, 12);
      ctx.fillStyle = pal.danger;
      ctx.fillRect(px(5), py(9), 10, 10);

      // head
      ctx.fillStyle = "#09090b";
      ctx.fillRect(px(6), py(4), 8, 5);
      eye(7, 5, true);
      eye(11, 5, true);

      // spikes
      ctx.fillStyle = "#ff7a8b";
      ctx.fillRect(px(3), py(11), 1, 2);
      ctx.fillRect(px(16), py(11), 1, 2);

      // legs
      ctx.fillStyle = "#1a1a22";
      const s = (Math.sin(t * 0.55) * 2) | 0;
      ctx.fillRect(px(6), py(20), 3, 6);
      ctx.fillRect(px(11 + s), py(20), 3, 6);
      return;
    }

    if (kind === "fiend") {
      // spiked fiend: thicker, angrier
      ctx.fillStyle = "#16060a";
      ctx.fillRect(px(3), py(7), 14, 14);
      ctx.fillStyle = "#ff1f3a";
      ctx.fillRect(px(4), py(8), 12, 12);

      // crown spikes
      ctx.fillStyle = "#ffd2da";
      ctx.fillRect(px(4), py(5), 1, 2);
      ctx.fillRect(px(7), py(4), 1, 3);
      ctx.fillRect(px(10), py(4), 1, 3);
      ctx.fillRect(px(13), py(5), 1, 2);

      // eyes
      ctx.fillStyle = "#0b0b0f";
      ctx.fillRect(px(6), py(11), 3, 2);
      ctx.fillRect(px(11), py(11), 3, 2);
      ctx.fillStyle = "#fff000";
      ctx.fillRect(px(7), py(12), 1, 1);
      ctx.fillRect(px(12), py(12), 1, 1);

      // claws
      ctx.fillStyle = "#b1002a";
      ctx.fillRect(px(2), py(18), 2, 2);
      ctx.fillRect(px(16), py(18), 2, 2);
      return;
    }

    if (kind === "golem") {
      // slow tank: stone plates
      ctx.fillStyle = "#0f0f14";
      ctx.fillRect(px(4), py(6), 12, 18);
      ctx.fillStyle = "#2d2d38";
      ctx.fillRect(px(5), py(7), 10, 16);
      ctx.fillStyle = "#1a1a22";
      ctx.fillRect(px(6), py(9), 8, 4);

      // eyes (dim)
      ctx.fillStyle = "#111";
      ctx.fillRect(px(7), py(12), 2, 1);
      ctx.fillRect(px(11), py(12), 2, 1);
      ctx.fillStyle = pal.sick;
      ctx.fillRect(px(8), py(12), 1, 1);
      ctx.fillRect(px(12), py(12), 1, 1);

      // stompy legs
      const s = (Math.sin(t * 0.25) * 1) | 0;
      ctx.fillStyle = "#111118";
      ctx.fillRect(px(6), py(24), 3, 6);
      ctx.fillRect(px(11 + s), py(24), 3, 6);
      return;
    }

    if (kind === "crazy") {
      // slender fast: thin limbs, twitch
      const twitch = (Math.sin(t * 1.3) * 2) | 0;
      ctx.fillStyle = "#121218";
      ctx.fillRect(px(7), py(5), 6, 16);

      // head
      ctx.fillStyle = "#e0e0ea";
      ctx.fillRect(px(8 + twitch), py(2), 4, 4);
      // eyes
      ctx.fillStyle = "#111";
      ctx.fillRect(px(9 + twitch), py(3), 1, 1);
      ctx.fillRect(px(11 + twitch), py(3), 1, 1);
      ctx.fillStyle = pal.danger;
      ctx.fillRect(px(10 + twitch), py(3), 1, 1);

      // arms
      ctx.fillStyle = "#1a1a22";
      ctx.fillRect(px(5), py(10), 2, 8);
      ctx.fillRect(px(13), py(10), 2, 8);

      // legs
      const s = (Math.sin(t * 0.9) * 2) | 0;
      ctx.fillRect(px(7), py(21), 2, 7);
      ctx.fillRect(px(11 + s), py(21), 2, 7);
      return;
    }

    if (kind === "wailer") {
      // floating grief enemy
      ctx.fillStyle = "rgba(125,60,255,0.18)";
      ctx.beginPath();
      ctx.arc(px(10), py(12 + wob), 12, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#1a0626";
      ctx.fillRect(px(5), py(6 + wob), 10, 14);
      ctx.fillStyle = pal.accent;
      ctx.fillRect(px(6), py(7 + wob), 8, 12);

      // mouth void
      ctx.fillStyle = "#000";
      ctx.fillRect(px(8), py(15 + wob), 4, 3);

      // eyes
      eye(7, 10 + wob, false);
      eye(11, 10 + wob, false);
      return;
    }
  }

  /********************************************************************
   * FX: particles, decals, screen effects (wiggle/memory/faces/glitch)
   ********************************************************************/
  class Particle {
    constructor(x, y, kind, pal) {
      this.x = x; this.y = y;
      this.kind = kind;
      this.vx = rand(-55, 55);
      this.vy = rand(-85, 35);
      this.life = rand(0.35, 0.85);
      this.pal = pal;
      this.sz = (kind === "gib") ? randi(2, 4) : randi(1, 3);
    }
    update(dt) {
      this.life -= dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.vy += 220 * dt;
    }
    draw(ctx, camx) {
      if (this.life <= 0) return;
      ctx.globalAlpha = clamp(this.life * 1.5, 0, 1);
      if (this.kind === "blood") ctx.fillStyle = this.pal.blood;
      else if (this.kind === "gib") ctx.fillStyle = this.pal.goreDark;
      else if (this.kind === "spark") ctx.fillStyle = "#ffffff";
      else ctx.fillStyle = "#aaaaaa";
      ctx.fillRect((this.x - camx) | 0, (this.y) | 0, this.sz, this.sz);
      ctx.globalAlpha = 1;
    }
  }

  class Decal {
    constructor(x, y, type, pal) {
      this.x = x; this.y = y;
      this.type = type;
      this.pal = pal;
      this.t = 0;
      this.r = randi(6, 14);
    }
    update(dt) { this.t += dt; }
    draw(ctx, camx) {
      const x = (this.x - camx) | 0;
      const y = (this.y) | 0;
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = this.type === "blood" ? this.pal.blood : "#111";
      ctx.beginPath();
      ctx.ellipse(x, y, this.r, (this.r * 0.55) | 0, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  class VisualFX {
    constructor() {
      this.allowFaces = true;
      this.wiggleT = 0;
      this.memoryT = 0;
      this.paletteShiftT = 0;
      this.glitchT = 0;
      this.faceFlashT = 0;
      this.faceImg = null;
      this.faceJitter = 0;
    }

    triggerWiggle(t = 4) { this.wiggleT = Math.max(this.wiggleT, t); }
    triggerMemory(t = 4) { this.memoryT = Math.max(this.memoryT, t); }
    triggerGlitch(t = 1.2) { this.glitchT = Math.max(this.glitchT, t); }
    triggerPaletteShift(t = 3) { this.paletteShiftT = Math.max(this.paletteShiftT, t); }
    triggerFace(im, t = 0.8) {
      if (!this.allowFaces) return;
      this.faceImg = im || this.faceImg;
      this.faceFlashT = Math.max(this.faceFlashT, t);
      this.faceJitter = rand(2, 7);
    }

    update(dt) {
      this.wiggleT = Math.max(0, this.wiggleT - dt);
      this.memoryT = Math.max(0, this.memoryT - dt);
      this.paletteShiftT = Math.max(0, this.paletteShiftT - dt);
      this.glitchT = Math.max(0, this.glitchT - dt);
      this.faceFlashT = Math.max(0, this.faceFlashT - dt);
    }

    postProcess(ctx, game) {
      // Add noise / mild vignette / glitch slices
      const pal = game.pal;
      const t = game.time;

      // Wiggle: horizontal sine displacement via scan stripes
      if (this.wiggleT > 0) {
        const amp = 3 + (this.wiggleT * 0.6);
        ctx.globalAlpha = 0.9;
        for (let y = 0; y < RH; y += 3) {
          const off = Math.sin(t * 8 + y * 0.12) * amp;
          // copy a strip to itself with offset
          ctx.drawImage(buf, 0, y, RW, 3, off, y, RW, 3);
        }
        ctx.globalAlpha = 1;
      }

      // Glitch slices
      if (this.glitchT > 0) {
        const n = 8;
        for (let i = 0; i < n; i++) {
          const y = randi(0, RH - 8);
          const h = randi(2, 10);
          const sx = randi(0, 20);
          const dx = randi(-18, 18);
          ctx.drawImage(buf, sx, y, RW - sx, h, dx, y, RW - sx, h);
        }
      }

      // Memory overlay: show ghostly “past” faces if assets exist
      if (this.memoryT > 0) {
        ctx.globalAlpha = clamp(this.memoryT / 4, 0, 1) * 0.35;
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, RW, RH);

        const face1 = ASSETS.get("assets/face1.png");
        const face2 = ASSETS.get("assets/face2.png");
        const face3 = ASSETS.get("assets/face3.png");
        const faces = [face1, face2, face3].filter(Boolean);

        if (faces.length) {
          const im = faces[(Math.floor(game.time * 2) % faces.length)];
          const w = 210, h = 210;
          const ox = (RW / 2 - w / 2 + Math.sin(game.time * 2) * 9) | 0;
          const oy = (RH / 2 - h / 2 + Math.cos(game.time * 1.7) * 7) | 0;
          // crude distortion: draw repeated with offsets
          for (let i = 0; i < 5; i++) {
            const dx = ox + rand(-8, 8);
            const dy = oy + rand(-8, 8);
            ctx.globalAlpha = 0.08;
            ctx.drawImage(im, dx, dy, w, h);
          }
          ctx.globalAlpha = clamp(this.memoryT / 4, 0, 1) * 0.24;
          ctx.drawImage(im, ox, oy, w, h);
        } else {
          // fallback: procedural “face” blocks
          ctx.globalAlpha = 0.22;
          ctx.fillStyle = pal.accent;
          ctx.fillRect(140, 60, 200, 160);
          ctx.fillStyle = "#000";
          ctx.fillRect(200, 110, 22, 10);
          ctx.fillRect(260, 110, 22, 10);
          ctx.fillRect(235, 140, 14, 18);
        }
        ctx.globalAlpha = 1;
      }

      // Palette shift tint
      if (this.paletteShiftT > 0) {
        ctx.globalAlpha = 0.12 + (this.paletteShiftT / 10);
        ctx.fillStyle = pal.accent;
        ctx.fillRect(0, 0, RW, RH);
        ctx.globalAlpha = 1;
      }

      // Film grain / pixel noise
      ctx.globalAlpha = 0.12;
      for (let i = 0; i < 140; i++) {
        const x = randi(0, RW - 1);
        const y = randi(0, RH - 1);
        ctx.fillStyle = (Math.random() < 0.5) ? "#0b0b0b" : "#151515";
        ctx.fillRect(x, y, 1, 1);
      }
      ctx.globalAlpha = 1;

      // Face flash (jump scare)
      if (this.faceFlashT > 0) {
        ctx.globalAlpha = clamp(this.faceFlashT, 0, 1) * 0.55;
        const im = this.faceImg || ASSETS.get("assets/face2.png");
        if (im) {
          const s = 240 + Math.sin(game.time * 10) * 12;
          const ox = (RW / 2 - s / 2 + rand(-this.faceJitter, this.faceJitter)) | 0;
          const oy = (RH / 2 - s / 2 + rand(-this.faceJitter, this.faceJitter)) | 0;
          ctx.drawImage(im, ox, oy, s, s);
        } else {
          ctx.fillStyle = "#fff";
          ctx.fillRect(0, 0, RW, RH);
        }
        ctx.globalAlpha = 1;
      }
    }
  }

  /********************************************************************
   * World: ground, obstacles, props (bins, glass, chests, potions)
   ********************************************************************/
  class Prop {
    constructor(x, y, kind) {
      this.x = x; this.y = y;
      this.kind = kind; // "bin"|"glass"|"chest"|"potion"
      this.w = (kind === "bin") ? 16 : (kind === "glass" ? 14 : (kind === "chest" ? 18 : 14));
      this.h = (kind === "bin") ? 14 : (kind === "glass" ? 18 : (kind === "chest" ? 14 : 14));
      this.broken = false;
      this._wiggle = rand(0, 10);
    }
    aabb() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }

    hit(game, cause = "bullet") {
      // returns optional drop
      if (this.broken) return null;
      this.broken = true;
      const pal = game.pal;

      if (this.kind === "glass") {
        // glass shards
        for (let i = 0; i < 18; i++) game.spawnParticle(this.x + this.w / 2, this.y + this.h / 2, "spark");
        game.fx.triggerGlitch(0.25);
        AudioSys.ping("hit", 0.7);
        return chance(0.25) ? "SAN" : null;
      }

      if (this.kind === "bin") {
        for (let i = 0; i < 8; i++) game.spawnParticle(this.x + this.w / 2, this.y + 4, "spark");
        AudioSys.ping("hit", 0.55);
        return chance(0.35) ? (chance(0.5) ? "HP" : "SAN") : null;
      }

      if (this.kind === "potion") {
        // randomized substance (power up/down)
        AudioSys.ping("hit", 0.75);
        if (chance(0.25)) return "CONFUSION";
        if (chance(0.40)) return "WIGGLE";
        return "MEMORY";
      }

      if (this.kind === "chest") {
        AudioSys.ping("hit", 0.9);
        // chest drops more interesting items
        const roll = Math.random();
        if (roll < 0.30) return "FRIEND";
        if (roll < 0.52) return "LASER";
        if (roll < 0.72) return "HP";
        if (roll < 0.90) return "SAN";
        return "GLITCH";
      }

      return null;
    }

    draw(ctx, camx, pal, t) {
      const x = (this.x - camx) | 0;
      const y = (this.y) | 0;
      if (x < -30 || x > RW + 30) return;

      if (this.broken) {
        ctx.globalAlpha = 0.35;
      }

      if (this.kind === "bin") {
        ctx.fillStyle = "#101018";
        ctx.fillRect(x, y, this.w, this.h);
        ctx.fillStyle = "#1f1f2a";
        ctx.fillRect(x + 2, y + 2, this.w - 4, this.h - 4);
        ctx.fillStyle = "#000";
        ctx.fillRect(x + 3, y + 5, this.w - 6, 2);
      } else if (this.kind === "glass") {
        ctx.fillStyle = "rgba(125,231,255,0.14)";
        ctx.fillRect(x, y, this.w, this.h);
        ctx.strokeStyle = pal.glass;
        ctx.strokeRect(x + 1, y + 1, this.w - 2, this.h - 2);
        ctx.fillStyle = "rgba(255,255,255,0.15)";
        ctx.fillRect(x + 3, y + 3, 2, this.h - 6);
      } else if (this.kind === "potion") {
        const bob = Math.sin(t * 2 + this._wiggle) * 1.5;
        ctx.fillStyle = "#0b0b10";
        ctx.fillRect(x, y + bob, this.w, this.h);
        ctx.fillStyle = pal.accent;
        ctx.fillRect(x + 3, y + 5 + bob, this.w - 6, this.h - 8);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(x + 6, y + 2 + bob, this.w - 12, 3);
      } else if (this.kind === "chest") {
        ctx.fillStyle = "#0b0b10";
        ctx.fillRect(x, y + 4, this.w, this.h - 4);
        ctx.fillStyle = "#1f102a";
        ctx.fillRect(x + 2, y + 6, this.w - 4, this.h - 8);
        ctx.fillStyle = pal.accent;
        ctx.fillRect(x + 7, y + 10, 4, 2);
        ctx.strokeStyle = "#2b2b35";
        ctx.strokeRect(x + 1, y + 5, this.w - 2, this.h - 6);
      }

      ctx.globalAlpha = 1;
    }
  }

  class World {
    constructor() {
      this.reset();
    }

    reset() {
      this.camx = 0;
      this.groundY = 220;
      this.obstacles = [];
      this.props = [];
      this._gen();
    }

    _gen() {
      // Generate a long corridor with props and occasional low obstacles
      let x = 0;
      for (let i = 0; i < 220; i++) {
        x += randi(42, 90);

        // low obstacles (boxes/beds)
        if (chance(0.25)) {
          const w = randi(14, 34);
          const h = randi(10, 28);
          this.obstacles.push({ x, y: this.groundY - h, w, h });
        }

        // props: bins, glass, potions, chests
        if (chance(0.28)) {
          const roll = Math.random();
          let kind = "bin";
          if (roll < 0.35) kind = "glass";
          else if (roll < 0.58) kind = "bin";
          else if (roll < 0.80) kind = "potion";
          else kind = "chest";
          const px = x + randi(-10, 20);
          const py = this.groundY - (kind === "glass" ? 18 : 14);
          this.props.push(new Prop(px, py, kind));
        }
      }
      // “exit” zone marker at far right
      this.exitX = x + 220;
    }

    drawBackground(ctx, pal, t) {
      ctx.fillStyle = pal.bg;
      ctx.fillRect(0, 0, RW, RH);

      // distant “ward” shapes
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = "#0a0a10";
      for (let i = 0; i < 14; i++) {
        const bx = (((i * 80) - (this.camx * 0.35)) % (RW + 120)) - 60;
        const by = 40 + (i % 3) * 10;
        ctx.fillRect(bx | 0, by | 0, 60, 90);
      }
      ctx.globalAlpha = 1;

      // ground
      ctx.fillStyle = pal.ground;
      ctx.fillRect(0, this.groundY, RW, RH - this.groundY);

      // grime lines
      ctx.globalAlpha = 0.25;
      ctx.strokeStyle = "#101018";
      for (let y = this.groundY; y < RH; y += 6) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(RW, y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    drawSolids(ctx, pal) {
      // obstacles
      ctx.fillStyle = pal.solid;
      for (const o of this.obstacles) {
        const x = (o.x - this.camx) | 0;
        if (x < -80 || x > RW + 80) continue;
        ctx.fillRect(x, o.y | 0, o.w | 0, o.h | 0);
        // detail edge
        ctx.fillStyle = "#0b0b10";
        ctx.fillRect(x + 1, o.y + 1, Math.max(0, o.w - 2), 2);
        ctx.fillStyle = pal.solid;
      }
    }

    collideEntity(e) {
      // ground
      e.grounded = false;
      if (e.y + e.h >= this.groundY) {
        e.y = this.groundY - e.h;
        e.vy = 0;
        e.grounded = true;
      }

      // obstacles
      for (const o of this.obstacles) {
        if (!aabb(e.x, e.y, e.w, e.h, o.x, o.y, o.w, o.h)) continue;

        // resolve minimal axis (simple)
        const overlapX1 = (e.x + e.w) - o.x;
        const overlapX2 = (o.x + o.w) - e.x;
        const overlapY1 = (e.y + e.h) - o.y;
        const overlapY2 = (o.y + o.h) - e.y;

        const minX = Math.min(overlapX1, overlapX2);
        const minY = Math.min(overlapY1, overlapY2);

        if (minY < minX) {
          // vertical
          if (overlapY1 < overlapY2) {
            e.y = o.y - e.h;
            e.vy = 0;
            e.grounded = true;
          } else {
            e.y = o.y + o.h;
            e.vy = 0;
          }
        } else {
          // horizontal
          if (overlapX1 < overlapX2) e.x = o.x - e.w;
          else e.x = o.x + o.w;
          e.vx = 0;
        }
      }
    }
  }

  /********************************************************************
   * Entities: player, enemies, bullets, pickups, daughter, friend
   ********************************************************************/
  class Entity {
    constructor(x, y, w, h) {
      this.x = x; this.y = y; this.w = w; this.h = h;
      this.vx = 0; this.vy = 0;
      this.grounded = false;
      this.dead = false;
      this.hp = 1;
      this.invT = 0;
      this.anim = 0;
    }
    get cx() { return this.x + this.w / 2; }
    get cy() { return this.y + this.h / 2; }
  }

  class Bullet {
    constructor(x, y, vx, vy, dmg, owner) {
      this.x = x; this.y = y;
      this.vx = vx; this.vy = vy;
      this.dmg = dmg;
      this.owner = owner; // "player"|"enemy"|"friend"
      this.w = 3; this.h = 2;
      this.dead = false;
      this.life = 1.3;
      this.hit = new Set();
    }
    update(dt, game) {
      this.life -= dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      if (this.life <= 0) this.dead = true;

      // collide with world bounds
      if (this.y < -20 || this.y > RH + 30) this.dead = true;

      // collide with obstacles
      for (const o of game.world.obstacles) {
        if (aabb(this.x, this.y, this.w, this.h, o.x, o.y, o.w, o.h)) {
          this.dead = true;
          game.spawnParticle(this.x, this.y, "spark");
          return;
        }
      }
    }
    draw(ctx, camx, pal) {
      const x = (this.x - camx) | 0;
      if (x < -10 || x > RW + 10) return;
      ctx.fillStyle = (this.owner === "enemy") ? pal.accent : "#ffe36a";
      ctx.fillRect(x, this.y | 0, this.w, this.h);
    }
  }

  class Pickup {
    constructor(x, y, kind) {
      this.x = x; this.y = y;
      this.kind = kind; // HP|SAN|WIGGLE|MEMORY|CONFUSION|FRIEND|LASER|GLITCH
      this.dead = false;
      this.t = rand(0, 99);
      this.w = 10; this.h = 10;
    }
    update(dt, game) {
      this.t += dt;
      // pickup
      const p = game.player;
      const py = this.y + Math.sin(this.t * 2) * 2;
      if (dist(p.cx, p.cy, this.x, py) < 16) {
        this.dead = true;
        game.onPickup(this.kind);
      }
    }
    draw(ctx, camx, pal) {
      const x = (this.x - camx) | 0;
      const y = (this.y + Math.sin(this.t * 2) * 2) | 0;
      if (x < -20 || x > RW + 20) return;

      let c = pal.accent;
      if (this.kind === "HP") c = pal.danger;
      if (this.kind === "SAN") c = pal.accent;
      if (this.kind === "WIGGLE") c = "#7de7ff";
      if (this.kind === "MEMORY") c = "#ffffff";
      if (this.kind === "CONFUSION") c = "#ff3cff";
      if (this.kind === "FRIEND") c = "#00ffaa";
      if (this.kind === "LASER") c = "#ffe36a";
      if (this.kind === "GLITCH") c = "#ff2a2a";

      ctx.fillStyle = "#000";
      ctx.fillRect(x - 1, y - 1, this.w + 2, this.h + 2);
      ctx.fillStyle = c;
      ctx.fillRect(x, y, this.w, this.h);
      ctx.fillStyle = "#111";
      ctx.fillRect(x + 2, y + 2, this.w - 4, 2);
    }
  }

  class Player extends Entity {
    constructor(name, avi) {
      super(40, 0, 18, 28);
      this.name = name;
      this.avi = avi;

      this.hpMax = (avi === 2) ? 160 : 110;
      this.hp = this.hpMax;

      this.sanMax = (avi === 1) ? 140 : 100;
      this.san = this.sanMax;

      this.speed = (avi === 2) ? 70 : 92;
      this.jump = (avi === 2) ? 210 : 235;

      this.facing = 1;
      this.shootCD = 0;

      // weapons
      this.weapons = [
        { id: "PISTOL", name: "Pistol", type: "gun", dmg: 9, rate: 0.18, spread: 0.03, bullets: 1, sanityCost: 0.25 },
        { id: "LASER", name: "Flesh-Cutting Laser", type: "laser", dmg: 26, rate: 0.0, spread: 0.0, bullets: 0, sanityCostPerSec: 10.5 },
      ];
      this.hasLaser = false;
      this.weaponIndex = 0;

      // status effects (timed, stable)
      this.status = {
        slowT: 0,
        griefT: 0,
        wiggleT: 0,
        memoryT: 0,
      };

      this.hasFriend = false;
      this.friendBoostT = 0;

      this.lantern = 160;
    }

    currentWeapon() {
      // If no laser unlocked, clamp selection
      if (!this.hasLaser && this.weapons[this.weaponIndex].id === "LASER") {
        this.weaponIndex = 0;
      }
      return this.weapons[this.weaponIndex];
    }

    swapWeapon() {
      this.weaponIndex = (this.weaponIndex + 1) % this.weapons.length;
      if (!this.hasLaser && this.weapons[this.weaponIndex].id === "LASER") {
        this.weaponIndex = 0;
      }
    }

    hurt(dmg, fromX) {
      if (this.invT > 0) return;
      this.hp -= dmg;
      this.invT = 0.5;
      this.vx += (this.x < fromX ? -1 : 1) * 70;
      this.san = Math.max(0, this.san - dmg * 0.25);
    }

    soothe(v) {
      this.san = clamp(this.san + v, 0, this.sanMax);
    }

    heal(v) {
      this.hp = clamp(this.hp + v, 0, this.hpMax);
    }

    applyEffect(kind, game) {
      if (kind === "WIGGLE") {
        this.status.wiggleT = Math.max(this.status.wiggleT, 5);
        game.fx.triggerWiggle(5);
        game.whisper("THE CORRIDOR BREATHES SIDEWAYS.", 2.0);
      }
      if (kind === "MEMORY") {
        this.status.memoryT = Math.max(this.status.memoryT, 5);
        game.fx.triggerMemory(5);
        game.whisper("SOMETHING YOU REMEMBER IS REMEMBERING YOU.", 2.0);
      }
      if (kind === "CONFUSION") {
        if (Input.confusionEnabled) {
          Input.confusionT = Math.max(Input.confusionT, 3.5);
          game.fx.triggerPaletteShift(2.0);
          game.whisper("LEFT MEANS RIGHT. JUST FOR NOW.", 1.8);
        }
      }
      if (kind === "GLITCH") {
        game.fx.triggerGlitch(1.2);
        game.fx.triggerFace(ASSETS.get("assets/face3.png"), 0.25);
        game.whisper("A FACE BORROWS YOUR SCREEN.", 1.4);
      }
      if (kind === "FRIEND") {
        this.hasFriend = true;
        this.friendBoostT = Math.max(this.friendBoostT, 8);
        game.whisper("A FRIEND-FORM CONTRACT SIGNS ITSELF.", 2.0);
      }
      if (kind === "LASER") {
        this.hasLaser = true;
        game.whisper("THE LASER IS WARM. LIKE MEAT.", 2.0);
      }
    }

    update(dt, game) {
      this.anim += dt * 60;
      this.invT = Math.max(0, this.invT - dt);

      // decay sanity slowly
      this.san = Math.max(0, this.san - dt * 0.9);

      // status
      this.status.slowT = Math.max(0, this.status.slowT - dt);
      this.status.griefT = Math.max(0, this.status.griefT - dt);
      this.status.wiggleT = Math.max(0, this.status.wiggleT - dt);
      this.status.memoryT = Math.max(0, this.status.memoryT - dt);
      this.friendBoostT = Math.max(0, this.friendBoostT - dt);

      // movement
      let dir = Input.readDir();
      if (dir !== 0) this.facing = dir > 0 ? 1 : -1;

      let sp = this.speed;
      if (this.status.slowT > 0) sp *= 0.62;
      if (this.status.griefT > 0) sp *= 0.70;

      this.vx = dir * sp;

      if (Input.wantJump() && this.grounded) {
        this.vy = -this.jump;
        AudioSys.ping("hit", 0.25);
      }

      // physics
      this.vy += 520 * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;

      // camera bounds (don't go behind camera too much)
      if (this.x < game.world.camx + 10) this.x = game.world.camx + 10;

      // collide
      game.world.collideEntity(this);

      // aiming
      let ax = Input.mouse.x + game.world.camx;
      let ay = Input.mouse.y;

      // if confused, add aim drift (NOT random left/right!)
      if (Input.confusionEnabled && Input.confusionT > 0) {
        const drift = Math.sin(game.time * 6) * 14;
        ax += drift;
        ay += Math.cos(game.time * 5) * 8;
      }

      // shooting
      const wpn = this.currentWeapon();
      this.shootCD = Math.max(0, this.shootCD - dt);

      if (Input.mouse.down) {
        if (wpn.type === "gun") {
          if (this.shootCD <= 0) {
            this.shootCD = wpn.rate;
            game.fireGun(this, ax, ay);
          }
        } else if (wpn.type === "laser") {
          // continuous
          game.fireLaser(this, ax, ay, dt);
        }
      }

      // lantern depends on sanity
      this.lantern = 90 + (this.san / this.sanMax) * 170;
    }

    draw(ctx, camx, pal) {
      const x = (this.x - camx) | 0;
      const y = this.y | 0;

      // optional image sprite
      const im = ASSETS.get("assets/player.png");
      if (im) {
        // simple 2-frame animation by time slicing if sprite sheet; else draw as-is
        // if your sprite is a sheet (32x32 frames), adapt here.
        ctx.drawImage(im, x - 6, y - 4, 32, 32);
        return;
      }

      // procedural pixel sprite
      drawPixelSprite(ctx, x, y, this.anim, "player", pal);

      // inv flash
      if (this.invT > 0) {
        ctx.globalAlpha = 0.22;
        ctx.fillStyle = "#fff";
        ctx.fillRect(x, y, this.w, this.h);
        ctx.globalAlpha = 1;
      }
    }
  }

  class Daughter extends Entity {
    constructor(x) {
      super(x, 0, 16, 26);
      this.saved = false;
      this._wanderT = rand(0.5, 2.2);
      this._dir = chance(0.5) ? -1 : 1;
      this.anim = rand(0, 99);
    }
    update(dt, game) {
      this.anim += dt * 60;
      if (this.saved) {
        // hover beside player
        const p = game.player;
        const tx = p.x - 22;
        this.x = lerp(this.x, tx, 1 - Math.pow(0.001, dt));
        this.y = lerp(this.y, p.y - 4 + Math.sin(game.time * 3) * 2, 1 - Math.pow(0.001, dt));
        return;
      }

      this._wanderT -= dt;
      if (this._wanderT <= 0) {
        this._wanderT = rand(0.8, 2.8);
        this._dir = chance(0.5) ? -1 : 1;
      }

      // avoid enemies slightly
      let fear = 0;
      for (const e of game.enemies) {
        const d = Math.abs(e.x - this.x);
        if (d < 70) { fear += (70 - d) / 70; }
      }
      const sp = 28 + fear * 42;
      this.vx = this._dir * sp;

      this.vy += 520 * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;

      game.world.collideEntity(this);

      // keep within camera forward region
      if (this.x < game.world.camx + 30) this.x = game.world.camx + 30;
    }
    draw(ctx, camx, pal) {
      const x = (this.x - camx) | 0;
      const y = this.y | 0;

      const im = ASSETS.get("assets/daughter.png");
      if (im) {
        ctx.globalAlpha = 0.9;
        ctx.drawImage(im, x - 8, y - 8, 32, 32);
        ctx.globalAlpha = 1;
        return;
      }

      // glow
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = pal.child;
      ctx.beginPath();
      ctx.arc(x + 8, y + 10, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      drawPixelSprite(ctx, x, y, this.anim, "daughter", pal);
    }
  }

  class Enemy extends Entity {
    constructor(x, y, type) {
      super(x, y, 18, 26);
      this.type = type; // angel|fiend|golem|crazy|wailer
      this.anim = rand(0, 99);
      this.onGround = true;
      this.touchDmg = 5;

      // tuned HP/damage so it’s winnable
      if (type === "angel") { this.hp = 24; this.speed = 40; this.touchDmg = 6; }
      if (type === "fiend") { this.hp = 36; this.speed = 36; this.touchDmg = 8; }
      if (type === "golem") { this.hp = 75; this.speed = 22; this.touchDmg = 10; this.w = 20; this.h = 30; }
      if (type === "crazy") { this.hp = 16; this.speed = 62; this.touchDmg = 4; this.w = 16; this.h = 28; }
      if (type === "wailer") { this.hp = 28; this.speed = 26; this.touchDmg = 3; this.w = 20; this.h = 20; }
    }

    hit(dmg, game) {
      this.hp -= dmg;

      // gore feedback
      const pal = game.pal;
      for (let i = 0; i < Math.min(10, 2 + (dmg / 6) | 0); i++) game.spawnParticle(this.cx, this.cy, chance(0.7) ? "blood" : "gib");

      if (chance(0.25)) game.fx.triggerGlitch(0.08);
      AudioSys.ping("hit", 0.6);

      if (this.hp <= 0) {
        this.dead = true;
        game.addDecal(this.cx, game.world.groundY - 1, "blood");
        // drop chance
        if (chance(0.20)) game.spawnPickup(this.x + 6, game.world.groundY - 16, chance(0.5) ? "HP" : "SAN");
        if (chance(0.06)) game.spawnPickup(this.x + 6, game.world.groundY - 16, "GLITCH");
      }
    }

    update(dt, game) {
      this.anim += dt * 60;

      const p = game.player;
      const dx = p.x - this.x;

      // behaviors
      if (this.type === "wailer") {
        // float and “grief” debuff
        this.y += Math.sin(game.time * 2 + this.x * 0.01) * 0.35;
        this.vx = Math.sign(dx) * this.speed;
        this.x += this.vx * dt;

        // grief aura
        if (dist(this.cx, this.cy, p.cx, p.cy) < 46) {
          p.status.griefT = Math.max(p.status.griefT, 1.2);
          if (chance(0.03 * dt * 60)) game.fx.triggerFace(ASSETS.get("assets/face1.png"), 0.12);
        }
      } else {
        // grounded AI
        const sp = this.speed;
        this.vx = Math.sign(dx) * sp;

        // crazies sometimes feint / stutter (not random direction each frame)
        if (this.type === "crazy") {
          const st = Math.sin((game.time + this.x * 0.01) * 5);
          this.vx *= (0.75 + 0.25 * st);
        }

        // golem occasionally pauses before charge
        if (this.type === "golem") {
          const phase = (Math.floor(game.time * 2 + this.x * 0.001) % 6);
          if (phase === 0) this.vx *= 0.35;
        }

        this.vy += 520 * dt;
        this.x += this.vx * dt;
        this.y += this.vy * dt;

        game.world.collideEntity(this);
      }

      // touch damage (tuned)
      if (aabb(this.x, this.y, this.w, this.h, p.x, p.y, p.w, p.h)) {
        p.hurt(this.touchDmg * dt * 6, this.x);
        if (chance(0.30)) game.spawnParticle(p.cx, p.cy, "blood");
      }
    }

    draw(ctx, camx, pal) {
      const x = (this.x - camx) | 0;
      const y = this.y | 0;
      if (x < -40 || x > RW + 40) return;

      // optional PNG sprites
      const map = {
        angel: "assets/angel.png",
        fiend: "assets/fiend.png",
        golem: "assets/golem.png",
        crazy: "assets/crazy.png",
        wailer: "assets/wailer.png",
      };
      const im = ASSETS.get(map[this.type]);
      if (im) {
        const size = 32;
        ctx.drawImage(im, x - 6, y - 6, size, size);
        return;
      }

      drawPixelSprite(ctx, x, y, this.anim, this.type, pal);
    }
  }

  class Companion {
    constructor(player) {
      this.p = player;
      this.x = player.x - 20;
      this.y = player.y - 4;
      this.t = 0;
      this.cd = 0;
    }
    update(dt, game) {
      this.t += dt;
      const p = this.p;
      // hover behind
      const tx = p.x - 18;
      const ty = p.y - 6 + Math.sin(game.time * 3) * 2;
      this.x = lerp(this.x, tx, 1 - Math.pow(0.0008, dt));
      this.y = lerp(this.y, ty, 1 - Math.pow(0.0008, dt));

      this.cd -= dt;
      if (this.cd <= 0) {
        const e = game.findNearestEnemy(this.x, this.y, 160);
        if (e) {
          this.cd = (p.friendBoostT > 0) ? 0.15 : 0.30;
          const ang = Math.atan2(e.cy - this.y, e.cx - this.x);
          const sp = 420;
          game.bullets.push(new Bullet(this.x, this.y, Math.cos(ang) * sp, Math.sin(ang) * sp, 6, "friend"));
          if (chance(0.25)) AudioSys.ping("shoot", 0.35);
        } else {
          this.cd = 0.22;
        }
      }
    }
    draw(ctx, camx, pal) {
      const x = (this.x - camx) | 0;
      const y = (this.y) | 0;
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = pal.child;
      ctx.fillRect(x, y, 6, 6);
      ctx.fillStyle = "#000";
      ctx.fillRect(x + 2, y + 2, 1, 1);
      ctx.fillRect(x + 4, y + 2, 1, 1);
      ctx.globalAlpha = 1;
    }
  }

  /********************************************************************
   * Tension/Atmosphere Manager
   ********************************************************************/
  class Tension {
    constructor() {
      this.mode = "atmosphere"; // atmosphere|frenetic
      this.heat = 0.0;          // 0..1
      this.spawnTimer = 0;
      this.triggerX = 220;      // distance to flip to frenetic
    }
    update(dt, game) {
      // flip tension: can be triggered by x distance or by mission urgency
      const depth = game.player.x / 10;
      const shouldFrenetic =
        depth > this.triggerX ||
        (game.mission?.id === "SURVIVE_120" && game.mission.timeLeft < 70) ||
        (game.mission?.id === "SAVE_CHILD" && !game.daughterSaved && depth > 180);

      this.mode = shouldFrenetic ? "frenetic" : "atmosphere";

      const target = (this.mode === "frenetic") ? 1 : 0.2;
      this.heat = lerp(this.heat, target, 1 - Math.pow(0.003, dt));
    }
  }

  class AtmosphereManager {
    constructor() {
      this.name = "ward";
      this.nextShiftAt = 30;
    }
    update(dt, game) {
      // shift palette occasionally for “change in atmosphere”
      // this is *controlled*, not chaotic per frame
      if (game.time > this.nextShiftAt) {
        this.nextShiftAt = game.time + rand(25, 40);

        const depth = game.player.x;
        if (depth > 2400 && chance(0.55)) this.name = "chapel";
        else if (chance(0.20)) this.name = "meltdown";
        else this.name = "ward";

        game.fx.triggerPaletteShift(2.5);
        game.whisper(
          this.name === "chapel" ? "A QUIETER ROOM. WRONG KIND OF QUIET." :
          this.name === "meltdown" ? "THE LIGHTS ARGUE WITH THEMSELVES." :
          "THE WARD RETURNS TO ITS BREATH.",
          2.0
        );
      }
    }
    palette() { return PALETTES[this.name]; }
  }

  /********************************************************************
   * Dialog system (moral dilemmas + lore)
   ********************************************************************/
  class Dialogue {
    constructor({ title, body, choices }) {
      this.title = title;
      this.body = body;
      this.choices = choices;
    }
  }

  class DialogueStack {
    constructor() { this.stack = []; }
    push(d) { this.stack.push(d); }
    pop() { return this.stack.pop(); }
    top() { return this.stack[this.stack.length - 1]; }
    get active() { return this.stack.length > 0; }
  }

  const Dialogs = new DialogueStack();

  /********************************************************************
   * Mission system
   ********************************************************************/
  class Mission {
    constructor(id) {
      this.id = id;
      this.done = false;
      this.failed = false;
      this.timeLeft = (id === "SURVIVE_120") ? 120 : 0;
    }
    title() {
      if (this.id === "SURVIVE_120") return "Mission: Survive 2:00";
      if (this.id === "SAVE_CHILD") return "Mission: Save Patient 07";
      return "Mission: Reach the Exit";
    }
    update(dt, game) {
      if (this.done || this.failed) return;

      if (this.id === "SURVIVE_120") {
        this.timeLeft = Math.max(0, this.timeLeft - dt);
        if (this.timeLeft <= 0) {
          this.done = true;
          game.win("You lasted.\n\nThe ward doesn’t congratulate you.\nIt just opens a door it didn’t have.");
        }
      }

      if (this.id === "SAVE_CHILD") {
        if (game.daughter && game.daughter.saved) {
          this.done = true;
          game.win("You touched her hand.\n\nShe becomes a light that refuses to die.\nGood Ending (for now).");
        }
      }

      if (this.id === "REACH_EXIT") {
        if (game.player.x > game.world.exitX - 60) {
          this.done = true;
          game.win("You found the exit.\n\nOutside is not better.\nJust wider.");
        }
      }
    }
  }

  /********************************************************************
   * Game core
   ********************************************************************/
  class Game {
    constructor() {
      this.state = "menu"; // menu|play|end
      this.world = new World();
      this.atmo = new AtmosphereManager();
      this.tension = new Tension();
      this.fx = new VisualFX();

      this.player = null;
      this.friend = null;

      this.enemies = [];
      this.bullets = [];
      this.particles = [];
      this.decals = [];
      this.pickups = [];

      this.mission = null;

      this.daughter = null;
      this.daughterSpawned = false;
      this.daughterSaved = false;

      this.time = 0;
      this.whisperText = "";
      this.whisperT = 0;

      // spawn pacing
      this.spawnAcc = 0;
      this.lastDilemmaAt = 18;
      this._mercy = 0;

      // laser beam visual
      this._laser = null;
    }

    whisper(msg, t = 1.8) {
      this.whisperText = msg;
      this.whisperT = t;
    }

    spawnParticle(x, y, kind) {
      this.particles.push(new Particle(x, y, kind, this.pal));
      if (this.particles.length > 1000) this.particles.splice(0, this.particles.length - 1000);
    }

    addDecal(x, y, type) {
      this.decals.push(new Decal(x, y, type, this.pal));
      if (this.decals.length > 240) this.decals.splice(0, this.decals.length - 240);
    }

    spawnPickup(x, y, kind) {
      this.pickups.push(new Pickup(x, y, kind));
    }

    onPickup(kind) {
      const p = this.player;

      if (kind === "HP") { p.heal(28); this.whisper("A RED PACK THAT SMELLS LIKE METAL.", 1.6); AudioSys.ping("hit", 0.35); return; }
      if (kind === "SAN") { p.soothe(26); this.whisper("A PURPLE BREATH IN A BOTTLE.", 1.6); AudioSys.ping("hit", 0.35); return; }

      if (kind === "WIGGLE" || kind === "MEMORY" || kind === "CONFUSION" || kind === "GLITCH") {
        p.applyEffect(kind, this);
        return;
      }
      if (kind === "FRIEND") { p.applyEffect("FRIEND", this); return; }
      if (kind === "LASER") { p.applyEffect("LASER", this); return; }
    }

    difficulty() {
      // Smooth, winnable scaling with mercy when low
      const depth = this.player.x / 10;
      const stage = clamp(depth / 650, 0, 1);
      const hpFrac = this.player.hp / this.player.hpMax;
      const sanFrac = this.player.san / this.player.sanMax;
      const struggling = (hpFrac < 0.35) || (sanFrac < 0.30);

      // mercy increases if struggling
      this._mercy = lerp(this._mercy, struggling ? 1 : 0, 1 - Math.pow(0.01, 1 / 60));
      const mercy = this._mercy;

      const baseSpawn = lerp(1.35, 0.70, stage);
      const spawnEvery = baseSpawn + mercy * 0.55;

      const maxEnemies = Math.floor(4 + stage * 6 - mercy * 2); // 4..10 (less when struggling)
      const eliteChance = clamp(lerp(0.08, 0.30, stage) - mercy * 0.12, 0.05, 0.30);

      return { stage, spawnEvery, maxEnemies, eliteChance };
    }

    spawnEnemyWave() {
      const d = this.difficulty();
      if (this.enemies.length >= d.maxEnemies) return;

      const n = randi(1, 2 + Math.floor(d.stage * 1.2));
      for (let i = 0; i < n; i++) {
        if (this.enemies.length >= d.maxEnemies) break;

        const x = this.world.camx + RW + randi(20, 80);
        let type = "angel";

        const elite = chance(d.eliteChance);
        if (elite) {
          const r = Math.random();
          if (r < 0.28) type = "fiend";
          else if (r < 0.52) type = "crazy";
          else if (r < 0.72) type = "wailer";
          else type = "golem";
        } else {
          type = chance(0.62) ? "angel" : "crazy";
        }

        const y = (type === "wailer") ? (this.world.groundY - randi(80, 120)) : (this.world.groundY - 26);
        this.enemies.push(new Enemy(x, y, type));
      }

      // mercy drops
      if (this._mercy > 0.6 && chance(0.25)) {
        this.spawnPickup(this.world.camx + randi(120, 220), this.world.groundY - 16, chance(0.5) ? "HP" : "SAN");
      }
    }

    findNearestEnemy(x, y, rad) {
      let best = null;
      let bd = rad;
      for (const e of this.enemies) {
        if (e.dead) continue;
        const d = dist(x, y, e.cx, e.cy);
        if (d < bd) { bd = d; best = e; }
      }
      return best;
    }

    fireGun(player, ax, ay) {
      const wpn = player.currentWeapon();
      const ox = player.x + (player.facing > 0 ? player.w : 0);
      const oy = player.y + 14;

      const ang = Math.atan2(ay - oy, ax - ox) + rand(-wpn.spread, wpn.spread);
      const sp = 520;

      this.bullets.push(new Bullet(ox, oy, Math.cos(ang) * sp, Math.sin(ang) * sp, wpn.dmg, "player"));
      player.san = Math.max(0, player.san - wpn.sanityCost);

      // recoil micro
      player.vx += -Math.cos(ang) * 12;

      // sound + small FX
      AudioSys.ping("shoot", 0.65);
      if (chance(0.18)) this.spawnParticle(ox, oy, "spark");
    }

    fireLaser(player, ax, ay, dt) {
      if (!player.hasLaser) return;

      const wpn = player.currentWeapon();
      const ox = player.x + (player.facing > 0 ? player.w : 0);
      const oy = player.y + 14;

      const ang = Math.atan2(ay - oy, ax - ox);
      const dx = Math.cos(ang), dy = Math.sin(ang);

      let hitLen = 320;

      // stop at obstacles / ground
      for (let t = 0; t < 320; t += 6) {
        const px = ox + dx * t;
        const py = oy + dy * t;
        if (py > this.world.groundY) { hitLen = t; break; }
        for (const o of this.world.obstacles) {
          if (aabb(px, py, 2, 2, o.x, o.y, o.w, o.h)) { hitLen = t; t = 9999; break; }
        }
      }

      // damage enemies along beam
      const beamR = 8;
      const dmg = wpn.dmg * dt;

      for (const e of this.enemies) {
        if (e.dead) continue;
        // point-to-segment distance (approx)
        const vx = e.cx - ox, vy = e.cy - oy;
        const proj = vx * dx + vy * dy;
        if (proj < 0 || proj > hitLen) continue;
        const px = ox + dx * proj;
        const py = oy + dy * proj;
        const d = dist(e.cx, e.cy, px, py);
        if (d < beamR) {
          e.hit(dmg * 1.15, this);
          if (chance(0.05)) this.spawnParticle(e.cx, e.cy, "blood");
        }
      }

      // sanity cost per second
      player.san = Math.max(0, player.san - (player.currentWeapon().sanityCostPerSec || 10.5) * dt);

      this._laser = { x0: ox, y0: oy, x1: ox + dx * hitLen, y1: oy + dy * hitLen, t: 0.06 };

      if (chance(0.22)) AudioSys.ping("laser", 0.38);
      if (chance(0.15)) this.fx.triggerGlitch(0.06);
    }

    maybeSpawnDaughter() {
      if (this.daughterSpawned) return;
      if (!this.mission) return;

      // for SAVE_CHILD spawn early; otherwise later anxiety appearance
      if (this.mission.id === "SAVE_CHILD") {
        this.daughterSpawned = true;
        this.daughter = new Daughter(this.world.camx + RW + 40);
        this.whisper("PATIENT 07 IS IN THE HALL.", 2.0);
        return;
      }

      if (this.tension.mode === "frenetic" && this.player.x > 1700 && chance(0.006)) {
        this.daughterSpawned = true;
        this.daughter = new Daughter(this.world.camx + RW - randi(60, 120));
        this.whisper("THE DAUGHTER APPEARS. DO NOT SHOOT.", 2.0);
      }
    }

    triggerDilemmaOnce() {
      // moral dilemmas show rarely and only when safe enough
      if (this.time < this.lastDilemmaAt) return;
      if (this.tension.mode !== "atmosphere") return;
      if (this.enemies.length > 0) return;

      if (chance(0.18)) {
        this.lastDilemmaAt = this.time + rand(25, 35);
        const p = this.player;
        const tone = (p.avi === 1) ? "ritual" : (p.avi === 2 ? "brutal" : "flat");

        const body =
          tone === "ritual"
            ? `${p.name}, a nurse offers a vial labeled: "MEMORY".\nHer lips move without sound.\n\nDo you drink it?`
            : tone === "brutal"
            ? `${p.name}, a deranged patient sits in the trash.\nHe whispers: "I can help you kill."\n\nDo you accept him?`
            : `${p.name}, a patient stands too close.\nHe asks you to choose what he becomes.\n\nWhat do you choose?`;

        const dlg = new Dialogue({
          title: "WARD ENCOUNTER",
          body,
          choices: [
            {
              label: "Accept.",
              hint: "Gain something. Also gain consequences.",
              act: () => {
                if (tone === "brutal") {
                  this.player.applyEffect("FRIEND", this);
                } else {
                  this.player.applyEffect("MEMORY", this);
                  if (chance(0.35) && Input.confusionEnabled) this.player.applyEffect("CONFUSION", this);
                }
                this.whisper("THE WARD NOTICES YOUR CHOICE.", 2.0);
              }
            },
            {
              label: "Refuse.",
              hint: "Small sanity gain; the ward gets offended later.",
              act: () => {
                this.player.soothe(10);
                this.tension.triggerX = Math.max(120, this.tension.triggerX - 25);
                this.whisper("YOU SAID NO. SOMETHING REMEMBERS IT.", 2.0);
              }
            },
            {
              label: "Steal the chest behind him.",
              hint: "Risk confusion; chance for Laser.",
              act: () => {
                this.spawnPickup(this.player.x + 40, this.world.groundY - 16, chance(0.45) ? "LASER" : "GLITCH");
                if (chance(0.35)) this.player.applyEffect("CONFUSION", this);
                this.whisper("THEFT IS ALSO A PRAYER.", 2.0);
              }
            }
          ]
        });

        this.openDialog(dlg);
      }
    }

    openDialog(dlg) {
      Dialogs.push(dlg);
      this.state = "dialog";
      UI.dialog.style.display = "grid";

      UI.dlgTitle.textContent = dlg.title;
      UI.dlgBody.textContent = dlg.body;

      UI.dlgChoices.innerHTML = "";
      dlg.choices.forEach((c, idx) => {
        const btn = document.createElement("button");
        btn.className = "gBtn";
        btn.textContent = `${idx + 1}. ${c.label}`;
        btn.onclick = () => this.pickDialog(idx);
        const hint = document.createElement("div");
        hint.className = "gTiny";
        hint.textContent = c.hint || "";
        const wrap = document.createElement("div");
        wrap.appendChild(btn);
        if (c.hint) wrap.appendChild(hint);
        UI.dlgChoices.appendChild(wrap);
      });
    }

    pickDialog(i) {
      const dlg = Dialogs.top();
      if (!dlg) return;
      const choice = dlg.choices[i];
      if (choice?.act) choice.act();
      Dialogs.pop();
      UI.dialog.style.display = "none";
      this.state = "play";
    }

    lose(text, bad = false) {
      this.state = "end";
      UI.end.style.display = "grid";
      UI.endTitle.textContent = bad ? "BAD ENDING" : "SIGNAL LOST";
      UI.endBody.textContent = text;
      AudioSys.setIntensity(bad ? 0.95 : 0.6, "frenetic");
      AudioSys.ping("hit", 1.0);
    }

    win(text) {
      this.state = "end";
      UI.end.style.display = "grid";
      UI.endTitle.textContent = "RUN COMPLETE";
      UI.endBody.textContent = text;
      AudioSys.setIntensity(0.35, "atmosphere");
      AudioSys.ping("hit", 0.7);
    }

    startRun({ name, avatar, missionId, allowImages, allowConfusion, hardAudio }) {
      this.state = "play";
      this.time = 0;

      // settings
      ASSETS.allowImages = !!allowImages;
      Input.confusionEnabled = !!allowConfusion;
      Input.confusionT = 0;
      AudioSys.setHard(!!hardAudio);

      // reset
      this.world.reset();
      this.atmo = new AtmosphereManager();
      this.tension = new Tension();
      this.fx = new VisualFX();
      this.fx.allowFaces = true;

      this.enemies.length = 0;
      this.bullets.length = 0;
      this.particles.length = 0;
      this.decals.length = 0;
      this.pickups.length = 0;

      this.player = new Player(name, avatar);
      this.friend = null;

      this.mission = new Mission(missionId);

      this.daughter = null;
      this.daughterSpawned = false;
      this.daughterSaved = false;

      this.spawnAcc = 0;
      this.lastDilemmaAt = 16;
      this._mercy = 0;

      this.whisper(`WELCOME, ${name}. THE WARD DOESN'T FORGET NAMES.`, 2.2);

      // early “note” message
      this.openDialog(new Dialogue({
        title: "ARCHIVE NOTE",
        body:
          avatar === 1
            ? `${name}, the corridor is a ritual circle.\nYour steps are syllables.\n\nThe ward will test what you protect.`
            : avatar === 2
            ? `${name}, the asylum respects force.\nBut it punishes waste.\n\nDo not shoot what you need to save.`
            : `${name}, a note is pinned to a bin:\n"LIGHT ISN'T SAFETY."\n\nKeep moving. Watch the fog.`,
        choices: [
          { label: "Continue.", hint: "The ward resumes breathing.", act: () => {} }
        ]
      }));
    }

    update(dt) {
      if (this.state !== "play") return;

      this.time += dt;
      if (this.whisperT > 0) this.whisperT -= dt;

      // camera follows player
      const target = this.player.x - RW * 0.33;
      this.world.camx = lerp(this.world.camx, target, 1 - Math.pow(0.00025, dt));
      this.world.camx = Math.max(0, this.world.camx);

      // atmosphere & tension
      this.atmo.update(dt, this);
      this.tension.update(dt, this);
      AudioSys.setIntensity(this.tension.heat, this.tension.mode);

      // mission
      this.mission.update(dt, this);

      // spawn daughter
      this.maybeSpawnDaughter();

      // update props
      for (const pr of this.world.props) {
        // props don't move, but keep for extensibility
      }

      // update player
      if (Input.wantSwap()) {
        this.player.swapWeapon();
        this.whisper(`WEAPON: ${this.player.currentWeapon().name}`, 1.2);
      }
      this.player.update(dt, this);

      // friend
      if (this.player.hasFriend) {
        if (!this.friend) this.friend = new Companion(this.player);
        this.friend.update(dt, this);
      } else {
        this.friend = null;
      }

      // daughter
      if (this.daughter) {
        this.daughter.update(dt, this);

        // interact to save
        if (Input.wantInteract() && !this.daughter.saved) {
          if (aabb(this.player.x, this.player.y, this.player.w, this.player.h, this.daughter.x, this.daughter.y, this.daughter.w, this.daughter.h)) {
            this.daughter.saved = true;
            this.daughterSaved = true;
            this.player.soothe(18);
            this.fx.triggerPaletteShift(1.5);
            this.whisper("SHE IS REAL ENOUGH TO HOLD.", 2.0);
          }
        }
      }

      // spawn enemies based on tension
      this.spawnAcc += dt;
      const d = this.difficulty();

      // In atmosphere mode: almost no enemies (exploration)
      // In frenetic mode: spawns
      const doSpawn = (this.tension.mode === "frenetic");

      if (doSpawn && this.spawnAcc > d.spawnEvery) {
        this.spawnAcc = 0;
        this.spawnEnemyWave();
      }

      // update enemies
      for (const e of this.enemies) e.update(dt, this);
      this.enemies = this.enemies.filter(e => !e.dead);

      // bullets
      for (const b of this.bullets) b.update(dt, this);
      this.bullets = this.bullets.filter(b => !b.dead);

      // pickups
      for (const p of this.pickups) p.update(dt, this);
      this.pickups = this.pickups.filter(p => !p.dead);

      // particles/decals
      for (const p of this.particles) p.update(dt);
      this.particles = this.particles.filter(p => p.life > 0);
      for (const dcl of this.decals) dcl.update(dt);

      // resolve bullet hits vs enemies/props/daughter
      this.resolveCombat();

      // occasional dilemma/lore
      this.triggerDilemmaOnce();

      // loss checks
      if (this.player.hp <= 0) {
        this.lose("Your body gives up.\n\nThe ward keeps walking.\nIt steps over you like a thought.", false);
      }
      if (this.player.san <= 0) {
        this.lose("Your mind fractures.\n\nThe fog learns your face.\nIt wears it.", false);
      }

      // update FX timers
      this.fx.update(dt);

      // degrade effects by status
      if (this.player.status.wiggleT > 0) this.fx.triggerWiggle(0.2);
      if (this.player.status.memoryT > 0) this.fx.triggerMemory(0.2);

      // small random face flashes under high tension
      if (this.tension.mode === "frenetic" && chance(0.003)) {
        this.fx.triggerFace(ASSETS.get("assets/face2.png"), 0.15);
      }
    }

    resolveCombat() {
      // bullets hit props first
      for (const b of this.bullets) {
        if (b.dead) continue;

        // props
        for (const pr of this.world.props) {
          if (pr.broken) continue;
          const box = pr.aabb();
          if (aabb(b.x, b.y, b.w, b.h, box.x, box.y, box.w, box.h)) {
            b.dead = true;
            const drop = pr.hit(this, "bullet");
            if (drop) this.spawnPickup(pr.x + pr.w / 2, this.world.groundY - 16, drop);
            this.spawnParticle(b.x, b.y, "spark");
            break;
          }
        }
        if (b.dead) continue;

        // daughter = instant bad ending (if not saved)
        if (this.daughter && !this.daughter.saved) {
          if (aabb(b.x, b.y, b.w, b.h, this.daughter.x, this.daughter.y, this.daughter.w, this.daughter.h)) {
            b.dead = true;
            for (let i = 0; i < 46; i++) this.spawnParticle(this.daughter.cx, this.daughter.cy, chance(0.6) ? "blood" : "gib");
            this.addDecal(this.daughter.cx, this.world.groundY - 1, "blood");
            this.lose("YOU SHOT THE DAUGHTER.\n\nBad Ending:\nThe ward stops pretending you were a person.", true);
            return;
          }
        }

        // enemies
        for (const e of this.enemies) {
          if (e.dead) continue;
          if (aabb(b.x, b.y, b.w, b.h, e.x, e.y, e.w, e.h)) {
            b.dead = true;
            e.hit(b.dmg, this);
            break;
          }
        }
      }
    }

    draw() {
      // palette
      this.pal = this.atmo.palette();

      // background
      this.world.drawBackground(bctx, this.pal, this.time);

      // decals
      for (const d of this.decals) d.draw(bctx, this.world.camx);

      // solids/obstacles
      this.world.drawSolids(bctx, this.pal);

      // props
      for (const pr of this.world.props) pr.draw(bctx, this.world.camx, this.pal, this.time);

      // pickups
      for (const p of this.pickups) p.draw(bctx, this.world.camx, this.pal);

      // daughter
      if (this.daughter) this.daughter.draw(bctx, this.world.camx, this.pal);

      // enemies
      for (const e of this.enemies) e.draw(bctx, this.world.camx, this.pal);

      // bullets
      for (const b of this.bullets) b.draw(bctx, this.world.camx, this.pal);

      // friend
      if (this.friend) this.friend.draw(bctx, this.world.camx, this.pal);

      // player
      if (this.player) this.player.draw(bctx, this.world.camx, this.pal);

      // laser beam overlay
      if (this._laser && this._laser.t > 0) {
        this._laser.t -= 1 / 60;
        bctx.globalAlpha = 0.85;
        bctx.strokeStyle = this.pal.accent;
        bctx.beginPath();
        bctx.moveTo((this._laser.x0 - this.world.camx) | 0, this._laser.y0 | 0);
        bctx.lineTo((this._laser.x1 - this.world.camx) | 0, this._laser.y1 | 0);
        bctx.stroke();
        bctx.globalAlpha = 1;
      }

      // lighting / fog mask (lantern)
      if (this.player) {
        const px = (this.player.cx - this.world.camx) | 0;
        const py = (this.player.cy) | 0;
        const rad = this.player.lantern;

        const fog = bctx.createRadialGradient(px, py, rad * 0.2, px, py, rad * 1.55);
        fog.addColorStop(0, "rgba(0,0,0,0)");
        fog.addColorStop(0.55, "rgba(0,0,0,0.48)");
        fog.addColorStop(1, this.pal.fog);
        bctx.fillStyle = fog;
        bctx.fillRect(0, 0, RW, RH);
      }

      // particles
      for (const p of this.particles) p.draw(bctx, this.world.camx);

      // whisper / UI text
      if (this.whisperT > 0) {
        bctx.globalAlpha = clamp(this.whisperT / 2, 0, 1) * 0.9;
        bctx.fillStyle = this.pal.ui;
        bctx.font = "10px ui-monospace, monospace";
        bctx.fillText(this.whisperText, 8, RH - 10);
        bctx.globalAlpha = 1;
      }

      // crosshair
      if (this.state === "play") {
        const mx = clamp(Input.mouse.x, 0, RW) | 0;
        const my = clamp(Input.mouse.y, 0, RH) | 0;
        bctx.globalAlpha = 0.85;
        bctx.strokeStyle = "#999";
        bctx.beginPath();
        bctx.moveTo(mx - 4, my); bctx.lineTo(mx - 1, my);
        bctx.moveTo(mx + 1, my); bctx.lineTo(mx + 4, my);
        bctx.moveTo(mx, my - 4); bctx.lineTo(mx, my - 1);
        bctx.moveTo(mx, my + 1); bctx.lineTo(mx, my + 4);
        bctx.stroke();
        bctx.globalAlpha = 1;
      }

      // post FX
      this.fx.postProcess(bctx, this);

      // blit to screen
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);
      ctx.drawImage(buf, 0, 0, RW, RH, DX, DY, RW * SCALE, RH * SCALE);

      // HUD update
      this.updateHud();
    }

    updateHud() {
      if (!this.player) return;

      UI.uiHp.style.width = `${clamp((this.player.hp / this.player.hpMax) * 100, 0, 100)}%`;
      UI.uiSan.style.width = `${clamp((this.player.san / this.player.sanMax) * 100, 0, 100)}%`;

      const st = [];
      if (Input.confusionT > 0) st.push("CONFUSION");
      if (this.player.status.slowT > 0) st.push("SLOW");
      if (this.player.status.griefT > 0) st.push("GRIEF");
      if (this.player.status.wiggleT > 0) st.push("WIGGLE");
      if (this.player.status.memoryT > 0) st.push("MEMORY");
      if (this.player.hasFriend) st.push(this.player.friendBoostT > 0 ? "FRIEND+" : "FRIEND");
      st.push(this.player.currentWeapon().id);

      UI.uiStatus.textContent = st.join(" · ");

      UI.uiMission.textContent = this.mission?.title() || "";
      if (this.mission?.id === "SURVIVE_120") {
        const t = Math.ceil(this.mission.timeLeft);
        const mm = String(Math.floor(t / 60)).padStart(1, "0");
        const ss = String(t % 60).padStart(2, "0");
        UI.uiTimer.textContent = `TIME: ${mm}:${ss}`;
      } else {
        UI.uiTimer.textContent = `DEPTH: ${(this.player.x / 10) | 0}m`;
      }

      UI.uiMode.textContent = (this.tension.mode === "frenetic") ? "FRENETIC" : "ATMOSPHERE";
    }
  }

  const game = new Game();

  /********************************************************************
   * Loop
   ********************************************************************/
  let last = performance.now();
  function loop(t) {
    const dt = Math.min(0.033, (t - last) / 1000);
    last = t;

    // Dialog shortcuts
    if (game.state === "dialog" && Dialogs.active) {
      if (Input._justPressed("Space")) game.pickDialog(0);
    }

    game.update(dt);
    game.draw();

    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  /********************************************************************
   * UI wiring
   ********************************************************************/
  UI.btnRestart.onclick = () => location.reload();

  UI.btnMute.onclick = async () => {
    await AudioSys.init();
    AudioSys.setMuted(!AudioSys.muted);
    UI.btnMute.textContent = AudioSys.muted ? "AUDIO: OFF" : "AUDIO: ON";
  };

  UI.btnStart.onclick = async () => {
    await AudioSys.init();

    // load optional assets (non-blocking but quick)
    ASSETS.allowImages = !!UI.optImages.checked;
    await ASSETS.loadList(OPTIONAL_ASSET_LIST);

    // start
    UI.menu.style.display = "none";
    UI.end.style.display = "none";
    UI.dialog.style.display = "none";

    game.startRun({
      name: (UI.inName.value || "SEEKER").trim().slice(0, 14),
      avatar: UI.getSelectedAvatar(),
      missionId: UI.inMission.value,
      allowImages: UI.optImages.checked,
      allowConfusion: UI.optConfusion.checked,
      hardAudio: UI.optHardAudio.checked
    });

    // turn audio on automatically once user starts (browser gesture)
    AudioSys.setMuted(false);
    UI.btnMute.textContent = "AUDIO: ON";
  };

  // prevent stuck black screen if user never clicks anything:
  // we still render menu overlay + background
  game.pal = PALETTES.ward;

})();

