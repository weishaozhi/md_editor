from pydantic import BaseModel
from datetime import datetime
from typing import Optional, Dict, Any


class PluginBase(BaseModel):
    name: str
    version: str
    description: Optional[str] = None
    author: Optional[str] = None


class PluginCreate(PluginBase):
    manifest: Dict[str, Any]


class PluginUpdate(BaseModel):
    enabled: Optional[bool] = None
    config: Optional[Dict[str, Any]] = None


class PluginResponse(PluginBase):
    id: int
    manifest: Dict[str, Any]
    enabled: bool
    config: Dict[str, Any]
    installed_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
