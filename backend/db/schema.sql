-- InsightHub Data - Database Schema
-- PostgreSQL

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- Core Tables
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key VARCHAR(64) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    revoked BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS subscription_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    price_monthly DECIMAL(10,2) NOT NULL,
    price_yearly DECIMAL(10,2) NOT NULL,
    requests_per_month INTEGER NOT NULL,
    requests_per_minute INTEGER NOT NULL,
    features JSONB DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES subscription_plans(id),
    status VARCHAR(50) DEFAULT 'active',
    current_period_start TIMESTAMPTZ DEFAULT NOW(),
    current_period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS usage_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    api_key_id UUID REFERENCES api_keys(id),
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    status_code INTEGER NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS data_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    update_frequency VARCHAR(100),
    status VARCHAR(50) DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS crawl_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    data_source_id UUID REFERENCES data_sources(id),
    status VARCHAR(50) DEFAULT 'pending',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    items_count INTEGER DEFAULT 0,
    error_log TEXT
);

-- ============================================================
-- Content Tables (one per data package)
-- ============================================================

-- Startup Intel / AI Geo: Market News & Analysis
CREATE TABLE IF NOT EXISTS market_news (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(500) NOT NULL,
    summary TEXT,
    content TEXT,
    source VARCHAR(255),
    url VARCHAR(1000),
    industry VARCHAR(255),
    region VARCHAR(255),
    tags JSONB DEFAULT '[]',
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enterprise Risk: Company Profiles
CREATE TABLE IF NOT EXISTS company_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_name VARCHAR(500) NOT NULL,
    registration_number VARCHAR(100),
    legal_representative VARCHAR(255),
    registered_capital VARCHAR(100),
    established_date DATE,
    industry VARCHAR(255),
    region VARCHAR(255),
    address TEXT,
    business_scope TEXT,
    risk_score DECIMAL(5,2) DEFAULT 0,
    risk_level VARCHAR(50) DEFAULT 'normal',
    risk_details JSONB DEFAULT '[]',
    credit_code VARCHAR(100),
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Finance Macro: Financial Indicators
CREATE TABLE IF NOT EXISTS financial_indicators (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    indicator_name VARCHAR(500) NOT NULL,
    indicator_code VARCHAR(100),
    country VARCHAR(255),
    region VARCHAR(255),
    value DECIMAL(20,4),
    unit VARCHAR(100),
    period VARCHAR(50),
    frequency VARCHAR(50),
    source VARCHAR(255),
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Patent Tech: Patents
CREATE TABLE IF NOT EXISTS patents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patent_number VARCHAR(100) UNIQUE NOT NULL,
    title VARCHAR(1000) NOT NULL,
    abstract TEXT,
    assignee VARCHAR(500),
    inventors JSONB DEFAULT '[]',
    filing_date DATE,
    publication_date DATE,
    cpc_class VARCHAR(255),
    ipc_class VARCHAR(255),
    status VARCHAR(100),
    country VARCHAR(100),
    claims_count INTEGER,
    citations_count INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Policy Bidding: Policy Documents
CREATE TABLE IF NOT EXISTS policy_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(1000) NOT NULL,
    document_number VARCHAR(200),
    issuing_body VARCHAR(500),
    region VARCHAR(255),
    type VARCHAR(100),
    status VARCHAR(100),
    publish_date DATE,
    effective_date DATE,
    summary TEXT,
    content TEXT,
    category VARCHAR(255),
    bidding_deadline TIMESTAMPTZ,
    budget_amount DECIMAL(15,2),
    contact_info TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Education: Educational Data
CREATE TABLE IF NOT EXISTS educational_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_name VARCHAR(500) NOT NULL,
    country VARCHAR(255),
    region VARCHAR(255),
    level VARCHAR(100),
    subject VARCHAR(255),
    program_name VARCHAR(500),
    degree_type VARCHAR(100),
    duration VARCHAR(100),
    tuition_fees DECIMAL(12,2),
    language VARCHAR(100),
    ranking INTEGER,
    description TEXT,
    website VARCHAR(500),
    application_deadline DATE,
    intake_year INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Web3 Crypto: Web3 & Crypto Data
CREATE TABLE IF NOT EXISTS web3_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(500) NOT NULL,
    symbol VARCHAR(50),
    type VARCHAR(100),
    chain VARCHAR(255),
    token_address VARCHAR(255),
    market_cap DECIMAL(20,2),
    price DECIMAL(20,8),
    volume_24h DECIMAL(20,2),
    circulating_supply DECIMAL(20,2),
    total_supply DECIMAL(20,2),
    description TEXT,
    website VARCHAR(500),
    whitepaper_url VARCHAR(500),
    tags JSONB DEFAULT '[]',
    launched_date DATE,
    risk_score VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key ON api_keys(key);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_usage_logs_user_id ON usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_timestamp ON usage_logs(timestamp);

CREATE INDEX IF NOT EXISTS idx_market_news_industry ON market_news(industry);
CREATE INDEX IF NOT EXISTS idx_market_news_region ON market_news(region);
CREATE INDEX IF NOT EXISTS idx_market_news_published_at ON market_news(published_at);

CREATE INDEX IF NOT EXISTS idx_company_profiles_industry ON company_profiles(industry);
CREATE INDEX IF NOT EXISTS idx_company_profiles_region ON company_profiles(region);
CREATE INDEX IF NOT EXISTS idx_company_profiles_risk_level ON company_profiles(risk_level);

CREATE INDEX IF NOT EXISTS idx_financial_indicators_country ON financial_indicators(country);
CREATE INDEX IF NOT EXISTS idx_financial_indicators_code ON financial_indicators(indicator_code);
CREATE INDEX IF NOT EXISTS idx_financial_indicators_period ON financial_indicators(period);

CREATE INDEX IF NOT EXISTS idx_patents_assignee ON patents(assignee);
CREATE INDEX IF NOT EXISTS idx_patents_cpc_class ON patents(cpc_class);
CREATE INDEX IF NOT EXISTS idx_patents_filing_date ON patents(filing_date);

CREATE INDEX IF NOT EXISTS idx_policy_documents_region ON policy_documents(region);
CREATE INDEX IF NOT EXISTS idx_policy_documents_type ON policy_documents(type);
CREATE INDEX IF NOT EXISTS idx_policy_documents_status ON policy_documents(status);

CREATE INDEX IF NOT EXISTS idx_educational_data_country ON educational_data(country);
CREATE INDEX IF NOT EXISTS idx_educational_data_level ON educational_data(level);
CREATE INDEX IF NOT EXISTS idx_educational_data_subject ON educational_data(subject);

CREATE INDEX IF NOT EXISTS idx_web3_data_chain ON web3_data(chain);
CREATE INDEX IF NOT EXISTS idx_web3_data_type ON web3_data(type);

-- ============================================================
-- Seed subscription plans
-- ============================================================

INSERT INTO subscription_plans (name, code, price_monthly, price_yearly, requests_per_month, requests_per_minute, features)
VALUES
    ('免费版', 'free', 0, 0, 1000, 10, '["基础数据访问", "每日10次API调用", "社区支持"]'),
    ('专业版', 'pro', 299, 2990, 50000, 100, '["全部数据包访问", "高级搜索过滤", "AI报告生成", "邮件支持", "API密钥管理"]'),
    ('企业版', 'enterprise', 999, 9990, 500000, 1000, '["全部数据包访问", "高级搜索过滤", "AI报告生成", "优先技术支持", "自定义集成", "SLA保障", "专属客户经理"]')
ON CONFLICT (code) DO NOTHING;

INSERT INTO data_sources (name, code, description, update_frequency, status)
VALUES
    ('创业商业情报', 'startup-intel', '全球创业公司、投融资动态、市场趋势分析', '每日更新', 'active'),
    ('企业风控', 'enterprise-risk', '企业信用评级、风险预警、经营异常监控', '每日更新', 'active'),
    ('金融宏观', 'finance-macro', '宏观经济指标、利率汇率、市场指数', '实时更新', 'active'),
    ('专利科技', 'patent-tech', '全球专利数据、技术创新趋势、专利分析', '每周更新', 'active'),
    ('政策招投标', 'policy-bidding', '政策文件、招投标公告、政府项目信息', '每日更新', 'active'),
    ('AI / GEO 分析', 'ai-geo', 'AI行业动态、地理空间数据、区域经济分析', '每日更新', 'active'),
    ('教育', 'education', '全球教育机构、课程项目、学术资源数据', '每周更新', 'active'),
    ('Web3 / Crypto', 'web3-crypto', '加密货币市场、链上数据、DeFi项目分析', '实时更新', 'active')
ON CONFLICT (code) DO NOTHING;
