from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from app.database import get_db
from app.models.file import File, FileVersion
from app.models.user import User
from app.schemas.file import VersionCreate, VersionResponse, FileResponse
from app.utils.dependencies import get_current_user

router = APIRouter(prefix="/files/{file_id}/versions", tags=["版本控制"])


@router.get("", response_model=List[VersionResponse])
async def get_versions(
    file_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(File).where(File.id == file_id))
    file = result.scalar_one_or_none()
    
    if not file:
        raise HTTPException(status_code=404, detail="文件不存在")
    
    if file.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权限访问")
    
    result = await db.execute(
        select(FileVersion).where(FileVersion.file_id == file_id).order_by(FileVersion.version_num.desc())
    )
    return result.scalars().all()


@router.post("", response_model=VersionResponse)
async def create_version(
    file_id: int,
    version_data: VersionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(File).where(File.id == file_id))
    file = result.scalar_one_or_none()
    
    if not file:
        raise HTTPException(status_code=404, detail="文件不存在")
    
    if file.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权限")
    
    last_version_result = await db.execute(
        select(FileVersion).where(FileVersion.file_id == file_id).order_by(FileVersion.version_num.desc()).limit(1)
    )
    last_version = last_version_result.scalar_one_or_none()
    next_version_num = (last_version.version_num + 1) if last_version else 1
    
    db_version = FileVersion(
        file_id=file_id,
        content=file.content,
        comment=version_data.comment,
        version_num=next_version_num
    )
    db.add(db_version)
    await db.commit()
    await db.refresh(db_version)
    return db_version


@router.get("/{version_id}", response_model=VersionResponse)
async def get_version(
    file_id: int,
    version_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(File).where(File.id == file_id))
    file = result.scalar_one_or_none()
    
    if not file:
        raise HTTPException(status_code=404, detail="文件不存在")
    
    if file.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权限访问")
    
    result = await db.execute(
        select(FileVersion).where(FileVersion.id == version_id, FileVersion.file_id == file_id)
    )
    version = result.scalar_one_or_none()
    
    if not version:
        raise HTTPException(status_code=404, detail="版本不存在")
    
    return version


@router.post("/{version_id}/restore", response_model=FileResponse)
async def restore_version(
    file_id: int,
    version_id: int,
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
        select(FileVersion).where(FileVersion.id == version_id, FileVersion.file_id == file_id)
    )
    version = result.scalar_one_or_none()
    
    if not version:
        raise HTTPException(status_code=404, detail="版本不存在")
    
    file.content = version.content
    await db.commit()
    await db.refresh(file)
    return file
