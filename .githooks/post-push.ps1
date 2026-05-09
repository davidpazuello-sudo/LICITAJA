param(
  [Parameter(Mandatory = $true)]
  [string]$StdinFile
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$lines = Get-Content -LiteralPath $StdinFile | Where-Object { $_.Trim() -ne "" }
$changedFiles = [System.Collections.Generic.HashSet[string]]::new()

foreach ($line in $lines) {
  $parts = $line -split "\s+"
  if ($parts.Length -lt 4) {
    continue
  }

  $localSha = $parts[1]
  $remoteSha = $parts[3]

  if ($remoteSha -match "^0+$") {
    $diffOutput = & git diff-tree --no-commit-id --name-only -r $localSha
  } else {
    $diffOutput = & git diff --name-only $remoteSha $localSha
  }

  foreach ($file in $diffOutput) {
    if ($file) {
      [void]$changedFiles.Add($file.Trim())
    }
  }
}

$frontendChanged = $changedFiles | Where-Object { $_ -eq ".htaccess" -or $_ -like "frontend/*" }
$backendChanged = $changedFiles | Where-Object { $_ -like "backend/*" }

if ($frontendChanged.Count -gt 0) {
  Write-Host "[LicitaAI] Deployando frontend na Hostinger..."
  & python (Join-Path $repoRoot "scripts\\deploy_hostinger_frontend.py") --repo-root $repoRoot
  if ($LASTEXITCODE -ne 0) {
    throw "Falha no deploy do frontend para Hostinger."
  }
}

if ($backendChanged.Count -gt 0) {
  Write-Host "[LicitaAI] Deployando backend no Railway..."
  & "C:\Users\david\AppData\Roaming\npm\railway.cmd" up backend --path-as-root --detach --service LICITAJA --environment production --project c6b019f1-a049-4086-b4fd-2ac13211ef6a --message "post-push deploy $(git -C $repoRoot rev-parse --short HEAD)"
  if ($LASTEXITCODE -ne 0) {
    throw "Falha no deploy do backend para Railway."
  }
}
