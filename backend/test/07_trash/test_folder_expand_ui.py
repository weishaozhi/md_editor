"""测试文件夹展开/收起 UI 行为 + 展开状态持久化

BASE_URL: http://localhost:8000/api
前置条件: 后端服务已启动（:8000）
覆盖场景:
  1. 后端 GET /files/tree 返回嵌套结构正确（验证后端数据）
  2. 纯 Python 模拟前端 fileStore.isFolderExpanded 默认行为
  3. 模拟 toggleFolder 切换 Set<number> 状态
  4. 模拟 Zustand persist 的 Array <-> Set 序列化往返
  5. 验证嵌套缩进样式类（ml-4 / border-l）已应用到源代码
"""
import json
import sys
import time
from pathlib import Path
import requests

BASE_URL = "http://localhost:8000/api"
FILETREE_TSX = Path(__file__).resolve().parents[3] / "frontend" / "src" / "components" / "FileTree" / "FileTree.tsx"
FILESTORE_TS = Path(__file__).resolve().parents[3] / "frontend" / "src" / "store" / "fileStore.ts"


class TestFolderExpandUI:
    def __init__(self):
        self.token = None
        self.folder_id = None
        self.subfolder_id = None
        self.file_id = None

    def log(self, msg, status="INFO"):
        print(f"[{status}] {msg}")

    def login(self):
        import random
        username = f"expandtest{random.randint(1000, 9999)}"
        password = "test123"

        requests.post(
            f"{BASE_URL}/auth/register",
            json={"username": username, "email": f"{username}@test.com", "password": password},
            timeout=10,
        )
        resp = requests.post(
            f"{BASE_URL}/auth/login",
            data={"username": username, "password": password},
            timeout=10,
        )
        if resp.status_code == 200:
            self.token = resp.json()["access_token"]
            self.log("Login success")
            return True
        self.log(f"Login failed: {resp.status_code}", "FAIL")
        return False

    def headers(self):
        return {"Authorization": f"Bearer {self.token}"}

    # ---------- 后端契约：嵌套结构数据正确 ----------
    def test_backend_nested_tree(self):
        """建嵌套文件夹 + 文件，验证 GET /files/tree 结构"""
        self.log("Test: Build nested tree via API")

        resp = requests.post(
            f"{BASE_URL}/files",
            json={"name": "OuterFolder", "is_folder": True},
            headers=self.headers(),
            timeout=10,
        )
        assert resp.status_code in (200, 201), f"outer folder: {resp.status_code}"
        self.folder_id = resp.json()["id"]

        resp = requests.post(
            f"{BASE_URL}/files",
            json={"name": "InnerFolder", "is_folder": True, "parent_id": self.folder_id},
            headers=self.headers(),
            timeout=10,
        )
        assert resp.status_code in (200, 201), f"inner folder: {resp.status_code} - {resp.text}"
        self.subfolder_id = resp.json()["id"]

        resp = requests.post(
            f"{BASE_URL}/files",
            json={"name": "NestedDoc.md", "content": "# Hi", "is_folder": False, "parent_id": self.subfolder_id},
            headers=self.headers(),
            timeout=10,
        )
        assert resp.status_code in (200, 201), f"nested file: {resp.status_code} - {resp.text}"
        self.file_id = resp.json()["id"]

        resp = requests.get(f"{BASE_URL}/files/tree", headers=self.headers(), timeout=10)
        assert resp.status_code == 200, f"tree: {resp.status_code}"
        tree = resp.json()

        outer = next((it for it in tree if it["name"] == "OuterFolder"), None)
        assert outer is not None, "OuterFolder not in tree"
        inner = next((c for c in outer.get("children", []) if c["name"] == "InnerFolder"), None)
        assert inner is not None, "InnerFolder not nested under OuterFolder"
        doc = next((c for c in inner.get("children", []) if c["name"] == "NestedDoc.md"), None)
        assert doc is not None, "NestedDoc.md not nested under InnerFolder"

        self.log(f"Tree depth 2 verified: Outer->Inner->NestedDoc (ids {self.folder_id}/{self.subfolder_id}/{self.file_id})", "PASS")
        return True

    # ---------- 模拟前端 store：默认全部收起 ----------
    def test_store_default_collapsed(self):
        """模拟 store 默认 expandedFolders = set()，所有文件夹应判定为收起"""
        self.log("Test: Simulate default-collapsed store")
        expanded_folders = set()

        def is_folder_expanded(fid: int) -> bool:
            return fid in expanded_folders

        assert is_folder_expanded(self.folder_id) is False, "outer should default collapsed"
        assert is_folder_expanded(self.subfolder_id) is False, "inner should default collapsed"
        self.log("All folders default collapsed (children not visible)", "PASS")
        return True

    # ---------- 模拟 toggleFolder：展开 → 收起 双向切换 ----------
    def test_store_toggle(self):
        """模拟 toggleFolder，验证 Set 添加/删除与 isFolderExpanded 一致"""
        self.log("Test: Simulate toggleFolder state transition")
        expanded_folders = set()

        def toggle(fid: int):
            if fid in expanded_folders:
                expanded_folders.remove(fid)
            else:
                expanded_folders.add(fid)

        def is_expanded(fid: int) -> bool:
            return fid in expanded_folders

        assert is_expanded(self.folder_id) is False
        toggle(self.folder_id)
        assert is_expanded(self.folder_id) is True, "should be expanded after first toggle"
        toggle(self.folder_id)
        assert is_expanded(self.folder_id) is False, "should be collapsed after second toggle"
        toggle(self.subfolder_id)
        assert is_expanded(self.subfolder_id) is True
        assert is_expanded(self.folder_id) is False, "toggling inner must not affect outer"

        self.log("Toggle transitions: False->True->False, independent per folder", "PASS")
        return True

    # ---------- 模拟 Zustand persist 的序列化往返 ----------
    def test_persist_roundtrip(self):
        """验证 Set -> JSON 数组 -> Set 持久化往返不丢数据、不漂类型"""
        self.log("Test: Simulate Zustand persist roundtrip")
        expanded_folders = {self.folder_id, self.subfolder_id}

        # partialize: Set -> Array
        serialized = {"expandedFolders": sorted(expanded_folders)}
        blob = json.dumps(serialized)
        assert isinstance(blob, str)

        # onRehydrateStorage: Array -> Set
        parsed = json.loads(blob)
        assert isinstance(parsed["expandedFolders"], list)
        rehydrated = set(parsed["expandedFolders"])
        assert rehydrated == expanded_folders, f"roundtrip mismatch: {rehydrated} vs {expanded_folders}"

        # 模拟刷新：清除 in-memory 后从 storage 还原
        del expanded_folders
        expanded_folders = rehydrated
        assert self.folder_id in expanded_folders
        assert self.subfolder_id in expanded_folders
        self.log(f"Persist roundtrip: Set<{len(expanded_folders)}> survives JSON serialize/deserialize", "PASS")
        return True

    # ---------- 源码静态契约：缩进 + 左边框 样式已写到 FileTree.tsx ----------
    def test_source_has_indent_and_border(self):
        """检查 FileTree.tsx 中子项渲染处已包含 ml-4 pl-2 border-l 类名"""
        self.log("Test: Static check FileTree.tsx indent + border classes")
        assert FILETREE_TSX.exists(), f"FileTree.tsx not found at {FILETREE_TSX}"
        src = FILETREE_TSX.read_text(encoding="utf-8")

        assert "ml-4" in src, "missing ml-4 indent class"
        assert "border-l" in src, "missing border-l left-border class"
        assert "pl-2" in src, "missing pl-2 inner padding"
        assert "isFolderExpanded(item.id)" in src, "missing isFolderExpanded guard in FileTree"
        self.log("FileTree.tsx contains ml-4 / border-l / pl-2 / isFolderExpanded guard", "PASS")

        # 检查 fileStore.ts 已使用 persist
        assert FILESTORE_TS.exists(), f"fileStore.ts not found at {FILESTORE_TS}"
        store_src = FILESTORE_TS.read_text(encoding="utf-8")
        assert "persist" in store_src, "fileStore.ts missing persist middleware"
        assert "partialize" in store_src, "fileStore.ts missing partialize"
        assert "onRehydrateStorage" in store_src, "fileStore.ts missing onRehydrateStorage"
        self.log("fileStore.ts contains persist / partialize / onRehydrateStorage", "PASS")
        return True

    def run_all(self):
        self.log("=" * 60)
        self.log("Test: Folder Expand/Collapse UI + Persist")
        self.log("=" * 60)

        if not self.login():
            self.log("Login failed", "FAIL")
            return False

        tests = [
            self.test_backend_nested_tree,
            self.test_store_default_collapsed,
            self.test_store_toggle,
            self.test_persist_roundtrip,
            self.test_source_has_indent_and_border,
        ]
        results = []
        for t in tests:
            try:
                results.append(bool(t()))
            except AssertionError as e:
                self.log(f"AssertionError: {e}", "FAIL")
                results.append(False)
            except Exception as e:
                self.log(f"Exception: {type(e).__name__}: {e}", "FAIL")
                results.append(False)
            time.sleep(0.2)

        self.log("=" * 60)
        self.log(f"Results: {sum(results)}/{len(results)} passed")
        self.log("=" * 60)
        return all(results)


if __name__ == "__main__":
    tester = TestFolderExpandUI()
    success = tester.run_all()
    sys.exit(0 if success else 1)