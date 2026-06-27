"""
Base spider classes for InsightHub Crawler.

Provides common functionality:
  - Database connection helper
  - Date parsing utilities
  - Rate limiting helper
  - Mock data generation (dev mode)
"""

import json
import logging
import time
from abc import ABC
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

import scrapy
from scrapy import Spider

logger = logging.getLogger(__name__)


class BaseSpider(Spider, ABC):
    """
    Abstract base spider with shared utilities.

    All InsightHub spiders should inherit from this class.
    """

    # ── Class-level overrides ──────────────────────────────────────────────
    custom_settings: Dict[str, Any] = {}
    mock_data: List[Dict[str, Any]] = []  # override in dev-mode subclasses

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        # Dev mode flag
        self.dev_mode: bool = getattr(self, "dev_mode", False)
        if hasattr(self, "settings"):
            self.dev_mode = self.settings.getbool("CRAWL_DEV_MODE", False)

        # Output directory
        self.output_dir: str = "output"

        # Crawl tracking
        self.crawl_id: str = datetime.utcnow().strftime("%Y%m%d%H%M%S")
        self.start_time: datetime = datetime.utcnow()

        # Rate-limit bookkeeping
        self._request_timestamps: List[float] = []

    # ── Startup / teardown ─────────────────────────────────────────────────

    def start_requests(self):
        """Override in subclass; fallback to mock data in dev mode."""
        if self.dev_mode and self.mock_data:
            logger.info(
                "[%s] Dev mode — yielding mock data (%d records)",
                self.name,
                len(self.mock_data),
            )
            for record in self.mock_data:
                yield self._mock_to_item(record)
        else:
            yield from self._build_requests()

    def _build_requests(self):
        """Override in subclass for real API requests."""
        raise NotImplementedError

    def _mock_to_item(self, record: dict) -> scrapy.Item:
        """Override in subclass to convert a mock dict to a Scrapy Item."""
        raise NotImplementedError

    # ── Date parsing helpers ───────────────────────────────────────────────

    @staticmethod
    def parse_date_iso(date_str: Optional[str]) -> Optional[str]:
        """Parse a date string to ISO-8601 format (YYYY-MM-DD)."""
        if not date_str:
            return None
        for fmt in (
            "%Y-%m-%d",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%dT%H:%M:%SZ",
            "%Y/%m/%d",
            "%d/%m/%Y",
            "%m/%d/%Y",
            "%B %d, %Y",
            "%d %B %Y",
            "%Y%m%d",
        ):
            try:
                return datetime.strptime(date_str.strip(), fmt).strftime("%Y-%m-%d")
            except (ValueError, AttributeError):
                continue
        logger.debug("Could not parse date: %s", date_str)
        return date_str  # return as-is

    @staticmethod
    def parse_year(year_str: Optional[str]) -> Optional[int]:
        """Parse a year value to int."""
        if not year_str:
            return None
        try:
            return int(year_str.strip()[:4])
        except (ValueError, AttributeError):
            return None

    # ── Rate limiting ──────────────────────────────────────────────────────

    def rate_limit(self, min_interval: float = 1.0):
        """
        Ensure at least `min_interval` seconds since the last request.
        Call before yielding each request.
        """
        now = time.time()
        if self._request_timestamps:
            elapsed = now - self._request_timestamps[-1]
            if elapsed < min_interval:
                sleep_for = min_interval - elapsed
                logger.debug("Rate-limiting: sleep %.2fs", sleep_for)
                time.sleep(sleep_for)
        self._request_timestamps.append(time.time())

    # ── JSON output helper ─────────────────────────────────────────────────

    def write_output_json(self, records: list, name: str):
        """Write a list of dicts to a JSON-lines file for debugging / fallback."""
        import os

        os.makedirs(self.output_dir, exist_ok=True)
        path = f"{self.output_dir}/{name}_{self.crawl_id}.jsonl"
        with open(path, "w", encoding="utf-8") as fh:
            for rec in records:
                fh.write(json.dumps(rec, ensure_ascii=False, default=str) + "\n")
        logger.info("[Output] Wrote %d records to %s", len(records), path)
        return path

    # ── Error helper ───────────────────────────────────────────────────────

    def log_error(self, url: str, status: Optional[int] = None, msg: str = ""):
        logger.error(
            "[%s] Request failed: url=%s status=%s msg=%s", self.name, url, status, msg
        )


class PaginatedSpider(BaseSpider, ABC):
    """
    Spider with built-in pagination helper.

    Subclasses define:
      - parse_page(response) -> list[items]
      - has_next_page(response) -> bool / str | None
    """

    page_size: int = 100
    max_pages: int = 10

    def _build_requests(self):
        """Build first-page request — override to add initial URL."""
        raise NotImplementedError

    def parse(self, response):
        items = self.parse_page(response)
        yield from items

        if self.max_pages and self._page_count() >= self.max_pages:
            return

        next_url = self.has_next_page(response)
        if next_url:
            yield scrapy.Request(url=next_url, callback=self.parse)

    def parse_page(self, response) -> list:
        """Extract items from a single page — override in subclass."""
        raise NotImplementedError

    def has_next_page(self, response) -> Optional[str]:
        """Return next page URL or None — override in subclass."""
        return None

    def _page_count(self):
        return self.crawler.stats.get_value("response_received_count", 0)
