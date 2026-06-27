const DataService = require('./dataService');

const seedData = [
  {
    id: 'fin-001', indicator_name: '国内生产总值 (GDP) - 中国', indicator_code: 'GDP.CN',
    country: '中国', region: '亚洲', value: 181000.00, unit: '十亿美元',
    period: '2025', frequency: 'yearly', source: '国家统计局',
    published_at: '2026-01-20T00:00:00Z', created_at: '2026-01-20T00:00:00Z',
  },
  {
    id: 'fin-002', indicator_name: '国内生产总值 (GDP) - 美国', indicator_code: 'GDP.US',
    country: '美国', region: '北美洲', value: 289000.00, unit: '十亿美元',
    period: '2025', frequency: 'yearly', source: 'BEA',
    published_at: '2026-01-30T00:00:00Z', created_at: '2026-01-30T00:00:00Z',
  },
  {
    id: 'fin-003', indicator_name: '消费者物价指数 (CPI) - 中国', indicator_code: 'CPI.CN',
    country: '中国', region: '亚洲', value: 100.80, unit: '指数',
    period: '2026-05', frequency: 'monthly', source: '国家统计局',
    published_at: '2026-06-10T00:00:00Z', created_at: '2026-06-10T00:00:00Z',
  },
  {
    id: 'fin-004', indicator_name: '消费者物价指数 (CPI) - 美国', indicator_code: 'CPI.US',
    country: '美国', region: '北美洲', value: 315.20, unit: '指数',
    period: '2026-05', frequency: 'monthly', source: 'BLS',
    published_at: '2026-06-12T00:00:00Z', created_at: '2026-06-12T00:00:00Z',
  },
  {
    id: 'fin-005', indicator_name: '人民币兑美元中间价', indicator_code: 'CNY.USD',
    country: '中国', region: '亚洲', value: 7.14, unit: 'CNY/USD',
    period: '2026-06-25', frequency: 'daily', source: '中国人民银行',
    published_at: '2026-06-25T09:15:00Z', created_at: '2026-06-25T09:15:00Z',
  },
  {
    id: 'fin-006', indicator_name: '美元指数', indicator_code: 'USDX',
    country: '美国', region: '全球', value: 102.35, unit: '指数',
    period: '2026-06-25', frequency: 'daily', source: 'ICE',
    published_at: '2026-06-25T20:00:00Z', created_at: '2026-06-25T20:00:00Z',
  },
  {
    id: 'fin-007', indicator_name: '一年期LPR利率', indicator_code: 'LPR.1Y.CN',
    country: '中国', region: '亚洲', value: 3.45, unit: '%',
    period: '2026-06', frequency: 'monthly', source: '中国人民银行',
    published_at: '2026-06-20T09:00:00Z', created_at: '2026-06-20T09:00:00Z',
  },
  {
    id: 'fin-008', indicator_name: '联邦基金利率', indicator_code: 'FEDFUNDS.US',
    country: '美国', region: '北美洲', value: 4.25, unit: '%',
    period: '2026-06', frequency: 'monthly', source: 'Federal Reserve',
    published_at: '2026-06-19T14:00:00Z', created_at: '2026-06-19T14:00:00Z',
  },
  {
    id: 'fin-009', indicator_name: '上证综合指数', indicator_code: 'SHCOMP',
    country: '中国', region: '亚洲', value: 3245.78, unit: '点',
    period: '2026-06-25', frequency: 'daily', source: '上海证券交易所',
    published_at: '2026-06-25T15:00:00Z', created_at: '2026-06-25T15:00:00Z',
  },
  {
    id: 'fin-010', indicator_name: '标普500指数', indicator_code: 'SPX',
    country: '美国', region: '北美洲', value: 5678.32, unit: '点',
    period: '2026-06-24', frequency: 'daily', source: 'S&P Global',
    published_at: '2026-06-24T16:00:00Z', created_at: '2026-06-24T16:00:00Z',
  },
  {
    id: 'fin-011', indicator_name: '社会融资规模增量', indicator_code: 'SF.CN',
    country: '中国', region: '亚洲', value: 3850.00, unit: '十亿元人民币',
    period: '2026-05', frequency: 'monthly', source: '中国人民银行',
    published_at: '2026-06-15T10:00:00Z', created_at: '2026-06-15T10:00:00Z',
  },
  {
    id: 'fin-012', indicator_name: '失业率 - 中国 (城镇)', indicator_code: 'UNEMP.CN',
    country: '中国', region: '亚洲', value: 5.10, unit: '%',
    period: '2026-05', frequency: 'monthly', source: '国家统计局',
    published_at: '2026-06-17T10:00:00Z', created_at: '2026-06-17T10:00:00Z',
  },
  {
    id: 'fin-013', indicator_name: '失业率 - 美国', indicator_code: 'UNEMP.US',
    country: '美国', region: '北美洲', value: 3.80, unit: '%',
    period: '2026-05', frequency: 'monthly', source: 'BLS',
    published_at: '2026-06-07T08:30:00Z', created_at: '2026-06-07T08:30:00Z',
  },
  {
    id: 'fin-014', indicator_name: '布伦特原油价格', indicator_code: 'OIL.BRENT',
    country: '全球', region: '全球', value: 78.50, unit: '美元/桶',
    period: '2026-06-25', frequency: 'daily', source: 'ICE',
    published_at: '2026-06-25T20:00:00Z', created_at: '2026-06-25T20:00:00Z',
  },
  {
    id: 'fin-015', indicator_name: '伦敦金价 (黄金)', indicator_code: 'GOLD.LONDON',
    country: '全球', region: '全球', value: 2345.60, unit: '美元/盎司',
    period: '2026-06-25', frequency: 'daily', source: 'LBMA',
    published_at: '2026-06-25T20:00:00Z', created_at: '2026-06-25T20:00:00Z',
  },
];

class FinanceMacroService extends DataService {
  constructor() {
    super({
      tableName: 'financial_indicators',
      packageCode: 'finance-macro',
      packageName: '金融宏观',
      searchFields: ['indicator_name', 'country', 'indicator_code'],
      defaultOrder: 'published_at DESC',
    });
    this.inMemoryData = seedData;
  }

  async search(queryParams, pagination = { page: 1, limit: 20 }) {
    const { page, limit } = pagination;
    const { q, country, indicator, date_from, date_to } = queryParams;

    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (q) {
      conditions.push(`(indicator_name ILIKE $${paramIndex} OR indicator_code ILIKE $${paramIndex})`);
      params.push(`%${q}%`);
      paramIndex++;
    }
    if (country) {
      conditions.push(`country ILIKE $${paramIndex}`);
      params.push(`%${country}%`);
      paramIndex++;
    }
    if (indicator) {
      conditions.push(`(indicator_name ILIKE $${paramIndex} OR indicator_code ILIKE $${paramIndex})`);
      params.push(`%${indicator}%`);
      paramIndex++;
    }
    if (date_from) {
      conditions.push(`published_at >= $${paramIndex}`);
      params.push(date_from);
      paramIndex++;
    }
    if (date_to) {
      conditions.push(`published_at <= $${paramIndex}`);
      params.push(date_to);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? conditions.join(' AND ') : '1=1';
    const offset = (page - 1) * limit;

    const rows = await this.dbQuery(
      `SELECT * FROM ${this.tableName} WHERE ${whereClause} ORDER BY published_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    if (rows) {
      const countResult = await this.count(whereClause, params);
      return { data: rows, total: countResult };
    }

    // Fallback
    let filtered = [...this.inMemoryData];
    if (q) {
      filtered = this.filterByText(filtered, q, ['indicator_name', 'indicator_code']);
    }
    if (country) {
      filtered = filtered.filter(item => item.country && item.country.includes(country));
    }
    if (indicator) {
      filtered = filtered.filter(item =>
        item.indicator_name.includes(indicator) || item.indicator_code.includes(indicator)
      );
    }
    if (date_from || date_to) {
      filtered = this.filterByDateRange(filtered, 'published_at', date_from, date_to);
    }

    return this.paginateData(filtered, page, limit);
  }

  /**
   * Override search to support /indicators endpoint
   */
  async searchIndicators(queryParams) {
    // Same as search
    return this.search(queryParams, { page: 1, limit: 100 });
  }
}

module.exports = new FinanceMacroService();
