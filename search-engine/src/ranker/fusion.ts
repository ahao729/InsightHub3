// ============================================================
// Reciprocal Rank Fusion (RRF) — Rank Fusion Algorithm
// ============================================================

import type { SearchResult, ScoredResult, FusionOptions } from '../types.js';

/**
 * Reciprocal Rank Fusion (RRF) algorithm.
 * 
 * Reference: "Reciprocal Rank Fusion outperforms Condorcet and individual 
 *             Rank Learning Methods" (Cormack, Clarke, Butt, 2009)
 * 
 * Formula: RRF_score(d) = Σ 1 / (k + rank_i(d))
 * 
 * - k = 60 (recommended constant from the paper)
 * - rank_i(d) = rank of document d in engine i (1-based)
 * - Higher score = better relevance
 */
export function reciprocalRankFusion(
  resultsArrays: SearchResult[][],
  options?: FusionOptions
): ScoredResult[] {
  const k = options?.k ?? 60;
  
  // Map to aggregate scores per URL
  const urlMap = new Map<string, {
    result: SearchResult;
    score: number;
    engineCount: number;
    engines: Set<string>;
    bestRank: number;
  }>();
  
  for (const results of resultsArrays) {
    for (const result of results) {
      const existing = urlMap.get(result.url);
      
      if (existing) {
        // Add RRF contribution from this engine
        existing.score += 1 / (k + result.rank);
        existing.engineCount += 1;
        existing.engines.add(result.engine);
        existing.bestRank = Math.min(existing.bestRank, result.rank);
        
        // Prefer the longer snippet
        if (result.snippet.length > existing.result.snippet.length) {
          existing.result = { ...result };
        }
      } else {
        urlMap.set(result.url, {
          result,
          score: 1 / (k + result.rank),
          engineCount: 1,
          engines: new Set([result.engine]),
          bestRank: result.rank,
        });
      }
    }
  }
  
  // Convert to array and sort by score (descending)
  const scored: ScoredResult[] = Array.from(urlMap.values())
    .map(item => ({
      ...item.result,
      score: item.score,
      engineCount: item.engineCount,
      engines: Array.from(item.engines),
    }))
    .sort((a, b) => b.score - a.score);
  
  return scored;
}

/**
 * Normalize scores to 0-1 range.
 */
export function normalizeScores(results: ScoredResult[]): ScoredResult[] {
  if (results.length === 0) return [];
  
  const maxScore = Math.max(...results.map(r => r.score));
  const minScore = Math.min(...results.map(r => r.score));
  const range = maxScore - minScore;
  
  if (range === 0) {
    return results.map(r => ({ ...r, score: 1 }));
  }
  
  return results.map(r => ({
    ...r,
    score: (r.score - minScore) / range,
  }));
}

/**
 * Remove duplicate results based on URL.
 * Keeps the one with the highest score.
 */
export function deduplicateResults(results: ScoredResult[]): ScoredResult[] {
  const urlMap = new Map<string, ScoredResult>();
  
  for (const result of results) {
    const existing = urlMap.get(result.url);
    if (!existing || result.score > existing.score) {
      urlMap.set(result.url, result);
    }
  }
  
  return Array.from(urlMap.values());
}
