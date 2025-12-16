/**
 * ToolExecutor - Base class for tool execution pattern
 * 
 * Framework pattern demonstrating how to create tool executors
 * for integrating external APIs and services.
 */

export class ToolExecutor {
  constructor(cache, updateToolFeedback) {
    this.cache = cache;
    this.updateToolFeedback = updateToolFeedback;
    this.cacheExpiration = 24 * 60 * 60 * 1000; // 24 hours
  }

  /**
   * Generate a cache key for the request
   * @param {Object} params - Request parameters
   * @returns {string} Cache key
   */
  generateCacheKey(params) {
    return JSON.stringify(params);
  }

  /**
   * Get cached response if available
   * @param {string} cacheKey - Cache key
   * @returns {Object|null} Cached response or null
   */
  getFromCache(cacheKey) {
    if (!this.cache || !(this.cache instanceof Map)) {
      return null;
    }
    
    const cached = this.cache.get(cacheKey);
    if (!cached) return null;
    
    const age = Date.now() - cached.timestamp;
    if (age > this.cacheExpiration) {
      this.cache.delete(cacheKey);
      return null;
    }
    
    return cached.data;
  }

  /**
   * Store response in cache
   * @param {string} cacheKey - Cache key
   * @param {Object} data - Data to cache
   */
  setInCache(cacheKey, data) {
    if (!this.cache || !(this.cache instanceof Map)) {
      return;
    }
    
    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Update tool feedback (to be implemented by subclasses)
   * @param {Object} feedback - Feedback object
   */
  updateFeedback(feedback) {
    if (this.updateToolFeedback) {
      this.updateToolFeedback(feedback);
    }
  }

  /**
   * Execute tool (to be implemented by subclasses)
   * @abstract
   */
  async execute(...args) {
    throw new Error('execute() must be implemented by subclass');
  }
}

export default ToolExecutor;

