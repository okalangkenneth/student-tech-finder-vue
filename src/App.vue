<script setup lang="ts">
import UpsellStrip from './components/UpsellStrip.vue'
import { ref, computed } from 'vue'
import ProductCard from './components/ProductCard.vue'
import EmailCapture from './components/EmailCapture.vue'
import CompareModal from './components/CompareModal.vue'

type Product = {
  id:string; title:string; brand:string;
  price:{ currency:string; amount:number };
  image:string; url:string;
  specs?:{ screen?:string; os?:string; weightKg?:number };
  why?:string[];
}

const topic = ref<'laptop'|'headphones'|'hubs'|'backpacks'|'monitors'>('laptop')
const budget = ref('€500–€900')
const screen = ref('14')
const os = ref('Windows')
const loading = ref(false)
const queryUsed = ref('')
const items = ref<Product[]>([])
const page = ref(0)
const pageSize = ref(12)
const total = ref(0)
const brandsAvailable = ref<string[]>([])
const selectedBrands = ref<string[]>([])
const sortBy = ref<'price-asc'|'price-desc'>('price-asc')
const compareIds = ref<Set<string>>(new Set())
const compareOpen = ref(false)
const minPrice = ref<number | null>(null)
const maxPrice = ref<number | null>(null)
const broaden  = ref(false)


const API_BASE = import.meta.env.PROD ? '' : (import.meta.env.VITE_API_BASE || 'http://localhost:4000')

function resetAndSearch(){ items.value=[]; page.value=0; doSearch(true) }

async function doSearch(reset=false){
  loading.value = true
  try {
    const r = await fetch(`${API_BASE}/api/search`, {
      method:'POST', headers:{'content-type':'application/json'},
      body: JSON.stringify({
        topic: topic.value,
        budget: budget.value, screen: screen.value, os: os.value,
        brands: selectedBrands.value,
        page: page.value, pageSize: pageSize.value
        minPrice: minPrice.value,     
        maxPrice: maxPrice.value,
        broaden: broaden.value
      })
    })
    const data = await r.json()
    if (data.ok){
      queryUsed.value = data.query || ''
      total.value = data.total || 0
      brandsAvailable.value = data.brands || []
      const newOnes = (data.results || []) as Product[]
      // de-dup by id when appending
      const existing = new Set(items.value.map(p=>p.id))
      const merged = reset ? newOnes : [...items.value, ...newOnes.filter(p=>!existing.has(p.id))]
      items.value = merged
    } else alert(data.error || 'Search failed')
  } finally { loading.value=false }
}

// inside <script setup>
async function watchPrice(p:any){
  const email = prompt('Your email for price alerts?')
  if (!email) return
  await fetch(`${API_BASE}/api/watch/add`, {
    method:'POST',
    headers:{'content-type':'application/json'},
    body: JSON.stringify({
      email,
      product_id: p.id,
      threshold: p?.price?.amount ?? null,
      last_price: p?.price?.amount ?? null
    })
  })
  alert('Watching! We’ll email you if the price drops.')
}

function loadMore(){
  if ((page.value+1)*pageSize.value >= total.value) return
  page.value += 1
  doSearch(false)
}

const sortedFiltered = computed(()=>{
  let list = [...items.value]
  if (selectedBrands.value.length) list = list.filter(p=>selectedBrands.value.includes(p.brand))
  if (sortBy.value==='price-asc')  list.sort((a,b)=>(a.price?.amount??0)-(b.price?.amount??0))
  if (sortBy.value==='price-desc') list.sort((a,b)=>(b.price?.amount??0)-(a.price?.amount??0))
  return list
})

function toggleCompare(id:string){
  const s = new Set(compareIds.value)
  s.has(id) ? s.delete(id) : s.add(id)
  compareIds.value = s
}
const compareItems = computed(()=> sortedFiltered.value.filter(p=>compareIds.value.has(p.id)))
</script>


<template>
  <main class="wrap">
    <nav class="tabs">
      <button :class="{active:topic==='laptop'}" @click="topic='laptop'; resetAndSearch()">Laptops</button>
      <button :class="{active:topic==='headphones'}" @click="topic='headphones'; resetAndSearch()">Headphones</button>
      <button :class="{active:topic==='hubs'}" @click="topic='hubs'; resetAndSearch()">USB-C Hubs</button>
      <button :class="{active:topic==='backpacks'}" @click="topic='backpacks'; resetAndSearch()">Backpacks</button>
      <button :class="{active:topic==='monitors'}" @click="topic='monitors'; resetAndSearch()">Budget Monitors</button>
    </nav>

    <!-- existing title/controls ... -->
    <!-- Add brand filter chips -->
    <div v-if="brandsAvailable.length" class="brand-filter">
      <span>Brands:</span>
      <label v-for="b in brandsAvailable" :key="b" class="chip">
        <input type="checkbox" :value="b" v-model="selectedBrands" @change="resetAndSearch" />
        <span>{{ b }}</span>
      </label>
    </div>

    <!-- Price range + broaden toggle -->
    <div class="filters">
      <label class="field">
        <span>Min (€)</span>
        <input
          type="number"
          min="0"
          step="10"
          v-model.number="minPrice"
          placeholder="0"
          inputmode="numeric"
        />
      </label>

      <label class="field">
        <span>Max (€)</span>
        <input
          type="number"
          min="0"
          step="10"
          v-model.number="maxPrice"
          placeholder="900"
          inputmode="numeric"
        />
      </label>

      <label class="switch" title="Loosen specs to see more results">
        <input type="checkbox" v-model="broaden" />
        <span>Broaden search</span>
      </label>

      <button class="btn primary" @click="resetAndSearch" :disabled="loading">
        Find laptops
      </button>
    </div>





    <EmailCapture />

    <div class="toolbar" v-if="sortedFiltered.length || loading">
      <div class="compare-info">
        <span>{{ compareIds.size }} selected</span>
        <button v-if="compareIds.size>=2" @click="compareOpen=true">Compare</button>
      </div>
      <label class="sorter">
        <span>Sort</span>
        <select v-model="sortBy">
          <option value="price-asc">Price ↑</option>
          <option value="price-desc">Price ↓</option>
        </select>
      </label>
    </div>

    <!-- Grid -->
    <div v-if="loading" class="grid"><div v-for="n in 12" :key="n" class="skeleton"/></div>
    <div v-else class="grid">
      <div v-for="(p,i) in sortedFiltered" :key="p.id" class="with-select">
        <label class="pick">
          <input type="checkbox" :checked="compareIds.has(p.id)" @change="toggleCompare(p.id)" />
          <span>Select</span>
        </label>
        <ProductCard v-for="(p,i) in sortedFiltered" :key="p.id" :product="p" :index="i" :queryUsed="queryUsed" :apiBase="API_BASE" @watch="watchPrice" />

      </div>
    </div>

    <div class="load-more" v-if="(page+1)*pageSize < total">
      <button class="btn" @click="loadMore" :disabled="loading">Load more</button>
      <p class="tiny">{{ Math.min((page+1)*pageSize, total) }} / {{ total }}</p>
    </div>

    <CompareModal :open="compareOpen" :items="compareItems" @close="compareOpen=false"/>
  </main>
  <UpsellStrip @pick="(t)=>{ topic = t as any; resetAndSearch(); }" />
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

.tabs{display:flex;gap:8px;justify-content:center;margin:8px 0 18px}
.tabs button{padding:8px 12px;border-radius:10px;border:1px solid #2a2a2a;background:#0b0b0b;color:#cbd5e1}
.tabs .active{background:#1f2937;color:#fff}

.brand-filter{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:10px 0}
.chip{display:inline-flex;gap:6px;align-items:center;background:#0b0b0b;border:1px solid #2a2a2a;padding:6px 10px;border-radius:999px}
.pick{position:absolute;top:10px;left:10px;display:flex;gap:6px;align-items:center;background:#0b0b0b;border:1px solid #2a2a2a;border-radius:999px;padding:4px 8px;font-size:.8rem}
.with-select{position:relative}

.load-more{display:grid;place-items:center;margin:16px 0 40px}

/* controls row */
.filters{
  display:flex; flex-wrap:wrap; gap:10px;
  align-items:flex-end; justify-content:center;
  margin:10px 0 16px;
}

.field{ display:grid; gap:6px; }
.field span{ font-size:.8rem; color:#9aa3af; }
.field input{
  width:140px;
  background:#0b0b0b; color:#e5e7eb;
  border:1px solid #2a2a2a; border-radius:10px;
  padding:8px 10px; outline:none;
}
.field input:focus{ border-color:#3b82f6; }

.switch{ display:flex; align-items:center; gap:8px; padding:8px 12px;
  border:1px solid #2a2a2a; border-radius:999px; background:#0b0b0b; color:#e5e7eb; }
.switch input{ accent-color:#3b82f6; }

.btn.primary{
  background:#22c55e; color:#0c0c0c; border:none;
  padding:10px 14px; border-radius:10px; font-weight:700;
}
.btn.primary:disabled{ opacity:.6; cursor:not-allowed; }


</style>

