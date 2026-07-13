"""
UNESCO Education Spider.

Fetches higher education institution data from UNESCO UIS API (free, no key required).

Usage:
    scrapy crawl unesco_education -a country=CN -a max_records=100
    python run_spider.py unesco_education -a country=US

Arguments:
    country     — ISO 3166-1 alpha-2 code (default: all)
    max_records — max records to fetch (default: 200)
"""

import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional
from urllib.parse import urlencode

import scrapy

from crawler.spiders.base import BaseSpider
from crawler.items import EducationDataItem

logger = logging.getLogger(__name__)

# ── Known university rankings / data sources ──────────────────────────────────

# We'll use a curated list of top universities from multiple countries
# because UNESCO's UIS API doesn't have a clean single endpoint for rankings.
# Alternative: scrape from public ranking datasets.

UNIVERSITY_SEED = [
    {
        "name": "MIT",
        "country": "US",
        "region": "Massachusetts",
        "subject": "Computer Science",
        "ranking": 1,
    },
    {
        "name": "Stanford University",
        "country": "US",
        "region": "California",
        "subject": "Artificial Intelligence",
        "ranking": 2,
    },
    {
        "name": "Tsinghua University",
        "country": "CN",
        "region": "Beijing",
        "subject": "Engineering",
        "ranking": 3,
    },
    {
        "name": "Peking University",
        "country": "CN",
        "region": "Beijing",
        "subject": "Economics",
        "ranking": 4,
    },
    {
        "name": "University of Oxford",
        "country": "GB",
        "region": "Oxford",
        "subject": "Humanities",
        "ranking": 5,
    },
    {
        "name": "ETH Zurich",
        "country": "CH",
        "region": "Zurich",
        "subject": "Science",
        "ranking": 6,
    },
    {
        "name": "National University of Singapore",
        "country": "SG",
        "region": "Singapore",
        "subject": "Technology",
        "ranking": 7,
    },
    {
        "name": "Zhejiang University",
        "country": "CN",
        "region": "Zhejiang",
        "subject": "Data Science",
        "ranking": 8,
    },
    {
        "name": "University of Cambridge",
        "country": "GB",
        "region": "Cambridge",
        "subject": "Mathematics",
        "ranking": 9,
    },
    {
        "name": "Caltech",
        "country": "US",
        "region": "California",
        "subject": "Physics",
        "ranking": 10,
    },
]


class UNESCOEducationSpider(BaseSpider):
    """
    Spider for education data. Uses QS/THE-style ranking data.
    In production, can be swapped to UNESCO UIS API or Times Higher Education.
    """

    name = "unesco_education"
    allowed_domains = []  # will be set dynamically
    custom_settings = {
        "DOWNLOAD_DELAY": 2.0,
        "CONCURRENT_REQUESTS": 2,
    }

    # ── Mock data for dev mode ─────────────────────────────────────────────
    mock_data: List[Dict[str, Any]] = [
        {
            "institution_name": "清华大学",
            "country": "中国",
            "ranking": 1,
            "subject": "计算机科学与技术",
            "score": 98.5,
            "year": 2026,
        },
        {
            "institution_name": "Stanford University",
            "country": "United States",
            "ranking": 2,
            "subject": "Artificial Intelligence",
            "score": 97.8,
            "year": 2026,
        },
    ]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.country: str = kwargs.get("country", "")
        self.max_records: int = int(kwargs.get("max_records", 200))
        self.year: int = int(kwargs.get("year", datetime.utcnow().year))

    def _build_requests(self):
        """
        Fetch education data from the Webometrics ranking API (free, public).
        This is a well-known open dataset of world universities.
        """
        # Option 1: Webometrics (public, no key, ~30k universities)
        url = "https://www.webometrics.info/en/top_10000"
        logger.info("[Education] Fetching Webometrics rankings")
        self.rate_limit(min_interval=2.0)
        yield scrapy.Request(
            url=url,
            callback=self.parse_webometrics,
            headers={"Accept": "text/html"},
            dont_filter=True,
        )

        # Option 2: Also try the QS API (if available)
        # yield scrapy.Request(
        #     url="https://www.topuniversities.com/qs-world-university-rankings",
        #     callback=self.parse_qs,
        #     dont_filter=True,
        # )

    def parse_webometrics(self, response):
        """Parse Webometrics university ranking table."""
        rows = response.css("table.tablesorter tbody tr")
        logger.info("[Education] Found %d university rows", len(rows))

        count = 0
        for row in rows:
            if count >= self.max_records:
                break

            cols = row.css("td::text").getall()
            if len(cols) < 5:
                continue

            try:
                rank_str = cols[0].strip().replace(",", "")
                ranking = int(rank_str) if rank_str.isdigit() else None
                name = cols[1].strip() if len(cols) > 1 else ""
                country = cols[2].strip() if len(cols) > 2 else ""
                score_str = cols[4].strip() if len(cols) > 4 else ""
                score = (
                    float(score_str) if score_str.replace(".", "").isdigit() else None
                )

                if self.country and self.country.upper() not in country.upper():
                    continue

                item = EducationDataItem(
                    institution_name=name,
                    country=country,
                    ranking=ranking,
                    subject="Higher Education",
                    score=score,
                    year=self.year,
                    url=response.url,
                    source="webometrics",
                )
                yield item
                count += 1
            except Exception as exc:
                logger.warning("[Education] Error parsing row: %s", exc)

        logger.info("[Education] Yielded %d records", count)

    def _mock_to_item(self, record: dict) -> scrapy.Item:
        """Convert mock dict to EducationDataItem."""
        return EducationDataItem(
            institution_name=record.get("institution_name", ""),
            country=record.get("country", ""),
            ranking=record.get("ranking"),
            subject=record.get("subject", ""),
            score=record.get("score"),
            year=record.get("year"),
            source="mock",
        )
