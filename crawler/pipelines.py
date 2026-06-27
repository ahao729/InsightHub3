"""
InsightHub Crawler Pipelines — validation, dedup, database storage, and stats.
"""

import json
import logging
from datetime import datetime
from typing import Optional

import psycopg2
import psycopg2.extras
from scrapy import Spider
from scrapy.exceptions import DropItem

from crawler.items import (
    MarketNewsItem,
    CompanyProfileItem,
    FinancialIndicatorItem,
    PatentItem,
    PolicyDocumentItem,
    EducationDataItem,
    Web3Item,
    MarketNewsModel,
    CompanyProfileModel,
    FinancialIndicatorModel,
    PatentModel,
    PolicyDocumentModel,
    EducationDataModel,
    Web3Model,
)

logger = logging.getLogger(__name__)

# ── Helpers ───────────────────────────────────────────────────────────────────

ITEM_TYPE_MAP = {
    MarketNewsItem: ("market_news", MarketNewsModel),
    CompanyProfileItem: ("company_profiles", CompanyProfileModel),
    FinancialIndicatorItem: ("financial_indicators", FinancialIndicatorModel),
    PatentItem: ("patents", PatentModel),
    PolicyDocumentItem: ("policy_documents", PolicyDocumentModel),
    EducationDataItem: ("education_data", EducationDataModel),
    Web3Item: ("web3_data", Web3Model),
}


def _table_name(item) -> Optional[str]:
    for cls, (table, _) in ITEM_TYPE_MAP.items():
        if isinstance(item, cls):
            return table
    return None


def _pydantic_model(item):
    for cls, (_, model) in ITEM_TYPE_MAP.items():
        if isinstance(item, cls):
            return model
    return None


# ── Validation Pipeline ───────────────────────────────────────────────────────


class ValidationPipeline:
    """Validate required fields via Pydantic models."""

    def process_item(self, item, spider: Spider):
        model_cls = _pydantic_model(item)
        if model_cls is None:
            raise DropItem(f"Unknown item type: {type(item)}")

        # Build a plain dict from the item
        data = dict(item)
        # Remove None values so Pydantic defaults apply
        data = {k: v for k, v in data.items() if v is not None}

        try:
            model_cls(**data)
        except Exception as exc:
            logger.warning("Validation failed for %s: %s", item.get("url", "N/A"), exc)
            raise DropItem(f"Validation error: {exc}")

        return item


# ── Dedup Pipeline ────────────────────────────────────────────────────────────


class DedupPipeline:
    """Drop duplicate items based on URL (or patent_number / indicator key)."""

    def __init__(self):
        self._seen: set = set()

    def _dedup_key(self, item) -> Optional[str]:
        if isinstance(item, MarketNewsItem) and item.get("url"):
            return item["url"]
        if isinstance(item, PatentItem) and item.get("patent_number"):
            return item["patent_number"]
        if isinstance(item, FinancialIndicatorItem):
            key = f"{item.get('indicator_name')}|{item.get('country')}|{item.get('period')}"
            return key
        if isinstance(item, Web3Item):
            key = f"{item.get('chain')}|{item.get('token_symbol')}|{item.get('timestamp')}"
            return key
        if isinstance(item, PolicyDocumentItem) and item.get("document_number"):
            return item["document_number"]
        if isinstance(item, CompanyProfileItem) and item.get("registration_number"):
            return item["registration_number"]
        if isinstance(item, EducationDataItem):
            key = f"{item.get('institution_name')}|{item.get('subject')}|{item.get('year')}"
            return key
        return None

    def process_item(self, item, spider: Spider):
        key = self._dedup_key(item)
        if key is None:
            return item
        if key in self._seen:
            raise DropItem(f"Duplicate item: {key}")
        self._seen.add(key)
        return item


# ── Database Pipeline ─────────────────────────────────────────────────────────


class DatabasePipeline:
    """Store validated items in PostgreSQL."""

    def __init__(self, db_url: str, dev_mode: bool):
        self.db_url = db_url
        self.dev_mode = dev_mode
        self.conn: Optional[psycopg2.extensions.connection] = None

    @classmethod
    def from_crawler(cls, crawler):
        return cls(
            db_url=crawler.settings["DATABASE_URL"],
            dev_mode=crawler.settings.getbool("CRAWL_DEV_MODE"),
        )

    def open_spider(self, spider: Spider):
        if self.dev_mode:
            logger.info("[DB] Dev mode — skipping database connection.")
            return
        try:
            self.conn = psycopg2.connect(self.db_url)
            self.conn.autocommit = False
            logger.info("[DB] Connected to PostgreSQL.")
        except Exception as exc:
            logger.error("[DB] Connection failed: %s", exc)
            self.conn = None

    def close_spider(self, spider: Spider):
        if self.conn:
            self.conn.close()
            logger.info("[DB] Disconnected from PostgreSQL.")

    def process_item(self, item, spider: Spider):
        if self.dev_mode or self.conn is None:
            return item

        table = _table_name(item)
        if table is None:
            return item

        data = dict(item)
        data["crawled_at"] = data.get("crawled_at") or datetime.utcnow().isoformat()

        # Convert list fields to JSON strings
        for field in ("inventors",):
            if field in data and isinstance(data[field], (list, tuple)):
                data[field] = json.dumps(data[field], ensure_ascii=False)

        columns = list(data.keys())
        values = [data.get(c) for c in columns]
        placeholders = ["%s"] * len(columns)

        # ON CONFLICT DO NOTHING for idempotent inserts
        conflict_col = None
        if table == "market_news":
            conflict_col = "url"
        elif table == "patents":
            conflict_col = "patent_number"
        elif table == "financial_indicators":
            conflict_col = "indicator_name, country, period"
        elif table == "web3_data":
            conflict_col = "chain, token_symbol, timestamp"
        elif table == "policy_documents":
            conflict_col = "document_number"
        elif table == "company_profiles":
            conflict_col = "registration_number"
        elif table == "education_data":
            conflict_col = "institution_name, subject, year"

        sql = (
            f"INSERT INTO {table} ({', '.join(columns)}) "
            f"VALUES ({', '.join(placeholders)})"
        )
        if conflict_col:
            sql += f" ON CONFLICT ({conflict_col}) DO NOTHING"

        try:
            with self.conn.cursor() as cur:
                cur.execute(sql, values)
            self.conn.commit()
        except Exception as exc:
            self.conn.rollback()
            logger.error("[DB] Insert error for %s: %s", table, exc)

        return item


# ── Stats Pipeline ────────────────────────────────────────────────────────────


class StatsPipeline:
    """Track per-spider crawl statistics."""

    def open_spider(self, spider: Spider):
        spider.crawler.stats.set_value("crawled_count", 0)

    def process_item(self, item, spider: Spider):
        spider.crawler.stats.inc_value("crawled_count")
        spider.crawler.stats.inc_value(f"crawled_{type(item).__name__}")
        return item
