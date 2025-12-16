/* ASYLUM FOG // GROTESQUE WARD
   Vanilla JS + Canvas, no build. GitHub Pages ready.

   Adds:
   - More gore: blood, gibs, floor decals
   - New enemy types: Fiend, Golem, Crazy, Grief Wailer
   - Weapons: Pistol + Flesh Laser + unlockable Companion friend
   - Ward props: bins, breakable glass, potions
   - Substances: Wiggle (screen wobble), Memory (past echoes)
   - Mission select: Survive 2:00 / Save Patient 07 / Reach Chapel
*/
(() => {
  "use strict";

  /*************************
   * DOM
   *************************/
  const $ = (id) => document.getElementById(id);
  const UI = {
    canvas: $("c"),
    menu: $("menu"),
    startBtn: $("startBtn"),
    retryBtn: $("retryBtn"),
    menuBtn: $("menuBtn"),

    hud: $("hud"),
    hpFill: $("hpFill"),
    sanFill: $("sanFill"),
    depthLabel: $("depthLabel"),
    modeLabel: $("modeLabel"),
    zoneLabel: $("zoneLabel"),
    weaponLabel: $("weaponLabel"),
    objectiveLabel: $("objectiveLabel"),
    statusLabel: $("statusLabel"),
    hintLabel: $("hintLabel"),

    nameInput: $("nameInput"),
    missionSelect: $("missionSelect"),
    toggleConfusion: $("toggleConfusion"),
    toggleFaces: $("toggleFaces"),
    toggleHardAudio: $("toggleHardAudio"),

    loadSpritesBtn: $("loadSpritesBtn"),
    spriteFiles: $("spriteFiles"),
    assetDot: $("assetDot"),
    assetText: $("assetText"),

    dialogue: $("dialogue"),
    dlgTitle: $("dlgTitle"),
    dlgSub: $("dlgSub"),
    dlgBody: $("dlgBody"),
    dlgChoices: $("dlgChoices"),

    end: $("end"),
    endTitle: $("endTitle"),
    endBody: $("endBody"),
  };

  /*************************
   * Canvas (low-res buffer)
   *************************/
  const canvas = UI.canvas;
  const ctx = canvas.getContext("2d", { alpha: false });
  ctx.imageSmoothingEnabled = false;

  const buf = document.createElement("canvas");
  const bctx = buf.getContext("2d", { alpha: false });
  bctx.imageSmoothingEnabled = false;

  let W=0, H=0;
  let RW=384, RH=216;

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

  /*************************
   * Helpers
   *************************/
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const lerp=(a,b,t)=>a+(b-a)*t;
  const rand=(a=0,b=1)=>a+Math.random()*(b-a);
  const randi=(a,b)=>(a+(Math.random()*(b-a+1)|0));
  const chance=(p)=>Math.random()<p;

  function aabb(ax,ay,aw,ah,bx,by,bw,bh){
    return ax<bx+bw && ax+aw>bx && ay<by+bh && ay+ah>by;
  }
  function norm(x,y){
    const l=Math.hypot(x,y)||1;
    return [x/l,y/l];
  }

  /*************************
   * Input (stable; no random flips)
   *************************/
  const Input = {
    keys: new Set(),
    mouse: { nx:0.5, ny:0.5, down:false },
    confusionEnabled:false,
    confusionT:0,

    down(code){ return this.keys.has(code); },
    consume(code){ if(this.keys.has(code)){ this.keys.delete(code); return true; } return false; },
    axisX(){
      const raw = (this.down("KeyD")?1:0) - (this.down("KeyA")?1:0);
      if (this.confusionEnabled && this.confusionT>0) return -raw;
      return raw;
    },
    jump(){ return this.down("KeyW"); },
    interact(){ return this.down("KeyE"); }
  };

  window.addEventListener("keydown", (e)=>{
    if(["KeyW","KeyA","KeyS","KeyD","KeyE","Space","Digit1","Digit2","Digit3","Digit4"].includes(e.code)) e.preventDefault();
    Input.keys.add(e.code);
  }, { passive:false });
  window.addEventListener("keyup", (e)=>Input.keys.delete(e.code));

  canvas.addEventListener("mousemove",(e)=>{
    const r=canvas.getBoundingClientRect();
    Input.mouse.nx = clamp((e.clientX-r.left)/Math.max(1,r.width),0,1);
    Input.mouse.ny = clamp((e.clientY-r.top)/Math.max(1,r.height),0,1);
  });
  canvas.addEventListener("mousedown", ()=>Input.mouse.down=true);
  window.addEventListener("mouseup", ()=>Input.mouse.down=false);

  /*************************
   * Palette
   *************************/
  const PAL = {
    bg:"#050505",
    floor:"#09090d",
    wall:"#0f0f16",
    fog:"#0b0b12",
    light:"#eaeaf2",
    accent:"#7d3cff",
    danger:"#ff2a2a",
    sick:"#a2ffcf",
    rust:"#5a0b17",
    paper:"#f1f1ff",
    glass:"#89b7ff",
    potion:"#ffb24a",
    slime:"#39ffb0",
  };

  /*************************
   * Assets + Sprite system
   *************************/
  class Assets {
    constructor(){
      this.images = new Map();
      this.manifest = {
        player:"assets/player.png",
        angel:"assets/angel.png",
        fiend:"assets/fiend.png",
        golem:"assets/golem.png",
        crazy:"assets/crazy.png",
        wailer:"assets/wailer.png",
        nurse:"assets/nurse.png",
        patient:"assets/patient.png",
        child:"assets/child.png",
        chest:"assets/chest.png",
        note:"assets/note.png",
        bin:"assets/bin.png",
        glass:"assets/glass.png",
        potion:"assets/potion.png",
        friend:"assets/friend.png",
        boss1:"assets/boss1.png",
        boss2:"assets/boss2.png",
        face1:"assets/face1.png",
        face2:"assets/face2.png",
      };
    }
    get(key){ return this.images.get(key)||null; }
    async tryLoadManifest(){
      const keys=Object.keys(this.manifest);
      await Promise.all(keys.map(k=>this._loadOne(k,this.manifest[k])));
    }
    _loadOne(key,url){
      return new Promise((resolve)=>{
        const img=new Image();
        img.onload=()=>{ this.images.set(key,img); resolve(true); };
        img.onerror=()=>resolve(false);
        img.src=url;
      });
    }
    async loadFromFiles(fileList){
      const files=Array.from(fileList||[]);
      for(const f of files){
        if(!f.type.includes("png")) continue;
        const name=(f.name||"").toLowerCase();
        const key = [
          "player","angel","fiend","golem","crazy","wailer","nurse","patient","child","chest","note",
          "bin","glass","potion","friend","boss1","boss2","face1","face2"
        ].find(k=>name.includes(k));
        if(!key) continue;

        const dataUrl = await new Promise((resolve)=>{
          const fr=new FileReader();
          fr.onload=()=>resolve(fr.result);
          fr.readAsDataURL(f);
        });

        await new Promise((resolve)=>{
          const img=new Image();
          img.onload=()=>{ this.images.set(key,img); resolve(true); };
          img.onerror=()=>resolve(false);
          img.src=dataUrl;
        });
      }
    }
  }
  const assets = new Assets();

  class Sprite {
    constructor(img, fw, fh, frames, fps=10){
      this.img=img; this.fw=fw; this.fh=fh; this.frames=frames; this.fps=fps;
    }
    draw(ctx,x,y,t,flip=false,scale=1,alpha=1,frameOverride=null){
      if(!this.img) return;
      const f = frameOverride!==null ? frameOverride : (Math.floor(t*this.fps)%this.frames);
      const sx=f*this.fw;
      ctx.save();
      ctx.globalAlpha=alpha;
      ctx.translate(x|0,y|0);
      if(flip){ ctx.scale(-1,1); ctx.translate(-this.fw*scale,0); }
      ctx.drawImage(this.img, sx,0,this.fw,this.fh, 0,0,(this.fw*scale)|0,(this.fh*scale)|0);
      ctx.restore();
    }
  }

  /*************************
   * Procedural pixel-art sheets (fallbacks)
   *************************/
  function makeSheet(key, fw, fh, frames, drawFrame){
    const c=document.createElement("canvas");
    c.width=fw*frames; c.height=fh;
    const x=c.getContext("2d");
    x.imageSmoothingEnabled=false;
    for(let i=0;i<frames;i++){
      x.save(); x.translate(i*fw,0);
      drawFrame(x,i,frames);
      x.restore();
    }
    assets.images.set(key,c);
  }
  function dots(x,w,h,density,color){
    x.fillStyle=color;
    const n=Math.floor(w*h*density);
    for(let i=0;i<n;i++) x.fillRect((Math.random()*w)|0,(Math.random()*h)|0,1,1);
  }
  function faceSheet(key){
    makeSheet(key, 96, 64, 1, (x)=>{
      x.clearRect(0,0,96,64);
      x.fillStyle="#000"; x.fillRect(0,0,96,64);
      x.globalAlpha=0.9;
      x.fillStyle="#101018"; x.fillRect(8,8,80,48);
      x.globalAlpha=1;
      x.fillStyle="#1b1b24"; x.fillRect(22,20,12,6);
      x.fillRect(62,20,12,6);
      x.fillStyle=PAL.paper; x.fillRect(26,22,4,2); x.fillRect(66,22,4,2);
      x.fillStyle=PAL.rust; x.fillRect(44,28,8,4);
      x.globalAlpha=0.35;
      for(let i=0;i<30;i++){
        x.fillStyle = (i%2)?PAL.accent:PAL.danger;
        x.fillRect(randi(0,95), randi(0,63), randi(1,3), 1);
      }
      x.globalAlpha=1;
      dots(x,96,64,0.07,"#00000022");
      dots(x,96,64,0.02,"#ffffff10");
    });
  }

  function buildProceduralSprites(){
    // Player
    makeSheet("player",24,36,6,(x,i)=>{
      x.clearRect(0,0,24,36);
      const step=Math.sin((i/6)*Math.PI*2);
      // coat
      x.fillStyle="#0a0a0f"; x.fillRect(6,9,12,22);
      x.fillStyle=PAL.light; x.fillRect(7,10,10,18);
      x.fillStyle="#161620"; x.fillRect(7,17,10,3);
      // head
      x.fillStyle="#101018"; x.fillRect(8,6,8,6);
      // eye
      x.fillStyle=PAL.accent; x.fillRect(14,8,2,1);
      // legs
      x.fillStyle="#0c0c12";
      x.fillRect(8+(step>0?1:0),28,3,6);
      x.fillRect(13+(step<0?1:0),28,3,6);
      // pistol holster
      x.fillStyle="#3a3a4a"; x.fillRect(6,22,2,4);
      dots(x,24,36,0.035,"#00000022");
      dots(x,24,36,0.02,"#ffffff10");
    });

    // Angel (baseline flyer)
    makeSheet("angel",28,28,6,(x,i)=>{
      x.clearRect(0,0,28,28);
      const flap=Math.sin((i/6)*Math.PI*2);
      // wings
      x.fillStyle=PAL.danger;
      x.fillRect(1,10,8,4+((flap*3)|0));
      x.fillRect(19,10,8,4+((-flap*3)|0));
      // torso
      x.fillStyle="#2a0b10"; x.fillRect(10,7,8,14);
      // eyes
      x.fillStyle=PAL.paper; x.fillRect(12,11,2,1); x.fillRect(14,11,2,1);
      // spikes
      x.fillStyle="#500f18";
      x.fillRect(9,6,1,2); x.fillRect(18,6,1,2);
      dots(x,28,28,0.06,"#00000022");
    });

    // Fiend: angry eyes + spikes (menacing)
    makeSheet("fiend",32,32,6,(x,i)=>{
      x.clearRect(0,0,32,32);
      const jerk=Math.sin((i/6)*Math.PI*2);
      // body mass
      x.fillStyle="#0b0b12"; x.fillRect(9,10,14,14);
      x.fillStyle="#1a1a25"; x.fillRect(10,11,12,12);
      // spikes
      x.fillStyle=PAL.danger;
      for(let k=0;k<6;k++){
        x.fillRect(8+k*4, 8, 1, 3);
      }
      x.fillRect(7,14,2,1); x.fillRect(23,14,2,1);
      // angry eyes
      x.fillStyle=PAL.paper;
      x.fillRect(13,15,2,1);
      x.fillRect(17,15,2,1);
      x.fillStyle=PAL.danger;
      x.fillRect(13,16,1,1); x.fillRect(18,16,1,1);
      // mouth
      x.fillStyle="#000"; x.fillRect(15,19,2,1);
      // jitter arms
      x.fillStyle="#14141f";
      x.fillRect(6,16+((jerk*1)|0),3,2);
      x.fillRect(23,16+(((-jerk)*1)|0),3,2);
      dots(x,32,32,0.06,"#00000022");
      dots(x,32,32,0.02,"#ffffff10");
    });

    // Golem: slow, heavy, high life
    makeSheet("golem",36,36,6,(x,i)=>{
      x.clearRect(0,0,36,36);
      const bob=Math.sin((i/6)*Math.PI*2);
      x.fillStyle="#0a0a10"; x.fillRect(10,8,16,22);
      x.fillStyle="#171722"; x.fillRect(11,10,14,18);
      // plates
      x.fillStyle="#232334";
      x.fillRect(12,12,12,3);
      x.fillRect(12,17,12,3);
      x.fillRect(12,22,12,3);
      // eye core
      x.fillStyle=PAL.accent;
      x.fillRect(17,16+((bob*1)|0),2,2);
      // shoulders
      x.fillStyle="#101018";
      x.fillRect(6,12,6,6);
      x.fillRect(24,12,6,6);
      // feet
      x.fillStyle="#09090d";
      x.fillRect(12,30,6,3); x.fillRect(18,30,6,3);
      dots(x,36,36,0.07,"#00000022");
    });

    // Crazy: slender fast, low hp, low dmg
    makeSheet("crazy",24,34,6,(x,i)=>{
      x.clearRect(0,0,24,34);
      const step=Math.sin((i/6)*Math.PI*2);
      // thin torso
      x.fillStyle="#0b0b10"; x.fillRect(10,9,4,18);
      x.fillStyle="#151520"; x.fillRect(11,10,2,16);
      // head
      x.fillStyle="#0f0f18"; x.fillRect(9,5,6,5);
      // eyes (wild)
      x.fillStyle=PAL.paper; x.fillRect(10,7,1,1); x.fillRect(13,7,1,1);
      x.fillStyle=PAL.danger; x.fillRect(11,7,1,1); x.fillRect(12,7,1,1);
      // arms
      x.fillStyle="#101018";
      x.fillRect(6,14+((step>0?1:0)),4,2);
      x.fillRect(14,14+((step<0?1:0)),4,2);
      // legs
      x.fillStyle="#0c0c12";
      x.fillRect(9+(step>0?1:0),27,2,6);
      x.fillRect(13+(step<0?1:0),27,2,6);
      dots(x,24,34,0.05,"#00000022");
    });

    // Wailer: grief madness aura
    makeSheet("wailer",32,32,6,(x,i)=>{
      x.clearRect(0,0,32,32);
      const swell=0.5+0.5*Math.sin((i/6)*Math.PI*2);
      // body
      x.globalAlpha=0.85;
      x.fillStyle="#0b0b12"; x.fillRect(11,8,10,18);
      x.fillStyle="#11111a"; x.fillRect(12,9,8,16);
      x.globalAlpha=1;
      // hollow mouth
      x.fillStyle="#000"; x.fillRect(15,18,2,4);
      // tear eyes
      x.fillStyle=PAL.paper; x.fillRect(13,14,2,1); x.fillRect(17,14,2,1);
      x.fillStyle=PAL.rust; x.fillRect(14,15,1,3); x.fillRect(18,15,1,3);
      // aura hint
      x.globalAlpha=0.25+0.25*swell;
      x.fillStyle=PAL.accent;
      x.fillRect(6,6,20,1);
      x.fillRect(6,26,20,1);
      x.globalAlpha=1;
      dots(x,32,32,0.06,"#00000022");
    });

    // Nurse / Patient / Child / Chest / Note reused if present else basic
    makeSheet("nurse",24,34,6,(x,i)=>{
      x.clearRect(0,0,24,34);
      const sway=Math.sin((i/6)*Math.PI*2);
      x.fillStyle="#0c0c12"; x.fillRect(7,7,10,24);
      x.fillStyle="#dcdcea"; x.fillRect(8,9,8,18);
      x.fillStyle="#f1f1ff"; x.fillRect(9,7,6,4);
      x.fillStyle=PAL.accent; x.fillRect(14,9,1,1);
      x.fillStyle="#6e6e80"; x.fillRect(3,14+((sway*1)|0),6,2);
      dots(x,24,34,0.045,"#00000022");
    });
    makeSheet("patient",24,34,6,(x,i)=>{
      x.clearRect(0,0,24,34);
      x.fillStyle="#09090f"; x.fillRect(7,7,10,24);
      x.fillStyle="#b8b8c6"; x.fillRect(8,10,8,14);
      x.fillStyle="#000"; x.fillRect(9,8,6,3);
      x.fillStyle=PAL.rust; x.fillRect(12,16,2,2);
      const step=Math.sin((i/6)*Math.PI*2);
      x.fillStyle="#101018";
      x.fillRect(8+(step>0?1:0),28,3,6);
      dots(x,24,34,0.05,"#00000022");
    });
    makeSheet("child",22,30,4,(x,i)=>{
      x.clearRect(0,0,22,30);
      const bob=Math.sin((i/4)*Math.PI*2);
      x.fillStyle=PAL.sick;
      x.fillRect(9,6+((bob*1)|0),4,4);
      x.beginPath();
      x.moveTo(11,10); x.lineTo(18,26); x.lineTo(4,26);
      x.closePath(); x.fill();
      x.fillStyle="#003a22";
      x.fillRect(9,9,1,1); x.fillRect(12,9,1,1);
      dots(x,22,30,0.03,"#ffffff10");
    });
    makeSheet("chest",26,18,4,(x,i)=>{
      x.clearRect(0,0,26,18);
      const pulse=Math.sin((i/4)*Math.PI*2);
      x.fillStyle="#0b0b11"; x.fillRect(3,6,20,10);
      x.fillStyle="#181820"; x.fillRect(4,7,18,4);
      x.fillStyle=PAL.potion; x.fillRect(6,11,14,2);
      x.fillStyle="#2a2a3a"; x.fillRect(12,10,2,3);
      x.globalAlpha=0.3+pulse*0.2;
      x.fillStyle=PAL.potion; x.fillRect(18,6,2,2);
      x.globalAlpha=1;
      dots(x,26,18,0.06,"#00000022");
    });
    makeSheet("note",14,12,2,(x,i)=>{
      x.clearRect(0,0,14,12);
      x.fillStyle=PAL.paper; x.fillRect(1,1,12,10);
      x.fillStyle="#2a2a3a"; x.fillRect(10,2,2,2);
      dots(x,14,12,0.08,"#00000014");
    });

    // Ward props
    makeSheet("bin",24,24,2,(x,i)=>{
      x.clearRect(0,0,24,24);
      if(i===1){
        x.globalAlpha=0.8;
        x.fillStyle="#0b0b11"; x.fillRect(6,12,12,8);
        x.fillStyle="#1c1c26"; x.fillRect(7,13,10,3);
        x.fillStyle=PAL.rust; x.fillRect(9,16,2,1);
        x.globalAlpha=1;
      } else {
        x.fillStyle="#0b0b11"; x.fillRect(6,8,12,14);
        x.fillStyle="#1c1c26"; x.fillRect(7,9,10,10);
        x.fillStyle="#101018"; x.fillRect(6,6,12,3);
        x.fillStyle="#2b2b3a"; x.fillRect(8,12,8,2);
        dots(x,24,24,0.06,"#00000022");
      }
    });

    makeSheet("glass",16,24,2,(x,i)=>{
      x.clearRect(0,0,16,24);
      if(i===0){
        x.globalAlpha=0.25;
        x.fillStyle=PAL.glass; x.fillRect(3,3,10,18);
        x.globalAlpha=0.8;
        x.strokeStyle=PAL.glass; x.strokeRect(3.5,3.5,9,17);
        x.globalAlpha=1;
        dots(x,16,24,0.03,"#ffffff22");
      } else {
        x.globalAlpha=0.18;
        x.fillStyle=PAL.glass; x.fillRect(4,6,8,10);
        x.globalAlpha=1;
        x.fillStyle="#fff";
        x.fillRect(2,14,1,1); x.fillRect(12,10,1,1);
        x.fillRect(7,4,1,1);
        dots(x,16,24,0.06,"#00000022");
      }
    });

    makeSheet("potion",16,16,2,(x,i)=>{
      x.clearRect(0,0,16,16);
      x.fillStyle="#0b0b11"; x.fillRect(6,2,4,3);
      x.fillStyle=i===0?PAL.potion:PAL.slime;
      x.fillRect(5,5,6,9);
      x.fillStyle="#1c1c26"; x.fillRect(6,6,4,7);
      x.fillStyle="#fff"; x.globalAlpha=0.25;
      x.fillRect(5,6,1,4);
      x.globalAlpha=1;
      dots(x,16,16,0.05,"#00000022");
    });

    // Friend companion
    makeSheet("friend",20,20,6,(x,i)=>{
      x.clearRect(0,0,20,20);
      const orb = Math.sin((i/6)*Math.PI*2);
      x.fillStyle="#0b0b11"; x.fillRect(6,6,8,8);
      x.fillStyle=PAL.accent; x.fillRect(9,9,2,2);
      x.fillStyle=PAL.paper; x.globalAlpha=0.25+0.2*orb;
      x.fillRect(2,9,4,1); x.fillRect(14,9,4,1);
      x.fillRect(9,2,1,4); x.fillRect(9,14,1,4);
      x.globalAlpha=1;
      dots(x,20,20,0.06,"#00000022");
    });

    // Boss sheets (simple fallback)
    makeSheet("boss1",64,64,6,(x,i)=>{
      x.clearRect(0,0,64,64);
      const r=10+Math.sin((i/6)*Math.PI*2)*2;
      x.fillStyle="#0d0d16"; x.fillRect(16,12,32,44);
      x.strokeStyle=PAL.accent;
      x.beginPath();
      for(let k=0;k<10;k++){
        const a=k*(Math.PI*2/10)+i*0.25;
        const cx=32, cy=20;
        x.moveTo(cx,cy);
        x.lineTo(cx+Math.cos(a)*(14+r), cy+Math.sin(a)*10);
      }
      x.stroke();
      x.fillStyle=PAL.danger; x.fillRect(30,28,4,10);
      dots(x,64,64,0.06,"#00000022");
    });
    makeSheet("boss2",72,56,6,(x,i)=>{
      x.clearRect(0,0,72,56);
      const wob=Math.sin((i/6)*Math.PI*2);
      x.fillStyle="#0b0b12"; x.fillRect(14,10,44,30);
      x.fillStyle=PAL.accent; x.fillRect(34,22,4,4);
      x.fillStyle=PAL.danger;
      x.fillRect(18,16,6,6); x.fillRect(48,16,6,6);
      x.strokeStyle="#3a3a55";
      x.beginPath();
      x.moveTo(36,40); x.lineTo(28,52+((wob*2)|0));
      x.moveTo(36,40); x.lineTo(44,52+(((-wob)*2)|0));
      x.stroke();
      dots(x,72,56,0.07,"#00000022");
    });

    // Faces for hallucinations / past echoes
    faceSheet("face1");
    faceSheet("face2");
  }
  buildProceduralSprites();

  function updateAssetUI(){
    UI.assetDot.className = "dot ok";
    UI.assetText.textContent = `Sprites ready (PNG override optional)`;
  }
  updateAssetUI();

  /*************************
   * Audio (procedural, abrasive)
   *************************/
  const AudioSys = {
    ctx:null, master:null, started:false,
    filter:null, drive:null,
    droneG:null, noiseG:null, sirenO:null, sirenG:null,
    hard:true,

    start(){
      if(this.started) return;
      const AC=window.AudioContext||window.webkitAudioContext;
      this.ctx=new AC();
      this.master=this.ctx.createGain();
      this.master.gain.value=0.26;
      this.master.connect(this.ctx.destination);

      this.filter=this.ctx.createBiquadFilter();
      this.filter.type="lowpass";
      this.filter.frequency.value=420;
      this.filter.Q.value=0.9;
      this.filter.connect(this.master);

      this.drive=this.ctx.createWaveShaper();
      this.drive.curve=this._dist(260);
      this.drive.oversample="4x";
      this.drive.connect(this.filter);

      // drone
      const o1=this.ctx.createOscillator();
      const o2=this.ctx.createOscillator();
      o1.type="sawtooth"; o2.type="triangle";
      o1.frequency.value=44; o2.frequency.value=56; o2.detune.value=-19;

      this.droneG=this.ctx.createGain();
      this.droneG.gain.value=0.10;
      o1.connect(this.droneG); o2.connect(this.droneG);
      this.droneG.connect(this.drive);

      // noise
      const nlen=2*this.ctx.sampleRate;
      const nb=this.ctx.createBuffer(1,nlen,this.ctx.sampleRate);
      const d=nb.getChannelData(0);
      for(let i=0;i<nlen;i++) d[i]=(Math.random()*2-1)*(0.8+0.2*Math.random());
      const ns=this.ctx.createBufferSource();
      ns.buffer=nb; ns.loop=true;

      const hp=this.ctx.createBiquadFilter();
      hp.type="highpass"; hp.frequency.value=160;

      this.noiseG=this.ctx.createGain();
      this.noiseG.gain.value=0.02;
      ns.connect(hp); hp.connect(this.noiseG); this.noiseG.connect(this.drive);

      // siren
      this.sirenO=this.ctx.createOscillator();
      this.sirenO.type="sine";
      this.sirenO.frequency.value=520;
      this.sirenG=this.ctx.createGain();
      this.sirenG.gain.value=0.0001;
      this.sirenO.connect(this.sirenG);
      this.sirenG.connect(this.filter);

      o1.start(); o2.start(); ns.start(); this.sirenO.start();
      this.started=true;
    },

    setHard(on){
      this.hard=!!on;
      if(!this.started) return;
      const t=this.ctx.currentTime;
      this.master.gain.setTargetAtTime(this.hard?0.28:0.20,t,0.08);
      this.drive.curve=this._dist(this.hard?320:150);
    },

    setIntensity(v, mode){
      if(!this.started) return;
      const t=this.ctx.currentTime;
      const i=clamp(v,0,1);
      this.filter.frequency.setTargetAtTime(280+i*(this.hard?2600:2000),t,0.10);
      this.noiseG.gain.setTargetAtTime(0.01+i*(this.hard?0.24:0.14),t,0.10);
      this.droneG.gain.setTargetAtTime(0.06+i*0.14,t,0.10);

      const sirenOn=(mode==="frenetic"||mode==="boss");
      const target=(this.hard && sirenOn)?(0.02+i*0.07):0.0001;
      this.sirenG.gain.setTargetAtTime(target,t,0.12);

      if(sirenOn){
        const f=420+Math.sin(performance.now()*0.0012)*200;
        this.sirenO.frequency.setTargetAtTime(f,t,0.12);
      }
    },

    ping(kind="shoot", amt=1){
      if(!this.started) return;
      const t=this.ctx.currentTime;
      const o=this.ctx.createOscillator();
      const g=this.ctx.createGain();
      o.connect(g); g.connect(this.filter);
      g.gain.value=0.0001;

      if(kind==="shoot"){
        o.type="square";
        o.frequency.setValueAtTime(200,t);
        o.frequency.exponentialRampToValueAtTime(70,t+0.09);
        g.gain.setValueAtTime(0.11*amt,t);
        g.gain.exponentialRampToValueAtTime(0.0001,t+0.10);
        o.start(t); o.stop(t+0.11);
      } else if(kind==="hit"){
        o.type="sawtooth";
        o.frequency.setValueAtTime(120,t);
        o.frequency.exponentialRampToValueAtTime(18,t+0.22);
        g.gain.setValueAtTime(0.18*amt,t);
        g.gain.exponentialRampToValueAtTime(0.0001,t+0.25);
        o.start(t); o.stop(t+0.26);
      } else if(kind==="thump"){
        o.type="sine";
        o.frequency.setValueAtTime(110,t);
        o.frequency.exponentialRampToValueAtTime(36,t+0.16);
        g.gain.setValueAtTime(0.22*amt,t);
        g.gain.exponentialRampToValueAtTime(0.0001,t+0.22);
        o.start(t); o.stop(t+0.24);
      } else if(kind==="laser"){
        o.type="triangle";
        o.frequency.setValueAtTime(320,t);
        o.frequency.linearRampToValueAtTime(90,t+0.14);
        g.gain.setValueAtTime(0.15*amt,t);
        g.gain.exponentialRampToValueAtTime(0.0001,t+0.18);
        o.start(t); o.stop(t+0.19);
      } else if(kind==="glass"){
        o.type="square";
        o.frequency.setValueAtTime(880,t);
        o.frequency.exponentialRampToValueAtTime(220,t+0.08);
        g.gain.setValueAtTime(0.10*amt,t);
        g.gain.exponentialRampToValueAtTime(0.0001,t+0.10);
        o.start(t); o.stop(t+0.11);
      }
    },

    _dist(amount){
      const n=44100;
      const curve=new Float32Array(n);
      const k=typeof amount==="number"?amount:50;
      const deg=Math.PI/180;
      for(let i=0;i<n;i++){
        const x=(i*2)/n-1;
        curve[i]=((3+k)*x*20*deg)/(Math.PI+k*Math.abs(x));
      }
      return curve;
    }
  };
  canvas.addEventListener("pointerdown", ()=>AudioSys.start());

  /*************************
   * Scene stack (dialogue overlay)
   *************************/
  const SceneStack = {
    stack:[],
    push(s){ this.stack.push(s); s.onEnter?.(); },
    pop(){ const s=this.stack.pop(); s?.onExit?.(); return s; },
    top(){ return this.stack[this.stack.length-1]||null; }
  };

  function escapeHtml(s){
    return (s??"").toString().replace(/[&<>"']/g,(m)=>({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
    }[m]));
  }

  class DialogueScene {
    constructor(cfg){ this.cfg=cfg; this.pausesGame=true; }
    onEnter(){
      UI.dialogue.classList.remove("hidden");
      UI.dlgTitle.textContent=this.cfg.title;
      UI.dlgSub.textContent=this.cfg.sub||"";
      UI.dlgBody.textContent=this.cfg.body;

      UI.dlgChoices.innerHTML="";
      this.cfg.choices.forEach((ch,idx)=>{
        const b=document.createElement("button");
        b.className="choiceBtn";
        b.innerHTML=`<b>${idx+1}) ${escapeHtml(ch.label)}</b><small>${escapeHtml(ch.hint||"")}</small>`;
        b.addEventListener("click", ()=>this.pick(idx));
        UI.dlgChoices.appendChild(b);
      });
    }
    onExit(){
      UI.dialogue.classList.add("hidden");
      UI.dlgChoices.innerHTML="";
    }
    pick(idx){
      const ch=this.cfg.choices[idx]; if(!ch) return;
      ch.onPick?.();
      SceneStack.pop();
    }
    update(){
      if(Input.consume("Digit1")) this.pick(0);
      if(Input.consume("Digit2")) this.pick(1);
      if(Input.consume("Digit3")) this.pick(2);
      if(Input.consume("Digit4")) this.pick(3);
    }
  }

  /*************************
   * Atmosphere Zones
   *************************/
  class AtmosphereManager {
    constructor(){
      this.zoneIndex=0;
      this.transitionT=0;
      this.zones=[
        {depth:0,   name:"INTAKE",   tint:"#2a2a33", fog:1.05, noise:1.00, ward:0.4, whisper:"Wet paper. Clean lies."},
        {depth:160, name:"WARD",     tint:"#1c2430", fog:1.18, noise:1.10, ward:1.0, whisper:"The ward is vibrant. It is not alive."},
        {depth:420, name:"SURGERY",  tint:"#2b1020", fog:1.12, noise:1.25, ward:0.7, whisper:"The lights are too clean. That’s how you know."},
        {depth:680, name:"BASEMENT", tint:"#0b1d16", fog:1.35, noise:1.35, ward:0.5, whisper:"Drips spell names you refuse to read."},
        {depth:980, name:"CHAPEL",   tint:"#2a1b0a", fog:1.10, noise:1.45, ward:0.3, whisper:"Witness is demanded."},
      ];
      this.zone=this.zones[0];
    }
    update(dt,g){
      const d=Math.floor(g.player.x/10);
      let idx=this.zoneIndex;
      while(idx+1<this.zones.length && d>=this.zones[idx+1].depth) idx++;
      if(idx!==this.zoneIndex){
        this.zoneIndex=idx;
        this.zone=this.zones[idx];
        this.transitionT=2.2;
        g.whisper(`[ZONE: ${this.zone.name}] ${this.zone.whisper}`,2.6);
        AudioSys.ping("thump",0.9);
      }
      this.transitionT=Math.max(0,this.transitionT-dt);
    }
    get fogMult(){ return this.zone.fog; }
    get noiseMult(){ return this.zone.noise; }
    get tint(){ return this.zone.tint; }
    get ward(){ return this.zone.ward; }
    get name(){ return this.zone.name; }
  }

  /*************************
   * Particles + Decals (gore)
   *************************/
  class Particle {
    constructor(x,y,kind){
      this.x=x; this.y=y;
      this.kind=kind;
      this.vx=rand(-120,120);
      this.vy=rand(-220,60);
      this.life=rand(0.25,1.2);
      this.s=rand(1,3);
      if(kind==="gib"){ this.s=rand(2,4); this.life=rand(0.4,1.4); this.vx*=1.2; this.vy*=1.2; }
      if(kind==="shard"){ this.s=rand(1,2); this.life=rand(0.25,0.9); this.vx*=1.4; this.vy*=1.1; }
    }
    update(dt,g){
      this.life-=dt;
      this.vy += g.world.gravity*dt*0.55;
      this.x += this.vx*dt;
      this.y += this.vy*dt;

      if(this.y>g.world.groundY){
        this.y=g.world.groundY;
        this.vx*=0.25;
        this.vy*=-0.15;
        // occasional blood decal splat
        if(this.kind==="blood"||this.kind==="gib"){
          if(chance(0.06)) g.addDecal(this.x, g.world.groundY-1, "blood");
        }
      }
    }
    draw(ctx,cam){
      const sx=(this.x-cam.x)|0, sy=(this.y-cam.y)|0;
      if(this.kind==="blood") ctx.fillStyle=PAL.rust;
      else if(this.kind==="gib") ctx.fillStyle=chance(0.7)?PAL.rust:"#22060a";
      else if(this.kind==="shard") ctx.fillStyle=PAL.glass;
      else if(this.kind==="spark") ctx.fillStyle=PAL.paper;
      else ctx.fillStyle="#3a3a44";
      ctx.fillRect(sx,sy,this.s,this.s);
    }
  }

  class Decal {
    constructor(x,y,type){
      this.x=x; this.y=y;
      this.type=type;
      this.a=rand(0.22,0.55);
      this.r=rand(4,12);
    }
    draw(ctx,cam){
      const sx=(this.x-cam.x)|0, sy=(this.y-cam.y)|0;
      ctx.globalAlpha=this.a;
      if(this.type==="blood"){
        ctx.fillStyle=PAL.rust;
        ctx.fillRect(sx,sy,this.r,(this.r*0.5)|0);
        ctx.fillRect(sx+(this.r*0.3)|0, sy-1, 2, 2);
      } else {
        ctx.fillStyle="#222230";
        ctx.fillRect(sx,sy,this.r,1);
      }
      ctx.globalAlpha=1;
    }
  }

  /*************************
   * World + Props
   *************************/
  class World {
    constructor(){
      this.gravity=720;
      this.groundY=170;
      this.cam={x:0,y:0};
      this.obstacles=[];
      this.decor=[];
      this.props=[];
      this.thresholdX=1100;
      this.reset();
    }
    reset(){
      this.cam.x=0; this.cam.y=0;
      this.obstacles.length=0;
      this.decor.length=0;
      this.props.length=0;

      let x=260;
      for(let i=0;i<260;i++){
        // obstacles
        if(chance(0.34)){
          const h=randi(16,60);
          const w=randi(20,90);
          this.obstacles.push({x,y:this.groundY-h,w,h,type:chance(0.5)?"cart":"pillar"});
        }
        // ward decor: bins/glass/potions
        if(chance(0.18)) this.props.push(new Prop(x+rand(-70,70), "bin"));
        if(chance(0.14)) this.props.push(new Prop(x+rand(-70,70), "glass"));
        if(chance(0.12)) this.props.push(new Prop(x+rand(-70,70), "potion"));

        // decor
        if(chance(0.22)){
          this.decor.push({x:x+rand(-90,90), type:chance(0.6)?"bars":"lamp", s:rand(0.7,1.4)});
        }
        x += rand(70,170);
      }
    }

    collide(body){
      body.grounded=false;
      if(body.y+body.h>=this.groundY){
        body.y=this.groundY-body.h;
        body.vy=0;
        body.grounded=true;
      }
      for(const o of this.obstacles){
        if(!aabb(body.x,body.y,body.w,body.h,o.x,o.y,o.w,o.h)) continue;
        const prevY=body.y-body.vy*(1/60);
        if(prevY+body.h<=o.y+2){
          body.y=o.y-body.h;
          body.vy=0;
          body.grounded=true;
        } else {
          if(body.x+body.w/2<o.x+o.w/2) body.x=o.x-body.w;
          else body.x=o.x+o.w;
          body.vx=0;
        }
      }
    }

    draw(ctx,t,atmo,decals){
      ctx.fillStyle=PAL.bg;
      ctx.fillRect(0,0,RW,RH);

      // parallax decor
      for(const d of this.decor){
        const sx=(d.x-this.cam.x*0.5)|0;
        if(sx<-120||sx>RW+120) continue;
        this.drawDecor(ctx,d,sx,t,atmo);
      }

      // ward background vibe
      ctx.globalAlpha=0.70;
      ctx.fillStyle=PAL.wall;
      ctx.fillRect(0,0,RW,this.groundY-80);
      ctx.globalAlpha=1;

      // “vibrant ward” pulses
      if(atmo && atmo.name==="WARD"){
        const pulse=0.05+0.05*Math.sin(t*5);
        ctx.globalAlpha=0.08+pulse;
        ctx.fillStyle="#2a3a55";
        ctx.fillRect(0,10,RW,20);
        ctx.globalAlpha=1;
      }

      // floor
      ctx.fillStyle=PAL.floor;
      ctx.fillRect(0,this.groundY,RW,RH-this.groundY);

      // blood decals first (on floor)
      if(decals){
        for(const d of decals) d.draw(ctx,this.cam);
      }

      // obstacles
      for(const o of this.obstacles){
        const sx=(o.x-this.cam.x)|0;
        if(sx+o.w<-60||sx>RW+60) continue;
        ctx.fillStyle="#12121a";
        ctx.fillRect(sx,o.y,o.w,o.h);
        ctx.strokeStyle="#0b0b10";
        ctx.strokeRect(sx+0.5,o.y+0.5,o.w-1,o.h-1);
        if(o.type==="cart"){
          ctx.fillStyle="#0a0a10"; ctx.fillRect(sx+4,o.y+4,o.w-8,3);
        } else {
          ctx.fillStyle="#0a0a10";
          for(let i=0;i<3;i++) ctx.fillRect(sx+3+i*5,o.y+3,2,o.h-6);
        }
      }

      // threshold glyph
      const tx=(this.thresholdX-this.cam.x)|0;
      if(tx>-40&&tx<RW+40){
        ctx.globalAlpha=0.8;
        ctx.strokeStyle=PAL.accent;
        for(let i=0;i<7;i++){
          const y0=this.groundY-92+i*14;
          ctx.beginPath();
          ctx.moveTo(tx,y0);
          ctx.lineTo(tx+(i%2?12:-12),y0+10);
          ctx.stroke();
        }
        ctx.globalAlpha=1;
      }

      // zone tint wash
      if(atmo){
        ctx.globalAlpha=0.08+(atmo.transitionT>0?0.06:0);
        ctx.fillStyle=atmo.tint;
        ctx.fillRect(0,0,RW,RH);
        ctx.globalAlpha=1;
      }

      // fog bands
      ctx.globalAlpha=0.24;
      ctx.fillStyle=PAL.fog;
      for(let i=0;i<8;i++){
        const yy=10+i*18+Math.sin(t*0.85+i+this.cam.x*0.004)*2;
        ctx.fillRect(0,yy,RW,10);
      }
      ctx.globalAlpha=1;
    }

    drawDecor(ctx,d,sx,t,atmo){
      const y=this.groundY;
      if(d.type==="bars"){
        ctx.globalAlpha=0.55;
        ctx.strokeStyle="#0b0b10";
        for(let i=0;i<7;i++){
          const x=sx+i*7;
          ctx.beginPath();
          ctx.moveTo(x,y-120*d.s);
          ctx.lineTo(x,y-10);
          ctx.stroke();
        }
        ctx.globalAlpha=1;
      } else {
        const flick=0.5+0.5*Math.sin(t*6+sx*0.02);
        ctx.globalAlpha=0.4;
        ctx.fillStyle="#0b0b10";
        ctx.fillRect(sx,y-130*d.s,8,120*d.s);
        ctx.globalAlpha=0.10+flick*0.22;
        ctx.fillStyle=PAL.paper;
        ctx.fillRect(sx-16,y-130*d.s,40,40);
        ctx.globalAlpha=1;
      }
    }
  }

  class Prop {
    constructor(x,type){
      this.x=x;
      this.type=type; // bin | glass | potion
      this.y=0;
      this.w=type==="bin"?16:(type==="glass"?10:10);
      this.h=type==="bin"?16:(type==="glass"?20:10);
      this.broken=false;
      this.bob=rand(0,6.28);
    }
    update(dt,g){
      this.bob += dt*1.8;
      if(this.type==="glass"){
        this.y = g.world.groundY - 26;
      } else if(this.type==="bin"){
        this.y = g.world.groundY - 18;
      } else {
        this.y = g.world.groundY - 16 + Math.sin(this.bob)*1.2;
      }
    }
    aabb(){ return {x:this.x, y:this.y, w:this.w, h:this.h}; }
    hit(g, kind="bullet"){
      if(this.broken) return null;
      this.broken=true;

      if(this.type==="glass"){
        for(let i=0;i<20;i++) g.fx(this.x+rand(0,this.w), this.y+rand(0,this.h),"shard",1);
        AudioSys.ping("glass",0.9);
        return null;
      }
      if(this.type==="bin"){
        for(let i=0;i<16;i++) g.fx(this.x+rand(0,this.w), this.y+rand(0,this.h),"spark",1);
        AudioSys.ping("thump",0.7);
        return null;
      }
      if(this.type==="potion"){
        // drop a substance pickup
        AudioSys.ping("thump",0.7);
        return chance(0.5) ? "WIGGLE" : "MEMORY";
      }
      return null;
    }
    draw(ctx,g){
      const cam=g.world.cam;
      const sx=(this.x-cam.x)|0, sy=(this.y-cam.y)|0;
      if(this.type==="bin"){
        const img=assets.get("bin");
        const sp=new Sprite(img,24,24,2,1);
        sp.draw(ctx,sx-4,sy-4, this.bob, false,1,1, this.broken?1:0);
      } else if(this.type==="glass"){
        const img=assets.get("glass");
        const sp=new Sprite(img,16,24,2,1);
        sp.draw(ctx,sx-3,sy-2, this.bob, false,1,1, this.broken?1:0);
      } else {
        const img=assets.get("potion");
        const sp=new Sprite(img,16,16,2,1);
        sp.draw(ctx,sx-3,sy-3, this.bob, false,1,1, this.broken?1:0);
      }
    }
  }

  /*************************
   * Entities
   *************************/
  class Entity {
    constructor(x,y,w,h){
      this.x=x; this.y=y; this.w=w; this.h=h;
      this.vx=0; this.vy=0;
      this.dead=false;
      this.grounded=false;
    }
    get cx(){ return this.x+this.w/2; }
    get cy(){ return this.y+this.h/2; }
  }

  class Bullet extends Entity {
    constructor(x,y,vx,vy,dmg,pierce,from){
      super(x,y,4,4);
      this.vx=vx; this.vy=vy;
      this.dmg=dmg;
      this.pierce=pierce|0;
      this.from=from;
      this.life=1.2;
      this.hit=new Set();
    }
    update(dt,g){
      this.life-=dt;
      if(this.life<=0){ this.dead=true; return; }
      this.x+=this.vx*dt;
      this.y+=this.vy*dt;

      if(this.y>RH||this.y<-40){ this.dead=true; return; }
      if(this.y+this.h>g.world.groundY){ this.dead=true; g.fx(this.x,this.y,"spark",6); return; }

      for(const o of g.world.obstacles){
        if(aabb(this.x,this.y,this.w,this.h,o.x,o.y,o.w,o.h)){
          this.dead=true; g.fx(this.x,this.y,"spark",6); return;
        }
      }
    }
    draw(ctx,cam){
      const sx=(this.x-cam.x)|0, sy=(this.y-cam.y)|0;
      ctx.fillStyle="#ffe66a"; ctx.fillRect(sx,sy,2,2);
      ctx.fillStyle="#fff"; ctx.fillRect(sx+1,sy+1,1,1);
    }
  }

  class Player extends Entity {
    constructor(name,avi){
      super(200,0,16,32);
      this.name=name;
      this.avi=avi|0;

      this.hpMax=110; this.hp=110;
      this.sanMax=110; this.san=110;
      if(this.avi===1){ this.sanMax=150; this.san=150; }
      if(this.avi===2){ this.hpMax=180; this.hp=180; }

      this.facing=1;
      this.cool=0;
      this.hurtT=0;

      // survivability
      this.invulnT=0;
      this.kbVx=0;

      // status
      this.status = {
        jamT:0,
        shiverT:0,
        slowT:0,
        griefT:0,
        wiggleT:0,
        memoryT:0,
      };

      this.lantern=190;
      this.animT=0;

      // weapons
      this.weaponIndex=0;
      this.weapons=this._buildWeapons();
      this.weapon=this.weapons[this.weaponIndex];

      // friend companion unlocked
      this.hasFriend=false;
      this.friendBoostT=0;
    }

    _buildWeapons(){
      // 4 slots to match 1-4
      if(this.avi===0){
        return [
          {name:"RIFLE", type:"gun", rate:0.12, bullets:1, spread:0.02, pierce:0, dmg:12, sanityCost:0.35},
          {name:"PISTOL", type:"gun", rate:0.09, bullets:1, spread:0.03, pierce:0, dmg:8, sanityCost:0.15},
          {name:"FLESH LASER", type:"laser", rate:0.00, dmg:26, sanityCostPerSec:8.5},
          {name:"BOND (FRIEND)", type:"bond", rate:0.35}
        ];
      }
      if(this.avi===1){
        return [
          {name:"NEEDLE", type:"gun", rate:0.15, bullets:1, spread:0.01, pierce:2, dmg:9, sanityCost:0.25},
          {name:"SIGIL SHARD", type:"gun", rate:0.20, bullets:2, spread:0.12, pierce:0, dmg:7, sanityCost:0.65},
          {name:"FLESH LASER", type:"laser", rate:0.00, dmg:24, sanityCostPerSec:9.5},
          {name:"BOND (FRIEND)", type:"bond", rate:0.35}
        ];
      }
      // heavy
      return [
        {name:"SCATTER", type:"gun", rate:0.26, bullets:5, spread:0.20, pierce:0, dmg:7, sanityCost:0.40},
        {name:"HAMMER", type:"melee", rate:0.40, dmg:30},
        {name:"PISTOL", type:"gun", rate:0.10, bullets:1, spread:0.04, pierce:0, dmg:8, sanityCost:0.15},
        {name:"BOND (FRIEND)", type:"bond", rate:0.35}
      ];
    }

    switchWeapon(idx){
      this.weaponIndex=clamp(idx,0,this.weapons.length-1);
      this.weapon=this.weapons[this.weaponIndex];
    }

    hurt(dmg,fromX=null){
      if(this.invulnT>0) return;
      this.invulnT=0.55;
      this.hp=clamp(this.hp-dmg,0,this.hpMax);
      this.san=clamp(this.san-dmg*0.20,0,this.sanMax);
      this.hurtT=0.22;

      if(fromX!==null){
        const dir=(this.cx<fromX)?-1:1;
        this.kbVx=dir*240;
        this.vy=Math.min(this.vy,-120);
      }
    }

    heal(a){ this.hp=clamp(this.hp+a,0,this.hpMax); }
    soothe(a){ this.san=clamp(this.san+a,0,this.sanMax); }

    applySubstance(kind,g){
      if(kind==="WIGGLE"){
        this.status.wiggleT = Math.max(this.status.wiggleT, rand(6.0, 10.0));
        g.whisper("WIGGLE SERUM: THE SCREEN LEARNS TO SWIM.", 2.2);
        AudioSys.ping("thump",0.9);
      } else if(kind==="MEMORY"){
        this.status.memoryT = Math.max(this.status.memoryT, rand(7.0, 12.0));
        g.whisper("MEMORY TINCTURE: YOUR PAST BECOMES A ROOM.", 2.2);
        AudioSys.ping("thump",0.9);
      } else if(kind==="FRIEND"){
        this.hasFriend=true;
        g.whisper("A FRIEND SIGNS YOUR HAND. IT SHOOTS FOR YOU.", 2.2);
        AudioSys.ping("thump",0.9);
      }
    }

    update(dt,g){
      this.animT+=dt;
      this.cool=Math.max(0,this.cool-dt);
      this.hurtT=Math.max(0,this.hurtT-dt);

      this.invulnT=Math.max(0,this.invulnT-dt);
      this.kbVx=lerp(this.kbVx,0,1-Math.pow(0.001,dt));

      // status timers
      for(const k in this.status) this.status[k]=Math.max(0,this.status[k]-dt);
      this.friendBoostT=Math.max(0,this.friendBoostT-dt);

      if(Input.consume("Digit1")) this.switchWeapon(0);
      if(Input.consume("Digit2")) this.switchWeapon(1);
      if(Input.consume("Digit3")) this.switchWeapon(2);
      if(Input.consume("Digit4")) this.switchWeapon(3);

      const slowMul = this.status.slowT>0 ? 0.62 : 1.0;
      const griefMul = this.status.griefT>0 ? 0.85 : 1.0;

      const dir=Input.axisX();
      this.vx=(dir*190*slowMul*griefMul) + this.kbVx;
      if(dir!==0) this.facing=dir>0?1:-1;

      if(Input.jump() && this.grounded){
        this.vy=-470*(slowMul*0.95);
        this.grounded=false;
        AudioSys.ping("thump",0.6);
      }

      this.vy += g.world.gravity*dt;
      this.x += this.vx*dt;
      this.y += this.vy*dt;
      g.world.collide(this);
      if(this.x<g.world.cam.x) this.x=g.world.cam.x;

      // sanity drain: grief is nasty
      const base = (g.tension.mode==="frenetic") ? 0.72 : 0.45;
      const griefDrain = (this.status.griefT>0) ? 2.2 : 0;
      this.san = clamp(this.san - dt*(base + griefDrain), 0, this.sanMax);

      this.lantern = 70 + (this.san/this.sanMax)*260;

      // aim drift
      const mx=Input.mouse.nx*RW + g.world.cam.x;
      const my=Input.mouse.ny*RH;
      const drift=(1-this.san/this.sanMax)*14 + (this.status.shiverT>0?10:0) + (this.status.griefT>0?9:0);
      const ax=mx+rand(-drift,drift);
      const ay=my+rand(-drift,drift);

      // fire
      if(this.weapon.type==="laser"){
        // continuous while held
        if(Input.mouse.down){
          g.fireLaser(this, ax, ay, dt);
        }
      } else if(Input.mouse.down && this.cool<=0){
        this.cool = this.weapon.rate * (this.status.jamT>0?1.8:1.0);
        g.fireWeapon(this, ax, ay);
      }

      // bond command: buffs friend briefly
      if(this.weapon.type==="bond" && Input.mouse.down && this.cool<=0){
        this.cool=this.weapon.rate;
        if(this.hasFriend){
          this.friendBoostT = 3.0;
          g.whisper("BOND: THE FRIEND LAUGHS QUIETER, SHOOTS FASTER.", 1.8);
          AudioSys.ping("thump",0.8);
        } else {
          g.whisper("NO FRIEND ANSWERS.", 1.2);
          AudioSys.ping("thump",0.5);
        }
      }
    }

    draw(ctx,g){
      const cam=g.world.cam;
      const sx=(this.x-cam.x)|0, sy=(this.y-cam.y)|0;
      const img=assets.get("player");
      const sp=new Sprite(img,24,36,6,10);
      const moving=Math.abs(this.vx)>5;
      const frame=moving?null:0;
      sp.draw(ctx,sx-4,sy-4,this.animT,this.facing<0,1,1,frame);

      if(this.invulnT>0){
        ctx.globalAlpha=0.14; ctx.fillStyle="#fff";
        ctx.fillRect(sx-2,sy-2,20,34);
        ctx.globalAlpha=1;
      }
    }
  }

  /*************************
   * Friend Companion
   *************************/
  class Companion extends Entity {
    constructor(player){
      super(player.x, player.y, 10, 10);
      this.p=player;
      this.animT=rand(0,10);
      this.orbit=rand(0,6.28);
      this.cool=0.15;
    }
    update(dt,g){
      this.animT+=dt;
      this.cool=Math.max(0,this.cool-dt);

      this.orbit += dt*(2.0 + (this.p.friendBoostT>0?2.5:0));
      const ox = Math.cos(this.orbit)*18;
      const oy = -18 + Math.sin(this.orbit*1.3)*8;
      this.x = this.p.x + ox;
      this.y = this.p.y + oy;

      // shoot nearest enemy
      if(this.cool<=0){
        const target = g.findNearestEnemy(this.x,this.y, 220);
        if(target){
          const [nx,ny]=norm(target.cx-this.x, target.cy-this.y);
          const sp=520;
          const dmg= (this.p.friendBoostT>0)?7:5;
          g.bullets.push(new Bullet(this.x,this.y, nx*sp, ny*sp, dmg, 0, "friend"));
          this.cool = (this.p.friendBoostT>0)?0.09:0.15;
          AudioSys.ping("shoot",0.35);
        }
      }
    }
    draw(ctx,g){
      const cam=g.world.cam;
      const sx=(this.x-cam.x)|0, sy=(this.y-cam.y)|0;
      const img=assets.get("friend");
      const sp=new Sprite(img,20,20,6,12);
      sp.draw(ctx,sx-5,sy-5,this.animT,false,1,1,null);
      ctx.globalAlpha=0.10;
      ctx.fillStyle=PAL.accent;
      ctx.fillRect(sx-10,sy-10,28,28);
      ctx.globalAlpha=1;
    }
  }

  /*************************
   * Enemies
   *************************/
  const ENEMY_DEF = {
    ANGEL:  {key:"angel",  fw:28,fh:28,frames:6,fps:12, w:18,h:18, hp:18, speed:90,  touch:6,  behavior:"fly"},
    FIEND:  {key:"fiend",  fw:32,fh:32,frames:6,fps:12, w:20,h:20, hp:38, speed:70,  touch:11, behavior:"stalker"},
    GOLEM:  {key:"golem",  fw:36,fh:36,frames:6,fps:8,  w:24,h:28, hp:95, speed:35,  touch:14, behavior:"tank"},
    CRAZY:  {key:"crazy",  fw:24,fh:34,frames:6,fps:14, w:14,h:28, hp:18, speed:145, touch:5,  behavior:"dash"},
    WAILER: {key:"wailer", fw:32,fh:32,frames:6,fps:10, w:18,h:18, hp:28, speed:65,  touch:4,  behavior:"aura"},
  };

  class Enemy extends Entity {
    constructor(x,y,type="ANGEL"){
      const d=ENEMY_DEF[type]||ENEMY_DEF.ANGEL;
      super(x,y,d.w,d.h);
      this.type=type;
      this.def=d;
      this.hp=d.hp;
      this.cool=rand(0.2,0.9);
      this.animT=rand(0,10);
      this.stateT=0;
      this.auraT=0;
    }
    hit(dmg,g){
      this.hp-=dmg;
      // gore on hit
      for(let i=0;i<6;i++) g.fx(this.cx,this.cy,"blood",1);
      if(chance(0.25)) g.fx(this.cx,this.cy,"gib",1);
      AudioSys.ping("hit",0.5);

      if(this.hp<=0){
        this.dead=true;
        // death gore burst (still pixel/abstract)
        for(let i=0;i<22;i++) g.fx(this.cx,this.cy,"blood",1);
        for(let i=0;i<10;i++) g.fx(this.cx,this.cy,"gib",1);
        g.addDecal(this.cx, g.world.groundY-1, "blood");
        g.player.killCount++;

        // small sustain to keep the game winnable
        if(chance(0.25)) g.player.soothe(3);
        if(chance(0.18)) g.player.heal(2);

        // rare friend unlock drop
        if(!g.player.hasFriend && chance(0.02)) g.spawnPickup(this.cx,this.cy,"FRIEND");
      }
    }
    update(dt,g){
      this.animT+=dt;
      this.cool=Math.max(0,this.cool-dt);

      const p=g.player;
      const dx=p.cx-this.cx;
      const dy=p.cy-this.cy;

      const beh=this.def.behavior;

      if(beh==="fly"){
        const [nx,ny]=norm(dx, dy + Math.sin(g.time*2 + this.x*0.01)*10);
        this.vx=nx*this.def.speed;
        this.vy=ny*this.def.speed;
        this.x+=this.vx*dt;
        this.y+=this.vy*dt;
        this.y=Math.min(this.y, g.world.groundY-40);
      }

      if(beh==="stalker"){
        // fiend: stalk then leap
        this.stateT -= dt;
        if(this.stateT<=0){
          this.stateT = rand(0.6, 1.3);
          // occasional pounce
          if(chance(0.35) && this.cool<=0){
            const [nx,ny]=norm(dx, dy-20);
            this.vx = nx*(170+g.tension.heat*60);
            this.vy = -rand(210, 300);
            this.cool = 1.0;
          } else {
            this.vx = Math.sign(dx) * (this.def.speed + g.tension.heat*30);
          }
        }
        this.vy += g.world.gravity*dt;
        this.x += this.vx*dt;
        this.y += this.vy*dt;
        g.world.collide(this);
      }

      if(beh==="tank"){
        // golem: slow + heavy
        this.vx = Math.sign(dx) * (this.def.speed + g.tension.heat*15);
        this.vy += g.world.gravity*dt;
        this.x += this.vx*dt;
        this.y += this.vy*dt;
        g.world.collide(this);
        if(this.grounded && chance(0.01) && this.cool<=0){
          this.vy=-rand(160,220);
          this.cool=1.2;
        }
      }

      if(beh==="dash"){
        // crazy: bursts
        this.stateT -= dt;
        if(this.stateT<=0){
          this.stateT = rand(0.25, 0.55);
          this.vx = Math.sign(dx) * (this.def.speed + rand(0,60));
          if(chance(0.12) && this.cool<=0){ this.vy=-rand(260,320); this.cool=0.8; }
        }
        this.vy += g.world.gravity*dt;
        this.x += this.vx*dt;
        this.y += this.vy*dt;
        g.world.collide(this);
      }

      if(beh==="aura"){
        // grief wailer: floats, applies slow+grief if close
        const [nx,ny]=norm(dx, dy);
        this.vx = nx*this.def.speed;
        this.vy = ny*(this.def.speed*0.7) + Math.sin(g.time*3+this.x*0.01)*18;
        this.x += this.vx*dt;
        this.y += this.vy*dt;
        this.y = clamp(this.y, 40, g.world.groundY-60);

        const dist = Math.hypot(dx,dy);
        if(dist < 110){
          p.status.slowT = Math.max(p.status.slowT, 0.9);
          p.status.griefT = Math.max(p.status.griefT, 1.1);
          // subtle sanity jab
          if(chance(0.06)) p.san = clamp(p.san - 0.5, 0, p.sanMax);
          if(chance(0.03)) g.whisper("GRIEF MAKES YOUR LIMBS HEAVY.", 1.2);
        }
      }

      // contact damage (i-frames prevent blender)
      if(aabb(this.x,this.y,this.w,this.h, p.x,p.y,p.w,p.h) && this.cool<=0){
        p.hurt(this.def.touch, this.cx);
        this.cool = 0.95;
        for(let i=0;i<8;i++) g.fx(p.cx,p.cy,"blood",1);
        AudioSys.ping("hit",0.7);
      }

      if(this.x < g.world.cam.x-240) this.dead=true;
    }
    draw(ctx,g){
      const cam=g.world.cam;
      const sx=(this.x-cam.x)|0, sy=(this.y-cam.y)|0;
      const img=assets.get(this.def.key);
      const sp=new Sprite(img,this.def.fw,this.def.fh,this.def.frames,this.def.fps);
      sp.draw(ctx, sx-((this.def.fw-this.w)/2)|0, sy-((this.def.fh-this.h)/2)|0, this.animT, this.vx<0, 1, 1, null);

      // aura overlay for wailer
      if(this.type==="WAILER"){
        ctx.globalAlpha=0.10;
        ctx.fillStyle=PAL.accent;
        ctx.fillRect(sx-16,sy-16,44,44);
        ctx.globalAlpha=1;
      }
    }
  }

  /*************************
   * Patient 07 (Daughter)
   *************************/
  class Patient07 extends Entity {
    constructor(x){
      super(x,0,14,24);
      this.animT=rand(0,10);
      this.vx=rand(-35,35);
      this.timer=rand(0.8,2.0);
      this.state="wander";
      this.cowerT=0;
      this.saved=false;
    }
    update(dt,g){
      this.animT+=dt;
      this.timer-=dt;

      if(this.saved){
        // follow slightly once saved
        const p=g.player;
        const dx=p.cx-this.cx;
        this.vx = clamp(dx*0.9, -75, 75);
      } else if(this.state==="cower"){
        this.vx=0;
        this.cowerT-=dt;
        if(this.cowerT<=0) this.state="wander";
      } else {
        if(this.timer<=0){
          this.vx=rand(-40,40);
          this.timer=rand(1.0,2.3);
        }
        for(const b of g.bullets){
          if(Math.hypot(b.x-this.x,b.y-this.y)<80){
            this.state="cower"; this.cowerT=1.2; break;
          }
        }
      }

      this.vy += g.world.gravity*dt;
      this.x += this.vx*dt;
      this.y += this.vy*dt;
      g.world.collide(this);

      const left=g.world.cam.x+12;
      const right=g.world.cam.x+RW-32;
      if(this.x<left) this.vx=Math.abs(this.vx)+6;
      if(this.x>right) this.vx=-Math.abs(this.vx)-6;

      // touching saves (mission)
      if(!this.saved && aabb(this.x,this.y,this.w,this.h, g.player.x,g.player.y,g.player.w,g.player.h)){
        if(g.mission && g.mission.id==="SAVE_CHILD"){
          this.saved=true;
          g.whisper("YOU TOUCHED PATIENT 07. THE WARD HATES THAT.", 2.4);
          AudioSys.ping("thump",1.0);
          g.mission.complete(g, "Patient 07 is alive. You didn’t have to be good. You chose it.");
        }
      }
    }
    draw(ctx,g){
      const cam=g.world.cam;
      const sx=(this.x-cam.x)|0, sy=(this.y-cam.y)|0;
      const img=assets.get("child");
      const sp=new Sprite(img,22,30,4,6);
      sp.draw(ctx,sx-4,sy-6,this.animT,false,1,1,null);

      ctx.globalAlpha=0.12;
      ctx.fillStyle=PAL.sick;
      ctx.fillRect(sx-10,sy-12,34,40);
      ctx.globalAlpha=1;

      if(!this.saved && g.mission && g.mission.id==="SAVE_CHILD"){
        ctx.globalAlpha=0.9;
        ctx.fillStyle=PAL.paper;
        ctx.font="10px ui-monospace, monospace";
        ctx.fillText("TOUCH", sx-6, sy-14);
        ctx.globalAlpha=1;
      }
    }
  }

  /*************************
   * Pickups (hp/sanity/substances/friend)
   *************************/
  class Pickup extends Entity {
    constructor(x,y,kind){
      super(x,y,10,10);
      this.kind=kind; // HP | SAN | WIGGLE | MEMORY | FRIEND
      this.bob=rand(0,6.28);
    }
    update(dt,g){
      this.bob += dt*2.2;
      this.y = g.world.groundY - 16 + Math.sin(this.bob)*2;
      if(aabb(this.x,this.y,this.w,this.h, g.player.x,g.player.y,g.player.w,g.player.h)){
        this.dead=true;
        if(this.kind==="HP"){ g.player.heal(28); g.whisper("FLESH CLOSES.", 1.3); }
        if(this.kind==="SAN"){ g.player.soothe(34); g.whisper("LIGHT RETURNS (WRONG).", 1.3); }
        if(this.kind==="WIGGLE"){ g.player.applySubstance("WIGGLE",g); }
        if(this.kind==="MEMORY"){ g.player.applySubstance("MEMORY",g); }
        if(this.kind==="FRIEND"){ g.player.applySubstance("FRIEND",g); }
        AudioSys.ping("thump",0.7);
      }
    }
    draw(ctx,g){
      const cam=g.world.cam;
      const sx=(this.x-cam.x)|0, sy=(this.y-cam.y)|0;
      ctx.globalAlpha=0.9;
      if(this.kind==="HP"){ ctx.fillStyle=PAL.danger; ctx.fillRect(sx,sy,10,10); }
      else if(this.kind==="SAN"){ ctx.fillStyle=PAL.accent; ctx.fillRect(sx,sy,10,10); }
      else if(this.kind==="WIGGLE"){ ctx.fillStyle=PAL.slime; ctx.fillRect(sx,sy,10,10); }
      else if(this.kind==="MEMORY"){ ctx.fillStyle=PAL.paper; ctx.fillRect(sx,sy,10,10); }
      else { ctx.fillStyle="#ffd36a"; ctx.fillRect(sx,sy,10,10); }
      ctx.globalAlpha=1;
      ctx.font="9px ui-monospace, monospace";
      ctx.fillStyle="#000";
      ctx.fillText(this.kind[0], sx+3, sy+8);
    }
  }

  /*************************
   * Missions
   *************************/
  class Mission {
    constructor(id, name){
      this.id=id;
      this.name=name;
      this.done=false;
      this.fail=false;
      this.timer=0;
      this.goalDepth=0;
      this.text="";
      this._winText="";
    }
    start(g){
      if(this.id==="SURVIVE_120"){
        this.timer=120.0;
        this.text="Survive 2:00";
        // start frenetic immediately
        g.tension.mode="frenetic";
        g.whisper("MISSION: SURVIVE. THE WARD WANTS FOOTAGE.", 2.0);
      }
      if(this.id==="SAVE_CHILD"){
        this.text="Save Patient 07 (Touch)";
        g.whisper("MISSION: FIND HER. TOUCH HER. DON'T PANIC.", 2.0);
      }
      if(this.id==="REACH_CHAPEL"){
        this.goalDepth=1000;
        this.text="Reach the Chapel (1000m)";
        g.whisper("MISSION: WALK UNTIL THE WARD RUNS OUT OF ROOMS.", 2.0);
      }
    }
    update(dt,g){
      if(this.done||this.fail) return;

      if(this.id==="SURVIVE_120"){
        this.timer=Math.max(0,this.timer-dt);
        if(this.timer<=0){
          this.complete(g, "You endured 2:00. The ward applauds with wet hands.");
        }
      }
      if(this.id==="REACH_CHAPEL"){
        const d=Math.floor(g.player.x/10);
        if(d>=this.goalDepth){
          this.complete(g, "You reached the Chapel. Something inside you believes it matters.");
        }
      }
    }
    complete(g, winText){
      if(this.done) return;
      this.done=true;
      this._winText=winText;
      g.win(winText);
    }
  }

  /*************************
   * Tension
   *************************/
  class Tension {
    constructor(){
      this.mode="atmosphere";
      this.heat=0;
      this.spawnT=0;
      this.depth=0;
      this.bossIndex=0;
    }
    update(dt,g){
      this.depth=Math.floor(g.player.x/10);
      const target=(this.mode==="frenetic"||this.mode==="boss")?1:0;
      this.heat=lerp(this.heat,target,1-Math.pow(0.0009,dt));

      if(this.mode==="atmosphere"){
        // trigger frenetic after threshold OR if mission is survive
        if(g.player.x>g.world.thresholdX || (g.mission && g.mission.id==="SURVIVE_120")){
          this.mode="frenetic";
          this.spawnT=0.35;
          g.whisper("THE ASYLUM REMEMBERS YOU.",2.0);
          AudioSys.ping("thump",1.0);
        }
      }

      // Bosses only on chapel-run (optional intensity)
      const bossAllowed = (g.mission && g.mission.id==="REACH_CHAPEL");
      if(bossAllowed && !g.boss && this.mode!=="boss"){
        const wantBoss =
          (this.bossIndex===0 && this.depth>260) ||
          (this.bossIndex===1 && this.depth>620);
        if(wantBoss){
          this.mode="boss";
          g.startBoss(this.bossIndex);
          this.bossIndex++;
          return;
        }
      }

      if(this.mode==="frenetic" && !g.boss){
        this.spawnT -= dt;
        if(this.spawnT<=0){
          const diff=g.difficulty();
          this.spawnT = rand(diff.spawnEvery*0.75, diff.spawnEvery*1.25);
          g.spawnWave();
        }
      }
    }
  }

  /*************************
   * Visual FX (wiggle + memory past echoes)
   *************************/
  class VisualFX {
    constructor(){
      this.noise=0.18;
      this.scan=0.12;
      this.vign=0.55;
      this.allowFaces=true;

      this.faceFlashT=0;
      this.faceAlpha=0;
      this.faceKey="face1";
      this.glitchKick=0;

      // “past echoes”
      this.echoT=0;
      this.echo = []; // {img:canvas, a, x,y, life}
      this.echoBuf=document.createElement("canvas");
      this.echoBuf.width=RW; this.echoBuf.height=RH;
      this.echoCtx=this.echoBuf.getContext("2d",{alpha:true});
      this.echoCtx.imageSmoothingEnabled=false;
    }

    update(dt,g){
      const sanity=g.player?(g.player.san/g.player.sanMax):1;
      const heat=g.tension.heat;
      const stress=clamp((1-sanity)*0.95 + heat*0.65 + (g.boss?0.35:0),0,1);
      const zoneNoise=g.atmo?g.atmo.noiseMult:1.0;

      this.noise = lerp(this.noise, (0.10+stress*0.65)*zoneNoise, 1-Math.pow(0.001,dt));
      this.scan  = lerp(this.scan,  0.06+stress*0.33, 1-Math.pow(0.001,dt));
      this.vign  = lerp(this.vign,  0.30+stress*0.72, 1-Math.pow(0.001,dt));

      // face flash
      if(this.allowFaces && g.player.status.memoryT>0){
        const pEvent = 0.004 + (1-sanity)*0.012 + heat*0.006;
        if(chance(pEvent*dt*60)){
          this.faceFlashT = rand(0.6, 1.4);
          this.faceAlpha = rand(0.16, 0.34);
          this.faceKey = chance(0.5)?"face1":"face2";
          this.glitchKick = 0.25;
        }
      }

      this.faceFlashT=Math.max(0,this.faceFlashT-dt);
      if(this.faceFlashT<=0) this.faceAlpha=lerp(this.faceAlpha,0,1-Math.pow(0.0001,dt));
      this.glitchKick=Math.max(0,this.glitchKick-dt);

      // past echoes: periodically capture buffer
      if(g.player.status.memoryT>0){
        this.echoT -= dt;
        if(this.echoT<=0){
          this.echoT = rand(0.35, 0.75);
          // snapshot current low-res buffer into a small ghost canvas
          const c=document.createElement("canvas");
          c.width=RW; c.height=RH;
          const x=c.getContext("2d",{alpha:true});
          x.imageSmoothingEnabled=false;
          x.globalAlpha=0.7;
          x.drawImage(buf,0,0);
          x.globalAlpha=0.6;
          x.fillStyle=PAL.accent;
          x.fillRect(randi(0,RW-40), randi(0,RH-30), randi(10,40), randi(2,8));
          x.globalAlpha=1;

          this.echo.push({img:c, x:randi(-8,8), y:randi(-8,8), a:rand(0.08,0.18), life:rand(0.6,1.2)});
        }
      } else {
        this.echoT=0;
      }

      // decay echoes
      for(const e of this.echo) e.life -= dt;
      this.echo = this.echo.filter(e=>e.life>0);
    }

    post(ctx,g){
      const w=ctx.canvas.width, h=ctx.canvas.height;

      // wiggle distortion (scanline slice shift) while wiggle serum active
      const wig = g.player.status.wiggleT;
      if(wig>0){
        const temp=this.echoBuf;
        const tx=this.echoCtx;
        tx.clearRect(0,0,RW,RH);
        tx.drawImage(ctx.canvas,0,0);

        ctx.clearRect(0,0,RW,RH);
        const strength = 2 + (wig/10)*6;
        for(let y=0;y<h;y+=2){
          const off = Math.sin((g.time*8)+(y*0.12)) * strength;
          ctx.drawImage(temp, 0,y,w,2, (off|0),y,w,2);
        }
      }

      // echoes
      if(this.echo.length){
        ctx.save();
        ctx.globalCompositeOperation="screen";
        for(const e of this.echo){
          ctx.globalAlpha=e.a*(e.life);
          ctx.drawImage(e.img, e.x, e.y);
        }
        ctx.restore();
      }

      // glitch kick
      if(this.glitchKick>0){
        const k=this.glitchKick;
        const dx=(Math.sin(g.time*40)*2)*k;
        const dy=(Math.cos(g.time*27)*1)*k;
        ctx.globalAlpha=0.7;
        ctx.drawImage(ctx.canvas, dx, dy);
        ctx.globalAlpha=1;
      }

      // scanlines
      ctx.globalAlpha=this.scan;
      ctx.fillStyle="#000";
      for(let y=0;y<h;y+=2) ctx.fillRect(0,y,w,1);
      ctx.globalAlpha=1;

      // noise
      const dotsN=Math.floor(w*h*(0.008 + this.noise*0.055));
      ctx.globalAlpha=0.10 + this.noise*0.22;
      ctx.fillStyle="#fff";
      for(let i=0;i<dotsN;i++) ctx.fillRect((Math.random()*w)|0,(Math.random()*h)|0,1,1);
      ctx.globalAlpha=1;

      // vignette
      ctx.globalAlpha=0.10+this.vign*0.18;
      ctx.fillStyle="#000";
      const b=10;
      ctx.fillRect(0,0,w,b); ctx.fillRect(0,h-b,w,b);
      ctx.fillRect(0,0,b,h); ctx.fillRect(w-b,0,b,h);
      ctx.globalAlpha=1;

      // sanity wash
      const sanity=g.player?(g.player.san/g.player.sanMax):1;
      const wash=clamp(1-sanity,0,1);
      if(wash>0.02){
        ctx.globalAlpha=wash*0.10;
        ctx.fillStyle=PAL.accent;
        ctx.fillRect(0,0,w,h);
        ctx.globalAlpha=1;
      }

      // grief tint
      if(g.player.status.griefT>0){
        ctx.globalAlpha=0.12;
        ctx.fillStyle=PAL.rust;
        ctx.fillRect(0,0,w,h);
        ctx.globalAlpha=1;
      }

      // face overlay
      if(this.faceAlpha>0.01){
        const img=assets.get(this.faceKey);
        ctx.save();
        ctx.globalAlpha=this.faceAlpha;
        if(img){
          const ox=(Math.sin(g.time*2)*6)|0;
          const oy=(Math.cos(g.time*1.7)*5)|0;
          ctx.globalCompositeOperation="screen";
          ctx.drawImage(img, -12+ox, -12+oy, w+24, h+24);
          ctx.globalCompositeOperation="source-over";
        }
        ctx.restore();
      }
    }
  }

  /*************************
   * Bosses (kept minimal)
   *************************/
  class BossBase extends Entity {
    constructor(x,y,w,h){
      super(x,y,w,h);
      this.maxHp=500; this.hp=500;
      this.phase=0;
      this.cool=0.8;
      this.animT=0;
      this.name="BOSS";
      this.dead=false;
    }
    hit(dmg,g){
      this.hp-=dmg;
      for(let i=0;i<10;i++) g.fx(this.cx,this.cy,"blood",1);
      if(this.hp<=0){
        this.dead=true;
        for(let i=0;i<60;i++) g.fx(this.cx,this.cy, chance(0.6)?"blood":"gib",1);
        g.addDecal(this.cx, g.world.groundY-1, "blood");
      }
    }
  }

  class BossClinician extends BossBase {
    constructor(x,g){
      super(x,g.world.groundY-72,38,72);
      this.name="SERAPH-CLINICIAN";
      this.maxHp=520; this.hp=520;
      this.lines=[];
    }
    update(dt,g){
      this.animT+=dt;
      this.cool=Math.max(0,this.cool-dt);
      const dx=g.player.cx-this.cx;
      this.vx=Math.sign(dx)*(35+g.tension.heat*18);

      this.vy+=g.world.gravity*dt;
      this.x+=this.vx*dt;
      this.y+=this.vy*dt;
      g.world.collide(this);

      this.phase = (this.hp < this.maxHp*0.55) ? 1 : 0;

      if(this.cool<=0){
        this.cool = this.phase ? 1.25 : 1.65;
        const x0=this.cx, y0=this.y+18;
        const x1=g.player.cx+rand(-30,30);
        const y1=g.player.cy+rand(-14,14);
        this.lines.push({x0,y0,x1,y1,t:this.phase?1.05:0.90});
        AudioSys.ping("hit",0.7);

        if(this.phase && chance(0.45)){
          g.spawnBossBurst(this.cx,this.cy,g.player.cx,g.player.cy,3,0.14,250,7);
        }
      }
      for(const L of this.lines) L.t-=dt;
      this.lines=this.lines.filter(L=>L.t>0);
    }
    draw(ctx,g){
      const cam=g.world.cam;
      const sx=(this.x-cam.x)|0, sy=(this.y-cam.y)|0;
      const img=assets.get("boss1");
      const sp=new Sprite(img,64,64,6,6);
      sp.draw(ctx,sx-14,sy-10,this.animT,false,1,1,null);

      ctx.globalAlpha=0.85;
      ctx.strokeStyle=PAL.accent;
      for(const L of this.lines){
        ctx.beginPath();
        ctx.moveTo((L.x0-cam.x)|0,(L.y0-cam.y)|0);
        ctx.lineTo((L.x1-cam.x)|0,(L.y1-cam.y)|0);
        ctx.stroke();
      }
      ctx.globalAlpha=1;
    }
  }

  class BossChoir extends BossBase {
    constructor(x,g){
      super(x,g.world.groundY-120,54,44);
      this.name="CHOIR-ENGINE";
      this.maxHp=450; this.hp=450;
      this.wob=rand(0,6.28);
    }
    update(dt,g){
      this.animT+=dt;
      this.cool=Math.max(0,this.cool-dt);

      const dx=g.player.cx-this.cx;
      this.x+=Math.sign(dx)*(60+g.tension.heat*30)*dt;
      this.y=(g.world.groundY-120)+Math.sin(g.time*2+this.wob)*12;

      this.phase=(this.hp<this.maxHp*0.55)?1:0;

      if(this.cool<=0){
        this.cool=this.phase?0.65:0.95;
        const mx=Input.mouse.nx*RW + g.world.cam.x;
        const my=Input.mouse.ny*RH;
        g.spawnBossBurst(this.cx,this.cy,mx,my,this.phase?4:3,this.phase?0.11:0.14,270,7);
        if(this.phase && chance(0.35)){
          g.enemies.push(new Enemy(g.world.cam.x+RW+40, g.world.groundY-randi(70,120), "ANGEL"));
        }
        AudioSys.ping("hit",0.6);
      }
    }
    draw(ctx,g){
      const cam=g.world.cam;
      const sx=(this.x-cam.x)|0, sy=(this.y-cam.y)|0;
      const img=assets.get("boss2");
      const sp=new Sprite(img,72,56,6,7);
      sp.draw(ctx,sx-14,sy-10,this.animT,false,1,1,null);
    }
  }

  /*************************
   * Game
   *************************/
  class Game {
    constructor(){
      this.state="menu";
      this.world=new World();
      this.atmo=new AtmosphereManager();
      this.tension=new Tension();
      this.fx=new VisualFX();

      this.player=null;
      this.friend=null;

      this.enemies=[];
      this.bullets=[];
      this.bossBullets=[];
      this.particles=[];
      this.decals=[];

      this.props=this.world.props; // alias
      this.pickups=[];
      this.child=null;

      this.boss=null;

      this.time=0;
      this.lastWhisper={text:"", t:0};
      this._hint="";

      this.flags = { metDilemma:false };

      this.mission=null;
      this._missionText="";
    }

    whisper(text,t=2.0){ this.lastWhisper.text=text; this.lastWhisper.t=t; }

    fxSpawn(x,y,kind,n=1){
      for(let i=0;i<n;i++){
        this.particles.push(new Particle(x,y,kind));
      }
      if(this.particles.length>800) this.particles.splice(0,this.particles.length-800);
    }
    fx(x, y, kind, n = 1) {
      this.fxSpawn(x, y, kind, n);
    }
     
    addDecal(x,y,type){
      this.decals.push(new Decal(x,y,type));
      if(this.decals.length>220) this.decals.splice(0,this.decals.length-220);
    }

    difficulty(){
      const d=Math.floor(this.player.x/10);
      const stage=clamp(d/650,0,1);
      const struggling = (this.player.hp/this.player.hpMax)<0.35 || (this.player.san/this.player.sanMax)<0.30;
      const assist = struggling?0.22:0;
      return {
        stage,
        spawnEvery: lerp(1.10,0.62,stage)+assist,
        maxEnemies: Math.floor(5+stage*5), // 5..10
        eliteChance: lerp(0.10,0.28,stage),
      };
    }

    startRun(name, avi, settings, missionId){
      this.state="play";
      this.time=0;

      this.world.reset();
      this.atmo=new AtmosphereManager();
      this.tension=new Tension();
      this.fx=new VisualFX();
      this.fx.allowFaces=!!settings.allowFaces;

      this.enemies.length=0;
      this.bullets.length=0;
      this.bossBullets.length=0;
      this.particles.length=0;
      this.decals.length=0;
      this.pickups.length=0;

      this.player=new Player(name,avi);
      this.friend=null;

      Input.confusionEnabled=!!settings.allowConfusion;
      Input.confusionT=0;

      AudioSys.setHard(!!settings.hardAudio);

      // mission
      const missionName =
        missionId==="SURVIVE_120" ? "Survive 2:00" :
        missionId==="SAVE_CHILD" ? "Save Patient 07" :
        "Reach the Chapel";
      this.mission=new Mission(missionId, missionName);
      this.mission.start(this);

      // spawn child depending mission
      this.child=null;
      if(missionId==="SAVE_CHILD"){
        // spawn her early, but slightly ahead
        this.child = new Patient07(this.world.cam.x + RW + 120);
        this.whisper("SHE IS SOMEWHERE IN THE WARD.", 2.0);
      } else {
        // she may appear later as anxiety
        this.child=null;
      }

      // start in “vibrant ward” quicker
      this.world.thresholdX = 700;

      this.flags.metDilemma=false;

      this.whisper(`WELCOME, ${name}. THE WARD KNOWS YOU.`, 2.2);
    }

    spawnPickup(x,y,kind){
      this.pickups.push(new Pickup(x,y,kind));
    }

    spawnWave(){
      const diff=this.difficulty();
      if(this.enemies.length>=diff.maxEnemies) return;

      const room = diff.maxEnemies - this.enemies.length;
      const count = Math.min(room, randi(1, 2 + Math.floor(diff.stage*1.6)));

      for(let i=0;i<count;i++){
        const x=this.world.cam.x + RW + randi(20,80);
        const baseY=this.world.groundY-40;

        let type="ANGEL";
        const elite = chance(diff.eliteChance);
        if(elite){
          // weighted variety
          const r=Math.random();
          if(r<0.35) type="FIEND";
          else if(r<0.60) type="CRAZY";
          else if(r<0.82) type="WAILER";
          else type="GOLEM";
        } else {
          // common: angels + crazies
          type = chance(0.65) ? "ANGEL" : "CRAZY";
        }

        const y = (type==="ANGEL"||type==="WAILER") ? (this.world.groundY - randi(70,130)) : (baseY);
        this.enemies.push(new Enemy(x,y,type));
      }

      // occasional helpful drops to keep winnable
      if(chance(0.10)) this.spawnPickup(this.world.cam.x+RW-randi(30,70), this.world.groundY-16, chance(0.5)?"HP":"SAN");
    }

    findNearestEnemy(x,y,rad){
      let best=null, bd=rad;
      for(const e of this.enemies){
        const d=Math.hypot(e.cx-x, e.cy-y);
        if(d<bd){ bd=d; best=e; }
      }
      if(this.boss && !this.boss.dead){
        const d=Math.hypot(this.boss.cx-x, this.boss.cy-y);
        if(d<bd){ bd=d; best=this.boss; }
      }
      return best;
    }

    fireWeapon(player, ax, ay){
      const wpn=player.weapon;

      if(wpn.type==="melee"){
        const range=34;
        const px=player.cx+player.facing*12;
        const py=player.cy;
        for(const e of this.enemies){
          if(!e.dead && Math.hypot(e.cx-px,e.cy-py)<range) e.hit(wpn.dmg,this);
        }
        if(this.boss && !this.boss.dead && Math.hypot(this.boss.cx-px,this.boss.cy-py)<range+18) this.boss.hit(wpn.dmg,this);
        this.fxSpawn(px,py,"spark",12);
        AudioSys.ping("thump",0.6);
        player.san=clamp(player.san-0.2,0,player.sanMax);
        return;
      }

      // gun
      const ox=player.x+(player.facing>0?player.w:0);
      const oy=player.y+14;
      const baseAng=Math.atan2(ay-oy, ax-ox);
      const sp=620;

      const bullets=wpn.bullets||1;
      const spread=wpn.spread||0;
      for(let i=0;i<bullets;i++){
        const ang=baseAng+rand(-spread,spread);
        const vx=Math.cos(ang)*sp;
        const vy=Math.sin(ang)*sp;
        this.bullets.push(new Bullet(ox,oy,vx,vy,wpn.dmg, wpn.pierce||0, "player"));
      }

      player.san=clamp(player.san-(wpn.sanityCost||0.35),0,player.sanMax);
      AudioSys.ping("shoot",0.7);
    }

    fireLaser(player, ax, ay, dt){
      // beam: hits first obstacle and enemies along ray (limited)
      const ox=player.x+(player.facing>0?player.w:0);
      const oy=player.y+14;
      const ang=Math.atan2(ay-oy, ax-ox);
      const dx=Math.cos(ang), dy=Math.sin(ang);

      const maxLen=320;
      let hitLen=maxLen;

      // stop at obstacle
      const step=6;
      for(let t=0;t<maxLen;t+=step){
        const px=ox+dx*t, py=oy+dy*t;
        if(py>this.world.groundY){ hitLen=t; break; }
        let blocked=false;
        for(const o of this.world.obstacles){
          if(aabb(px,py,2,2,o.x,o.y,o.w,o.h)){ blocked=true; break; }
        }
        if(blocked){ hitLen=t; break; }
      }

      // damage enemies near beam
      const dmgPerSec = player.weapon.dmg;
      const dmg = dmgPerSec * dt;

      const beamRadius=7;
      for(const e of this.enemies){
        if(e.dead) continue;
        // distance point-line approx by sampling along beam
        const ex=e.cx, ey=e.cy;
        // project onto ray
        const vx=ex-ox, vy=ey-oy;
        const proj=vx*dx+vy*dy;
        if(proj<0||proj>hitLen) continue;
        const px=ox+dx*proj, py=oy+dy*proj;
        const dist=Math.hypot(ex-px, ey-py);
        if(dist<beamRadius){
          e.hit(dmg*1.25, this);
        }
      }
      if(this.boss && !this.boss.dead){
        const ex=this.boss.cx, ey=this.boss.cy;
        const vx=ex-ox, vy=ey-oy;
        const proj=vx*dx+vy*dy;
        if(proj>0 && proj<hitLen){
          const px=ox+dx*proj, py=oy+dy*proj;
          const dist=Math.hypot(ex-px, ey-py);
          if(dist<beamRadius+10){
            this.boss.hit(dmg*1.05, this);
          }
        }
      }

      // sanity cost per second
      const cost = (player.weapon.sanityCostPerSec||8.5)*dt;
      player.san=clamp(player.san-cost,0,player.sanMax);

      // beam FX
      this._laser = {x0:ox,y0:oy,x1:ox+dx*hitLen,y1:oy+dy*hitLen, t:0.05};
      if(chance(0.2)) AudioSys.ping("laser",0.35);
      this.fxSpawn(ox+dx*(hitLen*0.7), oy+dy*(hitLen*0.7), "spark", 2);
      this.fxSpawn(ox+dx*(hitLen*0.9), oy+dy*(hitLen*0.9), "spark", 2);
    }

    spawnBossBurst(x0,y0,x1,y1,count,spread,speed,dmg){
      const base=Math.atan2(y1-y0,x1-x0);
      for(let i=0;i<count;i++){
        const ang=base+rand(-spread,spread);
        const vx=Math.cos(ang)*speed;
        const vy=Math.sin(ang)*speed;
        const b=new Bullet(x0,y0,vx,vy,dmg,0,"boss");
        b.w=5; b.h=5;
        this.bossBullets.push(b);
      }
    }

    startBoss(index){
      this.bullets.length=0;
      this.bossBullets.length=0;
      this.boss = index===0 ? new BossClinician(this.world.cam.x+RW+90,this) : new BossChoir(this.world.cam.x+RW+90,this);
      this.whisper(`${this.boss.name} ARRIVES.`,2.2);
      AudioSys.ping("hit",1.0);
    }

    moralDilemma(){
      if(this.flags.metDilemma) return;
      this.flags.metDilemma=true;

      const p=this.player;
      const name=p.name;
      const tone = (p.avi===1) ? "ritual" : (p.avi===2 ? "brutal" : "flat");

      const body =
        tone==="ritual"
          ? `${name}, the nurse offers a vial. She says it’s “memory.”\nHer hands shake like a metronome.\n\nDo you take it?`
          : tone==="brutal"
          ? `${name}, a patient blocks the hall with a bin.\nHe begs you to “make it quiet.”\n\nDo you help or push past?`
          : `${name}, a nurse stands still.\nShe offers a potion and refuses to blink.\n\nDo you drink it?`;

      SceneStack.push(new DialogueScene({
        title:"WARD ENCOUNTER",
        sub:"Moral pressure (it changes what happens later).",
        body,
        choices:[
          {label:"Take it.", hint:"Gain Memory Tincture; +Grief risk later", onPick:()=>{
            this.spawnPickup(p.x+40,p.y,"MEMORY");
            p.status.griefT = Math.max(p.status.griefT, 0.8);
            this.whisper("YOU ACCEPTED SOMETHING THAT ACCEPTS YOU BACK.",2.0);
          }},
          {label:"Refuse.", hint:"Small sanity gain; ward becomes angrier", onPick:()=>{
            p.soothe(10);
            this.whisper("YOU SAID NO. THE WARD TAKES IT AS A GAME.",2.0);
            // slightly more spawns for a while
            this.tension.spawnT = Math.min(this.tension.spawnT, 0.4);
          }},
          {label:"Steal the friend-contract.", hint:"Chance to unlock FRIEND", onPick:()=>{
            if(chance(0.55)){
              p.applySubstance("FRIEND", this);
            } else {
              p.status.slowT = Math.max(p.status.slowT, 1.2);
              this.whisper("IT SLIPS AWAY. YOUR LEGS FORGET TO OBEY.",2.0);
            }
          }},
        ]
      }));
    }

    update(dt){
      if(this.state!=="play") return;

      this.time += dt;
      if(this.lastWhisper.t>0) this.lastWhisper.t-=dt;
      Input.confusionT = Math.max(0, Input.confusionT-dt);

      // camera
      const targetX=this.player.x - RW*0.33;
      this.world.cam.x = lerp(this.world.cam.x, targetX, 1-Math.pow(0.00025,dt));
      this.world.cam.x = Math.max(0,this.world.cam.x);

      // zone + tension + mission
      this.atmo.update(dt,this);
      this.tension.update(dt,this);
      AudioSys.setIntensity(this.tension.heat, this.tension.mode);

      this.mission?.update(dt,this);

      // trigger dilemma once in WARD
      if(this.atmo.name==="WARD" && !this.flags.metDilemma && Math.floor(this.player.x/10)>210){
        if(chance(0.012)) this.moralDilemma();
      }

      // props update
      for(const pr of this.world.props) pr.update(dt,this);

      // player update
      this.player.update(dt,this);

      // friend companion
      if(this.player.hasFriend){
        if(!this.friend) this.friend=new Companion(this.player);
        this.friend.update(dt,this);
      } else {
        this.friend=null;
      }

      // child spawn logic if not save mission
      if(!this.child && (!this.mission || this.mission.id!=="SAVE_CHILD")){
        // appears occasionally after some depth in frenetic
        if(this.tension.mode==="frenetic" && Math.floor(this.player.x/10)>180 && chance(0.004)){
          this.child=new Patient07(this.world.cam.x+RW-randi(60,120));
          this.whisper("PATIENT 07 ENTERS THE HALL.", 2.0);
          AudioSys.ping("thump",0.9);
        }
      }
      if(this.child) this.child.update(dt,this);

      // spawns (also if survive mission)
      if(this.tension.mode==="frenetic" && !this.boss){
        // spawns handled by Tension, but give extra pulse in SURVIVE mission
        if(this.mission && this.mission.id==="SURVIVE_120" && chance(0.01)){
          if(this.enemies.length < this.difficulty().maxEnemies) this.spawnWave();
        }
      }

      // enemies
      for(const e of this.enemies) e.update(dt,this);
      this.enemies = this.enemies.filter(e=>!e.dead);

      // boss
      if(this.boss){
        this.boss.update(dt,this);
        if(this.boss.dead){
          this.boss=null;
          this.tension.mode="frenetic";
          this.whisper("THE ROOM EXHALES.",2.0);
          this.spawnPickup(this.world.cam.x+RW-60, this.world.groundY-16, "HP");
          this.spawnPickup(this.world.cam.x+RW-40, this.world.groundY-16, "SAN");
        }
      }

      // bullets
      for(const b of this.bullets) b.update(dt,this);
      for(const b of this.bossBullets) b.update(dt,this);
      this.bullets = this.bullets.filter(b=>!b.dead);
      this.bossBullets = this.bossBullets.filter(b=>!b.dead);

      // pickups
      for(const p of this.pickups) p.update(dt,this);
      this.pickups = this.pickups.filter(p=>!p.dead);

      // particles
      for(const p of this.particles) p.update(dt,this);
      this.particles = this.particles.filter(p=>p.life>0);

      // interactions (E)
      this._hint="";
      if(Input.interact()){
        // also: touching child is automatic in Patient07.update for mission, but E can “comfort” her when not saved
        if(this.child && aabb(this.child.x,this.child.y,this.child.w,this.child.h, this.player.x,this.player.y,this.player.w,this.player.h)){
          if(!this.child.saved){
            this.whisper("YOU FEEL HOW LIGHT SHE IS.", 1.6);
            this.player.soothe(6);
          }
        }
      }

      // resolve combat hits
      this.resolveCombat();

      // status label
      const st=[];
      if(Input.confusionEnabled && Input.confusionT>0) st.push("CONFUSION");
      if(this.player.status.slowT>0) st.push("SLOWED");
      if(this.player.status.griefT>0) st.push("GRIEF");
      if(this.player.status.wiggleT>0) st.push("WIGGLE");
      if(this.player.status.memoryT>0) st.push("MEMORY");
      if(this.player.hasFriend) st.push(this.player.friendBoostT>0?"FRIEND:BOOST":"FRIEND");
      this._statusText = st.join(" · ");

      // lose
      if(this.player.hp<=0) this.lose("PHYSICAL VESSEL DESTROYED\n\nThe ward keeps walking without you.");
      if(this.player.san<=0) this.lose("MIND FRACTURED\n\nThe fog learns your face and wears it.");
    }

    resolveCombat(){
      // bullets vs props + enemies + child + boss
      for(const b of this.bullets){
        if(b.dead) continue;

        // props
        for(const pr of this.world.props){
          if(pr.broken) continue;
          const box=pr.aabb();
          if(aabb(b.x,b.y,b.w,b.h, box.x,box.y,box.w,box.h)){
            b.dead=true;
            const drop=pr.hit(this,"bullet");
            if(drop==="WIGGLE") this.spawnPickup(pr.x,pr.y,"WIGGLE");
            if(drop==="MEMORY") this.spawnPickup(pr.x,pr.y,"MEMORY");
            this.fxSpawn(b.x,b.y,"spark",6);
            break;
          }
        }
        if(b.dead) continue;

        // child hit => bad ending always
        if(this.child && !this.child.saved && aabb(b.x,b.y,b.w,b.h, this.child.x,this.child.y,this.child.w,this.child.h)){
          b.dead=true;
          for(let i=0;i<40;i++) this.fxSpawn(this.child.cx,this.child.cy, chance(0.6)?"blood":"gib", 1);
          this.addDecal(this.child.cx, this.world.groundY-1, "blood");
          this.lose("YOU SHOT PATIENT 07.\n\nBad Ending:\nThe ward stops pretending it needs you.", true);
          return;
        }

        // enemies
        for(const e of this.enemies){
          if(e.dead) continue;
          if(aabb(b.x,b.y,b.w,b.h, e.x,e.y,e.w,e.h)){
            if(b.hit.has(e)) continue;
            b.hit.add(e);
            e.hit(b.dmg,this);
            if(b.pierce>0) b.pierce--;
            else b.dead=true;
            break;
          }
        }

        // boss
        if(this.boss && !this.boss.dead && aabb(b.x,b.y,b.w,b.h, this.boss.x,this.boss.y,this.boss.w,this.boss.h)){
          this.boss.hit(b.dmg,this);
          b.dead=true;
        }
      }

      // boss bullets
      for(const b of this.bossBullets){
        if(b.dead) continue;
        if(aabb(b.x,b.y,b.w,b.h, this.player.x,this.player.y,this.player.w,this.player.h)){
          b.dead=true;
          this.player.hurt(7, b.x);
          for(let i=0;i<10;i++) this.fxSpawn(this.player.cx,this.player.cy,"blood",1);
          AudioSys.ping("hit",0.9);
        }
        if(this.child && !this.child.saved && aabb(b.x,b.y,b.w,b.h, this.child.x,this.child.y,this.child.w,this.child.h)){
          b.dead=true;
          for(let i=0;i<40;i++) this.fxSpawn(this.child.cx,this.child.cy, chance(0.6)?"blood":"gib", 1);
          this.addDecal(this.child.cx, this.world.groundY-1, "blood");
          this.lose("THE SONG TOUCHED PATIENT 07.\n\nBad Ending:\nYou didn’t pull the trigger — the ward still blames you.", true);
          return;
        }
      }
    }

    lose(text, bad=false){
      this.state="end";
      UI.end.classList.remove("hidden");
      UI.endTitle.textContent = bad ? "BAD ENDING" : "SIGNAL LOST";
      UI.endBody.textContent = text;
      UI.hud.classList.add("hidden");
      AudioSys.setIntensity(bad?0.95:0.55,"boss");
      AudioSys.ping("hit",1.0);
    }

    win(text){
      this.state="end";
      UI.end.classList.remove("hidden");
      UI.endTitle.textContent = "RUN COMPLETE";
      UI.endBody.textContent = text;
      UI.hud.classList.add("hidden");
      AudioSys.setIntensity(0.35,"atmosphere");
      AudioSys.ping("thump",0.9);
    }

    draw(){
      const t=this.time;

      // world first
      this.world.draw(bctx,t,this.atmo,this.decals);

      // props
      for(const pr of this.world.props) pr.draw(bctx,this);

      // pickups
      for(const p of this.pickups) p.draw(bctx,this);

      // entities
      if(this.child) this.child.draw(bctx,this);
      for(const e of this.enemies) e.draw(bctx,this);
      if(this.boss) this.boss.draw(bctx,this);
      for(const b of this.bossBullets) b.draw(bctx,this.world.cam);
      for(const b of this.bullets) b.draw(bctx,this.world.cam);

      if(this.friend) this.friend.draw(bctx,this);
      if(this.player) this.player.draw(bctx,this);

      // particles
      for(const p of this.particles) p.draw(bctx,this.world.cam);

      // laser overlay
      if(this._laser && this._laser.t>0){
        this._laser.t -= 1/60;
        const cam=this.world.cam;
        bctx.globalAlpha=0.8;
        bctx.strokeStyle=PAL.potion;
        bctx.beginPath();
        bctx.moveTo((this._laser.x0-cam.x)|0,(this._laser.y0-cam.y)|0);
        bctx.lineTo((this._laser.x1-cam.x)|0,(this._laser.y1-cam.y)|0);
        bctx.stroke();
        bctx.globalAlpha=1;
      }

      // lighting + overlays
      this.drawLighting(bctx);
      this.drawOverlayText(bctx);

      // post
      this.fx.update(1/60,this);
      this.fx.post(bctx,this);

      // upscale
      ctx.fillStyle="#000";
      ctx.fillRect(0,0,W,H);
      const scale=Math.max(1,Math.floor(Math.min(W/RW,H/RH)));
      const dw=RW*scale, dh=RH*scale;
      const dx=((W-dw)/2)|0, dy=((H-dh)/2)|0;
      ctx.drawImage(buf,0,0,RW,RH,dx,dy,dw,dh);
    }

    drawLighting(ctx){
      const p=this.player;
      if(!p) return;

      const fogMult=this.atmo?this.atmo.fogMult:1.0;
      const px=(p.x-this.world.cam.x+p.w/2)|0;
      const py=(p.y+p.h/2)|0;
      const rad=p.lantern;

      const fog=ctx.createRadialGradient(px,py,rad*0.2,px,py,rad*1.65*fogMult);
      fog.addColorStop(0,"rgba(0,0,0,0)");
      fog.addColorStop(0.55,"rgba(0,0,0,0.45)");
      fog.addColorStop(1,"rgba(0,0,0,0.98)");
      ctx.fillStyle=fog;
      ctx.fillRect(0,0,RW,RH);

      ctx.globalCompositeOperation="screen";
      ctx.globalAlpha=(0.12+this.tension.heat*0.15)*fogMult;
      ctx.fillStyle="#111";
      for(let i=0;i<10;i++){
        const mx=((performance.now()/50+i*210)%(RW+420))-210;
        ctx.fillRect(mx,0,90,RH);
      }
      ctx.globalAlpha=1;
      ctx.globalCompositeOperation="source-over";
    }

    drawOverlayText(ctx){
      const mx=(Input.mouse.nx*RW)|0;
      const my=(Input.mouse.ny*RH)|0;
      ctx.globalAlpha=0.85;
      ctx.strokeStyle="#888";
      ctx.beginPath();
      ctx.moveTo(mx-4,my); ctx.lineTo(mx-1,my);
      ctx.moveTo(mx+1,my); ctx.lineTo(mx+4,my);
      ctx.moveTo(mx,my-4); ctx.lineTo(mx,my-1);
      ctx.moveTo(mx,my+1); ctx.lineTo(mx,my+4);
      ctx.stroke();
      ctx.globalAlpha=1;

      if(this.lastWhisper.t>0){
        ctx.font="10px ui-monospace, monospace";
        ctx.fillStyle="#9a9aaa";
        ctx.globalAlpha=clamp(this.lastWhisper.t/2,0,1)*0.9;
        ctx.fillText(this.lastWhisper.text, 8, RH-10);
        ctx.globalAlpha=1;
      }
    }
  }

  /*************************
   * Boot + UI wiring
   *************************/
  const game = new Game();

  function setAviSelection(idx){
    document.querySelectorAll(".avi").forEach(b=>b.classList.remove("sel"));
    const btn=document.querySelector(`.avi[data-avi="${idx}"]`);
    btn?.classList.add("sel");
  }
  let selectedAvi=0;
  document.querySelectorAll(".avi").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      selectedAvi=parseInt(btn.dataset.avi,10)||0;
      setAviSelection(selectedAvi);
    });
  });
  setAviSelection(0);

  UI.loadSpritesBtn.addEventListener("click", ()=>UI.spriteFiles.click());
  UI.spriteFiles.addEventListener("change", async ()=>{
    await assets.loadFromFiles(UI.spriteFiles.files);
    updateAssetUI();
  });

  UI.startBtn.addEventListener("click", async ()=>{
    const name=(UI.nameInput.value||"SEEKER").trim().slice(0,18)||"SEEKER";
    UI.nameInput.value=name;

    await assets.tryLoadManifest(); // optional
    updateAssetUI();

    AudioSys.start();
    AudioSys.setHard(UI.toggleHardAudio.checked);

    const settings={
      allowConfusion:UI.toggleConfusion.checked,
      allowFaces:UI.toggleFaces.checked,
      hardAudio:UI.toggleHardAudio.checked
    };
    const missionId = UI.missionSelect.value || "SURVIVE_120";

    UI.menu.classList.add("hidden");
    UI.end.classList.add("hidden");
    UI.hud.classList.remove("hidden");

    game.startRun(name, selectedAvi, settings, missionId);

    SceneStack.stack.length=0;
    SceneStack.push(game);
  });

  UI.retryBtn.addEventListener("click", ()=>{
    UI.end.classList.add("hidden");
    UI.hud.classList.remove("hidden");

    const name=(game.player?.name||UI.nameInput.value||"SEEKER").trim().slice(0,18)||"SEEKER";
    const settings={
      allowConfusion:UI.toggleConfusion.checked,
      allowFaces:UI.toggleFaces.checked,
      hardAudio:UI.toggleHardAudio.checked
    };
    const missionId = UI.missionSelect.value || "SURVIVE_120";

    game.startRun(name, game.player?.avi ?? selectedAvi, settings, missionId);
    SceneStack.stack.length=0;
    SceneStack.push(game);
  });

  UI.menuBtn.addEventListener("click", ()=>{
    UI.end.classList.add("hidden");
    UI.hud.classList.add("hidden");
    UI.menu.classList.remove("hidden");
    SceneStack.stack.length=0;
    game.state="menu";
  });

  /*************************
   * Main Loop (single update; no double tick)
   *************************/
  let last=performance.now();
  function loop(now){
    const dt=Math.min((now-last)/1000, 0.05);
    last=now;

    const top=SceneStack.top();
    if(top){
      if(top!==game && top.pausesGame) top.update?.(dt);
      else game.update(dt);

      game.draw();

      // HUD
      if(game.player && game.state==="play"){
        const p=game.player;
        UI.hpFill.style.width = `${(p.hp/p.hpMax*100)|0}%`;
        UI.sanFill.style.width = `${(p.san/p.sanMax*100)|0}%`;
        UI.weaponLabel.textContent = `Weapon: ${p.weapon.name}`;
        UI.depthLabel.textContent = `DEPTH: ${Math.floor(p.x/10)}m`;
        UI.modeLabel.textContent =
          game.tension.mode==="atmosphere" ? "ATMOSPHERE" :
          game.tension.mode==="boss" ? "BOSS" : "FRENETIC";
        UI.zoneLabel.textContent = `ZONE: ${game.atmo?.name||"—"}`;

        // objective
        let obj="—";
        if(game.mission){
          if(game.mission.id==="SURVIVE_120") obj = `Objective: Survive ${Math.ceil(game.mission.timer)}s`;
          if(game.mission.id==="SAVE_CHILD") obj = `Objective: Touch Patient 07`;
          if(game.mission.id==="REACH_CHAPEL") obj = `Objective: Reach 1000m`;
        }
        UI.objectiveLabel.textContent = obj;

        UI.statusLabel.textContent = game._statusText || "";
        UI.hintLabel.textContent = "";
      }
    }

    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

})();


