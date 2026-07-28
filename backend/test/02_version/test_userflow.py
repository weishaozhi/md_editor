"""模拟用户场景：编辑内容 → 保存版本快照 → 验证面板能刷新

模拟用户操作链路：
1. 注册/登录
2. 创建文件
3. PUT 修改内容（hasUnsavedChanges=true）
4. 创建版本快照（createVersionMutation.mutate()）
5. 后端返回成功，EditorPage 的 onSuccess 触发 invalidateQueries(['versions', Number(fileId)])
6. VersionPanel 的 useQuery 应当被这个 invalidate 命中
7. 再次 GET /files/{id}/versions 应当包含新创建的版本

由于不能直接驱动 React Query 缓存，我们用真实 API 调用替代：
- 用 HTTP GET 模拟"VersionPanel 渲染时的 useQuery 触发"
- 用 POST 模拟"用户点击保存版本快照 → createVersionMutation → invalidate"
- 验证后续 GET 能看到新的版本
"""
import urllib.request
import urllib.error
import json
import time

BASE = "http://localhost:5174/api"


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


def main():
    username = f"userflow_{int(time.time())}"
    print(f"User: {username}")

    code, _ = post_json("/auth/register", {"username": username, "email": f"{username}@x.com", "password": "pass1234"})
    code, text = post_form("/auth/login", {"username": username, "password": "pass1234"})
    token = json.loads(text)["access_token"]
    h = {"Authorization": f"Bearer {token}"}

    code, text = post_json("/files", {"name": "userflow.md", "content": "# 初始内容"}, token=token)
    file_id = json.loads(text)["id"]
    print(f"file id: {file_id}")

    # Step 1: GET /versions (初次进入面板，list 应该为空)
    code, text = get(f"/files/{file_id}/versions", token=token)
    versions_before = json.loads(text)
    print(f"\n[Step 1] GET versions (初次): {len(versions_before)} entries")
    assert len(versions_before) == 0, "初次列表应为空"

    # Step 2: 用户在编辑器中输入文字，触发 PUT (实际上是先 PUT 再 createVersion)
    code, _ = put(f"/files/{file_id}", {"content": "# 修改后的内容\n有新的一行"}, token=token)
    print(f"\n[Step 2] PUT 修改文件: {code}")

    # Step 3: 用户点"保存版本快照"按钮
    code, text = post_json(f"/files/{file_id}/versions", {"comment": "手动保存版本"}, token=token)
    assert code == 200, f"createVersion 应成功: {code} {text}"
    v_new = json.loads(text)
    print(f"\n[Step 3] createVersion: version_num={v_new['version_num']}, id={v_new['id']}")

    # Step 4: invalidate 触发，再次 GET /versions (模拟 React Query 自动 refetch)
    code, text = get(f"/files/{file_id}/versions", token=token)
    versions_after = json.loads(text)
    print(f"\n[Step 4] GET versions (保存后): {len(versions_after)} entries")
    for v in versions_after:
        print(f"  v{v['version_num']} id={v['id']} comment='{v['comment']}' content='{v['content']}'")

    assert len(versions_after) == 1, f"保存后应有 1 个版本，实际 {len(versions_after)}"
    assert versions_after[0]["version_num"] == 1
    assert versions_after[0]["content"] == "# 修改后的内容\n有新的一行"

    # Step 5: 用户在编辑器中再修改 → 再保存
    code, _ = put(f"/files/{file_id}", {"content": "# 第三次修改\n\n# v3"}, token=token)
    code, text = post_json(f"/files/{file_id}/versions", {"comment": "手动保存版本"}, token=token)
    assert code == 200
    v3 = json.loads(text)
    print(f"\n[Step 5] 再保存一次: version_num={v3['version_num']}, id={v3['id']}")

    code, text = get(f"/files/{file_id}/versions", token=token)
    versions_final = json.loads(text)
    print(f"\n[Step 6] GET versions (最终): {len(versions_final)} entries")
    for v in versions_final:
        print(f"  v{v['version_num']} id={v['id']} content='{v['content']}'")

    assert len(versions_final) == 2
    assert versions_final[0]["version_num"] == 2  # DESC 排序
    assert versions_final[1]["version_num"] == 1

    print("\n=== ALL FLOW OK ===")


if __name__ == "__main__":
    main()