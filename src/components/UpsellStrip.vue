<script setup lang="ts">
const emit = defineEmits<{ (e:'pick', topic:string): void }>()
</script>

<template>
  <section class="upsell">
    <h3>Starter Pack under €200</h3>
    <p>Keyboard, mouse, USB-C hub, backpack — perfect for new students.</p>
    <div class="row">
      <button @click="emit('pick','headphones')">Noise-canceling headphones</button>
      <button @click="emit('pick','hubs')">USB-C hubs</button>
      <button @click="emit('pick','backpacks')">Backpacks</button>
      <button @click="emit('pick','monitors')">Budget monitors</button>
    </div>
  </section>
</template>

<style scoped>
.upsell{margin:24px 0;padding:16px;border:1px solid #2a2a2a;background:#101010;border-radius:14px}
h3{margin:0 0 6px}
.row{display:flex;flex-wrap:wrap;gap:10px}
button{padding:10px 12px;border-radius:10px;border:1px solid #2a2a2a;background:#0b0b0b;color:#e5e7eb}
button:hover{background:#1f2937}
</style>
