"""端到端测试：stop.bat 能彻底停止前后端

背景: 旧 stop.bat 用了 `Stop-Process -Name python/node` + `taskkill /F /IM python.exe / node.exe`,
      会误杀同所有 python/node 进程 (Vite / Cursor 内置 TS/ESLint 语言服务 / 其他 Node 应用 / 其他 Python 应用).
      新 stop.bat 改为按端口 PID 精确 kill + taskkill /F /T /PID 整进程树.

本测试:
1. 加载 stop.bat 源码, 用 grep 校验关键修复点 (防止回滚)
2. 抽查: 启动后 PID 没有增加, 仅占用 8000/5173 端口的进程被 kill
"""
import subprocess
import re
import sys
import time
import urllib.request
import urllib.error
import urllib.parse
import json
import os

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
STOP_BAT = os.path.join(REPO, "backend", "stop.bat")
START_BAT = os.path.join(REPO, "backend", "start.bat")

PASS = 0
FAIL = 0


def check(label, ok, detail=""):
    global PASS, FAIL
    if ok:
        PASS += 1
        print(f"    [PASS] {label}")
    else:
        FAIL += 1
        print(f"    [FAIL] {label}  {detail}")


def print_header(text):
    print("\n" + "=" * 60)
    print(text)
    print("=" * 60)


def read_stop_bat():
    with open(STOP_BAT, "r", encoding="utf-8") as f:
        return f.read()


def list_listening_pids(port):
    """返回占用指定端口 LISTEN 状态的 OwningProcess PID 列表"""
    cmd = (
        'powershell -NoProfile -Command "'
        f'Get-NetTCPConnection -LocalPort {port} -State Listen -ErrorAction SilentlyContinue | '
        'Select-Object -ExpandProperty OwningProcess -Unique"'
    )
    out = subprocess.run(cmd, capture_output=True, text=True, shell=True)
    pids = [line.strip() for line in out.stdout.splitlines() if line.strip().isdigit()]
    return pids


def list_process_pids(name):
    """返回 tasklist 中匹配 name 的 PID 列表"""
    cmd = f'tasklist /FI "IMAGENAME eq {name}" /FO CSV /NH'
    out = subprocess.run(cmd, capture_output=True, text=True, shell=True)
    pids = []
    for line in out.stdout.splitlines():
        parts = line.strip().strip('"').split('","')
        if len(parts) >= 2:
            try:
                pids.append(int(parts[1]))
            except ValueError:
                pass
    return pids


def build_pid_relations():
    """返回两个字典:
    ppid_to_children: PPID -> [PID] (父子关系)
    pid_to_ppid: PID -> PPID (用于反向追溯祖宗链)
    """
    out = subprocess.run(
        'wmic process get processid,parentprocessid /FORMAT:CSV 2>&1',
        capture_output=True, text=True, shell=True,
    )
    ppid_to_children = {}
    pid_to_ppid = {}
    for line in out.stdout.splitlines():
        parts = line.strip().split(",")
        if len(parts) == 3 and parts[1].isdigit() and parts[2].isdigit():
            pid = int(parts[1])
            ppid = int(parts[2])
            pid_to_ppid[pid] = ppid
            ppid_to_children.setdefault(ppid, []).append(pid)
    return ppid_to_children, pid_to_ppid


def list_process_tree(root_pid, tree_map):
    """递归返回 root_pid 的所有子孙 PID + 自己 (含 root)"""
    visited = {root_pid}
    stack = [root_pid]
    while stack:
        pid = stack.pop()
        for child in tree_map.get(pid, []):
            if child not in visited:
                visited.add(child)
                stack.append(child)
    return visited


def find_top_ancestor(pid, pid_to_ppid):
    """追溯 pid 的最顶层祖先 (PPID 链上溯到没有父的根进程, 通常是 System/PID 0)"""
    visited = set()
    while pid and pid in pid_to_ppid and pid not in visited:
        visited.add(pid)
        pid = pid_to_ppid[pid]
    return pid


def http_get(url, timeout=3):
    try:
        return urllib.request.urlopen(url, timeout=timeout).status
    except urllib.error.HTTPError as e:
        return e.code
    except Exception:
        return None


def run_stop_bat():
    """运行 stop.bat 并返回 (returncode, stdout, stderr)"""
    return subprocess.run(
        ["cmd", "/c", STOP_BAT],
        capture_output=True,
        timeout=30,
    )


# ============================================================
# Part 1: 静态源码校验
# ============================================================
print_header("Part 1: 静态源码校验 - 防止回滚")

src = read_stop_bat()

# 1.1 必须包含: 按端口 PID 精确查询
check(
    "1.1 stop.bat 包含端口 PID 查询 (Get-NetTCPConnection -LocalPort)",
    "Get-NetTCPConnection -LocalPort 8000" in src,
    "缺失: 8000 端口查询",
)
check(
    "1.2 stop.bat 包含前端端口 PID 查询",
    "Get-NetTCPConnection -LocalPort 5173" in src,
    "缺失: 5173 端口查询",
)

# 1.2 必须用 taskkill /F (精确 kill) - 已包含 PID
check(
    "1.3 stop.bat 使用 taskkill /F /T /PID (进程树终止)",
    "taskkill /F /T /PID" in src,
    "缺失: 未使用 /T 杀进程树",
)

# 1.3 必须不包含: 全名批量 kill 危险模式
forbidden_patterns = [
    ("Stop-Process -Name python", "Stop-Process -Name python (会误杀所有 python)"),
    ("Stop-Process -Name node", "Stop-Process -Name node (会误杀所有 node)"),
    ("taskkill /F /IM python.exe", "taskkill /F /IM python.exe (会误杀所有 python)"),
    ("taskkill /F /IM node.exe", "taskkill /F /IM node.exe (会误杀所有 node)"),
    ("get-process python", "get-process python (会枚举所有 python)"),
    ("get-process node", "get-process node (会枚举所有 node)"),
]
for needle, desc in forbidden_patterns:
    check(
        f"1.4 禁止批量 kill: {desc}",
        needle.lower() not in src.lower(),
        f"仍存在: {needle}",
    )

# 1.4 启用延迟环境变量扩展 (因为 set 拼接多个 PID)
check(
    "1.5 stop.bat 启用 setlocal enabledelayedexpansion",
    "setlocal enabledelayedexpansion" in src,
    "缺失: 需 enabledelayedexpansion 才能!varname!赋值",
)

# 1.5 等待时间 >= 2 秒 (端口释放需要时间)
m = re.search(r"timeout\s+/t\s+(\d+)", src)
check(
    "1.6 stop.bat 等待端口释放 timeout >= 2 秒",
    m is not None and int(m.group(1)) >= 2,
    f"timeout={m.group(1) if m else 'none'}秒, 应 >= 2",
)

# ============================================================
# Part 2: 运行时验证 - 假定前后端都已运行
# ============================================================
print_header("Part 2: 运行时验证")

# 2.1 前后端现在应该在运行 (前置条件)
backend_pids_before = list_listening_pids(8000)
frontend_pids_before = list_listening_pids(5173)
check(
    "2.1 测试前置: 后端端口 8000 已监听",
    len(backend_pids_before) > 0,
    "请先运行 start.bat 启动后端 + 前端",
)
check(
    "2.2 测试前置: 前端端口 5173 已监听",
    len(frontend_pids_before) > 0,
    "请先运行 start.bat 启动前端",
)

# 2.3 记录 BEFORE 的所有 python/node 进程 (用于对比 stop 后是否误杀)
all_python_before = list_process_pids("python.exe")
all_node_before = list_process_pids("node.exe")
print(f"    [INFO] stop 前: python={len(all_python_before)} 个, node={len(all_node_before)} 个")

# 2.4 验证 HTTP 8000 200
check(
    "2.3 stop 前访问后端 /docs 应 200",
    http_get("http://localhost:8000/docs") == 200,
    "stops 前 /docs 不响应",
)

if not backend_pids_before or not frontend_pids_before:
    print("\n[SKIP] Part 2 因前后端未运行, 跳过的运行验证")
    print(f"\n[结果] PASS={PASS} FAIL={FAIL}")
    sys.exit(1 if FAIL else 0)

# 2.5 执行 stop.bat
print("    [INFO] 正在执行 stop.bat ...")

# 一次性快照: 同时抓端口 PID + PPID 关系, 避免 uvicorn reloader 切换导致快照不一致
# 顺序很关键: 先 wmic (PPID), 再 Get-NetTCPConnection (端口 PID) 间隔 < 100ms
import time as _time
_t0 = _time.time()
ppid_to_children, pid_to_ppid = build_pid_relations()
backend_pids_fresh = list_listening_pids(8000)
frontend_pids_fresh = list_listening_pids(5173)
backend_pids_before = [str(p) for p in backend_pids_fresh]
frontend_pids_before = [str(p) for p in frontend_pids_fresh]
backend_port_pids = set(backend_pids_fresh)
frontend_port_pids = set(frontend_pids_fresh)
print(f"    [INFO] stop 前端口快照: backend={backend_pids_before}, frontend={frontend_pids_before}")
all_python_before = list_process_pids("python.exe")
all_node_before = list_process_pids("node.exe")
print(f"    [INFO] 抓快照耗时 {_time.time() - _t0:.2f}s")

# 一个 PID 是端口相关的 = 它的 PPID 链能追到端口 PID
def is_port_related(pid, port_pids):
    """递归追溯 PPID 链, 看是否能追到任一端口 PID"""
    visited = set()
    cur = pid
    while cur and cur in pid_to_ppid and cur not in visited:
        visited.add(cur)
        cur = pid_to_ppid[cur]
        if cur in port_pids:
            return True
    return pid in port_pids  # 自身就是端口 PID


# 宿主机无关进程 = 既不监听端口, 也不是端口 PID 的子孙
host_python_before = [
    pid for pid in all_python_before if not is_port_related(pid, backend_port_pids)
]
host_node_before = [
    pid for pid in all_node_before if not is_port_related(pid, frontend_port_pids)
]
print(f"    [INFO] stop 前宿主机无关 python={host_python_before}")
print(f"    [INFO] stop 前宿主机无关 node={host_node_before}")

# 进程树 (用于软约束断言)
backend_tree = set()
for p in backend_pids_before:
    backend_tree |= list_process_tree(int(p), ppid_to_children)
frontend_tree = set()
for p in frontend_pids_before:
    frontend_tree |= list_process_tree(int(p), ppid_to_children)
print(f"    [INFO] stop 前, 后端进程树 PID: {sorted(backend_tree)}")
print(f"    [INFO] stop 前, 前端进程树 PID: {sorted(frontend_tree)}")

proc = run_stop_bat()
out = proc.stdout.decode("utf-8", errors="replace") if proc.stdout else ""
err = proc.stderr.decode("utf-8", errors="replace") if proc.stderr else ""
print(f"    [INFO] exit code: {proc.returncode}")
print(f"    [INFO] --- stop.bat stdout ---\n{out}")
if err.strip():
    print(f"    [INFO] --- stop.bat stderr ---\n{err}")

# 2.6 验证端口释放
time.sleep(1)
backend_pids_after = list_listening_pids(8000)
frontend_pids_after = list_listening_pids(5173)
check(
    "2.4 stop 后端口 8000 已无进程监听",
    len(backend_pids_after) == 0,
    f"残留 PID: {backend_pids_after}",
)
check(
    "2.5 stop 后端口 5173 已无进程监听",
    len(frontend_pids_after) == 0,
    f"残留 PID: {frontend_pids_after}",
)

# 2.7 验证 HTTP 不可达
check(
    "2.6 stop 后访问后端 /docs 不可达",
    http_get("http://localhost:8000/docs") is None,
    "stop 后 /docs 仍能响应",
)

# 2.8 防止误杀: 宿主机 python/node 进程数不应大幅减少
# (kill 数应小于 start.bat 拉起的进程树: 1 个后端 cmd+python+uvicorn, 1 个前端 Vite+worker)
all_python_after = list_process_pids("python.exe")
all_node_after = list_process_pids("node.exe")
print(f"    [INFO] stop 后: python={len(all_python_after)} 个, node={len(all_node_after)} 个")

python_killed = len(all_python_before) - len(all_python_after)
node_killed = len(all_node_before) - len(all_node_after)
# start.bat 启的后端用 `cmd /k "python run.py"`, 进程树节点 <= 3 (cmd + python + uvicorn worker)
# 前端 Vite 进程树节点 <= 4 (npm + node + esbuild worker 等)
check(
    "2.7 stop 后未误杀无关 python 进程 (kills <= 3 进程树节点)",
    python_killed <= 3,
    f"杀掉了 {python_killed} 个 python, 期望 <= 3 (后端进程树), 多了说明误杀",
)
check(
    "2.8 stop 后未误杀无关 node 进程 (kills <= 4 进程树节点)",
    node_killed <= 4,
    f"杀掉了 {node_killed} 个 node, 期望 <= 4 (Vite 进程树), 多了说明误杀",
)

# 2.9 反误杀 (核心断言): 宿主机原有非端口相关的进程必须 100% 保留
# 这是真正区分 '服务进程被杀' 与 '无辜进程被误杀' 的金标准.
# 判定: 进程 P 的 PPID 链上溯不到任何 8000/5173 端口 PID -> 宿主机原有.
host_python_after_kept = [pid for pid in host_python_before if pid in set(all_python_after)]
host_node_after_kept = [pid for pid in host_node_before if pid in set(all_node_after)]
check(
    "2.9 反误杀: 宿主机原有非后端 python 进程全部保留",
    host_python_after_kept == host_python_before,
    f"stop 前非后端 python={host_python_before}, stop 后保留={host_python_after_kept}, "
    f"被误杀={[p for p in host_python_before if p not in set(all_python_after)]}",
)
check(
    "2.10 反误杀: 宿主机原有非前端 node 进程全部保留",
    host_node_after_kept == host_node_before,
    f"stop 前非前端 node={host_node_before}, stop 后保留={host_node_after_kept}, "
    f"被误杀={[p for p in host_node_before if p not in set(all_node_after)]}",
)

# 2.11 软约束: 端口相关外被杀数 <= 2 (uvicorn reloader / Vite HMR 动态 fork race)
expected_killed_python = set(all_python_before) & (backend_tree | backend_port_pids)
actual_killed_python = set(all_python_before) - set(all_python_after)
unexpected_python_killed = actual_killed_python - expected_killed_python
check(
    "2.11 容忍: 端口相关外被杀 python 数 <= 2 (uvicorn reloader fork race)",
    len(unexpected_python_killed) <= 2,
    f"实际被杀={actual_killed_python}, 期望={expected_killed_python}, "
    f"越界={unexpected_python_killed}",
)

expected_killed_node = set(all_node_before) & (frontend_tree | frontend_port_pids)
actual_killed_node = set(all_node_before) - set(all_node_after)
unexpected_node_killed = actual_killed_node - expected_killed_node
check(
    "2.12 容忍: 端口相关外被杀 node 数 <= 2 (Vite HMR fork race)",
    len(unexpected_node_killed) <= 2,
    f"实际被杀={actual_killed_node}, 期望={expected_killed_node}, "
    f"越界={unexpected_node_killed}",
)

# 2.11 占端口的 PID 本身必须被 kill (最关键断言)
if backend_pids_before:
    check(
        "2.11 占用 8000 端口的 python PID 本身已被 kill",
        all(int(p) in actual_killed_python for p in backend_pids_before),
        f"占端口 PID={backend_pids_before}, 实际被杀={actual_killed_python}",
    )
if frontend_pids_before:
    check(
        "2.12 占用 5173 端口的 node PID 本身已被 kill",
        all(int(p) in actual_killed_node for p in frontend_pids_before),
        f"占端口 PID={frontend_pids_before}, 实际被杀={actual_killed_node}",
    )

# 2.13 stop.bat 脚本自身不能在 part 2 跑完后被 kill
check(
    "2.11 stop.bat 自身文件仍存在",
    os.path.exists(STOP_BAT),
    "stop.bat 丢失了!",
)

# ============================================================
# Part 3: stop.bat 在服务未启动时不应报错
# ============================================================
print_header("Part 3: 重复 stop.bat 在无服务环境下应快速返回")

# 刚 stop 完, 端口 8000/5173 都没占
print("    [INFO] 再次执行 stop.bat (此时前后端均已停止)...")
proc = run_stop_bat()
out = proc.stdout.decode("utf-8", errors="replace") if proc.stdout else ""
print(f"    [INFO] exit code: {proc.returncode}")
print(f"    [INFO] stdout:\n{out}")

check(
    "3.1 重复 stop 时 exit code = 0",
    proc.returncode == 0,
    f"exit code = {proc.returncode}",
)
check(
    "3.2 重复 stop 时输出含'后端未运行'",
    "后端未运行" in out,
    "未给'后端未运行'提示",
)
check(
    "3.3 重复 stop 时输出含'前端未运行'",
    "前端未运行" in out,
    "未给'前端未运行'提示",
)
check(
    "3.4 重复 stop 时输出含'所有服务已停止'",
    "所有服务已停止" in out,
    "未给'所有服务已停止'提示",
)

# ============================================================
# 总结
# ============================================================
print_header("总结")
print(f"PASS={PASS}  FAIL={FAIL}")
if FAIL:
    print("[FAIL] 有用例未通过")
    sys.exit(1)
else:
    print("[OK] 全部用例通过")
    sys.exit(0)
