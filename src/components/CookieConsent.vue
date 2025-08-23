<script setup lang="ts">
import { ref, onMounted } from 'vue'
const open = ref(false)
onMounted(() => { open.value = !localStorage.getItem('stf_consent') })
function accept() {
  localStorage.setItem('stf_consent','1')
  open.value = false
}
</script>

<template>
  <div v-if="open" class="cc">
    <p>We use first-party cookies/local storage to remember filters and improve your experience. No ad trackers.</p>
    <button @click="accept">OK</button>
  </div>
</template>

<style scoped>
.cc{position:fixed;bottom:16px;left:16px;right:16px;max-width:680px;margin:0 auto;
  background:#0b0b0b;border:1px solid #2a2a2a;color:#e5e7eb;padding:12px 14px;border-radius:12px;
  display:flex;gap:12px;align-items:center;justify-content:space-between;z-index:50}
.cc button{background:#22c55e;border:none;color:#0c0c0c;font-weight:700;border-radius:8px;padding:8px 12px}
</style>
