const { query } = require('../db/pool');
jest.mock('../db/pool');

const StartupIntelService = require('../services/startupIntel');

describe('StartupIntelService', () => {
  beforeEach(() => {
    query.mockReset();
    query.mockResolvedValue({ rows: null });
    StartupIntelService.dbAvailable = true;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('should set correct tableName and packageCode', () => {
      expect(StartupIntelService.tableName).toBe('market_news');
      expect(StartupIntelService.packageCode).toBe('startup-intel');
    });

    test('should load 12 seed records into inMemoryData', () => {
      expect(StartupIntelService.inMemoryData).toHaveLength(12);
    });
  });

  describe('search() - DB success', () => {
    test('should return results from DB when query returns rows', async () => {
      const mockRows = [
        { id: 'startup-001', title: 'DeepSeek融资', published_at: '2026-06-25T08:00:00Z' },
      ];
      query.mockResolvedValueOnce({ rows: mockRows });
      query.mockResolvedValueOnce({ rows: [{ count: '1' }] });

      const result = await StartupIntelService.search({}, { page: 1, limit: 20 });

      expect(result).toEqual({ data: mockRows, total: 1 });
      expect(query).toHaveBeenCalledTimes(2);
    });
  });

  describe('search() - DB fallback to in-memory data', () => {
    test('should filter by text query (q="AI")', async () => {
      const result = await StartupIntelService.search({ q: 'AI' }, { page: 1, limit: 20 });

      expect(result.data.length).toBeGreaterThan(0);
      expect(result.total).toBeGreaterThan(0);
      // Every returned item should contain "ai" in at least one searchable field
      result.data.forEach((item) => {
        const searchableText = [item.title, item.summary, item.source, item.industry]
          .join(' ')
          .toLowerCase();
        expect(searchableText).toContain('ai');
      });
    });

    test('should filter by industry (industry="人工智能")', async () => {
      const result = await StartupIntelService.search(
        { industry: '人工智能' },
        { page: 1, limit: 20 },
      );

      expect(result.data).toHaveLength(3);
      expect(result.total).toBe(3);
      result.data.forEach((item) => {
        expect(item.industry).toBe('人工智能');
      });
    });

    test('should filter by both q and industry together', async () => {
      const result = await StartupIntelService.search(
        { q: 'AI', industry: '人工智能' },
        { page: 1, limit: 20 },
      );

      // All 3 人工智能 records also contain "AI" in searchable fields
      expect(result.data).toHaveLength(3);
      expect(result.total).toBe(3);
      result.data.forEach((item) => {
        expect(item.industry).toBe('人工智能');
        const searchableText = [item.title, item.summary, item.source, item.industry]
          .join(' ')
          .toLowerCase();
        expect(searchableText).toContain('ai');
      });
    });

    test('should filter by date range (date_from and date_to)', async () => {
      const result = await StartupIntelService.search(
        { date_from: '2026-06-01', date_to: '2026-06-30' },
        { page: 1, limit: 20 },
      );

      expect(result.data).toHaveLength(10);
      expect(result.total).toBe(10);
      result.data.forEach((item) => {
        const d = new Date(item.published_at);
        expect(d >= new Date('2026-06-01')).toBe(true);
        expect(d <= new Date('2026-06-30')).toBe(true);
      });
    });

    test('should return all records sorted by published_at DESC when no params given', async () => {
      const result = await StartupIntelService.search({}, { page: 1, limit: 20 });

      expect(result.data).toHaveLength(12);
      expect(result.total).toBe(12);
      for (let i = 1; i < result.data.length; i++) {
        expect(
          new Date(result.data[i - 1].published_at) >= new Date(result.data[i].published_at),
        ).toBe(true);
      }
    });
  });

  describe('search() - pagination in fallback mode', () => {
    test('should paginate in-memory results correctly', async () => {
      const page1 = await StartupIntelService.search({}, { page: 1, limit: 5 });
      expect(page1.data).toHaveLength(5);
      expect(page1.total).toBe(12);
      expect(page1.data[0].id).toBe('startup-001');
      expect(page1.data[4].id).toBe('startup-005');

      const page2 = await StartupIntelService.search({}, { page: 2, limit: 5 });
      expect(page2.data).toHaveLength(5);
      expect(page2.total).toBe(12);
      expect(page2.data[0].id).toBe('startup-006');
      expect(page2.data[4].id).toBe('startup-010');

      const page3 = await StartupIntelService.search({}, { page: 3, limit: 5 });
      expect(page3.data).toHaveLength(2);
      expect(page3.total).toBe(12);
      expect(page3.data[0].id).toBe('startup-011');
      expect(page3.data[1].id).toBe('startup-012');
    });
  });

  describe('getById() - inherited from DataService', () => {
    test('should return a record from DB when found', async () => {
      const mockRow = { id: 'startup-001', title: 'DeepSeek融资', published_at: '2026-06-25T08:00:00Z' };
      query.mockResolvedValue({ rows: [mockRow] });

      const result = await StartupIntelService.getById('startup-001');

      expect(result).toEqual(mockRow);
      expect(query).toHaveBeenCalledTimes(1);
    });

    test('should fall back to in-memory data when DB is unavailable', async () => {
      query.mockRejectedValue({ code: 'ECONNREFUSED' });

      const result = await StartupIntelService.getById('startup-001');

      expect(result).toBeTruthy();
      expect(result.id).toBe('startup-001');
      expect(result.title).toContain('深度求索');
    });

    test('should return null when ID is not found in fallback', async () => {
      query.mockRejectedValue({ code: 'ECONNREFUSED' });

      const result = await StartupIntelService.getById('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('getStats() - inherited from DataService', () => {
    test('should return stats from DB when available', async () => {
      query.mockResolvedValueOnce({ rows: [{ total_count: '12' }] });
      query.mockResolvedValueOnce({
        rows: [{ id: 'startup-001', created_at: '2026-06-25T08:30:00Z' }],
      });

      const result = await StartupIntelService.getStats();

      expect(result).toEqual({
        totalRecords: 12,
        lastUpdated: '2026-06-25T08:30:00Z',
        package: 'startup-intel',
      });
      expect(query).toHaveBeenCalledTimes(2);
    });

    test('should fall back to in-memory data when DB is unavailable', async () => {
      query.mockRejectedValue({ code: 'ECONNREFUSED' });

      const result = await StartupIntelService.getStats();

      expect(result.totalRecords).toBe(12);
      expect(result.lastUpdated).toBe('2026-06-25T08:30:00Z');
      expect(result.package).toBe('startup-intel');
    });
  });
});
