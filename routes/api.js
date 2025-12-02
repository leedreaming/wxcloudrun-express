const express = require('express');
const {getDb} = require('../database');
const router = express.Router();

// 获取openid接口
router.get('/getOpenid', async (req, res) => {
  try {
    // 模拟获取openid，实际应用中应该通过微信API获取
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
router.post('/getBooks', async (req, res) => {
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
router.post('/searchBook', async (req, res) => {
  try {
    const { title } = req.body;
    const db = getDb();
    const collection = db.collection('books');
    
    if (!title) {
      return res.status(400).json({
        success: false,
        message: '书名不能为空'
      });
    }
    
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

// 发布书籍
router.post('/publishBook', async (req, res) => {
  try {
    const { title, price, description, imageUrl, status, sellerId } = req.body;
    const db = getDb();
    const collection = db.collection('books');
    
    // 验证必填字段
    if (!title || !price || !imageUrl) {
      return res.status(400).json({
        success: false,
        message: '书名、价格和图片不能为空'
      });
    }
    
    const newBook = {
      _id: `book_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title,
      price: parseFloat(price),
      description: description || '',
      imageUrl,
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

// 根据ID获取书籍
router.post('/getBookById', async (req, res) => {
  try {
    const { bookId } = req.body;
    const db = getDb();
    const collection = db.collection('books');
    
    if (!bookId) {
      return res.status(400).json({
        success: false,
        message: '书籍ID不能为空'
      });
    }
    
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
router.post('/createTransaction', async (req, res) => {
  try {
    const { bookId, sellerId, buyerId, buyerAmount, sellerAmount } = req.body;
    const db = getDb();
    const collection = db.collection('transactions');
    
    // 验证必填字段
    if (!bookId || !sellerId || !buyerId) {
      return res.status(400).json({
        success: false,
        message: '书籍ID、卖家ID和买家ID不能为空'
      });
    }
    
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
router.post('/saveUser', async (req, res) => {
  try {
    const { openid, userInfo } = req.body;
    const db = getDb();
    const collection = db.collection('users');
    
    const existingUser = await collection.findOne({ _openid: openid });
    
    if (existingUser) {
      // 更新用户信息
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
      // 创建新用户
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
router.post('/getUserBooks', async (req, res) => {
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
router.post('/getUserTransactions', async (req, res) => {
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
router.post('/getUserMessages', async (req, res) => {
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
router.post('/markMessageAsRead', async (req, res) => {
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
router.post('/createMessage', async (req, res) => {
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
router.post('/updateBookStatus', async (req, res) => {
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
router.post('/getTransactionById', async (req, res) => {
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
