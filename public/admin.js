/* AKEEYO 数字面试 — 管理后台逻辑（人工评分模式，支持令牌记忆） */
(function () {
  'use strict';
  const params = new URLSearchParams(location.search);
  let token = params.get('token') || localStorage.getItem('akeeyo_admin_token') || '';

  const TIER_COLOR = { 淘汰: '#9a9a9a', 待定: '#f5a623', 匹配: '#27c08a', 强匹配: '#d60012', 顶尖: '#8a0010' };
  const STATUS_LABEL = { pending: '待评分', scoring: 'AI评分中', scored: '已评分' };

  function setWho(text) {
    document.getElementById('who').textContent = text;
  }

  function showTokenPrompt(msg) {
    setWho(msg || '需要访问令牌');
    document.getElementById('token-overlay').style.display = 'flex';
    const inp = document.getElementById('token-input');
    inp.focus();
  }

  function hideTokenPrompt() {
    document.getElementById('token-overlay').style.display = 'none';
  }

  function tokenReady() {
    const ov = document.getElementById('token-overlay');
    return token && ov.style.display !== 'flex';
  }

  async function load() {
    const tbody = document.getElementById('rows');
    tbody.innerHTML = '<tr><td colspan="5" class="empty">加载中…</td></tr>';
    try {
      const res = await fetch('/api/submissions?token=' + encodeURIComponent(token));
      if (res.status === 401) {
        localStorage.removeItem('akeeyo_admin_token');
        showTokenPrompt('令牌无效，请重新输入');
        tbody.innerHTML = '<tr><td colspan="5" class="empty">等待授权…</td></tr>';
        return;
      }
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const list = await res.json();
      setWho('已授权');
      document.getElementById('count').textContent = '共 ' + list.length + ' 份';
      if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty">暂无候选人提交</td></tr>';
        return;
      }
      tbody.innerHTML = list
        .map((s) => {
          const color = TIER_COLOR[s.tier] || '#9a9a9a';
          const score = s.overallScore == null ? '—' : s.overallScore;
          const statusLabel = STATUS_LABEL[s.status] || s.status;
          return (
            '<tr data-id="' + s.id + '">' +
            '<td>' + esc(s.name) + '</td>' +
            '<td><b>' + score + '</b></td>' +
            '<td>' + (s.tier ? '<span class="badge" style="background:' + color + '">' + esc(s.tier) + '</span>' : '—') + '</td>' +
            '<td>' + esc(statusLabel) + '</td>' +
            '<td><button class="btn ghost" data-act="score">评分</button></td>' +
            '</tr>'
          );
        })
        .join('');
    } catch (e) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty">加载失败：' + esc(e.message) + '<br/>请确认服务已启动（npm start）</td></tr>';
    }
  }

  document.getElementById('rows').addEventListener('click', (e) => {
    const scoreBtn = e.target.closest('[data-act="score"]');
    const tr = e.target.closest('tr[data-id]');
    if (!tr) return;
    const id = tr.dataset.id;
    if (scoreBtn) {
      window.open('/scoring.html?id=' + encodeURIComponent(id) + '&token=' + encodeURIComponent(token), '_blank');
      return;
    }
    document.querySelectorAll('#rows tr').forEach((r) => r.classList.remove('sel'));
    tr.classList.add('sel');
    document.getElementById('frame').src = '/report/' + encodeURIComponent(id) + '?token=' + encodeURIComponent(token);
  });

  document.getElementById('refresh').addEventListener('click', load);

  // 令牌提交（回车或点按钮）
  function submitToken() {
    const v = document.getElementById('token-input').value.trim();
    if (!v) return;
    token = v;
    localStorage.setItem('akeeyo_admin_token', v);
    hideTokenPrompt();
    load();
  }
  document.getElementById('token-submit').addEventListener('click', submitToken);
  document.getElementById('token-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitToken();
  });

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );
  }

  // 启动：有令牌直接加载，没有则弹输入框
  if (token) {
    load();
  } else {
    showTokenPrompt();
  }
  setInterval(() => {
    if (tokenReady()) load();
  }, 30000);
})();
