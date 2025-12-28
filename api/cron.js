import { Telegraf } from 'telegraf';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { Redis } from '@upstash/redis';

// Initialize Redis for state persistence (optional)
const redis = process.env.REDIS_URL 
  ? new Redis({
      url: process.env.REDIS_URL,
      token: process.env.REDIS_TOKEN,
    })
  : null;

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const CRON_SECRET = process.env.CRON_SECRET;

// Cache for in-memory storage (fallback if no Redis)
let sentTokensCache = new Set();

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle OPTIONS for CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Optional: Add cron secret for security
  if (CRON_SECRET && req.query.secret !== CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {
    console.log('🚀 Starting crypto bot check...');
    
    if (!BOT_TOKEN || !CHAT_ID) {
      throw new Error('BOT_TOKEN or CHAT_ID not configured');
    }
    
    const bot = new Telegraf(BOT_TOKEN);
    
    // 1. Scrape tokens from cookin.fun
    console.log('🔍 Scraping cookin.fun...');
    const tokens = await scrapeCookinFun();
    
    // 2. Filter new tokens
    const newTokens = await filterNewTokens(tokens);
    
    // 3. Send to Telegram
    if (newTokens.length > 0) {
      console.log(`📨 Sending ${newTokens.length} new tokens...`);
      await sendToTelegram(bot, newTokens);
      
      // 4. Save sent tokens
      await saveSentTokens(newTokens);
    } else {
      console.log('📭 No new tokens found');
    }
    
    // 5. Log execution
    await logExecution(newTokens.length);
    
    // Return success response
    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      tokens_scraped: tokens.length,
      tokens_sent: newTokens.length,
      tokens: newTokens.slice(0, 3),
      message: `Checked ${tokens.length} tokens, sent ${newTokens.length} new ones`
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
    
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

async function scrapeCookinFun() {
  try {
    const response = await axios.get('https://cookin.fun', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Cache-Control': 'max-age=0'
      },
      timeout: 15000
    });
    
    const $ = cheerio.load(response.data);
    const tokens = [];
    
    // Method 1: Look for token cards/containers
    $('div, article, section').each((index, element) => {
      const text = $(element).text().trim();
      const html = $(element).html();
      
      // Check if this looks like a token listing
      const hasTokenKeywords = /(PUMP|NEW|TOKEN|SOLANA|MEME|COIN)/i.test(text);
      const hasSymbol = /\b([A-Z]{2,6})\b/.test(text);
      const hasAddress = /([A-Za-z0-9]{4,8})\.\.\./.test(text);
      
      if (hasTokenKeywords && (hasSymbol || hasAddress)) {
        // Extract symbol
        const symbolMatch = text.match(/\b([A-Z]{2,6})\b/);
        const symbol = symbolMatch ? symbolMatch[1] : 'UNKNOWN';
        
        // Extract address
        const addressMatch = text.match(/([A-Za-z0-9]{4,8})\.\.\./);
        const address = addressMatch ? addressMatch[1] + '...' : null;
        
        // Extract name (text before symbol)
        let name = symbol;
        const lines = text.split(/\s+/);
        for (let i = 0; i < lines.length; i++) {
          if (lines[i] === symbol && i > 0) {
            name = lines[i-1];
            break;
          }
        }
        
        // Determine status
        let status = 'NEW';
        let emoji = '🆕';
        if (/PUMP/i.test(text)) {
          status = '🚀 PUMPING';
          emoji = '🚀';
        } else if (/DUMP/i.test(text)) {
          status = '📉 DUMPING';
          emoji = '📉';
        }
        
        // Extract links
        const links = [];
        $(element).find('a[href*="http"]').each((i, a) => {
          const href = $(a).attr('href');
          if (href && !links.includes(href)) {
            links.push(href);
          }
        });
        
        tokens.push({
          id: `${symbol}_${address || Date.now()}`,
          symbol,
          name,
          address,
          status,
          emoji,
          text: text.substring(0, 200),
          links: links.slice(0, 3),
          source: 'cookin.fun',
          timestamp: new Date().toISOString(),
          element_text: text.substring(0, 100)
        });
      }
    });
    
    // Method 2: Look for specific patterns in page text
    if (tokens.length < 2) {
      const pageText = $('body').text();
      const lines = pageText.split('\n').map(l => l.trim()).filter(l => l.length > 10);
      
      for (const line of lines) {
        if (/(PUMP|NEW).*[A-Z]{2,6}/i.test(line)) {
          const symbolMatch = line.match(/\b([A-Z]{2,6})\b/);
          if (symbolMatch) {
            const existing = tokens.find(t => t.symbol === symbolMatch[1]);
            if (!existing) {
              tokens.push({
                id: `${symbolMatch[1]}_${Date.now()}`,
                symbol: symbolMatch[1],
                name: symbolMatch[1],
                address: null,
                status: /PUMP/i.test(line) ? '🚀 PUMPING' : '🆕 NEW',
                emoji: /PUMP/i.test(line) ? '🚀' : '🆕',
                text: line.substring(0, 150),
                links: [],
                source: 'text_scan',
                timestamp: new Date().toISOString()
              });
            }
          }
        }
      }
    }
    
    // Remove duplicates
    const uniqueTokens = [];
    const seen = new Set();
    
    for (const token of tokens) {
      const key = token.symbol + (token.address || '');
      if (!seen.has(key)) {
        seen.add(key);
        uniqueTokens.push(token);
      }
    }
    
    console.log(`✅ Found ${uniqueTokens.length} unique tokens`);
    return uniqueTokens.slice(0, 10); // Limit to 10
    
  } catch (error) {
    console.error('Scraping error:', error.message);
    
    // Fallback: Return mock data for testing
    if (process.env.NODE_ENV === 'development') {
      return [
        {
          id: 'TEST_1',
          symbol: 'TEST',
          name: 'Test Token',
          address: 'TestAddr...',
          status: '🆕 NEW',
          emoji: '🆕',
          text: 'Test token for development',
          links: [],
          source: 'mock',
          timestamp: new Date().toISOString()
        }
      ];
    }
    
    return [];
  }
}

async function filterNewTokens(tokens) {
  const newTokens = [];
  
  for (const token of tokens) {
    const tokenKey = `token:${token.symbol}:${token.address || 'no_address'}`;
    let isNew = false;
    
    // Check Redis first
    if (redis) {
      const sent = await redis.get(tokenKey);
      isNew = !sent;
    } else {
      // Check in-memory cache
      isNew = !sentTokensCache.has(tokenKey);
    }
    
    if (isNew) {
      newTokens.push(token);
    }
  }
  
  return newTokens;
}

async function sendToTelegram(bot, tokens) {
  for (const token of tokens) {
    const message = `
${token.emoji} *${token.status}* ${token.emoji}

*Token:* ${token.name}
*Symbol:* \`${token.symbol}\`
${token.address ? `*Address:* \`${token.address}\`\n` : ''}
*Info:*
${token.text}

${token.links.length > 0 ? `*Links:*\n${token.links.map(l => `• ${l}`).join('\n')}\n` : ''}
⏰ *Time:* ${new Date().toLocaleTimeString('id-ID')}
🔍 *Source:* ${token.source}
📅 *Date:* ${new Date().toLocaleDateString('id-ID')}

🤖 *Powered by Vercel Serverless*
🔄 *Auto-check every 5 minutes*
    `.trim();
    
    try {
      await bot.telegram.sendMessage(CHAT_ID, message, {
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
        disable_notification: false
      });
      
      console.log(`✅ Sent: ${token.symbol} (${token.status})`);
      
      // Delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`❌ Failed to send ${token.symbol}:`, error.message);
      
      // If it's a rate limit error, wait longer
      if (error.message.includes('Too Many Requests')) {
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }
}

async function saveSentTokens(tokens) {
  for (const token of tokens) {
    const tokenKey = `token:${token.symbol}:${token.address || 'no_address'}`;
    
    if (redis) {
      // Save to Redis with 24h TTL
      await redis.setex(tokenKey, 86400, new Date().toISOString());
    } else {
      // Save to in-memory cache
      sentTokensCache.add(tokenKey);
      
      // Limit cache size
      if (sentTokensCache.size > 1000) {
        const array = Array.from(sentTokensCache);
        sentTokensCache = new Set(array.slice(-500));
      }
    }
  }
}

async function logExecution(tokensSent) {
  const logKey = 'execution:logs';
  const statsKey = 'execution:stats';
  const timestamp = new Date().toISOString();
  
  const logEntry = {
    timestamp,
    tokens_sent: tokensSent,
    success: true
  };
  
  if (redis) {
    // Add to logs list (keep last 100)
    await redis.lpush(logKey, JSON.stringify(logEntry));
    await redis.ltrim(logKey, 0, 99);
    
    // Update stats
    await redis.hincrby(statsKey, 'total_checks', 1);
    await redis.hincrby(statsKey, 'total_tokens_sent', tokensSent);
    await redis.hset(statsKey, 'last_execution', timestamp);
  } else {
    console.log('Execution logged:', logEntry);
  }
}
