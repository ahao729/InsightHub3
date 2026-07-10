const DataService = require('./dataService');

const seedData = [
  // ========== 市场情报 Market Intelligence ==========
  {
    id: 'cb-001', category: 'market-intel', subcategory: 'crossborder-volume',
    title: '2026年Q2中美跨境电商交易额',
    source: '中国海关总署 / US Census Bureau',
    summary: '2026年Q2中美跨境电商交易额达328亿美元，同比增长17.3%，其中中国对美出口占62%，美国对华出口占38%。',
    value: 328, value_unit: '亿美元', growth_rate: 17.3,
    country_origin: '中国', country_destination: '美国',
    product_category: '全品类', indicator: 'trade_volume',
    confidence_score: 0.92, data_date: '2026-06-30',
    tags: ['中美贸易', '跨境电商', '市场趋势', 'B2C'],
    created_at: '2026-06-30T00:00:00Z',
  },
  {
    id: 'cb-002', category: 'market-intel', subcategory: 'crossborder-volume',
    title: '2026年东盟跨境电商市场规模',
    source: 'World Bank / e-Conomy SEA',
    summary: '东盟六国（印尼、泰国、越南、马来西亚、菲律宾、新加坡）2026年跨境电商总规模预计突破1,200亿美元，年增长22%，越南和菲律宾增速最快。',
    value: 1200, value_unit: '亿美元', growth_rate: 22.0,
    country_origin: '多国', country_destination: '东盟',
    product_category: '全品类', indicator: 'market_size',
    confidence_score: 0.88, data_date: '2026-06-15',
    tags: ['东盟', '东南亚', '新兴市场', '区域经济'],
    created_at: '2026-06-15T00:00:00Z',
  },
  {
    id: 'cb-003', category: 'market-intel', subcategory: 'platform-share',
    title: '全球跨境电商平台市场份额（2026年6月）',
    source: 'Similarweb / Marketplace Pulse',
    summary: 'Amazon 占全球跨境电商交易额 35.2%（第一），Alibaba/AliExpress 占 18.7%，Shopify 跨境店占 9.4%，Shein 占 6.8%，Temu 占 5.1%，TikTok Shop 占 3.9%。',
    value: 35.2, value_unit: '%', growth_rate: -2.1,
    platform: 'Amazon', indicator: 'market_share',
    confidence_score: 0.85, data_date: '2026-06-28',
    tags: ['电商平台', '市场份额', 'Amazon', 'Alibaba', 'Shein', 'Temu'],
    created_at: '2026-06-28T00:00:00Z',
  },
  {
    id: 'cb-004', category: 'market-intel', subcategory: 'consumer-trend',
    title: '2026年跨境消费者偏好变化 — 可持续与本地化',
    source: 'McKinsey 跨境消费调研 / Google Trends',
    summary: "72% 的跨境消费者更倾向于购买具有可持续认证的品牌。62% 的消费者期望看到本地化产品描述和支付方式。'中国品牌'在东南亚市场的搜索兴趣同比增长 41%。",
    value: 72, value_unit: '%', growth_rate: 12.0,
    indicator: 'consumer_preference',
    confidence_score: 0.82, data_date: '2026-06-20',
    tags: ['消费者洞察', '可持续', '本地化', '品牌出海'],
    created_at: '2026-06-20T00:00:00Z',
  },

  // ========== 品类分析 Product & Category Analysis ==========
  {
    id: 'cb-010', category: 'product-analysis', subcategory: 'top-categories',
    title: '2026年上半年跨境电商热销品类 Top 10',
    source: 'Amazon / AliExpress / Shopee 跨境数据聚合',
    summary: 'TOP5品类：1）智能家居设备（增速65%）；2）健康个护（增速52%）；3）户外运动（增速48%）；4）宠物用品（增速43%）；5）DIY工具（增速37%）。智能家居连续三个季度位居榜首。',
    value: 65, value_unit: '%', growth_rate: 65.0,
    product_category: '智能家居', indicator: 'sales_growth',
    confidence_score: 0.86, data_date: '2026-06-25',
    tags: ['热销品类', '智能家居', '健康个护', '户外运动', '宠物用品'],
    created_at: '2026-06-25T00:00:00Z',
  },
  {
    id: 'cb-011', category: 'product-analysis', subcategory: 'price-trend',
    title: '跨境电子品类价格趋势 — 蓝牙耳机',
    source: 'Keepa / CamelCamelCamel API',
    summary: "2026年Q2 跨境蓝牙耳机均价同比下降 18%，$20-50 价格段占比从 35% 升至 52%，中低端市场快速扩张。'开放耳'设计份额从 8% 增长至 23%。",
    value: 18, value_unit: '%', growth_rate: -18.0,
    product_category: '蓝牙耳机', indicator: 'price_trend',
    confidence_score: 0.90, data_date: '2026-06-22',
    tags: ['价格趋势', '电子品类', '蓝牙耳机', '消费电子'],
    created_at: '2026-06-22T00:00:00Z',
  },
  {
    id: 'cb-012', category: 'product-analysis', subcategory: 'demand-signal',
    title: '跨境搜索需求信号 — 美国市场 "made in China" 品牌搜索量',
    source: 'Google Trends / Jungle Scout',
    summary: '2026年H1 美国消费者搜索 "Chinese brand" + 品类词 的搜索量同比增长 89%。搜索量最高的中国品牌品类：扫地机器人（+145%）、电动工具（+112%）、智能摄像机（+97%）。',
    value: 89, value_unit: '%', growth_rate: 89.0,
    country_destination: '美国', indicator: 'search_volume',
    confidence_score: 0.84, data_date: '2026-06-18',
    tags: ['需求信号', 'Google Trends', '品牌搜索', '出海品牌'],
    created_at: '2026-06-18T00:00:00Z',
  },

  // ========== 物流成本 Logistics & Shipping ==========
  {
    id: 'cb-020', category: 'logistics', subcategory: 'shipping-rates',
    title: '中美跨境物流价格指数（2026年6月）',
    source: 'Freightos Baltic Index / 上海航运交易所',
    summary: '中国→美国西岸 40尺柜运费 $4,280（同比 -22%），中国→美国东岸 $5,150（同比 -18%）。空运价格 $5.20/kg（同比 -8%）。海运时效 18-25 天，空运 3-5 天。',
    value: 4280, value_unit: 'USD', growth_rate: -22.0,
    country_origin: '中国', country_destination: '美国',
    product_category: '物流', indicator: 'shipping_cost',
    confidence_score: 0.93, data_date: '2026-06-29',
    tags: ['跨境物流', '海运', '空运', '运费指数'],
    created_at: '2026-06-29T00:00:00Z',
  },
  {
    id: 'cb-021', category: 'logistics', subcategory: 'last-mile',
    title: '东南亚末端配送时效对比（2026年Q2）',
    source: 'Lazada / Shopee 物流数据 / Ninja Van',
    summary: '末端配送时效排名：新加坡（1.2天）、马来西亚（1.8天）、泰国（2.1天）、越南（2.8天）、印尼（3.5天）、菲律宾（4.2天）。印尼偏远地区可达7-10天。',
    value: 1.2, value_unit: '天', growth_rate: -5.0,
    country_destination: '东南亚', indicator: 'delivery_time',
    confidence_score: 0.87, data_date: '2026-06-15',
    tags: ['末端配送', '东南亚', '物流时效', 'Lazada', 'Shopee'],
    created_at: '2026-06-15T00:00:00Z',
  },

  // ========== 关税与政策 Tariffs & Policy ==========
  {
    id: 'cb-030', category: 'tariffs', subcategory: 'tariff-rates',
    title: '美国对华301关税复审结果 — 跨境电商影响分析',
    source: 'USTR / WTO Tariff Data',
    summary: '美国对华301关税清单中涉及跨境电商的主要品类：服饰鞋帽 25%、消费电子 7.5%-25%、家居用品 25%。800美元以下小额豁免（de minimis）规则仍在审查中，可能下调至400美元。',
    value: 25, value_unit: '%', growth_rate: 0,
    country_origin: '中国', country_destination: '美国',
    product_category: '服饰鞋帽', indicator: 'tariff_rate',
    confidence_score: 0.91, data_date: '2026-06-10',
    tags: ['关税', '301条款', '美国贸易政策', 'de minimis'],
    created_at: '2026-06-10T00:00:00Z',
  },
  {
    id: 'cb-031', category: 'tariffs', subcategory: 'trade-agreement',
    title: 'RCEP框架下中国-东盟关税优惠幅度',
    source: '中国商务部 / RCEP 联合委员会',
    summary: 'RCEP生效后，中国对东盟跨境电商核心品类关税优惠幅度：电子产品 0-5%（原10-15%）、纺织品 0-8%（原12-20%）、化妆品 0-10%（原15-30%）。零关税产品覆盖率将逐步提升至90%以上。',
    value: 90, value_unit: '%', growth_rate: 15.0,
    country_origin: '中国', country_destination: '东盟',
    product_category: '全品类', indicator: 'tariff_preference',
    confidence_score: 0.89, data_date: '2026-05-20',
    tags: ['RCEP', '东盟', '关税优惠', '自由贸易'],
    created_at: '2026-05-20T00:00:00Z',
  },

  // ========== 竞品与品牌跟踪 Competitor & Brand ==========
  {
    id: 'cb-040', category: 'competitor', subcategory: 'brand-performance',
    title: '中国出海品牌跨境表现指数（2026年6月）',
    source: 'Google Brand Index / Similarweb / Amazon Brand Analytics',
    summary: 'TOP10出海品牌：SHEIN（指数98.2）、Anker（95.6）、小米（91.3）、Temu（88.7）、TikTok（87.4）、大疆（85.9）、海尔（82.1）、华为（80.4）、EcoFlow（78.6）、Roborock（76.9）。',
    value: 98.2, value_unit: '品牌指数', growth_rate: 5.2,
    brand: 'SHEIN', indicator: 'brand_index',
    confidence_score: 0.88, data_date: '2026-06-28',
    tags: ['品牌出海', '品牌指数', 'SHEIN', 'Anker', 'Temu'],
    created_at: '2026-06-28T00:00:00Z',
  },
  {
    id: 'cb-041', category: 'competitor', subcategory: 'market-entry',
    title: '2026年新进入北美市场的中国DTC品牌分析',
    source: 'Similarweb / Crunchbase / 品牌官网监测',
    summary: '2026年H1 新进入北美市场的中国DTC品牌共47个，主要集中在：智能家居（12个）、宠物用品（9个）、美妆个护（8个）、运动户外（7个）。平均启动成本约$50万-$200万。',
    value: 47, value_unit: '品牌数', growth_rate: 34.0,
    country_destination: '美国', indicator: 'market_entry_count',
    confidence_score: 0.80, data_date: '2026-06-20',
    tags: ['DTC品牌', '市场进入', '北美市场', '品牌出海'],
    created_at: '2026-06-20T00:00:00Z',
  },

  // ========== 汇率与支付 Currency & Payments ==========
  {
    id: 'cb-050', category: 'finance', subcategory: 'forex-impact',
    title: '人民币汇率波动对跨境电商利润率的影响',
    source: '中国人民银行 / XE / 跨境支付平台',
    summary: '2026年Q2 人民币对美元平均汇率 7.18（同比贬值2.3%）。人民币每贬值1%，中国跨境出口电商平均利润率提升0.6-0.8个百分点。当前利润率中位数约12.4%（2025年为10.8%）。',
    value: 12.4, value_unit: '%', growth_rate: 1.6,
    indicator: 'profit_margin',
    confidence_score: 0.85, data_date: '2026-06-27',
    tags: ['汇率', '人民币', '利润率', '外汇风险'],
    created_at: '2026-06-27T00:00:00Z',
  },
  {
    id: 'cb-051', category: 'finance', subcategory: 'payment-methods',
    title: '全球跨境支付方式偏好排名（2026年）',
    source: 'Worldpay / PPRO / 跨境支付平台',
    summary: '全球跨境支付方式：数字钱包（42%）、信用卡/借记卡（30%）、银行转账（12%）、BNPL（8%）、加密货币（5%）、货到付款（3%）。东南亚数字钱包占比已达65%，拉美BNPL增速最快。',
    value: 42, value_unit: '%', growth_rate: 8.0,
    indicator: 'payment_method_share',
    confidence_score: 0.87, data_date: '2026-06-25',
    tags: ['跨境支付', '数字钱包', 'BNPL', '支付方式'],
    created_at: '2026-06-25T00:00:00Z',
  },

  // ========== 平台运营数据 Platform Operations ==========
  {
    id: 'cb-060', category: 'platform-ops', subcategory: 'advertising',
    title: '跨境电商广告投放成本指数（2026年6月）',
    source: 'Amazon Ads / Meta Ads / Google Ads API',
    summary: 'Amazon Sponsored Ads CPC 中位数 $1.12（同比 +14%），Meta 跨境广告 CPM $18.50（+8%），Google Shopping CPC $0.85（+11%）。TikTok 跨境广告 CPM $8.20（-5%），是性价比最优渠道。',
    value: 1.12, value_unit: 'USD', growth_rate: 14.0,
    platform: 'Amazon', indicator: 'advertising_cpc',
    confidence_score: 0.88, data_date: '2026-06-26',
    tags: ['广告投放', 'CPC', 'Amazon Ads', 'TikTok', '广告成本'],
    created_at: '2026-06-26T00:00:00Z',
  },
  {
    id: 'cb-061', category: 'platform-ops', subcategory: 'crossborder-fees',
    title: '跨境电商平台费率对比（2026年更新）',
    source: '各平台官方费率页面 / 卖家社区聚合',
    summary: 'Amazon 跨境佣金 15%（均值），Shopify 跨境交易费 2.9%+$0.30，TikTok Shop 佣金 8%，eBay 跨境佣金 12.9%，AliExpress 佣金 5-8%。各平台仓储附加费平均上涨12%。',
    value: 15, value_unit: '%', growth_rate: 2.0,
    platform: 'Amazon', indicator: 'commission_rate',
    confidence_score: 0.91, data_date: '2026-06-15',
    tags: ['平台费率', '佣金', '交易费', 'Amazon', 'Shopify', 'TikTok'],
    created_at: '2026-06-15T00:00:00Z',
  },
];

class CrossborderEcommerceService extends DataService {
  constructor() {
    super({
      tableName: 'crossborder_ecommerce_data',
      packageCode: 'crossborder-ecommerce',
      packageName: '跨境电商',
      searchFields: ['title', 'summary', 'source', 'tags'],
      defaultOrder: 'created_at DESC',
    });
    this.inMemoryData = seedData;
  }

  async search(queryParams, pagination = { page: 1, limit: 20 }) {
    const { page, limit } = pagination;
    const { q, category, country, platform, indicator } = queryParams;

    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (q) {
      conditions.push(`(title ILIKE $${paramIndex} OR summary ILIKE $${paramIndex} OR tags::text ILIKE $${paramIndex})`);
      params.push(`%${q}%`);
      paramIndex++;
    }
    if (category) {
      conditions.push(`category ILIKE $${paramIndex}`);
      params.push(category);
      paramIndex++;
    }
    if (country) {
      conditions.push(`(country_origin ILIKE $${paramIndex} OR country_destination ILIKE $${paramIndex})`);
      params.push(`%${country}%`);
      paramIndex++;
    }
    if (platform) {
      conditions.push(`platform ILIKE $${paramIndex}`);
      params.push(`%${platform}%`);
      paramIndex++;
    }
    if (indicator) {
      conditions.push(`indicator ILIKE $${paramIndex}`);
      params.push(indicator);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (page - 1) * limit;

    const rows = await this.dbQuery(
      `SELECT * FROM ${this.tableName} ${whereClause} ORDER BY ${this.defaultOrder} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    if (rows) {
      const countResult = await this.count(conditions.join(' AND '), params);
      return {
        data: rows,
        total: countResult,
        page,
        limit,
      };
    }

    // Fallback: filter in-memory
    let filtered = [...this.inMemoryData];
    if (q) {
      filtered = this.filterByText(filtered, q, ['title', 'summary', 'tags']);
    }
    if (category) {
      filtered = filtered.filter(item => item.category === category);
    }
    if (country) {
      filtered = filtered.filter(item =>
        (item.country_origin && item.country_origin.includes(country)) ||
        (item.country_destination && item.country_destination.includes(country))
      );
    }
    if (platform) {
      filtered = filtered.filter(item => item.platform && item.platform.includes(platform));
    }
    if (indicator) {
      filtered = filtered.filter(item => item.indicator === indicator);
    }

    return this.paginateData(filtered, page, limit);
  }

  /**
   * Get market overview statistics
   */
  async getStats() {
    const baseStats = await super.getStats();
    return {
      ...baseStats,
      totalRecords: this.inMemoryData.length,
      categories: [...new Set(this.inMemoryData.map(d => d.category))],
      indicators: [...new Set(this.inMemoryData.map(d => d.indicator))],
      lastUpdated: this.inMemoryData[0]?.created_at || null,
    };
  }

  /**
   * Get data grouped by category for dashboard
   */
  async getByCategory() {
    const grouped = {};
    for (const item of this.inMemoryData) {
      if (!grouped[item.category]) {
        grouped[item.category] = [];
      }
      grouped[item.category].push(item);
    }
    return grouped;
  }

  /**
   * Get available data categories list
   */
  async getCategories() {
    return [...new Set(this.inMemoryData.map(d => d.category))].map(cat => ({
      category: cat,
      count: this.inMemoryData.filter(d => d.category === cat).length,
      subcategories: [...new Set(this.inMemoryData.filter(d => d.category === cat).map(d => d.subcategory))],
    }));
  }
}

module.exports = new CrossborderEcommerceService();
