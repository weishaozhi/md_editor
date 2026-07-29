"""
md_editor 垃圾桶功能测试

测试目标：
1. 垃圾桶拖拽功能：验证文件/文件夹能否通过 API 删除到垃圾桶
2. 垃圾桶显示已删除文件夹：验证已删除的文件夹是否正确返回
3. 恢复功能：验证文件能否从垃圾桶恢复
4. 永久删除：验证文件能否彻底删除

运行方式：
    python -m pytest test_trash_api.py -v
或直接运行：
    python test_trash_api.py
"""

import requests
import sys
import time
from datetime import datetime

BASE_URL = "http://localhost:8000/api"

class TestTrashAPI:
    def __init__(self):
        self.token = None
        self.user_id = None
        self.test_file_id = None
        self.test_folder_id = None

    def log(self, msg, level="INFO"):
        timestamp = datetime.now().strftime("%H:%M:%S")
        # Use ASCII characters for Windows console compatibility
        print(f"[{timestamp}] [{level}] {msg}")

    def run_test(self, name, test_func):
        self.log(f"开始测试: {name}")
        try:
            result = test_func()
            if result:
                self.log(f"[PASS] 测试通过: {name}")
                return True
            else:
                self.log(f"[FAIL] 测试失败: {name}", "FAIL")
                return False
        except Exception as e:
            self.log(f"[ERROR] 测试异常: {name} - {e}", "ERROR")
            import traceback
            traceback.print_exc()
            return False

    def login(self, username="testuser", password="test123"):
        """登录获取 token"""
        self.log("执行登录...")
        response = requests.post(
            f"{BASE_URL}/auth/login",
            data={"username": username, "password": password},
            timeout=10
        )
        if response.status_code == 200:
            self.token = response.json()["access_token"]
            self.log(f"登录成功, token: {self.token[:20]}...")
            return True
        else:
            self.log(f"登录失败: {response.status_code} - {response.text}", "WARN")
            return self.register(username, password)

    def register(self, username, password):
        """注册新用户"""
        self.log(f"尝试注册用户: {username}")
        import random
        email = f"{username}{random.randint(1000,9999)}@test.com"
        response = requests.post(
            f"{BASE_URL}/auth/register",
            json={"username": username, "email": email, "password": password},
            timeout=10
        )
        if response.status_code in [200, 201]:
            self.log("注册成功，尝试登录...")
            return self.login(username, password)
        else:
            self.log(f"注册失败: {response.status_code} - {response.text}", "ERROR")
            return False

    def headers(self):
        return {"Authorization": f"Bearer {self.token}"}

    def test_create_file(self):
        """测试创建文件"""
        self.log("创建测试文件...")
        response = requests.post(
            f"{BASE_URL}/files",
            json={
                "name": f"测试文件_{int(time.time())}.md",
                "content": "# 测试内容",
                "is_folder": False
            },
            headers=self.headers(),
            timeout=10
        )
        if response.status_code in [200, 201]:
            self.test_file_id = response.json()["id"]
            self.log(f"文件创建成功, ID: {self.test_file_id}")
            return True
        self.log(f"文件创建失败: {response.status_code} - {response.text}", "ERROR")
        return False

    def test_create_folder(self):
        """测试创建文件夹"""
        self.log("创建测试文件夹...")
        response = requests.post(
            f"{BASE_URL}/files",
            json={
                "name": f"测试文件夹_{int(time.time())}",
                "is_folder": True
            },
            headers=self.headers(),
            timeout=10
        )
        if response.status_code in [200, 201]:
            self.test_folder_id = response.json()["id"]
            self.log(f"文件夹创建成功, ID: {self.test_folder_id}")
            return True
        self.log(f"文件夹创建失败: {response.status_code} - {response.text}", "ERROR")
        return False

    def test_get_file_tree(self):
        """测试获取文件树（不包含已删除项）"""
        self.log("获取文件树...")
        response = requests.get(
            f"{BASE_URL}/files/tree",
            headers=self.headers(),
            timeout=10
        )
        if response.status_code == 200:
            tree = response.json()
            self.log(f"文件树获取成功, 包含 {len(tree)} 个顶级项")
            return True
        self.log(f"文件树获取失败: {response.status_code} - {response.text}", "ERROR")
        return False

    def test_delete_file_to_trash(self):
        """测试删除文件到垃圾桶"""
        if not self.test_file_id:
            if not self.test_create_file():
                return False

        self.log(f"删除文件到垃圾桶, file_id: {self.test_file_id}")
        response = requests.delete(
            f"{BASE_URL}/files/{self.test_file_id}",
            headers=self.headers(),
            timeout=10
        )
        if response.status_code in [200, 204]:
            msg = response.json().get("message", "") if response.text else ""
            self.log(f"文件删除成功: {msg}")
            return True
        self.log(f"文件删除失败: {response.status_code} - {response.text}", "ERROR")
        return False

    def test_delete_folder_to_trash(self):
        """测试删除文件夹到垃圾桶"""
        if not self.test_folder_id:
            if not self.test_create_folder():
                return False

        self.log(f"删除文件夹到垃圾桶, folder_id: {self.test_folder_id}")
        response = requests.delete(
            f"{BASE_URL}/files/{self.test_folder_id}",
            headers=self.headers(),
            timeout=10
        )
        if response.status_code in [200, 204]:
            msg = response.json().get("message", "") if response.text else ""
            self.log(f"文件夹删除成功: {msg}")
            return True
        self.log(f"文件夹删除失败: {response.status_code} - {response.text}", "ERROR")
        return False

    def test_get_trash(self):
        """测试获取垃圾桶列表"""
        self.log("获取垃圾桶列表...")
        response = requests.get(
            f"{BASE_URL}/trash",
            headers=self.headers(),
            timeout=10
        )
        if response.status_code == 200:
            trash_items = response.json()
            self.log(f"垃圾桶获取成功, 包含 {len(trash_items)} 个项目")

            # 检查是否包含文件和文件夹
            has_files = any(not item.get("is_folder", False) for item in trash_items)
            has_folders = any(item.get("is_folder", False) for item in trash_items)

            self.log(f"  - 包含文件: {has_files}")
            self.log(f"  - 包含文件夹: {has_folders}")

            if self.test_file_id:
                file_in_trash = any(item["id"] == self.test_file_id for item in trash_items)
                self.log(f"  - 测试文件在垃圾桶中: {file_in_trash}")

            if self.test_folder_id:
                folder_in_trash = any(item["id"] == self.test_folder_id for item in trash_items)
                self.log(f"  - 测试文件夹在垃圾桶中: {folder_in_trash}")

            return True
        self.log(f"垃圾桶获取失败: {response.status_code} - {response.text}", "ERROR")
        return False

    def test_restore_file(self):
        """测试恢复文件"""
        if not self.test_file_id:
            self.log("无测试文件可恢复", "WARN")
            return True

        self.log(f"恢复文件, file_id: {self.test_file_id}")
        response = requests.post(
            f"{BASE_URL}/trash/{self.test_file_id}/restore",
            headers=self.headers(),
            timeout=10
        )
        if response.status_code == 200:
            self.log(f"文件恢复成功: {response.json().get('message', '')}")

            # 验证文件不再在垃圾桶中
            trash_response = requests.get(
                f"{BASE_URL}/trash",
                headers=self.headers(),
                timeout=10
            )
            if trash_response.status_code == 200:
                trash_items = trash_response.json()
                file_in_trash = any(item["id"] == self.test_file_id for item in trash_items)
                if not file_in_trash:
                    self.log("PASS: File removed from trash")
                    return True
                else:
                    self.log("验证失败: 文件仍在垃圾桶中", "FAIL")
                    return False
        self.log(f"文件恢复失败: {response.status_code} - {response.text}", "ERROR")
        return False

    def test_permanent_delete(self):
        """测试永久删除"""
        if not self.test_folder_id:
            self.log("无测试文件夹可永久删除", "WARN")
            return True

        self.log(f"永久删除文件夹, folder_id: {self.test_folder_id}")
        response = requests.delete(
            f"{BASE_URL}/trash/{self.test_folder_id}",
            headers=self.headers(),
            timeout=10
        )
        if response.status_code == 200:
            self.log(f"永久删除成功: {response.json().get('message', '')}")
            return True
        self.log(f"永久删除失败: {response.status_code} - {response.text}", "ERROR")
        return False

    def test_empty_trash(self):
        """测试清空垃圾桶"""
        # 先获取垃圾桶中是否有文件
        trash_resp = requests.get(
            f"{BASE_URL}/trash",
            headers=self.headers(),
            timeout=10
        )
        trash_items = trash_resp.json() if trash_resp.status_code == 200 else []

        self.log(f"清空垃圾桶... (当前 {len(trash_items)} 个项目)")
        response = requests.delete(
            f"{BASE_URL}/trash/empty",
            headers=self.headers(),
            timeout=10
        )
        if response.status_code == 200:
            msg = response.json().get("message", "")
            self.log(f"清空垃圾桶成功: {msg}")

            # 验证垃圾桶为空
            trash_response = requests.get(
                f"{BASE_URL}/trash",
                headers=self.headers(),
                timeout=10
            )
            if trash_response.status_code == 200:
                trash_items = trash_response.json()
                if len(trash_items) == 0:
                    self.log("PASS: Trash is empty")
                    return True
                else:
                    self.log(f"验证失败: 垃圾桶仍有 {len(trash_items)} 个项目", "FAIL")
                    return False
        self.log(f"清空垃圾桶失败: {response.status_code} - {response.text}", "ERROR")
        return False

    def test_trash_settings(self):
        """测试垃圾桶设置"""
        self.log("测试垃圾桶设置...")

        # 获取设置
        response = requests.get(
            f"{BASE_URL}/trash/settings",
            headers=self.headers(),
            timeout=10
        )
        if response.status_code == 200:
            settings = response.json()
            self.log(f"获取设置成功: retention_hours = {settings.get('retention_hours')}")
        else:
            self.log(f"获取设置失败: {response.status_code}", "WARN")

        # 更新设置
        response = requests.put(
            f"{BASE_URL}/trash/settings",
            json={"retention_hours": 168},  # 7天
            headers=self.headers(),
            timeout=10
        )
        if response.status_code == 200:
            settings = response.json()
            self.log(f"更新设置成功: retention_hours = {settings.get('retention_hours')}")
            if settings.get("retention_hours") == 168:
                return True
        self.log(f"更新设置失败: {response.status_code} - {response.text}", "ERROR")
        return False

    def run_all_tests(self):
        """运行所有测试"""
        self.log("=" * 60)
        self.log("md_editor 垃圾桶功能测试")
        self.log("=" * 60)

        if not self.login():
            self.log("无法登录，请确保服务器正在运行", "ERROR")
            return False

        tests = [
            ("获取文件树", self.test_get_file_tree),
            ("创建测试文件", self.test_create_file),
            ("创建测试文件夹", self.test_create_folder),
            ("删除文件到垃圾桶", self.test_delete_file_to_trash),
            ("删除文件夹到垃圾桶", self.test_delete_folder_to_trash),
            ("获取垃圾桶列表", self.test_get_trash),
            ("恢复文件", self.test_restore_file),
            ("永久删除文件夹", self.test_permanent_delete),
            ("垃圾桶设置", self.test_trash_settings),
            ("清空垃圾桶", self.test_empty_trash),
        ]

        results = []
        for name, test_func in tests:
            result = self.run_test(name, test_func)
            results.append((name, result))
            time.sleep(0.3)  # 避免请求过快

        self.log("=" * 60)
        self.log("测试结果汇总")
        self.log("=" * 60)

        passed = sum(1 for _, r in results if r)
        failed = sum(1 for _, r in results if not r)

        for name, result in results:
            status = "[PASS]" if result else "[FAIL]"
            self.log(f"  {status} - {name}")

        self.log("=" * 60)
        self.log(f"总计: {passed} 通过, {failed} 失败")
        self.log("=" * 60)

        return failed == 0


if __name__ == "__main__":
    tester = TestTrashAPI()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)
