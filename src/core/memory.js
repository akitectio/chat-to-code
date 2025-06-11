/**
 * Quản lý bộ nhớ và ngữ cảnh
 */

const path = require('path');
const logger = require('../utils/logger');
const { generateId, saveJsonToFile, readJsonFromFile } = require('../utils/helpers');
const config = require('../../config/default').memory;

class Memory {
  constructor() {
    this.conversations = {}; // Lưu trữ các cuộc hội thoại theo projectId
    this.context = {}; // Lưu trữ ngữ cảnh theo projectId
    this.persistPath = config.persistPath;
    this.maxMessages = config.maxMessages;
    this.saveInterval = config.saveInterval;
    
    // Thiết lập lưu tự động
    this.setupAutosave();
    
    // Tải dữ liệu từ đĩa nếu có
    this.loadFromDisk();
  }
  
  /**
   * Thiết lập lưu tự động
   */
  setupAutosave() {
    setInterval(() => {
      this.saveToDisk()
        .catch(err => logger.error('Lỗi khi tự động lưu bộ nhớ:', err));
    }, this.saveInterval);
  }
  
  /**
   * Tạo dự án mới
   * @param {string} name - Tên dự án
   * @param {object} metadata - Metadata của dự án
   * @returns {string} - ID của dự án
   */
  createProject(name, metadata = {}) {
    const projectId = generateId();
    
    this.conversations[projectId] = [];
    this.context[projectId] = {
      name,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata,
      summary: '',
      artifacts: []
    };
    
    logger.info(`Đã tạo dự án mới: ${name} (${projectId})`);
    return projectId;
  }
  
  /**
   * Thêm tin nhắn vào cuộc hội thoại
   * @param {string} projectId - ID của dự án
   * @param {string} role - Vai trò (user, ba, dev, tester)
   * @param {string} content - Nội dung tin nhắn
   * @param {object} metadata - Metadata của tin nhắn
   * @returns {object} - Tin nhắn đã thêm
   */
  addMessage(projectId, role, content, metadata = {}) {
    if (!this.conversations[projectId]) {
      this.conversations[projectId] = [];
    }
    
    const message = {
      id: generateId(),
      role,
      content,
      timestamp: new Date(),
      metadata
    };
    
    this.conversations[projectId].push(message);
    
    // Giới hạn số lượng tin nhắn
    if (this.conversations[projectId].length > this.maxMessages) {
      this.conversations[projectId].shift();
    }
    
    // Cập nhật thời gian cập nhật dự án
    if (this.context[projectId]) {
      this.context[projectId].updatedAt = new Date();
    }
    
    return message;
  }
  
  /**
   * Lấy lịch sử cuộc hội thoại
   * @param {string} projectId - ID của dự án
   * @param {number} limit - Số lượng tin nhắn tối đa
   * @returns {Array} - Lịch sử cuộc hội thoại
   */
  getConversation(projectId, limit = this.maxMessages) {
    if (!this.conversations[projectId]) {
      return [];
    }
    
    return this.conversations[projectId].slice(-limit);
  }
  
  /**
   * Lấy ngữ cảnh của dự án
   * @param {string} projectId - ID của dự án
   * @returns {object} - Ngữ cảnh của dự án
   */
  getContext(projectId) {
    return this.context[projectId] || {};
  }
  
  /**
   * Cập nhật ngữ cảnh của dự án
   * @param {string} projectId - ID của dự án
   * @param {object} updates - Các cập nhật
   */
  updateContext(projectId, updates) {
    if (!this.context[projectId]) {
      this.context[projectId] = {};
    }
    
    this.context[projectId] = {
      ...this.context[projectId],
      ...updates,
      updatedAt: new Date()
    };
  }
  
  /**
   * Thêm artifact vào dự án
   * @param {string} projectId - ID của dự án
   * @param {string} type - Loại artifact (spec, code, test, etc.)
   * @param {string} name - Tên artifact
   * @param {string} content - Nội dung artifact
   * @param {object} metadata - Metadata của artifact
   * @returns {string} - ID của artifact
   */
  addArtifact(projectId, type, name, content, metadata = {}) {
    if (!this.context[projectId]) {
      throw new Error(`Dự án không tồn tại: ${projectId}`);
    }
    
    if (!this.context[projectId].artifacts) {
      this.context[projectId].artifacts = [];
    }
    
    const artifactId = generateId();
    const artifact = {
      id: artifactId,
      type,
      name,
      content,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata
    };
    
    this.context[projectId].artifacts.push(artifact);
    this.context[projectId].updatedAt = new Date();
    
    return artifactId;
  }
  
  /**
   * Lấy artifact theo ID
   * @param {string} projectId - ID của dự án
   * @param {string} artifactId - ID của artifact
   * @returns {object} - Artifact
   */
  getArtifact(projectId, artifactId) {
    if (!this.context[projectId] || !this.context[projectId].artifacts) {
      return null;
    }
    
    return this.context[projectId].artifacts.find(a => a.id === artifactId);
  }
  
  /**
   * Lấy tất cả artifact của một loại
   * @param {string} projectId - ID của dự án
   * @param {string} type - Loại artifact
   * @returns {Array} - Danh sách artifact
   */
  getArtifactsByType(projectId, type) {
    if (!this.context[projectId] || !this.context[projectId].artifacts) {
      return [];
    }
    
    return this.context[projectId].artifacts.filter(a => a.type === type);
  }
  
  /**
   * Cập nhật artifact
   * @param {string} projectId - ID của dự án
   * @param {string} artifactId - ID của artifact
   * @param {object} updates - Các cập nhật
   * @returns {boolean} - true nếu cập nhật thành công
   */
  updateArtifact(projectId, artifactId, updates) {
    if (!this.context[projectId] || !this.context[projectId].artifacts) {
      return false;
    }
    
    const index = this.context[projectId].artifacts.findIndex(a => a.id === artifactId);
    if (index === -1) {
      return false;
    }
    
    this.context[projectId].artifacts[index] = {
      ...this.context[projectId].artifacts[index],
      ...updates,
      updatedAt: new Date()
    };
    
    this.context[projectId].updatedAt = new Date();
    return true;
  }
  
  /**
   * Lưu bộ nhớ vào đĩa
   * @returns {Promise<void>}
   */
  async saveToDisk() {
    try {
      const data = {
        conversations: this.conversations,
        context: this.context,
        savedAt: new Date()
      };
      
      const filePath = path.join(this.persistPath, 'memory.json');
      await saveJsonToFile(filePath, data);
      logger.debug('Đã lưu bộ nhớ vào đĩa');
    } catch (error) {
      logger.error('Lỗi khi lưu bộ nhớ vào đĩa:', error);
      throw error;
    }
  }
  
  /**
   * Tải bộ nhớ từ đĩa
   * @returns {Promise<boolean>} - true nếu tải thành công
   */
  async loadFromDisk() {
    try {
      const filePath = path.join(this.persistPath, 'memory.json');
      const data = await readJsonFromFile(filePath);
      
      if (!data) {
        logger.info('Không tìm thấy dữ liệu bộ nhớ để tải');
        return false;
      }
      
      this.conversations = data.conversations || {};
      this.context = data.context || {};
      
      logger.info(`Đã tải bộ nhớ từ đĩa (lưu lúc ${new Date(data.savedAt).toLocaleString()})`);
      return true;
    } catch (error) {
      logger.error('Lỗi khi tải bộ nhớ từ đĩa:', error);
      return false;
    }
  }
  
  /**
   * Khởi tạo bộ nhớ
   * @returns {Promise<void>}
   */
  async init() {
    try {
      // Đảm bảo thư mục lưu trữ tồn tại
      const { ensureDirectoryExists } = require('../utils/helpers');
      await ensureDirectoryExists(this.persistPath);
      
      // Tải dữ liệu từ đĩa
      await this.loadFromDisk();
      
      logger.info('Đã khởi tạo bộ nhớ thành công');
    } catch (error) {
      logger.error('Lỗi khi khởi tạo bộ nhớ:', error);
      throw error;
    }
  }
  
  /**
   * Xóa dự án
   * @param {string} projectId - ID của dự án
   * @returns {boolean} - true nếu xóa thành công
   */
  deleteProject(projectId) {
    if (!this.conversations[projectId] && !this.context[projectId]) {
      return false;
    }
    
    delete this.conversations[projectId];
    delete this.context[projectId];
    
    logger.info(`Đã xóa dự án: ${projectId}`);
    return true;
  }
}

module.exports = new Memory();