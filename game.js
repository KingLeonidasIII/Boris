"use strict";

const canvas=document.getElementById("game"),ctx=canvas.getContext("2d"),message=document.getElementById("message");
let W=innerWidth,H=innerHeight,dpr=1,last=0;
const C={bg:"#05050a",cyan:"#00ffff",red:"#ff1744",yellow:"#ffe600",white:"#fff",pink:"#ff66cc",orange:"#ff9d00",purple:"#a66cff",green:"#66ffcc"};

const keys=Object.create(null);
const prevent=["w","a","s","d","i","j","k","l","arrowup","arrowdown","arrowleft","arrowright"," ","shift","p","r","h","b","v","escape","enter","1","2","3","4","5","6","7","8","9","q","e"];

addEventListener("keydown",e=>{
 const k=e.key.toLowerCase();
 keys[k]=true;
 if(prevent.includes(k))e.preventDefault();
 if(e.repeat)return;

 if(weaponScreen){if(k==="escape"||k==="b")home();else weaponKey(k);return}
 if(abilityScreen){if(k==="escape"||k==="b")home();else abilityKey(k);return}
 if(homeScreen){if(k==="enter"||k===" ")start();else if(k==="b")showAbilities();else if(k==="v")showWeapons();return}
 if(gameOver){if(k==="r")start();else if(k==="h")home();return}

 if(k==="p")toggleShop();
 if(k===" ")shoot();
 if(k==="shift")dash();
});

addEventListener("keyup",e=>keys[e.key.toLowerCase()]=false);
addEventListener("blur",()=>Object.keys(keys).forEach(k=>keys[k]=false));

let homeScreen=true,abilityScreen=false,weaponScreen=false,paused=false,gameOver=false;
let score=0,orbs=0,timeAlive=0,spawnTimer=0,orbTimer=0,shopCooldown=0,shopDelay=1.5,shake=0,highScore=0;

try{highScore=+localStorage.getItem("neonHighScore")||0}catch(e){}

const player={
 x:W/2,y:H/2,r:14,health:3,maxHealth:3,moveSpeed:300,
 aim:0,aimX:1,aimY:0,fireCooldown:0,fireRate:.16,damage:1,
 bulletSpeed:850,dashCooldown:0,dashMax:1.1,dashTime:0,
 dashDuration:.12,dashSpeed:1000,dashX:1,dashY:0,
 emergencyShield:false,pickups:0
};

const bullets=[],enemies=[],orbList=[],particles=[];

const WEAPONS=[
 {id:"pulse",name:"PULSE CANNON",color:C.cyan,desc:"Balanced energy weapon with reliable damage and fire rate.",rate:.16,damage:1,speed:850,life:1.25},
 {id:"rail",name:"RAILGUN",color:C.orange,desc:"Heavy piercing round. Slow, but it can pass through enemies.",rate:.55,damage:4,speed:1400,life:1.2,pierce:2},
 {id:"scatter",name:"BLAST SHOTGUN",color:C.pink,desc:"Fires a wide cone of low-damage pellets.",rate:.28,damage:.55,speed:800,life:.9,pellets:7,spread:.72},
 {id:"laser",name:"LASER",color:"#ff3355",desc:"Rapid beam that pierces enemies and stays active briefly.",rate:.12,damage:.7,speed:1900,life:.28,pierce:4,laser:true},
 {id:"missile",name:"MISSILE LAUNCHER",color:C.purple,desc:"Slow rockets that explode on impact.",rate:.48,damage:3,speed:500,life:2.2,explosion:58},
 {id:"arc",name:"ARC CASTER",color:C.green,desc:"Electrical shots jump between nearby enemies.",rate:.24,damage:1.2,speed:1000,life:1.1,chain:2,chainRange:125}
];

const ABILITIES=[
 {id:"hull",name:"REINFORCED HULL",desc:"Start with +1 maximum health.",color:"#ff5555"},
 {id:"shield",name:"EMERGENCY SHIELD",desc:"The first collision each run causes no damage.",color:"#66ccff"},
 {id:"magnet",name:"MAGNETIC CORE",desc:"Attract yellow orbs from 85 pixels away.",color:C.yellow},
 {id:"scavenger",name:"SCAVENGER",desc:"Kills have a 12% chance to create an extra orb.",color:C.yellow},
 {id:"quickstart",name:"QUICK START",desc:"Enemy spawning is 25% slower for the first five seconds.",color:C.cyan},
 {id:"overcharge",name:"OVERCHARGED CORE",desc:"Weapon damage is increased by 15%.",color:C.orange},
 {id:"stabilizers",name:"STABILIZERS",desc:"Movement speed is increased by 10%.",color:"#00ff88"},
 {id:"afterburner",name:"AFTERBURNER",desc:"Dash cooldown is reduced by 12%.",color:C.purple},
 {id:"quickhands",name:"QUICK HANDS",desc:"Weapon firing delay is reduced by 10%.",color:C.cyan},
 {id:"barrel",name:"THICK BARREL",desc:"Projectile speed and lifetime are increased.",color:"#ff7b00"},
 {id:"collector",name:"COLLECTOR",desc:"Every fifth orb collected gives an additional orb.",color:C.yellow},
 {id:"laststand",name:"LAST STAND",desc:"At 1 HP, movement speed increases by 20%.",color:C.red},
 {id:"training",name:"COMBAT TRAINING",desc:"Enemy collisions knock you backward.",color:C.white}
];

let selectedWeapon="pulse",abilities=[null,null],wLevels={};

try{
 const w=localStorage.getItem("neonWeapon");
 if(WEAPONS.some(x=>x.id===w))selectedWeapon=w;
 const a=JSON.parse(localStorage.getItem("neonAbilities")||"null");
 if(Array.isArray(a)&&a.length===2)abilities=a.map(x=>ABILITIES.some(y=>y.id===x)?x:null);
}catch(e){}

const general={
 rapid:{name:"RAPID FIRE",desc:"20% less weapon delay per level.",cost:3,max:3,level:0},
 heavy:{name:"HEAVY WEAPON",desc:"+1 base damage per level.",cost:5,max:2,level:0},
 thrusters:{name:"THRUSTERS",desc:"+15% movement speed per level.",cost:4,max:3,level:0},
 overdrive:{name:"OVERDRIVE",desc:"20% less dash cooldown per level.",cost:6,max:2,level:0}
};

const weaponUpgrades={
 pulse:[
  {id:"pulseOverclock",name:"OVERCLOCK",desc:"20% faster Pulse Cannon fire rate.",cost:3,max:3},
  {id:"pulseAmplifier",name:"AMPLIFIER",desc:"+0.35 Pulse damage.",cost:5,max:2},
  {id:"pulseResonance",name:"RESONANCE",desc:"15% kill chance to spawn an extra orb.",cost:6,max:2}
 ],
 rail:[
  {id:"railPenetrator",name:"PENETRATOR",desc:"+1 enemy pierced per level.",cost:5,max:2},
  {id:"railAccelerator",name:"ACCELERATOR",desc:"25% faster rail rounds.",cost:4,max:2},
  {id:"railOvercharge",name:"RAIL OVERCHARGE",desc:"+1.5 Railgun damage.",cost:7,max:2}
 ],
 scatter:[
  {id:"scatterWide",name:"WIDE CHOKE",desc:"20% wider pellet cone.",cost:4,max:2},
  {id:"scatterBuckshot",name:"BUCKSHOT",desc:"+0.15 pellet damage.",cost:4,max:3},
  {id:"scatterBurst",name:"BURST LOAD",desc:"+2 pellets per shot.",cost:6,max:2}
 ],
 laser:[
  {id:"laserFocus",name:"FOCUS LENS",desc:"+0.25 Laser damage.",cost:5,max:3},
  {id:"laserReach",name:"EXTENDED BEAM",desc:"25% longer beam lifetime.",cost:4,max:2},
  {id:"laserPhase",name:"PHASE LENS",desc:"+2 enemies pierced.",cost:6,max:2}
 ],
 missile:[
  {id:"missileWarhead",name:"WARHEAD",desc:"+18 explosion radius.",cost:5,max:2},
  {id:"missileFuel",name:"ROCKET FUEL",desc:"25% faster missiles.",cost:4,max:2},
  {id:"missilePayload",name:"HEAVY PAYLOAD",desc:"+1 missile impact damage.",cost:6,max:2}
 ],
 arc:[
  {id:"arcChain",name:"CHAIN LINK",desc:"+1 electrical chain jump.",cost:5,max:2},
  {id:"arcVoltage",name:"HIGH VOLTAGE",desc:"+0.35 Arc damage.",cost:5,max:3},
  {id:"arcReach",name:"CONDUCTOR",desc:"+25 chain range.",cost:4,max:2}
 ]
};

function weapon(){return WEAPONS.find(w=>w.id===selectedWeapon)||WEAPONS[0]}
function has(id){return abilities.includes(id)}
function lvl(id){return wLevels[id]||0}

function resetWeaponLevels(){
 wLevels={};
 weaponUpgrades[selectedWeapon].forEach(u=>wLevels[u.id]=0);
}

function applyUpgrades(){
 const w=weapon();
 let rate=w.rate*Math.pow(.8,general.rapid.level);
 if(has("quickhands"))rate*=.9;
 if(selectedWeapon==="pulse")rate*=Math.pow(.8,lvl("pulseOverclock"));
 player.fireRate=rate;

 let damage=w.damage+general.heavy.level;
 if(has("overcharge"))damage*=1.15;
 if(selectedWeapon==="pulse")damage+=.35*lvl("pulseAmplifier");
 if(selectedWeapon==="rail")damage+=1.5*lvl("railOvercharge");
 if(selectedWeapon==="laser")damage+=.25*lvl("laserFocus");
 if(selectedWeapon==="missile")damage+=lvl("missilePayload");
 if(selectedWeapon==="arc")damage+=.35*lvl("arcVoltage");
 player.damage=damage;

 player.moveSpeed=300*(has("stabilizers")?1.1:1)*(1+.15*general.thrusters.level);
 player.dashMax=1.1*(has("afterburner")?.88:1)*Math.pow(.8,general.overdrive.level);
 player.bulletSpeed=w.speed*(has("barrel")?1.12:1);

 if(selectedWeapon==="rail")player.bulletSpeed*=1+.25*lvl("railAccelerator");
 if(selectedWeapon==="missile")player.bulletSpeed*=1+.25*lvl("missileFuel");
}

function clearObjects(){
 bullets.length=enemies.length=orbList.length=particles.length=0;
}

function resetPlayer(){
 player.maxHealth=has("hull")?4:3;
 player.health=player.maxHealth;
 player.x=W/2;player.y=H/2;
 player.fireCooldown=player.dashCooldown=player.dashTime=0;
 player.aim=0;player.aimX=1;player.aimY=0;
 player.dashX=1;player.dashY=0;
 player.emergencyShield=false;player.pickups=0;
}

function start(){
 homeScreen=abilityScreen=weaponScreen=paused=gameOver=false;
 score=orbs=timeAlive=0;
 spawnTimer=.25;orbTimer=getOrbInterval();
 shopCooldown=0;shopDelay=1.5;shake=0;last=0;
 clearObjects();resetPlayer();resetWeaponLevels();applyUpgrades();

 // Explicitly remove every menu/death/shop overlay.
 message.classList.remove("show");
 message.innerHTML="";
}

function home(){
 homeScreen=true;
 abilityScreen=weaponScreen=paused=gameOver=false;
 last=0;
 clearObjects();
 updateMessage();
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
 try{localStorage.setItem("neonWeapon",id)}catch(e){}
 updateWeaponMessage();
}

function weaponKey(k){
 const i="123456".indexOf(k);
 if(i>=0)selectWeapon(WEAPONS[i].id);
}

function toggleAbility(i){
 if(i<0||i>=ABILITIES.length)return;
 const id=ABILITIES[i].id,old=abilities.indexOf(id);

 if(old>=0)abilities[old]=null;
 else{
  const slot=abilities.indexOf(null);
  if(slot<0)return;
  abilities[slot]=id;
 }

 try{localStorage.setItem("neonAbilities",JSON.stringify(abilities))}catch(e){}
 updateAbilityMessage();
}

function abilityKey(k){
 const map={1:0,2:1,3:2,4:3,5:4,6:5,7:6,8:7,9:8,q:9,w:10,e:11,r:12};
 if(map[k]!==undefined)toggleAbility(map[k]);
}

function updateAbilityMessage(){
 message.innerHTML=`
 <h1 style="color:${C.cyan}">ABILITIES</h1>
 <p>Choose two permanent abilities. They remain active in every new run.</p>
 <div class="grid">${ABILITIES.map((a,i)=>{
  const s=has(a.id),slot=abilities.indexOf(a.id);
  const key=i<9?i+1:["Q","W","E","R"][i-9];
  return `<div class="card ${s?"selected":""}" onclick="toggleAbility(${i})">
   <span class="key">${key}</span>
   <h3 style="color:${s?C.yellow:a.color}">${a.name}</h3>
   <p>${a.desc}</p>
   ${s?`<span class="label">EQUIPPED — SLOT ${slot+1}</span>`:""}
  </div>`;
 }).join("")}</div>
 <p style="font-size:12px;color:#777">Keyboard: 1–9, Q, W, E, R</p>
 <button class="main-button secondary-button" onclick="home()">BACK TO HOME</button>`;

 message.classList.add("show");
}

function updateWeaponMessage(){
 const w=weapon();

 message.innerHTML=`
 <h1 style="color:${w.color}">WEAPONS</h1>
 <p>Choose one permanent weapon. Weapon-specific Armory upgrades only last for the current run.</p>
 <div class="grid">${WEAPONS.map((x,i)=>`
  <div class="card ${x.id===selectedWeapon?"selected":""}" onclick="selectWeapon('${x.id}')">
   <span class="key">${i+1}</span>
   <h3 style="color:${x.color}">${x.name}</h3>
   <p>${x.desc}</p>
   <p>Damage ${x.damage} · Fire ${x.rate.toFixed(2)}s</p>
   ${x.id===selectedWeapon?'<span class="label">EQUIPPED</span>':""}
  </div>`).join("")}</div>
 <p style="font-size:12px;color:#777">Keyboard: 1–6</p>
 <button class="main-button secondary-button" onclick="home()">BACK TO HOME</button>`;

 message.classList.add("show");
}

function shopItem(id,name,desc,cost,max,level,color){
 const can=orbs>=cost&&level<max;
 return `<div class="card shop">
  <h3 style="color:${color}">${name}</h3>
  <p>${desc}<br>Level ${level}/${max}</p>
  <button onclick="buyUpgrade('${id}')" ${can?"":"disabled"}>
   ${level>=max?"MAXED":"BUY — "+cost+" ORBS"}
  </button>
 </div>`;
}

function updateShopMessage(){
 const w=weapon();
 const cd=shopCooldown>0?`Cooldown: ${shopCooldown.toFixed(1)}s`:"SHOP READY";

 let html=`
 <h1 style="color:${C.cyan}">ARMORY</h1>
 <p>Yellow orbs: <strong style="color:${C.yellow}">${orbs}</strong></p>
 <p style="font-size:12px;color:#777">${cd} · Press P to close</p>
 <h2 style="font-size:15px;color:${w.color}">${w.name} UPGRADES</h2>
 <div class="grid">`;

 for(const [id,u] of Object.entries(general))
  html+=shopItem(id,u.name,u.desc,u.cost,u.max,u.level,
   id==="heavy"?C.orange:id==="thrusters"?"#00ff88":id==="overdrive"?C.purple:C.cyan);

 html+=shopItem("repair","REPAIR","Restore one health point.",2,1,
  player.health>=player.maxHealth?1:0,C.red);

 weaponUpgrades[selectedWeapon].forEach(u=>
  html+=shopItem(u.id,u.name,u.desc,u.cost,u.max,lvl(u.id),w.color)
 );

 message.innerHTML=html+"</div>";
 message.classList.add("show");
}

function toggleShop(){
 if(gameOver||homeScreen||shopDelay>0)return;

 if(paused){
  paused=false;
  message.classList.remove("show");
  return;
 }

 if(shopCooldown>0)return;

 paused=true;
 shopCooldown=10;
 updateShopMessage();
}

function buyUpgrade(id){
 if(!paused||gameOver||homeScreen)return;

 if(id==="repair"){
  if(orbs>=2&&player.health<player.maxHealth){
   orbs-=2;
   player.health++;
   burst(player.x,player.y,C.cyan,15,180);
   updateShopMessage();
  }
  return;
 }

 if(general[id]){
  const u=general[id];
  if(u.level>=u.max||orbs<u.cost)return;
  orbs-=u.cost;
  u.level++;
  applyUpgrades();
  burst(player.x,player.y,C.yellow,15,180);
  updateShopMessage();
  return;
 }

 const u=weaponUpgrades[selectedWeapon].find(x=>x.id===id);
 if(!u||lvl(id)>=u.max||orbs<u.cost)return;

 orbs-=u.cost;
 wLevels[id]++;
 applyUpgrades();
 burst(player.x,player.y,weapon().color,15,180);
 updateShopMessage();
}

window.start=start;
window.home=home;
window.showAbilities=showAbilities;
window.showWeapons=showWeapons;
window.toggleAbility=toggleAbility;
window.selectWeapon=selectWeapon;
window.buyUpgrade=buyUpgrade;

function edge(m=50){
 switch(Math.floor(Math.random()*4)){
  case 0:return{x:Math.random()*W,y:-m};
  case 1:return{x:W+m,y:Math.random()*H};
  case 2:return{x:Math.random()*W,y:H+m};
  default:return{x:-m,y:Math.random()*H};
 }
}

function enemyInterval(){return Math.max(.16,1-timeAlive*.009)}
function getOrbInterval(){return Math.max(.65,2.5*enemyInterval())}

function spawnEnemy(){
 const p=edge(),d=1+timeAlive/30,r=Math.random();
 let e={x:p.x,y:p.y,rot:Math.random()*7,flash:0};

 if(timeAlive>20&&r<.2)
  Object.assign(e,{type:"fast",r:9,speed:115*d,hp:1,points:150});
 else if(timeAlive>45&&r>.82)
  Object.assign(e,{type:"tank",r:22,speed:42*d,hp:3,maxHp:3,points:400});
 else
  Object.assign(e,{type:"normal",r:14,speed:62*d,hp:1,points:100});

 enemies.push(e);
}

function spawnOrb(){
 const p=70;
 orbList.push({
  x:p+Math.random()*Math.max(1,W-p*2),
  y:p+Math.random()*Math.max(1,H-p*2),
  r:7,p:Math.random()*7,life:8
 });
}

function burst(x,y,color,n=10,speed=150){
 for(let i=0;i<n;i++){
  const a=Math.random()*Math.PI*2,v=speed*(.3+Math.random()*.7);
  particles.push({
   x,y,dx:Math.cos(a)*v,dy:Math.sin(a)*v,
   life:.3+Math.random()*.5,max:.8,size:1.5+Math.random()*3,color
  });
 }
}

function flash(x,y,color,size=20){
 particles.push({x,y,dx:0,dy:0,life:.12,max:.12,size,color});
}

function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}

function makeBullet(angle,damage,extra={}){
 const m=31,w=weapon();

 bullets.push({
  x:player.x+Math.cos(angle)*m,
  y:player.y+Math.sin(angle)*m,
  dx:Math.cos(angle),dy:Math.sin(angle),
  r:extra.r||4,
  speed:extra.speed||player.bulletSpeed,
  damage,life:extra.life||1.25,
  pierce:extra.pierce||0,
  explosion:extra.explosion||0,
  chain:extra.chain||0,
  chainRange:extra.chainRange||125,
  laser:!!extra.laser,
  type:w.id,
  color:w.color,
  hit:new Set(),
  trail:0
 });
}

function shoot(){
 if(gameOver||paused||homeScreen||player.fireCooldown>0)return;

 const w=weapon();

 if(w.id==="scatter"){
  const n=w.pellets+2*lvl("scatterBurst");
  const spread=w.spread*(1+.2*lvl("scatterWide"));

  for(let i=0;i<n;i++){
   const a=player.aim+(n===1?0:(i/(n-1)-.5)*spread);
   makeBullet(a,player.damage*(.5+.15*lvl("scatterBuckshot")),{
    speed:player.bulletSpeed,life:w.life,r:3
   });
  }

  muzzle(C.pink,30,16);
 }else{
  const x={
   speed:player.bulletSpeed,
   life:w.life,
   pierce:w.pierce||0,
   laser:w.laser
  };

  if(w.id==="rail")x.pierce+=lvl("railPenetrator");
  if(w.id==="laser"){
   x.life*=1+.25*lvl("laserReach");
   x.pierce+=2*lvl("laserPhase");
   x.r=3;
  }
  if(w.id==="missile")x.explosion=w.explosion+18*lvl("missileWarhead");
  if(w.id==="arc"){
   x.chain=w.chain+lvl("arcChain");
   x.chainRange=w.chainRange+25*lvl("arcReach");
  }

  makeBullet(player.aim,player.damage,x);
  muzzle(w.color,30,w.id==="missile"?20:10);
 }

 player.fireCooldown=player.fireRate;
 shake=Math.max(shake,w.id==="missile"?4:2);
}

function muzzle(color,length=30,n=8){
 burst(
  player.x+player.aimX*length,
  player.y+player.aimY*length,
  color,n,190
 );
 flash(
  player.x+player.aimX*length,
  player.y+player.aimY*length,
  color,
  16
 );
}

function dash(){
 if(gameOver||paused||homeScreen||player.dashCooldown>0)return;

 let x=(keys.d||keys.arrowright?1:0)-(keys.a||keys.arrowleft?1:0);
 let y=(keys.s||keys.arrowdown?1:0)-(keys.w||keys.arrowup?1:0);
 const n=Math.hypot(x,y);

 if(!n){x=player.dashX;y=player.dashY}
 else{x/=n;y/=n}

 player.dashX=x;player.dashY=y;
 player.dashTime=player.dashDuration;
 player.dashCooldown=player.dashMax;

 burst(player.x,player.y,C.cyan,20,250);
}

function hitPlayer(){
 if(has("shield")&&!player.emergencyShield){
  player.emergencyShield=true;
  burst(player.x,player.y,"#66ccff",30,260);
  shake=7;
  return;
 }

 player.health--;
 burst(player.x,player.y,C.red,25,240);
 shake=9;

 if(player.health<=0)endGame();
}

function explode(x,y,r,damage,source){
 burst(x,y,C.purple,22,260);
 flash(x,y,C.purple,r);
 shake=Math.max(shake,7);

 for(let i=enemies.length-1;i>=0;i--){
  const e=enemies[i];
  if(dist({x,y},e)>r+e.r)continue;
  if(source?.hit?.has(e))continue;
  source?.hit?.add(e);

  e.hp-=damage;
  e.flash=.08;

  if(e.hp<=0)killEnemy(i);
 }
}

function chainAttack(x,y,damage,jumps,range,exclude){
 let from={x,y},used=new Set(exclude||[]);

 for(let n=0;n<jumps;n++){
  let best=-1,bestD=range+1;

  for(let i=0;i<enemies.length;i++){
   if(used.has(enemies[i]))continue;
   const d=dist(from,enemies[i]);
   if(d<bestD){bestD=d;best=i}
  }

  if(best<0)break;

  const e=enemies[best];
  used.add(e);
  e.hp-=damage;
  e.flash=.1;

  particles.push({
   x:from.x,y:from.y,dx:0,dy:0,
   life:.18,max:.18,size:bestD,color:C.green
  });

  burst(e.x,e.y,C.green,7,130);

  if(e.hp<=0)killEnemy(best);
  from={x:e.x,y:e.y};
 }
}

function killEnemy(i){
 const e=enemies[i];
 score+=e.points;

 if(has("scavenger")&&Math.random()<.12&&orbList.length<6)spawnOrb();
 if(selectedWeapon==="pulse"&&Math.random()<.15*lvl("pulseResonance")&&orbList.length<6)spawnOrb();

 burst(e.x,e.y,C.red,e.type==="tank"?28:16,220);
 enemies.splice(i,1);
}

function updateBullets(dt){
 for(let i=bullets.length-1;i>=0;i--){
  const b=bullets[i];

  // Trails are particles instead of permanent canvas paths.
  if(b.type!=="laser"){
   b.trail-=dt;
   if(b.trail<=0){
    b.trail=.025;
    particles.push({
     x:b.x,y:b.y,dx:0,dy:0,
     life:.12,max:.12,size:b.type==="missile"?5:2.5,color:b.color
    });
   }
  }

  b.x+=b.dx*b.speed*dt;
  b.y+=b.dy*b.speed*dt;
  b.life-=dt;

  if(b.life<=0||b.x<-70||b.x>W+70||b.y<-70||b.y>H+70){
   bullets.splice(i,1);
   continue;
  }

  let remove=false;

  for(let j=enemies.length-1;j>=0&&!remove;j--){
   const e=enemies[j];
   if(b.hit.has(e)||dist(b,e)>b.r+e.r)continue;

   b.hit.add(e);
   e.hp-=b.damage;
   e.flash=.08;

   burst(b.x,b.y,b.color,b.type==="rail"?7:4,120);

   if(b.explosion)explode(b.x,b.y,b.explosion,b.damage*.75,b);
   if(b.chain)chainAttack(e.x,e.y,b.damage*.65,b.chain,b.chainRange,b.hit);

   if(e.hp<=0)killEnemy(j);

   if(b.pierce>0)b.pierce--;
   else if(!b.laser)remove=true;
  }

  if(remove)bullets.splice(i,1);
 }
}

function updateEnemies(dt){
 for(let i=enemies.length-1;i>=0;i--){
  const e=enemies[i];
  const a=Math.atan2(player.y-e.y,player.x-e.x);

  e.x+=Math.cos(a)*e.speed*dt;
  e.y+=Math.sin(a)*e.speed*dt;
  e.rot+=dt*(e.type==="fast"?4:2);
  e.flash=Math.max(0,e.flash-dt);

  if(dist(player,e)<player.r+e.r){
   enemies.splice(i,1);

   if(has("training")){
    player.x+=Math.cos(a)*55;
    player.y+=Math.sin(a)*55;
    clampPlayer();
   }

   hitPlayer();
   if(gameOver)return;
  }
 }
}

function updateOrbs(dt){
 const magnet=has("magnet")?85:0;

 for(let i=orbList.length-1;i>=0;i--){
  const o=orbList[i];
  o.life-=dt;
  o.p+=dt*5;

  if(magnet){
   const dx=player.x-o.x,dy=player.y-o.y,d=Math.hypot(dx,dy);
   if(d>0&&d<magnet){
    const pull=180*(1-d/magnet);
    o.x+=dx/d*pull*dt;
    o.y+=dy/d*pull*dt;
   }
  }

  if(dist(player,o)<player.r+o.r+5){
   player.pickups++;
   orbs+=has("collector")&&player.pickups%5===0?2:1;
   burst(o.x,o.y,C.yellow,20,210);
   orbList.splice(i,1);
  }else if(o.life<=0)orbList.splice(i,1);
 }
}

function updateParticles(dt){
 for(let i=particles.length-1;i>=0;i--){
  const p=particles[i];
  p.life-=dt;
  p.x+=p.dx*dt;
  p.y+=p.dy*dt;
  p.dx*=Math.pow(.05,dt);
  p.dy*=Math.pow(.05,dt);

  if(p.life<=0)particles.splice(i,1);
 }
}

function clampPlayer(){
 player.x=Math.max(player.r,Math.min(W-player.r,player.x));
 player.y=Math.max(player.r,Math.min(H-player.r,player.y));
}

function update(dt){
 if(shopCooldown>0)shopCooldown=Math.max(0,shopCooldown-dt);
 if(shopDelay>0)shopDelay=Math.max(0,shopDelay-dt);

 if(paused||gameOver||homeScreen){
  updateParticles(dt);
  return;
 }

 timeAlive+=dt;
 score=Math.max(score,Math.floor(timeAlive*10));
 shake=Math.max(0,shake-dt*12);

 let mx=(keys.d?1:0)-(keys.a?1:0);
 let my=(keys.s?1:0)-(keys.w?1:0);
 const ml=Math.hypot(mx,my);

 if(ml){
  mx/=ml;my/=ml;
  player.dashX=mx;
  player.dashY=my;
 }

 let ax=(keys.l||keys.arrowright?1:0)-(keys.j||keys.arrowleft?1:0);
 let ay=(keys.k||keys.arrowdown?1:0)-(keys.i||keys.arrowup?1:0);
 const al=Math.hypot(ax,ay);

 if(al){
  ax/=al;ay/=al;
  player.aimX=ax;
  player.aimY=ay;
  player.aim=Math.atan2(ay,ax);
 }

 player.fireCooldown-=dt;
 player.dashCooldown-=dt;

 if(keys[" "])shoot();

 let speed=player.moveSpeed;
 if(has("laststand")&&player.health===1)speed*=1.2;

 if(player.dashTime>0){
  player.dashTime-=dt;
  player.x+=player.dashX*player.dashSpeed*dt;
  player.y+=player.dashY*player.dashSpeed*dt;
 }else{
  player.x+=mx*speed*dt;
  player.y+=my*speed*dt;
 }

 clampPlayer();

 spawnTimer-=dt;
 let ei=enemyInterval();
 if(has("quickstart")&&timeAlive<5)ei*=1.25;

 if(spawnTimer<=0){
  spawnEnemy();
  spawnTimer=ei;
 }

 orbTimer-=dt;

 if(orbTimer<=0){
  if(orbList.length<3)spawnOrb();
  orbTimer=getOrbInterval();
 }

 updateBullets(dt);
 updateEnemies(dt);
 updateOrbs(dt);
 updateParticles(dt);
}

function endGame(){
 gameOver=true;

 if(score>highScore){
  highScore=score;
  try{localStorage.setItem("neonHighScore",highScore)}catch(e){}
 }

 burst(player.x,player.y,C.red,50,300);
 shake=12;
 updateMessage();
}

function drawBackground(){
 ctx.fillStyle=C.bg;
 ctx.fillRect(-20,-20,W+40,H+40);

 ctx.strokeStyle="rgba(0,255,255,.07)";
 ctx.lineWidth=1;

 for(let x=0;x<=W;x+=50){
  ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();
 }

 for(let y=0;y<=H;y+=50){
  ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();
 }
}

function drawPlayer(){
 ctx.save();
 ctx.translate(player.x,player.y);
 ctx.rotate(player.aim);

 const c=weapon().color;

 ctx.shadowBlur=18;
 ctx.shadowColor=c;
 ctx.fillStyle=c;

 ctx.fillRect(0,-5,32,10);
 ctx.fillStyle=C.white;
 ctx.fillRect(26,-5,8,10);

 ctx.beginPath();
 ctx.moveTo(20,0);
 ctx.lineTo(-12,-10);
 ctx.lineTo(-7,0);
 ctx.lineTo(-12,10);
 ctx.closePath();
 ctx.fill();

 ctx.restore();

 if(player.dashCooldown<=0&&!gameOver){
  ctx.strokeStyle="rgba(0,255,255,.7)";
  ctx.lineWidth=2;
  ctx.beginPath();
  ctx.arc(player.x,player.y,player.r+9+Math.sin(performance.now()/100)*2,0,Math.PI*2);
  ctx.stroke();
 }

 if(has("shield")&&!player.emergencyShield&&!gameOver){
  ctx.strokeStyle="rgba(102,204,255,.7)";
  ctx.lineWidth=1.5;
  ctx.beginPath();
  ctx.arc(player.x,player.y,player.r+14,0,Math.PI*2);
  ctx.stroke();
 }
}

function drawBullets(){
 for(const b of bullets){
  ctx.save();
  ctx.translate(b.x,b.y);
  ctx.rotate(Math.atan2(b.dy,b.dx));

  ctx.shadowBlur=18;
  ctx.shadowColor=b.color;
  ctx.fillStyle=b.color;

  if(b.type==="laser"){
   ctx.globalAlpha=.85;
   ctx.fillRect(-25,-3,50,6);
   ctx.globalAlpha=.35;
   ctx.fillRect(-45,-1,90,2);
  }
  else if(b.type==="rail"){
   ctx.fillRect(-16,-3,32,6);
   ctx.fillStyle=C.white;
   ctx.fillRect(-9,-2,18,4);
  }
  else if(b.type==="missile"){
   ctx.fillStyle=b.color;
   ctx.fillRect(-8,-4,16,8);
   ctx.fillStyle=C.orange;
   ctx.beginPath();
   ctx.moveTo(-8,0);
   ctx.lineTo(-19,-5);
   ctx.lineTo(-19,5);
   ctx.closePath();
   ctx.fill();
  }
  else if(b.type==="arc"){
   ctx.beginPath();
   ctx.arc(0,0,b.r+2,0,Math.PI*2);
   ctx.strokeStyle=b.color;
   ctx.lineWidth=2;
   ctx.stroke();
   ctx.fill();
  }
  else{
   ctx.beginPath();
   ctx.arc(0,0,b.r,0,Math.PI*2);
   ctx.fill();
  }

  ctx.restore();
 }
}

function drawEnemies(){
 for(const e of enemies){
  ctx.save();
  ctx.translate(e.x,e.y);
  ctx.rotate(e.rot);

  ctx.shadowBlur=18;
  ctx.shadowColor=C.red;
  ctx.fillStyle=e.flash>0?C.white:C.red;

  if(e.type==="tank"){
   ctx.fillRect(-e.r,-e.r,e.r*2,e.r*2);
   ctx.fillStyle=C.bg;
   ctx.fillRect(-7,-7,14,14);
  }
  else if(e.type==="fast"){
   ctx.beginPath();
   ctx.moveTo(e.r,0);
   ctx.lineTo(-e.r,-e.r*.65);
   ctx.lineTo(-e.r,e.r*.65);
   ctx.closePath();
   ctx.fill();
  }
  else{
   ctx.beginPath();
   for(let i=0;i<8;i++){
    const a=i*Math.PI/4,r=i%2?e.r*.45:e.r;
    const x=Math.cos(a)*r,y=Math.sin(a)*r;
    i?ctx.lineTo(x,y):ctx.moveTo(x,y);
   }
   ctx.closePath();
   ctx.fill();
  }

  if(e.type==="tank"){
   ctx.fillStyle="rgba(255,255,255,.2)";
   ctx.fillRect(-e.r,e.r+7,e.r*2,3);
   ctx.fillStyle=C.white;
   ctx.fillRect(-e.r,e.r+7,e.r*2*Math.max(0,e.hp/e.maxHp),3);
  }

  ctx.restore();
 }
}

function drawOrbs(){
 for(const o of orbList){
  const s=1+Math.sin(o.p)*.25;

  ctx.save();
  ctx.translate(o.x,o.y);
  ctx.scale(s,s);

  ctx.shadowBlur=25;
  ctx.shadowColor=C.yellow;
  ctx.fillStyle=C.yellow;

  ctx.beginPath();
  ctx.arc(0,0,o.r,0,Math.PI*2);
  ctx.fill();

  ctx.restore();
 }
}

function drawParticles(){
 for(const p of particles){
  ctx.globalAlpha=Math.max(0,p.life/p.max);

  if(p.size>20&&p.dx===0){
   ctx.strokeStyle=p.color;
   ctx.lineWidth=2;
   ctx.beginPath();
   ctx.moveTo(p.x,p.y);
   ctx.lineTo(p.x+p.size,p.y);
   ctx.stroke();
  }else{
   ctx.fillStyle=p.color;
   ctx.fillRect(p.x-p.size/2,p.y-p.size/2,p.size,p.size);
  }
 }

 ctx.globalAlpha=1;
}

function drawUI(){
 if(homeScreen)return;

 ctx.shadowBlur=0;
 ctx.textAlign="left";

 ctx.fillStyle=C.white;
 ctx.font="bold 20px Arial";
 ctx.fillText("SCORE "+score,20,30);

 ctx.font="14px Arial";
 ctx.fillText("TIME "+timeAlive.toFixed(1)+"s",20,52);

 ctx.fillStyle=C.red;
 ctx.font="bold 14px Arial";
 ctx.fillText("HP",20,75);

 for(let i=0;i<player.maxHealth;i++){
  ctx.fillStyle=i<player.health?C.red:"rgba(255,255,255,.15)";
  ctx.fillRect(50+i*18,65,13,10);
 }

 ctx.fillStyle=C.yellow;
 ctx.font="bold 15px Arial";
 ctx.fillText("ORBS "+orbs,20,96);

 ctx.textAlign="right";
 ctx.fillStyle=C.white;
 ctx.font="14px Arial";
 ctx.fillText("BEST "+highScore,W-20,30);

 if(shopCooldown>0){
  ctx.fillStyle=C.red;
  ctx.fillText("SHOP "+shopCooldown.toFixed(1)+"s",W-20,52);
 }else if(shopDelay>0){
  ctx.fillStyle="#777";
  ctx.fillText("SHOP LOADING",W-20,52);
 }else{
  ctx.fillStyle=C.cyan;
  ctx.fillText("SHOP READY",W-20,52);
 }

 ctx.textAlign="left";
 ctx.fillStyle="rgba(255,255,255,.7)";
 ctx.font="12px Arial";
 ctx.fillText("WASD MOVE   IJKL AIM   SPACE FIRE   SHIFT DASH   P SHOP",20,H-20);

 ctx.textAlign="right";
 ctx.fillText(weapon().name,W-20,H-20);
 ctx.textAlign="left";
}

function draw(){
 ctx.save();

 if(shake>0)
  ctx.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);

 drawBackground();
 drawOrbs();
 drawEnemies();
 drawBullets();
 drawParticles();
 drawPlayer();
 drawUI();

 ctx.restore();
}

function updateMessage(){
 if(abilityScreen){updateAbilityMessage();return}
 if(weaponScreen){updateWeaponMessage();return}

 if(homeScreen){
  message.innerHTML=`
   <h1 style="color:${C.cyan}">NEON ESCAPE</h1>
   <p>Survive, destroy enemies, collect yellow orbs and spend them in the Armory.</p>
   <div class="home-buttons">
    <button class="main-button" onclick="start()">PLAY ROUND</button>
    <button class="main-button secondary-button" onclick="showAbilities()">PERMANENT ABILITIES</button>
    <button class="main-button secondary-button" onclick="showWeapons()">WEAPONS</button>
   </div>
   <p style="font-size:12px;color:#777">ENTER / SPACE — Play · B — Abilities · V — Weapons</p>`;

  message.classList.add("show");
  return;
 }

 if(gameOver){
  message.innerHTML=`
   <h1 style="color:${C.red}">GAME OVER</h1>
   <p>Score: <strong>${score}</strong></p>
   <p>Best: <strong>${highScore}</strong></p>
   <p>Orbs collected: <strong>${orbs}</strong></p>
   <button class="main-button" onclick="start()">PLAY AGAIN</button>
   <button class="main-button secondary-button" onclick="home()">HOME</button>
   <p style="font-size:12px;color:#777">R — Play Again · H — Home</p>`;

  message.classList.add("show");
  return;
 }

 if(paused){
  updateShopMessage();
  return;
 }

 message.classList.remove("show");
}

function resize(){
 dpr=Math.min(devicePixelRatio||1,2);
 W=innerWidth;
 H=innerHeight;

 canvas.width=W*dpr;
 canvas.height=H*dpr;
 canvas.style.width=W+"px";
 canvas.style.height=H+"px";

 ctx.setTransform(dpr,0,0,dpr,0,0);

 if(typeof player!=="undefined")clampPlayer();
}

addEventListener("resize",resize);

function frame(now){
 const dt=last?Math.min((now-last)/1000,.05):0;
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
