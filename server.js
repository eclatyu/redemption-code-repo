const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors()); // 启用 CORS，允许跨域请求
app.use(express.json()); // 解析 JSON 请求体

app.post('/redeem', (req, res) => {
  const { code, customerId } = req.body;
  if (!code || !customerId) {
    return res.status(400).json({ message: '缺少兑换码或客户 ID' });
  }
  // 处理兑换逻辑
  res.json({ message: '兑换成功' });
});

app.listen(process.env.PORT || 3000);


app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 配置环境变量
const API_KEY = process.env.SHOPIFY_API_KEY;
const ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const SHOP_NAME = process.env.SHOPIFY_SHOP_NAME || 'eclatyu';
const API_VERSION = '2023-10';
const BASE_URL = `https://${API_KEY}:${ACCESS_TOKEN}@${SHOP_NAME}.myshopify.com/admin/api/${API_VERSION}`;

// 验证兑换码
async function validateRedemptionCode(code) {
  const validCodes = {
    'CARBON50': 50, // 示例：CARBON50 兑换 50 积分
  };
  return validCodes[code] || null;
}

// 获取客户积分
async function getCustomerPoints(customerId) {
  try {
    const url = `${BASE_URL}/customers/${customerId}/metafields.json`;
    console.log(`请求获取积分: ${url}`);
    const response = await fetch(url, {
      headers: { 'X-Shopify-Access-Token': ACCESS_TOKEN }
    });
    if (!response.ok) {
      throw new Error(`Shopify API 请求失败，状态码: ${response.status}`);
    }
    const metafields = await response.json();
    const metafieldArray = metafields.metafields || [];
    for (const field of metafieldArray) {
      if (field.namespace === 'carbon' && field.key === 'points') {
        return parseInt(field.value) || 0;
      }
    }
    return 0;
  } catch (error) {
    console.error(`获取客户 ${customerId} 积分失败: ${error.message}`);
    throw error; // 向上抛出错误
  }
}

// 更新客户积分
async function updateCustomerPoints(customerId, points) {
  try {
    const url = `${BASE_URL}/customers/${customerId}/metafields.json`;
    const currentPoints = await getCustomerPoints(customerId);
    const newPoints = currentPoints + points;
    const data = {
      metafield: {
        namespace: 'carbon',
        key: 'points',
        value: newPoints.toString(),
        type: 'integer'
      }
    };
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': ACCESS_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      throw new Error(`更新积分失败，状态码: ${response.status}`);
    }
  } catch (error) {
    console.error(`更新客户 ${customerId} 积分失败: ${error.message}`);
    throw error;
  }
}

// 处理兑换请求
app.post('/redeem', async (req, res) => {
  const { code, customerId } = req.body;
  if (!code || !customerId) {
    return res.status(400).json({ message: '缺少兑换码或客户 ID' });
  }
  // 验证兑换码逻辑
  const pointsValue = (code === 'CARBON50') ? 50 : 0; // 示例
  if (!pointsValue) {
    return res.status(400).json({ message: '兑换码无效' });
  }
  // 更新客户积分逻辑（调用 Shopify API）
  res.json({ message: `兑换成功！增加了 ${pointsValue} 积分` });
});

app.listen(port, () => {
  console.log(`服务器运行在端口 ${port}`);
});
