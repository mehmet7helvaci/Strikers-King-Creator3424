param(
    [int]$Port = 18888,
    [switch]$AutoExit
)

$ErrorActionPreference = "SilentlyContinue"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $scriptDir) { $scriptDir = (Get-Location).Path }

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  STRICKERS KING CREATOR - VERI MERKEZI TUNEL YONETICISI  " -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

$cloudflaredPath = Join-Path $scriptDir "cloudflared.exe"
$tunnelUrlFile = Join-Path $scriptDir "tunnel_url.txt"

# 1. cloudflared.exe kontrolu ve indirme
if (-not (Test-Path $cloudflaredPath)) {
    Write-Host "[1/3] cloudflared.exe indiriliyor..." -ForegroundColor Yellow
    $downloadUrl = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -Uri $downloadUrl -OutFile $cloudflaredPath -UseBasicParsing
        Write-Host "      [OK] cloudflared.exe basariyla indirildi!" -ForegroundColor Green
    }
    catch {
        $msg = $_.Exception.Message
        Write-Host "      [HATA] cloudflared.exe indirilemedi: $msg" -ForegroundColor Red
        if (-not $AutoExit) { Read-Host "Cikmak icin Enter'a basin..." }
        exit 1
    }
} else {
    Write-Host "[1/3] [OK] cloudflared.exe mevcut." -ForegroundColor Green
}

# 2. Onceki dosyalari temizle
if (Test-Path $tunnelUrlFile) {
    Remove-Item $tunnelUrlFile -Force
}

# 3. cloudflared baslat
Write-Host "[2/3] Cloudflare Quick Tunnel baslatiliyor (Port: $Port)..." -ForegroundColor Cyan

$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = $cloudflaredPath
$psi.Arguments = "tunnel --url http://localhost:$Port"
$psi.UseShellExecute = $false
$psi.RedirectStandardError = $true
$psi.RedirectStandardOutput = $true
$psi.CreateNoWindow = $true

$proc = [System.Diagnostics.Process]::Start($psi)
if (-not $proc) {
    Write-Host "      [HATA] Islem baslatilamadi!" -ForegroundColor Red
    exit 1
}

$foundUrl = $null
$timeoutSeconds = 25
$startTime = Get-Date

Write-Host "[3/3] Guvenli HTTPS adresi bekleniyor..." -ForegroundColor Yellow

while (-not $foundUrl -and ((Get-Date) - $startTime).TotalSeconds -lt $timeoutSeconds) {
    if ($proc.HasExited) { break }
    
    $line = $proc.StandardError.ReadLine()
    if ($line) {
        if ($line -match 'https://[a-zA-Z0-9-]+\.trycloudflare\.com') {
            $foundUrl = $matches[0]
            break
        }
    } else {
        Start-Sleep -Milliseconds 200
    }
}

if ($foundUrl) {
    [System.IO.File]::WriteAllText($tunnelUrlFile, $foundUrl, [System.Text.Encoding]::UTF8)
    Write-Host ""
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host "  TUNEL BASARIYLA OLUSTURULDU VE AKTIF!                   " -ForegroundColor Green
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Merkezi Veri Havuzu URL Adresiniz:" -ForegroundColor White
    Write-Host "  $foundUrl" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  Bu linki diger yayincilara gonderin." -ForegroundColor Yellow
    Write-Host "  Yayincilar 'Veri Merkezi' menusunden bu linki yapistirip" -ForegroundColor Gray
    Write-Host "  dogrudan sizin bilgisayariniza baglanabilir!" -ForegroundColor Gray
    Write-Host ""
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host "  Tuneli acik tutmak icin bu pencereyi KAPATMAYIN." -ForegroundColor White
    Write-Host "==========================================================" -ForegroundColor Green

    try {
        $proc.WaitForExit()
    }
    finally {
        if (Test-Path $tunnelUrlFile) { Remove-Item $tunnelUrlFile -Force }
    }
} else {
    Write-Host "      [HATA] Tunel adresi olusturulamadi veya zaman asimi." -ForegroundColor Red
    try { $proc.Kill() } catch {}
    if (-not $AutoExit) { Read-Host "Cikmak icin Enter'a basin..." }
    exit 1
}
