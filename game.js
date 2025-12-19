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
  // shade("#rrggbb", +/-n) -> bright/dark hex
  const shade = (hex, amt) => {
    if(!hex || hex[0] !== "#") return hex;
    const n = parseInt(hex.slice(1),16);
    let r = ((n>>16)&255) + amt;
    let g = ((n>>8)&255) + amt;
    let b = (n&255) + amt;
    r = clamp(r,0,255); g = clamp(g,0,255); b = clamp(b,0,255);
    return "#" + ((r<<16)|(g<<8)|b).toString(16).padStart(6,"0");
  };
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
  :root{
    --bg:#050505;
    --panel:#0d0d12;
    --panel2:#101018;
    --text:#a7a7b8;
    --muted:#7f7f98;
    --accent:#7d3cff;
    --accent2:#b84cff;
    --danger:#ff2a2a;
    --good:#00ffaa;
    --warn:#ffb000;
    --light:#e8e8f2;
    --stroke:rgba(255,255,255,0.10);
    --stroke2:rgba(255,255,255,0.06);
    --shadow:0 0 22px rgba(0,0,0,0.9);
  }

  html,body{
    height:100%;
    margin:0;
    background:var(--bg);
    color:var(--text);
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Courier New", monospace;
    overflow:hidden;
  }

  canvas{
    position:fixed; inset:0;
    width:100%; height:100%;
    display:block;
    image-rendering:pixelated;
    background:#050505;
  }

  /* --- Overlay / Panels --- */
  .gOverlay{
    position:fixed; inset:0;
    display:grid; place-items:center;
    z-index:50;
    background:radial-gradient(1200px 700px at 50% 45%, rgba(125,60,255,0.14), rgba(0,0,0,0.86) 58%, rgba(0,0,0,0.92));
    pointer-events:auto;
  }

  .gPanel{
    width:min(860px,92vw);
    background:linear-gradient(180deg, rgba(16,16,26,0.92), rgba(10,10,16,0.92));
    border:1px solid var(--stroke);
    border-radius:18px;
    box-shadow:var(--shadow);
    padding:22px;
    position:relative;
    pointer-events:auto;
  }

  .gPanel:before{
    content:"";
    position:absolute;
    top:-1px; left:16px; right:16px;
    height:1px;
    background:linear-gradient(90deg, transparent, rgba(125,60,255,0.9), transparent);
    box-shadow:0 0 18px rgba(125,60,255,0.45);
  }

  .gTitle{
    margin:0 0 8px 0;
    color:var(--light);
    text-transform:uppercase;
    letter-spacing:4px;
    font-size:22px;
    text-shadow:0 0 12px rgba(125,60,255,0.45);
  }

  .gTiny{
    color:var(--muted);
    font-size:11px;
    line-height:1.6;
  }

  .gRow{
    display:grid;
    grid-template-columns: 1fr 1fr;
    gap:12px;
    margin-top:12px;
  }
  @media (max-width: 720px){
    .gRow{ grid-template-columns: 1fr; }
  }

  .gField{
    background:rgba(0,0,0,0.25);
    border:1px solid var(--stroke2);
    border-radius:14px;
    padding:12px;
  }

  /* --- Buttons --- */
  .gBtn{
    appearance:none;
    border:1px solid rgba(125,60,255,0.35);
    background:
      radial-gradient(500px 70px at 50% 0%, rgba(184,76,255,0.35), rgba(125,60,255,0.08) 55%, rgba(0,0,0,0.35)),
      linear-gradient(180deg, rgba(18,18,30,0.9), rgba(10,10,16,0.9));
    color:var(--light);
    border-radius:14px;
    padding:10px 12px;
    font:inherit;
    letter-spacing:0.10em;
    text-transform:uppercase;
    cursor:pointer;
    pointer-events:auto;
    box-shadow: 0 10px 28px rgba(0,0,0,0.55);
    transition: transform .06s ease, border-color .15s ease, filter .15s ease;
  }

  .gBtn:hover{
    border-color: rgba(184,76,255,0.65);
    filter:brightness(1.08);
  }
  .gBtn:active{
    transform: translateY(1px);
    filter:brightness(0.98);
  }

  .gBtn:focus-visible{
    outline: none;
    box-shadow: 0 0 0 2px rgba(184,76,255,0.35), 0 10px 28px rgba(0,0,0,0.55);
  }

  .gBtn.danger{
    border-color: rgba(255,42,42,0.5);
    background:
      radial-gradient(500px 70px at 50% 0%, rgba(255,42,42,0.28), rgba(255,42,42,0.07) 55%, rgba(0,0,0,0.35)),
      linear-gradient(180deg, rgba(20,10,12,0.9), rgba(10,6,8,0.9));
  }

  /* --- Avatar cards / clickable selection --- */
  #aviRow{
    display:grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap:10px;
    margin-top:10px;
  }
  @media (max-width: 720px){
    #aviRow{ grid-template-columns: 1fr; }
  }

  .gCard{
    border-radius:16px;
    border:1px solid var(--stroke2);
    background:
      linear-gradient(180deg, rgba(18,18,28,0.85), rgba(8,8,12,0.85));
    padding:12px 12px;
    cursor:pointer;
    pointer-events:auto;
    user-select:none;
    min-height:54px;
    display:flex;
    flex-direction:column;
    justify-content:center;
    gap:4px;
    transition: transform .06s ease, border-color .15s ease, filter .15s ease;
  }

  .gCard:hover{
    border-color: rgba(255,255,255,0.16);
    filter:brightness(1.07);
  }
  .gCard:active{ transform: translateY(1px); }

  .gCard.sel{
    border-color: rgba(184,76,255,0.75);
    box-shadow: 0 0 0 1px rgba(184,76,255,0.18), 0 0 22px rgba(125,60,255,0.25);
  }

  /* --- Inputs / selects --- */
  input, select{
    width:100%;
    background:rgba(0,0,0,0.35);
    border:1px solid rgba(255,255,255,0.10);
    border-radius:12px;
    color:var(--light);
    padding:10px 10px;
    font:inherit;
    outline:none;
  }
  input:focus, select:focus{
    border-color: rgba(184,76,255,0.55);
    box-shadow: 0 0 0 2px rgba(184,76,255,0.18);
  }
  label{ display:block; margin-bottom:6px; color:var(--muted); font-size:11px; letter-spacing:0.08em; text-transform:uppercase; }

  /* --- HUD keeps pointer-events off, but overlays are clickable --- */
  .gHud{
    position:fixed; left:12px; right:12px; top:10px; z-index:40;
    display:flex; justify-content:space-between; gap:10px;
    pointer-events:none;
    mix-blend-mode:normal;
    background:rgba(0,0,0,0.26);
    border:1px solid rgba(255,255,255,0.06);
    border-radius:12px;
    backdrop-filter: blur(2px);
    padding:10px 12px;
  }

  .gBars{display:grid;gap:6px}
  .gStat{color:#fff;font-size:10px;letter-spacing:1px;text-transform:uppercase;text-shadow:0 1px 2px rgba(0,0,0,0.9)}
  .gFade{opacity:.78}
  .gBar{
    width:172px;height:6px;
    background:#24242d;
    border:1px solid rgba(255,255,255,0.08);
    border-radius:10px;overflow:hidden;position:relative
  }
  .gFill{height:100%;width:100%;border-radius:10px}

  /* --- CRT / grain --- */
  .gCrt{
    position:fixed; inset:0;
    pointer-events:none;
    z-index:45;
    background:
      repeating-linear-gradient(to bottom, rgba(255,255,255,0.04), rgba(255,255,255,0.04) 1px, rgba(0,0,0,0) 2px, rgba(0,0,0,0) 4px),
      radial-gradient(1400px 900px at 50% 50%, rgba(255,255,255,0.05), rgba(0,0,0,0.55));
    opacity:0.55;
    mix-blend-mode:screen;
  }

  .toast{
    position:fixed; left:50%; bottom:20px; transform:translateX(-50%);
    background:rgba(0,0,0,0.65);
    border:1px solid rgba(255,255,255,0.10);
    color:#fff;
    border-radius:14px;
    padding:10px 12px;
    z-index:60;
    font-size:11px;
    letter-spacing:1px;
    text-transform:uppercase;
    opacity:0;
    transform:translateX(-50%) translateY(4px);
    transition:.18s;
    pointer-events:none;
  }
  .toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
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

        <div>
          <div class="gStat">GUILT</div>
          <div class="gBar"><div id="uiGuilt" class="gFill" style="background:#ffb000"></div></div>
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

      this._nodes = { noiseGain, droneGain, pulseGain, lp, loopGain:null };
      // Embedded industrial loop (base64 WAV) — blended with procedural layers
      try {
        const LOOP_B64 = "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";
        const bin = atob(LOOP_B64);
        const ab = new ArrayBuffer(bin.length);
        const u8 = new Uint8Array(ab);
        for(let i=0;i<bin.length;i++) u8[i]=bin.charCodeAt(i);
        const buf = await this.ctx.decodeAudioData(ab);
        const src = this.ctx.createBufferSource();
        src.buffer = buf; src.loop = true;
        const lg = this.ctx.createGain();
        lg.gain.value = 0.0;
        src.connect(lg).connect(this.master);
        src.start();
        this._nodes.loopGain = lg;
      } catch(e) {
        // If decode fails, game still works (procedural only)
        console.warn("Loop decode failed", e);
      }

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
      const { noiseGain, droneGain, pulseGain, lp, loopGain } = this._nodes;

      const base = this.muted ? 0 : 1;
      const hard = this.hard ? 1 : 0.60;

      droneGain.gain.setTargetAtTime(base*(0.06+this.intensity*0.18)*hard, t, 0.06);
      const nT = (this.mode==="atmosphere") ? (0.03+this.intensity*0.08) : (0.08+this.intensity*0.24);
      noiseGain.gain.setTargetAtTime(base*nT*hard, t, 0.05);

      const pT = (this.mode==="atmosphere") ? (0.01+this.intensity*0.04) : (0.05+this.intensity*0.16);
      pulseGain.gain.setTargetAtTime(base*pT*hard, t, 0.05);

      if(loopGain){
        // loop is stronger in frenetic / boss / madness
        const moodBoost = (this.mode==="frenetic"?0.55:(this.mode==="boss"?0.75:0.35));
        loopGain.gain.setTargetAtTime(base*(0.02 + this.intensity*0.20)*moodBoost*hard, t, 0.06);
      }

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
        
      // Madness psychedelic hallucination (playable): subtle RGB split + hue-wash + extra scanline wobble
      if(game.madness && game.madness.active){
        const k = 0.10 + 0.10*Math.sin(t*3.1);
        ctx.globalCompositeOperation = "screen";
        ctx.globalAlpha = 0.10;
        // color wash cycling
        const r = (Math.sin(t*1.2)+1)*0.5;
        const g = (Math.sin(t*1.7+2.0)+1)*0.5;
        const b = (Math.sin(t*2.1+4.0)+1)*0.5;
        ctx.fillStyle = `rgba(${(r*255)|0},${(g*255)|0},${(b*255)|0},0.35)`;
        ctx.fillRect(0,0,RW,RH);

        // tiny channel offsets for hallucination
        ctx.globalAlpha = 0.12;
        ctx.drawImage(buf, 0,0,RW,RH, (2+6*k)|0, (0)|0, RW, RH);
        ctx.drawImage(buf, 0,0,RW,RH, (-2-6*k)|0, (1)|0, RW, RH);

        // extra scanline jitter
        ctx.globalAlpha = 0.18;
        for(let y=0;y<RH;y+=4){
          const off = Math.sin(t*10.0 + y*0.16) * (2.2 + 2.8*k);
          ctx.drawImage(buf, 0,y,RW,2, off, y, RW, 2);
        }
        // wavy warp (playable): a few chunky vertical slices
        ctx.globalAlpha = 0.18;
        const sliceW = 24;
        for(let x=0;x<RW;x+=sliceW){
          const offY = Math.sin(t*3.6 + x*0.08) * (4 + 6*k);
          ctx.drawImage(buf, x,0,sliceW,RH, x, offY, sliceW, RH);
        }

        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
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
      // Brighter ward base: wall gradient + faint fog
      const g0 = ctx.createLinearGradient(0,0,0,RH);
      g0.addColorStop(0, shade(pal.bg, 12));
      g0.addColorStop(0.55, pal.bg);
      g0.addColorStop(1, shade(pal.ground, -8));
      ctx.fillStyle=g0; ctx.fillRect(0,0,RW,RH);

      // distant window shafts (moon/fluoro bounce) — makes it readable, not pure black
      ctx.globalAlpha=0.18;
      for(let i=0;i<5;i++){
        const wx = (((i*210)-(this.camx*0.22))%(RW+260))-40;
        const wgrad = ctx.createLinearGradient(wx, 0, wx+140, RH);
        wgrad.addColorStop(0, "rgba(160,200,255,0.00)");
        wgrad.addColorStop(0.25,"rgba(160,200,255,0.08)");
        wgrad.addColorStop(1, "rgba(20,30,50,0.00)");
        ctx.fillStyle=wgrad;
        ctx.fillRect(wx,0,160,RH);
      }
      ctx.globalAlpha=1;

      // ceiling lamps pools (parallax)
      for(let i=0;i<7;i++){
        const lx = (((i*170)-(this.camx*0.35))%(RW+240))-30;
        const ly = 28 + (i%2)*12;
        // fixture
        ctx.globalAlpha=0.30;
        ctx.fillStyle="#101018";
        ctx.fillRect(lx|0, (ly-6)|0, 60, 10);
        // glow
        ctx.globalAlpha=0.22;
        const lamp = ctx.createRadialGradient(lx+30, ly+4, 6, lx+30, ly+18, 120);
        lamp.addColorStop(0, "rgba(255,255,220,0.22)");
        lamp.addColorStop(0.35,"rgba(255,255,220,0.10)");
        lamp.addColorStop(1, "rgba(0,0,0,0.00)");
        ctx.fillStyle=lamp; ctx.fillRect((lx-110)|0,0,280,RH);
      }
      ctx.globalAlpha=1;

      // asylum ward silhouettes (beds + patients + carts) parallax — HAND-DRAWN PRIMITIVES
      const px = this.camx*0.45;
      ctx.globalAlpha=0.22;
      for(let i=0;i<12;i++){
        const bx = (((i*150)-px)%(RW+220))-80;
        const by = 60 + (i%3)*14;

        // bed frame
        ctx.fillStyle=shade(pal.solid,-10);
        ctx.fillRect((bx)|0,(by+38)|0, 92, 10);
        ctx.fillRect((bx+6)|0,(by+28)|0, 6, 22);
        ctx.fillRect((bx+80)|0,(by+28)|0, 6, 22);

        // mattress
        ctx.fillStyle=shade(pal.solid,-2);
        ctx.fillRect((bx+10)|0,(by+26)|0, 72, 14);

        // patient silhouette (sometimes)
        if(i%2===0){
          ctx.fillStyle="#0a0a12";
          // head
          ctx.fillRect((bx+18)|0,(by+18)|0, 10, 8);
          // body
          ctx.fillRect((bx+28)|0,(by+22)|0, 24, 10);
          // twitch line
          if((i+((t*2)|0))%5===0){
            ctx.globalAlpha=0.12;
            ctx.fillRect((bx+54)|0,(by+24)|0, 8, 2);
            ctx.globalAlpha=0.22;
          }
        }

        // IV stand
        if(i%3===0){
          ctx.strokeStyle="#121220";
          ctx.lineWidth=2;
          ctx.beginPath();
          ctx.moveTo(bx+92, by+18);
          ctx.lineTo(bx+92, by+56);
          ctx.stroke();
          ctx.fillStyle="#101018";
          ctx.fillRect((bx+88)|0,(by+16)|0, 8, 6);
          ctx.fillStyle=pal.glass;
          ctx.globalAlpha=0.12;
          ctx.fillRect((bx+90)|0,(by+24)|0, 5, 7);
          ctx.globalAlpha=0.22;
          ctx.lineWidth=1;
        }

        // rolling cart / cabinet
        if(i%4===0){
          ctx.fillStyle="#0c0c14";
          ctx.fillRect((bx-30)|0,(by+34)|0, 22, 18);
          ctx.fillStyle="#000";
          ctx.fillRect((bx-26)|0,(by+38)|0, 14, 3);
        }
      }
      ctx.globalAlpha=1;

      // mood tint (stronger with guilt via mood.heat)
      if(mood.id==="DEVOUT"){
        ctx.globalAlpha=0.06 + mood.heat*0.06; ctx.fillStyle=pal.accent; ctx.fillRect(0,0,RW,RH); ctx.globalAlpha=1;
      }else if(mood.id==="MELTDOWN"){
        ctx.globalAlpha=0.08 + mood.heat*0.10; ctx.fillStyle=pal.danger; ctx.fillRect(0,0,RW,RH); ctx.globalAlpha=1;
      }else{
        ctx.globalAlpha=0.04 + mood.heat*0.08; ctx.fillStyle="#2f4bff"; ctx.fillRect(0,0,RW,RH); ctx.globalAlpha=1;
      }

      // ground
      ctx.fillStyle=pal.ground; ctx.fillRect(0,this.groundY,RW,RH-this.groundY);
      ctx.globalAlpha=0.18;
      ctx.strokeStyle=shade(pal.solid,-20);
      for(let y=this.groundY;y<RH;y+=6){
        ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(RW,y); ctx.stroke();
      }
      ctx.globalAlpha=1;

      // floor light puddles (help readability)
      ctx.globalAlpha=0.18;
      for(let i=0;i<6;i++){
        const fx = (((i*210)-(this.camx*0.9))%(RW+240))-40;
        const f = ctx.createRadialGradient(fx+80,this.groundY+10,10, fx+80,this.groundY+10,120);
        f.addColorStop(0,"rgba(255,255,210,0.12)");
        f.addColorStop(1,"rgba(0,0,0,0)");
        ctx.fillStyle=f;
        ctx.fillRect(fx,this.groundY-80,200,200);
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
          // cosmetic destructible environment
          const idx = game.world.obstacles.indexOf(o);
          if(idx>=0){ game.world.obstacles.splice(idx,1); game.bus.emit("prop_break",{kind:"furniture",x:o.x,y:o.y}); }
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
        if(this.phase>=3 && chance(0.5)){
        // laser (no gravity)
        const spL = 620;
        game.enemyProjectiles.push({x:ox,y:oy,vx:Math.cos(ang)*spL,vy:Math.sin(ang)*spL,life:0.9,damage:22,noGrav:true,kind:"LASER"});
        game.fx.triggerGlitch(0.09);
        AudioSys.ping("shoot",0.65);
      }else{
        // syringe shard (gravity) — may induce confusion on hit
        game.enemyProjectiles.push({x:ox,y:oy,vx:Math.cos(ang)*sp2,vy:Math.sin(ang)*sp2,life:1.6,damage:10,kind:"VACCINE"});
        game.fx.triggerGlitch(0.05);
        AudioSys.ping("shoot",0.45);
      }
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
      this.cooldown=30;
      this.approval=0;
      this.guilt=0;
      this.cooldown=0; // seconds until madness can trigger again

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
        { id:"BULLET_WASTE",      hint:"You fired into the fog.", test:()=> (this.countIn(this._events.shotsWin, 12) - this.countIn(this._events.hitsWin, 12)) >= 18 },
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
      this.cooldown = 30; // 30s cooldown before another episode
      this.g.fx.triggerPaletteShift(1.0);
      this.g.whisper("MADNESS ENDS. YOU REMEMBER WRONG THINGS.", 2.0);
      this.g.restoreDaughterAfterMadness();
    }

    update(dt){
      if(Input.confusionT>0) Input.confusionT = Math.max(0, Input.confusionT - dt);

      const p=this.g.player;

      // guilt continuously corrodes sanity + intensifies tone/heat
      if(this.guilt>0 && !this.active){
        const drain = Math.min(0.35, this.guilt/220) * dt; // small but persistent
        p.san = Math.max(0, p.san - drain*6.0);
      }
      // slow natural guilt decay
      this.guilt = Math.max(0, this.guilt - dt*0.7);
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
        if(this.cooldown>0){ this.cooldown=Math.max(0, this.cooldown-dt); }
        if(this.cooldown<=0){
          for(const tr of this.triggers){
            if(tr.test()){
              this.start(tr.id);
              break;
            }
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
        if(!pr.noGrav) pr.vy += 120*dt;

        if(pr.life<=0) pr.life=0;

        // madness: harmless projectiles
        if(!this.madness.active && pr.life>0){
          if(dist(pr.x,pr.y,p.cx,p.cy)<10){
            const dmg = (pr.damage!=null)?pr.damage:9;
            p.hurt(dmg, pr.x, this);

            // status payloads
            if(pr.kind==="VACCINE"){
              p.status.slowT = Math.max(p.status.slowT, 3.6);
              p.status.griefT = Math.max(p.status.griefT, 4.4);
              this.fx.triggerWiggle(1.8);
              this.whisper("A VACCINE OF GRIEF. YOUR LEGS FORGET.", 1.7);
            }else if(pr.kind==="LASER"){
              this.fx.triggerGlitch(0.25);
              // mild sanity scorch
              p.san = Math.max(0, p.san - 6);
            }else if(!pr.noGrav){
              // shard confusion
              p.applyEffect("CONFUSION", this);
            }

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

      if(UI.uiGuilt){ const gPct = clamp((this.madness.guilt/100)*100,0,100); UI.uiGuilt.style.width = `${gPct}%`; }

      const st=[];

      if(this.madness && this.madness.guilt>0){ st.push(`GUILT:${Math.round(this.madness.guilt)}`); }
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
