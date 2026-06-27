const DataService = require('./dataService');

const seedData = [
  {
    id: 'edu-001', institution_name: '清华大学', country: '中国', region: '北京',
    level: '高等教育', subject: '计算机科学与技术',
    program_name: '计算机科学与技术（人工智能方向）本科项目',
    degree_type: '学士', duration: '4年', tuition_fees: 50000,
    language: '中文', ranking: 1,
    description: '清华大学计算机科学与技术专业在AI、数据科学等领域具有国际领先水平，拥有国家重点实验室和优秀师资队伍。',
    website: 'https://www.tsinghua.edu.cn', application_deadline: '2026-06-30', intake_year: 2026,
    created_at: '2026-06-25T00:00:00Z',
  },
  {
    id: 'edu-002', institution_name: '北京大学', country: '中国', region: '北京',
    level: '高等教育', subject: '经济学',
    program_name: '经济学硕士项目（金融科技方向）',
    degree_type: '硕士', duration: '2年', tuition_fees: 80000,
    language: '中文', ranking: 2,
    description: '北大经济学院与光华管理学院联合培养金融科技高端人才，课程涵盖区块链、数字货币、量化交易等前沿领域。',
    website: 'https://www.pku.edu.cn', application_deadline: '2026-07-15', intake_year: 2026,
    created_at: '2026-06-24T00:00:00Z',
  },
  {
    id: 'edu-003', institution_name: 'Stanford University', country: '美国', region: '加利福尼亚州',
    level: '高等教育', subject: '人工智能',
    program_name: 'Master of Science in Artificial Intelligence',
    degree_type: '硕士', duration: '2年', tuition_fees: 65000,
    language: '英语', ranking: 3,
    description: 'Stanford AI program is world-renowned, offering cutting-edge research in machine learning, natural language processing, and computer vision. Located in the heart of Silicon Valley.',
    website: 'https://www.stanford.edu', application_deadline: '2026-12-01', intake_year: 2027,
    created_at: '2026-06-23T00:00:00Z',
  },
  {
    id: 'edu-004', institution_name: '浙江大学', country: '中国', region: '浙江',
    level: '高等教育', subject: '数据科学',
    program_name: '数据科学与大数据技术本科专业',
    degree_type: '学士', duration: '4年', tuition_fees: 48000,
    language: '中文', ranking: 4,
    description: '浙大数据科学专业融合计算机、统计和管理学，培养具备大数据分析与处理能力的高素质复合型人才。',
    website: 'https://www.zju.edu.cn', application_deadline: '2026-06-30', intake_year: 2026,
    created_at: '2026-06-22T00:00:00Z',
  },
  {
    id: 'edu-005', institution_name: '上海交通大学', country: '中国', region: '上海',
    level: '高等教育', subject: '生物医学工程',
    program_name: '生物医学工程（医学影像AI方向）博士项目',
    degree_type: '博士', duration: '4年', tuition_fees: 10000,
    language: '中文', ranking: 5,
    description: '上海交通大学生物医学工程学院在医学影像AI、脑机接口等方向具有国际影响力，承担多项国家重点研发计划。',
    website: 'https://www.sjtu.edu.cn', application_deadline: '2026-08-31', intake_year: 2026,
    created_at: '2026-06-21T00:00:00Z',
  },
  {
    id: 'edu-006', institution_name: 'Massachusetts Institute of Technology', country: '美国', region: '马萨诸塞州',
    level: '高等教育', subject: '量子计算',
    program_name: 'PhD in Quantum Computing and Information',
    degree_type: '博士', duration: '5年', tuition_fees: 58000,
    language: '英语', ranking: 1,
    description: 'MIT offers a world-class PhD program in quantum computing with access to cutting-edge quantum hardware and leading researchers in the field.',
    website: 'https://web.mit.edu', application_deadline: '2026-12-15', intake_year: 2027,
    created_at: '2026-06-20T00:00:00Z',
  },
  {
    id: 'edu-007', institution_name: '复旦大学', country: '中国', region: '上海',
    level: '高等教育', subject: '微电子',
    program_name: '集成电路科学与工程硕士项目',
    degree_type: '硕士', duration: '2.5年', tuition_fees: 60000,
    language: '中文', ranking: 6,
    description: '复旦大学微电子学院是国内集成电路人才培养的重要基地，与中芯国际、华虹半导体等企业深度合作。',
    website: 'https://www.fudan.edu.cn', application_deadline: '2026-07-31', intake_year: 2026,
    created_at: '2026-06-19T00:00:00Z',
  },
  {
    id: 'edu-008', institution_name: 'National University of Singapore', country: '新加坡', region: '新加坡',
    level: '高等教育', subject: '数据科学与机器学习',
    program_name: 'Master of Science in Data Science and Machine Learning',
    degree_type: '硕士', duration: '1.5年', tuition_fees: 55000,
    language: '英语', ranking: 8,
    description: 'NUS DSML program offers rigorous training in statistical modeling, machine learning, and big data analytics. Strong industry connections in Asia.',
    website: 'https://www.nus.edu.sg', application_deadline: '2027-01-15', intake_year: 2027,
    created_at: '2026-06-18T00:00:00Z',
  },
  {
    id: 'edu-009', institution_name: '中国科学技术大学', country: '中国', region: '安徽',
    level: '高等教育', subject: '物理学',
    program_name: '量子信息科学本科项目',
    degree_type: '学士', duration: '4年', tuition_fees: 45000,
    language: '中文', ranking: 7,
    description: '中国科大在量子信息领域处于国际领先地位，潘建伟院士团队主导的量子通信和量子计算研究享誉世界。',
    website: 'https://www.ustc.edu.cn', application_deadline: '2026-06-30', intake_year: 2026,
    created_at: '2026-06-17T00:00:00Z',
  },
  {
    id: 'edu-010', institution_name: 'University of Cambridge', country: '英国', region: '英格兰',
    level: '高等教育', subject: '人工智能与伦理学',
    program_name: 'MPhil in AI Ethics and Society',
    degree_type: '硕士', duration: '1年', tuition_fees: 45000,
    language: '英语', ranking: 2,
    description: 'Cambridge offers a unique interdisciplinary program examining the ethical implications of AI, combining philosophy, computer science, and public policy.',
    website: 'https://www.cam.ac.uk', application_deadline: '2026-11-30', intake_year: 2027,
    created_at: '2026-06-16T00:00:00Z',
  },
  {
    id: 'edu-011', institution_name: '南京大学', country: '中国', region: '江苏',
    level: '高等教育', subject: '软件工程',
    program_name: '软件工程（智能化软件方向）本科项目',
    degree_type: '学士', duration: '4年', tuition_fees: 46000,
    language: '中文', ranking: 9,
    description: '南京大学软件学院是国家示范性软件学院，智能化软件方向专注于AI驱动的软件开发方法和工具。',
    website: 'https://www.nju.edu.cn', application_deadline: '2026-06-30', intake_year: 2026,
    created_at: '2026-06-15T00:00:00Z',
  },
  {
    id: 'edu-012', institution_name: 'ETH Zürich', country: '瑞士', region: '苏黎世',
    level: '高等教育', subject: '机器人学',
    program_name: 'Master in Robotics, Systems and Control',
    degree_type: '硕士', duration: '2年', tuition_fees: 1500,
    language: '英语', ranking: 4,
    description: 'ETH Zurich offers a world-renowned robotics program with focus on autonomous systems, robotic manipulation, and embodied AI. Affordable tuition with high quality of life.',
    website: 'https://ethz.ch', application_deadline: '2026-12-15', intake_year: 2027,
    created_at: '2026-06-14T00:00:00Z',
  },
];

class EducationService extends DataService {
  constructor() {
    super({
      tableName: 'educational_data',
      packageCode: 'education',
      packageName: '教育',
      searchFields: ['institution_name', 'program_name', 'subject', 'description'],
      defaultOrder: 'ranking ASC',
    });
    this.inMemoryData = seedData;
  }

  async search(queryParams, pagination = { page: 1, limit: 20 }) {
    const { page, limit } = pagination;
    const { q, country, level, subject } = queryParams;

    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (q) {
      conditions.push(`(institution_name ILIKE $${paramIndex} OR program_name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`);
      params.push(`%${q}%`);
      paramIndex++;
    }
    if (country) {
      conditions.push(`country ILIKE $${paramIndex}`);
      params.push(`%${country}%`);
      paramIndex++;
    }
    if (level) {
      conditions.push(`level ILIKE $${paramIndex}`);
      params.push(`%${level}%`);
      paramIndex++;
    }
    if (subject) {
      conditions.push(`subject ILIKE $${paramIndex}`);
      params.push(`%${subject}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? conditions.join(' AND ') : '1=1';
    const offset = (page - 1) * limit;

    const rows = await this.dbQuery(
      `SELECT * FROM ${this.tableName} WHERE ${whereClause} ORDER BY ranking ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    if (rows) {
      const countResult = await this.count(whereClause, params);
      return { data: rows, total: countResult };
    }

    // Fallback
    let filtered = [...this.inMemoryData];
    if (q) {
      filtered = this.filterByText(filtered, q, ['institution_name', 'program_name', 'description', 'subject']);
    }
    if (country) {
      filtered = filtered.filter(item => item.country && item.country.includes(country));
    }
    if (level) {
      filtered = filtered.filter(item => item.level && item.level.includes(level));
    }
    if (subject) {
      filtered = filtered.filter(item => item.subject && item.subject.includes(subject));
    }

    return this.paginateData(filtered, page, limit);
  }
}

module.exports = new EducationService();
