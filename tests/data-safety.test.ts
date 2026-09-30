import test from 'node:test';
import assert from 'node:assert/strict';
import { preserveUnreadableData, verifyDataWrite } from '../src/data-safety';

function memoryAdapter(files: Map<string, string>) {
  return {
    exists: async (path: string) => files.has(path),
    read: async (path: string) => { const v = files.get(path); if (v === undefined) throw new Error('ENOENT'); return v; },
    write: async (path: string, data: string) => { files.set(path, data); },
  };
}

test('copies an unreadable data.json aside and leaves the original untouched', async () => {
  const files = new Map([['p/data.json', '{ broken']]);
  const result = await preserveUnreadableData(memoryAdapter(files), 'p/data.json', new Date(2026, 8, 30, 8, 5, 9));
  assert.deepEqual(result, { state: 'preserved', backupPath: 'p/data.json.unreadable-20260930-080509' });
  assert.equal(files.get('p/data.json'), '{ broken');
  assert.equal(files.get('p/data.json.unreadable-20260930-080509'), '{ broken');
});

test('reports a missing file and a failed copy separately', async () => {
  assert.deepEqual(await preserveUnreadableData(memoryAdapter(new Map()), 'p/data.json'), { state: 'missing' });
  const adapter = { ...memoryAdapter(new Map([['p/data.json', 'x']])), write: async () => { throw new Error('EACCES'); } };
  assert.equal((await preserveUnreadableData(adapter, 'p/data.json')).state, 'failed');
  assert.equal((await preserveUnreadableData(null, 'p/data.json')).state, 'failed');
});

test('accepts a written payload and rejects a write that never reached the disk', async () => {
  const files = new Map([['p/data.json', JSON.stringify({ a: 1 }, null, 2)]]);
  await verifyDataWrite(memoryAdapter(files), 'p/data.json', { a: 1 });
  await assert.rejects(verifyDataWrite(memoryAdapter(files), 'p/data.json', { a: 2 }), /not written/);
  await assert.rejects(verifyDataWrite(memoryAdapter(new Map()), 'p/data.json', { a: 1 }));
});
