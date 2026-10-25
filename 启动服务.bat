@echo off
chcp 65001 >nul
title 工时记录 - 本地服务
cd /d "%~dp0"

echo ============================================
echo   工时记录 App - 本地服务
echo ============================================
echo.
echo   电脑访问：http://127.0.0.1:8788/
echo   iPhone 访问：http://192.168.1.253:8788/
echo                （iPhone 需连同一个 Wi-Fi）
echo.
echo   关闭此窗口即停止服务
echo ============================================
echo.

python -m http.server 8788 --bind 0.0.0.0
pause
