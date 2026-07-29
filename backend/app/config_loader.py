"""配置加载模块.

统一管理所有可配置项，禁止硬编码。
支持从 config.yaml 加载日志配置，同时保留 pydantic_settings 的环境变量配置。
"""
from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from pathlib import Path

import yaml
from pydantic_settings import BaseSettings


# Pydantic Settings（从环境变量或 .env 加载）
class Settings(BaseSettings):
    PROJECT_NAME: str = "MD Editor"
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"

    DATABASE_URL: str = "sqlite+aiosqlite:///./md_editor.db"

    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    WORKSPACE_PATH: str = "./workspace"

    DEBUG: bool = False

    class Config:
        env_file = ".env"


@dataclass(frozen=True)
class ServerConfig:
    host: str
    port: int
    reload: bool
    log_level: str


@dataclass(frozen=True)
class LoggingConfig:
    level: str
    format: str
    datefmt: str


@dataclass(frozen=True)
class LogFileConfig:
    enabled: bool
    path: str
    max_bytes: int
    backup_count: int


@dataclass(frozen=True)
class ConsoleConfig:
    enabled: bool
    level: str


@dataclass(frozen=True)
class ExtendedConfig:
    server: ServerConfig
    logging: LoggingConfig
    log_file: LogFileConfig
    console: ConsoleConfig


def load_extended_config(config_path: Path | None = None, base_dir: Path | None = None) -> ExtendedConfig:
    """加载扩展配置（日志相关）."""
    if base_dir is None:
        base_dir = Path(__file__).resolve().parent.parent  # app -> backend
    if config_path is None:
        config_path = base_dir / "config.yaml"

    with open(config_path, "r", encoding="utf-8") as f:
        raw = yaml.safe_load(f)

    return ExtendedConfig(
        server=ServerConfig(
            host=raw["server"]["host"],
            port=raw["server"]["port"],
            reload=raw["server"]["reload"],
            log_level=raw["server"]["log_level"],
        ),
        logging=LoggingConfig(
            level=raw["logging"]["level"],
            format=raw["logging"]["format"],
            datefmt=raw["logging"]["datefmt"],
        ),
        log_file=LogFileConfig(
            enabled=raw["log_file"]["enabled"],
            path=raw["log_file"]["path"],
            max_bytes=raw["log_file"]["max_bytes"],
            backup_count=raw["log_file"]["backup_count"],
        ),
        console=ConsoleConfig(
            enabled=raw["console"]["enabled"],
            level=raw["console"]["level"],
        ),
    )


def setup_logging(config: ExtendedConfig) -> logging.Logger:
    """配置日志."""
    logger = logging.getLogger()
    logger.setLevel(getattr(logging, config.logging.level.upper(), logging.DEBUG))

    formatter = logging.Formatter(
        fmt=config.logging.format,
        datefmt=config.logging.datefmt,
    )

    # 文件处理器
    if config.log_file.enabled:
        log_path = Path(__file__).resolve().parent / config.log_file.path
        log_path.parent.mkdir(parents=True, exist_ok=True)
        from logging.handlers import RotatingFileHandler
        file_handler = RotatingFileHandler(
            str(log_path),
            maxBytes=config.log_file.max_bytes,
            backupCount=config.log_file.backup_count,
            encoding="utf-8",
        )
        file_handler.setLevel(getattr(logging, config.logging.level.upper(), logging.DEBUG))
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)

    # 控制台处理器
    if config.console.enabled:
        console_handler = logging.StreamHandler()
        console_handler.setLevel(getattr(logging, config.console.level.upper(), logging.INFO))
        console_handler.setFormatter(formatter)
        logger.addHandler(console_handler)

    return logger


# 单例
_settings: Settings | None = None
_extended_config: ExtendedConfig | None = None


def get_settings() -> Settings:
    """获取 pydantic settings 单例."""
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings


def get_extended_config() -> ExtendedConfig:
    """获取扩展配置单例."""
    global _extended_config
    if _extended_config is None:
        _extended_config = load_extended_config()
    return _extended_config


# 为了兼容旧代码，提供 settings 别名
settings = get_settings()
