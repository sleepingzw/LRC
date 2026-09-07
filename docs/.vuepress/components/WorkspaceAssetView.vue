<template>
  <section class="workspace-asset-view" :data-theme="theme" :aria-label="`素材 ${path}`">
    <header><div><p class="asset-kicker">具体文件</p><h2>{{ path }}</h2><p>{{ roleLabel }} · {{ formatSize(asset.size ?? pendingFile?.raw?.size) }}</p></div><span>{{ pendingFile ? '待保存' : '已上传' }}</span></header>
    <p v-if="error" role="alert">{{ error }}</p><p v-else-if="loading" role="status">正在加载文件…</p>
    <template v-else-if="file">
      <section v-if="isText" class="asset-text"><MonacoLrcEditor :model-value="text" :language="language" :theme="theme" :read-only="locked" :aria-label="`编辑 ${path}`" @update:model-value="updateText" /><footer v-if="!locked"><button type="button" :disabled="busy" @click="applyText">应用文本修改</button></footer></section>
      <section v-else-if="isImage" class="asset-preview"><img :src="url" :alt="path"><button v-if="!locked" type="button" :disabled="busy" @click="imageEdit = true">旋转 / 马赛克</button></section>
      <section v-else-if="isAudio" class="asset-preview"><audio controls :src="url">当前浏览器不能播放此音频。</audio></section>
      <section v-else class="asset-preview"><p>此文件暂无内置预览，可下载后查看。</p><a :href="url" :download="filename">下载 {{ filename }}</a></section>
    </template>
    <ImageEditDialog v-if="imageEdit && file" :file="file" :theme="theme" @close="imageEdit = false" @save="applyImage" />
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import MonacoLrcEditor from './MonacoLrcEditor.vue';
import ImageEditDialog from './ImageEditDialog.vue';
const props = defineProps({ asset:{ type:Object, required:true }, loadAsset:Function, theme:{type:String,default:'light'}, readOnly:Boolean, busy:Boolean, pendingFile:{type:Object,default:null} });
const emit = defineEmits(['replace', 'update-pending', 'buffer']);
const file=ref(null); const text=ref(''); const appliedText=ref(''); const url=ref(''); const loading=ref(false); const error=ref(''); const imageEdit=ref(false); let request=0;
const pendingRaw=computed(()=>props.pendingFile?.raw || null); const path=computed(()=>String(props.pendingFile?.path || props.asset.path || props.asset.name || '未命名文件')); const filename=computed(()=>path.value.split('/').pop() || 'asset'); const locked=computed(()=>props.readOnly || props.busy); const roleLabel=computed(()=>({song:'原曲',photo:'图片',text:'文本',staff:'制作',cover:'封面',etc:'其他'})[props.asset.role || props.pendingFile?.role] || '其他'); const ext=computed(()=>path.value.split('.').pop()?.toLowerCase() || ''); const isText=computed(()=>['lrc','elrc','txt','md','json'].includes(ext.value)); const isImage=computed(()=>['png','jpg','jpeg','webp','gif','bmp','tiff'].includes(ext.value)); const isAudio=computed(()=>['mp3','flac','wav','m4a','aac','ogg','opus','wma','aiff'].includes(ext.value)); const language=computed(()=>ext.value === 'json' ? 'json' : ext.value === 'md' ? 'markdown' : 'lrc');
const formatSize=(value)=>{ const size=Number(value)||0; return size >= 1024*1024 ? `${(size/1024/1024).toFixed(1)} MB` : `${Math.ceil(size/1024)} KB`; };
function clearUrl(){ if(url.value) URL.revokeObjectURL(url.value); url.value=''; }
async function load(){ const version=++request; imageEdit.value=false; error.value=''; loading.value=true; clearUrl(); file.value=null; text.value=''; appliedText.value=''; try { const next=pendingRaw.value || await props.loadAsset?.(props.asset); if(!next) throw new Error('文件不可用'); if(version !== request) return; file.value=next; if(isText.value) { const nextText=await next.text(); if(version !== request) return; text.value=nextText; appliedText.value=nextText; } else url.value=URL.createObjectURL(next); } catch (reason) { if(version === request) error.value=`加载失败：${reason.message || '无法读取文件'}`; } finally { if(version === request) loading.value=false; } }
function updatePending(next){ emit('update-pending', { ...props.pendingFile, raw:next, name:path.value, path:path.value, size:next.size }); }
function updateText(value){ if(locked.value) return; text.value=value; if(value!==appliedText.value) emit('buffer'); }
function applyText(){ if(!file.value || locked.value || text.value===appliedText.value) return false; const next=new File([text.value], filename.value,{type:file.value.type || 'text/plain'}); if(props.pendingFile) updatePending(next); else emit('replace',{asset:props.asset,file:next,path:path.value}); file.value=next; appliedText.value=text.value; return true; }
function flush(){ return applyText(); }
function applyImage(next){ if(locked.value) return; imageEdit.value=false; if(props.pendingFile) updatePending(next); else emit('replace',{asset:props.asset,file:next,path:path.value}); file.value=next; clearUrl(); url.value=URL.createObjectURL(next); }
defineExpose({ flush });
watch(()=>[props.asset,props.pendingFile],load,{immediate:true,deep:false}); onBeforeUnmount(()=>{ request+=1; clearUrl(); });
</script>

<style scoped>
.workspace-asset-view{padding:1.25rem;min-width:0}.workspace-asset-view header{display:flex;justify-content:space-between;gap:1rem;align-items:start;border-bottom:1px solid var(--border-color,#d0d7de);padding-bottom:1rem;margin-bottom:1rem}.workspace-asset-view h2{margin:.15rem 0;font-size:1rem;overflow-wrap:anywhere}.workspace-asset-view p{margin:.25rem 0;opacity:.72;font-size:.85rem}.asset-kicker{font-size:.72rem!important;letter-spacing:.08em}.asset-text footer{padding-top:.7rem}.asset-preview{display:grid;gap:.8rem;justify-items:start}.asset-preview img{max-width:100%;max-height:65vh;object-fit:contain;border:1px solid var(--border-color,#d0d7de)}audio{width:min(100%,42rem)}button,a{font:inherit;color:inherit;border:1px solid var(--border-color,#d0d7de);border-radius:4px;background:transparent;padding:.42rem .65rem;text-decoration:none;cursor:pointer}button:disabled{opacity:.5;cursor:default}[role='alert']{color:#d73a49}
</style>
