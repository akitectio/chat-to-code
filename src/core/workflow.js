/**
 * Quản lý luồng công việc
 */

const logger = require('../utils/logger');
const memory = require('./memory');
const chat = require('./chat');
const { generateId, delay } = require('../utils/helpers');
const googleSearch = require('../utils/google-search');

class WorkflowManager {
  constructor() {
    this.activeWorkflows = new Map(); // Lưu trữ các workflow đang hoạt động
  }
  
  /**
   * Bắt đầu quy trình xử lý
   * @param {string} userMessage - Tin nhắn từ người dùng
   * @param {string} projectId - ID của dự án (tùy chọn)
   * @returns {Promise<object>} - Kết quả của quy trình
   */
  async startWorkflow(userMessage, projectId = null) {
    try {
      // Tạo dự án mới nếu chưa có
      if (!projectId) {
        projectId = memory.createProject('Dự án mới', {
          createdFrom: 'user_message',
          timestamp: new Date()
        });
      }
      
      // Tạo ID cho workflow
      const workflowId = generateId();
      
      // Lưu tin nhắn của người dùng
      memory.addMessage(projectId, 'user', userMessage);
      
      // Tạo đối tượng workflow
      const workflow = {
        id: workflowId,
        projectId,
        startTime: new Date(),
        status: 'running',
        steps: [],
        results: {}
      };
      
      // Lưu workflow vào danh sách đang hoạt động
      this.activeWorkflows.set(workflowId, workflow);
      
      logger.info(`Bắt đầu workflow ${workflowId} cho dự án ${projectId}`);
      
      // Thực hiện quy trình
      const result = await this.executeWorkflow(workflow, userMessage);
      
      // Cập nhật trạng thái workflow
      workflow.status = 'completed';
      workflow.endTime = new Date();
      
      // Xóa workflow khỏi danh sách đang hoạt động sau một khoảng thời gian
      setTimeout(() => {
        this.activeWorkflows.delete(workflowId);
      }, 60000); // Giữ trong 1 phút
      
      return result;
    } catch (error) {
      logger.error('Lỗi khi thực hiện workflow:', error);
      throw error;
    }
  }
  
  /**
   * Thực hiện quy trình xử lý
   * @param {object} workflow - Đối tượng workflow
   * @param {string} userMessage - Tin nhắn từ người dùng
   * @returns {Promise<object>} - Kết quả của quy trình
   */
  async executeWorkflow(workflow, userMessage) {
    const { projectId } = workflow;
    const io = require('../index').getIO();
    
    try {
      // Hàm callback để xử lý streaming từ các agent
      const handleStreamChunk = (chunk, role, projectId) => {
        // Gửi từng phần của phản hồi qua Socket.IO
        io.to(projectId).emit('agent_response_chunk', {
          agent: role,
          chunk: chunk,
          projectId: projectId,
          timestamp: Date.now(),
          workflowId: workflow.id,
          stepName: workflow.steps[workflow.steps.length - 1].name
        });
      };
      
      // Bước 1: Gửi tin nhắn đến BA
      logger.info('Bước 1: Gửi tin nhắn đến BA');
      workflow.steps.push({ name: 'ba_analysis', status: 'running' });
      
      // Thông báo bắt đầu phản hồi từ BA
      io.to(projectId).emit('agent_response_start', {
        agent: 'ba',
        projectId: projectId,
        workflowId: workflow.id,
        stepName: 'ba_analysis'
      });
      
      const baResponse = await chat.sendToAgent('ba', projectId, userMessage, handleStreamChunk);
      workflow.results.ba = baResponse;
      workflow.steps[0].status = 'completed';
      
      // Thông báo kết thúc phản hồi từ BA
      io.to(projectId).emit('agent_response_end', {
        agent: 'ba',
        projectId: projectId,
        workflowId: workflow.id,
        stepName: 'ba_analysis',
        messageId: memory.getConversation(projectId).slice(-1)[0]?.id
      });
      
      // Kiểm tra xem có cần tìm kiếm thông tin bổ sung không
      const needsAdditionalInfo = this.checkNeedsAdditionalInfo(baResponse);
      
      // Nếu cần tìm kiếm thông tin bổ sung
      if (needsAdditionalInfo) {
        logger.info('Cần tìm kiếm thông tin bổ sung');
        workflow.steps.push({ name: 'search_additional_info', status: 'running' });
        
        // Trích xuất truy vấn tìm kiếm từ phản hồi của BA
        const searchQuery = this.extractSearchQuery(baResponse);
        
        // Thực hiện tìm kiếm
        const searchResults = await chat.searchAdditionalInfo(searchQuery);
        workflow.results.search = searchResults;
        
        // Định dạng kết quả tìm kiếm
        const formattedResults = chat.formatSearchResults(searchResults);
        
        // Cập nhật trạng thái bước tìm kiếm
        workflow.steps[1].status = 'completed';
        
        // Gửi kết quả tìm kiếm đến BA để phân tích
        logger.info('Gửi kết quả tìm kiếm đến BA để phân tích');
        workflow.steps.push({ name: 'ba_analysis_with_search', status: 'running' });
        
        // Thông báo bắt đầu phản hồi từ BA với kết quả tìm kiếm
        io.to(projectId).emit('agent_response_start', {
          agent: 'ba',
          projectId: projectId,
          workflowId: workflow.id,
          stepName: 'ba_analysis_with_search'
        });
        
        const baResponseWithSearch = await chat.sendToAgent('ba', projectId, 
          `Dựa trên yêu cầu của người dùng, tôi đã tìm kiếm thông tin bổ sung. Hãy phân tích và tổng hợp thông tin này để cung cấp đặc tả chi tiết hơn.\n\n${formattedResults}`,
          handleStreamChunk);
        
        workflow.results.baWithSearch = baResponseWithSearch;
        workflow.steps[2].status = 'completed';
        
        // Thông báo kết thúc phản hồi từ BA với kết quả tìm kiếm
        io.to(projectId).emit('agent_response_end', {
          agent: 'ba',
          projectId: projectId,
          workflowId: workflow.id,
          stepName: 'ba_analysis_with_search',
          messageId: memory.getConversation(projectId).slice(-1)[0]?.id
        });
      }
      
      // Bước 2: Gửi phân tích của BA đến Dev
      logger.info('Bước 2: Gửi phân tích của BA đến Dev');
      workflow.steps.push({ name: 'dev_implementation', status: 'running' });
      
      // Sử dụng phân tích có kết quả tìm kiếm nếu có
      const baAnalysis = workflow.results.baWithSearch || workflow.results.ba;
      
      // Thông báo bắt đầu phản hồi từ Dev
      io.to(projectId).emit('agent_response_start', {
        agent: 'dev',
        projectId: projectId,
        workflowId: workflow.id,
        stepName: 'dev_implementation'
      });
      
      const devResponse = await chat.sendToAgent('dev', projectId, 
        `Dưới đây là phân tích yêu cầu từ Business Analyst. Hãy phát triển code dựa trên phân tích này.\n\n${baAnalysis}`,
        handleStreamChunk);
      
      workflow.results.dev = devResponse;
      workflow.steps[workflow.steps.length - 1].status = 'completed';
      
      // Thông báo kết thúc phản hồi từ Dev
      io.to(projectId).emit('agent_response_end', {
        agent: 'dev',
        projectId: projectId,
        workflowId: workflow.id,
        stepName: 'dev_implementation',
        messageId: memory.getConversation(projectId).slice(-1)[0]?.id
      });
      
      // Bước 3: Gửi code của Dev đến Tester
      logger.info('Bước 3: Gửi code của Dev đến Tester');
      workflow.steps.push({ name: 'tester_verification', status: 'running' });
      
      // Thông báo bắt đầu phản hồi từ Tester
      io.to(projectId).emit('agent_response_start', {
        agent: 'tester',
        projectId: projectId,
        workflowId: workflow.id,
        stepName: 'tester_verification'
      });
      
      const testerResponse = await chat.sendToAgent('tester', projectId, 
        `Dưới đây là code được phát triển bởi Developer dựa trên yêu cầu. Hãy viết test case và kiểm tra code này.\n\n${devResponse}`,
        handleStreamChunk);
      
      workflow.results.tester = testerResponse;
      workflow.steps[workflow.steps.length - 1].status = 'completed';
      
      // Thông báo kết thúc phản hồi từ Tester
      io.to(projectId).emit('agent_response_end', {
        agent: 'tester',
        projectId: projectId,
        workflowId: workflow.id,
        stepName: 'tester_verification',
        messageId: memory.getConversation(projectId).slice(-1)[0]?.id
      });
      
      // Bước 4: Nếu Tester phát hiện vấn đề, gửi lại cho Dev để sửa
      if (this.checkNeedsRevision(testerResponse)) {
        logger.info('Bước 4: Gửi phản hồi của Tester đến Dev để sửa');
        workflow.steps.push({ name: 'dev_revision', status: 'running' });
        
        // Thông báo bắt đầu phản hồi từ Dev (sửa lỗi)
        io.to(projectId).emit('agent_response_start', {
          agent: 'dev',
          projectId: projectId,
          workflowId: workflow.id,
          stepName: 'dev_revision'
        });
        
        const devRevisionResponse = await chat.sendToAgent('dev', projectId, 
          `Tester đã phát hiện một số vấn đề trong code của bạn. Hãy xem xét và sửa chữa.\n\n${testerResponse}`,
          handleStreamChunk);
        
        workflow.results.devRevision = devRevisionResponse;
        workflow.steps[workflow.steps.length - 1].status = 'completed';
        
        // Thông báo kết thúc phản hồi từ Dev (sửa lỗi)
        io.to(projectId).emit('agent_response_end', {
          agent: 'dev',
          projectId: projectId,
          workflowId: workflow.id,
          stepName: 'dev_revision',
          messageId: memory.getConversation(projectId).slice(-1)[0]?.id
        });
        
        // Gửi code đã sửa cho Tester kiểm tra lại
        logger.info('Gửi code đã sửa cho Tester kiểm tra lại');
        workflow.steps.push({ name: 'tester_final_verification', status: 'running' });
        
        // Thông báo bắt đầu phản hồi từ Tester (kiểm tra lại)
        io.to(projectId).emit('agent_response_start', {
          agent: 'tester',
          projectId: projectId,
          workflowId: workflow.id,
          stepName: 'tester_final_verification'
        });
        
        const testerFinalResponse = await chat.sendToAgent('tester', projectId, 
          `Developer đã sửa code dựa trên phản hồi của bạn. Hãy kiểm tra lại.\n\n${devRevisionResponse}`,
          handleStreamChunk);
        
        workflow.results.testerFinal = testerFinalResponse;
        workflow.steps[workflow.steps.length - 1].status = 'completed';
        
        // Thông báo kết thúc phản hồi từ Tester (kiểm tra lại)
        io.to(projectId).emit('agent_response_end', {
          agent: 'tester',
          projectId: projectId,
          workflowId: workflow.id,
          stepName: 'tester_final_verification',
          messageId: memory.getConversation(projectId).slice(-1)[0]?.id
        });
      }
      
      // Tổng hợp kết quả
      const finalResult = this.summarizeWorkflow(workflow);
      
      // Cập nhật tóm tắt dự án
      memory.updateContext(projectId, {
        summary: finalResult.summary
      });
      
      return finalResult;
    } catch (error) {
      logger.error(`Lỗi trong workflow ${workflow.id}:`, error);
      
      // Cập nhật trạng thái của bước hiện tại thành failed
      const currentStep = workflow.steps[workflow.steps.length - 1];
      if (currentStep) {
        currentStep.status = 'failed';
        currentStep.error = error.message;
      }
      
      throw error;
    }
  }
  
  /**
   * Kiểm tra xem có cần tìm kiếm thông tin bổ sung không
   * @param {string} baResponse - Phản hồi từ BA
   * @returns {boolean} - true nếu cần tìm kiếm thông tin bổ sung
   */
  checkNeedsAdditionalInfo(baResponse) {
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
    
    const lowerResponse = baResponse.toLowerCase();
    return keywords.some(keyword => lowerResponse.includes(keyword.toLowerCase()));
  }
  
  /**
   * Trích xuất truy vấn tìm kiếm từ phản hồi của BA
   * @param {string} baResponse - Phản hồi từ BA
   * @returns {string} - Truy vấn tìm kiếm
   */
  extractSearchQuery(baResponse) {
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
      const match = baResponse.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    
    // Nếu không tìm thấy cụm từ cụ thể, trích xuất từ khóa chính từ phản hồi
    const { extractKeywords } = require('../utils/helpers');
    const keywords = extractKeywords(baResponse, 5);
    return keywords.join(' ');
  }
  
  /**
   * Kiểm tra xem có cần sửa đổi code không
   * @param {string} testerResponse - Phản hồi từ Tester
   * @returns {boolean} - true nếu cần sửa đổi
   */
  checkNeedsRevision(testerResponse) {
    // Các từ khóa gợi ý cần sửa đổi
    const keywords = [
      'lỗi',
      'bug',
      'vấn đề',
      'cần sửa',
      'không hoạt động',
      'thất bại',
      'không đúng',
      'không phù hợp',
      'cần cải thiện',
      'không đạt yêu cầu'
    ];
    
    const lowerResponse = testerResponse.toLowerCase();
    return keywords.some(keyword => lowerResponse.includes(keyword.toLowerCase()));
  }
  
  /**
   * Tổng hợp kết quả của workflow
   * @param {object} workflow - Đối tượng workflow
   * @returns {object} - Kết quả tổng hợp
   */
  summarizeWorkflow(workflow) {
    const { results } = workflow;
    
    // Tạo tóm tắt từ các phản hồi
    let summary = '';
    
    // Thêm phân tích của BA
    if (results.baWithSearch) {
      summary += `## Phân tích yêu cầu (với thông tin bổ sung)\n\n${results.baWithSearch}\n\n`;
    } else if (results.ba) {
      summary += `## Phân tích yêu cầu\n\n${results.ba}\n\n`;
    }
    
    // Thêm code của Dev
    if (results.devRevision) {
      summary += `## Code đã sửa\n\n${results.devRevision}\n\n`;
    } else if (results.dev) {
      summary += `## Code\n\n${results.dev}\n\n`;
    }
    
    // Thêm kết quả kiểm thử
    if (results.testerFinal) {
      summary += `## Kết quả kiểm thử cuối cùng\n\n${results.testerFinal}\n\n`;
    } else if (results.tester) {
      summary += `## Kết quả kiểm thử\n\n${results.tester}\n\n`;
    }
    
    // Tạo đối tượng kết quả
    return {
      projectId: workflow.projectId,
      workflowId: workflow.id,
      summary,
      steps: workflow.steps,
      duration: workflow.endTime ? (workflow.endTime - workflow.startTime) : null,
      timestamp: new Date()
    };
  }
  
  /**
   * Lấy trạng thái của workflow theo workflowId
   * @param {string} workflowId - ID của workflow
   * @returns {object|null} - Trạng thái của workflow hoặc null nếu không tìm thấy
   */
  getWorkflowStatus(workflowId) {
    const workflow = this.activeWorkflows.get(workflowId);
    if (!workflow) {
      return null;
    }
    
    return {
      id: workflow.id,
      projectId: workflow.projectId,
      status: workflow.status,
      steps: workflow.steps,
      startTime: workflow.startTime,
      endTime: workflow.endTime
    };
  }
  
  /**
   * Lấy trạng thái của workflow theo projectId
   * @param {string} projectId - ID của project
   * @returns {object|null} - Trạng thái của workflow hoặc null nếu không tìm thấy
   */
  getStatus(projectId) {
    // Tìm workflow đang hoạt động cho project này
    for (const [_, workflow] of this.activeWorkflows) {
      if (workflow.projectId === projectId) {
        return {
          id: workflow.id,
          projectId: workflow.projectId,
          status: workflow.status,
          steps: workflow.steps,
          startTime: workflow.startTime,
          endTime: workflow.endTime
        };
      }
    }
    
    return null;
  }
}

module.exports = new WorkflowManager();