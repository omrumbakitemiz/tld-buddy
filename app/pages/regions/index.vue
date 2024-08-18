<script setup lang="ts">
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const { data: regions } = await useFetch('/api/regions/all');
</script>

<template>
  <div class="grid gap-4 overflow-auto p-4 md:grid-cols-2 lg:grid-cols-3">
    <Card v-for="region in regions" :key="region.slug"
      :class="cn('w-full hover:bg-muted hover:scale-105 hover:shadow-md transition-all duration-200 cursor-pointer', $attrs.class ?? '')"
      @click="$router.push(`/regions/${region.slug}`)">
      <CardHeader>
        <CardTitle>{{ region.name }}</CardTitle>

        <!-- REGION IMAGE -->
      </CardHeader>
      <CardContent class="grid grid-cols-2 gap-4">
        <div class="space-y-1">
          <!-- change color based on difficulty -->
          <p
            :class="cn('text-sm font-medium leading-none', region.difficulty === 'Beginner' ? 'text-primary' : 'text-destructive')">
            {{ region.difficulty }}
          </p>
          <p class="text-sm text-muted-foreground">
            {{ region.area_size }} km²
          </p>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
