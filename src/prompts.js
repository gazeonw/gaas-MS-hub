// 两套评分 prompt 构造（询盘回复 / 英语口语）
// 维度锚点基于实施方案 Rubric。

const INQUIRY_ANCHORS = {
  requirementUnderstanding: '需求理解：0=答非所问、漏掉核心诉求；50=抓到主要诉求、少数细节遗漏；100=精准识别产品型号/数量/目标市场/认证/交期/预算并逐条对应。',
  pricingNegotiation: '报价谈判：0=无 MOQ/无价格/无付款条件；50=给了价但无阶梯/无付款条款；100=阶梯报价+MOQ+TT或LC+交期+样品政策+合理让利空间。',
  writtenEnglish: '英文书面表达：0=大量语法拼写错误、不地道；50=基本通顺、少量错误；100=语法精准、用词地道、句式多样、专业术语正确。',
  productKnowledge: '产品行业知识：0=不懂行车记录仪、无卖点；50=能说分辨率/夜视、缺两轮专用/认证认知；100=熟用4K/WDR/停车监控/APP/防水/两轮减震；知EU需CE/E-mark、US需FCC。',
  businessProfessionalism: '商务专业度：0=邮件无结构、称谓错、无CTA；50=结构基本完整、小瑕疵；100=专业邮件体、礼貌清晰、明确下一步动作(样品/报价单)。',
  proactiveSourcing: '主动开发意识：0=被动应答、无延伸；50=提到一两项附加；100=Upsell/交叉销售/引导长期代理/建联动作明确。',
};

const ORAL_ANCHORS = {
  fluency: '流利度：0=长时间停顿、磕巴、难以连贯；50=偶有停顿、基本连贯；100=语速自然、连贯、少填充词(um/uh)。',
  contentQuality: '内容质量：0=偏题、无细节、无逻辑；50=切题但浅；100=切题+细节+销售逻辑(挖需/价值/促单)。',
  grammar: '语法：0=时态/主谓大量错误；50=主要正确、局部错误；100=时态/句式准确、复杂句使用恰当。',
  vocabulary: '词汇：0=词穷、用词错误；50=基础词够用；100=商务/行业词汇准确丰富、搭配地道。',
  confidence: '沟通自信：0=回避、语气犹豫；50=表达尚可；100=肯定、有说服力、不回避难点。',
};

const SYSTEM = '你是资深外贸 HR 总监兼英语母语评审，精通行车记录仪(dash cam)行业与欧美 B2B 外贸全流程。请严格依据给定 rubric 的维度与权重，对候选人表现给出 0-100 分评判，并保持标准一致。只输出 JSON，不要任何额外文字。';

function buildRubricText(dims, anchors) {
  return dims
    .map((d) => `- ${d.key}（${d.label}，权重 ${Math.round(d.weight * 100)}%）：${anchors[d.key]}`)
    .join('\n');
}

function buildInquiryPrompt({ inquiryText, replyText, dims }) {
  const user = `【外商询盘原文】\n${inquiryText}\n\n【候选人英文回复】\n${replyText || '(空)'}\n\n【评分 Rubric（6 维，权重合计100%）】\n${buildRubricText(dims, INQUIRY_ANCHORS)}\n\n【输出要求】严格输出如下 JSON（score 为 0-100 整数，comment 为中文逐维评语）：\n{\n  "dimensions": {\n    "requirementUnderstanding": {"score":0,"comment":""},\n    "pricingNegotiation": {"score":0,"comment":""},\n    "writtenEnglish": {"score":0,"comment":""},\n    "productKnowledge": {"score":0,"comment":""},\n    "businessProfessionalism": {"score":0,"comment":""},\n    "proactiveSourcing": {"score":0,"comment":""}\n  },\n  "overall_comment": "该候选人询盘回复整体评语（中文）",\n  "strengths": ["亮点1","亮点2"],\n  "risks": ["风险1","风险2"]\n}`;
  return { system: SYSTEM, user };
}

function buildOralPrompt({ questionText, transcript, dims }) {
  const user = `【口语问题】\n${questionText}\n\n【候选人口语转写文本】\n${transcript || '(空)'}\n\n【评分 Rubric（5 维，权重合计100%；注意：发音精度无法从文字评定，不在此评分）】\n${buildRubricText(dims, ORAL_ANCHORS)}\n\n【输出要求】严格输出如下 JSON（score 为 0-100 整数，comment 为中文逐维评语）：\n{\n  "dimensions": {\n    "fluency": {"score":0,"comment":""},\n    "contentQuality": {"score":0,"comment":""},\n    "grammar": {"score":0,"comment":""},\n    "vocabulary": {"score":0,"comment":""},\n    "confidence": {"score":0,"comment":""}\n  },\n  "overall_comment": "该候选人英语口语整体评语（中文）",\n  "strengths": ["亮点1","亮点2"],\n  "risks": ["风险1","风险2"],\n  "pronunciation_note": "发音精度无法由文字评定，需 HR 人工听音频确认"\n}`;
  return { system: SYSTEM, user };
}

module.exports = { buildInquiryPrompt, buildOralPrompt, INQUIRY_ANCHORS, ORAL_ANCHORS };
