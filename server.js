// AKEEYO 数字面试工具 — 后端入口
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');

const config = require('./src/config');
const store = require('./src/store');
const { scoreSubmission, saveManualScore } = require('./src/scorer');
const { generateHtml } = require('./src/report');
const { requireToken } = require('./src/auth');
const { INQUIRY_ANCHORS, ORAL_ANCHORS } = require('./src/prompts');
const game = require('./src/gamePrompts');
const { callJSON } = require('./src/llm');

const app = express();
app.use(express.json());
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 20 },
});

// 静态资源（候选页 / 管理页 / 样式）
app.use(express.static(path.join(__dirname, 'public')));

// 健康检查
app.get('/healthz', (req, res) => res.json({ ok: true }));

// ===== 游戏化询盘（AI 买家 + 4 专家评委） =====
// 前端会话 → 服务器侧买家档案（候选人不可见）
const gameSessions = new Map(); // sid -> { buyer, createdAt, turns }

function gameAvailable() {
  return config.llmProvider === 'deepseek' && !!config.deepseek.apiKey;
}

app.get('/api/game/config', (req, res) => {
  res.json({ enabled: gameAvailable() });
});

// 简易限流：每 IP 并发游戏会话上限（防刷）
const GAME_MAX_SESSIONS_PER_IP = 3;
const ipSessionCount = new Map();

app.post('/api/game/start', async (req, res) => {
  try {
    if (!gameAvailable()) return res.status(503).json({ error: '游戏模式未启用（未配置 DEEPSEEK_API_KEY）' });
    const ip = req.ip;
    const cnt = ipSessionCount.get(ip) || 0;
    if (cnt >= GAME_MAX_SESSIONS_PER_IP) return res.status(429).json({ error: '会话数超限，请稍后再试' });
    ipSessionCount.set(ip, cnt + 1);

    const buyer = game.composeBuyer();
    // 用 LLM 生成开场白（保持人设一致）
    let opening = '';
    try {
      const r = await callJSON({ system: game.combinedSystemPrompt(buyer), user: game.openingPrompt(buyer), temperature: 0.9 });
      opening = (r && r.opening) || '';
    } catch (e) {
      // 开场生成失败时兜底
      opening = 'Hello, I found your AKEEYO dash cams online. We are interested — could you tell me more?';
    }
    const sid = crypto.randomUUID();
    gameSessions.set(sid, { buyer, createdAt: Date.now(), turns: 0 });

    // 清理 2 小时以上的旧会话
    if (gameSessions.size > 500) {
      const now = Date.now();
      for (const [k, v] of gameSessions) if (now - v.createdAt > 2 * 3600e3) gameSessions.delete(k);
    }

    res.json({
      sid,
      opening,
      // 公开信息（候选人可见）：场景/风格/目标，不暴露人物特性与规则细节
      scenario: buyer.scenario.zh,
      style: buyer.style.zh,
      goal: buyer.goal.zh,
    });
  } catch (e) {
    res.status(500).json({ error: '开局失败：' + e.message });
  }
});

app.post('/api/game/turn', async (req, res) => {
  try {
    if (!gameAvailable()) return res.status(503).json({ error: '游戏模式未启用' });
    const { sid, history, message, turnNo, maxTurns } = req.body || {};
    const sess = gameSessions.get(sid);
    if (!sess) return res.status(404).json({ error: '会话不存在或已过期，请刷新重开' });
    if (sess.turns >= (maxTurns || 12)) return res.status(400).json({ error: '轮次已用完' });
    if (!message || typeof message !== 'string' || !message.trim()) return res.status(400).json({ error: '消息为空' });
    if (!Array.isArray(history)) return res.status(400).json({ error: 'history 格式错误' });
    sess.turns++;

    const r = await callJSON({
      system: game.combinedSystemPrompt(sess.buyer),
      user: game.turnUserPrompt(sess.buyer, history.slice(-24), message.slice(0, 2000), turnNo || sess.turns, maxTurns || 12),
      temperature: 0.8,
    });

    // 结构校验与兜底
    const reply = r && typeof r.reply === 'string' && r.reply.trim() ? r.reply.trim() : 'Hmm, could you clarify that?';
    let judges = Array.isArray(r && r.judges) ? r.judges : [];
    const keys = ['behavior', 'interpersonal', 'nego', 'etiquette'];
    const names = { behavior: '行为说服专家', interpersonal: '人际说服专家', nego: '谈判策略专家', etiquette: '商务礼仪专家' };
    judges = keys.map((k) => {
      const j = judges.find((x) => x && x.key === k) || {};
      return {
        key: k,
        name: j.name || names[k],
        verdict: ['good', 'bad', 'neutral'].includes(j.verdict) ? j.verdict : 'neutral',
        comment: typeof j.comment === 'string' && j.comment.trim() ? j.comment.trim() : '（本轮无明显信号）',
      };
    });
    const trust = Math.max(0, Math.min(5, Math.round(Number(r && r.trust) || 2)));
    const contactGiven = !!(r && r.contactGiven);

    res.json({ reply, judges, trust, contactGiven, gameOver: contactGiven || !!(r && r.gameOver) });
  } catch (e) {
    res.status(500).json({ error: '买家响应失败：' + e.message });
  }
});

// 提交（multipart：meta / inquiry / oral 为 JSON 文本，audio_qN 为音频 Blob）
app.post('/api/submit', upload.any(), async (req, res) => {
  try {
    let meta, inquiry, oral;
    try {
      meta = JSON.parse(req.body.meta || '{}');
      inquiry = JSON.parse(req.body.inquiry || '{}');
      oral = JSON.parse(req.body.oral || '[]');
    } catch (e) {
      return res.status(400).json({ error: '字段解析失败：' + e.message });
    }
    if (!Array.isArray(oral)) oral = [];

    const id = crypto.randomUUID();
    // 写音频文件
    const audioRefs = [];
    for (const f of req.files || []) {
      const m = /^audio_q(\d+)$/.exec(f.fieldname);
      if (!m) continue;
      const idx = parseInt(m[1], 10);
      const fname = `${id}_${f.fieldname}.webm`;
      await fs.promises.writeFile(path.join(config.paths.uploadsDir, fname), f.buffer);
      audioRefs.push(fname);
      if (oral[idx]) oral[idx].audioRef = fname;
    }

    const sub = {
      id,
      createdAt: new Date().toISOString(),
      status: 'pending',
      candidate: meta,
      inquiry,
      oral,
      audioRefs,
      antiCheat: {
        pasteBlocked: true,
        userAgent: req.headers['user-agent'] || '',
        ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '',
      },
    };
    await store.saveSubmission(sub);

    // 评分分流：manual 模式等 HR 在评分台打分；auto 模式异步调 LLM
    if (config.scoreMode === 'manual') {
      await store.updateSubmission(id, { status: 'pending', llmRaw: { source: 'manual' } });
      return res.json({ id, status: 'pending', reportUrl: `/report/${id}` });
    }

    // 异步评分（不阻塞响应）
    scoreSubmission(id).catch((err) => {
      console.error('[评分失败]', id, err.message);
      store.updateSubmission(id, {
        status: 'pending',
        llmRaw: { error: '评分失败：' + err.message + '（可在后台点"重评"重试）' },
      });
    });

    res.json({ id, status: 'scoring', reportUrl: `/report/${id}` });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '服务器错误：' + e.message });
  }
});

// 列表
app.get('/api/submissions', requireToken, async (req, res) => {
  const list = await store.listSubmissions();
  res.json(list);
});

// 单条 JSON
app.get('/api/report/:id', requireToken, async (req, res) => {
  const sub = await store.getSubmission(req.params.id);
  if (!sub) return res.status(404).json({ error: 'not found' });
  res.json(sub);
});

// 音频
app.get('/api/audio/:id/:qid', requireToken, async (req, res) => {
  const sub = await store.getSubmission(req.params.id);
  if (!sub) return res.status(404).json({ error: 'not found' });
  const idx = (sub.oral || []).findIndex((o) => o.qId === req.params.qid);
  if (idx < 0 || !sub.oral[idx].audioRef) return res.status(404).json({ error: 'no audio' });
  const fp = path.join(config.paths.uploadsDir, sub.oral[idx].audioRef);
  res.sendFile(fp);
});

// 人工评分保存（评分台提交）
app.post('/api/score/:id', requireToken, async (req, res) => {
  try {
    const result = await saveManualScore(req.params.id, req.body || {});
    res.json({ ok: true, overallScore: result.scores.overallScore, tier: result.scores.tier });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Rubric 元数据（评分台渲染维度/权重/锚点用）
app.get('/api/rubric', requireToken, (req, res) => {
  res.json({
    scoreMode: config.scoreMode,
    weights: config.weights,
    tiers: config.tiers,
    inquiryDims: config.inquiryDims,
    oralDims: config.oralDims,
    anchors: { inquiry: INQUIRY_ANCHORS, oral: ORAL_ANCHORS },
  });
});

// 重评（仅 auto 模式有意义，保留兼容）
app.post('/api/rescore/:id', requireToken, async (req, res) => {
  const sub = await store.getSubmission(req.params.id);
  if (!sub) return res.status(404).json({ error: 'not found' });
  await store.updateSubmission(req.params.id, { status: 'scoring' });
  scoreSubmission(req.params.id)
    .then(() => res.json({ status: 'scored' }))
    .catch((err) => {
      store.updateSubmission(req.params.id, { status: 'pending', llmRaw: { error: '重评失败：' + err.message } });
      res.status(500).json({ error: err.message });
    });
});

// HTML 报告页（需 token）
app.get('/report/:id', requireToken, async (req, res) => {
  const sub = await store.getSubmission(req.params.id);
  if (!sub) return res.status(404).send('<h1>未找到该测评</h1>');
  const html = generateHtml(sub, req.query.token);
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

// 管理页
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

const PORT = config.port;
app.listen(PORT, () => {
  console.log(`AKEEYO 数字面试工具已启动： http://localhost:${PORT}`);
  console.log(`LLM 服务商：${config.llmProvider} ｜ Mock评分：${config.mockScore ? '开' : '关'}`);
  console.log(`后台地址： http://localhost:${PORT}/admin?token=${config.adminToken}`);
});
