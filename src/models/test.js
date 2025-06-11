/**
 * Model test case
 */

const { generateId } = require('../utils/helpers');

class Test {
  /**
   * Khởi tạo một test case mới
   * @param {object} data - Dữ liệu test case
   */
  constructor(data = {}) {
    this.id = data.id || generateId();
    this.projectId = data.projectId;
    this.taskId = data.taskId; // ID của nhiệm vụ liên quan
    this.title = data.title || 'Test case mới';
    this.description = data.description || '';
    this.type = data.type || 'functional'; // functional, integration, performance, etc.
    this.status = data.status || 'pending'; // pending, passed, failed, blocked
    this.priority = data.priority || 'medium'; // low, medium, high, critical
    this.steps = data.steps || []; // Các bước thực hiện test
    this.expectedResults = data.expectedResults || []; // Kết quả mong đợi
    this.actualResults = data.actualResults || []; // Kết quả thực tế
    this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
    this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
    this.executedAt = data.executedAt ? new Date(data.executedAt) : null;
    this.executedBy = data.executedBy || null; // agent type: tester
    this.automated = data.automated || false; // true nếu là test tự động
    this.automationScript = data.automationScript || ''; // Script tự động hóa
    this.tags = data.tags || [];
    this.metadata = data.metadata || {};
    this.comments = data.comments || [];
  }
  
  /**
   * Thêm bước test
   * @param {string} description - Mô tả bước test
   * @param {string} expectedResult - Kết quả mong đợi
   * @returns {number} - Chỉ số của bước test
   */
  addStep(description, expectedResult = '') {
    const step = {
      id: generateId(),
      description,
      expectedResult
    };
    
    this.steps.push(step);
    this.updatedAt = new Date();
    
    return this.steps.length - 1;
  }
  
  /**
   * Cập nhật kết quả thực tế cho một bước test
   * @param {number} stepIndex - Chỉ số của bước test
   * @param {string} actualResult - Kết quả thực tế
   * @param {boolean} passed - true nếu bước test đạt yêu cầu
   */
  updateStepResult(stepIndex, actualResult, passed = true) {
    if (stepIndex >= 0 && stepIndex < this.steps.length) {
      if (!this.actualResults[stepIndex]) {
        this.actualResults[stepIndex] = {};
      }
      
      this.actualResults[stepIndex].result = actualResult;
      this.actualResults[stepIndex].passed = passed;
      this.actualResults[stepIndex].timestamp = new Date();
      
      this.updatedAt = new Date();
    }
  }
  
  /**
   * Thực thi test case
   * @param {string} executedBy - Agent thực thi test (tester)
   * @returns {boolean} - true nếu tất cả các bước test đều đạt yêu cầu
   */
  execute(executedBy = 'tester') {
    this.executedBy = executedBy;
    this.executedAt = new Date();
    this.updatedAt = new Date();
    
    // Kiểm tra xem tất cả các bước test đã có kết quả chưa
    const allStepsHaveResults = this.steps.every((_, index) => {
      return this.actualResults[index] && this.actualResults[index].result;
    });
    
    // Kiểm tra xem tất cả các bước test đều đạt yêu cầu không
    const allStepsPassed = this.steps.every((_, index) => {
      return this.actualResults[index] && this.actualResults[index].passed;
    });
    
    if (allStepsHaveResults) {
      this.status = allStepsPassed ? 'passed' : 'failed';
    } else {
      this.status = 'pending';
    }
    
    return allStepsPassed;
  }
  
  /**
   * Thêm bình luận vào test case
   * @param {string} author - Tác giả bình luận (user, ba, dev, tester, system)
   * @param {string} content - Nội dung bình luận
   * @returns {string} - ID của bình luận
   */
  addComment(author, content) {
    const comment = {
      id: generateId(),
      author,
      content,
      timestamp: new Date()
    };
    
    this.comments.push(comment);
    this.updatedAt = new Date();
    
    return comment.id;
  }
  
  /**
   * Thêm script tự động hóa
   * @param {string} script - Script tự động hóa
   */
  setAutomationScript(script) {
    this.automationScript = script;
    this.automated = true;
    this.updatedAt = new Date();
  }
  
  /**
   * Thêm tag cho test case
   * @param {string} tag - Tag cần thêm
   */
  addTag(tag) {
    if (!this.tags.includes(tag)) {
      this.tags.push(tag);
      this.updatedAt = new Date();
    }
  }
  
  /**
   * Xóa tag khỏi test case
   * @param {string} tag - Tag cần xóa
   */
  removeTag(tag) {
    const index = this.tags.indexOf(tag);
    if (index !== -1) {
      this.tags.splice(index, 1);
      this.updatedAt = new Date();
    }
  }
  
  /**
   * Cập nhật thông tin test case
   * @param {object} updates - Các cập nhật
   */
  update(updates) {
    Object.keys(updates).forEach(key => {
      if (key !== 'id' && key !== 'projectId' && key !== 'createdAt') {
        this[key] = updates[key];
      }
    });
    
    this.updatedAt = new Date();
  }
  
  /**
   * Chuyển đổi test case thành đối tượng JSON
   * @returns {object} - Đối tượng JSON
   */
  toJSON() {
    return {
      id: this.id,
      projectId: this.projectId,
      taskId: this.taskId,
      title: this.title,
      description: this.description,
      type: this.type,
      status: this.status,
      priority: this.priority,
      steps: this.steps,
      expectedResults: this.expectedResults,
      actualResults: this.actualResults,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      executedAt: this.executedAt,
      executedBy: this.executedBy,
      automated: this.automated,
      automationScript: this.automationScript,
      tags: this.tags,
      metadata: this.metadata,
      comments: this.comments
    };
  }
  
  /**
   * Tạo test case từ đối tượng JSON
   * @param {object} json - Đối tượng JSON
   * @returns {Test} - Đối tượng test case
   */
  static fromJSON(json) {
    return new Test(json);
  }
}

module.exports = Test;