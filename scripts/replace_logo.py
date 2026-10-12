# -*- coding: utf-8 -*-
"""将 index/admin/scoring 三个页面的手写 CSS 假 logo 替换为 LOGO CATALOG 权威源官方图片。
规则来源：Gaa 2026-09-15 LOGO 选用标准（黑底页面用「AKEEYO 黑底.jpg」）。
"""
import io, os, re

ROOT = r'D:\WorkBuddy\2026-09-29-18-33-46\akeeyo-interview'
B64 = io.open(os.path.join(ROOT, 'scripts', 'logo_b64.txt'), 'r', encoding='utf-8').read().strip()
IMG = '<img class="logo" alt="AKEEYO" src="data:image/jpeg;base64,' + B64 + '" />'

FAKE_DIV = '<div class="logo">AKEEYO</div>'

# 三个页面均为 #0a0a0a 黑底 topbar → 官方黑底 LOGO 图，无缝融入
CSS_NEW = '''.logo {
  height: 30px;
  width: auto;
  display: block;
}'''

changed = []
for name in ['index.html', 'admin.html', 'scoring.html']:
    p = os.path.join(ROOT, 'public', name)
    s = io.open(p, 'r', encoding='utf-8').read()
    if FAKE_DIV not in s:
        changed.append((name, 'SKIP: 未找到手写 logo'))
        continue
    s = s.replace(FAKE_DIV, IMG)
    # 内联 .logo 样式（admin/scoring）→ 图片尺寸样式
    s = re.sub(
        r'\.logo\{[^}]*\}',
        '.logo{height:30px;width:auto;display:block}',
        s, count=1)
    io.open(p, 'w', encoding='utf-8').write(s)
    changed.append((name, 'OK'))

# style.css 的 .logo 块（index 用）
css_p = os.path.join(ROOT, 'public', 'style.css')
s = io.open(css_p, 'r', encoding='utf-8').read()
# 定位 .logo { ... } 块并整块替换
m = re.search(r'\.logo \{[^}]*\}', s, re.S)
if m:
    s = s[:m.start()] + CSS_NEW + s[m.end():]
    io.open(css_p, 'w', encoding='utf-8').write(s)
    changed.append(('style.css', 'OK'))
else:
    changed.append(('style.css', 'SKIP'))

for c in changed:
    print(c)
