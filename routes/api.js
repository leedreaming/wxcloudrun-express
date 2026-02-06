const express = require('express');
const { getDb } = require('../database');
const router = express.Router();
const { body, validationResult } = require('express-validator');

// 全局参数校验中间件
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

// 获取openid接口（模拟）
router.get('/getOpenid', [validateParams], async (req, res) => {
  try {
    const mockOpenid = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    res.json({
      success: true,
      data: { openid: mockOpenid },
      message: '获取成功'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 获取书籍列表
router.post('/getBooks',
  [body('status').optional().isString().withMessage('书籍状态必须为字符串'), validateParams],
  async (req, res) => {
    try {
      const { status } = req.body;
      const db = getDb();
      let sql = 'SELECT * FROM books';
      let params = [];
      if (status) {
        sql += ' WHERE status = ?';
        params.push(status);
      }
      sql += ' ORDER BY created_at DESC';
      const [books] = await db.query(sql, params);
      // 处理JSON字段
      books.forEach(book => {
        book.images = JSON.parse(book.images || '[]');
      });
      res.json({ success: true, data: books, message: '获取成功' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

// 搜索书籍
router.post('/searchBook',
  [body('title').notEmpty().withMessage('书名不能为空').isString().withMessage('书名必须为字符串'), validateParams],
  async (req, res) => {
    try {
      const { title } = req.body;
      const db = getDb();
      const [books] = await db.query(
        'SELECT * FROM books WHERE title LIKE ? AND status = ? ORDER BY created_at DESC',
        [`%${title}%`, 'available']
      );
      books.forEach(book => {
        book.images = JSON.parse(book.images || '[]');
      });
      res.json({ success: true, data: books.length ? books[0] : null, message: '搜索成功' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

// 发布书籍（带图片上传）
router.post(
  '/publishBook',
  (req, res, next) => req.app.locals.upload.array('images', 3)(req, res, next),
  [
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
      // 处理图片
      const images = req.files ? req.files.map(file => `/uploads/${file.filename}`) : [];
      if (images.length === 0) {
        return res.status(400).json({ success: false, message: '书籍封面不能为空，请上传图片' });
      }
      const bookId = `book_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      // 插入数据库
      await db.query(
        'INSERT INTO books (id, title, price, description, images, status, seller_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [bookId, title, parseFloat(price), description || '', JSON.stringify(images), status || 'available', sellerId]
      );
      const newBook = {
        id: bookId,
        title,
        price: parseFloat(price),
        description: description || '',
        images,
        status: status || 'available',
        seller_id: sellerId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      res.json({ success: true, data: newBook, message: '发布成功' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

// 根据ID获取书籍
router.post('/getBookById',
  [body('bookId').notEmpty().withMessage('书籍ID不能为空'), validateParams],
  async (req, res) => {
    try {
      const { bookId } = req.body;
      const db = getDb();
      const [books] = await db.query('SELECT * FROM books WHERE id = ?', [bookId]);
      if (books.length) {
        books[0].images = JSON.parse(books[0].images || '[]');
      }
      res.json({ success: true, data: books.length ? books[0] : null, message: '获取成功' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

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
      const transId = `trans_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await db.query(
        'INSERT INTO transactions (id, book_id, seller_id, buyer_id, buyer_amount, seller_amount) VALUES (?, ?, ?, ?, ?, ?)',
        [transId, bookId, sellerId, buyerId, parseFloat(buyerAmount) || 0, parseFloat(sellerAmount) || 0]
      );
      const newTransaction = {
        id: transId,
        book_id: bookId,
        seller_id: sellerId,
        buyer_id: buyerId,
        buyer_amount: parseFloat(buyerAmount) || 0,
        seller_amount: parseFloat(sellerAmount) || 0,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      res.json({ success: true, data: newTransaction, message: '创建成功' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

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
      const [existingUsers] = await db.query('SELECT * FROM users WHERE openid = ?', [openid]);
      const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      if (existingUsers.length) {
        // 更新
        await db.query('UPDATE users SET user_info = ? WHERE openid = ?', [JSON.stringify(userInfo || {}), openid]);
      } else {
        // 新增
        await db.query(
          'INSERT INTO users (id, openid, user_info) VALUES (?, ?, ?)',
          [userId, openid, JSON.stringify(userInfo || {})]
        );
      }
      res.json({ success: true, data: { openid }, message: '保存成功' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

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
      let sql = 'SELECT * FROM books WHERE seller_id = ?';
      let params = [userId];
      if (status) {
        sql += ' AND status = ?';
        params.push(status);
      }
      sql += ' ORDER BY created_at DESC';
      const [books] = await db.query(sql, params);
      books.forEach(book => {
        book.images = JSON.parse(book.images || '[]');
      });
      res.json({ success: true, data: books, message: '获取成功' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

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
      let sql = 'SELECT * FROM transactions WHERE ';
      let params = [];
      if (type === 'buyer') {
        sql += 'buyer_id = ?';
        params.push(userId);
      } else if (type === 'seller') {
        sql += 'seller_id = ?';
        params.push(userId);
      } else {
        sql += '(buyer_id = ? OR seller_id = ?)';
        params.push(userId, userId);
      }
      sql += ' ORDER BY created_at DESC';
      const [transactions] = await db.query(sql, params);
      res.json({ success: true, data: transactions, message: '获取成功' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

// 获取用户消息
router.post('/getUserMessages',
  [body('userId').notEmpty().withMessage('用户ID不能为空'), validateParams],
  async (req, res) => {
    try {
      const { userId } = req.body;
      const db = getDb();
      const [messages] = await db.query(
        'SELECT * FROM messages WHERE receiver_id = ? ORDER BY created_at DESC',
        [userId]
      );
      res.json({ success: true, data: messages, message: '获取成功' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

// 标记消息为已读
router.post('/markMessageAsRead',
  [body('messageId').notEmpty().withMessage('消息ID不能为空'), validateParams],
  async (req, res) => {
    try {
      const { messageId } = req.body;
      const db = getDb();
      await db.query('UPDATE messages SET is_read = 1 WHERE id = ?', [messageId]);
      res.json({ success: true, data: null, message: '更新成功' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

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
      const msgId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await db.query(
        'INSERT INTO messages (id, transaction_id, sender_id, receiver_id, content, is_read) VALUES (?, ?, ?, ?, ?, ?)',
        [msgId, transactionId || null, senderId, receiverId, content, isRead ? 1 : 0]
      );
      const newMessage = {
        id: msgId,
        transaction_id: transactionId || null,
        sender_id: senderId,
        receiver_id: receiverId,
        content,
        is_read: isRead || false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      res.json({ success: true, data: newMessage, message: '创建成功' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

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
      await db.query('UPDATE books SET status = ? WHERE id = ?', [status, bookId]);
      res.json({ success: true, data: null, message: '更新成功' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

// 获取热门书籍
router.post('/getHotBooks', async (req, res) => {
  try {
    const db = getDb();
    const [books] = await db.query(
      'SELECT * FROM books WHERE status = ? ORDER BY created_at DESC LIMIT 10',
      ['available']
    );
    books.forEach(book => {
      book.images = JSON.parse(book.images || '[]');
    });
    res.json({ success: true, data: books, message: '获取成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 获取常购书籍
router.post('/getPopularBooks', async (req, res) => {
  try {
    const db = getDb();
    const [books] = await db.query(
      'SELECT * FROM books WHERE status = ? ORDER BY created_at DESC LIMIT 10',
      ['available']
    );
    books.forEach(book => {
      book.images = JSON.parse(book.images || '[]');
    });
    res.json({ success: true, data: books, message: '获取成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 根据ID获取交易
router.post('/getTransactionById',
  [body('transactionId').notEmpty().withMessage('交易ID不能为空'), validateParams],
  async (req, res) => {
    try {
      const { transactionId } = req.body;
      const db = getDb();
      const [transactions] = await db.query('SELECT * FROM transactions WHERE id = ?', [transactionId]);
      res.json({ success: true, data: transactions.length ? transactions[0] : null, message: '获取成功' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

module.exports = router;
