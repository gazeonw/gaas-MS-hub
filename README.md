# AKEEYO 外贸销售 · 在线数字面试筛选工具

用于 HR（Gaa）线上初筛外贸销售（B2B）候选人，自动识别两项能力：
1. **回复询盘的实际能力**（英文书面：需求理解 / 报价谈判 / 英文表达 / 产品知识 / 商务专业度 / 主动开发）
2. **英语口语技能**（流利度 / 内容 / 语法 / 词汇 / 沟通自信；发音精度由 HR 听音频人工确认）

评分结果生成 **AKEEYO 红黑品牌风 HTML 报告**，含 0–100 分与五档（淘汰 / 待定 / 匹配 / 强匹配 / 顶尖），对齐《简历分析框架 v1.1》。

---

## 一、本地运行（自检）

```bash
cd akeeyo-interview
npm install
cp .env.example .env          # 填写 ADMIN_TOKEN 与 LLM Key；纯自检可保持 MOCK_SCORE=1
node server.js                # 或 npm start
```

启动后：
- 候选作答页： http://localhost:3000
- HR 后台： http://localhost:3000/admin?token=你的ADMIN_TOKEN

> 本地 `localhost` 例外允许麦克风，可直接测试语音转写；远程访问**必须 HTTPS**，否则浏览器不授权麦克风。

---

## 二、配置（.env）

| 变量 | 说明 |
|---|---|
| `PORT` | 端口，默认 3000 |
| `LLM_PROVIDER` | `gemini` 或 `openai` |
| `GEMINI_API_KEY` / `GEMINI_MODEL` | Gemini Key（如 `gemini-2.0-flash`） |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | 限流时切换用 |
| `ADMIN_TOKEN` | HR 后台访问口令（自行设置强口令） |
| `INQUIRY_WEIGHT` / `ORAL_WEIGHT` | 综合分权重，默认 0.6 / 0.4（合计=1） |
| `MAX_RETRY` | 评分失败重试次数（应对 429 限流） |
| `MOCK_SCORE` | 设为 `1` 时返回模拟评分，**不消耗 API**，便于先跑通前端 |

**Key 安全**：Key 只在服务端 `.env` / 部署平台环境变量，永不下发到浏览器。

---

## 三、使用流程

**候选人**：打开作答页 → 填基本信息 → **实时对话挑战**（随机场景×随机目标，与剧本买家英文聊天，赢取信任度并达成目标，12 轮/15 分钟上限，禁粘贴/计时）→ 逐题口语作答（**纯录音** + 打字备用通道）→ 预提交总览确认 → 最终提交。
**HR**：后台列表查看所有候选人综合分/分档 → 点开看红黑风报告 → 试听口语音频复核发音 → 评分异常可点「重评」。
**公网交付**：`restart-interview.ps1` 一键启动（服务 + Cloudflare 隧道 + 自动重生成二维码海报），候选人扫码作答。

---

## 四、部署到 Render（免费 · 自动 HTTPS）

1. 把本目录推到 GitHub 私有仓库。
2. render.com → New → Web Service → 关联仓库。
3. Runtime = Node；Build = `npm install`；Start = `node server.js`。
4. Environment 填入：`LLM_PROVIDER`、`GEMINI_API_KEY`、`OPENAI_API_KEY`（可选）、`ADMIN_TOKEN`、`MOCK_SCORE=0`。
5. 免费层自动分配 `https://xxx.onrender.com`（带 HTTPS 证书）。
6. 免费层磁盘为临时盘，数据量小可先用 JSON 文件版；要持久化请接 Render Postgres 1GB 或把音频转存对象存储。

> 其他可选：Railway / Fly.io / WorkBuddy 云，同样需 HTTPS。

---

## 五、评分维度与分制

- 询盘回复（对话挑战，6 维，权重：需求理解20% / 报价谈判20% / **即时聊天英语**20% / 产品知识15% / 商务专业度15% / 主动开发10%）
- 英语口语（5 维，权重：流利度25% / 内容25% / 语法20% / 词汇20% / 自信10%）
- 综合分 = `INQUIRY_WEIGHT×询盘分 + ORAL_WEIGHT×口语分`
- 五档：<60 淘汰 ｜ 60–74 待定 ｜ 75–84 匹配 ｜ 85–94 强匹配 ｜ 95–100 顶尖

**硬约束**：口语不评发音精度，报告固定红字标注"需人工听音频确认"，落实框架中"英语能力一律需面试实测"。

---

## 六、目录结构

```
akeeyo-interview/
├── server.js            # 入口
├── src/                 # config / llm / prompts / scorer / store / report / auth
├── public/              # index.html 候选页、admin.html 后台、scoring.html 评分台、candidate.js、scoring.js、style.css
├── scripts/             # make_qr.py 二维码海报、test_buyer_logic.js 买家逻辑回归测试、replace_logo.py LOGO 替换
├── bin/                 # cloudflared.exe（Cloudflare 快速隧道）
├── data/                # 运行期：submissions.json + uploads/(音频)
├── candidate-qr.png / candidate-poster.png   # 候选人扫码海报（含当前隧道 URL）
├── restart-interview.ps1                     # 一键：起服务 + 隧道 + 重生成二维码
└── .env.example
```

## 七、已知边界

- **口语为纯录音模式**（2026-10-08 起定稿）：Web Speech 实时转写在手机浏览器（微信内置/iOS Safari）不可用（`not-allowed`），已砍掉，仅保留录音 + 本地试听 + 打字备用通道；HR 在评分台试听音频打分。
- 防作弊：禁粘贴/复制/右键 + 计时 + 记录用时 + 对话关键词防刷分（见第八节）；无法防截屏/外部求助，报告固定提示"须结合真人面试实测"。
- Gemini 免费 Key 高频触发 429：已内置退避重试 + 并发限流；失败可在后台"重评"。
- 如需更稳评分，可在 `.env` 切换 `LLM_PROVIDER=openai` 使用付费模型。
- **提交报 HTTP 404**：说明候选页不是从本服务打开的（如直接双击 `public/index.html` 或经静态预览打开）。页面加载时自动探测 `/healthz`，未连接会在顶部显示红色警告（含当前 URL）并禁用「开始作答 / 提交测评」。正确入口：本地 `http://localhost:3000`，线上为 Cloudflare 隧道 / 部署域名。
- **Cloudflare 快速隧道 URL 随重启变化**：重启后需重发新二维码海报（`restart-interview.ps1` 自动处理）；固定 URL 方案（Render 部署/命名隧道）待定。

## 八、实时对话挑战题库（买家剧本 · 零 API）

第一环节询盘题为**游戏化实时聊天**：候选人开场即与剧本买家英文对话，随机抽 1 场景 + 1 目标，上限 12 轮 / 15 分钟。提交时完整对话转写（含【目标达成/未达成】标记）自动存档，供 HR 评分台按询盘 6 维打分。

### 8.1 题库规模：4 场景 × 4 目标 = 16 种随机组合

| # | 场景 ID | 买家 | 特点 |
|---|---|---|---|
| 1 | CHAT-DE-001 | 德国慕尼黑 · Klaus Müller（汽车电子经销商） | 开口就问 500 台最优 FOB 价 |
| 2 | CHAT-US-002 | 美国芝加哥 · Sarah Johnson（200+ 车队运营经理） | 被中国品牌伤过，要你证明质量 |
| 3 | CHAT-UK-003 | 英国曼彻斯特 · James Smith（摩托车配件零售 30 店） | 关心防水，价格敏感要利润空间 |
| 4 | CHAT-NL-004 | 荷兰鹿特丹 · Erik de Vries（采购集团比价） | 竞品 USD 42 报价直接压价 |

| # | 目标 ID | 通关目标 | 命中关键词（临门一脚） |
|---|---|---|---|
| 1 | G-EMAIL | 拿到买家的商务邮箱 | email / e-mail |
| 2 | G-WHATSAPP | 拿到买家的 WhatsApp 号码 | whatsapp / whats app |
| 3 | G-SAMPLE | 让买家确认安排样品单 | sample / trial |
| 4 | G-MEETING | 约到一次视频会议 | zoom / teams / video call / meeting / schedule a call |

### 8.2 信任度 4 个得分维度的关键词明细

| 维度 | 得分关键词（出现即 +1，仅首次） | 不给分的情况 |
|---|---|---|
| **① 认证** | CE（独立词）、E-mark、FCC、certification / certified / certificate | "high quality" 等空话 |
| **② 质保** | warranty、guarantee、after-sales、defect、RMA、replacement、spare parts | "quality" 已明确排除（空话） |
| **③ 真报价** | 价格语境词 ±15 字符内出现两位数：`USD 46`、`$80`、`price is 45`、`FOB … 46`、`46 per unit` | A12（型号）、18 months（期限）等数字不算；光说 "best price" 无数字不算 |
| **④ 样品** | sample / trial（含 samples、trial order） | — |

### 8.3 防作弊规则

- **同词堆砌零分**：`ce ce ce` / `warranty warranty warranty` → 不加分 + 买家点破
- **单轮信任上限 +2**：一句话报满四个维度只记 2 分，其余留到后续轮次再验证
- **中文回复**：零分 + 买家要求 "English only" + 扣耐心
- **乱码**（同字符连打 6 次以上 / 无元音长串）：零分 + "看不懂请重发" + 扣耐心
- **复读检测**：与历史发言词重叠 >85%（双方 ≥5 词）→ 点破 + 扣耐心

### 8.4 通关与买家行为机制

- **通关条件**：信任度 **3 分 → 70% 概率**放行联系方式；**4 分（满分）→ 必放行**；且发言需命中本局目标关键词。3 分抽不中时买家回 uncertain 台词（"one more solid point"），引导补第 4 个信任点冲满分。信任不足 3 分时要联系方式会被搪塞（"basics first"）——测"先建信任再推进关系"的销售意识
- **买家大脑**（`buyerThink` 单函数可插拔，未来可换 AI）：18 个分支、60+ 句台词池；升级阶梯（同一话题越推越硬）、轮换指针续转（永不复读开场句）、话题 2 回合强制转移（`moveon` 池测更多维度）、每 2 轮主动抛新话题（付款条款/OEM/返单折扣/DDP）、情绪系统（摆烂→不耐烦→最后通牒）、收尾提示（信任够+后期引导要联系方式）
- **买家智能（2026-10-09 上线，零 API）**：
  - **心理价位分流**：每个场景内置目标价（DE 43.5 / US 38 / UK 41 / NL 42）。报价 ≥ 心理价+3 → 强压并回显双方数字；≤ 心理价-3 → 积极推进；≤ 心理价-8 → 怀疑质量（"what did you cut?"）；中间 → 常规场景压价
  - **事实账本**：自动记住候选人报过的价格、质保月数、MOQ，后续台词原样回显（"12 months sounds fair…"），数字对不上会被抓
  - **改价矛盾点破**：前后报价差 >2.5 美元（非正常小让步）→ 买家点破（"Earlier you quoted USD 50. Now you say 42."），每局限一次
  - **悬问催答**：买家问过的问题候选人答非所问 → 下轮先点破再回应（"You did not really answer my question about payment terms."），正面回答后自动消除；催价后只答其他问题会被持续追问报价
  - **议程答案确认**：候选人正面回应买家出过的话题（付款/OEM/折扣/DDP）→ 主题确认句（"T/T with 30% deposit is workable."），而非牛头不对马嘴的兜底
- **谈判力测评层（2026-10-09 上线，源自黄执中《行为说服》+ 熊浩《哈佛谈判术》课程笔记）**：
  - **拖延测试**（行为说服·戳破泡泡）：第 5-7 轮仍未给实质报价 → 买家拖延（"Let me check internally and get back to you."）。候选人给出**可验证的时间+动作**（"schedule a call Thursday / 先寄样品"）→ 买家配合推进；放任不管 → 买家冷淡收场
  - **立场-利益测试**（利益≠立场）：第 2 次常规报价 → 买家抛立场宣言（"The price is simply above our budget."）。候选人**纵向追问**（why / what's behind / what matters）→ 买家揭示真实利益（"采购预算被砍，降本是我的 KPI"）；不追问则按常规议价走
  - **让步质量检测**（让步换交换）：降价时带条件词（if you / in exchange / provided that）→ 买家接住交换框架（"Now we are talking…"）；**免费让步 → 买家得寸进尺**（"how much lower can you actually go?"）——教的就是"不免费让步"
  - **谈判力六信号**（结算小结 + 存档，供 HR 锚定"报价谈判/需求理解/主动开发"维度）：挖掘利益（why/what matters）· 条件让步（if you/in exchange）· 打包方案（package/bundle）· 小步推进（sample/trial/pilot）· 留痕确认（confirm/in writing）· 情绪确认（I understand/that makes sense）。命中数展示在结算面板并追加到存档转写
- **回归测试**：`node scripts/test_buyer_logic.js`，25 组 86 断言全 PASS（通关概率用例已 stub 随机数保证确定性）；改台词/正则后必跑。手感回放：`node scripts/replay.js`（4 段剧本化对话流直观看买家反应）

## 九、评分模式：人工评分台（当前默认，零 API 依赖）

自 2026-09-30 起默认 `SCORE_MODE=manual`：候选人提交后**不调用任何 AI**，由 HR 在评分台按 11 维 rubric 人工打分。

**操作流**：后台列表点「评分」→ 打开评分台（左：询盘原文/回复/口语转写+音频；右：11 维打分表含 0/50/100 锚点 + 综合评语/亮点/风险）→ 底栏实时显示加权分与分档 → 保存即生成报告（标注"人工评分"）。

- 权重计算在服务端按 `config.js` 执行（客户端只传分数评语，防篡改）：综合 = 0.6×询盘加权 + 0.4×口语加权，映射五档。
- 已评分记录可再次进入评分台修改重存（自动预填上次分数）。
- 评分台支持听音频后在评语中注明发音结论（发音精度不计入维度分）。

**切回 AI 自动评分**：`.env` 设 `SCORE_MODE=auto`，并配置 `MOCK_SCORE=0` + LLM Key（见下节），重启后提交即自动评分。

## 十、AI 自动评分（备选，需网络/Key）

当前 `.env` 已配置：`MOCK_SCORE=0` + `GEMINI_API_KEY`（取自 WorkBuddy models.json，Key 只存服务端）+ `GEMINI_MODEL=gemini-2.0-flash`。

**网络前提（重要）**：Gemini API 需经代理访问。启动方式已升级为智能探测：

```
npm start        # 自动探测本地代理端口（17891/7890/7897/10809 等），验证可通 Google 后带代理启动
```

- 启动时会打印检测结果：`使用本地代理: http://127.0.0.1:17891` 或 `⚠️ 未找到可通 Google 的代理`。
- **评分失败/状态停在 pending**：说明当时代理不通。开启你的代理/VPN 客户端 → 重启服务（Ctrl+C 后 `npm start`）→ 后台对失败记录点「重评」。
- 评分失败不会丢数据：记录回落 `pending`，答案与音频都在，重评即可。
- 代理端口不在默认列表时，可手动指定：`HTTPS_PROXY=http://127.0.0.1:端口 npm start`（脚本会优先用手动值）。

## 十一、游戏模式：AI 买家 + 四专家评委（DeepSeek）

> 2026-10-10 新增。`.env` 配置 `LLM_PROVIDER=deepseek` + `DEEPSEEK_API_KEY` 后重启即自动启用；未配置时自动回落第九章零 API 剧本模式，前端无感切换。

### 题库：10×10×10×10 随机组合（src/gameData.js）
- **10 场景**：德国分销/美国车队/英国零售/荷兰采购集团/法国保险渠道/日本进口商/澳洲越野/加拿大电商/西班牙摩旅/瑞典科技分销
- **10 人物特性**：数据控/价格猎手/质量焦虑/急性子/谨慎派/话痨/大厂傲气/新手买手/精明谈判者/关系型
- **10 沟通风格**：直接干脆/礼貌正式/挑刺质疑/热情健谈/冷淡简短/谈判施压/犹豫摇摆/细节控/幽默调侃/公事公办
- **10 目的**：邮箱/WhatsApp/样品单/视频会议/电话/索要报价单/转团队评估/试销订单/采购流程情报/约定跟进时间

每局随机抽取一组（共 1 万种组合），服务端持有人设（`gameSessions` Map，候选人不可见），前端仅见场景/风格/目标。

### 四专家评委（单次调用合并出结果，控成本）
| 评委 | 知识源 | 核心判据 |
|---|---|---|
| 行为说服·黄执中 | kdocs ctQRybMCsUxs | 愿望vs行为、拖延鉴别、B=MAP、死人原则 |
| 人际说服·黄执中 | kdocs cj4urBNGviVs | 三守门员、听众光谱、Q=A+1、上堆下切、换框、互惠 |
| 哈佛谈判术·熊浩 | kdocs cfvLO18xIHDJ | 立场vs利益、让步质量、ICON、锚定/ZOPA、听力三角、Package Deal |
| 国际商务礼仪 | 通用国际商务沟通惯例 | 称呼礼貌、文化敏感、书面习惯、商务边界、时间尊重 |

每轮 1 次 DeepSeek 调用，同时返回：买家回复（保持人设）+ trust 0-5 + 4 评委点评（中文 40-80 字，good/bad/neutral + 理由）。评委面板在聊天框下方 2×2 网格实时刷新。

### 通关判定
买家 trust≥4 且候选人明确提出索取 → `contactGiven:true` → 游戏胜利结算。结算面板展示评委累计统计（👍/⚠️ 计数），评委全记录写入提交记录 `inquiry.replyText`，供 HR 评分锚定。

### API
- `GET /api/game/config` → `{enabled}`（前端据此切换模式）
- `POST /api/game/start` → `{sid, opening, scenario, style, goal}`（每 IP 限 3 会话）
- `POST /api/game/turn` `{sid, history, message, turnNo, maxTurns}` → `{reply, judges[4], trust, contactGiven, gameOver}`

### 知识卡片（Library）
- 行为说服：https://www.workbuddy.cn/space/d/nwNUbwwof9prfWsGk1aTEd
- 哈佛谈判术：https://www.workbuddy.cn/space/d/CO6gKWYSU4F8n4hYGAiK2V
- 人际说服：https://www.workbuddy.cn/space/d/zxkoSJttdFa8fCuqZ1oBVY
