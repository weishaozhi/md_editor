import uvicorn
import logging
import os
from logging.handlers import RotatingFileHandler

# 配置日志
LOG_DIR = os.path.dirname(os.path.abspath(__file__))
LOG_FILE = os.path.join(LOG_DIR, "logs", "app.log")
LOG_LEVEL = logging.DEBUG  # 改为 DEBUG 获取更多信息

# 确保日志目录存在
os.makedirs(os.path.join(LOG_DIR, "logs"), exist_ok=True)

def setup_logging():
    """配置日志"""
    logger = logging.getLogger()
    logger.setLevel(LOG_LEVEL)

    # 文件处理器 - 保留最近 5 个日志文件，每个最大 10MB
    file_handler = RotatingFileHandler(
        LOG_FILE,
        maxBytes=10 * 1024 * 1024,  # 10MB
        backupCount=5,
        encoding="utf-8"
    )
    file_handler.setLevel(LOG_LEVEL)

    # 控制台处理器
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)

    # 格式化
    formatter = logging.Formatter(
        "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )
    file_handler.setFormatter(formatter)
    console_handler.setFormatter(formatter)

    logger.addHandler(file_handler)
    logger.addHandler(console_handler)

    return logger

logger = setup_logging()

if __name__ == "__main__":
    logger.info("=" * 50)
    logger.info("MD Editor Backend 启动中...")
    logger.info(f"日志文件: {LOG_FILE}")
    logger.info("=" * 50)

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
