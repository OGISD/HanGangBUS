// 실제 앱 코드를 고정 시계와 지연 가능한 통신으로 실행한다. 실서비스 호출은 하지 않는다.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const script = html.split('<script>')[1].split('/* ----- 이벤트 ----- */')[0];
let now = Date.parse('2026-11-25T12:00:00+09:00');
const elements = new Map(), settings = new Map(), requests = [], bridgeMarkup = [];
let writesBlocked = false;
function el(id) {
  if (!elements.has(id)) elements.set(id, {
    style:{}, querySelector:s=>el(id+s), querySelectorAll:()=>[], addEventListener(){},
    removeAttribute(){}, insertAdjacentElement(){}, insertAdjacentHTML(_,h){bridgeMarkup.push(h);}
  });
  return elements.get(id);
}
const ctx = vm.createContext({
  Date:class extends Date {static now(){return now;}},
  document:{hidden:false,getElementById:el,querySelector:el,querySelectorAll:()=>[]},
  localStorage:{getItem:k=>settings.get(k)??null,setItem(k,v){if(writesBlocked)throw Error('저장 공간 부족');settings.set(k,String(v));}}
});
vm.runInContext(script,ctx);
const realFetchTimed=ctx.fetchTimed;
ctx.fetchTimed = (url,opt,ms,reader) => new Promise((resolve,reject)=>{
  requests.push({ok:data=>resolve(reader({ok:true,json:()=>Promise.resolve(data),text:()=>Promise.resolve(JSON.stringify(data))})),fail:()=>reject(Error('시험 오류'))});
});
ctx.G.apiKey='검사용';
const hrfco = {content:[{ymdhm:'202611251150',wl:'1.11',tototf:'200'},{ymdhm:'202611251140',wl:'1.01',tototf:'210'}]};
const finish = (batch,data) => batch.forEach(req=>req.ok(data));
async function check(){
  ctx.fetch=()=>new Promise(()=>{});ctx.setTimeout=setTimeout;ctx.clearTimeout=clearTimeout;
  await assert.rejects(realFetchTimed('test',{},5),/응답 시간 초과/,'취소 기능이 없는 브라우저도 시간 제한을 지킴');
  ctx.store.set('test',1); writesBlocked=true;ctx.store.set('test',2);
  assert.equal(ctx.store.get('test'),'2','쓰기만 차단된 경우에도 마지막 설정을 읽음');
  writesBlocked=false;ctx.store.set('test',3);assert.equal(ctx.store.get('test'),'3');
  assert.equal(ctx.hrfcoRows({content:[{wl:'0'},null,{ymdhm:'202611251150',wl:' '},{ymdhm:'202611251150',wl:'7m'},{ymdhm:'202611251150',wl:'0'}]},'wl','wl').length,1);

  // 구버전 설정에 견본 수위가 남아 있어도 최초 실측 전에는 시각·판정을 만들지 않는다.
  ctx.bridges[0].sampleWl=4.35;
  ctx.buildCards();
  assert.equal(bridgeMarkup.length,2);
  assert(bridgeMarkup.every(h=>!h.includes('dot bg-safe')&&!h.includes('value="4.35"')));
  const jamsu=el('.card[data-id="jamsu"]');
  assert(!jamsu.querySelector('[data-r=t]').textContent);

  const realTide=ctx.fetchTide,realCur=ctx.fetchTideCur;
  ctx.fetchTide=ctx.fetchTideCur=ctx.fetchWeather=()=>Promise.resolve(true);
  ctx.setupTimer=()=>{};
  const first=ctx.fetchAll();
  assert.equal(ctx.fetchAll(true),first,'수동 새로고침과 자동 조회가 진행 중인 핵심 요청을 공유');
  assert.equal(requests.length,4);
  const old=requests.splice(0);ctx.setMode('manual');
  jamsu.querySelector('[data-r=wl]').value='4.17';
  jamsu.querySelector('[data-r=apply]').onclick();
  const manual=jamsu.querySelector('[data-r=big]').innerHTML;
  old[0].ok(hrfco);old[1].fail();old[2].ok(hrfco);old[3].fail();await first;
  assert.equal(jamsu.querySelector('[data-r=wl]').value,'4.17');
  assert.equal(jamsu.querySelector('[data-r=big]').innerHTML,manual);
  assert.equal(ctx.flow.bfRows,null);assert(!el('msg').textContent);
  ctx.setMode('auto');
  const work=ctx.fetchAll(),live=requests.splice(0);assert.equal(live.length,4);
  live[3].fail();finish(live.slice(0,3),hrfco);await work;
  assert.equal(el('wlT').textContent,'호출 실패','다른 지점의 성공으로 실패가 덮이지 않음');
  const retry=ctx.fetchAll();const next=requests.splice(0);
  next[3].ok({content:hrfco.content.map(r=>({...r,ymdhm:r.ymdhm.replace('1150','1145')}))});
  finish(next.slice(0,3),hrfco);await retry;
  assert.match(el('wlT').textContent,/11:45/,'공용 시각은 더 오래된 관측 기준');
  now+=15*60000;ctx.refreshFlowAge();
  assert.match(el('flowBadge').innerHTML,/판정 보류/,'후속 수신 없이 정확히 30분 경계가 지나도 보류');

  ctx.fetchTide=realTide;ctx.fetchTideCur=realCur;
  const day='2026-11-25';
  const tide=ctx.fetchTide(true),cur=ctx.fetchTideCur();
  assert.equal(ctx.fetchTide(false),tide);assert.equal(ctx.fetchTideCur(),cur);
  assert.equal(requests.length,9,'동시 조회 시 물때 1건과 조류예측 8건만 보냄');
  const yesterday=requests.splice(0);
  now=Date.parse('2026-11-26T00:01:00+09:00');finish(yesterday,{});await Promise.all([cur,tide]);
  assert(!settings.has('hb_tidecur')&&!settings.has('hb_tide'));
  assert.equal(ctx.tideApiRetryAt,0,'전날의 늦은 오류가 오늘의 재시도를 막지 않음');
  ctx.flow.tide='flood';ctx.flow.tideDate=day;ctx.renderFlow();assert.equal(ctx.flow.tide,null);
  ctx.flow.tide='ebb';ctx.flow.tideDate=ctx.kstToday();ctx.tideFail();assert.equal(ctx.flow.tide,null);
  const doc=ctx.loadTideBackupDoc('2026');assert.equal(ctx.loadTideBackupDoc('2026'),doc);
  requests.shift().fail();await assert.rejects(doc);
  const again=ctx.loadTideBackupDoc('2026');
  requests.shift().ok({stationCode:'DT_0001',unit:'cm',year:2026,days:{}});assert.equal((await again).year,2026);
  assert(!requests.length);
  console.log('[통과] 최초 판정·수동 전환·중복 요청·실패 복구·30분 경계·자정 전환·저장 공간 부족 검사');
}
check().catch(e=>{console.error(e);process.exitCode=1;});
