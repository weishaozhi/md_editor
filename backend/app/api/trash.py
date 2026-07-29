from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import List
from datetime import datetime, timedelta
import logging

from app.database import get_db
from app.models.file import File
from app.models.trash import TrashSettings
from app.models.user import User
from app.schemas.file import FileResponse
from app.schemas.trash import TrashSettingsResponse, TrashSettingsUpdate
from app.utils.dependencies import get_current_user

router = APIRouter(prefix="/trash", tags=["垃圾桶"])


@router.get("", response_model=List[FileResponse])
async def get_trash(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(File).where(
            and_(
                File.owner_id == current_user.id,
                File.deleted_at.isnot(None)
            )
        ).order_by(File.deleted_at.desc())
    )
    return result.scalars().all()


@router.post("/{file_id}/restore")
async def restore_file(
    file_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(File).where(File.id == file_id))
    file = result.scalar_one_or_none()

    if not file:
        raise HTTPException(status_code=404, detail="文件不存在")

    if file.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权限恢复")

    if file.deleted_at is None:
        raise HTTPException(status_code=400, detail="文件未被删除")

    file.deleted_at = None
    await db.commit()

    return {"message": "文件已恢复"}


@router.delete("/empty")
async def empty_trash(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(File).where(
            and_(
                File.owner_id == current_user.id,
                File.deleted_at.isnot(None)
            )
        )
    )
    files = result.scalars().all()

    for file in files:
        await db.delete(file)

    await db.commit()

    return {"message": f"已清空垃圾桶，删除 {len(files)} 个项目"}


@router.delete("/{file_id}")
async def permanent_delete(
    file_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(File).where(File.id == file_id))
    file = result.scalar_one_or_none()

    if not file:
        raise HTTPException(status_code=404, detail="文件不存在")

    if file.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权限删除")

    await db.delete(file)
    await db.commit()

    return {"message": "永久删除成功"}


@router.get("/settings", response_model=TrashSettingsResponse)
async def get_trash_settings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(TrashSettings).where(TrashSettings.user_id == current_user.id)
    )
    settings = result.scalar_one_or_none()

    if not settings:
        settings = TrashSettings(user_id=current_user.id, retention_hours=None)
        db.add(settings)
        await db.commit()
        await db.refresh(settings)

    return settings


@router.put("/settings", response_model=TrashSettingsResponse)
async def update_trash_settings(
    settings_update: TrashSettingsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(TrashSettings).where(TrashSettings.user_id == current_user.id)
    )
    settings = result.scalar_one_or_none()

    if not settings:
        settings = TrashSettings(user_id=current_user.id)
        db.add(settings)

    if settings_update.retention_hours is not None:
        if settings_update.retention_hours < 0:
            raise HTTPException(status_code=400, detail="保留时间不能为负数")
        settings.retention_hours = settings_update.retention_hours

    await db.commit()
    await db.refresh(settings)

    return settings


async def cleanup_expired_trash(db: AsyncSession):
    result = await db.execute(select(TrashSettings))
    all_settings = result.scalars().all()

    for settings in all_settings:
        if settings.retention_hours is None:
            continue

        cutoff_time = datetime.utcnow() - timedelta(hours=settings.retention_hours)

        files_result = await db.execute(
            select(File).where(
                and_(
                    File.owner_id == settings.user_id,
                    File.deleted_at.isnot(None),
                    File.deleted_at < cutoff_time
                )
            )
        )
        expired_files = files_result.scalars().all()

        for file in expired_files:
            await db.delete(file)

        if expired_files:
            logging.info(f"自动清理了用户 {settings.user_id} 的 {len(expired_files)} 个过期文件")

    await db.commit()
