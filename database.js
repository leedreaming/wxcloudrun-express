const { MongoClient } = require('mongodb');

let dbInstance = null;

// ⭐修改：环境变量名与.env统一（原MONGODB_NAME → MONGODB_DB_NAME，匹配之前的.env配置）
const DB_URL = process.env.MONGODB_URL || 'mongodb://localhost:27017';
const DB_NAME = process.env.MONGODB_DB_NAME || 'secondhand_books';

async function connectToDatabase() {
  if (dbInstance) {
    return dbInstance;
  }

  try {
    const client = new MongoClient(DB_URL, {
      // ⭐删除：useUnifiedTopology/useNewUrlParser 是MongoDB 4.x过时配置，6.x+无需配置，避免警告
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
