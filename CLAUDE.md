# CLAUDE.md — 한강 교량 통과높이 모니터

이 파일은 Claude Code가 이 프로젝트의 맥락을 이어받기 위한 메모입니다.
(설명·문서는 한국어로 작성합니다.)

## ⚙️ 작업 규칙 (항상 지킬 것)
- **작업을 완료할 때마다 이 CLAUDE.md를 확인하고 그때그때 갱신한다.** 바뀐 배포 상태·확정값·
  아키텍처 결정·"다음 할 일" 체크박스를 최신으로 유지. (예전 설명이 틀려졌으면 고치고, 끝낸
  할 일은 `[x]`로 표시·완료일 기록.) 문서 갱신도 같은 커밋/푸시에 포함한다.

## 프로젝트 한 줄 요약
한강 교량(잠수교·행주대교)의 **선박 통과높이**를 실시간 수위로 계산해 보여주는
단일 파일 모바일 웹앱. 소수 내부 공유용.

## 현재 배포 상태 (이미 라이브)
- **공개 주소**: https://ogisd.github.io/HanGangBUS/
- **저장소**: https://github.com/OGISD/HanGangBUS (GitHub 계정 OGISD)
- **호스팅**: GitHub Pages (`main` 브랜치).
- **로컬 폴더가 git 저장소임.** (2026-06-22 연결 완료) `origin` = OGISD/HanGangBUS,
  `main` 추적. 수정 반영은 `git add -A && git commit && git push` → Pages 자동 재배포.
  (예전 "웹에서 전체 복붙" 방식은 더 이상 안 씀.)
  - 인증: Git Credential Manager(system helper `manager`)가 처리. push 시 필요하면 로그인 창이 뜸.
  - 커밋 신원: user.name=OGISD, user.email=buwake58@naver.com (global).
  - 줄바꿈은 `.gitattributes`로 LF 정규화. `hangang-bridge-monitor.zip`·`.claude/`는 `.gitignore`.
- 자동 모드 실시간 작동 검증 완료(2026-06 기준).

## 핵심 공식
```
통과높이(passHeight) = 기준높이(base) − 현재 수위(wl)
기준높이(base)       = 다리 하단 형하 표고(EL.m) − 수위계 영점표고 gdt(EL.m)
```
- `wl`은 한강홍수통제소(HRFCO) 수위관측소의 실시간 수위(영점 기준 값, 음수 가능).

## 교량별 확정값
| 항목 | 잠수교 | 행주대교 |
|---|---|---|
| 관측소 코드(obscd) | 1018680 | 1019630 |
| 기준높이 base | 11.76 | 13.40 |
| 운항 금지선 noGo | 7.3 | 11.0 |
| 위험 경고선 warn | 7.6 | 13.0 |
| 위험 성격 | 수위 상승(잠김) | 선박 높이(마스트) |
- 둘 다 verified:true. 근거: 잠수교 base는 회사 시스템 응답(wl 4.35 + pass 7.41 = 11.76)으로 역산 검증,
  행주대교 base는 형하 14.2 − gdt 0.803 ≈ 13.40. 행주대교는 서해 조석 구간이라 썰물 때 wl 음수 정상.

## 데이터 출처 / 아키텍처 결정 (중요)
- HRFCO 오픈API: `https://api.hrfco.go.kr/{인증키}/waterlevel/list/10M/{obscd}.json`
  → 응답 `{ content: [...] }` 중 최신 ymdhm 항목의 wl 사용.
- **방문자 브라우저가 HRFCO를 직접 호출**한다(프록시 없음). HRFCO가
  `Access-Control-Allow-Origin: *` 를 주므로 브라우저 직접 호출이 가능 → 프록시 불필요.
- **❗ 워커/해외 프록시 방식은 폐기.** HRFCO API는 **해외 IP 요청에 응답하지 않음**
  (Cloudflare Worker·allorigins 모두 12초 타임아웃→522/AbortError, 국내 IP는 정상).
  → Vercel/Netlify/GitHub Actions 등 무료 serverless는 전부 해외 IP라 동일하게 막힘.
  → 따라서 "무료 서버로 키 숨기기"는 이 API에선 불가능. 키는 소스에 노출됨.
- **키 노출 판단**: HRFCO 키는 무료·공개 수위 읽기 전용이라 위험 낮음. 악용되면 hrfco.go.kr에서
  즉시 재발급. 현재 키가 공개 저장소 index.html(CONFIG.API_KEY)에 그대로 들어 있음.
- 해외에서 접속하면 자동 호출이 막히므로 **수동 모드(수위 직접 입력)**로 폴백 가능.

## 안전·표시 동작 (2026-06-22 추가)
- **데이터 신선도 경고**: 자동 모드에서 관측값의 경과시간을 카드 우상단에 "갱신 HH:MM · N분 전"으로
  표시. `STALE_MIN`(=30분, 10분 주기 3회분) 이상 지나면 빨간색 + `⚠`(`.t.stale`).
  - 경과시간은 ymdhm(KST=UTC+9)을 `Date.UTC(...)−9h`로 환산해 계산 → 기기 시간대와 무관하게 정확.
  - 수동 모드는 사용자 입력이라 ymdhm 없음 → 경과시간 미표시.
- **면책 문구**: 상단에 항상 표시되는 `.disc` 배너("참고용 정보 · 공식 정보로 직접 확인"). 운항 판단
  책임 회피용. 문구만 바꾸려면 index.html의 `<p class="disc">` 수정.

## 파일 구조
- `index.html` — 웹앱 전체(단일 파일). 실제 배포물.
- `hrfco-proxy-worker.js` — (사용 안 함) 폐기된 Cloudflare Worker. 삭제해도 무방.

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
- `.claude/launch.json` 에 미리보기 설정 있음(preview 도구용).
- preview 도구는 dev 서버(localhost) 오리진에 묶여 있어 외부 github.io 화면 캡처는 안 됨.

## 다음 할 일 후보
- [ ] 키 노출이 정 부담되면 **국내 IP 서버/프록시**를 따로 둬야 함(무료 serverless 불가). 난이도↑
- [ ] 행주대교 임계값(noGo/warn)을 실제 관심 선박 air draft(예: 한강버스)에 맞게 재설정
- [x] ~~로컬 폴더를 git에 연결해 web 복붙 대신 push로 배포 자동화~~ (2026-06-22 완료)
- [ ] 교량 추가 시 이 표와 도움말 Q&A에도 같은 형식으로 기록
