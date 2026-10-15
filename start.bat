@echo off
chcp 65001 >nul 2>&1
title AegisData 后端服务

REM ── 查找可用的 Python ──
set "PYTHON_EXE="

REM 1. 尝试系统 Python
where python >nul 2>&1 && (
    for /f "delims=" %%i in ('where python') do (
        if not defined PYTHON_EXE set "PYTHON_EXE=%%i"
    )
)

REM 2. 尝试 CodeArts 缓存运行时 Python
if not defined PYTHON_EXE (
    if exist "C:\Users\HGY\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" (
        set "PYTHON_EXE=C:\Users\HGY\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
    )
)

REM 3. 尝试 E:\develop\python
if not defined PYTHON_EXE (
    if exist "E:\develop\python\python.exe" (
        set "PYTHON_EXE=E:\develop\python\python.exe"
    )
)

if not defined PYTHON_EXE (
    echo [错误] 未找到 Python，请先安装 Python 3.10+
    echo        或将 python.exe 加入 PATH 环境变量
    pause
    exit /b 1
)

echo ============================================
echo   AegisData 企业数据安全管理平台
echo ============================================
echo   Python: %PYTHON_EXE%
echo ============================================
echo.

REM ── 检查 Flask 是否安装 ──
"%PYTHON_EXE%" -c "import flask" >nul 2>&1
if errorlevel 1 (
    echo [错误] Flask 未安装，正在安装依赖...
    "%PYTHON_EXE%" -m pip install flask
    if errorlevel 1 (
        echo [错误] Flask 安装失败，请手动运行: pip install flask
        pause
        exit /b 1
    )
)

REM ── 启动服务器 ──
cd /d "%~dp0"
echo 正在启动服务器...
echo 浏览器请访问: http://127.0.0.1:5000
echo.
"%PYTHON_EXE%" app.py

pause
