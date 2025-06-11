/**
 * Agent Tester
 */

const logger = require('../utils/logger');
const OllamaClient = require('../utils/ollama-client');
const memory = require('../core/memory');
const config = require('../../config/default');
const { generateId } = require('../utils/helpers');
const fs = require('fs').promises;
const path = require('path');

class Tester {
  constructor() {
    // Khởi tạo Ollama client
    this.client = new OllamaClient({
      model: config.agents.tester.model || config.ollama.agentModels.tester,
      params: { temperature: config.agents.tester.temperature }
    });
    
    // System prompt cho Tester
    this.systemPrompt = config.agents.tester.systemPrompt;
  }
  
  /**
   * Tạo kế hoạch kiểm thử dựa trên phân tích và nhiệm vụ
   * @param {string} projectId - ID của dự án
   * @param {object} task - Nhiệm vụ cần kiểm thử
   * @param {string} analysis - Phân tích từ BA
   * @returns {Promise<object>} - Kế hoạch kiểm thử
   */
  async createTestPlan(projectId, task, analysis) {
    try {
      logger.info(`Tester đang tạo kế hoạch kiểm thử cho nhiệm vụ ${task.id} trong dự án ${projectId}`);
      
      // Chuẩn bị prompt
      const prompt = this.prepareTestPlanPrompt(projectId, task, analysis);
      
      // Gọi Ollama API
      const response = await this.client.generateText(prompt);
      
      // Trích xuất kế hoạch kiểm thử từ phản hồi
      const testPlan = this.extractTestPlan(response);
      
      // Lưu kế hoạch kiểm thử vào bộ nhớ
      const testPlanId = memory.addArtifact(projectId, 'test_plan', `Kế hoạch kiểm thử cho ${task.title}`, JSON.stringify(testPlan), {
        source: 'tester',
        timestamp: new Date(),
        taskId: task.id
      });
      
      return {
        testPlan,
        testPlanId
      };
    } catch (error) {
      logger.error(`Lỗi khi tạo kế hoạch kiểm thử cho nhiệm vụ ${task.id}:`, error);
      throw error;
    }
  }
  
  /**
   * Chuẩn bị prompt cho việc tạo kế hoạch kiểm thử
   * @param {string} projectId - ID của dự án
   * @param {object} task - Nhiệm vụ cần kiểm thử
   * @param {string} analysis - Phân tích từ BA
   * @returns {string} - Prompt đã chuẩn bị
   */
  prepareTestPlanPrompt(projectId, task, analysis) {
    const context = memory.getContext(projectId);
    
    let prompt = `${this.systemPrompt}\n\n`;
    
    // Thêm thông tin về dự án
    prompt += `Thông tin dự án:\n`;
    prompt += `- Tên: ${context.name || 'Dự án mới'}\n`;
    prompt += `- ID: ${projectId}\n\n`;
    
    // Thêm phân tích từ BA
    prompt += `Phân tích yêu cầu từ Business Analyst:\n${analysis}\n\n`;
    
    // Thêm thông tin về nhiệm vụ
    prompt += `Nhiệm vụ cần kiểm thử:\n`;
    prompt += `- ID: ${task.id}\n`;
    prompt += `- Tiêu đề: ${task.title}\n`;
    prompt += `- Mô tả: ${task.description}\n`;
    prompt += `- Loại: ${task.type}\n`;
    prompt += `- Độ ưu tiên: ${task.priority}\n\n`;
    
    // Thêm hướng dẫn cho Tester
    prompt += `Hãy tạo một kế hoạch kiểm thử cho nhiệm vụ trên. Kế hoạch kiểm thử nên bao gồm:\n`;
    prompt += `1. Tổng quan về phương pháp kiểm thử\n`;
    prompt += `2. Các trường hợp kiểm thử (test cases)\n`;
    prompt += `3. Các bước kiểm thử chi tiết cho mỗi trường hợp\n`;
    prompt += `4. Kết quả mong đợi cho mỗi bước\n\n`;
    
    prompt += `Hãy trả về kế hoạch kiểm thử theo định dạng JSON như sau:\n`;
    prompt += `{\n`;
    prompt += `  "title": "Kế hoạch kiểm thử cho [Tên nhiệm vụ]",\n`;
    prompt += `  "overview": "Tổng quan về phương pháp kiểm thử",\n`;
    prompt += `  "testCases": [\n`;
    prompt += `    {\n`;
    prompt += `      "id": "TC001",\n`;
    prompt += `      "title": "Tiêu đề trường hợp kiểm thử",\n`;
    prompt += `      "description": "Mô tả trường hợp kiểm thử",\n`;
    prompt += `      "priority": "high",\n`;
    prompt += `      "steps": [\n`;
    prompt += `        {\n`;
    prompt += `          "id": 1,\n`;
    prompt += `          "description": "Mô tả bước kiểm thử",\n`;
    prompt += `          "expectedResult": "Kết quả mong đợi"\n`;
    prompt += `        }\n`;
    prompt += `      ]\n`;
    prompt += `    }\n`;
    prompt += `  ]\n`;
    prompt += `}\n`;
    
    return prompt;
  }
  
  /**
   * Trích xuất kế hoạch kiểm thử từ phản hồi
   * @param {string} response - Phản hồi từ Ollama API
   * @returns {object} - Kế hoạch kiểm thử
   */
  extractTestPlan(response) {
    try {
      // Tìm JSON trong phản hồi
      const jsonMatch = response.match(/\{[\s\S]*\}/m);
      
      if (jsonMatch) {
        const testPlan = JSON.parse(jsonMatch[0]);
        return testPlan;
      }
      
      // Nếu không tìm thấy JSON, tạo kế hoạch kiểm thử mặc định
      logger.warn('Không thể trích xuất kế hoạch kiểm thử từ phản hồi, sử dụng mặc định');
      
      return {
        title: 'Kế hoạch kiểm thử mặc định',
        overview: 'Không thể trích xuất kế hoạch kiểm thử từ phản hồi',
        testCases: []
      };
    } catch (error) {
      logger.error('Lỗi khi trích xuất kế hoạch kiểm thử:', error);
      
      return {
        title: 'Kế hoạch kiểm thử mặc định',
        overview: 'Lỗi khi trích xuất kế hoạch kiểm thử',
        testCases: []
      };
    }
  }
  
  /**
   * Thực hiện kiểm thử dựa trên code đã phát triển
   * @param {string} projectId - ID của dự án
   * @param {object} task - Nhiệm vụ cần kiểm thử
   * @param {object} testPlan - Kế hoạch kiểm thử
   * @returns {Promise<object>} - Kết quả kiểm thử
   */
  async executeTests(projectId, task, testPlan) {
    try {
      logger.info(`Tester đang thực hiện kiểm thử cho nhiệm vụ ${task.id} trong dự án ${projectId}`);
      
      // Lấy code đã phát triển
      const artifacts = memory.getArtifacts(projectId);
      const codeArtifacts = artifacts.filter(art => 
        art.type === 'code' && art.metadata && art.metadata.taskId === task.id
      );
      
      // Chuẩn bị prompt
      const prompt = this.prepareTestExecutionPrompt(projectId, task, testPlan, codeArtifacts);
      
      // Gọi Ollama API
      const response = await this.client.generateText(prompt);
      
      // Trích xuất kết quả kiểm thử từ phản hồi
      const testResults = this.extractTestResults(response, testPlan);
      
      // Lưu kết quả kiểm thử vào bộ nhớ
      const testResultId = memory.addArtifact(projectId, 'test_result', `Kết quả kiểm thử cho ${task.title}`, JSON.stringify(testResults), {
        source: 'tester',
        timestamp: new Date(),
        taskId: task.id
      });
      
      // Tạo đối tượng Test
      const Test = require('../models/test');
      const test = new Test({
        projectId,
        taskId: task.id,
        title: testResults.title,
        description: testResults.overview,
        type: 'functional',
        status: testResults.passed ? 'passed' : 'failed',
        priority: task.priority,
        steps: testResults.testCases.flatMap(tc => tc.steps.map(step => ({
          description: step.description,
          expectedResult: step.expectedResult,
          actualResult: step.actualResult,
          status: step.passed ? 'passed' : 'failed'
        }))),
        expectedResults: 'Xem chi tiết trong các bước kiểm thử',
        actualResults: testResults.summary,
        executedAt: new Date(),
        executedBy: 'tester',
        automated: false
      });
      
      // Lưu test vào bộ nhớ
      const testId = memory.addArtifact(projectId, 'test', test.title, JSON.stringify(test), {
        source: 'tester',
        timestamp: new Date(),
        taskId: task.id
      });
      
      return {
        test,
        testId,
        passed: testResults.passed
      };
    } catch (error) {
      logger.error(`Lỗi khi thực hiện kiểm thử cho nhiệm vụ ${task.id}:`, error);
      throw error;
    }
  }
  
  /**
   * Chuẩn bị prompt cho việc thực hiện kiểm thử
   * @param {string} projectId - ID của dự án
   * @param {object} task - Nhiệm vụ cần kiểm thử
   * @param {object} testPlan - Kế hoạch kiểm thử
   * @param {Array} codeArtifacts - Các artifact code
   * @returns {string} - Prompt đã chuẩn bị
   */
  prepareTestExecutionPrompt(projectId, task, testPlan, codeArtifacts) {
    let prompt = `${this.systemPrompt}\n\n`;
    
    // Thêm thông tin về nhiệm vụ
    prompt += `Nhiệm vụ cần kiểm thử:\n`;
    prompt += `- ID: ${task.id}\n`;
    prompt += `- Tiêu đề: ${task.title}\n`;
    prompt += `- Mô tả: ${task.description}\n\n`;
    
    // Thêm kế hoạch kiểm thử
    prompt += `Kế hoạch kiểm thử:\n`;
    prompt += `- Tiêu đề: ${testPlan.title}\n`;
    prompt += `- Tổng quan: ${testPlan.overview}\n\n`;
    
    prompt += `Các trường hợp kiểm thử:\n`;
    
    testPlan.testCases.forEach((testCase, index) => {
      prompt += `${index + 1}. ${testCase.title}\n`;
      prompt += `   Mô tả: ${testCase.description}\n`;
      prompt += `   Độ ưu tiên: ${testCase.priority}\n`;
      prompt += `   Các bước kiểm thử:\n`;
      
      testCase.steps.forEach((step, stepIndex) => {
        prompt += `     ${stepIndex + 1}. ${step.description}\n`;
        prompt += `        Kết quả mong đợi: ${step.expectedResult}\n`;
      });
      
      prompt += '\n';
    });
    
    // Thêm code cần kiểm thử
    prompt += `Code cần kiểm thử:\n`;
    
    if (codeArtifacts.length > 0) {
      codeArtifacts.forEach(art => {
        prompt += `File: ${art.metadata.fileName}\n`;
        prompt += '```\n';
        prompt += art.content;
        prompt += '\n```\n\n';
      });
    } else {
      prompt += 'Không có code để kiểm thử.\n\n';
    }
    
    // Thêm hướng dẫn cho Tester
    prompt += `Hãy thực hiện kiểm thử theo kế hoạch trên và đánh giá code. `;
    prompt += `Đối với mỗi bước kiểm thử, hãy cung cấp kết quả thực tế và đánh giá xem bước đó có đạt yêu cầu không. `;
    prompt += `Cuối cùng, hãy đưa ra đánh giá tổng thể về chất lượng code và liệu nó có đạt yêu cầu không.\n\n`;
    
    prompt += `Hãy trả về kết quả kiểm thử theo định dạng JSON như sau:\n`;
    prompt += `{\n`;
    prompt += `  "title": "Kết quả kiểm thử cho [Tên nhiệm vụ]",\n`;
    prompt += `  "overview": "Tổng quan về kết quả kiểm thử",\n`;
    prompt += `  "passed": true/false,\n`;
    prompt += `  "testCases": [\n`;
    prompt += `    {\n`;
    prompt += `      "id": "TC001",\n`;
    prompt += `      "title": "Tiêu đề trường hợp kiểm thử",\n`;
    prompt += `      "passed": true/false,\n`;
    prompt += `      "steps": [\n`;
    prompt += `        {\n`;
    prompt += `          "id": 1,\n`;
    prompt += `          "description": "Mô tả bước kiểm thử",\n`;
    prompt += `          "expectedResult": "Kết quả mong đợi",\n`;
    prompt += `          "actualResult": "Kết quả thực tế",\n`;
    prompt += `          "passed": true/false\n`;
    prompt += `        }\n`;
    prompt += `      ]\n`;
    prompt += `    }\n`;
    prompt += `  ],\n`;
    prompt += `  "summary": "Tóm tắt kết quả kiểm thử và đánh giá chất lượng code",\n`;
    prompt += `  "suggestions": "Các đề xuất cải thiện (nếu có)"\n`;
    prompt += `}\n`;
    
    return prompt;
  }
  
  /**
   * Trích xuất kết quả kiểm thử từ phản hồi
   * @param {string} response - Phản hồi từ Ollama API
   * @param {object} testPlan - Kế hoạch kiểm thử
   * @returns {object} - Kết quả kiểm thử
   */
  extractTestResults(response, testPlan) {
    try {
      // Tìm JSON trong phản hồi
      const jsonMatch = response.match(/\{[\s\S]*\}/m);
      
      if (jsonMatch) {
        const testResults = JSON.parse(jsonMatch[0]);
        return testResults;
      }
      
      // Nếu không tìm thấy JSON, tạo kết quả kiểm thử mặc định
      logger.warn('Không thể trích xuất kết quả kiểm thử từ phản hồi, sử dụng mặc định');
      
      return {
        title: `Kết quả kiểm thử cho ${testPlan.title}`,
        overview: 'Không thể trích xuất kết quả kiểm thử từ phản hồi',
        passed: false,
        testCases: testPlan.testCases.map(tc => ({
          id: tc.id,
          title: tc.title,
          passed: false,
          steps: tc.steps.map(step => ({
            id: step.id,
            description: step.description,
            expectedResult: step.expectedResult,
            actualResult: 'Không thể xác định',
            passed: false
          }))
        })),
        summary: 'Không thể trích xuất kết quả kiểm thử từ phản hồi',
        suggestions: 'Cần thực hiện lại kiểm thử'
      };
    } catch (error) {
      logger.error('Lỗi khi trích xuất kết quả kiểm thử:', error);
      
      return {
        title: `Kết quả kiểm thử cho ${testPlan.title}`,
        overview: 'Lỗi khi trích xuất kết quả kiểm thử',
        passed: false,
        testCases: testPlan.testCases.map(tc => ({
          id: tc.id,
          title: tc.title,
          passed: false,
          steps: tc.steps.map(step => ({
            id: step.id,
            description: step.description,
            expectedResult: step.expectedResult,
            actualResult: 'Lỗi khi trích xuất',
            passed: false
          }))
        })),
        summary: 'Lỗi khi trích xuất kết quả kiểm thử',
        suggestions: 'Cần thực hiện lại kiểm thử'
      };
    }
  }
}

module.exports = new Tester();