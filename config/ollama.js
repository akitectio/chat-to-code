/**
 * Cấu hình cho Ollama API
 */

require('dotenv').config();

module.exports = {
  baseUrl: "http://localhost:11434",
  defaultModel: "llama3.2:1b",

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
    ba: "llama3.2:1b",
    dev: "llama3.2:1b",
    tester: "llama3.2:1b"
  },

  // Timeout cho API calls (ms)
  timeout: 120000,

  // Số lần thử lại khi gặp lỗi
  retries: 3,

  // Thời gian chờ giữa các lần thử lại (ms)
  retryDelay: 1000
};