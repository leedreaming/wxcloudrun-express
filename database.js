const { MongoClient } = require('mongodb');

let dbInstance = null;

// 从环境变量获取数据库连接信息
const DB_URL = process.env.MONGODB_URL || 'mongodb://localhost:27017';
const DB_NAME = process.env.MONGODB_NAME || 'secondhand_books';

async function connectToDatabase() {
  if (dbInstance) {
    return dbInstance;
  }

  try {
    const client = new MongoClient(DB_URL, {
      useUnifiedTopology: true,
      useNewUrlParser: true
    });

    await client.connect();
    dbInstance = client.db(DB_NAME);
    
    console.log('成功连接到数据库');
    return dbInstance;
  } catch (error) {
    console.error('数据库连接失败:', error);
    throw error;
  }
}

function getDb() {
  if (!dbInstance) {
    throw new Error('数据库未连接，请先调用 connectToDatabase');
  }
  return dbInstance;
}

module.exports = {
  connectToDatabase,
  getDb
};
