from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class File(Base):
    __tablename__ = "files"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    path = Column(String(1000), nullable=False)
    content = Column(Text, default="")
    parent_id = Column(Integer, ForeignKey("files.id"), nullable=True)
    is_folder = Column(Boolean, default=False)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    owner = relationship("User", back_populates="files")
    parent = relationship("File", remote_side=[id], backref="children")
    versions = relationship("FileVersion", back_populates="file", cascade="all, delete-orphan")
    collaborators = relationship("FileCollaborator", back_populates="file", cascade="all, delete-orphan")


class FileVersion(Base):
    __tablename__ = "file_versions"

    id = Column(Integer, primary_key=True, index=True)
    file_id = Column(Integer, ForeignKey("files.id"), nullable=False)
    content = Column(Text, nullable=False)
    comment = Column(String(500), nullable=True)
    version_num = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    file = relationship("File", back_populates="versions")


class FileCollaborator(Base):
    __tablename__ = "file_collaborators"

    id = Column(Integer, primary_key=True, index=True)
    file_id = Column(Integer, ForeignKey("files.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    permission = Column(String(20), default="edit")
    created_at = Column(DateTime, default=datetime.utcnow)

    file = relationship("File", back_populates="collaborators")
    user = relationship("User", back_populates="collaborations")
