# Changelog

이 프로젝트의 주요 변경사항을 기록합니다. 형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.0.0/)를 따르며, 버전은 [Semantic Versioning](https://semver.org/lang/ko/)을 따릅니다.

---

## [Unreleased]

### Added
- (진행 중) 센서 이상값 방어 1단계 — 수위 범위 sanity check

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
