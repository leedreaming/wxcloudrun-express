const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const cors = require('cors');

// 连接数据库
const { connectToDatabase } = require('./database');
connectToDatabase().catch(console.error);

// 引入 API 路由
const apiRouter = require('./routes/api');

const app = express();

// 微信云托管通过 PORT 环境变量指定端口
const PORT = process.env.PORT || 8080;

// 中间件
app.use(cors());
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// 静态文件（可选）
app.use(express.static(path.join(__dirname, '.')));

// API 路由（所有接口以 /api 开头）
app.use('/api', apiRouter);

// 根路径返回简单提示（可选）
app.get('/', (req, res) => {
  res.send('二手书交易平台 API 服务运行中 ✅');
});

// 健康检查接口（用于云托管探活）
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 全局错误处理
app.use((err, req, res, next) => {
  console.error('❌ 服务器错误:', err.stack);
  res.status(500).json({
    success: false,
    message: '服务器内部错误'
  });
});

// 启动服务
app.listen(PORT, () => {
  console.log(`🚀 服务已启动，监听端口 ${PORT}`);
});
