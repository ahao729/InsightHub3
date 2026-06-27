const DataService = require('./dataService');

const seedData = [
  {
    id: 'web3-001', name: 'Bitcoin', symbol: 'BTC', type: '加密货币',
    chain: 'Bitcoin', token_address: null,
    market_cap: 1850000000000, price: 95680.50, volume_24h: 42000000000,
    circulating_supply: 19350000, total_supply: 21000000,
    description: '比特币是全球第一个去中心化加密货币，由中本聪于2009年创建。采用工作量证明共识机制，被视为数字黄金。',
    website: 'https://bitcoin.org', whitepaper_url: 'https://bitcoin.org/bitcoin.pdf',
    tags: ['加密货币', '数字黄金', 'PoW', '去中心化'],
    launched_date: '2009-01-03', risk_score: 'medium',
    created_at: '2026-06-25T00:00:00Z',
  },
  {
    id: 'web3-002', name: 'Ethereum', symbol: 'ETH', type: '公链平台',
    chain: 'Ethereum', token_address: null,
    market_cap: 650000000000, price: 5420.30, volume_24h: 28000000000,
    circulating_supply: 120000000, total_supply: null,
    description: '以太坊是领先的智能合约平台，支持去中心化应用（dApps）和DeFi生态。2022年完成PoS转型后能源消耗降低99.95%。',
    website: 'https://ethereum.org', whitepaper_url: 'https://ethereum.org/whitepaper',
    tags: ['智能合约', 'DeFi', 'PoS', 'Layer1'],
    launched_date: '2015-07-30', risk_score: 'medium',
    created_at: '2026-06-25T00:00:00Z',
  },
  {
    id: 'web3-003', name: 'Solana', symbol: 'SOL', type: '公链平台',
    chain: 'Solana', token_address: null,
    market_cap: 95000000000, price: 198.45, volume_24h: 5200000000,
    circulating_supply: 479000000, total_supply: null,
    description: 'Solana是一条高性能公链，采用历史证明（PoH）机制，理论TPS可达65000，是DePIN和Meme生态活跃的Layer1。',
    website: 'https://solana.com', whitepaper_url: 'https://solana.com/solana-whitepaper.pdf',
    tags: ['高性能', 'Layer1', 'DePIN', 'PoH'],
    launched_date: '2020-03-16', risk_score: 'high',
    created_at: '2026-06-24T00:00:00Z',
  },
  {
    id: 'web3-004', name: 'ChainLink', symbol: 'LINK', type: '预言机',
    chain: 'Ethereum', token_address: '0x514910771AF9Ca656af840dff83E8264EcF986CA',
    market_cap: 18500000000, price: 28.60, volume_24h: 1800000000,
    circulating_supply: 600000000, total_supply: 1000000000,
    description: 'Chainlink是去中心化预言机网络，连接智能合约与真实世界数据。CCIP跨链互操作协议已成为行业标准。',
    website: 'https://chain.link', whitepaper_url: 'https://chain.link/whitepaper',
    tags: ['预言机', 'CCIP', '跨链', '数据'],
    launched_date: '2019-05-30', risk_score: 'medium',
    created_at: '2026-06-24T00:00:00Z',
  },
  {
    id: 'web3-005', name: 'Uniswap', symbol: 'UNI', type: 'DeFi协议',
    chain: 'Ethereum', token_address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
    market_cap: 12500000000, price: 18.20, volume_24h: 850000000,
    circulating_supply: 600000000, total_supply: 1000000000,
    description: 'Uniswap是最大的去中心化交易平台（DEX），采用AMM机制。Uniswap v4引入Hooks架构，极大提升了资金效率和可组合性。',
    website: 'https://uniswap.org', whitepaper_url: null,
    tags: ['DEX', 'AMM', 'DeFi', '自动化做市'],
    launched_date: '2018-11-02', risk_score: 'medium',
    created_at: '2026-06-23T00:00:00Z',
  },
  {
    id: 'web3-006', name: 'Aave', symbol: 'AAVE', type: 'DeFi协议',
    chain: 'Ethereum', token_address: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9',
    market_cap: 5800000000, price: 385.00, volume_24h: 420000000,
    circulating_supply: 15000000, total_supply: 16000000,
    description: 'Aave是领先的去中心化借贷协议，支持闪电贷、利率互换等创新功能。GHO稳定币已成为DeFi生态重要基础设施。',
    website: 'https://aave.com', whitepaper_url: null,
    tags: ['借贷', 'DeFi', '闪电贷', '稳定币'],
    launched_date: '2020-01-08', risk_score: 'medium',
    created_at: '2026-06-23T00:00:00Z',
  },
  {
    id: 'web3-007', name: 'Polygon', symbol: 'MATIC', type: 'Layer2扩展',
    chain: 'Polygon', token_address: '0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0',
    market_cap: 15000000000, price: 1.52, volume_24h: 1200000000,
    circulating_supply: 9800000000, total_supply: 10000000000,
    description: 'Polygon是以太坊Layer2扩展解决方案，提供侧链、ZK-Rollup等多种扩容技术。Polygon zkEVM已实现以太坊等效性。',
    website: 'https://polygon.technology', whitepaper_url: null,
    tags: ['Layer2', 'ZK-Rollup', '扩展', 'EVM'],
    launched_date: '2020-05-30', risk_score: 'medium',
    created_at: '2026-06-22T00:00:00Z',
  },
  {
    id: 'web3-008', name: 'Arweave', symbol: 'AR', type: '去中心化存储',
    chain: 'Arweave', token_address: null,
    market_cap: 3200000000, price: 42.80, volume_24h: 280000000,
    circulating_supply: 66000000, total_supply: 66000000,
    description: 'Arweave提供永久去中心化存储，采用"一次付费、永久存储"模式。permaweb生态包括社交、博客、数据存档等应用。',
    website: 'https://arweave.org', whitepaper_url: 'https://arweave.org/whitepaper',
    tags: ['存储', '永久存储', 'permaweb', '去中心化'],
    launched_date: '2018-06-08', risk_score: 'high',
    created_at: '2026-06-22T00:00:00Z',
  },
  {
    id: 'web3-009', name: 'MakerDAO', symbol: 'MKR', type: 'DeFi协议',
    chain: 'Ethereum', token_address: '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2',
    market_cap: 2800000000, price: 2800.00, volume_24h: 180000000,
    circulating_supply: 1000000, total_supply: 1000000,
    description: 'MakerDAO是DAI稳定币的发行方，也是DeFi领域最古老和最大规模的DAO组织。DAI目前是第三大去中心化稳定币。',
    website: 'https://makerdao.com', whitepaper_url: null,
    tags: ['稳定币', 'DAI', 'DAO', '抵押借贷'],
    launched_date: '2017-12-18', risk_score: 'low',
    created_at: '2026-06-21T00:00:00Z',
  },
  {
    id: 'web3-010', name: 'The Graph', symbol: 'GRT', type: '索引协议',
    chain: 'Ethereum', token_address: '0xc944E90C64B2c07662A292be6244BDf05Cda44a7',
    market_cap: 4200000000, price: 0.45, volume_24h: 350000000,
    circulating_supply: 9500000000, total_supply: 10000000000,
    description: 'The Graph是区块链数据索引协议，为dApp提供高效的链上数据查询服务。支持20+条链的子图部署。',
    website: 'https://thegraph.com', whitepaper_url: null,
    tags: ['索引', '数据查询', 'API', '子图'],
    launched_date: '2020-12-17', risk_score: 'low',
    created_at: '2026-06-21T00:00:00Z',
  },
  {
    id: 'web3-011', name: 'Lido', symbol: 'LDO', type: '流动性质押',
    chain: 'Ethereum', token_address: '0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32',
    market_cap: 3800000000, price: 3.80, volume_24h: 420000000,
    circulating_supply: 1000000000, total_supply: 1000000000,
    description: 'Lido是最大的ETH流动性质押协议，用户可通过质押ETH获得stETH，在保证资金流动性的同时获取质押收益。',
    website: 'https://lido.fi', whitepaper_url: null,
    tags: ['流动性质押', 'stETH', 'ETH质押', 'DeFi'],
    launched_date: '2020-12-18', risk_score: 'low',
    created_at: '2026-06-20T00:00:00Z',
  },
  {
    id: 'web3-012', name: 'Worldcoin', symbol: 'WLD', type: '身份协议',
    chain: 'Ethereum', token_address: '0x163f8C2467924be0ae7B5347228CABF260318753',
    market_cap: 8500000000, price: 8.50, volume_24h: 1850000000,
    circulating_supply: 1000000000, total_supply: 10000000000,
    description: 'Worldcoin由Sam Altman联合创立，通过虹膜扫描技术提供全球唯一的数字身份证明，World ID已服务超过2000万用户。',
    website: 'https://worldcoin.org', whitepaper_url: null,
    tags: ['数字身份', 'World ID', '零知识证明', '隐私'],
    launched_date: '2023-07-24', risk_score: 'high',
    created_at: '2026-06-20T00:00:00Z',
  },
];

class Web3CryptoService extends DataService {
  constructor() {
    super({
      tableName: 'web3_data',
      packageCode: 'web3-crypto',
      packageName: 'Web3 / Crypto',
      searchFields: ['name', 'symbol', 'description', 'chain'],
      defaultOrder: 'market_cap DESC',
    });
    this.inMemoryData = seedData;
  }

  async search(queryParams, pagination = { page: 1, limit: 20 }) {
    const { page, limit } = pagination;
    const { q, chain, token, date_from, date_to } = queryParams;

    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (q) {
      conditions.push(`(name ILIKE $${paramIndex} OR symbol ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`);
      params.push(`%${q}%`);
      paramIndex++;
    }
    if (chain) {
      conditions.push(`chain ILIKE $${paramIndex}`);
      params.push(`%${chain}%`);
      paramIndex++;
    }
    if (token) {
      conditions.push(`(name ILIKE $${paramIndex} OR symbol ILIKE $${paramIndex})`);
      params.push(`%${token}%`);
      paramIndex++;
    }
    if (date_from) {
      conditions.push(`launched_date >= $${paramIndex}::date`);
      params.push(date_from);
      paramIndex++;
    }
    if (date_to) {
      conditions.push(`launched_date <= $${paramIndex}::date`);
      params.push(date_to);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? conditions.join(' AND ') : '1=1';
    const offset = (page - 1) * limit;

    const rows = await this.dbQuery(
      `SELECT * FROM ${this.tableName} WHERE ${whereClause} ORDER BY market_cap DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    if (rows) {
      const countResult = await this.count(whereClause, params);
      return { data: rows, total: countResult };
    }

    // Fallback
    let filtered = [...this.inMemoryData];
    if (q) {
      filtered = this.filterByText(filtered, q, ['name', 'symbol', 'description', 'chain']);
    }
    if (chain) {
      filtered = filtered.filter(item => item.chain && item.chain.toLowerCase().includes(chain.toLowerCase()));
    }
    if (token) {
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(token.toLowerCase()) ||
        item.symbol.toLowerCase().includes(token.toLowerCase())
      );
    }
    if (date_from || date_to) {
      filtered = this.filterByDateRange(filtered, 'launched_date', date_from, date_to);
    }

    return this.paginateData(filtered, page, limit);
  }
}

module.exports = new Web3CryptoService();
