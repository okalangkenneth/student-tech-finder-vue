<script setup lang="ts">
const props = defineProps<{ open: boolean; items: any[] }>()
const emit = defineEmits(['close'])
</script>

<template>
  <div v-if="open" class="overlay" @click.self="emit('close')">
    <div class="panel">
      <header>
        <h3>Compare</h3>
        <button @click="emit('close')">✕</button>
      </header>
      <div class="table">
        <div class="row head">
          <div>Spec</div>
          <div v-for="p in items" :key="p.id">{{ p.title }}</div>
        </div>
        <div class="row"><div>Brand</div><div v-for="p in items">{{ p.brand }}</div></div>
        <div class="row"><div>Price</div><div v-for="p in items">{{ p.price?.currency }} {{ p.price?.amount }}</div></div>
        <div class="row"><div>OS</div><div v-for="p in items">{{ p.specs?.os }}</div></div>
        <div class="row"><div>Screen</div><div v-for="p in items">{{ p.specs?.screen }}</div></div>
        <div class="row"><div>Why we like it</div>
          <div v-for="p in items">
            <ul><li v-for="(w,i) in (p.why||[])" :key="i">{{ w }}</li></ul>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay{position:fixed;inset:0;background:rgba(0,0,0,.6);display:grid;place-items:center;z-index:50;}
.panel{width:min(1000px,96vw);max-height:92vh;overflow:auto;background:#0f1115;border:1px solid #2a2f3a;border-radius:14px;padding:14px;}
header{display:flex;justify-content:space-between;align-items:center;}
.table{display:grid;gap:8px;margin-top:8px}
.row{display:grid;grid-template-columns:200px repeat(auto-fit,minmax(180px,1fr));gap:8px;align-items:start}
.head{font-weight:700}
button{background:#1f2937;color:#e5e7eb;border:1px solid #374151;border-radius:8px;padding:6px 10px}
</style>
