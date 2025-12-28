/**
 * Scraper untuk cookin.fun
 * Optimized untuk struktur website cookin.fun berdasarkan screenshot
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

export class CookinScraper {
  constructor() {
    this.baseUrl = 'https://cookin.fun';
    this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    this.timeout = 15000;
  }

  /**
   * Fetch dan parse tokens dari cookin.fun
   */
  async fetchTokens() {
    try {
      console.log('🔍 Fetching data from cookin.fun...');
      
      const response = await axios.get(this.baseUrl, {
        headers: this.getHeaders(),
        timeout: this.timeout
      });

      const tokens = this.parseTokens(response.data);
      console.log(`✅ Found ${tokens.length} potential tokens`);
      
      return tokens;
      
    } catch (error) {
      console.error('❌ Error fetching from cookin.fun:', error.message);
      
      // Return fallback data untuk development
      if (process.env.NODE_ENV === 'development') {
        return this.getMockTokens();
      }
      
      return [];
    }
  }

  /**
   * Parse HTML untuk ekstrak token info
   */
  parseTokens(html) {
    const $ = cheerio.load(html);
    const tokens = [];

    console.log('🧠 Parsing HTML structure...');

    // Method 1: Parse berdasarkan screenshot Anda
    // Dari screenshot: "FPM Funny Pants-Man FPM_PUMP DUMP..."
    tokens.push(...this.parseByTextPattern($));
    
    // Method 2: Parse berdasarkan struktur HTML
    tokens.push(...this.parseByHtmlStructure($));
    
    // Method 3: Parse berdasarkan class/id tertentu
    tokens.push(...this.parseByCssSelectors($));

    // Remove duplicates dan filter invalid
    return this.cleanTokens(tokens);
  }

  /**
   * Parse berdasarkan pola text dari screenshot
   */
  parseByTextPattern($) {
    const tokens = [];
    const pageText = $('body').text();
    
    // Pola dari screenshot Anda:
    // 1. [SYMBOL] [NAME] [SYMBOL]_[STATUS]
    // 2. PUMP/DUMP indicators
    // 3. Contract addresses dengan ...
    
    const lines = pageText.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 10);
    
    for (const line of lines) {
      // Skip jika bukan token line
      if (!this.isTokenLine(line)) continue;
      
      const token = this.extractFromLine(line);
      if (token) {
        tokens.push(token);
      }
    }
    
    return tokens;
  }

  /**
   * Parse berdasarkan struktur HTML
   */
  parseByHtmlStructure($) {
    const tokens = [];
    
    // Cari semua elemen yang mungkin mengandung token info
    const selectors = [
      'div', 'section', 'article', 'tr', 'li',
      '[class*="token"]', '[class*="card"]', '[class*="item"]',
      '[class*="pump"]', '[class*="new"]'
    ];
    
    $(selectors.join(', ')).each((index, element) => {
      const $element = $(element);
      const text = $element.text().trim();
      const html = $element.html();
      
      if (!text || text.length < 20) return;
      
      // Cek jika elemen ini mengandung info token
      if (this.containsTokenInfo(text)) {
        const token = this.extractFromElement($element, text, html);
        if (token) {
          tokens.push(token);
        }
      }
    });
    
    return tokens;
  }

  /**
   * Parse menggunakan CSS selectors spesifik
   */
  parseByCssSelectors($) {
    const tokens = [];
    
    // Selectors berdasarkan analisis screenshot
    const tokenSelectors = [
      // Dari screenshot tampaknya ada struktur tabel/list
      'div > div', // Nested divs
      'tr:has(td)', // Table rows
      'div:contains("PUMP")', // Divs containing "PUMP"
      'div:contains("NEW")', // Divs containing "NEW"
      'span:contains("...")', // Spans with address
    ];
    
    tokenSelectors.forEach(selector => {
      $(selector).each((index, element) => {
        const $element = $(element);
        const text = $element.text().trim();
        
        if (text && this.isTokenLine(text)) {
          const token = this.extractFromLine(text);
          if (token) {
            token.source = `selector:${selector}`;
            tokens.push(token);
          }
        }
      });
    });
    
    return tokens;
  }

  /**
   * Cek jika line mengandung info token
   */
  isTokenLine(line) {
    const upperLine = line.toUpperCase();
    
    // Keywords dari screenshot Anda
    const tokenKeywords = [
      'PUMP', 'DUMP', 'NEW', 'TOKEN',
      'SOLANA', 'MEMECOIN', 'COIN',
      'RESUSED', 'TORK', 'NAME', 'URL'
    ];
    
    const hasKeyword = tokenKeywords.some(keyword => 
      upperLine.includes(keyword)
    );
    
    // Juga cek pattern token address (ada ...)
    const hasAddressPattern = /[A-Za-z0-9]{4,8}\.\.\./.test(line);
    
    // Cek jika ada symbol (2-6 huruf kapital)
    const hasSymbol = /\b([A-Z]{2,6})\b/.test(line);
    
    return (hasKeyword || hasAddressPattern) && hasSymbol;
  }

  /**
   * Ekstrak info token dari text line
   */
  extractFromLine(line) {
    try {
      // Clean the line
      const cleanLine = line.replace(/\s+/g, ' ').trim();
      
      // Extract symbol (uppercase 2-6 chars)
      const symbolMatch = cleanLine.match(/\b([A-Z]{2,6})\b/);
      if (!symbolMatch) return null;
      
      const symbol = symbolMatch[1];
      
      // Extract address (pattern with ...)
      const addressMatch = cleanLine.match(/([A-Za-z0-9]{4,8})\.\.\./);
      const address = addressMatch ? addressMatch[1] + '...' : null;
      
      // Extract status
      let status = 'NEW';
      let emoji = '🆕';
      if (cleanLine.includes('PUMP')) {
        status = '🚀 PUMPING';
        emoji = '🚀';
      } else if (cleanLine.includes('DUMP')) {
        status = '📉 DUMPING';
        emoji = '📉';
      }
      
      // Extract name (text around symbol)
      let name = symbol;
      const words = cleanLine.split(' ');
      const symbolIndex = words.findIndex(w => w === symbol);
      
      if (symbolIndex > 0) {
        // Coba ambil kata sebelum symbol sebagai name
        name = words[symbolIndex - 1];
        
        // Jika name terlalu pendek atau sama dengan symbol, cari lagi
        if (name.length < 2 || name === symbol) {
          // Cari string antara symbol pertama dan kedua
          const secondSymbolMatch = cleanLine.match(new RegExp(`${symbol}\\s+([A-Za-z\\-]+)\\s+`));
          if (secondSymbolMatch && secondSymbolMatch[1]) {
            name = secondSymbolMatch[1];
          }
        }
      }
      
      // Extract links (telegram, twitter, etc)
      const linkRegex = /(https?:\/\/[^\s]+)/g;
      const links = [];
      let match;
      while ((match = linkRegex.exec(cleanLine)) !== null) {
        links.push(match[1]);
      }
      
      return {
        id: `${symbol}_${address || Date.now()}`,
        symbol,
        name: this.formatName(name),
        address,
        status,
        emoji,
        text: cleanLine.substring(0, 200),
        links: links.slice(0, 3),
        source: 'text_parsing',
        timestamp: new Date().toISOString(),
        confidence: this.calculateConfidence(cleanLine, symbol, address)
      };
      
    } catch (error) {
      console.error('Error extracting from line:', error);
      return null;
    }
  }

  /**
   * Ekstrak info dari HTML element
   */
  extractFromElement($element, text, html) {
    try {
      // Cari symbol
      const symbolMatch = text.match(/\b([A-Z]{2,6})\b/);
      if (!symbolMatch) return null;
      
      const symbol = symbolMatch[1];
      
      // Cari parent element untuk konteks lebih luas
      const parentText = $element.parent().text().substring(0, 300);
      
      // Gabungkan text dari element dan parent
      const combinedText = text + ' ' + parentText;
      
      // Extract dari combined text
      const token = this.extractFromLine(combinedText);
      if (token) {
        token.source = 'element_parsing';
        
        // Extract additional info dari HTML attributes
        const hrefs = [];
        $element.find('a[href]').each((i, a) => {
          const href = $(a).attr('href');
          if (href && !hrefs.includes(href)) {
            hrefs.push(href);
          }
        });
        
        if (hrefs.length > 0) {
          token.links = [...new Set([...token.links, ...hrefs])].slice(0, 3);
        }
      }
      
      return token;
      
    } catch (error) {
      console.error('Error extracting from element:', error);
      return null;
    }
  }

  /**
   * Cek jika text mengandung info token
   */
  containsTokenInfo(text) {
    if (!text || text.length < 10) return false;
    
    const upperText = text.toUpperCase();
    
    // Critical indicators dari screenshot
    const hasCritical = 
      (upperText.includes('PUMP') && upperText.includes('DUMP')) ||
      upperText.includes('NEW TOKENS') ||
      upperText.includes('RESUSED') ||
      /[A-Z]{2,6}_.*(PUMP|DUMP)/.test(upperText);
    
    // Basic indicators
    const hasBasic = 
      upperText.includes('TOKEN') ||
      upperText.includes('SOLANA') ||
      /[A-Za-z0-9]{4,8}\.\.\./.test(text) ||
      /\b([A-Z]{2,6})\b.*\b([A-Z]{2,6})\b/.test(text);
    
    return hasCritical || hasBasic;
  }

  /**
   * Format nama token
   */
  formatName(name) {
    if (!name || name === 'undefined' || name.length < 2) {
      return 'Unknown Token';
    }
    
    // Capitalize first letter
    return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  }

  /**
   * Hitung confidence score untuk token
   */
  calculateConfidence(text, symbol, address) {
    let score = 0;
    
    // Symbol validity
    if (symbol && symbol.length >= 2 && symbol.length <= 6) {
      score += 30;
    }
    
    // Address pattern
    if (address && address.includes('...')) {
      score += 40;
    }
    
    // Status indicators
    if (text.includes('PUMP') || text.includes('DUMP') || text.includes('NEW')) {
      score += 20;
    }
    
    // Links presence
    if (text.includes('https://') || text.includes('t.me/')) {
      score += 10;
    }
    
    return Math.min(score, 100);
  }

  /**
   * Clean dan filter tokens
   */
  cleanTokens(tokens) {
    const seen = new Set();
    const cleaned = [];
    
    for (const token of tokens) {
      if (!token || !token.symbol) continue;
      
      // Validasi minimal
      if (token.confidence < 30) continue;
      
      // Buat unique key
      const key = `${token.symbol}_${token.address || 'no_addr'}`;
      
      if (!seen.has(key)) {
        seen.add(key);
        cleaned.push(token);
      }
    }
    
    // Sort by confidence (highest first)
    cleaned.sort((a, b) => b.confidence - a.confidence);
    
    return cleaned.slice(0, 15); // Max 15 tokens
  }

  /**
   * Get headers untuk request
   */
  getHeaders() {
    return {
      'User-Agent': this.userAgent,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Cache-Control': 'max-age=0',
      'DNT': '1'
    };
  }

  /**
   * Mock data untuk development
   */
  getMockTokens() {
    console.log('⚠️ Using mock data for development');
    
    return [
      {
        id: 'FPM_1',
        symbol: 'FPM',
        name: 'Funny Pants-Man',
        address: 'F45yyX...pump',
        status: '🚀 PUMPING',
        emoji: '🚀',
        text: 'FPM Funny Pants-Man FPM_PUMP DUMP RESUSED TORK NAME',
        links: ['https://t.me/communities/20049885148200371257'],
        source: 'mock',
        timestamp: new Date().toISOString(),
        confidence: 95
      },
      {
        id: 'SOMALIA_1',
        symbol: 'SOMALIA',
        name: 'Gemalia-Meme',
        address: 'funATB...pump',
        status: '🚀 PUMPING',
        emoji: '🚀',
        text: 'SOMALIA Gemalia-Meme https://t.me/t/communities/20049885148200371257 PUMP DUMP RESUSED TORK NAME',
        links: ['https://t.me/t/communities/20049885148200371257', 'https://t.me/search?q=semalian&src=type#set_d1'],
        source: 'mock',
        timestamp: new Date().toISOString(),
        confidence: 90
      },
      {
        id: 'BOBO_1',
        symbol: 'BOBO',
        name: 'Bo Bo',
        address: 'GET<31...pump',
        status: '🚀 PUMPING',
        emoji: '🚀',
        text: 'bo bo https://t.me/t/communities/200498952422946621 https://thelocal.ink/ PUMP DUMP RESUSED BAG TORK NAME',
        links: ['https://t.me/t/communities/200498952422946621', 'https://thelocal.ink/'],
        source: 'mock',
        timestamp: new Date().toISOString(),
        confidence: 85
      },
      {
        id: 'GOONGON_1',
        symbol: 'GOONGON',
        name: 'Artelett Goon Coin',
        address: 'v8xV4...pump',
        status: '🆕 NEW',
        emoji: '🆕',
        text: 'GOONGON Artelett Goon Coin https://t.me/nod/T60/x/satura/20049907264901224 PUMP DUMP RESUSED URL TORK',
        links: ['https://t.me/nod/T60/x/satura/20049907264901224', 'https://t.me/nod1979/satura/200457028189410816'],
        source: 'mock',
        timestamp: new Date().toISOString(),
        confidence: 80
      }
    ];
  }

  /**
   * Test scraping dengan output detail
   */
  async debugScraping() {
    try {
      const response = await axios.get(this.baseUrl, {
        headers: this.getHeaders(),
        timeout: this.timeout
      });

      const $ = cheerio.load(response.data);
      
      // Log struktur HTML untuk debugging
      console.log('=== HTML STRUCTURE DEBUG ===');
      
      // Cari semua text nodes yang menarik
      $('body *').each((i, elem) => {
        const text = $(elem).text().trim();
        if (text.length > 20 && this.isTokenLine(text)) {
          console.log(`\nElement ${i}:`);
          console.log('Tag:', elem.name);
          console.log('Classes:', $(elem).attr('class'));
          console.log('Text:', text.substring(0, 100));
        }
      });
      
      return this.parseTokens(response.data);
      
    } catch (error) {
      console.error('Debug error:', error);
      return [];
    }
  }
}

// Export instance
export const scraper = new CookinScraper();

// Export fungsi utama
export default async function scrapeCookinFun() {
  const scraper = new CookinScraper();
  return await scraper.fetchTokens();
}
