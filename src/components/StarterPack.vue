<script setup lang="ts">
// filepath: e:\Projects\student-tech-finder-vue\src\components\StarterPack.vue
import { onMounted, ref } from 'vue'

type Product = { 
  id: string; 
  title: string; 
  brand: string; 
  price: { currency: string; amount: number }; 
  image: string; 
  url: string 
}

const props = defineProps<{ apiBase: string }>()
const items = ref<Product[]>([])
const total = ref(0)

async function pick(topic: string, maxPrice: number): Promise<Product | null> {
  try {
    const r = await fetch(`${props.apiBase}/api/search`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ topic, page: 0, pageSize: 1, minPrice: 0, maxPrice, broaden: true })
    })
    const d = await r.json()
    return d?.results?.[0] || null
  } catch (error) {
    console.error(`Error fetching ${topic}:`, error)
    return null
  }
}

onMounted(async () => {
  const [headphones, hub, backpack, keyboard] = await Promise.all([
    pick('headphones', 60),
    pick('hubs', 40),
    pick('backpacks', 60),
    pick('keyboards', 40)
  ])
  items.value = [headphones, hub, backpack, keyboard].filter((item): item is Product => item !== null)
  total.value = items.value.reduce((s, p) => s + (p.price.amount || 0), 0)
})
</script>