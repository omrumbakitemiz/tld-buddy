<script setup lang="ts">
const { data: items } = useFetch("/api/items/all");
</script>

<template>
  <div v-if="items">
    <p>Items</p>
    <p>Length: {{ items.length }}</p>
  </div>
</template>
