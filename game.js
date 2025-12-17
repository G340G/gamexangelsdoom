/* LO-FI ANGELS // ASYLUM PROTOCOL (Deep Edition)
   - Vanilla JS, GitHub Pages ready, no external URLs
   - Psychological Madness Episodes (hidden triggers per run)
   - Inversion rules during Madness (30s visible timer)
   - Score system + breakdown + persistent badges (localStorage)
   - Boss: Termite Saint (worm) spawning larval patients
   - Ward moods + atmosphere shifts + abrasive procedural audio
*/

(() => {
  "use strict";

  /********************************************************************
   * Utils
   ********************************************************************/
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const randi = (a, b) => (a + Math.floor(Math.random() * (b - a + 1)));
  const rand = (a, b) => a + Math.random() * (b - a);
  const chance = (p) => Math.random() < p;

  function aabb(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }
  function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }

  /********************************************************************
   * Canvas: internal buffer for pixel vibe
   ********************************************************************/
  const canvas = document.getElementById("game") || (() => {
    const c = document.createElement("canvas");
    c.id = "game";
    document.body.appendChild(c);
    return c;
  })();

  const RW = 480, RH = 270;
  const buf = document.createElement("canvas");
  buf.width = RW; buf.height = RH;
  const bctx = buf.getContext("2d", { alpha: false });
  const ctx = canvas.getContext("2d", { alpha: false });

  let W = 0, H = 0, SCALE = 1, DX = 0, DY = 0;
  function resize() {
    W = canvas.width = Math.floor(window.innerWidth);
    H = canvas.height = Math.floor(window.innerHeight);
    SCALE = Math.max(1, Math.floor(Math.min(W / RW, H / RH)));
    DX = ((W - RW * SCALE) / 2) | 0;
    DY = ((H - RH * SCALE) / 2) | 0;
    ctx.imageSmoothingEnabled = false;
    bctx.imageSmoothingEnabled = false;
  }
  window.addEventListener("resize", resize);
  resize();

  /********************************************************************
   * Palettes / Atmospheres
   ********************************************************************/
  const PALETTES = {
    ward: {
      bg:"#050506", ground:"#0b0b0f", solid:"#15151b",
      ui:"#e8e8f4", dim:"#8d8da6",
      accent:"#7d3cff", danger:"#ff2a2a",
      child:"#00ffaa", fog:"rgba(0,0,0,0.92)",
      blood:"#b0122a", gore:"#4a0b18", glass:"#7de7ff", sick:"#a5ff5a",
    },
    chapel: {
      bg:"#030304", ground:"#08080b", solid:"#13131a",
      ui:"#f0f0f6", dim:"#9a9ab6",
      accent:"#ffcc00", danger:"#ff3355",
      child:"#00ffaa", fog:"rgba(0,0,0,0.95)",
      blood:"#b0122a", gore:"#4a0b18", glass:"#9bf2ff", sick:"#e5ff7a",
    },
    meltdown: {
      bg:"#040307", ground:"#090812", solid:"#190f2c",
      ui:"#f7efff", dim:"#b2a6c9",
      accent:"#ff3cff", danger:"#ff2a2a",
      child:"#00ffaa", fog:"rgba(0,0,0,0.90)",
      blood:"#c10f33", gore:"#59061a", glass:"#b6f6ff", sick:"#b9ff6a",
    }
  };

  const WARD_MOODS = [
    { id:"SULLEN",  label:"Sullen Ward",  desc:"Fewer enemies, more notes, slower dread.", spawnMul:0.8, chestMul:0.9, triggerMul:1.2 },
    { id:"HUNGRY",  label:"Hungry Ward",  desc:"More enemies, more drops, louder corridors.", spawnMul:1.15, chestMul:1.1, triggerMul:1.0 },
    { id:"DEVOUT",  label:"Devout Ward",  desc:"More Wailers & Memory, reality bends politely.", spawnMul:1.0, chestMul:0.95, triggerMul:1.25 },
    { id:"CARNIVAL",label:"Carnival Ward",desc:"More chests, more confusion, more laughs (none yours).", spawnMul:1.05, chestMul:1.25, triggerMul:1.15 },
  ];

  /********************************************************************
   * UI injection (no external files needed)
   ********************************************************************/
  function injectCSS() {
    const css = `
      html,body{margin:0;height:100%;background:#000;overflow:hidden;font-family:ui-monospace,Menlo,Consolas,monospace}
      #game{position:fixed;inset:0;width:100%;height:100%;image-rendering:pixelated;display:block;background:#000}
      .gOverlay{position:fixed;inset:0;display:grid;place-items:center;z-index:50;background:rgba(0,0,0,.86)}
      .gPanel{width:min(960px,94vw);background:#0f0f14;border:1px solid #2b2b35;box-shadow:0 0 34px rgba(0,0,0,.65);padding:18px 18px 16px}
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
      .gCard{border:1px solid #2b2b35;background:#0a0a0f;padding:10px;cursor:pointer;opacity:.78}
      .gCard:hover{opacity:1}
      .gCard.sel{border-color:#7d3cff;opacity:1;background:#130c1f}
      .gTiny{color:#7f7f98;font-size:11px;line-height:1.6}
      .gHud{position:fixed;left:12px;right:12px;top:10px;z-index:40;display:flex;justify-content:space-between;pointer-events:none;mix-blend-mode:difference}
      .gBars{display:grid;gap:6px}
      .gStat{color:#fff;font-size:10px;letter-spacing:1px;text-transform:uppercase}
      .gBar{width:140px;height:5px;background:#2a2a33;position:relative}
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
      .toastWrap{position:fixed;right:12px;top:56px;z-index:60;display:grid;gap:8px;pointer-events:none}
      .toast{background:rgba(0,0,0,.75);border:1px solid #2b2b35;padding:8px 10px;color:#fff;font-size:11px;letter-spacing:1px;text-transform:uppercase;box-shadow:0 0 18px rgba(0,0,0,.5)}
      .bossBar{position:fixed;left:50%;top:10px;transform:translateX(-50%);z-index:45;pointer-events:none;display:none}
      .bossName{color:#fff;font-size:10px;letter-spacing:2px;text-transform:uppercase;text-align:center;margin-bottom:4px;mix-blend-mode:difference}
      .bossTrack{width:260px;height:6px;background:#2a2a33}
      .bossFill{height:100%;width:100%;background:#ff2a2a}
    `;
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
  }

  function makeUI() {
    injectCSS();

    const crt = document.createElement("div");
    crt.className = "gCrt";
    document.body.appendChild(crt);

    const toasts = document.createElement("div");
    toasts.className = "toastWrap";
    document.body.appendChild(toasts);

    const boss = document.createElement("div");
    boss.className = "bossBar";
    boss.innerHTML = `
      <div class="bossName" id="bossName">BOSS</div>
      <div class="bossTrack"><div class="bossFill" id="bossFill"></div></div>
    `;
    document.body.appendChild(boss);

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
        <div class="gStat" id="uiMadness" style="display:none"></div>
      </div>
      <div class="gRight">
        <div class="gStat" id="uiScore">SCORE: 0</div>
        <div class="gStat" id="uiMission"></div>
        <div class="gStat" id="uiTimer"></div>
        <div class="gStat gFade" id="uiMode"></div>
        <div class="gStat gFade" id="uiMood"></div>
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
          WASD move · SPACE jump · Mouse aim · Click shoot · E interact · Q swap weapon
          <br><span style="color:#ff2a2a">WARNING:</span> The ward contains hidden triggers. When you break, rules invert for 30 seconds.
        </p>

        <div class="gRow">
          <div class="gField">
            <div class="gLabel">IDENTITY</div>
            <input id="inName" class="gInput" maxlength="14" value="SEEKER" />
            <div class="gTiny">
              Madness triggers are <b>unknown</b> and change per run. Your actions are watched, counted, and misinterpreted.
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
              Runs are winnable, but mood + hidden triggers can make some runs harsh even for veterans.
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
        <div style="margin-top:10px" class="gTiny">Press SPACE to pick choice 1 quickly.</div>
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
        <div style="margin-top:14px" class="gTiny" id="endBadges"></div>
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

    function toast(msg) {
      const t = document.createElement("div");
      t.className = "toast";
      t.textContent = msg;
      toasts.appendChild(t);
      setTimeout(() => { t.style.opacity = "0"; }, 1600);
      setTimeout(() => { if (t.parentNode) t.parentNode.removeChild(t); }, 2100);
    }

    return {
      menu, dialog, end,
      btnStart: menu.querySelector("#btnStart"),
      btnMute: menu.querySelector("#btnMute"),
      btnRestart: end.querySelector("#btnRestart"),
      inName: menu.querySelector("#inName"),
      inMission: menu.querySelector("#inMission"),
      optImages: menu.querySelector("#optImages"),
      optConfusion: menu.querySelector("#optConfusion"),
      optHardAudio: menu.querySelector("#optHardAudio"),
      getAvatar: () => selAvi,

      uiHp: hud.querySelector("#uiHp"),
      uiSan: hud.querySelector("#uiSan"),
      uiStatus: hud.querySelector("#uiStatus"),
      uiMadness: hud.querySelector("#uiMadness"),
      uiScore: hud.querySelector("#uiScore"),
      uiMission: hud.querySelector("#uiMission"),
      uiTimer: hud.querySelector("#uiTimer"),
      uiMode: hud.querySelector("#uiMode"),
      uiMood: hud.querySelector("#uiMood"),

      dlgTitle: dialog.querySelector("#dlgTitle"),
      dlgBody: dialog.querySelector("#dlgBody"),
      dlgChoices: dialog.querySelector("#dlgChoices"),

      endTitle: end.querySelector("#endTitle"),
      endBody: end.querySelector("#endBody"),
      endBadges: end.querySelector("#endBadges"),

      bossWrap: boss,
      bossName: boss.querySelector("#bossName"),
      bossFill: boss.querySelector("#bossFill"),

      toast
    };
  }

  const UI = makeUI();

  /********************************************************************
   * Input (stable; confusion is timed, not random per frame)
   ********************************************************************/
  const Input = {
    keys: Object.create(null),
    mouse: { x: 0, y: 0, down: false },
    confusionEnabled: true,
    confusionT: 0,
    _pressed: Object.create(null),
    _justPressed(code) {
      const v = !!this.keys[code];
      const was = !!this._pressed[code];
      this._pressed[code] = v;
      return v && !was;
    },
    readDir() {
      let left = !!this.keys["KeyA"];
      let right = !!this.keys["KeyD"];
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
    Input.mouse.x = clamp(mx, 0, 1) * RW;
    Input.mouse.y = clamp(my, 0, 1) * RH;
  });
  window.addEventListener("mousedown", () => { Input.mouse.down = true; });
  window.addEventListener("mouseup", () => { Input.mouse.down = false; });

  /********************************************************************
   * Simple Event Bus
   ********************************************************************/
  class Bus {
    constructor(){ this.m = new Map(); }
    on(ev, fn){
      if(!this.m.has(ev)) this.m.set(ev, []);
      this.m.get(ev).push(fn);
    }
    emit(ev, payload){
      const a = this.m.get(ev);
      if(!a) return;
      for(const fn of a) fn(payload);
    }
  }

  /********************************************************************
   * Optional Assets (local only)
   ********************************************************************/
  class Assets {
    constructor(){ this.allowImages = true; this.img = new Map(); this.ready=false; }
    loadList(list){
      const ps = list.map(p => this.load(p));
      return Promise.allSettled(ps).then(()=>{ this.ready=true; });
    }
    load(path){
      return new Promise(res=>{
        const im = new Image();
        im.onload=()=>{ this.img.set(path, im); res(true); };
        im.onerror=()=>{ this.img.set(path, null); res(false); };
        im.src = path;
      });
    }
    get(path){ return this.allowImages ? (this.img.get(path) || null) : null; }
  }

  const ASSETS = new Assets();
  const OPTIONAL_ASSET_LIST = [
    "assets/player.png",
    "assets/angel.png",
    "assets/fiend.png",
    "assets/golem.png",
    "assets/crazy.png",
    "assets/wailer.png",
    "assets/larva.png",
    "assets/daughter.png",
    "assets/face1.png","assets/face2.png","assets/face3.png",
    "assets/worm.png"
  ];

  /********************************************************************
   * Procedural pixel sprite renderer
   ********************************************************************/
  function drawPixelSprite(ctx, x, y, frame, kind, pal) {
    const t = frame;
    const wob = Math.sin(t * 0.35) * 1.2;
    const px = (v) => (x + v) | 0;
    const py = (v) => (y + v) | 0;

    function eye(cx, cy, angry = false, color="#ff3344") {
      ctx.fillStyle = "#111";
      ctx.fillRect(px(cx), py(cy), 3, 2);
      ctx.fillStyle = color;
      ctx.fillRect(px(cx + 1), py(cy + 1), 1, 1);
      if (angry) {
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.moveTo(px(cx - 1), py(cy - 1));
        ctx.lineTo(px(cx + 3), py(cy));
        ctx.stroke();
      }
    }

    if (kind === "player") {
      ctx.fillStyle = "#1b1b22"; ctx.fillRect(px(4), py(6), 10, 18);
      ctx.fillStyle = "#2a2a36"; ctx.fillRect(px(5), py(7), 8, 16);
      ctx.fillStyle = "#d8d8e2"; ctx.fillRect(px(6), py(2), 6, 5);
      ctx.fillStyle = "#111"; ctx.fillRect(px(6), py(4), 6, 2);
      ctx.fillStyle = "#7de7ff"; ctx.fillRect(px(9), py(4), 2, 1);
      ctx.fillStyle = "#0e0e13";
      const step = (Math.sin(t * 0.6) * 2) | 0;
      ctx.fillRect(px(5), py(24), 3, 5);
      ctx.fillRect(px(10 + step), py(24), 3, 5);
      ctx.fillStyle = "#4b4b5a"; ctx.fillRect(px(14), py(12), 6, 2);
      ctx.fillStyle = pal.accent; ctx.fillRect(px(16), py(13), 2, 1);
      return;
    }

    if (kind === "daughter") {
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = pal.child;
      ctx.beginPath(); ctx.arc(px(8), py(10), 13, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1;
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

    if (kind === "daughterShade") {
      // hallucination target during Madness
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = pal.danger;
      ctx.beginPath(); ctx.arc(px(8), py(10), 14, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = pal.danger;
      ctx.beginPath();
      ctx.moveTo(px(8), py(1));
      ctx.lineTo(px(15), py(26));
      ctx.lineTo(px(1), py(26));
      ctx.fill();
      eye(6, 8, true, "#fff000");
      eye(10, 8, true, "#fff000");
      ctx.fillStyle = "#000";
      ctx.fillRect(px(7), py(14), 2, 3);
      return;
    }

    if (kind === "angel") {
      ctx.fillStyle = "#2a0a12"; ctx.fillRect(px(4), py(8), 12, 12);
      ctx.fillStyle = pal.danger; ctx.fillRect(px(5), py(9), 10, 10);
      ctx.fillStyle = "#09090b"; ctx.fillRect(px(6), py(4), 8, 5);
      eye(7, 5, true); eye(11, 5, true);
      ctx.fillStyle = "#ff7a8b";
      ctx.fillRect(px(3), py(11), 1, 2); ctx.fillRect(px(16), py(11), 1, 2);
      ctx.fillStyle = "#1a1a22";
      const s = (Math.sin(t * 0.55) * 2) | 0;
      ctx.fillRect(px(6), py(20), 3, 6);
      ctx.fillRect(px(11 + s), py(20), 3, 6);
      return;
    }

    if (kind === "fiend") {
      ctx.fillStyle = "#16060a"; ctx.fillRect(px(3), py(7), 14, 14);
      ctx.fillStyle = "#ff1f3a"; ctx.fillRect(px(4), py(8), 12, 12);
      ctx.fillStyle = "#ffd2da";
      ctx.fillRect(px(4), py(5), 1, 2);
      ctx.fillRect(px(7), py(4), 1, 3);
      ctx.fillRect(px(10), py(4), 1, 3);
      ctx.fillRect(px(13), py(5), 1, 2);
      ctx.fillStyle = "#0b0b0f";
      ctx.fillRect(px(6), py(11), 3, 2);
      ctx.fillRect(px(11), py(11), 3, 2);
      ctx.fillStyle = "#fff000";
      ctx.fillRect(px(7), py(12), 1, 1);
      ctx.fillRect(px(12), py(12), 1, 1);
      ctx.fillStyle = "#b1002a";
      ctx.fillRect(px(2), py(18), 2, 2);
      ctx.fillRect(px(16), py(18), 2, 2);
      return;
    }

    if (kind === "golem") {
      ctx.fillStyle = "#0f0f14"; ctx.fillRect(px(4), py(6), 12, 18);
      ctx.fillStyle = "#2d2d38"; ctx.fillRect(px(5), py(7), 10, 16);
      ctx.fillStyle = "#1a1a22"; ctx.fillRect(px(6), py(9), 8, 4);
      ctx.fillStyle = "#111"; ctx.fillRect(px(7), py(12), 2, 1); ctx.fillRect(px(11), py(12), 2, 1);
      ctx.fillStyle = pal.sick; ctx.fillRect(px(8), py(12), 1, 1); ctx.fillRect(px(12), py(12), 1, 1);
      const s = (Math.sin(t * 0.25) * 1) | 0;
      ctx.fillStyle = "#111118";
      ctx.fillRect(px(6), py(24), 3, 6);
      ctx.fillRect(px(11 + s), py(24), 3, 6);
      return;
    }

    if (kind === "crazy") {
      const twitch = (Math.sin(t * 1.3) * 2) | 0;
      ctx.fillStyle = "#121218"; ctx.fillRect(px(7), py(5), 6, 16);
      ctx.fillStyle = "#e0e0ea"; ctx.fillRect(px(8 + twitch), py(2), 4, 4);
      ctx.fillStyle = "#111"; ctx.fillRect(px(9 + twitch), py(3), 1, 1); ctx.fillRect(px(11 + twitch), py(3), 1, 1);
      ctx.fillStyle = pal.danger; ctx.fillRect(px(10 + twitch), py(3), 1, 1);
      ctx.fillStyle = "#1a1a22"; ctx.fillRect(px(5), py(10), 2, 8); ctx.fillRect(px(13), py(10), 2, 8);
      const s = (Math.sin(t * 0.9) * 2) | 0;
      ctx.fillRect(px(7), py(21), 2, 7);
      ctx.fillRect(px(11 + s), py(21), 2, 7);
      return;
    }

    if (kind === "wailer") {
      ctx.fillStyle = "rgba(125,60,255,0.18)";
      ctx.beginPath(); ctx.arc(px(10), py(12 + wob), 12, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = "#1a0626"; ctx.fillRect(px(5), py(6 + wob), 10, 14);
      ctx.fillStyle = pal.accent; ctx.fillRect(px(6), py(7 + wob), 8, 12);
      ctx.fillStyle = "#000"; ctx.fillRect(px(8), py(15 + wob), 4, 3);
      eye(7, 10 + wob, false, "#ffccff"); eye(11, 10 + wob, false, "#ffccff");
      return;
    }

    if (kind === "larva") {
      // flesh-eating patient (small fast)
      ctx.fillStyle = "#0b0b10"; ctx.fillRect(px(3), py(10), 12, 8);
      ctx.fillStyle = pal.blood; ctx.fillRect(px(4), py(11), 10, 6);
      ctx.fillStyle = "#fff000"; ctx.fillRect(px(12), py(12), 2, 1);
      ctx.fillStyle = "#000"; ctx.fillRect(px(5), py(13), 5, 1);
      // little legs
      ctx.fillStyle = "#111";
      const s = (Math.sin(t*0.9)*1)|0;
      ctx.fillRect(px(5), py(18+s), 2, 2);
      ctx.fillRect(px(10), py(18-s), 2, 2);
      return;
    }
  }

  /********************************************************************
   * Audio (procedural)
   ********************************************************************/
  const AudioSys = {
    ctx:null, master:null, muted:true, hard:true, intensity:0.25, mode:"atmosphere",
    _nodes:null,
    async init(){
      if(this.ctx) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0;
      this.master.connect(this.ctx.destination);

      const noiseBuf = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for(let i=0;i<d.length;i++) d[i] = (Math.random()*2-1)*0.9;

      const noise = this.ctx.createBufferSource(); noise.buffer=noiseBuf; noise.loop=true;
      const noiseGain = this.ctx.createGain(); noiseGain.gain.value = 0;

      const drone1 = this.ctx.createOscillator(); drone1.type="sawtooth"; drone1.frequency.value=52;
      const drone2 = this.ctx.createOscillator(); drone2.type="triangle"; drone2.frequency.value=104;
      const droneGain = this.ctx.createGain(); droneGain.gain.value=0;

      const lp = this.ctx.createBiquadFilter(); lp.type="lowpass"; lp.frequency.value=200;
      const hp = this.ctx.createBiquadFilter(); hp.type="highpass"; hp.frequency.value=38;

      const pulse = this.ctx.createOscillator(); pulse.type="square"; pulse.frequency.value=2;
      const pulseGain = this.ctx.createGain(); pulseGain.gain.value=0;

      const lfo = this.ctx.createOscillator(); lfo.type="sine"; lfo.frequency.value=0.14;
      const lfoGain = this.ctx.createGain(); lfoGain.gain.value=55;
      lfo.connect(lfoGain); lfoGain.connect(lp.frequency);

      noise.connect(hp).connect(noiseGain).connect(lp).connect(this.master);
      drone1.connect(droneGain).connect(lp);
      drone2.connect(droneGain).connect(lp);
      pulse.connect(pulseGain).connect(this.master);

      noise.start(); drone1.start(); drone2.start(); pulse.start(); lfo.start();

      this._nodes = { noiseGain, droneGain, pulseGain, lp };
      this.setMuted(true);
    },
    setMuted(m){
      this.muted = m;
      if(!this.master) return;
      const t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setTargetAtTime(m ? 0 : 0.28, t, 0.04);
    },
    setHard(v){ this.hard = v; },
    setIntensity(v, mode){
      this.intensity = clamp(v,0,1);
      this.mode = mode || this.mode;
      if(!this._nodes) return;
      const t = this.ctx.currentTime;
      const { noiseGain, droneGain, pulseGain, lp } = this._nodes;

      const base = this.muted ? 0 : 1;
      const hard = this.hard ? 1 : 0.55;

      droneGain.gain.setTargetAtTime(base*(0.05+this.intensity*0.15)*hard, t, 0.06);
      const nT = (this.mode==="atmosphere") ? (0.02+this.intensity*0.06) : (0.06+this.intensity*0.20);
      noiseGain.gain.setTargetAtTime(base*nT*hard, t, 0.05);

      const pT = (this.mode==="atmosphere") ? (0.00+this.intensity*0.03) : (0.03+this.intensity*0.13);
      pulseGain.gain.setTargetAtTime(base*pT*hard, t, 0.05);

      const f = (this.mode==="atmosphere") ? (160+this.intensity*160) : (260+this.intensity*980);
      lp.frequency.setTargetAtTime(f, t, 0.08);
    },
    ping(type="shoot", amp=0.7){
      if(!this.ctx || this.muted) return;
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      const f = this.ctx.createBiquadFilter();
      f.type="bandpass";
      f.frequency.value = (type==="hit") ? 120 : (type==="laser" ? 920 : 260);
      o.type = (type==="hit") ? "sawtooth" : (type==="laser" ? "square" : "triangle");
      o.frequency.setValueAtTime(type==="hit"?85:(type==="laser"?420:180), t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.12*amp, t+0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t+(type==="hit"?0.18:0.11));
      o.connect(f).connect(g).connect(this.master);
      o.start(t); o.stop(t+0.25);
    }
  };

  /********************************************************************
   * FX: particles, decals, post
   ********************************************************************/
  class Particle {
    constructor(x,y,kind,pal){
      this.x=x; this.y=y; this.kind=kind;
      this.vx=rand(-65,65);
      this.vy=rand(-95,40);
      this.life=rand(0.35,0.9);
      this.pal=pal;
      this.sz=(kind==="gib")?randi(2,4):randi(1,3);
    }
    update(dt){
      this.life-=dt;
      this.x+=this.vx*dt;
      this.y+=this.vy*dt;
      this.vy+=240*dt;
    }
    draw(ctx,camx){
      if(this.life<=0) return;
      ctx.globalAlpha = clamp(this.life*1.5,0,1);
      if(this.kind==="blood") ctx.fillStyle=this.pal.blood;
      else if(this.kind==="gib") ctx.fillStyle=this.pal.gore;
      else if(this.kind==="spark") ctx.fillStyle="#fff";
      else ctx.fillStyle="#aaa";
      ctx.fillRect((this.x-camx)|0, (this.y)|0, this.sz, this.sz);
      ctx.globalAlpha=1;
    }
  }

  class Decal {
    constructor(x,y,type,pal){
      this.x=x; this.y=y; this.type=type; this.pal=pal;
      this.r=randi(6,14);
    }
    update(_dt){}
    draw(ctx,camx){
      const x=(this.x-camx)|0, y=(this.y)|0;
      ctx.globalAlpha=0.75;
      ctx.fillStyle = (this.type==="blood") ? this.pal.blood : "#111";
      ctx.beginPath();
      ctx.ellipse(x,y,this.r,(this.r*0.55)|0,0,0,Math.PI*2);
      ctx.fill();
      ctx.globalAlpha=1;
    }
  }

  class VisualFX {
    constructor(){
      this.wiggleT=0; this.memoryT=0; this.paletteShiftT=0; this.glitchT=0;
      this.faceFlashT=0; this.faceImg=null; this.faceJitter=0;
      this.allowFaces=true;
    }
    triggerWiggle(t=4){ this.wiggleT=Math.max(this.wiggleT,t); }
    triggerMemory(t=4){ this.memoryT=Math.max(this.memoryT,t); }
    triggerGlitch(t=1.2){ this.glitchT=Math.max(this.glitchT,t); }
    triggerPaletteShift(t=3){ this.paletteShiftT=Math.max(this.paletteShiftT,t); }
    triggerFace(im,t=0.8){
      if(!this.allowFaces) return;
      this.faceImg=im||this.faceImg;
      this.faceFlashT=Math.max(this.faceFlashT,t);
      this.faceJitter=rand(2,7);
    }
    update(dt){
      this.wiggleT=Math.max(0,this.wiggleT-dt);
      this.memoryT=Math.max(0,this.memoryT-dt);
      this.paletteShiftT=Math.max(0,this.paletteShiftT-dt);
      this.glitchT=Math.max(0,this.glitchT-dt);
      this.faceFlashT=Math.max(0,this.faceFlashT-dt);
    }
    post(ctx, game){
      const pal = game.pal;
      const t = game.time;

      if(this.wiggleT>0){
        const amp = 3+(this.wiggleT*0.6);
        ctx.globalAlpha=0.9;
        for(let y=0;y<RH;y+=3){
          const off = Math.sin(t*8 + y*0.12)*amp;
          ctx.drawImage(buf,0,y,RW,3,off,y,RW,3);
        }
        ctx.globalAlpha=1;
      }

      if(this.glitchT>0){
        for(let i=0;i<8;i++){
          const y=randi(0,RH-8);
          const h=randi(2,10);
          const sx=randi(0,20);
          const dx=randi(-18,18);
          ctx.drawImage(buf,sx,y,RW-sx,h,dx,y,RW-sx,h);
        }
      }

      if(this.memoryT>0){
        ctx.globalAlpha = clamp(this.memoryT/4,0,1)*0.33;
        ctx.fillStyle="#000"; ctx.fillRect(0,0,RW,RH);

        const faces = ["assets/face1.png","assets/face2.png","assets/face3.png"]
          .map(p=>ASSETS.get(p)).filter(Boolean);

        if(faces.length){
          const im = faces[(Math.floor(game.time*2)%faces.length)];
          const s=220;
          const ox=(RW/2-s/2 + Math.sin(game.time*2)*10)|0;
          const oy=(RH/2-s/2 + Math.cos(game.time*1.7)*8)|0;
          for(let i=0;i<5;i++){
            ctx.globalAlpha=0.08;
            ctx.drawImage(im, ox+rand(-8,8), oy+rand(-8,8), s, s);
          }
          ctx.globalAlpha = clamp(this.memoryT/4,0,1)*0.22;
          ctx.drawImage(im, ox, oy, s, s);
        } else {
          ctx.globalAlpha=0.22;
          ctx.fillStyle=pal.accent; ctx.fillRect(140,60,200,160);
          ctx.fillStyle="#000"; ctx.fillRect(200,110,22,10); ctx.fillRect(260,110,22,10);
          ctx.fillRect(235,140,14,18);
        }
        ctx.globalAlpha=1;
      }

      if(this.paletteShiftT>0){
        ctx.globalAlpha=0.12+(this.paletteShiftT/10);
        ctx.fillStyle=pal.accent;
        ctx.fillRect(0,0,RW,RH);
        ctx.globalAlpha=1;
      }

      // grain
      ctx.globalAlpha=0.12;
      for(let i=0;i<140;i++){
        const x=randi(0,RW-1), y=randi(0,RH-1);
        ctx.fillStyle = (Math.random()<0.5) ? "#0b0b0b" : "#151515";
        ctx.fillRect(x,y,1,1);
      }
      ctx.globalAlpha=1;

      if(this.faceFlashT>0){
        ctx.globalAlpha=clamp(this.faceFlashT,0,1)*0.55;
        const im = this.faceImg || ASSETS.get("assets/face2.png");
        if(im){
          const s=240 + Math.sin(game.time*10)*12;
          const ox=(RW/2-s/2 + rand(-this.faceJitter,this.faceJitter))|0;
          const oy=(RH/2-s/2 + rand(-this.faceJitter,this.faceJitter))|0;
          ctx.drawImage(im, ox, oy, s, s);
        } else {
          ctx.fillStyle="#fff"; ctx.fillRect(0,0,RW,RH);
        }
        ctx.globalAlpha=1;
      }
    }
  }

  /********************************************************************
   * Props
   ********************************************************************/
  class Prop {
    constructor(x,y,kind){
      this.x=x; this.y=y; this.kind=kind;
      this.w = (kind==="bin")?16:(kind==="glass"?14:(kind==="chest"?18:14));
      this.h = (kind==="bin")?14:(kind==="glass"?18:(kind==="chest"?14:14));
      this.broken=false;
      this._wiggle=rand(0,10);
    }
    aabb(){ return {x:this.x,y:this.y,w:this.w,h:this.h}; }
    hit(game){
      if(this.broken) return null;
      this.broken=true;
      game.bus.emit("prop_break",{kind:this.kind,x:this.x,y:this.y});
      if(this.kind==="glass"){
        for(let i=0;i<18;i++) game.spawnParticle(this.x+this.w/2,this.y+this.h/2,"spark");
        game.fx.triggerGlitch(0.25);
        AudioSys.ping("hit",0.7);
        return chance(0.25)? "SAN":null;
      }
      if(this.kind==="bin"){
        for(let i=0;i<8;i++) game.spawnParticle(this.x+this.w/2,this.y+4,"spark");
        AudioSys.ping("hit",0.55);
        return chance(0.35)? (chance(0.5)?"HP":"SAN") : null;
      }
      if(this.kind==="potion"){
        AudioSys.ping("hit",0.75);
        if(chance(0.25)) return "CONFUSION";
        if(chance(0.40)) return "WIGGLE";
        return "MEMORY";
      }
      if(this.kind==="chest"){
        AudioSys.ping("hit",0.9);
        const roll=Math.random();
        if(roll<0.30) return "FRIEND";
        if(roll<0.52) return "LASER";
        if(roll<0.72) return "HP";
        if(roll<0.90) return "SAN";
        return "GLITCH";
      }
      return null;
    }
    draw(ctx,camx,pal,t){
      const x=(this.x-camx)|0, y=(this.y)|0;
      if(x<-30||x>RW+30) return;
      if(this.broken) ctx.globalAlpha=0.35;

      if(this.kind==="bin"){
        ctx.fillStyle="#101018"; ctx.fillRect(x,y,this.w,this.h);
        ctx.fillStyle="#1f1f2a"; ctx.fillRect(x+2,y+2,this.w-4,this.h-4);
        ctx.fillStyle="#000"; ctx.fillRect(x+3,y+5,this.w-6,2);
      } else if(this.kind==="glass"){
        ctx.fillStyle="rgba(125,231,255,0.14)"; ctx.fillRect(x,y,this.w,this.h);
        ctx.strokeStyle=pal.glass; ctx.strokeRect(x+1,y+1,this.w-2,this.h-2);
        ctx.fillStyle="rgba(255,255,255,0.15)"; ctx.fillRect(x+3,y+3,2,this.h-6);
      } else if(this.kind==="potion"){
        const bob=Math.sin(t*2+this._wiggle)*1.5;
        ctx.fillStyle="#0b0b10"; ctx.fillRect(x,y+bob,this.w,this.h);
        ctx.fillStyle=pal.accent; ctx.fillRect(x+3,y+5+bob,this.w-6,this.h-8);
        ctx.fillStyle="#fff"; ctx.fillRect(x+6,y+2+bob,this.w-12,3);
      } else if(this.kind==="chest"){
        ctx.fillStyle="#0b0b10"; ctx.fillRect(x,y+4,this.w,this.h-4);
        ctx.fillStyle="#1f102a"; ctx.fillRect(x+2,y+6,this.w-4,this.h-8);
        ctx.fillStyle=pal.accent; ctx.fillRect(x+7,y+10,4,2);
        ctx.strokeStyle="#2b2b35"; ctx.strokeRect(x+1,y+5,this.w-2,this.h-6);
      }
      ctx.globalAlpha=1;
    }
  }

  /********************************************************************
   * World
   ********************************************************************/
  class World {
    constructor(){ this.reset(); }
    reset(){
      this.camx=0;
      this.groundY=220;
      this.obstacles=[];
      this.props=[];
      this.exitX=2600;
      this._gen();
    }
    _gen(){
      let x=0;
      for(let i=0;i<220;i++){
        x += randi(42,90);
        if(chance(0.25)){
          const w=randi(14,34), h=randi(10,28);
          this.obstacles.push({x, y:this.groundY-h, w, h});
        }
        if(chance(0.28)){
          const roll=Math.random();
          let kind="bin";
          if(roll<0.35) kind="glass";
          else if(roll<0.58) kind="bin";
          else if(roll<0.80) kind="potion";
          else kind="chest";
          const px=x+randi(-10,20);
          const py=this.groundY-(kind==="glass"?18:14);
          this.props.push(new Prop(px,py,kind));
        }
      }
      this.exitX = x + 220;
    }
    drawBackground(ctx,pal,t, mood){
      ctx.fillStyle=pal.bg; ctx.fillRect(0,0,RW,RH);

      // distant blocks
      ctx.globalAlpha=0.18;
      ctx.fillStyle="#0a0a10";
      for(let i=0;i<14;i++){
        const bx = (((i*80)-(this.camx*0.35))%(RW+120))-60;
        const by = 40 + (i%3)*10;
        ctx.fillRect(bx|0, by|0, 60, 90);
      }
      ctx.globalAlpha=1;

      // subtle mood tint
      if(mood.id==="DEVOUT"){
        ctx.globalAlpha=0.05; ctx.fillStyle=pal.accent; ctx.fillRect(0,0,RW,RH); ctx.globalAlpha=1;
      } else if(mood.id==="CARNIVAL"){
        ctx.globalAlpha=0.035; ctx.fillStyle=pal.danger; ctx.fillRect(0,0,RW,RH); ctx.globalAlpha=1;
      }

      // ground
      ctx.fillStyle=pal.ground; ctx.fillRect(0,this.groundY,RW,RH-this.groundY);
      ctx.globalAlpha=0.25;
      ctx.strokeStyle="#101018";
      for(let y=this.groundY;y<RH;y+=6){
        ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(RW,y); ctx.stroke();
      }
      ctx.globalAlpha=1;
    }
    drawSolids(ctx,pal){
      ctx.fillStyle=pal.solid;
      for(const o of this.obstacles){
        const x=(o.x-this.camx)|0;
        if(x<-80||x>RW+80) continue;
        ctx.fillRect(x,o.y|0,o.w|0,o.h|0);
        ctx.fillStyle="#0b0b10";
        ctx.fillRect(x+1,o.y+1,Math.max(0,o.w-2),2);
        ctx.fillStyle=pal.solid;
      }
    }
    collide(e){
      e.grounded=false;
      if(e.y+e.h>=this.groundY){
        e.y=this.groundY-e.h; e.vy=0; e.grounded=true;
      }
      for(const o of this.obstacles){
        if(!aabb(e.x,e.y,e.w,e.h,o.x,o.y,o.w,o.h)) continue;
        const ox1=(e.x+e.w)-o.x;
        const ox2=(o.x+o.w)-e.x;
        const oy1=(e.y+e.h)-o.y;
        const oy2=(o.y+o.h)-e.y;
        const minX=Math.min(ox1,ox2);
        const minY=Math.min(oy1,oy2);
        if(minY<minX){
          if(oy1<oy2){ e.y=o.y-e.h; e.vy=0; e.grounded=true; }
          else { e.y=o.y+o.h; e.vy=0; }
        } else {
          if(ox1<ox2) e.x=o.x-e.w;
          else e.x=o.x+o.w;
          e.vx=0;
        }
      }
    }
  }

  /********************************************************************
   * Entities
   ********************************************************************/
  class Entity {
    constructor(x,y,w,h){
      this.x=x; this.y=y; this.w=w; this.h=h;
      this.vx=0; this.vy=0;
      this.grounded=false;
      this.dead=false;
      this.hp=1;
      this.anim=rand(0,99);
      this.invT=0;
    }
    get cx(){ return this.x+this.w/2; }
    get cy(){ return this.y+this.h/2; }
  }

  class Bullet {
    constructor(x,y,vx,vy,dmg,owner, tags={}){
      this.x=x; this.y=y; this.vx=vx; this.vy=vy;
      this.dmg=dmg; this.owner=owner;
      this.w=3; this.h=2;
      this.dead=false;
      this.life=1.25;
      this.tags=tags; // {isLaserTick?:true}
    }
    update(dt,game){
      this.life-=dt;
      this.x+=this.vx*dt;
      this.y+=this.vy*dt;
      if(this.life<=0) this.dead=true;
      if(this.y<-20||this.y>RH+30) this.dead=true;

      // obstacles
      for(const o of game.world.obstacles){
        if(aabb(this.x,this.y,this.w,this.h,o.x,o.y,o.w,o.h)){
          this.dead=true;
          game.spawnParticle(this.x,this.y,"spark");
          game.bus.emit("wall_hit",{x:this.x,y:this.y});
          return;
        }
      }
    }
    draw(ctx,camx,pal){
      const x=(this.x-camx)|0;
      if(x<-10||x>RW+10) return;
      ctx.fillStyle = (this.owner==="enemy") ? pal.accent : "#ffe36a";
      ctx.fillRect(x, this.y|0, this.w, this.h);
    }
  }

  class Pickup {
    constructor(x,y,kind){
      this.x=x; this.y=y; this.kind=kind;
      this.dead=false;
      this.t=rand(0,99);
      this.w=10; this.h=10;
    }
    update(dt,game){
      this.t+=dt;
      const p=game.player;
      const py=this.y+Math.sin(this.t*2)*2;
      if(dist(p.cx,p.cy,this.x,py)<16){
        this.dead=true;
        game.onPickup(this.kind);
        game.bus.emit("pickup",{kind:this.kind});
      }
    }
    draw(ctx,camx,pal){
      const x=(this.x-camx)|0;
      const y=(this.y+Math.sin(this.t*2)*2)|0;
      if(x<-20||x>RW+20) return;
      let c=pal.accent;
      if(this.kind==="HP") c=pal.danger;
      if(this.kind==="SAN") c=pal.accent;
      if(this.kind==="WIGGLE") c="#7de7ff";
      if(this.kind==="MEMORY") c="#ffffff";
      if(this.kind==="CONFUSION") c="#ff3cff";
      if(this.kind==="FRIEND") c="#00ffaa";
      if(this.kind==="LASER") c="#ffe36a";
      if(this.kind==="GLITCH") c="#ff2a2a";
      ctx.fillStyle="#000"; ctx.fillRect(x-1,y-1,this.w+2,this.h+2);
      ctx.fillStyle=c; ctx.fillRect(x,y,this.w,this.h);
      ctx.fillStyle="#111"; ctx.fillRect(x+2,y+2,this.w-4,2);
    }
  }

  class Player extends Entity {
    constructor(name, avi){
      super(40,0,18,28);
      this.name=name;
      this.avi=avi;

      this.hpMax = (avi===2)?160:110;
      this.hp=this.hpMax;
      this.sanMax = (avi===1)?140:100;
      this.san=this.sanMax;

      this.speed = (avi===2)?70:92;
      this.jump = (avi===2)?210:235;

      this.facing=1;
      this.shootCD=0;

      this.weapons=[
        { id:"PISTOL", name:"Pistol", type:"gun", dmg:9, rate:0.18, spread:0.03, sanityCost:0.25 },
        { id:"LASER", name:"Flesh-Cutting Laser", type:"laser", dmg:26, sanityCostPerSec:10.5 }
      ];
      this.hasLaser=false;
      this.weaponIndex=0;

      this.status={ slowT:0, griefT:0, wiggleT:0, memoryT:0 };
      this.hasFriend=false;
      this.friendBoostT=0;

      this.lantern=160;
      this.shots=0;
      this.hits=0;
    }
    currentWeapon(){
      if(!this.hasLaser && this.weapons[this.weaponIndex].id==="LASER") this.weaponIndex=0;
      return this.weapons[this.weaponIndex];
    }
    swapWeapon(){
      this.weaponIndex=(this.weaponIndex+1)%this.weapons.length;
      if(!this.hasLaser && this.weapons[this.weaponIndex].id==="LASER") this.weaponIndex=0;
    }
    hurt(dmg, fromX){
      if(this.invT>0) return;
      this.hp-=dmg;
      this.invT=0.5;
      this.vx += (this.x<fromX?-1:1)*70;
      this.san = Math.max(0, this.san - dmg*0.25);
    }
    soothe(v){ this.san=clamp(this.san+v,0,this.sanMax); }
    heal(v){ this.hp=clamp(this.hp+v,0,this.hpMax); }

    applyEffect(kind,game){
      if(kind==="WIGGLE"){
        this.status.wiggleT=Math.max(this.status.wiggleT,5);
        game.fx.triggerWiggle(5);
        game.whisper("THE CORRIDOR BREATHES SIDEWAYS.",2.0);
      }
      if(kind==="MEMORY"){
        this.status.memoryT=Math.max(this.status.memoryT,5);
        game.fx.triggerMemory(5);
        game.whisper("SOMETHING YOU REMEMBER IS REMEMBERING YOU.",2.0);
      }
      if(kind==="CONFUSION"){
        if(Input.confusionEnabled){
          Input.confusionT=Math.max(Input.confusionT,3.5);
          game.fx.triggerPaletteShift(2.0);
          game.whisper("LEFT MEANS RIGHT. JUST FOR NOW.",1.8);
        }
      }
      if(kind==="GLITCH"){
        game.fx.triggerGlitch(1.2);
        game.fx.triggerFace(ASSETS.get("assets/face3.png"),0.25);
        game.whisper("A FACE BORROWS YOUR SCREEN.",1.4);
      }
      if(kind==="FRIEND"){
        this.hasFriend=true;
        this.friendBoostT=Math.max(this.friendBoostT,10);
        game.whisper("A FRIEND-FORM CONTRACT SIGNS ITSELF.",2.0);
      }
      if(kind==="LASER"){
        this.hasLaser=true;
        game.whisper("THE LASER IS WARM. LIKE MEAT.",2.0);
      }
    }

    update(dt,game){
      this.anim += dt*60;
      this.invT = Math.max(0,this.invT-dt);

      // sanity drip (ward pressure)
      this.san = Math.max(0, this.san - dt*0.9);

      this.status.slowT=Math.max(0,this.status.slowT-dt);
      this.status.griefT=Math.max(0,this.status.griefT-dt);
      this.status.wiggleT=Math.max(0,this.status.wiggleT-dt);
      this.status.memoryT=Math.max(0,this.status.memoryT-dt);
      this.friendBoostT=Math.max(0,this.friendBoostT-dt);

      // movement
      let dir = Input.readDir();
      if(dir!==0) this.facing = dir>0?1:-1;

      let sp = this.speed;
      if(this.status.slowT>0) sp*=0.62;
      if(this.status.griefT>0) sp*=0.70;

      this.vx = dir*sp;

      if(Input.wantJump() && this.grounded){
        this.vy = -this.jump;
        AudioSys.ping("hit",0.25);
        game.bus.emit("jump",{});
      }

      this.vy += 520*dt;
      this.x += this.vx*dt;
      this.y += this.vy*dt;

      if(this.x < game.world.camx+10) this.x = game.world.camx+10;
      game.world.collide(this);

      // aim drift under confusion (stable oscillation)
      let ax = Input.mouse.x + game.world.camx;
      let ay = Input.mouse.y;
      if(Input.confusionEnabled && Input.confusionT>0){
        ax += Math.sin(game.time*6)*14;
        ay += Math.cos(game.time*5)*8;
      }

      // shooting
      const wpn=this.currentWeapon();
      this.shootCD=Math.max(0,this.shootCD-dt);
      if(Input.mouse.down){
        if(wpn.type==="gun"){
          if(this.shootCD<=0){
            this.shootCD = wpn.rate;
            game.fireGun(this, ax, ay);
          }
        } else {
          game.fireLaser(this, ax, ay, dt);
        }
      }

      // lantern
      this.lantern = 90 + (this.san/this.sanMax)*170;
    }

    draw(ctx,camx,pal){
      const x=(this.x-camx)|0;
      const y=this.y|0;

      const im = ASSETS.get("assets/player.png");
      if(im){ ctx.drawImage(im, x-6, y-4, 32, 32); }
      else { drawPixelSprite(ctx, x, y, this.anim, "player", pal); }

      if(this.invT>0){
        ctx.globalAlpha=0.22;
        ctx.fillStyle="#fff";
        ctx.fillRect(x,y,this.w,this.h);
        ctx.globalAlpha=1;
      }
    }
  }

  class Daughter extends Entity {
    constructor(x){
      super(x,0,16,26);
      this.saved=false;
      this._wanderT=rand(0.5,2.2);
      this._dir=chance(0.5)?-1:1;
    }
    update(dt,game){
      this.anim += dt*60;
      if(this.saved){
        const p=game.player;
        const tx=p.x-22;
        this.x = lerp(this.x, tx, 1-Math.pow(0.001,dt));
        this.y = lerp(this.y, p.y-4+Math.sin(game.time*3)*2, 1-Math.pow(0.001,dt));
        return;
      }

      this._wanderT -= dt;
      if(this._wanderT<=0){
        this._wanderT=rand(0.8,2.8);
        this._dir=chance(0.5)?-1:1;
      }

      // avoid enemies a bit (unless madness — then she may “freeze”)
      if(game.madness.active){
        this.vx = 0;
      } else {
        let fear=0;
        for(const e of game.enemies){
          const d=Math.abs(e.x-this.x);
          if(d<70) fear+=(70-d)/70;
        }
        const sp=28+fear*42;
        this.vx=this._dir*sp;
      }

      this.vy += 520*dt;
      this.x += this.vx*dt;
      this.y += this.vy*dt;
      game.world.collide(this);
      if(this.x < game.world.camx+30) this.x = game.world.camx+30;
    }
    draw(ctx,camx,pal){
      const x=(this.x-camx)|0, y=this.y|0;
      const im=ASSETS.get("assets/daughter.png");
      if(im){
        ctx.globalAlpha=0.9;
        ctx.drawImage(im, x-8, y-8, 32, 32);
        ctx.globalAlpha=1;
      } else {
        drawPixelSprite(ctx, x, y, this.anim, "daughter", pal);
      }
    }
  }

  class DaughterShade extends Entity {
    constructor(x){
      super(x,0,16,26);
      this.hp=1; // one “kill”
      this.existsFor=30;
    }
    update(dt,game){
      this.anim += dt*60;
      this.existsFor -= dt;
      // hover near player like a compulsion
      const p=game.player;
      const tx=p.x + 40;
      const ty=p.y - 12 + Math.sin(game.time*4)*6;
      this.x = lerp(this.x, tx, 1-Math.pow(0.002,dt));
      this.y = lerp(this.y, ty, 1-Math.pow(0.002,dt));
      if(this.existsFor<=0) this.dead=true;
    }
    draw(ctx,camx,pal){
      const x=(this.x-camx)|0, y=this.y|0;
      drawPixelSprite(ctx, x, y, this.anim, "daughterShade", pal);
    }
  }

  class Enemy extends Entity {
    constructor(x,y,type){
      super(x,y,18,26);
      this.type=type; // angel|fiend|golem|crazy|wailer|larva
      this.touchDmg=5;
      if(type==="angel"){ this.hp=24; this.speed=40; this.touchDmg=6; }
      if(type==="fiend"){ this.hp=36; this.speed=36; this.touchDmg=8; }
      if(type==="golem"){ this.hp=75; this.speed=22; this.touchDmg=10; this.w=20; this.h=30; }
      if(type==="crazy"){ this.hp=16; this.speed=62; this.touchDmg=4; this.w=16; this.h=28; }
      if(type==="wailer"){ this.hp=28; this.speed=26; this.touchDmg=3; this.w=20; this.h=20; }
      if(type==="larva"){ this.hp=10; this.speed=78; this.touchDmg=2; this.w=16; this.h=18; }
    }
    hit(dmg, game, meta={}){
      // Madness inversion: enemies should not be harmed; being shot becomes “wrong”
      if(game.madness.active && !meta.force){
        // heal them instead + penalty
        this.hp = Math.min(this.hp + dmg, this.maxHp());
        game.score.add(-50, "HIT ENEMY DURING MADNESS");
        game.madness.guilt += 1;
        game.whisper("DON'T HURT THEM. NOT NOW.", 1.2);
        game.fx.triggerGlitch(0.06);
        game.bus.emit("madness_violation",{kind:"hit_enemy"});
        return;
      }

      this.hp -= dmg;

      const goreN = Math.min(10, 2 + (dmg/6)|0);
      for(let i=0;i<goreN;i++) game.spawnParticle(this.cx,this.cy, chance(0.7)?"blood":"gib");
      if(chance(0.25)) game.fx.triggerGlitch(0.08);
      AudioSys.ping("hit",0.6);

      game.bus.emit("enemy_hit",{type:this.type, dmg});

      if(this.hp<=0){
        this.dead=true;
        game.addDecal(this.cx, game.world.groundY-1, "blood");
        game.bus.emit("enemy_kill",{type:this.type});
        game.score.onKill(this.type);

        // drops
        if(chance(0.20)) game.spawnPickup(this.x+6, game.world.groundY-16, chance(0.5)?"HP":"SAN");
        if(chance(0.05)) game.spawnPickup(this.x+6, game.world.groundY-16, "GLITCH");
      }
    }
    maxHp(){
      if(this.type==="golem") return 75;
      if(this.type==="fiend") return 36;
      if(this.type==="angel") return 24;
      if(this.type==="crazy") return 16;
      if(this.type==="wailer") return 28;
      if(this.type==="larva") return 10;
      return 30;
    }
    update(dt,game){
      this.anim += dt*60;

      const p=game.player;
      const dx=p.x-this.x;

      // Madness: enemies become harmless + slightly “friendly creep”
      if(game.madness.active){
        // drift around player instead of attacking
        const orbit = Math.sin((game.time + this.x*0.01)*2) * 18;
        this.vx = Math.sign(dx)*this.speed*0.35 + orbit;
      } else {
        this.vx = Math.sign(dx) * this.speed;
      }

      if(this.type==="wailer"){
        this.y += Math.sin(game.time*2 + this.x*0.01)*0.35;
        this.x += this.vx*dt;

        // grief aura
        if(dist(this.cx,this.cy,p.cx,p.cy)<46 && !game.madness.active){
          p.status.griefT=Math.max(p.status.griefT,1.2);
          if(chance(0.03*dt*60)) game.fx.triggerFace(ASSETS.get("assets/face1.png"),0.12);
        }
      } else {
        if(this.type==="crazy"){
          const st=Math.sin((game.time+this.x*0.01)*5);
          this.vx *= (0.75+0.25*st);
        }
        if(this.type==="golem"){
          const phase=(Math.floor(game.time*2+this.x*0.001)%6);
          if(phase===0) this.vx*=0.35;
        }

        this.vy += 520*dt;
        this.x += this.vx*dt;
        this.y += this.vy*dt;
        game.world.collide(this);
      }

      // touch damage (disabled during madness)
      if(!game.madness.active){
        if(aabb(this.x,this.y,this.w,this.h,p.x,p.y,p.w,p.h)){
          p.hurt(this.touchDmg*dt*6, this.x);
          if(chance(0.30)) game.spawnParticle(p.cx,p.cy,"blood");
          game.bus.emit("player_hit",{from:this.type});
        }
      } else {
        // in madness, touching enemies can restore sanity (sick comfort)
        if(aabb(this.x,this.y,this.w,this.h,p.x,p.y,p.w,p.h) && chance(0.03)){
          p.soothe(1);
        }
      }
    }
    draw(ctx,camx,pal){
      const x=(this.x-camx)|0, y=this.y|0;
      if(x<-40||x>RW+40) return;

      const map={
        angel:"assets/angel.png",
        fiend:"assets/fiend.png",
        golem:"assets/golem.png",
        crazy:"assets/crazy.png",
        wailer:"assets/wailer.png",
        larva:"assets/larva.png"
      };
      const im=ASSETS.get(map[this.type]);
      if(im){ ctx.drawImage(im, x-6, y-6, 32, 32); return; }
      drawPixelSprite(ctx, x, y, this.anim, this.type, pal);
    }
  }

  class Companion {
    constructor(player){
      this.p=player; this.x=player.x-20; this.y=player.y-4;
      this.t=0; this.cd=0;
    }
    update(dt,game){
      this.t+=dt;
      const p=this.p;
      const tx=p.x-18;
      const ty=p.y-6+Math.sin(game.time*3)*2;
      this.x=lerp(this.x,tx,1-Math.pow(0.0008,dt));
      this.y=lerp(this.y,ty,1-Math.pow(0.0008,dt));

      this.cd-=dt;
      if(this.cd<=0){
        const e=game.findNearestEnemy(this.x,this.y,160, /*includeBoss*/ false);
        if(e){
          this.cd=(p.friendBoostT>0)?0.15:0.30;
          const ang=Math.atan2(e.cy-this.y,e.cx-this.x);
          const sp=420;
          game.bullets.push(new Bullet(this.x,this.y,Math.cos(ang)*sp,Math.sin(ang)*sp,6,"friend"));
          if(chance(0.25)) AudioSys.ping("shoot",0.35);
          game.score.add(2, "FRIEND SHOT"); // tiny score tick
        } else this.cd=0.22;
      }
    }
    draw(ctx,camx,pal){
      const x=(this.x-camx)|0, y=(this.y)|0;
      ctx.globalAlpha=0.85;
      ctx.fillStyle=pal.child;
      ctx.fillRect(x,y,6,6);
      ctx.fillStyle="#000";
      ctx.fillRect(x+2,y+2,1,1);
      ctx.fillRect(x+4,y+2,1,1);
      ctx.globalAlpha=1;
    }
  }

  /********************************************************************
   * Boss: Termite Saint (worm)
   ********************************************************************/
  class TermiteSaint {
    constructor(x, groundY){
      this.name="TERMITE SAINT";
      this.x=x;
      this.y=groundY-90;
      this.groundY=groundY;

      this.hpMax=620;
      this.hp=this.hpMax;

      this.phase=1;
      this.t=0;
      this.burrowT=2.0;     // starts burrowed
      this.exposedT=0;
      this.spawnCD=2.5;

      // segments
      this.seg = [];
      const n=18;
      for(let i=0;i<n;i++){
        this.seg.push({x:this.x - i*10, y:this.y});
      }

      this.dead=false;
      this.hurtFlashT=0;
    }

    isHittable(){
      return this.burrowT<=0 && this.exposedT>0;
    }

    takeDamage(dmg, game){
      if(!this.isHittable()) return;

      // Madness inversion: boss is “harmless”; but you can still damage it (optional)
      // To keep madness meaningful, we REDUCE boss damage during madness
      const scale = game.madness.active ? 0.25 : 1.0;

      this.hp -= dmg*scale;
      this.hurtFlashT = 0.12;

      for(let i=0;i<10;i++) game.spawnParticle(this.seg[0].x, this.seg[0].y, chance(0.6)?"blood":"gib");
      game.fx.triggerGlitch(0.06);

      if(this.hp<=0){
        this.hp=0;
        this.dead=true;
        game.bus.emit("boss_kill",{id:"TERMITE_SAINT"});
        game.score.onBossKill("TERMITE_SAINT");
        game.whisper("THE WORM FORGETS ITS NAME.", 2.2);
      }
    }

    update(dt, game){
      this.t += dt;
      this.hurtFlashT = Math.max(0, this.hurtFlashT - dt);

      if(this.dead) return;

      // phases
      const hpFrac = this.hp/this.hpMax;
      this.phase = (hpFrac<0.33)?3:(hpFrac<0.66?2:1);

      // burrow/expose cycle
      this.burrowT -= dt;
      if(this.burrowT>0){
        // underground: move head position to ahead of player
        const targetX = game.player.x + 180 + Math.sin(game.time*0.7)*80;
        this.x = lerp(this.x, targetX, 1-Math.pow(0.001,dt));
        this.y = this.groundY + 40; // hidden
        if(this.burrowT<=0){
          this.exposedT = 1.4 + this.phase*0.6;
          game.fx.triggerGlitch(0.35);
          AudioSys.ping("hit", 0.9);
          game.whisper("THE FLOOR SWALLOWS A SHOUT.", 1.6);
        }
      } else {
        this.exposedT -= dt;

        // emerge above ground with wiggle
        const amp = 26 + this.phase*8;
        const rise = 88 + Math.sin(this.t*2.6)*12;
        this.y = this.groundY - rise;
        this.x += Math.sin(this.t*1.3)*amp*dt;

        // spawn larval patients
        this.spawnCD -= dt;
        const spawnRate = (this.phase===1)?2.3:(this.phase===2?1.7:1.2);
        if(this.spawnCD<=0){
          this.spawnCD = spawnRate;
          if(!game.madness.active){
            const sx = this.x + randi(-20,20);
            const sy = this.groundY - 18;
            game.enemies.push(new Enemy(sx, sy, "larva"));
            game.bus.emit("boss_spawn_minion",{id:"TERMITE_SAINT"});
          }
        }

        // if exposure ends -> burrow again
        if(this.exposedT<=0){
          this.burrowT = 1.6 + Math.random()*1.2;
        }
      }

      // segments follow head
      const head = this.seg[0];
      head.x = lerp(head.x, this.x, 1-Math.pow(0.0001,dt));
      head.y = lerp(head.y, this.y, 1-Math.pow(0.0001,dt));
      for(let i=1;i<this.seg.length;i++){
        const a=this.seg[i-1], b=this.seg[i];
        const dx=a.x-b.x, dy=a.y-b.y;
        const d=Math.max(0.0001, Math.hypot(dx,dy));
        const want=10;
        const k=(d-want)/d;
        b.x += dx*k*0.65;
        b.y += dy*k*0.65;
      }

      // boss touch damage (disabled during madness)
      if(!game.madness.active && this.burrowT<=0){
        // rough collision with a few segments near head
        for(let i=0;i<6;i++){
          const s=this.seg[i];
          if(dist(game.player.cx,game.player.cy,s.x,s.y)<16){
            game.player.hurt(8, s.x);
            game.spawnParticle(game.player.cx, game.player.cy, "blood");
            game.bus.emit("player_hit",{from:"boss"});
            break;
          }
        }
      }
    }

    draw(ctx, camx, pal){
      if(this.dead) return;
      const hit = this.isHittable();

      // optional image
      const im = ASSETS.get("assets/worm.png");
      if(im && hit){
        const x=(this.seg[0].x-camx)|0, y=(this.seg[0].y)|0;
        ctx.drawImage(im, x-64, y-64, 128, 128);
      }

      // body segments (procedural)
      for(let i=this.seg.length-1;i>=0;i--){
        const s=this.seg[i];
        const x=(s.x-camx)|0, y=(s.y)|0;
        const r = 8 - i*0.15;
        ctx.globalAlpha = 0.95;
        ctx.fillStyle = (i%2===0)? pal.gore : pal.blood;
        ctx.beginPath();
        ctx.arc(x, y, Math.max(2,r), 0, Math.PI*2);
        ctx.fill();

        // spikes
        if(i%3===0){
          ctx.strokeStyle = "#000";
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x+Math.sin(i)*6, y-6);
          ctx.stroke();
        }
      }
      ctx.globalAlpha=1;

      // head details (mouth-eye) when hittable
      const hx=(this.seg[0].x-camx)|0, hy=(this.seg[0].y)|0;
      if(hit){
        ctx.fillStyle="#000";
        ctx.fillRect(hx-5, hy-2, 10, 5);
        ctx.fillStyle="#fff000";
        ctx.fillRect(hx-1, hy-1, 2, 2);
      }

      if(this.hurtFlashT>0){
        ctx.globalAlpha=0.22;
        ctx.fillStyle="#fff";
        ctx.fillRect(hx-14, hy-14, 28, 28);
        ctx.globalAlpha=1;
      }
    }
  }

  /********************************************************************
   * Dialogue / Dilemmas
   ********************************************************************/
  class Dialogue {
    constructor({title,body,choices}){ this.title=title; this.body=body; this.choices=choices; }
  }
  class DialogueStack {
    constructor(){ this.stack=[]; }
    push(d){ this.stack.push(d); }
    pop(){ return this.stack.pop(); }
    top(){ return this.stack[this.stack.length-1]; }
    get active(){ return this.stack.length>0; }
  }
  const Dialogs = new DialogueStack();

  /********************************************************************
   * Missions
   ********************************************************************/
  class Mission {
    constructor(id){
      this.id=id;
      this.done=false;
      this.failed=false;
      this.timeLeft=(id==="SURVIVE_120")?120:0;
    }
    title(){
      if(this.id==="SURVIVE_120") return "Mission: Survive 2:00";
      if(this.id==="SAVE_CHILD") return "Mission: Save the Daughter";
      return "Mission: Reach the Exit";
    }
    update(dt,game){
      if(this.done||this.failed) return;
      if(this.id==="SURVIVE_120"){
        this.timeLeft=Math.max(0,this.timeLeft-dt);
        if(this.timeLeft<=0){
          this.done=true;
          game.win("You lasted.\n\nThe ward opens a door it didn’t have.");
        }
      }
      if(this.id==="SAVE_CHILD"){
        if(game.daughter && game.daughter.saved){
          this.done=true;
          game.win("You touched her hand.\n\nShe becomes a light that refuses to die.");
        }
      }
      if(this.id==="REACH_EXIT"){
        if(game.player.x>game.world.exitX-60){
          this.done=true;
          game.win("You found the exit.\n\nOutside is not better.\nJust wider.");
        }
      }
    }
  }

  /********************************************************************
   * Score System
   ********************************************************************/
  class ScoreManager {
    constructor(game){
      this.g=game;
      this.score=0;
      this.combo=1;
      this.comboT=0;
      this.kills=0;
      this.hits=0;
      this.shots=0;
      this.miss=0;
      this.breaks=0;
      this.notes=0;
      this.bossKills=0;
      this.madnessEpisodes=0;
      this.violations=0;
      this.breakdown = [];

      game.bus.on("shot", () => { this.shots++; this.add(1,"SHOT"); this.comboT=Math.max(this.comboT, 1.8); });
      game.bus.on("enemy_hit", () => { this.hits++; this.add(2,"HIT"); this.comboT=Math.max(this.comboT, 2.3); });
      game.bus.on("enemy_kill", () => { this.kills++; this.comboT=Math.max(this.comboT, 2.8); this.combo = clamp(this.combo + 0.08, 1, 2.6); });
      game.bus.on("prop_break", () => { this.breaks++; this.add(8,"BREAK"); });
      game.bus.on("boss_kill", () => { this.bossKills++; });
      game.bus.on("madness_start", () => { this.madnessEpisodes++; this.add(120,"MADNESS"); });
      game.bus.on("madness_violation", () => { this.violations++; this.add(-30,"VIOLATION"); });
    }
    add(v, reason){
      this.score = Math.max(0, (this.score + v) | 0);
      // keep light breadcrumb log (short)
      if(reason && Math.random()<0.08) this.breakdown.push(`${reason} ${v>=0?"+":""}${v}`);
      if(this.breakdown.length>10) this.breakdown.shift();
    }
    onKill(type){
      const base = {
        crazy:60, angel:90, fiend:130, golem:220, wailer:160, larva:45
      }[type] ?? 80;

      // combo multiplier rewards speed
      const mult = this.combo;
      const pts = Math.floor(base * mult);
      this.add(pts, `${type.toUpperCase()} KILL`);
    }
    onBossKill(id){
      this.add(2500, "BOSS");
      this.add(800, "PHASE SHOCK"); // dramatic bonus
    }
    tick(dt){
      if(this.comboT>0) this.comboT -= dt;
      else this.combo = lerp(this.combo, 1, 1 - Math.pow(0.02, dt));
    }
    finalBreakdown(game){
      // end bonuses
      const hpFrac = game.player.hp/game.player.hpMax;
      const sanFrac = game.player.san/game.player.sanMax;
      if(hpFrac>0.8) this.add(300, "UNBROKEN BODY");
      if(sanFrac<0.2) this.add(600, "BARELY HUMAN");
      if(game.mission?.id==="SAVE_CHILD" && game.daughter?.saved) this.add(1200, "DAUGHTER SAVED");
      if(game.mission?.id==="REACH_EXIT") this.add(500, "ESCAPE");
      if(game.mission?.id==="SURVIVE_120") this.add(500, "ENDURE");
      // ward morality
      const guilt = game.madness.guilt|0;
      const approval = game.madness.approval|0;
      this.add(Math.max(0, approval*60), "WARD APPROVAL");
      this.add(-Math.min(900, guilt*40), "GUILT");

      return [
        `Score: ${this.score}`,
        `Kills: ${this.kills} · Breaks: ${this.breaks} · Bosses: ${this.bossKills}`,
        `Shots: ${this.shots} · Hits: ${this.hits} · Combo Peak: x${this.combo.toFixed(2)}`,
        `Madness Episodes: ${this.madnessEpisodes} · Violations: ${this.violations}`,
        `Ward Approval: ${approval} · Guilt: ${guilt}`,
      ].join("\n");
    }
  }

  /********************************************************************
   * Badges (persistent)
   ********************************************************************/
  class BadgeManager {
    constructor(game){
      this.g=game;
      this.key="ASYLUM_BADGES_V1";
      this.unlocked = new Set(JSON.parse(localStorage.getItem(this.key)||"[]"));
      this.sessionUnlocked = new Set();

      this.stats = {
        noHitStreak:0,
        tookHit:false,
        glassBreaks:0,
        overkills:0,
        oathInvertedOk:true, // if you violate, becomes false
        madnessKillShade:false,
        missed:0,
      };

      game.bus.on("player_hit", ()=>{ this.stats.tookHit=true; });
      game.bus.on("prop_break", (p)=>{ if(p.kind==="glass") this.stats.glassBreaks++; });
      game.bus.on("madness_violation", ()=>{ this.stats.oathInvertedOk=false; });
      game.bus.on("madness_shade_killed", ()=>{ this.stats.madnessKillShade=true; });

      this.defs = [
        { id:"WARD_RUNNER", name:"Ward Runner", desc:"Finish any mission.", secret:false, test:(g)=>g.state==="end" },
        { id:"GLASS_CHOIR", name:"Glass Choir", desc:"Break 40 glass panes.", secret:false, test:(_g, bm)=>bm.stats.glassBreaks>=40 },
        { id:"NO_WITNESSES", name:"No Witnesses", desc:"30 kills without taking a hit.", secret:false,
          test:(g)=>(!g.badge.stats.tookHit && g.score.kills>=30)
        },
        { id:"OATH_INVERTED", name:"The Oath Inverted", desc:"During Madness, kill her and never hurt enemies.", secret:true,
          test:(g,bm)=> (bm.stats.madnessKillShade && bm.stats.oathInvertedOk)
        },
        { id:"TERMITE_COMMUNION", name:"Termite Communion", desc:"Kill the Termite Saint.", secret:true,
          test:(g)=> g._flags.termiteKilled===true
        },
        { id:"BARELY_HUMAN", name:"Barely Human", desc:"Win with sanity below 20%.", secret:false,
          test:(g)=> (g._flags.won && (g.player.san/g.player.sanMax)<0.2)
        },
      ];
    }

    unlock(id){
      if(this.unlocked.has(id)) return;
      this.unlocked.add(id);
      this.sessionUnlocked.add(id);
      localStorage.setItem(this.key, JSON.stringify([...this.unlocked]));
      const def = this.defs.find(d=>d.id===id);
      UI.toast(`BADGE UNLOCKED: ${def?def.name:id}`);
    }

    evaluateOnEnd(){
      for(const d of this.defs){
        if(this.unlocked.has(d.id)) continue;
        try{
          if(d.test(this.g, this)) this.unlock(d.id);
        }catch(_e){}
      }
    }

    sessionBadgeText(){
      if(this.sessionUnlocked.size===0) return "No badges unlocked this run.";
      const names = [...this.sessionUnlocked].map(id=>{
        const d=this.defs.find(x=>x.id===id);
        return d?d.name:id;
      });
      return `Badges unlocked: ${names.join(", ")}`;
    }
  }

  /********************************************************************
   * Madness Manager (hidden triggers per run)
   ********************************************************************/
  class MadnessManager {
    constructor(game){
      this.g=game;
      this.active=false;
      this.t=0;
      this.approval=0;
      this.guilt=0;

      // hidden triggers
      this.triggers=[];
      this._events={
        killsWindow:[],
        glassWindow:[],
        potionWindow:[],
        stillT:0,
        backwardT:0,
        wallTile:null,
        wallCount:0,
        hoarderCount:0,
        daughterNeglectT:0,
      };

      // track motion for stillness/backwards prayer
      this._lastPX = 0;

      // subscribe to bus
      game.bus.on("enemy_kill", ()=>{ this._events.killsWindow.push(game.time); });
      game.bus.on("prop_break", (p)=>{
        if(p.kind==="glass") this._events.glassWindow.push(game.time);
      });
      game.bus.on("pickup", (p)=>{
        if(["WIGGLE","MEMORY","CONFUSION","GLITCH"].includes(p.kind)) this._events.potionWindow.push(game.time);
        if(p.kind==="HP"){
          const hpFrac = game.player.hp/game.player.hpMax;
          if(hpFrac>0.85) this._events.hoarderCount++;
        }
      });
      game.bus.on("wall_hit", (w)=>{
        // quantize to tiles
        const tile = `${Math.floor(w.x/16)}:${Math.floor(w.y/16)}`;
        if(this._events.wallTile===tile) this._events.wallCount++;
        else { this._events.wallTile=tile; this._events.wallCount=1; }
      });
      game.bus.on("madness_violation", ()=>{ this.guilt += 1; });

      // build trigger pool
      this.pool = [
        { id:"RED_BLOOM", hint:"You killed too quickly.", test:()=> this.countInWindow(this._events.killsWindow, 20) >= 20 },
        { id:"GLASS_CHOIR", hint:"The glass sang.", test:()=> this.countInWindow(this._events.glassWindow, 15) >= 12 },
        { id:"POTION_SPIRAL", hint:"You drank too many memories.", test:()=> this.countInWindow(this._events.potionWindow, 12) >= 3 },
        { id:"STILLNESS", hint:"Stillness is a knife.", test:()=> this._events.stillT >= 20 },
        { id:"BACKWARDS_PRAYER", hint:"You walked backward in fear.", test:()=> this._events.backwardT >= 12 },
        { id:"WALL_CONFESSION", hint:"You confessed to a wall.", test:()=> this._events.wallCount >= 13 },
        { id:"HOARDER_SIN", hint:"You stole healing you didn't need.", test:()=> this._events.hoarderCount >= 3 },
        { id:"NEGLECT", hint:"You ignored her too long.", test:()=> this._events.daughterNeglectT >= 25 },
      ];
    }

    chooseTriggers(mood){
      // choose 3, mood influences weights lightly
      const weighted = this.pool.map(p=>{
        let w=1;
        if(mood.id==="DEVOUT" && (p.id==="POTION_SPIRAL"||p.id==="STILLNESS")) w=1.6;
        if(mood.id==="CARNIVAL" && (p.id==="GLASS_CHOIR"||p.id==="POTION_SPIRAL")) w=1.5;
        if(mood.id==="HUNGRY" && (p.id==="RED_BLOOM")) w=1.4;
        if(mood.id==="SULLEN" && (p.id==="STILLNESS"||p.id==="BACKWARDS_PRAYER")) w=1.5;
        return {p,w};
      });

      const chosen=[];
      for(let k=0;k<3;k++){
        const total = weighted.reduce((s,x)=>s+x.w,0);
        let r=Math.random()*total;
        let pick=null;
        for(const x of weighted){
          r-=x.w;
          if(r<=0){ pick=x.p; break; }
        }
        if(!pick) pick=weighted[0].p;
        chosen.push(pick);
        // remove it
        const idx = weighted.findIndex(x=>x.p.id===pick.id);
        if(idx>=0) weighted.splice(idx,1);
      }
      this.triggers=chosen;
    }

    countInWindow(arr, seconds){
      const t=this.g.time;
      // prune
      while(arr.length && (t - arr[0]) > seconds) arr.shift();
      return arr.length;
    }

    start(){
      if(this.active) return;
      this.active=true;
      this.t=30;
      this.approval += 1; // “the ward notices”
      this.g.bus.emit("madness_start",{});
      this.g.score.add(250, "MADNESS BEGINS");
      this.g.fx.triggerPaletteShift(2.0);
      this.g.fx.triggerGlitch(0.35);
      this.g.whisper("MADNESS: RULES INVERT FOR 30 SECONDS.", 2.2);

      // spawn a Daughter Shade (hallucination target)
      // (real daughter is protected from accidental run-breaking during Madness)
      this.g.spawnDaughterShade();
    }

    end(){
      if(!this.active) return;
      this.active=false;
      this.t=0;
      this.g.bus.emit("madness_end",{});
      this.g.fx.triggerPaletteShift(1.0);
      this.g.whisper("MADNESS ENDS. YOU REMEMBER WRONG THINGS.", 2.0);
    }

    update(dt){
      // update timers/tracking
      if(Input.confusionT>0) Input.confusionT = Math.max(0, Input.confusionT - dt);

      const p=this.g.player;
      const moved = Math.abs(p.x - this._lastPX);
      this._lastPX = p.x;

      if(moved < 0.2) this._events.stillT += dt;
      else this._events.stillT = Math.max(0, this._events.stillT - dt*0.5);

      // backwards prayer: moving left for time
      const dir = Input.readDir();
      if(dir<0) this._events.backwardT += dt;
      else this._events.backwardT = Math.max(0, this._events.backwardT - dt*0.75);

      // daughter neglect time
      if(this.g.daughter && !this.g.daughter.saved && !this.active){
        // if daughter is on screen and player not interacting for long
        const onScreen = Math.abs(this.g.daughter.x - (this.g.world.camx + RW/2)) < 260;
        if(onScreen) this._events.daughterNeglectT += dt;
        else this._events.daughterNeglectT = Math.max(0, this._events.daughterNeglectT - dt);
      } else {
        this._events.daughterNeglectT = Math.max(0, this._events.daughterNeglectT - dt);
      }

      // trigger check (only if not active)
      if(!this.active){
        for(const tr of this.triggers){
          if(tr.test()){
            this.start();
            break;
          }
        }
      } else {
        this.t -= dt;
        if(this.t <= 0){
          // if shade still alive => immediate bad ending (the inversion demand wasn’t fulfilled)
          if(this.g.daughterShade && !this.g.daughterShade.dead){
            this.g.lose("MADNESS ENDED.\n\nYou refused the inversion.\nThe ward calls it cowardice.", true);
            return;
          }
          this.end();
        }
      }
    }
  }

  /********************************************************************
   * Tension + Atmosphere shifts
   ********************************************************************/
  class Tension {
    constructor(){
      this.mode="atmosphere";
      this.heat=0.0;
      this.triggerX=220;
    }
    update(dt, game){
      const depth = game.player.x/10;
      const shouldFrenetic =
        depth > this.triggerX ||
        (game.mission?.id==="SURVIVE_120" && game.mission.timeLeft<70) ||
        (game.mission?.id==="SAVE_CHILD" && !game.daughterSaved && depth>180);

      this.mode = shouldFrenetic ? "frenetic" : "atmosphere";
      const target = (this.mode==="frenetic") ? 1 : 0.2;
      this.heat = lerp(this.heat, target, 1 - Math.pow(0.003, dt));
    }
  }

  class AtmosphereManager {
    constructor(){
      this.name="ward";
      this.nextShiftAt=30;
    }
    update(dt, game){
      if(game.time > this.nextShiftAt){
        this.nextShiftAt = game.time + rand(25,40);
        const depth = game.player.x;

        if(depth>2400 && chance(0.55)) this.name="chapel";
        else if(chance(0.20)) this.name="meltdown";
        else this.name="ward";

        game.fx.triggerPaletteShift(2.5);
        game.whisper(
          this.name==="chapel" ? "A QUIETER ROOM. WRONG KIND OF QUIET." :
          this.name==="meltdown" ? "THE LIGHTS ARGUE WITH THEMSELVES." :
          "THE WARD RETURNS TO ITS BREATH.",
          2.0
        );
      }
    }
    palette(){ return PALETTES[this.name]; }
  }

  /********************************************************************
   * Game Core
   ********************************************************************/
  class Game {
    constructor(){
      this.state="menu"; // menu|dialog|play|end
      this.bus = new Bus();

      this.world=new World();
      this.atmo=new AtmosphereManager();
      this.tension=new Tension();
      this.fx=new VisualFX();

      this.player=null;
      this.friend=null;

      this.enemies=[];
      this.bullets=[];
      this.particles=[];
      this.decals=[];
      this.pickups=[];

      this.mission=null;

      this.daughter=null;
      this.daughterSpawned=false;
      this.daughterSaved=false;

      this.daughterShade=null;

      this.time=0;
      this.whisperText="";
      this.whisperT=0;

      this.spawnAcc=0;
      this.lastDilemmaAt=18;
      this._mercy=0;

      this._laser=null;

      this.mood = WARD_MOODS[0];

      this.score = new ScoreManager(this);
      this.badge = new BadgeManager(this);
      this.madness = new MadnessManager(this);

      this.boss=null;
      this._flags = { won:false, termiteKilled:false };

      // badge hooks
      this.bus.on("boss_kill", (p)=>{ if(p.id==="TERMITE_SAINT") this._flags.termiteKilled=true; });
    }

    whisper(msg, t=1.8){ this.whisperText=msg; this.whisperT=t; }

    spawnParticle(x,y,kind){
      this.particles.push(new Particle(x,y,kind,this.pal));
      if(this.particles.length>1100) this.particles.splice(0,this.particles.length-1100);
    }
    addDecal(x,y,type){
      this.decals.push(new Decal(x,y,type,this.pal));
      if(this.decals.length>280) this.decals.splice(0,this.decals.length-280);
    }
    spawnPickup(x,y,kind){ this.pickups.push(new Pickup(x,y,kind)); }

    onPickup(kind){
      const p=this.player;

      if(kind==="HP"){ p.heal(28); this.whisper("A RED PACK THAT SMELLS LIKE METAL.",1.6); AudioSys.ping("hit",0.35); this.score.add(40,"HEAL"); return; }
      if(kind==="SAN"){ p.soothe(26); this.whisper("A PURPLE BREATH IN A BOTTLE.",1.6); AudioSys.ping("hit",0.35); this.score.add(40,"CALM"); return; }

      if(["WIGGLE","MEMORY","CONFUSION","GLITCH","FRIEND","LASER"].includes(kind)){
        p.applyEffect(kind,this);
        this.score.add(60,"SUBSTANCE");
        return;
      }
    }

    difficulty(){
      const depth=this.player.x/10;
      const stage=clamp(depth/650,0,1);
      const hpFrac=this.player.hp/this.player.hpMax;
      const sanFrac=this.player.san/this.player.sanMax;
      const struggling = (hpFrac<0.35)||(sanFrac<0.30);

      this._mercy = lerp(this._mercy, struggling?1:0, 1 - Math.pow(0.01, 1/60));
      const mercy=this._mercy;

      const moodSpawn = this.mood.spawnMul;
      const baseSpawn = lerp(1.35,0.70,stage) / moodSpawn;
      const spawnEvery = baseSpawn + mercy*0.55;

      const maxEnemies = Math.floor(4 + stage*6 - mercy*2);
      const eliteChance = clamp(lerp(0.08,0.30,stage) - mercy*0.12, 0.05, 0.30);

      return { stage, spawnEvery, maxEnemies, eliteChance };
    }

    findNearestEnemy(x,y,rad){
      let best=null, bd=rad;
      for(const e of this.enemies){
        if(e.dead) continue;
        const d=dist(x,y,e.cx,e.cy);
        if(d<bd){ bd=d; best=e; }
      }
      return best;
    }

    fireGun(player, ax, ay){
      const wpn=player.currentWeapon();
      const ox = player.x + (player.facing>0 ? player.w : 0);
      const oy = player.y + 14;
      const ang = Math.atan2(ay-oy, ax-ox) + rand(-wpn.spread, wpn.spread);
      const sp=520;

      this.bullets.push(new Bullet(ox,oy,Math.cos(ang)*sp,Math.sin(ang)*sp,wpn.dmg,"player"));
      player.san = Math.max(0, player.san - wpn.sanityCost);

      player.vx += -Math.cos(ang)*12;

      AudioSys.ping("shoot",0.65);
      if(chance(0.18)) this.spawnParticle(ox,oy,"spark");

      this.bus.emit("shot",{});
      this.score.add(0,"");
    }

    fireLaser(player, ax, ay, dt){
      if(!player.hasLaser) return;

      const wpn=player.currentWeapon();
      const ox = player.x + (player.facing>0 ? player.w : 0);
      const oy = player.y + 14;

      const ang=Math.atan2(ay-oy, ax-ox);
      const dx=Math.cos(ang), dy=Math.sin(ang);

      let hitLen=320;
      for(let t=0;t<320;t+=6){
        const px=ox+dx*t, py=oy+dy*t;
        if(py>this.world.groundY){ hitLen=t; break; }
        for(const o of this.world.obstacles){
          if(aabb(px,py,2,2,o.x,o.y,o.w,o.h)){ hitLen=t; t=9999; break; }
        }
      }

      // damage enemies along beam
      const beamR=8;
      const dmg=wpn.dmg*dt;

      for(const e of this.enemies){
        if(e.dead) continue;
        const vx=e.cx-ox, vy=e.cy-oy;
        const proj=vx*dx+vy*dy;
        if(proj<0||proj>hitLen) continue;
        const px=ox+dx*proj, py=oy+dy*proj;
        if(dist(e.cx,e.cy,px,py)<beamR){
          e.hit(dmg*1.15,this, {force:false});
          if(chance(0.05)) this.spawnParticle(e.cx,e.cy,"blood");
        }
      }

      // boss hit (if beam passes near head)
      if(this.boss && !this.boss.dead){
        const head = this.boss.seg ? this.boss.seg[0] : null;
        if(head){
          const vx=head.x-ox, vy=head.y-oy;
          const proj=vx*dx+vy*dy;
          if(proj>0 && proj<hitLen){
            const px=ox+dx*proj, py=oy+dy*proj;
            if(dist(head.x,head.y,px,py)<10){
              this.boss.takeDamage(dmg*1.4, this);
            }
          }
        }
      }

      player.san = Math.max(0, player.san - (wpn.sanityCostPerSec||10.5)*dt);

      this._laser = { x0:ox, y0:oy, x1:ox+dx*hitLen, y1:oy+dy*hitLen, t:0.06 };
      if(chance(0.22)) AudioSys.ping("laser",0.38);
      if(chance(0.15)) this.fx.triggerGlitch(0.06);

      this.bus.emit("shot",{});
    }

    spawnEnemyWave(){
      const d=this.difficulty();
      if(this.enemies.length>=d.maxEnemies) return;

      const n=randi(1,2+Math.floor(d.stage*1.2));
      for(let i=0;i<n;i++){
        if(this.enemies.length>=d.maxEnemies) break;

        const x=this.world.camx + RW + randi(20,80);
        let type="angel";
        const elite=chance(d.eliteChance);

        if(elite){
          // mood tweaks
          let r=Math.random();
          if(this.mood.id==="DEVOUT") r*=0.8; // more wailers
          if(r<0.25) type="fiend";
          else if(r<0.48) type="crazy";
          else if(r<0.72) type="wailer";
          else type="golem";
        } else {
          type = chance(0.62) ? "angel" : "crazy";
        }

        const y=(type==="wailer") ? (this.world.groundY - randi(80,120)) : (this.world.groundY - 26);
        this.enemies.push(new Enemy(x,y,type));
      }

      // mercy drops
      if(this._mercy>0.6 && chance(0.25)){
        this.spawnPickup(this.world.camx+randi(120,220), this.world.groundY-16, chance(0.5)?"HP":"SAN");
      }
    }

    maybeSpawnDaughter(){
      if(this.daughterSpawned) return;
      if(!this.mission) return;

      if(this.mission.id==="SAVE_CHILD"){
        this.daughterSpawned=true;
        this.daughter=new Daughter(this.world.camx+RW+40);
        this.whisper("THE DAUGHTER IS IN THE HALL.",2.0);
        return;
      }

      if(this.tension.mode==="frenetic" && this.player.x>1700 && chance(0.006)){
        this.daughterSpawned=true;
        this.daughter=new Daughter(this.world.camx+RW-randi(60,120));
        this.whisper("THE DAUGHTER APPEARS. DO NOT SHOOT.",2.0);
      }
    }

    spawnDaughterShade(){
      // always spawn shade when madness starts; keep it separate from real daughter
      this.daughterShade = new DaughterShade(this.player.x + 50);
    }

    maybeSpawnBoss(){
      // Termite Saint appears once per run under certain conditions
      if(this.boss || this._flags.termiteKilled) return;

      const depth = this.player.x;
      const should =
        (this.mission.id==="REACH_EXIT" && depth > this.world.exitX - 520) ||
        (this.mission.id==="SURVIVE_120" && this.mission.timeLeft < 55) ||
        (depth > 2100 && this.tension.mode==="frenetic");

      if(should){
        this.boss = new TermiteSaint(this.player.x + 260, this.world.groundY);
        this.bus.emit("boss_spawn",{id:"TERMITE_SAINT"});
        this.score.add(200, "BOSS ARRIVAL");
        this.whisper("THE TERMITE SAINT ARRIVES HUNGRY.", 2.0);
        UI.bossWrap.style.display = "block";
        UI.bossName.textContent = "TERMITE SAINT";
      }
    }

    triggerDilemmaOnce(){
      if(this.time < this.lastDilemmaAt) return;
      if(this.tension.mode!=="atmosphere") return;
      if(this.enemies.length>0) return;
      if(this.madness.active) return;

      if(chance(0.18 * this.mood.triggerMul)){
        this.lastDilemmaAt = this.time + rand(25,35);

        const p=this.player;
        const tone = (p.avi===1)?"ritual":(p.avi===2?"brutal":"flat");

        const body =
          tone==="ritual"
            ? `${p.name}, a nurse offers a vial labeled: "MEMORY".\nHer lips move without sound.\n\nDo you drink it?`
            : tone==="brutal"
            ? `${p.name}, a deranged patient sits in the trash.\nHe whispers: "I can help you kill."\n\nDo you accept him?`
            : `${p.name}, a patient stands too close.\nHe asks you to choose what he becomes.\n\nWhat do you choose?`;

        const dlg=new Dialogue({
          title:"WARD ENCOUNTER",
          body,
          choices:[
            {
              label:"Accept.",
              hint:"Gain something. Also gain consequences.",
              act:()=>{
                if(tone==="brutal"){
                  this.player.applyEffect("FRIEND",this);
                  this.madness.approval += 1;
                  this.score.add(120, "CRUEL ALLY");
                } else {
                  this.player.applyEffect("MEMORY",this);
                  if(chance(0.35) && Input.confusionEnabled) this.player.applyEffect("CONFUSION",this);
                  this.score.add(90, "DRINK MEMORY");
                }
                this.whisper("THE WARD NOTICES YOUR CHOICE.",2.0);
                this.bus.emit("dialog_choice",{kind:"accept"});
              }
            },
            {
              label:"Refuse.",
              hint:"Small sanity gain; the ward remembers it.",
              act:()=>{
                this.player.soothe(10);
                this.tension.triggerX = Math.max(120, this.tension.triggerX - 25);
                this.madness.guilt += 1; // refusal can be “cowardice” in this fiction
                this.score.add(40, "REFUSE");
                this.whisper("YOU SAID NO. SOMETHING REMEMBERS IT.",2.0);
                this.bus.emit("dialog_choice",{kind:"refuse"});
              }
            },
            {
              label:"Steal the chest behind him.",
              hint:"Risk confusion; chance for Laser.",
              act:()=>{
                this.spawnPickup(this.player.x+40, this.world.groundY-16, chance(0.45)?"LASER":"GLITCH");
                if(chance(0.35)) this.player.applyEffect("CONFUSION",this);
                this.score.add(150, "THEFT");
                this.whisper("THEFT IS ALSO A PRAYER.",2.0);
                this.bus.emit("dialog_choice",{kind:"steal"});
              }
            }
          ]
        });

        this.openDialog(dlg);
      }
    }

    openDialog(dlg){
      Dialogs.push(dlg);
      this.state="dialog";
      UI.dialog.style.display="grid";

      UI.dlgTitle.textContent=dlg.title;
      UI.dlgBody.textContent=dlg.body;
      UI.dlgChoices.innerHTML="";

      dlg.choices.forEach((c,idx)=>{
        const btn=document.createElement("button");
        btn.className="gBtn";
        btn.textContent=`${idx+1}. ${c.label}`;
        btn.onclick=()=>this.pickDialog(idx);
        const hint=document.createElement("div");
        hint.className="gTiny";
        hint.textContent=c.hint||"";
        const wrap=document.createElement("div");
        wrap.appendChild(btn);
        if(c.hint) wrap.appendChild(hint);
        UI.dlgChoices.appendChild(wrap);
      });
    }

    pickDialog(i){
      const dlg=Dialogs.top();
      if(!dlg) return;
      const choice=dlg.choices[i];
      if(choice?.act) choice.act();
      Dialogs.pop();
      UI.dialog.style.display="none";
      this.state="play";
    }

    lose(text, bad=false){
      this.state="end";
      UI.end.style.display="grid";
      UI.endTitle.textContent = bad ? "BAD ENDING" : "SIGNAL LOST";

      const breakdown = this.score.finalBreakdown(this);
      this.badge.evaluateOnEnd();

      UI.endBody.textContent = `${text}\n\n---\n${breakdown}`;
      UI.endBadges.textContent = this.badge.sessionBadgeText();

      AudioSys.setIntensity(bad?0.95:0.6,"frenetic");
      AudioSys.ping("hit",1.0);
    }

    win(text){
      this._flags.won=true;
      this.state="end";
      UI.end.style.display="grid";
      UI.endTitle.textContent = "RUN COMPLETE";

      const breakdown = this.score.finalBreakdown(this);
      this.badge.evaluateOnEnd();

      UI.endBody.textContent = `${text}\n\n---\n${breakdown}`;
      UI.endBadges.textContent = this.badge.sessionBadgeText();

      AudioSys.setIntensity(0.35,"atmosphere");
      AudioSys.ping("hit",0.7);
    }

    startRun({name, avatar, missionId, allowImages, allowConfusion, hardAudio}){
      this.state="play";
      this.time=0;

      ASSETS.allowImages=!!allowImages;
      Input.confusionEnabled=!!allowConfusion;
      Input.confusionT=0;
      AudioSys.setHard(!!hardAudio);

      // reset
      this.world.reset();
      this.atmo=new AtmosphereManager();
      this.tension=new Tension();
      this.fx=new VisualFX();

      this.enemies.length=0;
      this.bullets.length=0;
      this.particles.length=0;
      this.decals.length=0;
      this.pickups.length=0;

      this.player=new Player(name, avatar);
      this.friend=null;

      this.mission=new Mission(missionId);

      this.daughter=null;
      this.daughterSpawned=false;
      this.daughterSaved=false;
      this.daughterShade=null;

      this.spawnAcc=0;
      this.lastDilemmaAt=16;
      this._mercy=0;

      this._laser=null;

      // mood roll
      this.mood = WARD_MOODS[randi(0, WARD_MOODS.length-1)];
      this.whisper(`WELCOME, ${name}. ${this.mood.label.toUpperCase()}.`, 2.4);

      // systems reset
      this.score = new ScoreManager(this);
      this.badge = new BadgeManager(this);
      this.madness = new MadnessManager(this);
      this.madness.chooseTriggers(this.mood);

      this.boss=null;
      this._flags = { won:false, termiteKilled:false };

      // intro note
      this.openDialog(new Dialogue({
        title:"ARCHIVE NOTE",
        body:
          avatar===1
            ? `${name}, the corridor is a ritual circle.\nYour steps are syllables.\n\nThe ward will test what you protect.`
            : avatar===2
            ? `${name}, the asylum respects force.\nBut it punishes waste.\n\nSome rules will flip. You will obey.`
            : `${name}, a note is pinned to a bin:\n"LIGHT ISN'T SAFETY."\n\nKeep moving. Watch the fog.`,
        choices:[{label:"Continue.", hint:"The ward resumes breathing.", act:()=>{ this.score.add(50,"NOTE"); }}]
      }));
    }

    update(dt){
      if(this.state!=="play") return;

      this.time += dt;
      if(this.whisperT>0) this.whisperT -= dt;

      // camera
      const target = this.player.x - RW*0.33;
      this.world.camx = lerp(this.world.camx, target, 1 - Math.pow(0.00025, dt));
      this.world.camx = Math.max(0, this.world.camx);

      // tension + audio
      this.atmo.update(dt, this);
      this.tension.update(dt, this);
      AudioSys.setIntensity(this.tension.heat, this.tension.mode);

      // madness updates (may start/stop)
      this.madness.update(dt);
      UI.uiMadness.style.display = this.madness.active ? "block" : "none";

      // mission
      this.mission.update(dt, this);

      // spawn daughter
      this.maybeSpawnDaughter();

      // spawn boss
      this.maybeSpawnBoss();

      // player swap
      if(Input.wantSwap()){
        this.player.swapWeapon();
        this.whisper(`WEAPON: ${this.player.currentWeapon().name}`, 1.2);
        this.score.add(10, "SWAP");
      }

      // update player
      this.player.update(dt, this);

      // friend
      if(this.player.hasFriend){
        if(!this.friend) this.friend = new Companion(this.player);
        this.friend.update(dt, this);
      } else this.friend=null;

      // daughter
      if(this.daughter){
        this.daughter.update(dt, this);

        // interact save (disabled during madness: you can still save later, but it feels “wrong”)
        if(Input.wantInteract() && !this.daughter.saved && !this.madness.active){
          if(aabb(this.player.x,this.player.y,this.player.w,this.player.h,this.daughter.x,this.daughter.y,this.daughter.w,this.daughter.h)){
            this.daughter.saved=true;
            this.daughterSaved=true;
            this.player.soothe(18);
            this.fx.triggerPaletteShift(1.5);
            this.whisper("SHE IS REAL ENOUGH TO HOLD.", 2.0);
            this.bus.emit("daughter_saved",{});
            this.score.add(500, "SAVE");
            this.madness.approval += 2;
          }
        }
      }

      // daughter shade
      if(this.daughterShade && !this.daughterShade.dead){
        this.daughterShade.update(dt, this);
      }

      // spawn enemies
      const d=this.difficulty();
      this.spawnAcc += dt;

      const doSpawn = (this.tension.mode==="frenetic");
      if(doSpawn && this.spawnAcc > d.spawnEvery * (1/this.mood.spawnMul)){
        this.spawnAcc=0;
        if(!this.madness.active) this.spawnEnemyWave();
      }

      // update enemies
      for(const e of this.enemies) e.update(dt, this);
      this.enemies = this.enemies.filter(e=>!e.dead);

      // boss
      if(this.boss && !this.boss.dead){
        this.boss.update(dt, this);
      }

      // bullets
      for(const b of this.bullets) b.update(dt, this);
      this.bullets = this.bullets.filter(b=>!b.dead);

      // pickups
      for(const p of this.pickups) p.update(dt, this);
      this.pickups = this.pickups.filter(p=>!p.dead);

      // particles / decals
      for(const p of this.particles) p.update(dt);
      this.particles = this.particles.filter(p=>p.life>0);
      for(const dcl of this.decals) dcl.update(dt);

      // resolve bullet impacts (enemies/props/daughter/shade/boss)
      this.resolveCombat();

      // dilemmas
      this.triggerDilemmaOnce();

      // score tick
      this.score.tick(dt);

      // loss
      if(this.player.hp<=0) this.lose("Your body gives up.\n\nThe ward keeps walking.\nIt steps over you like a thought.", false);
      if(this.player.san<=0) this.lose("Your mind fractures.\n\nThe fog learns your face.\nIt wears it.", false);

      // FX
      this.fx.update(dt);
      if(this.player.status.wiggleT>0) this.fx.triggerWiggle(0.2);
      if(this.player.status.memoryT>0) this.fx.triggerMemory(0.2);

      // occasional face flash under high tension
      if(this.tension.mode==="frenetic" && chance(0.003)) this.fx.triggerFace(ASSETS.get("assets/face2.png"), 0.15);
    }

    resolveCombat(){
      for(const b of this.bullets){
        if(b.dead) continue;

        // props
        for(const pr of this.world.props){
          if(pr.broken) continue;
          const box=pr.aabb();
          if(aabb(b.x,b.y,b.w,b.h,box.x,box.y,box.w,box.h)){
            b.dead=true;
            const drop=pr.hit(this);
            this.spawnParticle(b.x,b.y,"spark");
            if(drop) this.spawnPickup(pr.x+pr.w/2, this.world.groundY-16, drop);
            this.score.add(8, "BREAK");
            break;
          }
        }
        if(b.dead) continue;

        // daughter shade (required target during madness)
        if(this.daughterShade && !this.daughterShade.dead){
          if(aabb(b.x,b.y,b.w,b.h,this.daughterShade.x,this.daughterShade.y,this.daughterShade.w,this.daughterShade.h)){
            b.dead=true;

            // kill shade: satisfies inversion
            this.daughterShade.dead=true;
            this.bus.emit("madness_shade_killed",{});
            this.score.add(800, "INVERSION");
            this.madness.approval += 3;
            this.fx.triggerPaletteShift(1.8);
            this.whisper("THE WARD SMILES WITH SOMEONE ELSE'S TEETH.", 2.1);

            for(let i=0;i<40;i++) this.spawnParticle(this.daughterShade.cx,this.daughterShade.cy, chance(0.6)?"blood":"gib");
            this.addDecal(this.daughterShade.cx, this.world.groundY-1, "blood");

            AudioSys.ping("hit", 1.0);
            break;
          }
        }

        // real daughter = instant BAD ending (unless madness, where she is protected)
        if(this.daughter && !this.daughter.saved && !this.madness.active){
          if(aabb(b.x,b.y,b.w,b.h,this.daughter.x,this.daughter.y,this.daughter.w,this.daughter.h)){
            b.dead=true;
            for(let i=0;i<46;i++) this.spawnParticle(this.daughter.cx,this.daughter.cy, chance(0.6)?"blood":"gib");
            this.addDecal(this.daughter.cx, this.world.groundY-1, "blood");
            this.lose("YOU SHOT THE DAUGHTER.\n\nBad Ending:\nThe ward stops pretending you were a person.", true);
            return;
          }
        }

        // boss hitbox (simple: head blob)
        if(this.boss && !this.boss.dead){
          const head = this.boss.seg ? this.boss.seg[0] : null;
          if(head && dist(b.x,b.y,head.x,head.y)<12){
            b.dead=true;
            this.boss.takeDamage(b.dmg, this);
            this.score.add(8, "BOSS HIT");
            this.bus.emit("enemy_hit",{});
            continue;
          }
        }

        // enemies
        for(const e of this.enemies){
          if(e.dead) continue;
          if(aabb(b.x,b.y,b.w,b.h,e.x,e.y,e.w,e.h)){
            b.dead=true;
            e.hit(b.dmg, this);
            this.score.add(0,"");
            break;
          }
        }
      }
    }

    draw(){
      this.pal = this.atmo.palette();

      // background
      this.world.drawBackground(bctx, this.pal, this.time, this.mood);

      // decals
      for(const d of this.decals) d.draw(bctx, this.world.camx);

      // solids
      this.world.drawSolids(bctx, this.pal);

      // props
      for(const pr of this.world.props) pr.draw(bctx, this.world.camx, this.pal, this.time);

      // pickups
      for(const p of this.pickups) p.draw(bctx, this.world.camx, this.pal);

      // daughter
      if(this.daughter) this.daughter.draw(bctx, this.world.camx, this.pal);

      // shade
      if(this.daughterShade && !this.daughterShade.dead) this.daughterShade.draw(bctx, this.world.camx, this.pal);

      // enemies
      for(const e of this.enemies) e.draw(bctx, this.world.camx, this.pal);

      // boss
      if(this.boss && !this.boss.dead) this.boss.draw(bctx, this.world.camx, this.pal);

      // bullets
      for(const b of this.bullets) b.draw(bctx, this.world.camx, this.pal);

      // friend
      if(this.friend) this.friend.draw(bctx, this.world.camx, this.pal);

      // player
      if(this.player) this.player.draw(bctx, this.world.camx, this.pal);

      // laser beam overlay
      if(this._laser && this._laser.t>0){
        this._laser.t -= 1/60;
        bctx.globalAlpha=0.85;
        bctx.strokeStyle=this.pal.accent;
        bctx.beginPath();
        bctx.moveTo((this._laser.x0-this.world.camx)|0, this._laser.y0|0);
        bctx.lineTo((this._laser.x1-this.world.camx)|0, this._laser.y1|0);
        bctx.stroke();
        bctx.globalAlpha=1;
      }

      // lighting / fog
      if(this.player){
        const px=(this.player.cx-this.world.camx)|0;
        const py=(this.player.cy)|0;
        const rad=this.player.lantern;

        const fog=bctx.createRadialGradient(px,py,rad*0.2,px,py,rad*1.55);
        fog.addColorStop(0,"rgba(0,0,0,0)");
        fog.addColorStop(0.55,"rgba(0,0,0,0.48)");
        fog.addColorStop(1,this.pal.fog);
        bctx.fillStyle=fog;
        bctx.fillRect(0,0,RW,RH);
      }

      // particles
      for(const p of this.particles) p.draw(bctx, this.world.camx);

      // whisper
      if(this.whisperT>0){
        bctx.globalAlpha=clamp(this.whisperT/2,0,1)*0.9;
        bctx.fillStyle=this.pal.ui;
        bctx.font="10px ui-monospace, monospace";
        bctx.fillText(this.whisperText, 8, RH-10);
        bctx.globalAlpha=1;
      }

      // crosshair
      if(this.state==="play"){
        const mx=clamp(Input.mouse.x,0,RW)|0;
        const my=clamp(Input.mouse.y,0,RH)|0;
        bctx.globalAlpha=0.85;
        bctx.strokeStyle="#999";
        bctx.beginPath();
        bctx.moveTo(mx-4,my); bctx.lineTo(mx-1,my);
        bctx.moveTo(mx+1,my); bctx.lineTo(mx+4,my);
        bctx.moveTo(mx,my-4); bctx.lineTo(mx,my-1);
        bctx.moveTo(mx,my+1); bctx.lineTo(mx,my+4);
        bctx.stroke();
        bctx.globalAlpha=1;
      }

      // post
      this.fx.post(bctx, this);

      // blit
      ctx.fillStyle="#000"; ctx.fillRect(0,0,W,H);
      ctx.drawImage(buf, 0,0,RW,RH, DX,DY, RW*SCALE, RH*SCALE);

      // UI
      this.updateHud();
    }

    updateHud(){
      const p=this.player;
      if(!p) return;

      UI.uiHp.style.width = `${clamp((p.hp/p.hpMax)*100,0,100)}%`;
      UI.uiSan.style.width = `${clamp((p.san/p.sanMax)*100,0,100)}%`;

      const st=[];
      if(Input.confusionT>0) st.push("CONFUSION");
      if(p.status.slowT>0) st.push("SLOW");
      if(p.status.griefT>0) st.push("GRIEF");
      if(p.status.wiggleT>0) st.push("WIGGLE");
      if(p.status.memoryT>0) st.push("MEMORY");
      if(p.hasFriend) st.push(p.friendBoostT>0 ? "FRIEND+" : "FRIEND");
      st.push(p.currentWeapon().id);
      UI.uiStatus.textContent = st.join(" · ");

      UI.uiScore.textContent = `SCORE: ${this.score.score}`;
      UI.uiMission.textContent = this.mission?.title() || "";

      if(this.mission?.id==="SURVIVE_120"){
        const t=Math.ceil(this.mission.timeLeft);
        const mm=String(Math.floor(t/60)).padStart(1,"0");
        const ss=String(t%60).padStart(2,"0");
        UI.uiTimer.textContent = `TIME: ${mm}:${ss}`;
      } else {
        UI.uiTimer.textContent = `DEPTH: ${(p.x/10)|0}m`;
      }

      UI.uiMode.textContent = this.madness.active ? "MADNESS (INVERTED)" : (this.tension.mode==="frenetic"?"FRENETIC":"ATMOSPHERE");
      UI.uiMood.textContent = `MOOD: ${this.mood.id}`;

      // Madness timer
      if(this.madness.active){
        const t=Math.ceil(this.madness.t);
        const ss=String(t%60).padStart(2,"0");
        UI.uiMadness.textContent = `MADNESS 00:${ss} · TARGET: HER`;
        UI.uiMadness.style.color = "#ff2a2a";
      }

      // boss bar
      if(this.boss && !this.boss.dead){
        UI.bossWrap.style.display = "block";
        UI.bossFill.style.width = `${clamp((this.boss.hp/this.boss.hpMax)*100,0,100)}%`;
      } else {
        UI.bossWrap.style.display = "none";
      }
    }
  }

  const game = new Game();

  /********************************************************************
   * Loop
   ********************************************************************/
  let last = performance.now();
  function loop(t){
    const dt = Math.min(0.033, (t-last)/1000);
    last=t;

    // dialog shortcut
    if(game.state==="dialog" && Dialogs.active){
      if(Input._justPressed("Space")) game.pickDialog(0);
    }

    if(game.state==="play") game.update(dt);
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

    ASSETS.allowImages = !!UI.optImages.checked;
    await ASSETS.loadList(OPTIONAL_ASSET_LIST);

    UI.menu.style.display="none";
    UI.end.style.display="none";
    UI.dialog.style.display="none";

    game.startRun({
      name: (UI.inName.value||"SEEKER").trim().slice(0,14),
      avatar: UI.getAvatar(),
      missionId: UI.inMission.value,
      allowImages: UI.optImages.checked,
      allowConfusion: UI.optConfusion.checked,
      hardAudio: UI.optHardAudio.checked
    });

    AudioSys.setMuted(false);
    UI.btnMute.textContent="AUDIO: ON";
  };

})();
