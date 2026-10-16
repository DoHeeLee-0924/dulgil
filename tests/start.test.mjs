import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('direct server entry starts and reports a URL', async () => {
  const child = spawn(process.execPath, [fileURLToPath(new URL('../server.mjs', import.meta.url))], {
    env: { ...process.env, PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  try {
    const output = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Server did not start')), 5000);
      child.once('error', error => { clearTimeout(timer); reject(error); });
      child.once('exit', code => { clearTimeout(timer); reject(new Error(`Server exited early: ${code}`)); });
      child.stdout.once('data', data => { clearTimeout(timer); resolve(data.toString()); });
    });
    assert.match(output, /http:\/\/localhost:/);
    assert.equal(child.exitCode, null);
  } finally {
    child.kill();
  }
});
