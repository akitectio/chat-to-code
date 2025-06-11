/**
 * Cấu hình mặc định cho hệ thống
 */

const path = require('path');
const prompts = require('./prompts');

module.exports = {
  // Cấu hình server
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || 'localhost'
  },
  
  // Cấu hình logging
  logging: {
    level: process.env.LOG_LEVEL || 'debug',
    directory: path.join(process.cwd(), 'logs')
  },
   // Cấu hình Ollama
  ollama: {
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    defaultModel: process.env.OLLAMA_DEFAULT_MODEL || 'llama3.2:1b',
    defaultParams: {
      temperature: 0.7,
      top_p: 0.9,
      top_k: 40,
      repeat_penalty: 1.1,
      max_tokens: 2000
    },
    agentModels: {
      ba: process.env.OLLAMA_BA_MODEL || 'llama3.2:1b',
      dev: process.env.OLLAMA_DEV_MODEL || 'llama3.2:1b',
      tester: process.env.OLLAMA_TESTER_MODEL || 'llama3.2:1b'
    },
    timeout: 60000, // 60 giây
    retries: 3,
    retryDelay: 1000 // 1 giây
  },

  // Cấu hình agent
  agents: {
    ba: {
      model: process.env.OLLAMA_BA_MODEL || 'llama3.2:1b',
      temperature: 0.7,
      systemPrompt: prompts.ba.systemPrompt
    },
    dev: {
      model: process.env.OLLAMA_DEV_MODEL || 'llama3.2:1b',
      temperature: 0.5,
      systemPrompt: prompts.dev.systemPrompt
    },
    tester: {
      model: process.env.OLLAMA_TESTER_MODEL || 'llama3.2:1b',
      temperature: 0.3,
      systemPrompt: prompts.tester.systemPrompt
    }
  },
  
  // Cấu hình bộ nhớ
  memory: {
    directory: path.join(process.cwd(), 'data'),
    persistPath: path.join(process.cwd(), 'data'),
    maxConversationLength: 100,
    maxContextLength: 4000,
    maxMessages: 100,
    saveInterval: 60000 // 1 minute
  },
  
  // Cấu hình dự án
  project: {
    outputDir: path.join(process.cwd(), 'output')
  },
  
  // Cấu hình Google Search API
  googleSearch: {
    apiKey: process.env.GOOGLE_API_KEY,
    searchEngineId: process.env.GOOGLE_SEARCH_ENGINE_ID,
    maxResults: 5
  },
  
  // Cấu hình SerpApi
  serpApi: {
    apiKey: process.env.SERPAPI_API_KEY,
    maxResults: 5
  }
};