// 실제 index.html의 기상 함수를 불러와 날짜 경계·특보 필터·장애 처리를 검증한다.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
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
assert(ctx.weatherTable(groups).includes('자료 없음'));
const midnight = ctx.weatherGroups([sample('202612312300', 3), sample('202701010000', 4)], at('2026-12-31T23:10:00'));
assert.equal(midnight[0].peak.speed, 3);
assert.equal(midnight[1].peak.speed, 4);

assert.equal(ctx.weatherWarningLines('o 없 음', false).length, 0);
assert.equal(ctx.weatherWarningLines('o 강풍주의보 : 서울(서울서남권, 서울서북권), 경기도', false)[0], '강풍주의보');
assert.equal(ctx.weatherWarningLines('o 호우경보 : 서울(서울동북권)', false).length, 0);
assert.equal(ctx.weatherWarningLines('o 한파주의보 : 서울, 경기도', false).length, 1);
assert.equal(ctx.weatherWarningLines('o 11월 12일 새벽 : 강풍 예비특보 : 서울(서울서남권)', true).length, 1);
assert.throws(() => ctx.weatherWarningLines('', false));
assert.throws(() => ctx.weatherWarningLines('응답 형식 변경', false));
assert.throws(() => ctx.weatherWarningLines('o 강풍주의보 : 서울(서울서남권 제외)', false));
assert.throws(() => ctx.weatherWarnings([]));

async function main() {
  ctx.weatherState.warning = {data:{active:[],pre:[],raw:'o 없 음',rawPre:'o 없음',stamp:'202611110200'},at:Date.now(),error:false};
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
  request = () => { throw new Error('숨긴 화면의 요청'); };
  ctx.document.hidden = true;
  assert.equal(await ctx.fetchWeather(true), false);
  console.log('[통과] 기상 날짜·풍향·4시간 집계·특보 지역·실패/복구·숨김 화면 검사');
}
main().catch(e => { console.error(e); process.exitCode = 1; });
