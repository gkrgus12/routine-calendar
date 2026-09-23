(function(){
'use strict';

/* =========================================================
   1. 상태 · 충돌 로직 (상수, 유틸, localStorage, 뷰 상태, 겹침 계산)
   ========================================================= */
const KEY='routine-cal-v1';
const DAYS=['월','화','수','목','금','토','일'];
const PCOL=['var(--p0)','var(--p1)','var(--p2)','var(--p3)','var(--p4)','var(--p5)'];
const uid=()=>Math.random().toString(36).slice(2,9);
const pad=n=>String(n).padStart(2,'0');
const toMin=t=>{const [h,m]=t.split(':').map(Number);return h*60+m};
const fromMin=m=>pad(Math.floor(m/60))+':'+pad(m%60);
const ymd=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const parse=s=>{const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)};
const wd=d=>(d.getDay()+6)%7; // 0=Mon
const overlap=(a1,a2,b1,b2)=>a1<b2&&b1<a2;
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
// 라벨 정규화(trim + 연속 공백 1개) 와 결정적 해시 (FNV-1a). 라벨별 색과 형제 블록 판정에 씀
const labelKey=s=>(s||'').trim().replace(/\s+/g,' ');
const hashStr=s=>{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0};

let S=load();
function load(){
  try{const raw=localStorage.getItem(KEY);if(raw){const s=JSON.parse(raw);if(s&&s.pages&&s.events)return s;}}catch(e){}
  return {pages:[],events:[],settings:{defaultStart:'10:00',defaultDur:60}};
}
function save(){try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}}
// 테마: settings.theme = 'system' | 'light' | 'dark' (없으면 system). <html data-theme> 로 CSS 에 전달하고, 첫 렌더 전에 적용
function applyTheme(){const t=S.settings.theme;if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t);else document.documentElement.removeAttribute('data-theme')}
applyTheme();

const today=ymd(new Date());
let view={type:'month',ym:today.slice(0,7),pageId:null,weekStart:mondayOf(new Date())};
function mondayOf(d){const x=new Date(d);x.setDate(x.getDate()-wd(x));x.setHours(0,0,0,0);return x}

/* ---------- backup (JSON 내보내기/가져오기) ---------- */
// 파일 형식: {version:1, exportedAt, pages, events, settings}. 가져올 때 version 과 각 레코드를 엄격히 검사하고,
// 알려진 필드만 복사한 새 객체를 돌려준다 (잘못된 파일은 기존 데이터를 건드리지 않음).
const BACKUP_VERSION=1;
const isId=s=>typeof s==='string'&&s.length>0&&s.length<=64;
const isTime=s=>{if(typeof s!=='string'||!/^\d{2}:\d{2}$/.test(s))return false;const [hh,mm]=s.split(':').map(Number);return mm<60&&hh*60+mm<=1440};
const isDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&ymd(parse(s))===s;
function validateBackup(obj){
  const fail=m=>({error:m});
  if(!obj||typeof obj!=='object'||Array.isArray(obj))return fail('최상위가 객체가 아니에요');
  if(obj.version!==BACKUP_VERSION)return fail(`지원하지 않는 버전이에요 (version: ${obj.version===undefined?'없음':JSON.stringify(obj.version)}, 필요: ${BACKUP_VERSION})`);
  if(!Array.isArray(obj.pages)||!Array.isArray(obj.events)||!obj.settings||typeof obj.settings!=='object')return fail('pages·events·settings 가 모두 있어야 해요');
  const uniq=(set,id,what)=>{if(set.has(id))throw new Error(`${what} id 중복: ${id}`);set.add(id)};
  try{
    const pids=new Set();
    const pages=obj.pages.map((p,i)=>{
      if(!p||typeof p!=='object'||!isId(p.id))throw new Error(`pages[${i}]: id 가 없어요`);
      uniq(pids,p.id,'페이지');
      if(!Array.isArray(p.items))throw new Error(`pages[${i}]: items 가 배열이 아니에요`);
      const iids=new Set();
      const items=p.items.map((it,j)=>{
        if(!it||typeof it!=='object'||!isId(it.id))throw new Error(`pages[${i}].items[${j}]: id 가 없어요`);
        uniq(iids,it.id,'루틴');
        if(!Number.isInteger(it.day)||it.day<0||it.day>6)throw new Error(`pages[${i}].items[${j}]: day 는 0~6 이어야 해요`);
        const start=it.start==null?'':it.start,end=it.end==null?'':it.end;
        if((start!==''&&!isTime(start))||(end!==''&&!isTime(end)))throw new Error(`pages[${i}].items[${j}]: 시간 형식은 HH:MM 이에요`);
        return {id:it.id,day:it.day,start,end,label:typeof it.label==='string'?it.label:''};
      });
      return {id:p.id,name:typeof p.name==='string'?p.name:'',color:Number.isInteger(p.color)?((p.color%PCOL.length)+PCOL.length)%PCOL.length:0,active:p.active===true,colorByLabel:p.colorByLabel===true,items};
    });
    const eids=new Set();
    const events=obj.events.map((ev,i)=>{
      if(!ev||typeof ev!=='object'||!isId(ev.id))throw new Error(`events[${i}]: id 가 없어요`);
      uniq(eids,ev.id,'약속');
      if(!isDate(ev.startDate)||!isDate(ev.endDate)||!isTime(ev.startTime)||!isTime(ev.endTime))throw new Error(`events[${i}]: 날짜(YYYY-MM-DD)·시간(HH:MM) 형식을 확인하세요`);
      return {id:ev.id,title:typeof ev.title==='string'?ev.title:'',startDate:ev.startDate,endDate:ev.endDate,startTime:ev.startTime,endTime:ev.endTime};
    });
    const st=obj.settings;
    if(!isTime(st.defaultStart)||!(Number.isFinite(st.defaultDur)&&st.defaultDur>=5))throw new Error('settings: defaultStart(HH:MM)·defaultDur(5 이상) 를 확인하세요');
    const settings={defaultStart:st.defaultStart,defaultDur:st.defaultDur};
    if(['system','light','dark'].includes(st.theme))settings.theme=st.theme;
    return {data:{pages,events,settings,exportedAt:typeof obj.exportedAt==='string'?obj.exportedAt:null}};
  }catch(e){return fail(e.message)}
}
// 합치기: id 기준 중복 제거. 같은 id 의 페이지는 기존 것을 두고 새 루틴만 추가, 약속도 새 id 만 추가. 설정은 유지
function mergeBackup(data){
  const byId=arr=>new Map(arr.map(x=>[x.id,x]));
  let addP=0,addI=0,addE=0,dup=0;
  const pmap=byId(S.pages);
  for(const p of data.pages){
    const cur=pmap.get(p.id);
    if(!cur){S.pages.push(p);addP++;addI+=p.items.length;continue}
    dup++;const imap=byId(cur.items);
    for(const it of p.items){if(imap.has(it.id)){dup++;continue}cur.items.push(it);addI++}
  }
  const emap=byId(S.events);
  for(const ev of data.events){if(emap.has(ev.id)){dup++;continue}S.events.push(ev);addE++}
  return {addP,addI,addE,dup};
}

/* ---------- conflict logic ---------- */
function activeItems(exceptPageId){
  const out=[];
  for(const p of S.pages){ if(!p.active||p.id===exceptPageId)continue; for(const it of p.items){ if(it.start&&it.end)out.push({...it,page:p}); } }
  return out;
}
function eventConflicts(ev){
  const res=[];const items=activeItems();
  let d=parse(ev.startDate),end=parse(ev.endDate);
  if(end<d)end=d;
  const s=toMin(ev.startTime),e=toMin(ev.endTime);
  for(;d<=end;d.setDate(d.getDate()+1)){
    const w=wd(d);
    for(const it of items){
      if(it.day!==w)continue;
      if(overlap(s,e,toMin(it.start),toMin(it.end))) res.push({date:ymd(d),item:it});
    }
  }
  return res;
}
function pageConflicts(page){
  const res=[];const others=activeItems(page.id);
  for(const a of page.items){ if(!a.start||!a.end)continue;
    for(const b of others){ if(a.day!==b.day)continue;
      if(overlap(toMin(a.start),toMin(a.end),toMin(b.start),toMin(b.end))) res.push({a,b});
    }
  }
  return res;
}

/* =========================================================
   2. 렌더링 (사이드바, 월간, 주간, 페이지 편집기, 드래그 그리드)
   ========================================================= */
const app=document.getElementById('app');
function render(){
  refreshPalette();
  app.innerHTML='';
  app.appendChild(renderSide());
  app.appendChild(renderMain());
}
function h(tag,attrs,children){
  const el=document.createElement(tag);
  if(attrs)for(const k in attrs){ if(k==='class')el.className=attrs[k]; else if(k==='style')el.style.cssText=attrs[k]; else if(k.startsWith('on'))el.addEventListener(k.slice(2),attrs[k]); else if(k==='html')el.innerHTML=attrs[k]; else el.setAttribute(k,attrs[k]); }
  (children||[]).forEach(c=>{ if(c==null)return; el.appendChild(typeof c==='string'?document.createTextNode(c):c) });
  return el;
}

/* label colors: colorByLabel 페이지의 블록 색 */
const hexToHsl=hex=>{const m=/^#?([0-9a-f]{6})$/i.exec(hex||'');if(!m)return null;const n=parseInt(m[1],16);const r=(n>>16&255)/255,g=(n>>8&255)/255,b=(n&255)/255;
  const max=Math.max(r,g,b),min=Math.min(r,g,b),l=(max+min)/2;let h=0,s=0;
  if(max!==min){const d=max-min;s=l>.5?d/(2-max-min):d/(max+min);if(max===r)h=(g-b)/d+(g<b?6:0);else if(max===g)h=(b-r)/d+2;else h=(r-g)/d+4;h*=60}
  return [h,s,l]};
// [채도 Δ, 명도 Δ] 6단계 순환 (색상 h 는 유지). 명도는 기본색에서 8%씩 벌린 사다리(-16,-8,+8,+16,+24,+32)로 단계가 눈에 띄게 다르고,
// 기본색이 밝은 팔레트(다크 테마, l>.5)에서는 방향을 뒤집어 어두워지는 쪽으로 간다 (클램프로 단계가 뭉치지 않게)
const LABEL_VARIANTS=[[.08,-.16],[-.08,-.08],[.08,.08],[-.08,.16],[.10,.24],[-.12,.32]];
let PBASE=[]; // 현재 테마의 --p0..--p5 실제 색(HSL). render() 마다 갱신하므로 테마가 바뀌면 변형색도 따라감
function refreshPalette(){const cs=getComputedStyle(document.documentElement);PBASE=PCOL.map((_,i)=>hexToHsl(cs.getPropertyValue('--p'+i).trim()))}
// 블록 인라인 스타일(배경, 필요하면 글자색). colorByLabel 이 켜진 페이지는 라벨 해시로 고른 변형색, 이름 없으면 페이지 기본색
function blockStyle(p,label,withInk){
  const ci=p.color%PCOL.length,base=PCOL[ci],k=labelKey(label);
  if(!p.colorByLabel||!k||!PBASE[ci])return 'background:'+base;
  const [hh,s,l]=PBASE[ci];const [ds,dl]=LABEL_VARIANTS[hashStr(k)%LABEL_VARIANTS.length];const dir=l>.5?-1:1;
  const s2=Math.min(1,Math.max(.12,s+ds)),l2=Math.min(.82,Math.max(.18,l+dir*dl));
  return `background:hsl(${hh.toFixed(1)} ${(s2*100).toFixed(1)}% ${(l2*100).toFixed(1)}%)`+(withInk!==false&&l2>.62?';color:#14181d':'');
}

function renderSide(){
  const side=h('div',{class:'side'});
  side.appendChild(h('h1',null,['루틴 캘린더']));
  const nav=h('ul',{class:'nav'});
  nav.appendChild(h('li',{class:view.type==='month'?'sel':'',onclick:()=>{view.type='month';render()}},[h('span',{class:'nm'},['월간 · 약속'])]));
  nav.appendChild(h('li',{class:view.type==='week'?'sel':'',onclick:()=>{view.type='week';view.weekStart=mondayOf(new Date());render()}},[h('span',{class:'nm'},['이번 주 · 활성 루틴'])]));
  side.appendChild(nav);
  side.appendChild(h('div',{class:'sec'},['루틴 페이지']));
  const pl=h('ul',{class:'nav'});
  if(!S.pages.length) pl.appendChild(h('li',{style:'color:var(--muted);cursor:default'},['아직 페이지가 없어요']));
  S.pages.forEach((p,i)=>{
    const li=h('li',{class:(p.active?'on ':'')+(view.type==='page'&&view.pageId===p.id?'sel':''),onclick:()=>{view.type='page';view.pageId=p.id;render()}},[
      h('span',{class:'dot',style:'background:'+PCOL[p.color%PCOL.length]}),
      h('span',{class:'nm'},[p.name||'(이름 없음)']),
      h('span',{class:'sw',title:p.active?'활성 — 클릭하면 끔':'비활성 — 클릭하면 켬',onclick:(e)=>{e.stopPropagation();togglePage(p)}})
    ]);
    pl.appendChild(li);
  });
  side.appendChild(pl);
  side.appendChild(h('button',{class:'add',onclick:addPage},['+ 새 루틴 페이지']));
  // 테마 토글 (사이드바 맨 아래 세그먼트: 시스템 / 라이트 / 다크)
  const cur=S.settings.theme||'system';
  const seg=h('div',{class:'seg',role:'group','aria-label':'테마'});
  [['system','시스템'],['light','라이트'],['dark','다크']].forEach(([k,label])=>seg.appendChild(h('button',{class:cur===k?'sel':'','aria-pressed':cur===k?'true':'false',onclick:()=>setTheme(k)},[label])));
  side.appendChild(h('div',{class:'theme'},[h('span',{class:'tl'},['테마']),seg]));
  return side;
}
function setTheme(k){S.settings.theme=k;save();applyTheme();render()}
function togglePage(p){
  if(!p.active){
    const cf=pageConflicts(p);
    p.active=true;save();
    if(cf.length){
      const seen=new Set();const lines=[];
      for(const {a,b} of cf){const k=a.id+b.id;if(seen.has(k))continue;seen.add(k);
        lines.push(`${DAYS[a.day]} ${a.start}–${a.end} ${a.label||''} ↔ ${b.page.name}의 ${b.start}–${b.end} ${b.label||''}`)}
      toast(`「${p.name}」을 켰어요. 다른 활성 페이지와 겹치는 시간이 ${lines.length}개 있어요 — 둘 다 그대로 둡니다.`,lines);
    }
  } else { p.active=false;save(); }
  render();
}
function addPage(){
  const p={id:uid(),name:'새 페이지',color:S.pages.length%PCOL.length,active:false,colorByLabel:false,items:[]};
  S.pages.push(p);save();view.type='page';view.pageId=p.id;render();
}

function renderMain(){
  const main=h('div',{class:'main'});
  if(view.type==='month')renderMonth(main);
  else if(view.type==='week')renderWeek(main);
  else renderPage(main);
  return main;
}

/* month */
function renderMonth(main){
  const [y,m]=view.ym.split('-').map(Number);
  const bar=h('div',{class:'bar'},[
    h('button',{class:'quiet',onclick:()=>{shiftMonth(-1)}},['‹']),
    h('h2',null,[`${y}년 ${m}월`]),
    h('button',{class:'quiet',onclick:()=>{shiftMonth(1)}},['›']),
    h('button',{class:'quiet',onclick:()=>{view.ym=today.slice(0,7);render()}},['오늘']),
    h('span',{class:'sp'}),
    h('button',{class:'quiet',onclick:openBackup},['백업']),
    h('button',{class:'quiet',onclick:openSettings},['약속 기본값']),
    h('button',{class:'primary',onclick:()=>openEvent(null,today)},['+ 약속'])
  ]);
  main.appendChild(bar);
  const body=h('div',{class:'body'});
  const grid=h('div',{class:'mgrid'});
  DAYS.forEach(d=>grid.appendChild(h('div',{class:'hd'},[d])));
  const first=new Date(y,m-1,1);const off=wd(first);
  const start=new Date(y,m-1,1-off);
  const evByDate=indexEvents();
  for(let i=0;i<42;i++){
    const d=new Date(start);d.setDate(start.getDate()+i);
    const key=ymd(d);const out=d.getMonth()!==m-1;
    if(i===35&&out)break;
    const cell=h('div',{class:'day'+(out?' out':'')+(key===today?' today':'')+(wd(d)===6?' sun':''),onclick:()=>openEvent(null,key)},[h('span',{class:'n'},[String(d.getDate())])]);
    (evByDate[key]||[]).forEach(ev=>{
      const cf=eventConflicts(ev).some(c=>c.date===key);
      cell.appendChild(h('div',{class:'ev',title:ev.title,onclick:(e)=>{e.stopPropagation();openEvent(ev)}},[
        cf?h('span',{class:'cf',title:'활성 루틴과 겹침'}):null,
        h('span',{class:'t'},[ev.startTime]),h('span',{class:'ti'},[ev.title||'(제목 없음)'])
      ]));
    });
    grid.appendChild(cell);
  }
  body.appendChild(grid);
  main.appendChild(body);
}
function shiftMonth(n){const [y,m]=view.ym.split('-').map(Number);const d=new Date(y,m-1+n,1);view.ym=d.getFullYear()+'-'+pad(d.getMonth()+1);render()}
function indexEvents(){
  const idx={};
  for(const ev of S.events){ let d=parse(ev.startDate),e=parse(ev.endDate);if(e<d)e=d;
    for(;d<=e;d.setDate(d.getDate()+1)){(idx[ymd(d)]=idx[ymd(d)]||[]).push(ev)} }
  for(const k in idx)idx[k].sort((a,b)=>a.startTime.localeCompare(b.startTime));
  return idx;
}

/* week */
function renderWeek(main){
  const ws=view.weekStart;const we=new Date(ws);we.setDate(ws.getDate()+6);
  const bar=h('div',{class:'bar'},[
    h('button',{class:'quiet',onclick:()=>{view.weekStart.setDate(view.weekStart.getDate()-7);render()}},['‹']),
    h('h2',null,[`${ws.getMonth()+1}월 ${ws.getDate()}일 – ${we.getMonth()+1}월 ${we.getDate()}일`]),
    h('button',{class:'quiet',onclick:()=>{view.weekStart.setDate(view.weekStart.getDate()+7);render()}},['›']),
    h('button',{class:'quiet',onclick:()=>{view.weekStart=mondayOf(new Date());render()}},['이번 주']),
    h('span',{class:'sp'}),
    h('button',{class:'quiet',onclick:openBackup},['백업']),
  ]);
  main.appendChild(bar);
  const body=h('div',{class:'body'});
  const act=S.pages.filter(p=>p.active);
  if(!act.length){body.appendChild(h('div',{class:'empty'},['활성화된 루틴 페이지가 없어요. 왼쪽 목록에서 스위치를 켜면 여기 표시됩니다.']));main.appendChild(body);return}
  const lg=h('div',{class:'legend'});
  act.forEach(p=>lg.appendChild(h('span',null,[h('i',{style:'background:'+PCOL[p.color%PCOL.length]}),p.name])));
  lg.appendChild(h('span',null,[h('i',{style:'border:1.5px solid var(--ink);background:transparent'}),'약속']));
  body.appendChild(lg);
  const H0=6,H1=24,PX=44;const height=(H1-H0)*PX;
  const wrap=h('div',{class:'wwrap'});
  const grid=h('div',{class:'wgrid'});
  grid.appendChild(h('div',{class:'whd'},['']));
  const dates=[];for(let i=0;i<7;i++){const d=new Date(ws);d.setDate(ws.getDate()+i);dates.push(d);grid.appendChild(h('div',{class:'whd'+(ymd(d)===today?' today':'')},[`${DAYS[i]} ${d.getDate()}`]))}
  const tc=h('div',{class:'tcol first',style:'height:'+height+'px'});
  for(let hr=H0;hr<=H1;hr++){const top=(hr-H0)*PX;tc.appendChild(h('div',{class:'hrline',style:'top:'+top+'px'}));if(hr<H1)tc.appendChild(h('div',{class:'hrlab',style:'top:'+top+'px'},[pad(hr)+':00']))}
  grid.appendChild(tc);
  const evIdx=indexEvents();
  dates.forEach((d,i)=>{
    const col=h('div',{class:'tcol',style:'height:'+height+'px'});
    for(let hr=H0;hr<=H1;hr++)col.appendChild(h('div',{class:'hrline',style:'top:'+((hr-H0)*PX)+'px'}));
    const blocks=[];
    act.forEach(p=>p.items.filter(it=>it.day===i&&it.start&&it.end).forEach(it=>{
      const s=Math.max(toMin(it.start),H0*60),e=Math.min(toMin(it.end),H1*60);if(e<=s)return;
      blocks.push({s,e,it,p});
    }));
    const lay=layoutOverlaps(blocks);
    blocks.forEach(({s,e,it,p},k)=>{
      const {col:c,n}=lay[k];
      // 겹치는 묶음은 폭을 n등분해 나란히. 겹치지 않으면(n=1) 기본 left/right 그대로. 3개 이상 겹치면 라벨 생략, title 툴팁만
      const split=n>1?`;right:auto;left:calc(3px + (100% - 6px) * ${c} / ${n});width:calc((100% - 6px) / ${n} - ${c<n-1?2:0}px)`:'';
      col.appendChild(h('div',{class:'blk',style:`top:${(s-H0*60)/60*PX}px;height:${(e-s)/60*PX-2}px;${blockStyle(p,it.label)}${split}`,title:`${p.name} · ${it.start}–${it.end} ${it.label||''}`},[n>=3?null:h('div',{class:'l'},[it.label||p.name])]));
    });
    (evIdx[ymd(d)]||[]).forEach(ev=>{
      const s=Math.max(toMin(ev.startTime),H0*60),e=Math.min(toMin(ev.endTime),H1*60);if(e<=s)return;
      const cf=eventConflicts(ev).some(c=>c.date===ymd(d));
      col.appendChild(h('div',{class:'blk evb'+(cf?' cf':''),style:`top:${(s-H0*60)/60*PX}px;height:${(e-s)/60*PX-2}px`,title:ev.title,onclick:()=>openEvent(ev)},[h('div',{class:'l'},[ev.title||'(제목 없음)'])]));
    });
    grid.appendChild(col);
  });
  wrap.appendChild(grid);body.appendChild(wrap);main.appendChild(body);
}

// 같은 요일에서 겹치는 블록을 나란히 놓기 위한 열 배치 (구글 캘린더 방식).
// 시작 시간순(같으면 긴 것 먼저)으로 훑으며 서로 이어져 겹치는 묶음(클러스터)을 만들고,
// 묶음 안에서는 비어 있는 첫 열에 넣는다. 결과 n = 묶음의 열 수 → 폭을 n등분.
function layoutOverlaps(blocks){ // blocks: [{s,e}] (분) → 같은 순서로 [{col,n}]
  const order=blocks.map((_,i)=>i).sort((a,b)=>blocks[a].s-blocks[b].s||blocks[b].e-blocks[a].e);
  const out=new Array(blocks.length);
  let cluster=[],colEnds=[],clusterEnd=-1;
  const flush=()=>{cluster.forEach(i=>out[i].n=colEnds.length);cluster=[];colEnds=[];clusterEnd=-1};
  for(const i of order){
    const b=blocks[i];
    if(cluster.length&&b.s>=clusterEnd)flush();
    let c=colEnds.findIndex(end=>end<=b.s);
    if(c<0){c=colEnds.length;colEnds.push(b.e)}else colEnds[c]=b.e;
    out[i]={col:c,n:1};cluster.push(i);clusterEnd=Math.max(clusterEnd,b.e);
  }
  flush();
  return out;
}

/* page editor */
function renderPage(main){
  const p=S.pages.find(x=>x.id===view.pageId);
  if(!p){view.type='month';renderMonth(main);return}
  const bar=h('div',{class:'bar'},[
    h('h2',null,['루틴 페이지']),
    h('span',{class:'sp'}),
    h('button',{class:p.active?'':'primary',onclick:()=>togglePage(p)},[p.active?'비활성화':'활성화']),
    h('button',{class:'quiet danger',onclick:()=>{if(confirm(`「${p.name}」 페이지를 삭제할까요?`)){S.pages=S.pages.filter(x=>x!==p);save();view.type='month';render()}}},['삭제'])
  ]);
  main.appendChild(bar);
  const body=h('div',{class:'body'});const ed=h('div',{class:'pedit'});
  const sw=h('div',{class:'swatches'});
  PCOL.forEach((c,i)=>sw.appendChild(h('button',{class:i===p.color?'sel':'',style:'background:'+c,title:'색',onclick:()=>{p.color=i;save();render()}})));
  ed.appendChild(h('div',{class:'row'},[
    h('input',{type:'text',value:p.name,placeholder:'페이지 이름 (예: 학교 시간표, 운동)',oninput:(e)=>{p.name=e.target.value;save();document.querySelectorAll('.side .nav li .nm').forEach(()=>{});},onchange:()=>render()}),
    sw
  ]));
  // 같은 이름끼리 같은 색 (page.colorByLabel)
  ed.appendChild(h('div',{class:'row',style:'margin-top:6px'},[
    h('button',{class:'tg'+(p.colorByLabel?' on':''),role:'switch','aria-checked':p.colorByLabel?'true':'false',onclick:()=>{p.colorByLabel=!p.colorByLabel;save();render()}},[h('span',{class:'sw'}),'같은 이름끼리 같은 색']),
    h('span',{class:'hint',style:'margin:0'},['켜면 라벨마다 페이지 색의 밝기·채도를 바꿔 배정해요. 이름 없는 블록은 기본색.'])
  ]));
  ed.appendChild(h('p',{class:'sub',style:'margin-top:8px'},['빈 칸을 드래그하면 루틴이 생겨요 (30분 단위). 블록을 끌면 이동, 위·아래 가장자리를 끌면 시간 조절. 클릭하면 이름 수정·삭제·요일 복제. 흐린 블록은 다른 활성 페이지의 루틴.']));
  ed.appendChild(renderEditGrid(p));
  ed.appendChild(h('p',{class:'sub'},['목록에서 시간을 정확히 고칠 수 있어요.']));
  const tbl=h('table');
  tbl.appendChild(h('tr',null,[h('th',null,['요일']),h('th',null,['시작']),h('th',null,['끝']),h('th',null,['이름']),h('th',null,[''])]));
  const sorted=[...p.items].sort((a,b)=>a.day-b.day||(a.start||'').localeCompare(b.start||''));
  sorted.forEach(it=>{
    const tr=h('tr');
    const sel=h('select',{onchange:(e)=>{it.day=Number(e.target.value);save()}});
    DAYS.forEach((d,i)=>sel.appendChild(h('option',{value:i,...(i===it.day?{selected:''}:{})},[d])));
    tr.appendChild(h('td',{class:'w1'},[sel]));
    tr.appendChild(h('td',{class:'w2'},[h('input',{type:'time',value:it.start,onchange:(e)=>{it.start=e.target.value;save()}})]));
    tr.appendChild(h('td',{class:'w2'},[h('input',{type:'time',value:it.end,onchange:(e)=>{it.end=e.target.value;save()}})]));
    tr.appendChild(h('td',null,[h('input',{type:'text',value:it.label||'',placeholder:'예: 알고리즘 수업',oninput:(e)=>{it.label=e.target.value;save()}})]));
    tr.appendChild(h('td',{class:'w3'},[h('button',{class:'quiet',title:'삭제',onclick:()=>{p.items=p.items.filter(x=>x!==it);save();render()}},['✕'])]));
    tbl.appendChild(tr);
  });
  ed.appendChild(tbl);
  if(!p.items.length)ed.appendChild(h('p',{class:'hint'},['아직 루틴이 없어요. 아래에서 추가하세요.']));
  ed.appendChild(h('div',{class:'row',style:'margin-top:10px'},[
    h('button',{onclick:()=>{const last=sorted[sorted.length-1];p.items.push({id:uid(),day:last?last.day:0,start:last?last.end:'09:00',end:last?fromMin(Math.min(toMin(last.end)+60,1439)):'10:00',label:''});save();render()}},['+ 루틴 추가']),
    h('button',{onclick:()=>{const src=sorted.filter(x=>x.day===0);if(!src.length){toast('복사할 월요일 루틴이 없어요');return}for(let d=1;d<5;d++)src.forEach(x=>p.items.push({...x,id:uid(),day:d}));save();render()}},['월요일을 평일에 복사']),
  ]));
  ed.appendChild(h('p',{class:'hint'},['표시 순서는 요일·시작 시간 순으로 자동 정렬돼요. 이 페이지가 켜져 있을 때만 약속과의 겹침을 검사합니다.']));
  body.appendChild(ed);main.appendChild(body);
}

/* edit grid: drag to paint routines */
let pendingEdit=null; // {itemId,isNew} — opened after render
function renderEditGrid(p){
  const H0=6,H1=24,PX=40,SLOT=30;const SPX=PX*SLOT/60;const height=(H1-H0)*PX;const nslots=(H1-H0)*60/SLOT;
  const wrap=h('div',{class:'egwrap'});const grid=h('div',{class:'egrid'});
  grid.appendChild(h('div',{class:'whd'},['']));
  DAYS.forEach(d=>grid.appendChild(h('div',{class:'whd'},[d])));
  const tc=h('div',{class:'tcol first',style:'height:'+height+'px'});
  for(let hr=H0;hr<=H1;hr++){const top=(hr-H0)*PX;tc.appendChild(h('div',{class:'hrline',style:'top:'+top+'px'}));if(hr<H1)tc.appendChild(h('div',{class:'hrlab',style:'top:'+top+'px'},[pad(hr)+':00']))}
  grid.appendChild(tc);
  const col=PCOL[p.color%PCOL.length];
  const others=activeItems(p.id);
  // 같은 페이지 안에서 서로 겹치는 아이템 (경고 테두리 + 툴팁). 충돌 로직(토스트·약속 경고)과는 별개로 표시만 한다
  const ovl=new Set();
  const its=p.items.filter(it=>it.start&&it.end);
  for(let a=0;a<its.length;a++)for(let b=a+1;b<its.length;b++){const x=its[a],y=its[b];
    if(x.day===y.day&&overlap(toMin(x.start),toMin(x.end),toMin(y.start),toMin(y.end))){ovl.add(x.id);ovl.add(y.id)}}
  const cols=[]; // 요일 컬럼 엘리먼트 (블록을 다른 요일로 옮길 때 참조)
  const dayAt=x=>{for(let i=0;i<7;i++){if(x<cols[i].getBoundingClientRect().right)return i}return 6};
  for(let day=0;day<7;day++){
    const c=h('div',{class:'tcol',style:'height:'+height+'px','data-day':day});cols[day]=c;
    for(let hr=H0;hr<=H1;hr++){c.appendChild(h('div',{class:'hrline',style:'top:'+((hr-H0)*PX)+'px'}));if(hr<H1)c.appendChild(h('div',{class:'hrline half',style:'top:'+((hr-H0)*PX+PX/2)+'px'}))}
    others.filter(it=>it.day===day).forEach(it=>{
      const s=Math.max(toMin(it.start),H0*60),e=Math.min(toMin(it.end),H1*60);if(e<=s)return;
      c.appendChild(h('div',{class:'blk other',style:`top:${(s-H0*60)/60*PX}px;height:${(e-s)/60*PX-2}px;${blockStyle(it.page,it.label,false)}`},[h('div',{class:'l'},[it.page.name])]));
    });
    p.items.filter(it=>it.day===day&&it.start&&it.end).forEach(it=>{
      const s=Math.max(toMin(it.start),H0*60),e=Math.min(toMin(it.end),H1*60);if(e<=s)return;
      const lbl=h('div',{class:'l'},[it.label||'(이름 없음)']);
      const isOvl=ovl.has(it.id);
      const blk=h('div',{class:'blk'+(isOvl?' ovl':''),'data-id':it.id,style:`top:${(s-H0*60)/60*PX}px;height:${(e-s)/60*PX-2}px;${blockStyle(p,it.label)}`,title:(isOvl?'같은 페이지 루틴과 겹침 · ':'')+`${it.start}–${it.end} ${it.label||''}`},[lbl,h('div',{class:'rs t'}),h('div',{class:'rs b'})]);
      // 블록 조작: 본체 드래그=이동(다른 요일로도), 상단/하단 6px(.rs)=시작/끝 시간 조절. 30분 스냅, 최소 30분.
      // 5px 미만 움직임으로 놓으면 클릭 → 이름 편집기. 드래그 중엔 시간 텍스트를 실시간 표시하고 놓을 때 저장.
      let d=null;
      const paintBlk=()=>{
        const s=Math.max(d.s,H0*60),e=Math.min(d.e,H1*60);
        blk.style.top=((s-H0*60)/60*PX)+'px';blk.style.height=Math.max(0,(e-s)/60*PX-2)+'px';
        blk.style.transform=d.day===d.day0?'':`translateX(${cols[d.day].offsetLeft-cols[d.day0].offsetLeft}px)`;
        lbl.textContent=fromMin(d.s)+'–'+fromMin(d.e);
      };
      blk.addEventListener('pointerdown',ev=>{
        ev.stopPropagation();
        if(ev.button!==0&&ev.pointerType==='mouse')return;
        settleLabelEditor(it);
        const t=ev.target.classList;const mode=t.contains('rs')?(t.contains('t')?'top':'bottom'):'move';
        const s0=toMin(it.start),e0=toMin(it.end);
        d={mode,x0:ev.clientX,y0:ev.clientY,s0,e0,day0:day,s:s0,e:e0,day,moved:false};
        blk.setPointerCapture(ev.pointerId);
      });
      blk.addEventListener('pointermove',ev=>{
        if(!d)return;
        const dx=ev.clientX-d.x0,dy=ev.clientY-d.y0;
        if(!d.moved){if(Math.hypot(dx,dy)<5)return;d.moved=true;blk.classList.add('dragging')}
        const dm=Math.round(dy/SPX)*SLOT;
        if(d.mode==='move'){
          const dur=d.e0-d.s0;
          d.s=Math.min(Math.max(d.s0+dm,H0*60),Math.max(H0*60,H1*60-dur));d.e=Math.min(d.s+dur,H1*60);d.day=dayAt(ev.clientX);
        }else if(d.mode==='top'){
          d.s=Math.min(Math.max(d.s0+dm,H0*60),Math.max(H0*60,d.e0-SLOT));
        }else{
          d.e=Math.max(Math.min(d.e0+dm,H1*60),Math.min(H1*60,d.s0+SLOT));
        }
        paintBlk();
      });
      blk.addEventListener('pointerup',()=>{
        if(!d)return;const cur=d;d=null;
        if(!cur.moved){openLabelEditor(p,it,false,grid);return}
        it.start=fromMin(cur.s);it.end=fromMin(cur.e);it.day=cur.day;save();render();
      });
      blk.addEventListener('pointercancel',()=>{if(!d)return;d=null;render()});
      c.appendChild(blk);
    });
    // drag to create
    let drag=null,ghost=null;
    const slotAt=(ev)=>{const r=c.getBoundingClientRect();const y=ev.clientY-r.top;return Math.min(nslots-1,Math.max(0,Math.floor(y/SPX)))};
    c.addEventListener('pointerdown',ev=>{
      if(ev.button!==0&&ev.pointerType==='mouse')return;
      closeLabelEditor();
      drag={s:slotAt(ev),e:slotAt(ev)};c.setPointerCapture(ev.pointerId);
      ghost=h('div',{class:'blk ghost',style:'background:'+col});c.appendChild(ghost);paint();
    });
    c.addEventListener('pointermove',ev=>{if(!drag)return;drag.e=slotAt(ev);paint()});
    const finish=(ev)=>{
      if(!drag)return;const a=Math.min(drag.s,drag.e),b=Math.max(drag.s,drag.e)+1;drag=null;ghost&&ghost.remove();ghost=null;
      const start=fromMin(H0*60+a*SLOT),end=fromMin(H0*60+b*SLOT);
      const it={id:uid(),day,start,end,label:''};p.items.push(it);save();
      pendingEdit={itemId:it.id,isNew:true};render();
    };
    c.addEventListener('pointerup',finish);c.addEventListener('pointercancel',()=>{drag=null;ghost&&ghost.remove();ghost=null});
    function paint(){const a=Math.min(drag.s,drag.e),b=Math.max(drag.s,drag.e)+1;ghost.style.top=(a*SPX)+'px';ghost.style.height=((b-a)*SPX-2)+'px';ghost.innerHTML='<div class="l">'+fromMin(H0*60+a*SLOT)+'–'+fromMin(H0*60+b*SLOT)+'</div>'}
    grid.appendChild(c);
  }
  wrap.appendChild(grid);
  if(pendingEdit){const pe=pendingEdit;pendingEdit=null;const it=p.items.find(x=>x.id===pe.itemId);if(it)setTimeout(()=>openLabelEditor(p,it,pe.isNew,grid,pe),0)}
  return wrap;
}
let lblEd=null;
function closeLabelEditor(){if(lblEd){lblEd.el.remove();lblEd.blk&&lblEd.blk.classList.remove('editing');lblEd=null}}
function settleLabelEditor(keep){ // 열린 이름 편집기를 렌더 없이 확정. 새 항목이 빈 이름이면 삭제(단 keep 항목은 유지). 블록 드래그 직전에 씀
  if(!lblEd)return;
  const {p,it,isNew,inp,blk}=lblEd;const v=inp.value.trim();
  if(isNew&&!v&&it!==keep){p.items=p.items.filter(x=>x!==it);blk&&blk.remove()}else commitLabel(p,it,v);
  save();closeLabelEditor();
}
const LBLW=236; // 라벨 편집기 폭 (styles.css .lbled width 와 같게)
// 형제 블록: 같은 페이지에서 이름(정규화)·시작·끝이 같은 블록들 (자기 자신 포함). 요일 체크박스와 이름 일괄 변경의 기준
function siblingsOf(p,it){const k=labelKey(it.label);return p.items.filter(x=>x.start===it.start&&x.end===it.end&&labelKey(x.label)===k)}
function commitLabel(p,it,v){for(const x of siblingsOf(p,it))x.label=v;it.label=v}
function openLabelEditor(p,it,isNew,grid,opts){
  closeLabelEditor();
  const blk=grid.querySelector(`.blk[data-id="${it.id}"]`);if(!blk)return;
  const colEl=blk.parentElement;
  blk.classList.add('editing');
  const inp=h('input',{type:'text',value:it.label||'',placeholder:'이름 (Enter 확정, Esc 취소)'});
  const done=()=>{commitLabel(p,it,inp.value.trim());save();closeLabelEditor();render()};
  const cancel=()=>{if(isNew&&!inp.value.trim()){p.items=p.items.filter(x=>x!==it);save()}closeLabelEditor();render()};
  const del=()=>{p.items=p.items.filter(x=>x!==it);save();closeLabelEditor();render()};
  inp.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();done()}else if(e.key==='Escape'){e.preventDefault();cancel()}});
  inp.addEventListener('blur',()=>{setTimeout(()=>{if(lblEd&&lblEd.inp===inp&&!lblEd.el.contains(document.activeElement)){isNew&&!inp.value.trim()?cancel():done()}},80)});
  // 요일 체크박스: 체크 = 그 요일에 같은 이름·시작·끝의 형제가 있음. 현재 블록의 요일은 해제 불가.
  // 체크/해제하면 입력 중인 이름을 먼저 형제 전체에 확정하고, 형제를 만들거나 지운 뒤 다시 그리고 편집기를 같은 블록에 다시 연다
  const days=h('div',{class:'days'});
  const sib=siblingsOf(p,it);
  DAYS.forEach((d,i)=>{
    const has=i===it.day||sib.some(x=>x.day===i);
    const cb=h('input',{type:'checkbox',...(has?{checked:''}:{}),...(i===it.day?{disabled:''}:{}),onchange:(e)=>{
      const v=inp.value.trim();commitLabel(p,it,v);
      if(e.target.checked){if(!siblingsOf(p,it).some(x=>x.day===i))p.items.push({id:uid(),day:i,start:it.start,end:it.end,label:v})}
      else{const rm=new Set(siblingsOf(p,it).filter(x=>x.day===i&&x!==it).map(x=>x.id));p.items=p.items.filter(x=>!rm.has(x.id))}
      save();pendingEdit={itemId:it.id,isNew:false,caretEnd:true};closeLabelEditor();render();
    }});
    days.appendChild(h('label',{title:d+'요일에 같은 이름·시간 블록'},[cb,d]));
  });
  const el=h('div',{class:'lbled',onpointerdown:e=>e.stopPropagation(),onclick:e=>e.stopPropagation()},[inp,h('button',{class:'quiet',title:'삭제',onmousedown:e=>e.preventDefault(),onclick:del},['✕']),days]);
  // position: below block, keep inside grid horizontally; if it would run past the bottom, put it above the block
  const top=colEl.offsetTop+blk.offsetTop+blk.offsetHeight+4;
  const gridW=grid.scrollWidth;
  let left=colEl.offsetLeft;if(left+LBLW>gridW)left=Math.max(0,gridW-LBLW-4);
  el.style.top=top+'px';el.style.left=left+'px';
  grid.appendChild(el);
  if(top+el.offsetHeight>grid.clientHeight)el.style.top=Math.max(0,colEl.offsetTop+blk.offsetTop-el.offsetHeight-4)+'px';
  lblEd={el,inp,blk,p,it,isNew};
  inp.focus();
  if(opts&&opts.caretEnd){const n=inp.value.length;inp.setSelectionRange(n,n)}else inp.select();
}

/* =========================================================
   3. 이벤트 모달 · 약속 기본값 · 토스트
   ========================================================= */

/* event modal */
function openEvent(ev,dateKey){
  const isNew=!ev;
  const st=S.settings;
  const draft=ev?{...ev}:{id:uid(),title:'',startDate:dateKey||today,endDate:dateKey||today,startTime:st.defaultStart,endTime:fromMin(Math.min(toMin(st.defaultStart)+st.defaultDur,1439))};
  const ov=h('div',{class:'ov',onclick:(e)=>{if(e.target===ov)close()}});
  const cfBox=h('div');
  function refreshCf(){
    cfBox.innerHTML='';
    if(!draft.startDate||!draft.endDate||!draft.startTime||!draft.endTime)return;
    const cf=eventConflicts(draft);
    if(!cf.length)return;
    const ul=h('ul');
    cf.slice(0,8).forEach(c=>ul.appendChild(h('li',null,[`${c.date.slice(5).replace('-','/')} ${DAYS[wd(parse(c.date))]} · ${c.item.page.name} ${c.item.start}–${c.item.end} ${c.item.label||''}`])));
    if(cf.length>8)ul.appendChild(h('li',null,[`외 ${cf.length-8}개`]));
    cfBox.appendChild(h('div',{class:'cfbox'},[`활성 루틴과 ${cf.length}건 겹쳐요. 저장은 됩니다.`,ul]));
  }
  const inp=(k,type,extra)=>h('input',{type,value:draft[k],...(extra||{}),oninput:(e)=>{draft[k]=e.target.value;if(k==='startDate'&&draft.endDate<draft.startDate){draft.endDate=draft.startDate;edI.value=draft.endDate}refreshCf()}});
  const edI=inp('endDate','date');
  const form=h('div',{class:'f'},[
    h('label',{class:'full'},['제목',inp('title','text',{placeholder:'무슨 약속?',autofocus:''})]),
    h('label',null,['시작일',inp('startDate','date')]),
    h('label',null,['종료일',edI]),
    h('label',null,['시작 시간',inp('startTime','time')]),
    h('label',null,['끝 시간',inp('endTime','time')]),
  ]);
  const md=h('div',{class:'md'},[
    h('h3',null,[isNew?'약속 추가':'약속 편집']),
    form,cfBox,
    h('div',{class:'acts'},[
      isNew?null:h('button',{class:'quiet danger',onclick:()=>{S.events=S.events.filter(x=>x.id!==ev.id);save();close();render()}},['삭제']),
      h('span',{class:'sp'}),
      h('button',{onclick:close},['취소']),
      h('button',{class:'primary',onclick:()=>{
        if(!draft.startDate||!draft.endDate||!draft.startTime||!draft.endTime){toast('날짜와 시간을 채워주세요');return}
        if(toMin(draft.endTime)<=toMin(draft.startTime)){toast('끝 시간이 시작 시간보다 늦어야 해요');return}
        if(isNew)S.events.push(draft);else Object.assign(ev,draft);
        save();close();render();
      }},[isNew?'추가':'저장'])
    ])
  ]);
  ov.appendChild(md);document.body.appendChild(ov);
  refreshCf();
  const onKey=(e)=>{if(e.key==='Escape')close()};document.addEventListener('keydown',onKey);
  function close(){ov.remove();document.removeEventListener('keydown',onKey)}
  setTimeout(()=>{const t=md.querySelector('input[type=text]');t&&t.focus()},0);
}
function openSettings(){
  const st=S.settings;const d={...st};
  const ov=h('div',{class:'ov',onclick:(e)=>{if(e.target===ov)ov.remove()}});
  const md=h('div',{class:'md'},[
    h('h3',null,['약속 기본값']),
    h('div',{class:'f'},[
      h('label',null,['기본 시작 시간',h('input',{type:'time',value:d.defaultStart,onchange:(e)=>d.defaultStart=e.target.value})]),
      h('label',null,['기본 길이(분)',h('input',{type:'number',min:'5',step:'5',value:d.defaultDur,onchange:(e)=>d.defaultDur=Math.max(5,Number(e.target.value)||60)})]),
    ]),
    h('p',{class:'hint'},['새 약속을 열 때 이 값으로 채워집니다. 날짜는 클릭한 날이 기본이에요.']),
    h('div',{class:'acts'},[h('span',{class:'sp'}),h('button',{onclick:()=>ov.remove()},['취소']),h('button',{class:'primary',onclick:()=>{S.settings=d;save();ov.remove();toast('기본값을 저장했어요')}},['저장'])])
  ]);
  ov.appendChild(md);document.body.appendChild(ov);
}

/* backup modal */
function exportBackup(){
  const name=`routine-calendar-${ymd(new Date())}.json`;
  const data={version:BACKUP_VERSION,exportedAt:new Date().toISOString(),pages:S.pages,events:S.events,settings:S.settings};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=h('a',{href:url,download:name});document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  toast(`내보냈어요: ${name}`);
}
function openBackup(){
  const countOf=s=>`페이지 ${s.pages.length}개 (루틴 ${s.pages.reduce((n,p)=>n+p.items.length,0)}개) · 약속 ${s.events.length}개`;
  let pending=null; // 검증을 통과한 가져오기 데이터
  const ov=h('div',{class:'ov',onclick:(e)=>{if(e.target===ov)close()}});
  const preview=h('div');
  const setReady=on=>{btnOver.disabled=!on;btnMerge.disabled=!on};
  const btnOver=h('button',{class:'danger',disabled:'',onclick:()=>{
    if(!pending)return;
    if(!confirm(`현재 데이터(${countOf(S)})를 모두 지우고 파일 내용으로 바꿀까요?`))return;
    S={pages:pending.pages,events:pending.events,settings:pending.settings};save();applyTheme();
    close();view.type='month';view.pageId=null;render();toast(`덮어썼어요: ${countOf(S)}`);
  }},['덮어쓰기']);
  const btnMerge=h('button',{class:'primary',disabled:'',onclick:()=>{
    if(!pending)return;
    const r=mergeBackup(pending);save();close();render();
    toast(`합쳤어요: 페이지 ${r.addP}개, 루틴 ${r.addI}개, 약속 ${r.addE}개 추가 · 중복 ${r.dup}개 건너뜀`);
  }},['합치기']);
  const file=h('input',{type:'file',accept:'.json,application/json',onchange:async(e)=>{
    pending=null;preview.innerHTML='';setReady(false);
    const f=e.target.files&&e.target.files[0];if(!f)return;
    let obj;
    try{obj=JSON.parse(await f.text())}catch(err){e.target.value='';toast('가져오기 실패: JSON 파일이 아니거나 형식이 깨졌어요');return}
    const r=validateBackup(obj);
    if(r.error){e.target.value='';toast('가져오기 실패: '+r.error);return}
    pending=r.data;
    preview.appendChild(h('div',{class:'pvbox'},[
      h('div',null,[countOf(pending)]),
      h('div',{class:'hint',style:'margin:2px 0 0'},[`${f.name}${pending.exportedAt?' · 내보낸 시각 '+pending.exportedAt.replace('T',' ').slice(0,16):''}`]),
      h('div',{class:'hint',style:'margin:2px 0 0'},['덮어쓰기: 현재 데이터를 지우고 파일로 교체 · 합치기: id 가 겹치지 않는 페이지·루틴·약속만 추가'])
    ]));
    setReady(true);
  }});
  const md=h('div',{class:'md'},[
    h('h3',null,['백업']),
    h('div',{class:'sect'},['내보내기']),
    h('p',{class:'hint',style:'margin:0 0 8px'},[`현재 ${countOf(S)} · 설정을 JSON 파일로 내려받아요.`]),
    h('button',{onclick:exportBackup},['JSON 내려받기']),
    h('div',{class:'sect'},['가져오기']),
    file,preview,
    h('div',{class:'acts'},[btnOver,btnMerge,h('span',{class:'sp'}),h('button',{onclick:close},['닫기'])])
  ]);
  ov.appendChild(md);document.body.appendChild(ov);
  const onKey=(e)=>{if(e.key==='Escape')close()};document.addEventListener('keydown',onKey);
  function close(){ov.remove();document.removeEventListener('keydown',onKey)}
}

/* toast */
let toastEl=null,toastT=null;
function toast(msg,lines){
  if(toastEl)toastEl.remove();clearTimeout(toastT);
  toastEl=h('div',{class:'toast',onclick:()=>{toastEl.remove();toastEl=null}},[msg]);
  if(lines&&lines.length){const ul=h('ul');lines.slice(0,6).forEach(l=>ul.appendChild(h('li',null,[l])));if(lines.length>6)ul.appendChild(h('li',null,[`외 ${lines.length-6}개`]));toastEl.appendChild(ul)}
  document.body.appendChild(toastEl);
  toastT=setTimeout(()=>{toastEl&&toastEl.remove();toastEl=null},lines&&lines.length?9000:3000);
}

render();
// OS 테마가 바뀌면 다시 그려서 라벨 변형색 등이 새 팔레트를 따르게
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{if(!S.settings.theme||S.settings.theme==='system')render()});
})();
