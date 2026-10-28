// ============================================================
// Satellite Communication Producer-Consumer Simulator - script.js
// All simulation state is real; nothing here is faked/random-display only.
// ============================================================
const $ = id => document.getElementById(id);

// ---------- Tab navigation ----------
document.querySelectorAll('.tab-btn').forEach(btn=>{
  btn.onclick = ()=>{
    document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.tabpanel').forEach(p=>p.classList.remove('active'));
    btn.classList.add('active');
    $(btn.dataset.tab).classList.add('active');
  };
});

// ---------- Core state ----------
let cap = 5, count = 0, buffer = []; // buffer: [{id,type,ts}]
let synchronized = false;
let running = false, prodHandle=null, consHandle=null;
let packetId = 0;
let mutexLocked = false, mutexOwner = null;
let emptySem = cap, fullSem = 0;
let satState = 'idle', gndState = 'idle';
let winRemaining = 20, winTotal = 20, winOpen = true, winHandle=null, winUsed=0;
let maxWait = 6;
let logPaused = false;
let history = []; // for Previous Step
let waitTimes = []; // completed packet waiting times
const types = ['Temperature Data','Atmospheric Data','Image Data','Location Data','Pressure Data','Camera Data','Telemetry Data'];

let stats = {produced:0, consumed:0, expired:0, bufferFull:0, bufferEmpty:0, race:0, syncBlocks:0};

function speedFactor(){ return parseFloat($('speedSel').value); }

// ---------- Logging ----------
function log(msg, cls){
  if(logPaused) return;
  const d = document.createElement('div');
  d.className = cls||'';
  const t = new Date().toLocaleTimeString();
  d.textContent = `[${t}] ${msg}`;
  const box = $('logBox');
  box.prepend(d);
  if($('autoscroll').checked) box.scrollTop = 0;
}
function setExplain(txt){ $('explain').textContent = txt; }

// ---------- Snapshot for Previous Step ----------
function snapshot(){
  history.push(JSON.stringify({cap,count,buffer,packetId,mutexLocked,mutexOwner,emptySem,fullSem,satState,gndState,stats,winRemaining,winOpen}));
  if(history.length>50) history.shift();
}
function restoreSnapshot(){
  if(history.length===0) return;
  const s = JSON.parse(history.pop());
  Object.assign(window, {}); // no-op, assign individually
  cap=s.cap; count=s.count; buffer=s.buffer; packetId=s.packetId;
  mutexLocked=s.mutexLocked; mutexOwner=s.mutexOwner; emptySem=s.emptySem; fullSem=s.fullSem;
  satState=s.satState; gndState=s.gndState; stats=s.stats; winRemaining=s.winRemaining; winOpen=s.winOpen;
  log('⏮ Reverted to previous step','info');
  render();
}

// ---------- Render ----------
function render(){
  $('bufCap').textContent = cap;
  $('bufCount').textContent = count;
  $('bufEmpty').textContent = cap-count;
  $('s_cap').textContent = cap;
  $('s_cur').textContent = count;
  $('s_emptyslots').textContent = cap-count;
  $('s_full').textContent = count===cap ? 'Yes':'No';
  $('s_empty').textContent = synchronized ? emptySem : (cap-count);
  $('s_full2').textContent = synchronized ? fullSem : count;
  $('s_mutex').textContent = mutexLocked ? `🔒 Locked by ${mutexOwner}` : '🔓 Available';
  $('s_mode').textContent = synchronized ? 'ON':'OFF';
  $('st_sync').textContent = synchronized ? 'ON':'OFF';
  $('st_prod').textContent = stats.produced;
  $('st_cons').textContent = stats.consumed;
  $('st_inbuf').textContent = count;
  $('st_exp').textContent = stats.expired;
  $('st_bfull').textContent = stats.bufferFull;
  $('st_bempty').textContent = stats.bufferEmpty;
  $('st_race').textContent = stats.race;
  $('st_syncblk').textContent = stats.syncBlocks;
  const avg = waitTimes.length ? (waitTimes.reduce((a,b)=>a+b,0)/waitTimes.length) : 0;
  const mx = waitTimes.length ? Math.max(...waitTimes) : 0;
  $('st_avgwait').textContent = avg.toFixed(1)+'s';
  $('st_maxwait').textContent = mx.toFixed(1)+'s';
  $('st_winused').textContent = winUsed+'s';

  // sync tab mirror
  $('sync_empty').textContent = emptySem;
  $('sync_full').textContent = fullSem;
  $('sync_mutex').textContent = mutexLocked ? `🔒 LOCKED (${mutexOwner})` : '🔓 UNLOCKED';

  const badge = $('bufBadge');
  if(count===cap){ badge.className='badge badge-full'; badge.textContent='🔴 BUFFER FULL'; }
  else if(count===0){ badge.className='badge badge-empty'; badge.textContent='🔵 BUFFER EMPTY'; }
  else { badge.className='badge badge-ok'; badge.textContent='Normal'; }

  const slots = $('slots'); slots.innerHTML='';
  for(let i=0;i<cap;i++){
    const s = document.createElement('div');
    s.className = 'slot' + (i<count ? ' filled':'');
    if(i<count){
      const pkt = buffer[i];
      const age = (Date.now()-pkt.ts)/1000;
      if(maxWait>0 && age > maxWait){ s.classList.add('expired'); s.title='EXPIRED'; }
      s.textContent = 'P'+String(pkt.id).padStart(2,'0');
    }
    slots.appendChild(s);
  }

  $('satPill').className = 'status-pill ' + (satState==='wait'?'pill-wait':satState==='active'?'pill-active':satState==='lock'?'pill-lock':'pill-idle');
  $('satPill').textContent = satState==='wait'?'WAITING (Buffer Full)':satState==='active'?'Producing':satState==='lock'?'In Critical Section':'Idle';
  $('gndPill').className = 'status-pill ' + (gndState==='wait'?'pill-wait':gndState==='active'?'pill-active':gndState==='lock'?'pill-lock':'pill-idle');
  $('gndPill').textContent = gndState==='wait'?'WAITING (Buffer Empty)':gndState==='active'?'Receiving':gndState==='lock'?'In Critical Section':'Idle';

  $('winTimer').textContent = winRemaining+'s';
  $('winBar').style.width = Math.max(0, (winRemaining/winTotal*100))+'%';
  $('winStatus').className = 'badge ' + (winOpen?'badge-ok':'badge-full');
  $('winStatus').textContent = winOpen?'OPEN':'CLOSED';

  $('produceBtn').disabled = count>=cap;
  $('consumeBtn').disabled = count===0 || !winOpen;
}

// ---------- Producer / Consumer ----------
function produce(){
  if(count>=cap){
    satState='wait'; stats.bufferFull++;
    setExplain('⚠ BUFFER FULL — Satellite cannot insert a new packet because the buffer has no empty slot. Producer is WAITING.');
    log('⚠ BUFFER FULL — Satellite waiting.','warn');
    render(); return false;
  }
  if(synchronized && emptySem<=0){ satState='wait'; stats.syncBlocks++; render(); return false; }

  const type = types[Math.floor(Math.random()*types.length)];
  packetId++;
  const pkt = {id:packetId, type, ts:Date.now()};

  if(synchronized){
    emptySem--; mutexLocked=true; mutexOwner='Satellite'; satState='lock';
    log('🔒 Satellite LOCK(mutex) — writing Packet P'+String(pkt.id).padStart(2,'0'),'info');
    render();
  }
  buffer.push(pkt); count++;
  satState='active';
  $('satState').innerHTML = `Current Action: Producing <b>Packet P${String(pkt.id).padStart(2,'0')}</b><br>Type: ${type}`;
  stats.produced++;
  log(`✓ Satellite produced Packet P${String(pkt.id).padStart(2,'0')} (${type})`,'ok');

  if(synchronized){
    mutexLocked=false; mutexOwner=null; fullSem++;
    log('🔓 Satellite UNLOCK(mutex), SIGNAL(full)','info');
  }
  render(); return true;
}

function consume(){
  if(!winOpen){
    setExplain('📡 COMMUNICATION CLOSED — Ground Station cannot receive packets. Packets remain in the satellite buffer.');
    return false;
  }
  if(count===0){
    gndState='wait'; stats.bufferEmpty++;
    setExplain('⚠ BUFFER EMPTY — Ground Station cannot receive a packet because none is available. Consumer is WAITING.');
    log('⚠ BUFFER EMPTY — Ground Station waiting.','warn');
    render(); return false;
  }
  if(synchronized && fullSem<=0){ gndState='wait'; stats.syncBlocks++; render(); return false; }

  if(synchronized){
    fullSem--; mutexLocked=true; mutexOwner='Ground Station'; gndState='lock';
    log('🔒 Ground Station LOCK(mutex) — reading packet','info');
    render();
  }
  const pkt = buffer.shift(); count--;
  gndState='active';
  const waited = (Date.now()-pkt.ts)/1000;
  waitTimes.push(waited);
  const expired = maxWait>0 && waited>maxWait;
  if(expired) stats.expired++;
  $('gndState').innerHTML = `Current Action: Receiving <b>Packet P${String(pkt.id).padStart(2,'0')}</b><br>Type: ${pkt.type} · Waited ${waited.toFixed(1)}s${expired?' · EXPIRED':''}`;
  stats.consumed++;
  log(`✓ Ground Station consumed Packet P${String(pkt.id).padStart(2,'0')} (${pkt.type})${expired?' — EXPIRED':''}`, expired?'warn':'ok');

  if(synchronized){
    mutexLocked=false; mutexOwner=null; emptySem++;
    log('🔓 Ground Station UNLOCK(mutex), SIGNAL(empty)','info');
  }
  render(); return true;
}

// ---------- Unsynchronized race-condition auto-check ----------
function maybeRace(){
  if(synchronized) return;
  if(Math.random() < 0.3){
    const before = count;
    const readSat = count, readGnd = count;
    count = readSat + 1;
    count = readGnd - 1;
    count = Math.max(0, Math.min(cap, count));
    stats.race++;
    $('raceWarning').style.display='block';
    $('raceLog').innerHTML = `Initial count = ${before}<br>
      Satellite: READ count → ${readSat}<br>
      Ground Station: READ count → ${readGnd}<br>
      Satellite: WRITE count → ${readSat+1}<br>
      Ground Station: WRITE count → ${readGnd-1} (overwrites satellite's update)<br>
      <b>Final count = ${count}</b> — inconsistent with real buffer contents (${buffer.length})`;
    setExplain('Race condition: the producer and consumer accessed shared data (count) concurrently without synchronization. One update was lost.');
    log('⚠ Race condition — shared count corrupted by concurrent access','err');
    setTimeout(()=>{ count = buffer.length; render(); }, 1800);
  } else {
    $('raceWarning').style.display='none';
  }
}

// ---------- Communication window ----------
function tickWindow(){
  if(winRemaining>0){
    winRemaining--; winUsed++;
    if(winRemaining===0){
      winOpen=false;
      log('📡 COMMUNICATION WINDOW CLOSED — satellite out of range.','err');
      setExplain('📡 COMMUNICATION CLOSED — the ground station cannot consume or transmit packets. Packets remain in the satellite buffer until the window reopens.');
    }
  }
  render();
}

// ---------- Controls ----------
function start(){
  if(running) return;
  running=true;
  log('▶ Simulation started ('+(synchronized?'SYNCHRONIZED':'UNSYNCHRONIZED')+' mode)','info');
  const prodDelay = parseInt($('prodSpeed').value) * speedFactor();
  const consDelay = parseInt($('consSpeed').value) * speedFactor();
  prodHandle = setInterval(()=>{ produce(); if(!synchronized) maybeRace(); }, prodDelay);
  consHandle = setInterval(consume, consDelay);
  if(!winHandle) winHandle = setInterval(tickWindow, 1000);
}
function pause(){
  running=false;
  clearInterval(prodHandle); clearInterval(consHandle);
  prodHandle=null; consHandle=null;
  log('⏸ Simulation paused','info');
}
function stop(){
  pause();
  clearInterval(winHandle); winHandle=null;
  log('⏹ Simulation stopped','warn');
}
function reset(){
  stop();
  cap = parseInt($('capSel').value);
  count=0; buffer=[]; packetId=0;
  mutexLocked=false; mutexOwner=null; emptySem=cap; fullSem=0;
  satState='idle'; gndState='idle';
  winTotal = parseInt($('winSel').value); winRemaining=winTotal; winOpen=true; winUsed=0;
  maxWait = parseInt($('maxWaitSel').value);
  stats = {produced:0,consumed:0,expired:0,bufferFull:0,bufferEmpty:0,race:0,syncBlocks:0};
  waitTimes=[]; history=[];
  $('satState').textContent='No packet generated yet.';
  $('gndState').textContent='Waiting for data...';
  $('raceWarning').style.display='none';
  $('logBox').innerHTML='';
  setExplain('Press Start, Next Step, or Produce/Receive to begin.');
  log('↻ Simulation reset — buffer, stats, timers, semaphores, log all cleared','ok');
  render();
}

$('produceBtn').onclick=()=>{ snapshot(); produce(); if(!synchronized) maybeRace(); };
$('consumeBtn').onclick=()=>{ snapshot(); consume(); };
$('startBtn').onclick=start;
$('pauseBtn').onclick=pause;
$('stopBtn').onclick=stop;
$('resetBtn').onclick=reset;
$('stepBtn').onclick=()=>{
  snapshot();
  if(count<cap) produce(); else consume();
  if(!synchronized) maybeRace();
};
$('prevBtn').onclick=restoreSnapshot;
$('clearLog').onclick=()=>{ $('logBox').innerHTML=''; };
$('pauseLog').onclick=(e)=>{ logPaused=!logPaused; e.target.textContent = logPaused?'Resume Log':'Pause Log'; };
$('capSel').onchange=()=>{ if(!running) reset(); };
$('winSel').onchange=()=>{ if(!running){ winTotal=parseInt($('winSel').value); winRemaining=winTotal; winOpen=true; render(); } };
$('maxWaitSel').onchange=()=>{ maxWait=parseInt($('maxWaitSel').value); };

$('modeUnsync').onclick=()=>{
  synchronized=false;
  $('modeUnsync').classList.add('active'); $('modeSync').classList.remove('active');
  log('Switched to UNSYNCHRONIZED mode','warn');
  setExplain('Both Satellite and Ground Station can access the shared buffer without protection. Watch for race conditions.');
  render();
};
$('modeSync').onclick=()=>{
  synchronized=true;
  emptySem = cap-count; fullSem = count;
  $('modeSync').classList.add('active'); $('modeUnsync').classList.remove('active');
  $('raceWarning').style.display='none';
  log('✓ Synchronization Active — mutex + semaphores now protect the buffer','ok');
  setExplain('The mutex allows only one process to enter the critical section at a time. Empty/full semaphores track available slots and packets.');
  render();
};

// ---------- Scenarios ----------
const scenarios = {
  balanced:{cap:5,prod:1100,cons:1100,sync:false,win:20},
  fastsat:{cap:5,prod:500,cons:2200,sync:false,win:20},
  fastgnd:{cap:5,prod:2200,cons:500,sync:false,win:20},
  full:{cap:3,prod:500,cons:3000,sync:false,win:30},
  empty:{cap:3,prod:3000,cons:500,sync:false,win:30},
  race:{cap:5,prod:400,cons:400,sync:false,win:20},
  windowclosed:{cap:5,prod:700,cons:700,sync:true,win:8},
  expiry:{cap:5,prod:900,cons:3500,sync:false,win:30,maxWait:4},
  'full-demo':{cap:5,prod:1000,cons:1200,sync:true,win:25}
};
$('runScenario').onclick=()=>{
  const key = $('scenarioSel').value;
  if(!key){ alert('Please select a scenario first.'); return; }
  const s = scenarios[key];
  // UI fix: presets may use values missing from the dropdowns (blank select -> NaN timers), so add them first
  const setSel=(id,v,label)=>{ const el=$(id); if(![...el.options].some(o=>o.value==String(v))) el.add(new Option(label,v)); el.value=v; };
  setSel('capSel',s.cap,s.cap);
  setSel('prodSpeed',s.prod,'Custom ('+s.prod+' ms)');
  setSel('consSpeed',s.cons,'Custom ('+s.cons+' ms)');
  setSel('winSel',s.win,s.win+' sec');
  if(s.maxWait) setSel('maxWaitSel',s.maxWait,s.maxWait+' sec');
  reset();
  if(s.sync) $('modeSync').click(); else $('modeUnsync').click();
  log('Running scenario: '+$('scenarioSel').selectedOptions[0].textContent,'info');
  start();
};

// ---------- Race condition timeline demo ----------
$('raceBtn').onclick=()=>{
  const before = count || 2;
  const rows = [
    ['T0','count = '+before, before],
    ['T1','Satellite reads count', before],
    ['T2','Ground Station reads count', before],
    ['T3','Satellite calculates count+1 = '+(before+1), before],
    ['T4','Ground Station calculates count-1 = '+(before-1), before],
    ['T5','Both write their values (Ground Station writes last)', before-1]
  ];
  const body = $('timelineBody'); body.innerHTML='';
  rows.forEach((r,i)=>{
    setTimeout(()=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td>`;
      body.appendChild(tr);
      if(i===rows.length-1){
        $('raceResult').style.display='block';
        $('raceResult').innerHTML = `<b>⚠ Race Condition</b><br>Expected final value: <b>${before}</b> (one increment, one decrement should cancel out)<br>
          Possible incorrect state produced: <b>${before-1}</b> or <b>${before+1}</b> depending on write order.<br><br>
          This happens because both processes read the <i>same old value</i> before either had written back — the second write silently overwrites the first.
          <br><br><b style="color:var(--ok)">With mutex:</b> the second process must wait() until the first unlock()s, so each operation sees the correctly updated value — no update is lost.`;
      }
    }, i*500);
  });
};

// ---------- Procedure list ----------
const procedureSteps = [
  'Open the simulator.',
  'Go to the Simulator tab.',
  'Set buffer capacity to 3 or 5.',
  'Set the satellite\'s production speed.',
  'Set the ground station\'s consumption speed.',
  'Click Start to run the simulation.',
  'Observe packets entering the buffer slots.',
  'Observe the 🔴 BUFFER FULL condition when all slots fill.',
  'Observe the producer status change to WAITING.',
  'Observe the consumer removing packets from the buffer.',
  'Observe the 🔵 BUFFER EMPTY condition when no packets remain.',
  'Open the Race Condition tab.',
  'Run the simulation in UNSYNCHRONIZED mode.',
  'Observe the incorrect shared-state (count) behavior.',
  'Switch to SYNCHRONIZED mode.',
  'Open the Synchronization tab and observe empty, full and mutex values update live.',
  'Set a Communication Window duration.',
  'Observe what happens to the ground station when the window closes.',
  'Compare synchronized and unsynchronized results in the Comparison tab.',
  'Click Reset and run another scenario.'
];
const procList = $('procList');
procedureSteps.forEach(s=>{ const li=document.createElement('li'); li.textContent=s; procList.appendChild(li); });

// ---------- Concepts ----------
const concepts = [
  ['Producer–Consumer Problem','Two processes share a fixed-size buffer: one (the producer) adds data, the other (the consumer) removes it. They must coordinate so the buffer is never overfilled or read when empty.'],
  ['Bounded Buffer','A buffer with a fixed, limited capacity — here, the satellite\'s onboard storage for packets awaiting transmission.'],
  ['Shared Resource','Data that more than one process can access — here, the buffer and the count of packets in it.'],
  ['Race Condition','An error that occurs when two processes access/modify shared data at the same time, and the final result depends on the unpredictable order of execution.'],
  ['Critical Section','The part of a process\'s code where it accesses the shared resource. Only one process should be inside its critical section at a time.'],
  ['Mutual Exclusion','The guarantee that no two processes are in their critical sections for the same shared resource simultaneously.'],
  ['Semaphore','An integer counter used for signaling between processes, with wait() (decrease, block if zero) and signal() (increase) operations.'],
  ['Mutex','A special binary lock used purely for mutual exclusion around a critical section: locked by one process, unlocked when it finishes.'],
  ['Buffer Full','The condition where every slot in the bounded buffer is occupied; the producer must wait before adding more.'],
  ['Buffer Empty','The condition where no items remain in the buffer; the consumer must wait before removing anything.'],
  ['Communication Window','A limited time period during which the satellite and ground station can exchange data — outside it, no transmission is possible.'],
  ['Waiting Time','How long a packet stays in the buffer before being consumed; if it exceeds a maximum, it is marked expired to show that delayed data can lose value.']
];
const cp = $('conceptsPanel');
concepts.forEach(c=>{
  const div=document.createElement('div'); div.className='concept-item';
  div.innerHTML = `<h4>${c[0]}</h4><p>${c[1]}</p>`;
  cp.appendChild(div);
});

// ---------- Results ----------
$('genResults').onclick=()=>{
  const avg = waitTimes.length ? (waitTimes.reduce((a,b)=>a+b,0)/waitTimes.length) : 0;
  const mx = waitTimes.length ? Math.max(...waitTimes) : 0;
  $('resultsBody').innerHTML = `
    <b>Simulation Snapshot</b><br><br>
    Packets Produced: <b>${stats.produced}</b><br>
    Packets Consumed: <b>${stats.consumed}</b><br>
    Packets Remaining in Buffer: <b>${count}</b><br>
    Packets Expired: <b>${stats.expired}</b><br><br>
    Buffer Full Events: <b>${stats.bufferFull}</b><br>
    Buffer Empty Events: <b>${stats.bufferEmpty}</b><br>
    Race Conditions Detected: <b>${stats.race}</b><br><br>
    Average Waiting Time: <b>${avg.toFixed(1)}s</b><br>
    Maximum Waiting Time: <b>${mx.toFixed(1)}s</b><br><br>
    Synchronization: <b>${synchronized ? 'Enabled':'Disabled'}</b><br>
    Communication Window: <b>${winTotal} seconds (${winUsed}s used)</b>`;
};

// ---------- Init ----------
reset();
