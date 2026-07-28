"""模拟前端 CompareOverlay 的 buildRemovedRows + buildAddedRows

buildRemovedRows:
  - change.removed → 输出 row + line+=len
  - change.added    → 不输出 row, line 不递增 (跳过)
  - context         → 输出 row? 不, 只输出到本侧行数(line+=len)

buildAddedRows:
  - change.added    → 输出 row + line+=len
  - change.removed  → 不输出 row, line 不递增 (跳过)
  - context         → 输出 row? 不, 只输出到本侧行数(line+=len)
"""
from difflib import ndiff


def diff_lines(a, b):
    out = []
    for line in ndiff(a.splitlines(keepends=True), b.splitlines(keepends=True)):
        if line.startswith("+ "):
            out.append({"value": line[2:], "added": True})
        elif line.startswith("- "):
            out.append({"value": line[2:], "removed": True})
        elif line.startswith("? "):
            continue
        elif line.startswith("  "):
            out.append({"value": line[2:]})
    return out


def split_count(value):
    raw = value.split("\n")
    if raw and raw[-1] == "":
        raw.pop()
    return raw, len(raw)


def build_removed(changes):
    rows = []
    line = 1
    for c in changes:
        raw, n = split_count(c["value"])
        if n == 0:
            continue
        if c.get("removed"):
            rows.append((line, line + n - 1, "removed"))
        if not c.get("added"):
            line += n
    return rows


def build_added(changes):
    rows = []
    line = 1
    for c in changes:
        raw, n = split_count(c["value"])
        if n == 0:
            continue
        if c.get("added"):
            rows.append((line, line + n - 1, "added"))
        if not c.get("removed"):
            line += n
    return rows


def case(name, a, b):
    print(f"\n=== {name} ===")
    diff = diff_lines(a, b)
    left = build_removed(diff)
    right = build_added(diff)
    print(f"left (历史) RED 区: {left}")
    print(f"right (当前) GREEN 区: {right}")
    # 验证行号不超界
    la = a.splitlines()
    lb = b.splitlines()
    print(f"  左侧文件共 {len(la)} 行: {la}")
    print(f"  右侧文件共 {len(lb)} 行: {lb}")
    for s, e, _ in left:
        assert 1 <= s <= len(la), f"左侧 RED 起始 {s} 越界 (文件 {len(la)} 行)"
        assert e <= len(la), f"左侧 RED 结束 {e} 越界 (文件 {len(la)} 行)"
    for s, e, _ in right:
        assert 1 <= s <= len(lb), f"右侧 GREEN 起始 {s} 越界 (文件 {len(lb)} 行)"
        assert e <= len(lb), f"右侧 GREEN 结束 {e} 越界 (文件 {len(lb)} 行)"
    print("  [OK] 所有行号在文件范围内")


case(
    "Scenario A: 单行修改",
    "Line1\nLine2\nLine3\nLine4\nLine5\n",
    "Line1\nLine2_modified\nLine3\nLine4\nLine5\n",
)

case(
    "Scenario B: 删一添一",
    "Line1\nLine2\nLine3\nLine4\nLine5\n",
    "Line1\nLine2_modified\nLine3\nLine4\nLine6_added\n",
)

case(
    "Scenario C: 完全替换 (暴露原 bug 的场景)",
    "# 原始\n第二行",
    "# 修改后\n第二行也不同\n新增一行",
)

case(
    "Scenario D: 文末换行差异",
    "Line A\nLine B\n",
    "Line A\nLine B\nLine C\n",
)