param(
  [string]$RepoZipUrl = "https://github.com/ledome1/ledome/archive/refs/heads/main.zip",
  [string]$Domain = "app.ledome.vn",
  [string]$InstallRoot = "C:\ConstructFlow",
  [int]$Port = 3000,
  [int64]$UploadMaxBytes = 104857600,
  [int]$SessionTtlHours = 12
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

function Assert-Admin {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($identity)
  if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw "Run PowerShell as Administrator, then run the one-line install command again."
  }
}

function Ensure-Directory {
  param([string]$Path)
  New-Item -ItemType Directory -Force -Path $Path | Out-Null
}

function Download-File {
  param([string]$Url, [string]$OutFile)
  Write-Host "Downloading $Url"
  Invoke-WebRequest -UseBasicParsing -Uri $Url -OutFile $OutFile
}

function Expand-ZipClean {
  param([string]$ZipFile, [string]$Destination)
  if (Test-Path $Destination) { Remove-Item -LiteralPath $Destination -Recurse -Force }
  Ensure-Directory $Destination
  Expand-Archive -LiteralPath $ZipFile -DestinationPath $Destination -Force
}

function Get-NodeExe {
  $candidates = @(
    "C:\Program Files\nodejs\node.exe",
    "C:\Program Files (x86)\nodejs\node.exe"
  )
  foreach ($candidate in $candidates) {
    if (Test-Path $candidate) { return $candidate }
  }
  $cmd = Get-Command node.exe -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  return $null
}

function Ensure-Node {
  $nodeExe = Get-NodeExe
  if ($nodeExe) {
    Write-Host "Node found: $nodeExe"
    return $nodeExe
  }

  Write-Host "Node.js not found. Installing Node.js 22 LTS..."
  $index = Invoke-RestMethod -UseBasicParsing "https://nodejs.org/dist/index.json"
  $release = $index | Where-Object { $_.version -like "v22.*" -and $_.files -contains "win-x64-msi" } | Select-Object -First 1
  if (-not $release) { throw "Cannot find a Node.js 22 win-x64 MSI release." }

  $msi = Join-Path $env:TEMP "node-$($release.version)-x64.msi"
  Download-File "https://nodejs.org/dist/$($release.version)/node-$($release.version)-x64.msi" $msi
  $process = Start-Process -FilePath "msiexec.exe" -ArgumentList "/i", $msi, "/qn", "/norestart" -Wait -PassThru
  if ($process.ExitCode -ne 0) { throw "Node.js installer failed with exit code $($process.ExitCode)." }

  $nodeExe = Get-NodeExe
  if (-not $nodeExe) { throw "Node.js install finished, but node.exe was not found." }
  return $nodeExe
}

function Ensure-Caddy {
  param([string]$BinDir)
  $caddyExe = Join-Path $BinDir "caddy.exe"
  if (Test-Path $caddyExe) {
    Write-Host "Caddy found: $caddyExe"
    return $caddyExe
  }

  Write-Host "Installing Caddy..."
  $release = Invoke-RestMethod -UseBasicParsing "https://api.github.com/repos/caddyserver/caddy/releases/latest"
  $asset = $release.assets | Where-Object { $_.name -match "windows_amd64\.zip$" } | Select-Object -First 1
  if (-not $asset) { throw "Cannot find Caddy windows_amd64 release asset." }

  $zip = Join-Path $env:TEMP $asset.name
  $extract = Join-Path $env:TEMP "caddy-latest"
  Download-File $asset.browser_download_url $zip
  Expand-ZipClean $zip $extract
  $source = Get-ChildItem -Path $extract -Recurse -Filter "caddy.exe" | Select-Object -First 1
  if (-not $source) { throw "Cannot find caddy.exe in Caddy archive." }
  Copy-Item -LiteralPath $source.FullName -Destination $caddyExe -Force
  return $caddyExe
}

function Install-AppCode {
  param([string]$Url, [string]$AppDir)
  Write-Host "Installing app code from $Url"
  $zip = Join-Path $env:TEMP "constructflow-main.zip"
  $extract = Join-Path $env:TEMP "constructflow-main"
  Download-File $Url $zip
  Expand-ZipClean $zip $extract
  $source = Get-ChildItem -Path $extract -Directory | Select-Object -First 1
  if (-not $source) { throw "Cannot find extracted repository directory." }
  Ensure-Directory $AppDir
  robocopy $source.FullName $AppDir /MIR /XD ".git" "data" "backups" "logs" /XF ".env" "*.log" | Out-Host
  if ($LASTEXITCODE -gt 7) { throw "robocopy failed with exit code $LASTEXITCODE." }
}

function Set-FirewallRule {
  param([string]$Name, [int]$LocalPort)
  $existing = Get-NetFirewallRule -DisplayName $Name -ErrorAction SilentlyContinue
  if ($existing) { return }
  New-NetFirewallRule -DisplayName $Name -Direction Inbound -Action Allow -Protocol TCP -LocalPort $LocalPort | Out-Null
}

function Stop-MatchingProcesses {
  param(
    [string]$ExecutableName,
    [string]$CommandNeedle
  )

  Get-CimInstance Win32_Process -Filter "name = '$ExecutableName'" | Where-Object {
    $_.CommandLine -and $_.CommandLine.Contains($CommandNeedle)
  } | ForEach-Object {
    Write-Host "Stopping process $($_.ProcessId): $($_.CommandLine)"
    Invoke-CimMethod -InputObject $_ -MethodName Terminate | Out-Null
  }
}

function Write-LaunchScripts {
  param(
    [string]$NodeExe,
    [string]$CaddyExe,
    [string]$AppDir,
    [string]$DataDir,
    [string]$BackupDir,
    [string]$LogsDir,
    [string]$CaddyFile,
    [string]$BinDir,
    [int]$Port,
    [int64]$UploadMaxBytes,
    [int]$SessionTtlHours
  )

  $appScript = Join-Path $BinDir "start-constructflow.ps1"
  $caddyScript = Join-Path $BinDir "start-caddy.ps1"

  @"
`$ErrorActionPreference = "Stop"
`$env:NODE_ENV = "production"
`$env:PORT = "$Port"
`$env:DATA_DIR = "$DataDir"
`$env:BACKUP_DIR = "$BackupDir"
`$env:UPLOAD_MAX_BYTES = "$UploadMaxBytes"
`$env:SESSION_TTL_HOURS = "$SessionTtlHours"
Set-Location -LiteralPath "$AppDir"
& "$NodeExe" "server.js" *>> "$LogsDir\constructflow.out.log"
"@ | Set-Content -LiteralPath $appScript -Encoding ASCII

  @"
`$ErrorActionPreference = "Stop"
Set-Location -LiteralPath "$(Split-Path -Parent $CaddyFile)"
& "$CaddyExe" run --config "$CaddyFile" --adapter caddyfile *>> "$LogsDir\caddy.out.log"
"@ | Set-Content -LiteralPath $caddyScript -Encoding ASCII

  return @{ App = $appScript; Caddy = $caddyScript }
}

function Ensure-StartupTask {
  param(
    [string]$Name,
    [string]$ScriptPath
  )

  $existing = Get-ScheduledTask -TaskName $Name -ErrorAction SilentlyContinue
  if ($existing) {
    Stop-ScheduledTask -TaskName $Name -ErrorAction SilentlyContinue
  }

  $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$ScriptPath`""
  $trigger = New-ScheduledTaskTrigger -AtStartup
  $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
  $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
  Register-ScheduledTask -TaskName $Name -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
  Start-ScheduledTask -TaskName $Name
}

function Start-DetachedScript {
  param([string]$ScriptPath)
  Start-Process `
    -FilePath "powershell.exe" `
    -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $ScriptPath `
    -WindowStyle Hidden | Out-Null
}

function Show-Diagnostics {
  param(
    [string]$LogsDir,
    [int]$Port
  )

  Write-Host ""
  Write-Host "Diagnostics:"
  Get-ScheduledTask -TaskName ConstructFlow, ConstructFlowCaddy -ErrorAction SilentlyContinue | Format-Table TaskName, State -AutoSize | Out-Host
  Get-CimInstance Win32_Process -Filter "name = 'node.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine.Contains("server.js") } | Select-Object ProcessId, CommandLine | Format-List | Out-Host
  netstat -ano | Select-String ":$Port\s+.*LISTENING" | Out-Host

  foreach ($file in @("constructflow.out.log", "caddy.out.log")) {
    $path = Join-Path $LogsDir $file
    if (Test-Path $path) {
      Write-Host ""
      Write-Host "Last log lines from $path"
      Get-Content -LiteralPath $path -Tail 30 | Out-Host
    }
  }
}

function Wait-ForHealth {
  param([string]$Url)
  for ($attempt = 1; $attempt -le 60; $attempt++) {
    try {
      $health = Invoke-RestMethod -UseBasicParsing $Url
      if ($health.ok) { return $health }
    } catch {
      Start-Sleep -Seconds 1
    }
  }
  throw "Health check failed at $Url."
}

Assert-Admin

$appDir = Join-Path $InstallRoot "app"
$dataDir = Join-Path $InstallRoot "data"
$backupDir = Join-Path $InstallRoot "backups"
$logsDir = Join-Path $InstallRoot "logs"
$binDir = Join-Path $InstallRoot "bin"

Ensure-Directory $InstallRoot
Ensure-Directory $appDir
Ensure-Directory $dataDir
Ensure-Directory $backupDir
Ensure-Directory $logsDir
Ensure-Directory $binDir

$nodeExe = Ensure-Node
$caddyExe = Ensure-Caddy $binDir
Install-AppCode $RepoZipUrl $appDir

$caddyFile = Join-Path $InstallRoot "Caddyfile"
@"
$Domain {
  encode gzip
  reverse_proxy 127.0.0.1:$Port
}
"@ | Set-Content -LiteralPath $caddyFile -Encoding ASCII

$scripts = Write-LaunchScripts `
  -NodeExe $nodeExe `
  -CaddyExe $caddyExe `
  -AppDir $appDir `
  -DataDir $dataDir `
  -BackupDir $backupDir `
  -LogsDir $logsDir `
  -CaddyFile $caddyFile `
  -BinDir $binDir `
  -Port $Port `
  -UploadMaxBytes $UploadMaxBytes `
  -SessionTtlHours $SessionTtlHours

Stop-MatchingProcesses -ExecutableName "node.exe" -CommandNeedle $appDir
Stop-MatchingProcesses -ExecutableName "caddy.exe" -CommandNeedle $caddyFile

Ensure-StartupTask -Name "ConstructFlow" -ScriptPath $scripts.App
Ensure-StartupTask -Name "ConstructFlowCaddy" -ScriptPath $scripts.Caddy
Start-DetachedScript $scripts.App
Start-DetachedScript $scripts.Caddy

Set-FirewallRule "ConstructFlow HTTP 80" 80
Set-FirewallRule "ConstructFlow HTTPS 443" 443

$healthUrl = "http://127.0.0.1:$Port/api/v1/health"
try {
  $health = Wait-ForHealth $healthUrl
} catch {
  Show-Diagnostics -LogsDir $logsDir -Port $Port
  throw
}

Write-Host ""
Write-Host "ConstructFlow install complete."
Write-Host "Local health: $healthUrl"
Write-Host "Startup tasks: ConstructFlow, ConstructFlowCaddy"
Write-Host "Public URL after DNS/router setup: https://$Domain"
Write-Host ""
Write-Host "Next required network steps:"
Write-Host "1. DNS A record: $Domain -> company public IP."
Write-Host "2. Router/NAT forward public 80 and 443 to this server."
Write-Host "3. Do not expose port $Port publicly."
Write-Host "4. Open https://$Domain and change all default passwords before real use."
