const express = require('express');
const fetch = require('node-fetch');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

const API_KEY = process.env.SHOPIFY_API_KEY;
const ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const SHOP_NAME = process.env.SHOPIFY_SHOP_NAME || 'eclatyu';
const API_VERSION = '2023-01';
const BASE_URL = `https://${API_KEY}:${ACCESS_TOKEN}@${SHOP_NAME}.myshopify.com/admin/api/${API_VERSION}`;

app.get('/', (req, res) => {
  res.send('Welcome to Redemption Code App!');
});

async function validateRedemptionCode(code) {
  const url = `${BASE_URL}/discount_codes.json`;
  const response = await fetch(url, {
    method: 'GET',
    headers: { 'X-Shopify-Access-Token': ACCESS_TOKEN }
  });
  const discounts = await response.json();
  for (const discount of discounts.discount_codes) {
    if (discount.code === code) {
      return 50; // 固定返回 50 积分
    }
  }
  return null;
}

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

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
