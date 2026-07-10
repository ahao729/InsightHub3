const { query } = require('../db/pool');
jest.mock('../db/pool');

const DataService = require('../services/dataService');

describe('DataService', () => {
  const defaultOptions = {
    tableName: 'test_table',
    packageCode: 'TEST',
    packageName: 'Test Package',
  };

  const fullOptions = {
    tableName: 'test_table',
    packageCode: 'TEST',
    packageName: 'Test Package',
    searchFields: ['name', 'description'],
    defaultOrder: 'name ASC',
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('should set all options correctly', () => {
      const service = new DataService(fullOptions);
      expect(service.tableName).toBe('test_table');
      expect(service.packageCode).toBe('TEST');
      expect(service.packageName).toBe('Test Package');
      expect(service.searchFields).toEqual(['name', 'description']);
      expect(service.defaultOrder).toBe('name ASC');
      expect(service.inMemoryData).toEqual([]);
      expect(service.dbAvailable).toBe(true);
    });

    test('should use defaults for searchFields and defaultOrder when not provided', () => {
      const service = new DataService(defaultOptions);
      expect(service.searchFields).toEqual([]);
      expect(service.defaultOrder).toBe('created_at DESC');
    });
  });

  describe('checkDb', () => {
    test('should return true and set dbAvailable=true when SELECT 1 succeeds', async () => {
      query.mockResolvedValue({ rows: [] });
      const service = new DataService(defaultOptions);
      const result = await service.checkDb();

      expect(result).toBe(true);
      expect(service.dbAvailable).toBe(true);
      expect(query).toHaveBeenCalledWith('SELECT 1');
    });

    test('should return false and set dbAvailable=false when SELECT 1 fails', async () => {
      query.mockRejectedValue(new Error('connection failed'));
      const service = new DataService(defaultOptions);
      const result = await service.checkDb();

      expect(result).toBe(false);
      expect(service.dbAvailable).toBe(false);
    });
  });

  describe('dbQuery', () => {
    test('should return result.rows on success', async () => {
      const rows = [{ id: 1 }, { id: 2 }];
      query.mockResolvedValue({ rows });
      const service = new DataService(defaultOptions);
      const result = await service.dbQuery('SELECT * FROM test');

      expect(result).toEqual(rows);
      expect(query).toHaveBeenCalledWith('SELECT * FROM test', []);
    });

    test.each([
      ['ECONNREFUSED'],
      ['ENOTFOUND'],
      ['57P01'],
      ['42P01'],
      ['3D000'],
    ])('should return null and set dbAvailable=false on error code %s', async (code) => {
      query.mockRejectedValue({ code });
      const service = new DataService(defaultOptions);
      const result = await service.dbQuery('SELECT * FROM test');

      expect(result).toBeNull();
      expect(service.dbAvailable).toBe(false);
    });

    test('should throw on other errors', async () => {
      const err = new Error('unexpected database error');
      query.mockRejectedValue(err);
      const service = new DataService(defaultOptions);

      await expect(service.dbQuery('SELECT * FROM test')).rejects.toThrow(
        'unexpected database error'
      );
    });
  });

  describe('getById', () => {
    test('should return DB row when found', async () => {
      const row = { id: '1', name: 'test item' };
      query.mockResolvedValue({ rows: [row] });
      const service = new DataService(defaultOptions);
      const result = await service.getById('1');

      expect(result).toEqual(row);
      expect(query).toHaveBeenCalledWith(
        'SELECT * FROM test_table WHERE id = $1',
        ['1']
      );
    });

    test('should fall back to in-memory when DB is unavailable', async () => {
      query.mockRejectedValue({ code: 'ECONNREFUSED' });
      const service = new DataService(defaultOptions);
      service.inMemoryData = [{ id: '1', name: 'in-memory item' }];

      const result = await service.getById('1');

      expect(result).toEqual({ id: '1', name: 'in-memory item' });
    });

    test('should return null when not found in DB or in-memory', async () => {
      query.mockRejectedValue({ code: 'ECONNREFUSED' });
      const service = new DataService(defaultOptions);
      service.inMemoryData = [{ id: '2', name: 'other item' }];

      const result = await service.getById('1');

      expect(result).toBeNull();
    });

    test('should return null when DB returns empty and dbAvailable is true', async () => {
      query.mockResolvedValue({ rows: [] });
      const service = new DataService(defaultOptions);
      service.inMemoryData = [{ id: '1', name: 'in-memory item' }];

      const result = await service.getById('1');

      // DB returned empty but is available, so no fallback
      expect(result).toBeNull();
    });
  });

  describe('getAll', () => {
    test('should return DB rows when available', async () => {
      const rows = [{ id: 1 }, { id: 2 }];
      query.mockResolvedValue({ rows });
      const service = new DataService(defaultOptions);
      const result = await service.getAll();

      expect(result).toEqual(rows);
      expect(query).toHaveBeenCalledWith(
        'SELECT * FROM test_table  ORDER BY created_at DESC',
        []
      );
    });

    test('should use provided WHERE clause and ORDER BY', async () => {
      const rows = [{ id: 1 }];
      query.mockResolvedValue({ rows });
      const service = new DataService(defaultOptions);
      const result = await service.getAll(
        'status = $1',
        ['active'],
        'name ASC'
      );

      expect(result).toEqual(rows);
      expect(query).toHaveBeenCalledWith(
        'SELECT * FROM test_table WHERE status = $1 ORDER BY name ASC',
        ['active']
      );
    });

    test('should fall back to in-memory when DB returns null', async () => {
      query.mockRejectedValue({ code: 'ECONNREFUSED' });
      const service = new DataService(defaultOptions);
      service.inMemoryData = [{ id: 1, name: 'fallback item' }];

      const result = await service.getAll();

      expect(result).toEqual([{ id: 1, name: 'fallback item' }]);
    });
  });

  describe('count', () => {
    test('should return DB count when available', async () => {
      query.mockResolvedValue({ rows: [{ count: '42' }] });
      const service = new DataService(defaultOptions);
      const result = await service.count();

      expect(result).toBe(42);
      expect(query).toHaveBeenCalledWith(
        'SELECT COUNT(*) as count FROM test_table ',
        []
      );
    });

    test('should return DB count with WHERE clause', async () => {
      query.mockResolvedValue({ rows: [{ count: '7' }] });
      const service = new DataService(defaultOptions);
      const result = await service.count('status = $1', ['active']);

      expect(result).toBe(7);
      expect(query).toHaveBeenCalledWith(
        'SELECT COUNT(*) as count FROM test_table WHERE status = $1',
        ['active']
      );
    });

    test('should fall back to inMemoryData.length when DB returns null', async () => {
      query.mockRejectedValue({ code: 'ECONNREFUSED' });
      const service = new DataService(defaultOptions);
      service.inMemoryData = [{ id: 1 }, { id: 2 }, { id: 3 }];

      const result = await service.count();

      expect(result).toBe(3);
    });
  });

  describe('getStats', () => {
    test('should return stats from DB when available', async () => {
      query.mockResolvedValueOnce({ rows: [{ total_count: '10' }] });
      query.mockResolvedValueOnce({ rows: [{ id: 1, created_at: '2024-01-01T00:00:00Z' }] });
      const service = new DataService(defaultOptions);
      const result = await service.getStats();

      expect(result).toEqual({
        totalRecords: 10,
        lastUpdated: '2024-01-01T00:00:00Z',
        package: 'TEST',
      });
    });

    test('should fall back to in-memory when DB is unavailable', async () => {
      query.mockRejectedValue({ code: 'ECONNREFUSED' });
      const service = new DataService(defaultOptions);
      service.inMemoryData = [{ id: 1, created_at: '2024-06-01T00:00:00Z' }];

      const result = await service.getStats();

      expect(result).toEqual({
        totalRecords: 1,
        lastUpdated: '2024-06-01T00:00:00Z',
        package: 'TEST',
      });
    });

    test('should return zero stats when DB and in-memory are both empty', async () => {
      query.mockRejectedValue({ code: 'ECONNREFUSED' });
      const service = new DataService(defaultOptions);

      const result = await service.getStats();

      expect(result).toEqual({
        totalRecords: 0,
        lastUpdated: null,
        package: 'TEST',
      });
    });
  });

  describe('search', () => {
    test('should return default empty paginated result with provided pagination', async () => {
      const service = new DataService(defaultOptions);
      const result = await service.search({}, { page: 2, limit: 10 });

      expect(result).toEqual({
        data: [],
        total: 0,
        page: 2,
        limit: 10,
      });
    });

    test('should use default pagination when not provided', async () => {
      const service = new DataService(defaultOptions);
      const result = await service.search({});

      expect(result).toEqual({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
      });
    });
  });

  describe('paginateData', () => {
    const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    test('should return first page correctly', () => {
      const service = new DataService(defaultOptions);
      const result = service.paginateData(data, 1, 3);

      expect(result.data).toEqual([1, 2, 3]);
      expect(result.total).toBe(10);
    });

    test('should return second page correctly', () => {
      const service = new DataService(defaultOptions);
      const result = service.paginateData(data, 2, 3);

      expect(result.data).toEqual([4, 5, 6]);
      expect(result.total).toBe(10);
    });

    test('should handle last partial page', () => {
      const service = new DataService(defaultOptions);
      const result = service.paginateData(data, 4, 3);

      expect(result.data).toEqual([10]);
      expect(result.total).toBe(10);
    });

    test('should use default page=1 and limit=20 when not provided', () => {
      const smallData = [1, 2, 3];
      const service = new DataService(defaultOptions);
      const result = service.paginateData(smallData);

      expect(result.data).toEqual([1, 2, 3]);
      expect(result.total).toBe(3);
    });

    test('should return empty data array when page exceeds available data', () => {
      const service = new DataService(defaultOptions);
      const result = service.paginateData(data, 10, 10);

      expect(result.data).toEqual([]);
      expect(result.total).toBe(10);
    });
  });

  describe('filterByText', () => {
    const data = [
      { name: 'Alpha', desc: 'First item' },
      { name: 'Beta', desc: 'Second item' },
      { name: 'Gamma', desc: 'Alpha-related content' },
    ];

    test('should filter case-insensitively across specified fields', () => {
      const service = new DataService(defaultOptions);
      const result = service.filterByText(data, 'alpha', ['name', 'desc']);

      expect(result).toEqual([
        { name: 'Alpha', desc: 'First item' },
        { name: 'Gamma', desc: 'Alpha-related content' },
      ]);
    });

    test('should return all data when query is an empty string', () => {
      const service = new DataService(defaultOptions);
      const result = service.filterByText(data, '', ['name']);

      expect(result).toEqual(data);
    });

    test('should return all data when query is only whitespace', () => {
      const service = new DataService(defaultOptions);
      const result = service.filterByText(data, '   ', ['name']);

      expect(result).toEqual(data);
    });

    test('should return all data when query is null', () => {
      const service = new DataService(defaultOptions);
      const result = service.filterByText(data, null, ['name']);

      expect(result).toEqual(data);
    });

    test('should return empty array when no items match', () => {
      const service = new DataService(defaultOptions);
      const result = service.filterByText(data, 'zzzzz', ['name']);

      expect(result).toEqual([]);
    });

    test('should handle numeric field values by converting to string', () => {
      const numericData = [
        { name: 'Item 1', code: 100 },
        { name: 'Item 2', code: 200 },
      ];
      const service = new DataService(defaultOptions);
      const result = service.filterByText(numericData, '100', ['code']);

      expect(result).toEqual([{ name: 'Item 1', code: 100 }]);
    });
  });

  describe('filterByDateRange', () => {
    const data = [
      { id: 1, date: '2024-01-15' },
      { id: 2, date: '2024-06-15' },
      { id: 3, date: '2024-12-15' },
    ];

    test('should filter with date_from only', () => {
      const service = new DataService(defaultOptions);
      const result = service.filterByDateRange(data, 'date', '2024-06-01', null);

      expect(result).toEqual([
        { id: 2, date: '2024-06-15' },
        { id: 3, date: '2024-12-15' },
      ]);
    });

    test('should filter with date_to only', () => {
      const service = new DataService(defaultOptions);
      const result = service.filterByDateRange(data, 'date', null, '2024-06-01');

      expect(result).toEqual([
        { id: 1, date: '2024-01-15' },
      ]);
    });

    test('should filter with both date_from and date_to', () => {
      const service = new DataService(defaultOptions);
      const result = service.filterByDateRange(data, 'date', '2024-02-01', '2024-11-01');

      expect(result).toEqual([
        { id: 2, date: '2024-06-15' },
      ]);
    });

    test('should return all data when no date filters are provided', () => {
      const service = new DataService(defaultOptions);
      const result = service.filterByDateRange(data, 'date', null, null);

      expect(result).toEqual(data);
    });

    test('should return empty array when no items match the date range', () => {
      const service = new DataService(defaultOptions);
      const result = service.filterByDateRange(data, 'date', '2025-01-01', null);

      expect(result).toEqual([]);
    });

    test('should include boundary dates correctly', () => {
      const boundaryData = [
        { id: 1, date: '2024-06-01' },
        { id: 2, date: '2024-06-02' },
      ];
      const service = new DataService(defaultOptions);
      const result = service.filterByDateRange(
        boundaryData,
        'date',
        '2024-06-01',
        '2024-06-01'
      );

      // >= from and <= to should include the boundary
      expect(result).toEqual([{ id: 1, date: '2024-06-01' }]);
    });
  });
});
