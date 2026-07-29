import uvicorn
from pathlib import Path
from app.config_loader import get_settings, get_extended_config, setup_logging

# 加载配置
_settings = get_settings()
_ext_config = get_extended_config()

# 配置日志
logger = setup_logging(_ext_config)

if __name__ == "__main__":
    logger.info("=" * 50)
    logger.info("MD Editor Backend 启动中...")
    logger.info(f"日志文件: {_ext_config.log_file.path}")
    logger.info(f"服务器配置: {_ext_config.server.host}:{_ext_config.server.port}")
    logger.info("=" * 50)

    uvicorn.run(
        "app.main:app",
        host=_ext_config.server.host,
        port=_ext_config.server.port,
        reload=_ext_config.server.reload,
        log_level=_ext_config.server.log_level,
    )
