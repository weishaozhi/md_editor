@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
echo ========================================
echo   Markdown Editor - 停止脚本
echo ========================================
echo.

:: ========================================
rem Safe stop constraints:
rem - Match project launchers by session, executable, title and command line.
rem - Fall back to listener PIDs for services started outside start.bat.
rem - Treat either a remaining listener or launcher as a failure.
:: ========================================
set "FAILED=0"

:: ========================================
:: 停止后端 (端口 8000)
:: ========================================
echo [1/2] 停止后端服务 (端口 8000)...

set "BACKEND_PIDS="
for /f "usebackq tokens=*" %%P in (`powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique"`) do (
    set "BACKEND_PIDS=!BACKEND_PIDS! %%P"
)

set "BACKEND_LAUNCHERS="
for /f "usebackq tokens=*" %%P in (`powershell -NoProfile -Command "$sessionId = (Get-Process -Id $PID).SessionId; $pattern = '(?i)\s/k\s+\x22?(?:cd\s+/d\s+.+\s+\x26\x26\s+)?python(?:\.exe)?\s+run\.py\x22?\s*$'; $title = 'MD Editor Backend'; $launcherIds = [Collections.Generic.HashSet[int]]::new(); $listenerIds = @(Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique); foreach ($listenerId in $listenerIds) { $currentId = [int]$listenerId; $seen = @{}; while ($currentId -gt 0 -and -not $seen.ContainsKey($currentId)) { $seen[$currentId] = $true; $current = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $currentId) -ErrorAction SilentlyContinue; if (-not $current) { break }; if ($current.Name -eq 'cmd.exe' -and $current.SessionId -eq $sessionId -and $current.CommandLine -match $pattern) { [void]$launcherIds.Add([int]$current.ProcessId); break }; $currentId = [int]$current.ParentProcessId } }; Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { $_.Name -eq 'cmd.exe' -and $_.SessionId -eq $sessionId -and $_.CommandLine -match $pattern } | ForEach-Object { $process = Get-Process -Id $_.ProcessId -ErrorAction SilentlyContinue; if ($process -and $process.MainWindowTitle.EndsWith($title, [StringComparison]::OrdinalIgnoreCase)) { [void]$launcherIds.Add([int]$_.ProcessId) } }; $launcherIds | Sort-Object"`) do (
    set "BACKEND_LAUNCHERS=!BACKEND_LAUNCHERS! %%P"
)

if not defined BACKEND_PIDS (
    if not defined BACKEND_LAUNCHERS (
        echo   后端未运行
    )
)
if defined BACKEND_PIDS (
    echo   端口 8000 监听进程 PID:!BACKEND_PIDS!
)
if defined BACKEND_LAUNCHERS (
    echo   项目后端启动窗口 PID:!BACKEND_LAUNCHERS!
    for %%P in (!BACKEND_LAUNCHERS!) do (
        taskkill /F /T /PID %%P 1>nul 2>&1
    )
)

rem Fall back to any listener not owned by a matched launcher.
set "BACKEND_REMAINING="
for /f "usebackq tokens=*" %%P in (`powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique"`) do (
    set "BACKEND_REMAINING=!BACKEND_REMAINING! %%P"
)
if defined BACKEND_REMAINING (
    echo   按端口终止后端残留进程 PID:!BACKEND_REMAINING!
    for %%P in (!BACKEND_REMAINING!) do (
        taskkill /F /T /PID %%P 1>nul 2>&1
    )
)

if defined BACKEND_PIDS timeout /t 2 /nobreak >nul 2>&1
if defined BACKEND_LAUNCHERS if not defined BACKEND_PIDS timeout /t 2 /nobreak >nul 2>&1

powershell -NoProfile -Command "$sessionId = (Get-Process -Id $PID).SessionId; $pattern = '(?i)\s/k\s+\x22?(?:cd\s+/d\s+.+\s+\x26\x26\s+)?python(?:\.exe)?\s+run\.py\x22?\s*$'; $portActive = [bool](Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue); $trackedActive = @($env:BACKEND_LAUNCHERS -split '\s+' | Where-Object { $_ -match '^\d+$' -and (Get-Process -Id ([int]$_) -ErrorAction SilentlyContinue) }).Count -gt 0; $titledActive = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { $_.Name -eq 'cmd.exe' -and $_.SessionId -eq $sessionId -and $_.CommandLine -match $pattern } | ForEach-Object { $process = Get-Process -Id $_.ProcessId -ErrorAction SilentlyContinue; if ($process -and $process.MainWindowTitle.EndsWith('MD Editor Backend', [StringComparison]::OrdinalIgnoreCase)) { $_.ProcessId } }).Count -gt 0; if ($portActive -or $trackedActive -or $titledActive) { exit 1 } else { exit 0 }" 1>nul 2>&1
if errorlevel 1 (
    echo   警告: 后端端口或项目启动窗口仍未关闭
    set "FAILED=1"
) else if defined BACKEND_PIDS (
    echo   后端服务及启动窗口已停止
) else if defined BACKEND_LAUNCHERS (
    echo   后端残留启动窗口已清理
)

:: ========================================
:: 停止前端 (端口 5173)
:: ========================================
echo [2/2] 停止前端服务 (端口 5173)...

set "FRONTEND_PIDS="
for /f "usebackq tokens=*" %%P in (`powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique"`) do (
    set "FRONTEND_PIDS=!FRONTEND_PIDS! %%P"
)

set "FRONTEND_LAUNCHERS="
for /f "usebackq tokens=*" %%P in (`powershell -NoProfile -Command "$sessionId = (Get-Process -Id $PID).SessionId; $pattern = '(?i)\s/k\s+\x22?(?:cd\s+/d\s+.+\s+\x26\x26\s+)?npm(?:\.cmd)?\s+run\s+dev\x22?\s*$'; $title = 'MD Editor Frontend'; $launcherIds = [Collections.Generic.HashSet[int]]::new(); $listenerIds = @(Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique); foreach ($listenerId in $listenerIds) { $currentId = [int]$listenerId; $seen = @{}; while ($currentId -gt 0 -and -not $seen.ContainsKey($currentId)) { $seen[$currentId] = $true; $current = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $currentId) -ErrorAction SilentlyContinue; if (-not $current) { break }; if ($current.Name -eq 'cmd.exe' -and $current.SessionId -eq $sessionId -and $current.CommandLine -match $pattern) { [void]$launcherIds.Add([int]$current.ProcessId); break }; $currentId = [int]$current.ParentProcessId } }; Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { $_.Name -eq 'cmd.exe' -and $_.SessionId -eq $sessionId -and $_.CommandLine -match $pattern } | ForEach-Object { $process = Get-Process -Id $_.ProcessId -ErrorAction SilentlyContinue; if ($process -and $process.MainWindowTitle.EndsWith($title, [StringComparison]::OrdinalIgnoreCase)) { [void]$launcherIds.Add([int]$_.ProcessId) } }; $launcherIds | Sort-Object"`) do (
    set "FRONTEND_LAUNCHERS=!FRONTEND_LAUNCHERS! %%P"
)

if not defined FRONTEND_PIDS (
    if not defined FRONTEND_LAUNCHERS (
        echo   前端未运行
    )
)
if defined FRONTEND_PIDS (
    echo   端口 5173 监听进程 PID:!FRONTEND_PIDS!
)
if defined FRONTEND_LAUNCHERS (
    echo   项目前端启动窗口 PID:!FRONTEND_LAUNCHERS!
    for %%P in (!FRONTEND_LAUNCHERS!) do (
        taskkill /F /T /PID %%P 1>nul 2>&1
    )
)

rem Fall back to any listener not owned by a matched launcher.
set "FRONTEND_REMAINING="
for /f "usebackq tokens=*" %%P in (`powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique"`) do (
    set "FRONTEND_REMAINING=!FRONTEND_REMAINING! %%P"
)
if defined FRONTEND_REMAINING (
    echo   按端口终止前端残留进程 PID:!FRONTEND_REMAINING!
    for %%P in (!FRONTEND_REMAINING!) do (
        taskkill /F /T /PID %%P 1>nul 2>&1
    )
)

if defined FRONTEND_PIDS timeout /t 2 /nobreak >nul 2>&1
if defined FRONTEND_LAUNCHERS if not defined FRONTEND_PIDS timeout /t 2 /nobreak >nul 2>&1

powershell -NoProfile -Command "$sessionId = (Get-Process -Id $PID).SessionId; $pattern = '(?i)\s/k\s+\x22?(?:cd\s+/d\s+.+\s+\x26\x26\s+)?npm(?:\.cmd)?\s+run\s+dev\x22?\s*$'; $portActive = [bool](Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue); $trackedActive = @($env:FRONTEND_LAUNCHERS -split '\s+' | Where-Object { $_ -match '^\d+$' -and (Get-Process -Id ([int]$_) -ErrorAction SilentlyContinue) }).Count -gt 0; $titledActive = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { $_.Name -eq 'cmd.exe' -and $_.SessionId -eq $sessionId -and $_.CommandLine -match $pattern } | ForEach-Object { $process = Get-Process -Id $_.ProcessId -ErrorAction SilentlyContinue; if ($process -and $process.MainWindowTitle.EndsWith('MD Editor Frontend', [StringComparison]::OrdinalIgnoreCase)) { $_.ProcessId } }).Count -gt 0; if ($portActive -or $trackedActive -or $titledActive) { exit 1 } else { exit 0 }" 1>nul 2>&1
if errorlevel 1 (
    echo   警告: 前端端口或项目启动窗口仍未关闭
    set "FAILED=1"
) else if defined FRONTEND_PIDS (
    echo   前端服务及启动窗口已停止
) else if defined FRONTEND_LAUNCHERS (
    echo   前端残留启动窗口已清理
)

:: 最终状态
set "FINAL_EXIT=!FAILED!"
echo.
echo [状态]
if "!FINAL_EXIT!"=="0" (
    echo 所有服务已停止, 项目启动窗口已关闭
) else (
    echo 警告: 仍有服务或项目启动窗口未关闭
)

echo.
echo ========================================
echo   操作完成
echo ========================================
endlocal & exit /b %FINAL_EXIT%
