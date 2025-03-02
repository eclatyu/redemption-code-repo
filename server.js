const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const port = process.env.PORT || 3000;

// 启用 CORS，允许来自 eclatyu.com 的请求
app.use(cors({
  origin: 'https://eclatyu.com',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

// 解析请求体
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 验证兑换码（示例逻辑）
async function validateRedemptionCode(code) {
  const validCodes = { 'CARBON50': 50 }; // 示例兑换码和积分
  return validCodes[code] || null;
}

// 处理 POST /redeem 请求
app.post('/redeem', async (req, res) => {
  const { code, customerId } = req.body;
  if (!code || !customerId) {
    return res.status(400).json({ message: '缺少兑换码或客户 ID' });
  }
  const pointsValue = await validateRedemptionCode(code);
  if (!pointsValue) {
    return res.status(400).json({ message: '兑换码无效' });
  }
  res.json({ message: `兑换成功！增加了 ${pointsValue} 积分` });
});

// 处理 GET / 请求
app.get('/', (req, res) => {
  res.send('欢迎访问兑换码服务器！');
});

// 启动服务器
app.listen(port, () => {
  console.log(`服务器运行在端口 ${port}`);
});
