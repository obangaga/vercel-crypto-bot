import { Telegraf } from 'telegraf';
import axios from 'axios';
import * as cheerio from 'cheerio';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    const BOT_TOKEN = process.env.BOT_TOKEN;
    const CHAT_ID = process.env.CHAT_ID;
    
    if (!BOT_TOKEN || !CHAT_ID) {
      return res.status(400).json({ 
        error: 'BOT_TOKEN or CHAT_ID not configured' 
      });
    }
    
    const bot = new Telegraf(BOT_TOKEN);
    
    // Manual check with immediate response
    const response = await axios.get('https://cookin.fun', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });
    
    const $ = cheerio.load(response.data);
    const tokens = [];
    
    // Simple scraping logic
    $('body').text().split('\n').forEach(line => {
      if (line.includes('PUMP') || line.includes('NEW')) {
        const symbolMatch = line.match(/\b([A-Z]{2,6})\b/);
        if (symbolMatch) {
          tokens.push({
            symbol: symbolMatch[1],
            text: line.substring(0, 100),
            status: line.includes('PUMP') ? '🚀 PUMP' : '🆕 NEW'
          });
        }
      }
    });
    
    // Send to Telegram if tokens found
    if (tokens.length > 0) {
      const message = `🔄 *Manual Check Result*\n\nFound ${tokens.length} tokens:\n${tokens.map(t => `• ${t.symbol}: ${t.status}`).join('\n')}`;
      
      await bot.telegram.sendMessage(CHAT_ID, message, {
        parse_mode: 'Markdown'
      });
    }
    
    return res.status(200).json({
      success: true,
      manual_check: true,
      tokens_found: tokens.length,
      tokens: tokens.slice(0, 5),
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Manual check error:', error);
    
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
