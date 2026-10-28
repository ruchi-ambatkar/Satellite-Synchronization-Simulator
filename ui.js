// ============================================================
// ui.js – dashboard layer. Reads simulator state from script.js;
// it never changes simulation logic or state.
// ============================================================
(function(){
const $=id=>document.getElementById(id);
let samples=[], peak=0, lastProd=0, lastCons=0;
const ICON={'Temperature Data':'🌡 TEMPERATURE','Atmospheric Data':'☁ ATMOSPHERE','Image Data':'🖼 IMAGE','Location Data':'📍 LOCATION','Pressure Data':'⏲ PRESSURE','Camera Data':'📷 CAMERA','Telemetry Data':'📡 TELEMETRY'};

// ----- navigation extras -----
document.querySelectorAll('.tab-btn').forEach(b=>b.addEventListener('click',()=>{$('side').classList.remove('open');window.scrollTo(0,0);}));
$('menuBtn').onclick=()=>$('side').classList.toggle('open');
$('sideReset').onclick=()=>$('resetBtn').click();
$('printBtn').onclick=()=>window.print();
const hideWelcome=()=>{$('welcome').style.display='none';};
$('startBtn').addEventListener('click',hideWelcome);
$('runScenario').addEventListener('click',()=>{ if($('scenarioSel').value) hideWelcome(); });
$('welcomeGo').onclick=()=>{$('startBtn').click();};

// ----- flying packet animation -----
function fly(from,to,label){
  if(matchMedia('(prefers-reduced-motion:reduce)').matches) return;
  const st=$('stage'), s=st.getBoundingClientRect(), a=from.getBoundingClientRect(), b=to.getBoundingClientRect();
  const el=document.createElement('div'); el.className='pkt-fly'; el.textContent=label; st.appendChild(el);
  const x1=a.left+a.width/2-s.left-20, y1=a.top+a.height/2-s.top-10, x2=b.left+b.width/2-s.left-20, y2=b.top+b.height/2-s.top-10;
  el.animate([{transform:`translate(${x1}px,${y1}px)`,opacity:1},{transform:`translate(${x2}px,${y2}px)`,opacity:.2}],{duration:600,easing:'ease-in-out'}).onfinish=()=>el.remove();
}

// ----- richer render, wrapped around the original -----
const baseRender=render;
render=function(){
  baseRender();
  if(stats.produced===0&&stats.consumed===0){samples=[];peak=0;}
  peak=Math.max(peak,count);
  samples.push(count); if(samples.length>60) samples.shift();

  // buffer slots as telemetry packets
  const slots=$('slots'); slots.innerHTML='';
  for(let i=0;i<cap;i++){
    const s=document.createElement('div'); s.className='slot';
    if(i<count){
      const p=buffer[i], age=(Date.now()-p.ts)/1000, ex=maxWait>0&&age>maxWait;
      s.classList.add('filled'); if(ex) s.classList.add('expired');
      s.innerHTML=`<b>P${String(p.id).padStart(2,'0')}</b><em>${(ICON[p.type]||p.type).replace(/^\S+\s/,'')}</em><s>${ex?'EXPIRED ':''}${age.toFixed(1)}s</s>`;
    } else s.textContent='empty';
    slots.appendChild(s);
  }

  const full=count>=cap, empty=count===0, status=running?'RUNNING':(winHandle?'PAUSED':'STOPPED');
  const modeName=synchronized?'Synchronized':'Unsynchronized';
  $('k_buf').textContent=`${count} / ${cap}`; $('k_pct').textContent=Math.round(count/cap*100)+'% occupied';
  $('k_bar').style.width=(count/cap*100)+'%';
  $('k_prod').textContent=stats.produced; $('k_cons').textContent=stats.consumed;
  $('k_state').textContent=status; $('k_state').className=running?'run':(winHandle?'paused':'');
  $('k_mode').textContent=modeName;
  $('sbMode').textContent=modeName; $('sbState').textContent=status[0]+status.slice(1).toLowerCase();
  $('hdMode').textContent=modeName.toUpperCase(); $('hdMode').classList.toggle('safe',synchronized);

  // banner
  const raceOn=!synchronized&&$('raceWarning').style.display==='block';
  let cls='',t,sub;
  if(raceOn){cls='race';t='⚠ UNSAFE SHARED ACCESS';sub='Both sides updated count at once — one update was lost.';}
  else if(!winOpen){cls='closed';t='COMMUNICATION CLOSED';sub='Ground station cannot receive. Packets stay queued until the next window.';}
  else if(full){cls='full';t='BUFFER FULL';sub='Satellite waiting for free space';}
  else if(empty){cls='empty';t='BUFFER EMPTY';sub='Ground station waiting for packet';}
  else if(synchronized){cls='safe';t='🔒 SYNCHRONIZED';sub='Mutex and semaphores guard every buffer access.';}
  else {t='BUFFER ACTIVE';sub='⚠ Unsynchronized: shared count is unprotected.';}
  $('banner').className='banner '+cls; $('bnTitle').textContent=t; $('bnSub').textContent=sub;
  $('bufCol').className='buffer-col '+(full?'full':empty?'empty':'');
  if(satState==='wait') $('satState').textContent='Waiting — buffer capacity reached.';
  if(gndState==='wait') $('gndState').textContent=winOpen?'Waiting — no packets available.':'Waiting — communication closed.';

  // sync + comm panels
  $('mutexNum').textContent=synchronized?(mutexLocked?0:1):'—';
  $('lockIco').textContent=mutexLocked?'🔒':'🔓'; $('lockIco').className='lock'+(mutexLocked?' on':'');
  if(!synchronized){$('s_empty').textContent='—';$('s_full2').textContent='—';}
  $('syncHint').textContent=synchronized?(mutexLocked?`MUTEX: LOCKED by ${mutexOwner} — the other side must wait.`:'MUTEX: free. EMPTY counts free slots, FULL counts ready packets.'):'Unsynchronized: semaphores and mutex are not in use.';
  $('ring').style.setProperty('--deg',(winRemaining/winTotal*360)+'deg');
  $('winHint').textContent=winOpen?'Packets may wait in the buffer until communication is available.':'Ground station cannot receive packets.';

  // button availability
  $('startBtn').disabled=running; $('pauseBtn').disabled=!running;
  $('stopBtn').disabled=!running&&!winHandle; $('prevBtn').disabled=history.length===0;

  // sparkline
  const w=300,h=70,n=samples.length;
  const pts=samples.map((v,i)=>`${(n<2?0:i/(n-1)*w).toFixed(1)},${(h-4-v/cap*(h-8)).toFixed(1)}`).join(' ');
  $('spark').innerHTML=`<line x1="0" x2="${w}" y1="4" y2="4" stroke="#fb923c" stroke-dasharray="4 4" opacity=".5"/><polyline points="${pts}" fill="none" stroke="#38bdf8" stroke-width="2" vector-effect="non-scaling-stroke"/>`;

  // packet flight
  if(stats.produced>lastProd) fly(document.querySelector('.actor.sat .ico'),$('slots'),'P'+String(packetId).padStart(2,'0'));
  if(stats.consumed>lastCons) fly($('slots'),document.querySelector('.actor.gnd .ico'),'▶');
  lastProd=stats.produced; lastCons=stats.consumed;
};
render();

// ----- results page -----
$('genResults').addEventListener('click',()=>{
  const bad=!synchronized&&stats.race>0, ok=!bad;
  const avg=waitTimes.length?waitTimes.reduce((a,b)=>a+b,0)/waitTimes.length:0;
  const item=(v,l)=>`<div><b>${v}</b><span>${l}</span></div>`;
  $('resultsBody').innerHTML=`<span class="verdict ${ok?'ok':'bad'}">${ok?'SUCCESS':'RACE CONDITIONS OBSERVED'}</span>
   <div class="rgrid">${item(stats.produced,'Packets produced')}${item(stats.consumed,'Packets consumed')}${item(count,'Left in buffer')}
   ${item(peak+' / '+cap,'Peak buffer usage')}${item(stats.race,'Race events')}${item(stats.expired,'Expired packets')}
   ${item(stats.bufferFull,'Buffer full events')}${item(stats.bufferEmpty,'Buffer empty events')}${item(avg.toFixed(1)+'s','Average wait')}
   ${item(synchronized?'ENABLED':'DISABLED','Synchronization')}${item(winTotal+'s ('+winUsed+'s used)','Communication window')}</div>`;
});

// ----- procedure (8 steps) -----
const steps=[['🧱','Initialize bounded buffer','Pick a buffer capacity of 3 or 5 slots.'],['🛰','Create producer and consumer','Satellite and ground station run as independent actors.'],['📡','Produce packets','Press Start and watch packets enter the buffer.'],['📦','Check buffer capacity','Notice BUFFER FULL — the satellite must wait.'],['🖥','Consume packets','The ground station drains the buffer; note BUFFER EMPTY.'],['⚠','Demonstrate race condition','Run Unsynchronized mode, or open the Race Condition page.'],['🔒','Apply synchronization','Switch to Synchronized and watch mutex, empty and full values.'],['⚖','Compare results','Check Comparison and Results, then try another scenario.']];
const pl=$('procList'); pl.innerHTML='';
steps.forEach((s,i)=>{const li=document.createElement('li');li.innerHTML=`<div class="i">${s[0]}</div><span class="n">STEP ${i+1}</span><h4>${s[1]}</h4><p>${s[2]}</p>`;pl.appendChild(li);});

// ----- concepts with satellite scenario -----
const sc={'Producer–Consumer Problem':'Satellite = producer, ground station = consumer.','Bounded Buffer':'Onboard storage with only 3–10 packet slots.','Shared Resource':'Both sides touch the buffer and its count.','Race Condition':'Satellite adds while ground removes; count ends up wrong.','Critical Section':'The few lines that insert or remove a packet.','Mutual Exclusion':'Only one of satellite or ground touches the buffer at once.','Semaphore':'EMPTY and FULL count free slots and ready packets.','Mutex':'The lock shown as 🔒 on the Synchronization panel.','Buffer Full':'Satellite waits for free space.','Buffer Empty':'Ground station waits for a packet.','Communication Window':'Ground can only receive while the window is OPEN.','Waiting Time':'Packets older than the max wait are marked EXPIRED.'};
document.querySelectorAll('.concept-item').forEach(c=>{const k=c.querySelector('h4').textContent; if(sc[k]){const d=document.createElement('div');d.className='sc';d.textContent='🛰 '+sc[k];c.appendChild(d);}});
[['Deadlock','Processes wait on each other forever.','Not possible here: the semaphore order wait(empty) → wait(mutex) is fixed.'],['Starvation','A process never gets its turn.','A satellite blocked forever by a busy ground station.']].forEach(c=>{const d=document.createElement('div');d.className='concept-item';d.innerHTML=`<h4>${c[0]}</h4><p>${c[1]}</p><div class="sc">🛰 ${c[2]}</div>`;$('conceptsPanel').appendChild(d);});

// ----- viva -----
[['What is a producer?','A process that generates data and places it in the shared buffer — the satellite here.'],['What is a consumer?','A process that removes data from the buffer and uses it — the ground station.'],['What is a race condition?','A bug where two processes access shared data at the same time and the result depends on execution order.'],['Why is a mutex required?','It guarantees only one process is inside the critical section, so updates to the buffer and count are never interleaved.'],['What happens when the buffer is full?','The producer must wait until the consumer frees a slot (wait(empty) blocks).'],['What happens when the buffer is empty?','The consumer must wait until the producer adds a packet (wait(full) blocks).'],['Why is sleep() not synchronization?','It only delays a thread. Timing can still overlap, so mutual exclusion is not guaranteed.'],['What is a semaphore?','An integer counter with wait() and signal(), used to block and wake processes. Here EMPTY counts free slots and FULL counts ready packets.'],['What is the critical section?','The code that accesses the shared buffer and count: inserting or removing a packet.'],['What is the difference between mutex and semaphore?','A mutex is a binary lock owned by one thread for mutual exclusion. A semaphore is a counter used for signalling and resource counting.']]
.forEach(q=>{const d=document.createElement('details');d.className='q';d.innerHTML=`<summary>${q[0]}</summary><p>${q[1]}</p>`;$('vivaList').appendChild(d);});
})();
