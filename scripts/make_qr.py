# 生成候选人测评入口二维码 + AKEEYO 品牌海报
# 用法: python make_qr.py <公网URL>
import sys
import qrcode
from qrcode.constants import ERROR_CORRECT_H
from PIL import Image, ImageDraw, ImageFont, ImageOps

URL = sys.argv[1] if len(sys.argv) > 1 else "https://helena-seeker-prompt-boost.trycloudflare.com"
OUT_DIR = r"D:\WorkBuddy\2026-09-29-18-33-46\akeeyo-interview"
LOGO = r"C:\Users\Gaa zeon Wong\Desktop\desktop-Gaa\LOGO CATALOG\LOGO\Akeeyo\AKEEYO 黑底.jpg"
FONT_R = "C:/Windows/Fonts/msyh.ttc"
FONT_B = "C:/Windows/Fonts/msyhbd.ttc"

RED = (214, 0, 18)      # #d60012
BLACK = (10, 10, 10)    # #0a0a0a
WHITE = (255, 255, 255)
GRAY = (170, 170, 170)

# ---------- 1. 纯二维码（白底，扫描兼容性最佳） ----------
qr = qrcode.QRCode(error_correction=ERROR_CORRECT_H, box_size=12, border=2)
qr.add_data(URL)
qr.make(fit=True)
img_qr = qr.make_image(fill_color="#0a0a0a", back_color="white").convert("RGB")
img_qr = img_qr.resize((1000, 1000), Image.NEAREST)
img_qr.save(OUT_DIR + r"\candidate-qr.png")

# ---------- 2. 品牌海报 ----------
W, H = 750, 1334
poster = Image.new("RGB", (W, H), BLACK)
d = ImageDraw.Draw(poster)

# 顶部 LOGO（黑底白标）
logo = Image.open(LOGO).convert("RGB")
lw = 360
lh = int(logo.height * lw / logo.width)
logo = logo.resize((lw, lh), Image.LANCZOS)
poster.paste(logo, ((W - lw) // 2, 64))

# 标题
f_title = ImageFont.truetype(FONT_B, 44)
f_sub = ImageFont.truetype(FONT_R, 26)
f_small = ImageFont.truetype(FONT_R, 20)
f_url = ImageFont.truetype(FONT_B, 17)
f_note = ImageFont.truetype(FONT_R, 22)
f_foot = ImageFont.truetype(FONT_R, 20)

def center(text, y, font, fill):
    w = d.textlength(text, font=font)
    d.text(((W - w) / 2, y), text, font=font, fill=fill)

y = 64 + lh + 46
center("外贸销售岗位 · 在线测评", y, f_title, WHITE)
y += 74
center("询盘回复能力 + 英语口语 · 约 20 分钟", y, f_sub, GRAY)

# 白色卡片 + 二维码
card_w, card_h = 560, 640
cx, cy = (W - card_w) // 2, y + 44
d.rounded_rectangle([cx, cy, cx + card_w, cy + card_h], radius=28, fill=WHITE)
qr_small = img_qr.resize((460, 460), Image.NEAREST)
poster.paste(qr_small, (cx + (card_w - 460) // 2, cy + 36))
uy = cy + 460 + 36 + 14
url_w = d.textlength(URL, font=f_url)
d.text(((W - url_w) / 2, uy), URL, font=f_url, fill=(30, 30, 30))

# 注意事项
ny = cy + card_h + 40
notes = [
    "· 口语为录音作答，请允许麦克风权限",
    "· 手机、电脑均可完成，建议用浏览器打开",
    "· 请独立完成，系统将记录作答用时",
]
for n in notes:
    d.rounded_rectangle([70, ny + 8, 78, ny + 26], radius=4, fill=RED)
    d.text((96, ny), n, font=f_note, fill=(225, 225, 225))
    ny += 46

# 底部
center("AKEEYO HR · 慕晟科技", H - 74, f_foot, GRAY)

poster.save(OUT_DIR + r"\candidate-poster.png")
print("OK: candidate-qr.png / candidate-poster.png ->", URL)
