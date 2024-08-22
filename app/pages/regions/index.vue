<script setup lang="ts">
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const { data: regions } = await useFetch('/api/regions/all');

const difficultColor = (difficulty: string | null) => {
  if (difficulty === 'Beginner') {
    return 'text-primary';
  } if (difficulty === 'Intermediate') {
    return 'text-primary';
  }
  return 'text-destructive';
}
</script>

<template>
  <div class="grid gap-4 overflow-auto p-4 md:grid-cols-2 lg:grid-cols-3">
    <Card v-for="region in regions" :key="region.slug"
      :class="cn('w-full hover:bg-muted hover:scale-105 hover:shadow-md transition-all duration-200 cursor-pointer', $attrs.class ?? '')"
      @click="$router.push(`/regions/${region.slug}`)">
      <CardHeader>
        <CardTitle>{{ region.name }}</CardTitle>
      </CardHeader>
      <CardContent class="grid grid-cols-2 gap-4">
        <div class="space-y-1">
          <p
            :class="cn('text-sm font-medium leading-none', difficultColor(region.difficulty))">
            {{ region.difficulty }}
          </p>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
