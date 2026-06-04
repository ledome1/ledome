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

function Ensure-Nssm {
  param([string]$BinDir)
  $nssmExe = Join-Path $BinDir "nssm.exe"
  if (Test-Path $nssmExe) {
    Write-Host "NSSM found: $nssmExe"
    return $nssmExe
  }

  Write-Host "Installing NSSM..."
  $zip = Join-Path $env:TEMP "nssm-2.24.zip"
  $extract = Join-Path $env:TEMP "nssm-2.24"
  Download-File "https://nssm.cc/release/nssm-2.24.zip" $zip
  Expand-ZipClean $zip $extract
  $source = Get-ChildItem -Path $extract -Recurse -Filter "nssm.exe" | Where-Object { $_.FullName -match "\\win64\\" } | Select-Object -First 1
  if (-not $source) { throw "Cannot find win64 nssm.exe in NSSM archive." }
  Copy-Item -LiteralPath $source.FullName -Destination $nssmExe -Force
  return $nssmExe
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

function Ensure-Service {
  param(
    [string]$NssmExe,
    [string]$Name,
    [string]$Application,
    [string]$Arguments,
    [string]$Directory,
    [string[]]$Environment,
    [string]$Stdout,
    [string]$Stderr
  )

  $service = Get-Service -Name $Name -ErrorAction SilentlyContinue
  if (-not $service) {
    & $NssmExe install $Name $Application $Arguments | Out-Host
  }
  & $NssmExe set $Name Application $Application | Out-Host
  & $NssmExe set $Name AppDirectory $Directory | Out-Host
  & $NssmExe set $Name AppParameters $Arguments | Out-Host
  & $NssmExe set $Name AppStdout $Stdout | Out-Host
  & $NssmExe set $Name AppStderr $Stderr | Out-Host
  & $NssmExe set $Name AppRotateFiles 1 | Out-Host
  & $NssmExe set $Name AppRotateOnline 1 | Out-Host
  & $NssmExe set $Name AppRotateBytes 10485760 | Out-Host
  & $NssmExe set $Name Start SERVICE_AUTO_START | Out-Host
  if ($Environment -and $Environment.Count) {
    & $NssmExe set $Name AppEnvironmentExtra $Environment | Out-Host
  }

  $service = Get-Service -Name $Name -ErrorAction SilentlyContinue
  if ($service -and $service.Status -eq "Running") {
    & $NssmExe restart $Name | Out-Host
  } else {
    & $NssmExe start $Name | Out-Host
  }
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
$nssmExe = Ensure-Nssm $binDir
$caddyExe = Ensure-Caddy $binDir
Install-AppCode $RepoZipUrl $appDir

$caddyFile = Join-Path $InstallRoot "Caddyfile"
@"
$Domain {
  encode gzip
  reverse_proxy 127.0.0.1:$Port
}
"@ | Set-Content -LiteralPath $caddyFile -Encoding ASCII

$appEnv = @(
  "NODE_ENV=production",
  "PORT=$Port",
  "DATA_DIR=$dataDir",
  "BACKUP_DIR=$backupDir",
  "UPLOAD_MAX_BYTES=$UploadMaxBytes",
  "SESSION_TTL_HOURS=$SessionTtlHours"
)

Ensure-Service `
  -NssmExe $nssmExe `
  -Name "ConstructFlow" `
  -Application $nodeExe `
  -Arguments "server.js" `
  -Directory $appDir `
  -Environment $appEnv `
  -Stdout (Join-Path $logsDir "constructflow.out.log") `
  -Stderr (Join-Path $logsDir "constructflow.err.log")

Ensure-Service `
  -NssmExe $nssmExe `
  -Name "ConstructFlowCaddy" `
  -Application $caddyExe `
  -Arguments "run --config `"$caddyFile`" --adapter caddyfile" `
  -Directory $InstallRoot `
  -Environment @() `
  -Stdout (Join-Path $logsDir "caddy.out.log") `
  -Stderr (Join-Path $logsDir "caddy.err.log")

Set-FirewallRule "ConstructFlow HTTP 80" 80
Set-FirewallRule "ConstructFlow HTTPS 443" 443

Start-Sleep -Seconds 2
$healthUrl = "http://127.0.0.1:$Port/api/v1/health"
$health = Invoke-RestMethod -UseBasicParsing $healthUrl
if (-not $health.ok) { throw "Health check failed at $healthUrl." }

Write-Host ""
Write-Host "ConstructFlow install complete."
Write-Host "Local health: $healthUrl"
Write-Host "Public URL after DNS/router setup: https://$Domain"
Write-Host ""
Write-Host "Next required network steps:"
Write-Host "1. DNS A record: $Domain -> company public IP."
Write-Host "2. Router/NAT forward public 80 and 443 to this server."
Write-Host "3. Do not expose port $Port publicly."
Write-Host "4. Open https://$Domain and change all default passwords before real use."
