import { describe, it, expect } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { reactive } from 'vue';
import AlbumMetaView from '../../docs/.vuepress/components/AlbumMetaView.vue';
import AlbumAssetsView from '../../docs/.vuepress/components/AlbumAssetsView.vue';
import WorkspaceAssetView from '../../docs/.vuepress/components/WorkspaceAssetView.vue';
import { toEdit, toDraft } from '../../docs/.vuepress/components/workspaceDocument.js';

describe('专辑视图', () => {
  it('表单编辑进入可保存草稿，中文名和英文名互不覆盖', async () => {
    let id = 0;
    const editor = reactive(toEdit('album', { album: '专辑', meta: {}, names: { zh_name: '中文', en_name: 'English' }, tracks: [], assets: [] }, () => ++id));
    const view = mount(AlbumMetaView, { props: { editor } });
    await view.get('[aria-label="英文名"]').setValue('Updated');
    await view.get('[aria-label="作曲"]').setValue('甲、乙');
    expect(toDraft(editor).names).toMatchObject({ zh_name: '中文', en_name: 'Updated' });
    expect(toDraft(editor).meta.composer).toEqual(['甲', '乙']);
    expect(view.emitted('update')).toHaveLength(2);
    view.unmount();
  });
  it('素材用途、共享曲目关联和移除更新同一份素材列表', async () => {
    const item = { n: 0, path: 'page.jpg', role: 'photo', size: 1024, linkTo: [1] };
    const view = mount(AlbumAssetsView, { props: { assets: [item], tracks: [{ order: 1, title: '一' }, { order: 2, title: '二' }] } });
    await view.get('[aria-label="用途 page.jpg"]').setValue('staff');
    expect(view.emitted('update').at(-1)[0][0].role).toBe('staff');
    await view.findAll('input[type="checkbox"]').at(-1).setValue(true);
    expect(view.emitted('update').at(-1)[0][0].linkTo).toEqual([1, 2]);
    await view.get('[aria-label="移除 page.jpg"]').trigger('click');
    expect(view.emitted('update').at(-1)[0]).toEqual([]);
    view.unmount();
  });
  it('素材总览提供文本编辑入口', () => {
    const view = mount(AlbumAssetsView, { props: { pendingFiles: [{ id: 'text', raw: new File(['原文'], 'notes.txt'), path: 'notes.txt', role: 'text' }] } });
    expect(view.get('[aria-label="编辑文本 notes.txt"]').exists()).toBe(true); view.unmount();
  });
});

const MonacoStub = { name: 'MonacoLrcEditor', props: ['modelValue'], emits: ['update:modelValue'], template: '<textarea :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />' };
const assetMount = (props) => mount(WorkspaceAssetView, { props, global: { stubs: { MonacoLrcEditor: MonacoStub, ImageEditDialog: true } } });

describe('具体素材文件视图', () => {
  it('编辑 pending 文本后以原始文字内容更新待上传文件', async () => {
    const raw = new File(['原始歌词\n'], 'song.elrc', { type: 'text/plain' }); const pendingFile = { id: 'p1', raw, path: 'lyrics/song.elrc', role: 'text' };
    const view = assetMount({ asset: { path: pendingFile.path, role: 'text' }, pendingFile }); await flushPromises();
    await view.get('textarea').setValue('修改后歌词\n'); await view.get('button').trigger('click');
    const update = view.emitted('update-pending').at(-1)[0]; expect(await update.raw.text()).toBe('修改后歌词\n'); expect(update.raw.size).toBe(new TextEncoder().encode('修改后歌词\n').byteLength); view.unmount();
  });
  it('只读图片仍可预览但不能打开编辑', async () => {
    const raw = new File(['image'], 'cover.png', { type: 'image/png' }); const create = URL.createObjectURL; URL.createObjectURL = () => 'blob:image';
    const view = assetMount({ asset: { path: 'cover.png', role: 'cover' }, pendingFile: { id: 'p2', raw, path: 'cover.png', role: 'cover' }, readOnly: true }); await flushPromises();
    expect(view.get('img').attributes('src')).toBe('blob:image'); expect(view.text()).not.toContain('旋转 / 马赛克'); view.unmount(); URL.createObjectURL = create;
  });
  it('切换素材时不会显示过期异步加载结果', async () => {
    let first; let second; const loadAsset = (asset) => new Promise((resolve) => { if (asset.n === 1) first = resolve; else second = resolve; });
    const view = assetMount({ asset: { n: 1, path: 'first.txt', role: 'text' }, loadAsset }); await view.setProps({ asset: { n: 2, path: 'second.txt', role: 'text' } });
    first(new File(['旧内容'], 'first.txt')); await flushPromises(); expect(view.text()).toContain('正在加载文件'); second(new File(['新内容'], 'second.txt')); await flushPromises(); expect(view.get('textarea').element.value).toBe('新内容'); view.unmount();
  });
  it('素材切换后不会写入已开始读取的旧文本', async () => {
    let firstText; let secondText; let calls = 0;
    const loadAsset = () => ++calls === 1
      ? { name: 'first.txt', type: 'text/plain', text: () => new Promise(resolve => { firstText = resolve; }) }
      : { name: 'second.txt', type: 'text/plain', text: () => new Promise(resolve => { secondText = resolve; }) };
    const view = assetMount({ asset: { n: 1, path: 'first.txt', role: 'text' }, loadAsset }); await flushPromises();
    await view.setProps({ asset: { n: 2, path: 'second.txt', role: 'text' } }); firstText('旧内容'); await flushPromises();
    secondText('新内容'); await flushPromises(); expect(view.get('textarea').element.value).toBe('新内容'); view.unmount();
  });
});
