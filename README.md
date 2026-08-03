# 한강버스 운항 도우미

한강버스 운항에 참고할 교량 통과높이, 팔당댐 방류량, 인천·여의도 물때, 한강 수위와 역류·순류 경향을
모바일 한 화면에 표시하는 정적 웹앱입니다.

- 서비스: https://ogisd.github.io/HanGangBUS/
- 호스팅: GitHub Pages (`main` 브랜치)
- 용도: 소수 내부 공유용 참고 정보

## 주요 기능

- 잠수교·행주대교 통과높이와 운항 판정
- 팔당댐 현재/4시간 전 방류량
- 인천·여의도 물때와 조류세기
- 행주대교·한강대교 수위 및 역류/순류 경향
- API 장애 시 인천 연간 조석표 자동 백업
- 접이식 도움말 Q&A와 운항 참고사항
- 데이터 신선도 경고, 수동 수위 입력, PWA 홈 화면 바로가기

## 파일

- `index.html` — 웹앱 UI와 로직
- `data/tide-incheon-2026.json`, `data/tide-incheon-2027.json` — 물때 API 장애용 연간표
- `tools/convert-tide.ps1` — 월별 조석표 ZIP을 연도별 JSON으로 변환
- `tools/check-project.ps1` — 코드·확정값·연간 조석표를 한 번에 검사
- `AI_HANDOFF.md` — 새 작업 세션 인수인계
- `CLAUDE.md` — 상세 기술 사양과 확정값
- `TASKS.md` — 작업 현황

HRFCO가 해외 IP 요청을 차단하므로 Cloudflare Worker 같은 해외 프록시를 현재 구조에 사용하면 안 됩니다.

## 로컬 미리보기

```powershell
python -m http.server 8137
```

브라우저에서 `http://localhost:8137/`을 엽니다. 실제 배포는 검증된 변경을 `main`에 push하면 자동 진행됩니다.

변경 전후 일괄 검사:

```powershell
powershell -ExecutionPolicy Bypass -File tools/check-project.ps1
```

## 통과높이 공식

```text
통과높이 = 기준높이(base) - 현재 수위(wl) + 오차보정(offset)
```

교량별 확정값과 근거는 `CLAUDE.md`를 확인합니다.

## 주의

이 앱은 참고용이며 공식 항행 안전 시스템을 대체하지 않습니다. 실제 운항 판단은 공식 정보로 직접 확인해야 합니다.
