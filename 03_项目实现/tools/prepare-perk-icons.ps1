param([switch]$VerifyOnly,[switch]$ReplacePrepared)
$ErrorActionPreference = 'Stop'
if ($PSVersionTable.PSVersion.Major -gt 5) {
    $perkArguments = @('-NoProfile','-ExecutionPolicy','Bypass','-File',$PSCommandPath)
    if ($VerifyOnly) { $perkArguments += '-VerifyOnly' }
    if ($ReplacePrepared) { $perkArguments += '-ReplacePrepared' }
    & powershell.exe @perkArguments
    if ($LASTEXITCODE -ne 0) { throw 'Perk preparation failed in Windows PowerShell' }
    return
}
Add-Type -AssemblyName System.Drawing
$perkProject = Split-Path $PSScriptRoot -Parent
$perkManifest = Get-Content -LiteralPath (Join-Path $perkProject 'docs/perk-icons-generation-20261027/prompts.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$perkOutput = Join-Path $perkProject 'assets/perk-icons'
$perkEvidence = Join-Path $perkProject 'docs/perk-icons-generation-20261027'
Add-Type -ReferencedAssemblies @([System.Drawing.Bitmap].Assembly.Location,[System.Drawing.Rectangle].Assembly.Location) -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
public static class PerkIconPreparation {
    public static Rectangle Bounds(Bitmap bitmap,int minimumAlpha=1) {
        int left=bitmap.Width, top=bitmap.Height, right=-1, bottom=-1;
        for(int y=0;y<bitmap.Height;y++) for(int x=0;x<bitmap.Width;x++) {
            if(bitmap.GetPixel(x,y).A<minimumAlpha) continue;
            left=Math.Min(left,x); top=Math.Min(top,y);
            right=Math.Max(right,x); bottom=Math.Max(bottom,y);
        }
        if(right<left) throw new Exception("Empty perk");
        return Rectangle.FromLTRB(left,top,right+1,bottom+1);
    }
    public static void Normalize(string source,string destination,bool replacePrepared,string hex) {
        if(System.IO.File.Exists(destination) && !replacePrepared) throw new Exception("Refusing to overwrite: "+destination);
        using(var image=new Bitmap(source)) using(var result=new Bitmap(128,128,PixelFormat.Format32bppArgb)) {
            // Ignore alpha 1-3 generation speckles for framing only; retain a two-pixel edge margin.
            Color accent=ColorTranslator.FromHtml(hex);
            Rectangle bounds=Bounds(image,4);
            bounds.Inflate(2,2);
            bounds.Intersect(new Rectangle(0,0,image.Width,image.Height));
            double scale=88.0/Math.Max(bounds.Width,bounds.Height);
            int width=(int)Math.Round(bounds.Width*scale), height=(int)Math.Round(bounds.Height*scale);
            using(var graphics=Graphics.FromImage(result)) {
                graphics.Clear(Color.Transparent);
                graphics.CompositingMode=CompositingMode.SourceCopy;
                graphics.CompositingQuality=CompositingQuality.HighQuality;
                graphics.InterpolationMode=InterpolationMode.HighQualityBicubic;
                graphics.PixelOffsetMode=PixelOffsetMode.HighQuality;
                using(var attributes=new ImageAttributes()) {
                    attributes.SetWrapMode(WrapMode.TileFlipXY);
                    graphics.DrawImage(image,new Rectangle((128-width)/2,(128-height)/2,width,height),bounds.X,bounds.Y,bounds.Width,bounds.Height,GraphicsUnit.Pixel,attributes);
                }
            }
            // Silhouette export: one indexed-style RGB fill; preserve generated/resampled alpha exactly.
            for(int y=0;y<result.Height;y++) for(int x=0;x<result.Width;x++) {
                Color c=result.GetPixel(x,y);
                if(c.A>0) result.SetPixel(x,y,Color.FromArgb(c.A,accent.R,accent.G,accent.B));
            }
            result.Save(destination,ImageFormat.Png);
        }
    }
    public static bool SingleFill(Bitmap image,string hex) {
        Color accent=ColorTranslator.FromHtml(hex);
        for(int y=0;y<image.Height;y++) for(int x=0;x<image.Width;x++) {
            Color c=image.GetPixel(x,y);
            if(c.A>0 && (c.R!=accent.R || c.G!=accent.G || c.B!=accent.B)) return false;
        }
        return true;
    }
    public static void Preview(string[] paths,string[] labels,string destination,int mode) {
        int columns=5, cellWidth=160, cellHeight=mode==0?180:100, size=mode==0?128:40;
        int rows=(paths.Length+columns-1)/columns;
        using(var sheet=new Bitmap(columns*cellWidth,rows*cellHeight,PixelFormat.Format32bppArgb)) using(var graphics=Graphics.FromImage(sheet)) using(var font=new Font("Arial",10)) {
            graphics.Clear(Color.FromArgb(22,28,35));
            graphics.InterpolationMode=InterpolationMode.HighQualityBicubic;
            graphics.PixelOffsetMode=PixelOffsetMode.HighQuality;
            using(var light=new SolidBrush(Color.FromArgb(28,35,44))) using(var dark=new SolidBrush(Color.FromArgb(34,43,53))) {
                for(int i=0;i<paths.Length;i++) {
                    int ox=(i%columns)*cellWidth+(cellWidth-size)/2, oy=(i/columns)*cellHeight+8;
                    for(int y=0;y<size;y+=8) for(int x=0;x<size;x+=8) graphics.FillRectangle(((x+y)/8)%2==0?light:dark,ox+x,oy+y,Math.Min(8,size-x),Math.Min(8,size-y));
                    using(var image=new Bitmap(paths[i])) graphics.DrawImage(image,new Rectangle(ox,oy,size,size));
                    graphics.DrawString(labels[i],font,Brushes.White,(i%columns)*cellWidth+12,(i/columns)*cellHeight+(mode==0?146:62));
                }
            }
            sheet.Save(destination,ImageFormat.Png);
        }
    }
}
'@
if ($perkManifest.assets.Count -ne 25) { throw 'Expected 25 perk definitions' }
if (-not (Test-Path -LiteralPath $perkOutput)) { New-Item -ItemType Directory -Path $perkOutput | Out-Null }
if (-not $VerifyOnly) {
    foreach ($perkAsset in $perkManifest.assets) {
        [PerkIconPreparation]::Normalize($perkAsset.source,(Join-Path $perkOutput $perkAsset.file),$ReplacePrepared.IsPresent,$perkAsset.color)
    }
}
if (@(Get-ChildItem -LiteralPath $perkOutput -File -Filter '*.png').Count -ne 25) { throw 'Expected exactly 25 PNG files' }
$perkResults = foreach ($perkAsset in $perkManifest.assets) {
    $perkPath = Join-Path $perkOutput $perkAsset.file
    $perkBitmap = [System.Drawing.Bitmap]::new($perkPath)
    try {
        $perkBounds = [PerkIconPreparation]::Bounds($perkBitmap)
        $perkCorners = @($perkBitmap.GetPixel(0,0).A,$perkBitmap.GetPixel(127,0).A,$perkBitmap.GetPixel(0,127).A,$perkBitmap.GetPixel(127,127).A)
        $perkBorderMax = 0
        for ($perkCoord=0;$perkCoord -lt 128;$perkCoord++) {
            $perkBorderMax = [Math]::Max($perkBorderMax,[Math]::Max([Math]::Max($perkBitmap.GetPixel($perkCoord,0).A,$perkBitmap.GetPixel($perkCoord,127).A),[Math]::Max($perkBitmap.GetPixel(0,$perkCoord).A,$perkBitmap.GetPixel(127,$perkCoord).A)))
        }
        $perkExtent = [Math]::Max($perkBounds.Width,$perkBounds.Height)/128.0
        if ($perkBitmap.Width -ne 128 -or $perkBitmap.Height -ne 128 -or $perkBorderMax -ne 0 -or $perkExtent -lt 0.60 -or $perkExtent -gt 0.75) { throw "Invalid perk: $($perkAsset.file)" }
        $perkSingleFill = [PerkIconPreparation]::SingleFill($perkBitmap,$perkAsset.color)
        if (-not $perkSingleFill) { throw "Nonuniform fill: $($perkAsset.file)" }
        [pscustomobject]@{file=$perkAsset.file;width=$perkBitmap.Width;height=$perkBitmap.Height;pixelFormat=$perkBitmap.PixelFormat.ToString();cornerAlpha=$perkCorners;borderMaxAlpha=$perkBorderMax;bounds=@($perkBounds.X,$perkBounds.Y,$perkBounds.Width,$perkBounds.Height);longestExtent=$perkExtent;fillRGB=$perkAsset.color;singleFill=$perkSingleFill;sha256=(Get-FileHash -LiteralPath $perkPath -Algorithm SHA256).Hash.ToLowerInvariant()}
    } finally { $perkBitmap.Dispose() }
}
$perkResults | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $perkEvidence 'verification.json') -Encoding UTF8
[string[]]$perkPaths = @($perkManifest.assets | ForEach-Object { Join-Path $perkOutput $_.file })
[string[]]$perkLabels = @($perkManifest.assets | ForEach-Object { $_.file })
[PerkIconPreparation]::Preview($perkPaths,$perkLabels,(Join-Path $perkEvidence 'preview.png'),0)
[PerkIconPreparation]::Preview($perkPaths,$perkLabels,(Join-Path $perkEvidence 'preview-40px.png'),1)
$perkResults | Select-Object file,width,height,borderMaxAlpha,longestExtent | Format-Table
Write-Output 'PERK_ICONS_OK 25 PNGs, 128x128, transparent borders, silhouette extent 60-75%, single RGB fill'
