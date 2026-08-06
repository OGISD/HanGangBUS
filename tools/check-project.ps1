[CmdletBinding()]
param(
  [string]$NodePath = ''
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$failures = New-Object System.Collections.Generic.List[string]

function Pass([string]$message) {
  Write-Host "[통과] $message" -ForegroundColor Green
}

function Fail([string]$message) {
  $failures.Add($message)
  Write-Host "[실패] $message" -ForegroundColor Red
}

function Require-Match([string]$text, [string]$pattern, [string]$message) {
  if ($text -match $pattern) { Pass $message } else { Fail $message }
}

function Require-NoMatch([string]$text, [string]$pattern, [string]$message) {
  if ($text -notmatch $pattern) { Pass $message } else { Fail $message }
}

$htmlPath = Join-Path $root 'index.html'
$html = Get-Content -LiteralPath $htmlPath -Raw -Encoding utf8
$agents = Get-Content -LiteralPath (Join-Path $root 'AGENTS.md') -Raw -Encoding utf8
$claude = Get-Content -LiteralPath (Join-Path $root 'CLAUDE.md') -Raw -Encoding utf8
$contributors = Get-Content -LiteralPath (Join-Path $root 'CONTRIBUTORS.md') -Raw -Encoding utf8
$manifest = Get-Content -LiteralPath (Join-Path $root 'manifest.webmanifest') -Raw -Encoding utf8

# 안전 판정과 확정 상수
Require-Match $html 'var pass=b\.base-wl\+\(b\.offset\|\|0\)' '통과높이 공식이 유지됨'
Require-Match $html 'if\(pass<=b\.noGo\+1e-9\)' '운항금지선과 같은 값도 소수 계산 오차 없이 운항 금지로 판정함'
Require-Match $html 'id:"jamsu"[^\r\n]+base:11\.76[^\r\n]+noGo:7\.3[^\r\n]+warn:7\.8[^\r\n]+offset:0\.02[^\r\n]+lowWarn:9\.1' '잠수교 확정값이 유지됨'
Require-Match $html 'id:"haengju"[^\r\n]+base:13\.4[^\r\n]+noGo:10\.9[^\r\n]+warn:10\.9[^\r\n]+offset:0' '행주대교 확정값이 유지됨'
Require-Match $html 'noGoFlow:3000' '팔당댐 운항금지 방류량이 유지됨'
Require-Match $html 'var STALE_MIN=30' '데이터 신선도 경고 30분이 유지됨'
Require-Match $html 'var FLOW_TUNING=\{ winMin:30, deadRate:2 \}' '역류 추세 조정값(30분·±2cm/h)이 한곳에 모여 있음'
Require-Match $html 'winMin:FLOW_TUNING\.winMin, deadRate:FLOW_TUNING\.deadRate' '역류 계산이 조정 전용 설정값을 사용함'
Require-Match $html 'data-flow-window[\s\S]+data-flow-dead-rate' '도움말이 역류 조정값을 자동 반영함'
Require-Match $html 'syncFlowTuningText\(\)' '시작할 때 역류 조정값을 화면에 반영함'
Require-Match $html 'function hourlyChange\(rows\)[\s\S]+target=t1-60\*60000[\s\S]+rows\[0\]\.wl-rows\[i\]\.wl' '다리 옆 수위 변화가 최신값과 정확히 1시간 전 값의 차이로 계산됨'
Require-Match $html 'if\(t===target\)[\s\S]+if\(t!=null&&t<target\) break' '정확히 1시간 전 관측이 없으면 변화량을 추정하지 않음'
Require-Match $html "cm\+'cm/1h'" '다리 옆 실제 1시간 변화량 단위가 명확히 표시됨'
Require-Match $html '한강 수위 · 최근 30분 판정' '카드 제목이 30분 판정과 1시간 변화 표시를 구분함'
Require-Match $html '행주 수위 ''\+ll\.lagMin\+''분 먼저 변함 · 조석 영향 추정' '일반 화면의 행주 시간차가 쉬운 표현으로 표시됨'
Require-Match $html '한강대교 수위 ''\+Math\.abs\(ll\.lagMin\)\+''분 먼저 변함 · 방류 영향 추정' '일반 화면의 한강대교 시간차가 쉬운 표현으로 표시됨'
Require-Match $html '\.flow-nowrap\{white-space:nowrap\}' '시간차 문구 내부의 줄바꿈을 방지함'
Require-Match $html 'function flowVerdict\(bfDir,hgDir,ph\)' '역류 방향 판정이 별도 함수로 분리됨'
Require-Match $html "matches===1[\s\S]+out\('up','🔺 상류 흐름 가능성'[\s\S]+out\('down','🔻 하류 흐름 가능성'" '밀물·썰물 방향 가능성을 대칭적으로 판정함'
Require-Match $html "if\(v\.segmentDiff\) evid\.push\('두 지점의 수위 변화가 다름'\)" '두 다리의 수위 변화 방향이 다름을 안내함'
Require-Match $html '⏸ 수위 변화 작음' '두 다리 모두 작은 변화인 상태를 별도로 표시함'
Require-Match $html '↕ 관측 방향이 달라 판단 어려움' '물때와 수위 근거가 맞지 않는 상태를 별도로 표시함'
Require-Match $html '실제 물이 멈췄다는 뜻은 아닙니다' '수위 추세 판정의 한계를 도움말에 안내함'
Require-Match $html 'bothFresh=flowRowsFresh\(flow\.bfRows\)&&flowRowsFresh\(flow\.hgRows\)' '두 관측소가 모두 신선할 때만 역류 판정을 허용함'
Require-Match $html '수위 자료가 오래되어 판정 보류' '오래된 수위의 판정 보류 안내가 있음'

# 장애 대응과 호출 최적화
Require-Match $html 'REQUEST_TIMEOUT=\{ hrfco:8000, tide:3000, tidecur:6000 \}' 'API별 최대 대기시간이 설정됨'
Require-Match $html 'var TIDE_RETRY_MS=30\*60000' '물때 API 자동 재시도 간격이 30분임'
Require-Match $html "obsCode='\+TIDE\.incheon\+'\&type=xml'" '물때 API 요청 형식을 XML로 명시함'
Require-Match $html "if\(s\.charAt\(0\)===\'\{\'\)[\s\S]+JSON\.parse\(s\)[\s\S]+DOMParser" '물때 API의 JSON·XML 응답을 모두 해석함'
Require-Match $html 'TIDE_BACKUP_TEMPLATE: "data/tide-incheon-\{year\}\.json"' '연간 조석표 백업 경로가 유지됨'
Require-Match $html 'anchor=tideBackupLast\(prevYmd\)' '첫 물때 증감의 전날 연간표 보충이 유지됨'
Require-Match $html 'if\(!partial\) try\{ store\.set\(''hb_tidecur''' '조류예측 일부 응답은 하루 캐시에 저장하지 않음'
Require-NoMatch $html '조류세기\(상대\)' '조류세기 상대지표 표기가 다시 노출되지 않음'
Require-Match $html '오동근, Claude·GPT와 함께' '라이브 제작자 표기에 Claude와 GPT가 함께 표시됨'
Require-Match $contributors 'Claude \(Anthropic\)[\s\S]+GPT \(OpenAI Codex\)' 'CONTRIBUTORS.md에 Claude와 GPT 역할이 기록됨'
Require-Match $agents 'Co-authored-by: Codex <codex@openai\.com>' 'Codex 참여 커밋의 공식 GitHub 공동 작성자 규칙이 기록됨'
Require-Match $html 'visibilitychange' '숨긴 페이지의 자동 호출 중지·복귀 처리가 있음'
Require-NoMatch $html 'allorigins|ENDPOINT_TEMPLATE|useProxy|proxyUrl|fetchRiseSet|RISESET_ENDPOINT' '폐기된 해외 프록시·출몰시각 코드가 없음'
Require-NoMatch $html '<link[^>]+stylesheet[^>]+https?://' '첫 화면이 외부 글꼴에 의존하지 않음'
Require-Match $agents 'pass <= noGo' 'AGENTS.md의 운항금지 경계가 코드와 일치함'
Require-Match $claude 'pass≤noGo' 'CLAUDE.md의 운항금지 경계가 코드와 일치함'
Require-Match $claude 'HRFCO 8초, 물때 3초, KHOA 조류예측 6초' 'CLAUDE.md의 최대 대기시간이 코드와 일치함'
Require-NoMatch $manifest '조류 실시간|물때 실시간' '매니페스트가 예측 자료를 실시간으로 표현하지 않음'

# HTML 안 JavaScript 문법
if (-not $NodePath) {
  $node = Get-Command node -ErrorAction SilentlyContinue
  if ($node) { $NodePath = $node.Source }
}
if (-not $NodePath -or -not (Test-Path -LiteralPath $NodePath)) {
  Fail 'JavaScript 문법 검사에 필요한 Node.js를 찾지 못함(-NodePath로 지정 가능)'
} else {
  $matches = [regex]::Matches($html, '(?is)<script(?:\s[^>]*)?>(.*?)</script>')
  $scripts = ($matches | ForEach-Object { $_.Groups[1].Value }) -join "`n"
  $tempJs = Join-Path ([IO.Path]::GetTempPath()) ("hangang-check-{0}.js" -f [guid]::NewGuid())
  try {
    [IO.File]::WriteAllText($tempJs, $scripts, (New-Object Text.UTF8Encoding($false)))
    $nodeOutput = & $NodePath --check $tempJs 2>&1
    if ($LASTEXITCODE -eq 0) { Pass 'index.html JavaScript 문법이 올바름' }
    else { Fail ("index.html JavaScript 문법 오류: " + ($nodeOutput -join ' ')) }
  } finally {
    if (Test-Path -LiteralPath $tempJs) { Remove-Item -LiteralPath $tempJs -Force }
  }

  # 상·하류 판정의 정방향/정반대 합성 사례
  $flowFunction = [regex]::Match($html, '(?s)function flowVerdict\(bfDir,hgDir,ph\)\{.*?\r?\n\}(?=\r?\nfunction renderFlow)')
  if (-not $flowFunction.Success) {
    Fail 'flowVerdict 합성 검사용 함수 추출'
  } else {
    $flowCases = @'
const cases = [
  ['사진 상황', 'up', 'down', 'ebb', 'down', '하류 흐름 가능성', true],
  ['정반대 상황', 'down', 'up', 'flood', 'up', '상류 흐름 가능성', true],
  ['두 다리 하강', 'down', 'down', 'ebb', 'down', '순류', false],
  ['두 다리 상승', 'up', 'up', 'flood', 'up', '역류 경향', false],
  ['두 다리 변화 작음', 'flat', 'flat', 'ebb', 'flat', '수위 변화 작음', false],
  ['물때와 수위 불일치', 'up', 'up', 'ebb', 'flat', '관측 방향이 달라 판단 어려움', false]
];
for (const c of cases) {
  const r = flowVerdict(c[1], c[2], c[3]);
  if (r.cls !== c[4] || !r.text.includes(c[5]) || r.segmentDiff !== c[6]) {
    throw new Error(c[0] + ': ' + JSON.stringify(r));
  }
}
'@
    $tempFlowJs = Join-Path ([IO.Path]::GetTempPath()) ("hangang-flow-check-{0}.js" -f [guid]::NewGuid())
    try {
      [IO.File]::WriteAllText($tempFlowJs, ($flowFunction.Value + "`n" + $flowCases), (New-Object Text.UTF8Encoding($false)))
      $flowOutput = & $NodePath $tempFlowJs 2>&1
      if ($LASTEXITCODE -eq 0) { Pass '상·하류 대칭 판정 합성 사례 6종' }
      else { Fail ("상·하류 대칭 판정 합성 사례: " + ($flowOutput -join ' ')) }
    } finally {
      if (Test-Path -LiteralPath $tempFlowJs) { Remove-Item -LiteralPath $tempFlowJs -Force }
    }
  }
}

# 연간 조석표의 기간·순서·형식·교대 여부
$tideSpecs = @(
  @{ File = 'data/tide-incheon-2026.json'; Year = 2026; Start = '2026-08-01'; End = '2026-12-31'; Count = 153 },
  @{ File = 'data/tide-incheon-2027.json'; Year = 2027; Start = '2027-01-01'; End = '2027-12-31'; Count = 365 }
)

foreach ($spec in $tideSpecs) {
  $path = Join-Path $root $spec.File
  try {
    $doc = Get-Content -LiteralPath $path -Raw -Encoding utf8 | ConvertFrom-Json
    $days = @($doc.days.PSObject.Properties | Sort-Object Name)
    $ok = $doc.stationCode -eq 'DT_0001' -and $doc.unit -eq 'cm' -and [int]$doc.year -eq $spec.Year
    $ok = $ok -and $days.Count -eq $spec.Count -and $days[0].Name -eq $spec.Start -and $days[-1].Name -eq $spec.End
    $previousDate = $null
    $previousType = $null
    foreach ($day in $days) {
      $date = [datetime]::ParseExact($day.Name, 'yyyy-MM-dd', [Globalization.CultureInfo]::InvariantCulture)
      if ($previousDate -and $date -ne $previousDate.AddDays(1)) { $ok = $false }
      $previousDate = $date
      $previousTime = ''
      $events = @($day.Value)
      if ($events.Count -lt 3) { $ok = $false }
      foreach ($event in $events) {
        $time = [string]$event[0]
        $type = [string]$event[1]
        $value = [double]$event[2]
        if ($time -notmatch '^([01][0-9]|2[0-3]):[0-5][0-9]$' -or ($previousTime -and $time -le $previousTime)) { $ok = $false }
        if (($type -ne 'high' -and $type -ne 'low') -or ($previousType -and $type -eq $previousType)) { $ok = $false }
        if ($value -lt -100 -or $value -gt 1100) { $ok = $false }
        $previousTime = $time
        $previousType = $type
      }
    }
    if ($ok) { Pass ("{0} 무결성({1}일 연속 자료)" -f $spec.File, $spec.Count) }
    else { Fail ("{0} 기간·형식·순서·고저조 교대 검사" -f $spec.File) }
  } catch {
    Fail ("{0} 읽기 실패: {1}" -f $spec.File, $_.Exception.Message)
  }
}

if ($failures.Count -gt 0) {
  Write-Host "`n총 $($failures.Count)개 검사가 실패했습니다." -ForegroundColor Red
  exit 1
}

Write-Host "`n모든 프로젝트 검사를 통과했습니다." -ForegroundColor Cyan
