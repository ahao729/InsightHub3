#!/usr/bin/env python3
"""
InsightHub — Command-line spider runner.

Usage:
    python run_spider.py gdelt_news -a query="AI startup" -a max_records=50
    python run_spider.py world_bank -a indicators=GDP,inflation -a countries=US,CN
    python run_spider.py uspto_patents -a query="machine learning" -a max_pages=3
    python run_spider.py arxiv_papers -a query="deep learning" -a max_results=30
    python run_spider.py public_company -a query="Tech" -a dev_mode=true

    # List available spiders
    python run_spider.py --list

    # Use dev mode (mock data)
    python run_spider.py gdelt_news --dev
"""

import argparse
import json
import logging
import os
import sys
from datetime import datetime

# Ensure the project root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from scrapy.crawler import CrawlerProcess
from scrapy.utils.project import get_project_settings
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger("run_spider")

# ── Spider registry ───────────────────────────────────────────────────────────

AVAILABLE_SPIDERS = {
    "gdelt_news": {
        "module": "crawler.spiders.gdelt_news",
        "class": "GdeltNewsSpider",
        "description": "GDELT 2.0 API — global news with sentiment",
    },
    "uspto_patents": {
        "module": "crawler.spiders.uspto_patents",
        "class": "UsptoPatentsSpider",
        "description": "USPTO Open Data API — patent search",
    },
    "world_bank": {
        "module": "crawler.spiders.world_bank",
        "class": "WorldBankSpider",
        "description": "World Bank API — economic indicators",
    },
    "public_company": {
        "module": "crawler.spiders.public_company",
        "class": "PublicCompanySpider",
        "description": "Company profiles (mock/API template)",
    },
    "arxiv_papers": {
        "module": "crawler.spiders.arxiv_papers",
        "class": "ArxivPapersSpider",
        "description": "arXiv API — academic research papers",
    },
}


def list_spiders():
    """Print available spiders."""
    print("\nAvailable spiders:")
    print(f"{'Name':<20} Description")
    print("-" * 60)
    for name, info in AVAILABLE_SPIDERS.items():
        print(f"{name:<20} {info['description']}")
    print()


def run_spider(spider_name: str, spider_args: dict, dev_mode: bool = False):
    """Run a single spider with the given arguments."""
    if spider_name not in AVAILABLE_SPIDERS:
        logger.error(
            "Unknown spider '%s'. Use --list to see available spiders.", spider_name
        )
        sys.exit(1)

    # Set dev mode in environment
    if dev_mode:
        os.environ["CRAWL_DEV_MODE"] = "true"
        logger.info("⚡ Running in DEV mode — mock data will be used.")

    # Get Scrapy settings
    settings = get_project_settings()

    # Enable JSON feed export for fallback
    output_dir = settings.get("CRAWL_OUTPUT_DIR", "output")
    os.makedirs(output_dir, exist_ok=True)
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    feed_uri = os.path.join(output_dir, f"{spider_name}_{timestamp}.jsonl")
    settings.set("FEED_URI", feed_uri, priority="cmdline")

    # Build process
    process = CrawlerProcess(settings)

    # Add spider arguments
    spider_kwargs = {"dev_mode": dev_mode}
    for key, val in spider_args.items():
        spider_kwargs[key] = val

    logger.info("Starting spider: %s with args: %s", spider_name, spider_kwargs)
    process.crawl(spider_name, **spider_kwargs)
    process.start()

    logger.info("Spider finished. Output written to: %s", feed_uri)


def main():
    parser = argparse.ArgumentParser(
        description="InsightHub Crawler — run spiders from the command line.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python run_spider.py gdelt_news -a query="AI startup" -a max_records=50
  python run_spider.py world_bank -a indicators=GDP,inflation
  python run_spider.py uspto_patents -a query="machine learning"
  python run_spider.py arxiv_papers -a query="deep learning" --dev
  python run_spider.py --list
        """,
    )

    parser.add_argument("spider", nargs="?", help="Name of the spider to run")
    parser.add_argument(
        "-a",
        action="append",
        default=[],
        dest="args",
        help="Spider argument in key=value format (repeatable)",
    )
    parser.add_argument(
        "--dev",
        action="store_true",
        default=False,
        help="Run in development mode (uses mock data)",
    )
    parser.add_argument(
        "--list", action="store_true", default=False, help="List available spiders"
    )

    args = parser.parse_args()

    if args.list:
        list_spiders()
        return

    if not args.spider:
        parser.print_help()
        sys.exit(1)

    # Parse -a key=value arguments
    spider_args = {}
    for arg in args.args:
        if "=" not in arg:
            logger.warning("Ignoring argument '%s' (not in key=value format)", arg)
            continue
        key, value = arg.split("=", 1)
        spider_args[key.strip()] = value.strip()

    run_spider(args.spider, spider_args, dev_mode=args.dev)


if __name__ == "__main__":
    main()
