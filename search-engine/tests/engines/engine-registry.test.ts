import { describe, it, expect } from 'vitest';
import { defaultEngines, createEngine } from '../../src/engines/index.js';
import { DuckDuckGoEngine } from '../../src/engines/duckduckgo.js';
import { GoogleEngine } from '../../src/engines/google.js';
import { BingEngine } from '../../src/engines/bing.js';
import { BaiduEngine } from '../../src/engines/baidu.js';
import { SogouEngine } from '../../src/engines/sogou.js';

describe('engines/index', () => {
  describe('defaultEngines', () => {
    it('contains 5 engines', () => {
      expect(defaultEngines).toHaveLength(5);
    });

    it('first engine is DuckDuckGo', () => {
      expect(defaultEngines[0]).toBeInstanceOf(DuckDuckGoEngine);
    });

    it('second engine is Google', () => {
      expect(defaultEngines[1]).toBeInstanceOf(GoogleEngine);
    });

    it('third engine is Bing', () => {
      expect(defaultEngines[2]).toBeInstanceOf(BingEngine);
    });

    it('fourth engine is Baidu', () => {
      expect(defaultEngines[3]).toBeInstanceOf(BaiduEngine);
    });

    it('fifth engine is Sogou', () => {
      expect(defaultEngines[4]).toBeInstanceOf(SogouEngine);
    });

    it('all engines have a name property', () => {
      for (const engine of defaultEngines) {
        expect(typeof engine.name).toBe('string');
        expect(engine.name.length).toBeGreaterThan(0);
      }
    });
  });

  describe('createEngine', () => {
    it('creates DuckDuckGo engine by full name', () => {
      const engine = createEngine('duckduckgo');
      expect(engine).toBeInstanceOf(DuckDuckGoEngine);
      expect(engine.name).toBe('duckduckgo');
    });

    it('creates DuckDuckGo engine by "ddg" alias', () => {
      const engine = createEngine('ddg');
      expect(engine).toBeInstanceOf(DuckDuckGoEngine);
    });

    it('creates Google engine (case-insensitive)', () => {
      const engine = createEngine('Google');
      expect(engine).toBeInstanceOf(GoogleEngine);
      expect(engine.name).toBe('google');
    });

    it('creates Bing engine', () => {
      const engine = createEngine('bing');
      expect(engine).toBeInstanceOf(BingEngine);
      expect(engine.name).toBe('bing');
    });

    it('creates Baidu engine', () => {
      const engine = createEngine('baidu');
      expect(engine).toBeInstanceOf(BaiduEngine);
      expect(engine.name).toBe('baidu');
    });

    it('creates Sogou engine', () => {
      const engine = createEngine('sogou');
      expect(engine).toBeInstanceOf(SogouEngine);
      expect(engine.name).toBe('sogou');
    });

    it('throws for unknown engine name', () => {
      expect(() => createEngine('yahoo')).toThrow('Unknown search engine: yahoo');
    });

    it('throws for empty string', () => {
      expect(() => createEngine('')).toThrow('Unknown search engine: ');
    });

    it('creates fresh instances (not shared)', () => {
      const a = createEngine('ddg');
      const b = createEngine('ddg');
      expect(a).not.toBe(b);
    });
  });
});
