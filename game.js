/* LO-FI ANGELS // ASYLUM PROTOCOL (Extended)
   - Vanilla JS, no build, no external URLs
   - 2 bosses + boss roulette: Termite Saint + Orderly King
   - Neutral NPCs (patients) with hidden trust seed: ally/ambush/uncertain
   - More hidden madness triggers (unknown per run), cryptic autopsy on end
   - Madness inversion: enemies harmless + NOT killable; Daughter becomes hostile & must be killed
   - If Daughter was touched/saved before madness: she UNBINDS and attacks during madness
   - Termite boss: leap over player causes damage + spawns oozing worm monsters
   - Bosses are hittable & killable (telegraphed vulnerability windows)
*/

(() => {
  "use strict";

  /********************************************************************
   * Utils
   ********************************************************************/
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const randi = (a, b) => a + ((Math.random() * (b - a + 1)) | 0);
  const chance = (p) => Math.random() < p;
  const sign = (x) => (x < 0 ? -1 : 1);
  const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

  function aabb(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  /********************************************************************
   * Canvas: internal low-res buffer for pixel vibe
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
      slime:"#7b0041" // cranberry ooze
    },
    chapel: {
      bg:"#030304", ground:"#08080b", solid:"#13131a",
      ui:"#f0f0f6", dim:"#9a9ab6",
      accent:"#ffcc00", danger:"#ff3355",
      child:"#00ffaa", fog:"rgba(0,0,0,0.95)",
      blood:"#b0122a", gore:"#4a0b18", glass:"#9bf2ff", sick:"#e5ff7a",
      slime:"#8a0048"
    },
    meltdown: {
      bg:"#040307", ground:"#090812", solid:"#190f2c",
      ui:"#f7efff", dim:"#b2a6c9",
      accent:"#ff3cff", danger:"#ff2a2a",
      child:"#00ffaa", fog:"rgba(0,0,0,0.90)",
      blood:"#c10f33", gore:"#59061a", glass:"#b6f6ff", sick:"#b9ff6a",
      slime:"#a10058"
    }
  };

  const WARD_MOODS = [
    { id:"SULLEN",   label:"Sullen Ward",   desc:"Fewer enemies, more notes, slower dread.", spawnMul:0.85, chestMul:0.95, triggerMul:1.25 },
    { id:"HUNGRY",   label:"Hungry Ward",   desc:"More enemies, more drops, louder corridors.", spawnMul:1.15, chestMul:1.10, triggerMul:1.00 },
    { id:"DEVOUT",   label:"Devout Ward",   desc:"More Wailers & Memory, reality bends politely.", spawnMul:1.00, chestMul:0.95, triggerMul:1.25 },
    { id:"CARNIVAL", label:"Carnival Ward", desc:"More chests, more confusion, more laughs (none yours).", spawnMul:1.05, chestMul:1.30, triggerMul:1.15 },
  ];

  /********************************************************************
   * UI
   ********************************************************************/
  function injectCSS() {
    const css = `
      html,body{margin:0;height:100%;background:#000;overflow:hidden;font-family:ui-monospace,Menlo,Consolas,monospace}
      #game{position:fixed;inset:0;width:100%;height:100%;image-rendering:pixelated;display:block;background:#000}
      .gOverlay{position:fixed;inset:0;display:grid;place-items:center;z-index:50;background:rgba(0,0,0,.86)}
      .gPanel{width:min(980px,94vw);background:#0f0f14;border:1px solid #2b2b35;box-shadow:0 0 34px rgba(0,0,0,.65);padding:18px 18px 16px}
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
      .gHud{position:fixed;left:12px;right:12px;top:10px;z-index:40;display:flex;justify-content:space-between;pointer-events:none;mix-blend-mode:normal;background:rgba(0,0,0,0.25);backdrop-filter:blur(2px);padding:6px 8px;border:1px solid rgba(255,255,255,0.05);border-radius:10px}
      .gBars{display:grid;gap:6px}
      .gStat{color:#fff;font-size:10px;letter-spacing:1px;text-transform:uppercase}
      .gBar{width:150px;height:5px;background:#2a2a33;position:relative}
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
      .bossTrack{width:280px;height:6px;background:#2a2a33}
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
          <br><span style="color:#ff2a2a">MADNESS:</span> enemies become harmless; the Daughter becomes your predator.
        </p>

        <div class="gRow">
          <div class="gField">
            <div class="gLabel">IDENTITY</div>
            <input id="inName" class="gInput" maxlength="14" value="SEEKER" />
            <div class="gTiny">
              Hidden triggers change per run. Patients may be friends. Or bait. You won’t know.
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
            <div class="gTiny">Boss roulette is on. Some runs end in a different nightmare.</div>
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
        <div style="margin-top:12px" class="gTiny" id="endAutopsy"></div>
        <div style="margin-top:10px" class="gTiny" id="endBadges"></div>
        <div style="margin-top:16px;display:flex;gap:10px;justify-content:center">
          <button class="gBtn" id="btnRestart">REBOOT</button>
        </div>
      </div>
    `;
    document.body.appendChild(end);

    const avatars = [
      { id: 0, name: "Vanguard",  desc: "Balanced. Good recoil control." },
      { id: 1, name: "Occultist", desc: "Higher sanity. Stranger visions." },
      { id: 2, name: "Heavy",     desc: "More HP. Slower, sturdier." },
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
      endAutopsy: end.querySelector("#endAutopsy"),
      endBadges: end.querySelector("#endBadges"),

      bossWrap: boss,
      bossName: boss.querySelector("#bossName"),
      bossFill: boss.querySelector("#bossFill"),

      toast
    };
  }

  const UI = makeUI();

  /********************************************************************
   * Input (stable confusion: timed swap, not random)
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
   * Event Bus
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
   * Optional local assets (PNG)
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
    "assets/angel.png","assets/fiend.png","assets/golem.png","assets/crazy.png","assets/wailer.png",
    "assets/oozer.png",
    "assets/daughter.png","assets/daughter_unbound.png",
    "assets/patient.png",
    "assets/face1.png","assets/face2.png","assets/face3.png",
    "assets/worm.png",
    "assets/orderly_king.png"
  ];

  /********************************************************************
   * Procedural sprite drawing (fallback if PNG missing)
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

    if (kind === "daughter_unbound") {
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
      // claws
      ctx.fillStyle="#000";
      ctx.fillRect(px(0), py(20), 4, 2);
      ctx.fillRect(px(12), py(20), 4, 2);
      return;
    }

    if (kind === "angel") {
      ctx.fillStyle = "#2a0a12"; ctx.fillRect(px(4), py(8), 12, 12);
      ctx.fillStyle = pal.danger; ctx.fillRect(px(5), py(9), 10, 10);
      ctx.fillStyle = "#09090b"; ctx.fillRect(px(6), py(4), 8, 5);
      eye(7, 5, true); eye(11, 5, true);
      const s = (Math.sin(t * 0.55) * 2) | 0;
      ctx.fillStyle="#111";
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
      // spikes
      ctx.fillStyle="#000";
      ctx.fillRect(px(2), py(18), 2, 2);
      ctx.fillRect(px(16), py(18), 2, 2);
      return;
    }

    if (kind === "golem") {
      ctx.fillStyle = "#0f0f14"; ctx.fillRect(px(4), py(6), 12, 18);
      ctx.fillStyle = "#2d2d38"; ctx.fillRect(px(5), py(7), 10, 16);
      ctx.fillStyle = "#1a1a22"; ctx.fillRect(px(6), py(9), 8, 4);
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

    if (kind === "oozer") {
      // disgusting worm monster oozing cranberry juice
      const sl = Math.sin(t*0.7)*2;
      ctx.fillStyle="#0b0b10"; ctx.fillRect(px(2), py(12), 14, 10);
      ctx.fillStyle=pal.slime; ctx.fillRect(px(3), py(13), 12, 8);
      ctx.fillStyle=pal.blood; ctx.fillRect(px(4), py(14), 10, 6);
      ctx.fillStyle="#fff000"; ctx.fillRect(px(12), py(15), 2, 1);
      ctx.fillStyle="#000"; ctx.fillRect(px(5), py(17), 6, 1);
      ctx.globalAlpha=0.6;
      ctx.fillStyle=pal.slime;
      ctx.fillRect(px(1), py(22+sl), 4, 2);
      ctx.fillRect(px(13), py(22-sl), 4, 2);
      ctx.globalAlpha=1;
      return;
    }

    if (kind === "patient") {
      // neutral NPC
      ctx.fillStyle="#0c0c12"; ctx.fillRect(px(6), py(6), 8, 18);
      ctx.fillStyle="#e0e0ea"; ctx.fillRect(px(7), py(2), 6, 5);
      ctx.fillStyle="#111"; ctx.fillRect(px(8), py(4), 1, 1); ctx.fillRect(px(11), py(4), 1, 1);
      ctx.fillStyle=pal.accent; ctx.fillRect(px(10), py(4), 1, 1);
      ctx.fillStyle="#15151d"; ctx.fillRect(px(5), py(12), 2, 7); ctx.fillRect(px(14), py(12), 2, 7);
      ctx.fillStyle="#111"; ctx.fillRect(px(7), py(23), 2, 6); ctx.fillRect(px(11), py(23), 2, 6);
      return;
    }

    if (kind === "orderly") {
      // boss fallback
      ctx.fillStyle="#0b0b10"; ctx.fillRect(px(4), py(2), 12, 26);
      ctx.fillStyle="#2b2b35"; ctx.fillRect(px(5), py(3), 10, 24);
      ctx.fillStyle=pal.danger; ctx.fillRect(px(6), py(6), 8, 6);
      ctx.fillStyle="#000"; ctx.fillRect(px(7), py(8), 2, 1); ctx.fillRect(px(11), py(8), 2, 1);
      ctx.fillStyle="#111"; ctx.fillRect(px(2), py(14), 4, 2);
      ctx.fillStyle="#111"; ctx.fillRect(px(14), py(14), 4, 2);
      ctx.fillStyle="#000"; ctx.fillRect(px(16), py(16), 6, 2); // baton
      return;
    }
  }

  /********************************************************************
   * Audio (procedural, abrasive)
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
      for(let i=0;i<d.length;i++) d[i] = (Math.random()*2-1)*0.95;

      const noise = this.ctx.createBufferSource(); noise.buffer=noiseBuf; noise.loop=true;
      const noiseGain = this.ctx.createGain(); noiseGain.gain.value = 0;

      const drone1 = this.ctx.createOscillator(); drone1.type="sawtooth"; drone1.frequency.value=52;
      const drone2 = this.ctx.createOscillator(); drone2.type="square"; drone2.frequency.value=104;
      const droneGain = this.ctx.createGain(); droneGain.gain.value=0;

      const lp = this.ctx.createBiquadFilter(); lp.type="lowpass"; lp.frequency.value=200;
      const hp = this.ctx.createBiquadFilter(); hp.type="highpass"; hp.frequency.value=34;

      const pulse = this.ctx.createOscillator(); pulse.type="square"; pulse.frequency.value=2;
      const pulseGain = this.ctx.createGain(); pulseGain.gain.value=0;

      const lfo = this.ctx.createOscillator(); lfo.type="sine"; lfo.frequency.value=0.16;
      const lfoGain = this.ctx.createGain(); lfoGain.gain.value=65;
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
      this.master.gain.setTargetAtTime(m ? 0 : 0.30, t, 0.04);
    },
    setHard(v){ this.hard = v; },
    setIntensity(v, mode){
      this.intensity = clamp(v,0,1);
      this.mode = mode || this.mode;
      if(!this._nodes) return;
      const t = this.ctx.currentTime;
      const { noiseGain, droneGain, pulseGain, lp } = this._nodes;

      const base = this.muted ? 0 : 1;
      const hard = this.hard ? 1 : 0.60;

      droneGain.gain.setTargetAtTime(base*(0.06+this.intensity*0.18)*hard, t, 0.06);
      const nT = (this.mode==="atmosphere") ? (0.03+this.intensity*0.08) : (0.08+this.intensity*0.24);
      noiseGain.gain.setTargetAtTime(base*nT*hard, t, 0.05);

      const pT = (this.mode==="atmosphere") ? (0.01+this.intensity*0.04) : (0.05+this.intensity*0.16);
      pulseGain.gain.setTargetAtTime(base*pT*hard, t, 0.05);

      const f = (this.mode==="atmosphere") ? (150+this.intensity*240) : (260+this.intensity*1100);
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
      o.frequency.setValueAtTime(type==="hit"?85:(type==="laser"?430:190), t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.14*amp, t+0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t+(type==="hit"?0.22:0.12));
      o.connect(f).connect(g).connect(this.master);
      o.start(t); o.stop(t+0.28);
    }
  };

  /********************************************************************
   * FX: particles + decals + post effects
   ********************************************************************/
  class Particle {
    constructor(x,y,kind,pal){
      this.x=x; this.y=y; this.kind=kind;
      this.vx=rand(-70,70);
      this.vy=rand(-120,50);
      this.life=rand(0.35,0.95);
      this.pal=pal;
      this.sz=(kind==="gib")?randi(2,4):randi(1,3);
    }
    update(dt){
      this.life-=dt;
      this.x+=this.vx*dt;
      this.y+=this.vy*dt;
      this.vy+=260*dt;
    }
    draw(ctx,camx){
      if(this.life<=0) return;
      ctx.globalAlpha = clamp(this.life*1.5,0,1);
      if(this.kind==="blood") ctx.fillStyle=this.pal.blood;
      else if(this.kind==="gib") ctx.fillStyle=this.pal.gore;
      else if(this.kind==="slime") ctx.fillStyle=this.pal.slime;
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
      ctx.fillStyle = (this.type==="blood") ? this.pal.blood : (this.type==="slime" ? this.pal.slime : "#111");
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
        if(chance(0.22)) return "CONFUSION";
        if(chance(0.35)) return "WIGGLE";
        return "MEMORY";
      }
      if(this.kind==="chest"){
        AudioSys.ping("hit",0.9);
        const roll=Math.random();
        if(roll<0.22) return "FRIEND";
        if(roll<0.44) return "LASER";
        if(roll<0.62) return "HP";
        if(roll<0.78) return "SAN";
        if(roll<0.90) return "GLITCH";
        return "OOZE"; // power-down / weird
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
      for(let i=0;i<240;i++){
        x += randi(42,90);
        if(chance(0.25)){
          const w=randi(14,34), h=randi(10,28);
          this.obstacles.push({x, y:this.groundY-h, w, h});
        }
        if(chance(0.30)){
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
      this.exitX = x + 240;
    }
    drawBackground(ctx,pal,t,mood){
      ctx.fillStyle=pal.bg; ctx.fillRect(0,0,RW,RH);

      // asylum silhouettes / beds / doors parallax
      ctx.globalAlpha=0.16;
      ctx.fillStyle="#0a0a10";
      for(let i=0;i<14;i++){
        const bx = (((i*80)-(this.camx*0.35))%(RW+120))-60;
        const by = 40 + (i%3)*10;
        ctx.fillRect(bx|0, by|0, 60, 90);
        if(i%2===0) ctx.fillRect((bx+18)|0, (by+20)|0, 22, 8); // bed slab
        if(i%3===0) ctx.fillRect((bx+8)|0, (by+10)|0, 10, 16); // door-ish
      }
      ctx.globalAlpha=1;

      // mood tint
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
   * Dialogue
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
   * Base entities
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
    constructor(x,y,vx,vy,dmg,owner){
      this.x=x; this.y=y; this.vx=vx; this.vy=vy;
      this.dmg=dmg; this.owner=owner; // player|friend
      this.w=3; this.h=2;
      this.dead=false;
      this.life=1.25;
    }
    update(dt,game){
      this.life-=dt;
      this.x+=this.vx*dt;
      this.y+=this.vy*dt;
      if(this.life<=0) this.dead=true;
      if(this.y<-20||this.y>RH+30) this.dead=true;

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
      ctx.fillStyle = "#ffe36a";
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
      if(this.kind==="OOZE") c=pal.slime;
      ctx.fillStyle="#000"; ctx.fillRect(x-1,y-1,this.w+2,this.h+2);
      ctx.fillStyle=c; ctx.fillRect(x,y,this.w,this.h);
      ctx.fillStyle="#111"; ctx.fillRect(x+2,y+2,this.w-4,2);
    }
  }

  /********************************************************************
   * Player
   ********************************************************************/
  class Player extends Entity {
    constructor(name, avi){
      super(40,0,18,28);
      this.name=name;
      this.avi=avi;

      this.hpMax = (avi===2)?170:115;
      this.hp=this.hpMax;
      this.sanMax = (avi===1)?150:100;
      this.san=this.sanMax;

      this.speed = (avi===2)?72:96;
      this.jump  = (avi===2)?210:238;

      this.facing=1;
      this.shootCD=0;

      this.weapons=[
        { id:"PISTOL", name:"Pistol", type:"gun", dmg:9, rate:0.17, spread:0.03, sanityCost:0.25 },
        { id:"LASER",  name:"Flesh-Cutting Laser", type:"laser", dmg:28, sanityCostPerSec:11.5 }
      ];
      this.hasLaser=false;
      this.weaponIndex=0;

      this.status={ slowT:0, griefT:0, wiggleT:0, memoryT:0, oozeT:0 };
      this.hasFriend=false;
      this.friendBoostT=0;

      this.lantern=160;

      this.shots=0; this.hits=0;
      this._lastHitTime=0;
    }
    currentWeapon(){
      if(!this.hasLaser && this.weapons[this.weaponIndex].id==="LASER") this.weaponIndex=0;
      return this.weapons[this.weaponIndex];
    }
    swapWeapon(){
      this.weaponIndex=(this.weaponIndex+1)%this.weapons.length;
      if(!this.hasLaser && this.weapons[this.weaponIndex].id==="LASER") this.weaponIndex=0;
    }
    hurt(dmg, fromX, game){
      // Defensive: prevent NaN damage from killing runs silently
      dmg = Number(dmg);
      if(!Number.isFinite(dmg) || dmg<=0) return;
      if(this.invT>0) return;

      this.hp = clamp(this.hp - dmg, 0, this.hpMax);
      this.invT = 0.50;

      const fx = Number.isFinite(fromX) ? fromX : this.x;
      this.vx += (this.x < fx ? -1 : 1) * 75;

      this.san = clamp(this.san - dmg*0.24, 0, this.sanMax);
      this._lastHitTime = game?.time ?? 0;
      game?.bus?.emit("player_hit",{});
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
        game.whisper("YOUR PAST LEAKS INTO THE LIGHT.",2.0);
      }
      if(kind==="CONFUSION"){
        if(Input.confusionEnabled){
          Input.confusionT=Math.max(Input.confusionT,3.7);
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
      if(kind==="OOZE"){
        // power-down: slow + wiggle + sanity drain (short)
        this.status.oozeT = Math.max(this.status.oozeT, 5.5);
        this.status.slowT = Math.max(this.status.slowT, 4.0);
        game.fx.triggerWiggle(3.5);
        game.whisper("CRANBERRY OOZE IN YOUR BOOTS.", 2.0);
      }
    }

    update(dt,game){
      this.anim += dt*60;
      this.invT = Math.max(0,this.invT-dt);

      // sanity drip
      let sanDrain = 0.9;
      if(this.status.oozeT>0) sanDrain += 1.2;
      this.san = Math.max(0, this.san - dt*sanDrain);

      this.status.slowT=Math.max(0,this.status.slowT-dt);
      this.status.griefT=Math.max(0,this.status.griefT-dt);
      this.status.wiggleT=Math.max(0,this.status.wiggleT-dt);
      this.status.memoryT=Math.max(0,this.status.memoryT-dt);
      this.status.oozeT=Math.max(0,this.status.oozeT-dt);
      this.friendBoostT=Math.max(0,this.friendBoostT-dt);

      let dir = Input.readDir();
      if(dir!==0) this.facing = dir>0?1:-1;

      let sp = this.speed;
      if(this.status.slowT>0) sp*=0.62;
      if(this.status.griefT>0) sp*=0.70;

      this.vx = dir*sp;

      if(Input.wantJump() && this.grounded){
        this.vy = -this.jump;
        AudioSys.ping("hit",0.22);
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

      // shooting (disabled during dialog/end)
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

      // sanitize vitals (prevents rare NaN causing "random" lose)
      if(!Number.isFinite(this.hp)) this.hp = this.hpMax;
      if(!Number.isFinite(this.san)) this.san = this.sanMax;
      this.hp = clamp(this.hp, 0, this.hpMax);
      this.san = clamp(this.san, 0, this.sanMax);

      this.lantern = 90 + (this.san/Math.max(1,this.sanMax))*170;
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

  /********************************************************************
   * Daughter (innocent) + DaughterUnbound (madness predator)
   ********************************************************************/
  class Daughter extends Entity {
    constructor(x){
      super(x,0,16,26);
      this.saved=false;
      this.dormant=false; // used during madness (she is "unbound" elsewhere)
      this._wanderT=rand(0.5,2.2);
      this._dir=chance(0.5)?-1:1;
      this._savedBeforeMadness=false;
    }
    update(dt,game){
      this.anim += dt*60;
      if(this.dormant) return;

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

      let fear=0;
      for(const e of game.enemies){
        const d=Math.abs(e.x-this.x);
        if(d<70) fear+=(70-d)/70;
      }
      const sp=28+fear*42;
      this.vx=this._dir*sp;

      this.vy += 520*dt;
      this.x += this.vx*dt;
      this.y += this.vy*dt;
      game.world.collide(this);
      if(this.x < game.world.camx+30) this.x = game.world.camx+30;
    }
    draw(ctx,camx,pal){
      if(this.dormant) return;
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

  class DaughterUnbound extends Entity {
    constructor(x, wasSaved){
      super(x,0,16,26);
      this.hp=44; // must be killable, but not trivial
      this.wasSaved=!!wasSaved;
      this.dashCD=0.8;
      this.hitCD=0;
    }
    update(dt,game){
      this.anim += dt*60;
      this.dashCD = Math.max(0,this.dashCD-dt);
      this.hitCD  = Math.max(0,this.hitCD-dt);

      const p=game.player;
      const dx=p.x-this.x;
      const near = Math.abs(dx)<120;

      // predator movement: stutter + dash
      if(this.dashCD<=0 && near){
        this.dashCD = 1.0 + Math.random()*0.7;
        this.vx = sign(dx) * 200;
        this.vy = -120;
        game.fx.triggerGlitch(0.10);
        AudioSys.ping("hit",0.55);
      } else {
        this.vx = sign(dx) * (near?72:48);
      }

      this.vy += 520*dt;
      this.x += this.vx*dt;
      this.y += this.vy*dt;
      game.world.collide(this);

      // damage on touch (during madness)
      if(this.hitCD<=0 && aabb(this.x,this.y,this.w,this.h,p.x,p.y,p.w,p.h)){
        this.hitCD=0.35;
        p.hurt(10, this.x, game);
        game.spawnParticle(p.cx,p.cy,"blood");
        game.whisper("SHE WANTS YOU QUIET.", 0.9);
      }
    }
    hit(dmg, game){
      this.hp -= dmg;
      for(let i=0;i<8;i++) game.spawnParticle(this.cx,this.cy, chance(0.7)?"blood":"gib");
      AudioSys.ping("hit",0.75);
      game.fx.triggerGlitch(0.06);
      if(this.hp<=0){
        this.dead=true;
        game.bus.emit("madness_target_killed",{});
        game.whisper("THE DAUGHTER STOPS MOVING.\nTHE WARD EXHALES.", 1.6);
        game.fx.triggerPaletteShift(1.5);
        game.score.add(900,"INVERSION");
      }
    }
    draw(ctx,camx,pal){
      const x=(this.x-camx)|0, y=this.y|0;
      const im=ASSETS.get("assets/daughter_unbound.png");
      if(im){ ctx.drawImage(im, x-8, y-8, 32, 32); return; }
      drawPixelSprite(ctx, x, y, this.anim, "daughter_unbound", pal);
    }
  }

  /********************************************************************
   * Neutral Patient NPC (uncertain ally/ambush) – hidden trust seed
   ********************************************************************/
  class PatientNPC extends Entity {
    constructor(x, trustSeed){
      super(x,0,16,28);
      this.kind="patient";
      this.trustSeed=trustSeed;     // hidden
      this.resolved=false;
      this._wanderT=rand(0.7,2.2);
      this._dir=chance(0.5)?-1:1;
      this._prompted=false;
      this._danger = (trustSeed < -0.25);
      this._angel  = (trustSeed >  0.35);
      this._timerToFlip = rand(18,30); // if ignored too long, may flip
    }
    update(dt,game){
      this.anim += dt*60;
      this._timerToFlip -= dt;

      // wander
      this._wanderT -= dt;
      if(this._wanderT<=0){
        this._wanderT=rand(0.9,2.8);
        this._dir=chance(0.5)?-1:1;
      }
      this.vx = this._dir*20;

      this.vy += 520*dt;
      this.x += this.vx*dt;
      this.y += this.vy*dt;
      game.world.collide(this);

      // if on screen and close, show encounter once
      if(!this.resolved && !this._prompted){
        const onScreen = Math.abs(this.x-(game.world.camx+RW/2))<250;
        if(onScreen && dist(this.cx,this.cy,game.player.cx,game.player.cy)<70){
          this._prompted=true;
          game.queuePatientEncounter(this);
        }
      }

      // if ignored too long, may become an enemy (anxious uncertainty)
      if(!this.resolved && this._timerToFlip<=0){
        this.resolved=true;
        this.dead=true;
        if(chance(0.55)){
          // ambush
          game.spawnEnemyAt(this.x+12, "fiend");
          game.spawnEnemyAt(this.x-12, "crazy");
          game.whisper("THE PATIENT WAS A DOOR WITH TEETH.", 1.8);
          game.score.add(120,"AMBUSH");
        } else {
          // disappears, leaving a note / pickup
          game.spawnPickup(this.x, game.world.groundY-16, chance(0.5)?"SAN":"MEMORY");
          game.whisper("THE PATIENT VANISHES MID-SENTENCE.", 1.6);
          game.score.add(80,"VANISH");
        }
      }
    }
    draw(ctx,camx,pal){
      const x=(this.x-camx)|0, y=this.y|0;
      const im=ASSETS.get("assets/patient.png");
      if(im){ ctx.drawImage(im, x-8, y-8, 32, 32); return; }
      drawPixelSprite(ctx, x, y, this.anim, "patient", pal);
    }
  }

  /********************************************************************
   * Enemies
   ********************************************************************/
  class Enemy extends Entity {
    constructor(x,y,type){
      super(x,y,18,26);
      this.type=type; // angel|fiend|golem|crazy|wailer|oozer
      this.touchDmg=5;
      if(type==="angel"){ this.hp=24; this.speed=40; this.touchDmg=6; }
      if(type==="fiend"){ this.hp=38; this.speed=34; this.touchDmg=8; }
      if(type==="golem"){ this.hp=80; this.speed=22; this.touchDmg=11; this.w=20; this.h=30; }
      if(type==="crazy"){ this.hp=16; this.speed=64; this.touchDmg=4; this.w=16; this.h=28; }
      if(type==="wailer"){ this.hp=28; this.speed=26; this.touchDmg=3; this.w=20; this.h=20; }
      if(type==="oozer"){ this.hp=14; this.speed=54; this.touchDmg=3; this.w=16; this.h=18; this._slimeTrail=0; }
    }

    maxHp(){
      if(this.type==="golem") return 80;
      if(this.type==="fiend") return 38;
      if(this.type==="angel") return 24;
      if(this.type==="crazy") return 16;
      if(this.type==="wailer") return 28;
      if(this.type==="oozer") return 14;
      return 30;
    }

    hit(dmg, game){
      // Madness rule: enemies must be innocuous AND not killable
      if(game.madness.active){
        // violations: healing them + guilt + score penalty
        this.hp = Math.min(this.maxHp(), this.hp + Math.max(2, dmg*0.8));
        game.score.add(-60, "HIT ENEMY (MADNESS)");
        game.madness.guilt += 1;
        game.bus.emit("madness_violation",{kind:"hit_enemy"});
        game.fx.triggerGlitch(0.08);
        game.whisper("DON'T HURT THEM. NOT NOW.", 0.9);
        return;
      }

      this.hp -= dmg;

      const goreN = Math.min(12, 2 + (dmg/6)|0);
      for(let i=0;i<goreN;i++) game.spawnParticle(this.cx,this.cy, chance(0.7)?"blood":"gib");
      if(this.type==="oozer"){
        for(let i=0;i<4;i++) game.spawnParticle(this.cx,this.cy,"slime");
        game.addDecal(this.cx, game.world.groundY-1, "slime");
      }
      if(chance(0.22)) game.fx.triggerGlitch(0.07);
      AudioSys.ping("hit",0.6);

      game.bus.emit("enemy_hit",{type:this.type, dmg});

      if(this.hp<=0){
        this.dead=true;
        game.addDecal(this.cx, game.world.groundY-1, "blood");
        game.bus.emit("enemy_kill",{type:this.type});
        game.score.onKill(this.type);

        // drops
        if(chance(0.22)) game.spawnPickup(this.x+6, game.world.groundY-16, chance(0.5)?"HP":"SAN");
        if(chance(0.05)) game.spawnPickup(this.x+6, game.world.groundY-16, "GLITCH");
        if(this.type==="oozer" && chance(0.22)) game.spawnPickup(this.x+6, game.world.groundY-16, "OOZE");
      }
    }

    update(dt,game){
      this.anim += dt*60;
      const p=game.player;
      const dx=p.x-this.x;

      // Madness: enemies are innocuous (no touch damage) and drift like attendants
      if(game.madness.active){
        const orbit = Math.sin((game.time + this.x*0.01)*2) * 16;
        this.vx = sign(dx)*this.speed*0.25 + orbit;
      } else {
        this.vx = sign(dx) * this.speed;
      }

      if(this.type==="wailer"){
        this.y += Math.sin(game.time*2 + this.x*0.01)*0.35;
        this.x += this.vx*dt;

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
        if(this.type==="oozer"){
          this._slimeTrail -= dt;
          if(this._slimeTrail<=0 && !game.madness.active){
            this._slimeTrail = 0.25 + Math.random()*0.18;
            game.addDecal(this.cx, game.world.groundY-1, "slime");
          }
        }

        this.vy += 520*dt;
        this.x += this.vx*dt;
        this.y += this.vy*dt;
        game.world.collide(this);
      }

      // touch damage (disabled during madness)
      if(!game.madness.active){
        if(aabb(this.x,this.y,this.w,this.h,p.x,p.y,p.w,p.h)){
          p.hurt(this.touchDmg*dt*6, this.x, game);
          if(this.type==="oozer"){
            p.applyEffect("OOZE", game);
          } else {
            if(chance(0.30)) game.spawnParticle(p.cx,p.cy,"blood");
          }
          game.bus.emit("player_hit",{from:this.type});
        }
      } else {
        // madness: touching enemies restores tiny sanity (twisted comfort)
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
        oozer:"assets/oozer.png"
      };
      const im=ASSETS.get(map[this.type]);
      if(im){ ctx.drawImage(im, x-6, y-6, 32, 32); return; }
      drawPixelSprite(ctx, x, y, this.anim, this.type, pal);
    }
  }

  /********************************************************************
   * Companion (weapon-friend)
   ********************************************************************/
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
        const e=game.findNearestEnemy(this.x,this.y,170);
        if(e && !game.madness.active){
          this.cd=(p.friendBoostT>0)?0.14:0.28;
          const ang=Math.atan2(e.cy-this.y,e.cx-this.x);
          const sp=430;
          game.bullets.push(new Bullet(this.x,this.y,Math.cos(ang)*sp,Math.sin(ang)*sp,6,"friend"));
          if(chance(0.25)) AudioSys.ping("shoot",0.35);
          game.score.add(2, "FRIEND SHOT");
        } else this.cd=0.20;
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
   * Bosses
   ********************************************************************/
  class TermiteSaint {
    constructor(x, groundY){
      this.id="TERMITE_SAINT";
      this.name="TERMITE SAINT";
      this.x=x;
      this.y=groundY-90;
      this.groundY=groundY;

      this.hpMax=720;
      this.hp=this.hpMax;

      this.phase=1;
      this.t=0;

      this.burrowT=1.8;
      this.exposedT=0;
      this.spawnCD=2.0;

      // leap attack (jump over protagonist)
      this.leap={ active:false, t:0, dur:0, sx:0, ex:0, peak:0, hitDone:false };

      // segments
      this.seg=[];
      const n=20;
      for(let i=0;i<n;i++) this.seg.push({x:this.x - i*10, y:this.y});

      this.dead=false;
      this.hurtFlashT=0;
    }

    isHittable(){
      // hittable whenever exposed OR leaping above ground
      return (this.burrowT<=0 && this.exposedT>0) || this.leap.active;
    }

    takeDamage(dmg, game){
      if(!this.isHittable()) return;

      // Madness: you "shouldn't" hurt enemies; allow but heavily reduced + penalties
      const scale = game.madness.active ? 0.20 : 1.0;
      if(game.madness.active){
        game.score.add(-80, "BOSS HIT (MADNESS)");
        game.madness.guilt += 1;
        game.bus.emit("madness_violation",{kind:"hit_boss"});
      }

      this.hp -= dmg*scale;
      this.hurtFlashT = 0.12;

      for(let i=0;i<12;i++) game.spawnParticle(this.seg[0].x, this.seg[0].y, chance(0.6)?"blood":"gib");
      game.fx.triggerGlitch(0.06);

      if(this.hp<=0){
        this.hp=0;
        this.dead=true;
        game.bus.emit("boss_kill",{id:this.id});
        game.score.onBossKill(this.id);
        game.whisper("THE TERMITE SAINT FORGETS ITS MOUTH.", 2.2);
      }
    }

    update(dt, game){
      this.t += dt;
      this.hurtFlashT = Math.max(0, this.hurtFlashT - dt);
      if(this.dead) return;

      // phases
      const hpFrac = this.hp/this.hpMax;
      this.phase = (hpFrac<0.33)?3:(hpFrac<0.66?2:1);

      // Madness: bosses become non-aggressive (still hittable if exposed)
      const attacksAllowed = !game.madness.active;

      // leap logic
      if(this.leap.active){
        this.leap.t += dt;
        const u = clamp(this.leap.t / this.leap.dur, 0, 1);
        const arc = Math.sin(u*Math.PI);
        this.x = lerp(this.leap.sx, this.leap.ex, u);
        this.y = this.groundY - (this.leap.peak * arc) - 40;

        // damage when "jumping over" (head passes above player) — only once
        if(attacksAllowed && !this.leap.hitDone){
          const head = this.seg[0];
          const p = game.player;
          const close = dist(head.x, head.y, p.cx, p.cy) < 26;
          if(close){
            this.leap.hitDone = true;
            p.hurt(18, head.x, game);
            game.spawnParticle(p.cx, p.cy, "blood");
            game.whisper("THE WORM STEPS THROUGH YOU.", 1.2);
          }
        }

        if(u>=1){
          // landing splash
          if(attacksAllowed){
            const p=game.player;
            if(dist(this.x,this.groundY-10,p.cx,p.cy)<38){
              p.hurt(12, this.x, game);
              game.spawnParticle(p.cx,p.cy,"blood");
            }
          }
          for(let i=0;i<14;i++) game.spawnParticle(this.x, this.groundY-6, chance(0.55)?"blood":"slime");
          game.addDecal(this.x, this.groundY-1, "slime");
          this.leap.active=false;
          this.exposedT = Math.max(this.exposedT, 1.1 + this.phase*0.4);
        }
      } else {
        // burrow/expose cycle
        this.burrowT -= dt;
        if(this.burrowT>0){
          const targetX = game.player.x + 200 + Math.sin(game.time*0.7)*90;
          this.x = lerp(this.x, targetX, 1-Math.pow(0.001,dt));
          this.y = this.groundY + 40;
          if(this.burrowT<=0){
            this.exposedT = 1.8 + this.phase*0.65; // longer exposure (killable)
            game.fx.triggerGlitch(0.35);
            AudioSys.ping("hit", 0.9);
            game.whisper("THE FLOOR OPENS LIKE A THROAT.", 1.6);
          }
        } else {
          this.exposedT -= dt;

          const amp = 26 + this.phase*9;
          const rise = 92 + Math.sin(this.t*2.6)*12;
          this.y = this.groundY - rise;
          this.x += Math.sin(this.t*1.3)*amp*dt;

          // leap attack chance (phase 2/3)
          if(attacksAllowed && (this.phase>=2) && this.exposedT>0.6 && chance(0.012)){
            this.leap.active=true;
            this.leap.t=0;
            this.leap.dur = 0.65 + Math.random()*0.25;
            this.leap.sx = this.x;
            this.leap.ex = game.player.x + (chance(0.5)?-80:80);
            this.leap.peak = 120 + this.phase*25;
            this.leap.hitDone=false;
            game.fx.triggerGlitch(0.12);
            AudioSys.ping("hit", 0.85);
          }

          // spawn disgusting oozers (cranberry juice worms)
          this.spawnCD -= dt;
          const spawnRate = (this.phase===1)?2.2:(this.phase===2?1.6:1.15);
          if(this.spawnCD<=0){
            this.spawnCD = spawnRate;
            if(attacksAllowed){
              const sx = this.x + randi(-24,24);
              const sy = this.groundY - 18;
              game.enemies.push(new Enemy(sx, sy, "oozer"));
              game.whisper("CRANBERRY WORMS CRAWL OUT.", 0.8);
            }
          }

          if(this.exposedT<=0){
            this.burrowT = 1.6 + Math.random()*1.1;
          }
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
        b.x += dx*k*0.66;
        b.y += dy*k*0.66;
      }

      // segment touch damage (only when attacks allowed)
      if(attacksAllowed && (this.burrowT<=0 || this.leap.active)){
        const p=game.player;
        for(let i=0;i<7;i++){
          const s=this.seg[i];
          if(dist(p.cx,p.cy,s.x,s.y)<16){
            p.hurt(10, s.x, game);
            game.spawnParticle(p.cx, p.cy, "blood");
            break;
          }
        }
      }
    }

    draw(ctx, camx, pal){
      if(this.dead) return;

      const im = ASSETS.get("assets/worm.png");
      const hit = this.isHittable();
      if(im && hit){
        const x=(this.seg[0].x-camx)|0, y=(this.seg[0].y)|0;
        ctx.globalAlpha=0.65;
        ctx.drawImage(im, x-64, y-64, 128, 128);
        ctx.globalAlpha=1;
      }

      for(let i=this.seg.length-1;i>=0;i--){
        const s=this.seg[i];
        const x=(s.x-camx)|0, y=(s.y)|0;
        const r = 8 - i*0.14;
        ctx.globalAlpha = 0.95;
        ctx.fillStyle = (i%2===0)? pal.gore : pal.blood;
        ctx.beginPath();
        ctx.arc(x, y, Math.max(2,r), 0, Math.PI*2);
        ctx.fill();

        if(i%3===0){
          ctx.strokeStyle = "#000";
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x+Math.sin(i)*6, y-6);
          ctx.stroke();
        }
      }
      ctx.globalAlpha=1;

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
        ctx.fillRect(hx-16, hy-16, 32, 32);
        ctx.globalAlpha=1;
      }
    }
  }

  class OrderlyKing {
    constructor(x, groundY){
      this.id="ORDERLY_KING";
      this.name="ORDERLY KING";
      this.x=x; this.y=groundY-44;
      this.groundY=groundY;

      this.hpMax=860;
      this.hp=this.hpMax;

      this.dead=false;
      this.hurtFlashT=0;

      this.phase=1;
      this.t=0;

      this.vx=0;
      this.attackCD=2.2;
      this.slamT=0;
      this.throwCD=1.7;
    }

    isHittable(){ return true; }

    takeDamage(dmg, game){
      if(this.dead) return;

      const scale = game.madness.active ? 0.20 : 1.0;
      if(game.madness.active){
        game.score.add(-80, "BOSS HIT (MADNESS)");
        game.madness.guilt += 1;
        game.bus.emit("madness_violation",{kind:"hit_boss"});
      }

      this.hp -= dmg*scale;
      this.hurtFlashT = 0.12;
      for(let i=0;i<10;i++) game.spawnParticle(this.x+12, this.y+18, chance(0.6)?"blood":"gib");
      AudioSys.ping("hit",0.75);
      if(this.hp<=0){
        this.hp=0; this.dead=true;
        game.bus.emit("boss_kill",{id:this.id});
        game.score.onBossKill(this.id);
        game.whisper("THE KING DROPS HIS KEYS.\nTHE DOORS DON’T OPEN.", 2.2);
      }
    }

    update(dt, game){
      this.t += dt;
      this.hurtFlashT = Math.max(0, this.hurtFlashT - dt);
      if(this.dead) return;

      const hpFrac = this.hp/this.hpMax;
      this.phase = (hpFrac<0.33)?3:(hpFrac<0.66?2:1);

      const attacksAllowed = !game.madness.active;

      const p=game.player;
      const dx = p.x - this.x;

      // heavy stalk
      const sp = 28 + this.phase*10;
      this.vx = sign(dx) * sp;
      this.x += this.vx*dt;

      // stay on ground
      this.y = this.groundY - 44;

      // slam shockwave
      this.attackCD -= dt;
      if(attacksAllowed && this.attackCD<=0){
        this.attackCD = (this.phase===1?2.2:(this.phase===2?1.8:1.4)) + Math.random()*0.4;
        this.slamT = 0.45;
        game.fx.triggerGlitch(0.12);
        AudioSys.ping("hit", 0.95);
        game.whisper("THE KING DECLARES THE FLOOR GUILTY.", 1.0);
      }

      if(this.slamT>0){
        this.slamT -= dt;
        // shockwave damage zone
        if(attacksAllowed){
          const r = 46 + this.phase*10;
          if(dist(this.x, this.groundY-10, p.cx, p.cy) < r){
            p.hurt(14*dt*6, this.x, game);
          }
        }
      }

      // throw “syringe shards” (bullets) occasionally
      this.throwCD -= dt;
      if(attacksAllowed && this.throwCD<=0){
        this.throwCD = (this.phase===1?1.9:(this.phase===2?1.45:1.1)) + Math.random()*0.3;
        const ox=this.x+10;
        const oy=this.y+18;
        const ang=Math.atan2(p.cy-oy, p.cx-ox) + rand(-0.18,0.18);
        const sp2=260 + this.phase*50;
        game.enemyProjectiles.push({x:ox,y:oy,vx:Math.cos(ang)*sp2,vy:Math.sin(ang)*sp2,life:1.6});
        game.fx.triggerGlitch(0.05);
        AudioSys.ping("shoot",0.45);
      }

      // touch damage
      if(attacksAllowed && aabb(this.x,this.y,26,44,p.x,p.y,p.w,p.h)){
        p.hurt(10*dt*6, this.x, game);
      }

      // spawn attendants (rare)
      if(attacksAllowed && this.phase>=2 && chance(0.006)){
        game.spawnEnemyAt(this.x + randi(-60,60), chance(0.6)?"angel":"fiend");
      }
    }

    draw(ctx, camx, pal){
      if(this.dead) return;
      const x=(this.x-camx)|0, y=(this.y)|0;

      const im=ASSETS.get("assets/orderly_king.png");
      if(im){ ctx.drawImage(im, x-22, y-16, 64, 64); }
      else { drawPixelSprite(ctx, x, y, this.t*60, "orderly", pal); }

      if(this.slamT>0){
        ctx.globalAlpha=0.18;
        ctx.fillStyle=pal.danger;
        ctx.beginPath();
        ctx.arc(x+12, (this.groundY-10)|0, 46 + this.phase*10, 0, Math.PI*2);
        ctx.fill();
        ctx.globalAlpha=1;
      }

      if(this.hurtFlashT>0){
        ctx.globalAlpha=0.22;
        ctx.fillStyle="#fff";
        ctx.fillRect(x-8,y-8,40,56);
        ctx.globalAlpha=1;
      }
    }
  }

  /********************************************************************
   * Score + Badges + Autopsy
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
      this.breaks=0;
      this.madnessEpisodes=0;
      this.violations=0;
      this.bossKills=0;
      this.patientDeals=0;
      this.patientKills=0;
      this.breakdown = [];

      game.bus.on("shot", () => { this.shots++; this.add(1,"SHOT"); this.comboT=Math.max(this.comboT, 1.8); });
      game.bus.on("enemy_hit", () => { this.hits++; this.add(2,"HIT"); this.comboT=Math.max(this.comboT, 2.3); });
      game.bus.on("enemy_kill", () => { this.kills++; this.comboT=Math.max(this.comboT, 2.8); this.combo = clamp(this.combo + 0.08, 1, 2.6); });
      game.bus.on("prop_break", () => { this.breaks++; this.add(8,"BREAK"); });
      game.bus.on("madness_start", () => { this.madnessEpisodes++; this.add(140,"MADNESS"); });
      game.bus.on("madness_violation", () => { this.violations++; this.add(-30,"VIOLATION"); });
      game.bus.on("boss_kill", () => { this.bossKills++; });
      game.bus.on("patient_deal", () => { this.patientDeals++; this.add(120,"PATIENT"); });
      game.bus.on("patient_kill", () => { this.patientKills++; this.add(-120,"PATIENT KILLED"); });
    }
    add(v, reason){
      this.score = Math.max(0, (this.score + v) | 0);
      if(reason && Math.random()<0.08) this.breakdown.push(`${reason} ${v>=0?"+":""}${v}`);
      if(this.breakdown.length>10) this.breakdown.shift();
    }
    onKill(type){
      const base = { crazy:60, angel:90, fiend:140, golem:240, wailer:170, oozer:80 }[type] ?? 80;
      const pts = Math.floor(base * this.combo);
      this.add(pts, `${type.toUpperCase()} KILL`);
    }
    onBossKill(_id){
      this.add(2600, "BOSS");
      this.add(900, "SURGE");
    }
    tick(dt){
      if(this.comboT>0) this.comboT -= dt;
      else this.combo = lerp(this.combo, 1, 1 - Math.pow(0.02, dt));
    }
    finalBreakdown(game){
      const hpFrac = game.player.hp/game.player.hpMax;
      const sanFrac = game.player.san/game.player.sanMax;
      if(hpFrac>0.8) this.add(300, "UNBROKEN BODY");
      if(sanFrac<0.2) this.add(650, "BARELY HUMAN");

      if(game._flags.won){
        this.add(400, "COMPLETION");
        if(game.mission?.id==="SAVE_CHILD" && game._flags.daughterSavedEver) this.add(1200, "DAUGHTER TOUCHED");
      }

      // ward morality
      this.add(Math.max(0, game.madness.approval*60), "WARD APPROVAL");
      this.add(-Math.min(1200, game.madness.guilt*45), "GUILT");

      return [
        `Score: ${this.score}`,
        `Kills: ${this.kills} · Breaks: ${this.breaks} · Bosses: ${this.bossKills}`,
        `Shots: ${this.shots} · Hits: ${this.hits} · Combo Peak: x${this.combo.toFixed(2)}`,
        `Madness Episodes: ${this.madnessEpisodes} · Violations: ${this.violations}`,
        `Patient Deals: ${this.patientDeals} · Patient Kills: ${this.patientKills}`,
        `Ward Approval: ${game.madness.approval} · Guilt: ${game.madness.guilt}`,
      ].join("\n");
    }
  }

  class BadgeManager {
    constructor(game){
      this.g=game;
      this.key="ASYLUM_BADGES_V2";
      this.unlocked = new Set(JSON.parse(localStorage.getItem(this.key)||"[]"));
      this.sessionUnlocked = new Set();

      this.stats = {
        glassBreaks:0,
        noHit:true,
        silentOath:true,
        oozeHits:0,
        madnessClears:0,
        bosses:0,
        patientHelp:0,
        patientShot:false,
      };

      game.bus.on("player_hit", ()=>{ this.stats.noHit=false; });
      game.bus.on("shot", ()=>{ this.stats.silentOath=false; });
      game.bus.on("prop_break", (p)=>{ if(p.kind==="glass") this.stats.glassBreaks++; });
      game.bus.on("madness_target_killed", ()=>{ this.stats.madnessClears++; });
      game.bus.on("boss_kill", ()=>{ this.stats.bosses++; });
      game.bus.on("patient_deal", ()=>{ this.stats.patientHelp++; });
      game.bus.on("patient_kill", ()=>{ this.stats.patientShot=true; });

      this.defs = [
        { id:"WARD_RUNNER", name:"Ward Runner", desc:"Finish any mission.", test:(g)=>g._flags.won },
        { id:"GLASS_CHOIR", name:"Glass Choir", desc:"Break 40 glass panes.", test:(_g,b)=>b.stats.glassBreaks>=40 },
        { id:"SILENT_OATH", name:"Silent Oath", desc:"Win without firing.", test:(g,b)=>g._flags.won && b.stats.silentOath },
        { id:"NO_HIT", name:"No Bruises", desc:"Win without taking damage.", test:(g,b)=>g._flags.won && b.stats.noHit },
        { id:"CRANBERRY_BAPTISM", name:"Cranberry Baptism", desc:"Get slimed 3 times and live.", test:(_g,b)=>b.stats.oozeHits>=3 },
        { id:"INVERSION_PRIEST", name:"Inversion Priest", desc:"Clear Madness 2 times in one run.", test:(_g,b)=>b.stats.madnessClears>=2 },
        { id:"DUAL_CROWN", name:"Dual Crown", desc:"Kill two bosses in one run.", test:(_g,b)=>b.stats.bosses>=2 },
        { id:"KINDNESS_TAX", name:"Kindness Tax", desc:"Help patients 3 times.", test:(_g,b)=>b.stats.patientHelp>=3 },
        { id:"NO_WITNESS", name:"No Witness", desc:"Shoot a patient. (The ward remembers.)", test:(_g,b)=>b.stats.patientShot },
      ];
    }

    unlock(id){
      if(this.unlocked.has(id)) return;
      this.unlocked.add(id);
      this.sessionUnlocked.add(id);
      localStorage.setItem(this.key, JSON.stringify([...this.unlocked]));
      const def = this.defs.find(d=>d.id===id);
      UI.toast(`BADGE: ${def?def.name:id}`);
    }

    evaluateOnEnd(){
      for(const d of this.defs){
        if(this.unlocked.has(d.id)) continue;
        try{ if(d.test(this.g, this)) this.unlock(d.id); } catch(_e){}
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
      if(this.id==="SAVE_CHILD") return "Mission: Touch the Daughter";
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
        if(game._flags.daughterSavedEver){
          this.done=true;
          game.win("You touched her hand.\n\nNow she knows your shape.");
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
   * Madness Manager (more triggers + per-run unknown selection)
   * Madness inversion:
   *  - Enemies harmless + unkillable
   *  - Daughter becomes hostile (unbound) and must be killed before timer ends
   ********************************************************************/
  class MadnessManager {
    constructor(game){
      this.g=game;
      this.active=false;
      this.t=0;
      this.approval=0;
      this.guilt=0;

      this.triggers=[];
      this.fired=[]; // record trigger ids that actually fired (for autopsy)

      this._events={
        killsWin:[],
        glassWin:[],
        potionWin:[],
        shotsWin:[],
        hitsWin:[],
        stillT:0,
        backwardT:0,
        wallTile:null,
        wallCount:0,
        hoarderCount:0,
        daughterNeglectT:0,
        lowSanT:0,
        noLightT:0,
        oozeT:0,
        patientTrustBetray:0,
      };

      this._lastPX = 0;

      game.bus.on("enemy_kill", ()=>{ this._events.killsWin.push(game.time); });
      game.bus.on("prop_break", (p)=>{ if(p.kind==="glass") this._events.glassWin.push(game.time); });
      game.bus.on("pickup", (p)=>{
        if(["WIGGLE","MEMORY","CONFUSION","GLITCH","OOZE"].includes(p.kind)) this._events.potionWin.push(game.time);
        if(p.kind==="HP"){
          const hpFrac = game.player.hp/game.player.hpMax;
          if(hpFrac>0.86) this._events.hoarderCount++;
        }
      });
      game.bus.on("shot", ()=>{ this._events.shotsWin.push(game.time); });
      game.bus.on("enemy_hit", ()=>{ this._events.hitsWin.push(game.time); });
      game.bus.on("wall_hit", (w)=>{
        const tile = `${Math.floor(w.x/16)}:${Math.floor(w.y/16)}`;
        if(this._events.wallTile===tile) this._events.wallCount++;
        else { this._events.wallTile=tile; this._events.wallCount=1; }
      });
      game.bus.on("patient_deal", ()=>{ /* trust up in game, but tracked in autopsy */ });
      game.bus.on("patient_kill", ()=>{ this._events.patientTrustBetray += 1; });

      this.pool = [
        { id:"RED_BLOOM",         hint:"You killed too quickly.", test:()=> this.countIn(this._events.killsWin, 20) >= 20 },
        { id:"GLASS_CHOIR",       hint:"The glass sang.",        test:()=> this.countIn(this._events.glassWin, 15) >= 12 },
        { id:"POTION_SPIRAL",     hint:"You drank too much.",    test:()=> this.countIn(this._events.potionWin, 12) >= 3 },
        { id:"STILLNESS",         hint:"Stillness is a knife.",  test:()=> this._events.stillT >= 20 },
        { id:"BACKWARDS_PRAYER",  hint:"You walked backward.",   test:()=> this._events.backwardT >= 12 },
        { id:"WALL_CONFESSION",   hint:"A wall heard you.",      test:()=> this._events.wallCount >= 13 },
        { id:"HOARDER_SIN",       hint:"You stole healing.",     test:()=> this._events.hoarderCount >= 3 },
        { id:"NEGLECT",           hint:"You ignored her.",       test:()=> this._events.daughterNeglectT >= 25 },
        { id:"BULLET_WASTE",      hint:"You fired into fog.",    test:()=> (this.countIn(this._events.shotsWin, 12) - this.countIn(this._events.hitsWin, 12)) >= 18 },
        { id:"PAIN_LOOP",         hint:"Pain repeats.",          test:()=> this.countIn(this._events.hitsWin, 10) >= 8 },
        { id:"NO_LIGHT",          hint:"You lived with no light.",test:()=> this._events.noLightT >= 18 },
        { id:"BETRAYAL",          hint:"You betrayed a patient.",test:()=> this._events.patientTrustBetray >= 1 },
      ];
    }

    chooseTriggers(mood){
      // choose 5 per run (more variety)
      const weighted = this.pool.map(p=>{
        let w=1;
        if(mood.id==="DEVOUT" && (p.id==="POTION_SPIRAL"||p.id==="STILLNESS"||p.id==="NO_LIGHT")) w=1.6;
        if(mood.id==="CARNIVAL" && (p.id==="GLASS_CHOIR"||p.id==="POTION_SPIRAL"||p.id==="BULLET_WASTE")) w=1.5;
        if(mood.id==="HUNGRY" && (p.id==="RED_BLOOM"||p.id==="PAIN_LOOP")) w=1.4;
        if(mood.id==="SULLEN" && (p.id==="STILLNESS"||p.id==="BACKWARDS_PRAYER"||p.id==="NO_LIGHT")) w=1.5;
        return {p,w};
      });

      const chosen=[];
      for(let k=0;k<5;k++){
        const total = weighted.reduce((s,x)=>s+x.w,0);
        let r=Math.random()*total;
        let pick=null;
        for(const x of weighted){
          r-=x.w;
          if(r<=0){ pick=x.p; break; }
        }
        if(!pick) pick=weighted[0].p;
        chosen.push(pick);
        const idx = weighted.findIndex(x=>x.p.id===pick.id);
        if(idx>=0) weighted.splice(idx,1);
      }
      this.triggers=chosen;
    }

    countIn(arr, seconds){
      const t=this.g.time;
      while(arr.length && (t - arr[0]) > seconds) arr.shift();
      return arr.length;
    }

    start(triggerId){
      if(this.active) return;
      this.active=true;
      this.t=30;
      this.approval += 1;
      this.g.bus.emit("madness_start",{triggerId});
      this.g.score.add(250, "MADNESS");
      this.g.fx.triggerPaletteShift(2.0);
      this.g.fx.triggerGlitch(0.35);

      if(triggerId) this.fired.push(triggerId);

      // Spawn/activate madness target: DaughterUnbound
      this.g.spawnMadnessDaughter();

      this.g.whisper("MADNESS: KILL THE DAUGHTER.\nENEMIES ARE INNOCENT FOR 30s.", 2.2);
    }

    end(){
      if(!this.active) return;
      this.active=false;
      this.t=0;
      this.g.bus.emit("madness_end",{});
      this.g.fx.triggerPaletteShift(1.0);
      this.g.whisper("MADNESS ENDS. YOU REMEMBER WRONG THINGS.", 2.0);
      this.g.restoreDaughterAfterMadness();
    }

    update(dt){
      if(Input.confusionT>0) Input.confusionT = Math.max(0, Input.confusionT - dt);

      const p=this.g.player;
      const moved = Math.abs(p.x - this._lastPX);
      this._lastPX = p.x;

      if(moved < 0.2) this._events.stillT += dt;
      else this._events.stillT = Math.max(0, this._events.stillT - dt*0.5);

      const dir = Input.readDir();
      if(dir<0) this._events.backwardT += dt;
      else this._events.backwardT = Math.max(0, this._events.backwardT - dt*0.75);

      // daughter neglect only when daughter exists & not in madness
      if(this.g.daughter && !this.g.daughter.saved && !this.active){
        const onScreen = Math.abs(this.g.daughter.x - (this.g.world.camx + RW/2)) < 260;
        if(onScreen) this._events.daughterNeglectT += dt;
        else this._events.daughterNeglectT = Math.max(0, this._events.daughterNeglectT - dt);
      } else {
        this._events.daughterNeglectT = Math.max(0, this._events.daughterNeglectT - dt);
      }

      // no-light tracker
      const sanFrac = this.g.player.san / this.g.player.sanMax;
      if(sanFrac < 0.15) this._events.noLightT += dt;
      else this._events.noLightT = Math.max(0, this._events.noLightT - dt*0.7);

      if(!this.active){
        for(const tr of this.triggers){
          if(tr.test()){
            this.start(tr.id);
            break;
          }
        }
      } else {
        this.t -= dt;

        // if player killed the madness target, we "satisfy" the ward, but timer still runs
        // (you can keep playing while inverted)
        if(this.t <= 0){
          // must have killed the DaughterUnbound
          if(this.g.madDaughter && !this.g.madDaughter.dead){
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
        (game.mission?.id==="SAVE_CHILD" && !game._flags.daughterSavedEver && depth>180) ||
        (game.boss && !game.boss.dead);

      this.mode = shouldFrenetic ? "frenetic" : "atmosphere";
      const target = (this.mode==="frenetic") ? 1 : 0.22;
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
   * Game
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
      this.patients=[];

      this.enemyProjectiles=[]; // for Orderly King

      this.mission=null;

      this.daughter=null;
      this.madDaughter=null; // DaughterUnbound during madness
      this._daughterSnapshot=null;

      this.time=0;
      this.whisperText="";
      this.whisperT=0;

      this.spawnAcc=0;
      this.lastDilemmaAt=16;
      this._mercy=0;

      this._laser=null;

      this.mood = WARD_MOODS[0];

      this.score = new ScoreManager(this);
      this.badge = new BadgeManager(this);
      this.madness = new MadnessManager(this);

      // boss roulette
      this.boss=null;
      this.bossQueue=[];
      this.bossIndex=0;

      this._flags = {
        won:false,
        daughterSavedEver:false,
        termiteKilled:false,
        orderlyKilled:false
      };

      // hooks
      this.bus.on("boss_kill",(p)=>{
        if(p.id==="TERMITE_SAINT") this._flags.termiteKilled=true;
        if(p.id==="ORDERLY_KING") this._flags.orderlyKilled=true;
      });

      this.bus.on("player_hit", ()=>{
        // badge: ooze hits
        if(this.player?.status?.oozeT>0) this.badge.stats.oozeHits++;
      });
    }

    whisper(msg, t=1.8){ this.whisperText=msg; this.whisperT=t; }

    spawnParticle(x,y,kind){
      this.particles.push(new Particle(x,y,kind,this.pal));
      if(this.particles.length>1200) this.particles.splice(0,this.particles.length-1200);
    }
    addDecal(x,y,type){
      this.decals.push(new Decal(x,y,type,this.pal));
      if(this.decals.length>320) this.decals.splice(0,this.decals.length-320);
    }
    spawnPickup(x,y,kind){ this.pickups.push(new Pickup(x,y,kind)); }

    onPickup(kind){
      const p=this.player;

      if(kind==="HP"){ p.heal(30); this.whisper("A RED PACK THAT SMELLS LIKE METAL.",1.6); AudioSys.ping("hit",0.35); this.score.add(40,"HEAL"); return; }
      if(kind==="SAN"){ p.soothe(28); this.whisper("A PURPLE BREATH IN A BOTTLE.",1.6); AudioSys.ping("hit",0.35); this.score.add(40,"CALM"); return; }

      if(["WIGGLE","MEMORY","CONFUSION","GLITCH","FRIEND","LASER","OOZE"].includes(kind)){
        p.applyEffect(kind,this);
        this.score.add(70,"SUBSTANCE");
        return;
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

    buildBossQueue(){
      // roulette: random order; sometimes both bosses appear in one run
      const ids = ["TERMITE_SAINT","ORDERLY_KING"];
      // shuffle
      for(let i=ids.length-1;i>0;i--){
        const j=randi(0,i);
        [ids[i],ids[j]]=[ids[j],ids[i]];
      }
      this.bossQueue = ids;

      // 55% chance to add a second boss after the first (so “dual crown” exists)
      if(chance(0.55)){
        // add the other one as second if not already (it is)
        // already both present; keep as is
      } else {
        // keep only first boss
        this.bossQueue = [ids[0]];
      }
      this.bossIndex=0;
    }

    spawnBossIfNeeded(){
      if(this.boss && !this.boss.dead) return;
      if(this.bossIndex>=this.bossQueue.length) return;

      const depth = this.player.x;
      const wantBoss =
        (this.mission.id==="REACH_EXIT" && depth > this.world.exitX - 560) ||
        (this.mission.id==="SURVIVE_120" && this.mission.timeLeft < 58) ||
        (depth > 2100 && this.tension.mode==="frenetic");

      if(!wantBoss) return;

      const id = this.bossQueue[this.bossIndex++];
      if(id==="TERMITE_SAINT"){
        this.boss = new TermiteSaint(this.player.x + 260, this.world.groundY);
        UI.bossWrap.style.display="block";
        UI.bossName.textContent=this.boss.name;
        this.whisper("THE TERMITE SAINT ARRIVES HUNGRY.", 2.0);
      } else {
        this.boss = new OrderlyKing(this.player.x + 260, this.world.groundY);
        UI.bossWrap.style.display="block";
        UI.bossName.textContent=this.boss.name;
        this.whisper("THE ORDERLY KING COUNTS YOUR BREATHS.", 2.0);
      }

      this.score.add(200, "BOSS ARRIVAL");
      this.fx.triggerGlitch(0.35);
      AudioSys.ping("hit", 0.9);
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
      const eliteChance = clamp(lerp(0.09,0.32,stage) - mercy*0.12, 0.06, 0.32);

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
      const sp=540;

      this.bullets.push(new Bullet(ox,oy,Math.cos(ang)*sp,Math.sin(ang)*sp,wpn.dmg,"player"));
      player.san = Math.max(0, player.san - wpn.sanityCost);

      player.vx += -Math.cos(ang)*12;

      AudioSys.ping("shoot",0.65);
      if(chance(0.18)) this.spawnParticle(ox,oy,"spark");

      this.bus.emit("shot",{});
    }

    fireLaser(player, ax, ay, dt){
      if(!player.hasLaser) return;

      const wpn=player.currentWeapon();
      const ox = player.x + (player.facing>0 ? player.w : 0);
      const oy = player.y + 14;

      const ang=Math.atan2(ay-oy, ax-ox);
      const dx=Math.cos(ang), dy=Math.sin(ang);

      let hitLen=330;
      for(let t=0;t<330;t+=6){
        const px=ox+dx*t, py=oy+dy*t;
        if(py>this.world.groundY){ hitLen=t; break; }
        for(const o of this.world.obstacles){
          if(aabb(px,py,2,2,o.x,o.y,o.w,o.h)){ hitLen=t; t=9999; break; }
        }
      }

      const beamR=8;
      const dmg=wpn.dmg*dt;

      // enemies
      for(const e of this.enemies){
        if(e.dead) continue;
        const vx=e.cx-ox, vy=e.cy-oy;
        const proj=vx*dx+vy*dy;
        if(proj<0||proj>hitLen) continue;
        const px=ox+dx*proj, py=oy+dy*proj;
        if(dist(e.cx,e.cy,px,py)<beamR){
          e.hit(dmg*1.15,this);
          if(chance(0.05)) this.spawnParticle(e.cx,e.cy,"blood");
        }
      }

      // boss
      if(this.boss && !this.boss.dead){
        // hit if beam passes near boss center/head
        const bx = this.boss.x ?? (this.boss.seg ? this.boss.seg[0].x : 0);
        const by = this.boss.y ?? (this.boss.seg ? this.boss.seg[0].y : 0);
        const vx=bx-ox, vy=by-oy;
        const proj=vx*dx+vy*dy;
        if(proj>0 && proj<hitLen){
          const px=ox+dx*proj, py=oy+dy*proj;
          if(dist(bx,by,px,py)<18){
            this.boss.takeDamage(dmg*1.4, this);
            this.score.add(10,"BOSS HIT");
          }
        }
      }

      // madness daughter target
      if(this.madDaughter && !this.madDaughter.dead){
        const vx=this.madDaughter.cx-ox, vy=this.madDaughter.cy-oy;
        const proj=vx*dx+vy*dy;
        if(proj>0 && proj<hitLen){
          const px=ox+dx*proj, py=oy+dy*proj;
          if(dist(this.madDaughter.cx,this.madDaughter.cy,px,py)<12){
            this.madDaughter.hit(dmg*1.2, this);
          }
        }
      }

      player.san = Math.max(0, player.san - (wpn.sanityCostPerSec||11.5)*dt);

      this._laser = { x0:ox, y0:oy, x1:ox+dx*hitLen, y1:oy+dy*hitLen, t:0.06 };
      if(chance(0.22)) AudioSys.ping("laser",0.38);
      if(chance(0.15)) this.fx.triggerGlitch(0.06);

      this.bus.emit("shot",{});
    }

    spawnEnemyAt(x, type){
      const y=(type==="wailer") ? (this.world.groundY - randi(80,120)) : (this.world.groundY - 26);
      this.enemies.push(new Enemy(x, y, type));
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
          let r=Math.random();
          if(this.mood.id==="DEVOUT") r*=0.8;
          if(r<0.22) type="fiend";
          else if(r<0.45) type="crazy";
          else if(r<0.68) type="wailer";
          else if(r<0.86) type="golem";
          else type="oozer";
        } else {
          type = chance(0.56) ? "angel" : (chance(0.7)?"crazy":"oozer");
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
      // spawn daughter on mission, or sometimes later
      if(this.daughter) return;

      if(this.mission.id==="SAVE_CHILD"){
        this.daughter = new Daughter(this.world.camx+RW+40);
        this.whisper("THE DAUGHTER IS IN THE HALL.", 2.0);
        return;
      }

      if(this.tension.mode==="frenetic" && this.player.x>1500 && chance(0.004)){
        this.daughter = new Daughter(this.world.camx+RW-randi(60,120));
        this.whisper("THE DAUGHTER APPEARS. DO NOT SHOOT.", 2.0);
      }
    }

    spawnMadnessDaughter(){
      // during madness: enemies harmless; Daughter becomes predator (always present)
      // If daughter exists (saved or not), she "unbinds" and is replaced by the unbound predator.
      const wasSaved = !!(this.daughter && this.daughter.saved);
      if(this.daughter){
        this._daughterSnapshot = { existed:true, saved:this.daughter.saved, x:this.daughter.x, y:this.daughter.y };
        this.daughter.dormant = true; // hide & ignore
      } else {
        this._daughterSnapshot = { existed:false, saved:false, x:this.player.x+40, y:this.world.groundY-26 };
      }
      const spawnX = this._daughterSnapshot.x ?? (this.player.x+40);
      this.madDaughter = new DaughterUnbound(spawnX, wasSaved);
    }

    restoreDaughterAfterMadness(){
      if(this.daughter){
        this.daughter.dormant=false;
        // If she was saved before madness, she returns saved again (but "shaken")
        if(this._daughterSnapshot?.saved) this.daughter.saved=true;
        // reposition near player to prevent weird off-screen
        this.daughter.x = this.player.x + 40;
        this.daughter.y = this.world.groundY - this.daughter.h;
      }
      this.madDaughter = null;
      this._daughterSnapshot = null;
    }

    queuePatientEncounter(patient){
      if(this.madness.active) return;
      if(this.state!=="play") return;

      // build an anxious moral dilemma: help / threaten / ignore
      const p=this.player;
      const tone = (p.avi===1)?"ritual":(p.avi===2?"brutal":"flat");

      const trust = patient.trustSeed; // hidden; affects outcome
      const line =
        tone==="ritual"
          ? `${p.name}, a patient offers you a whisper.\n"I can carry your guilt."\nHis palms are wet.\n\nDo you accept?`
          : tone==="brutal"
          ? `${p.name}, a patient blocks the corridor.\nHe says: "Give me medicine or I scream."\n\nWhat do you do?`
          : `${p.name}, a patient watches you reload.\nHe says: "I saw your future."\n\nChoose carefully.`;

      const dlg = new Dialogue({
        title:"PATIENT ENCOUNTER",
        body: line,
        choices: [
          {
            label:"Help.",
            hint:"Lose a little. Gain trust. Or get tricked.",
            act:()=>{
              this.bus.emit("patient_deal",{});
              // small cost
              p.san = Math.max(0, p.san - 6);
              p.hp  = Math.max(1, p.hp - 4);

              // outcome: ally / gift / ambush (hidden)
              const roll = trust + rand(-0.25,0.25);
              if(roll>0.25){
                p.applyEffect("FRIEND", this);
                this.madness.approval += 1;
                this.score.add(180, "KINDNESS");
                this.whisper("HE FOLLOWS YOU. TOO CLOSE.", 1.6);
              } else if(roll>-0.15){
                this.spawnPickup(patient.x, this.world.groundY-16, chance(0.55)?"SAN":"HP");
                this.score.add(120, "PITY");
                this.whisper("HE LEAVES A GIFT THAT FEELS STOLEN.", 1.6);
              } else {
                // tricked: confusion + ooze
                p.applyEffect("CONFUSION", this);
                p.applyEffect("OOZE", this);
                this.madness.guilt += 1;
                this.score.add(90, "TRICKED");
                this.whisper("HE WASN'T A PATIENT.\nHE WAS A TEST.", 1.8);
              }

              patient.resolved=true; patient.dead=true;
            }
          },
          {
            label:"Threaten.",
            hint:"Gain score. Lose sanity. Might trigger ambush.",
            act:()=>{
              this.score.add(160, "THREAT");
              p.san = Math.max(0, p.san - 10);
              this.madness.guilt += 1;

              if(trust < -0.25 || chance(0.35)){
                this.spawnEnemyAt(patient.x+20, "fiend");
                this.spawnEnemyAt(patient.x-10, "crazy");
                this.whisper("HE CALLS THE WARDEN IN YOUR NAME.", 1.6);
              } else {
                this.spawnPickup(patient.x, this.world.groundY-16, "GLITCH");
                this.whisper("HE BOWS.\nHE DOES NOT FORGIVE.", 1.6);
              }

              patient.resolved=true; patient.dead=true;
            }
          },
          {
            label:"Ignore.",
            hint:"Walk away. The ward remembers indecision.",
            act:()=>{
              this.score.add(60, "IGNORE");
              this.madness.approval += 0; // neutrality
              patient.resolved=true; patient.dead=true;
              this.whisper("YOU WALK PAST HIM.\nHE DOES NOT TURN.", 1.4);
            }
          }
        ]
      });

      this.openDialog(dlg);
    }

    triggerLoreEncounter(){
      // deeper storytelling + anxiety: neutral people that may or may not be safe
      if(this.madness.active) return;
      if(this.state!=="play") return;
      if(this.tension.mode!=="atmosphere") return;
      if(this.boss && !this.boss.dead) return;

      if(this.time < this.lastDilemmaAt) return;

      // chance increases with mood triggerMul
      if(chance(0.12 * this.mood.triggerMul)){
        this.lastDilemmaAt = this.time + rand(26,38);

        const p=this.player;
        const body =
          `${p.name}, a note is pinned into a cracked mirror.\n\n` +
          `"THE WARD HAS TWO FACES."\n"ONE WILL HELP YOU."\n"ONE WILL EAT YOU."\n\n` +
          `You can read the signature if you lean closer.\nDo you?`;

        this.openDialog(new Dialogue({
          title:"ARCHIVE NOTE",
          body,
          choices:[
            {
              label:"Lean closer.",
              hint:"Gain insight. Risk confusion.",
              act:()=>{
                this.score.add(130, "READ");
                this.fx.triggerMemory(3.8);
                if(chance(0.30) && Input.confusionEnabled) this.player.applyEffect("CONFUSION",this);
                if(chance(0.40)) this.fx.triggerFace(ASSETS.get("assets/face2.png"),0.18);
                this.whisper("YOU READ YOUR NAME IN SOMEONE ELSE'S HAND.", 2.0);
              }
            },
            {
              label:"Rip it down.",
              hint:"Gain resources. Risk guilt.",
              act:()=>{
                this.score.add(150, "RIP");
                this.madness.guilt += 1;
                this.spawnPickup(this.player.x+40, this.world.groundY-16, chance(0.5)?"HP":"SAN");
                this.whisper("PAPER TEARS LIKE SKIN.", 1.6);
              }
            },
            {
              label:"Leave it.",
              hint:"Small sanity gain; the ward remembers restraint.",
              act:()=>{
                this.score.add(80, "RESTRAINT");
                this.player.soothe(10);
                this.madness.approval += 1;
                this.whisper("YOU DO NOT LOOK.\nSOMETHING LOOKS FOR YOU.", 1.8);
              }
            }
          ]
        }));
      }
    }

    lose(text, bad=false){
      this.state="end";
      UI.end.style.display="grid";
      UI.endTitle.textContent = bad ? "BAD ENDING" : "SIGNAL LOST";

      const breakdown = this.score.finalBreakdown(this);
      this.badge.evaluateOnEnd();

      UI.endBody.textContent = `${text}\n\n---\n${breakdown}`;
      UI.endBadges.textContent = this.badge.sessionBadgeText();
      UI.endAutopsy.textContent = this.makeAutopsy();
      try{
        window.Leaderboard?.onRunEnd({
          name: this.player?.name,
          score: this.score.score,
          mission: this.mission?.id,
          result: bad ? "BAD_END" : "LOSE",
          ts: Date.now()
        });
      }catch(_e){}

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
      UI.endAutopsy.textContent = this.makeAutopsy();

      try{
        window.Leaderboard?.onRunEnd({
          name: this.player?.name,
          score: this.score.score,
          mission: this.mission?.id,
          result: "WIN",
          ts: Date.now()
        });
      }catch(_e){}

       
      AudioSys.setIntensity(0.35,"atmosphere");
      AudioSys.ping("hit",0.7);
    }

    makeAutopsy(){
      // cryptic: hints at which triggers fired, without naming mechanics directly
      const lines=[];
      lines.push("AUTOPSY REPORT (UNSIGNED):");

      // madness traces
      if(this.madness.fired.length){
        const map = {
          RED_BLOOM:"Too many fell too fast.",
          GLASS_CHOIR:"The glass learned your name.",
          POTION_SPIRAL:"You drank the wrong memories.",
          STILLNESS:"You stopped breathing on purpose.",
          BACKWARDS_PRAYER:"You walked backward like regret.",
          WALL_CONFESSION:"A wall kept your confession.",
          HOARDER_SIN:"You collected mercy you didn’t need.",
          NEGLECT:"You left her in the hall too long.",
          BULLET_WASTE:"You fired into fog for comfort.",
          PAIN_LOOP:"Pain repeated until it felt true.",
          NO_LIGHT:"You lived without light too long.",
          BETRAYAL:"A patient trusted you once.",
        };
        const uniq=[...new Set(this.madness.fired)].slice(0,4);
        for(const id of uniq){
          lines.push("• " + (map[id] || "A rule broke quietly."));
        }
      } else {
        lines.push("• No episode recorded. (Suspicious.)");
      }

      // morality
      if(this.madness.guilt>=4) lines.push("• Guilt weight: heavy.");
      else if(this.madness.guilt>=2) lines.push("• Guilt weight: audible.");
      else lines.push("• Guilt weight: denied.");

      if(this.madness.approval>=3) lines.push("• The ward approved your shape.");
      else if(this.madness.approval>=1) lines.push("• The ward watched, undecided.");
      else lines.push("• The ward withheld affection.");

      // bosses
      if(this._flags.termiteKilled) lines.push("• Cranberry worms no longer sing.");
      if(this._flags.orderlyKilled) lines.push("• The keys are missing teeth.");

      // daughter
      if(this._flags.daughterSavedEver) lines.push("• You touched her once. That counts.");
      else lines.push("• You never held her hand.");

      return lines.join("\n");
    }

    startRun({name, avatar, missionId, allowImages, allowConfusion, hardAudio}){
      this.state="play";
      this.time=0;

      ASSETS.allowImages=!!allowImages;
      Input.confusionEnabled=!!allowConfusion;
      Input.confusionT=0;
      AudioSys.setHard(!!hardAudio);

      this.world.reset();
      this.atmo=new AtmosphereManager();
      this.tension=new Tension();
      this.fx=new VisualFX();

      this.enemies.length=0;
      this.bullets.length=0;
      this.particles.length=0;
      this.decals.length=0;
      this.pickups.length=0;
      this.patients.length=0;
      this.enemyProjectiles.length=0;

      this.player=new Player(name, avatar);
      this.friend=null;

      this.mission=new Mission(missionId);

      this.daughter=null;
      this.madDaughter=null;
      this._daughterSnapshot=null;

      this.spawnAcc=0;
      this.lastDilemmaAt=16;
      this._mercy=0;

      this._laser=null;

      // mood roll
      this.mood = WARD_MOODS[randi(0, WARD_MOODS.length-1)];
      this.whisper(`WELCOME, ${name}. ${this.mood.label.toUpperCase()}.`, 2.4);

      // reset systems
      this.score = new ScoreManager(this);
      this.badge = new BadgeManager(this);
      this.madness = new MadnessManager(this);
      this.madness.chooseTriggers(this.mood);

      // boss roulette
      this.boss=null;
      this.buildBossQueue();

      this._flags = { won:false, daughterSavedEver:false, termiteKilled:false, orderlyKilled:false };

      // intro
      this.openDialog(new Dialogue({
        title:"ARCHIVE BOOT",
        body:
          avatar===1
            ? `${name}, the corridor is a ritual circle.\nYour steps are syllables.\n\nThe ward will test what you protect.`
            : avatar===2
            ? `${name}, the asylum respects force.\nBut it punishes waste.\n\nSome rules will flip. You will obey.`
            : `${name}, a note is pinned to a bin:\n"LIGHT ISN'T SAFETY."\n\nKeep moving. Watch the fog.`,
        choices:[{label:"Continue.", hint:"The ward resumes breathing.", act:()=>{ this.score.add(60,"NOTE"); }}]
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

      // tension + atmosphere + audio
      this.atmo.update(dt, this);
      this.tension.update(dt, this);
      AudioSys.setIntensity(this.tension.heat, this.tension.mode);

      // madness
      this.madness.update(dt);
      UI.uiMadness.style.display = this.madness.active ? "block" : "none";

      // mission
      this.mission.update(dt, this);

      // spawn daughter + patients
      this.maybeSpawnDaughter();
      this.maybeSpawnPatients(dt);

      // spawn boss roulette if needed
      this.spawnBossIfNeeded();

      // swap weapon
      if(Input.wantSwap()){
        this.player.swapWeapon();
        this.whisper(`WEAPON: ${this.player.currentWeapon().name}`, 1.2);
        this.score.add(10, "SWAP");
      }

      // player
      this.player.update(dt, this);

      // friend
      if(this.player.hasFriend){
        if(!this.friend) this.friend = new Companion(this.player);
        this.friend.update(dt, this);
      } else this.friend=null;

      // daughter (innocent)
      if(this.daughter){
        this.daughter.update(dt, this);

        // touching saves (outside madness)
        if(Input.wantInteract() && !this.daughter.saved && !this.madness.active){
          if(aabb(this.player.x,this.player.y,this.player.w,this.player.h,this.daughter.x,this.daughter.y,this.daughter.w,this.daughter.h)){
            this.daughter.saved=true;
            this._flags.daughterSavedEver=true;
            this.player.soothe(18);
            this.fx.triggerPaletteShift(1.5);
            this.whisper("SHE IS REAL ENOUGH TO HOLD.", 2.0);
            this.score.add(600, "SAVE");
            this.madness.approval += 2;
          }
        }
      }

      // madness daughter predator
      if(this.madDaughter && !this.madDaughter.dead){
        this.madDaughter.update(dt, this);
      }

      // enemies spawn (disabled during madness: they still exist but harmless; spawning slows)
      const d=this.difficulty();
      this.spawnAcc += dt;

      const doSpawn = (this.tension.mode==="frenetic");
      if(doSpawn && this.spawnAcc > d.spawnEvery * (1/this.mood.spawnMul)){
        this.spawnAcc=0;
        // still allow spawns during madness but reduced (harmless anyway)
        if(!this.madness.active || chance(0.35)) this.spawnEnemyWave();
      }

      // enemies update
      for(const e of this.enemies) e.update(dt, this);
      this.enemies = this.enemies.filter(e=>!e.dead);

      // boss update
      if(this.boss && !this.boss.dead){
        this.boss.update(dt, this);
      }

      // enemy projectiles (Orderly)
      this.updateEnemyProjectiles(dt);

      // bullets
      for(const b of this.bullets) b.update(dt, this);
      this.bullets = this.bullets.filter(b=>!b.dead);

      // pickups
      for(const p of this.pickups) p.update(dt, this);
      this.pickups = this.pickups.filter(p=>!p.dead);

      // patients
      for(const n of this.patients) n.update(dt, this);
      this.patients = this.patients.filter(n=>!n.dead);

      // particles / decals
      for(const p of this.particles) p.update(dt);
      this.particles = this.particles.filter(p=>p.life>0);
      for(const dcl of this.decals) dcl.update(dt);

      // resolve combat
      this.resolveCombat();

      // lore encounters
      this.triggerLoreEncounter();

      // score tick
      this.score.tick(dt);

      // lose conditions (robust: ignore NaN, require real depletion)
      if(!Number.isFinite(this.player.hp)) this.player.hp = 0;
      if(!Number.isFinite(this.player.san)) this.player.san = 0;
      if(this.player.hp<=0.001) this.lose("Your body gives up.\n\nThe ward keeps walking.\nIt steps over you like a thought.", false);
      if(this.player.san<=0.001) this.lose("Your mind fractures.\n\nThe fog learns your face.\nIt wears it.", false);

      // FX
      this.fx.update(dt);
      if(this.player.status.wiggleT>0) this.fx.triggerWiggle(0.2);
      if(this.player.status.memoryT>0) this.fx.triggerMemory(0.2);

      if(this.tension.mode==="frenetic" && chance(0.003)) this.fx.triggerFace(ASSETS.get("assets/face2.png"), 0.15);
    }

    maybeSpawnPatients(dt){
      if(this.madness.active) return;
      if(this.tension.mode!=="atmosphere") return;
      if(this.boss && !this.boss.dead) return;
      if(this.patients.length>1) return;

      // occasional neutral patient spawns
      if(chance(0.0035 * dt * 60)){
        const x = this.world.camx + RW + randi(40,120);
        // hidden trust seed from run seed + random
        const trustSeed = (Math.random()*2-1) * (this.mood.id==="SULLEN"?0.8:1.0);
        const npc = new PatientNPC(x, trustSeed);
        this.patients.push(npc);
        this.whisper("A PATIENT ENTERS THE HALL.\nYOU CAN'T TELL IF HE'S SAFE.", 1.6);
      }
    }

    updateEnemyProjectiles(dt){
      const p=this.player;
      for(const pr of this.enemyProjectiles){
        pr.life-=dt;
        pr.x += pr.vx*dt;
        pr.y += pr.vy*dt;
        pr.vy += 120*dt;

        if(pr.life<=0) pr.life=0;

        // madness: harmless projectiles
        if(!this.madness.active && pr.life>0){
          if(dist(pr.x,pr.y,p.cx,p.cy)<10){
            p.hurt(9, pr.x, this);
            this.spawnParticle(p.cx,p.cy,"blood");
            pr.life=0;
          }
        }
      }
      this.enemyProjectiles = this.enemyProjectiles.filter(pr=>pr.life>0 && pr.y<RH+40);
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
            break;
          }
        }
        if(b.dead) continue;

        // madness daughter target
        if(this.madDaughter && !this.madDaughter.dead){
          if(aabb(b.x,b.y,b.w,b.h,this.madDaughter.x,this.madDaughter.y,this.madDaughter.w,this.madDaughter.h)){
            b.dead=true;
            this.madDaughter.hit(b.dmg, this);
            continue;
          }
        }

        // real daughter: outside madness, shooting = immediate bad ending
        if(this.daughter && !this.madness.active && !this.daughter.dormant){
          if(aabb(b.x,b.y,b.w,b.h,this.daughter.x,this.daughter.y,this.daughter.w,this.daughter.h)){
            b.dead=true;
            for(let i=0;i<46;i++) this.spawnParticle(this.daughter.cx,this.daughter.cy, chance(0.6)?"blood":"gib");
            this.addDecal(this.daughter.cx, this.world.groundY-1, "blood");
            this.lose("YOU SHOT THE DAUGHTER.\n\nBad Ending:\nThe ward stops pretending you were a person.", true);
            return;
          }
        }

        // boss hit
        if(this.boss && !this.boss.dead){
          // rough hitbox around boss core
          const bx = this.boss.x ?? (this.boss.seg ? this.boss.seg[0].x : 0);
          const by = this.boss.y ?? (this.boss.seg ? this.boss.seg[0].y : 0);
          if(dist(b.x,b.y,bx,by)<26){
            b.dead=true;
            this.boss.takeDamage(b.dmg, this);
            this.score.add(8, "BOSS HIT");
            continue;
          }
          // termite segments: let bullets hit near head too (makes kill possible)
          if(this.boss.id==="TERMITE_SAINT" && this.boss.seg && this.boss.isHittable()){
            for(let i=0;i<5;i++){
              const s=this.boss.seg[i];
              if(dist(b.x,b.y,s.x,s.y)<12){
                b.dead=true;
                this.boss.takeDamage(b.dmg, this);
                break;
              }
            }
            if(b.dead) continue;
          }
        }

        // enemies
        for(const e of this.enemies){
          if(e.dead) continue;
          if(aabb(b.x,b.y,b.w,b.h,e.x,e.y,e.w,e.h)){
            b.dead=true;
            e.hit(b.dmg, this);
            break;
          }
        }

        // patients: shooting them counts as betrayal (and might trigger madness later)
        for(const n of this.patients){
          if(n.dead) continue;
          if(aabb(b.x,b.y,b.w,b.h,n.x,n.y,n.w,n.h)){
            b.dead=true;
            n.dead=true;
            this.bus.emit("patient_kill",{});
            this.madness.guilt += 2;
            this.score.add(100, "SILENCE");
            this.whisper("THE PATIENT STOPS BEING AMBIGUOUS.", 1.4);
            // blood
            for(let i=0;i<18;i++) this.spawnParticle(n.cx,n.cy,"blood");
            this.addDecal(n.cx, this.world.groundY-1, "blood");
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

      // patients
      for(const n of this.patients) n.draw(bctx, this.world.camx, this.pal);

      // daughter (innocent)
      if(this.daughter) this.daughter.draw(bctx, this.world.camx, this.pal);

      // madness daughter predator
      if(this.madDaughter && !this.madDaughter.dead) this.madDaughter.draw(bctx, this.world.camx, this.pal);

      // enemies
      for(const e of this.enemies) e.draw(bctx, this.world.camx, this.pal);

      // boss
      if(this.boss && !this.boss.dead) this.boss.draw(bctx, this.world.camx, this.pal);

      // enemy projectiles
      for(const pr of this.enemyProjectiles){
        bctx.fillStyle=this.pal.danger;
        bctx.fillRect(((pr.x-this.world.camx)|0), (pr.y|0), 3, 2);
      }

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
        fog.addColorStop(0.55,"rgba(0,0,0,0.50)");
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

      // HUD
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
      if(p.status.oozeT>0) st.push("OOZE");
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

      if(this.madness.active){
        const t=Math.ceil(this.madness.t);
        const ss=String(t%60).padStart(2,"0");
        UI.uiMadness.textContent = `MADNESS 00:${ss} · KILL THE DAUGHTER`;
        UI.uiMadness.style.color = "#ff2a2a";
      }

      if(this.boss && !this.boss.dead){
        UI.bossWrap.style.display = "block";
        UI.bossName.textContent = this.boss.name;
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

