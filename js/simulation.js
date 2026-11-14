export const LANE_WIDTH = 3.3;
export const TRAIN_HEIGHT = 3.1;
export const STEP = 1 / 120;
const clamp = (x,a,b) => Math.max(a,Math.min(b,x));

export class Simulation {
  constructor(seed = 72026) { this.seed = seed; this.reset(); }
  reset() {
    this.randomState = this.seed; this.entities = []; this.nextId = 1;
    this.distance = 0; this.time = 0; this.speed = 17; this.coins = 0;
    this.mode = 'ready'; this.nextChunk = 0; this.safeLane = 0;
    this.boardTime = 0; this.boards = 3; this.magnetTime = 0;
    this.invincible = 0; this.combo = 0; this.nextBoardReward = 500;
    this.player = {lane:0,x:0,y:0,vy:0,slide:0,grounded:true,coyote:0.1,jumpBuffer:0,landing:0};
    this.events = []; this.generateAhead();
  }
  random() { let t = this.randomState += 0x6D2B79F5; t=Math.imul(t^t>>>15,t|1); t^=t+Math.imul(t^t>>>7,t|61); return ((t^t>>>14)>>>0)/4294967296; }
  get score() { return Math.floor(this.distance*10+this.coins*25); }
  emit(type,data={}) { this.events.push({type,...data}); }
  start() { this.reset(); this.mode='running'; this.emit('start'); }
  action(action) {
    if(this.mode!=='running') return;
    const p=this.player;
    if(action==='left'||action==='right') {
      const next=clamp(p.lane+(action==='left'?-1:1),-1,1);
      if(next!==p.lane) { p.lane=next;this.emit('lane'); }
    }
    if(action==='jump') { p.jumpBuffer=0.16; p.slide=0; }
    if(action==='slide') { p.slide=0.86; p.jumpBuffer=0; if(!p.grounded) p.vy=Math.min(p.vy,-14);this.emit('slide'); }
    if(action==='board'&&this.boards>0&&this.boardTime<=0) {
      this.boards--;this.boardTime=22;this.emit('board');
    }
  }
  add(type,lane,s,extra={}) { const e={id:this.nextId++,type,lane,s,y:0,length:0.7,...extra}; this.entities.push(e);return e; }
  coinsLine(lane,start,end,spacing=3.6,height=1.05) { for(let s=start;s<=end;s+=spacing)this.add('coin',lane,s,{y:height}); }
  generateAhead() { while(this.nextChunk*96<this.distance+285) this.generateChunk(this.nextChunk++); }
  generateChunk(i) {
    const base=i*96;
    if(i===0) {
      this.safeLane=1;
      this.coinsLine(0,9,29); this.add('low',0,39);this.coinsLine(0,36,44,2,1.95);
      this.add('high',0,72);this.coinsLine(0,67,78);
      this.add('train',-1,64,{length:20,variant:0});
      this.coinsLine(1,42,85); this.add('magnet',1,53,{y:1.2});
      return;
    }
    const oldSafe=this.safeLane;
    let safe;
    if(i===1) safe=0;
    else { const choices=[-1,0,1].filter(l=>Math.abs(l-oldSafe)<=1);safe=choices[Math.floor(this.random()*choices.length)]; }
    this.safeLane=safe;
    const others=[-1,0,1].filter(l=>l!==safe);
    // The first 18m and last 16m form a completely clear transition zone.
    // An oncoming car is confined to one occupied lane, with an open lane alongside.
    const roofLane=others[0], secondLane=others[1];
    const variant=i%5;
    if(variant===1||variant===3) {
      this.add('ramp',roofLane,base+24,{length:10});
      this.add('train',roofLane,base+40,{length:22,variant:i%4});
      this.add('train',roofLane,base+66,{length:22,variant:(i+1)%4});
      for(let q=0;q<7;q++)this.add('coin',roofLane,base+20+q*1.35,{y:1.05+(q*1.35+1)/10*3.1});
      this.coinsLine(roofLane,base+31,base+48,3.4,4.15);
      this.coinsLine(roofLane,base+50,base+56,2,5.1);
      this.coinsLine(roofLane,base+59,base+75,3.4,4.15);
      this.add('low',secondLane,base+31);this.add('high',secondLane,base+63);
      this.coinsLine(secondLane,base+42,base+57);
    } else if(variant===2) {
      this.add('train',roofLane,base+58,{length:20,variant:i%4,moving:true,travel:0});
      this.add('high',secondLane,base+30);this.add('low',secondLane,base+62);
      this.coinsLine(secondLane,base+38,base+53);
    } else if(variant===4) {
      this.add('train',roofLane,base+40,{length:25,variant:i%4});
      this.add('block',secondLane,base+29,{length:1.15});
      this.add('high',secondLane,base+66);
      this.coinsLine(secondLane,base+41,base+57);
    } else {
      this.add('low',roofLane,base+28);this.add('high',roofLane,base+62);
      this.add('high',secondLane,base+30);this.add('low',secondLane,base+65);
      this.coinsLine(roofLane,base+37,base+54);
      this.coinsLine(secondLane,base+39,base+55);
    }
    this.coinsLine(safe,base+18,base+79,4.4);
    if(i%3===1)this.add('magnet',safe,base+51,{y:1.2});
    if(i%3===2)this.add('boardPickup',safe,base+49,{y:1.2});
    // A short trail indicates the lane change through the empty transition.
    this.coinsLine(oldSafe,base+3,base+11,4.0);
  }
  groundAt(x,distance) {
    let h=0;
    for(const e of this.entities) {
      if(e.removed||Math.abs(x-e.lane*LANE_WIDTH)>1.42)continue;
      const dz=distance-e.s;
      if(e.type==='ramp'&&Math.abs(dz)<=e.length/2+0.12)h=Math.max(h,clamp((dz+e.length/2)/e.length,0,1)*TRAIN_HEIGHT);
      if(e.type==='train'&&Math.abs(dz)<=e.length/2+0.1&&this.player.y>=TRAIN_HEIGHT-0.18)h=TRAIN_HEIGHT;
    }
    return h;
  }
  crash(e) {
    if(this.invincible>0)return;
    if(this.boardTime>0) {
      this.boardTime=0;this.invincible=2.1;this.emit('shield',{entity:e});
      for(const ob of this.entities)if(!['coin','magnet','boardPickup'].includes(ob.type)&&Math.abs(ob.s-this.distance)<22)ob.removed=true;
      return;
    }
    this.mode='dead';this.emit('crash',{entity:e});
  }
  update(dt) {
    if(this.mode!=='running')return;
    this.time+=dt;this.speed=17+Math.min(14,this.distance/170);
    const previousDistance=this.distance;
    this.distance+=this.speed*dt;
    const p=this.player,oldY=p.y;
    p.x+=(p.lane*LANE_WIDTH-p.x)*(1-Math.exp(-17*dt));
    p.slide=Math.max(0,p.slide-dt);p.landing=Math.max(0,p.landing-dt*4);
    p.jumpBuffer=Math.max(0,p.jumpBuffer-dt);p.coyote=Math.max(0,p.coyote-dt);
    this.boardTime=Math.max(0,this.boardTime-dt);this.magnetTime=Math.max(0,this.magnetTime-dt);this.invincible=Math.max(0,this.invincible-dt);
    if(p.jumpBuffer>0&&(p.grounded||p.coyote>0)) {p.vy=11.6;p.grounded=false;p.coyote=0;p.jumpBuffer=0;this.emit('jump');}
    for(const e of this.entities)if(e.moving&&e.s-this.distance<110) { const travel=7*dt;e.s-=travel;e.travel+=travel; }
    const floor=this.groundAt(p.x,this.distance);
    if(p.grounded&&p.vy<=0&&floor>=oldY-0.2&&floor<=oldY+0.22) { p.y=floor;p.vy=0;p.coyote=0.10; }
    else {
      p.grounded=false;p.vy-=28*dt;p.y+=p.vy*dt;
      if(p.y<=floor&&p.vy<=0&&oldY>=floor-0.22) {p.y=floor;p.vy=0;p.grounded=true;p.coyote=0.10;p.landing=1;this.emit('land');}
    }
    const bodyTop=p.y+(p.slide>0?0.74:1.67);
    for(const e of this.entities) {
      if(e.removed)continue;
      const dz=e.s-this.distance,dx=e.lane*LANE_WIDTH-p.x;
      if(e.type==='coin'||e.type==='magnet'||e.type==='boardPickup') {
        const dy=e.y-(p.y+(p.slide>0?0.5:1));
        const magnet=e.type==='coin'&&this.magnetTime>0&&dz<12&&dz>-2&&Math.hypot(dx,dy)<10;
        if(magnet||(Math.abs(dx)<0.92&&Math.abs(dz)<0.9&&Math.abs(dy)<1.25)) {
          e.removed=true;
          if(e.type==='coin') {this.coins++;this.combo++;this.emit('coin',{entity:e,magnet});}
          if(e.type==='magnet') {this.magnetTime=13;this.emit('magnet');}
          if(e.type==='boardPickup') {this.boards=Math.min(9,this.boards+1);this.emit('boardPickup');}
        }
        continue;
      }
      const near=e.s-e.length/2-0.19,far=e.s+e.length/2+0.19;
      if(this.distance<near||previousDistance>far||Math.abs(dx)>1.4)continue;
      let hit=false;
      if(e.type==='train')hit=p.y<TRAIN_HEIGHT-0.16;
      if(e.type==='block')hit=p.y<2.55;
      if(e.type==='low')hit=p.y<0.84;
      if(e.type==='high')hit=p.y<2.55&&bodyTop>1.05;
      if(e.type==='ramp')hit=p.y<floor-0.24;
      if(hit) {this.crash(e);if(this.mode==='dead')break;}
      else if(!e.passed&&this.distance>=e.s&&e.type!=='ramp') {e.passed=true;if(e.type!=='train')this.emit('dodge',{kind:e.type});}
    }
    if(this.distance>=this.nextBoardReward) {this.nextBoardReward+=500;this.boards=Math.min(9,this.boards+1);this.emit('reward');}
    this.entities=this.entities.filter(e=>e.s+e.length/2>this.distance-24&&!e.removed);
    this.generateAhead();
  }
  snapshot() {return {mode:this.mode,distance:this.distance,time:this.time,speed:this.speed,score:this.score,coins:this.coins,boards:this.boards,boardTime:this.boardTime,magnetTime:this.magnetTime,player:{...this.player},entities:this.entities.map(e=>({...e})),nextChunk:this.nextChunk};}
}

