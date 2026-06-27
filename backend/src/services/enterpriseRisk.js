const DataService = require('./dataService');

// Realistic seed data for Enterprise Risk
const seedData = [
  {
    id: 'risk-001', company_name: '北京字节跳动科技有限公司', registration_number: '91110108MA01XXXXXX',
    legal_representative: '张一鸣', registered_capital: '10000万元人民币',
    established_date: '2012-03-09', industry: '互联网科技', region: '北京',
    address: '北京市海淀区知春路甲48号', business_scope: '技术开发、技术推广、技术服务；计算机系统服务；数据处理',
    risk_score: 15, risk_level: 'low', risk_details: [],
    credit_code: '91110108MA01XXXXXX', status: 'active',
    created_at: '2026-06-25T00:00:00Z',
  },
  {
    id: 'risk-002', company_name: '杭州阿里巴巴网络科技有限公司', registration_number: '91330100MA2XXXXXX',
    legal_representative: '吴泳铭', registered_capital: '50000万元人民币',
    established_date: '2014-08-28', industry: '电子商务', region: '浙江',
    address: '浙江省杭州市余杭区文一西路969号', business_scope: '网络技术服务；计算机软硬件开发；电子商务平台运营',
    risk_score: 22, risk_level: 'low', risk_details: [],
    credit_code: '91330100MA2XXXXXX', status: 'active',
    created_at: '2026-06-24T00:00:00Z',
  },
  {
    id: 'risk-003', company_name: '深圳前海微众银行股份有限公司', registration_number: '91440300MA5XXXXXX',
    legal_representative: '顾敏', registered_capital: '420000万元人民币',
    established_date: '2014-12-16', industry: '金融科技', region: '广东',
    address: '深圳市前海深港合作区南山街道', business_scope: '吸收公众存款；发放贷款；办理国内外结算',
    risk_score: 45, risk_level: 'medium', risk_details: [
      { category: '不良贷款率', value: '2.3%', trend: 'up' },
      { category: '资本充足率', value: '12.5%', trend: 'stable' },
    ],
    credit_code: '91440300MA5XXXXXX', status: 'active',
    created_at: '2026-06-23T00:00:00Z',
  },
  {
    id: 'risk-004', company_name: '上海绿地房地产开发有限公司', registration_number: '91310115MA1XXXXXX',
    legal_representative: '张玉良', registered_capital: '300000万元人民币',
    established_date: '1992-07-18', industry: '房地产', region: '上海',
    address: '上海市黄浦区淮海中路300号', business_scope: '房地产开发与经营；物业管理；房地产咨询',
    risk_score: 72, risk_level: 'high', risk_details: [
      { category: '负债率', value: '85.7%', trend: 'up' },
      { category: '诉讼数量', value: '12', trend: 'up' },
      { category: '被执行人', value: '是', trend: 'up' },
    ],
    credit_code: '91310115MA1XXXXXX', status: 'active',
    created_at: '2026-06-22T00:00:00Z',
  },
  {
    id: 'risk-005', company_name: '广州恒大材料设备有限公司', registration_number: '91440101MA5XXXXXX',
    legal_representative: '许家印', registered_capital: '500000万元人民币',
    established_date: '2007-04-08', industry: '建材贸易', region: '广东',
    address: '广州市天河区黄埔大道西78号', business_scope: '建筑材料销售；设备租赁；供应链管理',
    risk_score: 95, risk_level: 'critical', risk_details: [
      { category: '负债率', value: '128%', trend: 'up' },
      { category: '诉讼数量', value: '47', trend: 'up' },
      { category: '被执行人', value: '是', trend: 'up' },
      { category: '失信被执行人', value: '是', trend: 'up' },
    ],
    credit_code: '91440101MA5XXXXXX', status: 'active',
    created_at: '2026-06-21T00:00:00Z',
  },
  {
    id: 'risk-006', company_name: '宁德时代新能源科技股份有限公司', registration_number: '91350900MA2XXXXXX',
    legal_representative: '曾毓群', registered_capital: '230000万元人民币',
    established_date: '2011-12-16', industry: '新能源', region: '福建',
    address: '福建省宁德市蕉城区漳湾镇新港路2号', business_scope: '锂离子电池研发、生产、销售',
    risk_score: 12, risk_level: 'low', risk_details: [],
    credit_code: '91350900MA2XXXXXX', status: 'active',
    created_at: '2026-06-20T00:00:00Z',
  },
  {
    id: 'risk-007', company_name: '深圳市柔宇科技股份有限公司', registration_number: '91440300MA5XXXXXX',
    legal_representative: '刘自鸿', registered_capital: '120000万元人民币',
    established_date: '2012-05-08', industry: '显示技术', region: '广东',
    address: '深圳市龙岗区坪地街道柔宇国际柔性显示产业园', business_scope: '柔性显示屏研发生产',
    risk_score: 88, risk_level: 'critical', risk_details: [
      { category: '欠薪情况', value: '6个月', trend: 'up' },
      { category: '诉讼数量', value: '23', trend: 'up' },
      { category: '资产冻结', value: '是', trend: 'up' },
    ],
    credit_code: '91440300MA5XXXXXX', status: 'active',
    created_at: '2026-06-19T00:00:00Z',
  },
  {
    id: 'risk-008', company_name: '中芯国际集成电路制造有限公司', registration_number: '91310000MA1XXXXXX',
    legal_representative: '刘训峰', registered_capital: '790000万元人民币',
    established_date: '2000-04-03', industry: '半导体', region: '上海',
    address: '上海市浦东新区张江路18号', business_scope: '集成电路制造与代工服务',
    risk_score: 35, risk_level: 'medium', risk_details: [
      { category: '产能利用率', value: '85%', trend: 'stable' },
      { category: '技术节点', value: '7nm', trend: 'up' },
    ],
    credit_code: '91310000MA1XXXXXX', status: 'active',
    created_at: '2026-06-18T00:00:00Z',
  },
  {
    id: 'risk-009', company_name: '北京旷视科技有限公司', registration_number: '91110108MA0XXXXXX',
    legal_representative: '印奇', registered_capital: '5000万元人民币',
    established_date: '2011-10-20', industry: '人工智能', region: '北京',
    address: '北京市海淀区中关村大街1号', business_scope: '人工智能技术开发、计算机视觉',
    risk_score: 28, risk_level: 'low', risk_details: [
      { category: '知识产权诉讼', value: '3', trend: 'stable' },
    ],
    credit_code: '91110108MA0XXXXXX', status: 'active',
    created_at: '2026-06-17T00:00:00Z',
  },
  {
    id: 'risk-010', company_name: '上海蔚来汽车有限公司', registration_number: '91310115MA1KXXXXXX',
    legal_representative: '李斌', registered_capital: '100000万元人民币',
    established_date: '2014-11-25', industry: '新能源汽车', region: '上海',
    address: '上海市嘉定区安亭镇安拓路56号', business_scope: '新能源汽车研发制造销售',
    risk_score: 50, risk_level: 'medium', risk_details: [
      { category: '净亏损', value: '45亿元', trend: 'down' },
      { category: '交付量', value: '18万辆/年', trend: 'up' },
    ],
    credit_code: '91310115MA1KXXXXXX', status: 'active',
    created_at: '2026-06-16T00:00:00Z',
  },
  {
    id: 'risk-011', company_name: '华为技术有限公司', registration_number: '9144030027XXXXXX',
    legal_representative: '梁华', registered_capital: '4030811万元人民币',
    established_date: '1987-09-15', industry: '通信技术', region: '广东',
    address: '深圳市龙岗区坂田华为基地', business_scope: '通信设备、消费电子、云计算',
    risk_score: 18, risk_level: 'low', risk_details: [],
    credit_code: '9144030027XXXXXX', status: 'active',
    created_at: '2026-06-15T00:00:00Z',
  },
  {
    id: 'risk-012', company_name: '科大讯飞股份有限公司', registration_number: '9134010014XXXXXX',
    legal_representative: '刘庆峰', registered_capital: '230000万元人民币',
    established_date: '1999-12-30', industry: '人工智能', region: '安徽',
    address: '合肥市高新开发区望江西路666号', business_scope: '智能语音及人工智能技术',
    risk_score: 25, risk_level: 'low', risk_details: [],
    credit_code: '9134010014XXXXXX', status: 'active',
    created_at: '2026-06-14T00:00:00Z',
  },
];

class EnterpriseRiskService extends DataService {
  constructor() {
    super({
      tableName: 'company_profiles',
      packageCode: 'enterprise-risk',
      packageName: '企业风控',
      searchFields: ['company_name', 'legal_representative', 'industry', 'region'],
      defaultOrder: 'risk_score DESC',
    });
    this.inMemoryData = seedData;
  }

  async search(queryParams, pagination = { page: 1, limit: 20 }) {
    const { page, limit } = pagination;
    const { q, region, risk_type } = queryParams;

    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (q) {
      conditions.push(`(company_name ILIKE $${paramIndex} OR legal_representative ILIKE $${paramIndex} OR business_scope ILIKE $${paramIndex})`);
      params.push(`%${q}%`);
      paramIndex++;
    }
    if (region) {
      conditions.push(`region ILIKE $${paramIndex}`);
      params.push(`%${region}%`);
      paramIndex++;
    }
    if (risk_type) {
      const levelMap = {
        'low': 'low', 'medium': 'medium', 'high': 'high', 'critical': 'critical',
      };
      const level = levelMap[risk_type] || risk_type;
      conditions.push(`risk_level = $${paramIndex}`);
      params.push(level);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? conditions.join(' AND ') : '1=1';
    const offset = (page - 1) * limit;

    const rows = await this.dbQuery(
      `SELECT * FROM ${this.tableName} WHERE ${whereClause} ORDER BY risk_score DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    if (rows) {
      const countResult = await this.count(whereClause, params);
      return { data: rows, total: countResult };
    }

    // Fallback
    let filtered = [...this.inMemoryData];
    if (q) {
      filtered = this.filterByText(filtered, q, ['company_name', 'legal_representative', 'business_scope']);
    }
    if (region) {
      filtered = filtered.filter(item => item.region && item.region.includes(region));
    }
    if (risk_type) {
      filtered = filtered.filter(item => item.risk_level === risk_type);
    }

    return this.paginateData(filtered, page, limit);
  }
}

module.exports = new EnterpriseRiskService();
