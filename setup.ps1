param([switch]$Preview, [switch]$Start)
$ErrorActionPreference = 'Stop'
if ($Preview -and $Start) { throw 'Choose either -Preview or -Start.' }
if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT -or -not [Environment]::Is64BitOperatingSystem) {
    throw 'DesktopRug requires 64-bit Windows.'
}
if (-not (Get-Command node.exe -ErrorAction SilentlyContinue) -or -not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
    throw 'Install Node.js 24 (x64), reopen PowerShell, then run setup.ps1 again.'
}
& node.exe -e "const [major,minor]=process.versions.node.split('.').map(Number);if(major<22||(major===22&&minor<12)||process.arch!=='x64')process.exit(1)"
if ($LASTEXITCODE -ne 0) { throw 'Node.js x64 >= 22.12 is required. Node.js 24 is recommended.' }
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path -LiteralPath $compiler)) { throw 'Windows .NET Framework 4.x compiler was not found.' }
& npm.cmd ci --prefix (Join-Path $PSScriptRoot 'web') --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed. Check access to npm and GitHub Electron downloads.' }
# Electron 44 downloads its runtime on demand; the native launcher needs it now.
& node.exe (Join-Path $PSScriptRoot 'web\node_modules\electron\install.js')
if ($LASTEXITCODE -ne 0) { throw 'Electron runtime download failed. Check access to GitHub downloads.' }
& (Join-Path $PSScriptRoot 'build.ps1')
if ($LASTEXITCODE -ne 0) { throw 'Native build failed.' }
& node.exe (Join-Path $PSScriptRoot 'scripts\check.mjs')
if ($LASTEXITCODE -ne 0) { throw 'Source checks failed.' }
$electron = Join-Path $PSScriptRoot 'web\node_modules\electron\dist\electron.exe'
if (-not (Test-Path -LiteralPath $electron)) { throw 'Electron runtime is missing after installation.' }
Write-Output 'DesktopRug is ready. Use DesktopRug.exe --gpu-preview for a preview, or DesktopRug.exe for the desktop.'
if ($Preview) {
    Start-Process -FilePath (Join-Path $PSScriptRoot 'DesktopRug.exe') -ArgumentList '--gpu-preview' -WorkingDirectory $PSScriptRoot -WindowStyle Hidden
} elseif ($Start) {
    Start-Process -FilePath (Join-Path $PSScriptRoot 'DesktopRug.exe') -WorkingDirectory $PSScriptRoot -WindowStyle Hidden
}
