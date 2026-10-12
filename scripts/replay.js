// 买家智能回放工具：模拟完整对话流，直观检查「聪明感」
// 用法: node scripts/replay.js
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'candidate.js'), 'utf8');
const MARK = 'const BUYER' + '_LINES';
const start = src.indexOf(MARK);
const end = src.indexOf('function renderTrust');
if (start < 0 || end < 0) throw new Error('未能定位买家代码段');
const code = src.slice(start, end);

globalThis.document = { querySelectorAll: () => [] };
function renderTrust() {}

let state = null;
function reset(scenario, goal) {
  state = {
    chat: {
      scenario, goal,
      flags: {}, trust: 0, turns: 0, history: [],
      mem: { lastBuyerText: '', saidCount: {}, mood: 0, agendaIdx: 0, buyerTurns: 0, lastAgendaAt: 0, lastBranch: '', branchStreak: 0, returnGuard: '', poolPtr: {}, hintGiven: false, pending: null, facts: { price: null, oldPrice: null, prev: null, months: null, moq: null, conflict: false, conflictUsed: false }, stallDone: false, stallPending: false, stanceDone: false, stancePending: false, negoSignals: {}, _empathyMood: false },
    },
  };
}
eval(code + '\nglobalThis.API = { buyerThink };');
const T = globalThis.API;

const DE = {
  id: 'CHAT-DE-001', market: '德国 · 慕尼黑',
  persona: 'Klaus Müller · Procurement Manager, Müller Auto-Electronics GmbH',
  opening: 'Hello! We are a distributor of automotive electronics in Munich. What is your best FOB price?',
  pushback: 'I have an offer from another supplier at USD 43.50 for a similar model. Can you do better on 500 pcs?',
  target: 43.5,
};
const GOAL = { id: 'G-EMAIL', label: '拿到邮箱', re: /e-?mail/i, win: 'My business email is {name}@{company}.com' };

function say(msg) {
  state.chat.history.push({ role: 'you', text: msg });
  state.chat.turns++;
  return T.buyerThink(msg);
}
function play(title, lines) {
  reset(DE, GOAL);
  console.log('\n===== ' + title + ' =====');
  console.log('[buyer] ' + DE.opening);
  state.chat.mem.lastBuyerText = DE.opening;
  for (const [you, note] of lines) {
    const out = say(you);
    console.log('[you]   ' + you);
    console.log('[buyer] ' + out.text + (note ? '   <- ' + note : ''));
  }
}

// 剧本1：高价 → 被强压 → 逐步让价 → 矛盾点破 → 好价积极推进
play('剧本1 高报价被压 + 改价矛盾被点破', [
  ['Our price is USD 50 per unit FOB Shenzhen', '高价 → 强压（回显 50 vs 43.5）'],
  ['Okay okay, best price is USD 42 for you', '降价 8 刀 → 矛盾点破（50 → 42）'],
  ['Sorry, my final price is USD 41 per unit', '再降 → 价格分流 priceGood（41 ≤ 40.5? 否→pricePush）'],
  ['We provide 18 months warranty and CE certification', '质保月数回显'],
]);

// 剧本2：买家催价后答非所问 → 被点破追问
play('剧本2 答非所问被催答', [
  ['We are a professional manufacturer with strong quality control', '闲聊 → 兜底'],
  ['We have been in this industry for many years with strict inspection', '第2轮 → 买家主动问付款'],
  ['Our factory has ten production lines and advanced equipment', '答非所问 → 点破 + 催价'],
  ['We accept T/T 30% deposit before production', '只答付款 → 仍催价'],
  ['Our best price is USD 44 per unit FOB Shenzhen', '报价 → 悬问消除'],
]);

// 剧本3：超低价引发怀疑
play('剧本3 超低价引发质量怀疑', [
  ['Our best price is USD 33 per unit', '超低价 → 怀疑'],
  ['We promise the quality is the same as before', '口头保证 → 无关键词推进'],
  ['We provide 24 months warranty and CE E-mark certification', '实质证据 → 得分'],
]);

// 剧本4：谈判情境全套（黄执中行为说服 + 熊浩哈佛谈判术）
play('剧本4 谈判情境：拖延测试 + 立场-利益 + 让步质量', [
  ['We are a professional manufacturer with strong quality control', '闲聊'],
  ['We have been in this industry for many years with strict inspection', '第2轮 → 买家问付款'],
  ['Our factory has ten production lines and advanced equipment', '答非所问 → 催价'],
  ['We attend trade shows regularly and have many loyal customers', '继续闲聊'],
  ['Our team is experienced and our quality is reliable', '第5轮没报价 → 买家拖延'],
  ['Could we schedule a quick call this Thursday to go through the details?', '时间+动作 → 配合推进'],
  ['Our price is USD 46 per unit', '首次报价 → 场景压价'],
  ['I can do USD 45 for you', '第2次报价 → 买家立场宣言（超预算）'],
  ['I hear you. But why is the budget so tight this quarter?', '追问 why → 揭示真实利益（降本KPI）'],
  ['Okay fine, USD 43 is my final price', '免费让步 → 买家得寸进尺'],
  ['For an order of 1000 pcs, in exchange I can do USD 42', '条件让步 → 接住交换框架'],
]);

console.log('\n（回放完。机制注解仅用于调试，页面实际台词随机场景/目标分配）');
