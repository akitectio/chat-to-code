/**
 * Client giao tiếp với Ollama API
 */

const axios = require('axios');
const logger = require('./logger');
const ollamaConfig = require('../../config/ollama');
const { delay } = require('./helpers');

class OllamaClient {
  constructor(config = {}) {
    this.baseUrl = config.baseUrl || ollamaConfig.baseUrl;
    this.defaultModel = config.model || ollamaConfig.defaultModel;
    this.defaultParams = {
      ...ollamaConfig.defaultParams,
      ...config.params
    };
    this.timeout = config.timeout || ollamaConfig.timeout;
    this.retries = config.retries || ollamaConfig.retries;
    this.retryDelay = config.retryDelay || ollamaConfig.retryDelay;

    // Khởi tạo axios client
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Gửi yêu cầu tạo văn bản đến Ollama API
   * @param {string} prompt - Prompt đầu vào
   * @param {object} options - Các tùy chọn bổ sung
   * @returns {Promise<string>} - Văn bản được tạo
   */
  async generateText(prompt, options = {}) {
    const model = options.model || this.defaultModel;
    const params = {
      ...this.defaultParams,
      ...options,
      model,
      prompt
    };

    let attempts = 0;
    let lastError = null;

    while (attempts < this.retries) {
      try {
        logger.debug(`Gửi yêu cầu đến Ollama API (model: ${model})`);
        logger.debug(`Request URL: ${this.baseUrl}/api/generate`);
        try {
          logger.debug(`Request params:`, JSON.stringify(params, null, 2));
        } catch (e) {
          logger.debug(`Request params (stringify failed):`, params);
        }
        const response = await this.client.post('/api/generate', params);
        return response.data.response;
      } catch (error) {
        lastError = error;
        logger.error(`Lỗi khi gọi Ollama API (lần thử ${attempts + 1}/${this.retries}):`, error.message);
        if (error.response) {
          logger.error(`Response status: ${error.response.status}`);
          logger.error(`Response data:`, error.response.data);
        }
        attempts++;

        if (attempts < this.retries) {
          logger.debug(`Đợi ${this.retryDelay}ms trước khi thử lại...`);
          await delay(this.retryDelay);
        }
      }
    }

    throw new Error(`Không thể kết nối đến Ollama API sau ${this.retries} lần thử: ${lastError.message}`);
  }

  /**
   * Gửi yêu cầu chat đến Ollama API
   * @param {Array<object>} messages - Mảng các tin nhắn (format: [{role: 'user', content: 'Hello'}, ...])
   * @param {object} options - Các tùy chọn bổ sung
   * @returns {Promise<string>} - Phản hồi từ mô hình
   */
  async chat(messages, options = {}) {
    const model = options.model || this.defaultModel;
    const params = {
      ...this.defaultParams,
      ...options,
      model,
      messages
    };

    let attempts = 0;
    let lastError = null;

    while (attempts < this.retries) {
      try {
        logger.debug(`Gửi yêu cầu chat đến Ollama API (model: ${model})`);
        logger.debug(`Request URL: ${this.baseUrl}/api/chat`);
        try {
          logger.debug(`Request params:`, JSON.stringify(params, null, 2));
        } catch (e) {
          logger.debug(`Request params (stringify failed):`, params);
        }
        const response = await this.client.post('/api/chat', params);
        return response.data.message.content;
      } catch (error) {
        lastError = error;
        logger.error(`Lỗi khi gọi Ollama API chat (lần thử ${attempts + 1}/${this.retries}):`, error.message);
        if (error.response) {
          logger.error(`Response status: ${error.response.status}`);
          logger.error(`Response data:`, error.response.data);
        }
        attempts++;

        if (attempts < this.retries) {
          logger.debug(`Đợi ${this.retryDelay}ms trước khi thử lại...`);
          await delay(this.retryDelay);
        }
      }
    }

    throw new Error(`Không thể kết nối đến Ollama API chat sau ${this.retries} lần thử: ${lastError.message}`);
  }

  /**
   * Gửi yêu cầu chat đến Ollama API với streaming
   * @param {Array<object>} messages - Mảng các tin nhắn (format: [{role: 'user', content: 'Hello'}, ...])
   * @param {function} onChunk - Callback được gọi khi nhận được một phần của phản hồi
   * @param {object} options - Các tùy chọn bổ sung
   * @returns {Promise<string>} - Phản hồi đầy đủ từ mô hình
   */
  async chatStream(messages, onChunk, options = {}) {
    const model = options.model || this.defaultModel;
    const params = {
      ...this.defaultParams,
      ...options,
      model,
      messages,
      stream: true
    };

    let attempts = 0;
    let lastError = null;
    let fullResponse = '';

    while (attempts < this.retries) {
      try {
        logger.debug(`Gửi yêu cầu chat stream đến Ollama API (model: ${model})`);
        logger.debug(`Request URL: ${this.baseUrl}/api/chat`);
        try {
          logger.debug(`Request params:`, JSON.stringify(params, null, 2));
        } catch (e) {
          logger.debug(`Request params (stringify failed):`, params);
        }

        const response = await this.client({
          method: 'post',
          url: '/api/chat',
          data: params,
          responseType: 'stream'
        });

        return new Promise((resolve, reject) => {
          response.data.on('data', (chunk) => {
            try {
              const lines = chunk.toString().split('\n').filter(line => line.trim() !== '');

              for (const line of lines) {
                try {
                  const data = JSON.parse(line);

                  if (data.message && data.message.content) {
                    const content = data.message.content;
                    fullResponse += content;
                    onChunk(content, data.message.role || 'assistant');
                  }
                } catch (parseError) {
                  logger.error('Lỗi khi phân tích dữ liệu stream:', parseError.message);
                }
              }
            } catch (streamError) {
              logger.error('Lỗi khi xử lý stream:', streamError.message);
            }
          });

          response.data.on('end', () => {
            resolve(fullResponse);
          });

          response.data.on('error', (err) => {
            reject(err);
          });
        });
      } catch (error) {
        lastError = error;
        logger.error(`Lỗi khi gọi Ollama API chat stream (lần thử ${attempts + 1}/${this.retries}):`, error.message);
        if (error.response) {
          logger.error(`Response status: ${error.response.status}`);
          logger.error(`Response data:`, error.response.data);
        }
        attempts++;

        if (attempts < this.retries) {
          logger.debug(`Đợi ${this.retryDelay}ms trước khi thử lại...`);
          await delay(this.retryDelay);
        }
      }
    }

    throw new Error(`Không thể kết nối đến Ollama API chat stream sau ${this.retries} lần thử: ${lastError.message}`);
  }

  /**
   * Kiểm tra xem mô hình có sẵn không
   * @param {string} model - Tên mô hình cần kiểm tra
   * @returns {Promise<boolean>} - true nếu mô hình có sẵn
   */
  async isModelAvailable(model = this.defaultModel) {
    try {
      const response = await this.client.get('/api/tags');
      const models = response.data.models || [];
      return models.some(m => m.name === model);
    } catch (error) {
      logger.error(`Lỗi khi kiểm tra mô hình ${model}:`, error.message);
      return false;
    }
  }

  /**
   * Tải mô hình nếu chưa có sẵn
   * @param {string} model - Tên mô hình cần tải
   * @returns {Promise<boolean>} - true nếu tải thành công hoặc mô hình đã có sẵn
   */
  async ensureModelAvailable(model = this.defaultModel) {
    const isAvailable = await this.isModelAvailable(model);

    if (isAvailable) {
      logger.info(`Mô hình ${model} đã có sẵn`);
      return true;
    }

    logger.info(`Mô hình ${model} chưa có sẵn, đang tải...`);

    try {
      await this.client.post('/api/pull', { name: model });
      logger.info(`Đã tải mô hình ${model} thành công`);
      return true;
    } catch (error) {
      logger.error(`Lỗi khi tải mô hình ${model}:`, error.message);
      return false;
    }
  }

  /**
   * Test kết nối với Ollama server
   * @returns {Promise<boolean>} - true nếu kết nối thành công
   */
  async testConnection() {
    try {
      await this.client.get('/api/tags');
      logger.info('Kết nối đến Ollama server thành công');
      return true;
    } catch (error) {
      logger.error('Không thể kết nối đến Ollama server:', error.message);
      return false;
    }
  }
}

module.exports = OllamaClient;