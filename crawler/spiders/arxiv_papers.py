"""
arXiv Research Papers Spider — fetches academic papers via arXiv API.

API: https://export.arxiv.org/api/query
Supports keyword search, category filter, and pagination.
"""

import logging
import re
import xml.etree.ElementTree as ET
from datetime import datetime
from typing import Any, Dict, List, Optional
from urllib.parse import urlencode

import scrapy

from crawler.items import EducationDataItem
from crawler.spiders.base import BaseSpider

logger = logging.getLogger(__name__)

# ── Category mapping ──────────────────────────────────────────────────────────

ARXIV_CATEGORIES = {
    "cs.AI": "Artificial Intelligence",
    "cs.LG": "Machine Learning",
    "cs.CL": "Computation and Language",
    "cs.CV": "Computer Vision",
    "cs.CR": "Cryptography and Security",
    "econ.GN": "Economics (General)",
    "q-fin.GN": "Finance (General)",
    "stat.ML": "Machine Learning (Statistics)",
    "physics.soc-ph": "Physics and Society",
    "math.OC": "Optimization and Control",
}

DEFAULT_CATEGORIES = ["cs.AI", "cs.LG", "cs.CL", "econ.GN", "q-fin.GN"]

NS = {
    "atom": "http://www.w3.org/2005/Atom",
    "arxiv": "http://arxiv.org/schemas/atom",
}


class ArxivPapersSpider(BaseSpider):
    """
    Spider for arXiv API.

    Usage:
        scrapy crawl arxiv_papers -a query="machine learning" -a max_results=50
        python run_spider.py arxiv_papers -a query="blockchain" -a max_results=30

    Arguments:
        query        — search keywords (default: "artificial intelligence")
        categories   — comma-separated arXiv category IDs (default: cs.AI,cs.LG,cs.CL)
        max_results  — max results per query (default: 50)
        sort_by      — relevance | lastUpdatedDate | submittedDate (default: submittedDate)
    """

    name = "arxiv_papers"
    allowed_domains = ["export.arxiv.org"]
    custom_settings = {
        "DOWNLOAD_DELAY": 3.0,  # arXiv asks for 3 sec minimum
        "CONCURRENT_REQUESTS": 1,
        "ROBOTSTXT_OBEY": True,
    }

    # ── Mock data for dev mode ─────────────────────────────────────────────
    mock_data: List[Dict[str, Any]] = [
        {
            "institution_name": "arXiv",
            "country": "Global",
            "ranking": None,
            "subject": "cs.AI",
            "score": None,
            "year": 2024,
            "title": "Large Language Models as Zero-Shot Reasoners",
            "url": "https://arxiv.org/abs/2401.00001",
        },
        {
            "institution_name": "arXiv",
            "country": "Global",
            "ranking": None,
            "subject": "cs.LG",
            "score": None,
            "year": 2024,
            "title": "Efficient Training of Transformer Models on Distributed Systems",
            "url": "https://arxiv.org/abs/2401.00002",
        },
        {
            "institution_name": "arXiv",
            "country": "Global",
            "ranking": None,
            "subject": "q-fin.GN",
            "score": None,
            "year": 2024,
            "title": "Deep Learning for Financial Time Series Prediction",
            "url": "https://arxiv.org/abs/2401.00003",
        },
    ]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        self.query: str = kwargs.get("query", "artificial intelligence")
        categories_str: str = kwargs.get("categories", ",".join(DEFAULT_CATEGORIES))
        self.categories: List[str] = [
            c.strip() for c in categories_str.split(",") if c.strip()
        ]
        self.max_results: int = int(kwargs.get("max_results", 50))
        self.sort_by: str = kwargs.get("sort_by", "submittedDate")

        self._start = 0

    # ── Real requests ──────────────────────────────────────────────────────

    def _build_requests(self):
        """Build arXiv API query."""
        url = self._build_query_url(start=0)
        logger.info("[arXiv] Requesting: %s", url)
        self.rate_limit(min_interval=3.0)
        yield scrapy.Request(url=url, callback=self.parse_papers)

    def _build_query_url(self, start: int) -> str:
        """Build arXiv API query URL."""
        # Construct search query
        cat_query = " OR ".join(f"cat:{c}" for c in self.categories)
        search_query = f"all:{self.query} AND ({cat_query})"

        params = {
            "search_query": search_query,
            "start": start,
            "max_results": min(self.max_results, 100),
            "sortBy": self.sort_by,
            "sortOrder": "descending",
        }
        return f"https://export.arxiv.org/api/query?{urlencode(params)}"

    # ── Parser ─────────────────────────────────────────────────────────────

    def parse_papers(self, response):
        """Parse arXiv Atom XML response into EducationDataItems."""
        if response.status != 200:
            self.log_error(response.url, response.status)
            return

        try:
            root = ET.fromstring(response.text)
        except ET.ParseError as exc:
            logger.error("[arXiv] XML parse error: %s", exc)
            return

        entries = root.findall("atom:entry", NS)
        if not entries:
            logger.info("[arXiv] No entries found.")
            return

        for entry in entries:
            item = self._parse_entry(entry)
            if item:
                yield item

        # Pagination: check if more results
        total_str = root.findtext("atom:totalResults", "0", NS)
        try:
            total = int(total_str)
        except ValueError:
            total = 0

        self._start += len(entries)
        if self._start < total and self._start < self.max_results:
            next_url = self._build_query_url(start=self._start)
            self.rate_limit(min_interval=3.0)
            yield scrapy.Request(url=next_url, callback=self.parse_papers)

    def _parse_entry(self, entry) -> Optional[EducationDataItem]:
        """Parse a single Atom entry."""
        # Title
        title_raw = entry.findtext("atom:title", "", NS)
        title = re.sub(r"\s+", " ", title_raw).strip()

        # URL (arxiv absolute link)
        url = ""
        for link in entry.findall("atom:link", NS):
            href = link.get("href", "")
            if "abs/" in href:
                url = href
                break

        # arXiv ID
        arxiv_id = entry.findtext("atom:id", "", NS)
        if not url and arxiv_id:
            url = arxiv_id.replace("http://", "https://")

        # Published date
        published_raw = entry.findtext("atom:published", "", NS)
        published = self.parse_date_iso(published_raw)

        # Year
        year = None
        if published:
            try:
                year = int(published[:4])
            except (ValueError, IndexError):
                pass

        # Categories / subjects
        cats = []
        for cat_elem in entry.findall("atom:category", NS):
            term = cat_elem.get("term", "")
            if term:
                cats.append(term)
        subject = cats[0] if cats else "cs.AI"

        # Summary (abstract)
        summary_raw = entry.findtext("atom:summary", "", NS)
        summary = re.sub(r"\s+", " ", summary_raw).strip() if summary_raw else ""

        # Authors
        authors = []
        for author in entry.findall("atom:author", NS):
            name = author.findtext("atom:name", "", NS)
            if name:
                authors.append(name)

        return EducationDataItem(
            institution_name=f"arXiv ({subject})",
            country="Global",
            ranking=None,
            subject=subject,
            score=None,
            year=year,
            url=url or arxiv_id,
            source="arXiv",
            crawl_id=self.crawl_id,
            crawled_at=datetime.utcnow().isoformat(),
        )

    # ── Mock helper ────────────────────────────────────────────────────────

    def _mock_to_item(self, record: dict) -> EducationDataItem:
        return EducationDataItem(
            institution_name=record.get("institution_name", "arXiv"),
            country=record.get("country", "Global"),
            ranking=record.get("ranking"),
            subject=record.get("subject", "cs.AI"),
            score=record.get("score"),
            year=record.get("year", datetime.utcnow().year),
            url=record.get("url", ""),
            source="arXiv",
            crawl_id=self.crawl_id,
            crawled_at=datetime.utcnow().isoformat(),
        )
