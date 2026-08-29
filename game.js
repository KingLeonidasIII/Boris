"use strict";

const canvas=document.getElementById("game"),ctx=canvas.getContext("2d"),message=document.getElementById("message");
let W=0,H=0,dpr=1;
const C={bg:"#05050a",cyan:"#00ffff",red:"#ff1744",yellow:"#ffe600",white:"#fff",pink:"#ff66cc",orange:"#ff9d00",purple:"#a66cff",green:"#66ffcc",blue:"#66ccff"};

function resize(){
 dpr=Math.min(devicePixelRatio||1,2);W=innerWidth;H=innerHeight;
 canvas.width=W*dpr;canvas.height=H*dpr;canvas.style.width=W+"px";canvas.style.height=H+"px";
 ctx.setTransform(dpr,0,0,dpr,0,0);
 player.x=Math.max(player.r,Math.min(W-player.r,player.x||W/2));
 player.y=Math.max(player.r,Math.min(H-player.r,player.y||H/2));
}

addEventListener("resize",resize);

const keys=Object.create(null);

addEventListener("keydown",e=>{
 const k=e.key.toLowerCase();
 keys[k]=true;

 if(["w","a","s","d","i","j","k","l","arrowup","arrowdown","arrowleft","arrowright"," ","shift","p","r","h","b","v","escape","enter","1","2","3","4","5","6","7","8","9","q","e"].includes(k))e.preventDefault();
 if(e.repeat)return;

 if(weaponScreen){
  if(k==="escape"||k==="b")showHome();
  else weaponKey(k);
  return;
 }

 if(abilityScreen){
  if(k==="escape"||k==="b")showHome();
  else abilityKey(k);
  return;
 }

 if(homeScreen){
  if(k==="enter"||k===" ")startRound();
  else if(k==="b")showAbilities();
  else if(k==="v")showWeapons();
  return;
 }

 if(gameOver){
  if(k==="r")restart();
  else if(k==="h")goHome();
  return;
 }

 if(armory){
  if(k==="p"||k==="escape")closeArmory();
  return;
 }

 if(k==="p")openArmory();
 else if(k===" ")shoot();
 else if(k==="shift")dash();
});

addEventListener("keyup",e=>keys[e.key.toLowerCase()]=false);
addEventListener("blur",()=>Object.keys(keys).forEach(k=>keys[k]=false));

let homeScreen=true,abilityScreen=false,weaponScreen=false,gameOver=false,armory=false;
let score=0,orbs=0,timeAlive=0,wave=0,waveState="home",waveEnemiesLeft=0,waveSpawnTimer=0;
let intermission=0,intermissionMax=0,waveModifier=null,shake=0,last=0,highScore=0,preWave=true;

const bullets=[],enemies=[],orbList=[],particles=[],hazards=[],texts=[];

try{
 highScore=+localStorage.getItem("neonHighScore")||0;
}catch(e){}

const player={
 x:W/2,y:H/2,r:14,health:3,maxHealth:3,moveSpeed:300,
 aim:0,aimX:1,aimY:0,fireCooldown:0,fireRate:.16,damage:1,bulletSpeed:850,
 dashCooldown:0,dashMax:1.1,dashTime:0,dashDuration:.12,dashSpeed:1000,dashX:1,dashY:0,
 emergencyShield:false,pickups:0,shotsFired:0
};

const WEAPONS=[
 {id:"pulse",name:"PULSE CANNON",color:C.cyan,desc:"Reliable mid-range energy fire. Good at sustained single-target pressure.",rate:.16,damage:1,speed:850,life:1.25},
 {id:"rail",name:"RAILGUN",color:C.orange,desc:"Slow piercing slug with very high single-shot damage.",rate:.58,damage:4,speed:1400,life:1.2,pierce:2},
 {id:"scatter",name:"BLAST SHOTGUN",color:C.pink,desc:"Short-range cone. Pellets spread heavily, but burst groups.",rate:.34,damage:.52,speed:800,life:.85,pellets:7,spread:.72},
 {id:"laser",name:"LASER",color:"#ff3355",desc:"Continuous precision beam. High hit reliability, short range of life.",rate:.14,damage:.72,speed:1900,life:.32,pierce:4,laser:true},
 {id:"missile",name:"MISSILE LAUNCHER",color:C.purple,desc:"Slow rockets with visible area explosions. Best against clusters.",rate:.52,damage:3,speed:500,life:2.2,explosion:62},
 {id:"arc",name:"ARC CASTER",color:C.green,desc:"Electrical projectile that jumps through nearby targets.",rate:.25,damage:1.2,speed:1000,life:1.1,chain:2,chainRange:125}
];

let selectedWeapon="pulse";

try{
 const s=localStorage.getItem("neonWeapon");
 if(WEAPONS.some(w=>w.id===s))selectedWeapon=s;
}catch(e){}

const ABILITIES=[
 {id:"hull",name:"REINFORCED HULL",desc:"Start with +1 maximum health.",color:"#ff5555"},
 {id:"shield",name:"EMERGENCY SHIELD",desc:"The first collision each run causes no damage.",color:C.blue},
 {id:"magnet",name:"MAGNETIC CORE",desc:"Attract yellow orbs from 115 pixels away.",color:C.yellow},
 {id:"scavenger",name:"SCAVENGER",desc:"Kills have a 15% chance to create an extra orb.",color:C.yellow},
 {id:"quickstart",name:"QUICK START",desc:"Wave 1 receives 20% fewer enemies.",color:C.cyan},
 {id:"overcharge",name:"OVERCHARGED CORE",desc:"Permanent +10% weapon damage.",color:C.orange},
 {id:"stabilizers",name:"STABILIZERS",desc:"Permanent +8% movement speed.",color:"#00ff88"},
 {id:"afterburner",name:"AFTERBURNER",desc:"Permanent -10% dash cooldown.",color:C.purple},
 {id:"quickhands",name:"QUICK HANDS",desc:"Permanent -8% weapon cooldown.",color:C.cyan},
 {id:"barrel",name:"THICK BARREL",desc:"Permanent +10% projectile speed and lifetime.",color:"#ff7b00"},
 {id:"collector",name:"COLLECTOR",desc:"Every fifth orb collected gives +1 extra orb.",color:C.yellow},
 {id:"laststand",name:"LAST STAND",desc:"At 1 HP, movement speed +20%.",color:C.red},
 {id:"training",name:"COMBAT TRAINING",desc:"Enemy collisions knock you backward.",color:C.white},
 {id:"phaseDash",name:"PHASE DASH",desc:"Dashing grants brief collision immunity.",color:C.purple},
 {id:"orbSurge",name:"ORB SURGE",desc:"Every 10 orbs collected grants +1 orb and restores 1 HP.",color:C.yellow},
 {id:"vitality",name:"VITALITY MATRIX",desc:"Start with +1 maximum health and restore 1 HP after every 5 waves.",color:C.red},
 {id:"overclock",name:"OVERCLOCKED TRIGGER",desc:"Every 12th shot automatically fires a 60% damage echo.",color:C.cyan}
];

let abilities=[null,null];

try{
 const a=JSON.parse(localStorage.getItem("neonAbilities")||"null");
 if(Array.isArray(a)&&a.length===2)abilities=a.map(x=>ABILITIES.some(a=>a.id===x)?x:null);
}catch(e){}

const has=id=>abilities.includes(id);
const abilitySlot=id=>abilities.indexOf(id);

function saveAbilities(){
 try{
  localStorage.setItem("neonAbilities",JSON.stringify(abilities));
 }catch(e){}
}

const general={
 thrusters:{name:"THRUSTERS",desc:"+7% movement speed per level.",cost:4,max:3,level:0},
 heavy:{name:"HEAVY WEAPON",desc:"+0.7 weapon damage per level.",cost:5,max:2,level:0},
 overdrive:{name:"OVERDRIVE",desc:"-12% dash cooldown per level.",cost:6,max:2,level:0},
 capacitor:{name:"CAPACITOR BANK",desc:"-8% weapon cooldown per level.",cost:6,max:3,level:0},
 plating:{name:"NANOPLATING",desc:"+1 maximum health per level.",cost:7,max:2,level:0}
};

const weaponUpgrades={
 pulse:[
  {id:"pulseStability",name:"STABILITY PATH",desc:"+12% projectile speed per level.",cost:4,max:3},
  {id:"pulseSurge",name:"SURGE PATH",desc:"+0.18 damage per level.",cost:5,max:2},
  {id:"pulseEcho",name:"ECHO PATH",desc:"12% chance per level to fire a 45% damage echo round.",cost:6,max:2},
  {id:"pulsePrism",name:"PRISM PATH",desc:"Shots split into two short-lived side bolts.",cost:7,max:2},
  {id:"pulseNova",name:"NOVA PATH",desc:"Every 8th Pulse shot releases a close-range energy burst.",cost:8,max:2}
 ],

 rail:[
  {id:"railPenetrator",name:"PENETRATOR",desc:"+1 pierce per level.",cost:5,max:2},
  {id:"railAccelerator",name:"ACCELERATOR",desc:"+18% projectile speed per level.",cost:4,max:2},
  {id:"railShock",name:"SHOCK SLUG",desc:"Impact stuns nearby enemies for 0.35s per level.",cost:6,max:2},
  {id:"railRupture",name:"RUPTURE PATH",desc:"Impacts mark enemies; the next hit deals +35% damage.",cost:7,max:2},
  {id:"railSingularity",name:"SINGULARITY PATH",desc:"Every 4th Rail shot creates a gravity pulse.",cost:8,max:2}
 ],

 scatter:[
  {id:"scatterWide",name:"WIDE CHOKE",desc:"+18% cone width per level.",cost:4,max:2},
  {id:"scatterBuckshot",name:"BUCKSHOT",desc:"+0.10 pellet damage per level.",cost:4,max:3},
  {id:"scatterBurst",name:"BURST LOAD",desc:"+2 pellets per level.",cost:6,max:2},
  {id:"scatterRicochet",name:"RICOCHET PATH",desc:"Pellets have a chance to bounce once into a nearby target.",cost:7,max:2},
  {id:"scatterShatter",name:"SHATTER PATH",desc:"Kills release a 6-pellet microburst.",cost:8,max:2}
 ],

 laser:[
  {id:"laserFocus",name:"FOCUS LENS",desc:"+0.18 beam damage per level.",cost:5,max:3},
  {id:"laserReach",name:"EXTENDED BEAM",desc:"+22% beam lifetime per level.",cost:4,max:2},
  {id:"laserPhase",name:"PHASE LENS",desc:"+2 enemy pierce per level.",cost:6,max:2},
  {id:"laserSweep",name:"SWEEP PATH",desc:"Beam width grows by 2 pixels per level.",cost:7,max:2},
  {id:"laserPrism",name:"PRISM PATH",desc:"Every 6th beam shot emits two angled mini-beams.",cost:8,max:2}
 ],

 missile:[
  {id:"missileWarhead",name:"WARHEAD",desc:"+18 explosion radius per level.",cost:5,max:2},
  {id:"missileFuel",name:"ROCKET FUEL",desc:"+22% rocket speed per level.",cost:4,max:2},
  {id:"missilePayload",name:"HEAVY PAYLOAD",desc:"+0.8 impact damage per level.",cost:6,max:2},
  {id:"missileCluster",name:"CLUSTER PATH",desc:"Explosions launch 3 secondary micro-rockets.",cost:7,max:2},
  {id:"missileMeteor",name:"METEOR PATH",desc:"Every 5th missile becomes a huge impact.",cost:8,max:2}
 ],

 arc:[
  {id:"arcChain",name:"CHAIN LINK",desc:"+1 chain jump per level.",cost:5,max:2},
  {id:"arcVoltage",name:"HIGH VOLTAGE",desc:"+0.20 chain damage per level.",cost:5,max:3},
  {id:"arcReach",name:"CONDUCTOR",desc:"+25 chain range per level.",cost:4,max:2},
  {id:"arcPulse",name:"THUNDER PATH",desc:"Every 4th Arc shot releases a radial electric pulse.",cost:7,max:2},
  {id:"arcFork",name:"FORK PATH",desc:"Chains split to one additional nearby target per level.",cost:8,max:2}
 ]
};

let wLevels={},weaponPath=null;

function resetWeaponLevels(){
 wLevels={};
 weaponPath=null;
 weaponUpgrades[selectedWeapon].forEach(u=>wLevels[u.id]=0);
}

function resetGeneralUpgrades(){
 Object.values(general).forEach(u=>u.level=0);
}

resetWeaponLevels();

const weapon=()=>WEAPONS.find(w=>w.id===selectedWeapon)||WEAPONS[0];
const lvl=id=>wLevels[id]||0;

function applyUpgrades(){
 const w=weapon();

 let rate=w.rate;

 if(has("quickhands"))rate*=.92;
 rate*=Math.pow(.92,general.capacitor.level);

 player.fireRate=rate;

 let damage=w.damage+.7*general.heavy.level;

 if(has("overcharge"))damage*=1.10;

 if(selectedWeapon==="pulse")
  damage+=.18*lvl("pulseSurge");

 if(selectedWeapon==="laser")
  damage+=.18*lvl("laserFocus");

 if(selectedWeapon==="missile")
  damage+=.8*lvl("missilePayload");

 if(selectedWeapon==="arc")
  damage+=.2*lvl("arcVoltage");

 player.damage=Math.max(.2,damage);

 player.moveSpeed=
  300*
  (has("stabilizers")?1.08:1)*
  (1+.07*general.thrusters.level);

 player.dashMax=
  1.1*
  (has("afterburner")?.9:1)*
  Math.pow(.88,general.overdrive.level);

 player.dashDuration=.12;

 player.bulletSpeed=
  w.speed*
  (has("barrel")?1.1:1);

 if(selectedWeapon==="pulse")
  player.bulletSpeed*=1+.12*lvl("pulseStability");

 if(selectedWeapon==="rail")
  player.bulletSpeed*=1+.18*lvl("railAccelerator");

 if(selectedWeapon==="missile")
  player.bulletSpeed*=1+.22*lvl("missileFuel");
}

function clearObjects(){
 bullets.length=
 enemies.length=
 orbList.length=
 particles.length=
 hazards.length=
 texts.length=0;
}

function resetPlayer(){
 player.maxHealth=
  3+
  (has("hull")?1:0)+
  (has("vitality")?1:0)+
  general.plating.level;

 player.health=player.maxHealth;
 player.x=W/2;
 player.y=H/2;

 player.fireCooldown=0;
 player.dashCooldown=0;
 player.dashTime=0;

 player.aim=0;
 player.aimX=1;
 player.aimY=0;

 player.dashX=1;
 player.dashY=0;

 player.emergencyShield=false;
 player.pickups=0;
 player.shotsFired=0;
}

function startRound(){
 homeScreen=abilityScreen=weaponScreen=gameOver=armory=false;

 score=orbs=timeAlive=wave=0;
 waveState="intermission";
 intermission=2;
 intermissionMax=2;
 waveModifier=null;
 preWave=true;

 waveEnemiesLeft=0;
 waveSpawnTimer=0;
 shake=0;
 last=0;

 clearObjects();
 resetPlayer();

 /*
  * These reset only when a NEW RUN starts.
  * They do not reset when a wave ends.
  */
 resetGeneralUpgrades();
 resetWeaponLevels();

 applyUpgrades();
 updateMessage();
}

function restart(){
 startRound();
}

function goHome(){
 homeScreen=true;
 abilityScreen=weaponScreen=gameOver=armory=false;
 clearObjects();
 last=0;
 updateMessage();
}

function showHome(){
 goHome();
}

function showAbilities(){
 if(!homeScreen)return;
 abilityScreen=true;
 updateAbilityMessage();
}

function showWeapons(){
 if(!homeScreen)return;
 weaponScreen=true;
 updateWeaponMessage();
}

function selectWeapon(id){
 if(!WEAPONS.some(w=>w.id===id))return;

 selectedWeapon=id;
 resetWeaponLevels();

 try{
  localStorage.setItem("neonWeapon",id);
 }catch(e){}

 updateWeaponMessage();
}

function weaponKey(k){
 const n="123456".indexOf(k);
 if(n>=0)selectWeapon(WEAPONS[n].id);
}

function toggleAbility(i){
 if(i<0||i>=ABILITIES.length)return;

 const id=ABILITIES[i].id;
 const s=abilitySlot(id);

 if(s>=0){
  abilities[s]=null;
 }else{
  const slot=abilities.indexOf(null);
  if(slot>=0)abilities[slot]=id;
 }

 saveAbilities();
 updateAbilityMessage();
}

function abilityKey(k){
 const map={
  "1":0,
  "2":1,
  "3":2,
  "4":3,
  "5":4,
  "6":5,
  "7":6,
  "8":7,
  "9":8,
  q:9,
  w:10,
  e:11,
  r:12
 };

 if(map[k]!=null)toggleAbility(map[k]);
}

Object.assign(window,{
 startRound,
 restart,
 goHome,
 showHome,
 showAbilities,
 showWeapons,
 toggleAbility,
 selectWeapon
});

function updateAbilityMessage(){
 message.innerHTML=`
 <h1 style="color:${C.cyan}">ABILITIES</h1>
 <p>Choose two permanent abilities. All permanent abilities provide benefits with no penalties.</p>

 <div class="grid">
 ${ABILITIES.map((a,i)=>{
  const s=abilitySlot(a.id);
  const key=i<9?i+1:["Q","W","E","R"][i-9];

  return `
   <div class="card ${s>=0?"selected":""}" onclick="toggleAbility(${i})">
    <span class="key">${key}</span>
    <h3 style="color:${s>=0?C.yellow:a.color}">${a.name}</h3>
    <p>${a.desc}</p>
    ${s>=0?`<span class="label">SLOT ${s+1}</span>`:""}
   </div>
  `;
 }).join("")}
 </div>

 <p class="small">Keyboard: 1–9, Q, W, E, R</p>
 <button class="main-button secondary-button" onclick="showHome()">BACK</button>
 `;

 message.classList.add("show");
}

function updateWeaponMessage(){
 message.innerHTML=`
 <h1 style="color:${weapon().color}">WEAPONS</h1>
 <p>Choose one permanent weapon. During a run, choose up to three of five Armory paths; unchosen paths lock after the third path is selected.</p>

 <div class="grid">
 ${WEAPONS.map((x,i)=>`
  <div class="card ${x.id===selectedWeapon?"selected":""}" onclick="selectWeapon('${x.id}')">
   <span class="key">${i+1}</span>
   <h3 style="color:${x.color}">${x.name}</h3>
   <p>${x.desc}</p>
   <p>Base damage ${x.damage} · cooldown ${x.rate.toFixed(2)}s</p>
   ${x.id===selectedWeapon?'<span class="label">EQUIPPED</span>':""}
  </div>
 `).join("")}
 </div>

 <p class="small">Keyboard: 1–6</p>
 <button class="main-button secondary-button" onclick="showHome()">BACK</button>
 `;

 message.classList.add("show");
}

function openArmory(){
 if(gameOver||homeScreen||(waveState!=="combat"&&waveState!=="intermission"))return;

 armory=true;
 updateArmory();
 message.classList.add("show");
}

function closeArmory(){
 armory=false;
 updateMessage();
}

function shopItem(id,name,desc,cost,max,level,color,locked=false){
 const can=orbs>=cost&&level<max&&!locked;

 return `
 <div class="card shop ${locked?"locked":""}">
  <h3 style="color:${color}">${name}</h3>
  <p>${desc}<br>Level ${level}/${max}</p>

  <button onclick="buyUpgrade('${id}')" ${can?"":"disabled"}>
   ${level>=max?"MAXED":locked?"LOCKED":"BUY — "+cost+" ORBS"}
  </button>
 </div>
 `;
}

function updateArmory(){
 const w=weapon();
 const chosen=weaponUpgrades[w.id].filter(u=>lvl(u.id)>0).length;

 let html=`
 <h1 style="color:${w.color}">ARMORY</h1>

 <p>
  Orbs:
  <strong style="color:${C.yellow}">${orbs}</strong>
  · Wave ${wave}
 </p>

 <p class="small">
  Choose up to 3 of 5 weapon paths.
  After your third path is chosen, the other 2 lock for this run.
 </p>

 <h2>CORE UPGRADES</h2>
 <div class="grid">
 `;

 html+=shopItem(
  "thrusters",
  general.thrusters.name,
  general.thrusters.desc,
  general.thrusters.cost,
  general.thrusters.max,
  general.thrusters.level,
  "#00ff88"
 );

 html+=shopItem(
  "heavy",
  general.heavy.name,
  general.heavy.desc,
  general.heavy.cost,
  general.heavy.max,
  general.heavy.level,
  C.orange
 );

 html+=shopItem(
  "overdrive",
  general.overdrive.name,
  general.overdrive.desc,
  general.overdrive.cost,
  general.overdrive.max,
  general.overdrive.level,
  C.purple
 );

 html+=shopItem(
  "capacitor",
  general.capacitor.name,
  general.capacitor.desc,
  general.capacitor.cost,
  general.capacitor.max,
  general.capacitor.level,
  C.cyan
 );

 html+=shopItem(
  "plating",
  general.plating.name,
  general.plating.desc,
  general.plating.cost,
  general.plating.max,
  general.plating.level,
  C.red
 );

 html+=shopItem(
  "repair",
  "REPAIR",
  "Restore 1 HP.",
  3,
  1,
  player.health>=player.maxHealth?1:0,
  C.blue
 );

 html+=`
 </div>

 <h2>${w.name} PATHS — ${chosen}/3 CHOSEN</h2>
 <div class="grid">
 `;

 weaponUpgrades[w.id].forEach(u=>{
  html+=shopItem(
   u.id,
   u.name,
   u.desc,
   u.cost,
   u.max,
   lvl(u.id),
   w.color,
   !lvl(u.id)&&chosen>=3
  );
 });

 html+=`
 </div>

 <p class="small">
  P / ESC closes Armory. The game is paused while the Armory is open.
 </p>
 `;

 message.innerHTML=html;
}

function buyUpgrade(id){
 if(!armory||gameOver||homeScreen)return;

 if(id==="repair"){
  if(orbs>=3&&player.health<player.maxHealth){
   orbs-=3;
   player.health++;
   burst(player.x,player.y,C.blue,15,180);
   updateArmory();
  }
  return;
 }

 if(general[id]){
  const u=general[id];

  if(u.level>=u.max||orbs<u.cost)return;

  orbs-=u.cost;
  u.level++;

  const oldMax=player.maxHealth;

  applyUpgrades();

  if(id==="plating"&&player.maxHealth>oldMax){
   player.health=Math.min(
    player.maxHealth,
    player.health+(player.maxHealth-oldMax)
   );
  }

  burst(player.x,player.y,C.yellow,15,180);
  updateArmory();
  return;
 }

 const u=weaponUpgrades[selectedWeapon].find(x=>x.id===id);

 if(!u)return;

 const chosenPaths=
  weaponUpgrades[selectedWeapon]
   .filter(x=>lvl(x.id)>0)
   .length;

 if(!lvl(id)&&chosenPaths>=3)return;
 if(lvl(id)>=u.max||orbs<u.cost)return;

 if(!lvl(id))weaponPath=id;

 orbs-=u.cost;
 wLevels[id]++;

 applyUpgrades();

 burst(player.x,player.y,weapon().color,15,180);
 updateArmory();
}

window.buyUpgrade=buyUpgrade;

function beginWave(){
 wave++;
 waveState="combat";
 preWave=false;

 waveModifier=getWaveModifier(wave);
 waveEnemiesLeft=waveBudget(wave);
 waveSpawnTimer=.2;

 spawnWaveHazards();
 updateMessage();
}

function waveBudget(n){
 let budget=
  Math.floor(
   5+
   n*2.3+
   Math.pow(n,1.18)*.8
  );

 if(n===1&&has("quickstart"))
  budget=Math.max(1,Math.floor(budget*.8));

 return budget;
}

function getWaveModifier(n){
 const pool=[
  {
   name:"HUNTERS",
   desc:"Fast enemies are more common.",
   id:"hunters"
  },
  {
   name:"FORTIFIED",
   desc:"Tanks are more common.",
   id:"fortified"
  },
  {
   name:"SWARM",
   desc:"More weak enemies, less health on elites.",
   id:"swarm"
  },
  {
   name:"CROSS FIRE",
   desc:"More ranged pressure.",
   id:"crossfire"
  },
  {
   name:"BLOOD MOON",
   desc:"Enemies are stronger; wave reward is higher.",
   id:"blood"
  },
  {
   name:"STABLE",
   desc:"No modifier.",
   id:"stable"
  }
 ];

 return pool[
  (n*7+Math.floor(n/3))%pool.length
 ];
}

function waveReward(){
 return 2+
  Math.floor(wave*.75)+
  (waveModifier.id==="blood"?2:0);
}

function spawnWaveHazards(){
 hazards.length=0;

 if(wave<3)return;

 if(waveModifier.id==="crossfire"||wave%4===0){
  const n=Math.min(
   2+Math.floor(wave/6),
   5
  );

  for(let i=0;i<n;i++){
   hazards.push({
    x:60+Math.random()*(W-120),
    y:60+Math.random()*(H-120),
    r:34,
    life:999,
    type:"mine",
    pulse:Math.random()*7
   });
  }
 }
}

function chooseEnemyType(){
 const r=Math.random();
 const n=wave;
 const m=waveModifier.id;

 const hunter=.14+(m==="hunters"?.12:0);
 const tank=.14+(m==="fortified"?.12:0);
 const leech=.10;
 const charger=.10;
 const shooter=.10;

 let p=0;

 if(n>=2){
  p+=hunter;
  if(r<p)return"fast";
 }

 if(n>=3){
  p+=tank;
  if(r<p)return"tank";
 }

 if(n>=4){
  p+=leech;
  if(r<p)return"leech";
 }

 if(n>=5){
  p+=charger;
  if(r<p)return"charger";
 }

 if(n>=6){
  p+=shooter;
  if(r<p)return"shooter";
 }

 return"normal";
}

function spawnEnemy(type=chooseEnemyType(),elite=false){
 const p=edge(55);

 const scale=1+wave*.045;

 const e={
  x:p.x,
  y:p.y,
  rot:Math.random()*7,
  flash:0,
  type,
  elite
 };

 const defs={
  normal:[14,62,1,100],
  fast:[12,92,1,150],
  tank:[23,40,4,400],
  leech:[15,54,2,240],
  charger:[15,58,2,260],
  shooter:[16,48,2,280]
 };

 const d=defs[type]||defs.normal;

 e.r=d[0]*(elite?1.12:1);
 e.speed=d[1]*scale*(elite?1.12:1);

 e.hp=
  d[2]+
  Math.floor(wave/7)+
  (elite?2:0);

 if(waveModifier.id==="swarm"&&e.type!=="normal")
  e.hp=Math.max(1,e.hp-1);

 if(waveModifier.id==="blood")
  e.hp+=1;

 e.maxHp=e.hp;
 e.points=d[3]*(elite?2.5:1);

 if(type==="fast")
  e.speed*=.92,e.hitR=16;

 if(type==="leech")
  e.orbTimer=2+Math.random()*2;

 if(type==="charger"){
  e.charge=1.2+Math.random()*1.2;
  e.chargeMax=e.charge;
  e.chargeTime=0;
 }

 if(type==="shooter")
  e.shot=1.5+Math.random();

 enemies.push(e);

 return e;
}

function spawnElite(){
 const types=[
  "fast",
  "tank",
  "charger",
  "shooter",
  "leech"
 ];

 return spawnEnemy(
  types[(wave*3)%types.length],
  true
 );
}

function spawnBoss(){
 const p=edge(90);

 const b={
  x:p.x,
  y:p.y,
  r:38,
  speed:32*(1+wave*.025),
  hp:35+wave*9,
  maxHp:35+wave*9,
  points:5000,
  rot:0,
  flash:0,
  type:"boss",
  elite:true,
  phase:0,
  shot:2,
  spawn:4
 };

 enemies.push(b);
 waveEnemiesLeft=0;
}

function edge(m=50){
 const s=Math.floor(Math.random()*4);

 if(s===0)
  return{x:Math.random()*W,y:-m};

 if(s===1)
  return{x:W+m,y:Math.random()*H};

 if(s===2)
  return{x:Math.random()*W,y:H+m};

 return{x:-m,y:Math.random()*H};
}

function spawnOrb(){
 if(waveState!=="combat"||orbList.length>=4)return;

 const p=70;

 orbList.push({
  x:p+Math.random()*Math.max(1,W-p*2),
  y:p+Math.random()*Math.max(1,H-p*2),
  r:7,
  p:Math.random()*7,
  life:7
 });
}

function burst(x,y,color,n=10,speed=150){
 for(let i=0;i<n;i++){
  const a=Math.random()*Math.PI*2;
  const v=speed*(.3+Math.random()*.7);

  particles.push({
   x,
   y,
   dx:Math.cos(a)*v,
   dy:Math.sin(a)*v,
   life:.3+Math.random()*.5,
   max:.8,
   size:1.5+Math.random()*3,
   color
  });
 }
}

function dist(a,b){
 return Math.hypot(a.x-b.x,a.y-b.y);
}

function text(x,y,s,color=C.white){
 texts.push({
  x,
  y,
  s,
  color,
  life:1
 });
}

function makeBullet(angle,damage,extra={}){
 bullets.push({
  x:player.x+Math.cos(angle)*31,
  y:player.y+Math.sin(angle)*31,
  dx:Math.cos(angle),
  dy:Math.sin(angle),
  r:extra.r||4,
  speed:extra.speed||player.bulletSpeed,
  damage,
  life:extra.life||1.2,
  pierce:extra.pierce||0,
  explosion:extra.explosion||0,
  chain:extra.chain||0,
  chainRange:extra.chainRange||125,
  laser:!!extra.laser,
  ricochet:extra.ricochet||0,
  width:extra.width||4,
  clusterChild:!!extra.clusterChild,
  hit:new Set(),
  trail:[]
 });
}

function shoot(){
 if(gameOver||armory||homeScreen||waveState!=="combat"||player.fireCooldown>0)return;

 const w=weapon();

 player.shotsFired=(player.shotsFired||0)+1;

 if(w.id==="scatter"){
  const n=
   7+
   2*lvl("scatterBurst");

  const spread=
   w.spread*
   (1+.18*lvl("scatterWide"));

  for(let i=0;i<n;i++){
   const a=
    player.aim+
    (n===1?0:(i/(n-1)-.5)*spread);

   makeBullet(
    a,
    player.damage*
    (.5+.10*lvl("scatterBuckshot")),
    {
     speed:player.bulletSpeed,
     life:w.life,
     r:3,
     ricochet:lvl("scatterRicochet")
    }
   );
  }

  weaponFlash(C.pink);
 }else{
  const ex={
   speed:player.bulletSpeed,
   life:w.life,
   pierce:w.pierce||0,
   laser:w.laser
  };

  if(has("barrel"))
   ex.life*=1.1;

  if(w.id==="rail")
   ex.pierce+=lvl("railPenetrator");

  if(w.id==="laser"){
   ex.life*=1+.22*lvl("laserReach");
   ex.pierce+=2*lvl("laserPhase");
   ex.r=4;
   ex.width=4+2*lvl("laserSweep");
  }

  if(w.id==="missile")
   ex.explosion=
    w.explosion+
    18*lvl("missileWarhead");

  if(w.id==="arc"){
   ex.chain=
    w.chain+
    lvl("arcChain");

   ex.chainRange=
    w.chainRange+
    25*lvl("arcReach");
  }

  if(
   w.id==="missile"&&
   lvl("missileMeteor")&&
   player.shotsFired%5===0
  ){
   ex.explosion+=45;
  }

  makeBullet(
   player.aim,
   player.damage,
   ex
  );

  if(
   w.id==="pulse"&&
   lvl("pulseEcho")&&
   Math.random()<.12*lvl("pulseEcho")
  ){
   makeBullet(
    player.aim+
    (.04+Math.random()*.04)*
    (Math.random()<.5?-1:1),
    player.damage*.45,
    {
     speed:player.bulletSpeed*.9,
     life:w.life*.8,
     r:3
    }
   );
  }

  if(
   w.id==="pulse"&&
   lvl("pulsePrism")
  ){
   makeBullet(
    player.aim+.16,
    player.damage*.42,
    {
     speed:player.bulletSpeed*.85,
     life:w.life*.55,
     r:3
    }
   );

   if(lvl("pulsePrism")>1){
    makeBullet(
     player.aim-.16,
     player.damage*.42,
     {
      speed:player.bulletSpeed*.85,
      life:w.life*.55,
      r:3
     }
    );
   }
  }

  if(
   w.id==="pulse"&&
   lvl("pulseNova")&&
   player.shotsFired%8===0
  ){
   hazards.push({
    x:player.x+player.aimX*75,
    y:player.y+player.aimY*75,
    r:10,
    maxR:75+25*lvl("pulseNova"),
    life:.24,
    maxLife:.24,
    type:"nova",
    pulse:0,
    damage:player.damage*.7,
    hit:new Set()
   });
  }

  if(
   w.id==="laser"&&
   lvl("laserPrism")&&
   player.shotsFired%6===0
  ){
   makeBullet(
    player.aim+.28,
    player.damage*.38,
    {
     speed:player.bulletSpeed,
     life:w.life*.5,
     r:2,
     laser:true,
     pierce:1
    }
   );

   makeBullet(
    player.aim-.28,
    player.damage*.38,
    {
     speed:player.bulletSpeed,
     life:w.life*.5,
     r:2,
     laser:true,
     pierce:1
    }
   );
  }

  if(
   w.id==="rail"&&
   lvl("railSingularity")&&
   player.shotsFired%4===0
  ){
   hazards.push({
    x:player.x+player.aimX*180,
    y:player.y+player.aimY*180,
    r:80,
    life:.55,
    maxLife:.55,
    type:"gravity",
    pulse:0
   });
  }

  if(
   w.id==="arc"&&
   lvl("arcPulse")&&
   player.shotsFired%4===0
  ){
   hazards.push({
    x:player.x,
    y:player.y,
    r:10,
    maxR:70+20*lvl("arcPulse"),
    life:.22,
    maxLife:.22,
    type:"arcPulse",
    pulse:0,
    damage:player.damage*.45
   });
  }

  if(
   has("overclock")&&
   player.shotsFired%12===0
  ){
   makeBullet(
    player.aim,
    player.damage*.6,
    {
     speed:player.bulletSpeed,
     life:w.life*.75,
     r:3
    }
   );
  }

  weaponFlash(w.color);
 }

 player.fireCooldown=player.fireRate;
 shake=Math.max(
  shake,
  w.id==="missile"?4:2
 );
}

function weaponFlash(color){
 burst(
  player.x+player.aimX*30,
  player.y+player.aimY*30,
  color,
  8,
  190
);
}

function dash(){
 if(gameOver||armory||homeScreen||waveState!=="combat"||player.dashCooldown>0)return;

 let x=
  (keys.d||keys.arrowright?1:0)-
  (keys.a||keys.arrowleft?1:0);

 let y=
  (keys.s||keys.arrowdown?1:0)-
  (keys.w||keys.arrowup?1:0);

 let n=Math.hypot(x,y);

 if(!n){
  x=player.dashX;
  y=player.dashY;
 }else{
  x/=n;
  y/=n;
 }

 player.dashX=x;
 player.dashY=y;

 player.dashTime=player.dashDuration;
 player.dashCooldown=player.dashMax;

 burst(
  player.x,
  player.y,
  C.cyan,
  20,
  250
 );
}

function hitPlayer(){
 if(
  player.dashTime>0&&
  has("phaseDash")
 )return;

 if(
  has("shield")&&
  !player.emergencyShield
 ){
  player.emergencyShield=true;
  burst(
   player.x,
   player.y,
   C.blue,
   30,
   260
  );
  shake=7;
  return;
 }

 player.health--;

 burst(
  player.x,
  player.y,
  C.red,
  25,
  240
 );

 shake=9;
 updatePlayerStats();

 if(player.health<=0)
  endGame();
}

function updatePlayerStats(){
 applyUpgrades();
}

function killEnemy(i){
 const e=enemies[i];

 if(!e)return;

 score+=Math.round(e.points);

 if(
  e.type!=="boss"&&
  Math.random()<.055&&
  orbList.length<4
 ){
  spawnOrb();
 }

 if(
  has("scavenger")&&
  Math.random()<.15&&
  orbList.length<4
 ){
  spawnOrb();
 }

 burst(
  e.x,
  e.y,
  e.type==="boss"?C.purple:C.red,
  e.type==="boss"?60:e.type==="tank"?28:16,
  240
 );

 if(e.type==="boss")
  text(
   e.x,
   e.y-50,
   "BOSS DEFEATED",
   C.yellow
  );

 enemies.splice(i,1);

 if(e.type==="boss"){
  completeWave();
  return;
 }

 if(waveEnemiesLeft>0)
  waveEnemiesLeft--;
}

function explode(x,y,r,damage,source){
 burst(
  x,
  y,
  C.purple,
  32,
  300
 );

 hazards.push({
  x,
  y,
  r:6,
  maxR:r,
  life:.28,
  maxLife:.28,
  type:"explosion",
  pulse:0
 });

 shake=Math.max(shake,7);

 for(let i=enemies.length-1;i>=0;i--){
  const e=enemies[i];

  if(
   e.type==="boss"&&
   source?.hit?.has(e)
  )continue;

  if(dist({x,y},e)<=r+e.r){
   if(source?.hit?.has(e))continue;

   source?.hit?.add(e);

   e.hp-=damage;
   e.flash=.08;

   if(e.hp<=0)
    killEnemy(i);
  }
 }
}

function chainAttack(
 x,
 y,
 damage,
 jumps,
 range,
 exclude
){
 let from={x,y};
 let used=new Set(exclude||[]);
 let chainNodes=[{x,y}];

 for(let n=0;n<jumps;n++){
  let best=null;
  let bestD=range+1;

  for(const e of enemies){
   if(used.has(e))continue;

   const d=dist(from,e);

   if(d<bestD){
    bestD=d;
    best=e;
   }
  }

  if(!best)break;

  used.add(best);

  best.hp-=damage;
  best.flash=.1;

  chainNodes.push({
   x:best.x,
   y:best.y
  });

  if(best.hp<=0){
   const idx=enemies.indexOf(best);

   if(idx>=0)
    killEnemy(idx);
  }

  from=best;
 }

 if(chainNodes.length>1){
  particles.push({
   type:"chain",
   nodes:chainNodes,
   life:.22,
   max:.22,
   color:C.green
  });
 }
}

function updateBullets(dt){
 for(let i=bullets.length-1;i>=0;i--){
  const b=bullets[i];

  if(b.enemy)continue;

  b.x+=b.dx*b.speed*dt;
  b.y+=b.dy*b.speed*dt;
  b.life-=dt;

  if(b.trail){
   b.trail.push({
    x:b.x,
    y:b.y
   });

   if(b.trail.length>8)
    b.trail.shift();
  }

  if(
   b.life<=0||
   b.x<-80||
   b.x>W+80||
   b.y<-80||
   b.y>H+80
  ){
   bullets.splice(i,1);
   continue;
  }

  let remove=false;

  for(
   let j=enemies.length-1;
   j>=0&&!remove;
   j--
  ){
   const e=enemies[j];

   const hitR=
    (e.hitR||e.r)+
    b.r;

   if(
    b.hit.has(e)||
    dist(b,e)>hitR
   )continue;

   b.hit.add(e);

   let dealt=b.damage;

   if(
    selectedWeapon==="rail"&&
    lvl("railRupture")&&
    e.rupture
   ){
    dealt*=1.35;
    e.rupture=0;
   }else if(
    selectedWeapon==="rail"&&
    lvl("railRupture")
   ){
    e.rupture=lvl("railRupture");
   }

   e.hp-=dealt;
   e.flash=.08;

   if(b.explosion)
    explode(
     b.x,
     b.y,
     b.explosion,
     dealt*.75,
     b
    );

   if(b.chain)
    chainAttack(
     e.x,
     e.y,
     dealt*.65,
     b.chain,
     b.chainRange,
     b.hit
    );

   if(
    selectedWeapon==="arc"&&
    lvl("arcFork")
   ){
    chainAttack(
     e.x,
     e.y,
     dealt*.35,
     lvl("arcFork"),
     b.chainRange,
     b.hit
    );
   }

   if(
    selectedWeapon==="scatter"&&
    b.ricochet&&
    Math.random()<.18*b.ricochet
   ){
    const a=Math.random()*Math.PI*2;

    makeBullet(
     a,
     dealt*.45,
     {
      speed:b.speed*.8,
      life:.45,
      r:2,
      ricochet:0
     }
    );

    const rb=bullets[bullets.length-1];

    rb.x=e.x;
    rb.y=e.y;
   }

   if(e.hp<=0){
    if(
     selectedWeapon==="scatter"&&
     lvl("scatterShatter")
    ){
     for(let k=0;k<6;k++){
      makeBullet(
       k*Math.PI/3,
       dealt*.3,
       {
        speed:650,
        life:.35,
        r:2
       }
      );

      const sb=bullets[bullets.length-1];

      sb.x=e.x;
      sb.y=e.y;
     }
    }

    killEnemy(j);
   }

   if(
    selectedWeapon==="missile"&&
    b.explosion&&
    lvl("missileCluster")&&
    !b.clusterChild
   ){
    for(let k=0;k<3;k++){
     const a=Math.random()*Math.PI*2;

     makeBullet(
      a,
      dealt*.3,
      {
       speed:430,
       life:.55,
       r:3,
       explosion:16,
       clusterChild:true
      }
     );

     const cb=bullets[bullets.length-1];

     cb.x=b.x;
     cb.y=b.y;
    }
   }

   if(
    selectedWeapon==="rail"&&
    lvl("railShock")
   ){
    hazards.push({
     x:e.x,
     y:e.y,
     r:18,
     maxR:18,
     life:.16,
     maxLife:.16,
     type:"stun",
     pulse:0
    });

    for(const target of enemies){
     if(
      dist(e,target)<=
      18+target.r
     ){
      target.stun=Math.max(
       target.stun||0,
       .35*lvl("railShock")
      );
     }
    }
   }

   if(b.pierce>0){
    b.pierce--;
   }else if(!b.laser){
    remove=true;
   }
  }

  if(remove)
   bullets.splice(i,1);
 }
}

function updateEnemies(dt){
 for(let i=enemies.length-1;i>=0;i--){
  const e=enemies[i];

  e.rot+=
   dt*
   (e.type==="fast"?5:2);

  e.flash=Math.max(
   0,
   e.flash-dt
  );

  e.stun=Math.max(
   0,
   (e.stun||0)-dt
  );

  const a=Math.atan2(
   player.y-e.y,
   player.x-e.x
  );

  const d=dist(player,e);

  if(e.stun<=0){
   if(e.type==="charger"){
    e.charge-=dt;

    if(e.charge<=0){
     e.chargeTime=.48;
     e.charge=
      e.chargeMax+
      Math.random();

     burst(
      e.x,
      e.y,
      C.orange,
      10,
      100
     );
    }

    if(e.chargeTime>0){
     e.chargeTime-=dt;

     e.x+=
      Math.cos(a)*
      e.speed*
      3.3*
      dt;

     e.y+=
      Math.sin(a)*
      e.speed*
      3.3*
      dt;
    }else{
     e.x+=
      Math.cos(a)*
      e.speed*
      .55*
      dt;

     e.y+=
      Math.sin(a)*
      e.speed*
      .55*
      dt;
    }
   }else if(e.type==="shooter"){
    if(d>260){
     e.x+=
      Math.cos(a)*
      e.speed*
      dt;

     e.y+=
      Math.sin(a)*
      e.speed*
      dt;
    }else if(d<190){
     e.x-=
      Math.cos(a)*
      e.speed*
      .7*
      dt;

     e.y-=
      Math.sin(a)*
      e.speed*
      .7*
      dt;
    }

    e.shot-=dt;

    if(e.shot<=0&&d<500){
     enemyShot(e);
     e.shot=1.8;
    }
   }else{
    e.x+=
     Math.cos(a)*
     e.speed*
     dt;

    e.y+=
     Math.sin(a)*
     e.speed*
     dt;
   }
  }

  if(e.type==="leech"){
   e.orbTimer-=dt;

   if(e.orbTimer<=0){
    const o=
     orbList
      .slice()
      .sort((a,b)=>dist(e,a)-dist(e,b))[0];

    if(o&&dist(e,o)<260){
     o.x=e.x;
     o.y=e.y;

     burst(
      o.x,
      o.y,
      C.red,
      5,
      80
     );
    }

    e.orbTimer=
     2+
     Math.random()*2;
   }
  }

  if(
   e.type==="boss"&&
   e.stun<=0
  ){
   updateBoss(e,dt);
  }

  if(
   d<
   player.r+
   (e.hitR||e.r)
  ){
   if(e.type==="boss"){
    endGame();
    return;
   }

   enemies.splice(i,1);

   if(waveEnemiesLeft>0)
    waveEnemiesLeft--;

   if(has("training")){
    player.x+=
     Math.cos(a)*55;

    player.y+=
     Math.sin(a)*55;

    player.x=
     Math.max(
      player.r,
      Math.min(
       W-player.r,
       player.x
      )
     );

    player.y=
     Math.max(
      player.r,
      Math.min(
       H-player.r,
       player.y
      )
     );
   }

   hitPlayer();

   if(gameOver)return;
  }
 }
}

function enemyShot(e){
 const a=Math.atan2(
  player.y-e.y,
  player.x-e.x
 );

 bullets.push({
  enemy:true,
  x:e.x,
  y:e.y,
  dx:Math.cos(a),
  dy:Math.sin(a),
  r:5,
  speed:260,
  damage:1,
  life:3,
  hit:new Set(),
  trail:[]
 });
}

function updateBoss(e,dt){
 e.phase+=dt;
 e.shot-=dt;
 e.spawn-=dt;

 if(e.shot<=0){
  for(let i=0;i<5;i++)
   enemyShot({
    x:e.x,
    y:e.y
   });

  e.shot=2.2;

  burst(
   e.x,
   e.y,
   C.purple,
   18,
   150
  );
 }

 if(e.spawn<=0){
  for(
   let i=0;
   i<Math.min(2,Math.floor(wave/4));
   i++
  ){
   spawnEnemy("fast");
  }

  e.spawn=5;
 }

 if(
  e.hp<e.maxHp*.5&&
  e.phase>8
 ){
  e.phase=0;

  hazards.push({
   x:W*.25+Math.random()*W*.5,
   y:H*.25+Math.random()*H*.5,
   r:55,
   life:1.2,
   maxLife:1.2,
   type:"warning",
   pulse:0
  });
 }
}

function updateEnemyBullets(dt){
 for(let i=bullets.length-1;i>=0;i--){
  const b=bullets[i];

  if(!b.enemy)continue;

  b.x+=b.dx*b.speed*dt;
  b.y+=b.dy*b.speed*dt;
  b.life-=dt;

  if(
   b.life<=0||
   b.x<-30||
   b.x>W+30||
   b.y<-30||
   b.y>H+30
  ){
   bullets.splice(i,1);
   continue;
  }

  if(
   dist(b,player)<
   b.r+player.r
  ){
   bullets.splice(i,1);
   hitPlayer();
  }
 }
}
function updateHazards(dt){
 for(let i=hazards.length-1;i>=0;i--){
  const h=hazards[i];

  h.life-=dt;
  h.pulse=(h.pulse||0)+dt;

  if(
   h.type==="mine"&&
   h.life>0&&
   dist(h,player)<h.r
  ){
   h.life=0;

   explode(
    h.x,
    h.y,
    58,
    1,
    {hit:new Set()}
   );

   hitPlayer();
  }

  if(
   h.type==="warning"&&
   h.life<.35&&
   dist(h,player)<h.r
  ){
   h.life=0;
   hitPlayer();
  }

  if(
   h.type==="gravity"&&
   h.life>0
  ){
   for(const e of enemies){
    const d=dist(h,e);

    if(
     d<h.r&&
     d>1
    ){
     e.x+=
      (h.x-e.x)/
      d*
      120*
      dt;

     e.y+=
      (h.y-e.y)/
      d*
      120*
      dt;
    }
   }
  }

  if(
   h.type==="arcPulse"&&
   h.life>0
  ){
   const maxR=
    h.maxR*
    (1-h.life/h.maxLife);

   for(
    let j=enemies.length-1;
    j>=0;
    j--
   ){
    const e=enemies[j];

    if(!h.hit)
     h.hit=new Set();

    if(
     !h.hit.has(e)&&
     dist(h,e)<maxR+e.r
    ){
     h.hit.add(e);

     e.hp-=h.damage;
     e.flash=.08;

     if(e.hp<=0)
      killEnemy(j);
    }
   }
  }

  if(
   h.type==="nova"&&
   h.life>0
  ){
   const maxR=
    h.maxR*
    (1-h.life/h.maxLife);

   for(
    let j=enemies.length-1;
    j>=0;
    j--
   ){
    const e=enemies[j];

    if(!h.hit)
     h.hit=new Set();

    if(
     !h.hit.has(e)&&
     dist(h,e)<maxR+e.r
    ){
     h.hit.add(e);

     e.hp-=h.damage;
     e.flash=.08;

     if(e.hp<=0)
      killEnemy(j);
    }
   }
  }

  if(h.life<=0)
   hazards.splice(i,1);
 }
}

function updateOrbs(dt){
 for(let i=orbList.length-1;i>=0;i--){
  const o=orbList[i];

  o.life-=dt;
  o.p+=dt*5;

  if(has("magnet")){
   const dx=player.x-o.x;
   const dy=player.y-o.y;
   const d=Math.hypot(dx,dy);

   if(
    d>0&&
    d<115
   ){
    o.x+=
     dx/d*
     180*
     (1-d/115)*
     dt;

    o.y+=
     dy/d*
     180*
     (1-d/115)*
     dt;
   }
  }

  if(
   dist(player,o)<
   player.r+o.r+5
  ){
   player.pickups++;

   orbs+=
    has("collector")&&
    player.pickups%5===0
     ?2
     :1;

   if(
    has("orbSurge")&&
    player.pickups%10===0
   ){
    orbs++;

    player.health=
     Math.min(
      player.maxHealth,
      player.health+1
     );

    text(
     player.x,
     player.y-28,
     "ORB SURGE",
     C.yellow
    );
   }

   burst(
    o.x,
    o.y,
    C.yellow,
    18,
    210
   );

   orbList.splice(i,1);
  }else if(o.life<=0){
   orbList.splice(i,1);
  }
 }
}

function updateParticles(dt){
 for(let i=particles.length-1;i>=0;i--){
  const p=particles[i];

  p.life-=dt;

  if(p.type==="chain"){
   // Chain particles are rendered from their stored node list.
  }else{
   p.x+=p.dx*dt;
   p.y+=p.dy*dt;

   p.dx*=Math.pow(.05,dt);
   p.dy*=Math.pow(.05,dt);
  }

  if(p.life<=0)
   particles.splice(i,1);
 }

 for(let i=texts.length-1;i>=0;i--){
  texts[i].y-=20*dt;
  texts[i].life-=dt;

  if(texts[i].life<=0)
   texts.splice(i,1);
 }
}

function completeWave(){
 if(waveState!=="combat")return;

 waveState="intermission";

 intermission=
  wave%5===0
   ?8
   :6;

 intermissionMax=intermission;

 orbList.length=0;
 hazards.length=0;

 const reward=waveReward();

 orbs+=reward;
 score+=wave*100;

 if(
  has("vitality")&&
  wave%5===0
 ){
  player.health=
   Math.min(
    player.maxHealth,
    player.health+1
   );

  text(
   W/2,
   H/2+28,
   "VITALITY +1 HP",
   C.red
  );
 }

 text(
  W/2,
  H/2,
  `WAVE ${wave} CLEAR +${reward} ORBS`,
  C.yellow
 );

 updateMessage();
}

function updateWave(dt){
 if(waveState==="intermission"){
  intermission=
   Math.max(
    0,
    intermission-dt
   );

  if(intermission<=0)
   beginWave();

  return;
 }

 if(waveState!=="combat")
  return;

 if(
  wave%5===0&&
  waveEnemiesLeft===0&&
  !enemies.some(
   e=>e.type==="boss"
  )
 ){
  spawnBoss();
  return;
 }

 if(waveEnemiesLeft>0){
  waveSpawnTimer-=dt;

  if(waveSpawnTimer<=0){
   spawnEnemy();

   waveSpawnTimer=
    Math.max(
     .22,
     .75-wave*.012
    );
  }
 }

 if(
  waveEnemiesLeft===0&&
  enemies.length===0
 ){
  completeWave();
 }
}

function endGame(){
 gameOver=true;

 if(score>highScore){
  highScore=score;

  try{
   localStorage.setItem(
    "neonHighScore",
    highScore
   );
  }catch(e){}
 }

 burst(
  player.x,
  player.y,
  C.red,
  50,
  300
 );

 shake=12;

 updateMessage();
}

function drawBackground(){
 ctx.fillStyle=C.bg;
 ctx.fillRect(
  -20,
  -20,
  W+40,
  H+40
 );

 ctx.strokeStyle=
  "rgba(0,255,255,.07)";

 ctx.lineWidth=1;

 for(let x=0;x<=W;x+=50){
  ctx.beginPath();
  ctx.moveTo(x,0);
  ctx.lineTo(x,H);
  ctx.stroke();
 }

 for(let y=0;y<=H;y+=50){
  ctx.beginPath();
  ctx.moveTo(0,y);
  ctx.lineTo(W,y);
  ctx.stroke();
 }
}

function drawPlayer(){
 ctx.save();

 ctx.translate(
  player.x,
  player.y
 );

 ctx.rotate(player.aim);

 const c=weapon().color;

 ctx.shadowBlur=20;
 ctx.shadowColor=c;
 ctx.fillStyle=c;

 ctx.fillRect(
  0,
  -5,
  32,
  10
 );

 ctx.fillStyle=C.white;

 ctx.fillRect(
  26,
  -5,
  8,
  10
 );

 ctx.beginPath();
 ctx.moveTo(20,0);
 ctx.lineTo(-12,-10);
 ctx.lineTo(-7,0);
 ctx.lineTo(-12,10);
 ctx.closePath();
 ctx.fill();

 ctx.restore();

 if(
  player.dashCooldown<=0&&
  !gameOver
 ){
  ctx.strokeStyle=
   "rgba(0,255,255,.7)";

  ctx.lineWidth=2;

  ctx.beginPath();

  ctx.arc(
   player.x,
   player.y,
   player.r+
   10+
   Math.sin(performance.now()/100)*2,
   0,
   Math.PI*2
  );

  ctx.stroke();
 }

 if(
  has("shield")&&
  !player.emergencyShield&&
  !gameOver
 ){
  ctx.strokeStyle=
   "rgba(102,204,255,.7)";

  ctx.lineWidth=1.5;

  ctx.beginPath();

  ctx.arc(
   player.x,
   player.y,
   player.r+14,
   0,
   Math.PI*2
  );

  ctx.stroke();
 }
}

function drawBullets(){
 for(const b of bullets){
  ctx.save();

  ctx.translate(
   b.x,
   b.y
  );

  if(b.enemy){
   ctx.shadowBlur=12;
   ctx.shadowColor=C.red;
   ctx.fillStyle=C.red;

   ctx.beginPath();
   ctx.arc(
    0,
    0,
    b.r,
    0,
    Math.PI*2
   );
   ctx.fill();

   ctx.restore();
   continue;
  }

  const c=weapon().color;
  const angle=
   Math.atan2(
    b.dy,
    b.dx
   );

  ctx.shadowBlur=16;
  ctx.shadowColor=c;
  ctx.fillStyle=c;

  /*
   * Arc projectiles intentionally have no trail.
   * This prevents the old horizontal-bar artifact.
   */
  if(
   b.trail.length>1&&
   weapon().id!=="arc"
  ){
   ctx.save();

   ctx.globalAlpha=.35;

   ctx.beginPath();
   ctx.moveTo(0,0);

   for(
    let i=b.trail.length-1;
    i>=0;
    i--
   ){
    const t=b.trail[i];

    ctx.lineTo(
     t.x-b.x,
     t.y-b.y
    );
   }

   ctx.strokeStyle=c;
   ctx.lineWidth=
    b.laser?
     (b.width||5):
     2;

   ctx.stroke();

   ctx.restore();
  }

  ctx.rotate(angle);

  if(b.laser){
   ctx.fillRect(
    -24,
    -2.5,
    48,
    5
   );

   ctx.fillStyle=C.white;

   ctx.fillRect(
    -14,
    -1,
    28,
    2
   );
  }else if(
   weapon().id==="missile"
  ){
   ctx.fillStyle=C.purple;

   ctx.fillRect(
    -10,
    -4,
    18,
    8
   );

   ctx.fillStyle=C.orange;

   ctx.fillRect(
    -13,
    -2,
    5,
    4
   );
  }else{
   ctx.beginPath();

   ctx.arc(
    0,
    0,
    b.r,
    0,
    Math.PI*2
   );

   ctx.fill();
  }

  ctx.restore();
 }
}

function drawEnemies(){
 for(const e of enemies){
  ctx.save();

  ctx.translate(
   e.x,
   e.y
  );

  ctx.rotate(e.rot);

  ctx.shadowBlur=20;

  ctx.shadowColor=
   e.type==="boss"
    ?C.purple
    :C.red;

  let col=
   e.flash>0
    ?C.white
    :e.type==="boss"
     ?C.purple
     :e.type==="fast"
      ?C.orange
      :e.type==="leech"
       ?C.yellow
       :e.type==="charger"
        ?C.orange
        :e.type==="shooter"
         ?C.blue
         :C.red;

  ctx.fillStyle=col;

  if(e.type==="boss"){
   ctx.beginPath();

   ctx.arc(
    0,
    0,
    e.r,
    0,
    Math.PI*2
   );

   ctx.fill();

   ctx.fillStyle=C.bg;

   ctx.beginPath();

   ctx.arc(
    0,
    0,
    15,
    0,
    Math.PI*2
   );

   ctx.fill();

   ctx.strokeStyle=C.white;
   ctx.lineWidth=3;

   ctx.stroke();
  }else if(e.type==="tank"){
   ctx.fillRect(
    -e.r,
    -e.r,
    e.r*2,
    e.r*2
   );

   ctx.fillStyle=C.bg;

   ctx.fillRect(
    -7,
    -7,
    14,
    14
   );
  }else if(e.type==="fast"){
   ctx.beginPath();

   ctx.moveTo(e.r,0);
   ctx.lineTo(
    -e.r,
    -e.r*.75
   );
   ctx.lineTo(
    -e.r,
    e.r*.75
   );

   ctx.closePath();
   ctx.fill();
  }else if(e.type==="leech"){
   ctx.beginPath();

   ctx.arc(
    0,
    0,
    e.r,
    0,
    Math.PI*2
   );

   ctx.fill();

   ctx.fillStyle=C.bg;

   ctx.fillRect(
    -3,
    -e.r,
    6,
    e.r*2
   );
  }else if(e.type==="charger"){
   ctx.beginPath();

   ctx.moveTo(e.r,0);
   ctx.lineTo(
    -e.r,
    -e.r
   );
   ctx.lineTo(
    -e.r,
    e.r
   );

   ctx.closePath();
   ctx.fill();
  }else if(e.type==="shooter"){
   ctx.fillRect(
    -e.r*.7,
    -e.r*.7,
    e.r*1.4,
    e.r*1.4
   );

   ctx.fillStyle=C.white;

   ctx.fillRect(
    -3,
    -3,
    6,
    6
   );
  }else{
   ctx.beginPath();

   for(let i=0;i<8;i++){
    const a=i*Math.PI/4;
    const r=
     i%2?
      e.r*.45:
      e.r;

    const x=Math.cos(a)*r;
    const y=Math.sin(a)*r;

    if(i)
     ctx.lineTo(x,y);
    else
     ctx.moveTo(x,y);
   }

   ctx.closePath();
   ctx.fill();
  }

  if(e.elite){
   ctx.strokeStyle=C.yellow;
   ctx.lineWidth=2;

   ctx.beginPath();

   ctx.arc(
    0,
    0,
    e.r+5,
    0,
    Math.PI*2
   );

   ctx.stroke();
  }

  if(e.hp<e.maxHp){
   ctx.fillStyle=
    "rgba(255,255,255,.2)";

   ctx.fillRect(
    -e.r,
    e.r+7,
    e.r*2,
    3
   );

   ctx.fillStyle=C.white;

   ctx.fillRect(
    -e.r,
    e.r+7,
    e.r*2*
    Math.max(
     0,
     e.hp/e.maxHp
    ),
    3
   );
  }

  ctx.restore();
 }
}

function drawOrbs(){
 for(const o of orbList){
  const s=
   1+
   Math.sin(o.p)*.25;

  ctx.save();

  ctx.translate(
   o.x,
   o.y
  );

  ctx.scale(
   s,
   s
  );

  ctx.shadowBlur=25;
  ctx.shadowColor=C.yellow;
  ctx.fillStyle=C.yellow;

  ctx.beginPath();

  ctx.arc(
   0,
   0,
   o.r,
   0,
   Math.PI*2
  );

  ctx.fill();

  ctx.restore();
 }
}

function drawHazards(){
 for(const h of hazards){
  if(h.type==="explosion"){
   const p=
    1-h.life/h.maxLife;

   ctx.strokeStyle=C.purple;
   ctx.lineWidth=5;
   ctx.globalAlpha=1-p;

   ctx.beginPath();

   ctx.arc(
    h.x,
    h.y,
    h.maxR*p,
    0,
    Math.PI*2
   );

   ctx.stroke();
  }else if(h.type==="warning"){
   ctx.strokeStyle=C.red;
   ctx.lineWidth=3;

   ctx.globalAlpha=
    .5+
    .5*Math.sin(
     h.pulse*12
    );

   ctx.beginPath();

   ctx.arc(
    h.x,
    h.y,
    h.r,
    0,
    Math.PI*2
   );

   ctx.stroke();
  }else if(h.type==="mine"){
   ctx.strokeStyle=
    "rgba(255,23,68,.45)";

   ctx.lineWidth=2;

   ctx.beginPath();

   ctx.arc(
    h.x,
    h.y,
    h.r+
    Math.sin(h.pulse*4)*4,
    0,
    Math.PI*2
   );

   ctx.stroke();

   ctx.fillStyle=C.red;

   ctx.beginPath();

   ctx.arc(
    h.x,
    h.y,
    5,
    0,
    Math.PI*2
   );

   ctx.fill();
  }else if(h.type==="stun"){
   ctx.strokeStyle=C.orange;
   ctx.lineWidth=2;

   ctx.beginPath();

   ctx.arc(
    h.x,
    h.y,
    h.r,
    0,
    Math.PI*2
   );

   ctx.stroke();
  }else if(h.type==="gravity"){
   ctx.strokeStyle=C.purple;
   ctx.lineWidth=2;
   ctx.globalAlpha=.65;

   ctx.beginPath();

   ctx.arc(
    h.x,
    h.y,
    h.r*
    (1-h.life/h.maxLife),
    0,
    Math.PI*2
   );

   ctx.stroke();
  }else if(h.type==="arcPulse"){
   ctx.strokeStyle=C.green;
   ctx.lineWidth=4;
   ctx.globalAlpha=.8;

   ctx.beginPath();

   ctx.arc(
    h.x,
    h.y,
    h.maxR*
    (1-h.life/h.maxLife),
    0,
    Math.PI*2
   );

   ctx.stroke();
  }else if(h.type==="nova"){
   ctx.strokeStyle=C.cyan;
   ctx.lineWidth=4;
   ctx.globalAlpha=.85;

   ctx.beginPath();

   ctx.arc(
    h.x,
    h.y,
    h.maxR*
    (1-h.life/h.maxLife),
    0,
    Math.PI*2
   );

   ctx.stroke();
  }

  ctx.globalAlpha=1;
 }
}

function drawParticles(){
 for(const p of particles){
  ctx.globalAlpha=
   Math.max(
    0,
    p.life/p.max
   );

  if(p.type==="chain"){
   ctx.strokeStyle=p.color;
   ctx.shadowBlur=18;
   ctx.shadowColor=p.color;
   ctx.lineWidth=4;

   ctx.beginPath();

   p.nodes.forEach((n,i)=>{
    if(i)
     ctx.lineTo(n.x,n.y);
    else
     ctx.moveTo(n.x,n.y);
   });

   ctx.stroke();

   ctx.lineWidth=1;
   ctx.strokeStyle=C.white;

   ctx.stroke();
  }else{
   ctx.fillStyle=p.color;

   ctx.fillRect(
    p.x,
    p.y,
    p.size,
    p.size
   );
  }
 }

 ctx.globalAlpha=1;

 for(const t of texts){
  ctx.globalAlpha=
   Math.max(
    0,
    t.life
   );

  ctx.textAlign="center";
  ctx.font="bold 22px Arial";
  ctx.fillStyle=t.color;

  ctx.fillText(
   t.s,
   t.x,
   t.y
  );

  ctx.globalAlpha=1;
 }
}

function drawUI(){
 if(homeScreen)return;

 ctx.shadowBlur=0;
 ctx.textAlign="left";
 ctx.fillStyle=C.white;
 ctx.font="bold 20px Arial";

 ctx.fillText(
  "SCORE "+score,
  20,
  30
 );

 ctx.font="14px Arial";

 ctx.fillText(
  "WAVE "+
  wave+
  " · "+
  waveState.toUpperCase(),
  20,
  52
 );

 ctx.fillStyle=C.red;
 ctx.font="bold 14px Arial";

 ctx.fillText(
  "HP",
  20,
  75
 );

 for(
  let i=0;
  i<player.maxHealth;
  i++
 ){
  ctx.fillStyle=
   i<player.health
    ?C.red
    :"rgba(255,255,255,.15)";

  ctx.fillRect(
   50+i*18,
   65,
   13,
   10
  );
 }

 ctx.fillStyle=C.yellow;
 ctx.font="bold 15px Arial";

 ctx.fillText(
  "ORBS "+orbs,
  20,
  96
 );

 ctx.textAlign="right";
 ctx.fillStyle=C.white;
 ctx.font="14px Arial";

 ctx.fillText(
  "BEST "+highScore,
  W-20,
  30
 );

 if(
  waveModifier&&
  waveState==="combat"
 ){
  ctx.fillStyle=C.orange;

  ctx.fillText(
   waveModifier.name,
   W-20,
   52
  );
 }else if(
  waveState==="intermission"
 ){
  ctx.fillStyle=C.cyan;

  ctx.fillText(
   `NEXT WAVE ${Math.ceil(intermission)}s`,
   W-20,
   52
  );
 }

 ctx.textAlign="left";
 ctx.fillStyle="rgba(255,255,255,.7)";
 ctx.font="12px Arial";

 ctx.fillText(
  "WASD MOVE   IJKL AIM   SPACE FIRE   SHIFT DASH   P ARMORY",
  20,
  H-20
 );

 ctx.textAlign="right";

 ctx.fillText(
  weapon().name,
  W-20,
  H-20
 );

 ctx.textAlign="left";
}

function draw(){
 ctx.save();

 if(shake>0){
  ctx.translate(
   (Math.random()-.5)*shake,
   (Math.random()-.5)*shake
  );
 }

 drawBackground();
 drawHazards();
 drawOrbs();
 drawEnemies();
 drawBullets();
 drawParticles();
 drawPlayer();
 drawUI();

 ctx.restore();
}

function updateMessage(){
 if(abilityScreen){
  updateAbilityMessage();
  return;
 }

 if(weaponScreen){
  updateWeaponMessage();
  return;
 }

 if(armory){
  updateArmory();
  return;
 }

 if(homeScreen){
  message.innerHTML=`
  <h1 style="color:${C.cyan}">NEON ESCAPE</h1>

  <p>
   Survive escalating waves, spend limited resources between waves,
   and build a specialized weapon.
  </p>

  <div class="home-buttons">
   <button class="main-button" onclick="startRound()">PLAY ROUND</button>
   <button class="main-button secondary-button" onclick="showAbilities()">PERMANENT ABILITIES</button>
   <button class="main-button secondary-button" onclick="showWeapons()">WEAPONS</button>
  </div>

  <p class="small">
   ENTER / SPACE — Play · B — Abilities · V — Weapons
  </p>
  `;

  message.classList.add("show");
  return;
 }

 if(gameOver){
  message.innerHTML=`
  <h1 style="color:${C.red}">GAME OVER</h1>

  <p>Score: <strong>${score}</strong></p>
  <p>Best: <strong>${highScore}</strong></p>
  <p>Wave reached: <strong>${wave}</strong></p>
  <p>Orbs collected: <strong>${orbs}</strong></p>

  <button class="main-button" onclick="restart()">PLAY AGAIN</button>
  <button class="main-button secondary-button" onclick="goHome()">HOME</button>

  <p class="small">R — Play Again · H — Home</p>
  `;

  message.classList.add("show");
  return;
 }

 if(waveState==="intermission"){
  if(preWave){
   message.innerHTML=`
   <h1 style="color:${C.cyan}">READY</h1>

   <p>
    Wave 1 begins in
    <strong>${Math.ceil(intermission)}s</strong>.
   </p>

   <p class="small">
    Build your loadout in Permanent Abilities and Weapons before starting.
   </p>
   `;
  }else{
   message.innerHTML=`
   <h1 style="color:${C.cyan}">
    WAVE ${wave} COMPLETE
   </h1>

   <p>
    Breathing room:
    <strong>${Math.ceil(intermission)}s</strong>
   </p>

   <p>
    You received
    <strong style="color:${C.yellow}">
     ${waveReward()} orbs
    </strong>.
    No enemies or orbs spawn during the break.
   </p>

   <button class="main-button" onclick="openArmory()">
    OPEN ARMORY
   </button>

   <button class="main-button secondary-button" onclick="closeArmory()">
    SKIP
   </button>

   <p class="small">
    P — Armory during the break
   </p>
   `;
  }

  message.classList.add("show");
  return;
 }

 message.classList.remove("show");
}

function update(dt){
 if(armory||homeScreen||gameOver){
  updateParticles(dt);
  return;
 }

 timeAlive+=dt;

 score=
  Math.max(
   score,
   Math.floor(timeAlive*4)
  );

 shake=
  Math.max(
   0,
   shake-dt*12
  );

 if(player.fireCooldown>0)
  player.fireCooldown-=dt;

 if(player.dashCooldown>0)
  player.dashCooldown-=dt;

 let mx=
  (keys.d?1:0)-
  (keys.a?1:0);

 let my=
  (keys.s?1:0)-
  (keys.w?1:0);

 let ml=Math.hypot(mx,my);

 if(ml){
  mx/=ml;
  my/=ml;

  player.dashX=mx;
  player.dashY=my;
 }

 let ax=
  (keys.l||keys.arrowright?1:0)-
  (keys.j||keys.arrowleft?1:0);

 let ay=
  (keys.k||keys.arrowdown?1:0)-
  (keys.i||keys.arrowup?1:0);

 let al=Math.hypot(ax,ay);

 if(al){
  ax/=al;
  ay/=al;

  player.aimX=ax;
  player.aimY=ay;

  player.aim=
   Math.atan2(
    ay,
    ax
   );
 }

 if(keys[" "])
  shoot();

 if(waveState==="combat"){
  let speed=player.moveSpeed;

  if(
   player.dashTime>0
  ){
   player.dashTime-=dt;

   player.x+=
    player.dashX*
    player.dashSpeed*
    dt;

   player.y+=
    player.dashY*
    player.dashSpeed*
    dt;
  }else{
   player.x+=
    mx*
    speed*
    dt;

   player.y+=
    my*
    speed*
    dt;
  }

  player.x=
   Math.max(
    player.r,
    Math.min(
     W-player.r,
     player.x
    )
   );

  player.y=
   Math.max(
    player.r,
    Math.min(
     H-player.r,
     player.y
    )
   );

  updateWave(dt);
  updateBullets(dt);
  updateEnemyBullets(dt);
  updateEnemies(dt);
  updateHazards(dt);
  updateOrbs(dt);
 }else{
  updateWave(dt);
 }

 updateParticles(dt);
}

function frame(now){
 const dt=
  last===0
   ?0
   :Math.min(
    (now-last)/1000,
    .05
   );

 last=now;

 update(dt);
 draw();

 requestAnimationFrame(frame);
}

resize();
resetPlayer();
resetWeaponLevels();
applyUpgrades();
updateMessage();
requestAnimationFrame(frame);
