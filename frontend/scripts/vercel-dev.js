const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const envPath = path.resolve(process.cwd(), '.env.local');

if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex < 1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (value && value !== '[SENSITIVE]') process.env[key] = value;
  }
}

const vercelExecutable = path.resolve(process.cwd(), 'node_modules', 'vercel', 'dist', 'vc.js');

const child = spawn(process.execPath, [vercelExecutable, 'dev'], {
  env: process.env,
  stdio: 'inherit',
  shell: false,
});

child.on('exit', code => process.exit(code ?? 1));
