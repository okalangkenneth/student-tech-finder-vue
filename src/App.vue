<template>
  <main style="min-height:100vh;background:#0a0a0a;color:#e5e5e5">
    <div style="max-width:960px;margin:0 auto;padding:32px 16px">
      <h1 style="font-size:28px;font-weight:600">Student Tech Finder</h1>
      <p style="opacity:.75">
        Answer 3 quick questions. <em style="opacity:.7">As an affiliate, we may earn from qualifying purchases.</em>
      </p>

      <div style="display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));margin-top:16px">
        <label><div>Budget</div>
          <select v-model="budget">
            <option>Under €500</option>
            <option>€500–€900</option>
            <option>€900–€1400</option>
            <option>Any</option>
          </select>
        </label>
        <label><div>Screen size</div>
          <select v-model="screen">
            <option>13</option><option>14</option><option>15</option><option>16</option><option>Any</option>
          </select>
        </label>
        <label><div>OS</div>
          <select v-model="os">
            <option>Windows</option><option>macOS</option><option>ChromeOS</option><option>Any OS</option>
          </select>
        </label>
      </div>

      <button :disabled="loading" @click="search" style="margin-top:16px;padding:10px 16px">
        {{ loading ? 'Searching…' : 'Find laptops' }}
      </button>

      <p v-if="queryUsed" style="font-size:12px;opacity:.6;margin-top:8px">Query used: {{ queryUsed }}</p>

      <section style="display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));margin-top:16px">
        <article v-for="(p,i) in items" :key="p.id" style="background:#121212;border-radius:12px;overflow:hidden">
          <img :src="p.image" :alt="p.title" style="width:100%;aspect-ratio:16/9;object-fit:cover" />
          <div style="padding:12px">
            <h3 style="font-size:18px">{{ p.title }}</h3>
            <div style="opacity:.7">{{ p.brand }} • {{ p.specs.screen }}" • {{ p.specs.os }}</div>
            <div style="margin-top:8px;font-size:20px">{{ p.price.currency }}{{ p.price.amount }}</div>
            <ul v-if="p.why?.length" style="margin-top:8px">
              <li v-for="(w,k) in p.why.slice(0,3)" :key="k">{{ w }}</li>
            </ul>
            <a
              :href="`/api/go/${p.id}?url=${encodeURIComponent(p.url)}&rank=${i+1}&query=${encodeURIComponent(queryUsed)}`"
              rel="nofollow sponsored"
              style="display:inline-block;margin-top:10px;padding:8px 12px;background:#22c55e;color:#000;border-radius:8px"
              target="_blank"
            >Buy</a>
          </div>
        </article>
      </section>
    </div>
  </main>
</template>

<script setup lang="ts">
import { ref } from 'vue'

type Product = {
  id: string
  title: string
  brand: string
  price: { currency: string; amount: number }
  image: string
  url: string
  specs: { screen: string; os: string; weightKg?: number }
  why?: string[]
}

const budget = ref('€500–€900')
const screen = ref('14')
const os = ref('Windows')
const loading = ref(false)
const items = ref<Product[]>([])
const queryUsed = ref('')

async function search() {
  loading.value = true
  items.value = []
  try {

      
      const r = await fetch('/api/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ budget: budget.value, screen: screen.value, os: os.value }),
    })
    const data = await r.json()
    if (data.ok) { items.value = data.results; queryUsed.value = data.query }
    else alert(data.error || 'Search failed')
  } finally {
    loading.value = false
  }
}
</script>
