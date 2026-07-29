from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List
from app.schemas.user import UserResponse


class VersionBase(BaseModel):
    comment: Optional[str] = None


class VersionCreate(VersionBase):
    pass


class VersionResponse(VersionBase):
    id: int
    file_id: int
    content: str
    version_num: int
    created_at: datetime

    class Config:
        from_attributes = True


class FileBase(BaseModel):
    name: str
    parent_id: Optional[int] = None
    is_folder: bool = False


class FileCreate(FileBase):
    content: str = ""


class FileUpdate(BaseModel):
    name: Optional[str] = None
    content: Optional[str] = None
    parent_id: Optional[int] = None


class FileResponse(BaseModel):
    id: int
    name: str
    path: str
    content: str
    parent_id: Optional[int]
    is_folder: bool
    owner_id: int
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class FileTreeItem(BaseModel):
    id: int
    name: str
    is_folder: bool
    parent_id: Optional[int]
    children: List["FileTreeItem"] = []

    class Config:
        from_attributes = True


FileTreeItem.model_rebuild()


class FileTreeResponse(BaseModel):
    items: List[FileTreeItem]
