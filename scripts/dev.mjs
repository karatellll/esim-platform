import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const apiRoot = join(root, 'apps', 'api');
const mobileRoot = join(root, 'apps', 'mobile');
const windows = process.platform === 'win32';
const python = join(apiRoot, '.venv', windows ? 'Scripts/python.exe' : 'bin/python');
const expo = join(mobileRoot, 'node_modules', 'expo', 'bin', 'cli');
const args = process.argv.slice(2);
const frontendEnv = { ...process.env };
// Use the browser's hostname for local API requests so SameSite cookies work
// with both localhost and 127.0.0.1. An explicit API URL still overrides this.
if (args.includes('--web') && !frontendEnv.EXPO_PUBLIC_API_URL?.trim()) {
  delete frontendEnv.EXPO_PUBLIC_API_URL;
  frontendEnv.EXPO_NO_DOTENV = '1';
}

if (args.includes('--help') || args.includes('-h')) {
  console.log(`Запуск API и Expo с автоматическим обновлением:
  npm run dev                Expo Go
  npm run dev:web            Браузер
  npm run dev -- --android   Android
  npm run dev -- --ios       iOS Simulator (macOS)

Дополнительные аргументы передаются в expo start. Ctrl+C останавливает оба процесса.`);
  process.exit(0);
}

if (!existsSync(python) || !existsSync(expo)) {
  console.error('Сначала установите зависимости из README.md:');
  if (!existsSync(python)) {
    console.error('  Создайте apps/api/.venv и установите Python-зависимости (apps/api/README.md).');
  }
  if (!existsSync(expo)) {
    console.error('  npm ci --prefix apps/mobile');
  }
  process.exit(1);
}

const children = new Set();
let stopping = false;
let forceTimer;

function signalTree(child, signal) {
  if (!child.pid) return;
  if (windows) {
    // taskkill also terminates Uvicorn's reload worker and Expo's child processes.
    const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
      stdio: 'ignore',
    });
    killer.on('error', () => child.kill());
  } else {
    try {
      process.kill(-child.pid, signal);
    } catch (error) {
      if (error.code !== 'ESRCH') console.error(`Не удалось остановить процесс: ${error.message}`);
    }
  }
}

function stop(code) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  const running = [...children];
  for (const child of running) signalTree(child, 'SIGTERM');
  // Allow graceful shutdown, then remove any remaining reload/Metro workers.
  forceTimer = setTimeout(() => {
    for (const child of running) signalTree(child, 'SIGKILL');
  }, 5000);
  forceTimer.unref();
}

function start(name, command, commandArgs, cwd, interactive = false, env = process.env) {
  const child = spawn(command, commandArgs, {
    cwd,
    env,
    detached: !windows,
    stdio: [interactive ? 'inherit' : 'ignore', 'inherit', 'inherit'],
  });
  children.add(child);
  child.on('error', (error) => {
    console.error(`[${name}] Ошибка запуска: ${error.message}`);
    children.delete(child);
    stop(1);
  });
  child.on('exit', (code, signal) => {
    children.delete(child);
    if (!stopping) {
      console.error(`[${name}] Процесс завершился (${signal ?? code}). Останавливаем приложение.`);
      // The process leader may have left workers behind.
      signalTree(child, 'SIGTERM');
      stop(code || 1);
    }
    if (children.size === 0) clearTimeout(forceTimer);
  });
}

process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));

console.log('Запускаем API (автоперезапуск) и Expo (Fast Refresh). Для остановки нажмите Ctrl+C.');
start('API', python, ['-m', 'app.cli'], apiRoot);
start('Expo', process.execPath, [expo, 'start', ...args], mobileRoot, true, frontendEnv);
