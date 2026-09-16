@echo off
REM n8n + Supabase Setup Script for Windows
REM Run this script to configure n8n with Supabase credentials

setlocal enabledelayedexpansion

echo ================================
echo N8N + Supabase Setup
echo ================================
echo.

REM Check if n8n is installed
where n8n >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] n8n is installed
) else (
    echo [ERROR] n8n not found
    echo Install with: npm install -g n8n
    exit /b 1
)

echo.
echo Step 1: Supabase Credentials
echo ==============================
echo.
echo Go to Supabase Dashboard ^> Settings ^> API
echo.

set /p SUPABASE_URL="Enter your Supabase Project URL (e.g., https://xxxxx.supabase.co): "
set /p SUPABASE_ANON_KEY="Enter your Supabase Anon Key: "
set /p SUPABASE_SERVICE_ROLE_KEY="Enter your Supabase Service Role Key (optional, press Enter to skip): "

echo.
echo Step 2: N8N Webhook Secret
echo ==============================
echo.
set /p N8N_SECRET="Enter a secure secret for N8N_WEBHOOK_SECRET (press Enter to use default): "

if "%N8N_SECRET%"=="" (
    set "N8N_SECRET=your-secure-secret-key-here"
    echo Using default: %N8N_SECRET%
)

echo.
echo Step 3: Environment Setup
echo ==============================
echo.

REM Create .env.n8n file
(
    echo # Supabase Configuration
    echo SUPABASE_URL=%SUPABASE_URL%
    echo SUPABASE_ANON_KEY=%SUPABASE_ANON_KEY%
    echo SUPABASE_SERVICE_ROLE_KEY=%SUPABASE_SERVICE_ROLE_KEY%
    echo.
    echo # N8N Webhook Secret
    echo N8N_WEBHOOK_SECRET=%N8N_SECRET%
    echo.
    echo # N8N Configuration
    echo N8N_PROTOCOL=http
    echo N8N_HOST=localhost
    echo N8N_PORT=5678
    echo N8N_TIMEZONE=Africa/Nairobi
    echo.
    echo # Dantown API Configuration
    echo DANTOWN_API_URL=http://localhost:3000/api/automation/stock-intake
) > .env.n8n

echo [OK] Created .env.n8n with your configuration
echo.

echo Step 4: Update Dantown .env
echo ==============================
echo.
echo Add this to your Dantown apps\web\.env.local:
echo.
echo # N8N Integration
echo N8N_WEBHOOK_SECRET=%N8N_SECRET%
echo.
echo Command:
echo   echo # N8N Integration >> apps\web\.env.local
echo   echo N8N_WEBHOOK_SECRET=%N8N_SECRET% >> apps\web\.env.local
echo.

echo Step 5: Next Steps
echo ==============================
echo.
echo 1. Update Dantown environment:
echo    Open apps\web\.env.local and add:
echo    N8N_WEBHOOK_SECRET=%N8N_SECRET%
echo.
echo 2. Start n8n:
echo    set -a
echo    for /f "delims==" %%%%i in (.env.n8n) do set "%%%%i"
echo    n8n
echo.
echo    OR simply run:
echo    set N8N_WEBHOOK_SECRET=%N8N_SECRET%
echo    n8n
echo.
echo 3. Access n8n:
echo    http://localhost:5678
echo.
echo 4. Add Supabase Credential:
echo    - Click Credentials (left sidebar)
echo    - Click New Credential
echo    - Search for 'Supabase'
echo    - Fill in:
echo      * Credential Name: Supabase - Dantown
echo      * Host: %SUPABASE_URL%
echo      * API Key (Anon): %SUPABASE_ANON_KEY%
echo      * Service Role Key: %SUPABASE_SERVICE_ROLE_KEY%
echo    - Click Save
echo.
echo 5. Import n8n workflow:
echo    - Open n8n
echo    - Click Import
echo    - Upload: automation\n8n\n8n_workflow_stock_intake.json
echo.
echo 6. Update workflow with your credentials:
echo    - Edit HTTP Request node
echo    - Verify URL is: http://localhost:3000/api/automation/stock-intake
echo    - Header should be: x-dantown-automation-secret = {{ $env.N8N_WEBHOOK_SECRET }}
echo    - Save and test
echo.

echo [OK] Setup complete!
echo.
pause
