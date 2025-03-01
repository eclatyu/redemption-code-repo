const express = require('express');
const fetch = require('node-fetch');
const app = express();

// 使用 Heroku 分配的端口或默认 3000
const port = process.env.PORT || 3000;

app.use(express.json());

// 从环境变量读取 Shopify 配置
const API_KEY = process.env.SHOPIFY_API_KEY;
const ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const SHOP_NAME = process.env.SHOPIFY_SHOP_NAME || 'eclatyu'; // 默认值，可在 Heroku 配置中覆盖
const API_VERSION = '2023-01';
const BASE_URL = `https://${API_KEY}:${ACCESS_TOKEN}@${SHOP_NAME}.myshopify.com/admin/api/${API_VERSION}`;

// 验证兑换码
async function validateRedemptionCode(code) {
  const url = `${BASE_URL}/discount_codes.json`;
  const response = await fetch(url, {
    headers: { 'X-Shopify-Access-Token': ACCESS_TOKEN }
  });
  const discounts = await response.json();
  for (const discount of discounts.discount_codes) {
    if (discount.code === code) {
      return 50; // 假设每个兑换码值 50 积分，可根据需要调整
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

// 处理积分抵扣请求
app.post('/apply-points', async (req, res) => {
  const { points, customerId } = req.body;
  const currentPoints = await getCustomerPoints(customerId);
  
  if (points > currentPoints) {
    return res.status(400).json({ message: '积分不足' });
  }

  const discountAmount = points; // 假设 1 积分 = 1 美元
  const discountCode = `CARBON_${customerId}_${Date.now()}`;
  
  // 创建折扣规则
  const priceRuleUrl = `${BASE_URL}/price_rules.json`;
  const priceRuleData = {
    price_rule: {
      title: discountCode,
      target_type: 'line_item',
      target_selection: 'all',
      allocation_method: 'across',
      value_type: 'fixed_amount',
      value: `-${discountAmount}`,
      customer_selection: 'all',
      starts_at: new Date().toISOString()
    }
  };
  const priceRuleResponse = await fetch(priceRuleUrl, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': ACCESS_TOKEN,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(priceRuleData)
  });
  const priceRuleId = (await priceRuleResponse.json()).price_rule.id;

  // 创建折扣码
  const discountUrl = `${BASE_URL}/discount_codes.json`;
  const discountData = {
    discount_code: {
      price_rule_id: priceRuleId,
      code: discountCode
    }
  };
  await fetch(discountUrl, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': ACCESS_TOKEN,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(discountData)
  });

  // 更新积分
  const newPoints = currentPoints - points;
  await updateCustomerPoints(customerId, newPoints);
  
  res.json({ message: `已生成折扣码 ${discountCode}，抵扣 ${discountAmount} 元` });
});

// 启动服务器
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});