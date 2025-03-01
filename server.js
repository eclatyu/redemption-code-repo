const express = require('express');
const fetch = require('node-fetch');
const app = express();
const port = process.env.PORT || 3000; // 使用 Heroku 的动态端口

app.use(express.json());

// 从环境变量读取密钥
const API_KEY = process.env.SHOPIFY_API_KEY;
const ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const SHOP_NAME = process.env.SHOPIFY_SHOP_NAME || 'eclatyu';
const API_VERSION = '2023-01';
const BASE_URL = `https://${API_KEY}:${ACCESS_TOKEN}@${SHOP_NAME}.myshopify.com/admin/api/${API_VERSION}`;

// 添加根路径路由
app.get('/', (req, res) => {
  res.send('Welcome to Redemption Code App!'); // 当访问根路径时返回欢迎消息
});

// 验证兑换码
async function validateRedemptionCode(code) {
  const url = `${BASE_URL}/discount_codes.json`;
  const response = await fetch(url, {
    headers: { 'X-Shopify-Access-Token': ACCESS_TOKEN }
  });
  const discounts = await response.json();
  for (const discount of discounts.discount_codes) {
    if (discount.code === code) {
      return 50; // 假设每个兑换码值 50 积分
    }
  }
  return null;
}

// 获取客户积分
async function getCustomerPoints(customerId) {
  const url = `${BASE_URL}/customers/${customerId}/metafields.json`;
  const response = await fetch(url, {
    headers: { 'X-Shopify-Access-Token': ACCESS_TOKEN }
  });
  const metafields = await response.json();
  for (const field of metafields.metafields) {
    if (field.namespace === 'carbon' && field.key === 'points') {
      return parseInt(field.value) || 0;
    }
  }
  return 0;
}

// 更新客户积分
async function updateCustomerPoints(customerId, points) {
  const url = `${BASE_URL}/customers/${customerId}/metafields.json`;
  const data = {
    metafield: {
      namespace: 'carbon',
      key: 'points',
      value: points.toString(),
      type: 'integer'
    }
  };
  await fetch(url, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': ACCESS_TOKEN,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });
}

// 处理兑换请求
app.post('/redeem', async (req, res) => {
  const { code, customerId } = req.body;
  const pointsValue = await validateRedemptionCode(code);
  
  if (pointsValue) {
    const currentPoints = await getCustomerPoints(customerId);
    const newPoints = currentPoints + pointsValue;
    await updateCustomerPoints(customerId, newPoints);
    res.json({ message: `兑换成功！增加了 ${pointsValue} 积分，总积分：${newPoints}` });
  } else {
    res.status(400).json({ message: '兑换码无效' });
  }
});

// 启动服务器
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});