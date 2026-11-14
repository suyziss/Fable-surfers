import * as THREE from '../vendor/three.module.js';
import {Simulation, LANE_WIDTH, STEP} from './simulation.js';
import {createRunner,createGuard} from './character.js';
import {createTrain,createRamp,createBarrier,createSegment,createBackdrop} from './world-art.js';
import {AudioEngine} from './audio.js';

const $=id=>document.getElementById(id);
const storage={get(key,fallback){try{return localStorage.getItem(key)??fallback;}catch{return fallback;}},set(key,value){try{localStorage.setItem(key,String(value));}catch{}}};
const sim=new Simulation();
const audio=new AudioEngine();
let best=Number(storage.get('neonrails.best',0)),muted=storage.get('neonrails.muted','false')==='true';
let lowQuality=storage.get('neonrails.quality','high')==='low';
let cinema=false, elapsed=0, accumulator=0, previousFrame=0, deadTime=0, toastTimer=0, shake=0;
let lastHud=0, trailTimer=0, jumpHint=false, slideHint=false;
let newRecord=false;
audio.setMuted(muted);

const renderer=new THREE.WebGLRenderer({canvas:$('game'),antialias:true,alpha:false,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,lowQuality?1:1.65));
renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.05;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene();
scene.background=new THREE.Color('#a6e4e5');scene.fog=new THREE.Fog('#b5dedb',55,175);
const camera=new THREE.PerspectiveCamera(59,innerWidth/innerHeight,0.1,260);
camera.position.set(6,4.3,8.5);
scene.add(new THREE.HemisphereLight(0xd9fcff,0x8074a4,2.0));
const sun=new THREE.DirectionalLight(0xffe5ba,3.3);
sun.position.set(-22,34,17);sun.target.position.set(0,0,-21);
sun.castShadow=true;sun.shadow.mapSize.set(lowQuality?1024:2048,lowQuality?1024:2048);
Object.assign(sun.shadow.camera,{left:-27,right:27,top:38,bottom:-26,near:1,far:100});
sun.shadow.bias=-0.00035;sun.shadow.normalBias=0.035;
scene.add(sun,sun.target);
const fill=new THREE.DirectionalLight(0xa5dfff,0.65);fill.position.set(16,9,-35);scene.add(fill);
const runner=createRunner();scene.add(runner.group);
const guard=createGuard();scene.add(guard.group);
guard.group.position.set(-0.6,0,3.8);
const backdrop=createBackdrop();scene.add(backdrop);
const worldSegments=[];
for(let i=0;i<7;i++){const group=createSegment(i);group.position.z=36-i*36;scene.add(group);worldSegments.push({group,index:i-1});}
const entityRoot=new THREE.Group();scene.add(entityRoot);
const entityMeshes=new Map();

const gold=new THREE.MeshStandardMaterial({color:0xffd640,metalness:0.65,roughness:0.24,emissive:0xd99500,emissiveIntensity:0.12});
const innerGold=new THREE.MeshStandardMaterial({color:0xffec91,metalness:0.45,roughness:0.3});
const pickupWhite=new THREE.MeshStandardMaterial({color:0xf9f3d8,roughness:0.38});
const pickupRed=new THREE.MeshStandardMaterial({color:0xff546d,metalness:0.2,roughness:0.32,emissive:0xff244a,emissiveIntensity:0.17});
const pickupBlue=new THREE.MeshStandardMaterial({color:0x2ef5d3,metalness:0.3,roughness:0.25,emissive:0x00e2c5,emissiveIntensity:0.3});
const coinGeo=new THREE.CylinderGeometry(0.34,0.34,0.105,18);
const coinRingGeo=new THREE.TorusGeometry(0.274,0.026,5,18);
const coinMarkGeo=new THREE.BoxGeometry(0.062,0.32,0.017);
const coinPrototype=new THREE.Group();
const coinBody=new THREE.Mesh(coinGeo,gold);coinBody.rotation.x=Math.PI/2;coinPrototype.add(coinBody);
for(const z of [-0.064,0.064]){const ring=new THREE.Mesh(coinRingGeo,innerGold);ring.position.z=z;coinPrototype.add(ring);const mark=new THREE.Mesh(coinMarkGeo,innerGold);mark.position.z=z;mark.rotation.z=-0.26;coinPrototype.add(mark);}
const coinBatches=coinPrototype.children.map(child=>{child.updateMatrix();const batch=new THREE.InstancedMesh(child.geometry,child.material,512);batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);batch.frustumCulled=false;scene.add(batch);return {batch,local:child.matrix.clone()};});
const coinTransform=new THREE.Object3D(),coinMatrix=new THREE.Matrix4();
const flyingCoins=[];
const flyingPool=Array.from({length:36},()=>{const m=coinPrototype.clone();m.visible=false;scene.add(m);return m;});
let flyingCursor=0;
function attractCoin(e) {
  const m=flyingPool[flyingCursor++%flyingPool.length];
  for(let i=flyingCoins.length-1;i>=0;i--)if(flyingCoins[i].mesh===m)flyingCoins.splice(i,1);
  m.position.set(e.lane*LANE_WIDTH,e.y,sim.distance-e.s);m.scale.setScalar(1);m.visible=true;
  flyingCoins.push({mesh:m,life:0});
}
const magnetPrototype=new THREE.Group();
const arc=new THREE.Mesh(new THREE.TorusGeometry(0.35,0.12,8,16,Math.PI),pickupRed);magnetPrototype.add(arc);
for(const x of [-0.35,0.35]){const leg=new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.12,0.27,8),pickupRed);leg.position.set(x,-0.12,0);magnetPrototype.add(leg);const tip=new THREE.Mesh(new THREE.CylinderGeometry(0.123,0.123,0.15,8),pickupWhite);tip.position.set(x,-0.32,0);magnetPrototype.add(tip);}
const pickupRingGeo=new THREE.TorusGeometry(0.69,0.023,6,28);
const pickupRingMat=new THREE.MeshBasicMaterial({color:0x77ffe6,transparent:true,opacity:0.7});
const boardPrototype=new THREE.Group();
const boardShape=new THREE.Mesh(new THREE.CapsuleGeometry(0.17,0.75,4,8),pickupBlue);boardShape.rotation.z=-0.5;boardPrototype.add(boardShape);
for(const y of [-0.31,0.31]){const stripe=new THREE.Mesh(new THREE.BoxGeometry(0.29,0.09,0.14),pickupRed);stripe.position.y=y;stripe.rotation.z=-0.5;boardPrototype.add(stripe);}

const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=64;
const shadowCtx=shadowCanvas.getContext('2d'),shadowGradient=shadowCtx.createRadialGradient(32,32,2,32,32,30);
shadowGradient.addColorStop(0,'rgba(18,32,58,.46)');shadowGradient.addColorStop(1,'rgba(18,32,58,0)');shadowCtx.fillStyle=shadowGradient;shadowCtx.fillRect(0,0,64,64);
const shadowTex=new THREE.CanvasTexture(shadowCanvas);
const contactShadow=new THREE.Mesh(new THREE.PlaneGeometry(2.5,2.1),new THREE.MeshBasicMaterial({map:shadowTex,transparent:true,depthWrite:false}));
contactShadow.rotation.x=-Math.PI/2;contactShadow.position.y=0.08;scene.add(contactShadow);

// All small effects share a single instanced mesh and a fixed allocation.
const particleCount=240;
const particles=new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.085),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.88}),particleCount);
particles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);particles.frustumCulled=false;scene.add(particles);
const particleData=Array.from({length:particleCount},()=>({life:0,x:0,y:0,z:0,vx:0,vy:0,vz:0,max:1,size:1}));
let particleCursor=0;
const dummy=new THREE.Object3D();const color=new THREE.Color();
function burst(x,y,z,tint=0xffdb51,count=10,strength=1) {
  for(let i=0;i<count;i++){
    const index=particleCursor++%particleCount,p=particleData[index];
    Object.assign(p,{life:0.35+Math.random()*0.4,max:0.8,x,y,z,vx:(Math.random()-.5)*5*strength,vy:(Math.random()*3+1)*strength,vz:(Math.random()-.5)*4*strength,size:0.5+Math.random()});
    particles.setColorAt(index,color.set(tint));
  }
  if(particles.instanceColor)particles.instanceColor.needsUpdate=true;
}
function updateParticles(dt) {
  particleData.forEach((p,i)=>{
    p.life=Math.max(0,p.life-dt);
    if(p.life>0){p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;p.vy-=7*dt;dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(elapsed*4,elapsed*5,i);dummy.scale.setScalar(p.size*Math.min(1,p.life*4));}
    else dummy.scale.setScalar(0);
    dummy.updateMatrix();particles.setMatrixAt(i,dummy.matrix);
  });particles.instanceMatrix.needsUpdate=true;
}

const magnetField=new THREE.Group();
for(let i=0;i<3;i++){const ring=new THREE.Mesh(new THREE.TorusGeometry(1.1+i*.25,0.015,5,48),new THREE.MeshBasicMaterial({color:0x53ffe1,transparent:true,opacity:0.3-i*.05,depthWrite:false}));ring.rotation.x=Math.PI/2+i*.3;ring.position.y=.5+i*.5;magnetField.add(ring);}scene.add(magnetField);
const streakPositions=new Float32Array(40*6);
for(let i=0;i<40;i++){const side=i%2?-1:1;let x=side*(5+Math.random()*6),y=.6+Math.random()*5,z=-Math.random()*75;streakPositions.set([x,y,z,x,y,z+1.8+Math.random()*3],i*6);}
const streakGeo=new THREE.BufferGeometry();streakGeo.setAttribute('position',new THREE.BufferAttribute(streakPositions,3));
const streakMat=new THREE.LineBasicMaterial({color:0xfff6cd,transparent:true,opacity:0.08,depthWrite:false});
const streaks=new THREE.LineSegments(streakGeo,streakMat);scene.add(streaks);

function meshFor(e) {
  let m;
  if(e.type==='train')m=createTrain(e.length,e.variant);
  else if(e.type==='ramp')m=createRamp(e.length);
  else if(e.type==='coin')m=coinPrototype.clone();
  else if(e.type==='magnet'||e.type==='boardPickup') {
    m=new THREE.Group();const item=(e.type==='magnet'?magnetPrototype:boardPrototype).clone();m.add(item);
    const ring=new THREE.Mesh(pickupRingGeo,pickupRingMat);m.add(ring);
    m.userData.item=item;m.userData.ring=ring;
  } else m=createBarrier(e.type);
  m.userData.kind=e.type;entityRoot.add(m);return m;
}
function syncEntities() {
  const alive=new Set();let coinCount=0;
  for(const e of sim.entities){
    if(e.type==='coin'){
      if(e.s-sim.distance>180||e.s-sim.distance< -20)continue;
      coinTransform.position.set(e.lane*LANE_WIDTH,e.y+Math.sin(elapsed*3+e.s*.18)*.055,sim.distance-e.s);
      coinTransform.rotation.y=elapsed*2.7+e.s*.08;coinTransform.updateMatrix();
      for(const {batch,local} of coinBatches){coinMatrix.multiplyMatrices(coinTransform.matrix,local);batch.setMatrixAt(coinCount,coinMatrix);}
      coinCount++;continue;
    }
    alive.add(e.id);let m=entityMeshes.get(e.id);if(!m){m=meshFor(e);entityMeshes.set(e.id,m);}
    m.position.set(e.lane*LANE_WIDTH,e.y,sim.distance-e.s);
    if(e.type==='coin'){m.rotation.y=elapsed*2.7+e.s*.08;m.position.y+=Math.sin(elapsed*3+e.s*.18)*.055;}
    if(e.type==='magnet'||e.type==='boardPickup'){m.position.y+=Math.sin(elapsed*3.8)*.16;m.userData.item.rotation.y=elapsed*1.7;m.userData.ring.rotation.y=-elapsed*1.2;m.userData.ring.rotation.z=elapsed*.3;}
    m.visible=m.position.z<20&&m.position.z>-180;
    if(e.moving&&sim.mode==='running'&&!m.userData.horn&&e.s-sim.distance<38){m.userData.horn=true;audio.play('train');}
  }
  for(const {batch} of coinBatches){batch.count=coinCount;batch.instanceMatrix.needsUpdate=true;}
  for(const [id,m] of entityMeshes)if(!alive.has(id)){releaseEntity(m);entityMeshes.delete(id);}
}
function releaseEntity(m){m.traverse(o=>{if(o.isInstancedMesh)o.dispose();});entityRoot.remove(m);}
function resetEntities(){for(const m of entityMeshes.values())releaseEntity(m);entityMeshes.clear();for(let i=0;i<worldSegments.length;i++)worldSegments[i].index=i-1;for(const m of flyingPool)m.visible=false;flyingCoins.length=0;}

function toast(message,duration=2) { $('toast').textContent=message;$('toast').classList.add('visible');toastTimer=duration; }
function flash(type='gold'){$('flash').className='flash '+type;requestAnimationFrame(()=>$('flash').classList.add('active'));setTimeout(()=>$('flash').classList.remove('active'),180);}
function updateSoundButton(){$('mute-button').setAttribute('aria-pressed',String(muted));$('mute-button').setAttribute('aria-label',muted?'Включить звук':'Отключить звук');}
function toggleMute(){muted=!muted;audio.setMuted(muted);storage.set('neonrails.muted',muted);updateSoundButton();if(!muted)audio.unlock();}
function toggleCinema(){cinema=!cinema;document.body.classList.toggle('cinema',cinema);if(cinema)toast('H — вернуть интерфейс',1.5);}
function toggleQuality(){lowQuality=!lowQuality;storage.set('neonrails.quality',lowQuality?'low':'high');renderer.setPixelRatio(Math.min(devicePixelRatio,lowQuality?1:1.65));sun.shadow.mapSize.set(lowQuality?1024:2048,lowQuality?1024:2048);if(sun.shadow.map){sun.shadow.map.dispose();sun.shadow.map=null;}toast(lowQuality?'Графика: экономичный режим · Q':'Графика: высокое качество · Q');}
function updateHud(force=false) {
  if(!force&&elapsed-lastHud<.09)return;lastHud=elapsed;
  $('score').textContent=sim.score.toLocaleString('ru-RU');$('coins').textContent=String(sim.coins).padStart(3,'0');
  $('best').textContent=Math.max(best,sim.score).toLocaleString('ru-RU');$('speed').textContent=Math.round(sim.speed*3.6);
  $('board-count').textContent=sim.boards;
  $('magnet-status').textContent=sim.magnetTime>0?'МАГНИТ · '+Math.ceil(sim.magnetTime)+'с':'МАГНИТ';
  $('magnet-status').classList.toggle('active',sim.magnetTime>0);
  $('board-status').textContent=sim.boardTime>0?'ЩИТ · '+Math.ceil(sim.boardTime)+'с':'B · ХОВЕРБОРД';
  $('board-status').classList.toggle('active',sim.boardTime>0);
  if($('multiplier'))$('multiplier').textContent=Math.floor(sim.distance)+' м';
}
async function startRun() {
  audio.unlock().then(()=>{if(sim.mode==='running')audio.startMusic();}).catch(()=>{});audio.startMusic();
  sim.start();resetEntities();deadTime=0;accumulator=0;shake=0;jumpHint=false;slideHint=false;newRecord=false;
  cinema=false;document.body.classList.remove('cinema');
  $('menu').hidden=true;$('game-over').hidden=true;$('pause-menu').hidden=true;$('hud').hidden=false;
  $('touch-controls').hidden=!matchMedia('(pointer: coarse)').matches;
  runner.group.rotation.set(0,0,0);camera.position.set(0,5.1,9.6);
  toast('Беги!  A / D — меняй путь',3);updateHud(true);
  $('game').focus();
}
function pauseRun() {
  if(sim.mode==='running'){sim.mode='paused';$('pause-menu').hidden=false;audio.stopMusic();}
  else if(sim.mode==='paused'){sim.mode='running';$('pause-menu').hidden=true;audio.startMusic();previousFrame=performance.now();}
}
function finishRun() {
  best=Math.max(best,sim.score);storage.set('neonrails.best',best);
  $('final-score').textContent=sim.score.toLocaleString('ru-RU');$('final-coins').textContent=sim.coins;
  $('final-best').textContent=best.toLocaleString('ru-RU');
  if($('result-label'))$('result-label').textContent=newRecord?'НОВЫЙ РЕКОРД!':'ПОГОНЯ ОКОНЧЕНА';
  $('game-over').hidden=false;$('hud').hidden=true;document.body.classList.remove('cinema');cinema=false;
  $('touch-controls').hidden=true;
  $('restart-button').focus();
}
function processEvents() {
  for(const ev of sim.events){
    if(ev.type==='coin') {audio.play('coin');if(ev.magnet)attractCoin(ev.entity);else burst(ev.entity.lane*LANE_WIDTH,ev.entity.y,Math.max(-7,sim.distance-ev.entity.s),0xffd54d,5);}
    if(ev.type==='jump') {audio.play('jump');burst(sim.player.x,sim.player.y+.1,.25,0xe9e5c6,7,.5);}
    if(ev.type==='land') {audio.play('land');burst(sim.player.x,sim.player.y+.12,0,0xffeed2,7,.6);}
    if(ev.type==='lane')audio.play('whoosh');
    if(ev.type==='slide')audio.play('slide');
    if(ev.type==='board') {audio.play('board');toast('Ховерборд: одно столкновение прощается',2.5);burst(sim.player.x,.25,0,0x55ffdb,25);}
    if(ev.type==='magnet') {audio.play('magnet');toast('Магнит! Монеты летят к тебе',2);flash('mint');burst(sim.player.x,1,0,0x40ffdf,20);}
    if(ev.type==='boardPickup'){audio.play('board');toast('+1 ховерборд · нажми B');}
    if(ev.type==='reward'){audio.play('board');toast(Math.floor(sim.distance)+' м! +1 ховерборд',2.5);}
    if(ev.type==='shield'){audio.play('crash');shake=.55;flash('mint');toast('Щит спас! Продолжай бежать',2);burst(sim.player.x,.6,0,0x39ffda,40,1.8);}
    if(ev.type==='crash'){newRecord=sim.score>best;best=Math.max(best,sim.score);storage.set('neonrails.best',best);audio.play('crash');audio.stopMusic();shake=.6;deadTime=0;flash('red');burst(sim.player.x,1,0,0xff795e,28,1.4);}
    if(ev.type==='dodge')burst(sim.player.x,.1,0,0x8ef5e1,3,.5);
  }sim.events.length=0;
}

function updateScenery() {
  for(const seg of worldSegments){
    while(sim.distance-seg.index*36>54)seg.index+=worldSegments.length;
    while(sim.distance-seg.index*36<-(worldSegments.length-1)*36)seg.index-=worldSegments.length;
    seg.group.position.z=sim.distance-seg.index*36;
  }
}
function visualUpdate(dt) {
  const p=sim.player,running=sim.mode==='running',ready=sim.mode==='ready',dead=sim.mode==='dead';
  runner.group.scale.setScalar(ready?1.65:1);
  if(!ready){runner.group.position.set(p.x,p.y+(sim.boardTime>0?.13:0),0);runner.group.rotation.y=0;}
  else {runner.group.position.set(4.2,.12,1);runner.group.rotation.y=Math.PI*.86;}
  runner.setBoard(sim.boardTime>0);
  runner.update(dt,{time:elapsed,speed:running?sim.speed:ready?1:0,running:running||ready,jumping:!p.grounded,sliding:p.slide>0,dead,laneLean:(p.lane*LANE_WIDTH-p.x)*.21,board:sim.boardTime>0,landing:p.landing});
  if(sim.invincible>0)runner.group.visible=Math.sin(elapsed*38)>-.5;else runner.group.visible=true;
  contactShadow.position.set(p.x,Math.max(.035,sim.groundAt(p.x,sim.distance)+.035),.05);
  contactShadow.material.opacity=1-Math.min(.6,(p.y-sim.groundAt(p.x,sim.distance))*.19);
  contactShadow.scale.setScalar(1+Math.max(0,p.y-sim.groundAt(p.x,sim.distance))*.15);
  guard.group.visible=ready||(running&&sim.time<5.0)||dead;
  let guardZ=ready?3.6:3.5+sim.time*.9;
  if(dead)guardZ=Math.max(1.0,6-deadTime*4.5);
  guard.group.position.set(ready?1.7:p.x*.7,0,ready?-4:guardZ);
  guard.group.rotation.y=ready?Math.PI*.9:0;
  guard.update(dt,{time:elapsed+1,speed:dead&&deadTime>1.2?0:sim.speed,running:!dead||deadTime<1.2,jumping:false,sliding:false,dead:false,laneLean:0,board:false,landing:0});
  if(ready){camera.position.lerp(new THREE.Vector3(6.1+Math.sin(elapsed*.12)*.6,3.5,7.5),1-Math.exp(-dt*2));camera.lookAt(.1,1.5,-7);}
  else {
    let targetFov=59+(sim.speed-17)*.26+(sim.boardTime>0?2:0);if(dead)targetFov=58;
    camera.fov+=(targetFov-camera.fov)*(1-Math.exp(-dt*3));camera.updateProjectionMatrix();
    const elevation=p.y*.52;
    camera.position.x+=(p.x*.19-camera.position.x)*(1-Math.exp(-dt*4));
    camera.position.y+=(5.35+elevation-camera.position.y)*(1-Math.exp(-dt*6));
    camera.position.z+=(9.7-camera.position.z)*(1-Math.exp(-dt*3));
    if(shake>0){camera.position.x+=(Math.random()-.5)*shake*.25;camera.position.y+=(Math.random()-.5)*shake*.22;shake=Math.max(0,shake-dt*1.5);}
    camera.lookAt(p.x*.14,1.55+p.y*.38,-12.5);
  }
  magnetField.visible=sim.magnetTime>0;magnetField.position.set(p.x,p.y,0);magnetField.rotation.y=elapsed*1.5;
  for(let i=flyingCoins.length-1;i>=0;i--){const c=flyingCoins[i];c.life+=dt;c.mesh.position.lerp(new THREE.Vector3(p.x,p.y+1,0),1-Math.exp(-dt*12));c.mesh.rotation.y+=dt*10;c.mesh.scale.setScalar(Math.max(.15,1-c.life*1.8));if(c.life>.36){c.mesh.visible=false;flyingCoins.splice(i,1);burst(p.x,p.y+1,0,0xffdd6a,3,.5);}}
  if(sim.boardTime>0&&running){trailTimer+=dt;if(trailTimer>.035){trailTimer=0;burst(p.x,p.y+.05,.65,0x58ffe1,2,.28);}}
  streaks.visible=running;streakMat.opacity=.02+Math.max(0,sim.speed-18)*.008;
  const pos=streakGeo.attributes.position;
  if(running){for(let i=0;i<40;i++){let z=pos.array[i*6+2]+sim.speed*dt*1.8;if(z>8)z=-75;pos.array[i*6+2]=z;pos.array[i*6+5]=z+2.4;}pos.needsUpdate=true;}
  updateParticles(dt);syncEntities();updateScenery();
  if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)$('toast').classList.remove('visible');}
  if(running){if(sim.distance>27&&!jumpHint){toast('ПРОБЕЛ — перепрыгни барьер',2);jumpHint=true;}if(sim.distance>58&&!slideHint){toast('S или ↓ — подкат под перекладиной',2);slideHint=true;}}
}
function frame(now) {
  const realDt=Math.min(.07,(now-(previousFrame||now))/1000);previousFrame=now;
  if(sim.mode!=='paused'){
    elapsed+=realDt;
    if(sim.mode==='running'){
      accumulator+=realDt;
      while(accumulator>=STEP){sim.update(STEP);accumulator-=STEP;if(sim.mode!=='running'){accumulator=0;break;}}
      processEvents();audio.update(sim.speed,realDt);updateHud();
    }
    if(sim.mode==='dead'){const before=deadTime;deadTime+=realDt;if(before<1.55&&deadTime>=1.55)finishRun();}
    visualUpdate(realDt);
  }
  renderer.render(scene,camera);requestAnimationFrame(frame);
}

const keys={KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right',Space:'jump',ArrowUp:'jump',KeyW:'jump',KeyS:'slide',ArrowDown:'slide',KeyB:'board'};
addEventListener('keydown',event=>{
  if(keys[event.code]||['Escape','KeyP','KeyH','KeyM','KeyF','KeyQ','Enter'].includes(event.code))event.preventDefault();
  if(event.repeat)return;
  if(event.code==='KeyM'){toggleMute();return;}
  if(event.code==='KeyH'){toggleCinema();return;}
  if(event.code==='KeyF'){toggleFullscreen();return;}
  if(event.code==='KeyQ'){toggleQuality();return;}
  if(event.code==='Escape'||event.code==='KeyP'){pauseRun();return;}
  if((event.code==='Enter'||event.code==='Space')&&(sim.mode==='ready'||(sim.mode==='dead'&&deadTime>0.8))){startRun();return;}
  if(keys[event.code])sim.action(keys[event.code]);
});
function toggleFullscreen(){if(document.fullscreenElement)document.exitFullscreen?.();else document.documentElement.requestFullscreen?.().catch(()=>toast('Полный экран: F11'));}
$('start-button').addEventListener('click',startRun);$('restart-button').addEventListener('click',startRun);
$('pause-button').addEventListener('click',pauseRun);$('resume-button').addEventListener('click',pauseRun);
$('mute-button').addEventListener('click',toggleMute);$('cinema-button')?.addEventListener('click',toggleCinema);
$('fullscreen-button')?.addEventListener('click',toggleFullscreen);
for(const button of document.querySelectorAll('[data-action]'))button.addEventListener('pointerdown',e=>{e.preventDefault();sim.action(button.dataset.action);});
let touchStart=null;
$('game').addEventListener('pointerdown',e=>{touchStart={x:e.clientX,y:e.clientY,time:performance.now()};});
$('game').addEventListener('pointerup',e=>{
  if(!touchStart)return;const dx=e.clientX-touchStart.x,dy=e.clientY-touchStart.y;
  if(Math.max(Math.abs(dx),Math.abs(dy))>24)sim.action(Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'slide':'jump');
  else if(performance.now()-touchStart.time<220){if(window.__lastTap&&performance.now()-window.__lastTap<310)sim.action('board');window.__lastTap=performance.now();}touchStart=null;
});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&sim.mode==='running')pauseRun();});
addEventListener('blur',()=>{if(sim.mode==='running')pauseRun();});
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();if(sim.mode==='running')pauseRun();toast('Графический контекст потерян. Обновите страницу.',30);});
updateSoundButton();updateHud(true);syncEntities();visualUpdate(0);
$('loading').hidden=true;
requestAnimationFrame(frame);

// Inspection is read-only during normal play. Mutating test controls only exist with ?test=1.
window.neonRails={snapshot:()=>sim.snapshot(),stats:()=>({drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,meshes:entityMeshes.size}),version:'1.0.0'};
if(new URLSearchParams(location.search).get('test')==='1') {
  window.neonRails.test={sim,start:()=>startRun(),action:a=>sim.action(a),step(seconds){for(let i=0;i<seconds/STEP&&sim.mode==='running';i++)sim.update(STEP);processEvents();visualUpdate(0);updateHud(true);},clear(){sim.entities=[];resetEntities();sim.nextChunk=Math.ceil((sim.distance+1000)/96);},add:(...args)=>sim.add(...args),render:()=>{visualUpdate(0);renderer.render(scene,camera);}};
}

