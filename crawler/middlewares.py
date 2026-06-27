"""
InsightHub Crawler Middlewares — user-agent rotation, error handling.
"""

import logging
import random
from typing import Optional

from scrapy import Spider
from scrapy.downloadermiddlewares.retry import RetryMiddleware
from scrapy.utils.response import response_status_message

logger = logging.getLogger(__name__)

# ── Realistic user-agent pool ─────────────────────────────────────────────────

USER_AGENTS = [
    # Chrome on macOS
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36",
    # Chrome on Windows
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36",
    # Firefox on macOS
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) "
    "Gecko/20100101 Firefox/121.0",
    # Firefox on Windows
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
    # Edge on Windows
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
    # Safari on macOS
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/605.1.15 (KHTML, like Gecko) "
    "Version/17.2 Safari/605.1.15",
]

# Polite bot identifiers for APIs that prefer bots
BOT_USER_AGENTS = [
    "InsightHubCrawler/1.0 (+https://insighthub.ai/bot)",
    "Mozilla/5.0 (compatible; InsightHubBot/1.0; +https://insighthub.ai/bot)",
]

# ── Middleware ─────────────────────────────────────────────────────────────────


class RotateUserAgentMiddleware:
    """Rotate user-agent on each request."""

    def __init__(self, user_agents: list):
        self.user_agents = user_agents

    @classmethod
    def from_crawler(cls, crawler):
        # Merge default pool with optional setting
        ua_pool = USER_AGENTS + BOT_USER_AGENTS
        return cls(user_agents=ua_pool)

    def process_request(self, request, spider: Spider):
        ua = random.choice(self.user_agents)
        request.headers["User-Agent"] = ua
        logger.debug("UA: %s …", ua[:60])


class ErrorHandlingMiddleware(RetryMiddleware):
    """Enhanced retry with logging and back-off."""

    def __init__(self, settings):
        super().__init__(settings)
        self.max_retry_times = settings.getint("RETRY_TIMES", 3)

    @classmethod
    def from_crawler(cls, crawler):
        return cls(crawler.settings)

    def process_response(self, request, response, spider: Spider):
        if response.status in [429, 503, 502, 500]:
            reason = response_status_message(response.status)
            logger.warning(
                "[Retry] %s %s — %s (retry count: %s)",
                request.method,
                request.url,
                reason,
                request.meta.get("retry_times", 0),
            )
            return self._retry(request, reason, spider) or response
        return response

    def process_exception(self, request, exception, spider: Spider):
        logger.warning(
            "[Exception] %s %s — %s: %s",
            request.method,
            request.url,
            type(exception).__name__,
            exception,
        )
        return self._retry(request, exception, spider)
