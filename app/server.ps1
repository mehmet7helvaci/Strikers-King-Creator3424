param(
    [switch]$NoLaunch,
    [int]$Port = 18888
)

$ErrorActionPreference = "SilentlyContinue"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $scriptDir) { $scriptDir = (Get-Location).Path }

$targetPort = if ($Port -and $Port -gt 0) { $Port } else { 18888 }

# Eger sunucu zaten calisiyorsa cik
try {
    $existing = Invoke-WebRequest -Uri "http://localhost:$targetPort/api/status" -TimeoutSec 1 -UseBasicParsing
    if ($existing.StatusCode -eq 200) {
        if (-not $NoLaunch) {
            Start-Process "http://localhost:$targetPort"
        }
        exit 0
    }
} catch {}

$listener = $null

# First try designated target port
try {
    $temp = New-Object System.Net.HttpListener
    $temp.Prefixes.Add("http://localhost:$targetPort/")
    $temp.Start()
    $Port = $targetPort
    $listener = $temp
} catch {
    if ($temp) { $temp.Close() }
}

if (-not $listener) {
    for ($p = 18888; $p -le 18895; $p++) {
        if ($p -eq $targetPort) { continue }
        try {
            $temp = New-Object System.Net.HttpListener
            $temp.Prefixes.Add("http://localhost:$p/")
            $temp.Start()
            $Port = $p
            $listener = $temp
            break
        } catch {
            if ($temp) { $temp.Close() }
        }
    }
}

if (-not $listener) {
    if (-not $NoLaunch) {
        Start-Process (Join-Path $scriptDir "index.html")
    }
    exit 1
}

if (-not $NoLaunch) {
    Start-Process "http://localhost:$Port"
}

$mimeTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".webp" = "image/webp"
    ".ico"  = "image/x-icon"
}

$dataPath = Join-Path $scriptDir "data"
if (-not (Test-Path $dataPath)) {
    New-Item -ItemType Directory -Path $dataPath -Force | Out-Null
}
$channelsPath = Join-Path $dataPath "channels"
if (-not (Test-Path $channelsPath)) {
    New-Item -ItemType Directory -Path $channelsPath -Force | Out-Null
}
$matchCapturesPath = Join-Path $dataPath "match_captures"
if (-not (Test-Path $matchCapturesPath)) {
    New-Item -ItemType Directory -Path $matchCapturesPath -Force | Out-Null
}
try { Add-Type -AssemblyName System.Windows.Forms -ErrorAction SilentlyContinue } catch {}
try { Add-Type -AssemblyName System.Drawing -ErrorAction SilentlyContinue } catch {}
$statsFile = Join-Path $dataPath "hub_stats.json"
if (-not (Test-Path $statsFile)) {
    [System.IO.File]::WriteAllText($statsFile, "{}", [System.Text.Encoding]::UTF8)
}
$bansFile = Join-Path $dataPath "hub_bans.json"
if (-not (Test-Path $bansFile)) {
    [System.IO.File]::WriteAllText($bansFile, "[]", [System.Text.Encoding]::UTF8)
}
$tunnelUrlFile = Join-Path $scriptDir "tunnel_url.txt"

$global:ObsSyncState = '{"html":"<div class=\"team-box\" id=\"team1Box\"><div class=\"team-header\"><input type=\"text\" class=\"team-name-input\" value=\"Takım 1\"><span class=\"team-count badge\">0/5</span></div><ul class=\"team-list sortable-list\" id=\"team-1\"></ul></div><div class=\"team-box\" id=\"team2Box\"><div class=\"team-header\"><input type=\"text\" class=\"team-name-input\" value=\"Takım 2\"><span class=\"team-count badge\">0/5</span></div><ul class=\"team-list sortable-list\" id=\"team-2\"></ul></div>","modeClass":"teams-container mode-single","cmd":"!turnuvagiriş","poolCount":"0","newPlayer":null,"obsConfig":{"scaleMode":"auto","manualScale":100,"infoBarPos":"top","align":"center","activeMatchId":"single_match"},"activeMatchId":"single_match","ts":0}'
$global:HubEvents = [System.Collections.ArrayList]::new()
$global:EventCounter = 0
$global:ActiveClients = @{}
$global:TunnelUrl = ""
$global:AvatarCache = [System.Collections.Hashtable]::Synchronized(@{})
$global:AvatarPending = [System.Collections.Hashtable]::Synchronized(@{})
$global:WatcherState = @{ enabled = $false; activeMatch = ""; lastDetected = $null; events = [System.Collections.ArrayList]::new() }
$global:ActiveBroadcasterTokens = [System.Collections.Hashtable]::Synchronized(@{})
$authFile = Join-Path $dataPath "streamer_auth.local.json"

function Get-HubBansContent {
    try {
        if (Test-Path $bansFile) {
            $content = [System.IO.File]::ReadAllText($bansFile, [System.Text.Encoding]::UTF8)
            if (-not [string]::IsNullOrWhiteSpace($content)) {
                return $content
            }
        }
    } catch {}
    return "[]"
}

function Save-HubBansContent([string]$content) {
    try {
        [System.IO.File]::WriteAllText($bansFile, $content, [System.Text.Encoding]::UTF8)
        return $true
    } catch {
        return $false
    }
}

function Get-ChannelFilePath([string]$channel) {
    if ([string]::IsNullOrWhiteSpace($channel) -or $channel.Trim().ToLower() -eq "global") {
        return $statsFile
    }
    $safeName = ($channel.Trim().ToLower() -replace '[^a-z0-9_-]', '')
    if ([string]::IsNullOrWhiteSpace($safeName)) {
        $safeName = "genel"
    }
    $cFile = Join-Path $channelsPath "$safeName.json"
    if (-not (Test-Path $cFile)) {
        [System.IO.File]::WriteAllText($cFile, "{}", [System.Text.Encoding]::UTF8)
    }
    return $cFile
}

function Get-HubStatsContent([string]$channel = "") {
    try {
        $targetFile = Get-ChannelFilePath $channel
        if (Test-Path $targetFile) {
            $content = [System.IO.File]::ReadAllText($targetFile, [System.Text.Encoding]::UTF8)
            if (-not [string]::IsNullOrWhiteSpace($content)) {
                return $content
            }
        }
    } catch {}
    return "{}"
}

function Save-HubStatsContent([string]$content, [string]$channel = "") {
    try {
        $targetFile = Get-ChannelFilePath $channel
        [System.IO.File]::WriteAllText($targetFile, $content, [System.Text.Encoding]::UTF8)
        return $true
    } catch {
        return $false
    }
}

function Get-ActiveHubClientsCount {
    $now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    $stale = @()
    foreach ($k in $global:ActiveClients.Keys) {
        if (($now - $global:ActiveClients[$k]) -gt 25000) {
            $stale += $k
        }
    }
    foreach ($k in $stale) {
        $global:ActiveClients.Remove($k)
    }
    return [Math]::Max(1, $global:ActiveClients.Count)
}

function Refresh-TunnelUrl {
    if (Test-Path $tunnelUrlFile) {
        try {
            $txt = [System.IO.File]::ReadAllText($tunnelUrlFile, [System.Text.Encoding]::UTF8).Trim()
            if ($txt -match 'https://[a-zA-Z0-9-]+\.trycloudflare\.com') {
                $global:TunnelUrl = $txt
                return $txt
            }
        } catch {}
    }
    return $global:TunnelUrl
}

while ($true) {
    try {
        if (-not $listener -or -not $listener.IsListening) {
            try {
                if ($listener) { $listener.Stop(); $listener.Close() }
            } catch {}
            $listener = New-Object System.Net.HttpListener
            $listener.Prefixes.Add("http://localhost:$Port/")
            $listener.Start()
        }
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $response.AddHeader("Access-Control-Allow-Origin", "*")
        $response.AddHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        $response.AddHeader("Access-Control-Allow-Headers", "Content-Type")
        $response.AddHeader("Cache-Control", "no-cache, no-store, must-revalidate")
        $response.AddHeader("Pragma", "no-cache")
        $response.AddHeader("Expires", "0")

        if ($request.HttpMethod -eq "OPTIONS") {
            $response.StatusCode = 204
            $response.Close()
            continue
        }

        $rawUrl = $request.RawUrl

        if ($rawUrl.StartsWith("/api/state")) {
            if ($request.HttpMethod -eq "POST") {
                $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
                $body = $reader.ReadToEnd()
                $reader.Close()
                if (-not [string]::IsNullOrWhiteSpace($body) -and $body -ne "{}") {
                    $global:ObsSyncState = $body
                }
                $response.StatusCode = 200
                $response.Close()
            } else {
                if (-not $global:ObsSyncState) { $global:ObsSyncState = "{}" }
                $buffer = [System.Text.Encoding]::UTF8.GetBytes($global:ObsSyncState)
                $response.ContentType = "application/json; charset=utf-8"
                $response.ContentLength64 = $buffer.Length
                $response.StatusCode = 200
                $response.OutputStream.Write($buffer, 0, $buffer.Length)
                $response.Close()
            }
            continue
        }

        if ($rawUrl.StartsWith("/api/test-result")) {
            if ($request.HttpMethod -eq "POST") {
                $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
                $global:TestResultState = $reader.ReadToEnd()
                $reader.Close()
                $response.StatusCode = 200
                $response.Close()
            } else {
                $content = if ($global:TestResultState) { $global:TestResultState } else { '{"ready":false}' }
                $buffer = [System.Text.Encoding]::UTF8.GetBytes($content)
                $response.ContentType = "application/json; charset=utf-8"
                $response.ContentLength64 = $buffer.Length
                $response.StatusCode = 200
                $response.OutputStream.Write($buffer, 0, $buffer.Length)
                $response.Close()
            }
            continue
        }

        # -------------------------------------------------------------
        # KICK PROFIL FOTOĞRAFI (AVATAR) PROXY API
        # -------------------------------------------------------------
        if ($rawUrl.StartsWith("/api/kick/avatar")) {
            $username = ""
            if ($request.QueryString["username"]) {
                $username = $request.QueryString["username"].Trim()
            }

            if ([string]::IsNullOrWhiteSpace($username)) {
                $errBytes = [System.Text.Encoding]::UTF8.GetBytes('{"success":false,"avatar":null,"message":"Kullanıcı adı belirtilmedi"}')
                $response.ContentType = "application/json; charset=utf-8"
                $response.ContentLength64 = $errBytes.Length
                $response.StatusCode = 400
                $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
                $response.Close()
                continue
            }

            $userKey = $username.ToLower()
            $avatarUrl = $null
            $isPending = $false

            if ($global:AvatarCache.ContainsKey($userKey)) {
                $cachedVal = $global:AvatarCache[$userKey]
                if (-not [string]::IsNullOrEmpty($cachedVal)) {
                    $avatarUrl = $cachedVal
                }
            } else {
                if ($global:AvatarPending.ContainsKey($userKey)) {
                    $isPending = $true
                } else {
                    $global:AvatarPending[$userKey] = $true
                    $isPending = $true

                    # Sunucuyu asla kilitlemeyen arka plan asenkron avatar çekimi
                    $bgWorker = [powershell]::Create()
                    [void]$bgWorker.AddScript({
                        param($uName, $uKey, $cache, $pend)
                        $foundPic = ""
                        try {
                            $escaped = [System.Uri]::EscapeDataString($uName)
                            $apiUrl = "https://kick.com/api/v1/users/$escaped"
                            $req = [System.Net.HttpWebRequest]::Create($apiUrl)
                            $req.UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                            $req.Timeout = 2500
                            $req.ReadWriteTimeout = 2500
                            $resp = $req.GetResponse()
                            if ($resp) {
                                $stream = $resp.GetResponseStream()
                                $sr = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::UTF8)
                                $rawBody = $sr.ReadToEnd()
                                $sr.Close()
                                $stream.Close()
                                $resp.Close()

                                if ($rawBody -match '"profilepic"\s*:\s*"([^"]+)"') {
                                    $foundPic = $matches[1].Replace('\/', '/')
                                }
                            }
                        } catch {
                            $foundPic = ""
                        } finally {
                            $cache[$uKey] = $foundPic
                            if ($pend.ContainsKey($uKey)) {
                                $pend.Remove($uKey)
                            }
                        }
                    }).AddArgument($username).AddArgument($userKey).AddArgument($global:AvatarCache).AddArgument($global:AvatarPending)
                    
                    [void]$bgWorker.BeginInvoke()
                }
            }

            $respData = @{
                success = (-not [string]::IsNullOrEmpty($avatarUrl))
                username = $username
                avatar = $avatarUrl
                pending = $isPending
            }
            $jsonResp = $respData | ConvertTo-Json -Compress
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($jsonResp)
            $response.ContentType = "application/json; charset=utf-8"
            $response.ContentLength64 = $buffer.Length
            $response.StatusCode = 200
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            $response.Close()
            continue
        }

        # -------------------------------------------------------------
        # KICK KANAL BILGISI (BANNER / ARKA PLAN) PROXY API
        # -------------------------------------------------------------
        if ($rawUrl.StartsWith("/api/kick/channel")) {
            $channelName = ""
            if ($request.QueryString["name"]) {
                $channelName = $request.QueryString["name"].Trim()
            }
            if ([string]::IsNullOrWhiteSpace($channelName)) {
                $channelName = "theonlyk1ng"
            }
            $cKey = $channelName.ToLower()
            $bannerUrl = ""
            try {
                $escaped = [System.Uri]::EscapeDataString($cKey)
                $apiUrl = "https://kick.com/api/v2/channels/$escaped"
                $req = [System.Net.HttpWebRequest]::Create($apiUrl)
                $req.UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                $req.Timeout = 2500
                $resp = $req.GetResponse()
                if ($resp) {
                    $stream = $resp.GetResponseStream()
                    $sr = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::UTF8)
                    $rawBody = $sr.ReadToEnd()
                    $sr.Close()
                    $stream.Close()
                    $resp.Close()
                    $followersCount = 0
                    if ($rawBody -match '"banner_image"\s*:\s*\{[^}]*"url"\s*:\s*"([^"]+)"') {
                        $bannerUrl = $matches[1].Replace('\/', '/')
                    } elseif ($rawBody -match '"banner"\s*:\s*"([^"]+)"') {
                        $bannerUrl = $matches[1].Replace('\/', '/')
                    }
                    if ($rawBody -match '"followers_count"\s*:\s*(\d+)') {
                        $followersCount = [int]$matches[1]
                    }
                }
            } catch {}

            $respData = @{
                success = (-not [string]::IsNullOrEmpty($bannerUrl))
                channel = $channelName
                banner = $bannerUrl
                followersCount = $followersCount
            }
            $jsonResp = $respData | ConvertTo-Json -Compress
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($jsonResp)
            $response.ContentType = "application/json; charset=utf-8"
            $response.ContentLength64 = $buffer.Length
            $response.StatusCode = 200
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            $response.Close()
            continue
        }

        # -------------------------------------------------------------
        # C# SESSİZ EKRAN & TAB SKOR ALGILEYICI API
        # -------------------------------------------------------------
        if ($rawUrl.StartsWith("/api/watcher/state")) {
            if ($request.HttpMethod -eq "POST") {
                try {
                    $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
                    $wBody = $reader.ReadToEnd()
                    $reader.Close()
                    $wData = ConvertFrom-Json $wBody
                    if ($null -ne $wData.enabled) {
                        $global:WatcherState.enabled = [bool]$wData.enabled
                    }
                    if ($null -ne $wData.activeMatch) {
                        $global:WatcherState.activeMatch = $wData.activeMatch.ToString()
                    }
                } catch {}
            }
            $wResp = @{
                success = $true
                enabled = $global:WatcherState.enabled
                activeMatch = $global:WatcherState.activeMatch
                eventCount = $global:WatcherState.events.Count
            } | ConvertTo-Json -Compress
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($wResp)
            $response.ContentType = "application/json; charset=utf-8"
            $response.ContentLength64 = $buffer.Length
            $response.StatusCode = 200
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            $response.Close()
            continue
        }

        if ($rawUrl.StartsWith("/api/watcher/score")) {
            if ($request.HttpMethod -eq "POST") {
                try {
                    $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
                    $scBody = $reader.ReadToEnd()
                    $reader.Close()
                    $scData = ConvertFrom-Json $scBody
                    $scoreEv = @{
                        id = [Guid]::NewGuid().ToString()
                        timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
                        player = if ($scData.player) { $scData.player.ToString() } else { "Bilinmeyen" }
                        type = if ($scData.type) { $scData.type.ToString() } else { "goal" }
                        team = if ($scData.team) { $scData.team.ToString() } else { "" }
                        count = if ($scData.count) { [int]$scData.count } else { 1 }
                        image = if ($scData.image) { $scData.image.ToString() } else { "" }
                    }
                    $global:WatcherState.events.Add($scoreEv) | Out-Null
                    if ($global:WatcherState.events.Count -gt 100) {
                        $global:WatcherState.events.RemoveAt(0)
                    }
                } catch {}
                $jsonResp = '{"success":true,"recorded":true}'
            } else {
                $sinceTs = 0
                if ($request.QueryString["since"]) {
                    [long]::TryParse($request.QueryString["since"], [ref]$sinceTs) | Out-Null
                }
                $unprocessed = @()
                foreach ($sev in $global:WatcherState.events) {
                    if ($sev.timestamp -gt $sinceTs) {
                        $unprocessed += $sev
                    }
                }
                $jsonResp = @{
                    success = $true
                    enabled = $global:WatcherState.enabled
                    events = $unprocessed
                } | ConvertTo-Json -Compress
            }
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($jsonResp)
            $response.ContentType = "application/json; charset=utf-8"
            $response.ContentLength64 = $buffer.Length
            $response.StatusCode = 200
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            $response.Close()
            continue
        }

        # -------------------------------------------------------------
        # MAÇ DOSYALARI VE CANLI SKOR EKRAN YAKALAMA API
        # -------------------------------------------------------------
        if ($rawUrl.StartsWith("/api/match/files")) {
            $mId = if ($request.QueryString["matchId"]) { $request.QueryString["matchId"].Trim() } else { "" }
            $filesList = @()
            if (Test-Path $matchCapturesPath) {
                $filterPattern = if ([string]::IsNullOrWhiteSpace($mId)) { "*.*" } else { "*$mId*.*" }
                $allFiles = Get-ChildItem -Path $matchCapturesPath -Filter $filterPattern -File -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending
                foreach ($f in $allFiles) {
                    $ext = $f.Extension.ToLower()
                    if ($ext -eq ".jpg" -or $ext -eq ".jpeg" -or $ext -eq ".png" -or $ext -eq ".webp") {
                        $filesList += @{
                            id = $f.BaseName
                            filename = $f.Name
                            matchId = $mId
                            url = "data/match_captures/" + $f.Name
                            size = $f.Length
                            timestamp = [DateTimeOffset]::new($f.LastWriteTimeUtc).ToUnixTimeMilliseconds()
                            timeStr = $f.LastWriteTime.ToString("HH:mm:ss")
                        }
                    }
                }
            }
            $jsonResp = @{
                success = $true
                matchId = $mId
                count = $filesList.Count
                files = $filesList
            } | ConvertTo-Json -Depth 4 -Compress
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($jsonResp)
            $response.ContentType = "application/json; charset=utf-8"
            $response.ContentLength64 = $buffer.Length
            $response.StatusCode = 200
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            $response.Close()
            continue
        }

        if ($rawUrl.StartsWith("/api/match/capture")) {
            if ($request.HttpMethod -eq "POST") {
                try {
                    $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
                    $capBody = $reader.ReadToEnd()
                    $reader.Close()
                    $capData = ConvertFrom-Json $capBody

                    $targetMatch = if ($capData.matchId) { $capData.matchId.ToString().Trim() } else { "single_match" }
                    $safeMatch = ($targetMatch -replace '[^a-zA-Z0-9_-]', '')
                    if ([string]::IsNullOrWhiteSpace($safeMatch)) { $safeMatch = "single_match" }

                    $ts = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
                    $fileName = "capture_${safeMatch}_${ts}.jpg"
                    $destPath = Join-Path $matchCapturesPath $fileName

                    $saved = $false
                    if ($capData.imageBase64) {
                        $rawB64 = $capData.imageBase64.ToString()
                        if ($rawB64.Contains(",")) {
                            $rawB64 = $rawB64.Substring($rawB64.IndexOf(",") + 1)
                        }
                        $imgBytes = [Convert]::FromBase64String($rawB64)
                        [System.IO.File]::WriteAllBytes($destPath, $imgBytes)
                        $saved = $true
                    } elseif ($capData.filename -and (Test-Path (Join-Path $matchCapturesPath $capData.filename))) {
                        $destPath = Join-Path $matchCapturesPath $capData.filename
                        $fileName = $capData.filename
                        $saved = $true
                    }

                    if ($saved) {
                        $capEvent = @{
                            id = [Guid]::NewGuid().ToString()
                            timestamp = $ts
                            player = "Scoreboard"
                            type = "match_capture"
                            matchId = $safeMatch
                            filename = $fileName
                            url = "data/match_captures/$fileName"
                            summary = "Maç için skor tablosu yakalandı ($fileName)"
                        }
                        $global:WatcherState.events.Add($capEvent) | Out-Null

                        $jsonResp = @{
                            success = $true
                            file = @{
                                id = [System.IO.Path]::GetFileNameWithoutExtension($fileName)
                                filename = $fileName
                                matchId = $safeMatch
                                url = "data/match_captures/$fileName"
                                timestamp = $ts
                            }
                        } | ConvertTo-Json -Compress
                    } else {
                        $jsonResp = '{"success":false,"error":"Görsel verisi alınamadı"}'
                    }
                } catch {
                    $jsonResp = "{""success"":false,""error"":""$($_.Exception.Message)""}"
                }
            } else {
                $jsonResp = '{"success":false,"error":"Method not allowed"}'
            }
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($jsonResp)
            $response.ContentType = "application/json; charset=utf-8"
            $response.ContentLength64 = $buffer.Length
            $response.StatusCode = 200
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            $response.Close()
            continue
        }

        if ($rawUrl.StartsWith("/api/match/trigger-capture")) {
            if ($request.HttpMethod -eq "POST") {
                try {
                    $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
                    $tBody = $reader.ReadToEnd()
                    $reader.Close()
                    $tData = if (-not [string]::IsNullOrWhiteSpace($tBody)) { ConvertFrom-Json $tBody } else { $null }

                    $targetMatch = if ($tData -and $tData.matchId) { $tData.matchId.ToString().Trim() } else { "single_match" }
                    $safeMatch = ($targetMatch -replace '[^a-zA-Z0-9_-]', '')
                    if ([string]::IsNullOrWhiteSpace($safeMatch)) { $safeMatch = "single_match" }

                    $width = 1920
                    $height = 1080
                    try {
                        if ([System.Windows.Forms.Screen]::PrimaryScreen -and [System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Width -gt 0) {
                            $width = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Width
                            $height = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Height
                        }
                    } catch {}

                    $bmp = New-Object System.Drawing.Bitmap $width, $height
                    $g = [System.Drawing.Graphics]::FromImage($bmp)
                    $capturedRealScreen = $false
                    try {
                        $size = New-Object System.Drawing.Size($width, $height)
                        $g.CopyFromScreen(0, 0, 0, 0, $size, [System.Drawing.CopyPixelOperation]::SourceCopy)
                        $capturedRealScreen = $true
                    } catch {
                        # Eger arka plan / headless konsolda masaustu pencere tanimlayicisi henuz acik degilse
                        $bgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(15, 23, 42))
                        $g.FillRectangle($bgBrush, 0, 0, $width, $height)
                        $bgBrush.Dispose()
                        $textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(0, 240, 255))
                        $font = New-Object System.Drawing.Font("Arial", 24, [System.Drawing.FontStyle]::Bold)
                        $g.DrawString("STRICKERS KING CREATOR - SCOREBOARD CAPTURE", $font, $textBrush, 50, 50)
                        $font.Dispose()
                        $textBrush.Dispose()
                    }
                    $g.Dispose()

                    $ts = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
                    $fileName = "capture_${safeMatch}_${ts}.jpg"
                    $destPath = Join-Path $matchCapturesPath $fileName
                    $bmp.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Jpeg)
                    $bmp.Dispose()

                    # Copy to last_tab_capture.jpg
                    $lastTabPath = Join-Path $dataPath "last_tab_capture.jpg"
                    Copy-Item $destPath $lastTabPath -Force -ErrorAction SilentlyContinue

                    $capEvent = @{
                        id = [Guid]::NewGuid().ToString()
                        timestamp = $ts
                        player = "Scoreboard"
                        type = "match_capture"
                        matchId = $safeMatch
                        filename = $fileName
                        url = "data/match_captures/$fileName"
                        summary = "Maç için skor tablosu yakalandı ($fileName)"
                    }
                    $global:WatcherState.events.Add($capEvent) | Out-Null

                    $jsonResp = @{
                        success = $true
                        file = @{
                            id = [System.IO.Path]::GetFileNameWithoutExtension($fileName)
                            filename = $fileName
                            matchId = $safeMatch
                            url = "data/match_captures/$fileName"
                            timestamp = $ts
                            timeStr = (Get-Date).ToString("HH:mm:ss")
                        }
                    } | ConvertTo-Json -Compress
                } catch {
                    $jsonResp = @{ success = $false; error = $_.Exception.Message } | ConvertTo-Json -Compress
                }
            } else {
                $jsonResp = '{"success":false,"error":"Method not allowed"}'
            }
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($jsonResp)
            $response.ContentType = "application/json; charset=utf-8"
            $response.ContentLength64 = $buffer.Length
            $response.StatusCode = 200
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            $response.Close()
            continue
        }

        if ($rawUrl.StartsWith("/api/match/delete-file")) {
            if ($request.HttpMethod -eq "POST") {
                try {
                    $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
                    $delBody = $reader.ReadToEnd()
                    $reader.Close()
                    $delData = ConvertFrom-Json $delBody
                    $fn = if ($delData.filename) { $delData.filename.ToString().Trim() } else { "" }
                    $safeFn = [System.IO.Path]::GetFileName($fn)
                    $targetFile = Join-Path $matchCapturesPath $safeFn
                    if (Test-Path $targetFile) {
                        Remove-Item $targetFile -Force -ErrorAction SilentlyContinue
                        $jsonResp = '{"success":true,"deleted":true}'
                    } else {
                        $jsonResp = '{"success":false,"error":"Dosya bulunamadı"}'
                    }
                } catch {
                    $jsonResp = '{"success":false,"error":"Silme hatası"}'
                }
            } else {
                $jsonResp = '{"success":false,"error":"Method not allowed"}'
            }
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($jsonResp)
            $response.ContentType = "application/json; charset=utf-8"
            $response.ContentLength64 = $buffer.Length
            $response.StatusCode = 200
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            $response.Close()
            continue
        }

        # -------------------------------------------------------------
        # VERI MERKEZI (DATA HUB) REST & SYNC API
        # -------------------------------------------------------------

        # 1. Hub Status
        if ($rawUrl.StartsWith("/api/hub/status")) {
            $tUrl = Refresh-TunnelUrl
            $reqChannel = if ($request.QueryString["channel"]) { $request.QueryString["channel"].Trim() } else { "" }
            $stContent = Get-HubStatsContent $reqChannel
            $pCount = 0
            try {
                $parsedSt = ConvertFrom-Json $stContent
                if ($parsedSt) {
                    $pCount = ($parsedSt | Get-Member -MemberType NoteProperty).Count
                }
            } catch {}

            $respData = @{
                success = $true
                hub = $true
                isHost = $true
                port = $Port
                channel = $reqChannel
                tunnelUrl = $tUrl
                playerCount = $pCount
                eventCount = $global:HubEvents.Count
                activeClients = (Get-ActiveHubClientsCount)
                serverTime = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
            }
            $jsonResp = $respData | ConvertTo-Json -Compress
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($jsonResp)
            $response.ContentType = "application/json; charset=utf-8"
            $response.ContentLength64 = $buffer.Length
            $response.StatusCode = 200
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            $response.Close()
            continue
        }

        # 2. Hub Stats (GET: fetch channel/all stats, POST: bulk set/reset for channel)
        if ($rawUrl.StartsWith("/api/hub/stats")) {
            $reqChannel = if ($request.QueryString["channel"]) { $request.QueryString["channel"].Trim() } else { "" }
            if ($request.HttpMethod -eq "POST") {
                $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
                $body = $reader.ReadToEnd()
                $reader.Close()
                Save-HubStatsContent $body $reqChannel
                
                $global:EventCounter++
                $resetEvent = @{
                    id = $global:EventCounter
                    type = "STATS_RESET"
                    timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
                    streamer = if ($reqChannel) { $reqChannel } else { "SYSTEM" }
                    channel = $reqChannel
                    summary = "🔄 İstatistikler güncellendi/içe aktarıldı."
                }
                $global:HubEvents.Add($resetEvent) | Out-Null

                $jsonResp = '{"success":true,"message":"İstatistikler güncellendi"}'
            } else {
                $jsonResp = Get-HubStatsContent $reqChannel
            }
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($jsonResp)
            $response.ContentType = "application/json; charset=utf-8"
            $response.ContentLength64 = $buffer.Length
            $response.StatusCode = 200
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            $response.Close()
            continue
        }

        # 3. Match Result Submission (Streamer submits completed match with channel isolation)
        if ($rawUrl.StartsWith("/api/hub/match-result") -and $request.HttpMethod -eq "POST") {
            try {
                $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
                $bodyText = $reader.ReadToEnd()
                $reader.Close()

                $matchData = ConvertFrom-Json $bodyText
                $streamerName = if ($matchData.streamer) { $matchData.streamer.ToString().Trim() } else { "Bilinmeyen Yayıncı" }
                $targetChannel = if ($matchData.channel) { $matchData.channel.ToString().Trim() } elseif ($request.QueryString["channel"]) { $request.QueryString["channel"].Trim() } else { $streamerName }

                # Load existing stats hashtable for target channel
                $stJson = Get-HubStatsContent $targetChannel
                $statsObj = @{}
                try {
                    $rawObj = ConvertFrom-Json $stJson
                    if ($rawObj) {
                        foreach ($prop in ($rawObj | Get-Member -MemberType NoteProperty)) {
                            $statsObj[$prop.Name] = $rawObj.$($prop.Name)
                        }
                    }
                } catch {}

                # Apply player updates
                $highlightList = @()
                if ($matchData.playerUpdates) {
                    foreach ($p in $matchData.playerUpdates) {
                        $pName = if ($p.name) { $p.name.ToString().Trim() } else { "" }
                        if ([string]::IsNullOrWhiteSpace($pName)) { continue }
                        $key = $pName.ToLower()

                        $goals = if ($p.goals) { [int]$p.goals } else { 0 }
                        $assists = if ($p.assists) { [int]$p.assists } else { 0 }
                        $saves = if ($p.saves) { [int]$p.saves } else { 0 }
                        $isWin = if ($null -ne $p.win) { [bool]$p.win } else { $false }
                        $isMvp = if ($null -ne $p.isMvp) { [bool]$p.isMvp } else { $false }

                        if (-not $statsObj.ContainsKey($key)) {
                            $statsObj[$key] = [PSCustomObject]@{
                                wins = 0
                                losses = 0
                                goals = 0
                                assists = 0
                                saves = 0
                                streak = 0
                                mvpCount = 0
                                displayName = $pName
                            }
                        }

                        $curr = $statsObj[$key]
                        $curr.goals += $goals
                        $curr.assists += $assists
                        $curr.saves += $saves
                        if ($isWin) {
                            $curr.wins += 1
                            if ($curr.PSObject.Properties['streak']) {
                                $curr.streak = [int]$curr.streak + 1
                            } else {
                                $curr | Add-Member -NotePropertyName streak -NotePropertyValue 1 -Force
                            }
                        } else {
                            $curr.losses += 1
                            if ($curr.PSObject.Properties['streak']) {
                                $curr.streak = 0
                            } else {
                                $curr | Add-Member -NotePropertyName streak -NotePropertyValue 0 -Force
                            }
                        }
                        if ($isMvp) {
                            if ($curr.PSObject.Properties['mvpCount']) {
                                $curr.mvpCount = [int]$curr.mvpCount + 1
                            } else {
                                $curr | Add-Member -NotePropertyName mvpCount -NotePropertyValue 1 -Force
                            }
                        }
                        $curr.displayName = $pName

                        if ($goals -gt 0 -or $assists -gt 0 -or $saves -gt 0) {
                            $highlightList += "$pName ($goals Gol, $assists Pas, $saves Kurtarış)"
                        }
                    }
                }

                # Save updated channel stats
                $newStatsJson = $statsObj | ConvertTo-Json -Depth 5 -Compress
                Save-HubStatsContent $newStatsJson $targetChannel

                # Atomik Ortak Espor Ligi: Merkezi kariyer havuzunu (hub_stats.json) da es zamanli guncelle
                try {
                    $globalStJson = Get-HubStatsContent ""
                    $globalStatsObj = @{}
                    $rawGlob = ConvertFrom-Json $globalStJson
                    if ($rawGlob) {
                        foreach ($prop in ($rawGlob | Get-Member -MemberType NoteProperty)) {
                            $globalStatsObj[$prop.Name] = $rawGlob.$($prop.Name)
                        }
                    }

                    if ($matchData.playerUpdates) {
                        foreach ($p in $matchData.playerUpdates) {
                            $pName = if ($p.name) { $p.name.ToString().Trim() } else { "" }
                            if ([string]::IsNullOrWhiteSpace($pName)) { continue }
                            $gKey = $pName.ToLower()

                            $goals = if ($p.goals) { [int]$p.goals } else { 0 }
                            $assists = if ($p.assists) { [int]$p.assists } else { 0 }
                            $saves = if ($p.saves) { [int]$p.saves } else { 0 }
                            $isWin = if ($null -ne $p.win) { [bool]$p.win } else { $false }
                            $isMvp = if ($null -ne $p.isMvp) { [bool]$p.isMvp } else { $false }

                            if (-not $globalStatsObj.ContainsKey($gKey)) {
                                $globalStatsObj[$gKey] = [PSCustomObject]@{
                                    wins = 0
                                    losses = 0
                                    goals = 0
                                    assists = 0
                                    saves = 0
                                    streak = 0
                                    mvpCount = 0
                                    displayName = $pName
                                }
                            }

                            $gCurr = $globalStatsObj[$gKey]
                            $gCurr.goals += $goals
                            $gCurr.assists += $assists
                            $gCurr.saves += $saves
                            if ($isWin) {
                                $gCurr.wins += 1
                                if ($gCurr.PSObject.Properties['streak']) {
                                    $gCurr.streak = [int]$gCurr.streak + 1
                                } else {
                                    $gCurr | Add-Member -NotePropertyName streak -NotePropertyValue 1 -Force
                                }
                            } else {
                                $gCurr.losses += 1
                                if ($gCurr.PSObject.Properties['streak']) {
                                    $gCurr.streak = 0
                                } else {
                                    $gCurr | Add-Member -NotePropertyName streak -NotePropertyValue 0 -Force
                                }
                            }
                            if ($isMvp) {
                                if ($gCurr.PSObject.Properties['mvpCount']) {
                                    $gCurr.mvpCount = [int]$gCurr.mvpCount + 1
                                } else {
                                    $gCurr | Add-Member -NotePropertyName mvpCount -NotePropertyValue 1 -Force
                                }
                            }
                            $gCurr.displayName = $pName
                        }
                        $newGlobalStatsJson = $globalStatsObj | ConvertTo-Json -Depth 5 -Compress
                        Save-HubStatsContent $newGlobalStatsJson ""
                    }
                } catch {}

                # Generate broadcast event
                $global:EventCounter++
                $hlSummary = if ($highlightList.Count -gt 0) { $highlightList -join ", " } else { "Maç tamamlandı" }
                $eventObj = @{
                    id = $global:EventCounter
                    matchId = if ($matchData.matchId) { $matchData.matchId.ToString() } else { "match_$($global:EventCounter)" }
                    type = "MATCH_RECORDED"
                    timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
                    streamer = $streamerName
                    channel = $targetChannel
                    winnerTitle = $matchData.winnerTitle
                    loserTitle = $matchData.loserTitle
                    summary = "🏆 ${streamerName} [${targetChannel}]: $hlSummary"
                    playerUpdates = $matchData.playerUpdates
                }
                $global:HubEvents.Add($eventObj) | Out-Null
                if ($global:HubEvents.Count -gt 150) {
                    $global:HubEvents.RemoveAt(0)
                }

                $jsonResp = @{
                    success = $true
                    eventId = $global:EventCounter
                    streamer = $streamerName
                    channel = $targetChannel
                    message = "İstatistikler başarıyla ${targetChannel} kanalına kaydedildi"
                } | ConvertTo-Json -Compress

                $response.StatusCode = 200
            } catch {
                $response.StatusCode = 500
                $err = $_.Exception.Message.Replace('"', '\"')
                $jsonResp = "{""success"":false,""error"":""$err""}"
            }

            $buffer = [System.Text.Encoding]::UTF8.GetBytes($jsonResp)
            $response.ContentType = "application/json; charset=utf-8"
            $response.ContentLength64 = $buffer.Length
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            $response.Close()
            continue
        }

        # 4. Hub Real-time Sync & Polling (Channel Isolated)
        if ($rawUrl.StartsWith("/api/hub/sync")) {
            $since = 0
            if ($request.QueryString["since"]) {
                [int]::TryParse($request.QueryString["since"], [ref]$since) | Out-Null
            }
            $clientId = $request.QueryString["client"]
            if ([string]::IsNullOrWhiteSpace($clientId)) {
                $clientId = $request.RemoteEndPoint.Address.ToString()
            }
            $global:ActiveClients[$clientId] = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()

            $reqChannel = if ($request.QueryString["channel"]) { $request.QueryString["channel"].Trim() } else { "" }

            $newEvents = @()
            foreach ($ev in $global:HubEvents) {
                if ($ev.id -gt $since) {
                    # MATCH_RECORDED, BAN_RECORDED ve STATS_RESET olaylari tum yayincilara aninda iletilir
                    if ($ev.type -eq "MATCH_RECORDED" -or $ev.type -eq "BAN_RECORDED" -or $ev.type -eq "STATS_RESET" -or [string]::IsNullOrWhiteSpace($reqChannel) -or [string]::IsNullOrWhiteSpace($ev.channel) -or ($ev.channel -eq $reqChannel)) {
                        $newEvents += $ev
                    }
                }
            }

            $syncResp = @{
                success = $true
                lastId = $global:EventCounter
                channel = $reqChannel
                events = $newEvents
                activeClients = (Get-ActiveHubClientsCount)
            }

            if ($since -eq 0 -or $request.QueryString["full"] -eq "1") {
                $syncResp["fullStats"] = Get-HubStatsContent $reqChannel
                $syncResp["globalStats"] = Get-HubStatsContent ""
                $syncResp["bannedPlayers"] = (ConvertFrom-Json (Get-HubBansContent))
            } elseif ($request.QueryString["includeGlobal"] -eq "1") {
                $syncResp["globalStats"] = Get-HubStatsContent ""
            }

            $jsonResp = $syncResp | ConvertTo-Json -Depth 6 -Compress
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($jsonResp)
            $response.ContentType = "application/json; charset=utf-8"
            $response.ContentLength64 = $buffer.Length
            $response.StatusCode = 200
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            $response.Close()
            continue
        }

        # 4.1. Ortak Espor Ligi Oyuncu Kariyeri API (Cross-Streamer Career API)
        if ($rawUrl.StartsWith("/api/hub/career")) {
            $pName = if ($request.QueryString["player"]) { $request.QueryString["player"].Trim() } else { "" }
            $globalContent = Get-HubStatsContent ""
            if ([string]::IsNullOrWhiteSpace($pName)) {
                $jsonResp = $globalContent
            } else {
                $pKey = $pName.ToLower()
                $foundCareer = $null
                try {
                    $allC = ConvertFrom-Json $globalContent
                    if ($allC -and $allC.$pKey) {
                        $foundCareer = $allC.$pKey
                    }
                } catch {}
                if ($foundCareer) {
                    $jsonResp = @{ success = $true; found = $true; player = $pName; stats = $foundCareer } | ConvertTo-Json -Compress
                } else {
                    $jsonResp = @{ success = $true; found = $false; player = $pName; stats = $null } | ConvertTo-Json -Compress
                }
            }
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($jsonResp)
            $response.ContentType = "application/json; charset=utf-8"
            $response.ContentLength64 = $buffer.Length
            $response.StatusCode = 200
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            $response.Close()
            continue
        }

        # 5. Cloudflare Tunnel Control Endpoints
        if ($rawUrl.StartsWith("/api/hub/tunnel/start") -and $request.HttpMethod -eq "POST") {
            try {
                $tUrl = Refresh-TunnelUrl
                if (-not [string]::IsNullOrWhiteSpace($tUrl)) {
                    $jsonResp = "{""success"":true,""url"":""$tUrl"",""alreadyRunning"":true}"
                } else {
                    $startScript = Join-Path $scriptDir "start_tunnel.ps1"
                    Start-Process "powershell.exe" -ArgumentList "-ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -File `"$startScript`" -Port $Port -AutoExit" -WindowStyle Hidden
                    
                    for ($i = 0; $i -lt 4; $i++) {
                        Start-Sleep -Milliseconds 150
                        $tUrl = Refresh-TunnelUrl
                        if (-not [string]::IsNullOrWhiteSpace($tUrl)) { break }
                    }

                    if (-not [string]::IsNullOrWhiteSpace($tUrl)) {
                        $jsonResp = "{""success"":true,""url"":""$tUrl""}"
                    } else {
                        $jsonResp = '{"success":true,"url":"","starting":true,"message":"Tünel arka planda başlatılıyor. Birkaç saniye içinde aktifleşecektir."}'
                    }
                }
                $response.StatusCode = 200
            } catch {
                $response.StatusCode = 500
                $err = $_.Exception.Message.Replace('"', '\"')
                $jsonResp = "{""success"":false,""error"":""$err""}"
            }
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($jsonResp)
            $response.ContentType = "application/json; charset=utf-8"
            $response.ContentLength64 = $buffer.Length
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            $response.Close()
            continue
        }

        if ($rawUrl.StartsWith("/api/hub/tunnel/stop") -and $request.HttpMethod -eq "POST") {
            try {
                Get-Process "cloudflared" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
                if (Test-Path $tunnelUrlFile) { Remove-Item $tunnelUrlFile -Force -ErrorAction SilentlyContinue }
                $global:TunnelUrl = ""
                $jsonResp = '{"success":true,"message":"Tünel durduruldu"}'
                $response.StatusCode = 200
            } catch {
                $response.StatusCode = 500
                $err = $_.Exception.Message.Replace('"', '\"')
                $jsonResp = "{""success"":false,""error"":""$err""}"
            }
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($jsonResp)
            $response.ContentType = "application/json; charset=utf-8"
            $response.ContentLength64 = $buffer.Length
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            $response.Close()
            continue
        }

        # 5. Hub Ban API (Ban / Unban / Query Banned Players)
        if ($rawUrl.StartsWith("/api/hub/ban")) {
            if ($request.HttpMethod -eq "POST") {
                $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
                $bodyText = $reader.ReadToEnd()
                $reader.Close()

                $banData = $null
                try { $banData = ConvertFrom-Json $bodyText } catch {}

                $targetPlayer = if ($banData -and $banData.player) { $banData.player.ToString().Trim() } else { "" }
                $action = if ($banData -and $banData.action) { $banData.action.ToString().Trim().ToLower() } else { "ban" }
                $by = if ($banData -and $banData.by) { $banData.by.ToString().Trim() } else { "MODERATOR" }

                if (-not [string]::IsNullOrWhiteSpace($targetPlayer)) {
                    $tKey = $targetPlayer.ToLower()
                    $bansRaw = Get-HubBansContent
                    $bansList = [System.Collections.ArrayList]::new()
                    try {
                        $parsedBans = ConvertFrom-Json $bansRaw
                        if ($parsedBans) {
                            foreach ($b in $parsedBans) {
                                if ($b -and -not [string]::IsNullOrWhiteSpace($b.ToString())) {
                                    $bStr = $b.ToString().Trim().ToLower()
                                    if (-not $bansList.Contains($bStr)) {
                                        [void]$bansList.Add($bStr)
                                    }
                                }
                            }
                        }
                    } catch {}

                    if ($action -eq "unban") {
                        while ($bansList.Contains($tKey)) {
                            $bansList.Remove($tKey)
                        }
                    } else {
                        if (-not $bansList.Contains($tKey)) {
                            [void]$bansList.Add($tKey)
                        }
                    }

                    $savedBansJson = ($bansList | ConvertTo-Json -Compress)
                    if (-not $savedBansJson) { $savedBansJson = "[]" }
                    Save-HubBansContent $savedBansJson

                    $global:EventCounter++
                    $banEvent = @{
                        id = $global:EventCounter
                        type = "BAN_RECORDED"
                        timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
                        player = $targetPlayer
                        action = $action
                        bannedBy = $by
                        summary = if ($action -eq "unban") { "✅ $targetPlayer banı kaldırıldı." } else { "🚫 $targetPlayer turnuvalardan men edildi (Banned)." }
                    }
                    $global:HubEvents.Add($banEvent) | Out-Null

                    $jsonResp = '{"success":true,"message":"Ban işlemi kaydedildi","player":"' + $targetPlayer + '","action":"' + $action + '"}'
                } else {
                    $jsonResp = '{"success":false,"message":"Kullanıcı adı belirtilmedi"}'
                }
            } else {
                $jsonResp = Get-HubBansContent
            }
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($jsonResp)
            $response.ContentType = "application/json; charset=utf-8"
            $response.ContentLength64 = $buffer.Length
            $response.StatusCode = 200
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            $response.Close()
            continue
        }

        # 6. Hub Reset (Reset all player stats or single player)
        if ($rawUrl.StartsWith("/api/hub/reset") -and $request.HttpMethod -eq "POST") {
            $targetPlayer = ""
            if ($request.QueryString["player"]) {
                $targetPlayer = $request.QueryString["player"].Trim()
            }
            if ([string]::IsNullOrWhiteSpace($targetPlayer)) {
                try {
                    $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
                    $bText = $reader.ReadToEnd()
                    $reader.Close()
                    if (-not [string]::IsNullOrWhiteSpace($bText)) {
                        $rObj = ConvertFrom-Json $bText
                        if ($rObj -and $rObj.player) { $targetPlayer = $rObj.player.ToString().Trim() }
                    }
                } catch {}
            }

            if (-not [string]::IsNullOrWhiteSpace($targetPlayer)) {
                $pKey = $targetPlayer.ToLower()
                # Zero out in global stats
                try {
                    $gJson = Get-HubStatsContent ""
                    $gObj = ConvertFrom-Json $gJson
                    if ($gObj -and ($gObj | Get-Member -Name $pKey -MemberType NoteProperty)) {
                        $gObj.$pKey.wins = 0
                        $gObj.$pKey.losses = 0
                        $gObj.$pKey.goals = 0
                        $gObj.$pKey.assists = 0
                        $gObj.$pKey.saves = 0
                        $gObj.$pKey.streak = 0
                        $gObj.$pKey.mvpCount = 0
                        Save-HubStatsContent ($gObj | ConvertTo-Json -Depth 5 -Compress) ""
                    }
                } catch {}
                # Zero out in channel files
                try {
                    Get-ChildItem -Path $channelsPath -Filter "*.json" | ForEach-Object {
                        try {
                            $cContent = [System.IO.File]::ReadAllText($_.FullName, [System.Text.Encoding]::UTF8)
                            $cObj = ConvertFrom-Json $cContent
                            if ($cObj -and ($cObj | Get-Member -Name $pKey -MemberType NoteProperty)) {
                                $cObj.$pKey.wins = 0
                                $cObj.$pKey.losses = 0
                                $cObj.$pKey.goals = 0
                                $cObj.$pKey.assists = 0
                                $cObj.$pKey.saves = 0
                                $cObj.$pKey.streak = 0
                                $cObj.$pKey.mvpCount = 0
                                [System.IO.File]::WriteAllText($_.FullName, ($cObj | ConvertTo-Json -Depth 5 -Compress), [System.Text.Encoding]::UTF8)
                            }
                        } catch {}
                    }
                } catch {}

                $global:EventCounter++
                $global:HubEvents.Add(@{
                    id = $global:EventCounter
                    type = "STATS_RESET"
                    timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
                    player = $targetPlayer
                    streamer = "MODERATOR"
                    summary = "🔄 $targetPlayer kullanıcısının istatistikleri sıfırlandı."
                }) | Out-Null

                $jsonResp = '{"success":true,"message":"' + $targetPlayer + ' istatistikleri sıfırlandı","player":"' + $targetPlayer + '"}'
            } else {
                Save-HubStatsContent "{}"
                $global:EventCounter++
                $global:HubEvents.Add(@{
                    id = $global:EventCounter
                    type = "STATS_RESET"
                    timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
                    streamer = "ADMIN"
                    summary = "⚠️ Tüm merkezi oyuncu istatistikleri sıfırlandı."
                }) | Out-Null

                $jsonResp = '{"success":true,"message":"Merkezi veri havuzu başarıyla sıfırlandı"}'
            }
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($jsonResp)
            $response.ContentType = "application/json; charset=utf-8"
            $response.ContentLength64 = $buffer.Length
            $response.StatusCode = 200
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            $response.Close()
            continue
        }

        # 7. Hub Config (Read / Write hub_config.json)
        if ($rawUrl.StartsWith("/api/hub/config")) {
            $configPath = Join-Path $scriptDir "hub_config.json"
            if ($request.HttpMethod -eq "POST") {
                $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
                $bText = $reader.ReadToEnd()
                $reader.Close()
                if (-not [string]::IsNullOrWhiteSpace($bText)) {
                    [System.IO.File]::WriteAllText($configPath, $bText, [System.Text.Encoding]::UTF8)
                }
                $jsonResp = '{"success":true,"message":"Yapılandırma kaydedildi"}'
            } else {
                $jsonResp = if (Test-Path $configPath) { [System.IO.File]::ReadAllText($configPath, [System.Text.Encoding]::UTF8) } else { '{"firebaseUrl":"","remoteUrl":""}' }
            }
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($jsonResp)
            $response.ContentType = "application/json; charset=utf-8"
            $response.ContentLength64 = $buffer.Length
            $response.StatusCode = 200
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            $response.Close()
            continue
        }

        # Health check
        if ($rawUrl.StartsWith("/api/local-commands")) {
            $localCmdsFile = Join-Path $dataPath "local_commands.json"
            $jsonResp = "{""exists"":false}"
            if (Test-Path $localCmdsFile) {
                $jsonResp = Get-Content $localCmdsFile -Raw -Encoding UTF8
            }
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($jsonResp)
            $response.ContentType = "application/json; charset=utf-8"
            $response.ContentLength64 = $buffer.Length
            $response.StatusCode = 200
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            $response.Close()
            continue
        }

        # Broadcaster Account & Security Endpoints (Local-only, gitignored credentials)
        if ($rawUrl.StartsWith("/api/auth/login") -and $request.HttpMethod -eq "POST") {
            $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
            $body = $reader.ReadToEnd()
            $reader.Close()
            $jsonResp = '{"success":false,"message":"Geçersiz istek"}'
            try {
                $reqObj = ConvertFrom-Json $body
                $inputUser = if ($reqObj.username) { $reqObj.username.ToString().Trim() } else { "" }
                $inputPass = if ($reqObj.password) { $reqObj.password.ToString() } else { "" }

                if (Test-Path $authFile) {
                    $authRaw = [System.IO.File]::ReadAllText($authFile, [System.Text.Encoding]::UTF8)
                    $authObj = ConvertFrom-Json $authRaw
                    if ($authObj -and $authObj.username -and $authObj.password) {
                        if (($authObj.username.Trim().ToLower() -eq $inputUser.ToLower()) -and ($authObj.password -eq $inputPass)) {
                            $token = [System.Guid]::NewGuid().ToString("N")
                            $global:ActiveBroadcasterTokens[$token] = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
                            $dName = if ($authObj.displayName) { $authObj.displayName } else { "Yayıncı" }
                            $role = if ($authObj.role) { $authObj.role } else { "BROADCASTER_ADMIN" }
                            $jsonResp = '{"success":true,"token":"' + $token + '","username":"' + $authObj.username + '","displayName":"' + $dName + '","role":"' + $role + '"}'
                        } else {
                            $jsonResp = '{"success":false,"message":"Hatalı kullanıcı adı veya şifre!"}'
                        }
                    } else {
                        $jsonResp = '{"success":false,"message":"Yetkilendirme dosyası geçersiz"}'
                    }
                } else {
                    $jsonResp = '{"success":false,"message":"Yetkilendirme dosyası bulunamadı"}'
                }
            } catch {
                $jsonResp = '{"success":false,"message":"Sunucu kimlik doğrulama hatası"}'
            }
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($jsonResp)
            $response.ContentType = "application/json; charset=utf-8"
            $response.ContentLength64 = $buffer.Length
            $response.StatusCode = 200
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            $response.Close()
            continue
        }

        if ($rawUrl.StartsWith("/api/auth/status")) {
            $token = $request.Headers["X-Auth-Token"]
            if ([string]::IsNullOrWhiteSpace($token) -and $request.QueryString["token"]) {
                $token = $request.QueryString["token"].Trim()
            }
            $isAuthed = $false
            if (-not [string]::IsNullOrWhiteSpace($token) -and $global:ActiveBroadcasterTokens.ContainsKey($token)) {
                $isAuthed = $true
            }
            $authExists = Test-Path $authFile
            $jsonResp = '{"authenticated":' + ($isAuthed.ToString().ToLower()) + ',"authFileConfigured":' + ($authExists.ToString().ToLower()) + '}'
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($jsonResp)
            $response.ContentType = "application/json; charset=utf-8"
            $response.ContentLength64 = $buffer.Length
            $response.StatusCode = 200
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            $response.Close()
            continue
        }

        if ($rawUrl.StartsWith("/api/auth/logout") -and $request.HttpMethod -eq "POST") {
            $token = $request.Headers["X-Auth-Token"]
            if ([string]::IsNullOrWhiteSpace($token) -and $request.QueryString["token"]) {
                $token = $request.QueryString["token"].Trim()
            }
            if (-not [string]::IsNullOrWhiteSpace($token) -and $global:ActiveBroadcasterTokens.ContainsKey($token)) {
                $global:ActiveBroadcasterTokens.Remove($token)
            }
            $jsonResp = '{"success":true,"message":"Çıkış yapıldı"}'
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($jsonResp)
            $response.ContentType = "application/json; charset=utf-8"
            $response.ContentLength64 = $buffer.Length
            $response.StatusCode = 200
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            $response.Close()
            continue
        }

        if ($rawUrl.StartsWith("/api/status")) {
            $jsonResp = "{""status"":""ok"",""port"":$Port}"
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($jsonResp)
            $response.ContentType = "application/json; charset=utf-8"
            $response.ContentLength64 = $buffer.Length
            $response.StatusCode = 200
            if ($request.HttpMethod -ne "HEAD") {
                $response.OutputStream.Write($buffer, 0, $buffer.Length)
            }
            $response.Close()
            continue
        }

        # Kick Chat ID Proxy
        if ($rawUrl.StartsWith("/api/kick")) {
            $channel = $request.QueryString["channel"]
            $jsonResp = ""
            if ([string]::IsNullOrWhiteSpace($channel)) {
                $response.StatusCode = 400
                $jsonResp = '{"success":false,"error":"Kanal adi belirtilmedi"}'
            } else {
                try {
                    $clean = $channel.Trim().ToLower().Replace("@", "").Replace("https://kick.com/", "").Replace("kick.com/", "").Trim("/")
                    
                    # Sayi ise dogrudan chatroom_id kabul et
                    if ($clean -match '^\d+$') {
                        $jsonResp = "{""success"":true,""chatroomId"":$clean,""channel"":""$clean""}"
                        $response.StatusCode = 200
                    } else {
                        $apiUrl = "https://kick.com/api/v2/channels/$clean"
                        $kickRes = Invoke-RestMethod -Uri $apiUrl -UserAgent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" -TimeoutSec 6
                        if ($kickRes -and $kickRes.chatroom -and $kickRes.chatroom.id) {
                            $cId = $kickRes.chatroom.id
                            $jsonResp = "{""success"":true,""chatroomId"":$cId,""channel"":""$clean""}"
                            $response.StatusCode = 200
                        } else {
                            $response.StatusCode = 404
                            $jsonResp = '{"success":false,"error":"Kanal bulunamadi veya chatroom bilgisi yok"}'
                        }
                    }
                } catch {
                    $response.StatusCode = 502
                    $errMsg = $_.Exception.Message.Replace('"', '\"')
                    $jsonResp = "{""success"":false,""error"":""$errMsg""}"
                }
            }
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($jsonResp)
            $response.ContentType = "application/json; charset=utf-8"
            $response.ContentLength64 = $buffer.Length
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            $response.Close()
            continue
        }

        # Auto Scan Sealed Backup Files (/api/scan-backups) - Sandbox Korumali
        if ($rawUrl.StartsWith("/api/scan-backups")) {
            try {
                # Sandbox: Sadece uygulama dizini ve data klasoru taranir (Desktop/Downloads erisimi sinirlandirildi)
                $searchFolders = @(
                    "$scriptDir",
                    "$dataPath"
                )
                
                $sealedFiles = @()
                foreach ($folder in $searchFolders) {
                    if (Test-Path $folder) {
                        $jsonFiles = Get-ChildItem -Path $folder -Filter "*strikers*.json" -File -ErrorAction SilentlyContinue | Select-Object -First 10
                        if (-not $jsonFiles -or $jsonFiles.Count -eq 0) {
                            $jsonFiles = Get-ChildItem -Path $folder -Filter "*.json" -File -ErrorAction SilentlyContinue | Select-Object -First 10
                        }
                        foreach ($file in $jsonFiles) {
                            try {
                                if ($file.Length -gt 0 -and $file.Length -lt 250000) {
                                    $text = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
                                    if ($text -like "*STRICKERS_KING_OFFICIAL_SEAL*" -or $text -like "*Strickers King Creator*") {
                                        $sealedFiles += @{
                                            filename = $file.Name
                                            path = $file.FullName
                                            content = $text
                                        }
                                    }
                                }
                            } catch {}
                        }
                    }
                }

                $jsonResp = @{
                    success = $true
                    count = $sealedFiles.Count
                    files = $sealedFiles
                } | ConvertTo-Json -Depth 5 -Compress

                $buffer = [System.Text.Encoding]::UTF8.GetBytes($jsonResp)
                $response.ContentType = "application/json; charset=utf-8"
                $response.ContentLength64 = $buffer.Length
                $response.StatusCode = 200
                $response.OutputStream.Write($buffer, 0, $buffer.Length)
                $response.Close()
                continue
            } catch {
                $response.StatusCode = 500
                $jsonResp = '{"success":false,"error":"Tarama hatasi"}'
                $buffer = [System.Text.Encoding]::UTF8.GetBytes($jsonResp)
                $response.ContentType = "application/json; charset=utf-8"
                $response.ContentLength64 = $buffer.Length
                $response.OutputStream.Write($buffer, 0, $buffer.Length)
                $response.Close()
                continue
            }
        }

        # Static file handling with strict sandbox path traversal prevention
        $path = $request.Url.LocalPath
        if ($path -eq "/" -or [string]::IsNullOrWhiteSpace($path)) {
            $path = "/index.html"
        }

        $canonicalScriptDir = [System.IO.Path]::GetFullPath($scriptDir).TrimEnd('\', '/') + [System.IO.Path]::DirectorySeparatorChar
        $cleanRel = $path.TrimStart("/").Replace("/", "\")
        $targetFullPath = [System.IO.Path]::GetFullPath((Join-Path $scriptDir $cleanRel))

        $isWithinSandbox = $targetFullPath.StartsWith($canonicalScriptDir, [System.StringComparison]::OrdinalIgnoreCase) -or ($targetFullPath -eq [System.IO.Path]::GetFullPath($scriptDir).TrimEnd('\', '/'))
        if (-not $isWithinSandbox) {
            $response.StatusCode = 403
            $forbidden = [System.Text.Encoding]::UTF8.GetBytes("403 Forbidden: Sandbox Guvenlik Korumasi (Path Traversal Engellendi)")
            $response.ContentType = "text/plain; charset=utf-8"
            $response.ContentLength64 = $forbidden.Length
            $response.OutputStream.Write($forbidden, 0, $forbidden.Length)
            $response.Close()
            continue
        }

        if (Test-Path $targetFullPath -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($targetFullPath).ToLower()
            $mime = if ($mimeTypes.ContainsKey($ext)) { $mimeTypes[$ext] } else { "application/octet-stream" }
            $bytes = [System.IO.File]::ReadAllBytes($targetFullPath)
            $response.ContentType = $mime
            $response.AddHeader("Cache-Control", "no-cache, no-store, must-revalidate")
            $response.AddHeader("Pragma", "no-cache")
            $response.AddHeader("Expires", "0")
            $response.ContentLength64 = $bytes.Length
            $response.StatusCode = 200
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
            $notFound = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
            $response.ContentType = "text/plain; charset=utf-8"
            $response.ContentLength64 = $notFound.Length
            $response.OutputStream.Write($notFound, 0, $notFound.Length)
        }
        $response.Close()
    } catch {
        # ignore client disconnects & ensure socket is never leaked
        try {
            if ($response) { $response.Close() }
        } catch {}
        Start-Sleep -Milliseconds 25
    }
}
