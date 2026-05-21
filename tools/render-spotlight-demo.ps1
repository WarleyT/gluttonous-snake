$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$artifactDir = Join-Path $root "artifacts"
$framesDir = Join-Path $artifactDir "spotlight-demo-frames"
$outFile = Join-Path $artifactDir "medal-spotlight-demo.mp4"
$thumbFile = Join-Path $artifactDir "medal-spotlight-demo-thumb.png"

if (!(Test-Path $artifactDir)) {
  New-Item -ItemType Directory -Path $artifactDir | Out-Null
}
if (Test-Path $framesDir) {
  Remove-Item -LiteralPath $framesDir -Recurse -Force
}
New-Item -ItemType Directory -Path $framesDir | Out-Null

$width = 1280
$height = 720
$fps = 30
$frames = 144

function Clamp01([double]$x) {
  return [Math]::Min(1, [Math]::Max(0, $x))
}

function Ease-Out-Cubic([double]$x) {
  $x = Clamp01 $x
  return 1 - [Math]::Pow(1 - $x, 3)
}

function Ease-Out-Back([double]$x) {
  $x = Clamp01 $x
  $c1 = 1.70158
  $c3 = $c1 + 1
  return 1 + $c3 * [Math]::Pow($x - 1, 3) + $c1 * [Math]::Pow($x - 1, 2)
}

function New-Path-RoundedRect([float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $d = $r * 2
  $path.AddArc($x, $y, $d, $d, 180, 90)
  $path.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $path.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $path.CloseFigure()
  return $path
}

function Fill-RoundedRect($g, $brush, [float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
  $path = New-Path-RoundedRect $x $y $w $h $r
  $g.FillPath($brush, $path)
  $path.Dispose()
}

function Stroke-RoundedRect($g, $pen, [float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
  $path = New-Path-RoundedRect $x $y $w $h $r
  $g.DrawPath($pen, $path)
  $path.Dispose()
}

function New-ChineseText([int[]]$codes) {
  return -join ($codes | ForEach-Object { [char]$_ })
}

function Draw-CenteredText($g, [string]$text, $font, $brush, [float]$x, [float]$y, [float]$w, [float]$h) {
  $sf = [System.Drawing.StringFormat]::new()
  $sf.Alignment = [System.Drawing.StringAlignment]::Center
  $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
  $g.DrawString($text, $font, $brush, [System.Drawing.RectangleF]::new($x, $y, $w, $h), $sf)
  $sf.Dispose()
}

function Draw-Star($g, [float]$cx, [float]$cy, [float]$r, [int]$alpha) {
  $pen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb($alpha, 255, 214, 91), 1.5)
  $g.DrawLine($pen, $cx - $r, $cy, $cx + $r, $cy)
  $g.DrawLine($pen, $cx, $cy - $r, $cx, $cy + $r)
  $pen.Dispose()
}

function Draw-Game-Ghost($g, [double]$pulse) {
  $panel = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(64, 17, 27, 32))
  $soft = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(42, 150, 255, 215))
  $line = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(30, 178, 225, 219), 1)
  Fill-RoundedRect $g $panel 78 66 165 74 10
  Fill-RoundedRect $g $panel 612 66 132 74 10
  Fill-RoundedRect $g $panel 772 66 132 74 10
  Fill-RoundedRect $g $panel 932 66 132 74 10
  Fill-RoundedRect $g $panel 160 164 470 420 10
  Fill-RoundedRect $g $panel 706 166 350 188 10
  Fill-RoundedRect $g $soft 944 76 42 42 21
  Fill-RoundedRect $g $soft 1002 76 42 42 21
  Fill-RoundedRect $g $soft 1060 76 42 42 21
  $g.DrawLine($line, 200, 472, 530, 472)
  Fill-RoundedRect $g $soft 248 524 270 43 8
  $panel.Dispose()
  $soft.Dispose()
  $line.Dispose()
}

function Draw-Spotlight($g, [double]$seconds) {
  $open = Ease-Out-Cubic (($seconds - 0.1) / 1.1)
  $twinkle = 0.78 + [Math]::Sin($seconds * 5.6) * 0.1
  $strength = $open * $twinkle
  $originX = 640
  $originY = 300

  for ($r = 0; $r -lt 17; $r++) {
    $angle = -158 + $r * 8.4 + [Math]::Sin($seconds * 0.9 + $r) * 2.2
    $spread = 4.2 + ($r % 3) * 1.8
    $len = 250 + (($r * 41) % 170)
    $alpha = [int](32 * $strength * (1 - [Math]::Abs($r - 8) / 11))
    if ($alpha -le 0) { continue }

    $a1 = ($angle - $spread) * [Math]::PI / 180
    $a2 = ($angle + $spread) * [Math]::PI / 180
    $p = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $p.AddPolygon(@(
      [System.Drawing.PointF]::new([float]$originX, [float]$originY),
      [System.Drawing.PointF]::new([float]($originX + [Math]::Cos($a1) * $len), [float]($originY + [Math]::Sin($a1) * $len)),
      [System.Drawing.PointF]::new([float]($originX + [Math]::Cos($a2) * $len), [float]($originY + [Math]::Sin($a2) * $len))
    ))
    $brush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb($alpha, 255, 191, 69))
    $g.FillPath($brush, $p)
    $brush.Dispose()
    $p.Dispose()
  }

  for ($ring = 0; $ring -lt 3; $ring++) {
    $size = 170 + $ring * 110 + [Math]::Sin($seconds * 2 + $ring) * 10
    $alpha = [int]((24 - $ring * 6) * $strength)
    $brush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb($alpha, 255, 191, 69))
    $g.FillEllipse($brush, [float]($originX - $size / 2), [float]($originY - $size * 0.46), [float]$size, [float]($size * 0.82))
    $brush.Dispose()
  }
}

function Draw-Particles($g, [double]$seconds) {
  for ($i = 0; $i -lt 95; $i++) {
    $seed = $i * 97
    $baseX = 170 + (($seed * 37) % 920)
    $baseY = 130 + (($seed * 53) % 300)
    $phase = (($seed % 100) / 100.0)
    $appear = Ease-Out-Cubic (($seconds - 0.28 - $phase * 0.9) / 1.2)
    if ($appear -le 0) { continue }
    $fade = if ($seconds -gt 3.55) { [Math]::Max(0, 1 - (($seconds - 3.55) / 0.8)) } else { 1 }
    $x = $baseX + [Math]::Sin($seconds * 1.6 + $phase * 8) * 30
    $y = $baseY + [Math]::Sin($seconds * 1.1 + $phase * 7) * 12 - $seconds * (5 + ($i % 4))
    $size = 1.2 + (($seed % 7) / 7.0) * 2.6
    $alpha = [int](210 * $appear * $fade * (0.7 + [Math]::Sin($seconds * 6 + $i) * 0.3))
    if ($alpha -lt 20) { continue }
    if ($i % 11 -eq 0) {
      Draw-Star $g ([float]$x) ([float]$y) ([float]($size + 2.4)) $alpha
    } else {
      $brush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb($alpha, 255, 207, 75))
      $g.FillEllipse($brush, [float]$x, [float]$y, [float]$size, [float]$size)
      $brush.Dispose()
    }
  }
}

$title = New-ChineseText @(0x51A0,0x519B,0x5165,0x699C)
$body = New-ChineseText @(0x65B0,0x7684,0x699C,0x9996,0x9AD8,0x5149,0x5DF2,0x70B9,0x4EAE)
$tag = "GOLD"

$fontTitle = [System.Drawing.Font]::new("Microsoft YaHei UI", 24, [System.Drawing.FontStyle]::Bold)
$fontBody = [System.Drawing.Font]::new("Microsoft YaHei UI", 13, [System.Drawing.FontStyle]::Bold)
$fontMedal = [System.Drawing.Font]::new("Arial", 25, [System.Drawing.FontStyle]::Bold)
$fontGold = [System.Drawing.Font]::new("Arial", 13, [System.Drawing.FontStyle]::Bold)

for ($i = 0; $i -lt $frames; $i++) {
  $seconds = $i / $fps
  $bmp = [System.Drawing.Bitmap]::new($width, $height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

  $bg = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
    [System.Drawing.Rectangle]::new(0, 0, $width, $height),
    [System.Drawing.Color]::FromArgb(255, 9, 18, 20),
    [System.Drawing.Color]::FromArgb(255, 8, 9, 13),
    25
  )
  $g.FillRectangle($bg, 0, 0, $width, $height)
  $bg.Dispose()

  Draw-Game-Ghost $g $seconds
  $veil = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(172, 3, 7, 10))
  $g.FillRectangle($veil, 0, 0, $width, $height)
  $veil.Dispose()

  Draw-Spotlight $g $seconds
  Draw-Particles $g $seconds

  $intro = Ease-Out-Back (($seconds - 0.16) / 0.7)
  $scale = [Math]::Min(1, [Math]::Max(0.18, $intro))
  $rest = if ($seconds -gt 1.05) { 1 + [Math]::Sin(($seconds - 1.05) * 6.2) * 0.01 * [Math]::Max(0, 1 - (($seconds - 1.05) / 2.0)) } else { $scale }
  $scale = if ($seconds -gt 1.05) { $rest } else { $scale }
  $cardW = 410 * $scale
  $cardH = 206 * $scale
  $cardX = ($width - $cardW) / 2
  $cardY = 226 + (1 - $scale) * 38

  $shadow = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(105, 0, 0, 0))
  Fill-RoundedRect $g $shadow ($cardX + 0) ($cardY + 22) $cardW $cardH 9
  $shadow.Dispose()

  $cardBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(237, 34, 45, 42))
  Fill-RoundedRect $g $cardBrush $cardX $cardY $cardW $cardH 9
  $cardBrush.Dispose()

  $border = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(144, 255, 210, 91), 1)
  Stroke-RoundedRect $g $border $cardX $cardY $cardW $cardH 9
  $border.Dispose()

  $medalOpen = Ease-Out-Back (($seconds - 0.42) / 0.58)
  $medalScale = [Math]::Max(0.2, [Math]::Min(1.08, $medalOpen))
  $medalR = 32 * $scale * $medalScale
  $medalX = $width / 2
  $medalY = $cardY + 55 * $scale
  $medalBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 255, 205, 72))
  $g.FillEllipse($medalBrush, [float]($medalX - $medalR), [float]($medalY - $medalR), [float]($medalR * 2), [float]($medalR * 2))
  $medalBrush.Dispose()

  $black = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 9, 18, 14))
  $white = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(248, 241, 248, 244))
  $muted = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(225, 176, 192, 184))
  Draw-CenteredText $g "#1" $fontMedal $black ([float]($medalX - 36 * $scale)) ([float]($medalY - 25 * $scale)) ([float](72 * $scale)) ([float](50 * $scale))
  Draw-CenteredText $g $title $fontTitle $white ([float]$cardX) ([float]($cardY + 90 * $scale)) ([float]$cardW) ([float](34 * $scale))
  Draw-CenteredText $g $body $fontBody $muted ([float]$cardX) ([float]($cardY + 127 * $scale)) ([float]$cardW) ([float](28 * $scale))

  $pillW = 62 * $scale
  $pillH = 26 * $scale
  $pillBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(242, 163, 255, 215))
  Fill-RoundedRect $g $pillBrush (($width - $pillW) / 2) ($cardY + 160 * $scale) $pillW $pillH 13
  Draw-CenteredText $g $tag $fontGold $black ([float](($width - $pillW) / 2)) ([float]($cardY + 160 * $scale)) ([float]$pillW) ([float]$pillH)
  $pillBrush.Dispose()

  $closeBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(120, 223, 233, 227))
  $closeR = 17 * $scale
  $closeX = $cardX + $cardW - 30 * $scale
  $closeY = $cardY + 28 * $scale
  $g.FillEllipse($closeBrush, [float]($closeX - $closeR), [float]($closeY - $closeR), [float]($closeR * 2), [float]($closeR * 2))
  $closeBrush.Dispose()
  Draw-CenteredText $g "x" $fontGold $white ([float]($closeX - $closeR)) ([float]($closeY - $closeR - 1)) ([float]($closeR * 2)) ([float]($closeR * 2))

  $black.Dispose()
  $white.Dispose()
  $muted.Dispose()

  $framePath = Join-Path $framesDir ("frame_{0:D4}.png" -f $i)
  $bmp.Save($framePath, [System.Drawing.Imaging.ImageFormat]::Png)
  if ($i -eq 45) {
    $bmp.Save($thumbFile, [System.Drawing.Imaging.ImageFormat]::Png)
  }
  $g.Dispose()
  $bmp.Dispose()
}

ffmpeg -y -framerate $fps -i (Join-Path $framesDir "frame_%04d.png") -c:v libx264 -pix_fmt yuv420p -movflags +faststart $outFile | Out-Null

Write-Host $outFile
Write-Host $thumbFile
