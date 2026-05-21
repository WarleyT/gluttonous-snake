$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$artifactDir = Join-Path $root "artifacts"
$framesDir = Join-Path $artifactDir "ribbons-demo-frames"
$outFile = Join-Path $artifactDir "medal-ribbons-demo.mp4"
$thumbFile = Join-Path $artifactDir "medal-ribbons-demo-thumb.png"

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
$frames = 120

function Ease-Out-Cubic([double]$x) {
  return 1 - [Math]::Pow(1 - [Math]::Min(1, [Math]::Max(0, $x)), 3)
}

function Ease-Out-Back([double]$x) {
  $c1 = 1.70158
  $c3 = $c1 + 1
  $x = [Math]::Min(1, [Math]::Max(0, $x))
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

$fontTitle = [System.Drawing.Font]::new("Microsoft YaHei UI", 28, [System.Drawing.FontStyle]::Bold)
$fontBody = [System.Drawing.Font]::new("Microsoft YaHei UI", 14, [System.Drawing.FontStyle]::Bold)
$fontMedal = [System.Drawing.Font]::new("Arial", 24, [System.Drawing.FontStyle]::Bold)
$fontGold = [System.Drawing.Font]::new("Arial", 13, [System.Drawing.FontStyle]::Bold)
$fontTiny = [System.Drawing.Font]::new("Microsoft YaHei UI", 13, [System.Drawing.FontStyle]::Bold)

$ribbons = @(
  @{x=180; delay=0.18; speed=0.72; color=[System.Drawing.Color]::FromArgb(235,255,209,102); rot=-18; len=54},
  @{x=292; delay=0.28; speed=0.86; color=[System.Drawing.Color]::FromArgb(220,168,255,217); rot=24; len=46},
  @{x=426; delay=0.36; speed=0.66; color=[System.Drawing.Color]::FromArgb(220,255,84,112); rot=10; len=42},
  @{x=740; delay=0.20; speed=0.78; color=[System.Drawing.Color]::FromArgb(230,255,209,102); rot=22; len=52},
  @{x=890; delay=0.32; speed=0.74; color=[System.Drawing.Color]::FromArgb(220,168,255,217); rot=-28; len=46},
  @{x=1036; delay=0.44; speed=0.64; color=[System.Drawing.Color]::FromArgb(210,255,84,112); rot=-8; len=42},
  @{x=512; delay=0.48; speed=0.7; color=[System.Drawing.Color]::FromArgb(190,255,255,255); rot=34; len=32},
  @{x=982; delay=0.58; speed=0.68; color=[System.Drawing.Color]::FromArgb(190,255,255,255); rot=-32; len=32}
)

for ($i = 0; $i -lt $frames; $i++) {
  $t = $i / ($frames - 1)
  $seconds = $i / $fps
  $bmp = [System.Drawing.Bitmap]::new($width, $height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

  $bg = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
    [System.Drawing.Rectangle]::new(0, 0, $width, $height),
    [System.Drawing.Color]::FromArgb(255, 12, 20, 22),
    [System.Drawing.Color]::FromArgb(255, 10, 10, 15),
    20
  )
  $g.FillRectangle($bg, 0, 0, $width, $height)
  $bg.Dispose()

  # Ghosted game UI behind the overlay.
  $ghostBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(58, 21, 29, 36))
  Fill-RoundedRect $g $ghostBrush 120 68 138 64 8
  Fill-RoundedRect $g $ghostBrush 280 68 138 64 8
  Fill-RoundedRect $g $ghostBrush 440 68 138 64 8
  Fill-RoundedRect $g $ghostBrush 600 68 138 64 8
  Fill-RoundedRect $g $ghostBrush 180 170 420 420 8
  Fill-RoundedRect $g $ghostBrush 750 170 310 170 8
  $ghostBrush.Dispose()

  $overlayBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(138, 4, 8, 10))
  $g.FillRectangle($overlayBrush, 0, 0, $width, $height)
  $overlayBrush.Dispose()

  # Sparse ribbons, deliberately low density.
  foreach ($r in $ribbons) {
    $local = ($seconds - [double]$r.delay) / 2.4
    if ($local -lt 0 -or $local -gt 1.18) { continue }
    $fall = Ease-Out-Cubic([Math]::Min(1, $local))
    $x = [double]$r.x + [Math]::Sin(($seconds * 2.4) + ([double]$r.x / 80)) * 18
    $y = -70 + $fall * 530 * [double]$r.speed
    $alphaFade = if ($local -gt 0.92) { [Math]::Max(0, 1 - (($local - 0.92) / 0.26)) } else { 1 }
    $c = [System.Drawing.Color]$r.color
    $brush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb([int]($c.A * $alphaFade), $c.R, $c.G, $c.B))
    $g.TranslateTransform([float]$x, [float]$y)
    $g.RotateTransform([float]([double]$r.rot + [Math]::Sin($seconds * 4 + $x) * 7))
    $ribbonTop = -([float]$r.len / 2)
    Fill-RoundedRect $g $brush -4 $ribbonTop 8 ([float]$r.len) 4
    $g.ResetTransform()
    $brush.Dispose()
  }

  $intro = Ease-Out-Back(($seconds - 0.1) / 0.75)
  $intro = [Math]::Min(1.08, [Math]::Max(0, $intro))
  $settle = if ($seconds -gt 0.95) { 1 + [Math]::Sin(($seconds - 0.95) * 8) * 0.015 * [Math]::Max(0, 1 - (($seconds - 0.95) / 1.2)) } else { $intro }
  $scale = if ($seconds -lt 0.95) { $intro } else { $settle }
  $scale = [Math]::Max(0.05, $scale)
  $cardW = 410 * $scale
  $cardH = 200 * $scale
  $cardX = ($width - $cardW) / 2
  $cardY = 260 + (1 - $scale) * 46

  $shadowBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(80, 0, 0, 0))
  Fill-RoundedRect $g $shadowBrush ($cardX + 0) ($cardY + 18) $cardW $cardH 8
  $shadowBrush.Dispose()

  $cardBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
    [System.Drawing.RectangleF]::new([float]$cardX, [float]$cardY, [float]$cardW, [float]$cardH),
    [System.Drawing.Color]::FromArgb(242, 37, 47, 44),
    [System.Drawing.Color]::FromArgb(242, 21, 34, 39),
    25
  )
  Fill-RoundedRect $g $cardBrush $cardX $cardY $cardW $cardH 8
  $cardBrush.Dispose()
  $borderPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(120, 255, 209, 102), 1)
  Stroke-RoundedRect $g $borderPen $cardX $cardY $cardW $cardH 8
  $borderPen.Dispose()

  $medalY = $cardY + 56 * $scale
  $medalR = 31 * $scale
  $medalBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
    [System.Drawing.RectangleF]::new([float](($width / 2) - $medalR), [float]($medalY - $medalR), [float]($medalR * 2), [float]($medalR * 2)),
    [System.Drawing.Color]::FromArgb(255, 255, 239, 168),
    [System.Drawing.Color]::FromArgb(255, 255, 188, 55),
    45
  )
  $g.FillEllipse($medalBrush, [float](($width / 2) - $medalR), [float]($medalY - $medalR), [float]($medalR * 2), [float]($medalR * 2))
  $medalBrush.Dispose()

  $black = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 7, 17, 13))
  $white = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(245, 238, 247, 243))
  $muted = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(220, 145, 163, 155))
  $goldText = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 7, 17, 13))

  $sf = [System.Drawing.StringFormat]::new()
  $sf.Alignment = [System.Drawing.StringAlignment]::Center
  $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
  $g.DrawString("#1", $fontMedal, $black, [System.Drawing.RectangleF]::new(($width / 2) - $medalR, $medalY - $medalR + 1, $medalR * 2, $medalR * 2), $sf)
  $g.DrawString("冠军入榜", $fontTitle, $white, [System.Drawing.RectangleF]::new($cardX, $cardY + 83 * $scale, $cardW, 42 * $scale), $sf)
  $g.DrawString("奖牌轻弹入场，少量彩带从上方飘落", $fontBody, $muted, [System.Drawing.RectangleF]::new($cardX, $cardY + 123 * $scale, $cardW, 28 * $scale), $sf)

  $pillW = 60 * $scale
  $pillH = 26 * $scale
  $pillBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(235, 168, 255, 217))
  Fill-RoundedRect $g $pillBrush (($width - $pillW) / 2) ($cardY + 158 * $scale) $pillW $pillH 13
  $g.DrawString("GOLD", $fontGold, $goldText, [System.Drawing.RectangleF]::new(($width - $pillW) / 2, $cardY + 158 * $scale, $pillW, $pillH), $sf)

  $labelBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(210, 255, 209, 102))
  $g.DrawString("方案三 Demo：奖牌弹跳 + 彩带飘落", $fontTiny, $labelBrush, [System.Drawing.RectangleF]::new(0, 28, $width, 28), $sf)

  $sf.Dispose()
  $black.Dispose()
  $white.Dispose()
  $muted.Dispose()
  $goldText.Dispose()
  $pillBrush.Dispose()
  $labelBrush.Dispose()

  $framePath = Join-Path $framesDir ("frame_{0:D4}.png" -f $i)
  $bmp.Save($framePath, [System.Drawing.Imaging.ImageFormat]::Png)
  if ($i -eq 36) {
    $bmp.Save($thumbFile, [System.Drawing.Imaging.ImageFormat]::Png)
  }
  $g.Dispose()
  $bmp.Dispose()
}

ffmpeg -y -framerate $fps -i (Join-Path $framesDir "frame_%04d.png") -c:v libx264 -pix_fmt yuv420p -movflags +faststart $outFile | Out-Null

Write-Host $outFile
Write-Host $thumbFile
