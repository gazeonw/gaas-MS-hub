// 模型抽象层：gemini / openai，带指数退避重试 + 简单并发限流 + Mock 模式
const config = require('./config');

const MAX_CONCURRENCY = 2;
let active = 0;
const waiters = [];

function acquire() {
  return new Promise((resolve) => {
    if (active < MAX_CONCURRENCY) {
      active++;
      resolve();
    } else {
      waiters.push(resolve);
    }
  });
}
function release() {
  active--;
  if (waiters.length) {
    active++;
    waiters.shift()();
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// 去除 ```json ... ``` 包裹
function stripFence(text) {
  let t = (text || '').trim();
  const m = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (m) t = m[1].trim();
  return t;
}

async function callGemini(system, user) {
  const { apiKey, model, base } = config.gemini;
  const url = `${base}/models/${model}:generateContent?key=${apiKey}`;
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ parts: [{ text: user }] }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Gemini ${res.status}: ${txt.slice(0, 200)}`);
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini 返回为空');
  return JSON.parse(stripFence(text));
}

async function callOpenAI(system, user) {
  const { apiKey, model } = config.openai;
  const url = 'https://api.openai.com/v1/chat/completions';
  const body = {
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.2,
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`OpenAI ${res.status}: ${txt.slice(0, 200)}`);
  }
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('OpenAI 返回为空');
  return JSON.parse(stripFence(text));
}

// DeepSeek：OpenAI 兼容协议，仅 base 不同
async function callDeepSeek(system, user) {
  const { apiKey, model, base } = config.deepseek;
  const url = `${base}/chat/completions`;
  const body = {
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.2,
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`DeepSeek ${res.status}: ${txt.slice(0, 200)}`);
  }
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('DeepSeek 返回为空');
  return JSON.parse(stripFence(text));
}

// 无 Key 时的模拟评分（便于先跑通前端，不消耗 API）
function mockScore(system, user) {
  const len = (user || '').length;
  const base = Math.min(92, Math.max(42, Math.round(45 + len / 25)));
  const jitter = (k) => Math.max(0, Math.min(100, base + ((k.length * 7) % 11) - 5));
  return {
    dimensions: {
      // 在 scorer 中按传入 keys 映射；此处仅给通用值，scorer 用 dimKeys 重新组织
      _mockBase: base,
    },
    overall_comment: '【模拟评分·未接通真实大模型】请配置 LLM_API_KEY 后重新评分（后台点"重评"）。',
    strengths: ['（模拟）结构完整', '（模拟）要点覆盖'],
    risks: ['未接通真实大模型，分数仅供参考'],
  };
}

async function generateJSON({ system, user, dimKeys }) {
  // Mock 模式或无可用 Key
  const noKey =
    (config.llmProvider === 'gemini' && !config.gemini.apiKey) ||
    (config.llmProvider === 'openai' && !config.openai.apiKey) ||
    (config.llmProvider === 'deepseek' && !config.deepseek.apiKey);
  if (config.mockScore || noKey) {
    const mocked = mockScore(system, user);
    // 把模拟分映射到具体维度
    const dims = {};
    dimKeys.forEach((k, i) => {
      dims[k] = { score: Math.max(0, Math.min(100, mocked.dimensions._mockBase + ((i * 5) % 13) - 6)), comment: '（模拟）待真实大模型评分后生成' };
    });
    return { dimensions: dims, overall_comment: mocked.overall_comment, strengths: mocked.strengths, risks: mocked.risks };
  }

  await acquire();
  let lastErr;
  for (let attempt = 0; attempt < config.maxRetry; attempt++) {
    try {
      let result;
      if (config.llmProvider === 'openai') result = await callOpenAI(system, user);
      else if (config.llmProvider === 'deepseek') result = await callDeepSeek(system, user);
      else result = await callGemini(system, user);
      if (result && result.dimensions) return result;
      throw new Error('返回缺少 dimensions 字段');
    } catch (e) {
      lastErr = e;
      const is429 = /429/.test(e.message);
      const backoff = is429 ? 2000 * Math.pow(2, attempt) : 800 * Math.pow(2, attempt);
      await sleep(backoff);
    } finally {
      release();
    }
  }
  throw lastErr || new Error('LLM 评分失败');
}

// 通用 JSON 调用（游戏模式：AI 买家 + 4 评委），返回任意 JSON 结构
async function callJSON({ system, user, temperature = 0.7 }) {
  if (config.llmProvider === 'deepseek' && !config.deepseek.apiKey) {
    throw new Error('DEEPSEEK_API_KEY 未配置');
  }
  await acquire();
  let lastErr;
  try {
    for (let attempt = 0; attempt < config.maxRetry; attempt++) {
      try {
        let result;
        if (config.llmProvider === 'deepseek') {
          const { apiKey, model, base } = config.deepseek;
          const res = await fetch(`${base}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model,
              messages: [
                { role: 'system', content: system },
                { role: 'user', content: user },
              ],
              response_format: { type: 'json_object' },
              temperature,
            }),
          });
          if (!res.ok) {
            const txt = await res.text();
            throw new Error(`DeepSeek ${res.status}: ${txt.slice(0, 200)}`);
          }
          const data = await res.json();
          const text = data?.choices?.[0]?.message?.content;
          if (!text) throw new Error('DeepSeek 返回为空');
          result = JSON.parse(stripFence(text));
        } else if (config.llmProvider === 'openai') {
          result = await callOpenAI(system, user);
        } else {
          result = await callGemini(system, user);
        }
        return result;
      } catch (e) {
        lastErr = e;
        const is429 = /429/.test(e.message);
        const backoff = is429 ? 2000 * Math.pow(2, attempt) : 800 * Math.pow(2, attempt);
        await sleep(backoff);
      }
    }
  } finally {
    release();
  }
  throw lastErr || new Error('LLM 调用失败');
}

module.exports = { generateJSON, callJSON };
