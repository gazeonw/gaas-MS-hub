// 生成 AKEEYO 红黑品牌风 HTML 报告（八模块）
function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

const TIER_COLOR = {
  淘汰: '#9a9a9a',
  待定: '#f5a623',
  匹配: '#27c08a',
  强匹配: '#d60012',
  顶尖: '#8a0010',
};

function dimBars(dimsObj) {
  if (!dimsObj) return '<p class="muted">评分未生成</p>';
  const rows = Object.values(dimsObj)
    .map((d) => {
      const pct = Math.max(0, Math.min(100, d.score));
      return (
        '<div class="drow">' +
        '<div class="dlabel">' + escapeHtml(d.label) + ' <span class="dval">' + d.score + '</span></div>' +
        '<div class="dtrack"><div class="dfill" style="width:' + pct + '%"></div></div>' +
        (d.comment ? '<div class="dcomment">' + escapeHtml(d.comment) + '</div>' : '') +
        '</div>'
      );
    })
    .join('');
  return rows;
}

function suggest(tier, weakInq, weakOral) {
  const base = {
    顶尖: '建议直接进入真人复试，并验证发音精度与高阶谈判实战。',
    强匹配: '建议优先安排真人面试，重点复核发音与真实业绩。',
    匹配: '可进入面试环节，针对薄弱维度做针对性深挖。',
    待定: '列入备选池，建议补一轮结构化面试后再定。',
    淘汰: '暂不建议进入下一轮，可保留人才库。',
  }[tier] || '建议结合其他材料综合判断。';
  let extra = '';
  if (weakInq.length) extra += ' 询盘薄弱：' + weakInq.join('、') + '。';
  if (weakOral.length) extra += ' 口语薄弱：' + weakOral.join('、') + '。';
  return base + extra;
}

function generateHtml(sub, token) {
  const c = sub.candidate || {};
  const s = sub.scores;
  const notScored = !s || sub.status !== 'scored';

  if (notScored) {
    const isManual = sub.llmRaw && sub.llmRaw.source === 'manual';
    const head = isManual ? '待人工评分' : '评分进行中…';
    const tip = isManual
      ? '请到管理后台点击「评分」，在人工评分台完成 11 维 rubric 打分后自动生成报告。'
      : '如长时间未完成，请到后台点击「重评」。';
    return (
      '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8">' +
      '<title>' + head + ' · AKEEYO</title><style>body{font-family:sans-serif;background:#0a0a0a;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh}</style>' +
      '</head><body><div style="text-align:center"><div style="font-size:48px">' + (isManual ? '📝' : '⏳') + '</div>' +
      '<h2>' + head + '</h2><p style="color:#bbb">ID: ' + escapeHtml(sub.id) + '</p>' +
      '<p style="color:#bbb">' + escapeHtml(tip) + '</p></div></body></html>'
    );
  }

  const overall = s.overallScore;
  const tier = s.tier;
  const tierColor = TIER_COLOR[tier] || '#d60012';

  // 薄弱维度
  const weakInq = Object.values(s.inquiryDims || {}).filter((d) => d.score < 60).map((d) => d.label);
  const weakOral = Object.values(s.oralDims || {}).filter((d) => d.score < 60).map((d) => d.label);

  const strengths = (sub.llmRaw?.strengths || []).map((x) => '<li>' + escapeHtml(x) + '</li>').join('');
  const risks = (sub.llmRaw?.risks || []).map((x) => '<li>' + escapeHtml(x) + '</li>').join('');

  // 音频区
  let audioSec = '';
  if (token && Array.isArray(sub.oral)) {
    const items = sub.oral
      .map((o, i) => {
        if (!o.audioRef) return '';
        const url = '/api/audio/' + encodeURIComponent(sub.id) + '/' + encodeURIComponent(o.qId) + '?token=' + encodeURIComponent(token);
        return '<div class="audio-item"><b>Q' + (i + 1) + '.</b> ' + escapeHtml(o.questionText) +
          '<br><audio controls src="' + url + '"></audio></div>';
      })
      .join('');
    if (items) audioSec = '<div class="card"><h2>⑧ 发音听音（人工复核）</h2>' + items + '</div>';
  }

  const html =
    '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '<title>外贸销售候选人 · 数字面试评估报告 · ' + escapeHtml(c.name || '') + '</title>' +
    '<style>' +
    ':root{--red:#d60012;--blk:#0a0a0a;--line:#e3e3e3;--mut:#6b6b6b}' +
    '*{box-sizing:border-box;margin:0;padding:0}body{font-family:"Segoe UI","Microsoft YaHei",sans-serif;background:#f5f5f5;color:#1a1a1a;line-height:1.6;padding:24px 14px}' +
    '.wrap{max-width:900px;margin:0 auto}.brand{background:var(--blk);color:#fff;padding:16px 22px;border-radius:12px;display:flex;align-items:center;gap:12px;margin-bottom:18px}' +
    '.logo{background:var(--red);color:#fff;font-weight:800;letter-spacing:1px;padding:6px 12px;border-radius:5px}' +
    '.brand h1{font-size:18px}.brand .sub{margin-left:auto;font-size:12px;color:#b9b9b9}' +
    '.card{background:#fff;border:1px solid var(--line);border-radius:12px;padding:20px 24px;margin-bottom:16px}' +
    '.card h2{font-size:16px;color:var(--red);margin-bottom:12px;border-left:4px solid var(--red);padding-left:10px}' +
    '.conclusion{background:linear-gradient(135deg,#1a0003,#0a0a0a);color:#fff;border:none}' +
    '.score-big{font-size:60px;font-weight:900;color:var(--red);line-height:1}' +
    '.badge{display:inline-block;background:var(--red);color:#fff;padding:5px 16px;border-radius:20px;font-weight:700;font-size:14px;margin-left:10px}' +
    '.one-liner{margin-top:10px;color:#eee;font-size:14.5px}' +
    '.kv{display:flex;gap:10px;flex-wrap:wrap}.kv div{background:#fafafa;border:1px solid var(--line);border-radius:8px;padding:8px 12px;font-size:13.5px}' +
    '.kv b{color:var(--mut);font-weight:600;margin-right:4px}' +
    '.drow{margin-bottom:12px}.dlabel{font-size:13.5px;font-weight:600}.dval{color:var(--red);font-weight:800;margin-left:6px}' +
    '.dtrack{height:10px;background:#eee;border-radius:6px;overflow:hidden;margin:5px 0}.dfill{height:100%;background:linear-gradient(90deg,#d60012,#ff4d57)}' +
    '.dcomment{font-size:12.5px;color:var(--mut)}' +
    '.note{background:#fff6f6;border:1px solid #ffd6d9;border-left:4px solid var(--red);border-radius:8px;padding:12px 14px;font-size:13px;color:#a3000d;margin-top:8px}' +
    'ul{margin:6px 0 0 18px;font-size:13.5px}li{margin-bottom:4px}' +
    '.audio-item{margin-bottom:12px;font-size:13.5px}audio{margin-top:4px;width:100%;max-width:420px}' +
    'details{margin-top:8px}summary{cursor:pointer;color:var(--mut);font-size:13px}' +
    'pre{white-space:pre-wrap;background:#fafafa;border:1px solid var(--line);border-radius:8px;padding:12px;font-size:12.5px;margin-top:8px}' +
    '.muted{color:var(--mut);font-size:13px}' +
    '</style></head><body><div class="wrap">' +

    '<div class="brand"><div class="logo">AKEEYO</div><div><h1>外贸销售候选人 · 数字面试评估报告</h1></div>' +
    '<div class="sub">报告编号 ' + escapeHtml(sub.id.slice(0, 8)) + ' · ' + escapeHtml((sub.createdAt || '').slice(0, 10)) + '</div></div>' +

    // 模块二 结论
    '<div class="card conclusion"><div><span class="score-big">' + overall + '</span><span style="font-size:20px;color:#fff">/100</span>' +
    '<span class="badge" style="background:' + tierColor + '">' + escapeHtml(tier) + '</span>' +
    (sub.llmRaw && sub.llmRaw.source === 'manual'
      ? '<span class="badge" style="background:#4a4a4a;font-size:12px">人工评分</span>'
      : '<span class="badge" style="background:#4a4a4a;font-size:12px">AI 评分</span>') + '</div>' +
    '<div class="one-liner">' + escapeHtml(sub.llmRaw?.overall_comment || sub.llmRaw?.inquiry_comment || '综合评分基于询盘回复能力与英语口语两项实测。') + '</div></div>' +

    // 模块三 基本画像
    '<div class="card"><h2>① 基本画像</h2><div class="kv">' +
    '<div><b>姓名</b>' + escapeHtml(c.name || '-') + '</div>' +
    '<div><b>经验</b>' + escapeHtml(c.yearsExperience || '-') + '</div>' +
    '<div><b>学历</b>' + escapeHtml(c.education || '-') + '</div>' +
    '<div><b>城市</b>' + escapeHtml(c.location || '-') + '</div>' +
    '<div><b>邮箱</b>' + escapeHtml(c.email || '-') + '</div>' +
    '<div><b>询盘用时</b>' + (sub.inquiry?.timeSpentSec || 0) + 's / ' + (sub.inquiry?.charCount || 0) + '字</div>' +
    '</div></div>' +

    // 模块四 逐维匹配
    '<div class="card"><h2>② 询盘回复能力 · ' + (s.inquiryScore ?? '-') + '/100</h2>' + dimBars(s.inquiryDims) + '</div>' +
    '<div class="card"><h2>③ 英语口语 · ' + (s.oralScore ?? '-') + '/100</h2>' + dimBars(s.oralDims) +
    '<div class="note">⚠ 发音精度无法由文字评定，<b>需 HR 人工听音频确认</b>（见模块⑧）。口语分数仅反映流利度/内容/语法/词汇/自信。</div></div>' +

    // 模块五 综合评语
    '<div class="card"><h2>④ 综合评语</h2>' +
    (strengths ? '<p class="muted" style="margin-bottom:4px">亮点</p><ul>' + strengths + '</ul>' : '') +
    (risks ? '<p class="muted" style="margin:10px 0 4px">风险</p><ul>' + risks + '</ul>' : '') +
    '</div>' +

    // 模块六 风险点
    '<div class="card"><h2>⑤ 风险点</h2><ul>' +
    '<li>发音精度未实测，须结合模块⑧人工听音。</li>' +
    '<li>在线自答，信度有限，须结合真人面试实测复核。</li>' +
    (weakInq.length ? '<li>询盘回复薄弱维度：' + escapeHtml(weakInq.join('、')) + '。</li>' : '') +
    (weakOral.length ? '<li>英语口语薄弱维度：' + escapeHtml(weakOral.join('、')) + '。</li>' : '') +
    (sub.llmRaw?.error ? '<li style="color:#a3000d">评分异常：' + escapeHtml(sub.llmRaw.error) + '</li>' : '') +
    '</ul></div>' +

    // 模块七 建议
    '<div class="card"><h2>⑥ 建议</h2><p>' + escapeHtml(suggest(tier, weakInq, weakOral)) + '</p></div>' +

    audioSec +

    // 模块八 原始数据
    '<div class="card"><h2>⑦ 原始数据留存</h2>' +
    '<details><summary>查看候选人询盘回复原文</summary><pre>' + escapeHtml(sub.inquiry?.replyText || '(空)') + '</pre></details>' +
    (Array.isArray(sub.oral) ? sub.oral.map((o, i) =>
      '<details><summary>查看口语 Q' + (i + 1) + ' 转写原文</summary><pre>' + escapeHtml(o.transcript || (o.audioRef ? '（录音作答，无转写文本 · 请听音频）' : '(空)')) + '</pre></details>'
    ).join('') : '') +
    '</div>' +

    '</div></body></html>';
  return html;
}

module.exports = { generateHtml };
