<template>
  <div class="flex items-center justify-center h-screen w-screen bg-background">
    <Card class="w-full max-w-sm">
      <CardHeader class="text-center">
        <CardTitle class="text-xl font-bold tracking-wide uppercase text-primary">
          TLD Buddy
        </CardTitle>
        <CardDescription>
          Enter the password to continue
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form @submit.prevent="login" class="flex flex-col gap-4">
          <div class="flex flex-col gap-2">
            <Input
              ref="inputRef"
              v-model="password"
              type="password"
              placeholder="Password"
              :disabled="loading"
              @keydown.enter="login"
            />
            <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
          </div>
          <Button type="submit" :disabled="loading || !password" class="w-full">
            <LockKeyholeIcon v-if="!loading" class="h-4 w-4 mr-2" />
            <LoaderIcon v-else class="h-4 w-4 mr-2 animate-spin" />
            {{ loading ? 'Checking...' : 'Enter' }}
          </Button>
        </form>
      </CardContent>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { LockKeyholeIcon, LoaderIcon } from 'lucide-vue-next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Button } from '~/components/ui/button'

const emit = defineEmits<{
  authenticated: []
}>()

const password = ref('')
const error = ref('')
const loading = ref(false)
const inputRef = ref<InstanceType<typeof Input> | null>(null)

onMounted(() => {
  nextTick(() => {
    inputRef.value?.$el?.focus()
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

    if (!res.ok) {
      error.value = 'Wrong password'
      password.value = ''
      return
    }

    emit('authenticated')
  } catch {
    error.value = 'Connection error'
  } finally {
    loading.value = false
  }
}
</script>
