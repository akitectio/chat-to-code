/**
 * Agent Developer
 */

const logger = require('../utils/logger');
const OllamaClient = require('../utils/ollama-client');
const googleSearch = require('../utils/google-search');
const memory = require('../core/memory');
const config = require('../../config/default');
const { generateId, ensureDirExists } = require('../utils/helpers');
const fs = require('fs').promises;
const path = require('path');

class Developer {
  constructor() {
    // Khởi tạo Ollama client
    this.client = new OllamaClient({
      model: config.agents.dev.model || config.ollama.agentModels.dev,
      params: { temperature: config.agents.dev.temperature }
    });
    
    // System prompt cho Developer
    this.systemPrompt = config.agents.dev.systemPrompt;
  }
  
  /**
   * Phát triển code dựa trên nhiệm vụ
   * @param {object} task - Nhiệm vụ cần thực hiện
   * @param {string} projectId - ID của dự án
   * @param {string} analysis - Phân tích từ BA
   * @returns {Promise<object>} - Kết quả phát triển
   */
  async developCode(task, projectId, analysis) {
    try {
      logger.info(`Developer đang phát triển code cho nhiệm vụ ${task.id} trong dự án ${projectId}`);
      
      // Chuẩn bị prompt
      const prompt = this.preparePrompt(task, projectId, analysis);
      
      // Gọi Ollama API
      const response = await this.client.generateText(prompt);
      
      // Trích xuất code từ phản hồi
      const codeFiles = this.extractCodeFiles(response);
      
      // Lưu code vào bộ nhớ và tạo file
      const artifacts = await this.saveCodeFiles(codeFiles, projectId, task.id);
      
      // Cập nhật trạng thái nhiệm vụ
      task.status = 'completed';
      task.updatedAt = new Date();
      task.completedAt = new Date();
      
      // Lưu nhiệm vụ đã cập nhật
      memory.updateArtifact(projectId, task.id, JSON.stringify(task));
      
      return {
        code: response,
        artifacts,
        needsAdditionalInfo: this.checkNeedsAdditionalInfo(response)
      };
    } catch (error) {
      logger.error(`Lỗi khi phát triển code cho nhiệm vụ ${task.id}:`, error);
      throw error;
    }
  }
  
  /**
   * Phát triển code với thông tin bổ sung từ tìm kiếm
   * @param {object} task - Nhiệm vụ cần thực hiện
   * @param {string} projectId - ID của dự án
   * @param {string} analysis - Phân tích từ BA
   * @param {Array} searchResults - Kết quả tìm kiếm
   * @returns {Promise<object>} - Kết quả phát triển
   */
  async developWithSearchResults(task, projectId, analysis, searchResults) {
    try {
      logger.info(`Developer đang phát triển code với thông tin bổ sung cho nhiệm vụ ${task.id}`);
      
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
      const prompt = this.preparePrompt(task, projectId, analysis, formattedResults);
      
      // Gọi Ollama API
      const response = await this.client.generateText(prompt);
      
      // Trích xuất code từ phản hồi
      const codeFiles = this.extractCodeFiles(response);
      
      // Lưu code vào bộ nhớ và tạo file
      const artifacts = await this.saveCodeFiles(codeFiles, projectId, task.id);
      
      // Cập nhật trạng thái nhiệm vụ
      task.status = 'completed';
      task.updatedAt = new Date();
      task.completedAt = new Date();
      
      // Lưu nhiệm vụ đã cập nhật
      memory.updateArtifact(projectId, task.id, JSON.stringify(task));
      
      return {
        code: response,
        artifacts,
        needsAdditionalInfo: false // Đã có thông tin bổ sung
      };
    } catch (error) {
      logger.error(`Lỗi khi phát triển code với thông tin bổ sung cho nhiệm vụ ${task.id}:`, error);
      throw error;
    }
  }
  
  /**
   * Chuẩn bị prompt cho Developer
   * @param {object} task - Nhiệm vụ cần thực hiện
   * @param {string} projectId - ID của dự án
   * @param {string} analysis - Phân tích từ BA
   * @param {string} additionalInfo - Thông tin bổ sung (tùy chọn)
   * @returns {string} - Prompt đã chuẩn bị
   */
  preparePrompt(task, projectId, analysis, additionalInfo = '') {
    const context = memory.getContext(projectId);
    const conversation = memory.getConversation(projectId);
    const artifacts = memory.getArtifacts(projectId);
    
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
    
    // Thêm phân tích từ BA
    prompt += `Phân tích yêu cầu từ Business Analyst:\n${analysis}\n\n`;
    
    // Thêm thông tin về nhiệm vụ
    prompt += `Nhiệm vụ cần thực hiện:\n`;
    prompt += `- ID: ${task.id}\n`;
    prompt += `- Tiêu đề: ${task.title}\n`;
    prompt += `- Mô tả: ${task.description}\n`;
    prompt += `- Loại: ${task.type}\n`;
    prompt += `- Độ ưu tiên: ${task.priority}\n\n`;
    
    // Thêm code đã có nếu có
    const codeArtifacts = artifacts.filter(art => 
      art.type === 'code' && art.metadata && art.metadata.taskId === task.id
    );
    
    if (codeArtifacts.length > 0) {
      prompt += `Code đã có:\n`;
      
      codeArtifacts.forEach(art => {
        prompt += `File: ${art.metadata.fileName}\n`;
        prompt += '```\n';
        prompt += art.content;
        prompt += '\n```\n\n';
      });
    }
    
    // Thêm thông tin bổ sung nếu có
    if (additionalInfo) {
      prompt += `Thông tin bổ sung:\n${additionalInfo}\n\n`;
    }
    
    // Thêm hướng dẫn cho Developer
    prompt += `Hãy phát triển code cho nhiệm vụ trên. Đối với mỗi file code, hãy sử dụng định dạng sau:\n`;
    prompt += '```file:đường_dẫn_file\n';
    prompt += 'nội dung file\n';
    prompt += '```\n\n';
    
    prompt += `Ví dụ:\n`;
    prompt += '```file:src/components/Button.js\n';
    prompt += 'import React from \'react\';\n\n';
    prompt += 'const Button = ({ text }) => {\n';
    prompt += '  return <button>{text}</button>;\n';
    prompt += '};\n\n';
    prompt += 'export default Button;\n';
    prompt += '```\n\n';
    
    prompt += `Hãy đảm bảo code đầy đủ, có thể chạy được và tuân thủ các tiêu chuẩn phát triển. `;
    prompt += `Nếu bạn cần thêm thông tin để phát triển, hãy nêu rõ những thông tin cần tìm kiếm thêm.`;
    
    return prompt;
  }
  
  /**
   * Kiểm tra xem có cần tìm kiếm thông tin bổ sung không
   * @param {string} response - Phản hồi của Developer
   * @returns {boolean} - true nếu cần tìm kiếm thông tin bổ sung
   */
  checkNeedsAdditionalInfo(response) {
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
    
    const lowerResponse = response.toLowerCase();
    return keywords.some(keyword => lowerResponse.includes(keyword.toLowerCase()));
  }
  
  /**
   * Trích xuất truy vấn tìm kiếm từ phản hồi
   * @param {string} response - Phản hồi của Developer
   * @returns {string} - Truy vấn tìm kiếm
   */
  extractSearchQuery(response) {
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
      const match = response.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    
    // Nếu không tìm thấy cụm từ cụ thể, trích xuất từ khóa chính từ phản hồi
    const { extractKeywords } = require('../utils/helpers');
    const keywords = extractKeywords(response, 5);
    return keywords.join(' ');
  }
  
  /**
   * Tìm kiếm thông tin bổ sung
   * @param {string} query - Truy vấn tìm kiếm
   * @returns {Promise<Array>} - Kết quả tìm kiếm
   */
  async searchAdditionalInfo(query) {
    try {
      logger.info(`Developer đang tìm kiếm thông tin bổ sung: "${query}"`);
      
      // Thực hiện tìm kiếm Google
      const searchResults = await googleSearch.search(query);
      
      return searchResults;
    } catch (error) {
      logger.error('Lỗi khi tìm kiếm thông tin bổ sung:', error);
      return [];
    }
  }
  
  /**
   * Trích xuất các file code từ phản hồi
   * @param {string} response - Phản hồi của Developer
   * @returns {Array} - Danh sách các file code
   */
  extractCodeFiles(response) {
    const codeFilePattern = /```file:([^\n]+)\n([\s\S]*?)```/g;
    const codeFiles = [];
    let match;
    
    while ((match = codeFilePattern.exec(response)) !== null) {
      const filePath = match[1].trim();
      const fileContent = match[2];
      
      codeFiles.push({
        filePath,
        content: fileContent
      });
    }
    
    return codeFiles;
  }
  
  /**
   * Lưu các file code vào bộ nhớ và tạo file
   * @param {Array} codeFiles - Danh sách các file code
   * @param {string} projectId - ID của dự án
   * @param {string} taskId - ID của nhiệm vụ
   * @returns {Promise<Array>} - Danh sách các artifact ID
   */
  async saveCodeFiles(codeFiles, projectId, taskId) {
    const artifactIds = [];
    
    for (const file of codeFiles) {
      try {
        // Lưu vào bộ nhớ
        const artifactId = memory.addArtifact(projectId, 'code', file.filePath, file.content, {
          source: 'dev',
          timestamp: new Date(),
          fileName: file.filePath,
          taskId
        });
        
        artifactIds.push(artifactId);
        
        // Tạo file thực tế
        const outputDir = path.join(config.project.outputDir, projectId);
        const outputPath = path.join(outputDir, file.filePath);
        
        // Đảm bảo thư mục tồn tại
        await ensureDirExists(path.dirname(outputPath));
        
        // Ghi file
        await fs.writeFile(outputPath, file.content);
        
        logger.info(`Đã tạo file: ${outputPath}`);
      } catch (error) {
        logger.error(`Lỗi khi lưu file ${file.filePath}:`, error);
      }
    }
    
    return artifactIds;
  }
  
  /**
   * Sửa đổi code dựa trên phản hồi từ Tester
   * @param {object} task - Nhiệm vụ cần sửa đổi
   * @param {string} projectId - ID của dự án
   * @param {object} test - Kết quả kiểm thử
   * @returns {Promise<object>} - Kết quả sửa đổi
   */
  async reviseCode(task, projectId, test) {
    try {
      logger.info(`Developer đang sửa đổi code cho nhiệm vụ ${task.id} dựa trên phản hồi từ Tester`);
      
      // Lấy code hiện tại
      const artifacts = memory.getArtifacts(projectId);
      const codeArtifacts = artifacts.filter(art => 
        art.type === 'code' && art.metadata && art.metadata.taskId === task.id
      );
      
      // Chuẩn bị prompt
      const prompt = this.prepareRevisionPrompt(task, projectId, test, codeArtifacts);
      
      // Gọi Ollama API
      const response = await this.client.generateText(prompt);
      
      // Trích xuất code từ phản hồi
      const codeFiles = this.extractCodeFiles(response);
      
      // Lưu code vào bộ nhớ và tạo file
      const newArtifacts = await this.saveCodeFiles(codeFiles, projectId, task.id);
      
      // Cập nhật trạng thái nhiệm vụ
      task.status = 'revised';
      task.updatedAt = new Date();
      
      // Lưu nhiệm vụ đã cập nhật
      memory.updateArtifact(projectId, task.id, JSON.stringify(task));
      
      return {
        code: response,
        artifacts: newArtifacts
      };
    } catch (error) {
      logger.error(`Lỗi khi sửa đổi code cho nhiệm vụ ${task.id}:`, error);
      throw error;
    }
  }
  
  /**
   * Chuẩn bị prompt cho việc sửa đổi code
   * @param {object} task - Nhiệm vụ cần sửa đổi
   * @param {string} projectId - ID của dự án
   * @param {object} test - Kết quả kiểm thử
   * @param {Array} codeArtifacts - Các artifact code hiện tại
   * @returns {string} - Prompt đã chuẩn bị
   */
  prepareRevisionPrompt(task, projectId, test, codeArtifacts) {
    let prompt = `${this.systemPrompt}\n\n`;
    
    // Thêm thông tin về nhiệm vụ
    prompt += `Nhiệm vụ cần sửa đổi:\n`;
    prompt += `- ID: ${task.id}\n`;
    prompt += `- Tiêu đề: ${task.title}\n`;
    prompt += `- Mô tả: ${task.description}\n\n`;
    
    // Thêm kết quả kiểm thử
    prompt += `Kết quả kiểm thử:\n`;
    prompt += `- Tiêu đề: ${test.title}\n`;
    prompt += `- Mô tả: ${test.description}\n`;
    prompt += `- Trạng thái: ${test.status}\n`;
    
    if (test.steps && test.steps.length > 0) {
      prompt += `- Các bước kiểm thử:\n`;
      
      test.steps.forEach((step, index) => {
        prompt += `  ${index + 1}. ${step.description}\n`;
        prompt += `     Kết quả mong đợi: ${step.expectedResult}\n`;
        prompt += `     Kết quả thực tế: ${step.actualResult || 'Không có'}\n`;
        prompt += `     Trạng thái: ${step.status}\n`;
      });
    }
    
    if (test.actualResults) {
      prompt += `- Kết quả thực tế: ${test.actualResults}\n`;
    }
    
    prompt += '\n';
    
    // Thêm code hiện tại
    if (codeArtifacts.length > 0) {
      prompt += `Code hiện tại cần sửa đổi:\n`;
      
      codeArtifacts.forEach(art => {
        prompt += `File: ${art.metadata.fileName}\n`;
        prompt += '```\n';
        prompt += art.content;
        prompt += '\n```\n\n';
      });
    }
    
    // Thêm hướng dẫn cho Developer
    prompt += `Hãy sửa đổi code để khắc phục các vấn đề được phát hiện trong kiểm thử. `;
    prompt += `Đối với mỗi file code đã sửa đổi, hãy sử dụng định dạng sau:\n`;
    prompt += '```file:đường_dẫn_file\n';
    prompt += 'nội dung file đã sửa đổi\n';
    prompt += '```\n\n';
    
    prompt += `Hãy giải thích ngắn gọn các thay đổi bạn đã thực hiện để khắc phục vấn đề.`;
    
    return prompt;
  }
}

module.exports = new Developer();