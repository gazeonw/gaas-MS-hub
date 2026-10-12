// 剧本买家逻辑单测（零 API）
// 用法: node scripts/test_buyer_logic.js
// 从 public/candidate.js 提取台词池与决策链，mock 掉 DOM 与 state，直接驱动验证行为。
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'candidate.js'), 'utf8');
const MARK = 'const BUYER' + '_LINES'; // 拼接防误替换
const start = src.indexOf(MARK);
const end = src.indexOf('function renderTrust');
if (start < 0 || end < 0) throw new Error('未能定位买家代码段');
const code = src.slice(start, end);

// --- mock 浏览器环境 ---
globalThis.document = { querySelectorAll: () => [] };
function renderTrust() {} // buyerThink 内部调用，mock 掉

// --- state 由测试重置 ---
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

// direct eval: 函数闭包捕获本作用域的 state / document
eval(code + '\nglobalThis.API = { BUYER_LINES: BUYER' + '_LINES, pickLine, normWords, isCandidateRepeat, buyerThink, buyerDecide, fillTemplate };');
const T = globalThis.API;

// 通关概率依赖 Math.random：默认 stub 为必中（0 < 0.7），保证既有用例确定性；概率用例单独覆盖
const _random = Math.random;
Math.random = () => 0;

const SC = {
  id: 'CHAT-DE-001', market: '德国 · 慕尼黑',
  persona: 'Klaus Müller · Procurement Director, AutoParts GmbH',
  opening: 'Hello! We are a distributor... What is your best FOB price?',
  pushback: 'I have an offer from another supplier at USD 43.50 for a similar model. Can you do better on 500 pcs?',
};
const GOAL_EMAIL = { id: 'G-EMAIL', label: '拿到买家的商务邮箱', re: /e-?mail/i, win: 'Great talking to you, {name}. My business email is {name}@{company}.com. Please send your full offer there.' };

let pass = 0, fail = 0;
function t(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}
function say(msg) { // 模拟候选人发言一轮（history 记录 + buyerThink）
  state.chat.history.push({ role: 'you', text: msg });
  state.chat.turns++;
  return T.buyerThink(msg);
}

console.log('\n[1] 复读检测：同一长句发两次 → 第二次触发 callout 且台词递进不重复');
reset(SC, GOAL_EMAIL);
const line1 = 'Our A12 model is CE certified with 18 months warranty and the FOB price is competitive for your market';
say(line1);
const r2 = say(line1);
t('第二次被判复读', T.isCandidateRepeat(line1));
t('callout 台词命中', T.BUYER_LINES.callout.includes(r2.text), r2.text);
const r3 = say(line1);
t('第三次 callout 升级', r3.text !== r2.text && T.BUYER_LINES.callout.includes(r3.text), r3.text);

console.log('\n[2] 升级阶梯：pricePush 连续 5 次 → 递进 + 到尾后轮换不回开场');
reset(SC, GOAL_EMAIL);
const seq = [];
for (let i = 0; i < 5; i++) seq.push(T.pickLine('pricePush', true));
t('第1次用场景压价', seq[0] === SC.pushback, seq[0]);
t('前4次阶梯各不相同', new Set(seq.slice(0, 4)).size === 4, JSON.stringify(seq));
t('无相邻重复', seq.every((x, i) => i === 0 || x !== seq[i - 1]));
t('用完池不回开场压价', seq[4] !== seq[0], seq[4]);

console.log('\n[3] 主动出题：闲聊 2 轮后买家抛 agenda 新话题');
reset(SC, GOAL_EMAIL);
say('Thanks for your interest, we are a professional manufacturer of dash cams');
const a2 = say('We have been in this industry for many years with strong production capacity');
t('第 2 轮抛出主动话题', T.BUYER_LINES.agenda.includes(a2.text), a2.text);
t('agendaIdx 推进', state.chat.mem.agendaIdx === 1);

console.log('\n[4] 通关路径：信任度攒满 3 分后命中目标 → win');
reset(SC, GOAL_EMAIL);
say('We can offer FOB Shenzhen USD 46 per unit');
say('The A12 is CE and E-mark certified');
say('We provide 18 months warranty and 1 percent spare parts');
t('信任度 = 3', state.chat.trust === 3);
const w = say('Could you share your business email so I can send the full offer?');
t('触发通关', w.win === true, JSON.stringify(w));
t('win 模板已填充', /\w+@\w+\.com/.test(w.text), w.text);

console.log('\n[5] 通关前索要联系方式 → deflect 搪塞且递进');
reset(SC, GOAL_EMAIL);
const d1 = say('What is your email address?');
const d2 = say('Can I get your WhatsApp number please?');
t('第1次搪塞', T.BUYER_LINES.deflect.includes(d1.text), d1.text);
t('第2次搪塞升级（不同句）', d2.text !== d1.text, d2.text);

console.log('\n[6] 防连读压测：任意 30 轮混合输入下，买家相邻两句永不相同');
reset(SC, GOAL_EMAIL);
state.chat.mem.lastBuyerText = SC.opening; // 开场白计入去重（页面同款逻辑）
const inputs = [
  'ok', 'hello', line1, line1, 'What is your email?', 'What is your email address now?',
  'Our price is USD 46 FOB Shenzhen', 'The price is USD 46 FOB Shenzhen port',
  'We have CE certification', 'We also have E-mark certification',
  'Warranty is 18 months', 'After-sales service is guaranteed',
  'We can send samples in 3 days', 'Trial order is welcome',
  'MOQ is 200 pcs', 'Lead time is 20 days after deposit',
  'We are a factory with 10 years experience', 'Our factory is ISO certified',
  'Do you support OEM', 'We support OEM packaging',
  line1, 'What is your WhatsApp?', 'Price USD 45', 'Price USD 44 for you',
  'Good quality guaranteed', 'Shipping by sea or air', 'Thanks', line1, 'Any discount for 1000 pcs', 'Final price USD 43',
];
let adjacentDup = null;
const VERBOSE = process.env.VERBOSE === '1';
for (const msg of inputs) {
  const prev = state.chat.mem.lastBuyerText; // buyerThink 内部会覆盖，先存上一句
  const out = say(msg);
  if (VERBOSE) console.log('    [you] ' + msg + '\n    [buyer] ' + out.text + '\n');
  if (out.text === prev) adjacentDup = msg;
}
t('30 轮无相邻复读', adjacentDup === null, '违规输入: ' + adjacentDup);

console.log('\n[7] 通关防误触：信任度不足时命中目标不通关');
reset(SC, GOAL_EMAIL);
say('We offer good products with competitive price and fast delivery');
const nw = say('Please give me your email');
t('未通关（trust<3）', nw.win !== true && T.BUYER_LINES.deflect.includes(nw.text), nw.text);

console.log('\n[8] 报价语义：型号/期限数字不算报价，真报价才算');
reset(SC, GOAL_EMAIL);
const m1 = say('Our A12 model with 4K dual lens and 18 months warranty is very popular');
t('"A12/18 months" 不误判为报价', state.chat.flags.price !== true && state.chat.trust === 1, 'trust=' + state.chat.trust);
reset(SC, GOAL_EMAIL);
const m2 = say('Our best price is USD 46 per unit FOB Shenzhen');
t('"USD 46" 识别为报价（且 price 一词不误触发 cert）', state.chat.flags.price === true && !state.chat.flags.cert && state.chat.trust === 1, JSON.stringify(state.chat.flags));
reset(SC, GOAL_EMAIL);
const m3 = say('We are a factory with 200 workers and 10 years experience');
t('无关数字不判报价', state.chat.flags.price !== true, JSON.stringify(state.chat.flags));
reset(SC, GOAL_EMAIL);
const m4 = say('The unit price is 46 dollars each');
t('"price 46 dollars" 识别为报价', state.chat.flags.price === true, JSON.stringify(state.chat.flags));

console.log('\n[9] 空话与符号报价：high quality 不加分，$80 算报价且走议价分支');
reset(SC, GOAL_EMAIL);
say('hi dear');
const q = say('high quality');
t('"high quality" 空话不加分', state.chat.flags.warranty !== true && state.chat.trust === 0, JSON.stringify(state.chat.flags));
reset(SC, GOAL_EMAIL);
const d = say('$80');
t('"$80" 识别为报价', state.chat.flags.price === true && state.chat.trust === 1, JSON.stringify(state.chat.flags));
t('"$80" 走议价分支（场景压价，不再反问报价）', d.text === SC.pushback, d.text);

console.log('\n[10] 乱码处理：gibberish 轮换不重复，短句连发无相邻复读');
reset(SC, GOAL_EMAIL);
const g1 = say('dgdgdfgdfgdfgdfhgjkdhfghdf gg');
const g2 = say('dfgggggghhhhhhhhhhhhhhhhhhh');
const g3 = say('bbbbbbbbbbbbbbbbbbbbbbbbbbb');
t('乱码1 → gibberish 池', T.BUYER_LINES.gibberish.includes(g1.text), g1.text);
t('乱码2 → gibberish 升级（不同句）', T.BUYER_LINES.gibberish.includes(g2.text) && g2.text !== g1.text, g2.text);
t('乱码3 → gibberish 第三句', T.BUYER_LINES.gibberish.includes(g3.text) && g3.text !== g2.text, g3.text);
t('乱码连发消耗耐心', state.chat.mem.mood < 0, 'mood=' + state.chat.mem.mood);
reset(SC, GOAL_EMAIL);
const shorts = [];
for (const s of ['ok', 'hi', '$80', 'good', 'fine']) shorts.push(say(s).text);
t('短句连发 5 次无相邻复读', shorts.every((x, i) => i === 0 || x !== shorts[i - 1]), JSON.stringify(shorts));
reset(SC, GOAL_EMAIL);
const normal = say('We are a professional manufacturer of automotive electronics in Shenzhen China');
t('正常长句不判乱码', !T.BUYER_LINES.gibberish.includes(normal.text), normal.text);

console.log('\n[11] 优秀答案但零关键词：买家不误扣情绪、主动推进新话题、无复读');
reset(SC, GOAL_EMAIL);
const goodOff = [
  'We have been supplying dash cams to European markets since 2016 with strong references',
  'Our engineering team handles all firmware development in-house for fast customization',
  'We attend the Hong Kong Global Sources fair every year and can arrange a factory audit',
  'Many German distributors work with us on private label projects with good margins',
  'Our production line runs full inspection before packing to ensure consistent output levels',
  'We can support marketing materials and product videos for your online channels',
];
const offReplies = [];
for (const g of goodOff) offReplies.push(say(g).text);
t('6 轮优秀长句零关键词不加分', state.chat.trust === 0, 'trust=' + state.chat.trust);
t('情绪不误扣', state.chat.mem.mood === 0, 'mood=' + state.chat.mem.mood);
t('无相邻复读', offReplies.every((x, i) => i === 0 || x !== offReplies[i - 1]));
t('买家主动推进话题（agenda 出现）', offReplies.some((x) => T.BUYER_LINES.agenda.includes(x)), JSON.stringify(offReplies));

console.log('\n[12] 关键词刷分：同词堆砌零分，报菜名单轮最多 +2');
reset(SC, GOAL_EMAIL);
say('ce ce ce ce');
t('"ce ce ce" 堆砌零分', state.chat.trust === 0 && state.chat.flags.cert !== true, JSON.stringify(state.chat.flags));
reset(SC, GOAL_EMAIL);
say('warranty warranty warranty');
t('"warranty" 堆砌零分', state.chat.trust === 0, JSON.stringify(state.chat.flags));
reset(SC, GOAL_EMAIL);
say('ce warranty sample price 46 usd');
t('一句话报满菜名最多 +2', state.chat.trust === 2, 'trust=' + state.chat.trust);
reset(SC, GOAL_EMAIL);
say('ce ce ce ce');
const stuffReply = T.BUYER_LINES.callout; // buyerDecide 返回的是 callout 池
reset(SC, GOAL_EMAIL);
const sr = say('ce ce ce ce');
t('堆砌被买家点破', stuffReply.includes(sr.text), sr.text);

console.log('\n[13] 话题 2 回合跳转：同一话题第 3 次买家主动转移');
reset(SC, GOAL_EMAIL);
const certMsgs = [
  'We have CE certification for the European market requirements',
  'The A12 model also carries E-mark certification for automotive use',
  'Our factory passed FCC certification audits last year successfully',
];
const certReplies = [];
for (const cmsg of certMsgs) certReplies.push(say(cmsg).text);
t('认证话题前 2 回合走 cert 池', T.BUYER_LINES.cert.includes(certReplies[0]) && T.BUYER_LINES.cert.includes(certReplies[1]));
t('第 3 回合强制换话题（不再 cert 池）', !T.BUYER_LINES.cert.includes(certReplies[2]), certReplies[2]);
reset(SC, GOAL_EMAIL);
const priceMsgs = ['Our price is USD 46', 'I can do USD 45 for you', 'Final offer is USD 44 FOB'];
const priceReplies = [];
for (const pm of priceMsgs) priceReplies.push(say(pm).text);
t('议价第 3 回合强制换话题', !T.BUYER_LINES.pricePush.includes(priceReplies[2]) && !priceReplies[2].includes(SC.pushback), priceReplies[2]);

console.log('\n[13b] 话题跳转后回归：不说重复台词，且只允许 1 个回合');
reset(SC, GOAL_EMAIL);
const backMsgs = [
  'We have CE certification for the European market requirements',
  'The A12 model also carries E-mark certification for automotive use',
  'Our factory passed the FCC certification audit last year',
  'Also the CE certificate is valid for two more years',      // 跳转后回归认证
  'And the E-mark certificate covers all EU countries',       // 回归 1 轮后应再跳
];
const backReplies = [];
for (const bm of backMsgs) backReplies.push(say(bm).text);
t('回归轮不说重复台词（非第 1 轮原话）', backReplies[3] !== backReplies[0], backReplies[3]);
t('回归 1 个回合后再跳转（第 5 轮非 cert 池）', !T.BUYER_LINES.cert.includes(backReplies[4]), backReplies[4]);

console.log('\n[14] 中文回复：买家要求英语且不加分');
reset(SC, GOAL_EMAIL);
const zh = say('我们的产品质量非常好，价格也很优惠');
t('中文回复零加分', state.chat.trust === 0, 'trust=' + state.chat.trust);
t('买家要求英语', T.BUYER_LINES.english.includes(zh.text), zh.text);
t('中文消耗耐心', state.chat.mem.mood < 0, 'mood=' + state.chat.mem.mood);

console.log('\n[15] 收尾提示：信任已够 + 后期轮次，买家引导候选人推进（仅一次）');
reset(SC, GOAL_EMAIL);
say('Our price is USD 46 per unit FOB Shenzhen');     // trust 1
say('The A12 is CE and E-mark certified');            // trust 2
say('We provide 18 months warranty');                 // trust 3
state.chat.turns = 8; // 模拟已到后期
const hintText = say('We also provide full marketing support for your channels');
t('信任 3 + 第 8 轮触发收尾提示', /anything you would like from me/i.test(hintText.text), hintText.text);
const hintText2 = say('Our lead time is 20 days after deposit');
t('收尾提示只给一次', !/anything you would like from me/i.test(hintText2.text), hintText2.text);

console.log('\n[16] 通关概率：3 分 70% 抽签（未中引导补分），4 分必得');
Math.random = () => 0.99; // 强制抽不中
reset(SC, GOAL_EMAIL);
say('Our price is USD 46 per unit FOB Shenzhen');   // trust 1
say('The A12 is CE and E-mark certified');          // trust 2
say('We provide 18 months warranty');               // trust 3
const unlucky = say('Could you share your email?');
t('3 分抽不中 → 不通关', unlucky.win !== true, JSON.stringify(unlucky));
t('抽不中 → uncertain 台词（非 deflect）', T.BUYER_LINES.uncertain.includes(unlucky.text), unlucky.text);
say('We can send samples within 3 days');           // trust 4 满分
const lucky = say('Could you share your email now?');
t('4 分满分 → 必通关（随机数也拦不住）', lucky.win === true, JSON.stringify(lucky));
Math.random = () => 0.5; // 0.5 < 0.7 应命中
reset(SC, GOAL_EMAIL);
say('Our price is USD 46 per unit');
say('The A12 is CE and E-mark certified');
say('We provide 18 months warranty');
const mid = say('What is your email address?');
t('3 分 + 随机数 0.5 < 0.7 → 通关', mid.win === true, JSON.stringify(mid));
Math.random = _random; // 恢复

// ===== 以下为「买家更聪明」智能升级用例（场景心理价位 / 事实回显 / 矛盾点破 / 悬问催答 / 议程确认） =====
const DE = { // 带 target 的真实场景（心理价位 43.5）
  id: 'CHAT-DE-001', market: '德国 · 慕尼黑',
  persona: 'Klaus Müller · Procurement Manager, Müller Auto-Electronics GmbH',
  opening: 'Hello! We are a distributor of automotive electronics in Munich. What is your best FOB price?',
  pushback: 'I have an offer from another supplier at USD 43.50 for a similar model. Can you do better on 500 pcs?',
  target: 43.5,
};

console.log('\n[17] 价格智能分流：DE 心理价位 43.5，按报价高低差异化反应');
reset(DE, GOAL_EMAIL);
const ph = say('Our best price is USD 48 per unit FOB Shenzhen');
t('报价 48（≥43.5+3）→ 强压并回显双方数字', ph.text.includes('48') && ph.text.includes('43.5'), ph.text);
reset(DE, GOAL_EMAIL);
const pn = say('Our best price is USD 46 per unit FOB Shenzhen');
t('报价 46（正常区间）→ 常规场景压价', pn.text === DE.pushback, pn.text);
reset(DE, GOAL_EMAIL);
const pg = say('Our best price is USD 40 per unit FOB Shenzhen');
t('报价 40（≤43.5-3）→ 积极推进并回显 40', pg.text.includes('40') && /competitive|attention|better than I expected/.test(pg.text), pg.text);
reset(DE, GOAL_EMAIL);
const ps = say('Our best price is USD 35 per unit FOB Shenzhen');
t('报价 35（≤43.5-8）→ 怀疑超低价质量', ps.text.includes('35') && /cut to get there|too good|quality holds/.test(ps.text), ps.text);

console.log('\n[18] 事实回填：报过的质保月数，买家台词原样回显');
reset(DE, GOAL_EMAIL);
const w12 = say('We provide 12 months warranty and free spare parts');
t('报 12 个月 → 回复以 "12 months" 开头', /^12 months/.test(w12.text), w12.text);
reset(DE, GOAL_EMAIL);
const w18 = say('We provide warranty and after-sales service for all products');
t('未报月数 → 默认 18 个月回显', /^18 months/.test(w18.text), w18.text);

console.log('\n[19] 改价矛盾：46 → 42 被点破，且每局最多点破一次');
reset(DE, GOAL_EMAIL);
say('Our price is USD 46 per unit');
const c1 = say('I can do USD 42 for you');
t('改价被点破（同时回显新旧报价）', /46/.test(c1.text) && /42/.test(c1.text), c1.text);
t('点破句来自 conflict 池（变量已回填）', T.BUYER_LINES.conflict.some((x) => c1.text === x.split('{old}').join('46').split('{price}').join('42')), c1.text);
const c2 = say('Final price is USD 40 FOB Shenzhen');
t('第三次改价不再点破（转入价格分流）', !/Earlier you quoted|moving target/.test(c2.text), c2.text);

console.log('\n[20] 悬问催答：答非所问先点破，正面回答不催');
reset(DE, GOAL_EMAIL);
say('We are a professional manufacturer with strong quality control systems');
const ag = say('We have been in this industry for many years with strict inspection');
t('第 2 轮买家主动问付款条款', /payment terms/i.test(ag.text), ag.text);
const dodge = say('Our factory has ten production lines and advanced equipment');
t('答非所问 → 前缀点破未答问题', dodge.text.startsWith('You did not really answer my question about payment terms'), dodge.text);
t('点破后接实质追问（催报价）', /your best price/i.test(dodge.text), dodge.text);
const ans0 = say('We accept T/T 30% deposit before production');
t('只答付款不报价 → 确认付款但仍催价（悬问保持）', ans0.text.includes('did not really answer my question about your best FOB price') && T.BUYER_LINES.ackPayment.some((x) => ans0.text.includes(x)), ans0.text);
const quote = say('Our best price is USD 44 per unit FOB Shenzhen');
t('给出报价 → 悬问消除', !quote.text.includes('did not really answer'), quote.text);
const ans = say('Payment is by T/T with 30% deposit');
t('再答付款 → 无催答 + ackPayment 池轮换', !ans.text.includes('did not really answer') && T.BUYER_LINES.ackPayment.includes(ans.text), ans.text);

console.log('\n[21] 议程答案确认：正面回应买家出过的话题 → 主题确认句');
reset(DE, GOAL_EMAIL);
const ao = say('We support OEM packaging with your logo on the box');
t('OEM 回应 → ackOem 池', T.BUYER_LINES.ackOem.includes(ao.text), ao.text);
reset(DE, GOAL_EMAIL);
const ad = say('Yes, we give a 3 percent volume discount for quarterly repeat orders');
t('折扣回应 → ackDiscount 池', T.BUYER_LINES.ackDiscount.includes(ad.text), ad.text);
reset(DE, GOAL_EMAIL);
const ash = say('DDP shipping to Hamburg is also possible for us');
t('DDP 回应 → ackShipping 池', T.BUYER_LINES.ackShipping.includes(ash.text), ash.text);

// ===== 以下为「谈判力测评层」用例（黄执中行为说服 + 熊浩哈佛谈判术情境） =====
console.log('\n[22] 拖延测试：中期未报价 → 买家拖延；可验证时间+动作 → 配合推进；放任 → 冷淡');
reset(SC, GOAL_EMAIL);
say('We are a professional manufacturer with strong quality control');        // t1
say('We have been in this industry for many years with strict inspection');  // t2 agenda
say('Our factory has ten production lines and advanced equipment');          // t3 nudge
say('We attend trade shows regularly and have many loyal customers');        // t4
const st5 = say('Our team is experienced and our quality is reliable');       // t5 → 拖延
t('第 5 轮仍未报价 → 买家抛拖延', T.BUYER_LINES.stall.includes(st5.text), st5.text);
const adv = say('Could we schedule a quick call this Thursday to go through the details?');
t('给出时间+动作 → 买家配合推进', T.BUYER_LINES.stallOk.includes(adv.text), adv.text);
reset(SC, GOAL_EMAIL);
say('We are a professional manufacturer with strong quality control');
say('We have been in this industry for many years with strict inspection');
say('Our factory has ten production lines and advanced equipment');
say('We attend trade shows regularly and have many loyal customers');
const st5b = say('Our team is experienced and our quality is reliable');
t('拖延每局只测一次', st5b.text === st5.text, st5b.text);
const idle = say('OK no problem, take your time');
t('放任拖延 → 买家冷淡收场', T.BUYER_LINES.stallCold.includes(idle.text), idle.text);

console.log('\n[23] 立场-利益：第 2 次报价买家抛立场，纵向追问才揭示真实利益');
reset(SC, GOAL_EMAIL);
say('Our price is USD 46 per unit');              // 第 1 次报价 → 场景压价
const stc = say('The best I can offer is USD 45'); // 第 2 次报价（小让步非矛盾）→ 立场宣言
t('第 2 次报价 → 买家立场宣言（非压价台词）', T.BUYER_LINES.stance.includes(stc.text), stc.text);
const why = say('I hear you. But why is the budget so tight this quarter?');
t('纵向追问 why → 买家揭示真实利益', T.BUYER_LINES.reveal.includes(why.text), why.text);
reset(SC, GOAL_EMAIL);
say('Our price is USD 46 per unit');
say('The best I can offer is USD 45');
const nowhy = say('Okay, I will give you a special discount then');
t('不追问 → 不揭示（走常规链）', !T.BUYER_LINES.reveal.includes(nowhy.text), nowhy.text);

console.log('\n[24] 让步质量：免费让步被得寸进尺，条件让步换来交换框架');
reset(SC, GOAL_EMAIL);
say('Our price is USD 46 per unit');
say('I can do USD 45 for you');                     // stance
const free = say('Okay fine, USD 43 is my final price');  // 免费让步
t('免费让步 → 买家得寸进尺继续压', T.BUYER_LINES.squeeze.includes(free.text), free.text);
reset(SC, GOAL_EMAIL);
say('Our price is USD 46 per unit');
say('I can do USD 45 for you');                     // stance
const cond = say('For an order of 1000 pcs, in exchange I can do USD 44');  // 条件让步
t('条件让步（if you...）→ 买家接住交换框架', T.BUYER_LINES.dealBait.includes(cond.text), cond.text);

console.log('\n[25] 谈判力信号：六类谈判行为锚点逐项检出（不影响信任分）');
reset(SC, GOAL_EMAIL);
const trustBefore = state.chat.trust;
say('I understand your concern, that makes sense');                          // empathy
say('May I ask why the budget is tight this quarter?');                      // digInterest
say('If you commit to 500 pcs, in exchange I can offer better terms');       // conditional
say('We can offer a full package including mounting accessories');           // package
say('Let us start with a trial order of 10 samples');                        // smallAsk
say('I will send you a written summary after this chat');                    // confirmLog
t('情绪确认', state.chat.mem.negoSignals.empathy === true);
t('挖掘利益', state.chat.mem.negoSignals.digInterest === true);
t('条件让步', state.chat.mem.negoSignals.conditional === true);
t('打包方案', state.chat.mem.negoSignals.package === true);
t('小步推进', state.chat.mem.negoSignals.smallAsk === true);
t('留痕确认', state.chat.mem.negoSignals.confirmLog === true);
t('情绪确认缓和买家耐心（mood≥0）', state.chat.mem.mood >= 0, 'mood=' + state.chat.mem.mood);
t('信号不虚增信任分（仅 sample 1 分）', state.chat.trust - trustBefore <= 1, 'trust=' + state.chat.trust);

console.log('\n========================================');
console.log('RESULT: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
