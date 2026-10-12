// 集中读取环境变量与权重/阈值配置
require('dotenv').config();

function num(v, d) {
  const n = parseFloat(v);
  return isNaN(n) ? d : n;
}

const config = {
  port: num(process.env.PORT, 3000),
  llmProvider: (process.env.LLM_PROVIDER || 'gemini').toLowerCase(),

  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
    base: process.env.GEMINI_BASE || 'https://generativelanguage.googleapis.com/v1beta',
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  },
  deepseek: {
    apiKey: process.env.DEEPSEEK_API_KEY || '',
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    base: process.env.DEEPSEEK_BASE || 'https://api.deepseek.com',
  },

  adminToken: process.env.ADMIN_TOKEN || 'change-me-strong-token',
  maxRetry: Math.max(1, Math.floor(num(process.env.MAX_RETRY, 5))),
  mockScore: process.env.MOCK_SCORE === '1',

  // 评分模式：manual=人工评分台（默认，零 API 依赖）；auto=提交后自动调 LLM
  scoreMode: (process.env.SCORE_MODE || 'manual').toLowerCase() === 'auto' ? 'auto' : 'manual',

  // 综合分权重
  weights: {
    inquiry: num(process.env.INQUIRY_WEIGHT, 0.6),
    oral: num(process.env.ORAL_WEIGHT, 0.4),
  },

  // 五档阈值（与简历分析框架 v1.1 对齐）
  tiers: [
    { min: 95, label: '顶尖' },
    { min: 85, label: '强匹配' },
    { min: 75, label: '匹配' },
    { min: 60, label: '待定' },
    { min: 0, label: '淘汰' },
  ],

  paths: {
    dataDir: require('path').join(__dirname, '..', 'data'),
    uploadsDir: require('path').join(__dirname, '..', 'data', 'uploads'),
    submissionsFile: require('path').join(__dirname, '..', 'data', 'submissions.json'),
  },
};

// 维度权重（rubric）——与 prompts.js / scorer.js 共用
config.inquiryDims = [
  { key: 'requirementUnderstanding', label: '需求理解', weight: 0.20 },
  { key: 'pricingNegotiation', label: '报价谈判', weight: 0.20 },
  { key: 'writtenEnglish', label: '英文书面表达', weight: 0.20 },
  { key: 'productKnowledge', label: '产品行业知识', weight: 0.15 },
  { key: 'businessProfessionalism', label: '商务专业度', weight: 0.15 },
  { key: 'proactiveSourcing', label: '主动开发意识', weight: 0.10 },
];

config.oralDims = [
  { key: 'fluency', label: '流利度', weight: 0.25 },
  { key: 'contentQuality', label: '内容质量', weight: 0.25 },
  { key: 'grammar', label: '语法', weight: 0.20 },
  { key: 'vocabulary', label: '词汇', weight: 0.20 },
  { key: 'confidence', label: '沟通自信', weight: 0.10 },
];

module.exports = config;
