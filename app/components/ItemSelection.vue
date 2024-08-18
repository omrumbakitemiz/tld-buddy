<script setup lang="ts">
import { ref, defineModel } from 'vue';
import { CaretSortIcon, CheckIcon } from '@radix-icons/vue';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import type { RegionItem } from '~~/server/api/regions/type';

defineProps<{
  items: Array<any>;
}>();

const emit = defineEmits(['onItemNameChange']);

const open = ref(false);
const itemName = ref('');

const onItemSelect = (item: any) => {
  itemName.value = item.itemName;

  open.value = false;
  emit('onItemNameChange', item.name, item.type);
}
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <Button variant="outline" role="combobox" :aria-expanded="open" class="w-[200px] justify-between">
        {{ itemName
          ? items.find((item: any) => item.name === itemName)?.name
          : "Select Item..." }}
        <CaretSortIcon class="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
    </PopoverTrigger>
    <PopoverContent class="w-[200px] p-0">
      <Command>
        <CommandInput class="h-9" placeholder="Search item..." />
        <CommandEmpty>No item found.</CommandEmpty>
        <CommandList>
          <CommandGroup>
            <CommandItem v-for="item in items" :key="item.name" :value="item.name" @select="() => onItemSelect(item)">
              {{ item.name }}
              <CheckIcon :class="cn(
                'ml-auto h-4 w-4',
                itemName === item.name ? 'opacity-100' : 'opacity-0',
              )" />
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>
</template>
