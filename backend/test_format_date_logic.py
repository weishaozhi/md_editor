"""
验证 VersionPanel.formatDate 的核心逻辑（UTC 兜底 + Asia/Shanghai 渲染）

不直接 import 前端 ts，而是按相同算法在 Python 里实现并对照期望值。
测试 case:
  1. 无 tz 后缀 + 22:50 → 应渲染为 22:50 (UTC)
  2. 带 'Z' 后缀       → 同上
  3. 带 +08:00 后缀    → 应转换为本地 22:50
"""
from datetime import datetime, timezone, timedelta

# 与前端 formatDate 等价的 Python 实现
def format_date(date_str: str) -> str:
    if not date_str:
        return ''
    has_tz = bool(__import__('re').search(r'[zZ]|[+\-]\d{2}:?\d{2}$', date_str))
    iso = date_str if has_tz else date_str + 'Z'
    dt = datetime.fromisoformat(iso.replace('Z', '+00:00'))
    # timeZone: 'Asia/Shanghai' = UTC+8 (无夏令时)
    shanghai = timezone(timedelta(hours=8))
    dt_sh = dt.astimezone(shanghai)
    return dt_sh.strftime('%m/%d %H:%M')


cases = [
    # (输入, 期望输出)
    ("2026-07-28T22:50:13.123456", "07/29 06:50"),   # naive UTC → +8 时区显示为次日 06:50
    ("2026-07-28T22:50:13Z",       "07/29 06:50"),   # 显式 UTC
    ("2026-07-28T22:50:13+08:00",  "07/28 22:50"),   # 已带 +8 → 直接显示
    ("2026-07-28T22:50:13-08:00",  "07/29 14:50"),   # -8 → 转 +8
    ("",                            ""),
]

print("case | input | expected | actual | pass")
print("-" * 80)
ok = 0
for i, (inp, expected) in enumerate(cases):
    actual = format_date(inp)
    passed = actual == expected
    ok += int(passed)
    print(f"{i+1:>4} | {inp:<32} | {expected:<12} | {actual:<12} | {'OK' if passed else 'FAIL'}")

print(f"\n{ok}/{len(cases)} passed")
assert ok == len(cases), "formatDate logic regression"