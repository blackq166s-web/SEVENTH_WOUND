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
$spriteManifest = Get-Content -LiteralPath (Join-Path $spriteProject 'docs/sprite-generation-20261022/prompts.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$spriteOutput = Join-Path $spriteProject 'assets/sprites'
$spriteEvidence = Join-Path $spriteProject 'docs/sprite-generation-20261022'
Add-Type -ReferencedAssemblies @([System.Drawing.Bitmap].Assembly.Location,[System.Drawing.Rectangle].Assembly.Location) -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
public static class SpriteAssetPreparation {
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
        using(var image=new Bitmap(source)) using(var result=new Bitmap(256,256,PixelFormat.Format32bppArgb)) {
            // Ignore alpha 1-3 generation speckles for framing only; retain a two-pixel edge margin.
            Rectangle bounds=Bounds(image,4);
            bounds.Inflate(2,2);
            bounds.Intersect(new Rectangle(0,0,image.Width,image.Height));
            double scale=184.0/Math.Max(bounds.Width,bounds.Height);
            int width=(int)Math.Round(bounds.Width*scale), height=(int)Math.Round(bounds.Height*scale);
            using(var graphics=Graphics.FromImage(result)) {
                graphics.Clear(Color.Transparent);
                graphics.CompositingMode=CompositingMode.SourceCopy;
                graphics.CompositingQuality=CompositingQuality.HighQuality;
                graphics.InterpolationMode=InterpolationMode.HighQualityBicubic;
                graphics.PixelOffsetMode=PixelOffsetMode.HighQuality;
                using(var attributes=new ImageAttributes()) {
                    attributes.SetWrapMode(WrapMode.TileFlipXY);
                    graphics.DrawImage(image,new Rectangle((256-width)/2,(256-height)/2,width,height),bounds.X,bounds.Y,bounds.Width,bounds.Height,GraphicsUnit.Pixel,attributes);
                }
            }
            result.Save(destination,ImageFormat.Png);
        }
    }
    public static void Preview(string[] paths,string[] labels,string destination,int mode) {
        using(var sheet=new Bitmap(1024,600,PixelFormat.Format32bppArgb)) using(var graphics=Graphics.FromImage(sheet)) using(var font=new Font("Arial",12)) {
            graphics.Clear(Color.FromArgb(45,34,33));
            using(var light=new SolidBrush(Color.FromArgb(232,232,232))) using(var dark=new SolidBrush(Color.FromArgb(204,204,204))) {
                for(int i=0;i<paths.Length;i++) {
                    int ox=(i%4)*256, oy=(i/4)*300;
                    if(mode>0) graphics.FillRectangle(Brushes.White,ox,oy,256,256);
                    else for(int y=0;y<256;y+=16) for(int x=0;x<256;x+=16) graphics.FillRectangle(((x+y)/16)%2==0?light:dark,ox+x,oy+y,16,16);
                    using(var image=new Bitmap(paths[i])) {
                        if(mode>0) for(int y=0;y<image.Height;y++) for(int x=0;x<image.Width;x++) {
                            Color c=image.GetPixel(x,y);
                            int gray=mode==2?0:(int)Math.Round(c.R*0.2126+c.G*0.7152+c.B*0.0722);
                            image.SetPixel(x,y,Color.FromArgb(c.A,gray,gray,gray));
                        }
                        graphics.DrawImageUnscaled(image,ox,oy);
                    }
                    graphics.DrawString(labels[i],font,Brushes.White,ox+12,oy+267);
                }
            }
            sheet.Save(destination,ImageFormat.Png);
        }
    }
}
'@
if (-not $VerifyOnly) {
    foreach ($spriteAsset in $spriteManifest.assets) {
        [SpriteAssetPreparation]::Normalize($spriteAsset.source,(Join-Path $spriteOutput $spriteAsset.file),$ReplacePrepared.IsPresent)
    }
}
$spriteResults = foreach ($spriteAsset in $spriteManifest.assets) {
    $spritePath = Join-Path $spriteOutput $spriteAsset.file
    $spriteBitmap = [System.Drawing.Bitmap]::new($spritePath)
    try {
        $spriteBounds = [SpriteAssetPreparation]::Bounds($spriteBitmap)
        $spriteCorners = @($spriteBitmap.GetPixel(0,0).A,$spriteBitmap.GetPixel(255,0).A,$spriteBitmap.GetPixel(0,255).A,$spriteBitmap.GetPixel(255,255).A)
        $spriteBorderMax = 0
        for ($spriteCoord=0;$spriteCoord -lt 256;$spriteCoord++) {
            $spriteBorderMax = [Math]::Max($spriteBorderMax,[Math]::Max([Math]::Max($spriteBitmap.GetPixel($spriteCoord,0).A,$spriteBitmap.GetPixel($spriteCoord,255).A),[Math]::Max($spriteBitmap.GetPixel(0,$spriteCoord).A,$spriteBitmap.GetPixel(255,$spriteCoord).A)))
        }
        $spriteExtent = [Math]::Max($spriteBounds.Width,$spriteBounds.Height)/256.0
        if ($spriteBitmap.Width -ne 256 -or $spriteBitmap.Height -ne 256 -or $spriteBorderMax -ne 0 -or $spriteExtent -lt 0.60 -or $spriteExtent -gt 0.80) { throw "Invalid sprite: $($spriteAsset.file)" }
        [pscustomobject]@{file=$spriteAsset.file;width=$spriteBitmap.Width;height=$spriteBitmap.Height;pixelFormat=$spriteBitmap.PixelFormat.ToString();cornerAlpha=$spriteCorners;borderMaxAlpha=$spriteBorderMax;bounds=@($spriteBounds.X,$spriteBounds.Y,$spriteBounds.Width,$spriteBounds.Height);longestExtent=$spriteExtent;sha256=(Get-FileHash -LiteralPath $spritePath -Algorithm SHA256).Hash.ToLowerInvariant()}
    } finally { $spriteBitmap.Dispose() }
}
$spriteResults | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $spriteEvidence 'verification.json') -Encoding UTF8
[string[]]$spritePaths = @($spriteManifest.assets | ForEach-Object { Join-Path $spriteOutput $_.file })
[string[]]$spriteLabels = @($spriteManifest.assets | ForEach-Object { $_.file })
[SpriteAssetPreparation]::Preview($spritePaths,$spriteLabels,(Join-Path $spriteEvidence 'preview.png'),0)
[SpriteAssetPreparation]::Preview($spritePaths,$spriteLabels,(Join-Path $spriteEvidence 'grayscale.png'),1)
[SpriteAssetPreparation]::Preview($spritePaths,$spriteLabels,(Join-Path $spriteEvidence 'silhouettes.png'),2)
$spriteResults | Select-Object file,width,height,borderMaxAlpha,longestExtent | Format-Table
Write-Output 'SPRITE_ASSETS_OK 7 PNGs, 256x256, transparent borders, silhouette extent 60-80%'
