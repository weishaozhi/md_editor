@echo off
chcp 65001 >nul
echo ========================================
echo   Markdown Editor - 停止脚本
echo ========================================
echo.

:: ========================================
:: 停止后端 (端口 8000)
:: ========================================
echo [1/2] 停止后端服务 (端口 8000)...

powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }" 1>nul 2>&1
if errorlevel 1 (
    echo   后端未运行
) else (
    powershell -NoProfile -Command "Get-Process python -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue }" 1>nul 2>&1
    echo   已停止所有 Python 进程
    timeout /t 1 /nobreak >nul 2>&1
    powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue) { exit 1 } else { exit 0 }" 1>nul 2>&1
    if errorlevel 1 (
        echo   警告: 后端仍在运行
        taskkill /F /IM python.exe 1>nul 2>&1
    ) else (
        echo   后端已停止
    )
)

:: ========================================
:: 停止前端 (端口 5173)
:: ========================================
echo [2/2] 停止前端服务 (端口 5173)...

powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }" 1>nul 2>&1
if errorlevel 1 (
    echo   前端未运行
) else (
    powershell -NoProfile -Command "Get-Process node -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue }" 1>nul 2>&1
    echo   已停止所有 Node 进程
    timeout /t 1 /nobreak >nul 2>&1
    powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue) { exit 1 } else { exit 0 }" 1>nul 2>&1
    if errorlevel 1 (
        echo   警告: 前端仍在运行
        taskkill /F /IM node.exe 1>nul 2>&1
    ) else (
        echo   前端已停止
    )
)

:: ========================================
:: 兜底
:: ========================================
taskkill /F /FI "WINDOWTITLE eq MD Editor Backend*" 1>nul 2>&1
taskkill /F /FI "WINDOWTITLE eq MD Editor Frontend*" 1>nul 2>&1

:: 最终状态
echo.
echo [状态]
powershell -NoProfile -Command "$b = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue; $f = Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue; if (-not $b -and -not $f) { Write-Host '所有服务已停止' } elseif (-not $b) { Write-Host '后端已停止，前端仍在运行' } elseif (-not $f) { Write-Host '前端已停止，后端仍在运行' } else { Write-Host '仍有服务在运行' }"

echo.
echo ========================================
echo   操作完成
echo ========================================