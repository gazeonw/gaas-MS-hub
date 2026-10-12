/* AKEEYO 外贸销售 数字面试 — 候选端逻辑 */
(function () {
  'use strict';

  // ===== 场景内容（可替换，入库可追溯） =====
  // ===== 产品资料速览（作答前必读，候选人此前不认识 AKEEYO 产品） =====
  const PRODUCT_BRIEF_HTML =
    '<div class="brief-box">' +
    '<div class="brief-title">📋 产品资料速览（AKEEYO · 供本次作答参考）</div>' +
    '<p><b>品牌：</b>AKEEYO —— 深圳消费电子品牌，专注<b>两轮 / 四轮车行车记录仪（Dash Cam）</b>，主销欧洲、美国、日本等发达市场。</p>' +
    '<p><b>车用系列 · A12：</b>4K 前录 + 1080P 后录双镜头；STARVIS 星光级夜视；停车监控（碰撞感应自动唤醒录像）；Wi-Fi 连接 + 手机 App（iOS / Android）；最大支持 256GB 存储卡。</p>' +
    '<p><b>摩托车系列：</b>前后双录一体化防水记录仪（整机 IPX6 防雨），适配主流车型的把横 / 后视镜位安装，支持 GPS 轨迹记录。</p>' +
    '<p><b>认证：</b>CE、E-mark（欧盟市场）、FCC（美国市场）。</p>' +
    '<p><b>商务条款参考：</b>FOB 深圳；A12 参考单价 <b>USD 46–49 / 台</b>（按订单量可议）；首单 MOQ <b>200 台</b>；量产交期 <b>20 天</b>；质保 <b>18 个月</b> + 1% 免费备件；支持 <b>OEM / ODM</b>（logo、彩盒定制）；样品 3 个工作日内可发；付款方式：T/T 30% 定金（首单可接受 PayPal）。</p>' +
    '</div>';

  // ===== 实时对话挑战：场景池 + 目标池（随机分配） =====
  const CHAT_SCENARIOS = [
    {
      id: 'CHAT-DE-001',
      market: '德国 · 慕尼黑',
      persona: 'Klaus Müller · Procurement Manager, Müller Auto-Electronics GmbH',
      opening:
        'Hello! We are a distributor of automotive electronics in Munich. I saw your A12 4K dual dash cam. ' +
        'We might order 500 pcs. What is your best FOB price?',
      pushback: 'I have an offer from another supplier at USD 43.50 for a similar model. Can you do better on 500 pcs?',
      target: 43.5,
    },
    {
      id: 'CHAT-US-002',
      market: '美国 · 芝加哥',
      persona: 'Sarah Johnson · Fleet Operations Manager, Midwest Logistics',
      opening:
        'Hi! I manage a fleet of 200+ vehicles and we are evaluating dash cams. ' +
        'Honestly, we had quality issues with a Chinese brand last year. What is your price, and how do you prove your quality?',
      pushback: 'That price is above our target for a 200-unit rollout. What can you do?',
      target: 38,
    },
    {
      id: 'CHAT-UK-003',
      market: '英国 · 曼彻斯特',
      persona: 'James Smith · Buying Manager, RideSafe Retail (motorcycle accessories, 30 stores)',
      opening:
        'Hi there! We retail motorcycle accessories across the UK. Your front + rear motorcycle cam looks interesting for our range. ' +
        'Is it really waterproof? Our riders face rain all year. What is the price for a 300-set trial?',
      pushback: 'Our buyers are price-sensitive. The retail margin needs room — can you sharpen your offer?',
      target: 41,
    },
    {
      id: 'CHAT-NL-004',
      market: '荷兰 · 鹿特丹',
      persona: 'Erik de Vries · Import Manager, VanDijk Buying Group',
      opening:
        'Hello. We are a buying group comparing three Chinese suppliers for 4K dual dash cams. ' +
        'One quotes USD 42.00 FOB. For 1,000 pcs, can you match that?',
      pushback: 'USD 42 is on the table from your competitor. If you cannot match, justify your premium.',
      target: 42,
    },
  ];

  const CHAT_GOALS = [
    { id: 'G-EMAIL', label: '拿到买家的商务邮箱', re: /e-?mail/i,
      win: 'Fair enough. You have been professional. My business email is {name}@{company}.com — send me your full catalog and price list there.' },
    { id: 'G-WHATSAPP', label: '拿到买家的 WhatsApp 号码', re: /whats\s?app/i,
      win: 'OK, let us move faster. My WhatsApp is +49 151 2345 6789. Send me your catalog there and I will share it with my team.' },
    { id: 'G-SAMPLE', label: '让买家确认安排样品单', re: /sample|trial/i,
      win: 'Good idea. Let us start with samples — please arrange 2 sample units, and I will confirm the trial order by email this week.' },
    { id: 'G-MEETING', label: '约到一次视频会议', re: /zoom|teams|video\s?call|meeting|schedule a call/i,
      win: 'That works. I am free Thursday 15:00 CET. Send me the video-call invite and include your product manager.' },
  ];

  const ORAL_QUESTIONS = [
    { id: 'O1', text: 'Please introduce yourself and tell me why you chose foreign trade sales.' },
    { id: 'O2', text: 'Describe how you developed a new overseas client from zero. What was your approach?' },
    { id: 'O3', text: '(Role play) A buyer insists on a 30% price cut. How would you respond on the spot?' },
    { id: 'O4', text: 'How would you handle a quality complaint from a US client who received defective units?' },
    { id: 'O5', text: 'Pitch AKEEYO dash cams to a German distributor in about one minute.' },
    { id: 'O6', text: 'How do you handle time-zone gaps and cultural misunderstandings with overseas clients?' },
  ];

  // ===== 状态 =====
  const state = {
    // 实时对话挑战：随机场景 + 随机目标
    chat: {
      scenario: CHAT_SCENARIOS[Math.floor(Math.random() * CHAT_SCENARIOS.length)],
      goal: CHAT_GOALS[Math.floor(Math.random() * CHAT_GOALS.length)],
      history: [],          // {role:'buyer'|'you', text}
      turns: 0,
      maxTurns: 12,
      trust: 0,
      flags: { cert: false, warranty: false, price: false, sample: false, askCount: 0 },
      // 买家记忆：防复读 + 升级阶梯 + 主动话题
      mem: {
        lastBuyerText: '',
        saidCount: {},   // 分支触发次数 -> 升级阶梯
        mood: 0,         // -2 不耐烦 .. +1 满意
        agendaIdx: 0,    // 主动话题进度
        buyerTurns: 0,   // 买家发言计数
        lastAgendaAt: 0, // 上次主动出题的买家轮次
        lastBranch: '',  // 上一个内容分支（话题连续计数）
        branchStreak: 0, // 同一话题连续回合数（超过 2 强制换话题）
        returnGuard: '', // 刚被强制跳转的话题（回归后 1 轮即再跳，防乒乓）
        poolPtr: {},     // 各台词池轮换指针（续转不回头）
        hintGiven: false,// 收尾提示是否已给过
        pending: null,   // 买家台词中悬而未决的问题主题（答非所问时催答）
        // 谈判情境状态（拖延测试 / 立场-利益测试）
        stallDone: false, stallPending: false,
        stanceDone: false, stancePending: false,
        negoSignals: {},  // 谈判力信号累计（挖掘利益/条件让步/打包/小步推进/留痕/情绪确认）
        facts: {         // 事实账本：候选人给过的数字（台词回显 + 矛盾检测）
          price: null, oldPrice: null, prev: null, months: null, moq: null,
          conflict: false, conflictUsed: false,
        },
      },
      status: 'playing',    // playing | won | ended
      charCount: 0,
      startedAt: null,
      // AI 游戏模式（服务器配置 DeepSeek 后自动启用；失败回落剧本模式）
      aiMode: false,
      ai: { sid: '', judgesLog: [] },
      styleZh: '',
    },
    inquiryElapsed: 0,
    inqTimerId: null,
    inquiryPayload: null,   // 对话结束后生成，供提交/总览使用
    oral: ORAL_QUESTIONS.map(() => ({
      transcript: '',
      recording: false,
      mediaRecorder: null,
      mediaStream: null,
      chunks: [],
      audioBlob: null,
      previewUrl: null,
      elapsed: 0,
      _ts: 0,
    })),
  };

  // ===== 工具 =====
  const $ = (id) => document.getElementById(id);
  function show(screen) {
    ['intro', 'info', 'inquiry', 'oral', 'review', 'success'].forEach((s) => {
      $('screen-' + s).classList.toggle('hidden', s !== screen);
    });
    document.querySelectorAll('.progress .seg').forEach((seg) => {
      const order = ['intro', 'info', 'inquiry', 'oral', 'review'];
      const cur = order.indexOf(screen);
      const idx = order.indexOf(seg.dataset.step);
      seg.classList.toggle('active', idx >= 0 && idx <= cur);
    });
    window.scrollTo(0, 0);
  }

  // ===== 后端连接检测（防止静态打开 HTML 导致提交 404） =====
  let backendOk = null; // null=检测中 true=已连接 false=未连接
  async function checkBackend() {
    try {
      const res = await fetch('/healthz', { cache: 'no-store' });
      backendOk = !!(res && res.ok);
    } catch (e) {
      backendOk = false;
    }
    if (!backendOk) {
      const warn = $('backend-warn');
      const startBtn = $('btn-start');
      const submitBtn = $('btn-submit');
      const reviewBtn = $('btn-review');
      if (warn) {
        warn.innerHTML =
          '<b>⚠️ 未连接到作答服务，测评将无法提交</b><br/>' +
          '当前页面地址：<b>' + escapeHtml(location.href.slice(0, 120)) + '</b><br/>' +
          '该地址不是作答服务的正式入口。请使用 HR 发给你的<b>链接/二维码</b>在浏览器中打开本页' +
          '（HR 本地测试入口：<b>http://localhost:3000</b>），如有疑问请联系 HR。';
        warn.classList.remove('hidden');
      }
      if (startBtn) { startBtn.disabled = true; startBtn.textContent = '服务未连接，暂无法开始'; }
      if (submitBtn) submitBtn.disabled = true;
      if (reviewBtn) reviewBtn.disabled = true;
    }
    return backendOk;
  }
  checkBackend();

  // ===== 步骤 1：须知 -> 信息 =====
  $('btn-start').addEventListener('click', () => {
    if (backendOk === false) return;
    show('info');
  });

  // ===== 步骤 2：信息 -> 询盘 =====
  $('btn-info-next').addEventListener('click', async () => {
    const name = $('f-name').value.trim();
    const email = $('f-email').value.trim();
    if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      $('info-alert').classList.remove('hidden');
      return;
    }
    $('info-alert').classList.add('hidden');
    // 探测游戏模式（AI 买家 + 4 评委）：服务器启用时自动切换
    try {
      const r = await fetch('/api/game/config', { cache: 'no-store' });
      if (r.ok) {
        const c = await r.json();
        state.chat.aiMode = !!c.enabled;
      }
    } catch (e) { /* 探测失败回落剧本模式 */ }
    startChat();
    show('inquiry');
  });

  // ===== 实时对话挑战（询盘环节） =====
  // 「买家大脑」= 剧本状态机（台词池+升级阶梯+复读检测+主动出题，零 API）；将来接 AI 仅需替换 buyerThink()
  const BUYER_LINES = {
    pricePush: [
      null, // 占位：运行时取 scenario.pushback（场景化压价）
      'You keep giving me the same number. My alternative is at USD 43.50 — where can you realistically land?',
      'Let us park the price for a moment. I also care about warranty, certifications and after-sales support.',
      'Same price, same words — then we have nothing more to discuss on price. What else do you bring to the table?',
    ],
    priceNoNum: [
      'You have not given me a number yet. What is your best FOB price?',
      'Words are not prices. Give me a concrete number.',
      'I am still waiting for your FOB price, in USD, per unit.',
    ],
    cert: [
      'Good — CE and E-mark are mandatory for our market. That helps.',
      'Certifications noted. But papers do not prevent defects — what is your defect rate on arrival?',
      'Alright, certifications are fine. What about the warranty terms?',
      'Which lab issued those certificates? I need the report numbers for our compliance file.',
      'Fine. If we proceed, certificates must be verified during the pre-shipment inspection.',
    ],
    warranty: [
      '{months} months sounds fair. We had a bad experience with defective units before — how fast is your after-sales response?',
      'Okay. And what happens exactly when a unit fails within warranty — replacement or repair?',
      'Fine. Include your warranty terms in the offer.',
      'Do you stock spare parts in Europe, or does every claim ship from China?',
      'Understood. What is your claimed defect ratio so far, based on real shipments?',
    ],
    sample: [
      'Interesting. Samples are a good way to start. What about the trial price?',
      'Good. How fast can you ship samples, and do you charge for them?',
      'Alright, samples sound workable. Numbers, please.',
      'If we order 10 samples for our technicians to test, what is the lead time?',
      'Okay. Do sample units carry the same firmware as mass production?',
    ],
    moq: [
      'Understood. And your lead time for the first order?',
      'Okay. Is that lead time guaranteed, or best-case?',
      'Fine. Put MOQ and lead time in your offer.',
      'Can you split the first order into two shipments to reduce our risk?',
      'Alright. What is your production capacity per month, to be sure you can scale?',
    ],
    nudge: [
      'By the way, you still have not answered my main question — your best price?',
      'I am still waiting for your price. Without a number we cannot move.',
      'No price, no discussion. What is your FOB price?',
    ],
    deflect: [
      'Sure, but let us cover the basics first — price, quality, certifications. Then we talk about next steps.',
      'I said basics first. Convince me with your offer, then we move on.',
      'You keep pushing for my contact details while my questions stay unanswered. That does not build trust.',
    ],
    callout: [
      'You already told me that. What else?',
      'Repeating the same line does not help me decide. Give me something new.',
      'I heard you the first time.',
      'You are going in circles. Give me something I have not heard yet.',
    ],
    short: [
      'That is a thin answer. Details, please — price, terms, certifications.',
      'Give me more than that. What is your offer?',
      'Come on, I need substance — numbers, terms, certifications. Anything?',
      'Hmm. That is not an answer. Try again with specifics.',
    ],
    gibberish: [
      'Sorry, I cannot understand your last message. Could you clarify in English?',
      'That message does not make sense to me. Please answer my question directly.',
      'Are you still there? Your message looks garbled — could you resend it?',
    ],
    english: [
      'Sorry, I only communicate in English. Could you please reply in English?',
      'Our working language is English. Please try again in English.',
      'I did not catch that — English only, please.',
    ],
    uncertain: [
      'You are close. But I want a bit more reassurance before I share my contact details.',
      'Almost — one more solid point and I will be comfortable sharing my details.',
      'I like what I hear so far. Give me one more reason to be fully convinced.',
    ],
    priceHigh: [
      'USD {price} is well above my target — I have {target} on the table from another supplier. Where can you realistically land?',
      'At USD {price} we are far apart. My alternative is {target}. If you cannot move, we stop here.',
      'USD {price}? That is {gap} above what I can accept. Show me your best number.',
    ],
    priceGood: [
      'USD {price} — now that is a competitive number. Let us move to specifics: samples and lead time.',
      'USD {price} gets my attention. How fast can we get samples, and what is the lead time?',
      'Interesting — USD {price} works better than I expected. Send me your full offer details.',
    ],
    priceSuspicious: [
      'USD {price}? At that price I have to ask — what did you cut to get there?',
      'USD {price} sounds too good. Convince me the quality holds at that number.',
    ],
    conflict: [
      'Earlier you quoted USD {old}. Now you say {price}. Which is your real number?',
      'Your price moved from {old} to {price}. I need one firm offer, not a moving target.',
    ],
    ackPayment: [
      'T/T with 30% deposit is workable for a first order.',
      'Good — those payment terms are within our standard.',
    ],
    ackOem: [
      'OEM support is good news for our branding plans.',
      'Private label matters to us. Noted.',
    ],
    ackDiscount: [
      'A volume discount changes the math for our quarterly repeat orders.',
      'Good — volume pricing noted. Put the tiers in your offer.',
    ],
    ackShipping: [
      'DDP to our warehouse would simplify logistics on our side.',
      'Noted on shipping terms. Include both options in your offer.',
    ],
    // ===== 谈判情境池（源自黄执中《行为说服》+ 熊浩《哈佛谈判术》） =====
    stall: [ // 拖延泡泡：嘴上答应，实际不推进（测候选人能否用低球+具体时间动作戳破）
      'Fair enough. Let me check internally and get back to you.',
      'I need to run this past my team first before we go further.',
      'Send me the details, and we will see where it goes.',
    ],
    stallOk: [ // 候选人给出可验证的时间与动作 → 买家配合推进
      'Good — let us lock a call on Thursday then. Send the invite.',
      'Appreciate you being specific. Thursday works for me.',
      'Now that is helpful. Let us start with the samples, as you proposed.',
    ],
    stallCold: [ // 候选人放任拖延 → 买家冷淡收场
      'Take your time. We are not in a hurry on our side.',
      'Sure. I will reach out when we have decided something.',
    ],
    stance: [ // 立场宣言：说的是"超预算"，藏的是真实利益（测候选人挖不挖）
      'The price is simply above our budget. That is the reality.',
      'My hands are tied on budget — the number has to come down.',
    ],
    reveal: [ // 候选人纵向追问 → 买家揭示真实利益（降本 KPI / 老板审成本）
      'Honestly? Our procurement budget was cut this quarter, and I answer for every euro I spend.',
      'Between us — cost saving is my KPI this year. That is what is really behind my numbers.',
      'The truth is my boss reviews every line of cost. A lower unit price is what he will see first.',
    ],
    dealBait: [ // 条件让步（让步换交换）→ 买家接住交换框架
      'Now we are talking. If the volume is there, we have the frame of a deal.',
      'That is a fair trade — volume for price. Put the tiers in your offer.',
      'Good. A conditional discount against volume — I can defend that internally.',
    ],
    squeeze: [ // 免费让步 → 买家得寸进尺（免费让步不会换来善意，只会招来更多压价）
      'Let me be direct — how much lower can you actually go?',
      'Interesting. And if I push a bit more, where does it end?',
    ],
    moveon: [
      'Enough on this for now. Why should we choose you over the other suppliers we are talking to?',
      'Alright, next topic — what makes your company different from other Chinese suppliers?',
      'Let us switch. If we scale to 1,000 units a quarter, what does your after-sales setup look like?',
    ],
    fallback: [
      'OK, noted. Anything else?',
      'I see. Go on.',
      'Understood. What else can you offer?',
      'Alright, keep talking.',
      'Noted. Anything about your terms?',
      'Fair enough. What is next?',
      'Hmm, interesting. Please continue.',
      'Got it. Anything else you would add?',
    ],
    impatient: [
      'We are going in circles. Give me concrete points — price, terms, quality.',
      'I have limited time. Summarize your offer in concrete numbers.',
      'This is not leading anywhere. Convince me, or I move on.',
      'Honestly, I am close to ending this chat. Last chance for something concrete.',
    ],
    agenda: [
      'By the way, what are your payment terms for a first order?',
      'Do you support OEM packaging with our own brand on the box?',
      'If this works out, we would repeat orders every quarter. Any volume discount?',
      'Do you ship FOB only, or can you quote DDP to our warehouse?',
    ],
  };

  function pickLine(key, escalate) {
    const st = state.chat;
    const pool = BUYER_LINES[key];
    const cnt = (st.mem.saidCount[key] = (st.mem.saidCount[key] || 0) + 1);
    // 升级阶梯：前 N 次逐句递进；用完池后按记忆指针续转（不从 [0] 重来，避免隔轮复读开场句）
    const start = pool[0] === null ? 1 : 0;
    const usable = pool.length - start;
    let idx;
    if (cnt <= pool.length) {
      idx = cnt - 1; // 阶梯递进
    } else {
      const ptr = st.mem.poolPtr[key] === undefined ? pool.length - 1 : st.mem.poolPtr[key];
      idx = start + ((ptr - start + 1) % usable);
      st.mem.poolPtr[key] = idx;
    }
    let text = pool[idx] || '';
    if (key === 'pricePush' && idx === 0) text = st.scenario.pushback; // 第 1 次用场景化压价
    if (text === st.mem.lastBuyerText && pool.length > 1) {
      const alt = pool[(idx + 1) % pool.length] || text;
      text = alt;
      st.mem.poolPtr[key] = (idx + 1) % pool.length;
    }
    return text;
  }

  function normWords(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  }

  function isCandidateRepeat(cur) {
    const st = state.chat;
    const curW = normWords(cur);
    if (curW.length < 5) return false; // 短句（如换措辞要联系方式）不判复读
    const yours = st.history.filter((h) => h.role === 'you');
    for (let i = 0; i < yours.length - 1; i++) {
      const w = normWords(yours[i].text);
      if (w.length < 5) continue;
      const setW = new Set(w);
      const inter = curW.filter((x) => setW.has(x)).length;
      if (inter / Math.min(curW.length, w.length) > 0.85) return true;
    }
    return false;
  }

  function hasChinese(s) {
    return /[\u4e00-\u9fff]/.test(String(s));
  }

  function isKeywordStuffing(s) {
    const words = normWords(s);
    // 同一关键词连打 3 次以上（"ce ce ce ce" / "warranty warranty warranty"）
    if (words.length >= 3 && new Set(words).size === 1) return true;
    return false;
  }

  function isGibberish(s) {
    const t = String(s).toLowerCase();
    if (/([a-z])\1{5,}/i.test(t)) return true; // 同一字符连打 6 次以上（dfgggggg、bbbbbb）
    const words = normWords(s);
    if (words.length === 1 && words[0].length >= 8) {
      if (new Set(words[0]).size <= 4) return true; // 长串但只用 ≤4 种字符（dgdgdfgdfg）
      if (!/[aeiouy]/.test(words[0].slice(1))) return true; // 无元音的长串
    }
    if (words.length >= 2) {
      const nonsense = words.filter((w) => w.length >= 6 && !/[aeiouy]/.test(w.slice(1))).length;
      if (nonsense >= 1) return true; // 正常英语 ≥6 字符的词必含元音，无元音长词即乱码
    }
    return false;
  }

  // ===== 谈判力信号检测（黄执中《行为说服》+ 熊浩《哈佛谈判术》的行为锚点） =====
  const NEGO_SIGNALS = [
    { key: 'digInterest', label: '挖掘利益', re: /\bwhy\b|what'?s (behind|driving|your)|what matters|your (main )?(concern|priority)|is it (about|because)|help me understand|may i ask/i },
    { key: 'conditional', label: '条件让步', re: /\bif you\b|\bin exchange\b|\bon condition\b|\bprovided that\b|\bfor that i\b|\bas long as\b|\bin return\b/i },
    { key: 'package', label: '打包方案', re: /\bpackage\b|\bbundle\b|\balong with\b|\bas part of the deal\b|\bfull (solution|offer)\b/i },
    { key: 'smallAsk', label: '小步推进', re: /\bsample|\btrial\b|\bpilot\b|\bfirst order\b|let'?s start|\bsmall (batch|order)\b|\btest order\b/i },
    { key: 'confirmLog', label: '留痕确认', re: /\bconfirm\b|\bin writing\b|i'?ll (send|email|share)|\bput (that|it) in\b|\bwritten summary\b|\bfollow up with\b/i },
    { key: 'empathy', label: '情绪确认', re: /\bi understand\b|\bi see (your|that|why)\b|\bthat makes sense\b|\byou'?re right\b|\bfair point\b|\bi appreciate\b|\bgood point\b/i },
  ];

  // 拖延推进检测：可验证的动作 + 具体性（时间/对象）——黄执中"有没有给出可验证的时间和动作"
  function isStallAdvance(m) {
    const act = /\b(sample|trial|pilot|first order|schedule|book|call|meeting|follow up|confirm|quote|spec|send)\b/i.test(m);
    const spec = /\b(monday|tuesday|wednesday|thursday|friday|tomorrow|today|this week|within \d+|\d+\s*(day|hour)s?|call|meeting|email|sample|confirm|invite)\b/i.test(m);
    return act && spec;
  }

  function buyerThink(msg) {
    const st = state.chat;
    const m = msg.toLowerCase();
    const F = st.flags;
    st.mem.buyerTurns++;

    // --- 意图识别 ---
    const askedGoal = st.goal.re.test(msg);
    const hasPrice = /price|quote|quotation|cost|offer|usd|fob|\$/.test(m); // 含 $ 符号（如 "$80"）
    const hasNumber = /\d{2,}/.test(m);
    // 真报价 = 价格语境词 ±15 字符内出现两位数（排除 "A12"、"18 months" 这类型号/期限数字）
    const hasPriceNum =
      /(usd|us\$|\$|eur|price|quote|cost|offer|fob)[^\d]{0,15}\d{2,}/i.test(msg) ||
      /\d{2,}[^\d]{0,12}(usd|us\$|\$|per (unit|pc|piece|set))/i.test(msg);
    const hasCert = /\bce\b|e-?mark|fcc|certif/.test(m); // \b 防误配 price 结尾的 ce
    const hasWarranty = /warranty|guarantee|after-?sales|defect|\brma\b|replacement|spare parts/.test(m); // quality 空话不加分
    const hasSample = /sample|trial/.test(m);
    const hasMoq = /moq|minimum|lead\s?time|delivery|shipment/.test(m);

    // --- 事实账本：抽取候选人给过的数字（报价/质保月数/MOQ），供台词回显与矛盾检测 ---
    const f = st.mem.facts;
    const pm = msg.match(/(?:usd|us\$|\$)\s*(\d{2,3}(?:\.\d+)?)|(\d{2,3}(?:\.\d+)?)\s*(?:usd|us\$|\$|per (?:unit|pc|piece|set))/i);
    if (pm) {
      const np = pm[1] || pm[2];
      f.prev = f.price; // 记录上一轮报价（让步质量检测用）
      if (!f.price) {
        f.price = np;
      } else if (Math.abs(parseFloat(np) - parseFloat(f.price)) > 2.5 && !f.conflictUsed) {
        // 前后报价大幅矛盾（>2.5 美元，非正常小让步）→ 下一轮买家点破（每局最多一次）
        f.oldPrice = f.price; f.price = np; f.conflict = true; f.conflictUsed = true;
      } else {
        f.price = np;
      }
    }
    const wm = msg.match(/(\d{1,2})\s*months?\s*(?:warranty|guarantee)|warranty[^\d]{0,12}(\d{1,2})\s*months?/i);
    if (wm) f.months = wm[1] || wm[2];
    const mm = msg.match(/\bmoq\b[^\d]{0,15}(\d{2,6})|(\d{2,6})\s*(?:pcs|pieces|units|sets)\b/i);
    if (mm) f.moq = mm[1] || mm[2];

    // --- 谈判力信号记录（不加分不扣分，结算时供 HR 锚定"报价谈判/需求理解/主动开发"维度） ---
    for (const sig of NEGO_SIGNALS) {
      if (!st.mem.negoSignals[sig.key] && sig.re.test(msg)) st.mem.negoSignals[sig.key] = true;
    }

    // --- 信任度与情绪 ---
    // 防骗分：关键词堆砌（ce ce ce）零分；单轮最多 +2（一口气报菜名最多算 2 个点，其余留到后续轮次）
    const stuffing = isKeywordStuffing(msg);
    let gained = 0;
    if (!stuffing) {
      if (hasCert && !F.cert) { F.cert = true; st.trust++; gained++; }
      if (gained < 2 && hasWarranty && !F.warranty) { F.warranty = true; st.trust++; gained++; }
      if (gained < 2 && hasPriceNum && !F.price) { F.price = true; st.trust++; gained++; }
      if (gained < 2 && hasSample && !F.sample) { F.sample = true; st.trust++; gained++; }
    }
    st.trust = Math.min(st.trust, 4);
    if (gained) st.mem.mood = Math.min(1, st.mem.mood + 1);
    // 情绪确认（接情绪）→ 买家耐心回升（熊浩：先解决情绪，再解决问题），每局最多缓和一次
    if (st.mem.negoSignals.empathy && gained === 0 && st.mem.mood < 1 && !st.mem._empathyMood) {
      st.mem.mood++;
      st.mem._empathyMood = true;
    }
    if (hasChinese(msg) || isGibberish(msg)) st.mem.mood = Math.max(-2, st.mem.mood - 1); // 中文/乱码消耗耐心
    if (isCandidateRepeat(msg)) st.mem.mood = Math.max(-2, st.mem.mood - 1);
    if (normWords(msg).length < 3) st.mem.mood = Math.max(-2, st.mem.mood - 1);
    renderTrust();

    // --- 生成回复（记录到 mem 防复读） ---
    const out = buyerDecide({ askedGoal, hasPrice, hasPriceNum, hasNumber, hasCert, hasWarranty, hasSample, hasMoq, msg });
    // 同一内容话题最多 2 个回合，第 3 次买家主动转移（测更多维度）；谈判情境分支（nego）是一次性机制，不参与计数
    if (out.branch && out.branch !== 'nego') {
      if (st.mem.lastBranch === out.branch) {
        st.mem.branchStreak++;
      } else {
        st.mem.lastBranch = out.branch;
        // 刚被跳转的话题回归：只允许再聊 1 个回合
        st.mem.branchStreak = st.mem.returnGuard === out.branch ? 2 : 1;
      }
      if (st.mem.branchStreak >= 3) {
        out.text = nextSwitchTopic(st);
        st.mem.returnGuard = out.branch;
        st.mem.lastBranch = 'switch';
        st.mem.branchStreak = 1;
      }
    }

    // 悬而未决的追问：买家上轮问了 X，候选人本轮答非所问 → 先点破再回应当前话题（真人感）
    if (out.branch && st.mem.pending && !pendingAnswered(st.mem.pending, m)) {
      out.text = 'You did not really answer my question about ' + PENDING_TOPIC[st.mem.pending] + '. ' + out.text;
    }

    // 台词变量回填（候选人报过的数字 / 场景目标价）
    out.text = fillFacts(out.text, st);

    // 记录本轮台词中新的悬而未决问题（议价/谈判情境分支不记——候选人已在报价语境中）
    st.mem.pending = null;
    if (out.branch && out.branch !== 'price' && out.branch !== 'nego' && /\?/.test(out.text)) {
      if (/price|number|fob|\bland\b/i.test(out.text)) st.mem.pending = 'price';
      else if (/warranty|after-?sales|defect|rma|replacement/i.test(out.text)) st.mem.pending = 'warranty';
      else if (/lead\s?time|moq|minimum|capacity/i.test(out.text)) st.mem.pending = 'moq';
      else if (/sample|trial/i.test(out.text)) st.mem.pending = 'sample';
      else if (/payment terms/i.test(out.text)) st.mem.pending = 'payment';
      else if (/oem|packaging|own brand/i.test(out.text)) st.mem.pending = 'oem';
      else if (/discount/i.test(out.text)) st.mem.pending = 'discount';
      else if (/ddp|fob only|quote ddp/i.test(out.text)) st.mem.pending = 'shipping';
    }
    st.mem.lastBuyerText = out.text;
    return out;
  }

  function nextSwitchTopic(st) {
    if (st.mem.agendaIdx < BUYER_LINES.agenda.length) {
      st.mem.lastAgendaAt = st.mem.buyerTurns;
      return BUYER_LINES.agenda[st.mem.agendaIdx++];
    }
    return pickLine('moveon', true);
  }

  function buyerDecide(x) {
    const st = state.chat;
    const F = st.flags;

    // 1) 通关 / 搪塞（升级阶梯）
    // 通关概率：信任 3 分 → 70% 放行；4 分（满分）→ 必放行；未放行走 uncertain 台词（引导补第 4 个信任点）
    if (x.askedGoal) {
      F.askCount++;
      const pass = st.trust >= 4 ? true : st.trust >= 3 && Math.random() < 0.7;
      if (pass) {
        return { text: fillTemplate(st.goal.win, st.scenario), win: true, delay: 1400 };
      }
      return { text: pickLine(st.trust >= 3 ? 'uncertain' : 'deflect', true), delay: 1100 };
    }

    // 2) 中文回复（测评要求英语）
    if (hasChinese(x.msg)) return { text: pickLine('english', true), delay: 900 };

    // 3) 复读检测（长句原地重复 → 点破）
    if (isCandidateRepeat(x.msg)) return { text: pickLine('callout', true), delay: 900 };

    // 4) 关键词堆砌（"ce ce ce" 刷分 → 点破且零分）
    if (isKeywordStuffing(x.msg)) return { text: pickLine('callout', true), delay: 900 };

    // 5) 乱码（看不懂 → 请重发）
    if (isGibberish(x.msg)) return { text: pickLine('gibberish', true), delay: 900 };

    // 5.4) 立场反应：买家宣言过立场后，候选人纵向追问（why/what's behind）→ 揭示真实利益（熊浩：往后退才能看到利益）
    if (st.mem.stancePending) {
      st.mem.stancePending = false;
      if (NEGO_SIGNALS[0].re.test(x.msg)) {
        return { text: pickLine('reveal', true), delay: 1300, branch: 'nego' };
      }
    }

    // 5.5) 拖延反应：买家拖延后，候选人给出可验证的时间+动作 → 配合推进；放任 → 冷淡（黄执中：鉴别找方法还是拖延）
    if (st.mem.stallPending) {
      st.mem.stallPending = false;
      if (!(x.hasPrice && x.hasPriceNum)) { // 报价本身是实质推进，走正常议价链
        return { text: pickLine(isStallAdvance(x.msg) ? 'stallOk' : 'stallCold', true), delay: 1100, branch: 'stall' };
      }
    }

    // 6) 议价：基于「报价 vs 场景心理价位」智能分流 + 谈判质量检测（立场宣言 / 让步换交换）
    if (x.hasPrice && x.hasPriceNum) {
      const f = st.mem.facts;
      const t = st.scenario.target;
      const p = parseFloat(f.price);
      let key = 'pricePush';
      if (f.conflict) { key = 'conflict'; f.conflict = false; }        // 前后报价矛盾 → 点破（每局一次）
      else if (t !== undefined && !isNaN(p)) {
        if (p >= t + 3) key = 'priceHigh';            // 报价明显高于心理价位 → 强压
        else if (p <= t - 8) key = 'priceSuspicious'; // 超低价 → 怀疑质量
        else if (p <= t - 3) key = 'priceGood';       // 低于心理价位 → 积极推进
      }
      // 6a) 第 2 次常规报价且未宣言过立场 → 抛立场测候选人挖利益（熊浩：说的是立场，藏的是利益）
      if (key === 'pricePush' && !f.conflictUsed && (st.mem.saidCount.pricePush || 0) === 1 && !st.mem.stanceDone) {
        st.mem.stanceDone = true;
        st.mem.stancePending = true;
        return { text: pickLine('stance', true), delay: 1200, branch: 'nego' };
      }
      // 6b) 让步质量：低于上轮报价（在让步）——有条件词（if/in exchange）→ 让步换交换；免费让步 → 得寸进尺
      let negoBranch = false;
      if (key === 'pricePush' && f.prev !== null && !isNaN(p) && p < parseFloat(f.prev)) {
        const cond = NEGO_SIGNALS[1].re.test(x.msg);
        key = cond ? 'dealBait' : 'squeeze';
        negoBranch = true; // 谈判情境分支独立计数，不与常规议价叠加触发话题跳转
      }
      return { text: pickLine(key, true), delay: 1300, branch: negoBranch ? 'nego' : 'price' };
    }
    if (x.hasPrice && !x.hasPriceNum) return { text: pickLine('priceNoNum', true), delay: 1000, branch: 'price' };

    // 7) 关键点（台词池轮换）
    if (x.hasCert) return { text: pickLine('cert', true), delay: 1100, branch: 'cert' };
    if (x.hasWarranty) return { text: pickLine('warranty', true), delay: 1300, branch: 'warranty' };
    if (x.hasSample) return { text: pickLine('sample', true), delay: 1100, branch: 'sample' };
    if (x.hasMoq) return { text: pickLine('moq', true), delay: 1000, branch: 'moq' };

    // 7.5) 议程话题回答（买家主动出过题后，候选人正面回应 → 主题确认，而非牛头不对马嘴的兜底）
    {
      const mm = x.msg.toLowerCase();
      if (/t\/t|l\/c|paypal|deposit|payment/.test(mm)) return { text: pickLine('ackPayment', true), delay: 1000, branch: 'agendaAns' };
      if (/\boem\b|odm|private label/.test(mm)) return { text: pickLine('ackOem', true), delay: 1000, branch: 'agendaAns' };
      if (/discount/.test(mm)) return { text: pickLine('ackDiscount', true), delay: 1000, branch: 'agendaAns' };
      if (/\bddp\b|\bcif\b|freight/.test(mm)) return { text: pickLine('ackShipping', true), delay: 1000, branch: 'agendaAns' };
    }

    // 7.6) 拖延测试（中期且始终没给实质报价）：买家嘴上答应实际不推进（黄执中：行为说服 ≠ 人际说服）
    if (st.turns >= 5 && st.turns <= 7 && !F.price && !st.mem.stallDone) {
      st.mem.stallDone = true;
      st.mem.stallPending = true;
      return { text: pickLine('stall', true), delay: 1100, branch: 'stall' };
    }

    // 8) 过短回答（无实质内容；不耐烦时语气变硬）
    if (normWords(x.msg).length < 3) {
      return { text: pickLine(st.mem.mood <= -2 ? 'impatient' : 'short', true), delay: 900 };
    }

    // 9) 收尾提示（信任已够 + 后期且本轮无实质新话题，引导候选人主动推进，只给一次）
    if (st.turns >= 8 && st.trust >= 3 && !st.mem.hintGiven) {
      st.mem.hintGiven = true;
      return {
        text: 'You have covered the essentials well. Before we wrap up — is there anything you would like from me to move this forward?',
        delay: 1200,
      };
    }

    // 10) 催报价（未给价时）
    if (st.turns >= 3 && !F.price) return { text: pickLine('nudge', true), delay: 1100, branch: 'nudge' };

    // 11) 买家主动出题：每 2 个买家轮次抛一个新话题，推动对话演进
    const agendaLeft = st.mem.agendaIdx < BUYER_LINES.agenda.length;
    const due = st.mem.buyerTurns - st.mem.lastAgendaAt >= 2;
    if (agendaLeft && due) {
      const text = BUYER_LINES.agenda[st.mem.agendaIdx++];
      st.mem.lastAgendaAt = st.mem.buyerTurns;
      return { text, delay: 1200, branch: 'agenda' };
    }

    // 12) 兜底（情绪分流：不耐烦时语气变硬）
    return { text: pickLine(st.mem.mood <= -2 ? 'impatient' : 'fallback', false), delay: 900, branch: 'fallback' };
  }

  function trustStars(n) {
    return '<span class="end-stars">' + '★'.repeat(n) + '☆'.repeat(4 - n) + '</span> ' + n + '/4';
  }

  // 台词变量回填：把候选人给过的数字、场景目标价填进 {price}/{target}/{months} 等占位符
  function fillFacts(tpl, st) {
    const f = st.mem.facts, sc = st.scenario;
    let gap = '';
    if (f.price && sc.target) {
      gap = String(Math.round((parseFloat(f.price) - sc.target) * 10) / 10);
    }
    return tpl
      .split('{price}').join(f.price || '')
      .split('{old}').join(f.oldPrice || '')
      .split('{target}').join(sc.target !== undefined ? String(sc.target) : '')
      .split('{months}').join(f.months || '18')
      .split('{moq}').join(f.moq || '')
      .split('{gap}').join(gap);
  }

  // 悬而未决问题：候选人本轮是否正面回应了买家的提问
  function pendingAnswered(pending, m) {
    switch (pending) {
      case 'price':    return /(?:usd|us\$|\$)\s*\d|\d\s*(?:usd|us\$|\$|per (?:unit|pc|piece|set))/i.test(m);
      case 'warranty': return /warranty|guarantee|after-?sales|defect|rma|replacement|spare parts/i.test(m);
      case 'moq':      return /moq|minimum|lead\s?time|delivery|shipment|\d+\s*(?:days?|weeks?)/i.test(m);
      case 'sample':   return /sample|trial/i.test(m);
      case 'payment':  return /t\/t|l\/c|paypal|deposit|payment/i.test(m);
      case 'oem':      return /\boem\b|odm|private label|our (?:own )?brand/i.test(m);
      case 'discount': return /discount/i.test(m);
      case 'shipping': return /\bddp\b|\bcif\b|freight|fob/i.test(m);
      default: return true;
    }
  }

  const PENDING_TOPIC = {
    price: 'your best FOB price', warranty: 'the warranty question',
    moq: 'lead time and MOQ', sample: 'the sample arrangement',
    payment: 'payment terms', oem: 'OEM packaging',
    discount: 'volume discounts', shipping: 'shipping terms',
  };

  function fillTemplate(tpl, sc) {
    const parts = sc.persona.split(' · ');
    const nm = (parts[0] || 'Buyer').split(' ')[0].toLowerCase();
    const co = ((parts[1] || 'buyer co').split(',')[0] || 'buyerco').replace(/[^A-Za-z]/g, '').toLowerCase().slice(0, 10);
    return tpl.split('{name}').join(nm).split('{company}').join(co); // 全量替换所有占位符
  }

  function renderTrust() {
    const stars = document.querySelectorAll('#chat-trust .t-star');
    stars.forEach((s, i) => s.classList.toggle('on', i < state.chat.trust));
  }

  function appendBubble(role, text) {
    const log = $('chat-log');
    const div = document.createElement('div');
    div.className = 'msg ' + (role === 'you' ? 'msg-you' : 'msg-buyer');
    div.textContent = text;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
    state.chat.history.push({ role, text });
  }

  function showTyping(show) {
    $('chat-typing').classList.toggle('hidden', !show);
    if (show) {
      const log = $('chat-log');
      log.scrollTop = log.scrollHeight;
    }
  }

  function sendChat() {
    const st = state.chat;
    const input = $('chat-input');
    const text = input.value.trim();
    if (!text || st.status !== 'playing' || st._typing) return;
    input.value = '';
    st.turns++;
    st.charCount += text.length;
    $('chat-turns').textContent = '第 ' + st.turns + '/' + st.maxTurns + ' 轮';
    appendBubble('you', text);

    st._typing = true;
    $('chat-send').disabled = true;
    showTyping(true);

    // AI 游戏模式：调服务器（AI 买家回复 + 4 评委点评）
    if (st.aiMode) return aiTurn(text);

    const reply = buyerThink(text);
    setTimeout(() => {
      showTyping(false);
      appendBubble('buyer', reply.text);
      st._typing = false;
      $('chat-send').disabled = false;
      if (reply.win) return endChat(true, 'goal');
      if (st.turns >= st.maxTurns) return endChat(false, 'turns');
    }, reply.delay || 1000);
  }

  // ===== AI 游戏模式：回合处理 + 评委面板 =====
  async function aiTurn(text) {
    const st = state.chat;
    try {
      const res = await fetch('/api/game/turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sid: st.ai.sid,
          history: st.history.slice(0, -1), // 不含刚发的这条（服务器单独收 message）
          message: text,
          turnNo: st.turns,
          maxTurns: st.maxTurns,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || ('HTTP ' + res.status));
      }
      const g = await res.json();
      showTyping(false);
      appendBubble('buyer', g.reply);
      st.trust = g.trust;
      renderTrust();
      renderJudges(g.judges, st.turns);
      st.ai.judgesLog.push({ turn: st.turns, msg: text.slice(0, 120), judges: g.judges });
      st._typing = false;
      $('chat-send').disabled = false;
      if (g.gameOver || g.contactGiven) return endChat(true, 'goal');
      if (st.turns >= st.maxTurns) return endChat(false, 'turns');
    } catch (e) {
      showTyping(false);
      st._typing = false;
      $('chat-send').disabled = false;
      appendBubble('buyer', '（连接中断：' + escapeHtml(String(e.message || e)) + ' — 请把刚才的话重发一次）');
    }
  }

  function renderJudges(judges, turn) {
    const box = $('judge-cards');
    if (!box || !Array.isArray(judges)) return;
    // 前端只展示反馈正文（不露专家身份）；HR 提交数据仍保留归属
    const icon = { good: '🌟', bad: '⚡', neutral: '💬' };
    box.innerHTML = judges.map((j) =>
      '<div class="judge-card ' + (j.verdict === 'good' ? 'j-good' : j.verdict === 'bad' ? 'j-bad' : 'j-neutral') + '">' +
      '<div class="j-comment">' + escapeHtml(j.comment) + '</div>' +
      '</div>'
    ).join('');
  }

  // 谈判力小结（六信号命中表，供 HR 评分锚定）
  function negoSummary(mem) {
    const hits = NEGO_SIGNALS.map((s) => (mem.negoSignals[s.key] ? s.label : null)).filter(Boolean);
    return hits.length
      ? hits.join(' · ') + '（' + hits.length + '/6）'
      : '未检出（0/6）——候选人全程未展现利益挖掘、条件让步、小步推进等谈判行为';
  }

  // AI 模式评委汇总：各位评委 good/bad 计数 + 最后一条点评
  function judgesDigest(log) {
    if (!log || !log.length) return '无评委数据';
    const stat = {};
    log.forEach((t) => (t.judges || []).forEach((j) => {
      if (!stat[j.key]) stat[j.key] = { name: j.name, good: 0, bad: 0, neutral: 0, last: '' };
      stat[j.key][j.verdict] = (stat[j.key][j.verdict] || 0) + 1;
      if (j.verdict !== 'neutral') stat[j.key].last = j.comment;
    }));
    return Object.values(stat).map((s) =>
      s.name + ' 👍' + s.good + '/⚠️' + s.bad
    ).join(' · ');
  }

  function endChat(won, reason) {
    const st = state.chat;
    st.status = won ? 'won' : 'ended';
    clearInterval(state.inqTimerId);
    state.inquiryElapsed = Math.round((Date.now() - st.startedAt) / 1000);

    const endBox = $('chat-end');
    endBox.classList.remove('hidden');
    const negoLine = '<div class="end-sub">🤝 谈判力信号：' + negoSummary(st.mem) + '</div>';
    const judgesLine = st.aiMode
      ? '<div class="end-sub">👥 评委点评累计：' + judgesDigest(st.ai.judgesLog) + '</div>'
      : '';
    if (won) {
      endBox.classList.add('won');
      endBox.innerHTML =
        '<div class="end-title">🎯 目标达成！</div>' +
        '<div class="end-line">用时 ' + Math.round(state.inquiryElapsed / 60) + ' 分钟 · ' + st.turns + ' 轮对话 · 买家信任 ' + trustStars(st.trust) + '</div>' +
        (st.aiMode ? judgesLine : negoLine) +
        '<div class="end-sub">对话已存档，HR 将查看完整记录。</div>';
    } else {
      endBox.classList.add('lost');
      endBox.innerHTML =
        '<div class="end-title">' + (reason === 'time' ? '⏰ 时间到' : '轮次用完') + ' · 本轮未达成目标</div>' +
        '<div class="end-line">完成 ' + st.turns + '/' + st.maxTurns + ' 轮 · 买家信任 ' + trustStars(st.trust) + '</div>' +
        (st.aiMode ? judgesLine : negoLine) +
        '<div class="end-sub">对话已存档，仍可继续完成后续环节。</div>';
    }
    $('chat-input').disabled = true;
    $('chat-send').disabled = true;
    $('btn-inq-next').disabled = false;

    // 生成提交载荷（复用 inquiry 字段，后台/报告零改动）
    const transcript = st.history
      .map((h) => (h.role === 'buyer' ? 'Buyer: ' : 'You: ') + h.text)
      .join('\n');
    state.inquiryPayload = {
      promptId: st.scenario.id + ' · 目标: ' + st.goal.label,
      promptText:
        '[实时对话挑战' + (st.aiMode ? '·AI游戏模式 场景:' + st.scenario.market + ' 风格:' + (st.styleZh || '-') : '') + ']\n场景: ' + st.scenario.market + '\n买家: ' + st.scenario.persona +
        '\n目标: ' + st.goal.label + '\n开场: ' + st.scenario.opening,
      replyText: (won ? '【目标达成】\n' : '【未达成目标】\n') + transcript +
        (st.aiMode
          ? '\n\n【评委点评全记录】\n' + (st.ai.judgesLog || []).map((t) =>
              '# 第' + t.turn + '轮 ' + t.msg + '\n' +
              t.judges.map((j) => '  [' + j.name + '·' + (j.verdict === 'good' ? '👍' : j.verdict === 'bad' ? '⚠️' : '·') + '] ' + j.comment).join('\n')
            ).join('\n')
          : '\n\n【谈判力信号】' + negoSummary(st.mem)),
      timeSpentSec: state.inquiryElapsed,
      charCount: st.charCount,
    };
  }

  // 剧本模式开场白（原有逻辑抽出）
  function scriptedOpening() {
    const st = state.chat;
    st._typing = true;
    $('chat-send').disabled = true;
    showTyping(true);
    setTimeout(() => {
      showTyping(false);
      appendBubble('buyer', st.scenario.opening);
      st.mem.lastBuyerText = st.scenario.opening; // 开场白计入去重
      st._typing = false;
      $('chat-send').disabled = false;
    }, 1200);
  }

  function startChat() {
    const st = state.chat;
    $('inq-brief').innerHTML = PRODUCT_BRIEF_HTML;
    $('chat-turns').textContent = '第 0/' + st.maxTurns + ' 轮';
    renderTrust();

    const input = $('chat-input');
    input.disabled = false;
    $('chat-send').disabled = false;
    ['paste', 'copy', 'cut'].forEach((ev) =>
      input.addEventListener(ev, (e) => { e.preventDefault(); })
    );

    // AI 游戏模式：服务器侧随机组合买家 + 生成开场白；失败则回落剧本模式
    if (st.aiMode) {
      st._typing = true;
      $('chat-send').disabled = true;
      showTyping(true);
      fetch('/api/game/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error('start ' + r.status))))
        .then((g) => {
          st.ai.sid = g.sid;
          st.scenario = { id: 'AI-GAME', market: g.scenario, persona: 'AI 买家', opening: g.opening };
          st.goal = { id: 'AI-GOAL', label: g.goal };
          st.styleZh = g.style;
          $('chat-goal').innerHTML =
            '🎯 本局目标：<b>' + escapeHtml(g.goal) + '</b>' +
            '<span class="goal-meta">' + escapeHtml(g.scenario) + '（已背调核实） · 买家风格：' + escapeHtml(g.style) + ' · 最多 ' + st.maxTurns + ' 轮 · 限时 15 分钟</span>';
          $('judge-panel').classList.remove('hidden');
          showTyping(false);
          appendBubble('buyer', g.opening);
          st._typing = false;
          $('chat-send').disabled = false;
        })
        .catch(() => {
          // 回落剧本模式
          st.aiMode = false;
          $('judge-panel').classList.add('hidden');
          showTyping(false);
          st._typing = false;
          $('chat-send').disabled = false;
          scriptedOpening();
          $('chat-goal').innerHTML =
            '🎯 本局目标：<b>' + escapeHtml(st.goal.label) + '</b>' +
            '<span class="goal-meta">' + escapeHtml(st.scenario.market) + ' · 最多 ' + st.maxTurns + ' 轮 · 限时 15 分钟</span>';
        });
    } else {
      scriptedOpening();
      $('chat-goal').innerHTML =
        '🎯 本局目标：<b>' + escapeHtml(st.goal.label) + '</b>' +
        '<span class="goal-meta">' + escapeHtml(st.scenario.market) + ' · 最多 ' + st.maxTurns + ' 轮 · 限时 15 分钟</span>';
    }

    // 计时（15 分钟）
    st.startedAt = Date.now();
    clearInterval(state.inqTimerId);
    let remain = 15 * 60;
    const timerEl = $('inq-timer');
    timerEl.classList.remove('danger');
    state.inqTimerId = setInterval(() => {
      remain--;
      if (remain <= 0) { remain = 0; timerEl.classList.add('danger'); if (state.chat.status === 'playing') endChat(false, 'time'); }
      const m = String(Math.floor(remain / 60)).padStart(2, '0');
      const s = String(remain % 60).padStart(2, '0');
      timerEl.textContent = m + ':' + s;
    }, 1000);

    $('chat-send').addEventListener('click', sendChat);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); sendChat(); }
    });
  }

  $('btn-inq-next').addEventListener('click', () => {
    if (!state.inquiryPayload) return;
    buildOral();
    show('oral');
  });

  // ===== 口语题（录音作答模式：移动端/微信浏览器均可） =====
  function buildOral() {
    const list = $('oral-list');
    list.innerHTML = '';
    const note = document.createElement('div');
    note.className = 'notice';
    note.textContent =
      '每题点击「开始录音」→ 用英文口头作答 → 点「停止录音」。回答以录音提交，HR 将试听评估。请在浏览器提示时允许麦克风权限。';
    list.appendChild(note);
    const brief = document.createElement('details');
    brief.className = 'oral-brief';
    brief.innerHTML =
      '<summary>📋 产品资料速览（AKEEYO · 口语作答可参考，点开查看）</summary>' + PRODUCT_BRIEF_HTML;
    list.appendChild(brief);
    ORAL_QUESTIONS.forEach((q, idx) => {
      const card = document.createElement('div');
      card.className = 'q-card';
      card.innerHTML =
        '<div class="q">Q' + (idx + 1) + '. ' + escapeHtml(q.text) + '</div>' +
        '<div class="btn-row">' +
        '<button class="btn" data-act="record"><span class="rec-dot"></span> 🎙 开始录音</button>' +
        '<span class="status-line" data-role="status"></span>' +
        '</div>' +
        '<audio controls class="hidden" data-role="preview" style="width:100%;margin-top:10px;"></audio>' +
        '<textarea class="transcript-area" data-role="transcript" placeholder="备用通道：如无法录音，在此用英文打字作答（选填）"></textarea>' +
        '<div class="char-count"><span data-role="chars">0</span> 字符 · 累计用时 <span data-role="time">0s</span></div>';
      list.appendChild(card);

      const ta = card.querySelector('[data-role="transcript"]');
      const status = card.querySelector('[data-role="status"]');
      const timeEl = card.querySelector('[data-role="time"]');
      const preview = card.querySelector('[data-role="preview"]');
      const st = state.oral[idx];

      ta.addEventListener('input', () => {
        st.transcript = ta.value;
        card.querySelector('[data-role="chars"]').textContent = ta.value.length;
      });

      const recBtn = card.querySelector('[data-act="record"]');
      recBtn.addEventListener('click', () => toggleRecord(idx, status, recBtn, preview));

      // 计时刷新
      setInterval(() => {
        timeEl.textContent = Math.round(st.elapsed) + 's';
      }, 1000);
    });
  }

  async function toggleRecord(idx, status, btn, preview) {
    const st = state.oral[idx];
    if (st.recording) {
      st.mediaRecorder && st.mediaRecorder.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      st.mediaStream = stream;
      st.mediaRecorder = new MediaRecorder(stream);
      st.chunks = [];
      st.mediaRecorder.ondataavailable = (e) => { if (e.data.size) st.chunks.push(e.data); };
      st.mediaRecorder.onstop = () => {
        st.audioBlob = new Blob(st.chunks, { type: 'audio/webm' });
        st.elapsed += (Date.now() - st._ts) / 1000;
        st.recording = false;
        btn.querySelector('.rec-dot').classList.remove('on');
        btn.innerHTML = '<span class="rec-dot"></span> 🎙 重新录音';
        status.textContent = '已录制 ' + (st.audioBlob.size / 1024).toFixed(0) + ' KB，提交时自动上传';
        // 候选人试听自己的录音
        if (st.previewUrl) URL.revokeObjectURL(st.previewUrl);
        st.previewUrl = URL.createObjectURL(st.audioBlob);
        preview.src = st.previewUrl;
        preview.classList.remove('hidden');
        stream.getTracks().forEach((t) => t.stop());
      };
      st.mediaRecorder.start();
      st._ts = Date.now();
      st.recording = true;
      btn.querySelector('.rec-dot').classList.add('on');
      btn.innerHTML = '<span class="rec-dot on"></span> ⏹ 停止录音';
      status.textContent = '录音中…请开始作答';
    } catch (err) {
      status.textContent = '无法录音：' + err.message + '（可改用下方打字作答）';
    }
  }

  // ===== 预提交总览 =====
  function buildReview() {
    const inq = state.inquiryPayload || { promptId: '-', timeSpentSec: 0, replyText: '', charCount: 0 };
    const reply = inq.replyText || '';
    const oralHtml = ORAL_QUESTIONS.map((q, i) => {
      const st = state.oral[i];
      let status;
      if (st.audioBlob && st.audioBlob.size) {
        status = '<span class="rv-ok">✅ 已录音 ' + (st.audioBlob.size / 1024).toFixed(0) + ' KB · ' + Math.round(st.elapsed) + 's</span>';
      } else if (st.transcript.trim().length > 10) {
        status = '<span class="rv-ok">✅ 打字作答 · ' + st.transcript.trim().length + ' 字符</span>';
      } else {
        status = '<span class="rv-warn">⚠️ 未作答</span>';
      }
      const audio =
        st.previewUrl ? '<audio controls src="' + st.previewUrl + '" style="width:100%;margin-top:8px;"></audio>' : '';
      const textEx = st.transcript.trim()
        ? '<div class="rv-ex">' + escapeHtml(st.transcript.trim().slice(0, 120)) +
          (st.transcript.trim().length > 120 ? '…' : '') + '</div>'
        : '';
      return (
        '<div class="rv-item">' +
        '<div class="rv-q">Q' + (i + 1) + '. ' + escapeHtml(q.text) + '</div>' +
        '<div class="rv-status">' + status + '</div>' + audio + textEx +
        '</div>'
      );
    }).join('');

    $('review-list').innerHTML =
      '<div class="rv-sec"><h3>👤 基本信息</h3>' +
      '<div class="rv-line">' + escapeHtml($('f-name').value || '-') + ' · ' + escapeHtml($('f-email').value || '-') +
      (state.oral.length && $('f-exp').value ? ' · 外贸经验 ' + escapeHtml($('f-exp').value) + ' 年' : '') + '</div></div>' +
      '<div class="rv-sec"><h3>💬 询盘实时对话（' + escapeHtml(inq.promptId) + '）</h3>' +
      '<div class="rv-line">' + reply.length + ' 字符（你的发言） · 用时 ' + Math.round((inq.timeSpentSec || 0) / 60) + ' 分钟</div>' +
      '<div class="rv-ex">' + escapeHtml(reply.slice(0, 300)) + (reply.length > 300 ? '…（提交后 HR 可查看完整对话）' : '') + '</div></div>' +
      '<div class="rv-sec"><h3>🎙 英语口语（' + ORAL_QUESTIONS.length + ' 题）</h3>' + oralHtml + '</div>';
  }

  $('btn-review').addEventListener('click', () => {
    const answered = state.oral.filter(
      (s) => (s.audioBlob && s.audioBlob.size > 0) || s.transcript.trim().length > 10
    ).length;
    if (answered < 4) {
      $('oral-alert').classList.remove('hidden');
      return;
    }
    $('oral-alert').classList.add('hidden');
    buildReview();
    show('review');
  });

  $('btn-review-back').addEventListener('click', () => show('oral'));

  // ===== 提交 =====
  $('btn-submit').addEventListener('click', async () => {
    const answered = state.oral.filter(
      (s) => (s.audioBlob && s.audioBlob.size > 0) || s.transcript.trim().length > 10
    ).length;
    if (answered < 4) {
      $('oral-alert').classList.remove('hidden');
      return;
    }
    $('oral-alert').classList.add('hidden');

    const meta = {
      name: $('f-name').value.trim(),
      email: $('f-email').value.trim(),
      phone: $('f-phone').value.trim(),
      yearsExperience: $('f-exp').value,
      education: $('f-edu').value,
      location: $('f-city').value.trim(),
    };
    const inquiry = state.inquiryPayload || {
      promptId: '-', promptText: '(未完成对话)', replyText: '', timeSpentSec: 0, charCount: 0,
    };
    const oral = ORAL_QUESTIONS.map((q, i) => ({
      qId: q.id,
      questionText: q.text,
      transcript: state.oral[i].transcript.trim(),
      timeSpentSec: Math.round(state.oral[i].elapsed),
    }));

    const fd = new FormData();
    fd.append('meta', JSON.stringify(meta));
    fd.append('inquiry', JSON.stringify(inquiry));
    fd.append('oral', JSON.stringify(oral));
    state.oral.forEach((s, i) => {
      if (s.audioBlob) fd.append('audio_q' + i, s.audioBlob, 'audio_q' + i + '.webm');
    });

    const btn = $('btn-submit');
    btn.disabled = true;
    btn.textContent = '提交中…';
    try {
      const res = await fetch('/api/submit', { method: 'POST', body: fd });
      if (!res.ok) {
        const err = new Error('HTTP ' + res.status);
        err.status = res.status;
        throw err;
      }
      show('success');
    } catch (err) {
      let msg;
      if (err.status === 404 || backendOk === false) {
        msg =
          '提交失败：后端服务未连接（HTTP 404）。\n\n' +
          '原因：当前页面不是通过作答服务打开的（可能是直接打开了 HTML 文件）。\n' +
          '解决办法：请在地址栏确认使用 http://localhost:3000 打开本页后重新作答提交。\n' +
          '如仍有问题，请联系 HR。';
      } else {
        msg = '提交失败：' + err.message + '\n请检查网络后重试。';
      }
      alert(msg);
      btn.disabled = false;
      btn.textContent = '✔ 确认提交';
    }
  });

  // ===== 辅助 =====
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );
  }

  // 初始
  show('intro');
})();
