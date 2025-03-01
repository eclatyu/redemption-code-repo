const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const port = process.env.PORT || 3000; // Heroku 动态端口

// 启用 CORS，允许跨域请求
app.use(cors({
  origin: 'https://eclatayu.com', // 您的 Shopify 网站域名
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

// 解析请求体
app.use(bodyParser.json()); // 支持 application/json
app.use(bodyParser.urlencoded({ extended: true })); // 支持 application/x-www-form-urlencoded

// 示例兑换码验证逻辑
async function validateRedemptionCode(code) {
  const validCodes = {
    'CARBON50': 50 // 示例：兑换码 CARBON50 对应 50 积分
  };
  return validCodes[code] || null;
}

// 处理 POST /redeem 请求
app.post('/redeem', async (req, res) => {
  try {
    const { code, customerId } = req.body;
    console.log(`收到请求: code=${code}, customerId=${customerId}`);

    // 检查参数是否完整
    if (!code || !customerId) {
      return res.status(400).json({ message: '缺少兑换码或客户 ID' });
    }

    // 验证兑换码
    const pointsValue = await validateRedemptionCode(code);
    if (!pointsValue) {
      return res.status(400).json({ message: '兑换码无效' });
    }

    // TODO: 添加更新客户积分的逻辑（例如调用 Shopify API）
    // await updateCustomerPoints(customerId, pointsValue);

    res.json({ message: `兑换成功！增加了 ${pointsValue} 积分` });
  } catch (error) {
    console.error(`错误: ${error.message}`);
    res.status(500).json({ message: '服务器错误，请稍后重试' });
  }
});

// 处理未定义的 GET 请求
app.get('*', (req, res) => {
  res.status(404).send('404 Not Found: 路由未定义');
});

// 启动服务器
app.listen(port, () => {
  console.log(`服务器运行在端口 ${port}`);
});
