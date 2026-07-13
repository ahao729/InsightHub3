"""
跨境电商数据爬虫 (Crossborder Ecommerce)
==========================================
数据源：
  - UN Comtrade API (公开贸易数据)
  - World Bank WITS (贸易统计)
  - 各国海关公开数据

运行示例：
  python run_spider.py uncomtrade_crossborder -a max_records=30
  python run_spider.py uncomtrade_crossborder -a reporter=156 partner=842 max_records=20
  DEV_MODE=true python run_spider.py uncomtrade_crossborder
"""

import hashlib
import json
import logging
import random
from datetime import datetime, timedelta

import scrapy

from crawler.items import CrossborderDataItem
from crawler.spiders.base import BaseSpider

logger = logging.getLogger(__name__)


class UncomtradeCrossborderSpider(BaseSpider):
    """跨境电商数据爬虫 — UN Comtrade / World Bank WITS / 公开贸易数据"""

    name = "uncomtrade_crossborder"
    description = "跨境电商市场、物流、合规与平台运营数据"
    industry = "crossborder-ecommerce"

    custom_settings = {
        "DOWNLOAD_DELAY": 2,
        "CONCURRENT_REQUESTS": 4,
        "RANDOMIZE_DOWNLOAD_DELAY": True,
    }

    # Reporter / Partner ISO numeric codes
    REPORTER_CODES = {
        "156": "China",
        "842": "United States",
        "276": "Germany",
        "392": "Japan",
        "410": "South Korea",
        "360": "Indonesia",
        "764": "Thailand",
        "704": "Vietnam",
        "458": "Malaysia",
        "608": "Philippines",
        "702": "Singapore",
        "826": "United Kingdom",
        "250": "France",
        "124": "Canada",
        "036": "Australia",
        "076": "Brazil",
        "643": "Russia",
        "356": "India",
        "484": "Mexico",
        "792": "Turkey",
    }

    # HS Code top-level categories
    HS_CATEGORIES = {
        "84": "Machinery & Computers",
        "85": "Electronics",
        "87": "Vehicles",
        "94": "Furniture",
        "61": "Apparel Knitted",
        "62": "Apparel Woven",
        "95": "Toys & Games",
        "39": "Plastics",
        "73": "Iron & Steel",
        "30": "Pharmaceuticals",
        "64": "Footwear",
        "42": "Leather Goods",
        "70": "Glass",
        "76": "Aluminum",
        "29": "Organic Chemicals",
    }

    def __init__(
        self,
        reporter="156",
        partner="842",
        max_records=30,
        include_logistics=True,
        include_compliance=True,
        *args,
        **kwargs,
    ):
        super().__init__(*args, **kwargs)
        self.reporter = str(reporter)
        self.partner = str(partner)
        self.max_records = int(max_records)
        self.include_logistics = include_logistics
        self.include_compliance = include_compliance

    # ─── Mock Data ────────────────────────────────────────────────────────────

    def _mock_items(self):
        """丰富 mock 数据 — 覆盖所有5大品类"""
        now = datetime.utcnow()
        items = []

        # ── market-intel ──
        mock_market_intel = [
            {
                "subcategory": "crossborder-volume",
                "title": "2026年Q2中美跨境电商交易额",
                "summary": "中美跨境电商交易额达328亿美元，同比增长17.3%，中国对美出口占62%。",
                "value": 328,
                "value_unit": "亿美元",
                "growth_rate": 17.3,
                "country_origin": "中国",
                "country_destination": "美国",
                "product_category": "全品类",
                "indicator": "trade_volume",
                "confidence_score": 0.92,
                "tags": ["中美贸易", "跨境电商", "市场趋势", "B2C"],
            },
            {
                "subcategory": "crossborder-volume",
                "title": "2026年东盟跨境电商市场规模",
                "summary": "东盟六国跨境电商总规模预计突破1,200亿美元，年增长22%，越南和菲律宾增速最快。",
                "value": 1200,
                "value_unit": "亿美元",
                "growth_rate": 22.0,
                "country_origin": "多国",
                "country_destination": "东盟",
                "product_category": "全品类",
                "indicator": "market_size",
                "confidence_score": 0.88,
                "tags": ["东盟", "东南亚", "新兴市场", "区域经济"],
            },
            {
                "subcategory": "platform-share",
                "title": "全球跨境电商平台市场份额（2026年6月）",
                "summary": "Amazon 35.2%，Alibaba/AliExpress 18.7%，Shopify 跨境店 9.4%，Shein 6.8%，Temu 5.1%，TikTok Shop 3.9%。",
                "value": 35.2,
                "value_unit": "%",
                "growth_rate": -2.1,
                "country_origin": "全球",
                "country_destination": "全球",
                "product_category": "全品类",
                "indicator": "market_share",
                "confidence_score": 0.85,
                "platform": "Amazon",
                "tags": ["电商平台", "市场份额", "Amazon", "Shein", "Temu"],
            },
            {
                "subcategory": "consumer-trend",
                "title": "2026年跨境消费者偏好变化 — 可持续与本地化",
                "summary": "72%消费者更倾向可持续认证品牌，62%期望本地化产品描述和支付方式。",
                "value": 72,
                "value_unit": "%",
                "growth_rate": 12.0,
                "country_origin": "全球",
                "country_destination": "全球",
                "product_category": "全品类",
                "indicator": "consumer_preference",
                "confidence_score": 0.82,
                "tags": ["消费者洞察", "可持续", "本地化", "品牌出海"],
            },
        ]

        # ── product-analysis ──
        mock_product = [
            {
                "subcategory": "top-categories",
                "title": "2026年上半年跨境电商热销品类 Top 10",
                "summary": "TOP5：智能家居（+65%）、健康个护（+52%）、户外运动（+48%）、宠物用品（+43%）、DIY工具（+37%）。",
                "value": 65,
                "value_unit": "%",
                "growth_rate": 65.0,
                "country_origin": "中国",
                "country_destination": "全球",
                "product_category": "智能家居",
                "indicator": "sales_growth",
                "confidence_score": 0.86,
                "tags": ["热销品类", "智能家居", "健康个护", "户外运动"],
            },
            {
                "subcategory": "price-trend",
                "title": "跨境电子品类价格趋势 — 蓝牙耳机",
                "summary": "跨境蓝牙耳机均价同比下降18%，$20-50价格段占比从35%升至52%。",
                "value": 18,
                "value_unit": "%",
                "growth_rate": -18.0,
                "country_origin": "中国",
                "country_destination": "全球",
                "product_category": "蓝牙耳机",
                "indicator": "price_trend",
                "confidence_score": 0.90,
                "tags": ["价格趋势", "电子品类", "蓝牙耳机", "消费电子"],
            },
            {
                "subcategory": "demand-signal",
                "title": "跨境搜索需求信号 — 美国市场中国品牌搜索量",
                "summary": "美国消费者搜索'Chinese brand'+品类词搜索量同比增长89%，扫地机器人+145%。",
                "value": 89,
                "value_unit": "%",
                "growth_rate": 89.0,
                "country_origin": "中国",
                "country_destination": "美国",
                "product_category": "全品类",
                "indicator": "search_volume",
                "confidence_score": 0.84,
                "tags": ["需求信号", "Google Trends", "品牌搜索", "出海品牌"],
            },
        ]

        # ── logistics ──
        mock_logistics = [
            {
                "subcategory": "shipping-rates",
                "title": "中美跨境物流价格指数（2026年6月）",
                "summary": "中国→美国西岸40尺柜运费$4,280（同比-22%），空运$5.20/kg（同比-8%）。",
                "value": 4280,
                "value_unit": "USD",
                "growth_rate": -22.0,
                "country_origin": "中国",
                "country_destination": "美国",
                "product_category": "物流",
                "indicator": "shipping_cost",
                "confidence_score": 0.93,
                "tags": ["跨境物流", "海运", "空运", "运费指数"],
            },
            {
                "subcategory": "fulfillment-time",
                "title": "跨境物流时效对比（2026年Q2）",
                "summary": "海运平均22天（同比-12%），空运平均4天，海外仓本地配送平均2.3天。",
                "value": 22,
                "value_unit": "天",
                "growth_rate": -12.0,
                "country_origin": "中国",
                "country_destination": "美国",
                "product_category": "物流",
                "indicator": "delivery_time",
                "confidence_score": 0.88,
                "tags": ["物流时效", "海外仓", "最后一公里"],
            },
            {
                "subcategory": "warehouse-cost",
                "title": "海外仓运营成本趋势",
                "summary": "美国西岸海外仓月租$8.2/立方米（同比+5%），人工成本同比+12%。",
                "value": 8.2,
                "value_unit": "USD/m³",
                "growth_rate": 5.0,
                "country_origin": "中国",
                "country_destination": "美国",
                "product_category": "物流",
                "indicator": "warehouse_cost",
                "confidence_score": 0.85,
                "tags": ["海外仓", "仓储成本", "运营成本"],
            },
        ]

        # ── compliance ──
        mock_compliance = [
            {
                "subcategory": "tariff-change",
                "title": "2026年美国对华关税政策更新",
                "summary": "301条款关税维持7.5%-25%，新增电动车100%、半导体50%关税。小额免税门槛维持$800。",
                "value": 25,
                "value_unit": "%",
                "growth_rate": 0,
                "country_origin": "中国",
                "country_destination": "美国",
                "product_category": "全品类",
                "indicator": "tariff_rate",
                "confidence_score": 0.95,
                "tags": ["关税政策", "301条款", "贸易壁垒", "合规"],
            },
            {
                "subcategory": "regulation-update",
                "title": "欧盟DSA数字服务法跨境电商合规要求",
                "summary": "2026年7月起，所有向欧盟消费者销售的跨境电商平台需完成DSA合规注册。",
                "value": 100,
                "value_unit": "%",
                "growth_rate": 0,
                "country_origin": "全球",
                "country_destination": "欧盟",
                "product_category": "全品类",
                "indicator": "compliance_rate",
                "confidence_score": 0.90,
                "tags": ["DSA", "欧盟合规", "数字服务法", "平台责任"],
            },
            {
                "subcategory": "tax-update",
                "title": "东南亚跨境电商增值税政策汇总",
                "summary": "印尼GST 11%，泰国VAT 7%，越南VAT 8%，马来西亚SST 10%。多国加强电商征税。",
                "value": 11,
                "value_unit": "%",
                "growth_rate": 0,
                "country_origin": "全球",
                "country_destination": "东盟",
                "product_category": "全品类",
                "indicator": "tax_rate",
                "confidence_score": 0.87,
                "tags": ["增值税", "东南亚", "税务合规", "电商征税"],
            },
        ]

        # ── platform-ops ──
        mock_platform = [
            {
                "subcategory": "platform-fee",
                "title": "主流跨境电商平台费率对比（2026年）",
                "summary": "Amazon佣金8%-15%，AliExpress 5%-8%，Shopify月租$39+交易费2.9%，Temu 0佣金但控价。",
                "value": 8,
                "value_unit": "%",
                "growth_rate": 0,
                "country_origin": "全球",
                "country_destination": "全球",
                "product_category": "全品类",
                "indicator": "platform_fee",
                "confidence_score": 0.88,
                "tags": ["平台费率", "佣金", "运营成本", "平台对比"],
            },
            {
                "subcategory": "ad-spend",
                "title": "跨境电商广告投放ROI趋势",
                "summary": "Amazon PPC平均ACoS 28%（同比+3pp），TikTok Shop广告ROI 3.2x，Google Shopping 4.1x。",
                "value": 3.2,
                "value_unit": "x",
                "growth_rate": -8.0,
                "country_origin": "全球",
                "country_destination": "全球",
                "product_category": "全品类",
                "indicator": "ad_roi",
                "confidence_score": 0.82,
                "tags": ["广告ROI", "PPC", "TikTok Shop", "流量成本"],
            },
            {
                "subcategory": "return-rate",
                "title": "跨境电商退货率品类分析",
                "summary": "服装退货率最高（30-40%），电子产品5-8%，家居10-15%。平均退货处理成本$8-15/件。",
                "value": 35,
                "value_unit": "%",
                "growth_rate": 5.0,
                "country_origin": "全球",
                "country_destination": "美国",
                "product_category": "服装",
                "indicator": "return_rate",
                "confidence_score": 0.86,
                "tags": ["退货率", "逆向物流", "品类分析", "售后成本"],
            },
        ]

        all_mock = (
            mock_market_intel
            + mock_product
            + mock_logistics
            + mock_compliance
            + mock_platform
        )

        for i, m in enumerate(all_mock):
            date_offset = timedelta(days=random.randint(0, 60))
            data_date = (now - date_offset).strftime("%Y-%m-%d")
            created_at = (now - date_offset).isoformat() + "Z"

            yield CrossborderDataItem(
                category=self._category_from_subcat(m["subcategory"]),
                subcategory=m["subcategory"],
                title=m["title"],
                source="CrossborderEcommerce Mock / Public Trade Data",
                summary=m["summary"],
                value=m["value"],
                value_unit=m["value_unit"],
                growth_rate=m["growth_rate"],
                country_origin=m["country_origin"],
                country_destination=m["country_destination"],
                product_category=m["product_category"],
                indicator=m["indicator"],
                confidence_score=m["confidence_score"],
                data_date=data_date,
                tags=json.dumps(m["tags"], ensure_ascii=False),
                url=f"https://mock.crossborder-insight.com/item/{i}",
                source_db="mock",
                crawl_id=self.crawl_id,
                crawled_at=datetime.utcnow().isoformat(),
            )

    def _category_from_subcat(self, subcategory):
        mapping = {
            "crossborder-volume": "market-intel",
            "platform-share": "market-intel",
            "consumer-trend": "market-intel",
            "top-categories": "product-analysis",
            "price-trend": "product-analysis",
            "demand-signal": "product-analysis",
            "shipping-rates": "logistics",
            "fulfillment-time": "logistics",
            "warehouse-cost": "logistics",
            "tariff-change": "compliance",
            "regulation-update": "compliance",
            "tax-update": "compliance",
            "platform-fee": "platform-ops",
            "ad-spend": "platform-ops",
            "return-rate": "platform-ops",
        }
        return mapping.get(subcategory, "market-intel")

    # ─── Real API ─────────────────────────────────────────────────────────────

    def start_requests(self):
        if self.dev_mode:
            logger.info("[DEV] Mock 模式 — 输出跨境电商 mock 数据")
            for item in self._mock_items():
                yield item
            return

        # ── Source 1: UN Comtrade API (公开贸易流量) ──
        reporter_name = self.REPORTER_CODES.get(self.reporter, "China")
        partner_name = self.REPORTER_CODES.get(self.partner, "United States")

        # Try UN Comtrade bulk download (public, no API key required for recent data)
        comtrade_url = (
            f"https://comtradeapi.un.org/public/v1/preview/C/A/HS"
            f"?reporterCode={self.reporter}&partnerCode={self.partner}"
            f"&period=2025,2026&cmdCode=TOTAL&flowCode=M"
        )
        yield scrapy.Request(
            comtrade_url,
            callback=self._parse_comtrade,
            meta={
                "reporter_name": reporter_name,
                "partner_name": partner_name,
                "source": "UN Comtrade",
            },
            errback=self._errback_fallback,
        )

        # ── Source 2: World Bank WITS (贸易统计) ──
        wits_url = (
            f"https://wits.worldbank.org/API/V1/SDMX/V21/rest/data"
            f"/DF_WITS_TradeStats_TradeA?reporterCode={self.reporter}"
            f"&partnerCode={self.partner}&indicatorCode=TM_VAL_USD"
            f"&startPeriod=2024&endPeriod=2026"
        )
        yield scrapy.Request(
            wits_url,
            callback=self._parse_wits,
            meta={"reporter_name": reporter_name, "partner_name": partner_name},
            errback=self._errback_fallback,
        )

    def _parse_comtrade(self, response):
        """Parse UN Comtrade API response"""
        reporter_name = response.meta["reporter_name"]
        partner_name = response.meta["partner_name"]
        source = response.meta["source"]

        try:
            data = response.json()
            records = data.get("data", [])
        except Exception:
            logger.warning("[COMTRADE] JSON parse failed, falling back to mock")
            for item in self._mock_items():
                yield item
            return

        if not records:
            logger.info("[COMTRADE] No records, falling back to mock")
            for item in self._mock_items():
                yield item
            return

        logger.info(
            "[COMTRADE] Got %d trade records for %s→%s",
            len(records),
            reporter_name,
            partner_name,
        )

        # Aggregate by HS 2-digit code
        hs_totals = {}
        for rec in records:
            hs2 = str(rec.get("cmdCode", ""))[:2]
            flow = rec.get("flowCode", "M")
            value = rec.get("primary_value", 0) or 0
            period = str(rec.get("period", ""))
            key = f"{hs2}|{period}"
            if key not in hs_totals:
                hs_totals[key] = {
                    "hs2": hs2,
                    "period": period,
                    "import_value": 0,
                    "desc": self.HS_CATEGORIES.get(hs2, f"HS {hs2}"),
                }
            if flow == "M":
                hs_totals[key]["import_value"] += value
            else:
                hs_totals[key]["export_value"] = (
                    hs_totals[key].get("export_value", 0) + value
                )

        for key, agg in hs_totals.items():
            if agg["import_value"] == 0:
                continue
            total_usd = agg["import_value"]
            if total_usd >= 1e9:
                display_val = round(total_usd / 1e9, 2)
                unit = "十亿美元"
            elif total_usd >= 1e6:
                display_val = round(total_usd / 1e6, 2)
                unit = "百万美元"
            else:
                display_val = round(total_usd, 2)
                unit = "美元"

            yield CrossborderDataItem(
                category="product-analysis",
                subcategory="trade-flow",
                title=f"{agg['desc']} — {reporter_name}→{partner_name} ({agg['period']})",
                source=source,
                summary=f"{agg['period']}年{reporter_name}向{partner_name}出口{agg['desc']}约{display_val}{unit}。",
                value=display_val,
                value_unit=unit,
                growth_rate=None,
                country_origin=reporter_name,
                country_destination=partner_name,
                product_category=agg["desc"],
                indicator="trade_flow",
                confidence_score=0.95,
                data_date=f"{agg['period']}-12-31",
                tags=[agg["desc"], reporter_name, partner_name, "贸易流量"],
                url=response.url,
                source_db=source,
                crawl_id=self.crawl_id,
                crawled_at=datetime.utcnow().isoformat(),
            )

        # Also generate macro-level item
        total_import = sum(a["import_value"] for a in hs_totals.values())
        if total_import > 0:
            display_total = round(total_import / 1e9, 2)
            yield CrossborderDataItem(
                category="market-intel",
                subcategory="crossborder-volume",
                title=f"{reporter_name}→{partner_name} 跨境贸易总额",
                source=source,
                summary=f"{reporter_name}对{partner_name}贸易总额约{display_total}十亿美元。",
                value=display_total,
                value_unit="十亿美元",
                growth_rate=None,
                country_origin=reporter_name,
                country_destination=partner_name,
                product_category="全品类",
                indicator="trade_volume",
                confidence_score=0.95,
                data_date=datetime.utcnow().strftime("%Y-%m-%d"),
                tags=["贸易总额", reporter_name, partner_name, "宏观经济"],
                url=response.url,
                source_db=source,
                crawl_id=self.crawl_id,
                crawled_at=datetime.utcnow().isoformat(),
            )

    def _parse_wits(self, response):
        """Parse World Bank WITS API response"""
        reporter_name = response.meta["reporter_name"]
        partner_name = response.meta["partner_name"]

        try:
            data = response.json()
            datasets = data.get("dataSets", [{}])
            if not datasets:
                return
            series = datasets[0].get("series", [])
        except Exception:
            logger.warning("[WITS] JSON parse failed")
            return

        logger.info(
            "[WITS] Got %d series for %s→%s", len(series), reporter_name, partner_name
        )

        # Extract key trade metrics
        for s in series:
            obs = s.get("observations", {})
            indicator = s.get("seriesKey", {}).get("key", "")
            if not obs:
                continue

            # Get the latest observation
            latest_period = max(obs.keys()) if obs else None
            if latest_period is None:
                continue
            latest_value = obs[latest_period]
            if isinstance(latest_value, list):
                latest_value = latest_value[0]

            if latest_value and latest_value > 0:
                total_usd = latest_value
                if total_usd >= 1e9:
                    display_val = round(total_usd / 1e9, 2)
                    unit = "十亿美元"
                elif total_usd >= 1e6:
                    display_val = round(total_usd / 1e6, 2)
                    unit = "百万美元"
                else:
                    display_val = round(total_usd, 2)
                    unit = "美元"

                period_str = (
                    f"{2000 + int(latest_period // 1)}"
                    if isinstance(latest_period, (int, float))
                    else str(latest_period)
                )

                yield CrossborderDataItem(
                    category="market-intel",
                    subcategory="crossborder-volume",
                    title=f"{reporter_name}进口总额 ({period_str}) — World Bank",
                    source="World Bank WITS",
                    summary=f"{period_str}年{reporter_name}从{partner_name}进口总额约{display_val}{unit}。",
                    value=display_val,
                    value_unit=unit,
                    growth_rate=None,
                    country_origin=partner_name,
                    country_destination=reporter_name,
                    product_category="全品类",
                    indicator="trade_volume",
                    confidence_score=0.90,
                    data_date=datetime.utcnow().strftime("%Y-%m-%d"),
                    tags=["进口总额", reporter_name, partner_name, "World Bank"],
                    url=response.url,
                    source_db="World Bank WITS",
                    crawl_id=self.crawl_id,
                    crawled_at=datetime.utcnow().isoformat(),
                )

    # ─── Fallback ─────────────────────────────────────────────────────────────

    def _errback_fallback(self, failure):
        """API 失败时降级到 mock 数据"""
        logger.warning(
            "[FALLBACK] API request failed: %s — using mock data", failure.request.url
        )
        for item in self._mock_items():
            yield item

    def _parse_empty(self, response):
        pass
