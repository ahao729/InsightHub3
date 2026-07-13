"""
InsightHub Scrapy Items — structured data containers for all 8 data packages.
"""

import scrapy
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


# ── Scrapy Items ──────────────────────────────────────────────────────────────


class MarketNewsItem(scrapy.Item):
    """News / media monitoring item."""

    title = scrapy.Field()
    url = scrapy.Field()
    source = scrapy.Field()
    published = scrapy.Field()  # ISO-8601 datetime string
    content = scrapy.Field()
    summary = scrapy.Field()
    industry = scrapy.Field()  # e.g. startup, AI, finance, policy, education, web3
    region = scrapy.Field()  # country / region code
    sentiment = scrapy.Field()  # float -1.0 … 1.0
    crawl_id = scrapy.Field()
    crawled_at = scrapy.Field()


class CompanyProfileItem(scrapy.Item):
    """Enterprise / company information item."""

    name = scrapy.Field()
    registration_number = scrapy.Field()
    legal_representative = scrapy.Field()
    registered_capital = scrapy.Field()
    status = scrapy.Field()  # active, dissolved, etc.
    industry = scrapy.Field()
    region = scrapy.Field()
    established_date = scrapy.Field()
    address = scrapy.Field()
    url = scrapy.Field()
    source = scrapy.Field()
    crawl_id = scrapy.Field()
    crawled_at = scrapy.Field()


class FinancialIndicatorItem(scrapy.Item):
    """Macro-economic indicator item."""

    indicator_name = scrapy.Field()
    country = scrapy.Field()
    value = scrapy.Field()
    unit = scrapy.Field()
    period = scrapy.Field()  # "2024-Q1", "2024", etc.
    source = scrapy.Field()
    crawl_id = scrapy.Field()
    crawled_at = scrapy.Field()


class PatentItem(scrapy.Item):
    """Patent document item."""

    patent_number = scrapy.Field()
    title = scrapy.Field()
    abstract = scrapy.Field()
    assignee = scrapy.Field()
    inventors = scrapy.Field()  # list of names
    filing_date = scrapy.Field()
    publication_date = scrapy.Field()
    cpc_class = scrapy.Field()
    country = scrapy.Field()
    url = scrapy.Field()
    source = scrapy.Field()
    crawl_id = scrapy.Field()
    crawled_at = scrapy.Field()


class PolicyDocumentItem(scrapy.Item):
    """Government policy / regulation item."""

    title = scrapy.Field()
    agency = scrapy.Field()
    document_number = scrapy.Field()
    type = scrapy.Field()  # regulation, law, policy, notice
    publish_date = scrapy.Field()
    effective_date = scrapy.Field()
    region = scrapy.Field()
    summary = scrapy.Field()
    url = scrapy.Field()
    source = scrapy.Field()
    crawl_id = scrapy.Field()
    crawled_at = scrapy.Field()


class EducationDataItem(scrapy.Item):
    """University / education ranking item."""

    institution_name = scrapy.Field()
    country = scrapy.Field()
    ranking = scrapy.Field()
    subject = scrapy.Field()
    score = scrapy.Field()
    year = scrapy.Field()
    url = scrapy.Field()
    source = scrapy.Field()
    crawl_id = scrapy.Field()
    crawled_at = scrapy.Field()


class Web3Item(scrapy.Item):
    """Web3 / crypto market data item."""

    chain = scrapy.Field()
    token_symbol = scrapy.Field()
    token_name = scrapy.Field()
    price = scrapy.Field()
    volume = scrapy.Field()
    market_cap = scrapy.Field()
    timestamp = scrapy.Field()
    source = scrapy.Field()
    crawl_id = scrapy.Field()
    crawled_at = scrapy.Field()


# ── Pydantic Models (for validation) ──────────────────────────────────────────


class MarketNewsModel(BaseModel):
    title: str = Field(..., min_length=1, max_length=1024)
    url: str = Field(..., max_length=2048)
    source: str = Field(..., max_length=256)
    published: Optional[str] = None
    content: Optional[str] = None
    summary: Optional[str] = None
    industry: Optional[str] = None
    region: Optional[str] = None
    sentiment: Optional[float] = Field(None, ge=-1.0, le=1.0)
    crawl_id: Optional[str] = None
    crawled_at: Optional[str] = None


class CompanyProfileModel(BaseModel):
    name: str = Field(..., min_length=1, max_length=512)
    registration_number: Optional[str] = None
    legal_representative: Optional[str] = None
    registered_capital: Optional[str] = None
    status: Optional[str] = None
    industry: Optional[str] = None
    region: Optional[str] = None
    established_date: Optional[str] = None
    address: Optional[str] = None
    url: Optional[str] = None
    source: Optional[str] = None
    crawl_id: Optional[str] = None
    crawled_at: Optional[str] = None


class FinancialIndicatorModel(BaseModel):
    indicator_name: str = Field(..., min_length=1, max_length=256)
    country: str = Field(..., max_length=128)
    value: float = ...
    unit: Optional[str] = None
    period: str = Field(..., max_length=64)
    source: Optional[str] = None
    crawl_id: Optional[str] = None
    crawled_at: Optional[str] = None


class PatentModel(BaseModel):
    patent_number: str = Field(..., min_length=1, max_length=64)
    title: Optional[str] = None
    abstract: Optional[str] = None
    assignee: Optional[str] = None
    inventors: Optional[str] = None  # stored as JSON array string
    filing_date: Optional[str] = None
    publication_date: Optional[str] = None
    cpc_class: Optional[str] = None
    country: Optional[str] = None
    url: Optional[str] = None
    source: Optional[str] = None
    crawl_id: Optional[str] = None
    crawled_at: Optional[str] = None


class PolicyDocumentModel(BaseModel):
    title: str = Field(..., min_length=1, max_length=1024)
    agency: Optional[str] = None
    document_number: Optional[str] = None
    type: Optional[str] = None
    publish_date: Optional[str] = None
    effective_date: Optional[str] = None
    region: Optional[str] = None
    summary: Optional[str] = None
    url: Optional[str] = None
    source: Optional[str] = None
    crawl_id: Optional[str] = None
    crawled_at: Optional[str] = None


class EducationDataModel(BaseModel):
    institution_name: str = Field(..., min_length=1, max_length=512)
    country: Optional[str] = None
    ranking: Optional[int] = Field(None, ge=1)
    subject: Optional[str] = None
    score: Optional[float] = None
    year: Optional[int] = None
    url: Optional[str] = None
    source: Optional[str] = None
    crawl_id: Optional[str] = None
    crawled_at: Optional[str] = None


class Web3Model(BaseModel):
    chain: str = Field(..., max_length=128)
    token_symbol: str = Field(..., max_length=32)
    token_name: Optional[str] = None
    price: Optional[float] = None
    volume: Optional[float] = None
    market_cap: Optional[float] = None
    timestamp: Optional[str] = None
    source: Optional[str] = None
    crawl_id: Optional[str] = None
    crawled_at: Optional[str] = None


class CrossborderDataItem(scrapy.Item):
    """Crossborder ecommerce data item."""

    category = (
        scrapy.Field()
    )  # market-intel, product-analysis, logistics, compliance, platform-ops
    subcategory = (
        scrapy.Field()
    )  # crossborder-volume, platform-share, top-categories, etc.
    title = scrapy.Field()
    source = scrapy.Field()
    summary = scrapy.Field()
    value = scrapy.Field()  # numeric value
    value_unit = scrapy.Field()  # %, USD, 亿美元, etc.
    growth_rate = scrapy.Field()  # percentage growth
    country_origin = scrapy.Field()
    country_destination = scrapy.Field()
    product_category = scrapy.Field()
    indicator = scrapy.Field()  # trade_volume, market_size, shipping_cost, etc.
    confidence_score = scrapy.Field()  # 0-1
    data_date = scrapy.Field()
    tags = scrapy.Field()  # list of strings
    url = scrapy.Field()
    source_db = scrapy.Field()  # rename to avoid conflict with source field
    crawl_id = scrapy.Field()
    crawled_at = scrapy.Field()


class CrossborderDataModel(BaseModel):
    category: str = Field(..., max_length=64)
    subcategory: Optional[str] = Field(None, max_length=64)
    title: str = Field(..., max_length=512)
    source: Optional[str] = Field(None, max_length=256)
    summary: Optional[str] = None
    value: Optional[float] = None
    value_unit: Optional[str] = Field(None, max_length=32)
    growth_rate: Optional[float] = None
    country_origin: Optional[str] = Field(None, max_length=128)
    country_destination: Optional[str] = Field(None, max_length=128)
    product_category: Optional[str] = Field(None, max_length=128)
    indicator: Optional[str] = Field(None, max_length=64)
    confidence_score: Optional[float] = Field(None, ge=0.0, le=1.0)
    data_date: Optional[str] = None
    tags: Optional[str] = None  # stored as JSON array string
    url: Optional[str] = Field(None, max_length=2048)
    source_db: Optional[str] = Field(None, max_length=256)
    crawl_id: Optional[str] = None
    crawled_at: Optional[str] = None
