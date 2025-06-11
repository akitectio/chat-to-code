/**
 * Cấu hình cho Ollama API
 */

require('dotenv').config();

module.exports = {
  baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  defaultModel: process.env.OLLAMA_DEFAULT_MODEL || 'phi3:mini',

  // Các tham số mặc định cho API gọi
  defaultParams: {
    temperature: 0.7,
    top_p: 0.9,
    top_k: 40,
    repeat_penalty: 1.1,
    max_tokens: 2000,
  },

  // Cấu hình cho từng agent
  agentModels: {
    ba: process.env.OLLAMA_BA_MODEL || process.env.OLLAMA_DEFAULT_MODEL || 'phi3:mini',
    dev: process.env.OLLAMA_DEV_MODEL || process.env.OLLAMA_DEFAULT_MODEL || 'phi3:mini',
    tester: process.env.OLLAMA_TESTER_MODEL || process.env.OLLAMA_DEFAULT_MODEL || 'phi3:mini'
  },

  // Timeout cho API calls (ms)
  timeout: 1200000000,

  // Số lần thử lại khi gặp lỗi
  retries: 3,

  // Thời gian chờ giữa các lần thử lại (ms)
  retryDelay: 1000
};