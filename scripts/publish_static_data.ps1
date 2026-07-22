param(
    [string]$CommitMessage = "Update static catalog data"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $ProjectRoot

if (-not $env:PYTHONPATH) {
    $env:PYTHONPATH = "src"
}

python scripts/export_static_data.py --clean
git add web/data
git commit -m $CommitMessage
git push
