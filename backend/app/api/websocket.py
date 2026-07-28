from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Dict, List
import json
import asyncio

from app.database import get_db, async_session
from app.models.file import File
from app.models.user import User
from app.utils.security import decode_token

router = APIRouter()


class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, Dict[int, WebSocket]] = {}

    async def connect(self, websocket: WebSocket, file_id: int, user_id: int):
        await websocket.accept()
        if file_id not in self.active_connections:
            self.active_connections[file_id] = {}
        self.active_connections[file_id][user_id] = websocket

    def disconnect(self, file_id: int, user_id: int):
        if file_id in self.active_connections:
            self.active_connections[file_id].pop(user_id, None)
            if not self.active_connections[file_id]:
                del self.active_connections[file_id]

    async def broadcast(self, file_id: int, message: dict, exclude_user: int = None):
        if file_id in self.active_connections:
            disconnected = []
            for user_id, connection in self.active_connections[file_id].items():
                if user_id != exclude_user:
                    try:
                        await connection.send_json(message)
                    except:
                        disconnected.append(user_id)
            for user_id in disconnected:
                self.disconnect(file_id, user_id)

    def get_users(self, file_id: int) -> List[int]:
        if file_id in self.active_connections:
            return list(self.active_connections[file_id].keys())
        return []


manager = ConnectionManager()


@router.websocket("/ws/collab/{file_id}")
async def websocket_endpoint(websocket: WebSocket, file_id: int):
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4001)
        return

    payload = decode_token(token)
    if not payload:
        await websocket.close(code=4001)
        return

    user_id = payload.get("sub")
    if not user_id:
        await websocket.close(code=4001)
        return

    try:
        user_id = int(user_id)
    except (ValueError, TypeError):
        await websocket.close(code=4001)
        return

    async with async_session() as db:
        result = await db.execute(select(File).where(File.id == file_id))
        file = result.scalar_one_or_none()
        if not file:
            await websocket.close(code=4004)
            return

        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            await websocket.close(code=4001)
            return

        username = user.username

    await manager.connect(websocket, file_id, user_id)

    await manager.broadcast(file_id, {
        "type": "user_joined",
        "user_id": user_id,
        "username": username
    })

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")

            if msg_type == "cursor_update":
                await manager.broadcast(file_id, {
                    "type": "cursor_update",
                    "user_id": user_id,
                    "username": username,
                    "position": data.get("position")
                }, exclude_user=user_id)

            elif msg_type == "content_change":
                await manager.broadcast(file_id, {
                    "type": "content_change",
                    "user_id": user_id,
                    "content": data.get("content"),
                    "cursor_position": data.get("cursor_position")
                }, exclude_user=user_id)

            elif msg_type == "save":
                async with async_session() as db:
                    result = await db.execute(select(File).where(File.id == file_id))
                    file = result.scalar_one_or_none()
                    if file and file.owner_id == user_id:
                        file.content = data.get("content", file.content)
                        await db.commit()

    except WebSocketDisconnect:
        manager.disconnect(file_id, user_id)
        await manager.broadcast(file_id, {
            "type": "user_left",
            "user_id": user_id,
            "username": username
        })
