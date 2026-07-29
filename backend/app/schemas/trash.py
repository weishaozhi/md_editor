from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class TrashSettingsBase(BaseModel):
    retention_hours: Optional[int] = None


class TrashSettingsCreate(TrashSettingsBase):
    pass


class TrashSettingsUpdate(TrashSettingsBase):
    pass


class TrashSettingsResponse(TrashSettingsBase):
    id: int
    user_id: int
    created_at: datetime

    class Config:
        from_attributes = True
