"""验证 CORS / credentials 安全配置（ISS-003 闭环）

BASE_URL: 无（不依赖后端 HTTP；通过子进程 import main.py 检查行为）
前置条件: 无；纯本地启动校验
覆盖场景:
  1. CORS_ALLOW_ORIGINS=* 且 DEBUG=False  → 进程启动失败（拒绝不安全配置）
  2. CORS_ALLOW_ORIGINS=* 且 DEBUG=True   → 启动成功，allow_credentials=False
  3. CORS_ALLOW_ORIGINS=https://a.com,https://b.com 且 DEBUG=False → 启动成功，
     allow_credentials=True，生成的 CORSMiddleware 配置正确
  4. CORS_ALLOW_ORIGINS 为空              → 进程启动失败
"""
import os
import subprocess
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[2]
MAIN_PY = BACKEND_ROOT / "app" / "main.py"


def _run_with_env(env_overrides: dict, timeout: int = 15) -> tuple[int, str, str]:
    """以受控环境变量启动子进程执行 'python -c from app.main import app; print(...)'。

    Returns: (exit_code, stdout, stderr)
    """
    env = os.environ.copy()
    # 隔离：避免父进程 .env 影响
    env.pop("CORS_ALLOW_ORIGINS", None)
    env.pop("DEBUG", None)
    env.pop("SECRET_KEY", None)
    env.update(env_overrides)

    # 用 -S 避免 sitecustomize 干扰；cwd 设为 backend 根以保证 import app.main 解析正确
    code = (
        "from app.main import app, _cors_state; "
        "print('origins=' + ','.join(_cors_state['origins'])); "
        "print('credentials=' + str(_cors_state['credentials'])); "
        "print('version=' + app.version); "
    )
    proc = subprocess.run(
        [sys.executable, "-c", code],
        cwd=str(BACKEND_ROOT),
        env=env,
        capture_output=True,
        text=True,
        timeout=timeout,
    )
    return proc.returncode, proc.stdout, proc.stderr


def _expect_fail(label: str, env_overrides: dict):
    """断言子进程应非 0 退出"""
    rc, out, err = _run_with_env(env_overrides)
    print(f"[{label}] exit={rc} stderr_tail={err.strip().splitlines()[-1] if err else ''}")
    assert rc != 0, f"Expected startup to FAIL, but it succeeded.\nstdout={out}\nstderr={err}"
    print(f"[PASS] {label}: refused to start")


def _expect_success(label: str, env_overrides: dict,
                    expected_origins: list[str], expected_credentials: bool):
    rc, out, err = _run_with_env(env_overrides)
    print(f"[{label}] exit={rc}")
    assert rc == 0, f"Expected startup to SUCCEED.\nstdout={out}\nstderr={err}"
    lines = out.strip().splitlines()
    origins_line = next((l for l in lines if l.startswith("origins=")), "")
    creds_line = next((l for l in lines if l.startswith("credentials=")), "")
    actual_origins = origins_line.replace("origins=", "").split(",") if origins_line else []
    actual_credentials = creds_line.replace("credentials=", "") == "True"
    print(f"  origins={actual_origins} credentials={actual_credentials}")
    assert actual_origins == expected_origins, (
        f"{label}: expected origins={expected_origins}, got {actual_origins}"
    )
    assert actual_credentials == expected_credentials, (
        f"{label}: expected credentials={expected_credentials}, got {actual_credentials}"
    )
    print(f"[PASS] {label}: origins/credentials as expected")


def test_cors_origin_wildcard_in_prod_fails():
    """1. 生产模式禁止 '*' """
    _expect_fail(
        "* 拒绝: DEBUG=False + CORS=*",
        {"CORS_ALLOW_ORIGINS": "*", "DEBUG": "False"},
    )


def test_cors_origin_wildcard_in_debug_allowed():
    """2. DEBUG 模式下允许 '*'，但强制 credentials=False"""
    _expect_success(
        "* 允许: DEBUG=True + CORS=*",
        {"CORS_ALLOW_ORIGINS": "*", "DEBUG": "True"},
        expected_origins=["*"],
        expected_credentials=False,
    )


def test_cors_explicit_list_in_prod_succeeds():
    """3. 生产模式显式列表 + credentials=True"""
    _expect_success(
        "显式来源: DEBUG=False + CORS=https://a.com,https://b.com",
        {
            "CORS_ALLOW_ORIGINS": "https://a.com,https://b.com",
            "DEBUG": "False",
        },
        expected_origins=["https://a.com", "https://b.com"],
        expected_credentials=True,
    )


def test_cors_empty_value_in_prod_fails():
    """4. 空字符串视为不允许"""
    _expect_fail(
        "空拒绝: DEBUG=False + CORS=",
        {"CORS_ALLOW_ORIGINS": "", "DEBUG": "False"},
    )


def main():
    print("=" * 60)
    print("Test: CORS / credentials 安全配置 (ISS-003 闭环)")
    print("=" * 60)
    cases = [
        test_cors_origin_wildcard_in_prod_fails,
        test_cors_origin_wildcard_in_debug_allowed,
        test_cors_explicit_list_in_prod_succeeds,
        test_cors_empty_value_in_prod_fails,
    ]
    ok = 0
    for fn in cases:
        try:
            fn()
            ok += 1
        except AssertionError as exc:
            print(f"[FAIL] {fn.__name__}: {exc}")
    print(f"\n{ok}/{len(cases)} passed")
    assert ok == len(cases), "CORS config regression"
    sys.exit(0)


if __name__ == "__main__":
    main()
