"""端到端版本控制测试脚本

覆盖以下场景：
1. 未带 token 调用 /files/<id>/versions → 401
2. 登录后创建文件、连续创建多个版本、列出、查看单个版本
3. 创建版本 → 恢复版本（验证文件内容回到旧版）
"""
import urllib.request
import urllib.error
import json
import time

BASE = "http://localhost:8000/api"


def request(method, path, *, token=None, json_body=None, form_body=None):
    url = f"{BASE}{path}"
    headers = {}
    body = None
    if json_body is not None:
        headers["Content-Type"] = "application/json"
        body = json.dumps(json_body).encode()
    elif form_body is not None:
        headers["Content-Type"] = "application/x-www-form-urlencoded"
        body = urllib.parse.urlencode(form_body).encode()
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        r = urllib.request.urlopen(req)
        return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


def get(path, token=None):
    return request("GET", path, token=token)


def post_json(path, data, token=None):
    return request("POST", path, token=token, json_body=data)


def put(path, data, token=None):
    return request("PUT", path, token=token, json_body=data)


def post_form(path, data):
    return request("POST", path, form_body=data)


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


def test_unauthorized_version_access():
    print_header("场景 1: 未登录访问版本接口")
    # 先注册并登录获取 fileId
    username = f"version_test_{int(time.time())}"
    code, _ = post_json(
        "/auth/register",
        {"username": username, "email": f"{username}@example.com", "password": "pass1234"},
    )
    if code == 400:
        code, text = post_form("/auth/login", {"username": username, "password": "pass1234"})
        assert code == 200, text
    _, token_text = post_form("/auth/login", {"username": username, "password": "pass1234"})
    token = json.loads(token_text)["access_token"]

    code, text = post_json(
        "/files",
        {"name": "version_test.md", "content": "# v0"},
        token=token,
    )
    assert code == 200, f"创建文件失败: {code} {text}"
    file_id = json.loads(text)["id"]

    # 不带 token 调版本接口
    print("\n[1.1] 无 token 请求 /files/.../versions...")
    code, text = get(f"/files/{file_id}/versions")
    print(f"     状态码: {code}, 响应: {text}")
    check("未带 token 获取版本列表被 401 拒绝", code == 401)

    print("\n[1.2] 无 token 请求 POST /files/.../versions...")
    code, text = post_json(f"/files/{file_id}/versions", {"comment": "no auth"})
    print(f"     状态码: {code}, 响应: {text}")
    check("未带 token 创建版本被 401 拒绝", code == 401)

    return token, file_id


def test_create_and_list_versions(token, file_id):
    print_header("场景 2: 登录后创建/列出/查看版本")
    # 写入三版：v0, v1, v2
    print("\n[2.1] 修改文件内容 v0 → v1...")
    code, _ = put(f"/files/{file_id}", {"content": "# v1"}, token=token)
    check("更新文件到 v1 成功", code == 200)

    print("\n[2.2] 创建版本 v1（comment=手动保存版本）...")
    code, text = post_json(
        f"/files/{file_id}/versions", {"comment": "手动保存版本"}, token=token
    )
    assert code == 200, f"创建版本失败: {code} {text}"
    v1 = json.loads(text)
    check(f"v1 version_num == 1", v1["version_num"] == 1, str(v1))
    check(f"v1 content == '# v1'", v1["content"] == "# v1", v1["content"])

    print("\n[2.3] 修改文件 v1 → v2 并再次创建版本...")
    code, _ = put(f"/files/{file_id}", {"content": "# v2"}, token=token)
    check("更新文件到 v2 成功", code == 200)
    code, text = post_json(
        f"/files/{file_id}/versions", {"comment": "手动保存版本"}, token=token
    )
    assert code == 200, text
    v2 = json.loads(text)
    check(f"v2 version_num == 2", v2["version_num"] == 2, str(v2))

    print("\n[2.4] 列出文件所有版本（默认按 version_num DESC）...")
    code, text = get(f"/files/{file_id}/versions", token=token)
    assert code == 200, text
    versions = json.loads(text)
    check(f"版本列表含 2 条 (实际 {len(versions)})", len(versions) == 2)
    check(
        "列表首条是 v2",
        versions[0]["version_num"] == 2,
        versions[0],
    )

    print("\n[2.5] 通过版本 id 获取指定版本...")
    code, text = get(f"/files/{file_id}/versions/{v1['id']}", token=token)
    assert code == 200, text
    fetched = json.loads(text)
    check(
        f"取回的版本内容 == '# v1'",
        fetched["content"] == "# v1",
        fetched["content"],
    )

    return v1, v2


def test_restore_version(token, file_id, v1_id):
    print_header("场景 3: 恢复历史版本")
    # 当前文件应已是 v2
    print("\n[3.1] 确认当前文件内容为 v2...")
    code, text = get(f"/files/{file_id}", token=token)
    assert code == 200, text
    current = json.loads(text)
    check(f"当前文件内容 == '# v2'", current["content"] == "# v2", current["content"])

    print(f"\n[3.2] 恢复到版本 id={v1_id}...")
    code, text = post_json(
        f"/files/{file_id}/versions/{v1_id}/restore", {}, token=token
    )
    assert code == 200, text
    restored = json.loads(text)
    check(
        "恢复后文件内容 == '# v1'",
        restored["content"] == "# v1",
        restored["content"],
    )

    print("\n[3.3] 重新拉取文件，确认已生效...")
    code, text = get(f"/files/{file_id}", token=token)
    assert code == 200, text
    cur = json.loads(text)
    check(
        "拉取文件内容 == '# v1'",
        cur["content"] == "# v1",
        cur["content"],
    )


def main():
    try:
        token, file_id = test_unauthorized_version_access()
        v1, v2 = test_create_and_list_versions(token, file_id)
        test_restore_version(token, file_id, v1["id"])
    except AssertionError as e:
        print(f"\n[ASSERT ERROR] {e}")
        return 1
    except Exception as e:
        import traceback
        print(f"\n[ERROR] {type(e).__name__}: {e}")
        traceback.print_exc()
        return 2

    print("\n" + "=" * 60)
    print(f"PASS: {PASS}, FAIL: {FAIL}")
    print("=" * 60)
    return 0 if FAIL == 0 else 1


if __name__ == "__main__":
    import sys
    sys.exit(main())
