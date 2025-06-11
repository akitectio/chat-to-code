/**
 * Module tìm kiếm Google
 */

const { GoogleSearch } = require('google-search-results-nodejs');
const axios = require('axios');
const logger = require('./logger');
const config = require('../../config/default');

class GoogleSearchClient {
  constructor() {
    this.googleConfig = config.googleSearch;
    this.serpApiConfig = config.serpApi;
    
    // Khởi tạo SerpApi client nếu được bật
    if (this.serpApiConfig.enabled && this.serpApiConfig.apiKey) {
      this.serpApi = new GoogleSearch(this.serpApiConfig.apiKey);
    }
  }
  
  /**
   * Tìm kiếm sử dụng Google Custom Search API
   * @param {string} query - Truy vấn tìm kiếm
   * @param {object} options - Tùy chọn tìm kiếm
   * @returns {Promise<Array>} - Kết quả tìm kiếm
   */
  async searchWithGoogleApi(query, options = {}) {
    try {
      if (!this.googleConfig.enabled || !this.googleConfig.apiKey || !this.googleConfig.searchEngineId) {
        throw new Error('Google Search API chưa được cấu hình');
      }
      
      const params = {
        key: this.googleConfig.apiKey,
        cx: this.googleConfig.searchEngineId,
        q: query,
        num: options.num || this.googleConfig.resultsPerQuery,
        lr: options.lr || '',
        gl: options.gl || 'vn',
        hl: options.hl || 'vi'
      };
      
      logger.info(`Tìm kiếm Google: "${query}"`);
      const response = await axios.get('https://www.googleapis.com/customsearch/v1', { params });
      
      if (!response.data.items || response.data.items.length === 0) {
        logger.info('Không tìm thấy kết quả');
        return [];
      }
      
      // Xử lý kết quả
      return response.data.items.map(item => ({
        title: item.title,
        link: item.link,
        snippet: item.snippet,
        source: 'Google Custom Search API'
      }));
    } catch (error) {
      logger.error('Lỗi khi tìm kiếm với Google API:', error.message);
      throw error;
    }
  }
  
  /**
   * Tìm kiếm sử dụng SerpApi
   * @param {string} query - Truy vấn tìm kiếm
   * @param {object} options - Tùy chọn tìm kiếm
   * @returns {Promise<Array>} - Kết quả tìm kiếm
   */
  async searchWithSerpApi(query, options = {}) {
    return new Promise((resolve, reject) => {
      try {
        if (!this.serpApiConfig.enabled || !this.serpApi) {
          throw new Error('SerpApi chưa được cấu hình');
        }
        
        const params = {
          q: query,
          num: options.num || this.googleConfig.resultsPerQuery,
          lr: options.lr || '',
          gl: options.gl || 'vn',
          hl: options.hl || 'vi'
        };
        
        logger.info(`Tìm kiếm SerpApi: "${query}"`);
        this.serpApi.json(params, (data) => {
          if (!data.organic_results || data.organic_results.length === 0) {
            logger.info('Không tìm thấy kết quả');
            resolve([]);
            return;
          }
          
          // Xử lý kết quả
          const results = data.organic_results.map(item => ({
            title: item.title,
            link: item.link,
            snippet: item.snippet,
            source: 'SerpApi'
          }));
          
          resolve(results);
        }, (error) => {
          logger.error('Lỗi khi tìm kiếm với SerpApi:', error);
          reject(error);
        });
      } catch (error) {
        logger.error('Lỗi khi tìm kiếm với SerpApi:', error.message);
        reject(error);
      }
    });
  }
  
  /**
   * Tìm kiếm Google
   * @param {string} query - Truy vấn tìm kiếm
   * @param {object} options - Tùy chọn tìm kiếm
   * @returns {Promise<Array>} - Kết quả tìm kiếm
   */
  async search(query, options = {}) {
    try {
      // Thử sử dụng SerpApi trước nếu được cấu hình
      if (this.serpApiConfig.enabled && this.serpApiConfig.apiKey) {
        try {
          return await this.searchWithSerpApi(query, options);
        } catch (error) {
          logger.warn('Lỗi khi tìm kiếm với SerpApi, chuyển sang Google API:', error.message);
        }
      }
      
      // Sử dụng Google Custom Search API
      if (this.googleConfig.enabled && this.googleConfig.apiKey && this.googleConfig.searchEngineId) {
        return await this.searchWithGoogleApi(query, options);
      }
      
      throw new Error('Không có API tìm kiếm nào được cấu hình');
    } catch (error) {
      logger.error('Lỗi khi tìm kiếm Google:', error.message);
      return [];
    }
  }
  
  /**
   * Trích xuất thông tin từ URL
   * @param {string} url - URL cần trích xuất
   * @returns {Promise<string>} - Nội dung trích xuất
   */
  async extractContent(url) {
    try {
      logger.info(`Trích xuất nội dung từ: ${url}`);
      const response = await axios.get(url, {
        timeout: 5000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      // Trích xuất nội dung HTML
      const html = response.data;
      
      // Đơn giản hóa: loại bỏ các thẻ HTML và trả về văn bản thuần túy
      // Trong thực tế, bạn có thể sử dụng thư viện như cheerio để phân tích HTML tốt hơn
      const text = html.replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      // Giới hạn độ dài
      return text.substring(0, 5000);
    } catch (error) {
      logger.error(`Lỗi khi trích xuất nội dung từ ${url}:`, error.message);
      return '';
    }
  }
}

module.exports = new GoogleSearchClient();