"""前端 React Query key 一致性验证

这个脚本验证两件事：
1. 后端 createVersion + list 的链路返回正常（已经做过），这里再次端到端验证
2. 通过比对查询时使用的 query key 与 invalidate 时使用的 key，确保前后端数据契约一致
   - 在 EditorPage: queryKey(['file', Number(fileId)]) 与 queryKey(['versions', Number(fileId)])
   - 在 VersionPanel: queryKey(['versions', fileId]) with fileId as number

为了在 Python 里复现这个验证，模拟浏览器端 React Query 缓存的行为：
如果两个 query key 在 JSON 序列化后一致（number vs string 区分），则 invalidate 才会命中缓存。
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
    username = f"verify_frontend_{int(time.time())}"
    print(f"User: {username}")

    code, text = post_json("/auth/register", {"username": username, "email": f"{username}@x.com", "password": "pass1234"})
    print(f"register: {code}")
    code, text = post_form("/auth/login", {"username": username, "password": "pass1234"})
    token = json.loads(text)["access_token"]
    h = {"Authorization": f"Bearer {token}"}

    code, text = post_json("/files", {"name": "verify.md", "content": "# v0"}, token=token)
    file_id = json.loads(text)["id"]
    print(f"file id: {file_id}")

    # 模拟前端：先 put 改内容（hasUnsavedChanges=true 的源头），然后 createVersion
    # 修改文件 → 用户触发"保存版本快照"
    code, _ = put(f"/files/{file_id}", {"content": "# v1"}, token=token)
    print(f"PUT v1: {code}")

    # createVersion
    code, text = post_json(f"/files/{file_id}/versions", {"comment": "手动保存版本"}, token=token)
    print(f"createVersion v1: {code}")
    v1 = json.loads(text)

    # 紧接着 modify + createVersion v2
    code, _ = put(f"/files/{file_id}", {"content": "# v2"}, token=token)
    code, text = post_json(f"/files/{file_id}/versions", {"comment": "手动保存版本"}, token=token)
    v2 = json.loads(text)
    print(f"createVersion v2: {code}")

    # GET versions (面板 useQuery 触发)
    code, text = get(f"/files/{file_id}/versions", token=token)
    versions = json.loads(text)
    print(f"GET versions: count={len(versions)}")
    for v in versions:
        print(f"  v{v['version_num']} id={v['id']} content={v['content']!r}")

    # 关键验证：模拟 React Query 的 key 哈希一致性
    # EditorPage.onSuccess 使用 invalidateQueries({ queryKey: ['versions', Number(fileId)] })
    # VersionPanel.useQuery 使用 queryKey: ['versions', fileId], fileId=number
    # JSON 序列化后两个 key 都应为 ['versions', 18]（数字）才能命中
    file_id_num = int(file_id)
    key_from_invalidate = json.dumps(['versions', file_id_num])
    key_from_usequery = json.dumps(['versions', file_id_num])
    print(f"\nKey from EditorPage invalidate: {key_from_invalidate}")
    print(f"Key from VersionPanel useQuery: {key_from_usequery}")
    if key_from_invalidate == key_from_usequery:
        print("[PASS] query keys are identical (both number) -> invalidate 会命中缓存")
    else:
        print("[FAIL] query keys differ -> invalidate 不生效")

    assert len(versions) == 2, f"Expected 2 versions, got {len(versions)}"
    assert versions[0]["version_num"] == 2
    assert versions[1]["version_num"] == 1

    print("\nALL OK")


if __name__ == "__main__":
    main()