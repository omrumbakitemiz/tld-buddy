<script setup lang="ts">
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const searchTerm = ref("");

const { data: regions } = useFetch("/api/regions/all");

const filteredRegions = computed(() =>
	regions.value?.filter((region) =>
		region.name.toLowerCase().includes(searchTerm.value.toLowerCase()),
	),
);

const difficultColor = (difficulty: string | null) => {
	if (difficulty === "Beginner") {
		return "text-primary";
	}
	if (difficulty === "Intermediate") {
		return "text-primary";
	}
	return "text-destructive";
};

</script>

<template>
  <div class="flex flex-col justify-center gap-y-4 py-4">
    <SearchBar class="ml-4" placeholder="Search region..." v-model="searchTerm" />

    <div class="grid gap-4 overflow-auto p-4 md:grid-cols-2 lg:grid-cols-3">
      <Card v-for="region in filteredRegions" :key="region.slug"
        :class="cn('w-full hover:bg-muted hover:scale-105 hover:shadow-md transition-all duration-200 cursor-pointer', $attrs.class ?? '')"
        @click="$router.push(`/regions/${region.slug}`)">
        <CardHeader>
          <CardTitle>{{ region.name }}</CardTitle>
        </CardHeader>
        <CardContent class="grid grid-cols-2 gap-4">
          <div class="space-y-1">
            <p :class="cn('text-sm font-medium leading-none', difficultColor(region.difficulty))">
              {{ region.difficulty }}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>

</template>
