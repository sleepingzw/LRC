import test from 'node:test';
import assert from 'node:assert/strict';
import { handleApi } from '../worker/src/api.js';
import { toEdit, toDraft, syncInstrumentalLyrics } from '../docs/.vuepress/components/workspaceDocument.js';
import { applySourceBuffer, setSourceBuffer } from '../docs/.vuepress/components/workspaceEditState.js';
import { fakeBucket, authedRequest, authenticatedUsers } from './worker/_fakeR2.mjs';

test('nested files and linked lyric edits survive editor roundtrip and extraction', async () => {
  const bucket = fakeBucket();
  const env = {
    UPLOAD_BUCKET: bucket,
    USERS: authenticatedUsers(),
    JOB: { getByName: () => ({ fetch: async () => Response.json({ state: 'queued' }) }) },
  };
  const post = async (action, body) => {
    const response = await handleApi(authedRequest(`https://x/api/workspace/${action}`, { method: 'POST', body }), env);
    const result = await response.json();
    assert.equal(response.status, 200, JSON.stringify(result));
    return result;
  };
  const { ref } = await post('create', { album: '文件往返', submission_type: 'single' });
  await post('document', { ref, kind: 'folder', path: '歌词' });
  await post('document', { ref, kind: 'file', path: '歌词/星河.elrc' });
  await post('document', { ref, kind: 'file', path: '歌词/星河 INST.elrc' });
  await post('document', { ref, kind: 'file', path: '歌词/说明.json' });
  const readDraft = async () => (await (await handleApi(authedRequest(`https://x/api/workspace/draft?ref=${ref}`), env)).json()).draft;
  const initial = await readDraft();
  initial.tracks[1].inst = true;
  let nextId = 0;
  const newId = () => `row-${++nextId}`;
  const edit = toEdit(initial.album, initial, newId);
  const elrc = '[00:01.000]<00:01.000>星<00:01.500>河\n';
  setSourceBuffer(edit.tracks[0], 'elrc', elrc);
  assert.equal(applySourceBuffer(edit.tracks[0], 'elrc', newId), true);
  assert.equal(syncInstrumentalLyrics(edit, edit.tracks[0], [edit.tracks[1]._id], newId).length, 1);
  edit.documents.find(item => item.path === '歌词/说明.json').text = '{"说明":"保存后继续修改"}\n';
  await post('save', { ref, draft: toDraft(edit) });

  const reloaded = toDraft(toEdit(initial.album, await readDraft(), newId));
  assert.equal(reloaded.submission_type, 'single');
  assert.deepEqual(reloaded.tracks.map(track => track.lyric_stem), ['歌词/星河', '歌词/星河 INST']);
  for (const track of reloaded.tracks) {
    assert.equal(track.lrc, '[00:01.000]星河\n');
    assert.equal(track.klrc, elrc);
  }
  await post('extract', { ref });
  const manifest = JSON.parse(bucket.store.get(`web/${ref}/manifest.json`));
  const files = new Map(manifest.files.map(file => [file.path, bucket.store.get(`web/${ref}/${file.n}`)]));
  assert.equal(files.get('歌词/说明.json'), '{"说明":"保存后继续修改"}\n');
  assert.equal(files.get('歌词/星河.elrc'), elrc);
  assert.equal(files.get('歌词/星河 INST.elrc'), elrc);
  assert.equal(files.get('歌词/星河.lrc'), '[00:01.000]星河\n');
  assert.equal(files.get('歌词/星河 INST.lrc'), '[00:01.000]星河\n');
  assert.equal([...files.keys()].some(path => path.endsWith('.klrc')), false);
});
