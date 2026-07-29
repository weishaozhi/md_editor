from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import traceback

from app.config import settings
from app.database import init_db
from app.api import files_router, auth_router, versions_router, plugins_router, collab_router, export_router, trash_router
from app.api.websocket import router as ws_router
import logging

logger = logging.getLogger(__name__)

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Markdown 文件读取与编辑工具 API"
)

# 全局异常处理器
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}\n{traceback.format_exc()}")
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc) if settings.DEBUG else "Internal server error"}
    )

# CORS 配置：来源从环境变量 CORS_ALLOW_ORIGINS 注入
# 安全约束：allow_credentials=True 时不允许 "*"（浏览器规范禁止）
_cors_raw = settings.CORS_ALLOW_ORIGINS.strip()
if _cors_raw == "*":
    if settings.DEBUG:
        # 仅 DEBUG 模式下允许 "*"，并强制关闭 credentials，避免不安全组合
        cors_origins = ["*"]
        logger.warning(
            "CORS_ALLOW_ORIGINS=* 与 DEBUG=True：不安全配置，仅供本地手测使用。"
            "生产环境请显式列出允许来源。"
        )
    else:
        raise RuntimeError(
            "CORS_ALLOW_ORIGINS='*' 不能在生产环境使用。"
            "请在 .env 中显式列出允许的来源，例如 "
            "CORS_ALLOW_ORIGINS=https://your.domain,https://admin.your.domain"
        )
else:
    cors_origins = [o.strip() for o in _cors_raw.split(",") if o.strip()]
    if not cors_origins:
        raise RuntimeError(
            "CORS_ALLOW_ORIGINS 为空。请在 .env 中至少配置一个允许来源。"
        )

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=cors_origins != ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

# Expose resolved CORS settings for runtime introspection & tests.
# Read-only dict; do not mutate at runtime.
_cors_state: dict = {
    "origins": list(cors_origins),
    "credentials": cors_origins != ["*"],
}

app.include_router(auth_router, prefix=settings.API_PREFIX)
app.include_router(files_router, prefix=settings.API_PREFIX)
app.include_router(versions_router, prefix=settings.API_PREFIX)
app.include_router(plugins_router, prefix=settings.API_PREFIX)
app.include_router(collab_router, prefix=settings.API_PREFIX)
app.include_router(export_router, prefix=settings.API_PREFIX)
app.include_router(trash_router, prefix=settings.API_PREFIX)
app.include_router(ws_router)


@app.on_event("startup")
async def startup():
    await init_db()


@app.get("/")
async def root():
    return {"message": "MD Editor API", "version": settings.VERSION}


@app.get("/health")
async def health():
    return {"status": "healthy"}
