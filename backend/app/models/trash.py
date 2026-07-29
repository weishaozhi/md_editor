from sqlalchemy import Column, Integer, DateTime, ForeignKey
from datetime import datetime
from app.database import Base


class TrashSettings(Base):
    __tablename__ = "trash_settings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    retention_hours = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
