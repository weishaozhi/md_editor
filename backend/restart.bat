@echo off
chcp 65001 >nul
echo ========================================
echo   Markdown Editor - 重启脚本
echo ========================================
echo.

:: ========================================
:: 停止现有服务
:: ========================================
echo [1/4] 停止现有服务...

powershell -NoProfile -Command "Get-Process python,node -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue }" 1>nul 2>&1
echo   后端已停止
echo   前端已停止

taskkill /F /FI "WINDOWTITLE eq MD Editor Backend*" 1>nul 2>&1
taskkill /F /FI "WINDOWTITLE eq MD Editor Frontend*" 1>nul 2>&1

:: ========================================
:: 等待端口释放
:: ========================================
echo [2/4] 等待端口释放...
timeout /t 2 /nobreak >nul

powershell -NoProfile -Command "while ((Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue) -or (Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue)) { Start-Sleep -Milliseconds 500 }" 1>nul 2>&1
echo   端口已释放

:: ========================================
:: 启动后端
:: ========================================
echo [3/4] 启动后端服务 (http://localhost:8000)...
start "MD Editor Backend" cmd /k "cd /d %~dp0 && python run.py"

timeout /t 3 /nobreak >nul

powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue) { Write-Host '后端启动成功' } else { Write-Host '后端启动失败' }"

:: ========================================
:: 启动前端
:: ========================================
echo [4/4] 启动前端服务 (http://localhost:5173)...
cd ..\frontend
start "MD Editor Frontend" cmd /k "npm run dev"
cd ..\backend

timeout /t 2 /nobreak >nul

powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue) { Write-Host '前端启动成功' } else { Write-Host '前端启动失败' }"

echo.
echo ========================================
echo   服务已重启！
echo   后端: http://localhost:8000
echo   前端: http://localhost:5173
echo ========================================
echo.
echo 提示: 运行 status.bat 可查看服务状态
echo       运行 stop.bat 可停止服务
echo.