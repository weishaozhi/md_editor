from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from app.database import get_db
from app.models.file import File, FileCollaborator
from app.models.user import User
from app.utils.dependencies import get_current_user

router = APIRouter(prefix="/collaboration", tags=["协作"])


@router.get("/files/{file_id}/collaborators")
async def get_collaborators(
    file_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(File).where(File.id == file_id))
    file = result.scalar_one_or_none()
    
    if not file:
        raise HTTPException(status_code=404, detail="文件不存在")
    
    if file.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权限")
    
    result = await db.execute(
        select(FileCollaborator, User).join(User).where(FileCollaborator.file_id == file_id)
    )
    collaborators = []
    for collab, user in result.all():
        collaborators.append({
            "id": collab.id,
            "user_id": user.id,
            "username": user.username,
            "permission": collab.permission
        })
    
    return collaborators


@router.post("/files/{file_id}/collaborators")
async def add_collaborator(
    file_id: int,
    user_id: int,
    permission: str = "edit",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(File).where(File.id == file_id))
    file = result.scalar_one_or_none()
    
    if not file:
        raise HTTPException(status_code=404, detail="文件不存在")
    
    if file.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权限")
    
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    
    result = await db.execute(
        select(FileCollaborator).where(
            FileCollaborator.file_id == file_id,
            FileCollaborator.user_id == user_id
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="用户已在协作者列表中")
    
    collab = FileCollaborator(
        file_id=file_id,
        user_id=user_id,
        permission=permission
    )
    db.add(collab)
    await db.commit()
    
    return {"message": "添加成功"}


@router.delete("/files/{file_id}/collaborators/{collab_user_id}")
async def remove_collaborator(
    file_id: int,
    collab_user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(File).where(File.id == file_id))
    file = result.scalar_one_or_none()
    
    if not file:
        raise HTTPException(status_code=404, detail="文件不存在")
    
    if file.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权限")
    
    result = await db.execute(
        select(FileCollaborator).where(
            FileCollaborator.file_id == file_id,
            FileCollaborator.user_id == collab_user_id
        )
    )
    collab = result.scalar_one_or_none()
    
    if not collab:
        raise HTTPException(status_code=404, detail="协作者不存在")
    
    await db.delete(collab)
    await db.commit()
    
    return {"message": "移除成功"}
