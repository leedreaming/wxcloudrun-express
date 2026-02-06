const mysql = require('mysql2/promise');

let pool = null;

// 从环境变量读取 MySQL 配置
const DB_CONFIG = {
  host: process.env.MYSQL_HOST,
  port: process.env.MYSQL_PORT || 3306,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// 创建连接池（推荐生产环境使用）
async function connectToDatabase() {
  if (pool) return pool;
  try {
    pool = mysql.createPool(DB_CONFIG);
    // 测试连接
    await pool.getConnection();
    console.log('✅ MySQL 数据库连接成功');
    return pool;
  } catch (error) {
    console.error('❌ MySQL 连接失败:', error);
    throw error;
  }
}

// 获取数据库实例
function getDb() {
  if (!pool) {
    throw new Error('数据库未连接，请先调用 connectToDatabase');
  }
  return pool;
}

module.exports = {
  connectToDatabase,
  getDb
};
