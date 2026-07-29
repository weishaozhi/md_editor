from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_, update
from sqlalchemy.orm import selectinload
from typing import List, Optional
from datetime import datetime

from app.database import get_db
from app.models.file import File
from app.models.user import User
from app.schemas.file import FileCreate, FileUpdate, FileResponse, FileTreeItem
from app.utils.dependencies import get_current_user

router = APIRouter(prefix="/files", tags=["文件管理"])


def build_file_tree(files: List[File], parent_id: Optional[int] = None) -> List[FileTreeItem]:
    tree = []
    for file in files:
        if file.parent_id == parent_id and file.deleted_at is None:
            children = build_file_tree(files, file.id)
            item = FileTreeItem(
                id=file.id,
                name=file.name,
                is_folder=file.is_folder,
                parent_id=file.parent_id,
                children=children
            )
            tree.append(item)
    return tree


@router.get("/tree", response_model=List[FileTreeItem])
async def get_file_tree(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(File).where(
            and_(
                or_(File.owner_id == current_user.id, File.owner_id == 1),
                File.deleted_at.is_(None)
            )
        ).order_by(File.is_folder.desc(), File.name)
    )
    files = result.scalars().all()
    return build_file_tree(list(files))


@router.get("/folders", response_model=List[FileResponse])
async def get_folders(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(File).where(
            and_(
                File.owner_id == current_user.id,
                File.is_folder == True,
                File.deleted_at.is_(None)
            )
        ).order_by(File.name)
    )
    return result.scalars().all()


@router.get("", response_model=List[FileResponse])
async def get_files(
    parent_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = select(File).where(
        and_(
            File.owner_id == current_user.id,
            File.deleted_at.is_(None)
        )
    )
    if parent_id is not None:
        query = query.where(File.parent_id == parent_id)
    else:
        query = query.where(File.parent_id == None)

    result = await db.execute(query.order_by(File.is_folder.desc(), File.name))
    return result.scalars().all()


@router.get("/{file_id}", response_model=FileResponse)
async def get_file(
    file_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(File).where(File.id == file_id))
    file = result.scalar_one_or_none()

    if not file:
        raise HTTPException(status_code=404, detail="文件不存在")

    if file.deleted_at is not None:
        raise HTTPException(status_code=404, detail="文件已在垃圾桶中")

    if file.owner_id != current_user.id and file.owner_id != 1:
        raise HTTPException(status_code=403, detail="无权限访问")

    return file


@router.post("", response_model=FileResponse)
async def create_file(
    file: FileCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if file.is_folder and file.parent_id is not None:
        raise HTTPException(status_code=400, detail="文件夹只能在根目录创建，不支持嵌套")

    db_file = File(
        name=file.name,
        path=file.name,
        content=file.content,
        parent_id=file.parent_id,
        is_folder=file.is_folder,
        owner_id=current_user.id
    )
    db.add(db_file)
    await db.commit()
    await db.refresh(db_file)
    return db_file


@router.put("/{file_id}", response_model=FileResponse)
async def update_file(
    file_id: int,
    file: FileUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(File).where(File.id == file_id))
    db_file = result.scalar_one_or_none()

    if not db_file:
        raise HTTPException(status_code=404, detail="文件不存在")

    if db_file.deleted_at is not None:
        raise HTTPException(status_code=400, detail="已删除的文件无法修改")

    if db_file.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权限修改")

    if file.name is not None:
        db_file.name = file.name
    if file.content is not None:
        db_file.content = file.content
    if file.parent_id is not None:
        db_file.parent_id = file.parent_id
        db_file.deleted_at = None

    await db.commit()
    await db.refresh(db_file)
    return db_file


@router.delete("/{file_id}")
async def delete_file(
    file_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(File).where(File.id == file_id))
    db_file = result.scalar_one_or_none()

    if not db_file:
        raise HTTPException(status_code=404, detail="文件不存在")

    if db_file.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权限删除")

    db_file.deleted_at = datetime.utcnow()
    await db.commit()

    return {"message": "已移入垃圾桶"}


@router.get("/search/", response_model=List[FileResponse])
async def search_files(
    q: str = Query(..., min_length=1),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(File).where(
            and_(
                File.owner_id == current_user.id,
                File.name.like(f"%{q}%"),
                File.is_folder == False,
                File.deleted_at.is_(None)
            )
        ).limit(20)
    )
    return result.scalars().all()
