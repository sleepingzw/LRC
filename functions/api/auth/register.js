import {
  json, jsonWithHeaders, directory, sha256Hex, hashPassword,
  cleanUsername, validPassword, cleanDisplayName, issueSession, sanitizeUser,
} from './_lib.js';

const INVITE_RE = /^[0-9a-f]{16,64}$/;
const INVITE_ERROR = { not_found: 'invalid invite', used: 'invite already used', expired: 'invite expired' };

// 先原子占用邀请码，避免并发建号重复使用。
export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => ({}));
  const code = typeof body.invite_code === 'string' ? body.invite_code.trim() : '';
  if (!INVITE_RE.test(code)) return json({ error: 'invalid invite' }, 400);

  const name = cleanUsername(body.name);
  if (!name) return json({ error: 'bad name' }, 400);
  if (!validPassword(body.password)) return json({ error: 'weak password' }, 400);
  const display_name = cleanDisplayName(body.display_name, name);

  const dir = directory(env);
  const codeHash = await sha256Hex(code);
  const claimed = await dir.claimInvite(codeHash, Date.now());
  if (!claimed.ok) return json({ error: INVITE_ERROR[claimed.reason] || 'invalid invite' }, 400);

  let credentials;
  let created;
  try {
    credentials = await hashPassword(body.password);
    created = await dir.createUser({
      name, display_name, role: claimed.role, ...credentials,
    });
  } catch (error) {
    // 派生或写入异常也不能让占用状态永久卡住邀请码
    await dir.releaseInvite(codeHash);
    throw error;
  }
  if (!created.ok) {
    // 建号失败（撞用户名）不能让邀请码白白作废：放回未使用状态，换个用户名还能重试
    await dir.releaseInvite(codeHash);
    return json({ error: 'username taken' }, 409);
  }

  await dir.finalizeInvite(codeHash, created.user.id);

  const headers = new Headers();
  await issueSession(env, created.user.id, headers);
  return jsonWithHeaders({ user: sanitizeUser(created.user) }, 201, headers);
}
