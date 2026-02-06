const express = require('express');
const { getDb } = require('../database');
const router = express.Router();

// ⭐新增：引入参数校验工具（已在package.json添加依赖，无需额外安装）
const { body, query, validationResult } = require('express-validator');

// ⭐新增：全局参数校验中间件（所有接口通用，捕获校验错误并统一返回）
const validateParams = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: '参数校验失败',
      data: errors.array().map(e => ({ field: e.path, msg: e.msg }))
    });
  }
  next();
};

// 获取openid接口
router.get('/getOpenid', 
  [
    // ⭐新增：空校验（示例，实际对接微信API时可加code参数校验）
    validateParams
  ],
  async (req, res) => {
  try {
    // 模拟获取openid，实际应用中应该通过微信API获取（传入code，调用微信接口换openid）
    const mockOpenid = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    res.json({
      success: true,
      data: {
        openid: mockOpenid
      },
      message: '获取成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 获取书籍列表
router.post('/getBooks', 
  [
    // ⭐新增：status参数可选，若传则必须是字符串
    body('status').optional().isString().withMessage('书籍状态必须为字符串（如available）'),
    validateParams
  ],
  async (req, res) => {
  try {
    const { status } = req.body;
    const db = getDb();
    const collection = db.collection('books');
    
    let query = {};
    if (status) {
      query.status = status;
    }
    
    const books = await collection.find(query).sort({ createdAt: -1 }).toArray();
    
    res.json({
      success: true,
      data: books,
      message: '获取成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 搜索书籍
router.post('/searchBook', 
  [
    // ⭐新增：书名必填+非空字符串
    body('title').notEmpty().withMessage('书名不能为空').isString().withMessage('书名必须为字符串'),
    validateParams
  ],
  async (req, res) => {
  try {
    const { title } = req.body;
    const db = getDb();
    const collection = db.collection('books');
    
    const book = await collection.findOne({
      title: { $regex: title, $options: 'i' },
      status: 'available'
    });
    
    res.json({
      success: true,
      data: book || null,
      message: '搜索成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ⭐核心改造：发布书籍接口（集成multer图片上传+多图支持+严格校验）
// 从index.js获取upload实例（支持最多3张图，单张≤2M）+ 新增参数校验
router.post(
  '/publishBook',
  (req, res, next) => req.app.locals.upload.array('images', 3)(req, res, next), // 多图上传：字段名images，最多3张
  [
    // ⭐新增：严格参数校验
    body('title').notEmpty().withMessage('书名不能为空').isString().withMessage('书名必须为字符串'),
    body('price').notEmpty().withMessage('价格不能为空').isFloat({ min: 0.01 }).withMessage('价格必须大于0'),
    body('sellerId').notEmpty().withMessage('卖家ID不能为空'),
    body('status').optional().isIn(['available', 'sold', 'offline']).withMessage('状态只能是available/sold/offline'),
    validateParams
  ],
  async (req, res) => {
  try {
    const { title, price, description, status, sellerId } = req.body;
    const db = getDb();
    const collection = db.collection('books');

    // ⭐新增：处理上传的图片（拼接可访问路径，替代原有手动传imageUrl）
    // req.files是上传的图片数组，/uploads/是index.js配置的静态托管路径，前端可直接访问
    const images = req.files ? req.files.map(file => `/uploads/${file.filename}`) : [];
    // 无图片则返回参数错误（必传封面）
    if (images.length === 0) {
      return res.status(400).json({
        success: false,
        message: '书籍封面不能为空，请上传图片'
      });
    }
    
    const newBook = {
      _id: `book_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title,
      price: parseFloat(price),
      description: description || '',
      // ⭐修改：单图imageUrl → 多图images数组（更贴合二手书发布需求：封面+内页）
      images,
      status: status || 'available',
      sellerId: sellerId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    const result = await collection.insertOne(newBook);
    
    res.json({
      success: true,
      data: newBook,
      message: '发布成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 以下所有原有接口均保留，仅新增参数校验（不改变任何业务逻辑）
// 根据ID获取书籍
router.post('/getBookById',
  [
    body('bookId').notEmpty().withMessage('书籍ID不能为空'),
    validateParams
  ],
  async (req, res) => {
  try {
    const { bookId } = req.body;
    const db = getDb();
    const collection = db.collection('books');
    
    const book = await collection.findOne({ _id: bookId });
    
    res.json({
      success: true,
      data: book,
      message: '获取成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 创建交易
router.post('/createTransaction',
  [
    body('bookId').notEmpty().withMessage('书籍ID不能为空'),
    body('sellerId').notEmpty().withMessage('卖家ID不能为空'),
    body('buyerId').notEmpty().withMessage('买家ID不能为空'),
    body('buyerAmount').optional().isFloat({ min: 0 }).withMessage('买家金额不能为负数'),
    body('sellerAmount').optional().isFloat({ min: 0 }).withMessage('卖家金额不能为负数'),
    validateParams
  ],
  async (req, res) => {
  try {
    const { bookId, sellerId, buyerId, buyerAmount, sellerAmount } = req.body;
    const db = getDb();
    const collection = db.collection('transactions');
    
    const newTransaction = {
      _id: `trans_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      bookId,
      sellerId,
      buyerId,
      buyerAmount: parseFloat(buyerAmount) || 0,
      sellerAmount: parseFloat(sellerAmount) || 0,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    const result = await collection.insertOne(newTransaction);
    
    res.json({
      success: true,
      data: newTransaction,
      message: '创建成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 保存用户信息
router.post('/saveUser',
  [
    body('openid').notEmpty().withMessage('openid不能为空'),
    body('userInfo').optional().isObject().withMessage('用户信息必须为对象'),
    validateParams
  ],
  async (req, res) => {
  try {
    const { openid, userInfo } = req.body;
    const db = getDb();
    const collection = db.collection('users');
    
    const existingUser = await collection.findOne({ _openid: openid });
    
    if (existingUser) {
      await collection.updateOne(
        { _openid: openid },
        { 
          $set: { 
            userInfo: userInfo,
            updatedAt: new Date().toISOString()
          }
        }
      );
    } else {
      const newUser = {
        _id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        _openid: openid,
        userInfo: userInfo,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await collection.insertOne(newUser);
    }
    
    res.json({
      success: true,
      data: { openid },
      message: '保存成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 获取用户书籍
router.post('/getUserBooks',
  [
    body('userId').notEmpty().withMessage('用户ID不能为空'),
    body('status').optional().isString().withMessage('书籍状态必须为字符串'),
    validateParams
  ],
  async (req, res) => {
  try {
    const { userId, status } = req.body;
    const db = getDb();
    const collection = db.collection('books');
    
    let query = { sellerId: userId };
    if (status) {
      query.status = status;
    }
    
    const books = await collection.find(query).sort({ createdAt: -1 }).toArray();
    
    res.json({
      success: true,
      data: books,
      message: '获取成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 获取用户交易
router.post('/getUserTransactions',
  [
    body('userId').notEmpty().withMessage('用户ID不能为空'),
    body('type').optional().isIn(['buyer', 'seller']).withMessage('类型只能是buyer/seller'),
    validateParams
  ],
  async (req, res) => {
  try {
    const { userId, type } = req.body;
    const db = getDb();
    const collection = db.collection('transactions');
    
    let query = {};
    if (type === 'buyer') {
      query.buyerId = userId;
    } else if (type === 'seller') {
      query.sellerId = userId;
    } else {
      query = {
        $or: [
          { buyerId: userId },
          { sellerId: userId }
        ]
      };
    }
    
    const transactions = await collection.find(query).sort({ createdAt: -1 }).toArray();
    
    res.json({
      success: true,
      data: transactions,
      message: '获取成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 获取用户消息
router.post('/getUserMessages',
  [
    body('userId').notEmpty().withMessage('用户ID不能为空'),
    validateParams
  ],
  async (req, res) => {
  try {
    const { userId } = req.body;
    const db = getDb();
    const collection = db.collection('messages');
    
    const messages = await collection
      .find({ receiverId: userId })
      .sort({ createdAt: -1 })
      .toArray();
    
    res.json({
      success: true,
      data: messages,
      message: '获取成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 标记消息为已读
router.post('/markMessageAsRead',
  [
    body('messageId').notEmpty().withMessage('消息ID不能为空'),
    validateParams
  ],
  async (req, res) => {
  try {
    const { messageId } = req.body;
    const db = getDb();
    const collection = db.collection('messages');
    
    await collection.updateOne(
      { _id: messageId },
      { 
        $set: { 
          isRead: true,
          updatedAt: new Date().toISOString()
        }
      }
    );
    
    res.json({
      success: true,
      data: null,
      message: '更新成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 创建消息
router.post('/createMessage',
  [
    body('senderId').notEmpty().withMessage('发送者ID不能为空'),
    body('receiverId').notEmpty().withMessage('接收者ID不能为空'),
    body('content').notEmpty().withMessage('消息内容不能为空').isString().withMessage('内容必须为字符串'),
    validateParams
  ],
  async (req, res) => {
  try {
    const { transactionId, senderId, receiverId, content, isRead } = req.body;
    const db = getDb();
    const collection = db.collection('messages');
    
    const newMessage = {
      _id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      transactionId,
      senderId,
      receiverId,
      content,
      isRead: isRead || false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    const result = await collection.insertOne(newMessage);
    
    res.json({
      success: true,
      data: newMessage,
      message: '创建成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 更新书籍状态
router.post('/updateBookStatus',
  [
    body('bookId').notEmpty().withMessage('书籍ID不能为空'),
    body('status').notEmpty().withMessage('状态不能为空').isIn(['available', 'sold', 'offline']).withMessage('状态只能是available/sold/offline'),
    validateParams
  ],
  async (req, res) => {
  try {
    const { bookId, status } = req.body;
    const db = getDb();
    const collection = db.collection('books');
    
    await collection.updateOne(
      { _id: bookId },
      { 
        $set: { 
          status: status,
          updatedAt: new Date().toISOString()
        }
      }
    );
    
    res.json({
      success: true,
      data: null,
      message: '更新成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 获取热门书籍
router.post('/getHotBooks', async (req, res) => {
  try {
    const db = getDb();
    const collection = db.collection('books');
    
    const books = await collection
      .find({ status: 'available' })
      .sort({ createdAt: -1 })
      .limit(10)
      .toArray();
    
    res.json({
      success: true,
      data: books,
      message: '获取成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 获取常购书籍
router.post('/getPopularBooks', async (req, res) => {
  try {
    const db = getDb();
    const collection = db.collection('books');
    
    const books = await collection
      .find({ status: 'available' })
      .sort({ createdAt: -1 })
      .limit(10)
      .toArray();
    
    res.json({
      success: true,
      data: books,
      message: '获取成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 根据ID获取交易
router.post('/getTransactionById',
  [
    body('transactionId').notEmpty().withMessage('交易ID不能为空'),
    validateParams
  ],
  async (req, res) => {
  try {
    const { transactionId } = req.body;
    const db = getDb();
    const collection = db.collection('transactions');
    
    const transaction = await collection.findOne({ _id: transactionId });
    
    res.json({
      success: true,
      data: transaction,
      message: '获取成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
