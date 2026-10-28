# Chụp ảnh giao diện AI MUSIC LAB cho hồ sơ dự thi (ảnh lưu vào ho-so/anh-giao-dien/).
# Cần chạy máy chủ cục bộ trước: powershell -ExecutionPolicy Bypass -File tools/serve.ps1
# Dùng Microsoft Edge chạy ẩn (headless) với hồ sơ trình duyệt riêng, không đụng tới dữ liệu của người dùng.
param([string]$Only = '')

$root = Split-Path -Parent $PSScriptRoot
$out = Join-Path $root 'ho-so\anh-giao-dien'
New-Item -ItemType Directory -Force $out | Out-Null
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
$profileDir = Join-Path $env:TEMP 'ai-music-lab-chup-anh'
$base = 'http://localhost:8765'

# Tên file, đường dẫn, rộng, cao, thời gian chờ (ms)
$shots = @(
  @('01-khuong-nhac',      '/tools/chup-anh.html?view=khuong-nhac&demo=cham-not', 1280, 860, 4000),
  @('02-tim-not',          '/tools/chup-anh.html?view=khuong-nhac&demo=tim-not-sai', 1280, 860, 4000),
  @('03-nghe-cao-do',      '/tools/chup-anh.html?view=nghe-cao-do', 1280, 860, 4000),
  @('04-trac-nghiem',      '/tools/chup-anh.html?view=trac-nghiem', 1280, 860, 4000),
  @('05-keo-tha',          '/tools/chup-anh.html?view=keo-tha', 1280, 860, 4000),
  @('06-sang-tao',         '/tools/chup-anh.html?view=sang-tao&demo=mau-giai-dieu', 1280, 860, 4000),
  @('07-bao-cao',          '/tools/chup-anh.html?view=khuong-nhac&demo=bao-cao-thu&scroll=%23view-bao-cao', 1280, 860, 12000),
  @('08-tro-ly-giao-vien', '/tools/chup-anh.html?view=tro-ly-giao-vien', 1280, 860, 5000)
)

foreach ($s in $shots) {
  if ($Only -and $s[0] -notlike "*$Only*") { continue }
  $file = Join-Path $out ($s[0] + '.png')
  $args = @('--headless=new', '--disable-gpu', '--hide-scrollbars', '--mute-audio', '--no-first-run', '--autoplay-policy=no-user-gesture-required',
    "--user-data-dir=$profileDir", "--window-size=$($s[2]),$($s[3])", "--virtual-time-budget=$($s[4])",
    "--screenshot=`"$file`"", ('"' + $base + $s[1] + '"'))
  Start-Process -FilePath $edge -ArgumentList $args -Wait -NoNewWindow
  Write-Output ("{0}: {1}" -f $s[0], (Test-Path $file))
}


# ---------- Ảnh cần chờ lâu hoặc cần giả lập điện thoại: dùng giao thức DevTools ----------
# Mở trang, hỏi định kỳ biểu thức $Ready (ví dụ window.__testResults), đúng thì mới chụp.
function Send-Cdp($ws, [int]$id, [string]$method, $params) {
  $json = @{ id = $id; method = $method; params = $params } | ConvertTo-Json -Depth 5 -Compress
  $bytes = [Text.Encoding]::UTF8.GetBytes($json)
  $ws.SendAsync([ArraySegment[byte]]$bytes, 'Text', $true, [Threading.CancellationToken]::None).Wait()
  $buffer = New-Object byte[] 65536
  while ($true) {
    $text = ''
    do {
      $r = $ws.ReceiveAsync([ArraySegment[byte]]$buffer, [Threading.CancellationToken]::None).Result
      $text += [Text.Encoding]::UTF8.GetString($buffer, 0, $r.Count)
    } while (-not $r.EndOfMessage)
    $msg = $text | ConvertFrom-Json
    if ($msg.id -eq $id) { return $msg }
  }
}

function Capture-Cdp([string]$Name, [string]$Path, [int]$Width, [int]$Height, [bool]$Mobile, [string]$Ready, [string]$Report) {
  if ($Only -and $Name -notlike "*$Only*") { return }
  $file = Join-Path $out ($Name + '.png')
  $port = 9333
  $proc = Start-Process -FilePath $edge -PassThru -NoNewWindow -ArgumentList @('--headless=new', '--disable-gpu', '--hide-scrollbars',
    '--mute-audio', '--no-first-run', '--autoplay-policy=no-user-gesture-required', "--user-data-dir=$profileDir-cdp",
    '--window-size=1280,900', "--remote-debugging-port=$port", 'about:blank')
  try {
    $target = $null
    for ($i = 0; $i -lt 50 -and -not $target; $i++) {
      Start-Sleep -Milliseconds 300
      try { $target = (Invoke-RestMethod "http://127.0.0.1:$port/json") | Where-Object { $_.type -eq 'page' } | Select-Object -First 1 } catch {}
    }
    $ws = New-Object Net.WebSockets.ClientWebSocket
    $ws.ConnectAsync([Uri]$target.webSocketDebuggerUrl, [Threading.CancellationToken]::None).Wait()
    $id = 1
    $null = Send-Cdp $ws $id 'Emulation.setDeviceMetricsOverride' @{ width = $Width; height = $Height; deviceScaleFactor = $(if ($Mobile) { 2 } else { 1 }); mobile = $Mobile }
    $id++; $null = Send-Cdp $ws $id 'Page.navigate' @{ url = $base + $Path }
    $done = $false
    for ($i = 0; $i -lt 120 -and -not $done; $i++) {
      Start-Sleep -Seconds 1
      $id++; $done = (Send-Cdp $ws $id 'Runtime.evaluate' @{ expression = $Ready; returnByValue = $true }).result.result.value
    }
    $summary = ''
    if ($Report) { $id++; $summary = (Send-Cdp $ws $id 'Runtime.evaluate' @{ expression = $Report; returnByValue = $true }).result.result.value }
    $id++; $shot = Send-Cdp $ws $id 'Page.captureScreenshot' @{ format = 'png' }
    [IO.File]::WriteAllBytes($file, [Convert]::FromBase64String($shot.result.data))
    Write-Output ("{0}: {1} {2}" -f $Name, (Test-Path $file), $summary)
  } finally {
    Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
  }
}

# Điện thoại 390 × 844 (Edge chạy ẩn không thu cửa sổ nhỏ hơn khoảng 500 px nên phải giả lập thiết bị).
Capture-Cdp '09-dien-thoai' '/tools/chup-anh.html?view=khuong-nhac&demo=cham-not' 390 844 $true '!!window.__done' ''
# Trang kiểm thử: chạy thật (âm thanh, khung iframe) nên chờ tới khi có kết quả; in ra các phép không đạt nếu có.
Capture-Cdp '10-kiem-thu' '/tests/kiem-thu.html' 1280 900 $false '!!window.__testResults' `
  'scrollTo(0,0); [document.getElementById("summary").textContent].concat([].map.call(document.querySelectorAll("td.bad"), function (td) { return "LOI: " + td.parentElement.cells[0].textContent + " => " + td.textContent; })).join("\n")'