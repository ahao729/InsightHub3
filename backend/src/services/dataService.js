/**
 * Base Data Service
 * Provides common database query methods and fallback in-memory data store.
 * Each package service extends or uses this for standardized data access.
 */

const { query } = require('../db/pool');

class DataService {
  constructor(options) {
    this.tableName = options.tableName;
    this.packageCode = options.packageCode;
    this.packageName = options.packageName;
    this.searchFields = options.searchFields || [];
    this.defaultOrder = options.defaultOrder || 'created_at DESC';
    this.inMemoryData = [];
    this.dbAvailable = true;
  }

  /**
   * Test database availability
   */
  async checkDb() {
    try {
      await query('SELECT 1');
      this.dbAvailable = true;
      return true;
    } catch (err) {
      this.dbAvailable = false;
      return false;
    }
  }

  /**
   * Execute a database query with fallback
   */
  async dbQuery(sql, params = []) {
    try {
      const result = await query(sql, params);
      return result.rows;
    } catch (err) {
      // If DB is not available, return null to trigger fallback
      if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === '57P01' ||
          err.code === '42P01' || err.code === '3D000') {
        this.dbAvailable = false;
        return null;
      }
      throw err;
    }
  }

  /**
   * Get a single item by ID
   */
  async getById(id) {
    // Try database first
    const rows = await this.dbQuery(
      `SELECT * FROM ${this.tableName} WHERE id = $1`,
      [id]
    );
    if (rows && rows.length > 0) {
      return rows[0];
    }

    // Fallback to in-memory
    if (!this.dbAvailable) {
      return this.inMemoryData.find(item => item.id === id) || null;
    }

    return null;
  }

  /**
   * Get all data with optional where clause (for internal use)
   */
  async getAll(where = '', params = [], orderBy = '') {
    const orderClause = orderBy || this.defaultOrder;
    const whereClause = where ? `WHERE ${where}` : '';

    const rows = await this.dbQuery(
      `SELECT * FROM ${this.tableName} ${whereClause} ORDER BY ${orderClause}`,
      params
    );

    if (rows) {
      return rows;
    }

    // Fallback
    return this.inMemoryData;
  }

  /**
   * Count rows matching criteria
   */
  async count(where = '', params = []) {
    const whereClause = where ? `WHERE ${where}` : '';

    const rows = await this.dbQuery(
      `SELECT COUNT(*) as count FROM ${this.tableName} ${whereClause}`,
      params
    );

    if (rows && rows.length > 0) {
      return parseInt(rows[0].count, 10);
    }

    // Fallback
    return this.inMemoryData.length;
  }

  /**
   * Get package statistics
   */
  async getStats() {
    const rows = await this.dbQuery(
      `SELECT COUNT(*) as total_count FROM ${this.tableName}`
    );

    let totalCount = 0;
    let recentItem = null;

    if (rows && rows.length > 0) {
      totalCount = parseInt(rows[0].total_count, 10);

      // Get most recent item
      const recent = await this.dbQuery(
        `SELECT * FROM ${this.tableName} ORDER BY created_at DESC LIMIT 1`
      );
      if (recent && recent.length > 0) {
        recentItem = recent[0];
      }
    } else {
      totalCount = this.inMemoryData.length;
      recentItem = this.inMemoryData.length > 0 ? this.inMemoryData[0] : null;
    }

    return {
      totalRecords: totalCount,
      lastUpdated: recentItem ? recentItem.created_at : null,
      package: this.packageCode,
    };
  }

  /**
   * Generic search implementation - override in subclasses for custom logic
   */
  async search(queryParams, pagination = { page: 1, limit: 20 }) {
    const { page, limit } = pagination;
    const offset = (page - 1) * limit;

    // Override in subclass
    return {
      data: [],
      total: 0,
      page,
      limit,
    };
  }

  /**
   * Paginate in-memory data
   */
  paginateData(data, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    return {
      data: data.slice(offset, offset + limit),
      total: data.length,
    };
  }

  /**
   * Filter in-memory data by text search fields
   */
  filterByText(data, query, fields) {
    if (!query || !query.trim()) return data;
    const q = query.toLowerCase();
    return data.filter(item => {
      return fields.some(field => {
        const val = item[field];
        return val && String(val).toLowerCase().includes(q);
      });
    });
  }

  /**
   * Filter in-memory data by date range
   */
  filterByDateRange(data, dateField, dateFrom, dateTo) {
    let filtered = data;
    if (dateFrom) {
      const from = new Date(dateFrom);
      filtered = filtered.filter(item => new Date(item[dateField]) >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo);
      filtered = filtered.filter(item => new Date(item[dateField]) <= to);
    }
    return filtered;
  }
}

module.exports = DataService;
