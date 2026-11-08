# NetMD Bundle Script
# This script creates a clean ZIP file for the Chrome Web Store

$ErrorActionPreference = "Stop"

$manifest = Get-Content manifest.json -Raw | ConvertFrom-Json
$version = $manifest.version
$zipFile = "netmd-v$version.zip"
$zipPath = Join-Path (Get-Location) $zipFile

Write-Host "Creating bundle for NetMD v$version..." -ForegroundColor Cyan

# Remove existing zip if it exists
if (Test-Path $zipFile) {
    Remove-Item $zipFile -Force
}

# Create a temporary staging directory
$staging = "staging_bundle"
if (Test-Path $staging) {
    Remove-Item -Recurse -Force $staging -ErrorAction SilentlyContinue
}
New-Item -ItemType Directory -Path $staging | Out-Null

try {
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

    # Remove store assets from staging (promo/screenshot images are uploaded
    # manually to the Chrome Web Store Developer Dashboard, not shipped with the extension)
    $storeAssets = Join-Path $staging "assets\store"
    if (Test-Path $storeAssets) {
        Remove-Item -Recurse -Force $storeAssets
        Write-Host "Excluded assets/store/ from bundle (store listing images)." -ForegroundColor DarkGray
    }

    # Ensure all file handles from copying are fully closed
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
    Start-Sleep -Milliseconds 250

    # Compress staging using native .NET ZipFile (avoids Compress-Archive handle locks and console buffer errors)
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $stagingFull = (Resolve-Path $staging).Path
    [System.IO.Compression.ZipFile]::CreateFromDirectory($stagingFull, $zipPath, [System.IO.Compression.CompressionLevel]::Optimal, $false)

}
finally {
    # Cleanup staging directory with retry logic for Windows file locks
    if (Test-Path $staging) {
        [GC]::Collect()
        [GC]::WaitForPendingFinalizers()
        
        $cleaned = $false
        for ($i = 0; $i -lt 5; $i++) {
            try {
                Start-Sleep -Milliseconds 200
                Remove-Item -Recurse -Force $staging -ErrorAction Stop
                $cleaned = $true
                break
            } catch {
                # Brief pause before retrying
            }
        }
        if (-not $cleaned) {
            Remove-Item -Recurse -Force $staging -ErrorAction SilentlyContinue
        }
    }
}

if ((Test-Path $zipFile) -and ((Get-Item $zipFile).Length -gt 0)) {
    $sizeKb = [Math]::Round((Get-Item $zipFile).Length / 1KB, 1)
    Write-Host "Successfully created $zipFile ($sizeKb KB)" -ForegroundColor Green
    Write-Host "You can now upload this file to the Chrome Web Store Developer Console."
} else {
    Write-Error "Failed to generate $zipFile"
}
