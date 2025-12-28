/**
 * Storage utilities untuk menyimpan state token
 * Menggunakan Redis (Upstash) atau in-memory cache sebagai fallback
 */

import { Redis } from '@upstash/redis';

export class TokenStorage {
  constructor() {
    this.useRedis = false;
    this.redis = null;
    this.memoryCache = new Map();
    this.cacheExpiry = new Map();
    
    this.initStorage();
  }

  /**
   * Initialize storage backend
   */
  initStorage() {
    // Cek jika Redis tersedia dari environment variables
    const redisUrl = process.env.REDIS_URL;
    const redisToken = process.env.REDIS_TOKEN;
    
    if (redisUrl && redisToken) {
      try {
        this.redis = new Redis({
          url: redisUrl,
          token: redisToken,
        });
        this.useRedis = true;
        console.log('✅ Using Redis for persistent storage');
      } catch (error) {
        console.error('❌ Redis connection failed, using memory cache:', error.message);
        this.useRedis = false;
      }
    } else {
      console.log('ℹ️ Using in-memory cache (set REDIS_URL for persistent storage)');
    }
  }

  /**
   * Simpan token sebagai sudah dikirim
   */
  async markTokenAsSent(tokenId, ttlSeconds = 86400) { // Default 24 jam
    const timestamp = Date.now();
    const data = {
      sent_at: timestamp,
      expires_at: timestamp + (ttlSeconds * 1000)
    };

    try {
      if (this.useRedis && this.redis) {
        await this.redis.setex(`sent:${tokenId}`, ttlSeconds, JSON.stringify(data));
      } else {
        this.memoryCache.set(tokenId, data);
        this.cacheExpiry.set(tokenId, data.expires_at);
        
        // Auto cleanup expired entries
        this.cleanupExpired();
      }
      
      return true;
    } catch (error) {
      console.error('Error marking token as sent:', error);
      return false;
    }
  }

  /**
   * Cek apakah token sudah dikirim
   */
  async isTokenSent(tokenId) {
    try {
      if (this.useRedis && this.redis) {
        const data = await this.redis.get(`sent:${tokenId}`);
        return data !== null;
      } else {
        // Cek di memory cache
        const data = this.memoryCache.get(tokenId);
        if (!data) return false;
        
        // Cek jika expired
        if (Date.now() > data.expires_at) {
          this.memoryCache.delete(tokenId);
          this.cacheExpiry.delete(tokenId);
          return false;
        }
        
        return true;
      }
    } catch (error) {
      console.error('Error checking token:', error);
      return false;
    }
  }

  /**
   * Dapatkan token IDs yang sudah dikirim
   */
  async getSentTokens(limit = 100) {
    try {
      if (this.useRedis && this.redis) {
        // Note: Ini pattern matching di Redis, bisa lambat untuk dataset besar
        // Untuk production, consider menggunakan Redis sets atau hash
        const keys = await this.redis.keys('sent:*');
        const tokens = [];
        
        for (const key of keys.slice(0, limit)) {
          const data = await this.redis.get(key);
          if (data) {
            tokens.push({
              id: key.replace('sent:', ''),
              ...JSON.parse(data)
            });
          }
        }
        
        return tokens;
      } else {
        const tokens = [];
        for (const [id, data] of this.memoryCache.entries()) {
          if (Date.now() <= data.expires_at) {
            tokens.push({ id, ...data });
          }
        }
        return tokens.slice(0, limit);
      }
    } catch (error) {
      console.error('Error getting sent tokens:', error);
      return [];
    }
  }

  /**
   * Hitung berapa token yang sudah dikirim
   */
  async getSentCount() {
    try {
      if (this.useRedis && this.redis) {
        const keys = await this.redis.keys('sent:*');
        return keys.length;
      } else {
        return this.memoryCache.size;
      }
    } catch (error) {
      console.error('Error counting sent tokens:', error);
      return 0;
    }
  }

  /**
   * Hapus token dari sent list
   */
  async removeToken(tokenId) {
    try {
      if (this.useRedis && this.redis) {
        await this.redis.del(`sent:${tokenId}`);
      } else {
        this.memoryCache.delete(tokenId);
        this.cacheExpiry.delete(tokenId);
      }
      return true;
    } catch (error) {
      console.error('Error removing token:', error);
      return false;
    }
  }

  /**
   * Clear semua sent tokens
   */
  async clearAll() {
    try {
      if (this.useRedis && this.redis) {
        const keys = await this.redis.keys('sent:*');
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      } else {
        this.memoryCache.clear();
        this.cacheExpiry.clear();
      }
      console.log('✅ Cleared all sent tokens');
      return true;
    } catch (error) {
      console.error('Error clearing tokens:', error);
      return false;
    }
  }

  /**
   * Simpan execution log
   */
  async logExecution(data) {
    const logId = `log:${Date.now()}`;
    const logData = {
      ...data,
      timestamp: Date.now()
    };

    try {
      if (this.useRedis && this.redis) {
        // Simpan log dengan TTL 7 hari
        await this.redis.setex(logId, 604800, JSON.stringify(logData));
        
        // Juga simpan dalam list untuk history
        await this.redis.lpush('execution_logs', JSON.stringify(logData));
        await this.redis.ltrim('execution_logs', 0, 99); // Keep last 100 logs
      } else {
        // Simpan di memory
        const logs = this.memoryCache.get('execution_logs') || [];
        logs.unshift(logData);
        if (logs.length > 100) logs.pop();
        this.memoryCache.set('execution_logs', logs);
      }
      
      return true;
    } catch (error) {
      console.error('Error logging execution:', error);
      return false;
    }
  }

  /**
   * Dapatkan execution logs
   */
  async getExecutionLogs(limit = 20) {
    try {
      if (this.useRedis && this.redis) {
        const logs = await this.redis.lrange('execution_logs', 0, limit - 1);
        return logs.map(log => JSON.parse(log));
      } else {
        const logs = this.memoryCache.get('execution_logs') || [];
        return logs.slice(0, limit);
      }
    } catch (error) {
      console.error('Error getting logs:', error);
      return [];
    }
  }

  /**
   * Simpan statistics
   */
  async updateStats(stats) {
    const statsKey = 'bot_stats';
    const now = Date.now();

    try {
      if (this.useRedis && this.redis) {
        // Update hash fields
        await this.redis.hset(statsKey, {
          last_updated: now,
          total_checks: stats.totalChecks || 0,
          total_tokens_sent: stats.totalTokensSent || 0,
          last_execution: stats.lastExecution || now
        });
        
        // Set TTL 30 hari
        await this.redis.expire(statsKey, 2592000);
      } else {
        const currentStats = this.memoryCache.get(statsKey) || {};
        this.memoryCache.set(statsKey, {
          ...currentStats,
          last_updated: now,
          total_checks: (currentStats.total_checks || 0) + (stats.totalChecks || 0),
          total_tokens_sent: (currentStats.total_tokens_sent || 0) + (stats.totalTokensSent || 0),
          last_execution: stats.lastExecution || now
        });
      }
      
      return true;
    } catch (error) {
      console.error('Error updating stats:', error);
      return false;
    }
  }

  /**
   * Dapatkan statistics
   */
  async getStats() {
    try {
      if (this.useRedis && this.redis) {
        const stats = await this.redis.hgetall('bot_stats');
        return stats || {};
      } else {
        return this.memoryCache.get('bot_stats') || {};
      }
    } catch (error) {
      console.error('Error getting stats:', error);
      return {};
    }
  }

  /**
   * Cleanup expired entries dari memory cache
   */
  cleanupExpired() {
    const now = Date.now();
    for (const [tokenId, expiry] of this.cacheExpiry.entries()) {
      if (now > expiry) {
        this.memoryCache.delete(tokenId);
        this.cacheExpiry.delete(tokenId);
      }
    }
  }

  /**
   * Get storage info (untuk debugging)
   */
  async getStorageInfo() {
    return {
      backend: this.useRedis ? 'redis' : 'memory',
      sent_tokens_count: await this.getSentCount(),
      has_redis: !!(process.env.REDIS_URL && process.env.REDIS_TOKEN),
      memory_cache_size: this.memoryCache.size
    };
  }
}

// Export singleton instance
export const storage = new TokenStorage();

// Export helper functions
export async function markTokenAsSent(tokenId, ttl = 86400) {
  return await storage.markTokenAsSent(tokenId, ttl);
}

export async function isTokenSent(tokenId) {
  return await storage.isTokenSent(tokenId);
}

export async function filterNewTokens(tokens) {
  const newTokens = [];
  
  for (const token of tokens) {
    // Buat unique ID untuk token
    const tokenId = `token:${token.symbol}:${token.address || 'no_address'}`;
    
    if (!(await storage.isTokenSent(tokenId))) {
      newTokens.push({
        ...token,
        storage_id: tokenId
      });
    }
  }
  
  return newTokens;
}

export async function saveSentTokens(tokens) {
  const results = [];
  
  for (const token of tokens) {
    const tokenId = token.storage_id || `token:${token.symbol}:${token.address || 'no_address'}`;
    const success = await storage.markTokenAsSent(tokenId);
    results.push({ tokenId, symbol: token.symbol, success });
  }
  
  return results;
}

// Export default instance
export default storage;
