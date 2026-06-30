/**
 * Embedding Service
 * Generates vector embeddings for text using OpenAI's embedding API.
 * Includes in-memory cache and fallback for development/testing.
 */

const config = require('../config');

class EmbeddingService {
  constructor() {
    this.cache = new Map();
    this.client = null;
    this.initialized = false;
    this.mockMode = false;
    this.dimension = config.embeddingDimensions || 1536;
    this.model = config.models.embedding || 'text-embedding-3-small';
  }

  /**
   * Initialize the OpenAI client (lazy init)
   */
  async init() {
    if (this.initialized) return;

    if (!config.openaiApiKey || config.openaiApiKey === '') {
      console.warn('[Embedding] No OPENAI_API_KEY configured — using mock embeddings');
      this.mockMode = true;
      this.initialized = true;
      return;
    }

    try {
      const { OpenAI } = require('openai');
      this.client = new OpenAI({
        apiKey: config.openaiApiKey,
        baseURL: config.openaiBaseUrl,
      });
      this.initialized = true;
      console.log('[Embedding] OpenAI client initialized');
    } catch (err) {
      console.warn(`[Embedding] Failed to init OpenAI: ${err.message} — using mock embeddings`);
      this.mockMode = true;
      this.initialized = true;
    }
  }

  /**
   * Generate embedding vector for a single text string.
   * @param {string} text - The text to embed
   * @returns {Promise<number[]>} - The embedding vector
   */
  async getEmbedding(text) {
    await this.init();

    const normalized = text.trim().toLowerCase();
    const cacheKey = normalized;

    // Check cache first
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    let vector;

    if (this.mockMode) {
      vector = this._generateMockEmbedding(normalized);
    } else {
      try {
        const response = await this.client.embeddings.create({
          model: this.model,
          input: normalized,
          dimensions: this.dimension,
        });
        vector = response.data[0].embedding;
      } catch (err) {
        console.warn(`[Embedding] API call failed: ${err.message} — falling back to mock`);
        vector = this._generateMockEmbedding(normalized);
      }
    }

    // Cache the result (LRU-like: limit cache size)
    if (this.cache.size > 5000) {
      // Delete oldest entry (first key)
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(cacheKey, vector);

    return vector;
  }

  /**
   * Generate embeddings for multiple texts in batch.
   * @param {string[]} texts - Array of texts to embed
   * @returns {Promise<number[][]>} - Array of embedding vectors
   */
  async getEmbeddings(texts) {
    await this.init();

    if (this.mockMode) {
      return texts.map(t => this._generateMockEmbedding(t));
    }

    // Check which texts need API calls
    const results = [];
    const uncached = [];
    const uncachedIndices = [];

    texts.forEach((text, idx) => {
      const normalized = text.trim().toLowerCase();
      if (this.cache.has(normalized)) {
        results[idx] = this.cache.get(normalized);
      } else {
        uncached.push(normalized);
        uncachedIndices.push(idx);
      }
    });

    if (uncached.length > 0) {
      try {
        const response = await this.client.embeddings.create({
          model: this.model,
          input: uncached,
          dimensions: this.dimension,
        });

        response.data.forEach((item, i) => {
          const vector = item.embedding;
          const idx = uncachedIndices[i];
          results[idx] = vector;
          this.cache.set(uncached[i], vector);
        });
      } catch (err) {
        console.warn(`[Embedding] Batch API call failed: ${err.message} — using mock for uncached`);
        uncached.forEach((text, i) => {
          const idx = uncachedIndices[i];
          results[idx] = this._generateMockEmbedding(text);
        });
      }
    }

    return results;
  }

  /**
   * Compute cosine similarity between two vectors.
   */
  cosineSimilarity(a, b) {
    let dot = 0, magA = 0, magB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      magA += a[i] * a[i];
      magB += b[i] * b[i];
    }
    const denom = Math.sqrt(magA) * Math.sqrt(magB);
    return denom === 0 ? 0 : dot / denom;
  }

  /**
   * Find top-k most similar texts from a candidate list.
   * @param {string} query - Query text
   * @param {string[]} candidates - Candidate texts
   * @param {number} k - Number of results
   * @param {number} threshold - Minimum similarity threshold
   * @returns {Promise<{text: string, score: number}[]>}
   */
  async searchSimilar(query, candidates, k = 5, threshold = 0.5) {
    const queryVec = await this.getEmbedding(query);
    const candidateVecs = await this.getEmbeddings(candidates);

    const scored = candidateVecs.map((vec, i) => ({
      text: candidates[i],
      score: this.cosineSimilarity(queryVec, vec),
    }));

    return scored
      .filter(s => s.score >= threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }

  /**
   * Generate a deterministic mock embedding for development/testing.
   * Uses a simple hash-based approach to produce a pseudo-random vector.
   */
  _generateMockEmbedding(text) {
    const dim = this.dimension;
    const vector = new Array(dim).fill(0);

    // Simple hash-based pseudo-random embedding
    let seed = 0;
    for (let i = 0; i < text.length; i++) {
      seed = ((seed << 5) - seed) + text.charCodeAt(i);
      seed |= 0;
    }

    for (let i = 0; i < dim; i++) {
      // Use deterministic pseudo-random values
      const phase = (seed * (i + 1) * 2654435761) >>> 0;
      vector[i] = (phase % 200000) / 100000 - 1; // Range [-1, 1]
    }

    // Normalize
    let magnitude = 0;
    for (let i = 0; i < dim; i++) {
      magnitude += vector[i] * vector[i];
    }
    magnitude = Math.sqrt(magnitude);
    if (magnitude > 0) {
      for (let i = 0; i < dim; i++) {
        vector[i] /= magnitude;
      }
    }

    return vector;
  }
}

// Singleton instance
const embeddingService = new EmbeddingService();

module.exports = embeddingService;
