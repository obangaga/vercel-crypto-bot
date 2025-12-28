/**
 * Telegram bot utilities
 */

import { Telegraf } from 'telegraf';

export class TelegramBot {
  constructor(token) {
    if (!token) {
      throw new Error('Bot token is required');
    }
    
    this.bot = new Telegraf(token);
    this.setupErrorHandling();
  }

  /**
   * Setup error handling
   */
  setupErrorHandling() {
    this.bot.catch((err, ctx) => {
      console.error(`Telegram Bot Error for ${ctx.updateType}:`, err);
    });
  }

  /**
   * Format token message untuk Telegram
   */
  formatTokenMessage(token) {
    const message = `
${token.emoji} *${token.status}* ${token.emoji}

*Token:* ${token.name}
*Symbol:* \`${token.symbol}\`
${token.address ? `*Address:* \`${token.address}\`\n` : ''}
*Confidence:* ${token.confidence}%

*Info:*
${token.text}

${token.links.length > 0 ? `*Links:*\n${token.links.map((l, i) => `${i + 1}. ${l}`).join('\n')}\n` : ''}
⏰ *Detected:* ${new Date(token.timestamp).toLocaleTimeString('id-ID')}
🔍 *Source:* ${token.source}
📅 *Date:* ${new Date().toLocaleDateString('id-ID')}

🤖 *Auto-detected by Cookin.fun Monitor*
🔄 *Real-time updates every 5 minutes*
`.trim();

    return message;
  }

  /**
   * Send token to Telegram
   */
  async sendToken(chatId, token) {
    try {
      const message = this.formatTokenMessage(token);
      
      await this.bot.telegram.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
        disable_notification: false
      });
      
      console.log(`✅ Telegram: Sent ${token.symbol} to ${chatId}`);
      return true;
      
    } catch (error) {
      console.error(`❌ Telegram send failed for ${token.symbol}:`, error.message);
      
      // Handle specific errors
      if (error.description?.includes('Too Many Requests')) {
        console.log('⚠️ Rate limited, waiting...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      return false;
    }
  }

  /**
   * Send multiple tokens
   */
  async sendTokens(chatId, tokens) {
    const results = [];
    
    for (const token of tokens) {
      const success = await this.sendToken(chatId, token);
      results.push({ token: token.symbol, success });
      
      // Delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return results;
  }

  /**
   * Send summary report
   */
  async sendSummary(chatId, stats) {
    const message = `
📊 *Daily Report*

*Statistics:*
• Total tokens detected: ${stats.totalDetected}
• New tokens sent: ${stats.newTokens}
• Success rate: ${stats.successRate}%

*Recent Activity:*
${stats.recentTokens.map(t => `• ${t.symbol}: ${t.status}`).join('\n')}

⏰ *Report Time:* ${new Date().toLocaleTimeString('id-ID')}
🔄 *Next check:* 5 minutes

🤖 *Cookin.fun Monitor Bot*
`.trim();

    try {
      await this.bot.telegram.sendMessage(chatId, message, {
        parse_mode: 'Markdown'
      });
      
      return true;
    } catch (error) {
      console.error('Failed to send summary:', error);
      return false;
    }
  }

  /**
   * Test bot connection
   */
  async testConnection() {
    try {
      const me = await this.bot.telegram.getMe();
      console.log(`✅ Bot connected: @${me.username}`);
      return true;
    } catch (error) {
      console.error('❌ Bot connection failed:', error.message);
      return false;
    }
  }
}

// Export instance factory
export function createTelegramBot(token) {
  return new TelegramBot(token);
}
