/**
 * Model dự án
 */

const { generateId } = require('../utils/helpers');

class Project {
  /**
   * Khởi tạo một dự án mới
   * @param {object} data - Dữ liệu dự án
   */
  constructor(data = {}) {
    this.id = data.id || generateId();
    this.name = data.name || 'Dự án mới';
    this.description = data.description || '';
    this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
    this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
    this.tasks = data.tasks || [];
    this.tests = data.tests || [];
    this.artifacts = data.artifacts || [];
    this.metadata = data.metadata || {};
    this.status = data.status || 'active'; // active, completed, archived
  }
  
  /**
   * Thêm nhiệm vụ vào dự án
   * @param {object} task - Nhiệm vụ cần thêm
   * @returns {string} - ID của nhiệm vụ
   */
  addTask(task) {
    if (!task.id) {
      task.id = generateId();
    }
    
    this.tasks.push(task);
    this.updatedAt = new Date();
    return task.id;
  }
  
  /**
   * Thêm test case vào dự án
   * @param {object} test - Test case cần thêm
   * @returns {string} - ID của test case
   */
  addTest(test) {
    if (!test.id) {
      test.id = generateId();
    }
    
    this.tests.push(test);
    this.updatedAt = new Date();
    return test.id;
  }
  
  /**
   * Thêm artifact vào dự án
   * @param {object} artifact - Artifact cần thêm
   * @returns {string} - ID của artifact
   */
  addArtifact(artifact) {
    if (!artifact.id) {
      artifact.id = generateId();
    }
    
    this.artifacts.push(artifact);
    this.updatedAt = new Date();
    return artifact.id;
  }
  
  /**
   * Lấy nhiệm vụ theo ID
   * @param {string} taskId - ID của nhiệm vụ
   * @returns {object|null} - Nhiệm vụ hoặc null nếu không tìm thấy
   */
  getTask(taskId) {
    return this.tasks.find(task => task.id === taskId) || null;
  }
  
  /**
   * Lấy test case theo ID
   * @param {string} testId - ID của test case
   * @returns {object|null} - Test case hoặc null nếu không tìm thấy
   */
  getTest(testId) {
    return this.tests.find(test => test.id === testId) || null;
  }
  
  /**
   * Lấy artifact theo ID
   * @param {string} artifactId - ID của artifact
   * @returns {object|null} - Artifact hoặc null nếu không tìm thấy
   */
  getArtifact(artifactId) {
    return this.artifacts.find(artifact => artifact.id === artifactId) || null;
  }
  
  /**
   * Cập nhật thông tin dự án
   * @param {object} updates - Các cập nhật
   */
  update(updates) {
    Object.keys(updates).forEach(key => {
      if (key !== 'id' && key !== 'createdAt') {
        this[key] = updates[key];
      }
    });
    
    this.updatedAt = new Date();
  }
  
  /**
   * Chuyển đổi dự án thành đối tượng JSON
   * @returns {object} - Đối tượng JSON
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      tasks: this.tasks,
      tests: this.tests,
      artifacts: this.artifacts,
      metadata: this.metadata,
      status: this.status
    };
  }
  
  /**
   * Tạo dự án từ đối tượng JSON
   * @param {object} json - Đối tượng JSON
   * @returns {Project} - Đối tượng dự án
   */
  static fromJSON(json) {
    return new Project(json);
  }
}

module.exports = Project;