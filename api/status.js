import { Redis } from '@upstash/redis';

const redis = process.env.REDIS_URL 
  ? new Redis({
      url: process.env.REDIS_URL,
      token: process.env.REDIS_TOKEN,
    })
  : null;

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Content-Type', 'application/json');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    let stats = {};
    let recentLogs = [];
    
    if (redis) {
      // Get stats from Redis
      stats = await redis.hgetall('execution:stats') || {};
      const logs = await redis.lrange('execution:logs', 0, 9) || [];
      recentLogs = logs.map(log => JSON.parse(log));
    }
    
    const status = {
      service: 'cookin.fun Crypto Monitor Bot',
      status: 'operational',
      timestamp: new Date().toISOString(),
      environment: {
        bot_configured: !!process.env.BOT_TOKEN,
        chat_configured: !!process.env.CHAT_ID,
        redis_configured: !!redis,
        node_env: process.env.NODE_ENV || 'development'
      },
      endpoints: {
        cron: '/api/cron - Auto check (every 5 min)',
        check: '/api/check - Manual check',
        status: '/api/status - This status page',
        dashboard: '/ - Web dashboard'
      },
      statistics: {
        total_checks: parseInt(stats.total_checks) || 0,
        total_tokens_sent: parseInt(stats.total_tokens_sent) || 0,
        last_execution: stats.last_execution || 'Never',
        uptime: process.uptime()
      },
      recent_executions: recentLogs,
      version: '1.0.0',
      documentation: 'https://github.com/yourusername/vercel-crypto-bot'
    };
    
    return res.status(200).json(status);
    
  } catch (error) {
    console.error('Status error:', error);
    
    return res.status(200).json({
      service: 'cookin.fun Crypto Monitor Bot',
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString(),
      environment: {
        bot_configured: !!process.env.BOT_TOKEN,
        chat_configured: !!process.env.CHAT_ID
      }
    });
  }
}
