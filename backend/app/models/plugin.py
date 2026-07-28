from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, JSON
from datetime import datetime
from app.database import Base


class Plugin(Base):
    __tablename__ = "plugins"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, index=True, nullable=False)
    version = Column(String(20), nullable=False)
    description = Column(Text, nullable=True)
    author = Column(String(100), nullable=True)
    manifest = Column(JSON, nullable=False)
    enabled = Column(Boolean, default=True)
    config = Column(JSON, default={})
    installed_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
