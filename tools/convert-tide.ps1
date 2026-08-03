param(
  [Parameter(Mandatory=$true)][string]$ZipPath,
  [Parameter(Mandatory=$true)][string]$OutputDirectory
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem

$cp949 = [System.Text.Encoding]::GetEncoding(949)
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$highMark = [char]0xACE0
$lowMark = [char]0xC800
$byYear = @{}
$seenMonths = @{}

$zip = [System.IO.Compression.ZipFile]::OpenRead((Resolve-Path -LiteralPath $ZipPath))
try {
  $entries = @($zip.Entries | Where-Object { $_.Name -match '^\[Hilow\](20\d{4}) .+\.txt$' })
  if (-not $entries.Count) { throw 'No Incheon tide table text files found.' }

  foreach ($entry in $entries) {
    $month = [regex]::Match($entry.Name, '(20\d{4})').Groups[1].Value
    if ($seenMonths.ContainsKey($month)) { throw "Duplicate month file: $month" }
    $seenMonths[$month] = $true

    $stream = $entry.Open()
    try {
      $reader = New-Object System.IO.StreamReader($stream, $cp949, $false)
      try { $text = $reader.ReadToEnd() } finally { $reader.Dispose() }
    } finally { $stream.Dispose() }

    $daysInFile = [ordered]@{}
    foreach ($line in ($text -split "`r?`n")) {
      if ($line -notmatch '^(20\d{2}-\d{2}-\d{2}),\s*(.+)$') { continue }
      $date = $matches[1]
      if ($date.Replace('-', '').Substring(0,6) -ne $month) {
        throw "Filename and date do not match: $($entry.Name) / $date"
      }

      $events = @()
      foreach ($cell in ($matches[2] -split ',\s*')) {
        if ($cell -match '^(\d{2}:\d{2})/([^/])/(-?\d+)$' -and ($matches[2] -eq $highMark -or $matches[2] -eq $lowMark)) {
          $events += ,@($matches[1], $(if ($matches[2] -eq $highMark) { 'high' } else { 'low' }), [int]$matches[3])
        } elseif ($cell -notmatch '^--:--/-/--/--$') {
          throw "Invalid tide event: $date / $cell"
        }
      }
      if ($events.Count -lt 3 -or $events.Count -gt 4) { throw "Invalid event count: $date ($($events.Count))" }
      $daysInFile[$date] = $events
    }

    $year = [int]$month.Substring(0,4)
    $monthNumber = [int]$month.Substring(4,2)
    $expectedDays = [DateTime]::DaysInMonth($year, $monthNumber)
    if ($daysInFile.Count -ne $expectedDays) {
      throw "$month day count mismatch: expected $expectedDays, actual $($daysInFile.Count)"
    }

    if (-not $byYear.ContainsKey($year)) { $byYear[$year] = [ordered]@{} }
    foreach ($date in $daysInFile.Keys) {
      if ($byYear[$year].Contains($date)) { throw "Duplicate date: $date" }
      $byYear[$year][$date] = $daysInFile[$date]
    }
  }
} finally {
  $zip.Dispose()
}

if (-not (Test-Path -LiteralPath $OutputDirectory)) {
  New-Item -ItemType Directory -Path $OutputDirectory | Out-Null
}

foreach ($year in ($byYear.Keys | Sort-Object)) {
  $orderedDays = [ordered]@{}
  foreach ($date in ($byYear[$year].Keys | Sort-Object)) { $orderedDays[$date] = $byYear[$year][$date] }
  $document = [ordered]@{
    station = 'Incheon'
    stationCode = 'DT_0001'
    year = [int]$year
    unit = 'cm'
    source = 'KHOA annual tide table (predicted high/low tides)'
    days = $orderedDays
  }
  $json = $document | ConvertTo-Json -Depth 7 -Compress
  $outputPath = Join-Path $OutputDirectory "tide-incheon-$year.json"
  [System.IO.File]::WriteAllText($outputPath, $json + "`n", $utf8NoBom)
  Write-Output "$outputPath ($($orderedDays.Count) days)"
}
