import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import Workbench from '../../docs/.vuepress/components/Workbench.vue';
import AccountSettingsView from '../../docs/.vuepress/components/AccountSettingsView.vue';
import WorkspaceUsersView from '../../docs/.vuepress/components/WorkspaceUsersView.vue';

const admin = { id: 1, name: 'root', display_name: 'Root', role: 'admin', github: null, status: 'active' };
const editor = { id: 2, name: 'ed', display_name: 'Editor', role: 'editor', github: null, status: 'active' };
const response = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const Workspace = { name: 'Workspace', template: '<main><slot name="account"/><slot name="users"/></main>', methods: { canLeave: () => true, openVirtualView: () => {} } };
async function mountWorkbench(fetcher) { globalThis.fetch = fetcher; globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} }); const wrapper = mount(Workbench, { global: { stubs: { Workspace } } }); await flushPromises(); return wrapper; }

describe('工作站会话界面', () => {
  it('未登录时显示简洁登录入口和邀请码注册入口', async () => {
    const wrapper = await mountWorkbench((url) => url === '/api/auth/setup' ? response({ needsBootstrap: false, githubConfigured: false }) : response({ error: 'unauthorized' }, 401));
    expect(wrapper.text()).toContain('欢迎回来'); expect(wrapper.text()).toContain('使用邀请码注册'); expect(wrapper.find('input[autocomplete="username"]').exists()).toBe(true); expect(wrapper.html()).not.toContain('/api/upload/verify'); wrapper.unmount();
  });
  it('登录成功后挂载工作区，401 返回登录态', async () => {
    let logged = false; const wrapper = await mountWorkbench((url) => { if (url === '/api/auth/setup') return response({ needsBootstrap: false, githubConfigured: true }); if (url === '/api/auth/me') return logged ? response({ user: admin }) : response({ error: 'unauthorized' }, 401); if (url === '/api/auth/login') { logged = true; return response({ user: admin }); } return response({}); });
    await wrapper.find('input[autocomplete="username"]').setValue('root'); await wrapper.find('input[autocomplete="current-password"]').setValue('pass'); await wrapper.find('form').trigger('submit'); await flushPromises(); expect(wrapper.text()).toContain('管理员'); wrapper.vm.endSession(); await wrapper.vm.$nextTick(); expect(wrapper.text()).toContain('登录已失效'); wrapper.unmount();
  });
  it('初始管理员错误会显示服务端错误', async () => {
    const wrapper = await mountWorkbench((url) => url === '/api/auth/setup' ? response({ needsBootstrap: true, githubConfigured: false }) : url === '/api/auth/me' ? response({ error: 'unauthorized' }, 401) : response({ error: '引导口令错误' }, 401));
    expect(wrapper.text()).toContain('设置首个管理员'); await wrapper.find('form').trigger('submit'); await flushPromises(); expect(wrapper.text()).toContain('引导口令错误'); wrapper.unmount();
  });
  it('编辑者没有用户管理入口', async () => {
    const wrapper = await mountWorkbench((url) => url === '/api/auth/setup' ? response({ needsBootstrap: false, githubConfigured: false }) : response({ user: editor }));
    expect(wrapper.text()).not.toContain('用户管理'); wrapper.unmount();
  });
  it('退出请求失败时保留登录界面并显示可重试错误', async () => {
    const wrapper=await mountWorkbench((url)=>url==='/api/auth/setup'?response({needsBootstrap:false,githubConfigured:false}):url==='/api/auth/logout'?response({error:'退出服务暂不可用'},503):response({user:admin}));
    await wrapper.findAll('button').find(button=>button.text()==='退出').trigger('click');await flushPromises();
    expect(wrapper.text()).toContain('退出服务暂不可用');expect(wrapper.text()).toContain('管理员');expect(wrapper.text()).not.toContain('登录工作站');wrapper.unmount();
  });
  it('管理员首次创建后退出返回普通登录而非重复初始化', async () => {
    const wrapper=await mountWorkbench((url)=>url==='/api/auth/setup'?response({needsBootstrap:true,githubConfigured:false}):url==='/api/auth/me'?response({error:'unauthorized'},401):url==='/api/auth/bootstrap'?response({user:admin}):response({ok:true}));
    await wrapper.find('input[autocomplete="username"]').setValue('root');
    await wrapper.find('form').trigger('submit');await flushPromises();
    await wrapper.findAll('button').find(button=>button.text()==='退出').trigger('click');await flushPromises();
    expect(wrapper.text()).toContain('欢迎回来');expect(wrapper.text()).not.toContain('设置首个管理员');wrapper.unmount();
  });
  it('邀请码注册校验用户名、密码确认，并清理切页时的密码', async () => {
    const wrapper = await mountWorkbench((url) => url === '/api/auth/setup' ? response({ needsBootstrap: false, githubConfigured: false }) : response({ error: 'unauthorized' }, 401));
    await wrapper.findAll('button').find((button) => button.text() === '使用邀请码注册').trigger('click');
    expect(wrapper.text()).toContain('邀请码注册'); expect(wrapper.text()).toContain('邀请码请向管理员获取');
    await wrapper.find('#invite-code').setValue('invite'); await wrapper.find('#register-name').setValue('UPPER'); await wrapper.find('#register-password').setValue('short'); await wrapper.find('#register-confirm-password').setValue('other');
    await wrapper.find('form').trigger('submit'); await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain('用户名需为'); expect(wrapper.text()).toContain('密码需为 8–200 位。'); expect(wrapper.text()).toContain('两次输入的密码不一致。');
    await wrapper.findAll('button').find((button) => button.text() === '返回登录').trigger('click');
    await wrapper.findAll('button').find((button) => button.text() === '使用邀请码注册').trigger('click');
    expect(wrapper.find('#register-password').element.value).toBe(''); expect(wrapper.find('#register-confirm-password').element.value).toBe(''); wrapper.unmount();
  });
  it('注册服务端邀请码错误显示中文提示，显示密码按钮切换输入类型', async () => {
    const wrapper = await mountWorkbench((url) => url === '/api/auth/setup' ? response({ needsBootstrap: false, githubConfigured: false }) : url === '/api/auth/me' ? response({ error: 'unauthorized' }, 401) : response({ error: 'invite expired' }, 400));
    await wrapper.findAll('button').find((button) => button.text() === '使用邀请码注册').trigger('click');
    await wrapper.find('#invite-code').setValue('valid-code'); await wrapper.find('#register-name').setValue('writer'); await wrapper.find('#register-password').setValue('eightchars'); await wrapper.find('#register-confirm-password').setValue('eightchars');
    expect(wrapper.find('#register-password').attributes('type')).toBe('password'); await wrapper.findAll('.wb-password-toggle')[0].trigger('click'); expect(wrapper.find('#register-password').attributes('type')).toBe('text');
    await wrapper.find('form').trigger('submit'); await flushPromises(); expect(wrapper.text()).toContain('邀请码已过期。'); wrapper.unmount();
  });
  it('提交期间禁用重复提交和模式切换', async () => {
    let resolveLogin; const login = new Promise((resolve) => { resolveLogin = resolve; }); let calls = 0;
    const wrapper = await mountWorkbench((url) => { if (url === '/api/auth/setup') return response({ needsBootstrap: false, githubConfigured: false }); if (url === '/api/auth/me') return response({ error: 'unauthorized' }, 401); if (url === '/api/auth/login') { calls += 1; return login; } return response({}); });
    await wrapper.find('#login-name').setValue('writer'); await wrapper.find('#login-password').setValue('eightchars'); await wrapper.find('form').trigger('submit'); await wrapper.vm.$nextTick();
    expect(wrapper.find('button.primary').attributes('disabled')).toBeDefined(); expect(wrapper.findAll('button').find((button) => button.text() === '使用邀请码注册').attributes('disabled')).toBeDefined();
    await wrapper.find('form').trigger('submit'); expect(calls).toBe(1); resolveLogin(response({ user: editor })); await flushPromises(); wrapper.unmount();
  });
});

describe('账户与用户管理交互', () => {
  it('账户更新、密码更新与 OAuth 配置状态可见', async () => {
    const adapter = { updateMe: vi.fn().mockResolvedValue({ user: { ...editor, display_name: 'New' } }), unlinkGithub: vi.fn() };
    const wrapper = mount(AccountSettingsView, { props: { user: editor, githubConfigured: false, adapter } }); expect(wrapper.text()).toContain('尚未配置 GitHub OAuth'); expect(wrapper.findAll('button').find((b) => b.text() === '绑定 GitHub').attributes('disabled')).toBeDefined(); await wrapper.find('input[autocomplete="name"]').setValue('New'); await wrapper.find('form').trigger('submit'); await flushPromises(); expect(adapter.updateMe).toHaveBeenCalledWith({ display_name: 'New' }); wrapper.unmount();
  });
  it('管理员可创建、显示和吊销邀请码，并区分占用中断', async () => {
    const adapter = { users: vi.fn().mockResolvedValue({ users: [admin] }), invites: vi.fn().mockResolvedValue({ invites: [{ code_hash: 'a', role: 'editor', used_by: null, expires_at: 0 }, { code_hash: 'b', role: 'editor', used_by: 0, expires_at: 0 }] }), createInvite: vi.fn().mockResolvedValue({ code: 'new-code' }), revokeInvite: vi.fn().mockResolvedValue({ ok: true }), updateUser: vi.fn() };
    const wrapper = mount(WorkspaceUsersView, { props: { adapter } }); await flushPromises(); expect(wrapper.text()).toContain('未使用'); expect(wrapper.text()).toContain('占用中断'); await wrapper.find('.invite-create button').trigger('click'); await flushPromises(); expect(wrapper.text()).toContain('new-code'); await wrapper.findAll('button').find((button) => button.text() === '吊销').trigger('click'); expect(adapter.revokeInvite).toHaveBeenCalledWith('a'); wrapper.unmount();
  });
});
