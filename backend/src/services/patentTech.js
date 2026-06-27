const DataService = require('./dataService');

const seedData = [
  {
    id: 'pat-001', patent_number: 'CN114567890A', title: '一种基于深度学习的自然语言处理方法及系统',
    abstract: '本发明公开了一种基于深度学习的自然语言处理方法，包括：获取输入文本序列，通过预训练语言模型提取语义特征，基于注意力机制对语义特征进行加权处理，生成目标输出。本发明提高了自然语言处理的准确性和效率。',
    assignee: '华为技术有限公司', inventors: ['张伟', '李明', '王芳'],
    filing_date: '2025-03-15', publication_date: '2025-09-20',
    cpc_class: 'G06N3/08', ipc_class: 'G06N3/08', status: '公开',
    country: '中国', claims_count: 12, citations_count: 5,
    created_at: '2025-09-20T00:00:00Z',
  },
  {
    id: 'pat-002', patent_number: 'CN114567891A', title: '固态电池电解质材料及其制备方法',
    abstract: '本发明提供一种固态电池电解质材料，化学式为Li6PS5Cl，采用高能球磨法制备。该材料在室温下离子电导率达到10^(-3)S/cm级别，电化学稳定性窗口达到5V以上。',
    assignee: '宁德时代新能源科技股份有限公司', inventors: ['陈立泉', '赵忠尧'],
    filing_date: '2025-05-20', publication_date: '2025-11-25',
    cpc_class: 'H01M10/056', ipc_class: 'H01M10/056', status: '授权',
    country: '中国', claims_count: 8, citations_count: 15,
    created_at: '2025-11-25T00:00:00Z',
  },
  {
    id: 'pat-003', patent_number: 'US20260012345A1', title: 'Quantum Error Correction Using Surface Codes with Adaptive Decoding',
    abstract: 'A method for quantum error correction using surface codes with adaptive decoding techniques. The method reduces logical error rates by dynamically adjusting decoding parameters based on noise characteristics.',
    assignee: 'Google LLC', inventors: ['Hartmut Neven', 'John Martinis'],
    filing_date: '2025-08-10', publication_date: '2026-02-15',
    cpc_class: 'G06N10/00', ipc_class: 'G06N10/00', status: '公开',
    country: '美国', claims_count: 20, citations_count: 8,
    created_at: '2026-02-15T00:00:00Z',
  },
  {
    id: 'pat-004', patent_number: 'CN114567892A', title: '自动驾驶车辆路径规划方法及装置',
    abstract: '本发明提供一种自动驾驶车辆路径规划方法，结合深度强化学习和模型预测控制，在复杂交通场景下实时生成最优行驶轨迹。实验表明该方法在密集车流中的规划成功率提高至98.5%。',
    assignee: '小马智行科技有限公司', inventors: ['楼天城', '彭军'],
    filing_date: '2025-06-01', publication_date: '2025-12-01',
    cpc_class: 'G05D1/02', ipc_class: 'G05D1/02', status: '授权',
    country: '中国', claims_count: 15, citations_count: 12,
    created_at: '2025-12-01T00:00:00Z',
  },
  {
    id: 'pat-005', patent_number: 'EP20250012345A1', title: 'Method for Producing Green Hydrogen Using Photocatalytic Water Splitting',
    abstract: 'A method for producing hydrogen through photocatalytic water splitting using a novel Z-scheme heterojunction photocatalyst comprising BiVO4 and g-C3N4. Solar-to-hydrogen efficiency reaches 8.5%.',
    assignee: 'Siemens Energy AG', inventors: ['Klaus Schmidt', 'Anna Weber'],
    filing_date: '2025-04-22', publication_date: '2025-10-30',
    cpc_class: 'C25B1/04', ipc_class: 'C25B1/04', status: '审查中',
    country: '欧洲', claims_count: 14, citations_count: 3,
    created_at: '2025-10-30T00:00:00Z',
  },
  {
    id: 'pat-006', patent_number: 'CN114567893A', title: '基于区块链的数据共享与隐私保护方法',
    abstract: '本发明涉及一种基于区块链的数据共享与隐私保护方法，采用同态加密和零知识证明技术，在保障数据隐私的前提下实现多方数据的安全共享和计算。',
    assignee: '蚂蚁科技集团股份有限公司', inventors: ['蒋国飞', '周政'],
    filing_date: '2025-07-15', publication_date: '2026-01-15',
    cpc_class: 'H04L9/32', ipc_class: 'H04L9/32', status: '公开',
    country: '中国', claims_count: 10, citations_count: 7,
    created_at: '2026-01-15T00:00:00Z',
  },
  {
    id: 'pat-007', patent_number: 'JP20260012345A', title: '半導体レーザー素子及びその製造方法',
    abstract: '高効率な半導体レーザー素子を提供する。活性層にInGaAsP系量子井戸構造を用い、共振器端面に高反射コーティングを施すことで、しきい値電流を低減し、出力効率を向上させる。',
    assignee: 'ソニーグループ株式会社', inventors: ['佐藤健一', '田中宏'],
    filing_date: '2025-09-05', publication_date: '2026-03-05',
    cpc_class: 'H01S5/00', ipc_class: 'H01S5/00', status: '公开',
    country: '日本', claims_count: 7, citations_count: 2,
    created_at: '2026-03-05T00:00:00Z',
  },
  {
    id: 'pat-008', patent_number: 'CN114567894A', title: 'CRISPR-Cas9基因编辑系统及其在治疗遗传性疾病中的应用',
    abstract: '本发明提供了一种改进的CRISPR-Cas9基因编辑系统，通过优化sgRNA设计和Cas9蛋白变体，将脱靶效应降低至传统方法的1/10以下，并在β-地中海贫血小鼠模型中实现了有效的基因治疗。',
    assignee: '北京华大基因研究院', inventors: ['汪建', '杨焕明'],
    filing_date: '2025-10-01', publication_date: '2026-04-01',
    cpc_class: 'C12N15/113', ipc_class: 'C12N15/113', status: '审查中',
    country: '中国', claims_count: 18, citations_count: 20,
    created_at: '2026-04-01T00:00:00Z',
  },
  {
    id: 'pat-009', patent_number: 'KR20260012345A', title: '고효율 태양전지 및 그 제조방법',
    abstract: '페로브스카이트-실리콘 탠덤 태양전지의 효율을 향상시키기 위한 계면층 기술에 관한 발명으로, 33.5%의 인증 효율을 달성하였다.',
    assignee: '삼성전자주식회사', inventors: ['김민수', '이지영'],
    filing_date: '2025-11-20', publication_date: '2026-05-20',
    cpc_class: 'H01L31/072', ipc_class: 'H01L31/072', status: '公开',
    country: '韩国', claims_count: 11, citations_count: 4,
    created_at: '2026-05-20T00:00:00Z',
  },
  {
    id: 'pat-010', patent_number: 'CN114567895A', title: '基于边缘计算的实时视频分析系统',
    abstract: '本发明提供一种基于边缘计算的实时视频分析系统，通过在网络边缘部署轻量化深度学习模型，实现毫秒级视频分析响应，适用于智慧城市、工业质检等场景。',
    assignee: '海康威视数字技术股份有限公司', inventors: ['胡扬忠', '邬伟琪'],
    filing_date: '2025-12-10', publication_date: '2026-06-10',
    cpc_class: 'H04N7/18', ipc_class: 'H04N7/18', status: '公开',
    country: '中国', claims_count: 9, citations_count: 1,
    created_at: '2026-06-10T00:00:00Z',
  },
  {
    id: 'pat-011', patent_number: 'CN114567896A', title: 'mRNA疫苗脂质纳米颗粒递送系统',
    abstract: '本发明提供一种新型可电离脂质及其在mRNA疫苗递送中的应用。该脂质纳米颗粒在体内表现出高效的mRNA递送能力和良好的生物安全性，在新冠和流感疫苗中展现出优异效果。',
    assignee: '艾博生物科技有限公司', inventors: ['英博', '张旭'],
    filing_date: '2025-08-05', publication_date: '2026-02-05',
    cpc_class: 'A61K9/51', ipc_class: 'A61K9/51', status: '公开',
    country: '中国', claims_count: 16, citations_count: 25,
    created_at: '2026-02-05T00:00:00Z',
  },
  {
    id: 'pat-012', patent_number: 'CN114567897A', title: '大模型训练方法、装置及计算设备',
    abstract: '本发明提供了一种大模型训练方法，采用混合专家模型（MoE）架构和流水线并行策略，支持在千卡规模集群上高效训练万亿参数级别的大语言模型，训练效率提升40%以上。',
    assignee: '深度求索人工智能基础技术研究有限公司', inventors: ['梁文锋', '刘知远'],
    filing_date: '2026-01-15', publication_date: '2026-06-15',
    cpc_class: 'G06N3/045', ipc_class: 'G06N3/045', status: '公开',
    country: '中国', claims_count: 13, citations_count: 0,
    created_at: '2026-06-15T00:00:00Z',
  },
];

class PatentTechService extends DataService {
  constructor() {
    super({
      tableName: 'patents',
      packageCode: 'patent-tech',
      packageName: '专利科技',
      searchFields: ['title', 'abstract', 'assignee', 'patent_number'],
      defaultOrder: 'filing_date DESC',
    });
    this.inMemoryData = seedData;
  }

  async search(queryParams, pagination = { page: 1, limit: 20 }) {
    const { page, limit } = pagination;
    const { q, assignee, cpc_class, date_from, date_to } = queryParams;

    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (q) {
      conditions.push(`(title ILIKE $${paramIndex} OR abstract ILIKE $${paramIndex} OR patent_number ILIKE $${paramIndex})`);
      params.push(`%${q}%`);
      paramIndex++;
    }
    if (assignee) {
      conditions.push(`assignee ILIKE $${paramIndex}`);
      params.push(`%${assignee}%`);
      paramIndex++;
    }
    if (cpc_class) {
      conditions.push(`cpc_class ILIKE $${paramIndex}`);
      params.push(`%${cpc_class}%`);
      paramIndex++;
    }
    if (date_from) {
      conditions.push(`filing_date >= $${paramIndex}::date`);
      params.push(date_from);
      paramIndex++;
    }
    if (date_to) {
      conditions.push(`filing_date <= $${paramIndex}::date`);
      params.push(date_to);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? conditions.join(' AND ') : '1=1';
    const offset = (page - 1) * limit;

    const rows = await this.dbQuery(
      `SELECT * FROM ${this.tableName} WHERE ${whereClause} ORDER BY filing_date DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    if (rows) {
      const countResult = await this.count(whereClause, params);
      return { data: rows, total: countResult };
    }

    // Fallback
    let filtered = [...this.inMemoryData];
    if (q) {
      filtered = this.filterByText(filtered, q, ['title', 'abstract', 'patent_number', 'assignee']);
    }
    if (assignee) {
      filtered = filtered.filter(item =>
        item.assignee && item.assignee.toLowerCase().includes(assignee.toLowerCase())
      );
    }
    if (cpc_class) {
      filtered = filtered.filter(item =>
        item.cpc_class && item.cpc_class.toLowerCase().includes(cpc_class.toLowerCase())
      );
    }
    if (date_from || date_to) {
      filtered = this.filterByDateRange(filtered, 'filing_date', date_from, date_to);
    }

    return this.paginateData(filtered, page, limit);
  }
}

module.exports = new PatentTechService();
