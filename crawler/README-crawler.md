# InsightHub Crawler Framework

Scrapy-based data crawler for the InsightHub AI data platform.

## Quick Start

```bash
# 1. Install dependencies
cd /path/to/InsightHub3
pip install -r crawler/requirements.txt

# 2. Set up environment (optional)
cp .env.example .env
# Edit DB_HOST, DB_NAME, DB_USER, DB_PASSWORD

# 3. Create database tables
python crawler/db_setup.py

# 4. Run a spider (dev mode — uses mock data)
python crawler/run_spider.py gdelt_news --dev
python crawler/run_spider.py world_bank --dev
python crawler/run_spider.py uspto_patents --dev
python crawler/run_spider.py arxiv_papers --dev
python crawler/run_spider.py public_company --dev
```

## Available Spiders

| Spider | Source | Data Type |
|---|---|---|
| `gdelt_news` | GDELT 2.0 API | Global news with sentiment |
| `world_bank` | World Bank API | Economic indicators (GDP, inflation, etc.) |
| `uspto_patents` | USPTO Open Data API | Patent search |
| `arxiv_papers` | arXiv API | Academic research papers |
| `public_company` | Template (企查查/天眼查/Crunchbase) | Company profiles |

## Usage

### Run a single spider

```bash
python crawler/run_spider.py <spider_name> -a key=value -a key=value [--dev]
```

Examples:

```bash
# GDELT news — search for AI startup news
python crawler/run_spider.py gdelt_news -a query="AI startup" -a max_records=50

# World Bank — get GDP and inflation for US and China
python crawler/run_spider.py world_bank -a indicators=GDP,inflation -a countries=US,CN

# USPTO patents — search for blockchain patents
python crawler/run_spider.py uspto_patents -a query="blockchain" -a max_pages=3

# arXiv papers — latest ML papers
python crawler/run_spider.py arxiv_papers -a query="deep learning" -a max_results=30

# List all spiders
python crawler/run_spider.py --list
```

### Run via scheduler (cron/Airflow)

```bash
# Run all spiders sequentially
python crawler/crawl_scheduler.py --all

# Run specific spiders
python crawler/crawl_scheduler.py --spiders gdelt_news,world_bank

# Dry run
python crawler/crawl_scheduler.py --all --dry-run
```

### Database setup

```bash
# Create tables (safe — IF NOT EXISTS)
python crawler/db_setup.py

# Verbose mode (prints SQL)
python crawler/db_setup.py --verbose

# Drop and recreate (DANGER)
python crawler/db_setup.py --drop
```

### Direct Scrapy commands

```bash
# Scrapy crawl
scrapy crawl gdelt_news -a query="AI"

# Shell
scrapy shell https://api.gdeltproject.org/api/v2/doc/doc?query=AI&format=json
```

## Output

- **Database**: Items are stored in PostgreSQL tables (market_news, financial_indicators, patents, etc.)
- **JSON fallback**: Results are also written to `output/<spider>_<timestamp>.jsonl`
- **Dev mode**: Uses built-in mock data — no external API calls needed

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DB_HOST` | localhost | PostgreSQL host |
| `DB_PORT` | 5432 | PostgreSQL port |
| `DB_NAME` | insighthub | Database name |
| `DB_USER` | insighthub | Database user |
| `DB_PASSWORD` | insighthub | Database password |
| `DB_SCHEMA` | public | Database schema |
| `CRAWL_DEV_MODE` | false | Use mock data when true |
| `CRAWL_OUTPUT_DIR` | output | JSON output directory |
| `COMPANY_API_KEY` | — | API key for company data (public_company spider) |
| `COMPANY_API_BASE` | — | API base URL for company data |
