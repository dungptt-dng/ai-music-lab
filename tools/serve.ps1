# Máy chủ tĩnh cục bộ để chạy thử AI MUSIC LAB (chỉ truy cập được từ chính máy này).
# Cách dùng:  powershell -ExecutionPolicy Bypass -File tools\serve.ps1 [-Port 8765]
param([int]$Port = 8765)

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$types = @{
  '.html' = 'text/html; charset=utf-8'; '.css' = 'text/css; charset=utf-8';
  '.js' = 'text/javascript; charset=utf-8'; '.json' = 'application/json; charset=utf-8';
  '.svg' = 'image/svg+xml'; '.png' = 'image/png'; '.jpg' = 'image/jpeg'; '.ico' = 'image/x-icon';
  '.md' = 'text/plain; charset=utf-8'; '.csv' = 'text/csv; charset=utf-8'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "AI MUSIC LAB dang chay tai http://localhost:$Port/  (Ctrl+C de dung)"

try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $res = $ctx.Response
    try {
      $rel = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
      if ($rel -eq '' -or $rel.EndsWith('/')) { $rel = $rel + 'index.html' }
      $path = [IO.Path]::GetFullPath((Join-Path $root $rel))
      if (-not $path.StartsWith($root) -or -not (Test-Path $path -PathType Leaf)) {
        $res.StatusCode = 404
        $bytes = [Text.Encoding]::UTF8.GetBytes('Khong tim thay')
      } else {
        $ext = [IO.Path]::GetExtension($path).ToLower()
        $res.ContentType = if ($types.ContainsKey($ext)) { $types[$ext] } else { 'application/octet-stream' }
        $res.Headers.Add('Cache-Control', 'no-store')
        $bytes = [IO.File]::ReadAllBytes($path)
      }
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } catch {
      $res.StatusCode = 500
    } finally {
      $res.Close()
    }
  }
} finally {
  $listener.Stop()
}
