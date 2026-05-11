@echo off
chcp 65001 > nul
echo.
echo ╔════════════════════════════════════════════════════╗
echo ║  파일 보안 해제 (최초 1회 실행)                    ║
echo ║  Windows 스마트 앱 컨트롤 / SmartScreen 차단 해제  ║
echo ╚════════════════════════════════════════════════════╝
echo.
echo  이 폴더의 모든 파일에서 인터넷 다운로드 표시를 제거합니다.
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$count = 0; Get-ChildItem -Path '%~dp0' -Recurse -File | ForEach-Object { Unblock-File $_.FullName -ErrorAction SilentlyContinue; $count++ }; Write-Host (\"  $count 개 파일 보안 해제 완료\")"

echo.
echo  완료! 이제 시작.bat 를 실행하세요.
echo.
pause
