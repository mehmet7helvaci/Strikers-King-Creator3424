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

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $response.AddHeader("Access-Control-Allow-Origin", "*")
        $response.AddHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        $response.AddHeader("Access-Control-Allow-Headers", "*")
        $response.AddHeader("Cache-Control", "no-cache, no-store, must-revalidate")
        $response.AddHeader("Pragma", "no-cache")
        $response.AddHeader("Expires", "0")

        if ($request.HttpMethod -eq "OPTIONS") {
            $response.StatusCode = 204
            $response.Close()
            continue
        }

        $rawUrl = $request.RawUrl

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
