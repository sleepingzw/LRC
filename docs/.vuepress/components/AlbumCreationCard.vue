<template>
  <section class="album-creation-card" :data-theme="theme" aria-label="新建专辑内容选择">
    <header><p>新建专辑</p><h2>准备素材与提交信息</h2><span>文件、目录和拍照素材会在创建后保留用途与关联。</span></header>
    <div class="album-creation-meta"><label>专辑名称<input :value="model.album" aria-label="专辑名称" autofocus :disabled="busy" @input="patch({ album: $event.target.value })"></label><label>投稿类型<select :value="model.submissionType" aria-label="投稿类型" :disabled="busy" @change="patch({ submissionType: $event.target.value })"><option value="album">专辑</option><option value="single">单曲</option></select></label></div>
    <AlbumAssetsView :assets="[]" :pending-files="model.pendingFiles" :tracks="[]" :uploading="busy" :theme="theme" @import="emit('import', $event)" @update-pending="patch({ pendingFiles: $event })" />
    <footer><button type="button" :disabled="busy" @click="emit('cancel')">取消</button><button class="primary" type="button" :disabled="busy || !model.album.trim()" @click="emit('create')">创建并上传</button></footer>
  </section>
</template>
<script setup>
import AlbumAssetsView from './AlbumAssetsView.vue';
const props = defineProps({ model: { type: Object, required: true }, busy: Boolean, theme: String }); const emit = defineEmits(['update:model', 'import', 'cancel', 'create']); function patch(value) { emit('update:model', { ...props.model, ...value }); }
</script>
<style scoped>
.album-creation-card{height:100%;min-height:0;overflow:auto;padding:clamp(1rem,3vw,2rem);background:var(--workspace-surface,var(--bg-color,#fff));box-sizing:border-box}.album-creation-card>header{max-width:48rem;margin:0 auto 1.25rem}.album-creation-card h2{margin:.2rem 0;font-size:1.3rem}.album-creation-card header p{margin:0;color:var(--theme-color,#3a7afe);font-size:.78rem;font-weight:700;letter-spacing:.08em}.album-creation-card header span{display:block;margin-top:.45rem;opacity:.7;font-size:.88rem}.album-creation-meta{max-width:48rem;margin:0 auto;display:grid;grid-template-columns:minmax(0,1fr) minmax(10rem,.42fr);gap:.8rem}.album-creation-meta label{display:grid;gap:.35rem;font-size:.82rem}.album-creation-meta input,.album-creation-meta select,button{font:inherit;color:inherit;border:1px solid var(--border-color,#d0d7de);border-radius:5px;background:transparent;padding:.5rem .65rem}button{cursor:pointer}.primary{color:#fff;background:var(--theme-color,#3a7afe);border-color:var(--theme-color,#3a7afe)}button:disabled{opacity:.5;cursor:default}.album-creation-card :deep(.album-assets){max-width:48rem;margin:0 auto}.album-creation-card>footer{max-width:48rem;margin:1rem auto 0;display:flex;justify-content:flex-end;gap:.6rem}@media(max-width:560px){.album-creation-meta{grid-template-columns:1fr}}
</style>
