// ⭐新增：最开头加载环境变量（必须第一行，优先读取敏感配置）
require('dotenv').config();

const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const cors = require('cors');

// ⭐新增：引入二手书平台必需依赖（安全防护、文件上传）
const helmet = require('helmet');
const multer = require('multer');

// 连接数据库
const { connectToDatabase } = require('./database');
connectToDatabase().catch(console.error);

// 引入 API 路由
const apiRouter = require('./routes/api');

const app = express();

// 微信云托管通过 PORT 环境变量指定端口
const PORT = process.env.PORT || 8080;

// ⭐新增1：配置multer文件上传（二手书图片专用，单张≤2M，存uploads目录）
const upload = multer({
  dest: path.join(__dirname, 'uploads/'), // 绝对路径更安全，避免部署路径问题
  limits: { fileSize: 2 * 1024 * 1024 } // 单张图片最大2M，适配小程序上传
});
// ⭐新增：导出upload实例，供routes/api.js的接口使用（比如书籍发布接口需要图片上传）
app.locals.upload = upload;

// 中间件
// ⭐新增2：安全防护中间件（优先配置，防止XSS/CSRF等攻击）
app.use(helmet());
// ⭐新增3：完善cors配置（从.env读合法域名，仅允许小程序访问，防止接口滥用）
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*', // 优先读环境变量，无则临时允许所有（开发阶段）
  credentials: true, // 允许携带cookie/登录态，适配小程序登录
  methods: ['GET', 'POST', 'PUT', 'DELETE'], // 仅允许常用请求方式
  allowedHeaders: ['Content-Type', 'Authorization'] // 允许的请求头
}));
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// 静态文件
app.use(express.static(path.join(__dirname, '.')));
// ⭐新增4：托管uploads图片目录（让前端能直接访问上传的书籍封面/内页）
app.use('/uploads', express.static(path.join(__dirname, 'uploads/')));

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
