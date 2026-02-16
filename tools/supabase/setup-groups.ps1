param(
  [string]$ProjectRef = "ajbhpqbfcpmztjtxqxxk"
)

$ErrorActionPreference = "Stop"

function Ensure-Scoop {
  if (-not (Get-Command scoop -ErrorAction SilentlyContinue)) {
    Set-ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
    iwr -useb get.scoop.sh | iex
  }
}

function Ensure-SupabaseCLI {
  if (-not (Get-Command supabase -ErrorAction SilentlyContinue)) {
    Ensure-Scoop
    scoop bucket add supabase https://github.com/supabase/scoop-bucket
    scoop install supabase
  }
}

function Ensure-Linked {
  $status = supabase status 2>$null
  if ($LASTEXITCODE -ne 0 -or $status -match "not linked") {
    if (-not $env:SUPABASE_ACCESS_TOKEN) {
      Write-Error "SUPABASE_ACCESS_TOKEN not set. Set it in the current session and rerun."
    }
    supabase link --project-ref $ProjectRef | Out-Host
  }
}

function Push-Migrations {
  supabase db push | Tee-Object -Variable PushOutput | Out-Host
  if ($LASTEXITCODE -ne 0) {
    if ($PushOutput -match "migration history" -or $PushOutput -match "mismatch") {
      supabase migration repair --status applied --version 20260216 | Out-Host
      supabase db push | Out-Host
    } else {
      throw "supabase db push failed.`n$PushOutput"
    }
  }
}

function Verify-Tables {
  $q = "select to_regclass('public.groups') as groups, to_regclass('public.group_members') as group_members;"
  $r = supabase db query "$q"
  $txt = $r | Out-String
  if ($txt -notmatch "groups" -or $txt -notmatch "group_members") {
    throw "Verification output unexpected:`n$txt"
  }
  if ($txt -match "null") {
    throw "One or more tables missing:`n$txt"
  }
  Write-Output "OK: groups backend initialized."
}

Push-Location $PSScriptRoot
try {
  Set-Location "..\..\"
  Ensure-SupabaseCLI
  Ensure-Linked
  Push-Migrations
  Verify-Tables
} finally {
  Pop-Location
}

