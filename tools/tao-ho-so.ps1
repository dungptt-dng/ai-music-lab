# Tạo Hồ sơ dự thi từ ho-so/nguon/ho-so-du-thi.html:
#   - .docx: Microsoft Word mở trang HTML, nhúng ảnh, đặt khổ A4 và số trang; nội dung Word đã dựng (OOXML)
#     được đóng gói thẳng thành file .docx. (Trên máy phát triển, lệnh "Lưu" của Word tự động hóa bị treo ở một
#     hộp thoại ẩn, nên không dùng SaveAs.)
#   - .pdf: Microsoft Edge in trang HTML ra PDF.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$src = Join-Path $root 'ho-so\nguon\ho-so-du-thi.html'
$docx = Join-Path $root 'ho-so\Ho-so-du-thi-AI-MUSIC-LAB.docx'
$pdf = Join-Path $root 'ho-so\Ho-so-du-thi-AI-MUSIC-LAB.pdf'

# ---------- 1. Word dựng tài liệu ----------
$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
try {
  $m = [Type]::Missing
  # Mở dạng trang web (Format 7), mã hóa UTF-8 (65001) để Word không hỏi.
  $doc = $word.Documents.Open($src, $false, $true, $false, $m, $m, $m, $m, $m, 7, 65001)
  $doc.ActiveWindow.View.Type = 3                     # bố cục trang in

  # Nhúng ảnh vào tài liệu (khi mở từ HTML, Word chỉ liên kết tới file ảnh).
  foreach ($shape in @($doc.InlineShapes)) {
    if ($shape.LinkFormat) {
      $shape.LinkFormat.SavePictureWithDocument = $true
      $shape.LinkFormat.BreakLink()
    }
  }

  # Khổ A4, lề 2 cm (trái 2,5 cm để đóng quyển), số trang ở giữa chân trang.
  $cm = 28.3465
  foreach ($section in @($doc.Sections)) {
    $ps = $section.PageSetup
    $ps.PaperSize = 7                                  # wdPaperA4
    $ps.TopMargin = 2 * $cm; $ps.BottomMargin = 2 * $cm
    $ps.LeftMargin = 2.5 * $cm; $ps.RightMargin = 2 * $cm
    $null = $section.Footers.Item(1).PageNumbers.Add(1, $true)
  }
  $pages = $doc.ComputeStatistics(2)
  $pictures = $doc.InlineShapes.Count
  $flat = $doc.WordOpenXML                             # toàn bộ tài liệu dạng Flat OPC (gồm cả ảnh)
  $doc.Close($false)
} finally {
  $word.Quit()
}

# ---------- 2. Đóng gói Flat OPC thành file .docx (ZIP) ----------
Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem
$xml = New-Object Xml.XmlDocument
$xml.LoadXml($flat)
$pkgNs = 'http://schemas.microsoft.com/office/2006/xmlPackage'
$ns = New-Object Xml.XmlNamespaceManager $xml.NameTable
$ns.AddNamespace('pkg', $pkgNs)
$parts = $xml.SelectNodes('//pkg:part', $ns)

$types = New-Object Text.StringBuilder
[void]$types.Append('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">')
[void]$types.Append('<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>')
foreach ($part in $parts) {
  $name = $part.GetAttribute('name', $pkgNs)
  if ($name -notlike '*.rels') { [void]$types.Append('<Override PartName="' + $name + '" ContentType="' + $part.GetAttribute('contentType', $pkgNs) + '"/>') }
}
[void]$types.Append('</Types>')

if (Test-Path $docx) { Remove-Item $docx -Force }
$utf8 = New-Object Text.UTF8Encoding $false
$zip = [IO.Compression.ZipFile]::Open($docx, 'Create')
try {
  function Add-Entry($name, [byte[]]$bytes) {
    $entry = $zip.CreateEntry($name, 'Optimal')
    $stream = $entry.Open(); $stream.Write($bytes, 0, $bytes.Length); $stream.Close()
  }
  Add-Entry '[Content_Types].xml' $utf8.GetBytes($types.ToString())
  foreach ($part in $parts) {
    $name = $part.GetAttribute('name', $pkgNs).TrimStart('/')
    $data = $part.SelectSingleNode('pkg:xmlData', $ns)
    if ($data) {
      Add-Entry $name $utf8.GetBytes('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' + $data.FirstChild.OuterXml)
    } else {
      Add-Entry $name ([Convert]::FromBase64String($part.SelectSingleNode('pkg:binaryData', $ns).InnerText))
    }
  }
} finally {
  $zip.Dispose()
}
Write-Output ("Đã tạo: {0} ({1} trang, {2} ảnh, {3} phần)" -f $docx, $pages, $pictures, $parts.Count)

# ---------- 3. PDF bằng Microsoft Edge ----------
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
$profileDir = Join-Path $env:TEMP 'ai-music-lab-pdf'
Start-Process -FilePath $edge -Wait -NoNewWindow -ArgumentList @('--headless=new', '--disable-gpu', '--no-first-run',
  "--user-data-dir=$profileDir", '--no-pdf-header-footer', "--print-to-pdf=`"$pdf`"", ('"file:///' + ($src -replace '\\', '/') + '"'))
Write-Output ("Đã tạo: {0}" -f $pdf)
