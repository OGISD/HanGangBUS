// 실제 index.html의 기상 함수를 불러와 날짜 경계·특보 필터·장애 처리를 검증한다.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
assert(html.indexOf('id="weatherCard"') < html.indexOf('id="damCard"'));
for(const id of ['weatherAlert','weatherWarning','weatherMore','weatherForecastTime']) assert(!html.includes('id="'+id+'"'),id+' 제거');
assert.equal((html.match(/id="weatherCard"/g)||[]).length,1,'기상예보 카드를 중복 생성하지 않음');
const block = html.slice(html.indexOf('var WEATHER='), html.indexOf('/* ----- 모드 ----- */'));
assert(block.startsWith('var WEATHER='), '기상 구현을 찾지 못했습니다');
const elements = {};
const values = {};
let request = () => { throw new Error('의도하지 않은 요청'); };
const toMs = s => Date.UTC(+s.slice(0,4), +s.slice(4,6)-1, +s.slice(6,8), +s.slice(8,10), +s.slice(10,12));
const ctx = vm.createContext({
  CONFIG: {TIDE_KEY: '검사용'}, Date, Promise, document: {hidden: false},
  $: id => elements[id] || (elements[id] = {}),
  store: {get: (k,d) => values[k] || d, set: (k,v) => { values[k] = v; }},
  ymdhmToMs: toMs,
  ymdhmAgeMin: s => (Date.now() - (toMs(s) - 9*3600000)) / 60000,
  ymdhmToStr: s => s.slice(8,10) + ':' + s.slice(10,12),
  STALE_MIN:30, ageStr:m=>m<1?'방금':m+'분 전',
  fmt: (n,d) => Number(n).toFixed(d),
  fetchTimed: (...args) => Promise.resolve().then(() => request(...args))
});
vm.runInContext(block, ctx);
const at = s => Date.parse(s + '+09:00');
const sample = (stamp, speed, dir = 90) => ({stamp, speed, dir});
const api = items => JSON.stringify({response: {header: {resultCode: '00'}, body: {items: {item: items}}}});

assert.equal(ctx.weatherBase('forecast', at('2026-11-11T01:00:00')), '202611102300');
assert.equal(ctx.weatherBase('forecast', at('2026-11-11T02:10:00')), '202611102300');
assert.equal(ctx.weatherBase('forecast', at('2026-11-11T02:20:00')), '202611110200');
assert.equal(ctx.weatherBase('obs', at('2027-01-01T00:10:00')), '202612312300');
assert.equal(ctx.weatherNumber(null), null);
assert.equal(ctx.weatherNumber(''), null);
assert.equal(ctx.weatherNumber('-998'), null);
assert.equal(ctx.weatherWind(360, 2), '북풍');
assert.equal(ctx.weatherWind(0, 0), '무풍');
assert.equal(ctx.weatherWind(129, 2.2), '남동풍');
assert.equal(ctx.weatherCompassAngle(202.5, 3), 202.5, '남남서풍은 불어오는 쪽을 표시함');
assert.equal(ctx.weatherCompassAngle(360, 3), 0);
assert.equal(ctx.weatherCompassAngle(null, 3), null);
assert.equal(ctx.weatherCompassAngle(0, 0), null);
assert.equal(ctx.weatherCompassAngle(361, 3), null);
[[0,180],[90,270],[180,0],[270,90],[360,180],[202.5,22.5],[129,309]].forEach(([from,toward]) => {
  [false,true].forEach(large => assert(ctx.weatherCompassSvg(from,large).includes('rotate('+toward+' 50 50)'), '작은/확대 화살표는 바람의 이동 방향: '+from));
});
assert.equal(ctx.weatherWind(270,3), '서풍', '화살표를 바꿔도 풍향 이름은 불어오는 방위 유지');
assert(ctx.weatherWindMarkup(90,3,'현재 바람').includes('화살표는 바람이 향하는 방향'));
assert(html.includes('이름·풍향 각도는 <b>불어오는 방위</b>'), '확대창에서 풍향 각도와 화살표의 의미를 구분함');
assert(ctx.weatherCompassSvg(202.5, true).includes('>SSW</text>'));
assert(ctx.weatherWindMarkup(129, 2.2, '현재 바람').includes('data-wind-deg="129"'), '16방위 이름과 별개로 원래 각도를 유지함');
assert(!ctx.weatherWindMarkup(0, 0, '현재 바람').includes('wind-needle'));
assert(!ctx.weatherWindMarkup(null, 2, '현재 바람').includes('<button'));
assert.throws(() => ctx.weatherObservation([{category:'WSD', obsrValue:'', baseDate:'20261111', baseTime:'1100'}]));
assert.throws(() => ctx.weatherItems('{"response":{"header":{"resultCode":"03"}}}'));
assert.equal(ctx.weatherItems(api({category:'WSD'})).length, 1);

const series = ctx.weatherSeries([
  {category:'WSD', fcstDate:'20261111', fcstTime:'1200', fcstValue:'0'},
  {category:'VEC', fcstDate:'20261111', fcstTime:'1200', fcstValue:'0'},
  {category:'WSD', fcstDate:'20261111', fcstTime:'1300', fcstValue:''}
]);
assert.equal(series.length, 1);
assert.equal(series[0].speed, 0);
const groups = ctx.weatherGroups([
  sample('202611111200', 2), sample('202611111300', 7, 180),
  sample('202611111400', 4), sample('202611111500', 1),
  sample('202611112000', 3)
], at('2026-11-11T12:05:00'));
assert.equal(groups[0].peak.speed, 7);
assert.equal(groups[0].peak.dir, 180);
assert.equal(groups[0].partial, false);
assert.equal(groups[0].remaining, true);
assert.equal(groups[1].peak, null, '예보가 통째로 빠진 구간을 숨기지 않음');
assert.equal(groups[2].partial, true);
const compareAt=at('2026-11-11T12:05:00');
const compareSlots=ctx.weatherGroups([],compareAt);
const compareRows=[sample('202611111200',2),sample('202611111300',7),sample('202611111400',4),sample('202611111500',1)];
for(const id of ['magok','yeouido'])ctx.weatherRegionState(id).forecast={data:compareRows,base:'202611111100'};
ctx.weatherRegionState('jamsil').forecast={data:[sample('202611111600',9)],base:'202611111400'};
function rowFor(id,markup=elements.weatherForecast.innerHTML){return markup.match(new RegExp('<tr data-weather-region="'+id+'">([\\s\\S]*?)</tr>'))[1];}
function currentFor(id){return rowFor(id).match(/<td>([\s\S]*?)<\/td>/)[1];}
const matrix=ctx.weatherTable(compareSlots.slice(0,2),compareAt);
assert.equal((matrix.match(/data-weather-region=/g)||[]).length,3,'한 표에 세 지역 행을 표시함');
assert(rowFor('magok',matrix).includes('>7.0</b>'));
const jamsilCells=Array.from(rowFor('jamsil',matrix).matchAll(/<td>([\s\S]*?)<\/td>/g),m=>m[1]);
assert(jamsilCells[1].includes('자료 없음')&&!jamsilCells[1].includes('9.0'),'현재 구간이 빠져도 다음 구간을 앞 열에 당기지 않음');
assert(jamsilCells[2].includes('9.0'));
assert.equal(ctx.weatherComparisonSlots(compareAt)[0].start,compareSlots[0].start,'한 지역에 남은 구간 예보가 있으면 공통 첫 열로 유지함');
for(const id of ['magok','yeouido'])ctx.weatherRegionState(id).forecast.data=[sample('202611111600',9)];
assert.equal(ctx.weatherComparisonSlots(compareAt)[0].start,compareSlots[1].start,'세 지역 모두 현재 구간이 없으면 함께 다음 구간부터 표시함');
ctx.weatherRegionState('magok').forecast.data=compareRows;
ctx.weatherRegionState('yeouido').forecast.data=compareRows;
assert(matrix.includes('남은 예보'));
assert(matrix.includes('data-wind-context="잠실 11/11 16–20시 예보"'));
assert(matrix.includes('data-wind-context="마곡 11/11 12–16시 예보"'),'기본 예보의 확대 문맥에 지역과 구간을 포함함');
const unified=ctx.weatherWindMarkup(202.5,3.2,'마곡 11/11 12–16시 예보');
assert(unified.indexOf('weather-speed')<unified.indexOf('weather-wind-name'),'윗줄 나침반·풍속, 아랫줄 풍향 순서를 유지함');
assert(unified.includes('data-wind-deg="202.5"')&&unified.includes('rotate(22.5 50 50)'),'예보 화살표도 원래 풍향과 이동 방향을 구분함');
assert(!ctx.weatherForecastCell({data:[]},{peak:sample('202611111200',0,0)},'예보').includes('<button'),'무풍 예보에는 잘못된 방향 버튼을 만들지 않음');
assert(!ctx.weatherForecastCell({error:true},{peak:sample('202611111200',2)},'예보').includes('wind-compass'),'실패한 예보에는 남아 있는 값의 나침반을 표시하지 않음');
assert(!html.includes('id="weatherRegion"'),'지역 선택 메뉴 대신 세 정보를 동시에 표시함');
assert(html.includes('<span class="weather-compass-hint">나침반 눌러 확대</span>'), '확대 안내는 카드 제목 옆 여백에 표시함');
assert(!matrix.includes('눌러 확대'), '예보 표에 확대 안내를 중복 표시하지 않음');
assert.equal((matrix.match(/ m\/s<\//g)||[]).length,1,'표 안의 단위는 한 번만 표시');
const midnight = ctx.weatherGroups([sample('202612312300', 3), sample('202701010000', 4)], at('2026-12-31T23:10:00'));
assert.equal(midnight[0].peak.speed, 3);
assert.equal(midnight[1].peak.speed, 4);
assert.equal(ctx.weatherForecastContext(ctx.weatherRegionInfo('magok'),midnight[0]),'마곡 12/31 20–24시 예보');
assert.equal(ctx.weatherForecastContext(ctx.weatherRegionInfo('jamsil'),midnight[1]),'잠실 01/01 00–04시 예보');

assert.equal(ctx.weatherWarningLines('o 없 음', false).length, 0);
assert.equal(ctx.weatherWarningLines('o 강풍주의보 : 서울(서울서남권, 서울서북권), 경기도', false)[0], '강풍주의보');
assert.equal(ctx.weatherWarningLines('o 호우경보 : 서울(서울동북권)', false).length, 0);
assert.equal(ctx.weatherWarningLines('o 한파주의보 : 서울, 경기도', false).length, 1);
assert.equal(ctx.weatherWarningLines('o 호우경보 : 서울(서울동남권)', false,'se')[0], '호우경보');
assert.equal(ctx.weatherWarningLines('o 호우경보 : 서울(서울동남권)', false,'sw').length, 0);
assert.equal(ctx.weatherWarningLines('o 호우경보 : 서울(송파구)', false,'se').length, 1);
assert.equal(ctx.weatherWarningLines('o 호우경보 : 부산(강서구)', false,'sw').length, 0, '동명이인 자치구를 서울로 오인하지 않음');
assert.equal(ctx.weatherWarningLines('o 호우경보 : 울산(동구), 서울(서울동북권)', false,'se').length, 0);
assert.equal(ctx.weatherWarningLines('o 호우경보 : 서울(전역)', false,'se').length, 1);
assert.equal(ctx.weatherWarningLines('o 11월 12일 새벽 : 강풍 예비특보 : 서울(서울서남권)', true).length, 1);
assert.throws(() => ctx.weatherWarningLines('', false));
assert.throws(() => ctx.weatherWarningLines('응답 형식 변경', false));
assert.throws(() => ctx.weatherWarningLines('o 강풍주의보 : 서울(서울서남권 제외)', false));
assert.throws(() => ctx.weatherWarnings([]));

// 2026-11-17 20:30 실제 응답: 예비특보 제목과 시간·구역이 서로 다른 줄에 있다.
const nov17Warning = {tmFc:202611172030,
  t6:'o 풍랑주의보 : 남해서부서쪽먼바다, 제주도남쪽바깥먼바다, 제주도남서쪽안쪽먼바다',
  t7:'(1) 풍랑 예비특보\r\no 11월 18일 새벽(00시~06시) : 서해남부남쪽안쪽먼바다, 서해남부남쪽바깥먼바다, 남해동부바깥먼바다, 제주도남동쪽안쪽먼바다\r\no 11월 18일 오전(06시~12시) : 서해남부북쪽바깥먼바다, 서해중부안쪽먼바다, 서해중부바깥먼바다, 제주도앞바다(제주도동부앞바다, 제주도서부앞바다)\r\no 11월 18일 오후(12시~18시) : 동해남부북쪽안쪽먼바다, 동해남부북쪽바깥먼바다, 동해중부안쪽먼바다, 동해중부바깥먼바다, 서해남부앞바다, 서해남부북쪽안쪽먼바다, 서해중부앞바다, 남해동부안쪽먼바다, 남해서부동쪽먼바다, 제주도앞바다(제주도북부앞바다)\r\no 11월 18일 밤(18시~24시) : 동해남부남쪽안쪽먼바다, 동해남부남쪽바깥먼바다, 동해중부앞바다\r\n(2) 강풍 예비특보\r\no 11월 18일 오전(06시~12시) : 서해5도(백령도.대청도), 전북자치도(군산어청도)\r\no 11월 18일 오후(12시~18시) : 서해5도(연평도.우도), 강원도(태백, 동해산지, 삼척산지, 속초산지, 고성산지, 양양산지, 평창산지, 강릉산지, 정선평지, 정선산지, 홍천산지, 인제산지), 충청남도(태안, 당진, 서산, 서천, 보령(도서제외), 보령도서, 홍성서부), 전라남도(여수, 영암, 함평, 목포, 신안(흑산면제외), 진도, 흑산도.홍도, 거문도.초도, 영광(낙월면 제외), 영광낙월면, 고흥북부, 고흥남부, 해남북부, 해남남부, 완도(여서도 제외), 무안북부, 무안남부), 전북자치도(고창, 부안위도면, 군산(옥도면 제외), 군산옥도면(어청도 제외)), 경상북도(영양산지, 봉화산지, 울진산지), 제주도(서귀포시남부 제외), 인천(옹진, 인천영종), 울릉도.독도'
};
const parsedNov17=ctx.weatherWarnings([nov17Warning]);
const mixedWarning='o 풍랑주의보 : 서해중부안쪽먼바다\r\no 풍랑주의보 : 제주도앞바다\r\no 호우주의보 : 서울, <가상지역>';
const mixedPre='(1) 풍랑 예비특보\r\n  o 11월 18일 오전 : 인천·경기북부앞바다\r\no 11월 18일 밤 : 제주도앞바다\r\n(2) 강풍 예비특보\r\no 11월 18일 오후 : 부산(강서구)';
const highlighted=ctx.weatherWarnings([{...nov17Warning,t6:mixedWarning,t7:mixedPre}]);
assert.equal(highlighted.markup,'<strong>o 풍랑주의보</strong> : <strong>서해중부안쪽먼바다</strong>\r\no 풍랑주의보 : 제주도앞바다\r\n<strong>o 호우주의보</strong> : <strong>서울</strong>, &lt;가상지역&gt;');
assert.equal(highlighted.markupPre,'<strong>(1) 풍랑 예비특보</strong>\r\n  <strong>o 11월 18일 오전</strong> : <strong>인천·경기북부앞바다</strong>\r\no 11월 18일 밤 : 제주도앞바다\r\n(2) 강풍 예비특보\r\no 11월 18일 오후 : 부산(강서구)');
assert.equal(highlighted.raw,mixedWarning,'전국 원문 보존');
for (const area of ['sw','se']) {
  assert.equal(parsedNov17.areas[area].active.length,0);
  assert.equal(parsedNov17.areas[area].pre.length,0,'타 지역 예비특보를 서울로 오인하거나 전체 실패로 처리하지 않음');
}
assert.equal(parsedNov17.rawPre,nov17Warning.t7,'특보 상세에는 API 원문을 보존함');
const groupedPre='(1) 강풍 예비특보\no 11월 18일 오전(06시~12시) : 서울(서울서남권), 부산(강서구)\no 11월 18일 오후(12시~18시) : 서울(영등포구)\n(2) 대설 예비특보\no 11월 18일 밤(18시~24시) : 서울(서울동남권)';
assert.deepEqual(Array.from(ctx.weatherWarningLines(groupedPre,true,'sw')),['강풍 예비특보'],'그룹 제목을 시간·구역 행에 적용하고 중복 제거');
assert.deepEqual(Array.from(ctx.weatherWarningLines(groupedPre,true,'se')),['대설 예비특보'],'두 번째 그룹의 특보 종류를 이전 그룹과 섞지 않음');
assert.equal(ctx.weatherWarningLines('(1) 강풍 예비특보\n○ 11월 18일 오후 ： 서울(전역)',true,'se')[0],'강풍 예비특보');
for (const malformed of [
  '(1) 강풍 예비특보',
  '(1) 강풍 예비특보\n(2) 대설 예비특보\no 11월 18일 오후 : 서울',
  '(1) 강풍 예비특보\no 11월 18일 오후 : 서울\n(2) 대설 예비특보',
  '(1) 알 수 없는 예비특보\no 11월 18일 오후 : 서울',
  '(1) 강풍 예비특보\no 알 수 없는 시간 : 서울',
  '(1) 강풍 예비특보\no 11월 18일 오후 :',
  '(1) 강풍 예비특보\no 11월 18일 오후 : 서울(서울서남권 제외)',
  'o 11월 18일 오후 : 서울'
]) assert.throws(()=>ctx.weatherWarningLines(malformed,true),'해석 불가·제목 누락·내용 누락·제외 구역을 특보 없음으로 처리하지 않음');
assert.throws(()=>ctx.weatherWarningLines(groupedPre,false),'그룹 예비특보 해석을 일반 특보에 잘못 적용하지 않음');

async function main() {
  ctx.weatherState.warning = {data:ctx.weatherWarnings([{tmFc:'202611110200',t6:'o 없음',t7:'o 없음'}]),at:Date.now(),error:false};
  ctx.renderWeather();
  assert.equal(elements.weatherWarningSummary.textContent,'기상특보 상세');
  ctx.weatherState.warning.error = true;
  ctx.renderWeather();
  assert(elements.weatherWarningSummary.textContent.includes('확인 불가'));
  ctx.weatherState.warning.error = false;
  ctx.weatherState.warning.at = Date.now() - 6*60000;
  ctx.renderWeather();
  assert(elements.weatherWarningText.textContent.includes('확인 중'));
  ctx.weatherState.warning = {};
  let calls = 0;
  request = () => { calls++; throw new Error('연결 실패'); };
  assert.equal(await ctx.fetchWeatherPart('warning', true), false);
  assert.equal(calls, 1);
  assert(ctx.weatherState.warning.error);
  assert.equal(await ctx.fetchWeatherPart('warning', false), false);
  assert.equal(calls, 1, '실패 직후 자동 재요청을 제한함');
  ctx.weatherState.warning = {};
  request = () => api([nov17Warning]);
  assert.equal(await ctx.fetchWeatherPart('warning', true), true);
  assert.equal(elements.weatherWarningSummary.textContent,'⚠ 기상특보 상세 · 인천 앞바다 영향 가능');
  assert(elements.weatherWarningText.innerHTML.includes('인천 앞바다 주변(서해중부) · 풍랑 예비특보'));
  assert(!JSON.parse(values.hb_weather_v2).warning.data.markup,'원문과 강조용 HTML을 중복 저장하지 않음');
  ctx.restoreWeather();
  assert(ctx.weatherState.warning.data.markupPre.includes('<strong>'),'저장된 원문으로 강조를 복원함');
  request = () => api([{...nov17Warning,t7:'(1) 강풍 예비특보'}]);
  assert.equal(await ctx.fetchWeatherPart('warning',true),false);
  assert(elements.weatherWarningSummary.textContent.includes('확인 불가'),'불완전한 응답은 이전 특보 없음으로 표시하지 않음');
  request = () => api([{...nov17Warning,t7:groupedPre}]);
  assert.equal(await ctx.fetchWeatherPart('warning',true),true);
  assert(!ctx.weatherState.warning.error&&elements.weatherWarningText.innerHTML.includes('한강 · 강풍 예비특보 · 대설 예비특보'));

  const marine = {tmFc:'202611250500',t6:'o 호우경보 : 서울(서울동남권)\no 풍랑주의보 : 인천·경기남부앞바다중북부앞평수구역',t7:'(1) 풍랑 예비특보\no 11월 25일 밤(18시~24시) : 인천.경기북부앞바다'};
  ctx.weatherState.warning.data=ctx.weatherWarnings([marine]);
  ctx.renderWeather();
  assert.equal(elements.weatherWarningSummary.textContent,'⚠ 기상특보 상세 · 한강·인천 앞바다 영향 가능');
  assert.equal(elements.weatherWarningSummary.className,'weather-highlight');
  assert(elements.weatherWarningText.innerHTML.includes('한강 · 호우경보'));
  assert(elements.weatherWarningText.innerHTML.includes('인천 앞바다 · 풍랑주의보 · 풍랑 예비특보'));
  assert.equal(ctx.weatherWarningLines('o 풍랑주의보 : 서해중부안쪽먼바다',false,'incheon').length,0);
  assert.equal(ctx.weatherWarningLines('o 풍랑주의보 : 인천,경기북부앞바다',false,'incheon').length,1);
  ctx.weatherState.warning.data=ctx.weatherWarnings([{...marine,t6:'o 강풍주의보 : 경기도(파주, 김포)\no 풍랑주의보 : 서해중부안쪽먼바다',t7:'o 없음'}]);ctx.renderWeather();
  assert(elements.weatherWarningText.innerHTML.includes('한강 주변(김포·고양·하남) · 강풍주의보'));
  assert(elements.weatherWarningText.innerHTML.includes('인천 앞바다 주변(서해중부) · 풍랑주의보'));
  assert.equal(ctx.weatherWarningLines('o 풍랑주의보 : 서해중부바깥먼바다',false,'seaNear').length,0);
  ctx.weatherState.warning.at=Date.now()-6*60000;ctx.renderWeather();
  assert.equal(elements.weatherWarningSummary.className,'','오래된 특보는 강조하지 않음');
  const urls=[];
  function responseFor(url) {
    const u=new URL(url),x=Number(u.searchParams.get('nx')),stamp=ctx.weatherStamp(Date.now());
    if(url.includes('getPwnStatus'))return api([{tmFc:stamp,t6:'o 없음',t7:'o 없음'}]);
    if(url.includes('getUltraSrtNcst'))return api(['WSD','VEC'].map(category=>({category,obsrValue:category==='WSD'?String(x/10):'90',baseDate:stamp.slice(0,8),baseTime:stamp.slice(8,10)+'00'})));
    return api(['WSD','VEC'].map(category=>({category,fcstValue:category==='WSD'?String(x/10):'90',fcstDate:stamp.slice(0,8),fcstTime:stamp.slice(8,10)+'00',baseDate:u.searchParams.get('base_date'),baseTime:u.searchParams.get('base_time')})));
  }
  ctx.weatherState={regions:{},warning:{}};
  request=url=>{urls.push(url);return responseFor(url);};
  await ctx.fetchWeather();
  for(const id of ['magok','yeouido','jamsil']) {
    const r=ctx.weatherRegionInfo(id),s=ctx.weatherRegionState(id);
    assert.equal(s.obs.data.speed,r.nx/10);
    assert(currentFor(id).includes(r.name+' 현재 바람'));
    assert(urls.some(u=>u.includes('getUltraSrtNcst')&&u.includes('&nx='+r.nx+'&ny='+r.ny)));
    assert(urls.some(u=>u.includes('getVilageFcst')&&u.includes('&nx='+r.nx+'&ny='+r.ny)));
  }
  assert.equal(urls.filter(u=>u.includes('getPwnStatus')).length,1,'특보 요청은 세 지역이 공유함');
  const count=urls.length;
  assert.equal(urls.length,7,'세 지역 현재·예보 여섯 건과 공통 특보 한 건만 요청함');
  assert.equal((elements.weatherForecast.innerHTML.match(/data-wind-context="[^"]* 현재 바람"/g)||[]).length,3,'각 지역 현재 나침반의 문맥을 구분함');
  assert((elements.weatherForecast.innerHTML.match(/class="wind-compass"/g)||[]).length>3,'기본 표의 예보에도 나침반을 표시함');
  assert.match(elements.weatherUpdated.textContent,/^갱신 \d\d:\d\d · 방금$/);
  const currentAt=Date.now();
  for(const r of ctx.WEATHER.regions) {
    const s=ctx.weatherRegionState(r.id);s.obs.at=s.forecast.at=currentAt-31*60000;
  }
  ctx.weatherState.warning.at=currentAt;
  ctx.renderWeather();
  assert.match(elements.weatherUpdated.textContent,/31분 전/,'특보 수신 시각은 바람 갱신 시각에 미포함');
  assert.equal(elements.weatherUpdated.className,'t stale');
  for(const r of ctx.WEATHER.regions) {const s=ctx.weatherRegionState(r.id);s.obs.at=s.forecast.at=currentAt;}
  await ctx.fetchWeather();
  assert.equal(urls.length,count,'같은 발표 자료를 다시 요청하지 않음');
  ctx.weatherState={regions:{},warning:{}};
  ctx.restoreWeather();
  assert.equal(ctx.weatherRegionState('magok').obs.data.speed,5.7);
  assert.equal(ctx.weatherRegionState('jamsil').obs.data.speed,6.2);
  assert(!values.hb_weather_v1,'지역 미분리 구형 캐시에 저장하지 않음');

  ctx.weatherState.regions={};
  const pending={};
  request=url=>url.includes('getUltraSrtNcst')?new Promise(resolve=>{pending[new URL(url).searchParams.get('nx')]=()=>resolve(responseFor(url));}):responseFor(url);
  const magokWork=ctx.fetchWeatherPart('obs',false,'magok');
  const jamsilWork=ctx.fetchWeatherPart('obs',false,'jamsil');
  await Promise.resolve();await Promise.resolve();
  pending['62']();await jamsilWork;
  pending['57']();await magokWork;
  assert(currentFor('jamsil').includes('잠실 현재 바람')&&currentFor('jamsil').includes('6.2'));
  assert(currentFor('magok').includes('마곡 현재 바람')&&currentFor('magok').includes('5.7'),'늦은 응답이 해당 지역 행만 갱신함');
  request=()=>{throw new Error('마곡 연결 실패');};
  assert.equal(await ctx.fetchWeatherPart('obs',true,'magok'),false);
  assert(ctx.weatherRegionState('magok').obs.error);
  assert(!ctx.weatherRegionState('jamsil').obs.error);
  assert(currentFor('magok').includes('조회 실패')&&!currentFor('magok').includes('마곡 현재 바람'));
  assert(currentFor('jamsil').includes('잠실 현재 바람'),'한 지역의 실패가 다른 행에 영향을 주지 않음');
  const oldObservation=ctx.weatherRegionState('jamsil').obs.data;
  ctx.weatherRegionState('jamsil').obs.data={stamp:ctx.weatherStamp(Date.now()-121*60000),dir:90,speed:3};
  ctx.renderWeather();assert(currentFor('jamsil').includes('오래된 자료')&&!currentFor('jamsil').includes('wind-compass'),'오래된 현재 자료는 바람처럼 표시하지 않음');
  ctx.weatherRegionState('jamsil').obs.data=oldObservation;
  request = () => { throw new Error('숨긴 화면의 요청'); };
  ctx.document.hidden = true;
  assert.equal(await ctx.fetchWeather(true), false);
  console.log('[통과] 기상 날짜·풍향·4시간 집계·3지역 격자·특보 권역·지역 캐시·응답 역전·실패 격리·숨김 화면 검사');
}
main().catch(e => { console.error(e); process.exitCode = 1; });
