@echo off
chcp 65001 >nul
echo ========================================
echo   Markdown Editor - 启动脚本
echo ========================================
echo.

:: 检查端口占用情况
powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }" 1>nul 2>&1
set "BACKEND_RUNNING=%errorlevel%"

powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }" 1>nul 2>&1
set "FRONTEND_RUNNING=%errorlevel%"

:: 检查 Python
python --version 1>nul 2>&1
if errorlevel 1 (
    echo [错误] 未找到 Python，请先安装 Python 3.11+
    pause
    exit /b 1
)

:: 检查并安装依赖
echo [1/4] 检查 Python 依赖...
pip show fastapi 1>nul 2>&1
if errorlevel 1 (
    echo [提示] 正在安装 Python 依赖...
    pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
)

:: 启动后端 (如果未运行)
echo [2/4] 启动后端服务 (http://localhost:8000)...
if %BACKEND_RUNNING%==0 (
    echo   [警告] 后端已在端口 8000 运行，跳过启动
) else (
    cd /d "%~dp0"
    start "MD Editor Backend" /min cmd /k "python run.py"
)

:: 等待后端启动
timeout /t 2 /nobreak >nul

:: 启动前端 (如果未运行)
echo [3/4] 启动前端服务 (http://localhost:5173)...
if %FRONTEND_RUNNING%==0 (
    echo   [警告] 前端已在端口 5173 运行，跳过启动
) else (
    cd /d "%~dp0..\frontend"
    start "MD Editor Frontend" /min cmd /k "npm run dev"
)

:: 等待服务就绪
timeout /t 2 /nobreak >nul

:: 检查最终状态
echo [4/4] 检查服务状态...
powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue) { Write-Host '  后端: 已启动' } else { Write-Host '  后端: 启动失败' }"
powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue) { Write-Host '  前端: 已启动' } else { Write-Host '  前端: 启动失败' }"

echo.
echo ========================================
echo   服务已启动！
echo   后端: http://localhost:8000
echo   前端: http://localhost:5173
echo   API文档: http://localhost:8000/docs
echo ========================================
echo.
echo 提示: 运行 status.bat 可查看服务状态
echo       运行 stop.bat 可停止服务
echo.