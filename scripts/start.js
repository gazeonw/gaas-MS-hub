// 智能启动：自动探测本地代理并验证可达 Google 后，以正确代理环境启动 server.js
// 用法：node scripts/start.js  （替代直接 node server.js）
const net = require('net');
const { spawn } = require('child_process');

// 常见本地代理端口（17891 为本机历史配置优先；4996 是沙箱代理，排除）
const CANDIDATE_PORTS = [17891, 7890, 7897, 7891, 10809, 10808, 1080, 8118, 8888];
const GOOGLE_HOST = 'generativelanguage.googleapis.com';

function portOpen(port, host) {
  return new Promise((resolve) => {
    const s = net.connect(port, host || '127.0.0.1');
    s.setTimeout(600);
    const done = (ok) => { try { s.destroy(); } catch (e) {} resolve(ok); };
    s.on('connect', () => done(true));
    s.on('error', () => done(false));
    s.on('timeout', () => done(false));
  });
}

// 经代理发 CONNECT，看代理能否对 Google 建立隧道（返回 200 即上游连通）
function proxyTunnelsGoogle(proxy) {
  return new Promise((resolve) => {
    const m = proxy.match(/^http:\/\/127\.0\.0\.1:(\d+)$/);
    if (!m) return resolve(false);
    const s = net.connect(Number(m[1]), '127.0.0.1');
    s.setTimeout(6000);
    let buf = '';
    const fail = () => { try { s.destroy(); } catch (e) {} resolve(false); };
    s.on('error', fail);
    s.on('timeout', fail);
    s.on('connect', () => {
      s.write(`CONNECT ${GOOGLE_HOST}:443 HTTP/1.1\r\nHost: ${GOOGLE_HOST}:443\r\n\r\n`);
    });
    s.on('data', (d) => {
      buf += d.toString('latin1');
      if (buf.includes('\r\n\r\n') || buf.includes('\n\n')) {
        const ok = /^HTTP\/1\.[01] 200/.test(buf.trim());
        try { s.destroy(); } catch (e) {}
        resolve(ok);
      }
    });
  });
}

(async () => {
  let proxy = null;

  // 仅当配置了 Gemini 真实评分时才需要检查代理通路
  require('dotenv').config();
  const needsGoogle = (process.env.LLM_PROVIDER || 'gemini') === 'gemini' && process.env.MOCK_SCORE !== '1';

  if (needsGoogle) {
    console.log('[start] 检测本地代理与 Google 连通性...');
    // 优先使用手动指定的代理（HTTPS_PROXY=... npm start）
    const manual = process.env.HTTPS_PROXY || process.env.https_proxy;
    if (manual) {
      if (await proxyTunnelsGoogle(manual)) {
        proxy = manual;
        console.log(`[start] 使用手动指定代理: ${proxy}`);
      } else {
        console.log(`[start] 手动指定的代理 ${manual} 无法连通 Google，尝试自动探测...`);
      }
    }
    if (!proxy) {
      for (const p of CANDIDATE_PORTS) {
        if (await portOpen(p)) {
          const cand = `http://127.0.0.1:${p}`;
          if (await proxyTunnelsGoogle(cand)) { proxy = cand; break; }
        }
      }
    }
    if (proxy && !manual) {
      console.log(`[start] 使用本地代理: ${proxy}`);
    } else if (!proxy && await portOpen(443, GOOGLE_HOST)) {
      console.log('[start] 直连可达 Google（TUN 模式），无需代理');
    } else if (!proxy) {
      console.log('[start] ⚠️  当前未找到可通 Google 的代理，Gemini 真实评分会失败！');
      console.log('[start]    请开启你的代理/VPN 客户端后重启本服务（npm start）。');
    }
  }

  const env = { ...process.env, NODE_USE_ENV_PROXY: '1' };
  // 清掉可能继承的沙箱代理（4996），避免污染
  delete env.HTTP_PROXY;
  delete env.HTTPS_PROXY;
  delete env.http_proxy;
  delete env.https_proxy;
  if (proxy) {
    env.HTTP_PROXY = proxy;
    env.HTTPS_PROXY = proxy;
  }

  const child = spawn(process.execPath, ['server.js'], { stdio: 'inherit', env, cwd: __dirname + '/..' });
  child.on('exit', (code) => process.exit(code || 0));
})();
