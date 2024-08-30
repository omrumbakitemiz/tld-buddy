<script setup lang="ts">
import type { Items } from "~~/server/drizzle/schema";
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus } from 'lucide-vue-next';
import { useItemStore } from "~/store/item.store";

const props = defineProps<{ items: typeof Items.$inferInsert, locationId: number }>();

const route = useRoute();

const itemStore = useItemStore();

const saveChanges = async () => {
  const result = await $fetch('/api/item-locations/add', {
    method: 'POST',
    body: {
      regionSlug: route.params.slug,
      itemId: itemStore.itemId,
      count: itemStore.itemCount,
      locationId: props.locationId
    }
  });

  console.log('item added...', result);

  if (typeof route.params.slug === 'string') {
    refreshNuxtData(route.params.slug);

    console.log('refreshed data...');

    itemStore.$reset();
  }
};
</script>

<template>
  <Dialog>
    <DialogTrigger as-child>
      <Button variant="outline" size="icon">
        <Plus class="size-4" />
      </Button>
    </DialogTrigger>
    <DialogContent class="sm:max-w-[425px]">
      <DialogHeader>
        <DialogTitle>Add Item</DialogTitle>
        <DialogDescription>Add a new item to the database</DialogDescription>
        ItemId: {{ itemStore.itemId }}
      </DialogHeader>
      <div class="grid gap-4 py-4">
        <ItemSelection v-if="items" :items="items" />

        <Input class="w-full" type="number" placeholder="Item Count" v-model="itemStore.itemCount" />
      </div>
      <DialogFooter>
        <Button type="button" @click="saveChanges">
          Save changes
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
