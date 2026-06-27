#!/usr/bin/env python3
"""
InsightHub — Database Setup Script.

Creates all required tables for the crawler framework if they don't exist.
Tests the database connection.

Usage:
    python db_setup.py                     # create tables, test connection
    python db_setup.py --drop              # DROP and recreate tables (DANGER)
    python db_setup.py --dry-run           # show SQL without executing
    python db_setup.py --verbose           # print all SQL statements

Environment variables (or .env):
    DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, DB_SCHEMA
"""

import argparse
import logging
import os
import sys

from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger("db_setup")

# ── Table DDL ─────────────────────────────────────────────────────────────────

SCHEMA_SQL = """
CREATE SCHEMA IF NOT EXISTS {schema};
"""

# Market news / media monitoring
CREATE_MARKET_NEWS = """
CREATE TABLE IF NOT EXISTS {schema}.market_news (
    id              SERIAL PRIMARY KEY,
    title           TEXT NOT NULL,
    url             TEXT NOT NULL UNIQUE,
    source          VARCHAR(256),
    published       TIMESTAMP,
    content         TEXT,
    summary         TEXT,
    industry        VARCHAR(128),
    region          VARCHAR(32),
    sentiment       REAL,
    crawl_id        VARCHAR(64),
    crawled_at      TIMESTAMP DEFAULT NOW(),
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_market_news_industry ON {schema}.market_news(industry);
CREATE INDEX IF NOT EXISTS idx_market_news_region ON {schema}.market_news(region);
CREATE INDEX IF NOT EXISTS idx_market_news_published ON {schema}.market_news(published);
CREATE INDEX IF NOT EXISTS idx_market_news_crawl_id ON {schema}.market_news(crawl_id);
"""

# Company / enterprise profiles
CREATE_COMPANY_PROFILES = """
CREATE TABLE IF NOT EXISTS {schema}.company_profiles (
    id                      SERIAL PRIMARY KEY,
    name                    VARCHAR(512) NOT NULL,
    registration_number     VARCHAR(128),
    legal_representative    VARCHAR(256),
    registered_capital      VARCHAR(128),
    status                  VARCHAR(64) DEFAULT 'active',
    industry                VARCHAR(256),
    region                  VARCHAR(64),
    established_date        DATE,
    address                 TEXT,
    url                     TEXT,
    source                  VARCHAR(256),
    crawl_id                VARCHAR(64),
    crawled_at              TIMESTAMP DEFAULT NOW(),
    created_at              TIMESTAMP DEFAULT NOW(),
    updated_at              TIMESTAMP DEFAULT NOW(),
    UNIQUE(registration_number)
);

CREATE INDEX IF NOT EXISTS idx_company_industry ON {schema}.company_profiles(industry);
CREATE INDEX IF NOT EXISTS idx_company_region ON {schema}.company_profiles(region);
CREATE INDEX IF NOT EXISTS idx_company_status ON {schema}.company_profiles(status);
"""

# Financial / economic indicators
CREATE_FINANCIAL_INDICATORS = """
CREATE TABLE IF NOT EXISTS {schema}.financial_indicators (
    id              SERIAL PRIMARY KEY,
    indicator_name  VARCHAR(256) NOT NULL,
    country         VARCHAR(64) NOT NULL,
    value           DOUBLE PRECISION NOT NULL,
    unit            VARCHAR(64),
    period          VARCHAR(32) NOT NULL,
    source          VARCHAR(256),
    crawl_id        VARCHAR(64),
    crawled_at      TIMESTAMP DEFAULT NOW(),
    created_at      TIMESTAMP DEFAULT NOW(),
    UNIQUE(indicator_name, country, period)
);

CREATE INDEX IF NOT EXISTS idx_financial_country ON {schema}.financial_indicators(country);
CREATE INDEX IF NOT EXISTS idx_financial_period ON {schema}.financial_indicators(period);
CREATE INDEX IF NOT EXISTS idx_financial_indicator ON {schema}.financial_indicators(indicator_name);
"""

# Patents
CREATE_PATENTS = """
CREATE TABLE IF NOT EXISTS {schema}.patents (
    id                SERIAL PRIMARY KEY,
    patent_number     VARCHAR(64) NOT NULL UNIQUE,
    title             TEXT,
    abstract          TEXT,
    assignee          VARCHAR(512),
    inventors         JSONB,
    filing_date       DATE,
    publication_date  DATE,
    cpc_class         VARCHAR(256),
    country           VARCHAR(16) DEFAULT 'US',
    url               TEXT,
    source            VARCHAR(256),
    crawl_id          VARCHAR(64),
    crawled_at        TIMESTAMP DEFAULT NOW(),
    created_at        TIMESTAMP DEFAULT NOW(),
    updated_at        TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patents_assignee ON {schema}.patents(assignee);
CREATE INDEX IF NOT EXISTS idx_patents_cpc ON {schema}.patents(cpc_class);
CREATE INDEX IF NOT EXISTS idx_patents_country ON {schema}.patents(country);
CREATE INDEX IF NOT EXISTS idx_patents_publication_date ON {schema}.patents(publication_date);
"""

# Policy documents
CREATE_POLICY_DOCUMENTS = """
CREATE TABLE IF NOT EXISTS {schema}.policy_documents (
    id                SERIAL PRIMARY KEY,
    title             TEXT NOT NULL,
    agency            VARCHAR(256),
    document_number   VARCHAR(128) UNIQUE,
    type              VARCHAR(64),
    publish_date      DATE,
    effective_date    DATE,
    region            VARCHAR(64),
    summary           TEXT,
    url               TEXT,
    source            VARCHAR(256),
    crawl_id          VARCHAR(64),
    crawled_at        TIMESTAMP DEFAULT NOW(),
    created_at        TIMESTAMP DEFAULT NOW(),
    updated_at        TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_policy_agency ON {schema}.policy_documents(agency);
CREATE INDEX IF NOT EXISTS idx_policy_region ON {schema}.policy_documents(region);
CREATE INDEX IF NOT EXISTS idx_policy_type ON {schema}.policy_documents(type);
"""

# Education data (university rankings, etc.)
CREATE_EDUCATION_DATA = """
CREATE TABLE IF NOT EXISTS {schema}.education_data (
    id                SERIAL PRIMARY KEY,
    institution_name  VARCHAR(512) NOT NULL,
    country           VARCHAR(128),
    ranking           INTEGER,
    subject           VARCHAR(256),
    score             REAL,
    year              INTEGER,
    url               TEXT,
    source            VARCHAR(256),
    crawl_id          VARCHAR(64),
    crawled_at        TIMESTAMP DEFAULT NOW(),
    created_at        TIMESTAMP DEFAULT NOW(),
    updated_at        TIMESTAMP DEFAULT NOW(),
    UNIQUE(institution_name, subject, year)
);

CREATE INDEX IF NOT EXISTS idx_education_country ON {schema}.education_data(country);
CREATE INDEX IF NOT EXISTS idx_education_subject ON {schema}.education_data(subject);
CREATE INDEX IF NOT EXISTS idx_education_year ON {schema}.education_data(year);
"""

# Web3 / crypto data
CREATE_WEB3_DATA = """
CREATE TABLE IF NOT EXISTS {schema}.web3_data (
    id              SERIAL PRIMARY KEY,
    chain           VARCHAR(128) NOT NULL,
    token_symbol    VARCHAR(32) NOT NULL,
    token_name      VARCHAR(256),
    price           DOUBLE PRECISION,
    volume          DOUBLE PRECISION,
    market_cap      DOUBLE PRECISION,
    timestamp       TIMESTAMP,
    source          VARCHAR(256),
    crawl_id        VARCHAR(64),
    crawled_at      TIMESTAMP DEFAULT NOW(),
    created_at      TIMESTAMP DEFAULT NOW(),
    UNIQUE(chain, token_symbol, timestamp)
);

CREATE INDEX IF NOT EXISTS idx_web3_chain ON {schema}.web3_data(chain);
CREATE INDEX IF NOT EXISTS idx_web3_symbol ON {schema}.web3_data(token_symbol);
CREATE INDEX IF NOT EXISTS idx_web3_timestamp ON {schema}.web3_data(timestamp);
"""

# Crawl job tracking
CREATE_CRAWL_JOBS = """
CREATE TABLE IF NOT EXISTS {schema}.crawl_jobs (
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

CREATE INDEX IF NOT EXISTS idx_crawl_jobs_status ON {schema}.crawl_jobs(status);
CREATE INDEX IF NOT EXISTS idx_crawl_jobs_spider ON {schema}.crawl_jobs(spider_name);
CREATE INDEX IF NOT EXISTS idx_crawl_jobs_started ON {schema}.crawl_jobs(started_at);
"""

ALL_TABLES = [
    ("market_news", CREATE_MARKET_NEWS),
    ("company_profiles", CREATE_COMPANY_PROFILES),
    ("financial_indicators", CREATE_FINANCIAL_INDICATORS),
    ("patents", CREATE_PATENTS),
    ("policy_documents", CREATE_POLICY_DOCUMENTS),
    ("education_data", CREATE_EDUCATION_DATA),
    ("web3_data", CREATE_WEB3_DATA),
    ("crawl_jobs", CREATE_CRAWL_JOBS),
]


def get_connection():
    """Create a PostgreSQL connection."""
    import psycopg2

    return psycopg2.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", 5432)),
        dbname=os.getenv("DB_NAME", "insighthub"),
        user=os.getenv("DB_USER", "insighthub"),
        password=os.getenv("DB_PASSWORD", "insighthub"),
    )


def test_connection(conn) -> bool:
    """Test database connectivity."""
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT version();")
            version = cur.fetchone()[0]
            logger.info("Connected to PostgreSQL: %s", version)
        return True
    except Exception as exc:
        logger.error("Connection test failed: %s", exc)
        return False


def create_tables(
    conn, schema: str, dry_run: bool = False, verbose: bool = False, drop: bool = False
):
    """Create (or drop+create) all tables."""
    schema_ident = conn.encoding  # placeholder; we use string formatting
    formatted_schema = schema

    # Create schema first
    sql = SCHEMA_SQL.format(schema=formatted_schema)
    if verbose:
        print(sql)
    if not dry_run:
        with conn.cursor() as cur:
            cur.execute(sql)
        conn.commit()
        logger.info("Schema '%s' ensured.", formatted_schema)

    for table_name, ddl in ALL_TABLES:
        full_ddl = ddl.format(schema=formatted_schema)

        if drop:
            drop_sql = f"DROP TABLE IF EXISTS {formatted_schema}.{table_name} CASCADE;"
            if verbose:
                print(f"-- Dropping {table_name} --")
                print(drop_sql)
            if not dry_run:
                with conn.cursor() as cur:
                    cur.execute(drop_sql)
                conn.commit()
                logger.info("Table '%s.%s' dropped.", formatted_schema, table_name)

        if verbose:
            print(f"-- Creating {table_name} --")
            print(full_ddl)

        if not dry_run:
            try:
                with conn.cursor() as cur:
                    cur.execute(full_ddl)
                conn.commit()
                logger.info("Table '%s.%s' ready.", formatted_schema, table_name)
            except Exception as exc:
                conn.rollback()
                logger.error("Failed to create table '%s': %s", table_name, exc)
                raise


def main():
    parser = argparse.ArgumentParser(
        description="InsightHub Crawler — Database Setup",
    )
    parser.add_argument(
        "--drop", action="store_true", help="DROP existing tables before creating"
    )
    parser.add_argument(
        "--dry-run", action="store_true", help="Only print SQL, don't execute"
    )
    parser.add_argument(
        "--verbose", action="store_true", help="Print all SQL statements"
    )
    parser.add_argument(
        "--schema",
        type=str,
        default=os.getenv("DB_SCHEMA", "public"),
        help="Database schema (default: public)",
    )

    args = parser.parse_args()

    # Test connection
    try:
        conn = get_connection()
    except Exception as exc:
        logger.error("Cannot connect to database: %s", exc)
        logger.error(
            "Check your .env or environment variables (DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD)"
        )
        sys.exit(1)

    success = test_connection(conn)
    if not success:
        conn.close()
        sys.exit(1)

    # Create tables
    try:
        create_tables(
            conn,
            schema=args.schema,
            dry_run=args.dry_run,
            verbose=args.verbose,
            drop=args.drop,
        )
    except Exception as exc:
        logger.error("Table creation failed: %s", exc)
        conn.close()
        sys.exit(1)

    # Final verification
    if not args.dry_run:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = %s
                  AND table_type = 'BASE TABLE'
                ORDER BY table_name;
            """,
                (args.schema,),
            )
            tables = [row[0] for row in cur.fetchall()]
        logger.info("Tables in schema '%s': %s", args.schema, ", ".join(tables))

    conn.close()
    logger.info("Database setup complete.")


if __name__ == "__main__":
    main()
