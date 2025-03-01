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

// 获取客户积分（添加错误处理）
async function getCustomerPoints(customerId) {
  try {
    const url = `${BASE_URL}/customers/${customerId}/metafields.json`;
    const response = await fetch(url, {
      headers: { 'X-Shopify-Access-Token': ACCESS_TOKEN }
    });

    if (!response.ok) {
      throw new Error(`Shopify API 请求失败，状态码: ${response.status}`);
    }

    const metafields = await response.json();
    // 检查 metafields 是否存在且是一个数组
    const metafieldArray = metafields.metafields || [];
    for (const field of metafieldArray) {
      if (field.namespace === 'carbon' && field.key === 'points') {
        return parseInt(field.value) || 0;
      }
    }
    return 0; // 如果没有找到相关元字段，返回 0
  } catch (error) {
    console.error('获取客户积分时出错:', error.message);
    return 0; // 发生错误时返回 0，避免应用崩溃
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
      throw new Error(`更新客户积分失败，状态码: ${response.status}`);
    }
  } catch (error) {
    console.error('更新客户积分时出错:', error.message);
    throw error; // 抛出错误以便上层处理
  }
}

// 生成折扣码
async function createDiscountCode(customerId, points) {
  try {
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

    if (!priceRuleResponse.ok) {
      throw new Error(`创建价格规则失败，状态码: ${priceRuleResponse.status}`);
    }

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

    if (!discountCodeResponse.ok) {
      throw new Error(`创建折扣码失败，状态码: ${discountCodeResponse.status}`);
    }

    const discountCode = await discountCodeResponse.json();
    return discountCode.discount_code.code;
  } catch (error) {
    console.error('生成折扣码时出错:', error.message);
    throw error;
  }
}

// 处理兑换码请求
app.post('/redeem', async (req, res) => {
  try {
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
  } catch (error) {
    console.error('处理兑换码请求时出错:', error.message);
    res.status(500).json({ message: '服务器内部错误，请稍后重试' });
  }
});

// 处理积分抵扣请求
app.post('/apply-points', async (req, res) => {
  try {
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
  } catch (error) {
    console.error('处理积分抵扣请求时出错:', error.message);
    res.status(500).json({ message: '服务器内部错误，请稍后重试' });
  }
});

// 启动服务器
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
