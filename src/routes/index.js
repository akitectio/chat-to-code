/**
 * Routes
 */

const express = require('express');
const router = express.Router();
const apiRoutes = require('./api');

// API Routes
router.use('/api', apiRoutes);

// Trang chủ
router.get('/', (req, res) => {
  res.send('Chat-to-Code API Server');
});

// Xử lý 404
router.use((req, res) => {
  res.status(404).json({ error: 'Không tìm thấy đường dẫn' });
});

// Xử lý lỗi
router.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Lỗi server', message: err.message });
});

module.exports = router;