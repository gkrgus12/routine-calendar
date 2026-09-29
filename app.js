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
// 설정 기본값. 저장값에 없는 키는 기본값으로 읽는다(cfg). weekStart: 'mon'|'sun' (표시 순서만 바뀌고 데이터의 day 는 항상 0=월…6=일),
// dayStart/dayEnd: 주간 뷰·편집 그리드가 보여줄 시간 범위(시). 범위 밖 루틴은 잘려 보일 뿐 데이터는 그대로
const SETTINGS_DEFAULTS={defaultStart:'10:00',defaultDur:60,theme:'system',weekStart:'mon',dayStart:6,dayEnd:24,googleKeepLogin:true,routineAlpha:22,eventColor:0,hourHeight:'fit'};
// hourHeight: 'fit'(그리드 영역 높이 ÷ 표시 시간 수, 최소 32px) 또는 고정 px(24~80). 세 그리드(편집·주간·일간) 공통. CSS 변수 --px 로 적용
// routineAlpha: 일간·주간 루틴 블록과 편집 그리드 '다른 페이지 루틴'의 투명도(%). eventColor: 약속 색 팔레트(--e0..--e5) 인덱스
const cfg=k=>S.settings[k]===undefined?SETTINGS_DEFAULTS[k]:S.settings[k];
const dayOrder=()=>cfg('weekStart')==='sun'?[6,0,1,2,3,4,5]:[0,1,2,3,4,5,6]; // 요일 표시 순서
const dayPos=d=>dayOrder().indexOf(d);

const today=ymd(new Date());
const VIEW_KEY='routine-cal-view'; // 마지막 캘린더 뷰(day|week|month). UI 상태라 백업 데이터 키와 분리
const lastCalView=()=>{try{const v=localStorage.getItem(VIEW_KEY);return ['day','week','month'].includes(v)?v:'month'}catch(e){return 'month'}};
let view={type:lastCalView(),ym:today.slice(0,7),pageId:null,weekStart:weekStartOf(new Date()),day:today};
function setCalView(t){view.type=t;try{localStorage.setItem(VIEW_KEY,t)}catch(e){}render()}
// 설정의 주 시작 요일(월/일)에 맞춘, d 가 속한 주의 첫날
function weekStartOf(d){const x=new Date(d);const back=cfg('weekStart')==='sun'?x.getDay():wd(x);x.setDate(x.getDate()-back);x.setHours(0,0,0,0);return x}

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
    if(st.weekStart!==undefined){if(!['mon','sun'].includes(st.weekStart))throw new Error('settings: weekStart 는 mon 또는 sun 이에요');settings.weekStart=st.weekStart}
    if(st.googleKeepLogin!==undefined){if(typeof st.googleKeepLogin!=='boolean')throw new Error('settings: googleKeepLogin 은 true/false 여야 해요');settings.googleKeepLogin=st.googleKeepLogin}
    if(st.routineAlpha!==undefined){if(!Number.isInteger(st.routineAlpha)||st.routineAlpha<5||st.routineAlpha>100)throw new Error('settings: routineAlpha 는 5~100 정수여야 해요');settings.routineAlpha=st.routineAlpha}
    if(st.eventColor!==undefined){if(!Number.isInteger(st.eventColor)||st.eventColor<0||st.eventColor>5)throw new Error('settings: eventColor 는 0~5 정수여야 해요');settings.eventColor=st.eventColor}
    if(st.hourHeight!==undefined){if(!(st.hourHeight==='fit'||(Number.isInteger(st.hourHeight)&&st.hourHeight>=24&&st.hourHeight<=80)))throw new Error("settings: hourHeight 는 'fit' 또는 24~80 정수여야 해요");settings.hourHeight=st.hourHeight}
    if(st.dayStart!==undefined||st.dayEnd!==undefined){
      const a=st.dayStart===undefined?SETTINGS_DEFAULTS.dayStart:st.dayStart,b=st.dayEnd===undefined?SETTINGS_DEFAULTS.dayEnd:st.dayEnd;
      if(!Number.isInteger(a)||!Number.isInteger(b)||a<0||b>24||a>=b)throw new Error('settings: dayStart/dayEnd 는 0~24 정수이고 dayStart < dayEnd 여야 해요');
      if(st.dayStart!==undefined)settings.dayStart=a;if(st.dayEnd!==undefined)settings.dayEnd=b;
    }
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

/* ---------- google calendar (읽기 전용) ---------- */
// 서버 없이 브라우저에서 Google Identity Services(토큰 클라이언트) + Calendar API v3 를 직접 호출한다.
// 토큰은 G.token(메모리)에만 두고 절대 localStorage 에 쓰지 않는다 → 새로고침하면 다시 연결해야 한다.
const GOOGLE_SCOPE='https://www.googleapis.com/auth/calendar.events'; // 약속을 구글 캘린더(primary)에 직접 쓰기 위해 events 스코프. 기존 readonly 동의 사용자는 재동의 필요
const EV_BASE='https://www.googleapis.com/calendar/v3/calendars/primary/events';
const gEventUrl=id=>EV_BASE+'/'+encodeURIComponent(id);
const NO_WRITE_MSG='일정 편집 권한이 없어요. 설정 > 구글 탭에서 다시 연결해 권한을 허용하세요.';
const G={status:'off',token:null,expiresAt:0,email:'',events:[],anchor:null,loading:null,syncedAt:null,error:'',note:'',canWrite:true}; // status: off | connecting | on | expired. canWrite: 토큰에 calendar.events 권한이 있는지
const GLINK_KEY='routine-cal-google-linked'; // "연결한 적 있음" 플래그만 저장 (토큰은 절대 저장하지 않음). 로드 시 조용한 재연결 시도의 근거
const GHINT_KEY='routine-cal-google-hint';   // 마지막으로 연결한 계정 이메일(토큰 아님). 재연결 때 GIS hint 로 넘겨 계정 선택 화면을 건너뛴다
const isLinked=()=>{try{return localStorage.getItem(GLINK_KEY)==='1'}catch(e){return false}};
const getHint=()=>{try{return localStorage.getItem(GHINT_KEY)||''}catch(e){return ''}};
const setLinked=(on,email)=>{try{if(on){localStorage.setItem(GLINK_KEY,'1');if(email)localStorage.setItem(GHINT_KEY,email)}else{localStorage.removeItem(GLINK_KEY);localStorage.removeItem(GHINT_KEY)}}catch(e){}};
const glog=(...a)=>{try{console.info('[gcal]',...a)}catch(e){}}; // 연결 흐름 추적용 콘솔 로그 (호출 여부·순서·응답 error 값)
const googleClientId=()=>window.GOOGLE_CLIENT_ID||''; // config.js 의 var GOOGLE_CLIENT_ID
let onGoogleChange=null; // 설정 모달 구글 탭이 열려 있으면 패널 다시 그리기
const notifyGoogle=()=>{render();if(onGoogleChange)onGoogleChange()};
let gisPromise=null;
function loadGis(){ // GIS 스크립트는 연결을 시도할 때만 로드 (미연결 상태에선 외부 요청 없음)
  if(window.google&&google.accounts&&google.accounts.oauth2)return Promise.resolve();
  if(!gisPromise)gisPromise=new Promise((res,rej)=>{const el=document.createElement('script');el.src='https://accounts.google.com/gsi/client';el.async=true;el.defer=true;el.onload=()=>res();el.onerror=()=>{gisPromise=null;rej(new Error('Google 스크립트를 불러오지 못했어요'))};document.head.appendChild(el)});
  return gisPromise;
}
async function googleConnect(opts){
  // silent: 페이지 로드 시 자동 재연결. prompt:'none' 으로 어떤 UI(계정 선택·동의 팝업)도 띄우지 않고, 실패하면 미연결(expired) + "다시 연결" 버튼만 보여준다.
  // 수동 연결은 prompt:'' (이미 동의한 계정이면 UI 없이, 아니면 동의 화면). 둘 다 마지막 계정 이메일을 hint 로 넘겨 계정 선택 화면을 건너뛴다
  const silent=!!(opts&&opts.silent);
  if(!googleClientId()){if(!silent)toast('config.js 에 GOOGLE_CLIENT_ID 가 없어요');return}
  if(G.status==='connecting'){glog('connect ignored: already connecting');return}
  const prev=G.status;
  const hint=getHint();
  glog(silent?'auto-reconnect: start':'connect: start',{prevStatus:prev,keepLogin:cfg('googleKeepLogin'),linked:isLinked(),hint:hint||null,gisLoaded:!!(window.google&&google.accounts&&google.accounts.oauth2)});
  G.status='connecting';G.error='';if(onGoogleChange)onGoogleChange();
  try{
    await loadGis();
    const req=Object.assign({prompt:silent?'none':''},hint?{hint}:{});
    glog('GIS ready → requestAccessToken',req);
    const tok=await new Promise((res,rej)=>{
      const tc=google.accounts.oauth2.initTokenClient({client_id:googleClientId(),scope:GOOGLE_SCOPE,
        callback:r=>{
          glog('token callback',r&&r.error?{error:r.error,error_description:r.error_description||null,error_subtype:r.error_subtype||null}:{ok:true,scope:r&&r.scope,expires_in:r&&r.expires_in});
          r&&r.access_token?res(r):rej(new Error(r&&r.error?String(r.error):'연결이 취소됐어요'));
        },
        error_callback:e=>{
          glog('token error_callback',{type:e&&e.type,message:e&&e.message});
          rej(new Error(e&&e.type==='popup_closed'?'연결 창이 닫혔어요':e&&e.type==='popup_failed_to_open'?'브라우저가 팝업을 막았어요':(e&&e.message)||(e&&e.type)||'연결에 실패했어요'));
        }});
      tc.requestAccessToken(req);
    });
    G.token=tok.access_token;G.expiresAt=Date.now()+(Number(tok.expires_in)||3600)*1000;G.status='on';G.note='';
    // 허용된 스코프 확인: 예전(readonly) 동의만 있거나 사용자가 체크를 풀면 쓰기 불가 → 탭에 재연결 안내
    G.canWrite=!tok.scope||/auth\/calendar\.events(\s|$)|auth\/calendar(\s|$)/.test(tok.scope);
    if(!G.canWrite)G.note='일정 편집 권한이 없어요(읽기 전용으로 연결됨). 다시 연결해서 "Google 캘린더 일정 보기·수정" 권한을 허용하세요.';
    const cal=await gapiFetch('https://www.googleapis.com/calendar/v3/calendars/primary'); // primary 캘린더 id = 계정 이메일
    G.email=cal.id||'';G.anchor=null;G.events=[];setLinked(true,G.email);
    glog(silent?'auto-reconnect: ok':'connect: ok',{email:G.email,canWrite:G.canWrite});
    toast(silent?`Google 다시 연결됨: ${G.email}`:`Google 연결됨: ${G.email}`);
  }catch(e){
    const msg=e&&e.message?e.message:String(e);
    glog(silent?'auto-reconnect: failed':'connect: failed',msg);
    if(silent&&!G.token){
      // 자동 팝업으로 넘어가지 않는다. 미연결로 두고 탭에서 "다시 연결" 만 제공
      G.status='expired';G.error='';
      G.note=`이전에 연결한 기록이 있어 조용히 다시 연결하려 했지만 실패했어요 (${msg}). 다시 연결을 누르세요. Chrome 이 서드파티 쿠키나 팝업을 막고 있으면 아래 안내대로 허용한 뒤 새로고침하면 자동으로 이어져요.`;
    }else{
      G.status=G.token?'on':(prev==='expired'?'expired':'off');G.error=msg;toast('Google 연결 실패: '+msg);
    }
  }
  notifyGoogle();
}
function googleAutoReconnect(){ // 페이지 로드 시: '로그인 유지' 가 켜져 있고 연결 플래그가 있으면 prompt:'none' 으로 조용히 재연결 시도 (UI 없음)
  const why=!googleClientId()?'no client id':!cfg('googleKeepLogin')?'keep-login off':!isLinked()?'not linked before':null;
  if(why){glog('auto-reconnect: skipped',why);return} // 로그인 유지를 끄면 새로고침 시 미연결
  googleConnect({silent:true});
}
function googleDisconnect(){
  const t=G.token;
  if(t&&window.google&&google.accounts&&google.accounts.oauth2)try{google.accounts.oauth2.revoke(t,()=>{})}catch(e){}
  G.token=null;G.status='off';G.email='';G.events=[];G.anchor=null;G.loading=null;G.syncedAt=null;G.error='';G.note='';G.canWrite=true;setLinked(false);
  toast('Google 연결을 해제했어요. 로컬 데이터는 그대로예요.');notifyGoogle();
}
function googleExpire(){G.token=null;G.status='expired';G.events=[];G.anchor=null;G.loading=null;G.note='토큰이 만료됐어요. 다시 연결하면 이어서 볼 수 있어요.';notifyGoogle()}
// Calendar API 호출. 401 → 만료 처리(재연결 유도), 403(권한 부족) → canWrite=false + 재연결 안내, 그 외 실패 → "상태코드 메시지" 에러
async function gapiCall(method,url,body){
  if(!G.token)throw new Error('연결되지 않았어요');
  if(Date.now()>G.expiresAt){googleExpire();throw new Error('토큰이 만료됐어요. 다시 연결하세요')}
  const r=await fetch(url,{method,headers:{Authorization:'Bearer '+G.token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
  if(r.status===401){googleExpire();throw Object.assign(new Error('401 토큰이 만료됐어요. 다시 연결하세요'),{status:401})}
  if(r.status===204)return null;
  let j=null;try{j=await r.json()}catch(e){}
  if(!r.ok){
    const msg=(j&&j.error&&j.error.message)||r.statusText||'오류';
    if(r.status===403&&/insufficient|permission|scope|forbidden/i.test(msg)){G.canWrite=false;G.note='일정 편집 권한이 없어요. 다시 연결해서 권한을 허용하세요.';if(onGoogleChange)onGoogleChange()}
    throw Object.assign(new Error(`${r.status} ${msg}`),{status:r.status});
  }
  return j;
}
const gapiFetch=url=>gapiCall('GET',url);
// 표시 중인 달(ym) ±1개월 범위의 이벤트를 가져온다. 같은 달이면 캐시(G.events) 사용. 월을 옮기면 다시 조회. 끝나면 다시 그린다
function ensureGoogleEvents(ym){
  if(G.status!=='on'||G.anchor===ym||G.loading===ym)return;
  G.loading=ym;
  const [y,m]=ym.split('-').map(Number);
  const from=new Date(y,m-2,1),to=new Date(y,m+1,1); // [전달 1일, 다다음달 1일)
  fetchGoogleEvents(from,to)
    .then(evs=>{if(G.loading!==ym)return;G.events=evs;G.anchor=ym;G.loading=null;G.syncedAt=new Date();notifyGoogle()})
    .catch(e=>{if(G.loading===ym)G.loading=null;G.error=e&&e.message?e.message:String(e);if(G.status==='on')toast('구글 캘린더 조회 실패: '+G.error);else if(G.status==='expired')toast(G.error);if(onGoogleChange)onGoogleChange()});
}
async function fetchGoogleEvents(from,to){
  const out=[];let pageToken='';
  do{
    const u=new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
    u.searchParams.set('timeMin',from.toISOString());u.searchParams.set('timeMax',to.toISOString());
    u.searchParams.set('singleEvents','true');u.searchParams.set('orderBy','startTime');u.searchParams.set('maxResults','2500');
    if(pageToken)u.searchParams.set('pageToken',pageToken);
    const j=await gapiFetch(u.toString());
    for(const it of j.items||[])out.push(...toLocalEvents(it));
    pageToken=j.nextPageToken||'';
  }while(pageToken);
  return out;
}
// 구글 이벤트 → 화면용 조각들 ({id,title,startDate,endDate,startTime,endTime} + google:true, gid, raw, allDay, recurring).
// 종일은 한 조각(범위), end.date 는 exclusive 라 하루 뺀다. 여러 날에 걸친 시간 이벤트는 날짜별 조각(첫날 start~24:00, 중간 00:00~24:00, 마지막 00:00~end)
// 으로 나눠 표시하고, 편집은 raw 의 실제 시작·끝으로 한다. cancelled 는 버린다
function toLocalEvents(it){
  if(!it||it.status==='cancelled')return [];
  const base={gid:it.id,title:it.summary||'(제목 없음)',google:true,raw:it,recurring:!!it.recurringEventId,link:it.htmlLink||''};
  if(it.start&&it.start.date){
    const e=parse((it.end&&it.end.date)||it.start.date);e.setDate(e.getDate()-1);
    const endDate=ymd(e)<it.start.date?it.start.date:ymd(e);
    return [{...base,id:'g:'+it.id,allDay:true,startDate:it.start.date,endDate,startTime:'00:00',endTime:'24:00'}];
  }
  if(!(it.start&&it.start.dateTime))return [];
  const s=new Date(it.start.dateTime),e=new Date((it.end&&it.end.dateTime)||it.start.dateTime);
  const sd=ymd(s),ed=ymd(e),sm=s.getHours()*60+s.getMinutes(),em=e.getHours()*60+e.getMinutes();
  if(ed===sd)return [{...base,id:'g:'+it.id,allDay:false,startDate:sd,endDate:sd,startTime:fromMin(sm),endTime:fromMin(Math.max(em,sm+1))}];
  const out=[];const d=new Date(s.getFullYear(),s.getMonth(),s.getDate());
  for(let i=0;i<62;i++){const k=ymd(d);if(k>ed)break;const st=k===sd?sm:0,en=k===ed?em:1440;
    if(en>st)out.push({...base,id:'g:'+it.id+':'+k,allDay:false,startDate:k,endDate:k,startTime:fromMin(st),endTime:fromMin(en)});d.setDate(d.getDate()+1)}
  return out;
}
// 편집 폼 초기값: 구글 이벤트의 실제 시작·끝. <input type=time> 은 24:00 을 못 보여주므로 종일은 00:00~23:59 로, 자정에 끝나면 다음날 00:00 으로 표기(저장 시 같은 시각)
function draftFromGoogle(it){
  if(it.start&&it.start.date){const e=parse((it.end&&it.end.date)||it.start.date);e.setDate(e.getDate()-1);
    return {title:it.summary||'',startDate:it.start.date,endDate:ymd(e)<it.start.date?it.start.date:ymd(e),startTime:'00:00',endTime:'23:59',allDay:true}}
  const s=new Date(it.start.dateTime),e=new Date((it.end&&it.end.dateTime)||it.start.dateTime);
  return {title:it.summary||'',startDate:ymd(s),endDate:ymd(e),startTime:fromMin(s.getHours()*60+s.getMinutes()),endTime:fromMin(e.getHours()*60+e.getMinutes()),allDay:false};
}
// 폼 값 → Calendar API 본문. 종일(00:00~23:59 그대로 둔 종일 이벤트)은 date, 아니면 dateTime(시작일+시작시간 ~ 종료일+끝시간, 연속 구간)
function toGoogleBody(d){
  if(d.allDay&&d.startTime==='00:00'&&d.endTime==='23:59'){const e=parse(d.endDate);e.setDate(e.getDate()+1);return {summary:d.title,start:{date:d.startDate},end:{date:ymd(e)}}}
  const tz=Intl.DateTimeFormat().resolvedOptions().timeZone;
  const iso=(date,time)=>{const x=parse(date);x.setMinutes(toMin(time));return x.toISOString()}; // '24:00' 은 다음날 00:00
  return {summary:d.title,start:{dateTime:iso(d.startDate,d.startTime),timeZone:tz},end:{dateTime:iso(d.endDate,d.endTime),timeZone:tz}};
}
// 로컬(임시) 약속을 구글로 옮긴다. 로컬의 "여러 날 같은 시간" 의미를 지키려고 날짜마다 이벤트 하나씩 만든다. 성공한 것만 로컬에서 지운다
async function migrateLocalEvents(){
  if(G.status!=='on'){toast('먼저 Google 에 연결하세요');return}
  if(!G.canWrite){toast(NO_WRITE_MSG);return}
  let moved=0,failed=null;
  for(const ev of [...S.events]){
    try{
      let d=parse(ev.startDate),e=parse(ev.endDate);if(e<d)e=d;
      for(;d<=e;d.setDate(d.getDate()+1)){const k=ymd(d);await gapiCall('POST',EV_BASE,toGoogleBody({title:ev.title,startDate:k,endDate:k,startTime:ev.startTime,endTime:ev.endTime}))}
      S.events=S.events.filter(x=>x.id!==ev.id);save();moved++;
    }catch(e){failed=e&&e.message?e.message:String(e);break}
  }
  G.anchor=null;
  toast(failed?`로컬 약속 ${moved}개를 옮긴 뒤 실패했어요: ${failed}`:`로컬 약속 ${moved}개를 구글 캘린더로 옮겼어요`);
  notifyGoogle();
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
  fitGrids(); // 시간당 높이(--px) 적용: DOM 이 붙은 뒤 실제 높이를 재서 계산
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
const ECOL=['var(--e0)','var(--e1)','var(--e2)','var(--e3)','var(--e4)','var(--e5)']; // 약속 색 팔레트 (루틴 팔레트와 겹치지 않게 고른 6색)
let EBASE=[];
function refreshPalette(){
  const cs=getComputedStyle(document.documentElement);
  PBASE=PCOL.map((_,i)=>hexToHsl(cs.getPropertyValue('--p'+i).trim()));
  EBASE=ECOL.map((_,i)=>hexToHsl(cs.getPropertyValue('--e'+i).trim()));
  document.documentElement.style.setProperty('--routine-alpha',String(cfg('routineAlpha')/100)); // 일간·주간 루틴 블록 + 편집 그리드 other 블록 투명도
}
// 약속 블록·칩 인라인 스타일: 설정의 약속 색 하나로 채우고, 밝은 색이면 글자를 어둡게
function eventStyle(){const ci=cfg('eventColor')%ECOL.length;const hsl=EBASE[ci];return 'background:'+ECOL[ci]+(hsl&&hsl[2]>.62?';color:#14181d':';color:#fff')}
// 블록 인라인 스타일(배경, 필요하면 글자색). colorByLabel 이 켜진 페이지는 라벨 해시로 고른 변형색, 이름 없으면 페이지 기본색
function blockStyle(p,label,withInk){
  const ci=p.color%PCOL.length,base=PCOL[ci],k=labelKey(label);
  if(!p.colorByLabel||!k||!PBASE[ci])return 'background:'+base;
  const [hh,s,l]=PBASE[ci];const [ds,dl]=LABEL_VARIANTS[hashStr(k)%LABEL_VARIANTS.length];const dir=l>.5?-1:1;
  const s2=Math.min(1,Math.max(.12,s+ds)),l2=Math.min(.82,Math.max(.18,l+dir*dl));
  return `background:hsl(${hh.toFixed(1)} ${(s2*100).toFixed(1)}% ${(l2*100).toFixed(1)}%)`+(withInk!==false&&l2>.62?';color:#14181d':'');
}

// 시간당 높이(--px) 적용. 'fit' 이면 그리드 영역(래퍼 시작 ~ .body 아래)에 표시 시간 수가 스크롤 없이 들어가도록 계산(최소 32px, 그 밑이면 세로 스크롤),
// 고정이면 설정 px. 세로 좌표가 전부 calc(var(--px) * …) 라서 값만 바꾸면 블록·눈금이 따라온다. 창 크기가 바뀌면 다시 계산
function hourPx(grid){
  const hh=cfg('hourHeight');const hours=Number(grid.dataset.hours)||18;
  if(hh!=='fit')return Math.min(80,Math.max(24,Number(hh)||44));
  const body=grid.closest('.body'),wrap=grid.parentElement;
  if(!body)return 44;
  const bodyR=body.getBoundingClientRect(),wrapR=wrap.getBoundingClientRect();
  const relTop=wrapR.top-bodyR.top+body.scrollTop; // 래퍼의 body 안 위치
  const avail=body.clientHeight-relTop-parseFloat(getComputedStyle(body).paddingBottom||'0')-parseFloat(getComputedStyle(wrap).marginBottom||'0');
  const tcol=grid.querySelector('.tcol');const headerH=tcol?tcol.getBoundingClientRect().top-grid.getBoundingClientRect().top:0;
  return Math.max(32,Math.floor((avail-headerH-2)/hours));
}
function fitGrids(){document.querySelectorAll('.wgrid,.egrid').forEach(grid=>grid.style.setProperty('--px',hourPx(grid)+'px'))}
let fitT=null;window.addEventListener('resize',()=>{clearTimeout(fitT);fitT=setTimeout(fitGrids,50)}); // 창 크기 변경 시 다시 계산 (짧게 디바운스)

// iOS 세그먼트 컨트롤 (상단바 뷰 전환과 설정 모달에서 공용)
function segControl(name,options,value,onPick){const el=h('div',{class:'seg',role:'group','aria-label':name});options.forEach(([k,label])=>el.appendChild(h('button',{class:value===k?'sel':'','aria-pressed':value===k?'true':'false',onclick:()=>onPick(k)},[label])));return el}
const calSeg=()=>segControl('보기',[['day','일간'],['week','주간'],['month','월간']],view.type,setCalView);
const isCalView=()=>['day','week','month'].includes(view.type);

function renderSide(){
  const side=h('div',{class:'side'});
  const snav=h('div',{class:'snav'}); // 스크롤되는 부분. 아래 .foot(설정)은 항상 보임
  snav.appendChild(h('h1',null,['루틴 캘린더']));
  const nav=h('ul',{class:'nav'});
  nav.appendChild(h('li',{class:isCalView()?'sel':'',onclick:()=>setCalView(lastCalView())},[h('span',{class:'nm'},['캘린더'])]));
  snav.appendChild(nav);
  snav.appendChild(h('div',{class:'sec'},['루틴 페이지']));
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
  snav.appendChild(pl);
  snav.appendChild(h('button',{class:'add',onclick:addPage},['+ 새 루틴 페이지']));
  side.appendChild(snav);
  side.appendChild(h('div',{class:'foot'},[h('button',{title:'설정',onclick:()=>openSettings()},['⚙ 설정'])]));
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
  else if(view.type==='day')renderDay(main);
  else renderPage(main);
  return main;
}

/* month */
function renderMonth(main){
  const [y,m]=view.ym.split('-').map(Number);
  ensureGoogleEvents(view.ym);
  const bar=h('div',{class:'bar'},[
    h('button',{class:'quiet',onclick:()=>{shiftMonth(-1)}},['‹']),
    h('h2',null,[`${y}년 ${m}월`]),
    h('button',{class:'quiet',onclick:()=>{shiftMonth(1)}},['›']),
    h('button',{class:'quiet',onclick:()=>{view.ym=today.slice(0,7);render()}},['오늘']),
    h('span',{class:'sp'}),
    calSeg(),
    h('button',{class:'primary',onclick:()=>openEvent(null,today)},['+ 약속'])
  ]);
  main.appendChild(bar);
  const body=h('div',{class:'body'});
  const grid=h('div',{class:'mgrid'});
  dayOrder().forEach(d=>grid.appendChild(h('div',{class:'hd'},[DAYS[d]])));
  const first=new Date(y,m-1,1);const off=dayPos(wd(first));
  const start=new Date(y,m-1,1-off);
  const evByDate=indexEvents();
  for(let i=0;i<42;i++){
    const d=new Date(start);d.setDate(start.getDate()+i);
    const key=ymd(d);const out=d.getMonth()!==m-1;
    if(i===35&&out)break;
    const cell=h('div',{class:'day'+(out?' out':'')+(key===today?' today':'')+(wd(d)===6?' sun':''),onclick:()=>openEvent(null,key)},[h('span',{class:'n'},[String(d.getDate())])]);
    (evByDate[key]||[]).forEach(ev=>{
      const cf=!ev.allDay&&eventConflicts(ev).some(c=>c.date===key);
      // 구글 이벤트는 점선 테두리(.g), 종일 이벤트는 날짜 상단 한 줄(.allday, 정렬로 맨 위)
      const tmp=!ev.google&&G.status!=='on'; // 미연결 상태의 로컬 약속 = 임시 배지 (구글/로컬 구분 표기는 그 외에 없음)
      cell.appendChild(h('div',{class:'ev'+(ev.allDay?' allday':'')+(tmp?' tmp':''),style:eventStyle(),'data-src':ev.google?'g':'l',title:ev.title,onclick:(e)=>{e.stopPropagation();openEvent(ev)}},[
        cf?h('span',{class:'cf',title:'활성 루틴과 겹침'}):null,
        tmp?h('span',{class:'tag'},['임시']):null,
        ev.allDay?null:h('span',{class:'t'},[ev.startTime]),h('span',{class:'ti'},[ev.title||'(제목 없음)'])
      ]));
    });
    grid.appendChild(cell);
  }
  body.appendChild(grid);
  main.appendChild(body);
}
function shiftMonth(n){const [y,m]=view.ym.split('-').map(Number);const d=new Date(y,m-1+n,1);view.ym=d.getFullYear()+'-'+pad(d.getMonth()+1);render()}
function indexEvents(){ // 로컬 약속 + (연결돼 있으면) 구글 이벤트. 날짜별로 종일 먼저, 그다음 시작 시간순
  const idx={};
  for(const ev of [...S.events,...(G.status==='on'?G.events:[])]){ let d=parse(ev.startDate),e=parse(ev.endDate);if(e<d)e=d;
    for(;d<=e;d.setDate(d.getDate()+1)){(idx[ymd(d)]=idx[ymd(d)]||[]).push(ev)} }
  for(const k in idx)idx[k].sort((a,b)=>(b.allDay?1:0)-(a.allDay?1:0)||a.startTime.localeCompare(b.startTime));
  return idx;
}

/* week */
function renderWeek(main){
  view.weekStart=weekStartOf(view.weekStart||new Date());const ws=view.weekStart;const we=new Date(ws);we.setDate(ws.getDate()+6);
  ensureGoogleEvents(ymd(ws).slice(0,7));
  const bar=h('div',{class:'bar'},[
    h('button',{class:'quiet',onclick:()=>{view.weekStart.setDate(view.weekStart.getDate()-7);render()}},['‹']),
    h('h2',null,[`${ws.getMonth()+1}월 ${ws.getDate()}일 – ${we.getMonth()+1}월 ${we.getDate()}일`]),
    h('button',{class:'quiet',onclick:()=>{view.weekStart.setDate(view.weekStart.getDate()+7);render()}},['›']),
    h('button',{class:'quiet',onclick:()=>{view.weekStart=weekStartOf(new Date());render()}},['이번 주']),
    h('span',{class:'sp'}),
    calSeg(),
  ]);
  main.appendChild(bar);
  const dates=[];for(let i=0;i<7;i++){const d=new Date(ws);d.setDate(ws.getDate()+i);dates.push(d)}
  main.appendChild(timeGridBody(dates));
}

/* day: 주간과 같은 시간축에 컬럼 하나 (드래그 편집 없음) */
function renderDay(main){
  const d=parse(view.day);
  ensureGoogleEvents(view.day.slice(0,7));
  const bar=h('div',{class:'bar'},[
    h('button',{class:'quiet',onclick:()=>shiftDay(-1)},['‹']),
    h('h2',null,[`${d.getMonth()+1}월 ${d.getDate()}일 (${DAYS[wd(d)]})`]),
    h('button',{class:'quiet',onclick:()=>shiftDay(1)},['›']),
    h('button',{class:'quiet',onclick:()=>{view.day=today;render()}},['오늘']),
    h('span',{class:'sp'}),
    calSeg(),
    h('button',{class:'primary',onclick:()=>openEvent(null,view.day)},['+ 약속'])
  ]);
  main.appendChild(bar);
  main.appendChild(timeGridBody([d]));
}
function shiftDay(n){const d=parse(view.day);d.setDate(d.getDate()+n);view.day=ymd(d);render()}

// 시간축 그리드 본문 (주간 7열 / 일간 1열 공용): 범례 + 종일 줄 + 활성 루틴 블록(흐림, 배경) + 약속 블록(채움) + 빈 시간 드래그로 약속 생성
function timeGridBody(dates){
  const body=h('div',{class:'body'});
  const act=S.pages.filter(p=>p.active);
  if(!act.length)body.appendChild(h('div',{class:'notice'},['활성화된 루틴 페이지가 없어요. 왼쪽 목록에서 스위치를 켜면 루틴이 함께 보여요.'])); // 그리드는 항상 표시
  const lg=h('div',{class:'legend'});
  act.forEach(p=>lg.appendChild(h('span',null,[h('i',{style:'background:'+PCOL[p.color%PCOL.length]}),p.name])));
  lg.appendChild(h('span',null,[h('i',{style:eventStyle()}),'약속']));
  body.appendChild(lg);
  const H0=cfg('dayStart'),H1=cfg('dayEnd'),SLOT=30;const hours=H1-H0;const nslots=hours*60/SLOT;
  const cy=hr=>`calc(var(--px) * ${hr})`;const height=cy(hours); // 세로 좌표는 시간당 높이 --px 기준 (fitGrids 가 정함)
  const n=dates.length;
  const wrap=h('div',{class:'wwrap'});
  const grid=h('div',{class:'wgrid'+(n===1?' dgrid':''),style:`grid-template-columns:48px repeat(${n},minmax(0,1fr))`,'data-hours':hours});
  const PXv=()=>parseFloat(getComputedStyle(grid).getPropertyValue('--px'))||44; // 드래그 픽셀 계산용 현재 시간당 px
  grid.appendChild(h('div',{class:'whd'},['']));
  dates.forEach(d=>grid.appendChild(h('div',{class:'whd'+(ymd(d)===today?' today':'')},[`${DAYS[wd(d)]} ${d.getDate()}`])));
  const evIdx=indexEvents();
  // 종일 이벤트 줄: 하나라도 있으면 헤더 아래에 한 줄 추가
  const adWeek=dates.map(d=>(evIdx[ymd(d)]||[]).filter(ev=>ev.allDay));
  if(adWeek.some(a=>a.length)){
    grid.appendChild(h('div',{class:'wad lab'},['종일']));
    adWeek.forEach(list=>grid.appendChild(h('div',{class:'wad'},list.map(ev=>h('div',{class:'ev allday',style:eventStyle(),'data-src':ev.google?'g':'l',title:ev.title,onclick:()=>openEvent(ev)},[h('span',{class:'ti'},[ev.title])])))));
  }
  const tc=h('div',{class:'tcol first',style:'height:'+height});
  for(let hr=H0;hr<H1;hr++)tc.appendChild(h('div',{class:'hrlab',style:'top:'+cy(hr-H0)},[pad(hr)+':00'])); // 시간 축 열에는 가로선 없이 라벨만
  grid.appendChild(tc);
  dates.forEach((d,i)=>{
    const col=h('div',{class:'tcol',style:'height:'+height});
    for(let hr=H0;hr<=H1;hr++)col.appendChild(h('div',{class:'hrline',style:'top:'+cy(hr-H0)}));
    const blocks=[];
    const dow=wd(d);
    act.forEach(p=>p.items.filter(it=>it.day===dow&&it.start&&it.end).forEach(it=>{
      const s=Math.max(toMin(it.start),H0*60),e=Math.min(toMin(it.end),H1*60);if(e<=s)return;
      blocks.push({s,e,it,p});
    }));
    const lay=layoutOverlaps(blocks);
    blocks.forEach(({s,e,it,p},k)=>{
      const {col:c,n}=lay[k];
      // 겹치는 묶음은 폭을 n등분해 나란히. 겹치지 않으면(n=1) 기본 left/right 그대로. 3개 이상 겹치면 라벨 생략, title 툴팁만
      const split=n>1?`;right:auto;left:calc(3px + (100% - 6px) * ${c} / ${n});width:calc((100% - 6px) / ${n} - ${c<n-1?2:0}px)`:'';
      col.appendChild(h('div',{class:'blk rt',style:`top:${cy((s-H0*60)/60)};height:calc(var(--px) * ${(e-s)/60} - 2px);${blockStyle(p,it.label)}${split}`,title:`${p.name} · ${it.start}–${it.end} ${it.label||''}`},[n>=3?null:h('div',{class:'l'},[it.label||p.name])]));
    });
    (evIdx[ymd(d)]||[]).forEach(ev=>{
      if(ev.allDay)return; // 종일은 위 줄에
      const s=Math.max(toMin(ev.startTime),H0*60),e=Math.min(toMin(ev.endTime),H1*60);if(e<=s)return;
      const cf=eventConflicts(ev).some(c=>c.date===ymd(d));
      const tmp=!ev.google&&G.status!=='on';
      // 약속 블록은 pointerdown 을 막아 열(드래그 생성)로 안 가게 하고, 클릭하면 편집
      col.appendChild(h('div',{class:'blk evb'+(cf?' cf':''),'data-src':ev.google?'g':'l',style:`top:${cy((s-H0*60)/60)};height:calc(var(--px) * ${(e-s)/60} - 2px);${eventStyle()}`,title:ev.title+(cf?' · 활성 루틴과 겹침':''),onpointerdown:e=>e.stopPropagation(),onclick:()=>openEvent(ev)},[h('div',{class:'l'},[(tmp?'임시 · ':'')+(ev.title||'(제목 없음)')])]));
    });
    // 빈 시간(또는 배경인 루틴 블록 위) 드래그 → 약속 생성. 편집 그리드와 같은 30분 스냅·고스트. 5px 미만 움직임은 클릭 = 기본 길이
    let drag=null,ghost=null;
    const slotAt=ev=>{const r=col.getBoundingClientRect();return Math.min(nslots-1,Math.max(0,Math.floor((ev.clientY-r.top)/(PXv()*SLOT/60))))};
    const paint=()=>{const SPX=PXv()*SLOT/60;const a=Math.min(drag.s,drag.e),b=Math.max(drag.s,drag.e)+1;ghost.style.top=(a*SPX)+'px';ghost.style.height=((b-a)*SPX-2)+'px';ghost.textContent='';ghost.appendChild(h('div',{class:'l'},[fromMin(H0*60+a*SLOT)+'–'+fromMin(H0*60+b*SLOT)]))};
    col.addEventListener('pointerdown',ev=>{
      if(ev.button!==0&&ev.pointerType==='mouse')return;
      drag={s:slotAt(ev),e:slotAt(ev),x0:ev.clientX,y0:ev.clientY,moved:false};col.setPointerCapture(ev.pointerId);
      ghost=h('div',{class:'blk evb ghost',style:eventStyle()});col.appendChild(ghost);paint();
    });
    col.addEventListener('pointermove',ev=>{if(!drag)return;if(!drag.moved&&Math.hypot(ev.clientX-drag.x0,ev.clientY-drag.y0)>=5)drag.moved=true;drag.e=slotAt(ev);paint()});
    const finish=()=>{
      if(!drag)return;const dg=drag;drag=null;ghost&&ghost.remove();ghost=null;
      const a=Math.min(dg.s,dg.e),b=Math.max(dg.s,dg.e)+1;
      const st=H0*60+a*SLOT;
      const en=Math.min(dg.moved?H0*60+b*SLOT:st+cfg('defaultDur'),1439); // time 입력은 24:00 을 못 보여주므로 23:59 까지
      openEvent(null,ymd(d),{startTime:fromMin(st),endTime:fromMin(Math.max(en,st+1))});
    };
    col.addEventListener('pointerup',finish);col.addEventListener('pointercancel',()=>{drag=null;ghost&&ghost.remove();ghost=null});
    grid.appendChild(col);
  });
  wrap.appendChild(grid);body.appendChild(wrap);
  return body;
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
  const sorted=[...p.items].sort((a,b)=>dayPos(a.day)-dayPos(b.day)||(a.start||'').localeCompare(b.start||''));
  sorted.forEach(it=>{
    const tr=h('tr');
    const sel=h('select',{onchange:(e)=>{it.day=Number(e.target.value);save()}});
    dayOrder().forEach(i=>sel.appendChild(h('option',{value:i,...(i===it.day?{selected:''}:{})},[DAYS[i]])));
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
  const H0=cfg('dayStart'),H1=cfg('dayEnd'),SLOT=30;const hours=H1-H0;const nslots=hours*60/SLOT;
  const cy=hr=>`calc(var(--px) * ${hr})`;const height=cy(hours); // 세로 좌표는 시간당 높이 --px 기준 (fitGrids 가 정함)
  const order=dayOrder();
  const wrap=h('div',{class:'egwrap'});const grid=h('div',{class:'egrid','data-hours':hours});
  const PXv=()=>parseFloat(getComputedStyle(grid).getPropertyValue('--px'))||40; // 드래그·리사이즈 픽셀 계산용 현재 시간당 px
  grid.appendChild(h('div',{class:'whd'},['']));
  order.forEach(d=>grid.appendChild(h('div',{class:'whd'},[DAYS[d]])));
  const tc=h('div',{class:'tcol first',style:'height:'+height});
  for(let hr=H0;hr<H1;hr++)tc.appendChild(h('div',{class:'hrlab',style:'top:'+cy(hr-H0)},[pad(hr)+':00'])); // 시간 축 열에는 가로선 없이 라벨만
  grid.appendChild(tc);
  const col=PCOL[p.color%PCOL.length];
  const others=activeItems(p.id);
  // 같은 페이지 안에서 서로 겹치는 아이템 (경고 테두리 + 툴팁). 충돌 로직(토스트·약속 경고)과는 별개로 표시만 한다
  const ovl=new Set();
  const its=p.items.filter(it=>it.start&&it.end);
  for(let a=0;a<its.length;a++)for(let b=a+1;b<its.length;b++){const x=its[a],y=its[b];
    if(x.day===y.day&&overlap(toMin(x.start),toMin(x.end),toMin(y.start),toMin(y.end))){ovl.add(x.id);ovl.add(y.id)}}
  const cols=[]; // 요일 컬럼 엘리먼트 (블록을 다른 요일로 옮길 때 참조)
  const dayAt=x=>{for(const d of order){if(x<cols[d].getBoundingClientRect().right)return d}return order[6]};
  for(const day of order){
    const c=h('div',{class:'tcol',style:'height:'+height,'data-day':day});cols[day]=c;
    for(let hr=H0;hr<=H1;hr++){c.appendChild(h('div',{class:'hrline',style:'top:'+cy(hr-H0)}));if(hr<H1)c.appendChild(h('div',{class:'hrline half',style:'top:'+cy(hr-H0+.5)}))}
    others.filter(it=>it.day===day).forEach(it=>{
      const s=Math.max(toMin(it.start),H0*60),e=Math.min(toMin(it.end),H1*60);if(e<=s)return;
      c.appendChild(h('div',{class:'blk other',style:`top:${cy((s-H0*60)/60)};height:calc(var(--px) * ${(e-s)/60} - 2px);${blockStyle(it.page,it.label,false)}`},[h('div',{class:'l'},[it.page.name])]));
    });
    p.items.filter(it=>it.day===day&&it.start&&it.end).forEach(it=>{
      const s=Math.max(toMin(it.start),H0*60),e=Math.min(toMin(it.end),H1*60);if(e<=s)return;
      const lbl=h('div',{class:'l'},[it.label||'(이름 없음)']);
      const isOvl=ovl.has(it.id);
      const blk=h('div',{class:'blk'+(isOvl?' ovl':''),'data-id':it.id,style:`top:${cy((s-H0*60)/60)};height:calc(var(--px) * ${(e-s)/60} - 2px);${blockStyle(p,it.label)}`,title:(isOvl?'같은 페이지 루틴과 겹침 · ':'')+`${it.start}–${it.end} ${it.label||''}`},[lbl,h('div',{class:'rs t'}),h('div',{class:'rs b'})]);
      // 블록 조작: 본체 드래그=이동(다른 요일로도), 상단/하단 6px(.rs)=시작/끝 시간 조절. 30분 스냅, 최소 30분.
      // 5px 미만 움직임으로 놓으면 클릭 → 이름 편집기. 드래그 중엔 시간 텍스트를 실시간 표시하고 놓을 때 저장.
      let d=null;
      const paintBlk=()=>{
        const s=Math.max(d.s,H0*60),e=Math.min(d.e,H1*60);
        const PX=PXv();blk.style.top=((s-H0*60)/60*PX)+'px';blk.style.height=Math.max(0,(e-s)/60*PX-2)+'px';
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
        const dm=Math.round(dy/(PXv()*SLOT/60))*SLOT;
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
    const slotAt=(ev)=>{const r=c.getBoundingClientRect();const y=ev.clientY-r.top;return Math.min(nslots-1,Math.max(0,Math.floor(y/(PXv()*SLOT/60))))};
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
    function paint(){const SPX=PXv()*SLOT/60;const a=Math.min(drag.s,drag.e),b=Math.max(drag.s,drag.e)+1;ghost.style.top=(a*SPX)+'px';ghost.style.height=((b-a)*SPX-2)+'px';ghost.innerHTML='<div class="l">'+fromMin(H0*60+a*SLOT)+'–'+fromMin(H0*60+b*SLOT)+'</div>'}
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
  dayOrder().forEach(i=>{const d=DAYS[i];
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
function openEvent(ev,dateKey,preset){ // preset: 드래그 생성 시 {startTime,endTime}
  // 연결돼 있으면 새 약속과 구글 이벤트는 구글 캘린더(primary)에 직접 쓴다. 로컬 약속은 미연결 상태에서만 새로 만들 수 있고, 남아 있는 로컬 약속은 "임시" 로 편집·삭제만 된다
  const isNew=!ev;
  const gmode=G.status==='on'&&(isNew||!!(ev&&ev.google));
  const raw=ev&&ev.google?ev.raw:null;
  const pst=(preset&&preset.startTime)||cfg('defaultStart');
  const draft=raw?draftFromGoogle(raw):ev?{...ev}:{id:uid(),title:'',startDate:dateKey||today,endDate:dateKey||today,startTime:pst,endTime:(preset&&preset.endTime)||fromMin(Math.min(toMin(pst)+cfg('defaultDur'),1439))};
  let busy=false;
  const ov=h('div',{class:'ov',onclick:(e)=>{if(e.target===ov&&!busy)close()}});
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
  const note=gmode?(raw?(raw.recurringEventId?'구글 캘린더 반복 일정 — 이 일정만 수정·삭제돼요.':draft.allDay?'구글 캘린더 종일 일정 — 시간을 00:00~23:59 그대로 두면 종일로 저장돼요.':'구글 캘린더 일정이에요. 저장하면 바로 반영돼요.'):'연결된 구글 캘린더(primary)에 추가돼요.')
    :(G.status==='on'?'임시(로컬) 약속이에요. 설정 > 구글 탭에서 구글 캘린더로 옮길 수 있어요.':null);
  const setBusy=on=>{busy=on;md.querySelectorAll('button').forEach(b=>b.disabled=on)};
  const fail=e=>{setBusy(false);toast('구글 캘린더 오류: '+(e&&e.message?e.message:String(e)))}; // 로컬 상태는 그대로
  const done=msg=>{close();G.anchor=null;render();toast(msg)}; // 성공 후 해당 월 재조회
  const validate=()=>{
    if(!draft.startDate||!draft.endDate||!draft.startTime||!draft.endTime){toast('날짜와 시간을 채워주세요');return false}
    if(draft.endDate<draft.startDate){toast('종료일이 시작일보다 앞설 수 없어요');return false}
    if(draft.startDate===draft.endDate&&toMin(draft.endTime)<=toMin(draft.startTime)){toast('끝 시간이 시작 시간보다 늦어야 해요');return false}
    return true;
  };
  const md=h('div',{class:'md'},[
    h('h3',null,[isNew?'약속 추가':'약속 편집']),
    note?h('p',{class:'hint',style:'margin:-6px 0 10px'},[note]):null,
    form,cfBox,
    h('div',{class:'acts'},[
      isNew?null:h('button',{class:'quiet danger',onclick:async()=>{
        if(gmode){if(!G.canWrite){toast(NO_WRITE_MSG);return}setBusy(true);try{await gapiCall('DELETE',gEventUrl(raw.id));done('구글 캘린더에서 삭제했어요')}catch(e){fail(e)}}
        else{S.events=S.events.filter(x=>x.id!==ev.id);save();close();render()}
      }},['삭제']),
      h('span',{class:'sp'}),
      h('button',{onclick:close},['취소']),
      h('button',{class:'primary',onclick:async()=>{
        if(!validate())return;
        if(gmode){
          if(!G.canWrite){toast(NO_WRITE_MSG);return}
          setBusy(true);
          try{
            if(isNew)await gapiCall('POST',EV_BASE,toGoogleBody(draft));else await gapiCall('PATCH',gEventUrl(raw.id),toGoogleBody(draft));
            done(isNew?'구글 캘린더에 추가했어요':'구글 캘린더에 저장했어요');
          }catch(e){fail(e)}
        }else{
          if(isNew)S.events.push(draft);else Object.assign(ev,draft);
          save();close();render();
        }
      }},[isNew?'추가':'저장'])
    ])
  ]);
  ov.appendChild(md);document.body.appendChild(ov);
  refreshCf();
  const onKey=(e)=>{if(e.key==='Escape'&&!busy)close()};document.addEventListener('keydown',onKey);
  function close(){ov.remove();document.removeEventListener('keydown',onKey)}
  setTimeout(()=>{const t=md.querySelector('input[type=text]');t&&t.focus()},0);
}
/* settings modal (좌측 탭: 일반 / 약속 / 백업). 모든 뷰의 상단바 ⚙ 설정 버튼으로 연다 */
function exportBackup(){
  const name=`routine-calendar-${ymd(new Date())}.json`;
  const data={version:BACKUP_VERSION,exportedAt:new Date().toISOString(),pages:S.pages,events:S.events,settings:S.settings};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=h('a',{href:url,download:name});document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  toast(`내보냈어요: ${name}`);
}
function openSettings(tab){
  const TABS=[['general','일반'],['event','약속'],['google','구글'],['backup','백업']];
  let cur=TABS.some(([k])=>k===tab)?tab:'general';
  const ov=h('div',{class:'ov',onclick:(e)=>{if(e.target===ov)close()}});
  const tabs=h('div',{class:'stabs',role:'tablist'});
  const pane=h('div',{class:'spane'});
  function drawTabs(){tabs.innerHTML='';TABS.forEach(([k,label])=>tabs.appendChild(h('button',{class:k===cur?'sel':'',role:'tab','aria-selected':k===cur?'true':'false',onclick:()=>{cur=k;drawTabs();drawPane()}},[label])))}
  function drawPane(){pane.innerHTML='';({general:generalTab,event:eventTab,google:googleTab,backup:backupTab})[cur](pane)}
  // 값이 바뀌면 바로 저장·적용한다. 모달은 body 에 붙어 있어 render() 에 지워지지 않으므로 패널만 다시 그린다
  const apply=fn=>{fn();save();render();drawPane()};
  const seg=segControl;
  function generalTab(el){
    el.appendChild(h('div',{class:'sect'},['테마']));
    el.appendChild(h('div',{class:'frow'},[seg('테마',[['system','시스템'],['light','라이트'],['dark','다크']],cfg('theme'),k=>apply(()=>{S.settings.theme=k;applyTheme()}))]));
    el.appendChild(h('div',{class:'sect'},['주 시작 요일']));
    el.appendChild(h('div',{class:'frow'},[seg('주 시작 요일',[['mon','월요일'],['sun','일요일']],cfg('weekStart'),k=>apply(()=>{S.settings.weekStart=k;if(view.weekStart){const mid=new Date(view.weekStart);mid.setDate(mid.getDate()+3);view.weekStart=weekStartOf(mid)}}))]));
    el.appendChild(h('p',{class:'hint'},['월간·주간·편집 그리드가 이 요일부터 시작해요.']));
    el.appendChild(h('div',{class:'sect'},['주간 뷰 시간 범위']));
    const a=h('input',{type:'number',min:'0',max:'23',step:'1',value:cfg('dayStart')}),b=h('input',{type:'number',min:'1',max:'24',step:'1',value:cfg('dayEnd')});
    const commit=()=>{
      let st=Math.round(Number(a.value)),en=Math.round(Number(b.value));
      if(!Number.isFinite(st)||!Number.isFinite(en)){drawPane();return}
      st=Math.min(23,Math.max(0,st));en=Math.min(24,Math.max(1,en));
      if(st>=en){toast('시작 시가 끝 시보다 앞서야 해요');drawPane();return}
      apply(()=>{S.settings.dayStart=st;S.settings.dayEnd=en});
    };
    a.addEventListener('change',commit);b.addEventListener('change',commit);
    el.appendChild(h('div',{class:'frow'},[h('label',null,['시작 ',a,' 시']),h('span',{class:'hint',style:'margin:0'},['~']),h('label',null,['끝 ',b,' 시'])]));
    el.appendChild(h('p',{class:'hint'},['주간 뷰와 편집 그리드에 적용돼요. 범위 밖 루틴은 잘려 보이지만 데이터는 그대로예요.']));
    el.appendChild(h('div',{class:'sect'},['루틴 블록 흐림']));
    const pct=h('span',{class:'pct'},[cfg('routineAlpha')+'%']);
    const rng=h('input',{type:'range',min:'5',max:'100',step:'1',value:cfg('routineAlpha'),'aria-label':'루틴 블록 불투명도',
      oninput:(e)=>{S.settings.routineAlpha=Number(e.target.value);pct.textContent=e.target.value+'%';document.documentElement.style.setProperty('--routine-alpha',String(Number(e.target.value)/100))},
      onchange:(e)=>apply(()=>{S.settings.routineAlpha=Number(e.target.value)})});
    el.appendChild(h('div',{class:'frow'},[rng,pct]));
    el.appendChild(h('p',{class:'hint'},['일간·주간 뷰의 루틴 블록과 편집 그리드의 다른 페이지 루틴이 이만큼 불투명하게 보여요. 약속이 루틴 위에서 뚜렷하게 구분되도록 낮게 두는 게 기본이에요.']));
    el.appendChild(h('div',{class:'sect'},['시간당 높이']));
    const hh=cfg('hourHeight');const fixed=hh!=='fit';
    el.appendChild(h('div',{class:'frow'},[seg('시간당 높이',[['fit','높이 맞춤'],['fixed','고정']],fixed?'fixed':'fit',k=>apply(()=>{S.settings.hourHeight=k==='fit'?'fit':(fixed?hh:44)}))]));
    if(fixed){
      const pxl=h('span',{class:'pct'},[hh+'px']);
      const hr=h('input',{type:'range',min:'24',max:'80',step:'2',value:hh,'aria-label':'시간당 높이(px)',
        oninput:(e)=>{S.settings.hourHeight=Number(e.target.value);pxl.textContent=e.target.value+'px';fitGrids()},
        onchange:(e)=>apply(()=>{S.settings.hourHeight=Number(e.target.value)})});
      el.appendChild(h('div',{class:'frow'},[hr,pxl]));
    }
    el.appendChild(h('p',{class:'hint'},[fixed?'편집·주간·일간 그리드의 한 시간 높이를 고정해요.':'그리드 영역의 높이에 맞춰 하루가 스크롤 없이 들어가도록 한 시간 높이를 계산해요 (최소 32px, 그 밑이면 세로 스크롤). 창 크기가 바뀌면 다시 계산해요.']));
  }
  function eventTab(el){
    el.appendChild(h('div',{class:'sect'},['새 약속 기본값']));
    el.appendChild(h('div',{class:'f'},[
      h('label',null,['기본 시작 시간',h('input',{type:'time',value:cfg('defaultStart'),onchange:(e)=>{if(e.target.value)apply(()=>{S.settings.defaultStart=e.target.value});else drawPane()}})]),
      h('label',null,['기본 길이(분)',h('input',{type:'number',min:'5',step:'5',value:cfg('defaultDur'),onchange:(e)=>apply(()=>{S.settings.defaultDur=Math.max(5,Number(e.target.value)||60)})})]),
    ]));
    el.appendChild(h('p',{class:'hint'},['새 약속을 열 때 이 값으로 채워집니다. 날짜는 클릭한 날이 기본이에요.']));
    el.appendChild(h('div',{class:'sect'},['약속 색']));
    const sw=h('div',{class:'swatches'});
    ECOL.forEach((c,i)=>sw.appendChild(h('button',{class:i===cfg('eventColor')?'sel':'',style:'background:'+c,title:'약속 색 '+(i+1),'aria-pressed':i===cfg('eventColor')?'true':'false',onclick:()=>apply(()=>{S.settings.eventColor=i})})));
    el.appendChild(h('div',{class:'frow'},[sw]));
    el.appendChild(h('p',{class:'hint'},['월간·주간·일간의 모든 약속 블록에 한 가지 색으로 적용돼요. 루틴 팔레트와 겹치지 않는 색들이에요.']));
  }
  function backupTab(el){
    const countOf=s=>`페이지 ${s.pages.length}개 (루틴 ${s.pages.reduce((n,p)=>n+p.items.length,0)}개) · 약속 ${s.events.length}개`;
    let pending=null; // 검증을 통과한 가져오기 데이터
    const preview=h('div');
    const setReady=on=>{btnOver.disabled=!on;btnMerge.disabled=!on};
    const btnOver=h('button',{class:'danger',disabled:'',onclick:()=>{
      if(!pending)return;
      if(!confirm(`현재 데이터(${countOf(S)})를 모두 지우고 파일 내용으로 바꿀까요?`))return;
      S={pages:pending.pages,events:pending.events,settings:pending.settings};save();applyTheme();
      close();view.type='month';view.pageId=null;view.weekStart=weekStartOf(new Date());render();toast(`덮어썼어요: ${countOf(S)}`);
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
    el.appendChild(h('div',{class:'sect'},['내보내기']));
    el.appendChild(h('p',{class:'hint',style:'margin:0 0 8px'},[`현재 ${countOf(S)} · 설정을 JSON 파일로 내려받아요.`]));
    el.appendChild(h('button',{onclick:exportBackup},['JSON 내려받기']));
    el.appendChild(h('div',{class:'sect'},['가져오기']));
    el.appendChild(file);el.appendChild(preview);
    el.appendChild(h('div',{class:'acts',style:'justify-content:flex-start'},[btnOver,btnMerge]));
  }
  function googleTab(el){
    el.appendChild(h('div',{class:'sect'},['Google Calendar']));
    if(!googleClientId()){el.appendChild(h('p',{class:'hint'},['config.js 에 GOOGLE_CLIENT_ID 를 넣으면 연결할 수 있어요.']));return}
    // 로그인 유지: 켜져 있으면 로드 시 연결 플래그(토큰 아님)로 조용히 재연결. 끄면 새로고침 시 미연결
    el.appendChild(h('label',{class:'chk'},[h('input',{type:'checkbox',...(cfg('googleKeepLogin')?{checked:''}:{}),onchange:(e)=>{S.settings.googleKeepLogin=e.target.checked;save();drawPane()}}),'로그인 유지 — 새로고침해도 팝업 없이 자동으로 다시 연결']));
    const st=G.status;
    if(st==='on'){
      el.appendChild(h('div',{class:'frow'},[h('span',null,['연결됨: ',h('b',null,[G.email||'(이메일 확인 불가)'])])]));
      el.appendChild(h('p',{class:'hint'},[G.loading?'이벤트를 가져오는 중…':G.syncedAt?`마지막 조회 ${pad(G.syncedAt.getHours())}:${pad(G.syncedAt.getMinutes())} · 이벤트 ${G.events.length}개 (표시 중인 달 ±1개월)`:'월간·주간 뷰를 열면 이벤트를 가져와요.']));
      if(!G.canWrite){
        el.appendChild(h('div',{class:'cfbox'},[G.note||'일정 편집 권한이 없어요. 다시 연결해서 권한을 허용하세요.']));
        el.appendChild(h('div',{class:'frow'},[h('button',{class:'primary',onclick:googleConnect},['다시 연결 (권한 허용)'])]));
      }
      el.appendChild(h('div',{class:'frow'},[h('button',{onclick:()=>{G.anchor=null;render();drawPane()}},['새로고침']),h('button',{class:'danger',onclick:googleDisconnect},['연결 해제'])]));
      if(S.events.length){
        el.appendChild(h('div',{class:'sect'},['임시(로컬) 약속']));
        el.appendChild(h('p',{class:'hint'},[`미연결 상태에서 만든 로컬 약속 ${S.events.length}개가 남아 있어요. 구글 캘린더로 옮기면 로컬에서는 지워져요.`]));
        el.appendChild(h('div',{class:'frow'},[h('button',{class:'primary',...(G.canWrite?{}:{disabled:''}),onclick:migrateLocalEvents},[`로컬 약속 ${S.events.length}개 구글로 옮기기`])]));
      }
    }else if(st==='connecting'){
      el.appendChild(h('p',{class:'hint'},['연결 중… 팝업에서 계정을 선택하세요.']));
    }else{
      if(st==='expired')el.appendChild(h('div',{class:'cfbox'},[G.note||'토큰이 만료됐어요. 다시 연결하면 이어서 볼 수 있어요.']));
      el.appendChild(h('div',{class:'frow'},[h('button',{class:'primary',onclick:googleConnect},[st==='expired'?'다시 연결':'Google 연결'])]));
      if(G.error)el.appendChild(h('p',{class:'hint danger'},[G.error]));
    }
    el.appendChild(h('p',{class:'hint'},['연결하면 약속이 구글 캘린더(primary)에 바로 저장·수정·삭제되고, 표시 중인 달 ±1개월 범위를 읽어 월간·주간·일간에 보여줘요. 반복 일정은 이 일정만 편집돼요. 토큰은 메모리에만 두고 저장하지 않아요. 연결한 적이 있으면 새로고침할 때 화면 없이 조용히 다시 연결을 시도하고, 실패하면 미연결 상태로 두고 "다시 연결" 만 보여줘요.']));
    el.appendChild(h('p',{class:'hint'},['Chrome 이 서드파티 쿠키를 차단하면 조용한 재연결이 실패해요. 주소창 오른쪽의 쿠키(눈 모양) 아이콘 → 서드파티 쿠키 허용, 또는 chrome://settings/content/siteData 에서 이 사이트를 "쿠키 허용" 에 추가하세요. 팝업 차단도 같은 곳(chrome://settings/content/popups)에서 허용하면 돼요.']));
  }
  const md=h('div',{class:'md settings',role:'dialog','aria-label':'설정'},[
    h('div',{class:'shead'},[h('h3',null,['설정']),h('button',{class:'quiet',title:'닫기',onclick:()=>close()},['닫기'])]),
    h('div',{class:'sbody'},[tabs,pane])
  ]);
  drawTabs();drawPane();onGoogleChange=drawPane;
  ov.appendChild(md);document.body.appendChild(ov);
  const onKey=(e)=>{if(e.key==='Escape')close()};document.addEventListener('keydown',onKey);
  function close(){ov.remove();document.removeEventListener('keydown',onKey);onGoogleChange=null}
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
googleAutoReconnect(); // 이전 연결 기록이 있으면 조용히 재연결
// OS 테마가 바뀌면 다시 그려서 라벨 변형색 등이 새 팔레트를 따르게
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{if(!S.settings.theme||S.settings.theme==='system')render()});
})();
