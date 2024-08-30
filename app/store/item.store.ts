import { defineStore } from 'pinia';

export const useItemStore = defineStore('item', () => {
  const itemId = ref<number>();
  const itemCount = ref(1);
  const regionSlug = ref<string>();
  const locationId = ref<number>();

  const setItemId = (id: number) => {
    itemId.value = id;
  };

  const $reset = () => {
    itemId.value = undefined;
    itemCount.value = 1;
    regionSlug.value = undefined;
    locationId.value = undefined;
  };

  return {
    itemId,
    itemCount,
    regionSlug,
    locationId,
    setItemId,
    $reset,
  };
})
