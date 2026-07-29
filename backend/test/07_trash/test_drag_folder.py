"""测试拖拽和文件夹嵌套功能"""
import requests
import sys

BASE_URL = "http://localhost:8000/api"

class TestDragAndFolder:
    def __init__(self):
        self.token = None
        self.folder_id = None
        self.subfolder_id = None
        self.file_id = None

    def log(self, msg, status="INFO"):
        print(f"[{status}] {msg}")

    def login(self):
        import random
        username = f"dragtest{random.randint(1000,9999)}"
        password = "test123"

        resp = requests.post(f"{BASE_URL}/auth/register",
            json={"username": username, "email": f"{username}@test.com", "password": password}, timeout=10)

        resp = requests.post(f"{BASE_URL}/auth/login",
            data={"username": username, "password": password}, timeout=10)

        if resp.status_code == 200:
            self.token = resp.json()["access_token"]
            self.log(f"Login success")
            return True
        return False

    def headers(self):
        return {"Authorization": f"Bearer {self.token}"}

    def test_nested_folder_creation(self):
        """测试嵌套文件夹创建"""
        self.log("Test: Create nested folder")

        # 创建父文件夹
        resp = requests.post(f"{BASE_URL}/files",
            json={"name": "ParentFolder", "is_folder": True},
            headers=self.headers(), timeout=10)
        if resp.status_code not in [200, 201]:
            self.log(f"Parent folder creation failed: {resp.status_code}", "FAIL")
            return False
        self.folder_id = resp.json()["id"]
        self.log(f"Created parent folder: ID={self.folder_id}")

        # 在父文件夹内创建子文件夹
        resp = requests.post(f"{BASE_URL}/files",
            json={"name": "SubFolder", "is_folder": True, "parent_id": self.folder_id},
            headers=self.headers(), timeout=10)
        if resp.status_code not in [200, 201]:
            self.log(f"Sub folder creation failed: {resp.status_code} - {resp.text}", "FAIL")
            return False
        self.subfolder_id = resp.json()["id"]
        self.log(f"Created sub folder: ID={self.subfolder_id}")
        return True

    def test_file_in_folder(self):
        """测试在文件夹内创建文件"""
        self.log("Test: Create file in folder")

        resp = requests.post(f"{BASE_URL}/files",
            json={"name": "FileInFolder.md", "content": "# Content", "is_folder": False, "parent_id": self.folder_id},
            headers=self.headers(), timeout=10)
        if resp.status_code not in [200, 201]:
            self.log(f"File creation failed: {resp.status_code} - {resp.text}", "FAIL")
            return False
        self.file_id = resp.json()["id"]
        self.log(f"Created file: ID={self.file_id}")
        return True

    def test_tree_structure(self):
        """测试文件树结构"""
        self.log("Test: Verify tree structure")

        resp = requests.get(f"{BASE_URL}/files/tree", headers=self.headers(), timeout=10)
        if resp.status_code != 200:
            self.log(f"Tree fetch failed: {resp.status_code}", "FAIL")
            return False

        tree = resp.json()
        self.log(f"Tree has {len(tree)} root items")

        # 找到父文件夹
        parent = next((item for item in tree if item["name"] == "ParentFolder"), None)
        if not parent:
            self.log("Parent folder not found in tree", "FAIL")
            return False

        # 检查子文件夹
        children = parent.get("children", [])
        self.log(f"Parent folder has {len(children)} children")

        subfolders = [c for c in children if c["name"] == "SubFolder"]
        files = [c for c in children if c["name"] == "FileInFolder.md"]

        if not subfolders:
            self.log("SubFolder not found inside ParentFolder", "FAIL")
            return False

        # 检查子文件夹内的文件
        subfolder_children = subfolders[0].get("children", [])
        self.log(f"SubFolder has {len(subfolder_children)} children")

        if not files:
            self.log("FileInFolder not found inside ParentFolder", "FAIL")
            return False

        self.log("Tree structure verified: Parent -> SubFolder -> File", "PASS")
        return True

    def test_move_file(self):
        """测试移动文件到子文件夹"""
        self.log("Test: Move file to subfolder")

        # 创建根目录文件
        resp = requests.post(f"{BASE_URL}/files",
            json={"name": "RootFile.md", "content": "# Root", "is_folder": False},
            headers=self.headers(), timeout=10)
        if resp.status_code not in [200, 201]:
            self.log(f"Root file creation failed", "FAIL")
            return False
        root_file_id = resp.json()["id"]
        self.log(f"Created root file: ID={root_file_id}")

        # 移动到子文件夹 (使用 "__none__" 哨兵值测试)
        resp = requests.put(f"{BASE_URL}/files/{root_file_id}",
            json={"parent_id": self.subfolder_id},
            headers=self.headers(), timeout=10)
        if resp.status_code != 200:
            self.log(f"Move file failed: {resp.status_code} - {resp.text}", "FAIL")
            return False

        self.log(f"Moved file {root_file_id} to subfolder {self.subfolder_id}", "PASS")

        # 验证
        resp = requests.get(f"{BASE_URL}/files/tree", headers=self.headers(), timeout=10)
        tree = resp.json()

        parent = next((item for item in tree if item["name"] == "ParentFolder"), None)
        subfolders = [c for c in parent.get("children", []) if c["name"] == "SubFolder"]
        subfolder_children = subfolders[0].get("children", []) if subfolders else []

        root_file_moved = any(c["name"] == "RootFile.md" for c in subfolder_children)
        if root_file_moved:
            self.log("File successfully moved to subfolder", "PASS")
            return True
        else:
            self.log("File not found in subfolder after move", "FAIL")
            return False

    def test_move_to_root(self):
        """测试移动文件到根目录"""
        self.log("Test: Move file back to root (using sentinel)")

        if not self.file_id:
            self.log("No file to move", "WARN")
            return True

        # 使用哨兵值 "__none__" 移动到根目录
        resp = requests.put(f"{BASE_URL}/files/{self.file_id}",
            json={"parent_id": "__none__"},
            headers=self.headers(), timeout=10)
        if resp.status_code != 200:
            self.log(f"Move to root failed: {resp.status_code} - {resp.text}", "FAIL")
            return False

        self.log("File moved to root using sentinel", "PASS")

        # 验证 parent_id 为 None
        resp = requests.get(f"{BASE_URL}/files/{self.file_id}", headers=self.headers(), timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if data.get("parent_id") is None:
                self.log("File parent_id is now None (in root)", "PASS")
                return True
            else:
                self.log(f"File parent_id is {data.get('parent_id')}, expected None", "FAIL")
                return False
        self.log("Failed to verify file parent_id", "FAIL")
        return False

    def run_all(self):
        self.log("=" * 60)
        self.log("Test: Drag and Nested Folder Features")
        self.log("=" * 60)

        if not self.login():
            self.log("Login failed", "FAIL")
            return False

        tests = [
            self.test_nested_folder_creation,
            self.test_file_in_folder,
            self.test_tree_structure,
            self.test_move_file,
            self.test_move_to_root,
        ]

        results = []
        for test in tests:
            results.append(test())
            import time
            time.sleep(0.3)

        self.log("=" * 60)
        self.log(f"Results: {sum(results)}/{len(results)} passed")
        self.log("=" * 60)
        return all(results)


if __name__ == "__main__":
    tester = TestDragAndFolder()
    success = tester.run_all()
    sys.exit(0 if success else 1)
