// 存储层：JSON 文件版（低并发足够；后续可换 SQLite/Postgres 适配器）
const fs = require('fs/promises');
const path = require('path');
const config = require('./config');

async function ensureFile() {
  try {
    await fs.access(config.paths.submissionsFile);
  } catch {
    // 云端冷启动时 data/uploads 目录可能不存在，递归创建
    await fs.mkdir(config.paths.dataDir, { recursive: true });
    await fs.mkdir(config.paths.uploadsDir, { recursive: true });
    await fs.writeFile(config.paths.submissionsFile, '[]', 'utf8');
  }
}

async function readAll() {
  await ensureFile();
  const raw = await fs.readFile(config.paths.submissionsFile, 'utf8');
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function writeAll(list) {
  await fs.writeFile(config.paths.submissionsFile, JSON.stringify(list, null, 2), 'utf8');
}

async function saveSubmission(sub) {
  const list = await readAll();
  list.push(sub);
  await writeAll(list);
  return sub;
}

async function getSubmission(id) {
  const list = await readAll();
  return list.find((s) => s.id === id) || null;
}

async function updateSubmission(id, patch) {
  const list = await readAll();
  const idx = list.findIndex((s) => s.id === id);
  if (idx === -1) return null;
  list[idx] = { ...list[idx], ...patch };
  await writeAll(list);
  return list[idx];
}

async function listSubmissions() {
  const list = await readAll();
  // 列表视图只返回概览字段，按时间倒序
  return list
    .map((s) => ({
      id: s.id,
      name: s.candidate?.name || '未命名',
      email: s.candidate?.email || '',
      overallScore: s.scores?.overallScore ?? null,
      tier: s.scores?.tier ?? null,
      status: s.status,
      createdAt: s.createdAt,
    }))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

module.exports = { saveSubmission, getSubmission, updateSubmission, listSubmissions };
