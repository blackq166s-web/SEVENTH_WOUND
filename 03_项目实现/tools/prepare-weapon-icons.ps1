param([switch]$VerifyOnly,[switch]$ReplacePrepared)
$ErrorActionPreference = 'Stop'
if ($PSVersionTable.PSVersion.Major -gt 5) {
    $spriteArguments = @('-NoProfile','-ExecutionPolicy','Bypass','-File',$PSCommandPath)
    if ($VerifyOnly) { $spriteArguments += '-VerifyOnly' }
    if ($ReplacePrepared) { $spriteArguments += '-ReplacePrepared' }
    & powershell.exe @spriteArguments
    if ($LASTEXITCODE -ne 0) { throw 'Sprite preparation failed in Windows PowerShell' }
    return
}
Add-Type -AssemblyName System.Drawing
$spriteProject = Split-Path $PSScriptRoot -Parent
$spriteManifest = Get-Content -LiteralPath (Join-Path $spriteProject 'docs/weapon-icons-generation-20261022/prompts.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$spriteOutput = Join-Path $spriteProject 'assets/weapon-icons'
$spriteEvidence = Join-Path $spriteProject 'docs/weapon-icons-generation-20261022'
Add-Type -ReferencedAssemblies @([System.Drawing.Bitmap].Assembly.Location,[System.Drawing.Rectangle].Assembly.Location) -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
public static class WeaponIconPreparation {
    public static Rectangle Bounds(Bitmap bitmap,int minimumAlpha=1) {
        int left=bitmap.Width, top=bitmap.Height, right=-1, bottom=-1;
        for(int y=0;y<bitmap.Height;y++) for(int x=0;x<bitmap.Width;x++) {
            if(bitmap.GetPixel(x,y).A<minimumAlpha) continue;
            left=Math.Min(left,x); top=Math.Min(top,y);
            right=Math.Max(right,x); bottom=Math.Max(bottom,y);
        }
        if(right<left) throw new Exception("Empty sprite");
        return Rectangle.FromLTRB(left,top,right+1,bottom+1);
    }
    public static void Normalize(string source,string destination,bool replacePrepared) {
        if(System.IO.File.Exists(destination) && !replacePrepared) throw new Exception("Refusing to overwrite: "+destination);
        using(var image=new Bitmap(source)) using(var result=new Bitmap(128,128,PixelFormat.Format32bppArgb)) {
            // Ignore alpha 1-3 generation speckles for framing only; retain a two-pixel edge margin.
            Rectangle bounds=Bounds(image,4);
            bounds.Inflate(2,2);
            bounds.Intersect(new Rectangle(0,0,image.Width,image.Height));
            double scale=102.0/Math.Max(bounds.Width,bounds.Height);
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
                if(c.A>0) result.SetPixel(x,y,Color.FromArgb(c.A,32,36,42));
            }
            result.Save(destination,ImageFormat.Png);
        }
    }
    public static bool SingleFill(Bitmap image) {
        for(int y=0;y<image.Height;y++) for(int x=0;x<image.Width;x++) {
            Color c=image.GetPixel(x,y);
            if(c.A>0 && (c.R!=32 || c.G!=36 || c.B!=42)) return false;
        }
        return true;
    }
    public static void Preview(string[] paths,string[] labels,string destination,int mode) {
        int columns=5, cellWidth=160, cellHeight=mode==0?180:100, size=mode==0?128:40;
        int rows=(paths.Length+columns-1)/columns;
        using(var sheet=new Bitmap(columns*cellWidth,rows*cellHeight,PixelFormat.Format32bppArgb)) using(var graphics=Graphics.FromImage(sheet)) using(var font=new Font("Arial",10)) {
            graphics.Clear(Color.FromArgb(235,237,240));
            graphics.InterpolationMode=InterpolationMode.HighQualityBicubic;
            graphics.PixelOffsetMode=PixelOffsetMode.HighQuality;
            using(var light=new SolidBrush(Color.FromArgb(245,245,245))) using(var dark=new SolidBrush(Color.FromArgb(220,220,220))) {
                for(int i=0;i<paths.Length;i++) {
                    int ox=(i%columns)*cellWidth+(cellWidth-size)/2, oy=(i/columns)*cellHeight+8;
                    for(int y=0;y<size;y+=8) for(int x=0;x<size;x+=8) graphics.FillRectangle(((x+y)/8)%2==0?light:dark,ox+x,oy+y,Math.Min(8,size-x),Math.Min(8,size-y));
                    using(var image=new Bitmap(paths[i])) graphics.DrawImage(image,new Rectangle(ox,oy,size,size));
                    graphics.DrawString(labels[i],font,Brushes.Black,(i%columns)*cellWidth+12,(i/columns)*cellHeight+(mode==0?146:62));
                }
            }
            sheet.Save(destination,ImageFormat.Png);
        }
    }
}
'@
if ($spriteManifest.assets.Count -ne 17) { throw 'Expected 17 weapon definitions' }
if (-not (Test-Path -LiteralPath $spriteOutput)) { New-Item -ItemType Directory -Path $spriteOutput | Out-Null }
if (-not $VerifyOnly) {
    foreach ($spriteAsset in $spriteManifest.assets) {
        [WeaponIconPreparation]::Normalize($spriteAsset.source,(Join-Path $spriteOutput $spriteAsset.file),$ReplacePrepared.IsPresent)
    }
}
if (@(Get-ChildItem -LiteralPath $spriteOutput -File -Filter '*.png').Count -ne 17) { throw 'Expected exactly 17 PNG files' }
$spriteResults = foreach ($spriteAsset in $spriteManifest.assets) {
    $spritePath = Join-Path $spriteOutput $spriteAsset.file
    $spriteBitmap = [System.Drawing.Bitmap]::new($spritePath)
    try {
        $spriteBounds = [WeaponIconPreparation]::Bounds($spriteBitmap)
        $spriteCorners = @($spriteBitmap.GetPixel(0,0).A,$spriteBitmap.GetPixel(127,0).A,$spriteBitmap.GetPixel(0,127).A,$spriteBitmap.GetPixel(127,127).A)
        $spriteBorderMax = 0
        for ($spriteCoord=0;$spriteCoord -lt 128;$spriteCoord++) {
            $spriteBorderMax = [Math]::Max($spriteBorderMax,[Math]::Max([Math]::Max($spriteBitmap.GetPixel($spriteCoord,0).A,$spriteBitmap.GetPixel($spriteCoord,127).A),[Math]::Max($spriteBitmap.GetPixel(0,$spriteCoord).A,$spriteBitmap.GetPixel(127,$spriteCoord).A)))
        }
        $spriteExtent = [Math]::Max($spriteBounds.Width,$spriteBounds.Height)/128.0
        if ($spriteBitmap.Width -ne 128 -or $spriteBitmap.Height -ne 128 -or $spriteBorderMax -ne 0 -or $spriteExtent -lt 0.70 -or $spriteExtent -gt 0.85) { throw "Invalid sprite: $($spriteAsset.file)" }
        $weaponSingleFill = [WeaponIconPreparation]::SingleFill($spriteBitmap)
        if (-not $weaponSingleFill) { throw "Nonuniform fill: $($spriteAsset.file)" }
        [pscustomobject]@{file=$spriteAsset.file;width=$spriteBitmap.Width;height=$spriteBitmap.Height;pixelFormat=$spriteBitmap.PixelFormat.ToString();cornerAlpha=$spriteCorners;borderMaxAlpha=$spriteBorderMax;bounds=@($spriteBounds.X,$spriteBounds.Y,$spriteBounds.Width,$spriteBounds.Height);longestExtent=$spriteExtent;fillRGB='#20242A';singleFill=$weaponSingleFill;sha256=(Get-FileHash -LiteralPath $spritePath -Algorithm SHA256).Hash.ToLowerInvariant()}
    } finally { $spriteBitmap.Dispose() }
}
$spriteResults | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $spriteEvidence 'verification.json') -Encoding UTF8
[string[]]$spritePaths = @($spriteManifest.assets | ForEach-Object { Join-Path $spriteOutput $_.file })
[string[]]$spriteLabels = @($spriteManifest.assets | ForEach-Object { $_.file })
[WeaponIconPreparation]::Preview($spritePaths,$spriteLabels,(Join-Path $spriteEvidence 'preview.png'),0)
[WeaponIconPreparation]::Preview($spritePaths,$spriteLabels,(Join-Path $spriteEvidence 'preview-40px.png'),1)
$spriteResults | Select-Object file,width,height,borderMaxAlpha,longestExtent | Format-Table
Write-Output 'WEAPON_ICONS_OK 17 PNGs, 128x128, transparent borders, silhouette extent 70-85%, single RGB fill'
