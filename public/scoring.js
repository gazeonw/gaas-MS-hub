/* AKEEYO 数字面试 — 人工评分台逻辑 */
(function () {
  'use strict';

  // 产品资料速览（与候选页 PRODUCT_BRIEF_HTML 同源，供评分对照）
  const BRIEF_REF =
    'AKEEYO（深圳）— 两轮/四轮车行车记录仪，主销欧美日\n' +
    '车用 A12：4K前录+1080P后录双镜头 / STARVIS夜视 / 停车监控 / Wi-Fi+App / 256GB\n' +
    '摩托车系列：前后双录，整机IPX6防水，把横/后视镜安装，GPS轨迹\n' +
    '认证：CE、E-mark（欧盟）、FCC（美国）\n' +
    '商务条款：FOB深圳；A12参考价 USD 46-49/台（按量可议）；MOQ 200台；交期20天；' +
    '质保18个月+1%备件；OEM/ODM；样品3工作日；T/T 30%定金（首单可PayPal）';
  const params = new URLSearchParams(location.search);
  const token = params.get('token') || localStorage.getItem('akeeyo_admin_token') || '';
  const id = params.get('id') || '';
  const who = document.getElementById('who');

  if (!token || !id) {
    who.textContent = '缺少参数';
    document.getElementById('content').innerHTML =
      '<div class="warn">缺少 token 或候选人 id，请从管理后台的「评分」按钮进入。</div>';
    return;
  }
  who.textContent = '人工 rubric 评分';

  const $ = (sel) => document.querySelector(sel);
  const esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );

  let RUBRIC = null;
  let SUB = null;

  function tierOf(score, tiers) {
    for (const t of tiers) if (score >= t.min) return t.label;
    return '淘汰';
  }

  function fmtTime(sec) {
    if (!sec && sec !== 0) return '—';
    if (sec < 60) return sec + 's';
    return Math.floor(sec / 60) + 'm' + (sec % 60) + 's';
  }

  async function init() {
    try {
      const [rubricRes, subRes] = await Promise.all([
        fetch('/api/rubric?token=' + encodeURIComponent(token)),
        fetch('/api/report/' + encodeURIComponent(id) + '?token=' + encodeURIComponent(token)),
      ]);
      if (!rubricRes.ok || !subRes.ok) throw new Error('加载失败 HTTP ' + rubricRes.status + '/' + subRes.status);
      RUBRIC = await rubricRes.json();
      SUB = await subRes.json();
    } catch (e) {
      document.getElementById('content').innerHTML =
        '<div class="warn">加载失败：' + esc(e.message) + '<br/>请确认从管理后台进入且 token 有效。</div>';
      return;
    }

    renderMeta();
    renderLeft();
    renderRight();
    prefill();
    document.getElementById('savebar').style.display = 'flex';
    recalc();
  }

  function renderMeta() {
    const c = SUB.candidate || {};
    document.getElementById('meta').innerHTML =
      '<div><b>姓名</b>' + esc(c.name || '-') + '</div>' +
      '<div><b>经验</b>' + esc(c.yearsExperience || '-') + '</div>' +
      '<div><b>学历</b>' + esc(c.education || '-') + '</div>' +
      '<div><b>城市</b>' + esc(c.location || '-') + '</div>' +
      '<div><b>邮箱</b>' + esc(c.email || '-') + '</div>' +
      '<div><b>提交时间</b>' + esc((SUB.createdAt || '').replace('T', ' ').slice(0, 16)) + '</div>' +
      '<div><b>状态</b>' + (SUB.status === 'scored' ? '已评分（可修改重存）' : '待评分') + '</div>';
  }

  function renderLeft() {
    const inq = SUB.inquiry || {};
    const oralList = (SUB.oral || [])
      .map((o, i) => {
        const audio = o.audioRef
          ? '<audio controls src="/api/audio/' + encodeURIComponent(SUB.id) + '/' + encodeURIComponent(o.qId) +
            '?token=' + encodeURIComponent(token) + '"></audio>'
          : '<div class="q-meta">（候选人未录音 / 浏览器不支持）</div>';
        return (
          '<div class="q-card">' +
          '<div class="q-title">Q' + (i + 1) + '. ' + esc(o.questionText) + '</div>' +
          '<div class="q-meta">用时 ' + fmtTime(o.timeSpentSec) + ' · 转写 ' + (o.transcript || '').length + ' 字符</div>' +
          '<div class="q-trans">' + esc(o.transcript || (o.audioRef ? '（录音作答 · 请试听评分）' : '(空)')) + '</div>' +
          audio + '</div>'
        );
      })
      .join('');

    document.getElementById('content').innerHTML =
      '<div class="grid">' +
      '<div>' +
      '<div class="card"><h2>外商询盘原文（' + esc(inq.promptId || '') + '）</h2><pre>' + esc(inq.promptText || '(空)') + '</pre></div>' +
      '<div class="card"><h2>📋 产品资料速览（评分对照用）</h2><pre>' + esc(BRIEF_REF) + '</pre></div>' +
      '<div class="card"><h2>候选人英文回复 · ' + fmtTime(inq.timeSpentSec) + ' / ' + (inq.charCount || 0) + ' 字符</h2><pre>' + esc(inq.replyText || '(空)') + '</pre></div>' +
      '<div class="card"><h2>口语作答（转写 + 音频）</h2>' + (oralList || '<p class="muted">无</p>') + '</div>' +
      '</div>' +
      '<div id="right-col"></div>' +
      '</div>';
  }

  function dimTable(sec, dims, anchors) {
    const rows = dims
      .map(
        (d) =>
          '<div class="dim-row">' +
          '<div class="dim-head"><b>' + esc(d.label) + '</b><span class="dim-w">权重 ' + Math.round(d.weight * 100) + '%</span></div>' +
          '<div class="anchor">' + esc((anchors[d.key] || '').split('：').slice(1).join('：') || '') + '</div>' +
          '<div class="dim-inputs">' +
          '<input type="number" min="0" max="100" step="1" class="score-in" data-sec="' + sec + '" data-key="' + d.key + '" placeholder="0-100">' +
          '<input type="text" class="comment-in" data-sec="' + sec + '" data-key="' + d.key + '" placeholder="评语（选填，出现在报告里）">' +
          '</div></div>'
      )
      .join('');
    return rows;
  }

  function renderRight() {
    const oralNote =
      '<div class="note">⚠ 发音精度不计入 5 维评分（转写文本无法判定）。请点上方音频试听，结论写在「口语流利度」或综合评语里。</div>';
    document.getElementById('right-col').innerHTML =
      '<div class="card"><h2>询盘回复评分 · 6 维</h2>' + dimTable('inquiry', RUBRIC.inquiryDims, RUBRIC.anchors.inquiry) + '</div>' +
      '<div class="card"><h2>英语口语评分 · 5 维</h2>' + dimTable('oral', RUBRIC.oralDims, RUBRIC.anchors.oral) + oralNote + '</div>' +
      '<div class="card"><h2>综合评语 / 亮点 / 风险</h2>' +
      '<label>综合评语（显示在报告结论区）</label><textarea id="ov-comment" rows="3" placeholder="例：询盘回复结构完整、报价专业，口语表达流畅但词汇偏基础，建议进入真人面试复核谈判实战。"></textarea>' +
      '<label>亮点（一行一条）</label><textarea id="strengths" rows="3" placeholder="例：&#10;阶梯报价+付款条款完整&#10;主动提出寄样与 upsell"></textarea>' +
      '<label>风险（一行一条）</label><textarea id="risks" rows="3" placeholder="例：&#10;口语语法错误较多&#10;产品认证认知不足"></textarea>' +
      '</div>';
  }

  function prefill() {
    if (SUB.status !== 'scored' || !SUB.scores) return;
    ['inquiry', 'oral'].forEach((sec) => {
      const dims = sec === 'inquiry' ? SUB.scores.inquiryDims : SUB.scores.oralDims;
      Object.keys(dims || {}).forEach((k) => {
        const sIn = document.querySelector('.score-in[data-sec="' + sec + '"][data-key="' + k + '"]');
        const cIn = document.querySelector('.comment-in[data-sec="' + sec + '"][data-key="' + k + '"]');
        if (sIn) sIn.value = dims[k].score;
        if (cIn) cIn.value = dims[k].comment || '';
      });
    });
    const raw = SUB.llmRaw || {};
    if (raw.overall_comment) $('#ov-comment').value = raw.overall_comment;
    if (Array.isArray(raw.strengths) && raw.strengths.length) $('#strengths').value = raw.strengths.join('\n');
    if (Array.isArray(raw.risks) && raw.risks.length) $('#risks').value = raw.risks.join('\n');
  }

  function collectScores(sec) {
    const out = {};
    let filled = 0;
    document.querySelectorAll('.score-in[data-sec="' + sec + '"]').forEach((el) => {
      out[el.dataset.key] = { score: el.value, comment: (document.querySelector('.comment-in[data-sec="' + sec + '"][data-key="' + el.dataset.key + '"]') || {}).value || '' };
      if (el.value !== '' && !isNaN(Number(el.value))) filled++;
    });
    return { out, filled };
  }

  function recalc() {
    const inq = collectScores('inquiry');
    const oral = collectScores('oral');
    const wInq = RUBRIC.weights.inquiry;
    const wOral = RUBRIC.weights.oral;

    function weighted(dims, data) {
      let sum = 0;
      dims.forEach((d) => {
        const v = Number((data[d.key] || {}).score);
        if (!isNaN(v)) sum += d.weight * Math.max(0, Math.min(100, v));
      });
      return sum;
    }

    const iScore = Math.round(weighted(RUBRIC.inquiryDims, inq.out));
    const oScore = Math.round(weighted(RUBRIC.oralDims, oral.out));
    const overall = Math.round(wInq * iScore + wOral * oScore);
    const total = inq.filled + oral.filled;

    if (total === 0) {
      $('#preview').innerHTML = '待打分（共 11 维）';
      return;
    }
    const tier = tierOf(overall, RUBRIC.tiers);
    $('#preview').innerHTML =
      '询盘 <span class="big">' + iScore + '</span> · 口语 <span class="big">' + oScore + '</span> · 综合 <span class="big">' +
      overall + '</span>（' + esc(tier) + '）· 已填 ' + total + '/11 维';
  }

  document.addEventListener('input', (e) => {
    if (e.target.classList && (e.target.classList.contains('score-in') || e.target.classList.contains('comment-in'))) {
      // 分数输入即时约束在 0-100
      if (e.target.classList.contains('score-in')) {
        const v = Number(e.target.value);
        if (e.target.value !== '' && (v < 0 || v > 100)) e.target.value = Math.max(0, Math.min(100, v));
      }
      recalc();
    }
  });

  $('#save').addEventListener('click', async () => {
    const inq = collectScores('inquiry');
    const oral = collectScores('oral');
    if (inq.filled < RUBRIC.inquiryDims.length || oral.filled < RUBRIC.oralDims.length) {
      alert('还有维度未打分：询盘 ' + inq.filled + '/' + RUBRIC.inquiryDims.length + '，口语 ' + oral.filled + '/' + RUBRIC.oralDims.length + '。请填满 11 维后再保存。');
      return;
    }
    const btn = $('#save');
    btn.disabled = true;
    btn.textContent = '保存中…';
    try {
      const payload = {
        inquiryDims: inq.out,
        oralDims: oral.out,
        overallComment: $('#ov-comment').value.trim(),
        strengths: $('#strengths').value.split('\n').map((s) => s.trim()).filter(Boolean),
        risks: $('#risks').value.split('\n').map((s) => s.trim()).filter(Boolean),
      };
      const res = await fetch('/api/score/' + encodeURIComponent(id) + '?token=' + encodeURIComponent(token), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'HTTP ' + res.status);
      recalc();
      const banner = document.createElement('div');
      banner.className = 'ok-banner';
      banner.innerHTML =
        '✅ 已保存：综合 <b>' + data.overallScore + '</b> 分（' + esc(data.tier) +
        '）　<a href="/report/' + encodeURIComponent(id) + '?token=' + encodeURIComponent(token) + '" target="_blank">查看报告</a>' +
        '<a href="/admin?token=' + encodeURIComponent(token) + '">返回后台</a>';
      const wrap = document.querySelector('.wrap');
      wrap.insertBefore(banner, wrap.firstChild);
      $('#view-report').style.display = 'inline-block';
      window.scrollTo(0, 0);
    } catch (e) {
      alert('保存失败：' + e.message);
    } finally {
      btn.disabled = false;
      btn.textContent = '保存评分';
    }
  });

  $('#view-report').addEventListener('click', () => {
    window.open('/report/' + encodeURIComponent(id) + '?token=' + encodeURIComponent(token), '_blank');
  });

  init();
})();
