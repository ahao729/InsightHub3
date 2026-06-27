"""
InsightHub Crawler — Scrapy project settings.
"""

import os
from dotenv import load_dotenv

load_dotenv()

# ── Bot Identity ──────────────────────────────────────────────────────────────
BOT_NAME = "insighthub_crawler"
SPIDER_MODULES = ["crawler.spiders"]
NEWSPIDER_MODULE = "crawler.spiders"

# ── Politeness ────────────────────────────────────────────────────────────────
ROBOTSTXT_OBEY = True
DOWNLOAD_DELAY = 2.0
CONCURRENT_REQUESTS = 4
CONCURRENT_REQUESTS_PER_DOMAIN = 2
AUTOTHROTTLE_ENABLED = True
AUTOTHROTTLE_START_DELAY = 1.0
AUTOTHROTTLE_MAX_DELAY = 10.0
AUTOTHROTTLE_TARGET_CONCURRENCY = 1.0

# ── User-Agent ────────────────────────────────────────────────────────────────
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36 "
    "InsightHubCrawler/1.0"
)

# ── Middleware ────────────────────────────────────────────────────────────────
DOWNLOADER_MIDDLEWARES = {
    "crawler.middlewares.RotateUserAgentMiddleware": 400,
    "crawler.middlewares.ErrorHandlingMiddleware": 500,
    "scrapy.downloadermiddlewares.useragent.UserAgentMiddleware": None,
}

# ── Item Pipelines ────────────────────────────────────────────────────────────
ITEM_PIPELINES = {
    "crawler.pipelines.ValidationPipeline": 100,
    "crawler.pipelines.DedupPipeline": 200,
    "crawler.pipelines.DatabasePipeline": 300,
    "crawler.pipelines.StatsPipeline": 400,
}

# ── Database (from environment / .env) ───────────────────────────────────────
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", 5432))
DB_NAME = os.getenv("DB_NAME", "insighthub")
DB_USER = os.getenv("DB_USER", "insighthub")
DB_PASSWORD = os.getenv("DB_PASSWORD", "insighthub")
DB_SCHEMA = os.getenv("DB_SCHEMA", "public")

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}",
)

# ── Crawl defaults ────────────────────────────────────────────────────────────
CRAWL_OUTPUT_DIR = os.getenv("CRAWL_OUTPUT_DIR", "output")
CRAWL_DEV_MODE = os.getenv("CRAWL_DEV_MODE", "false").lower() == "true"

# ── Extensions ────────────────────────────────────────────────────────────────
EXTENSIONS = {
    "scrapy.extensions.telnet.TelnetConsole": None,
}

# ── Logging ───────────────────────────────────────────────────────────────────
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
LOG_FILE = os.getenv("LOG_FILE", None)

# ── Feed exports (JSON fallback) ───────────────────────────────────────────────
FEED_FORMAT = "jsonlines"
FEED_URI = os.getenv("FEED_URI", None)
FEED_EXPORT_ENCODING = "utf-8"
