export const useItemAdd = () => {
  const itemId = ref(0);
  const itemCount = ref(1);
  const regionSlug = ref(0);
  const locationId = ref(0);

  return {
    itemId,
    itemCount,
    regionSlug,
    locationId,
  };
};
