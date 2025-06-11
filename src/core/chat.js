/**
 * Xử lý giao tiếp giữa các agent
 */

const logger = require('../utils/logger');
const memory = require('./memory');
const OllamaClient = require('../utils/ollama-client');
const googleSearch = require('../utils/google-search');
const config = require('../../config/default');

class ChatManager {
  constructor() {
    // Khởi tạo các client cho từng agent
    this.clients = {
      ba: new OllamaClient({
        model: config.agents.ba.model || config.ollama.agentModels.ba,
        params: { temperature: config.agents.ba.temperature }
      }),
      dev: new OllamaClient({
        model: config.agents.dev.model || config.ollama.agentModels.dev,
        params: { temperature: config.agents.dev.temperature }
      }),
      tester: new OllamaClient({
        model: config.agents.tester.model || config.ollama.agentModels.tester,
        params: { temperature: config.agents.tester.temperature }
      })
    };
  }
  
  /**
   * Chuẩn bị prompt cho agent
   * @param {string} role - Vai trò của agent (ba, dev, tester)
   * @param {string} projectId - ID của dự án
   * @param {string} input - Đầu vào từ người dùng hoặc agent khác
   * @returns {string} - Prompt đã chuẩn bị
   */
  preparePrompt(role, projectId, input) {
    const conversation = memory.getConversation(projectId);
    const context = memory.getContext(projectId);
    
    // Lấy system prompt cho agent
    const systemPrompt = config.agents[role].systemPrompt;
    
    // Xây dựng prompt với ngữ cảnh và lịch sử
    let prompt = `${systemPrompt}\n\n`;
    
    // Thêm thông tin về dự án
    prompt += `Thông tin dự án:\n`;
    prompt += `- Tên: ${context.name || 'Chưa đặt tên'}\n`;
    prompt += `- Ngày tạo: ${context.createdAt ? new Date(context.createdAt).toLocaleString() : 'Không xác định'}\n`;
    
    // Thêm tóm tắt dự án nếu có
    if (context.summary) {
      prompt += `\nTóm tắt dự án:\n${context.summary}\n\n`;
    }
    
    // Thêm lịch sử cuộc hội thoại
    prompt += `\nLịch sử cuộc hội thoại:\n`;
    conversation.forEach(msg => {
      const roleName = this.getRoleName(msg.role);
      prompt += `${roleName}: ${msg.content}\n\n`;
    });
    
    // Thêm đầu vào hiện tại
    prompt += `\nĐầu vào hiện tại:\n${input}\n\n`;
    
    // Thêm hướng dẫn cho agent
    prompt += `\nBạn là ${this.getRoleName(role)}. Hãy phản hồi dựa trên vai trò của bạn.`;
    
    return prompt;
  }
  
  /**
   * Chuẩn bị tin nhắn cho chat API
   * @param {string} role - Vai trò của agent (ba, dev, tester)
   * @param {string} projectId - ID của dự án
   * @param {string} input - Đầu vào từ người dùng hoặc agent khác
   * @returns {Array} - Mảng tin nhắn cho chat API
   */
  prepareMessages(role, projectId, input) {
    const conversation = memory.getConversation(projectId);
    const context = memory.getContext(projectId);
    
    // Lấy system prompt cho agent
    const systemPrompt = config.agents[role].systemPrompt;
    
    // Tạo tin nhắn system
    const messages = [
      {
        role: 'system',
        content: systemPrompt
      }
    ];
    
    // Thêm thông tin về dự án
    let projectInfo = `Thông tin dự án:\n`;
    projectInfo += `- Tên: ${context.name || 'Chưa đặt tên'}\n`;
    projectInfo += `- Ngày tạo: ${context.createdAt ? new Date(context.createdAt).toLocaleString() : 'Không xác định'}\n`;
    
    // Thêm tóm tắt dự án nếu có
    if (context.summary) {
      projectInfo += `\nTóm tắt dự án:\n${context.summary}\n\n`;
    }
    
    messages.push({
      role: 'system',
      content: projectInfo
    });
    
    // Chuyển đổi lịch sử cuộc hội thoại thành định dạng tin nhắn
    conversation.forEach(msg => {
      let messageRole = 'user';
      if (msg.role === role) {
        messageRole = 'assistant';
      } else if (msg.role !== 'user') {
        // Đối với tin nhắn từ các agent khác, thêm tiền tố để phân biệt
        messageRole = 'user';
        msg.content = `[${this.getRoleName(msg.role)}] ${msg.content}`;
      }
      
      messages.push({
        role: messageRole,
        content: msg.content
      });
    });
    
    // Thêm đầu vào hiện tại
    messages.push({
      role: 'user',
      content: input
    });
    
    return messages;
  }
  
  /**
   * Lấy tên hiển thị của vai trò
   * @param {string} role - Vai trò (user, ba, dev, tester)
   * @returns {string} - Tên hiển thị
   */
  getRoleName(role) {
    const roleNames = {
      user: 'Người dùng',
      ba: 'Business Analyst',
      dev: 'Developer',
      tester: 'Tester'
    };
    
    return roleNames[role] || role;
  }
  
  /**
   * Gửi tin nhắn đến agent và nhận phản hồi
   * @param {string} role - Vai trò của agent (ba, dev, tester)
   * @param {string} projectId - ID của dự án
   * @param {string} input - Đầu vào từ người dùng hoặc agent khác
   * @param {function} onChunk - Callback được gọi khi nhận được một phần của phản hồi (optional)
   * @returns {Promise<string>} - Phản hồi từ agent
   */
  async sendToAgent(role, projectId, input, onChunk = null) {
    try {
      logger.info(`Gửi tin nhắn đến ${this.getRoleName(role)}`);
      
      // Chuẩn bị tin nhắn cho chat API
      const messages = this.prepareMessages(role, projectId, input);
      
      // Nếu có callback onChunk, sử dụng streaming
      if (onChunk) {
        // Tạo một wrapper cho callback để thêm thông tin về agent
        const onChunkWithAgent = (chunk, chunkRole) => {
          onChunk(chunk, role, projectId);
        };
        
        // Gọi API chat với streaming
        const response = await this.clients[role].chatStream(messages, onChunkWithAgent);
        
        // Lưu tin nhắn đầy đủ vào bộ nhớ
        memory.addMessage(projectId, role, response);
        
        return response;
      } else {
        // Gọi API chat thông thường nếu không có callback
        const response = await this.clients[role].chat(messages);
        
        // Lưu tin nhắn vào bộ nhớ
        memory.addMessage(projectId, role, response);
        
        return response;
      }
    } catch (error) {
      logger.error(`Lỗi khi gửi tin nhắn đến ${this.getRoleName(role)}:`, error);
      
      // Thử lại với phương thức generateText nếu chat API không hoạt động
      try {
        const prompt = this.preparePrompt(role, projectId, input);
        const response = await this.clients[role].generateText(prompt);
        
        // Lưu tin nhắn vào bộ nhớ
        memory.addMessage(projectId, role, response);
        
        return response;
      } catch (fallbackError) {
        logger.error(`Lỗi khi thử lại với generateText:`, fallbackError);
        throw new Error(`Không thể giao tiếp với ${this.getRoleName(role)}: ${error.message}`);
      }
    }
  }
  
  /**
   * Tìm kiếm thông tin bổ sung khi cần thiết
   * @param {string} query - Truy vấn tìm kiếm
   * @param {object} options - Tùy chọn tìm kiếm
   * @returns {Promise<Array>} - Kết quả tìm kiếm
   */
  async searchAdditionalInfo(query, options = {}) {
    try {
      logger.info(`Tìm kiếm thông tin bổ sung: "${query}"`);
      
      // Thực hiện tìm kiếm Google
      const searchResults = await googleSearch.search(query, options);
      
      // Nếu không có kết quả, trả về mảng rỗng
      if (!searchResults || searchResults.length === 0) {
        logger.info('Không tìm thấy kết quả');
        return [];
      }
      
      // Trích xuất nội dung từ các kết quả hàng đầu (tối đa 3)
      const topResults = searchResults.slice(0, 3);
      const enrichedResults = [];
      
      for (const result of topResults) {
        try {
          // Trích xuất nội dung từ URL
          const content = await googleSearch.extractContent(result.link);
          
          enrichedResults.push({
            ...result,
            extractedContent: content
          });
        } catch (error) {
          logger.error(`Lỗi khi trích xuất nội dung từ ${result.link}:`, error.message);
          enrichedResults.push(result); // Vẫn thêm kết quả mà không có nội dung trích xuất
        }
      }
      
      return enrichedResults;
    } catch (error) {
      logger.error('Lỗi khi tìm kiếm thông tin bổ sung:', error.message);
      return [];
    }
  }
  
  /**
   * Định dạng kết quả tìm kiếm thành văn bản
   * @param {Array} searchResults - Kết quả tìm kiếm
   * @returns {string} - Văn bản đã định dạng
   */
  formatSearchResults(searchResults) {
    if (!searchResults || searchResults.length === 0) {
      return 'Không tìm thấy kết quả tìm kiếm.';
    }
    
    let formatted = '### Kết quả tìm kiếm:\n\n';
    
    searchResults.forEach((result, index) => {
      formatted += `#### ${index + 1}. ${result.title}\n`;
      formatted += `- URL: ${result.link}\n`;
      formatted += `- Mô tả: ${result.snippet || 'Không có mô tả'}\n`;
      
      if (result.extractedContent) {
        // Giới hạn độ dài nội dung trích xuất
        const truncatedContent = result.extractedContent.length > 500
          ? result.extractedContent.substring(0, 500) + '...'
          : result.extractedContent;
        
        formatted += `- Nội dung trích xuất: ${truncatedContent}\n`;
      }
      
      formatted += '\n';
    });
    
    return formatted;
  }
}

module.exports = new ChatManager();