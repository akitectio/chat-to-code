/**
 * Agent Business Analyst
 */

const logger = require('../utils/logger');
const OllamaClient = require('../utils/ollama-client');
const googleSearch = require('../utils/google-search');
const memory = require('../core/memory');
const config = require('../../config/default');
const { generateId } = require('../utils/helpers');

class BusinessAnalyst {
  constructor() {
    // Khởi tạo Ollama client
    this.client = new OllamaClient({
      model: config.agents.ba.model || config.ollama.agentModels.ba,
      params: { temperature: config.agents.ba.temperature }
    });
    
    // System prompt cho BA
    this.systemPrompt = config.agents.ba.systemPrompt;
  }
  
  /**
   * Phân tích yêu cầu từ người dùng
   * @param {string} userRequest - Yêu cầu từ người dùng
   * @param {string} projectId - ID của dự án
   * @returns {Promise<object>} - Kết quả phân tích
   */
  async analyzeRequirement(userRequest, projectId) {
    try {
      logger.info(`BA đang phân tích yêu cầu cho dự án ${projectId}`);
      
      // Chuẩn bị prompt
      const prompt = this.preparePrompt(userRequest, projectId);
      
      // Gọi Ollama API
      const response = await this.client.generateText(prompt);
      
      // Lưu phân tích vào bộ nhớ
      const analysisId = memory.addArtifact(projectId, 'requirement', 'Phân tích yêu cầu', response, {
        source: 'ba',
        timestamp: new Date()
      });
      
      // Kiểm tra xem có cần tìm kiếm thông tin bổ sung không
      const needsAdditionalInfo = this.checkNeedsAdditionalInfo(response);
      
      return {
        analysis: response,
        analysisId,
        needsAdditionalInfo
      };
    } catch (error) {
      logger.error('Lỗi khi phân tích yêu cầu:', error);
      throw error;
    }
  }
  
  /**
   * Phân tích yêu cầu với thông tin bổ sung từ tìm kiếm
   * @param {string} userRequest - Yêu cầu từ người dùng
   * @param {Array} searchResults - Kết quả tìm kiếm
   * @param {string} projectId - ID của dự án
   * @returns {Promise<object>} - Kết quả phân tích
   */
  async analyzeWithSearchResults(userRequest, searchResults, projectId) {
    try {
      logger.info(`BA đang phân tích yêu cầu với thông tin bổ sung cho dự án ${projectId}`);
      
      // Định dạng kết quả tìm kiếm
      let formattedResults = 'Kết quả tìm kiếm:\n\n';
      
      searchResults.forEach((result, index) => {
        formattedResults += `${index + 1}. ${result.title}\n`;
        formattedResults += `   URL: ${result.link}\n`;
        formattedResults += `   Mô tả: ${result.snippet || 'Không có mô tả'}\n`;
        
        if (result.extractedContent) {
          formattedResults += `   Nội dung trích xuất: ${result.extractedContent.substring(0, 300)}...\n`;
        }
        
        formattedResults += '\n';
      });
      
      // Chuẩn bị prompt với kết quả tìm kiếm
      const prompt = this.preparePrompt(userRequest, projectId, formattedResults);
      
      // Gọi Ollama API
      const response = await this.client.generateText(prompt);
      
      // Lưu phân tích vào bộ nhớ
      const analysisId = memory.addArtifact(projectId, 'requirement', 'Phân tích yêu cầu với thông tin bổ sung', response, {
        source: 'ba',
        timestamp: new Date(),
        hasSearchResults: true
      });
      
      return {
        analysis: response,
        analysisId,
        needsAdditionalInfo: false // Đã có thông tin bổ sung
      };
    } catch (error) {
      logger.error('Lỗi khi phân tích yêu cầu với thông tin bổ sung:', error);
      throw error;
    }
  }
  
  /**
   * Chuẩn bị prompt cho BA
   * @param {string} userRequest - Yêu cầu từ người dùng
   * @param {string} projectId - ID của dự án
   * @param {string} additionalInfo - Thông tin bổ sung (tùy chọn)
   * @returns {string} - Prompt đã chuẩn bị
   */
  preparePrompt(userRequest, projectId, additionalInfo = '') {
    const context = memory.getContext(projectId);
    const conversation = memory.getConversation(projectId);
    
    let prompt = `${this.systemPrompt}\n\n`;
    
    // Thêm thông tin về dự án
    prompt += `Thông tin dự án:\n`;
    prompt += `- Tên: ${context.name || 'Dự án mới'}\n`;
    prompt += `- ID: ${projectId}\n`;
    prompt += `- Ngày tạo: ${context.createdAt ? new Date(context.createdAt).toLocaleString() : 'Không xác định'}\n\n`;
    
    // Thêm tóm tắt dự án nếu có
    if (context.summary) {
      prompt += `Tóm tắt dự án:\n${context.summary}\n\n`;
    }
    
    // Thêm lịch sử cuộc hội thoại
    if (conversation && conversation.length > 0) {
      prompt += `Lịch sử cuộc hội thoại:\n`;
      
      conversation.forEach(msg => {
        const role = msg.role === 'user' ? 'Người dùng' : 
                    msg.role === 'ba' ? 'Business Analyst' : 
                    msg.role === 'dev' ? 'Developer' : 
                    msg.role === 'tester' ? 'Tester' : msg.role;
        
        prompt += `${role}: ${msg.content}\n\n`;
      });
    }
    
    // Thêm yêu cầu hiện tại
    prompt += `Yêu cầu hiện tại:\n${userRequest}\n\n`;
    
    // Thêm thông tin bổ sung nếu có
    if (additionalInfo) {
      prompt += `Thông tin bổ sung:\n${additionalInfo}\n\n`;
    }
    
    // Thêm hướng dẫn cho BA
    prompt += `Hãy phân tích yêu cầu trên và tạo ra một đặc tả chi tiết. Đặc tả nên bao gồm:\n`;
    prompt += `1. Tổng quan về yêu cầu\n`;
    prompt += `2. Các chức năng cần thiết\n`;
    prompt += `3. Các ràng buộc và yêu cầu phi chức năng\n`;
    prompt += `4. Các câu hỏi cần làm rõ (nếu có)\n`;
    prompt += `5. Đề xuất giải pháp\n\n`;
    
    prompt += `Nếu bạn cần thêm thông tin để phân tích, hãy nêu rõ những thông tin cần tìm kiếm thêm.`;
    
    return prompt;
  }
  
  /**
   * Kiểm tra xem có cần tìm kiếm thông tin bổ sung không
   * @param {string} analysis - Phân tích của BA
   * @returns {boolean} - true nếu cần tìm kiếm thông tin bổ sung
   */
  checkNeedsAdditionalInfo(analysis) {
    // Các từ khóa gợi ý cần tìm kiếm thêm thông tin
    const keywords = [
      'cần thêm thông tin',
      'cần tìm kiếm thêm',
      'không đủ thông tin',
      'cần nghiên cứu thêm',
      'tìm hiểu thêm',
      'tra cứu',
      'google',
      'tìm kiếm',
      'không rõ',
      'chưa đủ dữ liệu'
    ];
    
    const lowerAnalysis = analysis.toLowerCase();
    return keywords.some(keyword => lowerAnalysis.includes(keyword.toLowerCase()));
  }
  
  /**
   * Trích xuất truy vấn tìm kiếm từ phân tích
   * @param {string} analysis - Phân tích của BA
   * @returns {string} - Truy vấn tìm kiếm
   */
  extractSearchQuery(analysis) {
    // Tìm kiếm các cụm từ gợi ý truy vấn tìm kiếm
    const patterns = [
      /cần tìm kiếm thêm về[:\s]+(.*?)(?:\.|\n|$)/i,
      /cần thêm thông tin về[:\s]+(.*?)(?:\.|\n|$)/i,
      /tìm hiểu thêm về[:\s]+(.*?)(?:\.|\n|$)/i,
      /tra cứu[:\s]+(.*?)(?:\.|\n|$)/i,
      /google[:\s]+(.*?)(?:\.|\n|$)/i,
      /tìm kiếm[:\s]+(.*?)(?:\.|\n|$)/i
    ];
    
    for (const pattern of patterns) {
      const match = analysis.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    
    // Nếu không tìm thấy cụm từ cụ thể, trích xuất từ khóa chính từ phân tích
    const { extractKeywords } = require('../utils/helpers');
    const keywords = extractKeywords(analysis, 5);
    return keywords.join(' ');
  }
  
  /**
   * Tìm kiếm thông tin bổ sung
   * @param {string} query - Truy vấn tìm kiếm
   * @returns {Promise<Array>} - Kết quả tìm kiếm
   */
  async searchAdditionalInfo(query) {
    try {
      logger.info(`BA đang tìm kiếm thông tin bổ sung: "${query}"`);
      
      // Thực hiện tìm kiếm Google
      const searchResults = await googleSearch.search(query);
      
      return searchResults;
    } catch (error) {
      logger.error('Lỗi khi tìm kiếm thông tin bổ sung:', error);
      return [];
    }
  }
  
  /**
   * Tạo nhiệm vụ từ phân tích
   * @param {string} analysis - Phân tích của BA
   * @param {string} projectId - ID của dự án
   * @returns {Promise<Array>} - Danh sách nhiệm vụ
   */
  async createTasksFromAnalysis(analysis, projectId) {
    try {
      logger.info(`BA đang tạo nhiệm vụ từ phân tích cho dự án ${projectId}`);
      
      // Chuẩn bị prompt để tạo nhiệm vụ
      const prompt = `Dưới đây là phân tích yêu cầu:\n\n${analysis}\n\n`
        + `Hãy tạo danh sách các nhiệm vụ cần thực hiện dựa trên phân tích trên. `
        + `Mỗi nhiệm vụ nên có tiêu đề, mô tả, độ ưu tiên (thấp, trung bình, cao) và loại nhiệm vụ (tính năng, cải tiến, sửa lỗi).\n\n`
        + `Hãy trả về danh sách nhiệm vụ theo định dạng JSON như sau:\n`
        + `[\n`
        + `  {\n`
        + `    "title": "Tiêu đề nhiệm vụ",\n`
        + `    "description": "Mô tả chi tiết",\n`
        + `    "priority": "medium",\n`
        + `    "type": "feature"\n`
        + `  },\n`
        + `  ...\n`
        + `]`;
      
      // Gọi Ollama API
      const response = await this.client.generateText(prompt);
      
      // Trích xuất JSON từ phản hồi
      const jsonMatch = response.match(/\[\s*\{.*\}\s*\]/s);
      if (!jsonMatch) {
        logger.warn('Không thể trích xuất JSON từ phản hồi');
        return [];
      }
      
      try {
        const tasks = JSON.parse(jsonMatch[0]);
        
        // Thêm các nhiệm vụ vào bộ nhớ
        const Task = require('../models/task');
        const taskIds = [];
        
        for (const taskData of tasks) {
          const task = new Task({
            projectId,
            title: taskData.title,
            description: taskData.description,
            priority: taskData.priority,
            type: taskData.type,
            status: 'pending',
            assignedTo: 'dev' // Gán cho Developer
          });
          
          const taskId = memory.addArtifact(projectId, 'task', task.title, JSON.stringify(task), {
            source: 'ba',
            timestamp: new Date()
          });
          
          taskIds.push(taskId);
        }
        
        return taskIds;
      } catch (error) {
        logger.error('Lỗi khi phân tích JSON nhiệm vụ:', error);
        return [];
      }
    } catch (error) {
      logger.error('Lỗi khi tạo nhiệm vụ từ phân tích:', error);
      return [];
    }
  }
}

module.exports = new BusinessAnalyst();