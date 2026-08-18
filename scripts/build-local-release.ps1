param(
  [Parameter(Mandatory = $true)]
  [string]$KeyPath,

  [string]$KeyPassword = "",
  [string]$Repository = "Validolio11/E-task-manager",
  [string]$Notes = "First E-task release"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Assert-Command {
  param([Parameter(Mandatory = $true)][string]$Name)

  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command '$Name' was not found. Install it and restart PowerShell."
  }
}

function Invoke-Checked {
  param(
    [Parameter(Mandatory = $true)][string]$Command,
    [Parameter(Mandatory = $true)][string[]]$Arguments
  )

  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed with exit code $LASTEXITCODE`: $Command $($Arguments -join ' ')"
  }
}

Assert-Command -Name "node"
Assert-Command -Name "npm"
Assert-Command -Name "rustc"
Assert-Command -Name "cargo"

$scriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$repositoryRoot = (Resolve-Path (Join-Path $scriptDirectory "..")).Path
$resolvedKeyPath = (Resolve-Path $KeyPath).Path
$configPath = Join-Path $repositoryRoot "src-tauri\tauri.conf.json"
$config = Get-Content -Raw $configPath | ConvertFrom-Json
$version = [string]$config.version
$tag = "v$version"

if ($version -notmatch '^\d+\.\d+\.\d+([+-][0-9A-Za-z.-]+)?$') {
  throw "Invalid application version in tauri.conf.json: $version"
}

$nsisDirectory = Join-Path $repositoryRoot "src-tauri\target\release\bundle\nsis"
$releaseDirectory = Join-Path $repositoryRoot "release\$tag"

Push-Location $repositoryRoot
try {
  $env:TAURI_SIGNING_PRIVATE_KEY = $resolvedKeyPath
  $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = $KeyPassword

  Invoke-Checked -Command "npm" -Arguments @("ci")
  Invoke-Checked -Command "npm" -Arguments @("run", "desktop:build", "--", "--bundles", "nsis")

  $installer = Get-ChildItem -Path $nsisDirectory -Filter "*.exe" |
    Sort-Object LastWriteTimeUtc -Descending |
    Select-Object -First 1

  if (-not $installer) {
    throw "The NSIS installer was not found in $nsisDirectory"
  }

  $signaturePath = "$($installer.FullName).sig"
  if (-not (Test-Path $signaturePath)) {
    throw "The updater signature was not generated: $signaturePath"
  }

  New-Item -ItemType Directory -Path $releaseDirectory -Force | Out-Null
  Copy-Item -Path $installer.FullName -Destination $releaseDirectory -Force
  Copy-Item -Path $signaturePath -Destination $releaseDirectory -Force

  $signature = (Get-Content -Raw $signaturePath).Trim()
  $encodedInstallerName = [Uri]::EscapeDataString($installer.Name)
  $downloadUrl = "https://github.com/$Repository/releases/download/$tag/$encodedInstallerName"

  $manifest = [ordered]@{
    version = $version
    notes = $Notes
    pub_date = [DateTime]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ")
    platforms = [ordered]@{
      "windows-x86_64" = [ordered]@{
        signature = $signature
        url = $downloadUrl
      }
    }
  }

  $manifestPath = Join-Path $releaseDirectory "latest.json"
  $manifestJson = $manifest | ConvertTo-Json -Depth 6
  $utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($manifestPath, $manifestJson, $utf8WithoutBom)

  Write-Host ""
  Write-Host "Local E-task release is ready:" -ForegroundColor Green
  Write-Host "  $releaseDirectory"
  Write-Host ""
  Write-Host "Upload all three files to a published GitHub Release with tag $tag`:"
  Write-Host "  $($installer.Name)"
  Write-Host "  $($installer.Name).sig"
  Write-Host "  latest.json"
}
finally {
  Remove-Item Env:TAURI_SIGNING_PRIVATE_KEY -ErrorAction SilentlyContinue
  Remove-Item Env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD -ErrorAction SilentlyContinue
  Pop-Location
}
