<script setup lang="ts">
import { computed, ref } from 'vue'

type Product = {
  id: string; title: string; brand: string;
  price: { currency: string; amount: number };
  image: string; url: string;
  specs?: { screen?: string; os?: string; weightKg?: number };
  why?: string[];
}

const props = withDefaults(defineProps<{
  product: Product
  index: number
  queryUsed: string
  apiBase: string
  showCompareToggle?: boolean
  selectedForCompare?: boolean
}>(), {
  apiBase: '',
  showCompareToggle: false,
  selectedForCompare: false
})

const emit = defineEmits<{
  (e: 'watch', product: Product): void
  (e: 'toggle-compare', id: string): void
}>()

const imgSrc = ref(props.product.image || 'https://via.placeholder.com/640x360?text=No+Image')
function onImgError(e: Event) {
  const target = e.target as HTMLImageElement | null
  if (target) target.src = 'https://via.placeholder.com/640x360?text=No+Image'
}

const priceText = computed(() => {
  const currency = props.product.price?.currency ?? 'USD'
  const amount = props.product.price?.amount ?? 0
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(2)}`
  }
})

const buyHref = computed(() =>
  `${props.apiBase}/api/go/${props.product.id}?url=${encodeURIComponent(props.product.url)}&rank=${props.index + 1}&query=${encodeURIComponent(props.queryUsed)}`
)

function watchClick() {
  emit('watch', props.product)
}
function toggleCompare() {
  emit('toggle-compare', props.product.id)
}
</script>

<template>
  <article class="card">
    <button v-if="showCompareToggle" class="pick" :aria-pressed="selectedForCompare" @click.stop="toggleCompare" title="Select for compare">
      <span v-if="selectedForCompare">✓</span><span v-else>＋</span><small>Compare</small>
    </button>

    <div class="thumb">
      <img :src="imgSrc" alt="" loading="lazy" @error="onImgError" />
    </div>

    <div class="body">
      <div class="brand-line"><span class="brand">{{ product.brand || '—' }}</span></div>
      <h3 class="title" :title="product.title">{{ product.title }}</h3>

      <div class="price-row"><span class="price">{{ priceText }}</span></div>

      <ul class="chips">
        <li v-if="product.specs?.os">{{ product.specs?.os }}</li>
        <li v-if="product.specs?.screen">{{ product.specs?.screen }}″</li>
        <li v-if="product.specs?.weightKg">{{ product.specs?.weightKg }} kg</li>
      </ul>

      <div class="cta-row">
        <a :href="buyHref" target="_blank" rel="nofollow sponsored" class="btn-buy">Buy</a>
        <button class="btn-watch" @click.prevent="watchClick">Watch price</button>
      </div>

      <p class="tiny">We may earn a commission on qualifying purchases.</p>
    </div>
  </article>
</template>

<style scoped>
.card {
  position: relative;
  display: grid; grid-template-rows: auto 1fr; gap: 12px;
  background: #121212; border: 1px solid #2a2a2a; border-radius: 16px;
  overflow: hidden; transition: transform .15s ease, box-shadow .15s ease, border-color .15s ease;
}
.card:hover { transform: translateY(-2px); box-shadow: 0 10px 24px rgba(0,0,0,.35); border-color:#3a3a3a; }

.pick { position:absolute; top:10px; left:10px; display:flex; gap:6px; align-items:center;
  padding:6px 10px; border-radius:999px; border:1px solid #2a2a2a; background:#0b0b0b; color:#d1d5db; font-size:.8rem; z-index:2; }
.pick[aria-pressed="true"]{ background:#1f2937; color:#fff; border-color:#3b4252; }

.thumb {
  aspect-ratio: 16/9; background:#0b0b0b;
  display:flex; align-items:center; justify-content:center; padding:8px; /* letterbox space */
}
.thumb img { width: 100%; height: 100%; object-fit: contain; background:#0d0d0d; }

.body { padding:14px; display:grid; gap:10px; }
.brand-line .brand { font-size:.85rem; color:#9aa3af; letter-spacing:.02em; }
.title {
  font-size:1.05rem; line-height:1.25; margin:0; color:#eee;
  /* multi-line truncation */
  display:-webkit-box;
  -webkit-box-orient:vertical;
  -webkit-line-clamp:2;
  /* standard property for newer browsers */
  line-clamp: 2;
  overflow:hidden;
}
.price-row { display:flex; align-items:baseline; gap:8px; }
.price { font-weight:700; color:#f3f4f6; }
.chips { list-style:none; display:flex; flex-wrap:wrap; gap:8px; padding:0; margin:0; }
.chips li { font-size:.75rem; background:#1b1b1b; border:1px solid #2c2c2c; padding:4px 8px; border-radius:999px; color:#cbd5e1; }

.cta-row { display:flex; gap:8px; align-items:center; }
.btn-buy { display:inline-flex; align-items:center; justify-content:center; padding:10px 14px; border-radius:10px; background:#22c55e; color:#0c0c0c; font-weight:700; text-decoration:none; }
.btn-buy:hover{ filter:brightness(1.05); }
.btn-watch { padding:10px 12px; border-radius:10px; border:1px solid #2a2a2a; background:#0ea5e9; color:#0b0b0b; font-weight:700; }
.btn-watch:hover{ filter:brightness(1.05); }

.tiny { margin:0; color:#8b949e; font-size:.72rem; }
</style>
