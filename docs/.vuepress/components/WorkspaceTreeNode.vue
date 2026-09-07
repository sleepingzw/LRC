<template>
  <div class="workspace-node">
    <div class="workspace-node-row">
      <button type="button" :class="{ selected: node.id === selectedId }" :aria-expanded="isFolder || hasChildren ? open : undefined" @click="activate"><span aria-hidden="true">{{ isFolder || hasChildren ? (open ? '⌄' : '›') : node.view === 'text:json' ? '{}' : node.view === 'assets' ? '▧' : '≡' }}</span><span class="workspace-tree-label">{{ node.label }}</span></button>
      <span v-if="node.resource?.kind === 'track'" class="workspace-node-actions"><button type="button" title="聚合调轴" :aria-label="`聚合调轴 ${node.label}`" @click="$emit('open', { ...node, view: 'timing' })">⌁</button></span>
      <span v-if="editable && isFolder" class="workspace-node-actions"><label :aria-label="`在 ${path} 上传素材`" title="上传素材" class="workspace-upload-action">↑<input type="file" multiple @change="upload"></label><button type="button" :aria-label="`在 ${path} 新建文件`" @click="$emit('start-create', { kind: 'file', parentPath: path })">+</button><button type="button" :aria-label="`在 ${path} 新建文件夹`" @click="$emit('start-create', { kind: 'folder', parentPath: path })">□</button></span>
    </div>
    <form v-if="creating?.parentPath === path" class="workspace-tree-create" @submit.prevent="$emit('submit-create')"><input ref="input" v-model="creating.name" :aria-label="creating.kind === 'folder' ? '新建文件夹名称' : '新建文件名称'" :disabled="busy" @keydown.esc.prevent="$emit('cancel-create')"><button type="submit" :disabled="busy || !creating.name.trim()">创建</button><p v-if="creating.error" role="alert">{{ creating.error }}</p></form>
    <div v-if="(isFolder || hasChildren) && open" class="workspace-children"><WorkspaceTreeNode v-for="child in node.children || []" :key="child.id" :node="child" :selected-id="selectedId" :editable="editable" :creating="creating" :busy="busy" @open="$emit('open', $event)" @start-create="$emit('start-create', $event)" @submit-create="$emit('submit-create')" @cancel-create="$emit('cancel-create')" @upload="$emit('upload', $event)" /></div>
  </div>
</template>
<script setup>
import { computed, nextTick, ref, watch } from 'vue';
defineOptions({ name: 'WorkspaceTreeNode' });
const props = defineProps({ node: { type: Object, required: true }, selectedId: String, editable: Boolean, creating: Object, busy: Boolean });
const open = ref(true); const input = ref(null); const isFolder = computed(() => props.node.type === 'folder'); const hasChildren = computed(() => (props.node.children || []).length > 0); const path = computed(() => props.node.path || props.node.label);
function activate() { if (isFolder.value || hasChildren.value) open.value = !open.value; else emit('open', props.node); }
const emit = defineEmits(['open', 'start-create', 'submit-create', 'cancel-create', 'upload']);
function upload(event) { const files = Array.from(event.target.files || []); event.target.value = ''; if (files.length) emit('upload', { files, parentPath: path.value }); }
watch(() => props.creating?.parentPath === path.value, async active => { if (active) { await nextTick(); input.value?.focus(); } });
</script>
