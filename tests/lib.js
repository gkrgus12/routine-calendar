/* tests 공용 (tests/run.py 가 여는 t-*.html 에서 <script src="lib.js"> 로 로드)
   - loadApp(): ../app.js 원문을 받아 IIFE 래퍼 `(function(){ … })();` 를 벗기고 new Function 으로 평가한다. 끝에 붙인 return 이 그 스코프의
     eval 클로저를 돌려주므로 RC.<이름> 으로 내부 함수·상태를 읽고(RC.itemSegs(...), RC.S.pages) RC.<이름>=값 으로 바꿀 수 있다.
     프로덕션 코드(app.js)에는 테스트용 훅이 없다. 평가하면 app.js 의 부트(render, googleAutoReconnect)도 그대로 돈다
   - seed(state): 평가 전에 localStorage 의 routine-cal-v1 을 채운다
   - check(이름, 조건, 부가정보) 로 PASS/FAIL 을 쌓고, run(async fn) 이 끝나면 <pre id="RESULT"> 에 JSON 을 남긴다 (러너가 읽음)
   - 변형: 러너가 파일 첫 줄 <!-- variants: s=A s=B@600x800 --> 를 읽어 ?s= 로 연다. 페이지에서는 V 로 읽는다 */
'use strict';
const T={checks:[],log:[]};
const V=new URLSearchParams(location.search).get('s')||'';
// check/log 는 console 에도 남긴다 → 하네스가 끝나지 못하면 러너가 Chrome stderr 의 CONSOLE 줄로 어디까지 갔는지 보여준다
function check(name,ok,extra){const line=(ok?'PASS':'FAIL')+' '+name+(extra===undefined?'':' :: '+(typeof extra==='string'?extra:JSON.stringify(extra)));T.checks.push(line);console.log('[check] '+line)}
const near=(a,b,tol)=>Math.abs(a-b)<=(tol===undefined?1.5:tol);
function log(){const line=[...arguments].map(x=>typeof x==='string'?x:JSON.stringify(x)).join(' ');T.log.push(line);console.log('[log] '+line)}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
// 가상 시간(--virtual-time-budget)에서는 setTimeout 이 실시간 없이 즉시 지나가므로, 파일 읽기 같은 실제 I/O 를 기다릴 때는
// 조건을 폴링하되 매 회 로컬 서버에 XHR 을 한 번 보내 실시간이 흐르게 한다(네트워크 요청 중에는 가상 시간도 멈춘다)
async function waitFor(fn,timeout){
  const until=Date.now()+(timeout||4000);
  for(let i=0;;i++){
    if(fn())return true;
    if(Date.now()>until)return false;
    await new Promise(r=>{const x=new XMLHttpRequest();x.open('GET','lib.js?tick='+i);x.onloadend=r;x.send()});
    await sleep(10);
  }
}
const btn=txt=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===txt);
const toastText=()=>{const t=document.querySelector('.toast');return t?t.textContent:''};
const text=sel=>{const el=document.querySelector(sel);return el?el.innerText.replace(/\s+/g,' ').trim():''};
const seed=state=>localStorage.setItem('routine-cal-v1',JSON.stringify(state));
let RC=null;
function loadApp(){
  return new Promise((res,rej)=>{
    const x=new XMLHttpRequest();x.open('GET','../app.js');
    x.onload=()=>{try{
      const m=/^\(function\(\)\{([\s\S]*)\}\)\(\);\s*$/.exec(x.responseText);
      if(!m)throw new Error('app.js 의 IIFE 래퍼 (function(){ … })(); 를 찾지 못했어요');
      const api=new Function(m[1]+'\nreturn {get:function(n){return eval(n)},set:function(n,v){return eval(n+"=v")}};')();
      RC=new Proxy({},{
        get:(_,k)=>(typeof k!=='string'||k==='then')?undefined:api.get(k), // 'then' 은 await 가 thenable 검사로 읽으므로 제외
        set:(_,k,v)=>{api.set(String(k),v);return true}
      });
      res(RC);
    }catch(e){rej(e)}};
    x.onerror=()=>rej(new Error('app.js 를 불러오지 못했어요'));
    x.send();
  });
}
function finish(extra){
  const out=Object.assign({test:document.title,variant:V,checks:T.checks},extra||{},{log:T.log});
  const pre=document.createElement('pre');pre.id='RESULT';pre.textContent=JSON.stringify(out,null,1);document.body.appendChild(pre);
}
async function run(fn){try{await fn()}catch(e){T.checks.push('EXCEPTION '+(e&&e.stack||e))}finish()}
window.addEventListener('error',e=>log('window.error',e.message));
try{localStorage.clear()}catch(e){}
