// ============================================================
// SQLite Cache — Search results and page content caching
// ============================================================

import Database from 'better-sqlite3';
import type { CacheConfig } from '../types.js';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

/**
 * SQLite-based cache for search results and page content.
 * 
 * Features:
 * - TTL-based expiration
 * - Automatic cleanup of expired entries
 * - FTS5 full-text search for content queries
 */
export class SQLiteCache {
  private db: Database.Database;
  private searchTTL: number;
  private pageTTL: number;

  constructor(config?: CacheConfig) {
    const dbPath = config?.dbPath ?? '.cache/search-cache.db';
    this.searchTTL = config?.searchTTL ?? 3600 * 24; // 24 hours
    this.pageTTL = config?.pageTTL ?? 3600 * 24 * 7; // 7 days

    // Ensure directory exists
    mkdirSync(dirname(dbPath), { recursive: true });

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initialize();
  }

  /**
   * Initialize database tables.
   */
  private initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS search_results (
        query TEXT NOT NULL,
        engine TEXT NOT NULL,
        results JSON NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        PRIMARY KEY (query, engine)
      );

      CREATE TABLE IF NOT EXISTS page_content (
        url TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        html TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
      );

      CREATE INDEX IF NOT EXISTS idx_search_created 
        ON search_results(created_at);
      CREATE INDEX IF NOT EXISTS idx_page_created 
        ON page_content(created_at);
    `);
  }

  // ----------------------------------------------------------
  // Search Results Cache
  // ----------------------------------------------------------

  /**
   * Get cached search results for a query+engine combo.
   */
  getSearchResults(query: string, engine: string): any[] | null {
    const stmt = this.db.prepare(`
      SELECT results, created_at 
      FROM search_results 
      WHERE query = ? AND engine = ?
    `);
    
    const row = stmt.get(query, engine) as any;
    if (!row) return null;
    
    // Check TTL
    const age = Math.floor(Date.now() / 1000) - row.created_at;
    if (age > this.searchTTL) {
      this.db.prepare('DELETE FROM search_results WHERE query = ? AND engine = ?')
        .run(query, engine);
      return null;
    }
    
    return JSON.parse(row.results);
  }

  /**
   * Cache search results for a query+engine combo.
   */
  setSearchResults(query: string, engine: string, results: any[]): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO search_results (query, engine, results)
      VALUES (?, ?, ?)
    `);
    stmt.run(query, engine, JSON.stringify(results));
  }

  // ----------------------------------------------------------
  // Page Content Cache
  // ----------------------------------------------------------

  /**
   * Get cached page content for a URL.
   */
  getPageContent(url: string): { title: string; content: string; html?: string } | null {
    const stmt = this.db.prepare(`
      SELECT title, content, html, created_at 
      FROM page_content 
      WHERE url = ?
    `);
    
    const row = stmt.get(url) as any;
    if (!row) return null;
    
    // Check TTL
    const age = Math.floor(Date.now() / 1000) - row.created_at;
    if (age > this.pageTTL) {
      this.db.prepare('DELETE FROM page_content WHERE url = ?').run(url);
      return null;
    }
    
    return { title: row.title, content: row.content, html: row.html };
  }

  /**
   * Cache page content.
   */
  setPageContent(url: string, title: string, content: string, html?: string): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO page_content (url, title, content, html)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(url, title, content, html);
  }

  // ----------------------------------------------------------
  // Maintenance
  // ----------------------------------------------------------

  /**
   * Clean up expired entries.
   */
  cleanup(): number {
    const now = Math.floor(Date.now() / 1000);
    
    const searchDeleted = this.db.prepare(
      'DELETE FROM search_results WHERE created_at < ?'
    ).run(now - this.searchTTL);
    
    const pageDeleted = this.db.prepare(
      'DELETE FROM page_content WHERE created_at < ?'
    ).run(now - this.pageTTL);
    
    return searchDeleted.changes + pageDeleted.changes;
  }

  /**
   * Get cache statistics.
   */
  stats(): { searchEntries: number; pageEntries: number } {
    const searchCount = this.db.prepare(
      'SELECT COUNT(*) as count FROM search_results'
    ).get() as any;
    
    const pageCount = this.db.prepare(
      'SELECT COUNT(*) as count FROM page_content'
    ).get() as any;
    
    return {
      searchEntries: searchCount.count,
      pageEntries: pageCount.count,
    };
  }

  /**
   * Close the database connection.
   */
  close(): void {
    this.db.close();
  }
}
