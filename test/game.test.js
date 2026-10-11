import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../server/game.js';
import { createServer } from '../server/index.js';
function setup(teams=false){let time=1000000;const g=new Game({now:()=>time});const a=g.create('Rianna'),b=g.join(a.code,'Maya');if(teams)g.action(a.code,a.token,{type:'mode',mode:'teams'});for(const p of [a,b])g.action(a.code,p.token,{type:'ready',ready:true});g.action(a.code,a.token,{type:'start'});return {g,a,b,advance:n=>{time+=n;},now:()=>time};}
function makeDrink(g,p,advance){const s=g.state(p.code,p.token),o=s.cafe.orders[0],r=o.recipe;const act=a=>g.action(p.code,p.token,{orderId:o.id,...a});act({type:'claim'});act({type:'cup',cup:r.cup});for(let i=0;i<r.shots;i++){act({type:'brew'});advance(2500);g.state(p.code,p.token);}for(let i=0;i<r.milkUnits;i++)act({type:'milk',milk:r.milk});for(let i=0;i<r.pumps;i++)act({type:'syrup',syrup:r.syrup});if(r.ice)act({type:'ice'});return act({type:'serve'});}
test('two separate sessions get equal recipes and isolated cafés; full shift finishes',()=>{const {g,a,b,advance}=setup();assert.deepEqual(g.state(a.code,a.token).cafe.orders.map(o=>o.recipe),g.state(b.code,b.token).cafe.orders.map(o=>o.recipe));const s=makeDrink(g,a,advance);assert.equal(s.cafe.history[0].accuracy,100);assert(s.cafe.tips>450);assert.equal(g.state(b.code,b.token).cafe.tips,0);advance(100000);assert.equal(g.state(a.code,a.token).phase,'playing');advance(100000);assert.equal(g.state(a.code,a.token).phase,'playing');advance(100000);const end=g.state(a.code,a.token);assert.equal(end.phase,'results');assert.deepEqual(end.winners,['Rianna']);assert.throws(()=>g.action(a.code,a.token,{type:'brew'}),/not open/);});
test('teams share drinks, prevent conflicting edits, and allow intact handoffs',()=>{let time=100;const g=new Game({now:()=>time});const a=g.create('A'),b=g.join(a.code,'B'),c=g.join(a.code,'C'),d=g.join(a.code,'D');g.action(a.code,a.token,{type:'mode',mode:'teams'});for(const p of [a,b,c,d])g.action(a.code,p.token,{type:'ready',ready:true});g.action(a.code,a.token,{type:'start'});const o=g.state(a.code,a.token).cafe.orders[0];assert.equal(g.state(c.code,c.token).cafe.orders[0].id,o.id);g.action(a.code,a.token,{type:'claim',orderId:o.id});g.action(a.code,a.token,{type:'cup',orderId:o.id,cup:'hot'});assert.throws(()=>g.action(c.code,c.token,{type:'claim',orderId:o.id}),/teammate/);assert.throws(()=>g.action(b.code,b.token,{type:'claim',orderId:o.id}),/already left/);g.action(a.code,a.token,{type:'handoff',orderId:o.id});g.action(c.code,c.token,{type:'claim',orderId:o.id});assert.equal(g.state(c.code,c.token).cafe.orders[0].drink.cup,'hot');time+=31000;assert.equal(g.state(a.code,a.token).cafe.orders[0].claimedBy,null);});
test('reject invalid sessions, premature brewing, duplicate serves and late joins',()=>{const {g,a,b,advance}=setup();assert.throws(()=>g.state(a.code,'invalid'),/session/);assert.throws(()=>g.join(a.code,'Late'),/started/);const o=g.state(a.code,a.token).cafe.orders[0];g.action(a.code,a.token,{type:'claim',orderId:o.id});g.action(a.code,a.token,{type:'cup',orderId:o.id,cup:'hot'});g.action(a.code,a.token,{type:'brew',orderId:o.id});assert.throws(()=>g.action(a.code,a.token,{type:'serve',orderId:o.id}),/Wait/);advance(2500);g.action(a.code,a.token,{type:'serve',orderId:o.id});assert.throws(()=>g.action(a.code,a.token,{type:'serve',orderId:o.id}),/already left/);const exposed=JSON.stringify(g.state(b.code,b.token));assert(!exposed.includes(a.token));assert(!exposed.includes(b.token));});
test('expired orders score zero; exact ties share victory; rematch resets scores',()=>{const {g,a,b,advance}=setup();advance(91000);const s=g.state(a.code,a.token);assert.equal(s.cafe.missed,2);assert.equal(s.cafe.tips,0);advance(300000);assert.deepEqual(g.state(a.code,a.token).winners.sort(),['Maya','Rianna']);assert.throws(()=>g.action(b.code,b.token,{type:'rematch'}),/host/);g.action(a.code,a.token,{type:'rematch'});assert.equal(g.state(a.code,a.token).phase,'lobby');assert(g.state(a.code,a.token).players.every(p=>!p.ready));});
test('balanced teams and readiness required; host transfers on lobby departure',()=>{const g=new Game();const a=g.create('A'),b=g.join(a.code,'B'),c=g.join(a.code,'C');g.action(a.code,a.token,{type:'mode',mode:'teams'});assert.throws(()=>g.action(a.code,a.token,{type:'start'}),/ready/);for(const p of [a,b,c])g.action(a.code,p.token,{type:'ready',ready:true});assert.throws(()=>g.action(a.code,a.token,{type:'start'}),/same number/);g.action(a.code,a.token,{type:'leave'});assert.equal(g.state(b.code,b.token).host,true);});
test('real HTTP clients can host, join, play and finish through production endpoints',async()=>{let now=100000;const g=new Game({now:()=>now});const server=createServer(g);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));try{const base='http://127.0.0.1:'+server.address().port;const post=async(path,data,token)=>{const r=await fetch(base+'/api/'+path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(data)});return {status:r.status,body:await r.json()};};const a=(await post('create',{name:'Host'})).body,b=(await post('join',{name:'Guest',code:a.code})).body;for(const p of [a,b])assert.equal((await post('action',{code:a.code,action:{type:'ready',ready:true}},p.token)).status,200);const s=(await post('action',{code:a.code,action:{type:'start'}},a.token)).body;const order=s.cafe.orders[0];for(const action of [{type:'claim'},{type:'cup',cup:order.recipe.cup},{type:'brew'}])assert.equal((await post('action',{code:a.code,action:{...action,orderId:order.id}},a.token)).status,200);now+=2500;assert.equal((await post('action',{code:a.code,action:{type:'serve',orderId:order.id}},a.token)).status,200);now+=300000;const end=await fetch(base+'/api/state?code='+a.code,{headers:{Authorization:'Bearer '+b.token}});assert.equal((await end.json()).phase,'results');const html=await fetch(base+'/');assert.equal(html.status,200);assert((await html.text()).includes('Expresso'));assert.equal((await post('action',{code:a.code,action:{type:'start'}},'invalid')).status,400);}finally{await new Promise(resolve=>server.close(resolve));}});


test('orders evenly rotate three distinct cups and score to-go drinks correctly', () => {
  let now=1000;
  const g=new Game({now:()=>now});
  const host=g.create('A',true);
  g.action(host.code,host.token,{type:'ready',ready:true});
  g.action(host.code,host.token,{type:'start'});
  const room=g.room(host.code), cafe=room.cafes[0];
  const counts={hot:0,iced:0,togo:0};
  for(let i=0;i<30;i++)counts[g.order(room,cafe).recipe.cup]++;
  assert.deepEqual(counts,{hot:10,iced:10,togo:10});
  cafe.orders=[g.order(room,cafe)];
  while(cafe.orders[0].recipe.cup!=='togo')cafe.orders=[g.order(room,cafe)];
  const result=makeDrink(g,host,amount=>now+=amount);
  assert.equal(result.cafe.history[0].accuracy,100);
});

test('HTTP cup selection accepts hot, cold and to-go as distinct machine cups', async () => {
  const server=createServer();
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try {
    const base='http://127.0.0.1:'+server.address().port;
    const post=async(path,data,token)=>{
      const response=await fetch(base+'/api/'+path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(data)});
      assert.equal(response.status,200);
      return response.json();
    };
    const host=await post('create',{name:'Cup QA',practice:true});
    const action=a=>post('action',{code:host.code,action:a},host.token);
    await action({type:'ready',ready:true});
    const playing=await action({type:'start'});
    const orderId=playing.cafe.orders[0].id;
    await action({type:'claim',orderId});
    for(const cup of ['hot','iced','togo']) {
      const state=await action({type:'cup',orderId,cup});
      assert.equal(state.cafe.orders[0].drink.cup,cup);
      await action({type:'reset',orderId});
    }
  } finally { await new Promise(resolve=>server.close(resolve)); }
});
