# Tạo bộ PowerPoint dự thi ho-so/AI-MUSIC-LAB-du-thi.pptx bằng Microsoft PowerPoint (Windows).
# Ảnh lấy từ ho-so/anh-giao-dien/ (chạy tools/chup-anh.ps1 trước). Mỗi trang có ghi chú người trình bày.
# Tùy chọn -Preview <thư mục>: xuất ảnh PNG từng trang để kiểm tra.
param([string]$Preview = '')
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $PSScriptRoot
$shots = Join-Path $root 'ho-so\anh-giao-dien'
$outFile = Join-Path $root 'ho-so\AI-MUSIC-LAB-du-thi.pptx'
$tmp = Join-Path $env:TEMP 'ai-music-lab-pptx'
New-Item -ItemType Directory -Force $tmp | Out-Null

# ---------- Màu (PowerPoint dùng thứ tự B-G-R) ----------
function Rgb([string]$hex) { [Convert]::ToInt32($hex.Substring(4, 2) + $hex.Substring(2, 2) + $hex.Substring(0, 2), 16) }
$PRIMARY = Rgb '5B4FD6'; $PRIMARY_DARK = Rgb '2A2463'; $LILAC = Rgb 'ECE9FF'; $ACCENT = Rgb 'FF8A3D'
$INK = Rgb '2A2740'; $MUTED = Rgb '5E5A78'; $WHITE = Rgb 'FFFFFF'; $GOOD = Rgb '1F9D63'; $GOOD_SOFT = Rgb 'E3F7EC'
$WARN = Rgb 'C45C12'; $WARN_SOFT = Rgb 'FFF0E3'; $PEACH = Rgb 'FFF4EA'
$NL = [string][char]13
$FONT = 'Calibri'

# ---------- Cắt ảnh chụp cho vừa trang trình chiếu ----------
function Crop-Shot([string]$name, [int]$x, [int]$y, [int]$w, [int]$h) {
  $src = [Drawing.Image]::FromFile((Join-Path $shots $name))
  $bmp = New-Object Drawing.Bitmap $w, $h
  $g = [Drawing.Graphics]::FromImage($bmp)
  $g.DrawImage($src, (New-Object Drawing.Rectangle 0, 0, $w, $h), (New-Object Drawing.Rectangle $x, $y, $w, $h), 'Pixel')
  $g.Dispose(); $src.Dispose()
  $path = Join-Path $tmp $name
  $bmp.Save($path); $bmp.Dispose()
  return $path
}
$img = @{
  staff  = Crop-Shot '01-khuong-nhac.png' 156 143 968 717
  listen = Crop-Shot '03-nghe-cao-do.png' 156 143 968 560
  drag   = Crop-Shot '05-keo-tha.png' 156 143 968 636
  melody = Crop-Shot '06-sang-tao.png' 156 143 968 636
  report = Crop-Shot '07-bao-cao.png' 156 0 968 860
  phone  = Join-Path $shots '09-dien-thoai.png'
  tests  = Crop-Shot '10-kiem-thu.png' 0 0 1280 560
  teacher = Crop-Shot '08-tro-ly-giao-vien.png' 156 143 968 717
}

# ---------- Hàm vẽ ----------
function Text($s, $x, $y, $w, $h, [string]$text, $size = 16, $color = $INK, [bool]$bold = $false, $align = 1, [bool]$italic = $false) {
  $b = $s.Shapes.AddTextbox(1, $x, $y, $w, $h)
  $tf = $b.TextFrame
  $tf.WordWrap = -1; $tf.AutoSize = 0
  $tf.MarginLeft = 0; $tf.MarginRight = 0; $tf.MarginTop = 0; $tf.MarginBottom = 0
  $r = $tf.TextRange
  $r.Text = $text
  $r.Font.Name = $FONT; $r.Font.Size = $size; $r.Font.Color.RGB = $color
  $r.Font.Bold = $(if ($bold) { -1 } else { 0 }); $r.Font.Italic = $(if ($italic) { -1 } else { 0 })
  $r.ParagraphFormat.Alignment = $align
  return $b
}

function Box($s, $x, $y, $w, $h, $fill, $shape = 5, $radius = 0.08) {
  $b = $s.Shapes.AddShape($shape, $x, $y, $w, $h)
  $b.Fill.ForeColor.RGB = $fill; $b.Fill.Solid()
  $b.Line.Visible = 0; $b.Shadow.Visible = 0
  if ($shape -eq 5) { $b.Adjustments.Item(1) = $radius }
  $b.TextFrame.TextRange.Text = ''
  return $b
}

# Chữ trong một hình (canh giữa), ví dụ số thứ tự trong vòng tròn.
function Label($shape, [string]$text, $size, $color, [bool]$bold = $true) {
  $tf = $shape.TextFrame
  $tf.MarginLeft = 2; $tf.MarginRight = 2; $tf.MarginTop = 0; $tf.MarginBottom = 0; $tf.WordWrap = -1
  $tf.VerticalAnchor = 3
  $r = $tf.TextRange
  $r.Text = $text; $r.Font.Name = $FONT; $r.Font.Size = $size; $r.Font.Color.RGB = $color
  $r.Font.Bold = $(if ($bold) { -1 } else { 0 }); $r.ParagraphFormat.Alignment = 2
}

# Danh sách gạch đầu dòng; phần trước dấu ":" (nếu có, khi $lead) được in đậm.
function Bullets($s, $x, $y, $w, $h, [string[]]$items, $size = 16, $color = $INK, [bool]$lead = $false, $space = 8) {
  $b = Text $s $x $y $w $h ($items -join $NL) $size $color
  $r = $b.TextFrame.TextRange
  $r.ParagraphFormat.Bullet.Visible = -1
  $r.ParagraphFormat.Bullet.Character = 8226
  $r.ParagraphFormat.Bullet.Font.Color.RGB = $PRIMARY
  $r.ParagraphFormat.SpaceAfter = $space
  $b.TextFrame.Ruler.Levels.Item(1).FirstMargin = 0
  $b.TextFrame.Ruler.Levels.Item(1).LeftMargin = 16
  if ($lead) {
    for ($i = 1; $i -le $items.Count; $i++) {
      $p = $r.Paragraphs($i)
      $k = $items[$i - 1].IndexOf(':')
      if ($k -gt 0) { $p.Characters(1, $k + 1).Font.Bold = -1 }
    }
  }
  return $b
}

function Picture($s, [string]$path, $x, $y, $w, $h) {
  $p = $s.Shapes.AddPicture($path, 0, -1, $x, $y, $w, $h)
  $p.Line.Visible = -1; $p.Line.ForeColor.RGB = (Rgb 'DDD6F5'); $p.Line.Weight = 1
  return $p
}

function Table($s, $x, $y, $w, [object[]]$rows, [double[]]$widths, $size = 13, $rowHeight = 26) {
  $shape = $s.Shapes.AddTable($rows.Count, $rows[0].Count, $x, $y, $w, $rows.Count * $rowHeight)
  $t = $shape.Table
  for ($j = 1; $j -le $widths.Count; $j++) { $t.Columns.Item($j).Width = $widths[$j - 1] }
  for ($i = 1; $i -le $rows.Count; $i++) {
    for ($j = 1; $j -le $rows[0].Count; $j++) {
      $cell = $t.Cell($i, $j)
      $cell.Shape.Fill.ForeColor.RGB = $(if ($i -eq 1) { $PRIMARY } elseif ($i % 2 -eq 0) { $WHITE } else { (Rgb 'F6F4FF') })
      $tf = $cell.Shape.TextFrame
      $tf.MarginLeft = 6; $tf.MarginRight = 6; $tf.MarginTop = 4; $tf.MarginBottom = 4
      $r = $tf.TextRange
      $r.Text = [string]$rows[$i - 1][$j - 1]
      $r.Font.Name = $FONT; $r.Font.Size = $size
      $r.Font.Color.RGB = $(if ($i -eq 1) { $WHITE } else { $INK })
      $r.Font.Bold = $(if ($i -eq 1 -or $j -eq 1) { -1 } else { 0 })
    }
  }
  return $shape
}

function Notes($s, [string]$text) { $s.NotesPage.Shapes.Placeholders.Item(2).TextFrame.TextRange.Text = $text }

$script:slideNo = 0
# Trang nội dung: nền trắng, tiêu đề cùng vị trí, chân trang có tên sản phẩm và số trang.
function Content-Slide([string]$title) {
  $script:slideNo++
  $s = $pres.Slides.Add($script:slideNo, 12)
  $s.FollowMasterBackground = 0
  $s.Background.Fill.ForeColor.RGB = $WHITE
  $null = Text $s 40 26 880 44 $title 30 $INK $true
  $null = Text $s 40 510 600 16 'AI MUSIC LAB · Hồ sơ dự thi Đổi mới sáng tạo giáo dục với AI 2026' 10 $MUTED
  $null = Text $s 840 510 80 16 ([string]$script:slideNo) 10 $MUTED $false 3
  return $s
}

function Dark-Slide() {
  $script:slideNo++
  $s = $pres.Slides.Add($script:slideNo, 12)
  $s.FollowMasterBackground = 0
  $s.Background.Fill.ForeColor.RGB = $PRIMARY_DARK
  return $s
}

# ---------- Dựng bộ trình chiếu ----------
$app = New-Object -ComObject PowerPoint.Application
$pres = $app.Presentations.Add(0)
try {
  $pres.PageSetup.SlideWidth = 960
  $pres.PageSetup.SlideHeight = 540

  # 1. Bìa
  $s = Dark-Slide
  $null = Text $s 60 60 560 20 'DIỄN ĐÀN ĐỔI MỚI SÁNG TẠO GIÁO DỤC VIỆT NAM VỚI AI 2026' 13 (Rgb 'C9C3FF') $true
  $null = Text $s 60 120 560 70 'AI MUSIC LAB' 56 $WHITE $true
  $null = Text $s 60 192 560 36 'Phòng thí nghiệm âm nhạc số cho học sinh lớp 4–5' 24 $WHITE
  $tag = Box $s 60 250 470 40 $ACCENT 5 0.5
  Label $tag 'Nguyên mẫu học tập số có kiến trúc mở rộng AI' 16 $WHITE
  $null = Text $s 60 330 540 80 ("Tác giả: ……………………………" + $NL + "Đơn vị: ……………………………" + $NL + "Năm học 2026 – 2027") 16 (Rgb 'E4E0FF')
  $frame = Box $s 680 40 220 460 $WHITE 5 0.08
  $null = Picture $s $img.phone 692 52 196 424
  $null = Text $s 680 482 220 16 'Giao diện trên điện thoại' 11 (Rgb 'C9C3FF') $false 2
  Notes $s 'Giới thiệu tên sản phẩm và đối tượng. Nhấn mạnh: đây là nguyên mẫu học tập số; phần học sinh không dùng AI, AI chỉ ở trang dành cho giáo viên và có kiểm soát. Điền tên tác giả, đơn vị trước khi nộp.'

  # 2. Vấn đề
  $s = Content-Slide 'Vấn đề giáo dục cần giải quyết'
  $cards = @(
    @('🎼', 'Vị trí nốt trừu tượng', 'Nốt trên dòng, trong khe, dòng kẻ phụ dễ nhầm – nhất là các nốt cạnh nhau (Rê₄ – Mi₄, Si₄ – Đô₅).'),
    @('👂', 'Ít cơ hội luyện nghe riêng', 'Nhận biết cao độ cần luyện nhiều lần, nhưng thời lượng ít, lớp đông.'),
    @('📋', 'Khó biết em nào nhầm nốt nào', 'Giáo viên thiếu công cụ ghi nhận lỗi cụ thể của từng lần luyện tập.'),
    @('🎹', 'Ít cơ hội tự sáng tạo', 'Học sinh hiếm khi tự ghép giai điệu và kể về ý tưởng của mình.')
  )
  for ($i = 0; $i -lt 4; $i++) {
    $x = 40 + $i * 222
    $null = Box $s $x 100 206 250 $LILAC
    $c = Box $s ($x + 16) 116 52 52 $WHITE 9
    Label $c $cards[$i][0] 24 $INK $false
    $null = Text $s ($x + 16) 184 176 50 $cards[$i][1] 18 $PRIMARY $true
    $null = Text $s ($x + 16) 240 176 100 $cards[$i][2] 15 $INK
  }
  $null = Text $s 40 372 880 40 'Đây là nhận định ban đầu từ thực tế giảng dạy của tác giả; sẽ được khẳng định bằng khảo sát đầu vào trong kế hoạch thử nghiệm.' 13 $MUTED $false 1 $true
  Notes $s 'Nêu các khó khăn quan sát được khi dạy nội dung đọc nốt trên khuông khóa Sol ở lớp 4–5. Không đưa số liệu khi chưa khảo sát – nói rõ đây là nhận định ban đầu.'

  # 3. Mục tiêu và đối tượng
  $s = Content-Slide 'Mục tiêu và bối cảnh sử dụng'
  $null = Text $s 40 92 430 24 'Mục tiêu' 20 $PRIMARY $true
  $null = Bullets $s 40 126 420 300 @(
    'Nhận biết, đọc, nghe, ghi nhớ cao độ 8 nốt Đô₄ – Đô₅ trên khuông khóa Sol',
    'Sáng tạo giai điệu ngắn và diễn đạt cảm xúc, hình ảnh, câu chuyện',
    'Luyện tập theo tiến độ cá nhân, phản hồi tức thời và thân thiện',
    'Giáo viên có báo cáo trung thực về lỗi của học sinh',
    'Kiến trúc mở rộng AI an toàn, có kiểm soát chuyên môn') 17
  $ctx = @(
    @('Tiết học trên lớp', 'Giáo viên trình chiếu; học sinh lên thao tác trên bảng tương tác.'),
    @('Phòng máy / nhóm nhỏ', 'Mỗi em hoặc mỗi nhóm luyện riêng; cuối giờ xuất báo cáo.'),
    @('Ở nhà (tùy chọn)', 'Mở đường dẫn website trên điện thoại; không cần tài khoản.'))
  for ($i = 0; $i -lt 3; $i++) {
    $y = 92 + $i * 120
    $null = Box $s 500 $y 420 104 $LILAC
    $null = Text $s 520 ($y + 16) 380 24 $ctx[$i][0] 18 $PRIMARY $true
    $null = Text $s 520 ($y + 46) 380 50 $ctx[$i][1] 15 $INK
  }
  Notes $s 'Đối tượng: học sinh lớp 4–5 và giáo viên Âm nhạc. Phần học sinh chạy trên Chrome/Edge, không cần cài đặt, không hỏi họ tên; mở file index.html là dùng được cả khi không có mạng.'

  # 4. Sáu hoạt động
  $s = Content-Slide 'Sản phẩm: 6 hoạt động trong một web app'
  $acts = @(
    @('🎼', 'Khuông nhạc tương tác', 'Chạm nốt: tên, ký hiệu, tần số, vị trí, âm thanh; chế độ Tìm nốt'),
    @('👂', 'Nghe cao độ', '3 mức, âm mốc Đô₄; luyện tập và thử thách 5/10/15 câu'),
    @('✅', 'Trắc nghiệm', '5 dạng câu theo quy tắc nhạc lý, giải thích từng câu'),
    @('🎯', 'Kéo thả nốt', 'Đặt 8 nốt lên khuông, kiểm tra theo tọa độ thực tế'),
    @('🎹', 'Phòng sáng tạo', 'Ghép tối đa 16 nốt, phát lại, lưu JSON/PNG, kể ý tưởng'),
    @('📊', 'Báo cáo', 'Đúng/sai, nốt hay nhầm, xuất CSV/JSON, gợi ý luyện tập'))
  for ($i = 0; $i -lt 6; $i++) {
    $x = 40 + ($i % 3) * 296; $y = 96 + [math]::Floor($i / 3) * 196
    $null = Box $s $x $y 280 180 $LILAC
    $c = Box $s ($x + 18) ($y + 18) 50 50 $WHITE 9
    Label $c $acts[$i][0] 22 $INK $false
    $null = Text $s ($x + 82) ($y + 30) 186 30 $acts[$i][1] 18 $PRIMARY $true
    $null = Text $s ($x + 18) ($y + 84) 246 80 $acts[$i][2] 15 $INK
  }
  Notes $s 'Sáu hoạt động đi từ nhận biết (nhìn, nghe) đến vận dụng (kéo thả) và sáng tạo. Tất cả dùng quy tắc nhạc lý và âm thanh tổng hợp – không gắn nhãn AI.'

  # 5. Khuông nhạc + Nghe cao độ
  $s = Content-Slide 'Nhìn và nghe: Khuông nhạc tương tác, Nghe cao độ'
  $null = Picture $s $img.staff 40 92 430 318
  $null = Picture $s $img.listen 490 92 430 249
  $null = Text $s 40 418 430 60 'Chạm Sol₄: hiện G4 · 392,00 Hz · dòng kẻ thứ hai từ dưới lên. Bật/tắt tên nốt để tự luyện đọc.' 14 $INK
  $null = Text $s 490 350 430 110 'Nghe âm mốc Đô₄ rồi đoán nốt. Sai: hiện đáp án, so sánh cao – thấp, cho nghe lại. Có thanh âm lượng; báo rõ khi trình duyệt chặn âm thanh.' 14 $INK
  Notes $s 'Âm thanh tổng hợp bằng Web Audio API theo chuẩn A4 = 440 Hz. Đây là bài tập nhận biết cao độ từ âm thanh tổng hợp, không phải nhận diện giọng hát.'

  # 6. Kéo thả + Sáng tạo
  $s = Content-Slide 'Thực hành và sáng tạo: Kéo thả nốt, Phòng sáng tạo'
  $null = Picture $s $img.drag 40 92 430 283
  $null = Picture $s $img.melody 490 92 430 283
  $null = Text $s 40 388 430 60 'Kéo thẻ nốt lên khuông (chuột hoặc ngón tay). Vị trí kiểm tra theo tọa độ; đặt sai thì biết đang cao hơn hay thấp hơn.' 14 $INK
  $null = Text $s 490 388 430 60 'Ghép giai điệu, đổi thứ tự, phát ở 3 tốc độ; đặt tên và trả lời "Giai điệu gợi cảm xúc, hình ảnh gì?"' 14 $INK
  Notes $s 'Kéo thả kiểm tra vị trí thực tế trên khuông, không chỉ tên nốt. Phòng sáng tạo khuyến khích học sinh diễn giải ý tưởng; sản phẩm lưu được thành file JSON và ảnh PNG làm minh chứng.'

  # 7. Báo cáo
  $s = Content-Slide 'Báo cáo trung thực và gợi ý luyện tập'
  $null = Picture $s $img.report 40 88 372 330
  $null = Text $s 40 424 372 50 'Số liệu trong ảnh do người phát triển thao tác thử 4 câu – không phải kết quả học sinh.' 12 $WARN $false 1 $true
  $null = Bullets $s 440 92 480 380 @(
    'Chỉ tính câu đã thực sự trả lời: tách lần đầu và lần làm lại',
    'Phiên này / tích lũy: tách rõ; chỉ lưu trong trình duyệt khi người dùng bật',
    'Nốt hay nhầm: chỉ kết luận khi có từ 2 câu sai với cùng một nốt',
    'Xuất CSV/JSON, in: không có họ tên học sinh',
    'Gợi ý luyện tập tiếp theo: 5 quy tắc cố định, mỗi gợi ý kèm lý do – không dùng AI') 16 $INK $true 10
  Notes $s 'Báo cáo không tự tạo số liệu. Dữ liệu chỉ nằm trên máy, không đồng bộ, không có tài khoản. Gợi ý luyện tập là quy tắc minh bạch nên không gọi là AI.'

  # 8. Quy trình học tập
  $s = Content-Slide 'Quy trình học tập của học sinh'
  # Dấu ngoặc cần thiết: trong PowerShell dấu phẩy ưu tiên hơn phép cộng chuỗi.
  $steps = @(('Khám phá' + $NL + 'nhìn – nghe'), 'Tìm nốt', ('Nghe cao độ' + $NL + 'Dễ → Khó'), 'Trắc nghiệm', ('Kéo thả' + $NL + 'ghi nốt'), ('Sáng tạo' + $NL + 'kể ý tưởng'), ('Báo cáo' + $NL + 'gợi ý'))
  for ($i = 0; $i -lt 7; $i++) {
    $x = 40 + $i * 126
    $c = Box $s ($x + 31) 110 50 50 $(if ($i -eq 6) { $ACCENT } else { $PRIMARY }) 9
    Label $c ([string]($i + 1)) 20 $WHITE
    $null = Text $s $x 172 112 50 $steps[$i] 15 $INK $true 2
    if ($i -lt 6) { $a = Box $s ($x + 88) 128 70 14 (Rgb 'C9C3FF') 33; }
  }
  $null = Box $s 40 260 880 200 $PEACH
  $null = Text $s 64 276 830 26 'Ví dụ một tiết 35 phút (gợi ý, giáo viên điều chỉnh)' 18 $WARN $true
  $null = Bullets $s 64 312 830 140 @(
    '5 phút: hát thang âm, nghe cả 8 nốt',
    '8 phút: học sinh lên chạm nốt, đọc tên và vị trí (Khám phá, Tìm nốt)',
    '8 phút: nghe – đoán theo nhóm (Nghe cao độ, mức Dễ)',
    '9 phút: sáng tạo giai điệu 6–8 nốt và kể ý tưởng; 5 phút: xem báo cáo, giao luyện tập') 15 $INK $true 4
  Notes $s 'Chuỗi hoạt động đi từ nhận biết đến sáng tạo. Sau báo cáo, học sinh quay lại ôn phần còn yếu theo gợi ý.'

  # 9. Vai trò
  $s = Content-Slide 'Vai trò của giáo viên và của công nghệ'
  $null = Box $s 40 92 430 270 $LILAC
  $null = Text $s 64 108 380 28 '📚  Giáo viên' 20 $PRIMARY $true
  $null = Bullets $s 64 148 390 200 @('Thiết kế tiết học, chọn hoạt động và mức độ', 'Hướng dẫn, động viên, giải thích khi học sinh nhầm', 'Đánh giá học sinh, quyết định nội dung ôn tập', 'Đọc lại, chỉnh sửa nội dung AI soạn', 'Bảo vệ dữ liệu: dùng mã số thay tên') 16
  $null = Box $s 490 92 430 270 $GOOD_SOFT
  $null = Text $s 514 108 380 28 '💻  Công nghệ' 20 $GOOD $true
  $null = Bullets $s 514 148 390 200 @('Hoạt động tương tác, âm thanh chuẩn A4 = 440 Hz', 'Phản hồi tức thời, nêu lỗi cụ thể, cho thử lại', 'Ghi nhận kết quả thật, báo cáo, gợi ý có lý do', 'Không tự chấm điểm học sinh', 'Trợ lý AI soạn nội dung; máy kiểm tra đáp án') 16
  $null = Box $s 40 380 880 80 $PEACH
  $null = Text $s 64 396 830 50 'Nguyên tắc: công nghệ không thay giáo viên đánh giá học sinh. Mọi nội dung AI soạn đều phải được giáo viên đọc lại trước khi dùng.' 16 $WARN $true
  Notes $s 'Công nghệ hỗ trợ, giáo viên giữ vai trò quyết định sư phạm và đánh giá.'

  # 10. AI trung thực
  $s = Content-Slide 'Tích hợp AI một cách trung thực'
  $null = Table $s 40 92 880 @(
    @('Phân loại', 'Chức năng', 'Dùng AI?'),
    @('(1) Đã hoạt động', '6 hoạt động học sinh, báo cáo, xuất CSV/JSON', 'Không – quy tắc nhạc lý, âm thanh tổng hợp'),
    @('(2) Mới phát triển, đã kiểm thử', 'Gợi ý luyện tập tiếp theo', 'Không – 5 quy tắc cố định'),
    @('(3) Mới là đề xuất', 'AI hỗ trợ học sinh sáng tạo, diễn giải giai điệu', 'Sẽ cần AI; chưa làm (dữ liệu trẻ em)'),
    @('(4) Cần mô hình AI qua API', 'Trợ lý giáo viên: tạo câu hỏi theo mức độ, gợi ý thiết kế hoạt động', 'Có – Claude (Anthropic). Đã kiểm thử với AI giả lập, chưa chạy API thật')
  ) @(210, 330, 340) 15 52
  $null = Box $s 40 380 880 80 $PEACH
  $null = Text $s 64 394 830 56 'Vì phần học sinh chưa dùng mô hình AI, sản phẩm được giới thiệu là nguyên mẫu học tập số có kiến trúc mở rộng AI. Không gắn nhãn AI cho chức năng chỉ dùng quy tắc cố định.' 16 $WARN $true
  Notes $s 'Bảng này trả lời trực tiếp yêu cầu phân biệt 4 loại chức năng. Trợ lý giáo viên đã có mã máy chủ hoàn chỉnh, kiểm thử với AI giả lập; cần khóa API của nhà trường để chạy thật.'

  # 11. Quy trình AI
  $s = Content-Slide 'Trợ lý giáo viên: AI có kiểm soát chuyên môn'
  $flow = @(
    @('Giáo viên', 'chọn mức độ, nốt, dạng câu; nhập mã giáo viên'),
    @('Máy chủ của trường', 'kiểm tra mã, tham số; bỏ trường thừa'),
    @('Claude (Anthropic)', 'soạn câu hỏi / kế hoạch theo cấu trúc JSON'),
    @('Kiểm tra bằng quy tắc', 'tính lại đáp án, loại câu sai, lộ đáp án'),
    @('Giáo viên đọc lại', 'dùng, chỉnh sửa, tải văn bản/JSON'))
  for ($i = 0; $i -lt 5; $i++) {
    $x = 40 + $i * 180
    $fill = $(if ($i -eq 2) { $ACCENT } elseif ($i -eq 3) { $GOOD } else { $PRIMARY })
    $b = Box $s $x 96 160 70 $fill
    Label $b $flow[$i][0] 16 $WHITE
    $null = Text $s $x 176 160 60 $flow[$i][1] 13 $INK $false 2
    if ($i -lt 4) { $null = Box $s ($x + 162) 124 16 14 (Rgb 'C9C3FF') 33 }
  }
  $null = Bullets $s 40 260 520 220 @(
    'Khóa API: chỉ ở biến môi trường bí mật của máy chủ (Cloudflare), không có trong mã trình duyệt',
    'Không gửi dữ liệu học sinh: chỉ gửi lựa chọn trong form của giáo viên',
    'Đáp án không do AI quyết định: máy chủ tính lại bằng quy tắc nhạc lý',
    'Chi phí: ước tính 0,05–0,11 USD/lần, chưa đo thực tế; nhà trường đặt hạn mức') 15 $INK $true 8
  $null = Picture $s $img.teacher 600 256 320 237
  Notes $s 'Mô hình: Claude Opus 5.5 (claude-opus-5-5) của Anthropic qua SDK chính thức, chạy trên Cloudflare Pages Functions. Khi chưa cài máy chủ, trang giáo viên báo rõ và khóa nút tạo (như ảnh).'

  # 12. Điểm mới
  $s = Content-Slide 'Điểm mới của sản phẩm'
  $news = @(
    @('Chính xác được kiểm chứng', '8 nốt × 8 tiêu chí kiểm thử tự động; tần số đo lại từ âm thanh'),
    @('Nhìn – nghe – làm – sáng tạo', 'Một web app, chạy cả khi không có mạng'),
    @('Phản hồi theo đúng lỗi', 'Cao hơn/thấp hơn, so sánh và nghe lại hai nốt'),
    @('Báo cáo trung thực', 'Chỉ từ dữ liệu thật, phân biệt phiên và tích lũy'),
    @('AI có kiểm soát', 'Máy kiểm tra lại đáp án AI viết trước khi đến giáo viên'),
    @('Bảo vệ dữ liệu trẻ em', 'Không tài khoản, không họ tên, không gửi dữ liệu học sinh'))
  for ($i = 0; $i -lt 6; $i++) {
    $x = 40 + ($i % 2) * 446; $y = 92 + [math]::Floor($i / 2) * 128
    $null = Box $s $x $y 434 112 $LILAC
    $c = Box $s ($x + 18) ($y + 30) 50 50 $PRIMARY 9
    Label $c ([string]($i + 1)) 20 $WHITE
    $null = Text $s ($x + 84) ($y + 22) 330 26 $news[$i][0] 18 $PRIMARY $true
    $null = Text $s ($x + 84) ($y + 52) 330 50 $news[$i][1] 15 $INK
  }
  Notes $s 'Điểm mới nằm ở sự chính xác có kiểm chứng, phản hồi theo lỗi, báo cáo trung thực và cách tích hợp AI có kiểm soát.'

  # 13. Kiểm thử
  $s = Content-Slide 'Kiểm thử độ chính xác và chức năng'
  $stat = Box $s 40 92 260 150 $GOOD_SOFT
  $null = Text $s 40 108 260 70 '155/155' 54 $GOOD $true 2
  $null = Text $s 56 182 228 50 'phép kiểm thử tự động đạt (28/10/2026, Chromium và Edge)' 14 $INK $false 2
  $null = Bullets $s 40 260 260 220 @('8 nốt × 8 tiêu chí: 64 phép', '91 phép chức năng: đúng, sai, làm lại, tải lại trang, CSV/JSON, màn hình 360 px', 'Cố ý làm sai thì phép thử phát hiện') 14 $INK $false 6
  $null = Picture $s $img.tests 320 92 600 263
  $null = Box $s 320 372 600 104 $WARN_SOFT
  $null = Text $s 340 382 560 22 'Chưa kiểm chứng – cần kiểm tra thủ công / khi thử nghiệm' 15 $WARN $true
  $null = Text $s 340 408 560 64 'Nghe bằng tai trên loa lớp học · thiết bị thật (điện thoại, bảng tương tác) · tải file và in thật · Trợ lý AI với API thật · hiệu quả học tập với học sinh' 14 $INK
  Notes $s 'Ban giám khảo có thể mở tests/kiem-thu.html để tự chạy lại. Nêu rõ phần chưa kiểm chứng.'

  # 14. Giá trị sư phạm, nhân rộng
  $s = Content-Slide 'Giá trị sư phạm và khả năng nhân rộng'
  $null = Box $s 40 92 430 330 $LILAC
  $null = Box $s 490 92 430 330 $GOOD_SOFT
  $null = Text $s 64 108 380 26 '🎵  Giá trị sư phạm' 20 $PRIMARY $true
  $null = Bullets $s 64 148 390 270 @('Học qua trải nghiệm đa giác quan: nhìn, nghe, thao tác, sáng tạo', 'Hỗ trợ năng lực âm nhạc: thể hiện, cảm thụ và hiểu biết, ứng dụng và sáng tạo', 'Luyện theo tiến độ cá nhân, phản hồi không gây áp lực', 'Tự đánh giá qua báo cáo và gợi ý luyện tập', 'Phát triển ngôn ngữ khi kể về giai điệu') 16
  $null = Text $s 514 108 380 26 '🏫  Khả năng nhân rộng' 20 $GOOD $true
  $null = Bullets $s 514 148 390 270 @('Không cài đặt, không tài khoản; chạy trên Chrome/Edge', 'Trang tĩnh: lưu trữ miễn phí, hoặc chép USB dùng không cần mạng', 'Mã nguồn có chú thích và bộ kiểm thử – dễ mở rộng (thêm nốt, quãng, đổi "Sol/Son")', 'Phần AI là tùy chọn: trường chưa có điều kiện vẫn dùng đủ phần học sinh') 16
  Notes $s 'Nhấn mạnh chi phí triển khai thấp và tính an toàn dữ liệu – điều kiện quan trọng để nhân rộng ở trường tiểu học.'

  # 15. Hạn chế
  $s = Content-Slide 'Hạn chế hiện tại và hướng phát triển'
  $null = Table $s 40 92 880 @(
    @('Hạn chế hiện tại', 'Hướng phát triển'),
    @('Chỉ 8 nốt Đô₄–Đô₅; chưa có trường độ, nhịp, dấu hóa', 'Mở rộng trường độ, tiết tấu, quãng'),
    @('Âm thanh tổng hợp đơn giản', 'Âm sắc nhạc cụ có bản quyền phù hợp'),
    @('Dữ liệu chỉ trong trình duyệt từng máy, không đồng bộ', 'Tài khoản do nhà trường quản lý, có thông báo và đồng ý của phụ huynh'),
    @('Trợ lý AI chưa chạy với API thật', 'Triển khai thử, giáo viên chuyên môn đánh giá chất lượng, đo chi phí'),
    @('Chưa thử nghiệm với học sinh', 'Thực hiện kế hoạch thử nghiệm 7 tuần')
  ) @(440, 440) 15 50
  Notes $s 'Trình bày thẳng thắn các hạn chế – điều này giúp hồ sơ đáng tin cậy.'

  # 16. Kế hoạch thử nghiệm
  $s = Content-Slide 'Kế hoạch thử nghiệm thực tế (7 tuần)'
  $plan = @(@('Tuần 1', 'Xin phép, thông báo phụ huynh, gán mã số'), @('Tuần 1', 'Kiểm tra đầu vào trên giấy'), @('Tuần 2–5', 'Mỗi tuần 1 tiết dùng sản phẩm; xuất CSV/JSON'), @('Tuần 6', 'Kiểm tra đầu ra, phiếu phản hồi'), @('Tuần 7', 'Tổng hợp, rút kinh nghiệm'))
  for ($i = 0; $i -lt 5; $i++) {
    $x = 40 + $i * 180
    $b = Box $s $x 96 166 44 $(if ($i -eq 2) { $ACCENT } else { $PRIMARY }) 5 0.5
    Label $b $plan[$i][0] 16 $WHITE
    $null = Text $s ($x + 6) 150 154 70 $plan[$i][1] 14 $INK $false 2
  }
  $null = Table $s 40 236 880 @(
    @('Chỉ số (chỉ điền khi đã thu thập)', 'Kết quả', 'Cách thu thập'),
    @('Số lớp / số học sinh tham gia', '……', 'Danh sách mã số của giáo viên'),
    @('Điểm đọc nốt: đầu vào → đầu ra', '…… → ……', 'Bài kiểm tra trên giấy'),
    @('Tỷ lệ đúng lần đầu trong ứng dụng (tuần đầu → cuối)', '…… → ……', 'File CSV từ mục Báo cáo'),
    @('Mức độ yêu thích; nhận xét giáo viên', '……', 'Phiếu phản hồi thực tế')
  ) @(420, 160, 300) 14 40
  Notes $s 'Số liệu để trống cho đến khi thực sự thu thập. Nêu rõ số học sinh, thời gian, cách đo khi trình bày kết quả.'

  # 17. Minh chứng
  $s = Content-Slide 'Danh mục minh chứng'
  $null = Box $s 40 92 430 300 $GOOD_SOFT
  $null = Text $s 64 108 380 28 '✓ Đã có' 20 $GOOD $true
  $null = Bullets $s 64 148 390 230 @('10 ảnh giao diện (6 hoạt động, trang giáo viên, điện thoại, kiểm thử)', 'Trang kiểm thử tự động 155/155 – chạy lại được', 'Mã nguồn, hướng dẫn chạy và triển khai', 'Tài liệu kiến trúc AI, hồ sơ sản phẩm') 16
  $null = Box $s 490 92 430 300 $WARN_SOFT
  $null = Text $s 514 108 380 28 '○ Cần thu thập' 20 $WARN $true
  $null = Bullets $s 514 148 390 230 @('Website đang hoạt động và mã QR', 'Ảnh/video tiết học (không lộ mặt học sinh, có đồng ý)', 'Giai điệu học sinh tạo (JSON/PNG) kèm lời kể ý tưởng', 'CSV kết quả đã ẩn thông tin cá nhân', 'Phiếu phản hồi, kết quả kiểm tra đầu vào – đầu ra, xác nhận của nhà trường') 16
  $null = Text $s 40 412 880 40 'Chỉ dùng minh chứng thu thập hợp pháp: có sự đồng ý của nhà trường và phụ huynh, dùng mã số thay họ tên học sinh, không dựng lại hay ước đoán số liệu.' 14 $MUTED $false 1 $true
  Notes $s 'Chỉ đưa vào hồ sơ minh chứng thu thập hợp pháp; dùng mã số thay họ tên.'

  # 18. Kết
  $s = Dark-Slide
  $null = Text $s 60 120 840 70 'Cảm ơn quý thầy cô và ban giám khảo!' 40 $WHITE $true 2
  $null = Text $s 60 200 840 30 'AI MUSIC LAB – học nốt nhạc bằng cách nhìn, nghe, làm và sáng tạo' 20 (Rgb 'E4E0FF') $false 2
  $q = Box $s 400 260 160 160 $WHITE 5 0.06
  Label $q ('Mã QR website' + $NL + '(thêm sau khi triển khai)') 13 $MUTED $false
  $null = Text $s 60 440 840 24 'Website: ……………………………   ·   Liên hệ: ……………………………' 16 (Rgb 'E4E0FF') $false 2
  Notes $s 'Nếu trình diễn trực tiếp: mở sẵn website và trang kiểm thử. Thay ô mã QR bằng mã QR thật sau khi đưa website lên.'

  if (Test-Path $outFile) { Remove-Item $outFile -Force }
  $pres.SaveAs($outFile, 24)                         # ppSaveAsOpenXMLPresentation
  Write-Output ("Đã tạo: {0} ({1} trang)" -f $outFile, $pres.Slides.Count)
  if ($Preview) {
    New-Item -ItemType Directory -Force $Preview | Out-Null
    foreach ($slide in @($pres.Slides)) { $slide.Export((Join-Path $Preview ('slide-{0:D2}.png' -f $slide.SlideIndex)), 'PNG', 1280, 720) }
    Write-Output "Đã xuất ảnh xem trước vào $Preview"
  }
} finally {
  $pres.Close()
  $app.Quit()
}
