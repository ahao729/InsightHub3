"""
OpenCorporates Enterprise Risk Spider.

Fetches company profiles from OpenCorporates API (free tier, limited but functional).

Usage:
    scrapy crawl opencorporates_risk -a query="technology" -a jurisdiction=us -a max_pages=5
    python run_spider.py opencorporates_risk -a query="AI startup" -a max_pages=3

Arguments:
    query       — search keywords (default: "")
    jurisdiction — country code filter e.g. us, gb, cn (default: all)
    max_pages   — max pages to crawl (default: 5)
    per_page    — results per page (default: 50)
"""

import json
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from urllib.parse import urlencode

import scrapy

from crawler.spiders.base import BaseSpider
from crawler.items import CompanyProfileItem

logger = logging.getLogger(__name__)


class OpenCorporatesRiskSpider(BaseSpider):
    """
    Spider for OpenCorporates API — company search endpoint.
    Fetches company profiles with basic risk indicators.
    """

    name = "opencorporates_risk"
    allowed_domains = ["api.opencorporates.com"]
    custom_settings = {
        "DOWNLOAD_DELAY": 1.0,  # OpenCorporates rate limit
        "CONCURRENT_REQUESTS": 2,
    }

    # ── Mock data for dev mode ─────────────────────────────────────────────
    mock_data: List[Dict[str, Any]] = [
        {
            "name": "Example Tech Inc.",
            "registration_number": "DE-12345678",
            "legal_representative": "John Smith",
            "registered_capital": "$50,000,000",
            "status": "Active",
            "industry": "Technology",
            "region": "US-DE",
            "established_date": "2015-03-15",
            "address": "123 Main St, San Francisco, CA",
        },
        {
            "name": "示例科技有限公司",
            "registration_number": "91110108MA01XXXXXX",
            "legal_representative": "张三",
            "registered_capital": "1000万元人民币",
            "status": "Active",
            "industry": "人工智能",
            "region": "北京",
            "established_date": "2018-06-01",
            "address": "北京市海淀区中关村大街1号",
        },
    ]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.query: str = kwargs.get("query", "")
        self.jurisdiction: str = kwargs.get("jurisdiction", "")
        self.max_pages: int = int(kwargs.get("max_pages", 5))
        self.per_page: int = int(kwargs.get("per_page", 50))
        self._current_page: int = 1

    def _build_requests(self):
        """Build first page request."""
        yield from self._make_page_request(1)

    def _make_page_request(self, page: int):
        """Build OpenCorporates search request for a given page."""
        params = {
            "q": self.query,
            "per_page": self.per_page,
            "page": page,
        }
        if self.jurisdiction:
            params["jurisdiction_code"] = self.jurisdiction

        url = (
            f"https://api.opencorporates.com/v0.4/companies/search?{urlencode(params)}"
        )
        logger.info(
            "[OpenCorporates] Page %d/%d query=%s", page, self.max_pages, self.query
        )
        self.rate_limit(min_interval=1.0)
        yield scrapy.Request(
            url=url,
            callback=self.parse,
            headers={"Accept": "application/json"},
            meta={"page": page},
            dont_filter=True,
        )

    def parse(self, response):
        """Parse OpenCorporates search response."""
        try:
            data = json.loads(response.text)
        except json.JSONDecodeError:
            logger.error(
                "[OpenCorporates] Failed to parse JSON: %s", response.text[:200]
            )
            return

        results = data.get("results", {}).get("companies", [])
        page = response.meta.get("page", 1)
        logger.info("[OpenCorporates] Page %d: %d companies", page, len(results))

        for company_data in results:
            company = company_data.get("company", {})
            try:
                item = CompanyProfileItem(
                    name=company.get("name", ""),
                    registration_number=company.get("company_number", ""),
                    legal_representative=company.get("natural_person_key", ""),
                    registered_capital=company.get("authorized_shares_str", ""),
                    status=company.get("current_status", ""),
                    industry=company.get("industry_type", ""),
                    region=company.get("jurisdiction_code", ""),
                    established_date=self.parse_date_iso(
                        company.get("incorporation_date", "")
                    ),
                    address=company.get("registered_address_in_full", ""),
                    url=company.get("opencorporates_url", ""),
                    source="opencorporates",
                )
                yield item
            except Exception as exc:
                logger.warning(
                    "[OpenCorporates] Error yielding company %s: %s",
                    company.get("name"),
                    exc,
                )

        # Pagination
        if page < self.max_pages:
            # Check if there are more results
            total_results = data.get("results", {}).get("total_count", 0)
            if page * self.per_page < total_results:
                yield from self._make_page_request(page + 1)

    def _mock_to_item(self, record: dict) -> scrapy.Item:
        """Convert mock dict to CompanyProfileItem."""
        return CompanyProfileItem(
            name=record.get("name", ""),
            registration_number=record.get("registration_number", ""),
            legal_representative=record.get("legal_representative", ""),
            registered_capital=record.get("registered_capital", ""),
            status=record.get("status", ""),
            industry=record.get("industry", ""),
            region=record.get("region", ""),
            established_date=record.get("established_date"),
            address=record.get("address", ""),
            source="opencorporates",
        )
