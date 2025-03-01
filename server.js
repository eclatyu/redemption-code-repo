const express = require('express');
const fetch = require('node-fetch');
const app = express();
const port = process.env.PORT || 3000;

// 添加中间件以解析 JSON 和 URL 编码格式的请求体
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 从环境变量读取密钥
const API_KEY = process.env.SHOPIFY_API_KEY;
const ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const SHOP_NAME = process.env.SHOPIFY_SHOP_NAME || 'eclatyu';
const API_VERSION = '2023-10'; // 使用最新API版本
const BASE_URL = `https://${API_KEY}:${ACCESS_TOKEN}@${SHOP_NAME}.myshopify.com/admin/api/${API_VERSION}`;

// 根路径路由
app.get('/', (req, res) => {
  res.send('Welcome to Redemption Code App!');
});

// 验证兑换码（模拟兑换码列表）
async function validateRedemptionCode(code) {
  // 模拟兑换码验证（可以用数据库替换）
  const validCodes = {
    'CARBON50': 50, // 兑换码CARBON50值50积分
    'CARBON100': 100 // 兑换码CARBON100值100积分
  };
  return validCodes[code] || null;
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
  await fetch(url, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': ACCESS_TOKEN,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });
}

// 生成折扣码
async function createDiscountCode(customerId, points) {
  const priceRuleUrl = `${BASE_URL}/price_rules.json`;
  const priceRuleData = {
    price_rule: {
      title: `Carbon Points Discount for ${customerId}`,
      target_type: "line_item",
      target_selection: "all",
      allocation_method: "across",
      value_type: "fixed_amount",
      value: `-${points}`, // 抵扣金额（积分等同于美元）
      customer_selection: "all",
      starts_at: new Date().toISOString()
    }
  };
  const priceRuleResponse = await fetch(priceRuleUrl, {
    method: "POST",
    headers: {
      'X-Shopify-Access-Token': ACCESS_TOKEN,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(priceRuleData)
  });
  const priceRule = await priceRuleResponse.json();

  const discountCodeUrl = `${BASE_URL}/price_rules/${priceRule.price_rule.id}/discount_codes.json`;
  const discountCodeData = {
    discount_code: {
      code: `CARBON_${customerId}_${Date.now()}`
    }
  };
  const discountCodeResponse = await fetch(discountCodeUrl, {
    method: "POST",
    headers: {
      'X-Shopify-Access-Token': ACCESS_TOKEN,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(discountCodeData)
  });
  const discountCode = await discountCodeResponse.json();
  return discountCode.discount_code.code;
}

// 处理兑换码请求
app.post('/redeem', async (req, res) => {
  const { code, customerId } = req.body;
  if (!code || !customerId) {
    return res.status(400).json({ message: '缺少兑换码或客户 ID' });
  }
  const pointsValue = await validateRedemptionCode(code);
  
  if (pointsValue) {
    await updateCustomerPoints(customerId, pointsValue);
    res.json({ message: `兑换成功！增加了 ${pointsValue} 积分，总积分：${await getCustomerPoints(customerId)}` });
  } else {
    res.status(400).json({ message: '兑换码无效' });
  }
});

// 处理积分抵扣请求
app.post('/apply-points', async (req, res) => {
  const { points, customerId } = req.body;
  if (!points || !customerId) {
    return res.status(400).json({ message: '缺少积分或客户 ID' });
  }
  const currentPoints = await getCustomerPoints(customerId);
  
  if (points > currentPoints) {
    return res.status(400).json({ message: '积分不足' });
  }

  const discountCode = await createDiscountCode(customerId, points);
  await updateCustomerPoints(customerId, currentPoints - points);
  res.json({ message: `已生成折扣码 ${discountCode}，抵扣 ${points} 元` });
});

// 启动服务器
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
