"""
CoinGecko Web3/Crypto Spider.

Fetches cryptocurrency market data from the CoinGecko free API (no key required).

Usage:
    scrapy crawl coingecko_web3 -a top_n=100
    python run_spider.py coingecko_web3 -a top_n=100

Arguments:
    top_n       — number of top coins to fetch (default: 100)
    vs_currency — quote currency (default: usd)
"""

import json
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from urllib.parse import urlencode

import scrapy

from crawler.spiders.base import BaseSpider
from crawler.items import Web3Item

logger = logging.getLogger(__name__)


class CoinGeckoWeb3Spider(BaseSpider):
    """
    Spider for CoinGecko public API — /coins/markets endpoint.
    Fetches top coins by market cap and yields Web3Item records.
    """

    name = "coingecko_web3"
    allowed_domains = ["api.coingecko.com"]
    custom_settings = {
        "DOWNLOAD_DELAY": 1.5,  # CoinGecko free tier: ~10-30 req/min
        "CONCURRENT_REQUESTS": 1,
    }

    # ── Mock data for dev mode ─────────────────────────────────────────────
    mock_data: List[Dict[str, Any]] = [
        {
            "chain": "Bitcoin",
            "token_symbol": "BTC",
            "token_name": "Bitcoin",
            "price": 95680.50,
            "volume": 42000000000.0,
            "market_cap": 1850000000000.0,
            "timestamp": datetime.utcnow().isoformat(),
            "source": "coingecko",
        },
        {
            "chain": "Ethereum",
            "token_symbol": "ETH",
            "token_name": "Ethereum",
            "price": 5420.30,
            "volume": 28000000000.0,
            "market_cap": 650000000000.0,
            "timestamp": datetime.utcnow().isoformat(),
            "source": "coingecko",
        },
        {
            "chain": "Solana",
            "token_symbol": "SOL",
            "token_name": "Solana",
            "price": 198.45,
            "volume": 5200000000.0,
            "market_cap": 95000000000.0,
            "timestamp": datetime.utcnow().isoformat(),
            "source": "coingecko",
        },
    ]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.top_n: int = int(kwargs.get("top_n", 100))
        self.vs_currency: str = kwargs.get("vs_currency", "usd")

    def _build_requests(self):
        """Build CoinGecko /coins/markets request."""
        params = {
            "vs_currency": self.vs_currency,
            "order": "market_cap_desc",
            "per_page": min(self.top_n, 250),  # CoinGecko max per page
            "page": 1,
            "sparkline": "false",
        }
        url = f"https://api.coingecko.com/api/v3/coins/markets?{urlencode(params)}"
        logger.info("[CoinGecko] Requesting top %d coins", self.top_n)
        self.rate_limit(min_interval=1.5)
        yield scrapy.Request(
            url=url,
            callback=self.parse_coins,
            headers={"Accept": "application/json"},
            dont_filter=True,
        )

        # If user wants more than 250, fetch page 2+
        if self.top_n > 250:
            for page in range(2, (self.top_n // 250) + 2):
                params["page"] = page
                url = f"https://api.coingecko.com/api/v3/coins/markets?{urlencode(params)}"
                self.rate_limit(min_interval=1.5)
                yield scrapy.Request(
                    url=url,
                    callback=self.parse_coins,
                    headers={"Accept": "application/json"},
                    dont_filter=True,
                )

    def parse_coins(self, response):
        """Parse JSON response from /coins/markets."""
        try:
            data = json.loads(response.text)
        except json.JSONDecodeError:
            logger.error("[CoinGecko] Failed to parse JSON: %s", response.text[:200])
            return

        if not isinstance(data, list):
            logger.warning("[CoinGecko] Unexpected response type: %s", type(data))
            return

        timestamp = datetime.utcnow().isoformat()
        logger.info("[CoinGecko] Received %d coins", len(data))

        for coin in data:
            try:
                item = Web3Item(
                    chain=coin.get("symbol", "").upper(),
                    token_symbol=coin.get("symbol", "").upper(),
                    token_name=coin.get("name", ""),
                    price=coin.get("current_price"),
                    volume=coin.get("total_volume"),
                    market_cap=coin.get("market_cap"),
                    timestamp=timestamp,
                    source="coingecko",
                )
                yield item
            except Exception as exc:
                logger.warning(
                    "[CoinGecko] Error yielding coin %s: %s", coin.get("name"), exc
                )

    def _mock_to_item(self, record: dict) -> scrapy.Item:
        """Convert mock dict to Web3Item."""
        return Web3Item(
            chain=record.get("chain", ""),
            token_symbol=record.get("token_symbol", ""),
            token_name=record.get("token_name", ""),
            price=record.get("price"),
            volume=record.get("volume"),
            market_cap=record.get("market_cap"),
            timestamp=record.get("timestamp"),
            source=record.get("source", "coingecko"),
        )
