@echo off
chcp 65001 > nul
echo.
echo ╔════════════════════════════════════════╗
echo ║  네이버 브랜드 검색 대시보드           ║
echo ╚════════════════════════════════════════╝
echo.

:: ── 파일 보안 해제 (SmartScreen / 스마트 앱 컨트롤 차단 방지) ──
echo  [1/3] 파일 보안 해제 중...
powershell -NoProfile -Command ^
  "Get-ChildItem -Path '%~dp0' -Recurse -File | Unblock-File -ErrorAction SilentlyContinue; Write-Host '  완료'" 2>nul
echo.

:: ── Node.js 설치 확인 ──
echo  [2/3] Node.js 확인 중...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  [오류] Node.js가 설치되어 있지 않습니다.
    echo.
    echo   Node.js 다운로드: https://nodejs.org
    echo   LTS 버전을 설치한 후 다시 실행해 주세요.
    echo.
    pause
    exit /b 1
)
node -v
echo.

:: ── 서버 시작 ──
echo  [3/3] 서버를 시작합니다...
echo.
echo  브라우저에서 아래 주소를 여세요:
echo  ^> http://localhost:3000
echo.
echo  종료하려면 이 창을 닫거나 Ctrl+C 를 누르세요.
echo.

node "%~dp0server.js"
pause
