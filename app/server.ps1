param(
    [switch]$NoLaunch
)

$ErrorActionPreference = "SilentlyContinue"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $scriptDir) { $scriptDir = (Get-Location).Path }

# Eger sunucu zaten calisiyorsa cik
try {
    $existing = Invoke-WebRequest -Uri "http://localhost:18888/api/status" -TimeoutSec 1 -UseBasicParsing
    if ($existing.StatusCode -eq 200) {
        if (-not $NoLaunch) {
            Start-Process "http://localhost:18888"
        }
        exit 0
    }
} catch {}

$Port = 18888
$listener = $null

for ($p = 18888; $p -le 18895; $p++) {
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
$statsFile = Join-Path $dataPath "hub_stats.json"
if (-not (Test-Path $statsFile)) {
    [System.IO.File]::WriteAllText($statsFile, "{}", [System.Text.Encoding]::UTF8)
}
$tunnelUrlFile = Join-Path $scriptDir "tunnel_url.txt"

$global:ObsSyncState = '{"html":"<div class=\"team-box\" id=\"team1Box\"><div class=\"team-header\"><input type=\"text\" class=\"team-name-input\" value=\"Takım 1\"><span class=\"team-count badge\">0/5</span></div><ul class=\"team-list sortable-list\" id=\"team-1\"></ul></div><div class=\"team-box\" id=\"team2Box\"><div class=\"team-header\"><input type=\"text\" class=\"team-name-input\" value=\"Takım 2\"><span class=\"team-count badge\">0/5</span></div><ul class=\"team-list sortable-list\" id=\"team-2\"></ul></div>","modeClass":"teams-container mode-single","cmd":"!kingsc","poolCount":"0","newPlayer":null,"obsConfig":{"scaleMode":"auto","manualScale":100,"infoBarPos":"top","align":"center","activeMatchId":"single_match"},"activeMatchId":"single_match","ts":0}'
$global:HubEvents = [System.Collections.ArrayList]::new()
$global:EventCounter = 0
$global:ActiveClients = @{}
$global:TunnelUrl = ""
$global:AvatarCache = [System.Collections.Hashtable]::Synchronized(@{})
$global:AvatarPending = [System.Collections.Hashtable]::Synchronized(@{})


function Get-HubStatsContent {
    try {
        if (Test-Path $statsFile) {
            return [System.IO.File]::ReadAllText($statsFile, [System.Text.Encoding]::UTF8)
        }
    } catch {}
    return "{}"
}

function Save-HubStatsContent([string]$content) {
    try {
        [System.IO.File]::WriteAllText($statsFile, $content, [System.Text.Encoding]::UTF8)
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

while ($listener.IsListening) {
    try {
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
        # VERI MERKEZI (DATA HUB) REST & SYNC API
        # -------------------------------------------------------------

        # 1. Hub Status
        if ($rawUrl.StartsWith("/api/hub/status")) {
            $tUrl = Refresh-TunnelUrl
            $stContent = Get-HubStatsContent
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

        # 2. Hub Stats (GET: fetch all stats, POST: bulk set/reset)
        if ($rawUrl.StartsWith("/api/hub/stats")) {
            if ($request.HttpMethod -eq "POST") {
                $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
                $body = $reader.ReadToEnd()
                $reader.Close()
                Save-HubStatsContent $body
                
                $global:EventCounter++
                $resetEvent = @{
                    id = $global:EventCounter
                    type = "STATS_RESET"
                    timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
                    streamer = "SYSTEM"
                    summary = "🔄 İstatistikler güncellendi/içe aktarıldı."
                }
                $global:HubEvents.Add($resetEvent) | Out-Null

                $jsonResp = '{"success":true,"message":"İstatistikler güncellendi"}'
            } else {
                $jsonResp = Get-HubStatsContent
            }
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($jsonResp)
            $response.ContentType = "application/json; charset=utf-8"
            $response.ContentLength64 = $buffer.Length
            $response.StatusCode = 200
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            $response.Close()
            continue
        }

        # 3. Match Result Submission (Any streamer submits completed match)
        if ($rawUrl.StartsWith("/api/hub/match-result") -and $request.HttpMethod -eq "POST") {
            try {
                $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
                $bodyText = $reader.ReadToEnd()
                $reader.Close()

                $matchData = ConvertFrom-Json $bodyText
                $streamerName = if ($matchData.streamer) { $matchData.streamer.ToString().Trim() } else { "Bilinmeyen Yayıncı" }

                # Load existing stats hashtable
                $stJson = Get-HubStatsContent
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

                        if (-not $statsObj.ContainsKey($key)) {
                            $statsObj[$key] = [PSCustomObject]@{
                                wins = 0
                                losses = 0
                                goals = 0
                                assists = 0
                                saves = 0
                                displayName = $pName
                            }
                        }

                        $curr = $statsObj[$key]
                        $curr.goals += $goals
                        $curr.assists += $assists
                        $curr.saves += $saves
                        if ($isWin) {
                            $curr.wins += 1
                        } else {
                            $curr.losses += 1
                        }
                        $curr.displayName = $pName

                        if ($goals -gt 0 -or $assists -gt 0 -or $saves -gt 0) {
                            $highlightList += "$pName ($goals Gol, $assists Pas, $saves Kurtarış)"
                        }
                    }
                }

                # Save updated stats
                $newStatsJson = $statsObj | ConvertTo-Json -Depth 5 -Compress
                Save-HubStatsContent $newStatsJson

                # Generate broadcast event
                $global:EventCounter++
                $hlSummary = if ($highlightList.Count -gt 0) { $highlightList -join ", " } else { "Maç tamamlandı" }
                $eventObj = @{
                    id = $global:EventCounter
                    type = "MATCH_RECORDED"
                    timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
                    streamer = $streamerName
                    winnerTitle = $matchData.winnerTitle
                    loserTitle = $matchData.loserTitle
                    summary = "🏆 ${streamerName}: $hlSummary"
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
                    message = "İstatistikler başarıyla merkezi havuza kaydedildi"
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

        # 4. Hub Real-time Sync & Polling
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

            $newEvents = @()
            foreach ($ev in $global:HubEvents) {
                if ($ev.id -gt $since) {
                    $newEvents += $ev
                }
            }

            $syncResp = @{
                success = $true
                lastId = $global:EventCounter
                events = $newEvents
                activeClients = (Get-ActiveHubClientsCount)
            }

            if ($since -eq 0 -or $request.QueryString["full"] -eq "1") {
                $syncResp["fullStats"] = Get-HubStatsContent
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

        # 6. Hub Reset (Reset all player stats)
        if ($rawUrl.StartsWith("/api/hub/reset") -and $request.HttpMethod -eq "POST") {
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
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($jsonResp)
            $response.ContentType = "application/json; charset=utf-8"
            $response.ContentLength64 = $buffer.Length
            $response.StatusCode = 200
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            $response.Close()
            continue
        }

        # Health check
        if ($rawUrl.StartsWith("/api/status")) {
            $jsonResp = "{""status"":""ok"",""port"":$Port}"
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($jsonResp)
            $response.ContentType = "application/json; charset=utf-8"
            $response.ContentLength64 = $buffer.Length
            $response.StatusCode = 200
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
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

        # Auto Scan Sealed Backup Files (/api/scan-backups)
        if ($rawUrl.StartsWith("/api/scan-backups")) {
            try {
                $searchFolders = @(
                    "$env:USERPROFILE\Downloads",
                    "$env:USERPROFILE\Desktop",
                    "$scriptDir"
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

        # Static file handling
        $path = $request.Url.LocalPath
        if ($path -eq "/" -or [string]::IsNullOrWhiteSpace($path)) {
            $path = "/index.html"
        }
        $localPath = Join-Path $scriptDir $path.TrimStart("/").Replace("/", "\")

        if (Test-Path $localPath -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($localPath).ToLower()
            $mime = if ($mimeTypes.ContainsKey($ext)) { $mimeTypes[$ext] } else { "application/octet-stream" }
            $bytes = [System.IO.File]::ReadAllBytes($localPath)
            $response.ContentType = $mime
            $response.ContentLength64 = $bytes.Length
            $response.StatusCode = 200
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
            $notFound = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
            $response.ContentType = "text/plain"
            $response.ContentLength64 = $notFound.Length
            $response.OutputStream.Write($notFound, 0, $notFound.Length)
        }
        $response.Close()
    } catch {
        # ignore client disconnects
    }
}
