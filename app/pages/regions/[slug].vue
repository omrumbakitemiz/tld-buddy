<script setup lang="ts">
const route = useRoute();
const { data: regionDetails } = await useFetch(`/api/regions/${route.params.slug}`);
</script>

<template>
  <div>
    <u><b>route.params.slug</b></u> -> {{ route.params.slug }}

    <p>Region Details</p>
    <pre>{{ JSON.stringify(regionDetails) }}</pre>
  </div>
</template>
