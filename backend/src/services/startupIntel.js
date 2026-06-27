const DataService = require('./dataService');

// Realistic seed data for Startup Intel
const seedData = [
  {
    id: 'startup-001', title: '深度求索DeepSeek完成新一轮10亿美元融资，估值达85亿美元',
    summary: '人工智能大模型公司深度求索（DeepSeek）宣布完成新一轮融资，估值达到85亿美元。本轮融资由多家一线风投机构参与，资金将用于下一代AI模型的研发和算力基础设施建设。',
    source: '36氪', industry: '人工智能', region: '中国',
    tags: ['AI', '大模型', '融资', 'DeepSeek'],
    published_at: '2026-06-25T08:00:00Z', created_at: '2026-06-25T08:30:00Z',
  },
  {
    id: 'startup-002', title: '新能源电池公司固态能源获5.5亿元B轮融资',
    summary: '专注于固态电池研发的固态能源科技宣布完成5.5亿元人民币B轮融资，由蔚来资本领投，宁德时代跟投。公司计划2027年实现固态电池量产。',
    source: '投资界', industry: '新能源', region: '中国',
    tags: ['新能源', '电池', '固态电池', '融资'],
    published_at: '2026-06-24T06:00:00Z', created_at: '2026-06-24T06:30:00Z',
  },
  {
    id: 'startup-003', title: 'OpenAI发布GPT-5：推理能力大幅提升，数学竞赛成绩超越人类',
    summary: 'OpenAI正式发布GPT-5模型，在数学推理、代码生成和多模态理解方面取得显著突破。在多项基准测试中，GPT-5的表现超越了此前所有模型。',
    source: 'TechCrunch', industry: '人工智能', region: '美国',
    tags: ['AI', 'GPT-5', 'OpenAI', '大模型'],
    published_at: '2026-06-20T14:00:00Z', created_at: '2026-06-20T14:30:00Z',
  },
  {
    id: 'startup-004', title: '生物科技公司基因编辑疗法获FDA突破性疗法认定',
    summary: '北京华大基因旗下子公司开发的基因编辑疗法BG-101获得美国FDA突破性疗法认定，用于治疗罕见遗传性血液疾病。这是中国首个获得该认定的基因编辑疗法。',
    source: '医药经济报', industry: '生物医药', region: '中国',
    tags: ['基因编辑', 'FDA', '生物科技', '医药'],
    published_at: '2026-06-18T09:00:00Z', created_at: '2026-06-18T09:30:00Z',
  },
  {
    id: 'startup-005', title: '星箭科技成功发射可回收火箭，开启商业航天新篇章',
    summary: '民营航天企业星箭科技成功完成"星云-3"可回收火箭的发射和回收任务，成为全球第三家掌握轨道级火箭回收技术的公司。',
    source: '航天新闻', industry: '商业航天', region: '中国',
    tags: ['航天', '火箭回收', '商业航天', '星箭科技'],
    published_at: '2026-06-15T11:00:00Z', created_at: '2026-06-15T11:30:00Z',
  },
  {
    id: 'startup-006', title: '量子计算创企QuanTech完成2亿美元C轮融资',
    summary: '英国量子计算公司QuanTech宣布完成2亿美元C轮融资，投资者包括Google Ventures和软银愿景基金。公司计划在2027年推出1000量子比特的量子计算机。',
    source: 'Financial Times', industry: '量子计算', region: '英国',
    tags: ['量子计算', 'QuanTech', '融资', 'C轮'],
    published_at: '2026-06-12T10:00:00Z', created_at: '2026-06-12T10:30:00Z',
  },
  {
    id: 'startup-007', title: '自动驾驶公司小马智行获准在广州开展全无人商业化运营',
    summary: '小马智行（Pony.ai）获得广州市政府批准，将在南沙区开展全无人自动驾驶出租车商业化运营服务，成为国内首批获此许可的企业。',
    source: '汽车之家', industry: '自动驾驶', region: '中国',
    tags: ['自动驾驶', '小马智行', '商业化', '无人驾驶'],
    published_at: '2026-06-10T08:00:00Z', created_at: '2026-06-10T08:30:00Z',
  },
  {
    id: 'startup-008', title: 'SaaS平台聚水潭启动港股IPO，拟募资约5亿美元',
    summary: '电商SaaS服务商聚水潭向港交所提交上市申请，计划募资约5亿美元。公司2025年ARR突破15亿元人民币，是国内最大的电商ERP服务商之一。',
    source: '港交所公告', industry: 'SaaS', region: '中国',
    tags: ['IPO', 'SaaS', '电商', '聚水潭'],
    published_at: '2026-06-08T07:00:00Z', created_at: '2026-06-08T07:30:00Z',
  },
  {
    id: 'startup-009', title: '合成生物学公司微光科技获3亿元A轮融资',
    summary: '合成生物学初创公司微光科技完成3亿元A轮融资，由红杉中国领投。公司利用AI驱动的蛋白质设计平台开发新型工业酶制剂。',
    source: '生物谷', industry: '合成生物学', region: '中国',
    tags: ['合成生物学', 'AI', '蛋白质设计', 'A轮'],
    published_at: '2026-06-05T09:00:00Z', created_at: '2026-06-05T09:30:00Z',
  },
  {
    id: 'startup-010', title: '2026年上半年全球AI领域投融资报告：总额超450亿美元',
    summary: 'CBInsights发布2026年上半年AI领域投融资报告，全球AI初创公司融资总额超过450亿美元，同比增长35%。生成式AI仍是最热门赛道。',
    source: 'CBInsights', industry: '人工智能', region: '全球',
    tags: ['AI', '投融资', '报告', '2026'],
    published_at: '2026-06-01T12:00:00Z', created_at: '2026-06-01T12:30:00Z',
  },
  {
    id: 'startup-011', title: 'RISC-V芯片设计公司赛昉科技获6亿元战略投资',
    summary: 'RISC-V架构芯片设计公司赛昉科技获得6亿元战略投资，投资方包括中芯聚源、华为哈勃等。新一代高性能RISC-V处理器预计年底流片。',
    source: '电子工程时报', industry: '半导体', region: '中国',
    tags: ['RISC-V', '芯片', '半导体', '战略投资'],
    published_at: '2026-05-28T10:00:00Z', created_at: '2026-05-28T10:30:00Z',
  },
  {
    id: 'startup-012', title: '印尼电商平台Bukalapak完成5亿美元Pre-IPO融资',
    summary: '印尼电商平台Bukalapak完成上市前最后一轮5亿美元融资，估值达60亿美元。公司计划年底前在纳斯达克上市。',
    source: 'Bloomberg', industry: '电商', region: '东南亚',
    tags: ['电商', '东南亚', 'Bukalapak', 'Pre-IPO'],
    published_at: '2026-05-25T07:00:00Z', created_at: '2026-05-25T07:30:00Z',
  },
];

class StartupIntelService extends DataService {
  constructor() {
    super({
      tableName: 'market_news',
      packageCode: 'startup-intel',
      packageName: '创业商业情报',
      searchFields: ['title', 'summary', 'source', 'industry', 'tags'],
      defaultOrder: 'published_at DESC',
    });
    this.inMemoryData = seedData;
  }

  async search(queryParams, pagination = { page: 1, limit: 20 }) {
    const { page, limit } = pagination;
    const { q, industry, date_from, date_to } = queryParams;

    // Try DB first
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (q) {
      conditions.push(`(title ILIKE $${paramIndex} OR summary ILIKE $${paramIndex} OR source ILIKE $${paramIndex})`);
      params.push(`%${q}%`);
      paramIndex++;
    }
    if (industry) {
      conditions.push(`industry ILIKE $${paramIndex}`);
      params.push(`%${industry}%`);
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

    // Fallback: filter in-memory data
    let filtered = [...this.inMemoryData];

    if (q) {
      filtered = this.filterByText(filtered, q, ['title', 'summary', 'source', 'industry']);
    }
    if (industry) {
      filtered = filtered.filter(item =>
        item.industry && item.industry.toLowerCase().includes(industry.toLowerCase())
      );
    }
    if (date_from || date_to) {
      filtered = this.filterByDateRange(filtered, 'published_at', date_from, date_to);
    }

    return this.paginateData(filtered, page, limit);
  }
}

module.exports = new StartupIntelService();
