from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from app.database import get_db
from app.models.plugin import Plugin
from app.models.user import User
from app.schemas.plugin import PluginCreate, PluginResponse, PluginUpdate
from app.utils.dependencies import get_current_user

router = APIRouter(prefix="/plugins", tags=["插件管理"])


@router.get("", response_model=List[PluginResponse])
async def get_plugins(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Plugin).order_by(Plugin.installed_at.desc()))
    return result.scalars().all()


@router.get("/{plugin_id}", response_model=PluginResponse)
async def get_plugin(
    plugin_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Plugin).where(Plugin.id == plugin_id))
    plugin = result.scalar_one_or_none()
    
    if not plugin:
        raise HTTPException(status_code=404, detail="插件不存在")
    
    return plugin


@router.post("", response_model=PluginResponse)
async def create_plugin(
    plugin_data: PluginCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Plugin).where(Plugin.name == plugin_data.name))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="插件已存在")
    
    db_plugin = Plugin(
        name=plugin_data.name,
        version=plugin_data.version,
        description=plugin_data.description,
        author=plugin_data.author,
        manifest=plugin_data.manifest
    )
    db.add(db_plugin)
    await db.commit()
    await db.refresh(db_plugin)
    return db_plugin


@router.put("/{plugin_id}", response_model=PluginResponse)
async def update_plugin(
    plugin_id: int,
    plugin_data: PluginUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Plugin).where(Plugin.id == plugin_id))
    plugin = result.scalar_one_or_none()
    
    if not plugin:
        raise HTTPException(status_code=404, detail="插件不存在")
    
    if plugin_data.enabled is not None:
        plugin.enabled = plugin_data.enabled
    if plugin_data.config is not None:
        plugin.config = plugin_data.config
    
    await db.commit()
    await db.refresh(plugin)
    return plugin


@router.delete("/{plugin_id}")
async def delete_plugin(
    plugin_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Plugin).where(Plugin.id == plugin_id))
    plugin = result.scalar_one_or_none()
    
    if not plugin:
        raise HTTPException(status_code=404, detail="插件不存在")
    
    await db.delete(plugin)
    await db.commit()
    return {"message": "删除成功"}
