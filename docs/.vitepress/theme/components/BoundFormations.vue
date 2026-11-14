<script setup lang="ts">
const rows = [
  ['React', 'Next.js', 'Vue', 'Nuxt', 'Express', 'Hono', 'Fastify', 'NestJS', 'Node.js 20+', 'Bun'],
  ['Prisma', 'Drizzle', 'Kysely', 'Mongoose', 'PostgreSQL', 'MySQL', 'SQLite', 'SQL Server', 'MongoDB', 'Memory'],
]
</script>

<template>
  <section class="bound" aria-label="Supported frameworks, runtimes and databases">
    <p class="label"><span class="pulse" />Formation bound to</p>
    <div v-for="(row, r) in rows" :key="r" class="lane" :class="{ reverse: r === 1 }">
      <ul class="belt">
        <li v-for="name in row" :key="name">{{ name }}</li>
      </ul>
      <!-- Duplicate for a seamless loop; hidden from assistive tech. -->
      <ul class="belt" aria-hidden="true">
        <li v-for="name in row" :key="name">{{ name }}</li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.bound {
  padding: 8px 0 40px;
  overflow: hidden;
  -webkit-mask-image: linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent);
  mask-image: linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent);
}
.label {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin: 0 0 14px;
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--vp-c-text-3);
}
.pulse {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--sect-jade);
  box-shadow: 0 0 0 0 var(--sect-jade-glow);
  animation: pulse 2s ease-out infinite;
}
.lane {
  display: flex;
  width: max-content;
  margin-bottom: 10px;
  animation: belt 40s linear infinite;
}
.lane.reverse {
  animation-direction: reverse;
  animation-duration: 46s;
}
.bound:hover .lane {
  animation-play-state: paused;
}
.belt {
  display: flex;
  gap: 10px;
  margin: 0;
  padding: 0 5px;
  list-style: none;
}
.belt li {
  padding: 6px 14px;
  border-radius: 8px;
  border: 1px solid var(--vp-c-divider);
  background: color-mix(in srgb, var(--vp-c-bg-soft) 80%, transparent);
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
  color: var(--vp-c-text-2);
  white-space: nowrap;
}
@keyframes belt {
  to { transform: translateX(-50%); }
}
@keyframes pulse {
  to { box-shadow: 0 0 0 10px transparent; }
}
@media (prefers-reduced-motion: reduce) {
  .lane, .pulse { animation: none; }
  .lane { flex-wrap: wrap; width: auto; justify-content: center; }
  .belt { flex-wrap: wrap; justify-content: center; }
  .belt[aria-hidden='true'] { display: none; }
}
</style>
