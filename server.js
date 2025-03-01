const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser'); // 用于解析请求体

const app = express();
const port = process.env.PORT || 3000; // Heroku 动态端口

// 启用 CORS，允许跨域请求
app.use(cors({
  origin: 'https://eclatayu.com', // 允许来自您的 Shopify 网站
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

// 解析 JSON 和 URL-encoded 请求体
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 示例兑换码验证函数（可替换为您的实际逻辑）
async function validateRedemptionCode(code) {
  const validCodes = {
    'CARBON50': 50 // 示例：CARBON50 兑换 50 积分
  };
  return validCodes[code] || null;
}

// 处理 POST /redeem 请求
app.post('/redeem', async (req, res) => {
  try {
    const { code, customerId } = req.body;
    console.log(`收到兑换请求: code=${code}, customerId=${customerId}`);

    // 验证请求参数
    if (!code || !customerId) {
      return res.status(400).json({ message: '缺少兑换码或客户 ID' });
    }

    // 验证兑换码
    const pointsValue = await validateRedemptionCode(code);
    if (!pointsValue) {
      return res.status(400).json({ message: '兑换码无效' });
    }

    // TODO: 在此添加更新客户积分的逻辑，例如调用 Shopify API
    // await updateCustomerPoints(customerId, pointsValue);

    // 返回成功响应
    res.json({ message: `兑换成功！增加了 ${pointsValue} 积分` });
  } catch (error) {
    console.error(`处理兑换请求失败: ${error.message}`);
    res.status(500).json({ message: '服务器内部错误，请稍后重试' });
  }
});

// 处理未定义的 GET 请求，避免“cannot get”错误
app.get('*', (req, res) => {
  res.status(404).send('Cannot GET: 路由未定义');
});

// 启动服务器
app.listen(port, () => {
  console.log(`服务器运行在端口 ${port}`);
});
