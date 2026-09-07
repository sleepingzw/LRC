<template>
  <section class="album-creation-card" aria-label="新建专辑内容选择">
    <header><strong>新建专辑</strong><p>先选择素材，再建立可编辑的专辑草稿。</p></header>
    <label>专辑名称<input v-model="album" aria-label="专辑名称" autofocus required></label>
    <label>投稿类型<select v-model="submissionType" aria-label="投稿类型"><option value="album">专辑</option><option value="single">单曲</option></select></label>
    <label class="album-creation-files">选择或拖入文件和文件夹<input ref="input" type="file" multiple webkitdirectory @change="collect($event.target.files)"><span @dragover.prevent @drop.prevent="collect($event.dataTransfer.files)">{{ files.length ? `已选择 ${files.length} 个文件` : '点击选择，或将素材拖到这里' }}</span></label>
    <footer><button type="button" @click="$emit('cancel')">取消</button><button class="primary" type="button" :disabled="!album.trim()" @click="$emit('create', { album: album.trim(), submissionType, files })">创建并打开素材</button></footer>
  </section>
</template>
<script setup>
import { ref } from 'vue';
defineEmits(['create', 'cancel']);
const album = ref(''); const submissionType = ref('album'); const files = ref([]);
function collect(list) { files.value = Array.from(list || []); }
</script>
