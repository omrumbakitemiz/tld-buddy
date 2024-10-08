<script setup lang="ts">
import type { RegionDetails } from "~~/server/type";

const route = useRoute();
const { data: regionDetails, status } = useFetch<RegionDetails>(
	`/api/regions/${route.params.slug}`,
	{
		key: typeof route.params.slug === "string" ? route.params.slug : undefined,
	},
);

const { data: items } = useFetch("/api/items/all");

const searchTerm = ref("");

const filteredLocations = computed(() => {
  return regionDetails.value?.locations.filter((location) =>
		location.name.toLowerCase().includes(searchTerm.value.toLowerCase()),
	);
});
</script>

<template>
  <div class="w-full h-[calc(100vh-50px)] flex justify-center items-center" v-if="status === 'pending'">
    <img src="/assets/images/wolf.gif" alt="Loading..." />
  </div>

  <div v-else class="flex flex-col justify-center gap-y-4 py-4">
    <SearchBar class="ml-4" placeholder="Search location..." v-model="searchTerm" />

    <div class="grid gap-4 overflow-auto p-4 md:grid-cols-2 lg:grid-cols-3">
      <Card v-for="location in filteredLocations" :key="location.name">
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
  </div>
</template>
