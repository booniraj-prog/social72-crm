$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$zip = Join-Path $root "social72-host.zip"
$stage = Join-Path $env:TEMP ("social72-host-" + [guid]::NewGuid().ToString("N"))

$include = @(
  "package.json",
  "package-lock.json",
  "next.config.ts",
  "tsconfig.json",
  "postcss.config.mjs",
  "eslint.config.mjs",
  "docker-compose.yml",
  ".env.example",
  "README.md",
  "prisma",
  "src",
  "public"
)

New-Item -ItemType Directory -Path $stage | Out-Null
try {
  foreach ($name in $include) {
    $from = Join-Path $root $name
    if (Test-Path $from) {
      Copy-Item -LiteralPath $from -Destination (Join-Path $stage $name) -Recurse -Force
    }
  }
  if (Test-Path $zip) { Remove-Item -LiteralPath $zip -Force }
  Compress-Archive -Path (Join-Path $stage "*") -DestinationPath $zip -CompressionLevel Optimal
  $mb = [math]::Round((Get-Item $zip).Length / 1MB, 2)
  Write-Output "Wrote $zip ($mb MB). Upload this zip, then on the server: npm ci && npx prisma generate && npm run build && npm start"
}
finally {
  Remove-Item -LiteralPath $stage -Recurse -Force -ErrorAction SilentlyContinue
}
