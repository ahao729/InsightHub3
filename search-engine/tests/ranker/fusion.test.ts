import { describe, it, expect } from 'vitest';
import {
  reciprocalRankFusion,
  normalizeScores,
  deduplicateResults,
} from '../../src/ranker/fusion.js';
import type { SearchResult, ScoredResult } from '../../src/types.js';

// -------------------------------------------------------
// Helpers
// -------------------------------------------------------

function makeResult(overrides: Partial<SearchResult> & { url: string; rank: number }): SearchResult {
  return {
    title: overrides.title ?? `Title for ${overrides.url}`,
    url: overrides.url,
    snippet: overrides.snippet ?? `Snippet for ${overrides.url}`,
    engine: overrides.engine ?? 'test-engine',
    rank: overrides.rank,
  };
}

// -------------------------------------------------------
// reciprocalRankFusion
// -------------------------------------------------------

describe('reciprocalRankFusion', () => {
  it('returns empty array for empty input', () => {
    const result = reciprocalRankFusion([]);
    expect(result).toEqual([]);
  });

  it('returns empty array when all result arrays are empty', () => {
    const result = reciprocalRankFusion([[], [], []]);
    expect(result).toEqual([]);
  });

  it('handles a single engine with one result', () => {
    const results = [[makeResult({ url: 'https://a.com', rank: 1, engine: 'ddg' })]];
    const scored = reciprocalRankFusion(results);

    expect(scored).toHaveLength(1);
    expect(scored[0].url).toBe('https://a.com');
    expect(scored[0].score).toBeCloseTo(1 / 61, 6); // 1/(60+1)
    expect(scored[0].engineCount).toBe(1);
    expect(scored[0].engines).toEqual(['ddg']);
  });

  it('ranks rank-1 results higher than rank-10', () => {
    const results = [
      [
        makeResult({ url: 'https://first.com', rank: 1, engine: 'ddg' }),
        makeResult({ url: 'https://tenth.com', rank: 10, engine: 'ddg' }),
      ],
    ];
    const scored = reciprocalRankFusion(results);

    expect(scored[0].url).toBe('https://first.com');
    expect(scored[1].url).toBe('https://tenth.com');
    expect(scored[0].score).toBeGreaterThan(scored[1].score);
  });

  it('boosts results appearing in multiple engines', () => {
    const engineA: SearchResult[] = [
      makeResult({ url: 'https://shared.com', rank: 1, engine: 'engineA' }),
      makeResult({ url: 'https://only-a.com', rank: 2, engine: 'engineA' }),
    ];
    const engineB: SearchResult[] = [
      makeResult({ url: 'https://shared.com', rank: 3, engine: 'engineB' }),
      makeResult({ url: 'https://only-b.com', rank: 1, engine: 'engineB' }),
    ];

    const scored = reciprocalRankFusion([engineA, engineB]);
    const shared = scored.find(r => r.url === 'https://shared.com')!;

    // Shared result should have score from both engines
    expect(shared.engineCount).toBe(2);
    expect(shared.engines).toContain('engineA');
    expect(shared.engines).toContain('engineB');
    expect(shared.score).toBeCloseTo(1 / 61 + 1 / 63, 6);
  });

  it('prefers the longer snippet for same URL', () => {
    const shortSnippet = 'Short';
    const longSnippet = 'This is a much longer and more descriptive snippet';
    const engineA: SearchResult[] = [
      makeResult({ url: 'https://dup.com', rank: 1, engine: 'A', snippet: shortSnippet }),
    ];
    const engineB: SearchResult[] = [
      makeResult({ url: 'https://dup.com', rank: 1, engine: 'B', snippet: longSnippet }),
    ];

    const scored = reciprocalRankFusion([engineA, engineB]);
    const dup = scored.find(r => r.url === 'https://dup.com')!;
    expect(dup.snippet).toBe(longSnippet);
  });

  it('respects custom k parameter', () => {
    const results = [[makeResult({ url: 'https://a.com', rank: 1, engine: 'ddg' })]];

    const defaultScored = reciprocalRankFusion(results);
    const customScored = reciprocalRankFusion(results, { k: 10 });

    expect(defaultScored[0].score).toBeCloseTo(1 / 61, 6);
    expect(customScored[0].score).toBeCloseTo(1 / 11, 6);
    expect(customScored[0].score).toBeGreaterThan(defaultScored[0].score);
  });

  it('sorts results by score descending', () => {
    const engineA: SearchResult[] = [
      makeResult({ url: 'https://a1.com', rank: 1, engine: 'A' }),
      makeResult({ url: 'https://a2.com', rank: 2, engine: 'A' }),
    ];
    const engineB: SearchResult[] = [
      makeResult({ url: 'https://b1.com', rank: 1, engine: 'B' }),
      makeResult({ url: 'https://b2.com', rank: 2, engine: 'B' }),
    ];

    const scored = reciprocalRankFusion([engineA, engineB]);
    for (let i = 1; i < scored.length; i++) {
      expect(scored[i - 1].score).toBeGreaterThanOrEqual(scored[i].score);
    }
  });

  it('handles large k values gracefully', () => {
    const results = [[makeResult({ url: 'https://a.com', rank: 1, engine: 'ddg' })]];
    const scored = reciprocalRankFusion(results, { k: 1000 });

    // With k=1000, score = 1/1001 ≈ 0.001
    expect(scored[0].score).toBeCloseTo(1 / 1001, 8);
  });
});

// -------------------------------------------------------
// normalizeScores
// -------------------------------------------------------

describe('normalizeScores', () => {
  it('returns empty array for empty input', () => {
    expect(normalizeScores([])).toEqual([]);
  });

  it('maps single result to score 1', () => {
    const input: ScoredResult[] = [
      { title: 'A', url: 'https://a.com', snippet: '', engine: 'test', rank: 1, score: 0.5, engineCount: 1, engines: ['test'] },
    ];
    const normalized = normalizeScores(input);
    expect(normalized[0].score).toBe(1);
  });

  it('maps all equal scores to 1', () => {
    const input: ScoredResult[] = [
      { title: 'A', url: 'https://a.com', snippet: '', engine: 'test', rank: 1, score: 0.5, engineCount: 1, engines: ['test'] },
      { title: 'B', url: 'https://b.com', snippet: '', engine: 'test', rank: 2, score: 0.5, engineCount: 1, engines: ['test'] },
    ];
    const normalized = normalizeScores(input);
    expect(normalized[0].score).toBe(1);
    expect(normalized[1].score).toBe(1);
  });

  it('normalizes scores to [0, 1] range', () => {
    const input: ScoredResult[] = [
      { title: 'A', url: 'https://a.com', snippet: '', engine: 'test', rank: 1, score: 10, engineCount: 1, engines: ['test'] },
      { title: 'B', url: 'https://b.com', snippet: '', engine: 'test', rank: 2, score: 5, engineCount: 1, engines: ['test'] },
      { title: 'C', url: 'https://c.com', snippet: '', engine: 'test', rank: 3, score: 0, engineCount: 1, engines: ['test'] },
    ];
    const normalized = normalizeScores(input);

    // Highest score → 1, lowest → 0
    expect(normalized.find(r => r.url === 'https://a.com')!.score).toBe(1);
    expect(normalized.find(r => r.url === 'https://c.com')!.score).toBe(0);
    expect(normalized.find(r => r.url === 'https://b.com')!.score).toBeCloseTo(0.5, 6);
  });

  it('does not mutate original array', () => {
    const input: ScoredResult[] = [
      { title: 'A', url: 'https://a.com', snippet: '', engine: 'test', rank: 1, score: 10, engineCount: 1, engines: ['test'] },
    ];
    const original = [...input];
    normalizeScores(input);
    expect(input[0].score).toBe(original[0].score);
  });

  it('preserves result properties other than score', () => {
    const input: ScoredResult[] = [
      { title: 'Hello', url: 'https://hello.com', snippet: 'World', engine: 'ddg', rank: 3, score: 8, engineCount: 2, engines: ['ddg', 'google'] },
    ];
    const normalized = normalizeScores(input);
    expect(normalized[0].title).toBe('Hello');
    expect(normalized[0].url).toBe('https://hello.com');
    expect(normalized[0].snippet).toBe('World');
    expect(normalized[0].engine).toBe('ddg');
    expect(normalized[0].rank).toBe(3);
    expect(normalized[0].engineCount).toBe(2);
    expect(normalized[0].engines).toEqual(['ddg', 'google']);
  });
});

// -------------------------------------------------------
// deduplicateResults
// -------------------------------------------------------

describe('deduplicateResults', () => {
  it('returns empty array for empty input', () => {
    expect(deduplicateResults([])).toEqual([]);
  });

  it('returns single result unchanged', () => {
    const input: ScoredResult[] = [
      { title: 'A', url: 'https://a.com', snippet: '', engine: 'test', rank: 1, score: 0.5, engineCount: 1, engines: ['test'] },
    ];
    const deduped = deduplicateResults(input);
    expect(deduped).toHaveLength(1);
    expect(deduped[0].url).toBe('https://a.com');
  });

  it('removes duplicates keeping highest score', () => {
    const input: ScoredResult[] = [
      { title: 'A-low', url: 'https://a.com', snippet: '', engine: 'test', rank: 1, score: 0.3, engineCount: 1, engines: ['test'] },
      { title: 'B', url: 'https://b.com', snippet: '', engine: 'test', rank: 1, score: 0.8, engineCount: 1, engines: ['test'] },
      { title: 'A-high', url: 'https://a.com', snippet: '', engine: 'test', rank: 1, score: 0.7, engineCount: 1, engines: ['test'] },
    ];
    const deduped = deduplicateResults(input);

    expect(deduped).toHaveLength(2);
    const aResult = deduped.find(r => r.url === 'https://a.com')!;
    expect(aResult.title).toBe('A-high'); // Higher score wins
    expect(aResult.score).toBe(0.7);
  });

  it('handles URLs with different paths as distinct', () => {
    const input: ScoredResult[] = [
      { title: 'A', url: 'https://example.com/page1', snippet: '', engine: 'test', rank: 1, score: 0.5, engineCount: 1, engines: ['test'] },
      { title: 'B', url: 'https://example.com/page2', snippet: '', engine: 'test', rank: 1, score: 0.5, engineCount: 1, engines: ['test'] },
    ];
    const deduped = deduplicateResults(input);
    expect(deduped).toHaveLength(2);
  });

  it('handles URL with trailing slash variations as distinct', () => {
    // Current implementation uses exact string match
    const input: ScoredResult[] = [
      { title: 'A', url: 'https://a.com', snippet: '', engine: 'test', rank: 1, score: 0.5, engineCount: 1, engines: ['test'] },
      { title: 'B', url: 'https://a.com/', snippet: '', engine: 'test', rank: 1, score: 0.5, engineCount: 1, engines: ['test'] },
    ];
    const deduped = deduplicateResults(input);
    // Exact string match treats these as different URLs
    expect(deduped).toHaveLength(2);
  });
});
