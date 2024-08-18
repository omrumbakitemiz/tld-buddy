<script setup lang="ts">
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const { data: items } = await useFetch('/api/items/all');
const route = useRoute();

const itemCount = ref(1);
const itemName = ref('');
const itemType = ref('');

const onItemNameChange = (name: string, type: string) => {
  itemName.value = name;
  itemType.value = type;
};

const saveChanges = async () => {
  console.log('save changes', itemName.value, itemCount.value);
  const result = await $fetch('/api/region-items/add', {
    method: 'POST',
    body: {
      regionSlug: route.params.slug,
      itemName: itemName.value,
      itemType: itemType.value,
    }
  });

  console.log('item added...', result);
  
};
</script>

<template>
  <Dialog>
    <DialogTrigger as-child>
      <Button variant="outline">
        Add Item
      </Button>
    </DialogTrigger>
    <DialogContent class="sm:max-w-[425px]">
      <DialogHeader>
        <DialogTitle>Add Item</DialogTitle>
        <DialogDescription>Add a new item to the database</DialogDescription>
      </DialogHeader>
      <div class="grid gap-4 py-4">
        <ItemSelection v-if="items?.tools" :items="items?.tools.default" @onItemNameChange="onItemNameChange" />

        <Input type="number" placeholder="Item Count" v-model="itemCount" />
      </div>
      <DialogFooter>
        <Button type="button" @click="saveChanges">
          Save changes
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
