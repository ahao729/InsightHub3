const config = require('../config');

jest.mock('../config', () => ({
  openaiApiKey: 'sk-test-key',
  openaiBaseUrl: 'https://api.openai.com/v1',
  embeddingDimensions: 1536,
  models: { embedding: 'text-embedding-3-small' },
}));

const mockEmbeddingsCreate = jest.fn();
jest.mock('openai', () => ({
  OpenAI: jest.fn(() => ({
    embeddings: { create: mockEmbeddingsCreate },
  })),
}));

const { OpenAI } = require('openai');
const embeddingService = require('../services/embeddingService');

beforeEach(async () => {
  jest.clearAllMocks();
  embeddingService.cache.clear();
  // Reset to non-mock state for each test
  embeddingService.initialized = false;
  embeddingService.mockMode = false;
  embeddingService.client = null;
});

describe('EmbeddingService', () => {
  // ── init ──────────────────────────────────────────
  describe('init', () => {
    it('should init OpenAI client when apiKey is present', async () => {
      await embeddingService.init();

      expect(OpenAI).toHaveBeenCalledWith({
        apiKey: 'sk-test-key',
        baseURL: 'https://api.openai.com/v1',
      });
      expect(embeddingService.initialized).toBe(true);
      expect(embeddingService.mockMode).toBe(false);
    });

    it('should enter mock mode when apiKey is empty', async () => {
      config.openaiApiKey = '';
      embeddingService.initialized = false;

      await embeddingService.init();

      expect(embeddingService.mockMode).toBe(true);
      expect(embeddingService.initialized).toBe(true);

      config.openaiApiKey = 'sk-test-key'; // restore
    });

    it('should only init once', async () => {
      await embeddingService.init();
      expect(OpenAI).toHaveBeenCalledTimes(1);

      await embeddingService.init();
      expect(OpenAI).toHaveBeenCalledTimes(1); // not called again
    });
  });

  // ── getEmbedding ──────────────────────────────────
  describe('getEmbedding', () => {
    it('should return embedding vector for valid text', async () => {
      const fakeVec = [0.1, 0.2, 0.3, 0.4];
      mockEmbeddingsCreate.mockResolvedValueOnce({
        data: [{ embedding: fakeVec }],
      });

      const vector = await embeddingService.getEmbedding('hello world');

      expect(vector).toEqual(fakeVec);
      expect(mockEmbeddingsCreate).toHaveBeenCalledWith({
        model: 'text-embedding-3-small',
        input: 'hello world',
        dimensions: 1536,
      });
    });

    it('should normalize and lowercase text', async () => {
      mockEmbeddingsCreate.mockResolvedValueOnce({
        data: [{ embedding: [0.5] }],
      });

      await embeddingService.getEmbedding('  Hello World  ');

      expect(mockEmbeddingsCreate).toHaveBeenCalledWith(
        expect.objectContaining({ input: 'hello world' }),
      );
    });

    it('should cache embeddings by normalized key', async () => {
      mockEmbeddingsCreate.mockResolvedValueOnce({
        data: [{ embedding: [0.1, 0.2] }],
      });

      const v1 = await embeddingService.getEmbedding('Hello');
      const v2 = await embeddingService.getEmbedding('hello');

      expect(v1).toEqual(v2);
      expect(mockEmbeddingsCreate).toHaveBeenCalledTimes(1); // cached
    });

    it('should fall back to mock on API error', async () => {
      mockEmbeddingsCreate.mockRejectedValueOnce(new Error('API error'));

      const vector = await embeddingService.getEmbedding('test');

      expect(vector).toBeDefined();
      expect(vector.length).toBe(1536);
    });

    it('should evict oldest cache entry when > 5000', async () => {
      // Fill cache just under limit
      for (let i = 0; i < 5000; i++) {
        embeddingService.cache.set(`key-${i}`, [i]);
      }
      // This set will trigger eviction (size check happens inside getEmbedding)
      mockEmbeddingsCreate.mockResolvedValueOnce({
        data: [{ embedding: [999] }],
      });

      await embeddingService.getEmbedding('new-item');

      expect(embeddingService.cache.size).toBe(5000);
    });
  });

  // ── getEmbeddings (batch) ─────────────────────────
  describe('getEmbeddings', () => {
    it('should return embeddings for multiple texts', async () => {
      mockEmbeddingsCreate.mockResolvedValueOnce({
        data: [{ embedding: [0.1] }, { embedding: [0.2] }],
      });

      const vectors = await embeddingService.getEmbeddings(['a', 'b']);

      expect(vectors).toHaveLength(2);
      expect(vectors[0]).toEqual([0.1]);
      expect(vectors[1]).toEqual([0.2]);
    });

    it('should use cached results for repeated texts', async () => {
      mockEmbeddingsCreate.mockResolvedValueOnce({
        data: [{ embedding: [0.1] }, { embedding: [0.2] }],
      });

      await embeddingService.getEmbeddings(['a', 'b']);
      const vectors = await embeddingService.getEmbeddings(['a', 'b']);

      expect(vectors).toHaveLength(2);
      expect(mockEmbeddingsCreate).toHaveBeenCalledTimes(1); // second call fully cached
    });

    it('should fall back to mock on batch API error', async () => {
      mockEmbeddingsCreate.mockRejectedValueOnce(new Error('Batch fail'));

      const vectors = await embeddingService.getEmbeddings(['a', 'b']);

      expect(vectors).toHaveLength(2);
      // Should be mock vectors of correct dimension
      vectors.forEach((v) => expect(v.length).toBe(1536));
    });
  });

  // ── cosineSimilarity ──────────────────────────────
  describe('cosineSimilarity', () => {
    it('returns 1 for identical vectors', () => {
      expect(embeddingService.cosineSimilarity([3, 4], [3, 4])).toBeCloseTo(1);
    });

    it('returns 0 for orthogonal vectors', () => {
      expect(embeddingService.cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
    });

    it('handles zero vector', () => {
      expect(embeddingService.cosineSimilarity([0, 0], [1, 0])).toBe(0);
    });
  });

  // ── searchSimilar ─────────────────────────────────
  describe('searchSimilar', () => {
    it('should return ranked results above threshold', async () => {
      // Mock getEmbedding to return a known vector
      jest.spyOn(embeddingService, 'getEmbedding').mockResolvedValueOnce([1, 0, 0]);

      const candidates = ['cat animal', 'dog animal', 'car vehicle'];
      // Mock getEmbeddings to return known vectors
      jest.spyOn(embeddingService, 'getEmbeddings').mockResolvedValueOnce([
        [0.9, 0.1, 0],
        [0.8, 0.2, 0],
        [0, 1, 0],
      ]);

      const results = await embeddingService.searchSimilar('animal', candidates, 2, 0.5);

      expect(results).toHaveLength(2);
      expect(results[0].text).toBe('cat animal');
      expect(results[1].text).toBe('dog animal');
    });

    it('should return empty array when none above threshold', async () => {
      jest.spyOn(embeddingService, 'getEmbedding').mockResolvedValueOnce([1, 0, 0]);
      jest.spyOn(embeddingService, 'getEmbeddings').mockResolvedValueOnce([
        [0, 1, 0],
        [0, 0, 1],
      ]);

      const results = await embeddingService.searchSimilar('query', ['a', 'b'], 5, 0.5);

      expect(results).toHaveLength(0);
    });

    it('should use defaults for k and threshold', async () => {
      jest.spyOn(embeddingService, 'getEmbedding').mockResolvedValueOnce([1, 0]);
      jest.spyOn(embeddingService, 'getEmbeddings').mockResolvedValueOnce([
        [0.9, 0],
        [0.8, 0],
        [0.7, 0],
        [0.6, 0],
        [0.5, 0],
        [0.4, 0],
      ]);

      const results = await embeddingService.searchSimilar('query', ['a', 'b', 'c', 'd', 'e', 'f']);

      expect(results).toHaveLength(5); // k=5 default
      results.forEach((r) => expect(r.score).toBeGreaterThanOrEqual(0.5)); // threshold=0.5 default
    });
  });

  // ── _generateMockEmbedding ────────────────────────
  describe('_generateMockEmbedding', () => {
    it('should produce deterministic vectors', () => {
      const v1 = embeddingService._generateMockEmbedding('hello');
      const v2 = embeddingService._generateMockEmbedding('hello');
      expect(v1).toEqual(v2);
    });

    it('should produce unit vectors', () => {
      const v = embeddingService._generateMockEmbedding('test');
      const mag = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
      expect(mag).toBeCloseTo(1, 1);
    });

    it('should produce different vectors for different inputs', () => {
      const v1 = embeddingService._generateMockEmbedding('cat');
      const v2 = embeddingService._generateMockEmbedding('dog');
      expect(v1).not.toEqual(v2);
    });
  });
});
