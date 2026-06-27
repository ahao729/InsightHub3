const DataService = require('./dataService');

// AI Geo uses the same market_news table structure but with AI/geospatial focus
const seedData = [
  {
    id: 'aigeo-001', title: '2026年全球AI芯片市场规模突破800亿美元',
    summary: '根据IDC最新报告，2026年全球AI芯片市场规模预计达到820亿美元，同比增长45%。GPU仍占主导地位，但ASIC和存算一体芯片增速更快。',
    source: 'IDC', industry: 'AI芯片', region: '全球',
    tags: ['AI芯片', 'GPU', 'ASIC', '市场规模'],
    published_at: '2026-06-24T08:00:00Z', created_at: '2026-06-24T08:30:00Z',
  },
  {
    id: 'aigeo-002', title: '中国建成全球最大AI算力网络，总算力超500EFLOPS',
    summary: '国家算力网络工程宣布，"东数西算"八大枢纽节点已全部建成投产，总算力规模超过500EFLOPS，赋能千行百业智能化转型。',
    source: '工信部', industry: '算力基础设施', region: '中国',
    tags: ['算力网络', '东数西算', 'AI算力', '基础设施'],
    published_at: '2026-06-22T10:00:00Z', created_at: '2026-06-22T10:30:00Z',
  },
  {
    id: 'aigeo-003', title: 'Google发布Gemini 3.0：多模态能力全面升级',
    summary: 'Google正式发布Gemini 3.0大模型，在视频理解、3D空间感知、实时翻译等能力上实现重大突破，支持长达1小时的视频内容分析。',
    source: 'Google AI Blog', industry: '人工智能', region: '美国',
    tags: ['Gemini', 'Google', '多模态', '大模型'],
    published_at: '2026-06-20T16:00:00Z', created_at: '2026-06-20T16:30:00Z',
  },
  {
    id: 'aigeo-004', title: '粤港澳大湾区智慧城市群建设进展报告',
    summary: '广东省发布粤港澳大湾区智慧城市群建设中期报告，已建成5G基站超30万个，智慧交通、智慧医疗、智慧政务等应用全面铺开，数字经济规模突破8万亿元。',
    source: '广东省政府', industry: '智慧城市', region: '粤港澳大湾区',
    tags: ['粤港澳', '智慧城市', '5G', '数字经济'],
    published_at: '2026-06-18T09:00:00Z', created_at: '2026-06-18T09:30:00Z',
  },
  {
    id: 'aigeo-005', title: '高分辨率遥感卫星"天眸-5"成功发射，分辨率达0.3米',
    summary: '中国商业遥感卫星"天眸-5"在酒泉卫星发射中心成功发射，最高分辨率达到0.3米，将服务于城市规划、农业监测、灾害评估等领域。',
    source: '航天科技集团', industry: '遥感卫星', region: '中国',
    tags: ['遥感卫星', '高分辨率', '商业航天', '地理空间'],
    published_at: '2026-06-15T11:00:00Z', created_at: '2026-06-15T11:30:00Z',
  },
  {
    id: 'aigeo-006', title: 'Meta发布开源多语言AI模型，支持200种语言',
    summary: 'Meta发布开源多语言大模型NLLB-3.0，支持200种语言之间的互译和文本理解，特别覆盖了50种低资源语言，推动AI普惠。',
    source: 'Meta AI', industry: '人工智能', region: '美国',
    tags: ['Meta', '开源', '多语言', 'NLLB'],
    published_at: '2026-06-12T14:00:00Z', created_at: '2026-06-12T14:30:00Z',
  },
  {
    id: 'aigeo-007', title: '长三角数字经济一体化发展白皮书发布',
    summary: '长三角三省一市联合发布数字经济一体化发展白皮书，提出共建数字基础设施、共享数据要素市场、协同数字产业发展等六大行动。',
    source: '上海市发改委', industry: '数字经济', region: '长三角',
    tags: ['长三角', '数字经济', '一体化', '白皮书'],
    published_at: '2026-06-10T08:00:00Z', created_at: '2026-06-10T08:30:00Z',
  },
  {
    id: 'aigeo-008', title: 'AI驱动的蛋白质结构预测突破：一天预测10万种蛋白质结构',
    summary: 'DeepMind联合多家机构发布新一代AlphaFold 4，利用扩散模型将蛋白质结构预测速度提升了100倍，一天可预测10万种蛋白质结构。',
    source: 'Nature', industry: 'AI+生物', region: '英国',
    tags: ['AlphaFold', '蛋白质', 'AI', 'DeepMind'],
    published_at: '2026-06-08T18:00:00Z', created_at: '2026-06-08T18:30:00Z',
  },
  {
    id: 'aigeo-009', title: '东南亚数字经济发展报告：2030年GDP贡献将达1万亿美元',
    summary: 'Google、Temasek和Bain联合发布2026年东南亚数字经济报告，预计到2030年数字经济对东南亚GDP贡献将达到1万亿美元，电商和金融科技是主要驱动力。',
    source: 'Google-Temasek-Bain', industry: '数字经济', region: '东南亚',
    tags: ['东南亚', '数字经济', '电商', '金融科技'],
    published_at: '2026-06-05T10:00:00Z', created_at: '2026-06-05T10:30:00Z',
  },
  {
    id: 'aigeo-010', title: '全国首个城市级数字孪生平台在雄安上线',
    summary: '雄安新区正式上线全国首个城市级数字孪生平台，实现现实城市与数字城市的同步规划、同步建设、同步运行，为智慧城市建设树立标杆。',
    source: '雄安新区管委会', industry: '数字孪生', region: '雄安',
    tags: ['数字孪生', '雄安', '智慧城市', '数字城市'],
    published_at: '2026-06-01T09:00:00Z', created_at: '2026-06-01T09:30:00Z',
  },
  {
    id: 'aigeo-011', title: '特斯拉Optimus Gen 3人形机器人开始量产',
    summary: '特斯拉宣布Optimus Gen 3人形机器人正式进入量产阶段，首批产能5000台/月，售价2万美元，面向工业制造和物流场景。',
    source: 'Tesla', industry: '机器人', region: '美国',
    tags: ['人形机器人', '特斯拉', 'Optimus', '量产'],
    published_at: '2026-05-28T15:00:00Z', created_at: '2026-05-28T15:30:00Z',
  },
  {
    id: 'aigeo-012', title: '长江经济带绿色发展指数报告发布',
    summary: '国家发改委发布长江经济带绿色发展指数报告，综合评估11省市在生态环境、绿色产业、低碳转型等方面的进展，浙江、江苏、上海位列前三。',
    source: '国家发改委', industry: '绿色发展', region: '长江经济带',
    tags: ['长江经济带', '绿色发展', '指数', '低碳'],
    published_at: '2026-05-25T10:00:00Z', created_at: '2026-05-25T10:30:00Z',
  },
];

class AiGeoService extends DataService {
  constructor() {
    super({
      tableName: 'market_news',
      packageCode: 'ai-geo',
      packageName: 'AI / GEO 分析',
      searchFields: ['title', 'summary', 'source', 'industry', 'tags'],
      defaultOrder: 'published_at DESC',
    });
    this.inMemoryData = seedData;
  }

  async search(queryParams, pagination = { page: 1, limit: 20 }) {
    const { page, limit } = pagination;
    const { q, region, date_from, date_to } = queryParams;

    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (q) {
      conditions.push(`(title ILIKE $${paramIndex} OR summary ILIKE $${paramIndex} OR source ILIKE $${paramIndex})`);
      params.push(`%${q}%`);
      paramIndex++;
    }
    if (region) {
      conditions.push(`region ILIKE $${paramIndex}`);
      params.push(`%${region}%`);
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
      filtered = this.filterByText(filtered, q, ['title', 'summary', 'source', 'industry']);
    }
    if (region) {
      filtered = filtered.filter(item => item.region && item.region.includes(region));
    }
    if (date_from || date_to) {
      filtered = this.filterByDateRange(filtered, 'published_at', date_from, date_to);
    }

    return this.paginateData(filtered, page, limit);
  }
}

module.exports = new AiGeoService();
