<script setup lang="ts">
import { computed } from 'vue'

type Product = {
  id: string; title: string; brand: string;
  price: { currency: string; amount: number };
  image: string; url: string;
  specs?: { screen?: string; os?: string; weightKg?: number };
  why?: string[];
}

const props = defineProps<{
  product: Product
  index: number
  queryUsed: string
  apiBase: string
}>()

const imgSrc = computed(() =>
  props.product.image || 'https://via.placeholder.com/640x360?text=No+Image')

const priceText = computed(() => {
  const c = props.product.price?.currency || 'USD'
  const n = props.product.price?.amount ?? 0
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: c }).format(n)
  } catch { return `${c} ${n.toFixed(2)}` }
})

const buyHref = computed(() =>
  `${props.apiBase}/api/go/${props.product.id}?url=${encodeURIComponent(props.product.url)}&rank=${props.index+1}&query=${encodeURIComponent(props.queryUsed)}`)
</script>

<template>
  <article class="card">
    <div class="thumb">
      <img :src="imgSrc" alt="" loading="lazy" />
    </div>

    <div class="body">
      <div class="brand-line">
        <span class="brand">{{ product.brand || '—' }}</span>
      </div>

      <h3 class="title" :title="product.title">{{ product.title }}</h3>

      <div class="price-row">
        <span class="price">{{ priceText }}</span>
      </div>

      <ul class="chips">
        <li v-if="product.specs?.os">{{ product.specs?.os }}</li>
        <li v-if="product.specs?.screen">{{ product.specs?.screen }}″</li>
        <li v-if="product.specs?.weightKg">{{ product.specs?.weightKg }} kg</li>
      </ul>

      <ul v-if="product.why?.length" class="why">
        <li v-for="(w, i) in product.why" :key="i">• {{ w }}</li>
      </ul>

      <a :href="buyHref" target="_blank" rel="nofollow sponsored" class="btn-buy">Buy</a>
      <p class="tiny">We may earn a commission on qualifying purchases.</p>
    </div>
  </article>
</template>

<style scoped>
.card {
  display: grid; grid-template-rows: auto 1fr; gap: 12px;
  background: #121212; border: 1px solid #2a2a2a; border-radius: 16px;
  overflow: hidden; transition: transform .15s ease, box-shadow .15s ease;
}
.card:hover { transform: translateY(-2px); box-shadow: 0 10px 24px rgba(0,0,0,.35); }
.thumb { aspect-ratio: 16/9; background: #0d0d0d; display: flex; align-items: center; justify-content: center; }
.thumb img { width: 100%; height: 100%; object-fit: cover; }
.body { padding: 14px; display: grid; gap: 10px; }
.brand-line .brand { font-size: .85rem; color: #9aa3af; letter-spacing: .02em; }
.title { font-size: 1.05rem; line-height: 1.25; margin: 0; color: #eee; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.price-row { display: flex; align-items: baseline; gap: 8px; }
.price { font-weight: 700; color: #f3f4f6; }
.chips { list-style: none; display: flex; flex-wrap: wrap; gap: 8px; padding: 0; margin: 0; }
.chips li { font-size: .75rem; background: #1b1b1b; border: 1px solid #2c2c2c; padding: 4px 8px; border-radius: 999px; color: #cbd5e1; }
.why { padding-left: 16px; margin: 0; color: #c9d1d9; font-size: .85rem; }
.btn-buy {
  display: inline-flex; align-items: center; justify-content: center;
  padding: 10px 14px; border-radius: 10px; background: #22c55e;
  color: #0c0c0c; font-weight: 700; text-decoration: none; margin-top: 4px;
}
.btn-buy:hover { filter: brightness(1.05); }
.tiny { margin: 0; color: #8b949e; font-size: .72rem; }
</style>
