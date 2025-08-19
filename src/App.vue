<script setup lang="ts">
import { ref, computed } from 'vue'
import ProductCard from './components/ProductCard.vue'
import EmailCapture from './components/EmailCapture.vue'

type Product = {
  id: string; title: string; brand: string;
  price: { currency: string; amount: number };
  image: string; url: string;
  specs?: { screen?: string; os?: string; weightKg?: number };
  why?: string[];
}

const budget = ref('€500–€900')
const screen = ref('14')
const os = ref('Windows')
const loading = ref(false)
const queryUsed = ref('')
const items = ref<Product[]>([])
const sortBy = ref<'price-asc'|'price-desc'>('price-asc')

// Same-origin in prod (Vercel), local API in dev
const API_BASE = import.meta.env.PROD ? '' : (import.meta.env.VITE_API_BASE || 'http://localhost:4000')

async function search() {
  loading.value = true; items.value = []
  try {
    const r = await fetch(`${API_BASE}/api/search`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ budget: budget.value, screen: screen.value, os: os.value }),
    })
    const data = await r.json()
    if (data.ok) { items.value = data.results || []; queryUsed.value = data.query || '' }
    else alert(data.error || 'Search failed')
  } finally { loading.value = false }
}

const sortedItems = computed(() => {
  const list = [...items.value]
  if (sortBy.value === 'price-asc') list.sort((a,b)=>(a.price?.amount??0)-(b.price?.amount??0))
  if (sortBy.value === 'price-desc') list.sort((a,b)=>(b.price?.amount??0)-(a.price?.amount??0))
  return list
})
</script>

<template>
  <main class="wrap">
    <h1>Student Tech Finder</h1>
    <p class="tag">Answer 3 quick questions. <em>We may earn from qualifying purchases.</em></p>

    <div class="controls">
      <label>
        <span>Budget</span>
        <select v-model="budget">
          <option>Under €500</option>
          <option>€500–€900</option>
          <option>€900–€1400</option>
          <option>Any</option>
        </select>
      </label>

      <label>
        <span>Screen size</span>
        <select v-model="screen">
          <option>13</option><option>14</option><option>15</option><option>16</option><option>17</option>
          <option>Any</option>
        </select>
      </label>

      <label>
        <span>OS</span>
        <select v-model="os">
          <option>Windows</option><option>macOS</option><option>ChromeOS</option><option>Any OS</option>
        </select>
      </label>

      <button class="btn" @click="search" :disabled="loading">{{ loading ? 'Searching…' : 'Find laptops' }}</button>
    </div>

    <EmailCapture />

    <div class="query" v-if="queryUsed">Query used: <code>{{ queryUsed }}</code></div>

    <div class="toolbar" v-if="items.length || loading">
      <div/>
      <label class="sorter">
        <span>Sort</span>
        <select v-model="sortBy">
          <option value="price-asc">Price ↑</option>
          <option value="price-desc">Price ↓</option>
        </select>
      </label>
    </div>

    <!-- Skeletons -->
    <div v-if="loading" class="grid">
      <div v-for="n in 6" :key="n" class="skeleton"></div>
    </div>

    <!-- Results -->
    <div v-else class="grid">
      <ProductCard
        v-for="(p, i) in sortedItems" :key="p.id"
        :product="p" :index="i" :queryUsed="queryUsed" :apiBase="API_BASE" />
    </div>
  </main>
</template>

<style scoped>
.wrap { max-width: 1100px; margin: 24px auto 80px; padding: 0 16px; color: #e5e7eb; }
h1 { text-align: center; margin: 10px 0 6px; }
.tag { text-align: center; color: #9ca3af; margin: 0 0 18px; }
.controls { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 12px; align-items: end; }
label { display: grid; gap: 6px; font-size: .9rem; color: #cbd5e1; }
select { background:#0b0b0b; color:#e5e7eb; border:1px solid #2a2a2a; border-radius:10px; padding:8px 10px; }
.btn { padding: 10px 14px; border-radius: 10px; background:#22c55e; font-weight:700; border:none; }
.btn[disabled]{ opacity:.6; cursor:not-allowed; }
.toolbar { display:flex; justify-content: space-between; align-items:center; margin: 10px 2px; }
.sorter { display:flex; align-items:center; gap: 8px; }
.grid { margin-top: 12px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
@media (max-width: 1000px){ .grid{ grid-template-columns: repeat(2,1fr); } .controls{ grid-template-columns: 1fr 1fr; } }
@media (max-width: 640px){ .grid{ grid-template-columns: 1fr; } .controls{ grid-template-columns: 1fr; } }

.skeleton { height: 300px; border-radius: 16px; background:
  linear-gradient(90deg, #151515 25%, #1d1d1d 37%, #151515 63%);
  background-size: 400% 100%; animation: shimmer 1.1s infinite linear;
  border: 1px solid #2a2a2a;
}
@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
.query { color:#9aa3af; margin: 6px 0 0; font-size:.9rem; }
code { background:#0b0b0b; border:1px solid #2a2a2a; padding: 2px 6px; border-radius: 6px; }
</style>

