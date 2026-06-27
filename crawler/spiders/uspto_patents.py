"""
USPTO Patent Spider — fetches patent data from USPTO Open Data API.

USPTO API: https://developer.uspto.gov/api-catalog
Currently uses the PatentsView proxy pattern (v2/query) for keyword / CPC / assignee search.
"""

import json
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from urllib.parse import urlencode

import scrapy

from crawler.items import PatentItem
from crawler.spiders.base import PaginatedSpider

logger = logging.getLogger(__name__)


class UsptoPatentsSpider(PaginatedSpider):
    """
    Spider for USPTO patent data.

    Usage:
        scrapy crawl uspto_patents -a query="machine learning" -a max_pages=5
        python run_spider.py uspto_patents -a query="blockchain" -a max_pages=3

    Arguments:
        query            — keyword search string (default: "artificial intelligence")
        assignee         — filter by assignee name (optional)
        cpc_class        — filter by CPC classification (optional)
        start_date       — earliest filing date YYYY-MM-DD (optional)
        end_date         — latest filing date YYYY-MM-DD (optional)
        country          — country code filter (default: US)
        max_pages        — max pages to crawl (default: 5)
    """

    name = "uspto_patents"
    allowed_domains = ["developer.uspto.gov", "api.uspto.gov"]
    custom_settings = {
        "DOWNLOAD_DELAY": 1.0,
        "CONCURRENT_REQUESTS": 2,
        "ROBOTSTXT_OBEY": False,  # USPTO API does not have a robots.txt for the data endpoint
    }
    page_size = 50
    max_pages = 5

    # ── Mock data for dev mode ─────────────────────────────────────────────
    mock_data: List[Dict[str, Any]] = [
        {
            "patent_number": "US20240000001A1",
            "title": "Method and System for Training Large Language Models",
            "abstract": "A system for efficiently training transformer-based neural networks using distributed computing.",
            "assignee": "Google LLC",
            "inventors": ["John Smith", "Jane Doe"],
            "filing_date": "2023-06-15",
            "publication_date": "2024-01-02",
            "cpc_class": "G06N20/00",
            "country": "US",
        },
        {
            "patent_number": "US20240000002A1",
            "title": "Blockchain-Based Identity Verification System",
            "abstract": "A decentralized identity verification system using distributed ledger technology.",
            "assignee": "IBM Corporation",
            "inventors": ["Alice Wang", "Bob Chen"],
            "filing_date": "2023-08-20",
            "publication_date": "2024-02-15",
            "cpc_class": "H04L9/32",
            "country": "US",
        },
        {
            "patent_number": "US20240000003A1",
            "title": "量子计算优化方法及其系统",
            "abstract": "一种基于量子比特的优化计算方法...",
            "assignee": "华为技术有限公司",
            "inventors": ["张伟", "李娜"],
            "filing_date": "2023-04-10",
            "publication_date": "2024-03-01",
            "cpc_class": "G06N10/00",
            "country": "US",
        },
    ]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        self.query: str = kwargs.get("query", "artificial intelligence")
        self.assignee: Optional[str] = kwargs.get("assignee", None)
        self.cpc_class: Optional[str] = kwargs.get("cpc_class", None)
        self.start_date: Optional[str] = kwargs.get("start_date", None)
        self.end_date: Optional[str] = kwargs.get("end_date", None)
        self.country: str = kwargs.get("country", "US")
        if hasattr(self, "max_pages"):
            self.max_pages = int(kwargs.get("max_pages", self.max_pages))

        self._page = 0

    # ── Real requests ──────────────────────────────────────────────────────

    def _build_requests(self):
        """Build first-page USPTO PatentsView query."""
        url = self._build_query_url(offset=0)
        logger.info("[USPTO] Requesting: %s", url)
        self.rate_limit(min_interval=1.0)
        yield scrapy.Request(url=url, callback=self.parse)

    def _build_query_url(self, offset: int) -> str:
        """Build PatentsView-style query URL."""
        # Using PatentsView API (public, free)
        base = "https://api.uspto.gov/api/v2/query"

        query_parts = [f'"_text_any":"{self.query}"']
        if self.assignee:
            query_parts.append(f'"assignee_organization":"{self.assignee}"')
        if self.cpc_class:
            query_parts.append(f'"cpc_group":"{self.cpc_class}"')
        if self.start_date:
            query_parts.append(f'"patent_date>="{self.start_date}"')
        if self.end_date:
            query_parts.append(f'"patent_date<="{self.end_date}"')

        query_body = {
            "q": " AND ".join(query_parts),
            "fq": f'country:"{self.country}"',
            "fl": "patent_number,patent_title,patent_abstract,assignee_organization,inventor_name_list,filing_date,patent_date,cpc_class_list,country",
            "start": offset,
            "rows": self.page_size,
            "sort": "patent_date desc",
        }
        return f"{base}?{urlencode({'request': json.dumps(query_body)})}"

    # ── Parser ─────────────────────────────────────────────────────────────

    def parse_page(self, response) -> list:
        """Parse USPTO JSON response into PatentItems."""
        if response.status != 200:
            self.log_error(response.url, response.status)
            return []

        try:
            data = json.loads(response.text)
        except json.JSONDecodeError as exc:
            logger.error("[USPTO] JSON parse error: %s", exc)
            return []

        patents = data.get("results", []) or data.get("patents", [])
        items = []
        for pat in patents:
            item = PatentItem(
                patent_number=pat.get("patent_number", ""),
                title=pat.get("patent_title", ""),
                abstract=pat.get("patent_abstract", ""),
                assignee=pat.get("assignee_organization", ""),
                inventors=pat.get("inventor_name_list", []),
                filing_date=self.parse_date_iso(pat.get("filing_date")),
                publication_date=self.parse_date_iso(pat.get("patent_date")),
                cpc_class=pat.get("cpc_class_list", ""),
                country=pat.get("country", "US"),
                url=f"https://patents.google.com/patent/{pat.get('patent_number', '')}/",
                source="USPTO",
                crawl_id=self.crawl_id,
                crawled_at=datetime.utcnow().isoformat(),
            )
            items.append(item)

        logger.info("[USPTO] Parsed %d patents on page %d", len(items), self._page)
        return items

    def has_next_page(self, response) -> Optional[str]:
        """Check if there are more results."""
        self._page += 1
        if self._page >= self.max_pages:
            return None
        try:
            data = json.loads(response.text)
            total = data.get("total", 0) or data.get("numFound", 0)
            if self._page * self.page_size >= total:
                return None
        except json.JSONDecodeError:
            return None
        return self._build_query_url(offset=self._page * self.page_size)

    # ── Mock helper ────────────────────────────────────────────────────────

    def _mock_to_item(self, record: dict) -> PatentItem:
        return PatentItem(
            patent_number=record["patent_number"],
            title=record.get("title", ""),
            abstract=record.get("abstract", ""),
            assignee=record.get("assignee", ""),
            inventors=json.dumps(record.get("inventors", []), ensure_ascii=False),
            filing_date=record.get("filing_date", ""),
            publication_date=record.get("publication_date", ""),
            cpc_class=record.get("cpc_class", ""),
            country=record.get("country", "US"),
            url=f"https://patents.google.com/patent/{record['patent_number']}/",
            source="USPTO",
            crawl_id=self.crawl_id,
            crawled_at=datetime.utcnow().isoformat(),
        )
