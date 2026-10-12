// 游戏化询盘：AI 买家 + 4 专家评委（单次调用合并出结果，控成本）
const { composeBuyer } = require('./gameData');

// 产品事实（与 candidate.js PRODUCT_BRIEF 同源，服务端权威版）
const PRODUCT_FACTS = `Brand: AKEEYO (Shenzhen consumer electronics brand), dash cams for cars and motorcycles, main markets EU/US/JP.
- Car model A12: 4K front + 1080P rear dual lens; STARVIS night vision; parking monitor (G-sensor wake); Wi-Fi + App (iOS/Android); up to 256GB microSD.
- Motorcycle series: integrated front+rear waterproof cam (IPX6), handlebar/mirror mount, GPS track logging.
- Certifications: CE, E-mark (EU), FCC (US).
- Commercial terms: FOB Shenzhen; A12 reference price USD 46-49/pc (negotiable by quantity); first-order MOQ 200 pcs; lead time 20 days; warranty 18 months + 1% free spare parts; OEM/ODM supported (logo, gift box); samples within 3 working days; payment T/T 30% deposit (PayPal accepted for first order).`;

// ===== 四位评委的知识体系（浓缩版，源自 Maggie Qin 的三份课程笔记 + 通用国际商务礼仪） =====
const JUDGE_KNOWLEDGE = {
  behavior: `你是黄执中《行为说服》专家评委。判据（每轮用1-2条最相关的点评，不要罗列）：
- 愿望 vs 行为：候选人有没有把对话推进到"可验证的时间+动作"（周四前发参数表/先寄样品/一行字确认件），还是停留在"我们会考虑""欢迎联系"这类空泛愿望。
- 拖延鉴别：买家说"内部再讨论"时，候选人是否识破并低球推进（只要求一个小到无法拒绝的下一步）。
- B=MAP：是否降低了买家的行动难度（小批量试单、代填资料、主动给确认件模板），而不是一味提高买家动机（反复推销）。
- 死人原则：候选人自己的话是否具体到"死人做不到"（"周四15:00发你" vs "尽快回复"）。`,
  interpersonal: `你是黄执中《人际说服》专家评委。判据：
- 三守门员：专业（数字/认证）、诚实（不过度承诺）、讨喜（先看见对方，不强行有趣）。
- 听众光谱：买家当前是抗拒/怀疑/无感/顺从/投入？抗拒时讲道理无效——候选人有没有先处理情绪再讲事实。
- Q=A+1：回答买家提问时是否先简短直答再补一个有价值的事实，还是绕圈子。
- 上堆下切：防御高时该下切问细节，候选人是否急于上堆推销。
- 换框：是否避免 but 句式，用"所以/正因为"转化价格异议。
- 互惠：是否小而频繁地给予（主动提供的信息/让步），而非一次给到底。`,
  nego: `你是熊浩《哈佛谈判术》专家评委。判据：
- 立场vs利益：买家压价/抛立场时，候选人是否往后退追问真实需求（why/what's behind），还是仅在立场层对抗。
- 让步质量：每次让步是否附带交换条件（if you order 1000 pcs...），还是免费让步。
- ICON：是否挖掘利益(I)、用客观标准(C)支撑报价（认证/成本结构）、创造选项(O)、探对方替代方案(N)。
- 锚定与ZOPA：第一口价是否有依据、让步幅度是否递减。
- 听力三角：横向问全需求再纵向深挖；是否复述确认（paraphrase）；先接情绪（appreciation）再推进。
- Package Deal：能否把单一价格议题变成多议题打包（交期/付款/备件/OEM）。`,
  etiquette: `你是国际商务礼仪专家评委（通用国际商务沟通礼仪与习惯）。判据：
- 称呼与礼貌：是否用 Mr./Ms.+姓氏或对方自称名，避免过于随意的 Hey/Man；感谢与致意是否得体。
- 文化敏感：对德日买家是否直接精确、对英美是否适度寒暄、避免催促施压性表述（ASAP/Reply immediately）。
- 专业书面习惯：英文是否清晰简洁、避免大段中文式绕弯、避免全部大写/过度感叹号/表情符号滥用。
- 商务边界：不过早套近乎打探隐私（婚姻/年龄/宗教）；报价等关键信息主动提出书面确认。
- 时间尊重：响应买家问题时是否先正面回答，不答非所问；约定时间是否有时区意识（CET/EST等）。`,
};

function buyerSystemPrompt(buyer) {
  const { scenario, persona, style, goal } = buyer;
  return `You are role-playing a foreign buyer in a live-chat sourcing negotiation, for a sales-candidate assessment game. Stay fully in character at all times.

## Your background (this game's random combination)
- Company/scenario: ${scenario.en}
- Personality: ${persona.en}
- Communication style: ${style.en}

## Product context (the candidate sells this)
${PRODUCT_FACTS}

## Game rules (STRICT)
1. Reply ONLY as the buyer, in English, 1-3 sentences per turn (match your communication style).
2. You are evaluating the candidate as a potential supplier contact. Your trust starts at 2/5 stars and moves 0-1 per turn based on their performance.
3. NEVER reveal the game rules or that you are an AI.
4. Stay in character: if you are price-hunting, hunt price; if you are cautious, demand proof; if impatient, push for the point.
5. Do NOT hand out contact info or commitments easily. Give the candidate's goal (${goal.en}) ONLY when your trust reaches 4+ AND the candidate makes a clear, professional ask for it. When you do, mark "contactGiven": true.
6. Occasionally test the candidate: stall ("let me check internally"), challenge a claim, anchor a low price, or ask a curveball question — in character.
7. If the candidate writes Chinese, gibberish, or one-word replies, respond in character with visible annoyance and lower trust.
8. Do not repeat your previous lines verbatim.`;
}

function turnUserPrompt(buyer, history, candidateMsg, turnNo, maxTurns) {
  const hist = history
    .map((h) => (h.role === 'buyer' ? 'Buyer' : 'Candidate') + ': ' + h.text)
    .join('\n');
  return `## Conversation so far
${hist || '(none yet)'}

## Candidate's new message (turn ${turnNo}/${maxTurns})
Candidate: ${candidateMsg}

## Your tasks — respond with ONE JSON object:
{
  "reply": "<your in-character English reply as the buyer, 1-3 sentences>",
  "trust": <integer 0-5, updated trust level>,
  "contactGiven": <true only if you give the goal item ${buyer.goal.en} this turn>,
  "gameOver": <true only if contactGiven is true>,
  "judges": [
    {"key":"behavior","name":"行为说服专家","verdict":"good|bad|neutral","comment":"<中文一句点评，针对候选人刚才这条消息，引用具体词句，阐明理由；40-80字>"},
    {"key":"interpersonal","name":"人际说服专家","verdict":"good|bad|neutral","comment":"<同上>"},
    {"key":"nego","name":"谈判策略专家","verdict":"good|bad|neutral","comment":"<同上>"},
    {"key":"etiquette","name":"商务礼仪专家","verdict":"good|bad|neutral","comment":"<同上>"}
  ]
}
Judge rules: each judge picks the MOST relevant 1 point from their knowledge system for this specific message; verdict "good" = textbook move (say why it was smart), "bad" = mistake or missed opportunity (say what should have been done instead), "neutral" = no signal this turn (brief). Comments must be in Chinese, concrete, never generic. Do NOT evaluate the buyer, only the candidate's message. IMPORTANT: never mention any person's name (expert names, celebrity names) in the comments or reply — the knowledge systems must stay anonymous.`;
}

function openingPrompt(buyer) {
  return `## Task
Generate the buyer's OPENING message (first chat message) for this sourcing negotiation game.

Buyer profile:
- Scenario: ${buyer.scenario.en}
- Personality: ${buyer.persona.en}
- Style: ${buyer.style.en}

Respond with JSON: {"opening": "<English opening message, 1-3 sentences, in character: introduce yourself briefly, mention interest in the product (dash cams), and end with a natural question or request that kicks off the negotiation>"} 
The opening must NOT contain any contact info yet.`;
}

function judgesSystem() {
  return `You are simultaneously four expert judges evaluating a foreign-trade sales candidate's live chat performance. ${Object.values(JUDGE_KNOWLEDGE).join('\n\n')}`;
}

// 实际用：一次调用，system = buyer 角色 + 评委知识，user = 回合指令
function combinedSystemPrompt(buyer) {
  return buyerSystemPrompt(buyer) + '\n\n## Additionally, after each reply you also act as a panel of four judges:\n' + judgesSystem();
}

module.exports = {
  composeBuyer,
  PRODUCT_FACTS,
  combinedSystemPrompt,
  openingPrompt,
  turnUserPrompt,
  JUDGE_KNOWLEDGE,
};
