@echo off
chcp 65001 >nul
echo ========================================
echo   Markdown Editor - 服务状态
echo ========================================
echo.

:: ========================================
:: 后端状态
:: ========================================
echo [后端服务 - 端口 8000]
powershell -NoProfile -Command "$b = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue; if ($b) { $p = Get-Process -Id $b.OwningProcess -ErrorAction SilentlyContinue; Write-Host '  状态:   运行中'; Write-Host ('  PID:    ' + $b.OwningProcess); Write-Host ('  进程:   ' + $p.ProcessName); Write-Host '  地址:   http://localhost:8000' } else { Write-Host '  状态:   已停止'; Write-Host '  地址:   http://localhost:8000' }; Write-Host ''"

echo.

:: ========================================
:: 前端状态
:: ========================================
echo [前端服务 - 端口 5173]
powershell -NoProfile -Command "$f = Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue; if ($f) { $p = Get-Process -Id $f.OwningProcess -ErrorAction SilentlyContinue; Write-Host '  状态:   运行中'; Write-Host ('  PID:    ' + $f.OwningProcess); Write-Host ('  进程:   ' + $p.ProcessName); Write-Host '  地址:   http://localhost:5173' } else { Write-Host '  状态:   已停止'; Write-Host '  地址:   http://localhost:5173' }; Write-Host ''"

echo.

:: ========================================
:: WebSocket
:: ========================================
echo [WebSocket - 端口 8000]
powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue) { Write-Host '  状态:   可用 (复用后端端口)' } else { Write-Host '  状态:   不可用 (后端未运行)' }; Write-Host ''"

echo.

:: ========================================
:: 健康检查
:: ========================================
echo [健康检查]
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri 'http://localhost:8000/health' -UseBasicParsing -TimeoutSec 3; Write-Host ('  后端 API: ' + $r.StatusCode) } catch { Write-Host '  后端 API: 无法连接' }"
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri 'http://localhost:5173' -UseBasicParsing -TimeoutSec 3; Write-Host ('  前端页面: ' + $r.StatusCode) } catch { Write-Host '  前端页面: 无法连接' }"

echo.
echo ========================================
echo   汇总
echo ========================================
powershell -NoProfile -Command "$b = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue; $f = Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue; if ($b -and $f) { Write-Host '所有服务运行正常' } elseif ($b) { Write-Host '后端运行中，前端已停止' } elseif ($f) { Write-Host '前端运行中，后端已停止' } else { Write-Host '所有服务已停止' }"
echo ========================================