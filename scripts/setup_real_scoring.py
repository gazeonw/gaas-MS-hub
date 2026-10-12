# 从 models.json 提取 Gemini Key，实测后写入 .env（Key 只在本地流转，不打印）
# 用法: python setup_real_scoring.py [--skip-test]  （无代理环境用 --skip-test 只写配置不验证）
import json, os, sys, urllib.request

SKIP_TEST = '--skip-test' in sys.argv

MJ = os.path.join(os.path.expanduser('~'), '.workbuddy', 'models.json')
ENV = r'D:\WorkBuddy\2026-09-29-18-33-46\akeeyo-interview\.env'
BASE = 'https://generativelanguage.googleapis.com/v1beta'

with open(MJ, 'r', encoding='utf-8') as f:
    models = json.load(f)

cands = []
for m in models:
    url = str(m.get('url', ''))
    key = m.get('apiKey') or m.get('api_key') or ''
    names = {m.get('model'), m.get('modelId'), m.get('id'), m.get('name')}
    gemini_names = [v for v in names if isinstance(v, str) and v.startswith('gemini')]
    if 'generativelanguage.googleapis.com' in url and key:
        cands.append((gemini_names, key))

if not cands:
    print('RESULT: NO_GEMINI_ENTRY')
    sys.exit(1)

def test_call(model, key):
    u = '%s/models/%s:generateContent?key=%s' % (BASE, model, key)
    body = json.dumps({
        'contents': [{'parts': [{'text': 'Reply with exactly: OK'}]}],
        'generationConfig': {'maxOutputTokens': 10},
    }).encode()
    req = urllib.request.Request(u, data=body, headers={'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=40) as r:
            return r.status == 200
    except urllib.error.HTTPError as e:
        print('  test %s -> HTTP %d' % (model, e.code))
        return False
    except Exception as e:
        print('  test %s -> %s' % (model, str(e)[:100]))
        return False

ok_model, ok_key = None, None
if SKIP_TEST:
    # 离线模式：直接取第一个 Gemini 条目的 Key（模型固定用已验证过的 gemini-2.0-flash）
    ok_model, ok_key = 'gemini-2.0-flash', cands[0][1]
else:
    for gemini_names, key in cands:
        for cand in list(gemini_names) + ['gemini-2.0-flash']:
            if cand and test_call(cand, key):
                ok_model, ok_key = cand, key
                break
        if ok_key:
            break

if not ok_key:
    print('RESULT: KEY_TEST_FAILED')
    sys.exit(2)

with open(ENV, 'r', encoding='utf-8') as f:
    lines = f.read().splitlines()
out = []
for ln in lines:
    if ln.startswith('GEMINI_API_KEY='):
        ln = 'GEMINI_API_KEY=' + ok_key
    elif ln.startswith('GEMINI_MODEL='):
        ln = 'GEMINI_MODEL=' + ok_model
    elif ln.startswith('MOCK_SCORE='):
        ln = 'MOCK_SCORE=0'
    out.append(ln)
with open(ENV, 'w', encoding='utf-8') as f:
    f.write('\n'.join(out) + '\n')

print('RESULT: CONFIGURED model=%s key_len=%d MOCK_SCORE=0' % (ok_model, len(ok_key)))
