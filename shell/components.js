// ═══ NORMALISE: ONE canonical vendor shape → both consumers ═══
// v20 hand-maintained this list twice in two numeric scales. Derived here instead.
(function(){
  const TOT = D.tasks.length;
  D.vendors.forEach(v=>{
    const aps = v.tasks.map(t=>t.aps);
    v.taskList  = v.tasks.map(t=>({t:t.name, aps:t.aps/100, vec:t.vec}));
    v.tt        = v.tasks.map(t=>({n:t.name, a:t.aps, v:t.vec, c:t.aps>=70?'h':'m'}));
    v.taskCount = v.tasks.length;
    v.breadth   = TOT ? v.tasks.length/TOT : 0;
    v.depth     = aps.length ? aps.reduce((a,b)=>a+b,0)/aps.length/100 : 0;
    v.aps       = Math.round(v.depth*100);
    v.prods     = v.products;
    v.li        = v.initials;
    v.reach = v.reach ?? v.trust ?? 60;
    v.workersLabel = v.workers ? (v.workers>=1000 ? Math.round(v.workers/1000)+'K' : String(v.workers))
                               : v.reach + '/100';
    v.evCls     = v.evidence==='Production' ? 'mx-ev-prod' : 'mx-ev-pilot';
    const broad = v.breadth >= D.matrix.breadthThreshold;
    const deep  = v.depth   >= D.matrix.depthThreshold;
    v.quad = broad&&deep ? 'Leader' : !broad&&deep ? 'Deep Specialist'
           : broad ? 'Wide but Shallow' : 'Emerging';
  });
})();


// ═══ PROGRESS + BTT ═══
window.addEventListener('scroll',()=>{const s=document.documentElement.scrollTop,h=document.documentElement.scrollHeight-window.innerHeight;document.getElementById('prog').style.width=(s/h*100)+'%';document.getElementById('btt').classList.toggle('vis',s>600)},{passive:true});

// ═══ REVEAL ═══
const obs=new IntersectionObserver(es=>{es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('revealed');obs.unobserve(e.target)}})},{threshold:.1,rootMargin:'0px 0px -30px 0px'});
document.querySelectorAll('.reveal').forEach(el=>obs.observe(el));

// ═══ RPI GAUGE ANIMATION ═══
const gaugeObs=new IntersectionObserver(es=>{es.forEach(e=>{if(e.isIntersecting){
  // Animate arc to D.scores.rpi% of the semicircle
  const arc=document.getElementById('gaugeArc');
  const total=283;const target=total*(1-D.scores.rpi/100);
  arc.style.transition='stroke-dashoffset 1.8s cubic-bezier(.16,1,.3,1)';
  arc.style.strokeDashoffset=target;
  // Animate value
  let v=0;const dur=1800;const st=performance.now();
  (function f(n){const p=Math.min((n-st)/dur,1);const ea=1-Math.pow(1-p,3);v=D.scores.rpi*ea;document.getElementById('gaugeVal').textContent=v.toFixed(1)+'%';if(p<1)requestAnimationFrame(f)})(st);
  // Bars
  setTimeout(()=>{
    [['aps','apsBar','apsVal'],['hrf','hrfBar','hrfVal'],['untouched','untBar','untVal'],['ajci','ajcBar','ajcVal']].forEach(([k,b,t])=>{const p=D.scores[k]+'%';document.getElementById(b).style.width=p;document.getElementById(t).textContent=p;});
  },200);
  gaugeObs.unobserve(e.target);
}})},{threshold:.3});
document.querySelectorAll('.gauge-wrap').forEach(el=>gaugeObs.observe(el));

// ═══ SHIFT TIMELINE ═══
const shiftData=D.shift;

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
const tasks=D.tasks;
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
    const vMap=Object.fromEntries((D.vendors||[]).map(v=>[v.name,'/marketplace/vendor/'+v.name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')]));
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
let xMin,xMax,yMin,yMax;
function xPx(v){return P.l+((v-xMin)/(xMax-xMin))*W;}
function yPx(v){return P.b-((v-yMin)/(yMax-yMin))*H;}
const bThresh=D.matrix.breadthThreshold,dThresh=D.matrix.depthThreshold;
// Long-tail vendors touching a single task all land on one coordinate — 30 of 43
// stacked on 8 points in No. 008. The scatter shows vendors at or above
// matrixMinTasks; the cards below still carry the complete roster.
const V=D.vendors.filter(v=>v.taskCount>=(D.matrix.matrixMinTasks||1));
{const _bs=V.map(v=>v.breadth),_ds=V.map(v=>v.depth);
 xMin=0; xMax=Math.max(0.25,Math.max(..._bs)*1.25);
 yMin=Math.max(0,Math.min(..._ds)-0.10); yMax=Math.min(1,Math.max(..._ds)+0.10);}
V.forEach(v=>{if(v.breadth>=bThresh&&v.depth>=dThresh)v.quad='Leader';else if(v.breadth<bThresh&&v.depth>=dThresh)v.quad='Deep Specialist';else if(v.breadth>=bThresh&&v.depth<dThresh)v.quad='Wide but Shallow';else v.quad='Emerging';});
const _rs=V.map(v=>v.reach);const wMin=Math.min(..._rs),wMax=Math.max(..._rs);
V.forEach(v=>{v.r=8+((v.reach-wMin)/((wMax-wMin)||1))*28;});
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
V.forEach((v,i)=>{const cx=xPx(v.breadth),cy=yPx(v.depth),fill=QC[v.quad]||'#A8A29E',op=v.quad==='Emerging'?'.6':'.9';s+=`<circle cx="${cx}" cy="${cy}" r="${v.r}" fill="${fill}" fill-opacity="${op}" stroke="#fff" stroke-width="2" style="cursor:pointer;transition:all .25s cubic-bezier(.22,1,.36,1);filter:drop-shadow(0 2px 4px rgba(0,0,0,.15))" data-i="${i}" class="mx-dot"/>`;s+=`<text x="${cx}" y="${cy-v.r-5}" text-anchor="middle" font-family="'Outfit',sans-serif" font-size="8" font-weight="600" fill="#1C1917" pointer-events="none">${v.name}</text>`;if(v.r>14)s+=`<text x="${cx}" y="${cy+3}" text-anchor="middle" font-family="'DM Mono',monospace" font-size="7" fill="rgba(255,255,255,.8)" pointer-events="none">${v.taskList.length}/${D.tasks.length}</text>`;});
svg.innerHTML=s;
function buildCard(v){let h=`<div class="mx-card-name">${v.name}</div><div class="mx-card-quad" style="color:${QCtext[v.quad]}">${v.quad}</div><div class="mx-row"><span class="mx-lbl">Tasks Covered</span><span class="mx-val">${v.taskList.length}/${D.tasks.length}</span></div><div class="mx-row"><span class="mx-lbl">Avg. APS</span><span class="mx-val">${(v.depth*100).toFixed(0)}%</span></div><div class="mx-row"><span class="mx-lbl">${v.workers?'Workers Reached':'Evidence Strength'}</span><span class="mx-val">${v.workers>=1000?(v.workers/1000).toFixed(0)+'K':v.workers}</span></div><div class="mx-div"></div>`;v.taskList.forEach(t=>{h+=`<div class="mx-task"><span>${t.t}</span><span class="mx-task-vec">${t.vec}</span><span class="mx-task-aps">${(t.aps*100).toFixed(0)}%</span></div>`;});h+=`<div class="mx-ev ${v.evCls}">${v.evidence}</div><div style="font-family:'DM Mono',monospace;font-size:9px;color:rgba(255,255,255,.4);margin-top:8px;line-height:1.4">${v.note}</div>`;return h;}
svg.addEventListener('mouseover',function(e){const dot=e.target.closest('.mx-dot');if(!dot)return;const v=V[+dot.getAttribute('data-i')];card.innerHTML=buildCard(v);card.classList.add('active');dot.setAttribute('r',v.r*1.15);dot.setAttribute('fill-opacity','1');const svgRect=svg.getBoundingClientRect(),areaRect=area.getBoundingClientRect(),cx=+dot.getAttribute('cx'),cy=+dot.getAttribute('cy'),scale=svgRect.width/600;let left=(cx*scale)+svgRect.left-areaRect.left+20,top=(cy*scale)+svgRect.top-areaRect.top-60;if(left+250>areaRect.width)left=left-270;if(top<0)top=10;card.style.left=left+'px';card.style.top=top+'px';});
svg.addEventListener('mouseout',function(e){const dot=e.target.closest('.mx-dot');if(!dot)return;const v=V[+dot.getAttribute('data-i')];card.classList.remove('active');dot.setAttribute('r',v.r);dot.setAttribute('fill-opacity',v.quad==='Emerging'?'.6':'.9');});
})();
// ═══ EXPANDABLE VENDOR CARDS ═══
(function(){
const container=document.getElementById('vxGroups');if(!container)return;
const QC={'Leader':'#C41E3A','Deep Specialist':'#2563EB','Wide but Shallow':'#B45309','Emerging':'#A8A29E'};
const quadOrder=['Leader','Deep Specialist','Wide but Shallow','Emerging'];
const quadDesc={'Leader':'High breadth + High depth','Deep Specialist':'Narrow + High depth','Wide but Shallow':'Broad + Lower depth','Emerging':'Developing'};
const V=D.vendors;
const grouped={};quadOrder.forEach(q=>{grouped[q]=V.filter(v=>v.quad===q);});
let html='';
quadOrder.forEach(q=>{const vendors=grouped[q];if(!vendors.length)return;const color=QC[q];const bCol=q==='Leader'?'crimson':q==='Deep Specialist'?'blue':q==='Wide but Shallow'?'amber':'amber';const isLeader=q==='Leader';html+=`<div class="vx-group${isLeader?' open':''}"><div class="vx-group-head"><div class="vx-group-dot" style="background:${color}"></div><div class="vx-group-label">${q}</div><div class="vx-group-desc">${quadDesc[q]}</div><div class="vx-group-arrow">▸</div></div><div class="vx-cards">`;vendors.forEach(v=>{const ac=v.aps>=70?'h':'m';const dCol=v.aps>=70?'emerald':'amber';const bPct=Math.round((v.taskCount/D.tasks.length)*100);html+=`<div class="vx-card" id="c-${v.id}"><div class="vx-card-top"><div class="vx-card-logo" style="background:${v.logo}">${v.li}</div><div class="vx-card-info"><div class="vx-card-name">${v.name}</div><div class="vx-card-stage">${v.stage}</div></div><div class="vx-card-aps ${ac}">${v.aps}%</div></div><div class="vx-bars"><div><div class="vx-bar-lbl"><span>Breadth</span><span>${v.taskCount}/${D.tasks.length}</span></div><div class="vx-bar-track"><div class="vx-bar-fill ${bCol}" style="--tw:${bPct}%;animation-delay:.3s"></div></div></div><div><div class="vx-bar-lbl"><span>Depth</span><span>${v.aps}%</span></div><div class="vx-bar-track"><div class="vx-bar-fill ${dCol}" style="--tw:${v.aps}%;animation-delay:.5s"></div></div></div></div><div class="vx-stats"><div class="vx-stat"><div class="stl">Tasks</div><div class="stv">${v.taskCount}/${D.tasks.length}</div></div><div class="vx-stat"><div class="stl">Products</div><div class="stv">${v.prods}</div></div><div class="vx-stat"><div class="stl">Workers</div><div class="stv">${v.workersLabel}</div></div><div class="vx-stat"><div class="stl">Evidence</div><div class="stv">${v.evidence==='Production'?'Prod':v.evidence==='Replacement'?'Repl':v.evidence==='Augmentation'?'Aug':v.evidence?'Pilot':'—'}</div></div></div><div class="vx-expand"><div class="vx-desc">${v.desc}</div><div class="vx-tasks-hd">Task-Level Automation Scores</div>${v.tt.map(t=>`<div class="vx-task-row"><div class="vx-task-name">${t.n}</div><div class="vx-task-vec">${t.v}</div><div class="vx-task-aps ${t.c}">${t.a}%</div></div>`).join('')}</div><div class="vx-toggle" onclick="vxTog('c-${v.id}')"><span class="tg-txt">Expand ↓</span></div></div>`;});html+=`</div></div>`;});
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
  const data={accuracy:fbAccuracy,correction:document.getElementById('fbCorrection').value,name:document.getElementById('fbName').value,role:document.getElementById('fbRole').value,email:document.getElementById('fbEmail').value,vendor:document.getElementById('fbVendor').value,consent:document.getElementById('fbConsent').checked,invite:document.getElementById('fbInvite').value,role_scored:D.role.title+' ('+D.role.soc+')',rpi:D.scores.rpi+'%',timestamp:new Date().toISOString()};
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
// Labels and bounds come from the data file. Roles with no BLS wage series
// (custom roles, us_emp_k=0) cannot run a labour-redeployment model at all and
// supply their own — e.g. agent compute spend — so nothing here is hardcoded.
(function(){
  const slider=document.getElementById('econSlider');
  if(!slider)return;
  const E=D.econ||{},L=E.labels||{};
  const set=(id,v)=>{const el=document.getElementById(id);if(el&&v!=null&&v!=='')el.textContent=v};
  set('econTitle',E.title);set('econSliderLabel',E.sliderLabel);
  set('econLabourLabel',L.labour);set('econTechLabel',L.tech);set('econNetLabel',L.net);
  if(E.min!=null)slider.min=E.min;
  if(E.max!=null)slider.max=E.max;
  if(E.step!=null)slider.step=E.step;
  if(E.baseVolume!=null)slider.value=E.baseVolume;

  const money=n=>(n<0?'−$':'$')+Math.abs(Math.round(n)).toLocaleString();
  function update(){
    const vol=parseInt(slider.value);
    set('econSliderVal',vol);
    const base=E.labourBase,fixed=E.techFixed,bv=E.baseVolume||1;
    // Figures not sourced -- show nothing rather than a number. Zero counts as
    // unsourced: compose returns 0/0 when no price survived verification, and a
    // rendered "$0" reads as "this is free", which is a worse lie than a blank.
    if(base==null||fixed==null||(base===0&&fixed===0)){
      ['econLabour','econTech','econNet'].forEach(id=>set(id,'—'));return;
    }
    // op 'diff' = labour redeployed minus tech cost (wage-grounded roles).
    // op 'sum'  = variable plus fixed spend (roles with no wage series, where the
    //             question is what the build costs, not what it saves).
    const sum=E.op==='sum';
    const scaled=Math.max(0,base*(vol/bv)),net=Math.round(sum?scaled+fixed:scaled-fixed);
    set('econLabour',money(scaled));
    set('econTech',(sum?'+$':'−$')+Math.abs(fixed).toLocaleString());
    set('econNet',money(net));
    const n=document.getElementById('econNet');if(n)n.style.color=net>=0?'var(--am)':'var(--c)';
    const l=document.getElementById('econLabour');if(l)l.style.color='var(--em)';
  }
  slider.addEventListener('input',update);
  update(); // render on load — previously the DOM kept No.001's hardcoded figures
            // until the reader dragged the slider
})();

// ═══ FEEDBACK: old functions (kept for compat) ═══
let fbR=0;
function setR(n){fbR=n;document.querySelectorAll('.fb-star').forEach(s=>{s.classList.toggle('on',parseInt(s.dataset.v)<=n)})}
function subFb(){document.getElementById('fbOk').style.display='block'}
