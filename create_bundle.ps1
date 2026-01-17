# NetMD Bundle Script
# This script creates a clean ZIP file for the Chrome Web Store

$version = (Get-Content manifest.json | ConvertFrom-Json).version
$zipFile = "netmd-v$version.zip"

Write-Host "Creating bundle for NetMD v$version..." -ForegroundColor Cyan

# Remove existing zip if it exists
if (Test-Path $zipFile) {
    Remove-Item $zipFile
}

# Create a temporary staging directory
$staging = "staging_bundle"
if (Test-Path $staging) { Remove-Item -Recurse -Force $staging }
New-Item -ItemType Directory -Path $staging | Out-Null

# Define files and folders to include
$includes = @(
    "src",
    "assets",
    "lib",
    "manifest.json",
    "LICENSE",
    "README.md"
)

# Copy files to staging
foreach ($item in $includes) {
    if (Test-Path $item) {
        Copy-Item -Path $item -Destination $staging -Recurse
    }
}

# Zip the staging directory
Compress-Archive -Path "$staging\*" -DestinationPath $zipFile

# Cleanup staging
Remove-Item -Recurse -Force $staging

Write-Host "Successfully created $zipFile" -ForegroundColor Green
Write-Host "You can now upload this file to the Chrome Web Store Developer Console."
