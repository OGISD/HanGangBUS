# AGENTS.md — 한강 교량 통과높이 모니터

이 파일은 Codex가 이 프로젝트의 맥락을 이어받기 위한 메모입니다.
(설명·문서는 한국어로 작성합니다.)

## ⚙️ 작업 규칙 (항상 지킬 것)
- **작업을 완료할 때마다 이 AGENTS.md를 확인하고 그때그때 갱신한다.** 바뀐 배포 상태·확정값·
  아키텍처 결정·"다음 할 일" 체크박스를 최신으로 유지. (예전 설명이 틀려졌으면 고치고, 끝낸
  할 일은 `[x]`로 표시·완료일 기록.) 문서 갱신도 같은 커밋/푸시에 포함한다.

## 프로젝트 한 줄 요약
**한강버스 운항 도우미** (앱 표시 이름, 2026-07-06 변경. 제작자 표기 "오동근 with 클로드").
한강 교량(잠수교·행주대교) 통과높이 + 팔당댐 방류량 + 여의도·인천 물때/출몰시각을 실시간으로
보여주는 단일 파일 모바일 웹앱. 소수 내부 공유용.

## 현재 배포 상태 (이미 라이브)
- **공개 주소**: https://ogisd.github.io/HanGangBUS/
- **저장소**: https://github.com/OGISD/HanGangBUS (GitHub 계정 OGISD)
- **호스팅**: GitHub Pages (`main` 브랜치).
- **로컬 폴더가 git 저장소임.** (2026-06-22 연결 완료) `origin` = OGISD/HanGangBUS,
  `main` 추적. 수정 반영은 `git add -A && git commit && git push` → Pages 자동 재배포.
  (예전 "웹에서 전체 복붙" 방식은 더 이상 안 씀.)
  - 인증: Git Credential Manager(system helper `manager`)가 처리. push 시 필요하면 로그인 창이 뜸.
  - 커밋 신원: user.name=OGISD, user.email=buwake58@naver.com (global).
  - 줄바꿈은 `.gitattributes`로 LF 정규화. `hangang-bridge-monitor.zip`·`.Codex/`는 `.gitignore`.
- 자동 모드 실시간 작동 검증 완료(2026-06 기준).

## 핵심 공식
```
통과높이(passHeight) = 기준높이(base) − 현재 수위(wl) + 오차보정(offset)
기준높이(base)       = 다리 하단 형하 표고(EL.m) − 수위계 영점표고 gdt(EL.m)
```
- `wl`은 한강홍수통제소(HRFCO) 수위관측소의 실시간 수위(영점 기준 값, 음수 가능).
- `offset`(오차보정): 계산값과 실제 여유의 미세 차이를 메우는 보정. 통과높이에 더함(설정에서 교량별 조정).

## 교량별 확정값 (2026-07-06 직원 피드백 반영)
| 항목 | 잠수교 | 행주대교 |
|---|---|---|
| 관측소 코드(obscd) | 1018680 | 1019630 |
| 기준높이 base | 11.76 | 13.40 |
| 오차보정 offset | +0.02 | 0 |
| 운항금지선 noGo | 7.3 | 11.2 |
| 운항경고선 warn | 7.8 | 11.2(=noGo → 경고 없음) |
| 저수위경고선 lowWarn | 9.1(통과높이 초과 시 저수심 경고) | 없음 |
| 상태줄 접두어 noGoPrefix | 없음 | "마스트 장착시 " |
| 위험 성격 | 수위 상승(잠김)+저수심(낮음) | 선박 높이(마스트) |
- 판정: pass<noGo→운항 금지(빨강), pass<warn→운항 경고(주황), **pass≥lowWarn→저수위 경고(주황, 저수심 위험)**,
  그 외 여유(초록). **warn≤noGo이면 경고 단계 안 뜸**(행주 — 여유/금지 2단계). lowWarn 없으면 저수위 경고 없음(행주).
  저수위 경고는 물이 너무 빠져(수위 낮음) 통과높이가 커진 상태 = 잠수교만 9.1m 초과 시.
- 저장 키 `hb_bridges6`(2026-07-07 bump — lowWarn/noGoPrefix 강제 적용). 예전 키 폐기.
- 상태줄 문구: "운항금지선(7.30m)까지 X.XX m" — 괄호에 데드라인 숫자 명시.
- base 근거: 잠수교는 회사 시스템 응답 역산, 행주대교는 형하 14.2 − gdt 0.803 ≈ 13.40. 행주는 조석 구간이라 썰물 때 wl 음수 정상.
- 저장 키는 값 바꿀 때 bump(현재 `hb_bridges6`, 2026-07-07). 예전 키는 폐기.

## 데이터 출처 / 아키텍처 결정 (중요)
- HRFCO 오픈API: `https://api.hrfco.go.kr/{인증키}/waterlevel/list/10M/{obscd}.json`
  → 응답 `{ content: [...] }` 중 최신 ymdhm 항목의 wl 사용.
- **HRFCO 댐 API도 같은 키로 사용 가능 (2026-07-05 검증)**:
  `.../dam/list/10M/{dmobscd}.json`(최신 1건) 또는 `.../dam/list/10M/{code}/{sdt}/{edt}.json`(기간).
  팔당댐 코드 `1017310`, 방류량 필드 `tototf`(㎥/s), 유입량 `inf`, 저수위 `swl`.
  ⚠ 기간 조회의 sdt/edt는 **10분 정각**(…00/…10)으로 맞출 것 — 어긋나면 값이 빈 행만 반환됨.
- **물때(조석예보 고저조)는 data.go.kr 국립해양조사원 API (2026-07-06 검증·구현)**:
  `https://apis.data.go.kr/1192136/tideFcstHghLw/GetTideFcstHghLwApiService?serviceKey={키}&obsCode={코드}`
  → 응답 **XML**(`DOMParser`로 파싱). 필드 `predcDt`(예보시각), `predcTdlvVl`(조위 cm), `extrSe`(홀수1·3=만조/짝수2·4=간조).
  ⚠ **date 파라미터는 무시됨 — 항상 서버 기준 오늘(KST)만 반환.** 필수 파라미터는 `obsCode`뿐.
  `Access-Control-Allow-Origin: *` 라 HRFCO처럼 브라우저 직접 호출 가능(프록시 불필요).
  관측소 코드: **인천 `DT_0001`**(사용 중), 경인항 `DT_0058`(미사용, 기록만).
- **방문자 브라우저가 HRFCO를 직접 호출**한다(프록시 없음). HRFCO가
  `Access-Control-Allow-Origin: *` 를 주므로 브라우저 직접 호출이 가능 → 프록시 불필요.
- **❗ 워커/해외 프록시 방식은 폐기.** HRFCO API는 **해외 IP 요청에 응답하지 않음**
  (Cloudflare Worker·allorigins 모두 12초 타임아웃→522/AbortError, 국내 IP는 정상).
  → Vercel/Netlify/GitHub Actions 등 무료 serverless는 전부 해외 IP라 동일하게 막힘.
  → 따라서 "무료 서버로 키 숨기기"는 이 API에선 불가능. 키는 소스에 노출됨.
- **키 노출 판단**: HRFCO 키는 무료·공개 수위 읽기 전용이라 위험 낮음. 악용되면 hrfco.go.kr에서
  즉시 재발급. 현재 키가 공개 저장소 index.html(CONFIG.API_KEY)에 그대로 들어 있음.
- 해외에서 접속하면 자동 호출이 막히므로 **수동 모드(수위 직접 입력)**로 폴백 가능.
- **API 키 유효기간(data.go.kr 2년)**: 물때 `2028-07-05`, 출몰시각 `2028-07-06` 만료. 만료되면 조용히
  데이터 끊김 → `API_EXPIRY`(index.html) 배열에 날짜 박아두고, 만료 `EXPIRY_WARN_DAYS`(=60)일 전부터
  상단 배너(`#expWarn`, `checkKeyExpiry()`)로 경고. **연장하면 `API_EXPIRY`의 date만 새 만료일로 갱신.**
  (HRFCO 키는 별도 만료 명시 없음 — 필요 시 hrfco.go.kr 재발급.)

## 안전·표시 동작 (2026-06-22 추가)
- **데이터 신선도 경고**: 자동 모드에서 관측값의 경과시간을 카드 우상단에 "갱신 HH:MM · N분 전"으로
  표시. `STALE_MIN`(=30분, 10분 주기 3회분) 이상 지나면 빨간색 + `⚠`(`.t.stale`).
  - 경과시간은 ymdhm(KST=UTC+9)을 `Date.UTC(...)−9h`로 환산해 계산 → 기기 시간대와 무관하게 정확.
  - 수동 모드는 사용자 입력이라 ymdhm 없음 → 경과시간 미표시.
- **면책 문구**: 상단에 항상 표시되는 `.disc` 배너("참고용 정보 · 공식 정보로 직접 확인"). 운항 판단
  책임 회피용. 문구만 바꾸려면 index.html의 `<p class="disc">` 수정.

## 팔당댐 방류량 카드 (2026-07-05 추가, v0.4.0)
- 최상단 고정 카드(`#damCard`, 정적 HTML — 교량 카드처럼 동적 생성 아님).
- **현재 방류량 + 4시간 전 방류량** 표시. 4시간 = 팔당 방류수가 여의도까지 도달하는 시간(회사 확인).
- 각 창은 10분 단위 3회 관측값을 **전부 개별 행으로 표시**(시각+값, 과거→최신 순, 최신 행 강조).
  "4시간 전" 창은 벽시계가 아니라 최신 관측시각 기준 −240분 → 두 창 간격이 정확히 4시간.
- 두 열 사이는 얇은 세로 구분선(`.ddiv`)으로만 분리. (추세 화살표는 2026-07-05 제거 —
  값을 다 보여주므로 눈으로 비교 가능하고, 평상시 늘 →로 떠 무의미했음.)
- **방류량 절대값 운항금지 판정**: 각 열의 최신값(강조 행)을 `DAM.noGoFlow`(=3000㎥/s, 회사 확인값)와
  비교. 넘으면 그 열 아래 빨간 칩 표시 — 4시간 전 열은 "운항금지"(지금 여의도, 2026-07-06 '여의도' 문구 제거),
  현재 열은 "4시간 뒤 운항금지"(예측). 두 열 독립 판정(사용자 선택).
  - `DAM.warnFlow`(주의선)는 **null 상태 — 회사 2번째 절대값 확인 대기(2026-07-06 예정)**.
    숫자를 넣으면 주황 '주의' 단계가 자동 활성(교량 noGo/warn 2단계와 동일 구조). `damLevel()`/`setDamStat()` 참고.
- 신선도 경고는 교량 카드와 동일 로직(`STALE_MIN` 공유). 수동 모드에서는 조회 안 함(안내 문구).
- 관련 코드: `DAM` 상수(코드 1017310, lagMin 240, winMin 30, noGoFlow 3000, warnFlow null),
  `damUrl()/fetchDam()/renderDam()/damLevel()/setDamStat()`. `fetchAll()`이 교량과 함께 호출.

## 조류세기 (인천 카드 하단) — 2026-07-07 KHOA 실측, '오늘 하루 세기'
- **KHOA 수치조류도 예측 유향·유속** API로 계산. 표시는 **바다타임식 '오늘 하루 세기 %'**(하루 고정,
  방향 화살표 없음, 깔끔한 %). 예: 오늘 59%(바다타임 일치). (조차 추정[방법 A]·실시간 유속 방식은 폐기.)
- 계산: 하루 여러 시각(`TIDECUR.hours`=0,3,…,21)의 인천 최근접 격자 유속 중 **최고값** = 오늘 하루 세기.
  이를 `TIDECUR.maxSpeed`(125cm/s, 오늘 최고 74→59% 보정)로 나눠 %. **하루 1번 계산 후 `hb_tidecur`
  (localStorage, {ymd,pct})에 캐시** → 이후 재조회 없음(호출 절약). `pickIncheonSpeed()/fetchTideCur()/renderTideCur()`.
- 왜 하루 세기? 실시간 유속은 정조(물멈춤) 땐 ~0이라 바다타임(하루 고정 59%)과 극단적으로 달라 혼란 → 사용자 선택.
- 엔드포인트: `https://khoa.go.kr/oceandata/api/tidalCurrentArea/search.do`
  파라미터 `ServiceKey·Date(YYYYMMDD)·Hour·Minute·MinX/MaxX/MinY/MaxY(경위도 박스)·ResultType=json`.
  응답 JSON `result.data[]`(격자점 `current_speed` cm/s·`current_dir`·`pre_lat/lon`). CORS 허용(*), 하루 20,000건.
- **키가 data.go.kr와 별개** — KHOA 바다누리(khoa.go.kr/oceandata) 자체 발급. `CONFIG.TIDECUR_KEY`,
  유효 ~**2027-07-06**(현재 최단 만료 → `API_EXPIRY`에 등록). 사용기관 '개인'.
- 출몰시각(`fetchRiseSet` 등) 코드는 미사용으로 보존(호출 안 함).

## 물때 카드: 여의도·인천 (2026-07-06 추가, v0.5.0)
- **인천 물때 카드**(`#incheonCard`): 인천(DT_0001)의 오늘 만조·간조 4개 전부 표시(시각·조위 cm, 만조 강조).
- **여의도 물때 카드**(`#yeouidoCard`): 인천 **만조만 2개** 골라 시각 +4시간(`TIDE.lagMin`=240). (2026-07-06 직원
  피드백으로 4개→만조 2개로 되돌림. `renderTide`에서 `.filter(e=>e.high)`.)
  4시간 = 팔당댐 카드와 같은 도달 시간 개념. +4시간이 자정을 넘으면 "익일" 태그. 조위는 인천 값 그대로(간이 방식).
- **화살표·증감**(2026-07-06): 각 행에 만조 ▲(주황)/간조 ▼(파랑) + 직전 물때 대비 증감(cm, 절대값).
  증감 = 현재 조위 − 직전 물때 조위. **하루 첫 물때의 직전 = 어제 마지막 물때인데 이 API는 어제를 안 줌**
  → 어제 마지막 물때 조위를 `hb_tidelast`(localStorage, {ymd:val}, 오늘+어제만 유지)에 캐시해 사용.
  캐시 없으면(첫 방문·공백일) 첫 행은 화살표만 표시. `ymdMinus1()/loadTideCache()/tideRow()` 참고.
- **카드 순서(화이트보드)**: 팔당댐 → 잠수교 → 여의도물때 → 행주대교 → 인천물때.
  구현: 물때 카드는 `#cards` 안 정적 HTML, `buildCards()`가 교량 카드(`.card[data-id]`)만 지우고
  잠수교는 여의도 앞·나머지 교량은 인천 앞에 삽입. (교량 추가 시 이 삽입 규칙 확인 필요)
- 예보값이라 신선도 경고 없음(대신 "MM/DD 예보" 표기). **수동 모드에서도 표시**(예보라 실시간 무관).
- 관련 코드: `TIDE` 상수(incheon DT_0001, lagMin 240), `fetchTide()/renderTide()/addMin()/tideFail()`.
  `fetchAll()` 및 init(수동 모드)에서 호출. XML→`DOMParser` 파싱.
- **일출·일몰·월출·월몰**(2026-07-06, 활성화 후 추가): 인천 물때 카드 하단에 통합(`#sunMoon` 2×2).
  한국천문연구원 출몰시각 API(`CONFIG.RISESET_ENDPOINT`, B090041 getAreaRiseSetInfo, **물때와 같은
  TIDE_KEY 사용**, CORS *). 파라미터 `serviceKey·locdate(오늘)·location=인천`. 필드 sunrise/sunset/
  moonrise/moonset(HHMM, 공백 trim, 없으면 '—'). `RISESET`/`fetchRiseSet()/hhmm()`. fetchAll·init에서 호출.
  위치는 인천(같은 카드 데이터와 일관). 서울과 1분 이내 차이.

## 한강 역류 감시 카드 (2026-07-08, 행주대교 카드 밑)
- `#backflowCard`(정적 카드) — **행주대교 수위 최근 30분(10분 단위 3개)**, 팔당댐 서식(`.drows/.drow`, 최신 강조,
  신선도 `#bfT`). HRFCO 행주대교(1019630) 기간조회. `BACKFLOW` 상수/`backflowUrl()/fetchBackflow()/renderBackflow()`.
  `fetchAll`에서 호출(자동 모드), 수동 모드는 안내(`applyModeUI`의 `#bfNote`).
- 배치: `#cards` 안 정적 HTML(인천 카드 뒤)로 두되 `buildCards()`가 **행주대교 카드 바로 아래로 이동**(insertAdjacentElement afterend).
- **역류 원리**: 인천 조위가 신곡수중보(≈720cm)를 넘으면 밀물이 한강 상류로 역류. 신곡수중보 지점 수위는
  아라한강갑문(내) 1019635로도 조회 가능(김포 고촌 신곡리, 실시간).
- **역류 자동 판정 미구현(대기)**: 인천 조위 720cm 기준으로 판정 예정이나, 실제 720 초과일 때 검증 후 도입.
  행주 절대수위 고정 임계값은 팔당댐 방류량에 따라 기준선이 변해 불안정(2026-07-08 분석) → 인천 조위(고저조 코사인 보간) 기준이 안정적.

## 파일 구조
- `index.html` — 웹앱 전체(단일 파일). 실제 배포물.
- `hrfco-proxy-worker.js` — (사용 안 함) 폐기된 Cloudflare Worker. 삭제해도 무방.
- **AI Development OS 문서** (2026-07-04 적용): `PRD.md`(요구사항) · `TASKS.md`(작업 추적) ·
  `RULES.md`(작업 규칙·원격 저장소 규칙) · `AI_HANDOFF.md`(세션 인수인계) · `CHANGELOG.md`(변경 이력).
  새 세션은 AI_HANDOFF.md부터 읽기. 작업 완료 시 이 문서들도 AGENTS.md와 함께 갱신.

## index.html 의 CONFIG
```js
var CONFIG = {
  API_KEY: "<HRFCO 키>",   // 직접 호출용. 현재 채워져 있음(공개 노출 감수)
  PROXY: "...",            // 사용 안 함(프록시 기본 꺼짐: hb_proxy 기본 '0')
  ENDPOINT_TEMPLATE: ""    // 비움(워커 폐기). 채우면 워커 모드지만 이 API엔 부적합
};
```
- 교량 설정은 `DEFAULT_BRIDGES` 배열. 항목 추가하면 카드가 늘어남.
- 설정은 guarded localStorage(키 `hb_*`, 교량은 `hb_bridges4`)에 저장. 막히면 메모리 폴백.

## 설정 패널 잠금 (일반 방문자에게 숨김)
- 설정 `<details id="setPanel">` 는 **기본 숨김**. 일반 방문자는 통과높이 카드만 봄.
- 열기: ① 비밀 URL `?admin` 로 접속, 또는 ② 제목(h1) 5회 연속 탭.
  → 해제되면 `hb_admin='1'` 로 그 기기에 기억됨.
- 다시 숨기기: 설정 맨 아래 "이 기기에서 설정 숨기기" 링크(`#lockSet`, hb_admin='0').
- **주의**: 이건 보안이 아니라 캐주얼 숨김. 키·설정값은 소스에 있고 우회 가능.

## 로컬 미리보기(개발용)
- 정적 파일이라 폴더를 그대로 서빙: `python -m http.server 8137` → http://localhost:8137/
- `.Codex/launch.json` 에 미리보기 설정 있음(preview 도구용).
- preview 도구는 dev 서버(localhost) 오리진에 묶여 있어 외부 github.io 화면 캡처는 안 됨.

## 다음 할 일 후보 (상세·최신은 TASKS.md 참고)
- [ ] **기능 확장(2026-07-05 회의)**: ~~팔당댐 방류량 카드~~(v0.4.0 완료) → 인천/여의도 물때 카드
  (KHOA 신규 바다누리 키 발급 중 — 사용자 진행, 발급되면 새 API 주소 형식 공유받기로)
- [~] ~~잠수교·행주대교 기준값 실측 반영 / 센서 이상값 방어~~ — 취소(2026-07-07).
- [ ] 키 노출이 정 부담되면 **국내 IP 서버/프록시**를 따로 둬야 함(무료 serverless 불가). 난이도↑
- [x] ~~로컬 폴더를 git에 연결해 web 복붙 대신 push로 배포 자동화~~ (2026-06-22 완료)
- [ ] 교량 추가 시 이 표와 도움말 Q&A에도 같은 형식으로 기록
