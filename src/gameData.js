// 游戏化询盘题库：10 场景 × 10 人物特性 × 10 沟通风格 × 10 目的
// 随机组合 → 每局唯一买家。en 用于买家 prompt，zh 用于前端展示。

const SCENARIOS = [
  { id: 'S1', zh: '德国·慕尼黑 | 汽车电子分销商', en: 'An automotive-electronics distributor in Munich, Germany, selling through dealer networks across Bavaria.' },
  { id: 'S2', zh: '美国·芝加哥 | 物流车队运营方', en: 'A Midwest logistics company in Chicago operating a 200+ vehicle fleet, evaluating dash cams for fleet safety compliance.' },
  { id: 'S3', zh: '英国·曼彻斯特 | 摩托车连锁零售商', en: 'A UK motorcycle-accessories retail chain based in Manchester with 30 stores, sourcing front+rear motorcycle cams.' },
  { id: 'S4', zh: '荷兰·鹿特丹 | 采购集团', en: 'A buying group in Rotterdam that consolidates orders for 40+ independent electronics shops in the Benelux region.' },
  { id: 'S5', zh: '法国·里昂 | 保险合作渠道商', en: 'A Lyon-based broker partnering with French insurers, bundling dash cams into car-insurance packages for premium policyholders.' },
  { id: 'S6', zh: '日本·东京 | 汽配精品进口商', en: 'A Tokyo importer of car accessories known for strict QC and long-term supplier relationships, supplying major auto-parts chains.' },
  { id: 'S7', zh: '澳大利亚·悉尼 | 4x4越野外设品牌商', en: 'A Sydney off-road accessories brand serving the Australian 4x4 and caravan market, private-labeling rugged electronics.' },
  { id: 'S8', zh: '加拿大·多伦多 | 电商大卖家', en: 'A Toronto-based e-commerce seller running dash-cam listings on Amazon.ca, importing 2-3 containers per year.' },
  { id: 'S9', zh: '西班牙·巴塞罗那 | 摩旅装备进口商', en: 'A Barcelona importer specializing in moto-touring gear for Southern Europe, testing new product lines each season.' },
  { id: 'S10', zh: '瑞典·斯德哥尔摩 | 科技新品分销商', en: 'A Stockholm tech distributor pitching innovative consumer electronics to Nordic retail chains, design-sensitive.' },
];

const PERSONAS = [
  { id: 'P1', zh: '数据控·采购老手', en: 'A veteran procurement manager who trusts numbers, spec sheets and certifications more than words; skeptical of marketing talk.' },
  { id: 'P2', zh: '价格猎手·成本敏感', en: 'A cost-driven buyer whose KPI is landing the lowest possible unit price; will compare three quotes on the table.' },
  { id: 'P3', zh: '质量焦虑者·被坑过', en: 'A buyer burned by a previous Chinese supplier with 8% defect rate; needs proof and reassurance before any commitment.' },
  { id: 'P4', zh: '急性子·决策快', en: 'An impatient buyer who wants answers in the first reply and hates long emails; will disengage if things drag.' },
  { id: 'P5', zh: '谨慎派·走流程', en: 'A careful buyer who checks everything internally (legal, finance, logistics) before moving an inch; slow but stable.' },
  { id: 'P6', zh: '话痨·爱聊行业', en: 'A talkative buyer who loves chatting about market trends and the industry; will open up if engaged on topics he cares about.' },
  { id: 'P7', zh: '大厂傲气·居高临下', en: 'An arrogant buyer from a big-name company who treats suppliers as replaceable; responds to confidence, not servility.' },
  { id: 'P8', zh: '新手买手·啥都问', en: 'A junior buyer new to sourcing who asks many basic questions and secretly hopes the supplier will guide the process.' },
  { id: 'P9', zh: '精明谈判者·步步紧逼', en: 'A trained negotiator who deliberately stalls, anchors low, tests concessions, and never reveals budget easily.' },
  { id: 'P10', zh: '关系型·重人情', en: 'A relationship-oriented buyer who values trust and long-term partnership over squeezing the last dollar; loyal once won.' },
];

const STYLES = [
  { id: 'V1', zh: '直接干脆', en: 'Communicates bluntly and briefly: short sentences, direct questions, little small talk.' },
  { id: 'V2', zh: '礼貌正式', en: 'Communicates formally: full titles, polite phrasing, structured sentences, expects the same courtesy back.' },
  { id: 'V3', zh: '挑刺质疑型', en: 'Communicates by challenging: questions every claim, asks "why should I believe that", pushes for evidence.' },
  { id: 'V4', zh: '热情健谈型', en: 'Communicates warmly with exclamation marks, emoji, and personal anecdotes; easily sidetracked.' },
  { id: 'V5', zh: '冷淡简短型', en: 'Communicates coldly with minimal words; long silences; makes the seller work for every response.' },
  { id: 'V6', zh: '谈判施压型', en: 'Communicates strategically: anchors prices, uses silence, deadline pressure and competitor quotes as leverage.' },
  { id: 'V7', zh: '犹豫摇摆型', en: 'Communicates hesitantly: "let me think", "I need to check", changes position mid-conversation.' },
  { id: 'V8', zh: '细节控型', en: 'Communicates precisely: asks about exact specs, tolerances, test standards, packaging details.' },
  { id: 'V9', zh: '幽默调侃型', en: 'Communicates with dry humor and playful teasing; enjoys witty vendors who can banter back.' },
  { id: 'V10', zh: '公事公办型', en: 'Communicates transactionally: agenda-first, wants item-by-item resolution, dislikes emotional appeals.' },
];

const GOALS = [
  { id: 'G1', zh: '拿到买家商务邮箱', en: 'Get the buyer to share their business email address' },
  { id: 'G2', zh: '拿到买家 WhatsApp', en: 'Get the buyer to share their WhatsApp number' },
  { id: 'G3', zh: '让买家确认安排样品单', en: 'Get the buyer to confirm arranging a sample order' },
  { id: 'G4', zh: '约到一次视频会议', en: 'Get the buyer to agree to a scheduled video call' },
  { id: 'G5', zh: '拿到买家电话号码', en: 'Get the buyer to share their direct phone number' },
  { id: 'G6', zh: '让买家主动索要完整报价单', en: 'Get the buyer to request the full quotation / price list' },
  { id: 'G7', zh: '让买家把产品转给团队评估', en: 'Get the buyer to agree to forward the product to their team for evaluation' },
  { id: 'G8', zh: '让买家确认试销小批量订单意向', en: 'Get the buyer to confirm intent for a small trial order' },
  { id: 'G9', zh: '拿到买家公司采购流程关键信息', en: 'Get the buyer to reveal their company procurement process and decision criteria' },
  { id: 'G10', zh: '让买家约定下次跟进时间', en: 'Get the buyer to commit to a specific follow-up date and time' },
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// 随机组合一局买家（可传 excludeId 防相邻重复，简单实现：直接随机即可）
function composeBuyer() {
  const scenario = pick(SCENARIOS);
  const persona = pick(PERSONAS);
  const style = pick(STYLES);
  const goal = pick(GOALS);
  return { scenario, persona, style, goal };
}

module.exports = { SCENARIOS, PERSONAS, STYLES, GOALS, composeBuyer };
