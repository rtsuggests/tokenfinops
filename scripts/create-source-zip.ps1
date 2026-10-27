$ErrorActionPreference = 'Stop'
$staging = Join-Path $env:TEMP 'tokenfinops_source_staging'
if (Test-Path $staging) { Remove-Item -Recurse -Force $staging }
New-Item -ItemType Directory -Path $staging | Out-Null

$itemsToCopy = @(
  'src',
  'public',
  'scripts',
  'astro.config.mjs',
  'netlify.toml',
  'package.json',
  'package-lock.json',
  'README.md',
  'tailwind.config.mjs',
  'tsconfig.json',
  '.env.example',
  '.gitignore'
)

foreach ($item in $itemsToCopy) {
  if (Test-Path $item) {
    Copy-Item -Path $item -Destination (Join-Path $staging $item) -Recurse -Force
  }
}

$destZip = Join-Path (Get-Location) 'tokenfinops-source.zip'
if (Test-Path $destZip) { Remove-Item -Force $destZip }

Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($staging, $destZip)
Remove-Item -Recurse -Force $staging
Write-Host "tokenfinops-source.zip created successfully!"
