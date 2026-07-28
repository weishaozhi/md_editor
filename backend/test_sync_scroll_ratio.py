"""
验证 Editor ↔ Preview 同步滚动的比例算法

数学:
  - src.scrollTop / (src.scrollHeight - src.clientHeight) = ratio [0, 1]
  - dst.scrollTop = ratio * (dst.scrollHeight - dst.clientHeight)
"""
def sync_scroll(src_top, src_height, src_client, dst_height, dst_client):
    """返回 dst 应该的 scrollTop"""
    max_src = src_height - src_client
    if max_src <= 0:
        return 0
    ratio = max(0, min(1, src_top / max_src))
    max_dst = dst_height - dst_client
    if max_dst <= 0:
        return 0
    return max_dst * ratio


# 测试 case
cases = [
    # (src_top, src_height, src_client, dst_height, dst_client, 期望 dst_top)
    # 顶部
    (0,    1000, 200, 800, 200, 0),
    # 中间 50%
    (400,  1000, 200, 800, 200, 300),
    # 底部 100%
    (800,  1000, 200, 800, 200, 600),
    # src 不可滚 (内容少) -> 0
    (100,  300,  300, 800, 200, 0),
    # dst 不可滚 (内容少) -> 0
    (400,  1000, 200, 100, 200, 0),
    # 不同高度比例 (ratio=200/1000=0.2, max_dst=1600, dst_top=320)
    (200,  1200, 200, 2000, 400, 320),
    # 越界保护: src_top > max_src 应被夹到 1
    (9999, 1000, 200, 800, 200, 600),
]

print("case | src_top | ratio | dst_top | expected | pass")
print("-" * 75)
ok = 0
for i, (st, sh, sc, dh, dc, exp) in enumerate(cases):
    actual = sync_scroll(st, sh, sc, dh, dc)
    passed = abs(actual - exp) < 0.001
    ok += int(passed)
    max_src = sh - sc
    ratio = max(0, min(1, st / max_src)) if max_src > 0 else 0
    print(f"{i+1:>4} | {st:>5}   | {ratio:.3f} | {actual:>7.1f} | {exp:>7.1f}   | {'OK' if passed else 'FAIL'}")

print(f"\n{ok}/{len(cases)} passed")
assert ok == len(cases), "sync scroll ratio math regression"