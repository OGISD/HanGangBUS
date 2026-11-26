// 실제 표시 함수를 검사해 간조 필터가 원자료·증감·역류 위상에 영향을 주지 않도록 한다.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert.match(html,/<div class="tnote">인천 물때 약 4시간 뒤 추정 · 단위 cm<\/div>/,'카드에서 간조 시간 안내만 생략');
const source = html.slice(html.indexOf('function addMin('), html.indexOf('/* ----- 조류세기:'));
assert(source.startsWith('function addMin('));
const elements = {}, values = {}, phaseCalls = [];
const ctx = vm.createContext({
  Date: class extends Date { static now() { return Date.parse('2026-08-02T12:00:00+09:00'); } },
  CONFIG: {}, TIDE: {lagMin: 240}, flow: {}, tideBackupDocs: {},
  $: id => elements[id] || (elements[id] = {}),
  store: {get: (k, d) => values[k] || d, set: (k, v) => { values[k] = v; }},
  fmt: (n, d) => Number(n).toFixed(d), renderFlow() {},
  tidePhaseNow(list, lag) { phaseCalls.push({list, lag}); return 'ebb'; }
});
vm.runInContext(source, ctx);
const event = (hm, high, val) => ({ymd: '2026-08-02', hm, high, val});
const cases = [
  ['00:01', true, true, '04:01', false],
  ['03:59', false, false, '07:59', false],
  ['04:00', false, true, '08:00', false],
  ['18:00', false, true, '22:00', false],
  ['18:01', false, false, '22:01', false],
  ['20:00', false, false, '00:00', true],
  ['22:30', true, true, '02:30', true]
];
for (const [hm, high, visible, shifted, nextDay] of cases) {
  const rows = ctx.yeouidoTideEvents([event(hm, high, 100)]);
  assert.equal(rows.length, visible ? 1 : 0, hm + ' 표시 경계');
  if (visible) { assert.equal(rows[0].hm, shifted); assert.equal(rows[0].nextDay, nextDay); }
}
const rows = [event('00:01',true,500), event('03:59',false,120), event('04:00',false,100), event('06:00',true,700), event('18:00',false,200), event('18:01',false,190), event('22:30',true,750)];
const capture = [];
for (const sourceName of ['api','table']) {
  ctx.renderTide(rows.slice().reverse(),sourceName,true);
  const rendered = elements.yeouidoRows.innerHTML;
  capture.push(rendered);
  assert.deepEqual(Array.from(rendered.matchAll(/class="tt">(\d\d:\d\d)/g), m => m[1]), ['04:01','08:00','10:00','22:00','02:30']);
  assert(rendered.includes('익일') && !rendered.includes('07:59') && !rendered.includes('22:01'));
  assert.equal((rendered.match(/>간조</g)||[]).length,2);
  assert(rendered.includes('▼ -20'), '표시에서 제외된 직전 물때도 증감 계산에 유지');
  assert.equal((elements.incheonRows.innerHTML.match(/class="trow/g)||[]).length,rows.length);
  assert.equal(JSON.parse(values.hb_tidelast)['2026-08-02'],750);
  assert.equal(phaseCalls.at(-1).list.length,rows.length,'역류 위상에 모든 물때 전달');
  assert.equal(phaseCalls.at(-1).lag,240);
  assert(elements.yeouidoT.textContent.includes(sourceName==='table'?'연간표':'온라인'));
}
assert.equal(capture[0],capture[1],'온라인·연간표의 행 표시가 동일함');
ctx.renderTide([event('03:59',false,100)],'api',true);
assert(elements.yeouidoRows.innerHTML.includes('표시할 물때 정보 없음'));
let days = 0;
for (const year of [2026,2027]) {
  const doc = JSON.parse(fs.readFileSync(path.join(root,'data','tide-incheon-'+year+'.json'),'utf8'));
  for (const [ymd, raw] of Object.entries(doc.days)) {
    const original = raw.map(([hm,type,val])=>({ymd,hm,high:type==='high',val}));
    const shifted = ctx.yeouidoTideEvents(original);
    const expected = original.filter(e=>e.high||(+e.hm.slice(0,2)*60 + +e.hm.slice(3,5)+240>=480 && +e.hm.slice(0,2)*60 + +e.hm.slice(3,5)+240<=1320));
    assert.equal(shifted.length,expected.length,ymd+' 연간표 필터');
    assert.equal(shifted.filter(r=>r.event.high).length,original.filter(e=>e.high).length,ymd+' 만조 유지');
    days++;
  }
}
console.log('[통과] 여의도 간조 08~22시 경계·익일·시간순·증감·온라인/연간표·전체 '+days+'일 검사');
