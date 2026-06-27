const DataService = require('./dataService');

const seedData = [
  {
    id: 'policy-001', title: '2026年国家新一代人工智能创新发展试验区建设方案',
    document_number: '国科发〔2026〕15号',
    issuing_body: '科学技术部', region: '全国', type: '政策文件', status: '现行有效',
    publish_date: '2026-03-01', effective_date: '2026-04-01',
    summary: '为加快推动人工智能创新发展试验区建设，提出新一代人工智能创新发展试验区建设的目标、任务和保障措施，推动AI与实体经济深度融合。',
    category: '科技政策', bidding_deadline: null, budget_amount: null, contact_info: null,
    created_at: '2026-03-01T00:00:00Z',
  },
  {
    id: 'policy-002', title: '北京市数字经济促进条例（2026年修订）',
    document_number: '北京市人民代表大会常务委员会公告〔2026〕8号',
    issuing_body: '北京市人民代表大会常务委员会', region: '北京', type: '地方法规', status: '即将生效',
    publish_date: '2026-05-15', effective_date: '2026-07-01',
    summary: '本条例旨在促进北京市数字经济发展，培育数据要素市场，推动数字产业化与产业数字化，建设全球数字经济标杆城市。',
    category: '数字经济', bidding_deadline: null, budget_amount: null, contact_info: null,
    created_at: '2026-05-15T00:00:00Z',
  },
  {
    id: 'policy-003', title: '上海市2026年度人工智能算力平台建设项目招标公告',
    document_number: 'SH-ZB-2026-0032',
    issuing_body: '上海市经济和信息化委员会', region: '上海', type: '招标公告', status: '招标中',
    publish_date: '2026-06-10', effective_date: '2026-06-10',
    summary: '上海市经济和信息化委员会现对2026年度人工智能算力平台建设项目进行公开招标，项目预算金额2.5亿元，建设内容包括算力集群、存储系统、网络系统等。',
    category: '信息化建设', bidding_deadline: '2026-07-10T17:00:00Z', budget_amount: 250000000, contact_info: '上海市经信委信息化推进处，电话：021-23111111',
    created_at: '2026-06-10T00:00:00Z',
  },
  {
    id: 'policy-004', title: '粤港澳大湾区数据跨境流动安全管理规定',
    document_number: '粤府令〔2026〕第302号',
    issuing_body: '广东省人民政府', region: '广东', type: '政府规章', status: '征求意见中',
    publish_date: '2026-04-20', effective_date: null,
    summary: '为促进粤港澳大湾区数据安全有序跨境流动，保障数据安全，保护个人信息权益，制定本规定。适用于大湾区内地九市与香港、澳门之间的数据跨境流动活动。',
    category: '数据安全', bidding_deadline: null, budget_amount: null, contact_info: '广东省司法厅，邮箱：sfj@gd.gov.cn',
    created_at: '2026-04-20T00:00:00Z',
  },
  {
    id: 'policy-005', title: '深圳市城市交通数字化转型项目（一期）招标',
    document_number: 'SZ-ZB-2026-0158',
    issuing_body: '深圳市交通运输局', region: '深圳', type: '招标公告', status: '招标中',
    publish_date: '2026-06-15', effective_date: '2026-06-15',
    summary: '深圳市交通运输局对城市交通数字化转型项目（一期）进行公开招标，预算金额1.8亿元，包括交通大脑平台建设、智慧信号灯系统、公交优先系统等。',
    category: '智慧交通', bidding_deadline: '2026-07-05T17:00:00Z', budget_amount: 180000000, contact_info: '深圳市交通运输局科技处，电话：0755-83165123',
    created_at: '2026-06-15T00:00:00Z',
  },
  {
    id: 'policy-006', title: '关于促进新能源产业高质量发展的若干政策措施',
    document_number: '发改能源〔2026〕456号',
    issuing_body: '国家发展改革委、国家能源局', region: '全国', type: '政策文件', status: '现行有效',
    publish_date: '2026-03-28', effective_date: '2026-04-28',
    summary: '从支持关键技术攻关、优化产业布局、完善市场机制、加强国际合作等方面提出20条政策措施，推动新能源产业高质量发展。',
    category: '新能源', bidding_deadline: null, budget_amount: null, contact_info: null,
    created_at: '2026-03-28T00:00:00Z',
  },
  {
    id: 'policy-007', title: '浙江省数字化改革"数字乡村"示范项目招标',
    document_number: 'ZJ-ZB-2026-0089',
    issuing_body: '浙江省农业农村厅', region: '浙江', type: '招标公告', status: '即将招标',
    publish_date: '2026-06-20', effective_date: '2026-06-25',
    summary: '浙江省农业农村厅对"数字乡村"示范项目进行公开招标，预算金额8000万元，覆盖20个示范村，建设内容包括数字农业平台、乡村治理系统等。',
    category: '数字乡村', bidding_deadline: '2026-07-20T17:00:00Z', budget_amount: 80000000, contact_info: '浙江省农业农村厅数字化处，电话：0571-86712345',
    created_at: '2026-06-20T00:00:00Z',
  },
  {
    id: 'policy-008', title: '2026年国家医保药品目录调整工作方案',
    document_number: '医保发〔2026〕22号',
    issuing_body: '国家医疗保障局', region: '全国', type: '政策文件', status: '现行有效',
    publish_date: '2026-05-10', effective_date: '2026-06-01',
    summary: '启动2026年国家医保药品目录调整工作，重点支持创新药、儿童用药、罕见病用药等纳入医保，优化医保药品结构。',
    category: '医疗保障', bidding_deadline: null, budget_amount: null, contact_info: null,
    created_at: '2026-05-10T00:00:00Z',
  },
  {
    id: 'policy-009', title: '成都市智慧医疗大数据平台建设采购项目',
    document_number: 'CD-ZB-2026-0210',
    issuing_body: '成都市卫生健康委员会', region: '四川', type: '招标公告', status: '招标中',
    publish_date: '2026-06-18', effective_date: '2026-06-18',
    summary: '成都市卫生健康委员会对智慧医疗大数据平台建设进行公开招标，预算金额1.2亿元，涵盖医疗数据汇聚平台、健康档案管理、AI辅助诊断等模块。',
    category: '智慧医疗', bidding_deadline: '2026-07-15T17:00:00Z', budget_amount: 120000000, contact_info: '成都市卫健委规划信息处，电话：028-61881234',
    created_at: '2026-06-18T00:00:00Z',
  },
  {
    id: 'policy-010', title: '数据安全治理能力评估标准（2026年版）',
    document_number: 'T/CESA 1234-2026',
    issuing_body: '中国电子工业标准化技术协会', region: '全国', type: '行业标准', status: '现行有效',
    publish_date: '2026-04-01', effective_date: '2026-07-01',
    summary: '本标准规定了组织数据安全治理能力评估的框架、指标和方法，适用于各类组织开展数据安全治理能力自评估和第三方评估。',
    category: '数据安全', bidding_deadline: null, budget_amount: null, contact_info: null,
    created_at: '2026-04-01T00:00:00Z',
  },
  {
    id: 'policy-011', title: '武汉市东湖高新区元宇宙产业培育项目招标',
    document_number: 'WH-ZB-2026-0056',
    issuing_body: '武汉东湖新技术开发区管委会', region: '湖北', type: '招标公告', status: '招标中',
    publish_date: '2026-06-22', effective_date: '2026-06-22',
    summary: '武汉东湖高新区对元宇宙产业培育项目进行公开招标，预算金额5000万元，包括元宇宙创新中心建设、应用场景开发、产业孵化服务等。',
    category: '元宇宙', bidding_deadline: '2026-07-12T17:00:00Z', budget_amount: 50000000, contact_info: '东湖高新区科创局，电话：027-67880123',
    created_at: '2026-06-22T00:00:00Z',
  },
  {
    id: 'policy-012', title: '关于进一步促进高校毕业生等青年就业创业的若干措施',
    document_number: '国办发〔2026〕18号',
    issuing_body: '国务院办公厅', region: '全国', type: '政策文件', status: '现行有效',
    publish_date: '2026-05-20', effective_date: '2026-06-01',
    summary: '从拓宽就业渠道、鼓励创业创新、加强就业服务、强化权益保障等方面提出15条措施，全力促进高校毕业生等青年就业创业。',
    category: '就业创业', bidding_deadline: null, budget_amount: null, contact_info: null,
    created_at: '2026-05-20T00:00:00Z',
  },
];

class PolicyBiddingService extends DataService {
  constructor() {
    super({
      tableName: 'policy_documents',
      packageCode: 'policy-bidding',
      packageName: '政策招投标',
      searchFields: ['title', 'issuing_body', 'document_number', 'summary'],
      defaultOrder: 'publish_date DESC',
    });
    this.inMemoryData = seedData;
  }

  async search(queryParams, pagination = { page: 1, limit: 20 }) {
    const { page, limit } = pagination;
    const { q, region, type, status } = queryParams;

    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (q) {
      conditions.push(`(title ILIKE $${paramIndex} OR summary ILIKE $${paramIndex} OR issuing_body ILIKE $${paramIndex})`);
      params.push(`%${q}%`);
      paramIndex++;
    }
    if (region) {
      conditions.push(`region ILIKE $${paramIndex}`);
      params.push(`%${region}%`);
      paramIndex++;
    }
    if (type) {
      conditions.push(`type ILIKE $${paramIndex}`);
      params.push(`%${type}%`);
      paramIndex++;
    }
    if (status) {
      conditions.push(`status ILIKE $${paramIndex}`);
      params.push(`%${status}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? conditions.join(' AND ') : '1=1';
    const offset = (page - 1) * limit;

    const rows = await this.dbQuery(
      `SELECT * FROM ${this.tableName} WHERE ${whereClause} ORDER BY publish_date DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    if (rows) {
      const countResult = await this.count(whereClause, params);
      return { data: rows, total: countResult };
    }

    // Fallback
    let filtered = [...this.inMemoryData];
    if (q) {
      filtered = this.filterByText(filtered, q, ['title', 'summary', 'issuing_body']);
    }
    if (region) {
      filtered = filtered.filter(item => item.region && item.region.includes(region));
    }
    if (type) {
      filtered = filtered.filter(item => item.type && item.type.includes(type));
    }
    if (status) {
      filtered = filtered.filter(item => item.status && item.status.includes(status));
    }

    return this.paginateData(filtered, page, limit);
  }
}

module.exports = new PolicyBiddingService();
