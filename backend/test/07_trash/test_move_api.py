"""测试移动文件相关 API"""
import requests
import sys

BASE_URL = "http://localhost:8000/api"

def login():
    """登录获取 token"""
    # 先尝试注册一个新用户
    import random
    username = f"movetest{random.randint(1000,9999)}"
    password = "test123"

    # 注册
    resp = requests.post(
        f"{BASE_URL}/auth/register",
        json={"username": username, "email": f"{username}@test.com", "password": password},
        timeout=10
    )

    # 登录
    resp = requests.post(
        f"{BASE_URL}/auth/login",
        data={"username": username, "password": password},
        timeout=10
    )

    if resp.status_code == 200:
        return resp.json()["access_token"]
    return None

def test_get_folders(token):
    """测试获取文件夹列表"""
    headers = {"Authorization": f"Bearer {token}"}

    resp = requests.get(f"{BASE_URL}/files/folders", headers=headers, timeout=10)
    print(f"GET /files/folders - Status: {resp.status_code}")

    if resp.status_code == 200:
        folders = resp.json()
        print(f"  Folders returned: {len(folders)}")
        for f in folders:
            print(f"    - ID: {f['id']}, Name: {f['name']}, is_folder: {f.get('is_folder', False)}")
        return True
    else:
        print(f"  Error: {resp.text}")
        return False

def test_get_tree(token):
    """测试获取文件树"""
    headers = {"Authorization": f"Bearer {token}"}

    resp = requests.get(f"{BASE_URL}/files/tree", headers=headers, timeout=10)
    print(f"GET /files/tree - Status: {resp.status_code}")

    if resp.status_code == 200:
        tree = resp.json()
        print(f"  Tree items: {len(tree)}")
        return True
    else:
        print(f"  Error: {resp.text}")
        return False

def test_move_file(token):
    """测试移动文件功能"""
    headers = {"Authorization": f"Bearer {token}"}

    # 1. 创建文件夹
    resp = requests.post(
        f"{BASE_URL}/files",
        json={"name": "TestFolder", "is_folder": True},
        headers=headers,
        timeout=10
    )
    if resp.status_code not in [200, 201]:
        print(f"Create folder failed: {resp.status_code} - {resp.text}")
        return False

    folder_id = resp.json()["id"]
    print(f"Created folder: ID={folder_id}")

    # 2. 创建文件
    resp = requests.post(
        f"{BASE_URL}/files",
        json={"name": "TestFile.md", "content": "# Test", "is_folder": False},
        headers=headers,
        timeout=10
    )
    if resp.status_code not in [200, 201]:
        print(f"Create file failed: {resp.status_code} - {resp.text}")
        return False

    file_id = resp.json()["id"]
    print(f"Created file: ID={file_id}")

    # 3. 移动文件到文件夹 (PUT /files/{id} with parent_id)
    resp = requests.put(
        f"{BASE_URL}/files/{file_id}",
        json={"parent_id": folder_id},
        headers=headers,
        timeout=10
    )

    if resp.status_code == 200:
        print(f"Move file success: file_id={file_id} -> folder_id={folder_id}")
        return True
    else:
        print(f"Move file failed: {resp.status_code} - {resp.text}")
        return False

def main():
    print("=" * 60)
    print("测试移动文件相关 API")
    print("=" * 60)

    # 登录
    print("\n1. 登录...")
    token = login()
    if not token:
        print("登录失败")
        return False

    print(f"登录成功, token: {token[:30]}...")

    # 测试 get_folders
    print("\n2. 测试 GET /files/folders...")
    test_get_folders(token)

    # 测试 get_tree
    print("\n3. 测试 GET /files/tree...")
    test_get_tree(token)

    # 测试移动文件
    print("\n4. 测试移动文件功能...")
    test_move_file(token)

    print("\n" + "=" * 60)
    print("测试完成")
    print("=" * 60)
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
