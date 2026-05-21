$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$artifactDir = Join-Path $root "artifacts"
$framesDir = Join-Path $artifactDir "ribbons-reference-frames"
$outFile = Join-Path $artifactDir "medal-ribbons-reference-demo.mp4"
$thumbFile = Join-Path $artifactDir "medal-ribbons-reference-demo-thumb.png"

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
$frames = 126

function Clamp01([double]$x) {
  return [Math]::Min(1, [Math]::Max(0, $x))
}

function Ease-Out-Cubic([double]$x) {
  $x = Clamp01 $x
  return 1 - [Math]::Pow(1 - $x, 3)
}

function Ease-In-Out([double]$x) {
  $x = Clamp01 $x
  return $x * $x * (3 - 2 * $x)
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

function Draw-Bezier-Ribbon($g, [float[]]$points, [System.Drawing.Color]$color, [float]$width, [double]$progress, [float]$offsetY, [float]$sway) {
  if ($progress -le 0) { return }
  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $count = [Math]::Max(2, [Math]::Ceiling(32 * (Clamp01 $progress)))
  $samples = New-Object System.Collections.Generic.List[System.Drawing.PointF]
  for ($i = 0; $i -le $count; $i++) {
    $t = $i / $count
    $u = 1 - $t
    $x = $u * $u * $u * $points[0] + 3 * $u * $u * $t * $points[2] + 3 * $u * $t * $t * $points[4] + $t * $t * $t * $points[6]
    $y = $u * $u * $u * $points[1] + 3 * $u * $u * $t * $points[3] + 3 * $u * $t * $t * $points[5] + $t * $t * $t * $points[7]
    $samples.Add([System.Drawing.PointF]::new([float]($x + [Math]::Sin($t * 5 + $sway) * 6), [float]($y + $offsetY)))
  }
  if ($samples.Count -gt 1) {
    $path.AddLines($samples.ToArray())
    $pen = [System.Drawing.Pen]::new($color, $width)
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $g.DrawPath($pen, $path)
    $pen.Dispose()
  }
  $path.Dispose()
}

function Draw-Confetti($g, [double]$seconds, [double]$globalProgress) {
  $items = @(
    @{x=86;y=80;w=16;h=11;c=[System.Drawing.Color]::FromArgb(235,110,218,192);d=.12;s=.58;r=18},
    @{x=204;y=70;w=20;h=9;c=[System.Drawing.Color]::FromArgb(230,255,209,102);d=.18;s=.42;r=38},
    @{x=342;y=58;w=10;h=10;c=[System.Drawing.Color]::FromArgb(225,168,255,217);d=.24;s=.52;r=8},
    @{x=426;y=96;w=12;h=12;c=[System.Drawing.Color]::FromArgb(220,255,84,112);d=.32;s=.40;r=28},
    @{x=528;y=72;w=9;h=16;c=[System.Drawing.Color]::FromArgb(210,255,232,170);d=.15;s=.54;r=-24},
    @{x=584;y=120;w=12;h=12;c=[System.Drawing.Color]::FromArgb(230,97,224,199);d=.22;s=.24;r=18},
    @{x=628;y=118;w=10;h=10;c=[System.Drawing.Color]::FromArgb(230,255,209,102);d=.26;s=.26;r=18},
    @{x=722;y=66;w=14;h=14;c=[System.Drawing.Color]::FromArgb(225,97,224,199);d=.28;s=.45;r=12},
    @{x=832;y=48;w=10;h=20;c=[System.Drawing.Color]::FromArgb(225,255,209,102);d=.18;s=.60;r=34},
    @{x=950;y=88;w=18;h=10;c=[System.Drawing.Color]::FromArgb(218,168,255,217);d=.34;s=.44;r=-18},
    @{x=1068;y=65;w=11;h=11;c=[System.Drawing.Color]::FromArgb(215,255,84,112);d=.42;s=.50;r=42},
    @{x=1158;y=102;w=16;h=11;c=[System.Drawing.Color]::FromArgb(220,255,209,102);d=.25;s=.48;r=-34},
    @{x=155;y=162;w=10;h=10;c=[System.Drawing.Color]::FromArgb(205,168,255,217);d=.48;s=.35;r=22},
    @{x=282;y=182;w=9;h=9;c=[System.Drawing.Color]::FromArgb(200,255,209,102);d=.58;s=.32;r=-18},
    @{x=685;y=158;w=9;h=9;c=[System.Drawing.Color]::FromArgb(225,255,84,112);d=.35;s=.24;r=-12},
    @{x=1015;y=170;w=12;h=12;c=[System.Drawing.Color]::FromArgb(220,255,255,255);d=.42;s=.26;r=-20},
    @{x=1115;y=205;w=10;h=10;c=[System.Drawing.Color]::FromArgb(215,139,230,199);d=.48;s=.24;r=31}
  )
  foreach ($item in $items) {
    $local = Clamp01 (($seconds - [double]$item.d) / 2.3)
    if ($local -le 0) { continue }
    $fade = if ($local -gt .82) { [Math]::Max(0, 1 - (($local - .82) / .18)) } else { 1 }
    $c = [System.Drawing.Color]$item.c
    $brush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb([int]($c.A * $fade * $globalProgress), $c.R, $c.G, $c.B))
    $x = [float]([double]$item.x + [Math]::Sin($seconds * 2 + [double]$item.x) * 10)
    $y = [float]([double]$item.y + (Ease-Out-Cubic $local) * 230 * [double]$item.s)
    $g.TranslateTransform($x, $y)
    $g.RotateTransform([float]([double]$item.r + $seconds * 65 * [double]$item.s))
    $g.FillRectangle($brush, [float](-[double]$item.w / 2), [float](-[double]$item.h / 2), [float]$item.w, [float]$item.h)
    $g.ResetTransform()
    $brush.Dispose()
  }
}

$fontTitle = [System.Drawing.Font]::new("Microsoft YaHei UI", 28, [System.Drawing.FontStyle]::Bold)
$fontBody = [System.Drawing.Font]::new("Microsoft YaHei UI", 14, [System.Drawing.FontStyle]::Bold)
$fontMedal = [System.Drawing.Font]::new("Arial", 23, [System.Drawing.FontStyle]::Bold)
$fontGold = [System.Drawing.Font]::new("Arial", 13, [System.Drawing.FontStyle]::Bold)
$fontUi = [System.Drawing.Font]::new("Microsoft YaHei UI", 22, [System.Drawing.FontStyle]::Bold)
$fontTiny = [System.Drawing.Font]::new("Microsoft YaHei UI", 13, [System.Drawing.FontStyle]::Bold)

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
    20
  )
  $g.FillRectangle($bg, 0, 0, $width, $height)
  $bg.Dispose()

  # Blurred-feeling game UI silhouettes behind the modal, matching the reference image composition.
  $surface = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(64, 21, 29, 36))
  $surface2 = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(36, 168, 255, 217))
  Fill-RoundedRect $g $surface 68 72 142 60 8
  Fill-RoundedRect $g $surface 380 70 130 60 8
  Fill-RoundedRect $g $surface 540 70 130 60 8
  Fill-RoundedRect $g $surface 700 70 130 60 8
  Fill-RoundedRect $g $surface 96 170 420 420 8
  Fill-RoundedRect $g $surface 690 168 330 190 8
  Fill-RoundedRect $g $surface2 760 88 42 42 21
  Fill-RoundedRect $g $surface2 814 88 42 42 21
  Fill-RoundedRect $g $surface2 868 88 42 42 21
  $goldLabel = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(95, 255, 209, 102))
  $g.DrawString("SNAKE", $fontUi, $goldLabel, 84, 82)
  Fill-RoundedRect $g $surface2 122 610 240 50 8
  $surface.Dispose()
  $surface2.Dispose()
  $goldLabel.Dispose()

  $overlayProgress = Ease-Out-Cubic ($seconds / .5)
  $overlayBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb([int](158 * $overlayProgress), 3, 8, 10))
  $g.FillRectangle($overlayBrush, 0, 0, $width, $height)
  $overlayBrush.Dispose()

  $ribbonProgress = Ease-Out-Cubic (($seconds - .18) / 1.1)
  $ribbonOffset = [float]((1 - $ribbonProgress) * -90)
  $sway = [float]($seconds * 2.1)
  Draw-Bezier-Ribbon $g ([float[]]@(78, 120, 28, 210, 46, 292, 88, 360)) ([System.Drawing.Color]::FromArgb(210, 139, 230, 199)) 18 $ribbonProgress $ribbonOffset $sway
  Draw-Bezier-Ribbon $g ([float[]]@(238, 84, 210, 130, 248, 178, 214, 228)) ([System.Drawing.Color]::FromArgb(220, 255, 199, 74)) 7 (Ease-Out-Cubic (($seconds - .34) / .9)) $ribbonOffset ($sway + 1.4)
  Draw-Bezier-Ribbon $g ([float[]]@(1040, 82, 1004, 156, 1092, 212, 1058, 310)) ([System.Drawing.Color]::FromArgb(218, 255, 199, 74)) 17 (Ease-Out-Cubic (($seconds - .26) / 1.0)) $ribbonOffset ($sway + 2.2)
  Draw-Bezier-Ribbon $g ([float[]]@(1068, 388, 1124, 338, 1100, 276, 1160, 238)) ([System.Drawing.Color]::FromArgb(205, 139, 230, 199)) 16 (Ease-Out-Cubic (($seconds - .46) / .9)) $ribbonOffset ($sway + .6)
  Draw-Bezier-Ribbon $g ([float[]]@(198, 112, 256, 98, 314, 118, 354, 94)) ([System.Drawing.Color]::FromArgb(208, 255, 209, 102)) 10 (Ease-Out-Cubic (($seconds - .42) / .65)) $ribbonOffset ($sway + 3.4)

Draw-Confetti $g $seconds $overlayProgress

  $intro = Ease-Out-Back (($seconds - .18) / .72)
  $intro = [Math]::Min(1.06, [Math]::Max(.001, $intro))
  $settle = if ($seconds -gt 1.0) { 1 + [Math]::Sin(($seconds - 1.0) * 8) * .012 * [Math]::Max(0, 1 - (($seconds - 1.0) / 1.0)) } else { $intro }
  $scale = if ($seconds -lt 1.0) { $intro } else { $settle }
  $cardW = 420 * $scale
  $cardH = 210 * $scale
  $cardX = ($width - $cardW) / 2
  $cardY = 336 + (1 - $scale) * 48

  $glowAlpha = [int](20 * (Ease-Out-Cubic (($seconds - .35) / .8)))
  $glow = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb($glowAlpha, 255, 209, 102))
  $g.FillEllipse($glow, [float]($cardX - 40), [float]($cardY - 38), [float]($cardW + 80), [float]($cardH + 90))
  $glow.Dispose()

  $shadowBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(95, 0, 0, 0))
  Fill-RoundedRect $g $shadowBrush ($cardX + 0) ($cardY + 20) $cardW $cardH 8
  $shadowBrush.Dispose()

  $cardBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
    [System.Drawing.RectangleF]::new([float]$cardX, [float]$cardY, [float]$cardW, [float]$cardH),
    [System.Drawing.Color]::FromArgb(238, 58, 64, 48),
    [System.Drawing.Color]::FromArgb(238, 24, 42, 44),
    28
  )
  Fill-RoundedRect $g $cardBrush $cardX $cardY $cardW $cardH 8
  $cardBrush.Dispose()
  $borderPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(155, 255, 209, 102), 1)
  Stroke-RoundedRect $g $borderPen $cardX $cardY $cardW $cardH 8
  $borderPen.Dispose()

  $closeBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(86, 255, 255, 255))
  $g.FillEllipse($closeBrush, [float]($cardX + $cardW - 48), [float]($cardY + 17), 34, 34)
  $closeBrush.Dispose()

  $sf = [System.Drawing.StringFormat]::new()
  $sf.Alignment = [System.Drawing.StringAlignment]::Center
  $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
  $white = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(246, 238, 247, 243))
  $muted = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(222, 178, 192, 185))
  $black = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 7, 17, 13))

  $g.DrawString("x", $fontBody, $white, [System.Drawing.RectangleF]::new($cardX + $cardW - 48, $cardY + 16, 34, 34), $sf)

  $medalProgress = Ease-Out-Back (($seconds - .32) / .55)
  $medalProgress = [Math]::Min(1.06, [Math]::Max(.02, $medalProgress))
  $medalR = 32 * $medalProgress * $scale
  $medalX = $width / 2
  $medalY = $cardY + 58 * $scale - (1 - $medalProgress) * 25
  $medalBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
    [System.Drawing.RectangleF]::new([float]($medalX - $medalR), [float]($medalY - $medalR), [float]($medalR * 2), [float]($medalR * 2)),
    [System.Drawing.Color]::FromArgb(255, 255, 239, 168),
    [System.Drawing.Color]::FromArgb(255, 255, 190, 58),
    45
  )
  $g.FillEllipse($medalBrush, [float]($medalX - $medalR), [float]($medalY - $medalR), [float]($medalR * 2), [float]($medalR * 2))
  $medalBrush.Dispose()
  $g.DrawString("#1", $fontMedal, $black, [System.Drawing.RectangleF]::new($medalX - $medalR, $medalY - $medalR + 1, $medalR * 2, $medalR * 2), $sf)

  $textAlpha = [int](255 * (Ease-Out-Cubic (($seconds - .55) / .55)))
  $whiteText = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb($textAlpha, 238, 247, 243))
  $mutedText = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb([int]($textAlpha * .78), 178, 192, 185))
  $g.DrawString("Champion", $fontTitle, $whiteText, [System.Drawing.RectangleF]::new($cardX, $cardY + 92 * $scale, $cardW, 42 * $scale), $sf)
  $g.DrawString("A new leaderboard highlight is live", $fontBody, $mutedText, [System.Drawing.RectangleF]::new($cardX, $cardY + 132 * $scale, $cardW, 28 * $scale), $sf)

  $pillW = 60 * $scale
  $pillH = 25 * $scale
  $pillBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb([int](235 * $textAlpha / 255), 168, 255, 217))
  Fill-RoundedRect $g $pillBrush (($width - $pillW) / 2) ($cardY + 166 * $scale) $pillW $pillH 13
  $g.DrawString("GOLD", $fontGold, $black, [System.Drawing.RectangleF]::new(($width - $pillW) / 2, $cardY + 166 * $scale, $pillW, $pillH), $sf)

  $labelBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(160, 255, 209, 102))
  $g.DrawString("Option 3 reference-style demo", $fontTiny, $labelBrush, [System.Drawing.RectangleF]::new(0, 24, $width, 26), $sf)

  $sf.Dispose()
  $white.Dispose()
  $muted.Dispose()
  $black.Dispose()
  $whiteText.Dispose()
  $mutedText.Dispose()
  $pillBrush.Dispose()
  $labelBrush.Dispose()

  $framePath = Join-Path $framesDir ("frame_{0:D4}.png" -f $i)
  $bmp.Save($framePath, [System.Drawing.Imaging.ImageFormat]::Png)
  if ($i -eq 42) {
    $bmp.Save($thumbFile, [System.Drawing.Imaging.ImageFormat]::Png)
  }
  $g.Dispose()
  $bmp.Dispose()
}

ffmpeg -y -framerate $fps -i (Join-Path $framesDir "frame_%04d.png") -c:v libx264 -pix_fmt yuv420p -movflags +faststart $outFile | Out-Null

Write-Host $outFile
Write-Host $thumbFile
