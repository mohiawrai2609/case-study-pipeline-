
// ═══ PROGRESS + BTT ═══
window.addEventListener('scroll',()=>{const s=document.documentElement.scrollTop,h=document.documentElement.scrollHeight-window.innerHeight;document.getElementById('prog').style.width=(s/h*100)+'%';document.getElementById('btt').classList.toggle('vis',s>600)},{passive:true});

// ═══ REVEAL ═══
const obs=new IntersectionObserver(es=>{es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('revealed');obs.unobserve(e.target)}})},{threshold:.1,rootMargin:'0px 0px -30px 0px'});
document.querySelectorAll('.reveal').forEach(el=>obs.observe(el));

// ═══ RPI GAUGE ANIMATION ═══
const gaugeObs=new IntersectionObserver(es=>{es.forEach(e=>{if(e.isIntersecting){
  // Animate arc: 32.2% of semicircle
  const arc=document.getElementById('gaugeArc');
  const total=283;const target=total*(1-0.322);
  arc.style.transition='stroke-dashoffset 1.8s cubic-bezier(.16,1,.3,1)';
  arc.style.strokeDashoffset=target;
  // Animate value
  let v=0;const dur=1800;const st=performance.now();
  (function f(n){const p=Math.min((n-st)/dur,1);const ea=1-Math.pow(1-p,3);v=32.2*ea;document.getElementById('gaugeVal').textContent=v.toFixed(1)+'%';if(p<1)requestAnimationFrame(f)})(st);
  // Bars
  setTimeout(()=>{
    document.getElementById('apsBar').style.width='52%';document.getElementById('apsVal').textContent='52%';
    document.getElementById('hrfBar').style.width='38%';document.getElementById('hrfVal').textContent='38%';
    document.getElementById('untBar').style.width='48%';document.getElementById('untVal').textContent='48%';
    document.getElementById('ajcBar').style.width='11%';document.getElementById('ajcVal').textContent='11%';
  },200);
  gaugeObs.unobserve(e.target);
}})},{threshold:.3});
document.querySelectorAll('.gauge-wrap').forEach(el=>gaugeObs.observe(el));

// ═══ SHIFT TIMELINE ═══
const shiftData=[
  {time:'6:00 AM',task:'Equipment diagnostics & kitchen prep',type:'augmented',desc:'AI sensors run automated diagnostics. Zenput IoT confirms overnight temps. Worker reviews AI prep forecast, verifies perishable quality by hand, signs digital compliance. Machine detects; human decides and certifies.'},
  {time:'7:00 AM',task:'Opening — first kiosk orders flow in',type:'automated',desc:'Kiosks handle 90% of early transactions. AI upsell prompts increase average order value by 8-12%. Payment processing, order routing, and kitchen display sequencing run without human intervention. Worker monitors for exceptions.'},
  {time:'8:00 AM',task:'Breakfast rush — coordinating systems',type:'augmented',desc:'Worker coordinates between kiosk queue, kitchen display, and drive-through AI voice agent. Troubleshoots a kiosk screen freeze. Helps an elderly customer who can\'t navigate the interface. The human is the glue between automated systems.'},
  {time:'9:00 AM',task:'Brewing & beverage prep',type:'augmented',desc:'Semi-automated dispensers handle portion control and brew timing via Crunchtime recipe parameters. Worker monitors output quality, cleans nozzles, reloads ingredients. Machine ensures consistency; human ensures care.'},
  {time:'10:00 AM',task:'Inventory alerts & restocking',type:'automated',desc:'Restaurant365 AI flags that chicken stock is trending below par based on sales velocity. Auto-generates purchase order. Worker physically verifies perishable quality and confirms delivery. Intelligence is automated; judgment is human.'},
  {time:'11:00 AM',task:'Lunch prep — Flippy handles frying',type:'augmented',desc:'Flippy autonomously loads, fries, times, and transfers french fries and chicken tenders. NVIDIA vision system monitors food colour and temperature. Worker loads ingredient bins, assembles sandwiches, garnishes plates. Dangerous repetitive work: robot. Creative assembly: human.'},
  {time:'12:00 PM',task:'Peak rush — exception handling',type:'augmented',desc:'Maximum volume. Kiosks, kitchen displays, and Flippy all running simultaneously. Worker\'s primary role: managing the gaps. Fixing a jammed packaging machine. Redirecting orders when a kiosk goes offline. Answering questions the AI voice agent couldn\'t parse.'},
  {time:'1:00 PM',task:'Angry customer — wrong order',type:'human',desc:'A customer is furious: wrong meal, 20-minute wait, child is crying. No algorithm handles this. The worker reads the emotional state, adapts tone, offers a replacement and a sincere apology. Turns a one-star review into a returning customer. This is irreplaceably human.'},
  {time:'2:00 PM',task:'Food safety compliance check',type:'human',desc:'Environmental health protocols require human sign-off. Worker walks the floor: checks fryer oil clarity, grill surface cleanliness, prep station organisation. Signs the digital compliance log. IoT detected the data; the human bears the accountability.'},
  {time:'3:00 PM',task:'Deep clean — grill and fryer area',type:'human',desc:'Burnt grease on the grill. Splattered oil around the fryer. Clogged drain cover. Every surface is different. No robot can assess "clean enough" for an inspector. The worker scrubs, judges, adapts. Entropy defeats automation.'},
  {time:'4:00 PM',task:'Afternoon kiosk monitoring',type:'automated',desc:'Transaction volume drops. Kiosks handle nearly all orders. Cash reconciliation auto-runs. Toast POS flags a $12 discrepancy for human review. Worker verifies, resolves in 2 minutes. The machine audits; the human adjudicates.'},
  {time:'5:00 PM',task:'Shift handover & close',type:'augmented',desc:'AI generates shift summary: transaction count, food waste, customer feedback scores, equipment alerts. Incoming worker receives context-rich briefing. No clipboard. No guesswork. The augmented handover is faster, more accurate, and more accountable than any manual process.'}
];

const hoursEl=document.getElementById('shiftHours');
shiftData.forEach((s,i)=>{
  const h=document.createElement('div');
  h.className='shift-hour '+s.type;
  h.textContent=s.time.split(' ')[0].split(':')[0];
  h.onclick=()=>{
    document.querySelectorAll('.shift-hour').forEach(x=>x.classList.remove('active'));
    h.classList.add('active');
    document.getElementById('sdTime').textContent=s.time+' — '+s.type.charAt(0).toUpperCase()+s.type.slice(1);
    document.getElementById('sdTask').textContent=s.task;
    document.getElementById('sdDesc').textContent=s.desc;
  };
  if(i===0)h.classList.add('active');
  hoursEl.appendChild(h);
});

// ═══ TASK GRID ═══
const tasks=[
  {name:'Payment Processing',type:'r',desc:'Self-service kiosks handle 70%+ of transactions with AI upsell prompts, payment processing, and order customisation.',vendor:'Toast, Oracle MICROS'},
  {name:'Counter Coordination',type:'r',desc:'AI kitchen display receives orders from kiosks and routes each item to correct prep station with load-balanced sequencing.',vendor:'Crunchtime'},
  {name:'Order Recording',type:'r',desc:'Kiosk/app captures orders including complex customisations. Human fallback for language barriers and modifier failures.',vendor:'Toast'},
  {name:'Cash Reconciliation',type:'r',desc:'AI auto-totals drawers, calculates expected balance, flags discrepancies. Human counts cash and reviews anomalies.',vendor:'Toast'},
  {name:'Complaint Handling',type:'h',desc:'De-escalating customer frustrations that automated systems cannot resolve. Requires emotional intelligence and improvised empathy.',vendor:'No vendor — human only'},
  {name:'Food Serving',type:'r',desc:'Robotic fry station handles cooking. Human performs final quality checks, presentation, and handoff.',vendor:'Miso Robotics (Flippy)'},
  {name:'Inventory Monitoring',type:'r',desc:'AI predicts shortages based on sales velocity, auto-generates purchase orders. Human executes restocking and verifies quality.',vendor:'Restaurant365'},
  {name:'Equipment Cleaning',type:'h',desc:'Manual cleaning of grills, fryers, surfaces. Irregular mess patterns and health code requirements demand human judgment.',vendor:'No vendor — human only'},
  {name:'Beverage Prep',type:'a',desc:'Semi-automated dispensers handle brew timing and portions. Human monitors quality and handles machine errors.',vendor:'Crunchtime'},
  {name:'Area Cleaning',type:'h',desc:'Dining areas, service stations, floors. Variability in mess and regulatory human sign-off requirements.',vendor:'No vendor — human only'},
  {name:'Food Preparation',type:'a',desc:'AI-monitored smart grills and auto-fryers. Human assembles, garnishes, ensures food safety.',vendor:'Miso Robotics'},
  {name:'Frozen Drinks',type:'a',desc:'Automated dispensing with recipe-controlled portions. Human loads ingredients and troubleshoots jams.',vendor:'Crunchtime'},
  {name:'Packaging',type:'r',desc:'Robotic bagging in high-volume locations. Human handles exceptions and special packaging.',vendor:'Brightpick'},
  {name:'Temp Monitoring',type:'r',desc:'IoT sensors continuously log temps, auto-trigger alerts. Human responds to alerts rather than proactively checking.',vendor:'Zenput (Crunchtime)'},
  {name:'Kiosk Assistance',type:'a',desc:'AI detects abandonment patterns, auto-triggers human help. Worker assists with disability, language, tech aversion.',vendor:'Intercom (Fin AI)'}
];
const tg=document.getElementById('taskGrid');
tasks.forEach((t,i)=>{
  const b=document.createElement('div');
  b.className='task-block '+t.type;
  b.innerHTML=`<div class="task-block-name">${t.name}</div><div class="task-block-type">${t.type==='r'?'Replaced':t.type==='a'?'Augmented':'Human'}</div>`;
  b.onclick=()=>{
    const p=document.getElementById('taskDetail');
    p.classList.add('open');
    document.getElementById('tdName').textContent=t.name;
    document.getElementById('tdDesc').textContent=t.desc;
    const vMap={'Toast':'/marketplace/vendor/toast','Oracle MICROS':'/marketplace/vendor/oracle','Crunchtime':'/marketplace/vendor/crunchtime','Miso Robotics':'/marketplace/vendor/miso-robotics','Miso Robotics (Flippy)':'/marketplace/vendor/miso-robotics','Restaurant365':'/marketplace/vendor/restaurant365','Brightpick':'/marketplace/vendor/brightpick','Intercom (Fin AI)':'/marketplace/vendor/intercom','Zenput (Crunchtime)':'/marketplace/vendor/crunchtime','Toast, Oracle MICROS':'/marketplace/vendor/toast'};
    const vNames=t.vendor.split(', ');
    const vLinks=vNames.map(vn=>{const slug=vMap[vn]||vMap[t.vendor];const vid=slug?slug.split('/').pop():'';return slug?'<a href="javascript:void(0)" onclick="openVendorProfile(\''+vid+'\')" style="color:var(--c);text-decoration:none;border-bottom:1px solid var(--c)">'+vn+'</a>':vn;}).join(', ');
    document.getElementById('tdVendor').innerHTML='Vendor: '+vLinks;
    p.scrollIntoView({behavior:'smooth',block:'nearest'});
  };
  tg.appendChild(b);
});

// ═══ AUTOMATION INTELLIGENCE MATRIX ═══
(function(){
const svg=document.getElementById('matrixSvg');
const card=document.getElementById('mxCard');
const area=document.getElementById('matrixArea');
if(!svg||!card||!area) return;
const P={l:72,r:565,t:30,b:375};const W=P.r-P.l,H=P.b-P.t;
const xMin=0,xMax=0.40,yMin=0.48,yMax=0.90;
function xPx(v){return P.l+((v-xMin)/(xMax-xMin))*W;}
function yPx(v){return P.b-((v-yMin)/(yMax-yMin))*H;}
const bThresh=0.16,dThresh=0.70;
const V=[
  {name:'Toast',breadth:5/15,depth:.74,workers:164000,evidence:'Production',evCls:'mx-ev-prod',tasks:[{t:'Payment Processing',aps:.82,vec:'Cognitive'},{t:'Order Recording',aps:.78,vec:'Cognitive'},{t:'Cash Reconciliation',aps:.71,vec:'Cognitive'},{t:'Counter Coordination',aps:.68,vec:'Hybrid'},{t:'Kiosk Assistance',aps:.70,vec:'Cognitive'}],note:'NYSE: TOST. Toast IQ AI. $195B payment volume. 15% of US restaurants.'},
  {name:'Crunchtime',breadth:4/15,depth:.68,workers:42000,evidence:'Production',evCls:'mx-ev-prod',tasks:[{t:'Counter Coordination',aps:.72,vec:'Cognitive'},{t:'Beverage Prep',aps:.65,vec:'Hybrid'},{t:'Frozen Drinks',aps:.66,vec:'Physical'},{t:'Temp Monitoring',aps:.69,vec:'Cognitive'}],note:'Kitchen routing + Zenput food safety. 850+ brands. G2 4.7/5.'},
  {name:'Miso Robotics',breadth:2/15,depth:.81,workers:800,evidence:'Production',evCls:'mx-ev-prod',tasks:[{t:'Food Serving',aps:.83,vec:'Physical'},{t:'Food Preparation',aps:.79,vec:'Physical'}],note:'Flippy fry station. NVIDIA AI vision. 99% uptime. RaaS model.'},
  {name:'Oracle MICROS',breadth:2/15,depth:.70,workers:120000,evidence:'Production',evCls:'mx-ev-prod',tasks:[{t:'Payment Processing',aps:.74,vec:'Cognitive'},{t:'Kiosk Assistance',aps:.66,vec:'Cognitive'}],note:'Simphony POS. Only enterprise kiosk with 180+ country compliance.'},
  {name:'Restaurant365',breadth:2/15,depth:.72,workers:40000,evidence:'Production',evCls:'mx-ev-prod',tasks:[{t:'Inventory Monitoring',aps:.76,vec:'Cognitive'},{t:'Cash Reconciliation',aps:.68,vec:'Cognitive'}],note:'#1 G2 across 12 categories. AI-driven inventory forecasting.'},
  {name:'Intercom',breadth:1/15,depth:.62,workers:5000,evidence:'Pilot',evCls:'mx-ev-pilot',tasks:[{t:'Kiosk Assistance',aps:.62,vec:'Cognitive'}],note:'Fin AI agent. Kiosk abandonment detection. 2.3M events from Klarna.'},
  {name:'Brightpick',breadth:1/15,depth:.58,workers:200,evidence:'Pilot',evCls:'mx-ev-pilot',tasks:[{t:'Packaging',aps:.58,vec:'Physical'}],note:'Autopicker robots. 70K items/day. Lights-out overnight.'}
];
V.forEach(v=>{if(v.breadth>=bThresh&&v.depth>=dThresh)v.quad='Leader';else if(v.breadth<bThresh&&v.depth>=dThresh)v.quad='Deep Specialist';else if(v.breadth>=bThresh&&v.depth<dThresh)v.quad='Wide but Shallow';else v.quad='Emerging';});
const wMin=Math.log(Math.min(...V.map(v=>v.workers))),wMax=Math.log(Math.max(...V.map(v=>v.workers)));
V.forEach(v=>{v.r=8+((Math.log(v.workers)-wMin)/(wMax-wMin||1))*28;});
const QC={'Leader':'#C41E3A','Deep Specialist':'#2563EB','Wide but Shallow':'#B45309','Emerging':'#A8A29E'};
const QCtext={'Leader':'#C41E3A','Deep Specialist':'#2563EB','Wide but Shallow':'#B45309','Emerging':'#A8A29E'};
let s='';
s+=`<rect x="${P.l}" y="${P.t}" width="${xPx(bThresh)-P.l}" height="${yPx(dThresh)-P.t}" fill="rgba(37,99,235,.018)"/>`;
s+=`<rect x="${xPx(bThresh)}" y="${P.t}" width="${P.r-xPx(bThresh)}" height="${yPx(dThresh)-P.t}" fill="rgba(196,30,58,.018)"/>`;
s+=`<rect x="${P.l}" y="${yPx(dThresh)}" width="${xPx(bThresh)-P.l}" height="${P.b-yPx(dThresh)}" fill="rgba(168,162,158,.02)"/>`;
s+=`<rect x="${xPx(bThresh)}" y="${yPx(dThresh)}" width="${P.r-xPx(bThresh)}" height="${P.b-yPx(dThresh)}" fill="rgba(180,83,9,.018)"/>`;
[{txt:'LEADERS',x:(xPx(bThresh)+P.r)/2,y:P.t+16,c:'rgba(196,30,58,.3)'},{txt:'DEEP SPECIALISTS',x:(P.l+xPx(bThresh))/2,y:P.t+16,c:'rgba(37,99,235,.3)'},{txt:'WIDE BUT SHALLOW',x:(xPx(bThresh)+P.r)/2,y:P.b-8,c:'rgba(180,83,9,.3)'},{txt:'EMERGING',x:(P.l+xPx(bThresh))/2,y:P.b-8,c:'rgba(168,162,158,.4)'}].forEach(q=>{s+=`<text x="${q.x}" y="${q.y}" text-anchor="middle" font-family="'Playfair Display',serif" font-size="8" font-weight="600" letter-spacing="1" fill="${q.c}">${q.txt}</text>`;});
[0,.1,.2,.3,.4].forEach(t=>{const x=xPx(t);s+=`<line x1="${x}" y1="${P.t}" x2="${x}" y2="${P.b}" stroke="#E7E5E4" stroke-width=".5"/>`;s+=`<text x="${x}" y="${P.b+16}" text-anchor="middle" font-family="'DM Mono',monospace" font-size="8" fill="#A8A29E">${Math.round(t*15)} tasks</text>`;});
[.5,.6,.7,.8,.9].forEach(t=>{const y=yPx(t);s+=`<line x1="${P.l}" y1="${y}" x2="${P.r}" y2="${y}" stroke="#E7E5E4" stroke-width=".5"/>`;s+=`<text x="${P.l-6}" y="${y+3}" text-anchor="end" font-family="'DM Mono',monospace" font-size="8" fill="#A8A29E">${(t*100).toFixed(0)}%</text>`;});
s+=`<line x1="${xPx(bThresh)}" y1="${P.t}" x2="${xPx(bThresh)}" y2="${P.b}" stroke="#D6D3D1" stroke-width="1" stroke-dasharray="4,3"/>`;
s+=`<line x1="${P.l}" y1="${yPx(dThresh)}" x2="${P.r}" y2="${yPx(dThresh)}" stroke="#D6D3D1" stroke-width="1" stroke-dasharray="4,3"/>`;
s+=`<line x1="${P.l}" y1="${P.b}" x2="${P.r}" y2="${P.b}" stroke="#D6D3D1" stroke-width="1"/>`;
s+=`<line x1="${P.l}" y1="${P.t}" x2="${P.l}" y2="${P.b}" stroke="#D6D3D1" stroke-width="1"/>`;
s+=`<text x="${(P.l+P.r)/2}" y="${P.b+32}" text-anchor="middle" font-family="'DM Mono',monospace" font-size="8" font-weight="500" letter-spacing="2" fill="#A8A29E">TASK COVERAGE BREADTH →</text>`;
s+=`<text x="${P.l-42}" y="${(P.t+P.b)/2}" text-anchor="middle" font-family="'DM Mono',monospace" font-size="8" font-weight="500" letter-spacing="2" fill="#A8A29E" transform="rotate(-90,${P.l-42},${(P.t+P.b)/2})">AUTOMATION DEPTH (APS) →</text>`;
s+=`<rect x="${P.l}" y="${P.t}" width="${W}" height="${H}" fill="none" stroke="#E7E5E4" stroke-width=".5"/>`;
V.forEach((v,i)=>{const cx=xPx(v.breadth),cy=yPx(v.depth),fill=QC[v.quad]||'#A8A29E',op=v.quad==='Emerging'?'.6':'.9';s+=`<circle cx="${cx}" cy="${cy}" r="${v.r}" fill="${fill}" fill-opacity="${op}" stroke="#fff" stroke-width="2" style="cursor:pointer;transition:all .25s cubic-bezier(.22,1,.36,1);filter:drop-shadow(0 2px 4px rgba(0,0,0,.15))" data-i="${i}" class="mx-dot"/>`;s+=`<text x="${cx}" y="${cy-v.r-5}" text-anchor="middle" font-family="'Outfit',sans-serif" font-size="8" font-weight="600" fill="#1C1917" pointer-events="none">${v.name}</text>`;if(v.r>14)s+=`<text x="${cx}" y="${cy+3}" text-anchor="middle" font-family="'DM Mono',monospace" font-size="7" fill="rgba(255,255,255,.8)" pointer-events="none">${v.tasks.length}/15</text>`;});
svg.innerHTML=s;
function buildCard(v){let h=`<div class="mx-card-name">${v.name}</div><div class="mx-card-quad" style="color:${QCtext[v.quad]}">${v.quad}</div><div class="mx-row"><span class="mx-lbl">Tasks Covered</span><span class="mx-val">${v.tasks.length}/15</span></div><div class="mx-row"><span class="mx-lbl">Avg. APS</span><span class="mx-val">${(v.depth*100).toFixed(0)}%</span></div><div class="mx-row"><span class="mx-lbl">Workers Reached</span><span class="mx-val">${v.workers>=1000?(v.workers/1000).toFixed(0)+'K':v.workers}</span></div><div class="mx-div"></div>`;v.tasks.forEach(t=>{h+=`<div class="mx-task"><span>${t.t}</span><span class="mx-task-vec">${t.vec}</span><span class="mx-task-aps">${(t.aps*100).toFixed(0)}%</span></div>`;});h+=`<div class="mx-ev ${v.evCls}">${v.evidence}</div><div style="font-family:'DM Mono',monospace;font-size:9px;color:rgba(255,255,255,.4);margin-top:8px;line-height:1.4">${v.note}</div>`;return h;}
svg.addEventListener('mouseover',function(e){const dot=e.target.closest('.mx-dot');if(!dot)return;const v=V[+dot.getAttribute('data-i')];card.innerHTML=buildCard(v);card.classList.add('active');dot.setAttribute('r',v.r*1.15);dot.setAttribute('fill-opacity','1');const svgRect=svg.getBoundingClientRect(),areaRect=area.getBoundingClientRect(),cx=+dot.getAttribute('cx'),cy=+dot.getAttribute('cy'),scale=svgRect.width/600;let left=(cx*scale)+svgRect.left-areaRect.left+20,top=(cy*scale)+svgRect.top-areaRect.top-60;if(left+250>areaRect.width)left=left-270;if(top<0)top=10;card.style.left=left+'px';card.style.top=top+'px';});
svg.addEventListener('mouseout',function(e){const dot=e.target.closest('.mx-dot');if(!dot)return;const v=V[+dot.getAttribute('data-i')];card.classList.remove('active');dot.setAttribute('r',v.r);dot.setAttribute('fill-opacity',v.quad==='Emerging'?'.6':'.9');});
})();
// ═══ EXPANDABLE VENDOR CARDS ═══
(function(){
const container=document.getElementById('vxGroups');if(!container)return;
const QC={'Leader':'#C41E3A','Deep Specialist':'#2563EB','Wide but Shallow':'#B45309','Emerging':'#A8A29E'};
const quadOrder=['Leader','Deep Specialist','Wide but Shallow','Emerging'];
const quadDesc={'Leader':'High breadth + High depth','Deep Specialist':'Narrow + High depth','Wide but Shallow':'Broad + Lower depth','Emerging':'Developing'};
const V=[
  {id:'to',name:'Toast',stage:'NYSE: TOST',logo:'linear-gradient(135deg,#C41E3A,#9A1830)',li:'T',quad:'Leader',tasks:5,aps:74,workers:'164K',prods:4,evidence:'Production',desc:'Dominant QSR POS. Toast IQ AI manages menu updates, shift scheduling, upsell strategies. 15% of US restaurant data.',tt:[{n:'Payment Processing',a:82,v:'Cognitive',c:'h'},{n:'Order Recording',a:78,v:'Cognitive',c:'h'},{n:'Cash Reconciliation',a:71,v:'Cognitive',c:'h'},{n:'Counter Coordination',a:68,v:'Hybrid',c:'m'},{n:'Kiosk Assistance',a:70,v:'Cognitive',c:'h'}]},
  {id:'ct',name:'Crunchtime',stage:'PE-backed',logo:'linear-gradient(135deg,#B45309,#92400E)',li:'CT',quad:'Wide but Shallow',tasks:4,aps:68,workers:'42K',prods:3,evidence:'Production',desc:'Kitchen routing + Zenput food safety. 850+ brands. G2 4.7/5. Broadest ops coverage.',tt:[{n:'Counter Coordination',a:72,v:'Cognitive',c:'h'},{n:'Beverage Prep',a:65,v:'Hybrid',c:'m'},{n:'Frozen Drinks',a:66,v:'Physical',c:'m'},{n:'Temp Monitoring',a:69,v:'Cognitive',c:'m'}]},
  {id:'mr',name:'Miso Robotics',stage:'Series D',logo:'linear-gradient(135deg,#2563EB,#1D4ED8)',li:'MR',quad:'Deep Specialist',tasks:2,aps:81,workers:'800',prods:1,evidence:'Production',desc:'Flippy fry station. NVIDIA AI vision. 99% uptime. Highest APS on physical food prep.',tt:[{n:'Food Serving',a:83,v:'Physical',c:'h'},{n:'Food Preparation',a:79,v:'Physical',c:'h'}]},
  {id:'om',name:'Oracle MICROS',stage:'NYSE: ORCL',logo:'linear-gradient(135deg,#059669,#047857)',li:'OM',quad:'Deep Specialist',tasks:2,aps:70,workers:'120K',prods:1,evidence:'Production',desc:'Simphony POS. Only enterprise kiosk with 180+ country compliance.',tt:[{n:'Payment Processing',a:74,v:'Cognitive',c:'h'},{n:'Kiosk Assistance',a:66,v:'Cognitive',c:'m'}]},
  {id:'r3',name:'Restaurant365',stage:'Series D',logo:'linear-gradient(135deg,#059669,#047857)',li:'R3',quad:'Deep Specialist',tasks:2,aps:72,workers:'40K',prods:1,evidence:'Production',desc:'#1 on G2 across 12 categories. AI-driven inventory forecasting.',tt:[{n:'Inventory Monitoring',a:76,v:'Cognitive',c:'h'},{n:'Cash Reconciliation',a:68,v:'Cognitive',c:'m'}]},
  {id:'ic',name:'Intercom',stage:'Series D',logo:'linear-gradient(135deg,#A8A29E,#78716C)',li:'IC',quad:'Emerging',tasks:1,aps:62,workers:'5K',prods:1,evidence:'Pilot',desc:'Fin AI agent. Kiosk abandonment detection. 2.3M events from Klarna.',tt:[{n:'Kiosk Assistance',a:62,v:'Cognitive',c:'m'}]},
  {id:'bp',name:'Brightpick',stage:'Series A',logo:'linear-gradient(135deg,#A8A29E,#78716C)',li:'BP',quad:'Emerging',tasks:1,aps:58,workers:'200',prods:1,evidence:'Pilot',desc:'Autopicker robots. 70K items/day. Lights-out overnight.',tt:[{n:'Packaging',a:58,v:'Physical',c:'m'}]}
];
const grouped={};quadOrder.forEach(q=>{grouped[q]=V.filter(v=>v.quad===q);});
let html='';
quadOrder.forEach(q=>{const vendors=grouped[q];if(!vendors.length)return;const color=QC[q];const bCol=q==='Leader'?'crimson':q==='Deep Specialist'?'blue':q==='Wide but Shallow'?'amber':'amber';const isLeader=q==='Leader';html+=`<div class="vx-group${isLeader?' open':''}"><div class="vx-group-head"><div class="vx-group-dot" style="background:${color}"></div><div class="vx-group-label">${q}</div><div class="vx-group-desc">${quadDesc[q]}</div><div class="vx-group-arrow">▸</div></div><div class="vx-cards">`;vendors.forEach(v=>{const ac=v.aps>=70?'h':'m';const dCol=v.aps>=70?'emerald':'amber';const bPct=Math.round((v.tasks/15)*100);html+=`<div class="vx-card" id="c-${v.id}"><div class="vx-card-top"><div class="vx-card-logo" style="background:${v.logo}">${v.li}</div><div class="vx-card-info"><div class="vx-card-name">${v.name}</div><div class="vx-card-stage">${v.stage}</div></div><div class="vx-card-aps ${ac}">${v.aps}%</div></div><div class="vx-bars"><div><div class="vx-bar-lbl"><span>Breadth</span><span>${v.tasks}/15</span></div><div class="vx-bar-track"><div class="vx-bar-fill ${bCol}" style="--tw:${bPct}%;animation-delay:.3s"></div></div></div><div><div class="vx-bar-lbl"><span>Depth</span><span>${v.aps}%</span></div><div class="vx-bar-track"><div class="vx-bar-fill ${dCol}" style="--tw:${v.aps}%;animation-delay:.5s"></div></div></div></div><div class="vx-stats"><div class="vx-stat"><div class="stl">Tasks</div><div class="stv">${v.tasks}/15</div></div><div class="vx-stat"><div class="stl">Products</div><div class="stv">${v.prods}</div></div><div class="vx-stat"><div class="stl">Workers</div><div class="stv">${v.workers}</div></div><div class="vx-stat"><div class="stl">Evidence</div><div class="stv">${v.evidence==='Production'?'Prod':'Pilot'}</div></div></div><div class="vx-expand"><div class="vx-desc">${v.desc}</div><div class="vx-tasks-hd">Task-Level Automation Scores</div>${v.tt.map(t=>`<div class="vx-task-row"><div class="vx-task-name">${t.n}</div><div class="vx-task-vec">${t.v}</div><div class="vx-task-aps ${t.c}">${t.a}%</div></div>`).join('')}</div><div class="vx-toggle" onclick="vxTog('c-${v.id}')"><span class="tg-txt">Expand ↓</span></div></div>`;});html+=`</div></div>`;});
container.innerHTML=html;
container.querySelectorAll('.vx-group-head').forEach(head=>{head.addEventListener('click',function(){this.parentElement.classList.toggle('open');});});
})();
function vxTog(id){const c=document.getElementById(id);const was=c.classList.contains('expanded');document.querySelectorAll('.vx-card.expanded').forEach(x=>{x.classList.remove('expanded');x.querySelector('.tg-txt').textContent='Expand ↓'});if(!was){c.classList.add('expanded');c.querySelector('.tg-txt').textContent='Collapse ↑'}}


// ═══ FEEDBACK SYSTEM 2 ═══
let fbAccuracy=null;
function setAcc(val){
  fbAccuracy=val;
  document.querySelectorAll('.fb2-acc-btn').forEach(b=>{b.classList.toggle('on',b.dataset.v===val)});
}
function subFb2(){
  const data={accuracy:fbAccuracy,correction:document.getElementById('fbCorrection').value,name:document.getElementById('fbName').value,role:document.getElementById('fbRole').value,email:document.getElementById('fbEmail').value,vendor:document.getElementById('fbVendor').value,consent:document.getElementById('fbConsent').checked,invite:document.getElementById('fbInvite').value,role_scored:'Fast Food Counter Worker (35-3023)',rpi:'32.2%',timestamp:new Date().toISOString()};
  console.log('Feedback payload:',JSON.stringify(data));
  document.getElementById('fbForm').style.opacity='.5';
  setTimeout(()=>{document.getElementById('fbOk').style.display='block';document.getElementById('fbForm').style.opacity='1'},600);
}

// ═══ INVITE URL HANDLING ═══
(function(){
  const params=new URLSearchParams(window.location.search);
  if(params.get('ref')==='vendor-invite'){
    const vendor=params.get('vendor');
    if(vendor){
      const bar=document.getElementById('inviteBar');
      document.getElementById('inviteVendor').textContent=vendor.replace(/-/g,' ').replace(/\b\w/g,l=>l.toUpperCase());
      bar.classList.add('show');
    }
  }
})();

// ═══ ECONOMICS SLIDER ═══
const slider=document.getElementById('econSlider');
slider.addEventListener('input',()=>{
  const vol=parseInt(slider.value);
  document.getElementById('econSliderVal').textContent=vol;
  // Model: labour savings scale linearly above 200, tech costs are fixed
  const labourBase=34500;const techFixed=17600;
  const labourScaled=Math.max(0,labourBase*(vol/500));
  const net=Math.round(labourScaled-techFixed);
  document.getElementById('econLabour').textContent='$'+labourScaled.toLocaleString();
  document.getElementById('econTech').textContent='−$'+techFixed.toLocaleString();
  document.getElementById('econNet').textContent=(net>=0?'$':'−$')+Math.abs(net).toLocaleString();
  document.getElementById('econNet').style.color=net>=0?'var(--am)':'var(--c)';
  document.getElementById('econLabour').style.color='var(--em)';
});

// ═══ FEEDBACK: old functions (kept for compat) ═══
let fbR=0;
function setR(n){fbR=n;document.querySelectorAll('.fb-star').forEach(s=>{s.classList.toggle('on',parseInt(s.dataset.v)<=n)})}
function subFb(){document.getElementById('fbOk').style.display='block'}
