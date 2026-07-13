"""
US Federal Regulation / Policy Spider.

Fetches US federal regulations and policy documents from regulations.gov API (free, requires API key).

Usage:
    scrapy crawl policy_regulations -a keyword="artificial intelligence" -a max_records=50
    python run_spider.py policy_regulations -a keyword="data privacy"

Arguments:
    keyword     — search keywords (default: "technology")
    max_records — max documents per query (default: 50)
    agency      — filter by agency name (default: all)
    document_type — rule|proposed_rule|notice (default: all)
"""

import json
import logging
import os
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from urllib.parse import urlencode

import scrapy

from crawler.spiders.base import BaseSpider
from crawler.items import PolicyDocumentItem

logger = logging.getLogger(__name__)


class PolicyRegulationsSpider(BaseSpider):
    """
    Spider for US federal policy documents via regulations.gov API v4.
    Also provides fallback to scraping White House OSTP or Congress.gov.
    """

    name = "policy_regulations"
    allowed_domains = ["api.regulations.gov", "www.congress.gov"]
    custom_settings = {
        "DOWNLOAD_DELAY": 1.5,
        "CONCURRENT_REQUESTS": 2,
    }

    # ── Mock data for dev mode ─────────────────────────────────────────────
    mock_data: List[Dict[str, Any]] = [
        {
            "title": "Framework for AI Executive Order Implementation",
            "agency": "Executive Office of the President",
            "document_number": "EOP-2026-001",
            "type": "policy",
            "publish_date": "2026-01-15",
            "effective_date": "2026-04-01",
            "region": "US",
            "summary": "Implementation framework for Executive Order on Safe, Secure, and Trustworthy AI.",
            "url": "https://www.whitehouse.gov/ai-executive-order",
            "source": "whitehouse",
        },
        {
            "title": "关于促进人工智能产业发展若干政策措施",
            "agency": "国务院办公厅",
            "document_number": "国办发〔2026〕12号",
            "type": "policy",
            "publish_date": "2026-03-01",
            "effective_date": "2026-04-15",
            "region": "CN",
            "summary": "为加快推动人工智能产业高质量发展，培育壮大智能经济。",
            "url": "https://www.gov.cn/zhengce/content/20260301",
            "source": "gov.cn",
        },
    ]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.keyword: str = kwargs.get("keyword", "technology")
        self.max_records: int = int(kwargs.get("max_records", 50))
        self.agency: str = kwargs.get("agency", "")
        self.document_type: str = kwargs.get("document_type", "")

    def _build_requests(self):
        """Build regulations.gov API request."""
        api_key = os.getenv("REGULATIONS_GOV_API_KEY", "")

        if api_key:
            # Use regulations.gov API v4
            params = {
                "filter[searchTerm]": self.keyword,
                "page[size]": min(self.max_records, 25),
                "sort": "postedDate",
            }
            if self.agency:
                params["filter[agency]"] = self.agency
            if self.document_type:
                params["filter[documentType]"] = self.document_type

            url = f"https://api.regulations.gov/v4/documents?{urlencode(params)}"
            headers = {
                "Accept": "application/vnd.api+json",
                "X-Api-Key": api_key,
            }
            logger.info("[Regulations] Requesting: keyword=%s", self.keyword)
            self.rate_limit(min_interval=1.5)
            yield scrapy.Request(
                url=url,
                callback=self.parse_regulations,
                headers=headers,
                dont_filter=True,
            )
        else:
            # Fallback: scrape Congress.gov search
            logger.info("[Regulations] No API key, falling back to Congress.gov")
            params = {
                "q": self.keyword,
                "search": "View All",
            }
            url = f"https://www.congress.gov/search?{urlencode(params)}"
            self.rate_limit(min_interval=2.0)
            yield scrapy.Request(
                url=url,
                callback=self.parse_congress,
                dont_filter=True,
            )

    def parse_regulations(self, response):
        """Parse regulations.gov API v4 JSON response."""
        try:
            data = json.loads(response.text)
        except json.JSONDecodeError:
            logger.error("[Regulations] Failed to parse JSON: %s", response.text[:200])
            return

        documents = data.get("data", [])
        logger.info("[Regulations] Received %d documents", len(documents))

        for doc in documents:
            attrs = doc.get("attributes", {})
            try:
                item = PolicyDocumentItem(
                    title=attrs.get("title", ""),
                    agency=attrs.get("agencyId", ""),
                    document_number=attrs.get("documentId", ""),
                    type=attrs.get("documentType", ""),
                    publish_date=self.parse_date_iso(attrs.get("postedDate")),
                    effective_date=self.parse_date_iso(attrs.get("effectiveDate")),
                    region="US",
                    summary=attrs.get("abstract", ""),
                    url=f"https://www.regulations.gov/document/{attrs.get('documentId', '')}",
                    source="regulations.gov",
                )
                yield item
            except Exception as exc:
                logger.warning(
                    "[Regulations] Error yielding doc %s: %s",
                    attrs.get("title"),
                    exc,
                )

        # Pagination
        next_link = data.get("links", {}).get("next")
        if next_link and self._page_count() < self.max_records:
            self.rate_limit(min_interval=1.5)
            yield scrapy.Request(
                url=next_link,
                callback=self.parse_regulations,
                headers={
                    "Accept": "application/vnd.api+json",
                    "X-Api-Key": os.getenv("REGULATIONS_GOV_API_KEY", ""),
                },
                dont_filter=True,
            )

    def parse_congress(self, response):
        """Fallback: parse Congress.gov search results HTML."""
        items = response.css("div.search-result")
        logger.info("[Congress.gov] Found %d results", len(items))

        for item_el in items:
            title = item_el.css("h2 a::text").get("").strip()
            url = item_el.css("h2 a::attr(href)").get("")
            summary = item_el.css("p::text").get("").strip()
            source_text = item_el.css("div.result-meta::text").get("").strip()

            if not title:
                continue

            try:
                item = PolicyDocumentItem(
                    title=title,
                    agency="U.S. Congress",
                    document_number="",
                    type="legislation",
                    publish_date=None,
                    effective_date=None,
                    region="US",
                    summary=summary,
                    url=url
                    if url.startswith("http")
                    else f"https://www.congress.gov{url}",
                    source="congress.gov",
                )
                yield item
            except Exception as exc:
                logger.warning("[Congress.gov] Error: %s", exc)

    def _mock_to_item(self, record: dict) -> scrapy.Item:
        """Convert mock dict to PolicyDocumentItem."""
        return PolicyDocumentItem(
            title=record.get("title", ""),
            agency=record.get("agency", ""),
            document_number=record.get("document_number", ""),
            type=record.get("type", ""),
            publish_date=record.get("publish_date"),
            effective_date=record.get("effective_date"),
            region=record.get("region", ""),
            summary=record.get("summary", ""),
            url=record.get("url", ""),
            source=record.get("source", ""),
        )
