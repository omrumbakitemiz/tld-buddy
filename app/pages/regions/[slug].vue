<script setup lang="ts">
const route = useRoute();
const { data: regionDetails } = await useFetch(`/api/regions/${route.params.slug}`);
</script>

<template>
  <div>
    <p>Region Details</p>
    <pre>{{ regionDetails.items }}</pre>
  </div>
</template>
