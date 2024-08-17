<script setup lang="ts">
import { ChevronsDownUp, PlusCircleIcon } from "lucide-vue-next";
import type { RegionItem } from "~~/server/api/regions/type";

const route = useRoute();
const { data: regionDetails } = await useFetch(`/api/regions/${route.params.slug}`);

const tools = regionDetails.value.items.filter((item: RegionItem) => item.itemType === "tools");
const clothing = regionDetails.value.items.filter((item: RegionItem) => item.itemType === "clothing");
const firstAid = regionDetails.value.items.filter((item: RegionItem) => item.itemType === "first-aid");
const foods = regionDetails.value.items.filter((item: RegionItem) => item.itemType === "foods");
const materials = regionDetails.value.items.filter((item: RegionItem) => item.itemType === "materials");
</script>

<template>
  <div class="flex justify-between p-4">
    <div class="flex w-full flex-col gap-4">
      <div class="flex flex-col items-center justify-center gap-4 py-8 px-6 sm:px-10">
        <div class="flex flex-col items-center justify-center gap-2 sm:gap-4">
          <div class="flex items-center gap-2">
            <div class="flex-shrink-0">
            </div>
            <div class="flex flex-col">
              <div class="text-2xl font-bold">
                {{ regionDetails.name }}
              </div>
              <div class="text-sm text-muted-foreground">
                {{ regionDetails.description }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="flex flex-col items-center justify-center gap-4 py-8 px-6 sm:px-10">
        <Collapsible class="w-full space-y-2">
          <div
            class="flex items-center justify-between space-x-4 border border-slate-200 rounded-lg p-2 hover:bg-slate-100">
            <h4 class="text-sm font-semibold">
              Tools
            </h4>
            <CollapsibleTrigger as-child>
              <div class="flex items-center size-6 p-0 cursor-pointer">
                <ChevronsDownUp class="h-4 w-4" />
                <span class="sr-only">Toggle Tools</span>
              </div>
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent class="space-y-1">
            <div v-for="tool in tools" class="rounded-md border px-4 py-3 font-mono text-sm">
              {{ tool.itemName }}
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Collapsible class="w-full space-y-2">
          <div
            class="flex items-center justify-between space-x-4 border border-slate-200 rounded-lg p-2 hover:bg-slate-100">
            <h4 class="text-sm font-semibold">
              Clothing
            </h4>
            <CollapsibleTrigger as-child>
              <div class="flex items-center size-6 p-0 cursor-pointer">
                <ChevronsDownUp class="h-4 w-4" />
                <span class="sr-only">Toggle Clothing</span>
              </div>
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent class="space-y-1">
            <div v-for="clothing in clothing" class="rounded-md border px-4 py-3 font-mono text-sm">
              {{ clothing.itemName }}
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Collapsible class="w-full space-y-2">
          <div
            class="flex items-center justify-between space-x-4 border border-slate-200 rounded-lg p-2 hover:bg-slate-100">
            <h4 class="text-sm font-semibold">
              First Aid
            </h4>
            <CollapsibleTrigger as-child>
              <div class="flex items-center size-6 p-0 cursor-pointer">
                <ChevronsDownUp class="h-4 w-4" />
                <span class="sr-only">Toggle First Aid</span>
              </div div>
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent class="space-y-1">
            <div v-for="firstAid in firstAid" class="rounded-md border px-4 py-3 font-mono text-sm">
              {{ firstAid.itemName }}
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Collapsible class="w-full space-y-2">
          <div
            class="flex items-center justify-between space-x-4 border border-slate-200 rounded-lg p-2 hover:bg-slate-100">
            <h4 class="text-sm font-semibold">
              Foods
            </h4>
            <CollapsibleTrigger as-child>
              <div class="flex items-center size-6 p-0 cursor-pointer">
                <ChevronsDownUp class="h-4 w-4" />
                <span class="sr-only">Toggle Foods</span>
              </div>
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent class="space-y-1">
            <div v-for="food in foods" class="rounded-md border px-4 py-3 font-mono text-sm">
              {{ food.itemName }}
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Collapsible class="w-full space-y-2">
          <div
            class="flex items-center justify-between space-x-4 border border-slate-200 rounded-lg p-2 hover:bg-slate-100">
            <h4 class="text-sm font-semibold">
              Materials
            </h4>
            <CollapsibleTrigger as-child>
              <div class="flex items-center size-6 p-0 cursor-pointer">
                <ChevronsDownUp class="h-4 w-4" />
                <span class="sr-only">Toggle Materials</span>
              </div>
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent class="space-y-1">
            <div v-for="material in materials" class="rounded-md border px-4 py-3 font-mono text-sm">
              {{ material.itemName }}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>

    <div class="w-56">
      <!-- Add a button to add a new item -->
        <div class="flex items-center justify-between space-x-4 border border-slate-200 rounded-lg p-2 hover:bg-slate-100">
          <h4 class="text-sm font-semibold">
            Add Item
          </h4>
          <button class="flex items-center size-6 p-0 cursor-pointer">
            <PlusCircleIcon class="h-4 w-4" />
            <span class="sr-only">Add Item</span>
          </button>
        </div>

    </div>
  </div>
</template>
