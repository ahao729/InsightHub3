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
    updated_at TIMESTAMPTZ DEFAULT NOW(),
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

-- ============================================================
-- Token Usage Tracking
-- ============================================================

CREATE TABLE IF NOT EXISTS token_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    model VARCHAR(255) NOT NULL,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER NOT NULL DEFAULT 0,
    cost_usd DECIMAL(12,6) NOT NULL DEFAULT 0,
    task_type VARCHAR(100) DEFAULT 'general',
    package_code VARCHAR(50),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_token_usage_user_id ON token_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_token_usage_timestamp ON token_usage(timestamp);
CREATE INDEX IF NOT EXISTS idx_token_usage_task_type ON token_usage(task_type);
CREATE INDEX IF NOT EXISTS idx_token_usage_package ON token_usage(package_code);
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
-- InsightHub Data - Seed Data
-- Realistic seed data for all 8 data packages
-- Compatible with the schema.sql table definitions

-- ============================================================
-- Seed market_news (Startup Intel & AI Geo)
-- ============================================================

INSERT INTO market_news (id, title, summary, source, industry, region, tags, published_at, created_at) VALUES
    ('a0000000-0000-0000-0000-000000000001', '深度求索DeepSeek完成新一轮10亿美元融资，估值达85亿美元', '人工智能大模型公司深度求索（DeepSeek）宣布完成新一轮融资，估值达到85亿美元。本轮融资由多家一线风投机构参与，资金将用于下一代AI模型的研发和算力基础设施建设。', '36氪', '人工智能', '中国', '["AI", "大模型", "融资", "DeepSeek"]', '2026-06-25T08:00:00Z', '2026-06-25T08:30:00Z'),
    ('a0000000-0000-0000-0000-000000000002', '新能源电池公司固态能源获5.5亿元B轮融资', '专注于固态电池研发的固态能源科技宣布完成5.5亿元人民币B轮融资，由蔚来资本领投，宁德时代跟投。公司计划2027年实现固态电池量产。', '投资界', '新能源', '中国', '["新能源", "电池", "固态电池", "融资"]', '2026-06-24T06:00:00Z', '2026-06-24T06:30:00Z'),
    ('a0000000-0000-0000-0000-000000000003', 'OpenAI发布GPT-5：推理能力大幅提升，数学竞赛成绩超越人类', 'OpenAI正式发布GPT-5模型，在数学推理、代码生成和多模态理解方面取得显著突破。在多项基准测试中，GPT-5的表现超越了此前所有模型。', 'TechCrunch', '人工智能', '美国', '["AI", "GPT-5", "OpenAI", "大模型"]', '2026-06-20T14:00:00Z', '2026-06-20T14:30:00Z'),
    ('a0000000-0000-0000-0000-000000000004', '生物科技公司基因编辑疗法获FDA突破性疗法认定', '北京华大基因旗下子公司开发的基因编辑疗法BG-101获得美国FDA突破性疗法认定，用于治疗罕见遗传性血液疾病。这是中国首个获得该认定的基因编辑疗法。', '医药经济报', '生物医药', '中国', '["基因编辑", "FDA", "生物科技", "医药"]', '2026-06-18T09:00:00Z', '2026-06-18T09:30:00Z'),
    ('a0000000-0000-0000-0000-000000000005', '星箭科技成功发射可回收火箭，开启商业航天新篇章', '民营航天企业星箭科技成功完成"星云-3"可回收火箭的发射和回收任务，成为全球第三家掌握轨道级火箭回收技术的公司。', '航天新闻', '商业航天', '中国', '["航天", "火箭回收", "商业航天", "星箭科技"]', '2026-06-15T11:00:00Z', '2026-06-15T11:30:00Z'),
    ('a0000000-0000-0000-0000-000000000006', '量子计算创企QuanTech完成2亿美元C轮融资', '英国量子计算公司QuanTech宣布完成2亿美元C轮融资，投资者包括Google Ventures和软银愿景基金。公司计划在2027年推出1000量子比特的量子计算机。', 'Financial Times', '量子计算', '英国', '["量子计算", "QuanTech", "融资", "C轮"]', '2026-06-12T10:00:00Z', '2026-06-12T10:30:00Z'),
    ('a0000000-0000-0000-0000-000000000007', '自动驾驶公司小马智行获准在广州开展全无人商业化运营', '小马智行（Pony.ai）获得广州市政府批准，将在南沙区开展全无人自动驾驶出租车商业化运营服务，成为国内首批获此许可的企业。', '汽车之家', '自动驾驶', '中国', '["自动驾驶", "小马智行", "商业化", "无人驾驶"]', '2026-06-10T08:00:00Z', '2026-06-10T08:30:00Z'),
    ('a0000000-0000-0000-0000-000000000008', 'SaaS平台聚水潭启动港股IPO，拟募资约5亿美元', '电商SaaS服务商聚水潭向港交所提交上市申请，计划募资约5亿美元。公司2025年ARR突破15亿元人民币，是国内最大的电商ERP服务商之一。', '港交所公告', 'SaaS', '中国', '["IPO", "SaaS", "电商", "聚水潭"]', '2026-06-08T07:00:00Z', '2026-06-08T07:30:00Z'),
    ('a0000000-0000-0000-0000-000000000009', '合成生物学公司微光科技获3亿元A轮融资', '合成生物学初创公司微光科技完成3亿元A轮融资，由红杉中国领投。公司利用AI驱动的蛋白质设计平台开发新型工业酶制剂。', '生物谷', '合成生物学', '中国', '["合成生物学", "AI", "蛋白质设计", "A轮"]', '2026-06-05T09:00:00Z', '2026-06-05T09:30:00Z'),
    ('a0000000-0000-0000-0000-000000000010', '2026年上半年全球AI领域投融资报告：总额超450亿美元', 'CBInsights发布2026年上半年AI领域投融资报告，全球AI初创公司融资总额超过450亿美元，同比增长35%。生成式AI仍是最热门赛道。', 'CBInsights', '人工智能', '全球', '["AI", "投融资", "报告", "2026"]', '2026-06-01T12:00:00Z', '2026-06-01T12:30:00Z'),
    ('a0000000-0000-0000-0000-000000000011', 'RISC-V芯片设计公司赛昉科技获6亿元战略投资', 'RISC-V架构芯片设计公司赛昉科技获得6亿元战略投资，投资方包括中芯聚源、华为哈勃等。新一代高性能RISC-V处理器预计年底流片。', '电子工程时报', '半导体', '中国', '["RISC-V", "芯片", "半导体", "战略投资"]', '2026-05-28T10:00:00Z', '2026-05-28T10:30:00Z'),
    ('a0000000-0000-0000-0000-000000000012', '印尼电商平台Bukalapak完成5亿美元Pre-IPO融资', '印尼电商平台Bukalapak完成上市前最后一轮5亿美元融资，估值达60亿美元。公司计划年底前在纳斯达克上市。', 'Bloomberg', '电商', '东南亚', '["电商", "东南亚", "Bukalapak", "Pre-IPO"]', '2026-05-25T07:00:00Z', '2026-05-25T07:30:00Z')
ON CONFLICT (id) DO NOTHING;

-- AI Geo specific entries (also in market_news)
INSERT INTO market_news (id, title, summary, source, industry, region, tags, published_at, created_at) VALUES
    ('a0000000-0000-0000-0000-000000000013', '2026年全球AI芯片市场规模突破800亿美元', '根据IDC最新报告，2026年全球AI芯片市场规模预计达到820亿美元，同比增长45%。GPU仍占主导地位，但ASIC和存算一体芯片增速更快。', 'IDC', 'AI芯片', '全球', '["AI芯片", "GPU", "ASIC", "市场规模"]', '2026-06-24T08:00:00Z', '2026-06-24T08:30:00Z'),
    ('a0000000-0000-0000-0000-000000000014', '中国建成全球最大AI算力网络，总算力超500EFLOPS', '国家算力网络工程宣布，"东数西算"八大枢纽节点已全部建成投产，总算力规模超过500EFLOPS，赋能千行百业智能化转型。', '工信部', '算力基础设施', '中国', '["算力网络", "东数西算", "AI算力", "基础设施"]', '2026-06-22T10:00:00Z', '2026-06-22T10:30:00Z'),
    ('a0000000-0000-0000-0000-000000000015', 'Google发布Gemini 3.0：多模态能力全面升级', 'Google正式发布Gemini 3.0大模型，在视频理解、3D空间感知、实时翻译等能力上实现重大突破，支持长达1小时的视频内容分析。', 'Google AI Blog', '人工智能', '美国', '["Gemini", "Google", "多模态", "大模型"]', '2026-06-20T16:00:00Z', '2026-06-20T16:30:00Z'),
    ('a0000000-0000-0000-0000-000000000016', '粤港澳大湾区智慧城市群建设进展报告', '广东省发布粤港澳大湾区智慧城市群建设中期报告，已建成5G基站超30万个，智慧交通、智慧医疗、智慧政务等应用全面铺开，数字经济规模突破8万亿元。', '广东省政府', '智慧城市', '粤港澳大湾区', '["粤港澳", "智慧城市", "5G", "数字经济"]', '2026-06-18T09:00:00Z', '2026-06-18T09:30:00Z'),
    ('a0000000-0000-0000-0000-000000000017', '高分辨率遥感卫星"天眸-5"成功发射，分辨率达0.3米', '中国商业遥感卫星"天眸-5"在酒泉卫星发射中心成功发射，最高分辨率达到0.3米，将服务于城市规划、农业监测、灾害评估等领域。', '航天科技集团', '遥感卫星', '中国', '["遥感卫星", "高分辨率", "商业航天", "地理空间"]', '2026-06-15T11:00:00Z', '2026-06-15T11:30:00Z'),
    ('a0000000-0000-0000-0000-000000000018', 'Meta发布开源多语言AI模型，支持200种语言', 'Meta发布开源多语言大模型NLLB-3.0，支持200种语言之间的互译和文本理解，特别覆盖了50种低资源语言，推动AI普惠。', 'Meta AI', '人工智能', '美国', '["Meta", "开源", "多语言", "NLLB"]', '2026-06-12T14:00:00Z', '2026-06-12T14:30:00Z'),
    ('a0000000-0000-0000-0000-000000000019', '长三角数字经济一体化发展白皮书发布', '长三角三省一市联合发布数字经济一体化发展白皮书，提出共建数字基础设施、共享数据要素市场、协同数字产业发展等六大行动。', '上海市发改委', '数字经济', '长三角', '["长三角", "数字经济", "一体化", "白皮书"]', '2026-06-10T08:00:00Z', '2026-06-10T08:30:00Z'),
    ('a0000000-0000-0000-0000-000000000020', 'AI驱动的蛋白质结构预测突破：一天预测10万种蛋白质结构', 'DeepMind联合多家机构发布新一代AlphaFold 4，利用扩散模型将蛋白质结构预测速度提升了100倍，一天可预测10万种蛋白质结构。', 'Nature', 'AI+生物', '英国', '["AlphaFold", "蛋白质", "AI", "DeepMind"]', '2026-06-08T18:00:00Z', '2026-06-08T18:30:00Z'),
    ('a0000000-0000-0000-0000-000000000021', '东南亚数字经济发展报告：2030年GDP贡献将达1万亿美元', 'Google、Temasek和Bain联合发布2026年东南亚数字经济报告，预计到2030年数字经济对东南亚GDP贡献将达到1万亿美元，电商和金融科技是主要驱动力。', 'Google-Temasek-Bain', '数字经济', '东南亚', '["东南亚", "数字经济", "电商", "金融科技"]', '2026-06-05T10:00:00Z', '2026-06-05T10:30:00Z'),
    ('a0000000-0000-0000-0000-000000000022', '全国首个城市级数字孪生平台在雄安上线', '雄安新区正式上线全国首个城市级数字孪生平台，实现现实城市与数字城市的同步规划、同步建设、同步运行，为智慧城市建设树立标杆。', '雄安新区管委会', '数字孪生', '雄安', '["数字孪生", "雄安", "智慧城市", "数字城市"]', '2026-06-01T09:00:00Z', '2026-06-01T09:30:00Z')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Seed company_profiles (Enterprise Risk)
-- ============================================================

INSERT INTO company_profiles (id, company_name, registration_number, legal_representative, registered_capital, established_date, industry, region, address, business_scope, risk_score, risk_level, risk_details, credit_code, status, created_at) VALUES
    ('b0000000-0000-0000-0000-000000000001', '北京字节跳动科技有限公司', '91110108MA01XXXXXX', '张一鸣', '10000万元人民币', '2012-03-09', '互联网科技', '北京', '北京市海淀区知春路甲48号', '技术开发、技术推广、技术服务；计算机系统服务；数据处理', 15, 'low', '[]', '91110108MA01XXXXXX', 'active', '2026-06-25T00:00:00Z'),
    ('b0000000-0000-0000-0000-000000000002', '杭州阿里巴巴网络科技有限公司', '91330100MA2XXXXXX', '吴泳铭', '50000万元人民币', '2014-08-28', '电子商务', '浙江', '浙江省杭州市余杭区文一西路969号', '网络技术服务；计算机软硬件开发；电子商务平台运营', 22, 'low', '[]', '91330100MA2XXXXXX', 'active', '2026-06-24T00:00:00Z'),
    ('b0000000-0000-0000-0000-000000000003', '深圳前海微众银行股份有限公司', '91440300MA5XXXXXX', '顾敏', '420000万元人民币', '2014-12-16', '金融科技', '广东', '深圳市前海深港合作区南山街道', '吸收公众存款；发放贷款；办理国内外结算', 45, 'medium', '[{"category": "不良贷款率", "value": "2.3%", "trend": "up"}, {"category": "资本充足率", "value": "12.5%", "trend": "stable"}]', '91440300MA5XXXXXX', 'active', '2026-06-23T00:00:00Z'),
    ('b0000000-0000-0000-0000-000000000004', '上海绿地房地产开发有限公司', '91310115MA1XXXXXX', '张玉良', '300000万元人民币', '1992-07-18', '房地产', '上海', '上海市黄浦区淮海中路300号', '房地产开发与经营；物业管理；房地产咨询', 72, 'high', '[{"category": "负债率", "value": "85.7%", "trend": "up"}, {"category": "诉讼数量", "value": "12", "trend": "up"}, {"category": "被执行人", "value": "是", "trend": "up"}]', '91310115MA1XXXXXX', 'active', '2026-06-22T00:00:00Z'),
    ('b0000000-0000-0000-0000-000000000005', '广州恒大材料设备有限公司', '91440101MA5XXXXXX', '许家印', '500000万元人民币', '2007-04-08', '建材贸易', '广东', '广州市天河区黄埔大道西78号', '建筑材料销售；设备租赁；供应链管理', 95, 'critical', '[{"category": "负债率", "value": "128%", "trend": "up"}, {"category": "诉讼数量", "value": "47", "trend": "up"}, {"category": "被执行人", "value": "是", "trend": "up"}, {"category": "失信被执行人", "value": "是", "trend": "up"}]', '91440101MA5XXXXXX', 'active', '2026-06-21T00:00:00Z'),
    ('b0000000-0000-0000-0000-000000000006', '宁德时代新能源科技股份有限公司', '91350900MA2XXXXXX', '曾毓群', '230000万元人民币', '2011-12-16', '新能源', '福建', '福建省宁德市蕉城区漳湾镇新港路2号', '锂离子电池研发、生产、销售', 12, 'low', '[]', '91350900MA2XXXXXX', 'active', '2026-06-20T00:00:00Z'),
    ('b0000000-0000-0000-0000-000000000007', '深圳市柔宇科技股份有限公司', '91440300MA5XXXXXX', '刘自鸿', '120000万元人民币', '2012-05-08', '显示技术', '广东', '深圳市龙岗区坪地街道柔宇国际柔性显示产业园', '柔性显示屏研发生产', 88, 'critical', '[{"category": "欠薪情况", "value": "6个月", "trend": "up"}, {"category": "诉讼数量", "value": "23", "trend": "up"}, {"category": "资产冻结", "value": "是", "trend": "up"}]', '91440300MA5XXXXXX', 'active', '2026-06-19T00:00:00Z'),
    ('b0000000-0000-0000-0000-000000000008', '中芯国际集成电路制造有限公司', '91310000MA1XXXXXX', '刘训峰', '790000万元人民币', '2000-04-03', '半导体', '上海', '上海市浦东新区张江路18号', '集成电路制造与代工服务', 35, 'medium', '[{"category": "产能利用率", "value": "85%", "trend": "stable"}, {"category": "技术节点", "value": "7nm", "trend": "up"}]', '91310000MA1XXXXXX', 'active', '2026-06-18T00:00:00Z'),
    ('b0000000-0000-0000-0000-000000000009', '北京旷视科技有限公司', '91110108MA0XXXXXX', '印奇', '5000万元人民币', '2011-10-20', '人工智能', '北京', '北京市海淀区中关村大街1号', '人工智能技术开发、计算机视觉', 28, 'low', '[{"category": "知识产权诉讼", "value": "3", "trend": "stable"}]', '91110108MA0XXXXXX', 'active', '2026-06-17T00:00:00Z'),
    ('b0000000-0000-0000-0000-000000000010', '上海蔚来汽车有限公司', '91310115MA1KXXXXXX', '李斌', '100000万元人民币', '2014-11-25', '新能源汽车', '上海', '上海市嘉定区安亭镇安拓路56号', '新能源汽车研发制造销售', 50, 'medium', '[{"category": "净亏损", "value": "45亿元", "trend": "down"}, {"category": "交付量", "value": "18万辆/年", "trend": "up"}]', '91310115MA1KXXXXXX', 'active', '2026-06-16T00:00:00Z'),
    ('b0000000-0000-0000-0000-000000000011', '华为技术有限公司', '9144030027XXXXXX', '梁华', '4030811万元人民币', '1987-09-15', '通信技术', '广东', '深圳市龙岗区坂田华为基地', '通信设备、消费电子、云计算', 18, 'low', '[]', '9144030027XXXXXX', 'active', '2026-06-15T00:00:00Z'),
    ('b0000000-0000-0000-0000-000000000012', '科大讯飞股份有限公司', '9134010014XXXXXX', '刘庆峰', '230000万元人民币', '1999-12-30', '人工智能', '安徽', '合肥市高新开发区望江西路666号', '智能语音及人工智能技术', 25, 'low', '[]', '9134010014XXXXXX', 'active', '2026-06-14T00:00:00Z')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Seed financial_indicators (Finance Macro)
-- ============================================================

INSERT INTO financial_indicators (id, indicator_name, indicator_code, country, region, value, unit, period, frequency, source, published_at, created_at) VALUES
    ('c0000000-0000-0000-0000-000000000001', '国内生产总值 (GDP) - 中国', 'GDP.CN', '中国', '亚洲', 181000.00, '十亿美元', '2025', 'yearly', '国家统计局', '2026-01-20T00:00:00Z', '2026-01-20T00:00:00Z'),
    ('c0000000-0000-0000-0000-000000000002', '国内生产总值 (GDP) - 美国', 'GDP.US', '美国', '北美洲', 289000.00, '十亿美元', '2025', 'yearly', 'BEA', '2026-01-30T00:00:00Z', '2026-01-30T00:00:00Z'),
    ('c0000000-0000-0000-0000-000000000003', '消费者物价指数 (CPI) - 中国', 'CPI.CN', '中国', '亚洲', 100.80, '指数', '2026-05', 'monthly', '国家统计局', '2026-06-10T00:00:00Z', '2026-06-10T00:00:00Z'),
    ('c0000000-0000-0000-0000-000000000004', '消费者物价指数 (CPI) - 美国', 'CPI.US', '美国', '北美洲', 315.20, '指数', '2026-05', 'monthly', 'BLS', '2026-06-12T00:00:00Z', '2026-06-12T00:00:00Z'),
    ('c0000000-0000-0000-0000-000000000005', '人民币兑美元中间价', 'CNY.USD', '中国', '亚洲', 7.14, 'CNY/USD', '2026-06-25', 'daily', '中国人民银行', '2026-06-25T09:15:00Z', '2026-06-25T09:15:00Z'),
    ('c0000000-0000-0000-0000-000000000006', '美元指数', 'USDX', '美国', '全球', 102.35, '指数', '2026-06-25', 'daily', 'ICE', '2026-06-25T20:00:00Z', '2026-06-25T20:00:00Z'),
    ('c0000000-0000-0000-0000-000000000007', '一年期LPR利率', 'LPR.1Y.CN', '中国', '亚洲', 3.45, '%', '2026-06', 'monthly', '中国人民银行', '2026-06-20T09:00:00Z', '2026-06-20T09:00:00Z'),
    ('c0000000-0000-0000-0000-000000000008', '联邦基金利率', 'FEDFUNDS.US', '美国', '北美洲', 4.25, '%', '2026-06', 'monthly', 'Federal Reserve', '2026-06-19T14:00:00Z', '2026-06-19T14:00:00Z'),
    ('c0000000-0000-0000-0000-000000000009', '上证综合指数', 'SHCOMP', '中国', '亚洲', 3245.78, '点', '2026-06-25', 'daily', '上海证券交易所', '2026-06-25T15:00:00Z', '2026-06-25T15:00:00Z'),
    ('c0000000-0000-0000-0000-000000000010', '标普500指数', 'SPX', '美国', '北美洲', 5678.32, '点', '2026-06-24', 'daily', 'S&P Global', '2026-06-24T16:00:00Z', '2026-06-24T16:00:00Z'),
    ('c0000000-0000-0000-0000-000000000011', '社会融资规模增量', 'SF.CN', '中国', '亚洲', 3850.00, '十亿元人民币', '2026-05', 'monthly', '中国人民银行', '2026-06-15T10:00:00Z', '2026-06-15T10:00:00Z'),
    ('c0000000-0000-0000-0000-000000000012', '失业率 - 中国 (城镇)', 'UNEMP.CN', '中国', '亚洲', 5.10, '%', '2026-05', 'monthly', '国家统计局', '2026-06-17T10:00:00Z', '2026-06-17T10:00:00Z'),
    ('c0000000-0000-0000-0000-000000000013', '失业率 - 美国', 'UNEMP.US', '美国', '北美洲', 3.80, '%', '2026-05', 'monthly', 'BLS', '2026-06-07T08:30:00Z', '2026-06-07T08:30:00Z'),
    ('c0000000-0000-0000-0000-000000000014', '布伦特原油价格', 'OIL.BRENT', '全球', '全球', 78.50, '美元/桶', '2026-06-25', 'daily', 'ICE', '2026-06-25T20:00:00Z', '2026-06-25T20:00:00Z'),
    ('c0000000-0000-0000-0000-000000000015', '伦敦金价 (黄金)', 'GOLD.LONDON', '全球', '全球', 2345.60, '美元/盎司', '2026-06-25', 'daily', 'LBMA', '2026-06-25T20:00:00Z', '2026-06-25T20:00:00Z')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Seed patents (Patent Tech)
-- ============================================================

INSERT INTO patents (id, patent_number, title, abstract, assignee, inventors, filing_date, publication_date, cpc_class, ipc_class, status, country, claims_count, citations_count, created_at) VALUES
    ('d0000000-0000-0000-0000-000000000001', 'CN114567890A', '一种基于深度学习的自然语言处理方法及系统', '本发明公开了一种基于深度学习的自然语言处理方法，包括：获取输入文本序列，通过预训练语言模型提取语义特征，基于注意力机制对语义特征进行加权处理，生成目标输出。本发明提高了自然语言处理的准确性和效率。', '华为技术有限公司', '["张伟", "李明", "王芳"]', '2025-03-15', '2025-09-20', 'G06N3/08', 'G06N3/08', '公开', '中国', 12, 5, '2025-09-20T00:00:00Z'),
    ('d0000000-0000-0000-0000-000000000002', 'CN114567891A', '固态电池电解质材料及其制备方法', '本发明提供一种固态电池电解质材料，化学式为Li6PS5Cl，采用高能球磨法制备。该材料在室温下离子电导率达到10^(-3)S/cm级别，电化学稳定性窗口达到5V以上。', '宁德时代新能源科技股份有限公司', '["陈立泉", "赵忠尧"]', '2025-05-20', '2025-11-25', 'H01M10/056', 'H01M10/056', '授权', '中国', 8, 15, '2025-11-25T00:00:00Z'),
    ('d0000000-0000-0000-0000-000000000003', 'US20260012345A1', 'Quantum Error Correction Using Surface Codes with Adaptive Decoding', 'A method for quantum error correction using surface codes with adaptive decoding techniques. The method reduces logical error rates by dynamically adjusting decoding parameters based on noise characteristics.', 'Google LLC', '["Hartmut Neven", "John Martinis"]', '2025-08-10', '2026-02-15', 'G06N10/00', 'G06N10/00', '公开', '美国', 20, 8, '2026-02-15T00:00:00Z'),
    ('d0000000-0000-0000-0000-000000000004', 'CN114567892A', '自动驾驶车辆路径规划方法及装置', '本发明提供一种自动驾驶车辆路径规划方法，结合深度强化学习和模型预测控制，在复杂交通场景下实时生成最优行驶轨迹。实验表明该方法在密集车流中的规划成功率提高至98.5%。', '小马智行科技有限公司', '["楼天城", "彭军"]', '2025-06-01', '2025-12-01', 'G05D1/02', 'G05D1/02', '授权', '中国', 15, 12, '2025-12-01T00:00:00Z'),
    ('d0000000-0000-0000-0000-000000000005', 'EP20250012345A1', 'Method for Producing Green Hydrogen Using Photocatalytic Water Splitting', 'A method for producing hydrogen through photocatalytic water splitting using a novel Z-scheme heterojunction photocatalyst comprising BiVO4 and g-C3N4. Solar-to-hydrogen efficiency reaches 8.5%.', 'Siemens Energy AG', '["Klaus Schmidt", "Anna Weber"]', '2025-04-22', '2025-10-30', 'C25B1/04', 'C25B1/04', '审查中', '欧洲', 14, 3, '2025-10-30T00:00:00Z'),
    ('d0000000-0000-0000-0000-000000000006', 'CN114567893A', '基于区块链的数据共享与隐私保护方法', '本发明涉及一种基于区块链的数据共享与隐私保护方法，采用同态加密和零知识证明技术，在保障数据隐私的前提下实现多方数据的安全共享和计算。', '蚂蚁科技集团股份有限公司', '["蒋国飞", "周政"]', '2025-07-15', '2026-01-15', 'H04L9/32', 'H04L9/32', '公开', '中国', 10, 7, '2026-01-15T00:00:00Z'),
    ('d0000000-0000-0000-0000-000000000007', 'JP20260012345A', '半導体レーザー素子及びその製造方法', '高効率な半導体レーザー素子を提供する。活性層にInGaAsP系量子井戸構造を用い、共振器端面に高反射コーティングを施すことで、しきい値電流を低減し、出力効率を向上させる。', 'ソニーグループ株式会社', '["佐藤健一", "田中宏"]', '2025-09-05', '2026-03-05', 'H01S5/00', 'H01S5/00', '公开', '日本', 7, 2, '2026-03-05T00:00:00Z'),
    ('d0000000-0000-0000-0000-000000000008', 'CN114567894A', 'CRISPR-Cas9基因编辑系统及其在治疗遗传性疾病中的应用', '本发明提供了一种改进的CRISPR-Cas9基因编辑系统，通过优化sgRNA设计和Cas9蛋白变体，将脱靶效应降低至传统方法的1/10以下，并在β-地中海贫血小鼠模型中实现了有效的基因治疗。', '北京华大基因研究院', '["汪建", "杨焕明"]', '2025-10-01', '2026-04-01', 'C12N15/113', 'C12N15/113', '审查中', '中国', 18, 20, '2026-04-01T00:00:00Z'),
    ('d0000000-0000-0000-0000-000000000009', 'KR20260012345A', '고효율 태양전지 및 그 제조방법', '페로브스카이트-실리콘 탠덤 태양전지의 효율을 향상시키기 위한 계면층 기술에 관한 발명으로, 33.5%의 인증 효율을 달성하였다.', '삼성전자주식회사', '["김민수", "이지영"]', '2025-11-20', '2026-05-20', 'H01L31/072', 'H01L31/072', '公开', '韩国', 11, 4, '2026-05-20T00:00:00Z'),
    ('d0000000-0000-0000-0000-000000000010', 'CN114567895A', '基于边缘计算的实时视频分析系统', '本发明提供一种基于边缘计算的实时视频分析系统，通过在网络边缘部署轻量化深度学习模型，实现毫秒级视频分析响应，适用于智慧城市、工业质检等场景。', '海康威视数字技术股份有限公司', '["胡扬忠", "邬伟琪"]', '2025-12-10', '2026-06-10', 'H04N7/18', 'H04N7/18', '公开', '中国', 9, 1, '2026-06-10T00:00:00Z'),
    ('d0000000-0000-0000-0000-000000000011', 'CN114567896A', 'mRNA疫苗脂质纳米颗粒递送系统', '本发明提供一种新型可电离脂质及其在mRNA疫苗递送中的应用。该脂质纳米颗粒在体内表现出高效的mRNA递送能力和良好的生物安全性。', '艾博生物科技有限公司', '["英博", "张旭"]', '2025-08-05', '2026-02-05', 'A61K9/51', 'A61K9/51', '公开', '中国', 16, 25, '2026-02-05T00:00:00Z'),
    ('d0000000-0000-0000-0000-000000000012', 'CN114567897A', '大模型训练方法、装置及计算设备', '本发明提供了一种大模型训练方法，采用混合专家模型（MoE）架构和流水线并行策略，支持在千卡规模集群上高效训练万亿参数级别的大语言模型。', '深度求索人工智能基础技术研究有限公司', '["梁文锋", "刘知远"]', '2026-01-15', '2026-06-15', 'G06N3/045', 'G06N3/045', '公开', '中国', 13, 0, '2026-06-15T00:00:00Z')
ON CONFLICT (patent_number) DO NOTHING;

-- ============================================================
-- Seed policy_documents (Policy Bidding)
-- ============================================================

INSERT INTO policy_documents (id, title, document_number, issuing_body, region, type, status, publish_date, effective_date, summary, category, bidding_deadline, budget_amount, contact_info, created_at) VALUES
    ('e0000000-0000-0000-0000-000000000001', '2026年国家新一代人工智能创新发展试验区建设方案', '国科发〔2026〕15号', '科学技术部', '全国', '政策文件', '现行有效', '2026-03-01', '2026-04-01', '为加快推动人工智能创新发展试验区建设，提出新一代人工智能创新发展试验区建设的目标、任务和保障措施。', '科技政策', NULL, NULL, NULL, '2026-03-01T00:00:00Z'),
    ('e0000000-0000-0000-0000-000000000002', '北京市数字经济促进条例（2026年修订）', '北京市人民代表大会常务委员会公告〔2026〕8号', '北京市人民代表大会常务委员会', '北京', '地方法规', '即将生效', '2026-05-15', '2026-07-01', '旨在促进北京市数字经济发展，培育数据要素市场，推动数字产业化与产业数字化。', '数字经济', NULL, NULL, NULL, '2026-05-15T00:00:00Z'),
    ('e0000000-0000-0000-0000-000000000003', '上海市2026年度人工智能算力平台建设项目招标公告', 'SH-ZB-2026-0032', '上海市经济和信息化委员会', '上海', '招标公告', '招标中', '2026-06-10', '2026-06-10', '对2026年度人工智能算力平台建设项目进行公开招标，项目预算金额2.5亿元。', '信息化建设', '2026-07-10T17:00:00Z', 250000000.00, '上海市经信委信息化推进处，电话：021-23111111', '2026-06-10T00:00:00Z'),
    ('e0000000-0000-0000-0000-000000000004', '粤港澳大湾区数据跨境流动安全管理规定', '粤府令〔2026〕第302号', '广东省人民政府', '广东', '政府规章', '征求意见中', '2026-04-20', NULL, '为促进粤港澳大湾区数据安全有序跨境流动，保障数据安全，保护个人信息权益。', '数据安全', NULL, NULL, '广东省司法厅，邮箱：sfj@gd.gov.cn', '2026-04-20T00:00:00Z'),
    ('e0000000-0000-0000-0000-000000000005', '深圳市城市交通数字化转型项目（一期）招标', 'SZ-ZB-2026-0158', '深圳市交通运输局', '深圳', '招标公告', '招标中', '2026-06-15', '2026-06-15', '对城市交通数字化转型项目（一期）进行公开招标，预算金额1.8亿元。', '智慧交通', '2026-07-05T17:00:00Z', 180000000.00, '深圳市交通运输局科技处，电话：0755-83165123', '2026-06-15T00:00:00Z'),
    ('e0000000-0000-0000-0000-000000000006', '关于促进新能源产业高质量发展的若干政策措施', '发改能源〔2026〕456号', '国家发展改革委、国家能源局', '全国', '政策文件', '现行有效', '2026-03-28', '2026-04-28', '从支持关键技术攻关、优化产业布局、完善市场机制、加强国际合作等方面提出20条政策措施。', '新能源', NULL, NULL, NULL, '2026-03-28T00:00:00Z'),
    ('e0000000-0000-0000-0000-000000000007', '浙江省数字化改革"数字乡村"示范项目招标', 'ZJ-ZB-2026-0089', '浙江省农业农村厅', '浙江', '招标公告', '即将招标', '2026-06-20', '2026-06-25', '对"数字乡村"示范项目进行公开招标，预算金额8000万元，覆盖20个示范村。', '数字乡村', '2026-07-20T17:00:00Z', 80000000.00, '浙江省农业农村厅数字化处，电话：0571-86712345', '2026-06-20T00:00:00Z'),
    ('e0000000-0000-0000-0000-000000000008', '2026年国家医保药品目录调整工作方案', '医保发〔2026〕22号', '国家医疗保障局', '全国', '政策文件', '现行有效', '2026-05-10', '2026-06-01', '启动2026年国家医保药品目录调整工作，重点支持创新药、儿童用药、罕见病用药等。', '医疗保障', NULL, NULL, NULL, '2026-05-10T00:00:00Z'),
    ('e0000000-0000-0000-0000-000000000009', '成都市智慧医疗大数据平台建设采购项目', 'CD-ZB-2026-0210', '成都市卫生健康委员会', '四川', '招标公告', '招标中', '2026-06-18', '2026-06-18', '对智慧医疗大数据平台建设进行公开招标，预算金额1.2亿元。', '智慧医疗', '2026-07-15T17:00:00Z', 120000000.00, '成都市卫健委规划信息处，电话：028-61881234', '2026-06-18T00:00:00Z'),
    ('e0000000-0000-0000-0000-000000000010', '数据安全治理能力评估标准（2026年版）', 'T/CESA 1234-2026', '中国电子工业标准化技术协会', '全国', '行业标准', '现行有效', '2026-04-01', '2026-07-01', '规定了组织数据安全治理能力评估的框架、指标和方法。', '数据安全', NULL, NULL, NULL, '2026-04-01T00:00:00Z'),
    ('e0000000-0000-0000-0000-000000000011', '武汉市东湖高新区元宇宙产业培育项目招标', 'WH-ZB-2026-0056', '武汉东湖新技术开发区管委会', '湖北', '招标公告', '招标中', '2026-06-22', '2026-06-22', '对元宇宙产业培育项目进行公开招标，预算金额5000万元。', '元宇宙', '2026-07-12T17:00:00Z', 50000000.00, '东湖高新区科创局，电话：027-67880123', '2026-06-22T00:00:00Z'),
    ('e0000000-0000-0000-0000-000000000012', '关于进一步促进高校毕业生等青年就业创业的若干措施', '国办发〔2026〕18号', '国务院办公厅', '全国', '政策文件', '现行有效', '2026-05-20', '2026-06-01', '从拓宽就业渠道、鼓励创业创新、加强就业服务等方面提出15条措施。', '就业创业', NULL, NULL, NULL, '2026-05-20T00:00:00Z')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Seed educational_data (Education)
-- ============================================================

INSERT INTO educational_data (id, institution_name, country, region, level, subject, program_name, degree_type, duration, tuition_fees, language, ranking, description, website, application_deadline, intake_year, created_at) VALUES
    ('f0000000-0000-0000-0000-000000000001', '清华大学', '中国', '北京', '高等教育', '计算机科学与技术', '计算机科学与技术（人工智能方向）本科项目', '学士', '4年', 50000, '中文', 1, '清华大学计算机科学与技术专业在AI、数据科学等领域具有国际领先水平。', 'https://www.tsinghua.edu.cn', '2026-06-30', 2026, '2026-06-25T00:00:00Z'),
    ('f0000000-0000-0000-0000-000000000002', '北京大学', '中国', '北京', '高等教育', '经济学', '经济学硕士项目（金融科技方向）', '硕士', '2年', 80000, '中文', 2, '北大经济学院与光华管理学院联合培养金融科技高端人才。', 'https://www.pku.edu.cn', '2026-07-15', 2026, '2026-06-24T00:00:00Z'),
    ('f0000000-0000-0000-0000-000000000003', 'Stanford University', '美国', '加利福尼亚州', '高等教育', '人工智能', 'Master of Science in Artificial Intelligence', '硕士', '2年', 65000, '英语', 3, 'Stanford AI program is world-renowned, offering cutting-edge research in machine learning, NLP, and computer vision.', 'https://www.stanford.edu', '2026-12-01', 2027, '2026-06-23T00:00:00Z'),
    ('f0000000-0000-0000-0000-000000000004', '浙江大学', '中国', '浙江', '高等教育', '数据科学', '数据科学与大数据技术本科专业', '学士', '4年', 48000, '中文', 4, '浙大数据科学专业融合计算机、统计和管理学。', 'https://www.zju.edu.cn', '2026-06-30', 2026, '2026-06-22T00:00:00Z'),
    ('f0000000-0000-0000-0000-000000000005', '上海交通大学', '中国', '上海', '高等教育', '生物医学工程', '生物医学工程（医学影像AI方向）博士项目', '博士', '4年', 10000, '中文', 5, '上海交通大学生物医学工程学院在医学影像AI、脑机接口等方向具有国际影响力。', 'https://www.sjtu.edu.cn', '2026-08-31', 2026, '2026-06-21T00:00:00Z'),
    ('f0000000-0000-0000-0000-000000000006', 'Massachusetts Institute of Technology', '美国', '马萨诸塞州', '高等教育', '量子计算', 'PhD in Quantum Computing and Information', '博士', '5年', 58000, '英语', 1, 'MIT offers a world-class PhD program in quantum computing with cutting-edge quantum hardware.', 'https://web.mit.edu', '2026-12-15', 2027, '2026-06-20T00:00:00Z'),
    ('f0000000-0000-0000-0000-000000000007', '复旦大学', '中国', '上海', '高等教育', '微电子', '集成电路科学与工程硕士项目', '硕士', '2.5年', 60000, '中文', 6, '复旦大学微电子学院是国内集成电路人才培养的重要基地。', 'https://www.fudan.edu.cn', '2026-07-31', 2026, '2026-06-19T00:00:00Z'),
    ('f0000000-0000-0000-0000-000000000008', 'National University of Singapore', '新加坡', '新加坡', '高等教育', '数据科学与机器学习', 'Master of Science in Data Science and Machine Learning', '硕士', '1.5年', 55000, '英语', 8, 'NUS DSML program offers rigorous training in statistical modeling and machine learning.', 'https://www.nus.edu.sg', '2027-01-15', 2027, '2026-06-18T00:00:00Z'),
    ('f0000000-0000-0000-0000-000000000009', '中国科学技术大学', '中国', '安徽', '高等教育', '物理学', '量子信息科学本科项目', '学士', '4年', 45000, '中文', 7, '中国科大在量子信息领域处于国际领先地位。', 'https://www.ustc.edu.cn', '2026-06-30', 2026, '2026-06-17T00:00:00Z'),
    ('f0000000-0000-0000-0000-000000000010', 'University of Cambridge', '英国', '英格兰', '高等教育', '人工智能与伦理学', 'MPhil in AI Ethics and Society', '硕士', '1年', 45000, '英语', 2, 'Cambridge offers a unique interdisciplinary program examining the ethical implications of AI.', 'https://www.cam.ac.uk', '2026-11-30', 2027, '2026-06-16T00:00:00Z'),
    ('f0000000-0000-0000-0000-000000000011', '南京大学', '中国', '江苏', '高等教育', '软件工程', '软件工程（智能化软件方向）本科项目', '学士', '4年', 46000, '中文', 9, '南京大学软件学院是国家示范性软件学院。', 'https://www.nju.edu.cn', '2026-06-30', 2026, '2026-06-15T00:00:00Z'),
    ('f0000000-0000-0000-0000-000000000012', 'ETH Zürich', '瑞士', '苏黎世', '高等教育', '机器人学', 'Master in Robotics, Systems and Control', '硕士', '2年', 1500, '英语', 4, 'ETH Zurich offers a world-renowned robotics program with focus on autonomous systems.', 'https://ethz.ch', '2026-12-15', 2027, '2026-06-14T00:00:00Z')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Seed web3_data (Web3 Crypto)
-- ============================================================

INSERT INTO web3_data (id, name, symbol, type, chain, token_address, market_cap, price, volume_24h, circulating_supply, total_supply, description, website, tags, launched_date, risk_score, created_at) VALUES
    ('00000000-0000-0000-0000-000000000001', 'Bitcoin', 'BTC', '加密货币', 'Bitcoin', NULL, 1850000000000, 95680.50, 42000000000, 19350000, 21000000, '比特币是全球第一个去中心化加密货币，由中本聪于2009年创建。采用工作量证明共识机制，被视为数字黄金。', 'https://bitcoin.org', '["加密货币", "数字黄金", "PoW", "去中心化"]', '2009-01-03', 'medium', '2026-06-25T00:00:00Z'),
    ('00000000-0000-0000-0000-000000000002', 'Ethereum', 'ETH', '公链平台', 'Ethereum', NULL, 650000000000, 5420.30, 28000000000, 120000000, NULL, '以太坊是领先的智能合约平台，支持去中心化应用（dApps）和DeFi生态。', 'https://ethereum.org', '["智能合约", "DeFi", "PoS", "Layer1"]', '2015-07-30', 'medium', '2026-06-25T00:00:00Z'),
    ('00000000-0000-0000-0000-000000000003', 'Solana', 'SOL', '公链平台', 'Solana', NULL, 95000000000, 198.45, 5200000000, 479000000, NULL, 'Solana是一条高性能公链，采用历史证明（PoH）机制，理论TPS可达65000。', 'https://solana.com', '["高性能", "Layer1", "DePIN", "PoH"]', '2020-03-16', 'high', '2026-06-24T00:00:00Z'),
    ('00000000-0000-0000-0000-000000000004', 'ChainLink', 'LINK', '预言机', 'Ethereum', '0x514910771AF9Ca656af840dff83E8264EcF986CA', 18500000000, 28.60, 1800000000, 600000000, 1000000000, 'Chainlink是去中心化预言机网络，连接智能合约与真实世界数据。', 'https://chain.link', '["预言机", "CCIP", "跨链", "数据"]', '2019-05-30', 'medium', '2026-06-24T00:00:00Z'),
    ('00000000-0000-0000-0000-000000000005', 'Uniswap', 'UNI', 'DeFi协议', 'Ethereum', '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', 12500000000, 18.20, 850000000, 600000000, 1000000000, 'Uniswap是最大的去中心化交易平台（DEX），采用AMM机制。', 'https://uniswap.org', '["DEX", "AMM", "DeFi", "自动化做市"]', '2018-11-02', 'medium', '2026-06-23T00:00:00Z'),
    ('00000000-0000-0000-0000-000000000006', 'Aave', 'AAVE', 'DeFi协议', 'Ethereum', '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9', 5800000000, 385.00, 420000000, 15000000, 16000000, 'Aave是领先的去中心化借贷协议，支持闪电贷、利率互换等创新功能。', 'https://aave.com', '["借贷", "DeFi", "闪电贷", "稳定币"]', '2020-01-08', 'medium', '2026-06-23T00:00:00Z'),
    ('00000000-0000-0000-0000-000000000007', 'Polygon', 'MATIC', 'Layer2扩展', 'Polygon', '0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0', 15000000000, 1.52, 1200000000, 9800000000, 10000000000, 'Polygon是以太坊Layer2扩展解决方案，提供侧链、ZK-Rollup等多种扩容技术。', 'https://polygon.technology', '["Layer2", "ZK-Rollup", "扩展", "EVM"]', '2020-05-30', 'medium', '2026-06-22T00:00:00Z'),
    ('00000000-0000-0000-0000-000000000008', 'Arweave', 'AR', '去中心化存储', 'Arweave', NULL, 3200000000, 42.80, 280000000, 66000000, 66000000, 'Arweave提供永久去中心化存储，采用"一次付费、永久存储"模式。', 'https://arweave.org', '["存储", "永久存储", "permaweb", "去中心化"]', '2018-06-08', 'high', '2026-06-22T00:00:00Z'),
    ('00000000-0000-0000-0000-000000000009', 'MakerDAO', 'MKR', 'DeFi协议', 'Ethereum', '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2', 2800000000, 2800.00, 180000000, 1000000, 1000000, 'MakerDAO是DAI稳定币的发行方，也是DeFi领域最古老和最大规模的DAO组织。', 'https://makerdao.com', '["稳定币", "DAI", "DAO", "抵押借贷"]', '2017-12-18', 'low', '2026-06-21T00:00:00Z'),
    ('00000000-0000-0000-0000-000000000010', 'The Graph', 'GRT', '索引协议', 'Ethereum', '0xc944E90C64B2c07662A292be6244BDf05Cda44a7', 4200000000, 0.45, 350000000, 9500000000, 10000000000, 'The Graph是区块链数据索引协议，为dApp提供高效的链上数据查询服务。', 'https://thegraph.com', '["索引", "数据查询", "API", "子图"]', '2020-12-17', 'low', '2026-06-21T00:00:00Z'),
    ('00000000-0000-0000-0000-000000000011', 'Lido', 'LDO', '流动性质押', 'Ethereum', '0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32', 3800000000, 3.80, 420000000, 1000000000, 1000000000, 'Lido是最大的ETH流动性质押协议，用户通过质押ETH获得stETH。', 'https://lido.fi', '["流动性质押", "stETH", "ETH质押", "DeFi"]', '2020-12-18', 'low', '2026-06-20T00:00:00Z'),
    ('00000000-0000-0000-0000-000000000012', 'Worldcoin', 'WLD', '身份协议', 'Ethereum', '0x163f8C2467924be0ae7B5347228CABF260318753', 8500000000, 8.50, 1850000000, 1000000000, 10000000000, 'Worldcoin由Sam Altman联合创立，通过虹膜扫描技术提供全球唯一的数字身份证明。', 'https://worldcoin.org', '["数字身份", "World ID", "零知识证明", "隐私"]', '2023-07-24', 'high', '2026-06-20T00:00:00Z')
ON CONFLICT (id) DO NOTHING;
