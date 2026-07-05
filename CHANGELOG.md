# Changelog

이 프로젝트의 주요 변경사항을 기록합니다. 형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.0.0/)를 따르며, 버전은 [Semantic Versioning](https://semver.org/lang/ko/)을 따릅니다.

---

## [Unreleased]

### Added
- (계획) 인천(경인항) 물때 카드 + 여의도 만조(인천+4h) 카드 — KHOA 키 발급·API 검증 대기
- (연기) 센서 이상값 방어 1단계 — 기능 확장 뒤로 미룸

---

## [0.4.0] - 2026-07-05

### Added
- 팔당댐 방류량 카드 (최상단): 현재 방류량 + 4시간 전 방류량(지금 여의도에 도달 중인 방류분).
  각 창은 10분 단위 3회 관측값을 **전부 개별 표시**(시각+값, 최신 행 강조), 증감 추세
  화살표(30분 평균 비교, ±2% 초과 시 ▲/▼), 교량 카드와 동일한 데이터 신선도 경고.
  HRFCO 댐 API(팔당댐 1017310, tototf ㎥/s) 사용. 수동 모드에서는 조회하지 않음(안내 문구 표시).

---

## [0.3.0] - 2026-07-04

### Added
- AI Development OS 문서 체계 적용: PRD.md, TASKS.md, RULES.md, AI_HANDOFF.md, CHANGELOG.md

---

## [0.2.0] - 2026-06-22

### Added
- 데이터 신선도 경고: 자동 모드에서 관측값 경과시간 표시("갱신 HH:MM · N분 전"),
  30분 이상이면 빨간색 + ⚠ (KST 기준 환산으로 기기 시간대 무관)
- 참고용 면책 문구 배너 상시 표시 ("실제 운항·통항 여부는 공식 정보로 직접 확인")
- `.gitignore`(zip·.claude 제외), `.gitattributes`(LF 정규화)

### Changed
- 배포 방식 전환: GitHub 웹에서 전체 복붙 → 로컬 git 저장소에서 `git push` (Pages 자동 재배포)
- CLAUDE.md에 "작업 완료 시 문서 갱신" 작업 규칙 추가

---

## [0.1.0] - 2026-06-21

### Added
- 최초 배포 (GitHub Pages: https://ogisd.github.io/HanGangBUS/)
- 통과높이 계산·표시: 잠수교·행주대교 카드, 수위 시각화(물 높이 애니메이션)
- 안전 판정: 운항 금지선(noGo)·위험 경고선(warn) 기준 색상/라벨
- 자동 모드(HRFCO 오픈API 직접 호출) / 수동 모드(수위 직접 입력) 전환
- 자동 새로고침(기본 10분), 설정 패널(교량별 값 편집, localStorage 저장)
- 설정 패널 잠금: 기본 숨김, `?admin` URL 또는 제목 5회 탭으로 해제
- 도움말 Q&A (통과높이·기준높이·gdt·임계값 설명)
