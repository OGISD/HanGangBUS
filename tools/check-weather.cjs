// 실제 index.html의 기상 함수를 불러와 날짜 경계·특보 필터·장애 처리를 검증한다.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
assert(html.indexOf('id="weatherAlert"') < html.indexOf('id="weatherCard"') && html.indexOf('id="weatherCard"') < html.indexOf('id="damCard"'), '특보 알림 아래 기상예보가 첫 번째 카드임');
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
const matrix=ctx.weatherTable(compareSlots.slice(0,2),true,compareAt);
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
assert(!ctx.weatherTable(compareSlots.slice(2),false,compareAt).includes('wind-compass'),'이후 예보에는 나침반을 반복하지 않음');
assert(!html.includes('id="weatherRegion"'),'지역 선택 메뉴 대신 세 정보를 동시에 표시함');
assert(html.includes('<span class="weather-compass-hint">나침반 눌러 확대</span>'), '확대 안내는 카드 제목 옆 여백에 표시함');
assert(!matrix.includes('눌러 확대'), '예보 표에 확대 안내를 중복 표시하지 않음');
assert(!matrix.includes(' m/s</'),'표 안에 단위를 반복하지 않음');
const midnight = ctx.weatherGroups([sample('202612312300', 3), sample('202701010000', 4)], at('2026-12-31T23:10:00'));
assert.equal(midnight[0].peak.speed, 3);
assert.equal(midnight[1].peak.speed, 4);

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

async function main() {
  ctx.weatherState.warning = {data:ctx.weatherWarnings([{tmFc:'202611110200',t6:'o 없음',t7:'o 없음'}]),at:Date.now(),error:false};
  ctx.renderWeather();
  assert(elements.weatherWarning.textContent.includes('특보 없음'));
  ctx.weatherState.warning.error = true;
  ctx.renderWeather();
  assert(elements.weatherWarning.textContent.includes('확인 불가'));
  assert(!elements.weatherAlert.hidden);
  ctx.weatherState.warning.error = false;
  ctx.weatherState.warning.at = Date.now() - 6*60000;
  ctx.renderWeather();
  assert(!elements.weatherWarning.textContent.includes('특보 없음'), '만료된 특보 없음은 정상 상태로 표시하지 않음');
  ctx.weatherState.warning = {};
  let calls = 0;
  request = () => { calls++; throw new Error('연결 실패'); };
  assert.equal(await ctx.fetchWeatherPart('warning', true), false);
  assert.equal(calls, 1);
  assert(ctx.weatherState.warning.error);
  assert.equal(await ctx.fetchWeatherPart('warning', false), false);
  assert.equal(calls, 1, '실패 직후 자동 재요청을 제한함');
  ctx.weatherState.warning = {};
  request = () => api([{tmFc:'202611110200',t6:'o 없 음',t7:'o 없음'}]);
  assert.equal(await ctx.fetchWeatherPart('warning', true), true);
  assert(elements.weatherWarning.textContent.includes('특보 없음'));

  ctx.weatherState.warning.data=ctx.weatherWarnings([{tmFc:'202611110200',t6:'o 호우경보 : 서울(서울동남권)',t7:'o 없음'}]);
  ctx.renderWeather();
  assert(elements.weatherWarning.textContent.includes('서울동남권')&&elements.weatherWarning.textContent.includes('호우경보'));
  assert(!elements.weatherAlert.hidden && elements.weatherAlert.textContent.includes('서울동남권'), '선택하지 않은 잠실 권역 특보도 상단에 표시함');
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
  assert.equal((elements.weatherForecast.innerHTML.match(/class="wind-compass"/g)||[]).length,3,'나침반은 각 지역 현재 바람에만 표시함');
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
