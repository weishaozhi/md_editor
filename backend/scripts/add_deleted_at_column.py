"""
数据库迁移脚本：添加 deleted_at 列到 files 表

用于支持垃圾桶功能（软删除）

运行方式：
    python -m scripts.add_deleted_at_column

前置条件：
    1. 后端服务已停止
    2. 数据库文件存在 (md_editor.db)

验证：
    运行后可通过以下方式验证：
    - 重启后端服务，访问 API 应该正常工作
    - python test/07_trash/test_trash_api.py 应该全部通过
"""

import sqlite3
import sys
from pathlib import Path

def migrate():
    db_path = Path(__file__).parent.parent / "md_editor.db"

    if not db_path.exists():
        print(f"[ERROR] 数据库文件不存在: {db_path}")
        print("请确保在 backend 目录下运行此脚本")
        sys.exit(1)

    print(f"[INFO] 连接到数据库: {db_path}")

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # 检查 files 表是否存在
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='files'")
    if not cursor.fetchone():
        print("[ERROR] files 表不存在，请先运行数据库初始化")
        conn.close()
        sys.exit(1)

    # 检查 deleted_at 列是否已存在
    cursor.execute("PRAGMA table_info(files)")
    columns = [col[1] for col in cursor.fetchall()]

    if "deleted_at" in columns:
        print("[INFO] deleted_at 列已存在，无需迁移")
        conn.close()
        return True

    print("[INFO] 添加 deleted_at 列到 files 表...")

    try:
        cursor.execute("ALTER TABLE files ADD COLUMN deleted_at TIMESTAMP")
        conn.commit()
        print("[SUCCESS] deleted_at 列添加成功")

        # 验证
        cursor.execute("PRAGMA table_info(files)")
        columns = [col[1] for col in cursor.fetchall()]
        if "deleted_at" in columns:
            print("[INFO] 验证通过：deleted_at 列已存在")
        else:
            print("[ERROR] 验证失败：deleted_at 列不存在")
            conn.close()
            sys.exit(1)

    except sqlite3.Error as e:
        print(f"[ERROR] 添加列失败: {e}")
        conn.close()
        sys.exit(1)

    conn.close()
    return True

if __name__ == "__main__":
    print("=" * 50)
    print("数据库迁移：添加 deleted_at 列")
    print("=" * 50)
    success = migrate()
    print("=" * 50)
    if success:
        print("迁移完成！")
    else:
        print("迁移失败！")
    print("=" * 50)
