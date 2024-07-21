<script setup lang="ts">
const runtimeConfig = useRuntimeConfig();

const { $pwa } = useNuxtApp();

// const toast = useToast();

onMounted(() => {
  if ($pwa?.offlineReady) {
    alert('App ready to work offline');
  }
});
</script>

<template>
  <div class="h-screen">
    <div class="flex flex-col gap-y-4">
      <ClientOnly v-if="runtimeConfig.public.env === 'PRODUCTION'"> PWA Installed: {{ $pwa?.isPWAInstalled }}
      </ClientOnly>

      <div class="flex flex-col gap-y-4">
        <Button>Click me</Button>
      </div>
    </div>
  </div>
</template>
