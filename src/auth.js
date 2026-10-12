// admin 鉴权：校验 ?token= 或 x-admin-token 头
const config = require('./config');

function requireToken(req, res, next) {
  const token = req.query.token || req.headers['x-admin-token'];
  if (token && token === config.adminToken) return next();
  return res.status(401).json({ error: '未授权：缺少或错误的 admin token' });
}

module.exports = { requireToken };
