import { randomBytes, randomInt } from 'node:crypto';

export const RECIPES = [
  { name: 'Flat white', cup: 'hot', shots: 2, milk: 'whole', milkUnits: 1, syrup: 'none', pumps: 0, ice: false },
  { name: 'Vanilla latte', cup: 'hot', shots: 1, milk: 'whole', milkUnits: 2, syrup: 'vanilla', pumps: 1, ice: false },
  { name: 'Iced oat latte', cup: 'iced', shots: 2, milk: 'oat', milkUnits: 2, syrup: 'none', pumps: 0, ice: true },
  { name: 'Caramel cold brew', cup: 'iced', shots: 1, milk: 'none', milkUnits: 0, syrup: 'caramel', pumps: 2, ice: true },
  { name: 'Oat cappuccino', cup: 'hot', shots: 2, milk: 'oat', milkUnits: 1, syrup: 'none', pumps: 0, ice: false },
  { name: 'Iced vanilla latte', cup: 'iced', shots: 1, milk: 'whole', milkUnits: 2, syrup: 'vanilla', pumps: 2, ice: true },
  { name: 'Americano', cup: 'hot', shots: 2, milk: 'none', milkUnits: 0, syrup: 'none', pumps: 0, ice: false },
  { name: 'Vanilla latte to go', cup: 'togo', shots: 1, milk: 'whole', milkUnits: 2, syrup: 'vanilla', pumps: 1, ice: false },
  { name: 'Oat cappuccino to go', cup: 'togo', shots: 2, milk: 'oat', milkUnits: 1, syrup: 'none', pumps: 0, ice: false },
  { name: 'Americano to go', cup: 'togo', shots: 2, milk: 'none', milkUnits: 0, syrup: 'none', pumps: 0, ice: false },
];
export const CUP_TYPES = ['hot', 'iced', 'togo'];
const CUSTOMERS = ['Maya', 'Theo', 'Alex', 'Sam', 'Jun', 'Riley', 'Noor', 'Jamie'];
const fail = message => { throw Object.assign(new Error(message), { status: 400 }); };
const token = () => randomBytes(24).toString('hex');
export class Game {
  constructor({ now = () => Date.now() } = {}) { this.now = now; this.rooms = new Map(); }
  name(value) { const name = String(value || '').trim().slice(0, 20); if (!name) fail('Enter your name first.'); return name; }
  create(name, practice = false) {
    let code; do { code = Array.from({ length: 5 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[randomInt('ABCDEFGHJKLMNPQRSTUVWXYZ23456789'.length)]).join(''); } while(this.rooms.has(code));
    const p = { id: token(), token: token(), name: this.name(name), team: 'blue', ready: false, lastSeen: this.now() };
    const room = { code, practice: Boolean(practice), host: p.id, players: [p], mode: 'ffa', phase: 'lobby', seed: randomInt(100000), cafes: [], events: [], created: this.now(), updated: this.now(), version: 1 };
    this.rooms.set(code, room); return { code, token: p.token, state: this.view(room, p.id) };
  }
  join(code, name) {
    const r = this.room(code); if(r.phase !== 'lobby') fail('This shift has started. Ask the host to play again.');
    if(r.practice) fail('Practice is a solo room. Create a multiplayer room to invite friends.');
    if(r.players.length >= 8) fail('This café is full (8 players maximum).');
    const p = { id: token(), token: token(), name: this.name(name), team: r.players.filter(x=>x.team==='blue').length > r.players.filter(x=>x.team==='peach').length ? 'peach' : 'blue', ready: false, lastSeen: this.now() };
    r.players.push(p); this.touch(r); return { code: r.code, token: p.token, state: this.view(r, p.id) };
  }
  room(code) { const r = this.rooms.get(String(code).toUpperCase()); if(!r) fail('Room not found. Check the five-character code.'); return r; }
  player(r, id) { const p = r.players.find(x=>x.token===id); if(!p) fail('Your session is no longer in this room. Join again.'); p.lastSeen = this.now(); return p; }
  touch(r) { r.updated = this.now(); r.version++; }
  cafe(r, p) { return r.cafes.find(c=>c.id===(r.mode==='teams'?p.team:p.id)); }
  order(r,c) {
    const index=c.next++, cup=CUP_TYPES[(r.seed+index)%CUP_TYPES.length];
    const choices=RECIPES.filter(recipe=>recipe.cup===cup);
    const recipe={...choices[(r.seed+Math.floor(index/3))%choices.length],cup};
    return { id: `${c.id}:${index}`, index, customer: CUSTOMERS[(r.seed+index)%CUSTOMERS.length], recipe, created:this.now(), expires:this.now()+90000, drink:null, owner:null, lease:0 };
  }
  tick(r) {
    if(r.phase !== 'playing') return;
    const now=this.now();
    if(now>=r.ends) { r.phase='results'; this.touch(r); return; }
    for(const c of r.cafes) {
      for(const o of c.orders) {
        if(o.owner && now-o.lease>30000) { o.owner=null; this.touch(r); }
        if(o.drink?.brewingUntil && now>=o.drink.brewingUntil) { o.drink.shots++; o.drink.brewingUntil=0; this.touch(r); }
      }
      const expired=c.orders.filter(o=>now>=o.expires);
      if(expired.length) { c.missed+=expired.length; c.orders=c.orders.filter(o=>now<o.expires); while(c.orders.length<2)c.orders.push(this.order(r,c)); this.touch(r); }
    }
  }
  state(code,id) { const r=this.room(code); const p=this.player(r,id); this.tick(r); return this.view(r,p.id); }
  action(code,id,a) {
    const r=this.room(code), p=this.player(r,id); id=p.id; this.tick(r);
    if(a.type==='leave') {
      if(r.phase==='playing') fail('Finish the shift before leaving, or close this tab.');
      r.players=r.players.filter(x=>x.id!==id); if(!r.players.length)this.rooms.delete(r.code); else if(r.host===id)r.host=r.players[0].id;
      this.touch(r); return { left:true };
    }
    if(a.type==='mode') { if(r.host!==id||r.phase!=='lobby')fail('Only the host can change the lobby mode.'); if(!['ffa','teams'].includes(a.mode)||r.practice&&a.mode==='teams')fail('Choose a valid mode.'); r.mode=a.mode; r.players.forEach(x=>x.ready=false); }
    else if(a.type==='team') { if(r.phase!=='lobby'||!['blue','peach'].includes(a.team))fail('Choose a team in the lobby.'); p.team=a.team; p.ready=false; }
    else if(a.type==='ready') { if(r.phase!=='lobby')fail('The shift has already started.'); p.ready=Boolean(a.ready); }
    else if(a.type==='start') {
      if(r.host!==id||r.phase!=='lobby')fail('Only the host can start a lobby.');
      if(!r.practice&&r.players.length<2)fail('Invite at least one other player.');
      if(!r.players.every(x=>x.ready))fail('Everyone needs to be ready.');
      if(r.players.some(x=>this.now()-x.lastSeen>15000))fail('A player is offline. Wait for them to reconnect.');
      if(r.mode==='teams') { const blue=r.players.filter(x=>x.team==='blue').length; if(blue<1||blue!==r.players.length-blue)fail('Teams need the same number of players.'); }
      r.phase='playing'; r.starts=this.now(); r.ends=r.starts+300000;
      const groups=r.mode==='teams'?['blue','peach']:r.players.map(x=>x.id);
      r.cafes=groups.map(key=>({id:key,name:r.mode==='teams'?(key==='blue'?'Blue café':'Peach café'):r.players.find(x=>x.id===key).name,tips:0,served:0,missed:0,next:0,orders:[],history:[]}));
      for(const c of r.cafes)c.orders=[this.order(r,c),this.order(r,c)];
    }
    else if(a.type==='rematch') { if(r.host!==id||r.phase!=='results')fail('Only the host can reopen the lobby after results.');r.phase='lobby';r.cafes=[];r.events=[];r.seed=randomInt(100000);r.players.forEach(x=>x.ready=false); }
    else {
      if(r.phase!=='playing')fail('The café is not open yet.');
      const c=this.cafe(r,p), o=c.orders.find(x=>x.id===a.orderId); if(!o)fail('That order has already left the café.');
      if(a.type==='claim') { if(o.owner&&o.owner!==id)fail('Your teammate is preparing this order.');o.owner=id;o.lease=this.now(); }
      else {
        if(o.owner!==id)fail('Claim this order before preparing it.');o.lease=this.now();
        if(a.type==='handoff') { o.owner=null; }
        else if(a.type==='cup') { if(!CUP_TYPES.includes(a.cup))fail('Choose a cup.'); if(o.drink)fail('Clear the cup before choosing another.');o.drink={cup:a.cup,shots:0,milk:'none',milkUnits:0,syrup:'none',pumps:0,ice:false,brewingUntil:0}; }
        else if(a.type==='reset') { o.drink=null; }
        else {
          const d=o.drink;if(!d)fail('Choose a cup first.');
          if(a.type==='brew') { if(d.brewingUntil)fail('The espresso is still brewing.');if(d.shots>=2)fail('Two shots maximum.');d.brewingUntil=this.now()+2500; }
          else if(a.type==='milk') { if(!['whole','oat'].includes(a.milk))fail('Choose a milk.');if(d.milkUnits>=2)fail('Two milk pours maximum.');if(d.milk!=='none'&&d.milk!==a.milk)fail('Do not mix milks. Clear the drink to start again.');d.milk=a.milk;d.milkUnits++; }
          else if(a.type==='syrup') { if(!['vanilla','caramel'].includes(a.syrup))fail('Choose a syrup.');if(d.pumps>=2)fail('Two syrup pumps maximum.');if(d.syrup!=='none'&&d.syrup!==a.syrup)fail('Do not mix syrups.');d.syrup=a.syrup;d.pumps++; }
          else if(a.type==='ice') { if(d.cup!=='iced')fail('Ice goes in a cold cup.');if(d.ice)fail('Ice is already added.');d.ice=true; }
          else if(a.type==='serve') {
            if(d.brewingUntil)fail('Wait for your espresso to finish.');if(!d.shots)fail('Brew at least one shot before serving.');
            const keys=['cup','shots','milk','milkUnits','syrup','pumps','ice'];const correct=keys.filter(k=>d[k]===o.recipe[k]).length;const accuracy=correct/keys.length;
            const patience=Math.max(0,(o.expires-this.now())/90000);const cents=Math.round(500*accuracy*(.4+.6*patience));
            c.tips+=cents;c.served++; const entry={customer:o.customer,recipe:o.recipe.name,cents,accuracy:Math.round(accuracy*100),player:p.name,time:this.now(),id:token()};c.history.unshift(entry);c.history=c.history.slice(0,12);
            c.orders=c.orders.filter(x=>x!==o);c.orders.push(this.order(r,c));
          } else fail('Unknown action.');
        }
      }
    }
    this.touch(r);return this.view(r,id);
  }
  view(r,id) {
    const now=this.now(), p=r.players.find(x=>x.id===id), mine=this.cafe(r,p);
    const leaders=r.cafes.map(c=>({id:c.id===id?'you':c.id,name:c.name,tips:c.tips,served:c.served,missed:c.missed,mine:c===mine})).sort((a,b)=>b.tips-a.tips);
    return {code:r.code,practice:r.practice,mode:r.mode,phase:r.phase,host:r.host===id,version:r.version,now,starts:r.starts,ends:r.ends,me:{name:p.name,team:p.team,ready:p.ready},players:r.players.map(x=>({name:x.name,team:x.team,ready:x.ready,host:x.id===r.host,me:x.id===id,online:now-x.lastSeen<15000})),leaders,winners:r.phase==='results'?leaders.filter(x=>x.tips===leaders[0]?.tips).map(x=>x.name):[],cafe:mine?{...mine,id:undefined,orders:mine.orders.map(o=>({...o,owner:undefined,claimedBy:o.owner?r.players.find(x=>x.id===o.owner)?.name:null,mine:o.owner===id})),history:mine.history}:null};
  }
  cleanup() {const now=this.now();for(const [code,r]of this.rooms)if(now-r.updated>6*3600000)this.rooms.delete(code);}
}
