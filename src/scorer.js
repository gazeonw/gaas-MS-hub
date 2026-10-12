// 评分编排：调用 LLM 对询盘回复 + 口语打分，加权汇总，映射五档，写回存储
const config = require('./config');
const { buildInquiryPrompt, buildOralPrompt } = require('./prompts');
const { generateJSON } = require('./llm');
const store = require('./store');

function clamp(n) {
  n = Number(n);
  if (isNaN(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function tierOf(score) {
  for (const t of config.tiers) {
    if (score >= t.min) return t.label;
  }
  return '淘汰';
}

async function scoreOne(promptBuilder, material, dims) {
  const { system, user } = promptBuilder(material);
  const keys = dims.map((d) => d.key);
  const result = await generateJSON({ system, user, dimKeys: keys });
  const dimsOut = {};
  let weighted = 0;
  for (const d of dims) {
    const cell = result.dimensions?.[d.key] || {};
    const score = clamp(cell.score);
    dimsOut[d.key] = {
      label: d.label,
      weight: d.weight,
      score,
      comment: typeof cell.comment === 'string' ? cell.comment : '',
    };
    weighted += d.weight * score;
  }
  return { dimsOut, score: Math.round(weighted), raw: result };
}

async function scoreSubmission(id) {
  const sub = await store.getSubmission(id);
  if (!sub) throw new Error('submission not found: ' + id);

  const inquiryRes = await scoreOne(
    buildInquiryPrompt,
    {
      inquiryText: sub.inquiry?.promptText || '',
      replyText: sub.inquiry?.replyText || '',
      dims: config.inquiryDims,
    },
    config.inquiryDims
  );

  const oralQuestions = (sub.oral || [])
    .map((o, i) => `Q${i + 1}. ${o.questionText}`)
    .join('\n');
  const oralTranscript = (sub.oral || [])
    .map((o, i) => `Q${i + 1} [${o.questionText}]\n${o.transcript || '(空)'}`)
    .join('\n\n');

  const oralRes = await scoreOne(
    buildOralPrompt,
    { questionText: oralQuestions, transcript: oralTranscript, dims: config.oralDims },
    config.oralDims
  );

  const inquiryScore = inquiryRes.score;
  const oralScore = oralRes.score;
  const overallScore = Math.round(
    config.weights.inquiry * inquiryScore + config.weights.oral * oralScore
  );

  const scores = {
    inquiryDims: inquiryRes.dimsOut,
    inquiryScore,
    oralDims: oralRes.dimsOut,
    oralScore,
    overallScore,
    tier: tierOf(overallScore),
    weights: { ...config.weights },
    pronunciationFlag: '需人工听音频确认发音精度',
  };

  const llmRaw = {
    inquiry_comment: inquiryRes.raw.overall_comment || '',
    oral_comment: oralRes.raw.overall_comment || '',
    strengths: inquiryRes.raw.strengths || [],
    risks: inquiryRes.raw.risks || [],
    pronunciation_note: oralRes.raw.pronunciation_note || scores.pronunciationFlag,
  };

  await store.updateSubmission(id, { status: 'scored', scores, llmRaw });
  return { id, scores };
}

// 人工评分：接收 11 维分数 + 评语 + 综合评语/亮点/风险，服务端按 config 权重计算总分与分档
async function saveManualScore(id, payload) {
  const sub = await store.getSubmission(id);
  if (!sub) throw new Error('submission not found: ' + id);

  function build(dims, input) {
    const out = {};
    let weighted = 0;
    for (const d of dims) {
      const cell = (input || {})[d.key];
      const raw = cell ? Number(cell.score) : NaN;
      if (cell == null || cell.score === '' || isNaN(raw)) {
        throw new Error('缺少维度分：' + d.label);
      }
      const score = clamp(raw);
      out[d.key] = {
        label: d.label,
        weight: d.weight,
        score,
        comment: typeof cell.comment === 'string' ? cell.comment : '',
      };
      weighted += d.weight * score;
    }
    return { dims: out, score: Math.round(weighted) };
  }

  const inq = build(config.inquiryDims, payload.inquiryDims);
  const oral = build(config.oralDims, payload.oralDims);
  const overallScore = Math.round(config.weights.inquiry * inq.score + config.weights.oral * oral.score);

  const scores = {
    inquiryDims: inq.dims,
    inquiryScore: inq.score,
    oralDims: oral.dims,
    oralScore: oral.score,
    overallScore,
    tier: tierOf(overallScore),
    weights: { ...config.weights },
    pronunciationFlag: '需人工听音频确认发音精度',
  };

  const llmRaw = {
    source: 'manual',
    overall_comment: typeof payload.overallComment === 'string' ? payload.overallComment : '',
    strengths: Array.isArray(payload.strengths) ? payload.strengths.map(String).filter((x) => x.trim()) : [],
    risks: Array.isArray(payload.risks) ? payload.risks.map(String).filter((x) => x.trim()) : [],
    pronunciation_note: scores.pronunciationFlag,
    scoredAt: new Date().toISOString(),
  };

  await store.updateSubmission(id, { status: 'scored', scores, llmRaw });
  return { id, scores };
}

module.exports = { scoreSubmission, saveManualScore };
