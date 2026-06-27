"""
Public Company Information Spider — template for enterprise data.

Note:
Enterprise/company data requires paid APIs (e.g. 企查查, 天眼查, Crunchbase).
This spider provides:
  - A clear integration framework showing where to plug in real API calls
  - Mock data generation for development and testing
  - The actual API integration points are marked with INTEGRATION POINT comments

To use with a real API:
  1. Set COMPANY_API_KEY and COMPANY_API_BASE in your .env file
  2. Update the _call_api() method with your API's request/response format
  3. Update the _parse_response() method for the response schema
"""

import json
import logging
import os
from datetime import datetime
from typing import Any, Dict, List, Optional

import scrapy
from dotenv import load_dotenv

from crawler.items import CompanyProfileItem
from crawler.spiders.base import BaseSpider

load_dotenv()

logger = logging.getLogger(__name__)


class PublicCompanySpider(BaseSpider):
    """
    Spider for company / enterprise information.

    Usage (dev/mock mode):
        scrapy crawl public_company -a query=TechCorp
        python run_spider.py public_company -a query="AI startup" -a max_records=10

    Arguments:
        query       — company name or keyword (default: "Technology")
        max_records — max records per API call (default: 20)
        country     — filter by country (default: CN,US)
        industry    — filter by industry (optional)

    Environment:
        COMPANY_API_KEY  — API key for the company data provider
        COMPANY_API_BASE — API base URL
        CRAWL_DEV_MODE   — set to "true" to use mock data
    """

    name = "public_company"
    allowed_domains = []
    custom_settings = {
        "DOWNLOAD_DELAY": 3.0,
        "CONCURRENT_REQUESTS": 1,
        "ROBOTSTXT_OBEY": True,
    }

    # ── Mock data for development ──────────────────────────────────────────
    mock_data: List[Dict[str, Any]] = [
        {
            "name": "北京智源人工智能研究院",
            "registration_number": "91110108MA01ABC123",
            "legal_representative": "张明",
            "registered_capital": "CNY 1000万",
            "status": "active",
            "industry": "AI",
            "region": "CN",
            "established_date": "2020-03-15",
            "address": "北京市海淀区中关村大街1号",
        },
        {
            "name": "上海数据科技有限公司",
            "registration_number": "91310115MA01DEF456",
            "legal_representative": "李华",
            "registered_capital": "CNY 5000万",
            "status": "active",
            "industry": "technology",
            "region": "CN",
            "established_date": "2019-07-22",
            "address": "上海市浦东新区张江高科技园区",
        },
        {
            "name": "TechNova Inc.",
            "registration_number": "US-TECH-2024-001",
            "legal_representative": "John Smith",
            "registered_capital": "USD 500万",
            "status": "active",
            "industry": "startup",
            "region": "US",
            "established_date": "2021-11-01",
            "address": "1 Market Street, San Francisco, CA",
        },
        {
            "name": "Quantum Financial Technologies",
            "registration_number": "SG-QFT-2023-002",
            "legal_representative": "Tan Wei Ming",
            "registered_capital": "SGD 2000万",
            "status": "active",
            "industry": "finance",
            "region": "SG",
            "established_date": "2023-01-10",
            "address": "10 Marina Boulevard, Singapore",
        },
    ]

    # ── INTEGRATION POINT: API Configuration ───────────────────────────────
    API_KEY = os.getenv("COMPANY_API_KEY", "")
    API_BASE = os.getenv("COMPANY_API_BASE", "https://api.example.com/company")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        self.query: str = kwargs.get("query", "Technology")
        self.max_records: int = int(kwargs.get("max_records", 20))
        self.country: str = kwargs.get("country", "CN,US")
        self.industry: Optional[str] = kwargs.get("industry", None)

    # ── Real API integration ───────────────────────────────────────────────

    def _build_requests(self):
        """
        Build API requests for company data.

        INTEGRATION POINT:
        Replace the URL construction and payload below with your
        enterprise data provider's API format (e.g. 企查查 / 天眼查 / Crunchbase).

        Common API patterns:
          - 企查查: https://open.qichacha.com/API/Search/SearchCompany
          - 天眼查: https://open.tianyancha.com/open/company/search
          - Crunchbase: https://api.crunchbase.com/api/v4/entities/organizations
        """
        if not self.API_KEY:
            logger.warning(
                "[PublicCompany] No COMPANY_API_KEY set. "
                "Set it in .env or use dev mode (CRAWL_DEV_MODE=true)."
            )
            # Fall back to mock data via start_requests() logic
            return

        # ── INTEGRATION POINT: build real request ──────────────────────────
        url = f"{self.API_BASE}/search"
        headers = {
            "Authorization": f"Bearer {self.API_KEY}",
            "Content-Type": "application/json",
        }
        payload = {
            "keyword": self.query,
            "pageSize": min(self.max_records, 100),
            "page": 1,
            "country": self.country,
        }
        if self.industry:
            payload["industry"] = self.industry

        self.rate_limit(min_interval=3.0)
        yield scrapy.Request(
            url=url,
            method="POST",
            body=json.dumps(payload),
            headers=headers,
            callback=self.parse_companies,
        )

    def parse_companies(self, response):
        """
        Parse company API response.

        INTEGRATION POINT:
        Replace the parsing logic below with your provider's response schema.
        """
        if response.status != 200:
            self.log_error(response.url, response.status)
            return

        try:
            data = json.loads(response.text)
        except json.JSONDecodeError:
            logger.error("[PublicCompany] Invalid JSON response")
            return

        # ── INTEGRATION POINT: adapt to actual response schema ─────────────
        records = (
            data.get("data", []) or data.get("results", []) or data.get("items", [])
        )
        for rec in records:
            item = self._record_to_item(rec)
            yield item

    def _record_to_item(self, rec: dict) -> CompanyProfileItem:
        """Convert a raw API record to a CompanyProfileItem."""
        return CompanyProfileItem(
            name=rec.get("name")
            or rec.get("companyName")
            or rec.get("CompanyName", ""),
            registration_number=rec.get("registration_number")
            or rec.get("regNumber")
            or rec.get("RegistrationNumber", ""),
            legal_representative=rec.get("legal_representative")
            or rec.get("legalPerson")
            or rec.get("LegalRepresentative", ""),
            registered_capital=rec.get("registered_capital")
            or rec.get("regCapital", ""),
            status=rec.get("status") or rec.get("companyStatus", "active"),
            industry=rec.get("industry") or rec.get("industryCategory", ""),
            region=rec.get("region") or rec.get("country", ""),
            established_date=self.parse_date_iso(
                rec.get("established_date")
                or rec.get("establishedDate")
                or rec.get("EstablishedDate")
            ),
            address=rec.get("address") or rec.get("regAddress", ""),
            url=rec.get("url", ""),
            source=rec.get("source", "company_api"),
            crawl_id=self.crawl_id,
            crawled_at=datetime.utcnow().isoformat(),
        )

    # ── Mock helper ────────────────────────────────────────────────────────

    def _mock_to_item(self, record: dict) -> CompanyProfileItem:
        return CompanyProfileItem(
            name=record["name"],
            registration_number=record.get("registration_number", ""),
            legal_representative=record.get("legal_representative", ""),
            registered_capital=record.get("registered_capital", ""),
            status=record.get("status", "active"),
            industry=record.get("industry", ""),
            region=record.get("region", ""),
            established_date=record.get("established_date", ""),
            address=record.get("address", ""),
            url="",
            source="mock",
            crawl_id=self.crawl_id,
            crawled_at=datetime.utcnow().isoformat(),
        )
