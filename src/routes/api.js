/**
 * API Routes
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const workflow = require('../core/workflow');
const memory = require('../core/memory');
const { generateId } = require('../utils/helpers');

// Middleware để xử lý lỗi
const asyncHandler = fn => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * @route   POST /api/projects
 * @desc    Tạo dự án mới
 * @access  Public
 */
router.post('/projects', asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Tên dự án là bắt buộc' });
  }
  
  // Tạo dự án mới với metadata chứa description
  const projectId = memory.createProject(name, { description });
  
  res.status(201).json({
    success: true,
    projectId,
    name,
    description
  });
}));

/**
 * @route   GET /api/projects
 * @desc    Lấy danh sách dự án
 * @access  Public
 */
router.get('/projects', asyncHandler(async (req, res) => {
  // Lấy tất cả các dự án từ context
  const projects = Object.entries(memory.context).map(([id, project]) => ({
    id,
    name: project.name,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    metadata: project.metadata
  }));
  
  res.json(projects);
}));

/**
 * @route   GET /api/projects/:projectId
 * @desc    Lấy thông tin dự án
 * @access  Public
 */
router.get('/projects/:projectId', asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  
  const project = memory.getContext(projectId);
  
  if (!project || Object.keys(project).length === 0) {
    return res.status(404).json({ error: 'Không tìm thấy dự án' });
  }
  
  res.json({
    id: projectId,
    name: project.name,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    metadata: project.metadata
  });
}));

/**
 * @route   POST /api/projects/:projectId/messages
 * @desc    Gửi tin nhắn mới
 * @access  Public
 */
router.post('/projects/:projectId/messages', asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const { message } = req.body;
  
  if (!message) {
    return res.status(400).json({ error: 'Nội dung tin nhắn là bắt buộc' });
  }
  
  // Kiểm tra dự án tồn tại
  const project = memory.getContext(projectId);
  
  if (!project || Object.keys(project).length === 0) {
    return res.status(404).json({ error: 'Không tìm thấy dự án' });
  }
  
  // Lưu tin nhắn
  const messageObj = memory.addMessage(projectId, 'user', message);
  
  // Bắt đầu workflow
  const workflowId = await workflow.startWorkflow(message, projectId);
  
  res.status(201).json({
    success: true,
    messageId: messageObj.id,
    workflowId
  });
}));

/**
 * @route   GET /api/projects/:projectId/messages
 * @desc    Lấy lịch sử tin nhắn
 * @access  Public
 */
router.get('/projects/:projectId/messages', asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  
  // Kiểm tra dự án tồn tại
  const project = memory.getContext(projectId);
  
  if (!project || Object.keys(project).length === 0) {
    return res.status(404).json({ error: 'Không tìm thấy dự án' });
  }
  
  const messages = memory.getConversation(projectId);
  
  res.json(messages);
}));

/**
 * @route   GET /api/projects/:projectId/artifacts
 * @desc    Lấy danh sách artifacts
 * @access  Public
 */
router.get('/projects/:projectId/artifacts', asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const { type } = req.query;
  
  // Kiểm tra dự án tồn tại
  const project = memory.getContext(projectId);
  
  if (!project || Object.keys(project).length === 0) {
    return res.status(404).json({ error: 'Không tìm thấy dự án' });
  }
  
  let artifacts = project.artifacts || [];
  
  // Lọc theo loại nếu có
  if (type) {
    artifacts = type ? memory.getArtifactsByType(projectId, type) : artifacts;
  }
  
  res.json(artifacts);
}));

/**
 * @route   GET /api/projects/:projectId/artifacts/:artifactId
 * @desc    Lấy thông tin artifact
 * @access  Public
 */
router.get('/projects/:projectId/artifacts/:artifactId', asyncHandler(async (req, res) => {
  const { projectId, artifactId } = req.params;
  
  // Kiểm tra dự án tồn tại
  const project = memory.getContext(projectId);
  
  if (!project || Object.keys(project).length === 0) {
    return res.status(404).json({ error: 'Không tìm thấy dự án' });
  }
  
  const artifact = memory.getArtifact(projectId, artifactId);
  
  if (!artifact) {
    return res.status(404).json({ error: 'Không tìm thấy artifact' });
  }
  
  res.json(artifact);
}));

/**
 * @route   GET /api/projects/:projectId/workflow
 * @desc    Lấy trạng thái workflow
 * @access  Public
 */
router.get('/projects/:projectId/workflow', asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  
  // Kiểm tra dự án tồn tại
  const project = memory.getContext(projectId);
  
  if (!project || Object.keys(project).length === 0) {
    return res.status(404).json({ error: 'Không tìm thấy dự án' });
  }
  
  const status = await workflow.getStatus(projectId);
  
  res.json(status);
}));

module.exports = router;