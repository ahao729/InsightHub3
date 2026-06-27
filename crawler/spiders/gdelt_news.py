"""
GDELT News Spider — fetches global news via GDELT 2.0 API.

GDELT Doc API: https://api.gdeltproject.org/api/v2/doc/doc
Supports keyword/industry search with sentiment scores.
"""

import json
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from urllib.parse import urlencode

import scrapy

from crawler.items import MarketNewsItem
from crawler.spiders.base import BaseSpider

logger = logging.getLogger(__name__)

# ── Industry keyword mapping ──────────────────────────────────────────────────

INDUSTRY_KEYWORDS: Dict[str, List[str]] = {
    "startup": ["startup", "venture capital", "funding", "series A", "start-up"],
    "AI": [
        "artificial intelligence",
        "machine learning",
        "deep learning",
        "AI",
        "LLM",
        "GPT",
    ],
    "finance": ["finance", "banking", "stock market", "investment", "IPO", "bond"],
    "policy": ["policy", "regulation", "government", "law", "legislation", "tariff"],
    "education": ["education", "university", "college", "student", "online learning"],
    "web3": [
        "web3",
        "blockchain",
        "cryptocurrency",
        "NFT",
        "DeFi",
        "Bitcoin",
        "Ethereum",
    ],
    "enterprise": [
        "enterprise",
        "SaaS",
        "cloud computing",
        "B2B",
        "digital transformation",
    ],
}

# Default domain to search (combines several)
DEFAULT_KEYWORDS = " OR ".join(
    f"({kw})" for group in INDUSTRY_KEYWORDS.values() for kw in group
)


class GdeltNewsSpider(BaseSpider):
    """
    Spider for GDELT 2.0 Doc API.

    Usage (CLI):
        scrapy crawl gdelt_news -a query="AI startup" -a max_records=50
        python run_spider.py gdelt_news -a query="AI startup" -a max_records=50

    Arguments:
        query       — search keywords (default: all industry keywords)
        max_records — max articles per query (default: 50)
        start_date  — YYYY-MM-DD (default: 7 days ago)
        end_date    — YYYY-MM-DD (default: today)
        language    — en|zh|en,zh (default: en,zh)
    """

    name = "gdelt_news"
    allowed_domains = ["api.gdeltproject.org"]
    custom_settings = {
        "DOWNLOAD_DELAY": 1.5,
        "CONCURRENT_REQUESTS": 2,
    }

    # ── Mock data for dev mode ─────────────────────────────────────────────
    mock_data: List[Dict[str, Any]] = [
        {
            "title": "AI Startup Raises $500M in Series C Funding Round",
            "url": "https://example.com/news/ai-startup-funding-001",
            "source": "TechCrunch",
            "published": (datetime.utcnow() - timedelta(hours=2)).isoformat(),
            "content": "A leading AI startup has raised $500 million in Series C funding...",
            "summary": "AI startup secures major funding round led by top VCs.",
            "industry": "AI",
            "region": "US",
            "sentiment": 0.75,
        },
        {
            "title": "央行发布新货币政策 降低企业融资成本",
            "url": "https://example.com/news/china-policy-002",
            "source": "新华社",
            "published": (datetime.utcnow() - timedelta(hours=5)).isoformat(),
            "content": "中国人民银行今日宣布下调政策利率...",
            "summary": "央行发布新政策支持实体经济发展。",
            "industry": "finance",
            "region": "CN",
            "sentiment": 0.3,
        },
        {
            "title": "New Blockchain Interoperability Protocol Launches on Ethereum",
            "url": "https://example.com/news/web3-protocol-003",
            "source": "CoinDesk",
            "published": (datetime.utcnow() - timedelta(days=1)).isoformat(),
            "content": "A new cross-chain interoperability protocol has launched on Ethereum mainnet...",
            "summary": "Web3 protocol aims to connect multiple blockchains seamlessly.",
            "industry": "web3",
            "region": "Global",
            "sentiment": 0.6,
        },
    ]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        self.query: str = kwargs.get("query", DEFAULT_KEYWORDS)
        self.max_records: int = int(kwargs.get("max_records", 50))
        self.start_date: str = kwargs.get(
            "start_date", (datetime.utcnow() - timedelta(days=7)).strftime("%Y-%m-%d")
        )
        self.end_date: str = kwargs.get(
            "end_date", datetime.utcnow().strftime("%Y-%m-%d")
        )
        self.language: str = kwargs.get("language", "en,zh")

    # ── Real requests ──────────────────────────────────────────────────────

    def _build_requests(self):
        """Build GDELT Doc API request."""
        params = {
            "query": self.query,
            "mode": "artlist",  # article list
            "maxrecords": self.max_records,
            "format": "json",
            "startdate": self.start_date,
            "enddate": self.end_date,
            "lang": self.language,
            "sort": "datedesc",
        }
        url = f"https://api.gdeltproject.org/api/v2/doc/doc?{urlencode(params)}"
        logger.info("[GDELT] Requesting: %s", url)
        self.rate_limit(min_interval=2.0)
        yield scrapy.Request(url=url, callback=self.parse_articles)

    # ── Parser ─────────────────────────────────────────────────────────────

    def parse_articles(self, response):
        """Parse GDELT JSON response into MarketNewsItems."""
        if response.status != 200:
            self.log_error(response.url, response.status)
            return

        try:
            data = json.loads(response.text)
        except json.JSONDecodeError as exc:
            logger.error("[GDELT] JSON parse error: %s", exc)
            return

        articles = data.get("articles", []) or data.get("results", [])
        if not articles:
            logger.info("[GDELT] No articles found for query.")
            return

        for article in articles:
            item = MarketNewsItem(
                title=article.get("title") or article.get("name", ""),
                url=article.get("url") or article.get("link", ""),
                source=article.get("source") or article.get("domain", ""),
                published=self.parse_date_iso(
                    article.get("seendate") or article.get("date")
                ),
                content=article.get("content") or article.get("body", ""),
                summary=article.get("summary", ""),
                industry=self._infer_industry(article),
                region=article.get("country", ""),
                sentiment=article.get("sentiment", None),
                crawl_id=self.crawl_id,
                crawled_at=datetime.utcnow().isoformat(),
            )
            yield item

    # ── Helpers ────────────────────────────────────────────────────────────

    def _infer_industry(self, article: dict) -> str:
        """Use keywords in title/content to tag the industry."""
        text = (
            (article.get("title") or "")
            + " "
            + (article.get("content") or "")
            + " "
            + (article.get("summary") or "")
        ).lower()

        for industry, keywords in INDUSTRY_KEYWORDS.items():
            for kw in keywords:
                if kw.lower() in text:
                    return industry
        return "general"

    def _mock_to_item(self, record: dict) -> MarketNewsItem:
        return MarketNewsItem(
            title=record["title"],
            url=record["url"],
            source=record.get("source", ""),
            published=record.get("published", ""),
            content=record.get("content", ""),
            summary=record.get("summary", ""),
            industry=record.get("industry", "general"),
            region=record.get("region", ""),
            sentiment=record.get("sentiment"),
            crawl_id=self.crawl_id,
            crawled_at=datetime.utcnow().isoformat(),
        )
