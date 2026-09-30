# Ekkorynd deploy script for Hostinger canonical estate.
# Usage: .\deploy-Cursor.ps1 -Domain <domain>
param(
  [Parameter(Mandatory = $true)]
  [string]$Domain,

  [string]$HostingerHost = "82.25.89.47",
  [int]$HostingerPort = 65002,
  [string]$HostingerUser = "u815783393"
)

$ErrorActionPreference = "Stop"

# Build and guard.
npm run build
python deploy_guard.py --preflight
if ($LASTEXITCODE -ne 0) { throw "Preflight failed" }

# Upload only. Never chain a remote delete step here.
Write-Host "Uploading dist/ to $Domain ..."
tar -czf - -C dist . | ssh -p $HostingerPort "${HostingerUser}@${HostingerHost}" "cd ~/domains/$Domain/public_html && tar --overwrite -xzf -"
if ($LASTEXITCODE -ne 0) { throw "Upload failed" }

# Verify prohibited paths are not reachable.
$protocol = if ($Domain -match '^https?://') { "" } else { "https://" }
$baseUrl = "$protocol$Domain"
python deploy_guard.py --verify $baseUrl
if ($LASTEXITCODE -ne 0) { throw "Live verification failed" }

Write-Host "Deploy complete: $baseUrl"
