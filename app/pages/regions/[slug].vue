<script setup lang="ts">
import type { RegionDetails } from '~~/server/type';

const route = useRoute();
const { data: regionDetails, status } = await useFetch<RegionDetails>(`/api/regions/${route.params.slug}`);

const { data: items } = await useFetch('/api/items/all');
</script>

<template>
  <div v-if="status === 'pending'">
    Please wait...
  </div>

  <div v-else class="grid gap-4 overflow-auto p-4 md:grid-cols-2 lg:grid-cols-3">
    <Card v-for="location in regionDetails?.locations" :key="location.name">
      <CardHeader>
        <CardTitle>{{ location.name }}</CardTitle>
      </CardHeader>
      <CardContent>
        <TooltipProvider :delay-duration="400">
          <div class="flex flex-col gap-4 w-full select-none">
            <div v-for="item in location.items.slice(0, 3)" :key="item.id">
              <Badge class="rounded-lg py-1">
                {{ item.name }} ({{ item.count }})
              </Badge>
            </div>

            <div class="flex w-full justify-end gap-x-2">
              <LocationItemDialog :location="location" />

              <ItemAddDialog :items="items" :locationId="location.id" />
            </div>
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  </div>

</template>
