# AKEEYO Interview Tool - one-click restart (server + public tunnel + QR regen)
# Usage: right-click -> Run with PowerShell  (or: powershell -File restart-interview.ps1)
$ErrorActionPreference = "Continue"
$root = "D:\WorkBuddy\2026-09-29-18-33-46\akeeyo-interview"
$py = "C:\Users\Gaa zeon Wong\.workbuddy\binaries\python\envs\default\Scripts\python.exe"
$npm = "C:\Users\Gaa zeon Wong\.workbuddy\binaries\node\versions\24.14.0\npm.cmd"

# 1. Start local server if not already running
$up = $false
try { $up = (Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 http://localhost:3000/healthz).StatusCode -eq 200 } catch {}
if (-not $up) {
  Write-Host "[1/3] Starting interview server..."
  Start-Process -FilePath $npm -ArgumentList "start" -WorkingDirectory $root -WindowStyle Minimized
  Start-Sleep -Seconds 5
} else {
  Write-Host "[1/3] Server already running."
}

# 2. Start public tunnel, capture URL
Write-Host "[2/3] Starting public tunnel (about 10-30s)..."
$log = "$env:TEMP\akeeyo-tunnel-err.log"
Start-Process -FilePath "$root\bin\cloudflared.exe" `
  -ArgumentList "tunnel", "--url", "http://localhost:3000" `
  -RedirectStandardError $log -RedirectStandardOutput "$env:TEMP\akeeyo-tunnel-out.log" `
  -WindowStyle Hidden
$url = $null
foreach ($i in 1..20) {
  Start-Sleep -Seconds 2
  if (Test-Path $log) {
    $m = Select-String -Path $log -Pattern "https://[a-z0-9-]+\.trycloudflare\.com" | Select-Object -First 1
    if ($m) { $url = $m.Matches[0].Value; break }
  }
}
if (-not $url) {
  Write-Host "TUNNEL FAILED - see log: $log"
  exit 1
}

# 3. Regenerate QR code + poster with the new URL
Write-Host "[3/3] Regenerating QR code and poster..."
& $py "$root\scripts\make_qr.py" $url

Write-Host ""
Write-Host "=================================================="
Write-Host "  PUBLIC URL : $url"
Write-Host "  QR / POSTER: $root\candidate-poster.png"
Write-Host "  ADMIN      : $url/admin  (token in .env)"
Write-Host "  NOTE: URL changes after each restart - regenerate"
Write-Host "        the QR (this script does it) and resend it."
Write-Host "=================================================="
Start-Process explorer.exe "/select,`"$root\candidate-poster.png`""
