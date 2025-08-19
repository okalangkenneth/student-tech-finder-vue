<script setup lang="ts">
import { ref } from 'vue'
const API_BASE = import.meta.env.PROD ? '' : (import.meta.env.VITE_API_BASE || 'http://localhost:4000')
const email = ref(''); const maxPrice = ref<number | null>(null)
const loading = ref(false); const msg = ref<string | null>(null)

async function subscribe() {
  msg.value = null; loading.value = true
  try {
    const r = await fetch(`${API_BASE}/api/subscribe`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: email.value, topic: 'laptop', max_price: maxPrice.value })
    })
    const data = await r.json()
    if (data.ok) { msg.value = 'You’re in! We’ll email picks and deals.'; email.value = '' }
    else msg.value = data.error || 'Something went wrong.'
  } catch { msg.value = 'Network error.' } finally { loading.value = false }
}
</script>

<template>
  <div class="capture">
    <h4>Get smarter picks in your inbox</h4>
    <p class="sub">1–2 emails per month. No spam. Unsubscribe anytime.</p>
    <form @submit.prevent="subscribe" class="row">
      <input type="email" v-model="email" required placeholder="you@example.com" />
      <input type="number" v-model.number="maxPrice" min="0" step="50" placeholder="Max price (€)" />
      <button :disabled="loading">{{ loading ? 'Joining…' : 'Notify me' }}</button>
    </form>
    <p v-if="msg" class="msg">{{ msg }}</p>
  </div>
</template>

<style scoped>
.capture { margin: 16px 0 24px; padding: 16px; border: 1px solid #2a2a2a; background: #101010; border-radius: 14px; }
h4 { margin: 0 0 4px; color: #e5e7eb; }
.sub { margin: 0 0 10px; color: #9ca3af; font-size: .9rem; }
.row { display: grid; grid-template-columns: 1.6fr 1fr auto; gap: 10px; }
input { background: #0b0b0b; border: 1px solid #2a2a2a; color: #e5e7eb; padding: 10px 12px; border-radius: 10px; }
button { padding: 10px 14px; border: none; border-radius: 10px; background: #3b82f6; color: #fff; font-weight: 700; }
button[disabled]{ opacity:.6; cursor:not-allowed; }
.msg { margin: 8px 0 0; color: #a7f3d0; }
@media (max-width: 700px){ .row{ grid-template-columns: 1fr; } }
</style>
