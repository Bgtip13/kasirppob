@echo off
cd /d %~dp0

mkdir src\lib\supabase
mkdir src\app\login
mkdir src\app\register
mkdir src\app\onboarding
mkdir "src\app\(dashboard)"

type nul > .env.local
type nul > src\lib\supabase\client.ts
type nul > src\lib\supabase\server.ts
type nul > src\lib\auth.ts
type nul > src\middleware.ts
type nul > src\app\login\page.tsx
type nul > src\app\register\page.tsx
type nul > src\app\onboarding\page.tsx
type nul > "src\app\(dashboard)\layout.tsx"
type nul > "src\app\(dashboard)\page.tsx"
type nul > "src\app\(dashboard)\logout-button.tsx"

echo.
echo Selesai! Semua folder dan file kosong sudah dibuat.
pause
