# PowerShell helper script to start PostgreSQL 17 cluster on port 5435
$pgData = "C:\Users\USER\.elov_pgdata"
$pgCtl = "C:\Program Files\PostgreSQL\17\bin\pg_ctl.exe"

if (-not (Test-Path $pgData)) {
    Write-Host "Initializing PostgreSQL cluster in $pgData..." -ForegroundColor Cyan
    & "C:\Program Files\PostgreSQL\17\bin\initdb.exe" -D $pgData -U postgres -A trust --encoding=UTF8
    Add-Content -Path "$pgData\postgresql.conf" -Value "`nport = 5435`n"
}

Write-Host "Starting PostgreSQL on port 5435..." -ForegroundColor Green
& $pgCtl -D $pgData -l "$pgData\server.log" start
Write-Host "PostgreSQL 17 is running on port 5435." -ForegroundColor Green
