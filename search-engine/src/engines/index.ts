// ============================================================
// Search Engines — Registry and Exports
// ============================================================

import type { SearchEngine } from '../types.js';
import { DuckDuckGoEngine } from './duckduckgo.js';
import { GoogleEngine } from './google.js';
import { BingEngine } from './bing.js';
import { BaiduEngine } from './baidu.js';
import { SogouEngine } from './sogou.js';

// Re-export all engines
export { DuckDuckGoEngine } from './duckduckgo.js';
export { GoogleEngine } from './google.js';
export { BingEngine } from './bing.js';
export { BaiduEngine } from './baidu.js';
export { SogouEngine } from './sogou.js';

/** Default engines in priority order (international first, CN fallbacks) */
export const defaultEngines: SearchEngine[] = [
  new DuckDuckGoEngine(),
  new GoogleEngine(),
  new BingEngine(),
  new BaiduEngine(),
  new SogouEngine(),
];

/**
 * Create a search engine instance by name.
 */
export function createEngine(name: string): SearchEngine {
  switch (name.toLowerCase()) {
    case 'duckduckgo':
    case 'ddg':
      return new DuckDuckGoEngine();
    case 'google':
      return new GoogleEngine();
    case 'bing':
      return new BingEngine();
    case 'baidu':
      return new BaiduEngine();
    case 'sogou':
      return new SogouEngine();
    default:
      throw new Error(`Unknown search engine: ${name}`);
  }
}
