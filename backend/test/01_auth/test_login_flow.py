"""端到端登录测试脚本"""
import urllib.request
import urllib.error
import json
import time

BASE = "http://localhost:8000/api"


def post_json(path, data, token=None):
    url = f"{BASE}{path}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body = json.dumps(data).encode()
    req = urllib.request.Request(url, data=body, headers=headers, method="POST")
    try:
        r = urllib.request.urlopen(req)
        return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


def post_form(path, data):
    """OAuth2 风格的 form 提交"""
    url = f"{BASE}{path}"
    body = urllib.parse.urlencode(data).encode()
    req = urllib.request.Request(url, data=body, method="POST")
    try:
        r = urllib.request.urlopen(req)
        return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


def get(path, token=None):
    url = f"{BASE}{path}"
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, headers=headers, method="GET")
    try:
        r = urllib.request.urlopen(req)
        return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


def test_login_flow():
    username = f"testuser_{int(time.time())}"
    email = f"{username}@example.com"
    password = "testpass123"

    print("=" * 60)
    print(f"测试用户: {username}")
    print("=" * 60)

    # 1. 测试登录（用户不存在）
    print("\n[1] 测试未注册用户登录 (预期 401)...")
    code, text = post_form("/auth/login", {"username": username, "password": password})
    print(f"    状态码: {code}")
    print(f"    响应: {text}")
    assert code == 401, f"应该是 401，实际是 {code}"
    print("    [PASS] 未注册用户登录被拒绝")

    # 2. 注册
    print("\n[2] 注册用户...")
    code, text = post_json("/auth/register", {"username": username, "email": email, "password": password})
    print(f"    状态码: {code}")
    print(f"    响应: {text}")
    if code == 200:
        print("    [PASS] 注册成功")
    elif code == 400 and ("已存在" in text or "已被使用" in text):
        print("    用户已存在，跳过注册")
    else:
        raise AssertionError(f"注册失败: {code} {text}")

    # 3. 错误密码登录
    print("\n[3] 测试错误密码登录 (预期 401)...")
    code, text = post_form("/auth/login", {"username": username, "password": "wrongpass"})
    print(f"    状态码: {code}")
    assert code == 401, f"应该是 401，实际是 {code}"
    print("    [PASS] 错误密码被拒绝")

    # 4. 正确密码登录
    print("\n[4] 测试正确密码登录...")
    code, text = post_form("/auth/login", {"username": username, "password": password})
    print(f"    状态码: {code}")
    print(f"    响应: {text}")
    assert code == 200, f"登录失败: {code} {text}"
    data = json.loads(text)
    token = data.get("access_token")
    assert token, "响应中没有 access_token"
    print(f"    [PASS] 登录成功，获得 token (前30字符): {token[:30]}...")

    # 5. 解码 JWT payload
    print("\n[5] 检查 JWT payload...")
    import base64
    payload_b64 = token.split(".")[1]
    # 补齐 padding
    payload_b64 += "=" * (-len(payload_b64) % 4)
    payload = json.loads(base64.urlsafe_b64decode(payload_b64))
    print(f"    payload: {payload}")
    assert payload.get("sub"), "token payload 中没有 sub"
    print(f"    [PASS] JWT payload 有效，sub={payload['sub']}")

    # 6. 使用 token 获取用户信息
    print("\n[6] 使用 token 获取当前用户信息...")
    code, text = get("/auth/me", token=token)
    print(f"    状态码: {code}")
    print(f"    响应: {text}")
    assert code == 200, f"获取用户信息失败: {code} {text}"
    user = json.loads(text)
    assert user.get("username") == username, f"用户名不匹配: {user.get('username')} != {username}"
    print(f"    [PASS] 获取用户信息成功: {user['username']}")

    # 7. 无 token 请求
    print("\n[7] 测试无 token 请求 (预期 401)...")
    code, text = get("/auth/me")
    print(f"    状态码: {code}")
    assert code == 401, f"应该是 401，实际是 {code}"
    print("    [PASS] 无 token 请求被拒绝")

    # 8. 错误 token 请求
    print("\n[8] 测试错误 token 请求 (预期 401)...")
    code, text = get("/auth/me", token="invalid_token_here")
    print(f"    状态码: {code}")
    assert code == 401, f"应该是 401，实际是 {code}"
    print("    [PASS] 错误 token 被拒绝")

    print("\n" + "=" * 60)
    print("[SUCCESS] 登录流程测试全部通过！")
    print("=" * 60)


if __name__ == "__main__":
    try:
        test_login_flow()
    except AssertionError as e:
        print(f"\n[FAILED] {e}")
        exit(1)
    except Exception as e:
        print(f"\n[ERROR] {e}")
        import traceback
        traceback.print_exc()
        exit(1)
