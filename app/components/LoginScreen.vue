<template>
  <main class="relative grid h-dvh place-items-center overflow-hidden bg-background px-4">
    <!-- A sliver of the painted map behind the form -->
    <img
      src="/maps/thumbs/mystery-lake-default.jpg"
      alt=""
      class="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover opacity-[0.07] blur-[2px] grayscale"
      aria-hidden="true"
    >
    <form class="surface-rail relative w-full max-w-sm space-y-5 rounded-2xl border border-border p-6 shadow-[0_12px_40px_oklch(0.1_0.02_258/0.6)]" @submit.prevent="login">
      <div class="space-y-1">
        <h1 class="hud-label text-sm text-foreground">TLD Buddy</h1>
        <p class="text-sm text-muted-foreground">Your maps, loot and stashes for The Long Dark.</p>
      </div>
      <div class="space-y-1.5">
        <Label for="password" class="hud-label text-muted-foreground">Password</Label>
        <Input
          id="password"
          ref="inputRef"
          v-model="password"
          type="password"
          autocomplete="current-password"
          :disabled="loading"
          :aria-invalid="!!error || undefined"
          aria-describedby="login-error"
          class="h-10"
        />
        <p id="login-error" class="min-h-5 text-sm text-destructive" role="alert">{{ error }}</p>
      </div>
      <Button type="submit" :disabled="loading || !password" class="h-10 w-full">
        <LoaderIcon v-if="loading" class="size-4 animate-spin" />
        {{ loading ? 'Checking…' : 'Enter' }}
      </Button>
    </form>
  </main>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import { LoaderIcon } from '@lucide/vue'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'

const emit = defineEmits<{ authenticated: [] }>()

const password = ref('')
const error = ref('')
const loading = ref(false)
const inputRef = ref<InstanceType<typeof Input> | null>(null)

onMounted(() => {
  nextTick(() => {
    const el = (inputRef.value as unknown as { $el?: HTMLElement })?.$el
    ;(el instanceof HTMLInputElement ? el : el?.querySelector('input'))?.focus()
  })
})

async function login() {
  if (!password.value || loading.value) return
  loading.value = true
  error.value = ''
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: password.value }),
    })
    if (res.status === 429) {
      error.value = 'Too many wrong tries. Wait a few minutes and try again.'
      return
    }
    if (!res.ok) {
      error.value = res.status === 401 ? 'That password is not right.' : 'The server could not sign you in. Try again.'
      password.value = ''
      return
    }
    emit('authenticated')
  } catch {
    error.value = 'Cannot reach the server. Check your connection.'
  } finally {
    loading.value = false
  }
}
</script>
