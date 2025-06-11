/**
 * Các hàm tiện ích
 */

const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

/**
 * Tạo ID ngẫu nhiên
 * @param {number} length - Độ dài của ID
 * @returns {string} - ID ngẫu nhiên
 */
function generateId(length = 10) {
  return crypto.randomBytes(Math.ceil(length / 2))
    .toString('hex')
    .slice(0, length);
}

/**
 * Trì hoãn thực thi trong một khoảng thời gian
 * @param {number} ms - Thời gian trì hoãn (milliseconds)
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Đảm bảo thư mục tồn tại
 * @param {string} dirPath - Đường dẫn thư mục
 * @returns {Promise<void>}
 */
async function ensureDirectoryExists(dirPath) {
  try {
    await fs.access(dirPath);
  } catch (error) {
    await fs.mkdir(dirPath, { recursive: true });
  }
}

/**
 * Lưu dữ liệu vào file JSON
 * @param {string} filePath - Đường dẫn file
 * @param {object} data - Dữ liệu cần lưu
 * @returns {Promise<void>}
 */
async function saveJsonToFile(filePath, data) {
  await ensureDirectoryExists(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * Đọc dữ liệu từ file JSON
 * @param {string} filePath - Đường dẫn file
 * @returns {Promise<object>} - Dữ liệu đọc được
 */
async function readJsonFromFile(filePath) {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null; // File không tồn tại
    }
    throw error;
  }
}

/**
 * Trích xuất từ khóa từ văn bản
 * @param {string} text - Văn bản cần trích xuất
 * @param {number} maxKeywords - Số lượng từ khóa tối đa
 * @returns {string[]} - Danh sách từ khóa
 */
function extractKeywords(text, maxKeywords = 10) {
  // Loại bỏ các ký tự đặc biệt và chuyển thành chữ thường
  const cleanText = text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '');
  
  // Tách thành các từ
  const words = cleanText.split(/\s+/);
  
  // Loại bỏ các từ dừng (stopwords)
  const stopwords = ['và', 'hoặc', 'là', 'của', 'cho', 'trong', 'với', 'các', 'những', 'một', 'có', 'được', 'không', 'này', 'đó', 'thì', 'mà', 'để', 'từ', 'bởi'];
  const filteredWords = words.filter(word => word.length > 2 && !stopwords.includes(word));
  
  // Đếm tần suất xuất hiện
  const wordFrequency = {};
  filteredWords.forEach(word => {
    wordFrequency[word] = (wordFrequency[word] || 0) + 1;
  });
  
  // Sắp xếp theo tần suất và lấy các từ khóa hàng đầu
  return Object.entries(wordFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxKeywords)
    .map(entry => entry[0]);
}

/**
 * Định dạng thời gian
 * @param {Date} date - Đối tượng Date
 * @returns {string} - Chuỗi thời gian đã định dạng
 */
function formatDate(date) {
  return date.toLocaleString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

module.exports = {
  generateId,
  delay,
  ensureDirectoryExists,
  saveJsonToFile,
  readJsonFromFile,
  extractKeywords,
  formatDate
};