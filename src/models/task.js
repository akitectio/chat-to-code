/**
 * Model nhiệm vụ
 */

const { generateId } = require('../utils/helpers');

class Task {
  /**
   * Khởi tạo một nhiệm vụ mới
   * @param {object} data - Dữ liệu nhiệm vụ
   */
  constructor(data = {}) {
    this.id = data.id || generateId();
    this.projectId = data.projectId;
    this.title = data.title || 'Nhiệm vụ mới';
    this.description = data.description || '';
    this.type = data.type || 'feature'; // feature, bug, improvement, etc.
    this.status = data.status || 'pending'; // pending, in_progress, review, completed
    this.priority = data.priority || 'medium'; // low, medium, high, critical
    this.assignedTo = data.assignedTo || null; // agent type: ba, dev, tester
    this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
    this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
    this.completedAt = data.completedAt ? new Date(data.completedAt) : null;
    this.dependencies = data.dependencies || []; // IDs của các nhiệm vụ phụ thuộc
    this.tags = data.tags || [];
    this.metadata = data.metadata || {};
    this.comments = data.comments || [];
  }
  
  /**
   * Cập nhật trạng thái nhiệm vụ
   * @param {string} status - Trạng thái mới
   * @param {string} comment - Bình luận về việc cập nhật (tùy chọn)
   */
  updateStatus(status, comment = '') {
    this.status = status;
    this.updatedAt = new Date();
    
    if (status === 'completed') {
      this.completedAt = new Date();
    }
    
    if (comment) {
      this.addComment('system', comment);
    }
  }
  
  /**
   * Thêm bình luận vào nhiệm vụ
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
   * Gán nhiệm vụ cho một agent
   * @param {string} agentType - Loại agent (ba, dev, tester)
   */
  assignTo(agentType) {
    this.assignedTo = agentType;
    this.updatedAt = new Date();
    
    this.addComment('system', `Nhiệm vụ được gán cho ${this.getAgentName(agentType)}`);
  }
  
  /**
   * Lấy tên hiển thị của agent
   * @param {string} agentType - Loại agent
   * @returns {string} - Tên hiển thị
   */
  getAgentName(agentType) {
    const agentNames = {
      ba: 'Business Analyst',
      dev: 'Developer',
      tester: 'Tester',
      user: 'Người dùng',
      system: 'Hệ thống'
    };
    
    return agentNames[agentType] || agentType;
  }
  
  /**
   * Thêm tag cho nhiệm vụ
   * @param {string} tag - Tag cần thêm
   */
  addTag(tag) {
    if (!this.tags.includes(tag)) {
      this.tags.push(tag);
      this.updatedAt = new Date();
    }
  }
  
  /**
   * Xóa tag khỏi nhiệm vụ
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
   * Thêm phụ thuộc cho nhiệm vụ
   * @param {string} taskId - ID của nhiệm vụ phụ thuộc
   */
  addDependency(taskId) {
    if (!this.dependencies.includes(taskId)) {
      this.dependencies.push(taskId);
      this.updatedAt = new Date();
    }
  }
  
  /**
   * Xóa phụ thuộc khỏi nhiệm vụ
   * @param {string} taskId - ID của nhiệm vụ phụ thuộc
   */
  removeDependency(taskId) {
    const index = this.dependencies.indexOf(taskId);
    if (index !== -1) {
      this.dependencies.splice(index, 1);
      this.updatedAt = new Date();
    }
  }
  
  /**
   * Cập nhật thông tin nhiệm vụ
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
   * Chuyển đổi nhiệm vụ thành đối tượng JSON
   * @returns {object} - Đối tượng JSON
   */
  toJSON() {
    return {
      id: this.id,
      projectId: this.projectId,
      title: this.title,
      description: this.description,
      type: this.type,
      status: this.status,
      priority: this.priority,
      assignedTo: this.assignedTo,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      completedAt: this.completedAt,
      dependencies: this.dependencies,
      tags: this.tags,
      metadata: this.metadata,
      comments: this.comments
    };
  }
  
  /**
   * Tạo nhiệm vụ từ đối tượng JSON
   * @param {object} json - Đối tượng JSON
   * @returns {Task} - Đối tượng nhiệm vụ
   */
  static fromJSON(json) {
    return new Task(json);
  }
}

module.exports = Task;