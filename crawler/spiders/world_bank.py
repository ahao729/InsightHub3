"""
World Bank Data Spider — fetches financial and economic indicators.

API: https://api.worldbank.org/v2/
Supported: GDP, inflation, unemployment, trade balance, etc.
"""

import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional
from urllib.parse import urlencode

import scrapy

from crawler.items import FinancialIndicatorItem
from crawler.spiders.base import BaseSpider

logger = logging.getLogger(__name__)

# ── Indicator configuration ───────────────────────────────────────────────────

INDICATOR_MAP: Dict[str, dict] = {
    "GDP": {"id": "NY.GDP.MKTP.CD", "name": "GDP (current US$)", "unit": "USD"},
    "GDP_per_capita": {
        "id": "NY.GDP.PCAP.CD",
        "name": "GDP per capita (current US$)",
        "unit": "USD",
    },
    "GDP_growth": {
        "id": "NY.GDP.MKTP.KD.ZG",
        "name": "GDP growth (annual %)",
        "unit": "%",
    },
    "inflation": {
        "id": "FP.CPI.TOTL.ZG",
        "name": "Inflation (CPI annual %)",
        "unit": "%",
    },
    "unemployment": {
        "id": "SL.UEM.TOTL.ZS",
        "name": "Unemployment (% of labor force)",
        "unit": "%",
    },
    "trade_balance": {
        "id": "NE.RSB.GNFS.CD",
        "name": "Trade balance (current US$)",
        "unit": "USD",
    },
    "foreign_direct_investment": {
        "id": "BX.KLT.DINV.WD.GD.ZS",
        "name": "FDI net inflows (% of GDP)",
        "unit": "%",
    },
    "government_debt": {
        "id": "GC.DOD.TOTL.GD.ZS",
        "name": "Government debt (% of GDP)",
        "unit": "%",
    },
    "interest_rate": {
        "id": "FR.INR.RINR",
        "name": "Real interest rate (%)",
        "unit": "%",
    },
    "population": {"id": "SP.POP.TOTL", "name": "Population", "unit": "persons"},
}

DEFAULT_COUNTRIES = [
    "US",
    "CN",
    "JP",
    "DE",
    "GB",
    "FR",
    "IN",
    "BR",
    "CA",
    "KR",
    "RU",
    "AU",
    "SG",
    "HK",
    "CH",
    "NL",
    "SE",
    "NO",
    "DK",
    "FI",
]

DEFAULT_INDICATORS = ["GDP", "GDP_growth", "inflation", "unemployment"]


class WorldBankSpider(BaseSpider):
    """
    Spider for World Bank API v2.

    Usage:
        scrapy crawl world_bank -a indicators=GDP,inflation -a countries=US,CN
        python run_spider.py world_bank -a indicators=GDP,inflation,unemployment

    Arguments:
        indicators  — comma-separated indicator keys from INDICATOR_MAP (default: GDP,GDP_growth,inflation,unemployment)
        countries   — comma-separated ISO country codes (default: US,CN,JP,DE,GB)
        start_year  — YYYY (default: 2020)
        end_year    — YYYY (default: current year)
    """

    name = "world_bank"
    allowed_domains = ["api.worldbank.org"]
    custom_settings = {
        "DOWNLOAD_DELAY": 0.5,
        "CONCURRENT_REQUESTS": 4,
        "ROBOTSTXT_OBEY": False,
    }

    # ── Mock data for dev mode ─────────────────────────────────────────────
    mock_data: List[Dict[str, Any]] = [
        {
            "indicator_name": "GDP (current US$)",
            "country": "US",
            "value": 27360000000000.0,
            "unit": "USD",
            "period": "2024",
        },
        {
            "indicator_name": "GDP (current US$)",
            "country": "CN",
            "value": 17700000000000.0,
            "unit": "USD",
            "period": "2024",
        },
        {
            "indicator_name": "GDP growth (annual %)",
            "country": "US",
            "value": 2.5,
            "unit": "%",
            "period": "2024",
        },
        {
            "indicator_name": "GDP growth (annual %)",
            "country": "CN",
            "value": 5.2,
            "unit": "%",
            "period": "2024",
        },
        {
            "indicator_name": "Inflation (CPI annual %)",
            "country": "US",
            "value": 3.4,
            "unit": "%",
            "period": "2024",
        },
        {
            "indicator_name": "Inflation (CPI annual %)",
            "country": "CN",
            "value": 0.2,
            "unit": "%",
            "period": "2024",
        },
        {
            "indicator_name": "Unemployment (% of labor force)",
            "country": "US",
            "value": 3.7,
            "unit": "%",
            "period": "2024",
        },
        {
            "indicator_name": "Unemployment (% of labor force)",
            "country": "JP",
            "value": 2.6,
            "unit": "%",
            "period": "2024",
        },
    ]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        indicators_str: str = kwargs.get("indicators", ",".join(DEFAULT_INDICATORS))
        countries_str: str = kwargs.get("countries", ",".join(DEFAULT_COUNTRIES[:6]))

        self.indicator_keys: List[str] = [
            k.strip() for k in indicators_str.split(",") if k.strip()
        ]
        self.countries: List[str] = [
            c.strip() for c in countries_str.split(",") if c.strip()
        ]
        self.start_year: int = int(kwargs.get("start_year", 2020))
        self.end_year: int = int(kwargs.get("end_year", datetime.utcnow().year))

        self._page = 0

    # ── Real requests ──────────────────────────────────────────────────────

    def _build_requests(self):
        """Build one request per (indicator, country) pair."""
        for indicator_key in self.indicator_keys:
            cfg = INDICATOR_MAP.get(indicator_key)
            if cfg is None:
                logger.warning("[WorldBank] Unknown indicator: %s", indicator_key)
                continue
            for country in self.countries:
                url = self._build_api_url(cfg["id"], country)
                logger.debug("[WorldBank] Requesting: %s", url)
                self.rate_limit(min_interval=0.5)
                yield scrapy.Request(
                    url=url,
                    callback=self.parse_indicator,
                    cb_kwargs={
                        "indicator_name": cfg["name"],
                        "unit": cfg["unit"],
                        "country": country,
                        "indicator_key": indicator_key,
                    },
                )

    def _build_api_url(self, indicator_id: str, country: str) -> str:
        """Build World Bank API v2 URL."""
        params = {
            "format": "json",
            "date": f"{self.start_year}:{self.end_year}",
            "per_page": 100,
        }
        return (
            f"https://api.worldbank.org/v2/country/{country}"
            f"/indicator/{indicator_id}?{urlencode(params)}"
        )

    # ── Parser ─────────────────────────────────────────────────────────────

    def parse_indicator(
        self, response, indicator_name: str, unit: str, country: str, indicator_key: str
    ):
        """Parse World Bank JSON response into FinancialIndicatorItems."""
        if response.status != 200:
            self.log_error(response.url, response.status)
            return

        try:
            data = json.loads(response.text)
        except json.JSONDecodeError as exc:
            logger.error("[WorldBank] JSON parse error: %s", exc)
            return

        # World Bank API returns [pagination_info, [data_entries]]
        if not isinstance(data, list) or len(data) < 2:
            logger.warning(
                "[WorldBank] Unexpected response format for %s/%s",
                country,
                indicator_key,
            )
            return

        entries = data[1]
        if not entries:
            logger.info("[WorldBank] No data for %s/%s", country, indicator_key)
            return

        for entry in entries:
            if entry is None:
                continue
            value = entry.get("value")
            if value is None:
                continue
            try:
                value = float(value)
            except (TypeError, ValueError):
                continue

            year = entry.get("date", "")
            item = FinancialIndicatorItem(
                indicator_name=indicator_name,
                country=country,
                value=value,
                unit=unit,
                period=year,
                source="World Bank",
                crawl_id=self.crawl_id,
                crawled_at=datetime.utcnow().isoformat(),
            )
            yield item

    # ── Mock helper ────────────────────────────────────────────────────────

    def _mock_to_item(self, record: dict) -> FinancialIndicatorItem:
        return FinancialIndicatorItem(
            indicator_name=record["indicator_name"],
            country=record["country"],
            value=record["value"],
            unit=record.get("unit", ""),
            period=record["period"],
            source="World Bank",
            crawl_id=self.crawl_id,
            crawled_at=datetime.utcnow().isoformat(),
        )
