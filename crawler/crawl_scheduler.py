#!/usr/bin/env python3
"""
InsightHub Crawler Scheduler — runs spiders on a schedule.

Can be called from cron, Airflow, or any job scheduler.

Usage:
    # Run all spiders sequentially
    python crawl_scheduler.py --all

    # Run specific spiders
    python crawl_scheduler.py --spiders gdelt_news,world_bank

    # Run once with dev mode
    python crawl_scheduler.py --all --dev

    # Dry-run (print what would be done)
    python crawl_scheduler.py --all --dry-run

Crawl jobs are tracked in the `crawl_jobs` table (PostgreSQL).
"""

import argparse
import json
import logging
import os
import sys
import time
from datetime import datetime
from typing import List, Optional

# Ensure the project root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger("crawl_scheduler")

# ── Database helpers ──────────────────────────────────────────────────────────

try:
    import psycopg2
    import psycopg2.extras

    HAS_DB = True
except ImportError:
    HAS_DB = False
    logger.warning("psycopg2 not installed — crawl_job tracking disabled.")


def get_db_connection():
    """Create a PostgreSQL connection from environment."""
    if not HAS_DB:
        return None
    try:
        conn = psycopg2.connect(
            host=os.getenv("DB_HOST", "localhost"),
            port=int(os.getenv("DB_PORT", 5432)),
            dbname=os.getenv("DB_NAME", "insighthub"),
            user=os.getenv("DB_USER", "insighthub"),
            password=os.getenv("DB_PASSWORD", "insighthub"),
        )
        conn.autocommit = False
        return conn
    except Exception as exc:
        logger.warning("Database connection failed: %s", exc)
        return None


def ensure_jobs_table(conn):
    """Create crawl_jobs table if it does not exist."""
    if conn is None:
        return
    try:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS crawl_jobs (
                    id              SERIAL PRIMARY KEY,
                    spider_name     VARCHAR(128) NOT NULL,
                    status          VARCHAR(32) NOT NULL DEFAULT 'pending',
                    started_at      TIMESTAMP,
                    finished_at     TIMESTAMP,
                    items_crawled   INTEGER DEFAULT 0,
                    args            JSONB,
                    error_message   TEXT,
                    created_at      TIMESTAMP DEFAULT NOW()
                );
            """)
            conn.commit()
    except Exception as exc:
        conn.rollback()
        logger.error("Failed to create crawl_jobs table: %s", exc)


def record_job_start(conn, spider_name: str, args: dict) -> Optional[int]:
    """Insert a crawl_job record and return its ID."""
    if conn is None:
        return None
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO crawl_jobs (spider_name, status, started_at, args)
                VALUES (%s, 'running', NOW(), %s)
                RETURNING id
                """,
                (spider_name, json.dumps(args)),
            )
            conn.commit()
            job_id = cur.fetchone()[0]
            logger.info("[Job #%s] Started spider '%s'", job_id, spider_name)
            return job_id
    except Exception as exc:
        conn.rollback()
        logger.error("Failed to record job start: %s", exc)
        return None


def record_job_finish(conn, job_id: int, items_count: int, error: Optional[str] = None):
    """Mark a crawl_job as finished."""
    if conn is None or job_id is None:
        return
    status = "failed" if error else "completed"
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE crawl_jobs
                SET status = %s, finished_at = NOW(), items_crawled = %s, error_message = %s
                WHERE id = %s
                """,
                (status, items_count, error, job_id),
            )
            conn.commit()
            logger.info(
                "[Job #%s] Finished with status='%s', items=%s",
                job_id,
                status,
                items_count,
            )
    except Exception as exc:
        conn.rollback()
        logger.error("Failed to record job finish: %s", exc)


# ── Spider runner ─────────────────────────────────────────────────────────────

AVAILABLE_SPIDERS = [
    "gdelt_news",
    "world_bank",
    "uspto_patents",
    "arxiv_papers",
    "public_company",
]

# Default args for each spider
SPIDER_DEFAULT_ARGS = {
    "gdelt_news": {
        "max_records": 50,
        "query": "startup OR AI OR finance OR policy OR education OR blockchain",
    },
    "world_bank": {
        "indicators": "GDP,GDP_growth,inflation,unemployment",
        "countries": "US,CN,JP,DE,GB,IN",
    },
    "uspto_patents": {
        "query": "artificial intelligence OR machine learning OR blockchain",
        "max_pages": 3,
    },
    "arxiv_papers": {
        "query": "machine learning OR artificial intelligence OR blockchain",
        "max_results": 30,
    },
    "public_company": {"query": "Technology", "max_records": 10},
}


def run_spider(spider_name: str, args: dict, dev_mode: bool, dry_run: bool) -> int:
    """
    Run a single spider and return the number of items crawled.
    In dry-run mode, just log what would happen.
    """
    logger.info("=" * 60)
    logger.info("Spider: %s | args: %s | dev=%s", spider_name, args, dev_mode)

    if dry_run:
        logger.info(
            "[DRY-RUN] Would run: python run_spider.py %s -a %s",
            spider_name,
            " -a ".join(f"{k}={v}" for k, v in args.items()),
        )
        return 0

    # Build command-line equivalent via run_spider module
    from run_spider import run_spider as _run

    # The run_spider module captures output via feed export; we can't easily
    # get items count back, so we approximate.
    try:
        _run(spider_name, args, dev_mode=dev_mode)
        return 1  # success marker
    except SystemExit:
        return 0
    except Exception as exc:
        logger.error("Spider '%s' failed: %s", spider_name, exc)
        return 0


def run_all_spiders(spider_names: List[str], dev_mode: bool, dry_run: bool):
    """Run a list of spiders sequentially with database tracking."""
    conn = get_db_connection()
    ensure_jobs_table(conn)

    total_items = 0
    results = []

    for name in spider_names:
        job_id = record_job_start(
            conn, name, {"dev_mode": dev_mode, **SPIDER_DEFAULT_ARGS.get(name, {})}
        )

        try:
            start = time.time()
            items = run_spider(
                name, SPIDER_DEFAULT_ARGS.get(name, {}), dev_mode, dry_run
            )
            elapsed = time.time() - start
            error = None
        except Exception as exc:
            items = 0
            elapsed = 0
            error = str(exc)

        record_job_finish(conn, job_id, items, error)

        status = "OK" if not error else "FAIL"
        results.append((name, status, items, elapsed))
        total_items += items

    # Summary
    print()
    print("=" * 60)
    print("Crawl Summary")
    print("=" * 60)
    print(f"{'Spider':<20} {'Status':<8} {'Items':<8} {'Time':<8}")
    print("-" * 60)
    for name, status, items, elapsed in results:
        print(f"{name:<20} {status:<8} {items:<8} {elapsed:<8.1f}s")
    print("-" * 60)
    print(f"{'TOTAL':<20} {'':<8} {total_items:<8}")
    print()

    if conn:
        conn.close()


def main():
    parser = argparse.ArgumentParser(
        description="InsightHub Crawler Scheduler — run spiders on a schedule.",
    )
    parser.add_argument("--all", action="store_true", help="Run all available spiders")
    parser.add_argument(
        "--spiders", type=str, default="", help="Comma-separated list of spiders to run"
    )
    parser.add_argument(
        "--dev", action="store_true", help="Run in dev mode (mock data)"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print what would be done without running",
    )
    parser.add_argument("--list", action="store_true", help="List available spiders")

    args = parser.parse_args()

    if args.list:
        print("Available spiders:")
        for s in AVAILABLE_SPIDERS:
            print(f"  - {s}")
        return

    # Determine which spiders to run
    spider_names = []
    if args.all:
        spider_names = AVAILABLE_SPIDERS[:]
    elif args.spiders:
        spider_names = [s.strip() for s in args.spiders.split(",") if s.strip()]
    else:
        parser.print_help()
        print("\nError: specify --all or --spiders")
        sys.exit(1)

    # Validate spider names
    for name in spider_names:
        if name not in AVAILABLE_SPIDERS:
            logger.warning(
                "Unknown spider '%s' — skipping. Available: %s", name, AVAILABLE_SPIDERS
            )

    spider_names = [n for n in spider_names if n in AVAILABLE_SPIDERS]

    if not spider_names:
        logger.error("No valid spiders to run.")
        sys.exit(1)

    run_all_spiders(spider_names, dev_mode=args.dev, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
