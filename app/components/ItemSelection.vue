<script setup lang="ts">
import { ref } from 'vue';
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
import type { Items } from '~~/server/drizzle/schema';

defineProps<{
  items: Array<typeof Items.$inferSelect>;
}>();

const open = ref(false);

const { itemId } = useItemAdd();

const onItemSelect = (item: typeof Items.$inferSelect) => {
  itemId.value = item.id;
  open.value = false;
}
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <Button variant="outline" role="combobox" :aria-expanded="open" class="w-[200px] justify-between">
        {{ itemId
          ? items.find((item) => item.id === itemId)?.name
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
            <CommandItem v-for="item in items" :key="item.name" :value="item.id" @select="() => onItemSelect(item)">
              {{ item.name }}
              <CheckIcon :class="cn(
                'ml-auto h-4 w-4',
                itemId === item.id ? 'opacity-100' : 'opacity-0',
              )" />
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>
</template>
