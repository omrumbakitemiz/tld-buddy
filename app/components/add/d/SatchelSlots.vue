<template>
	<div
		class="flex flex-wrap items-center gap-1.5"
		role="group"
		aria-label="Satchel slots"
	>
		<button
			v-for="(item, index) in items"
			:key="item.id"
			type="button"
			class="satchel-slot"
			:class="{ armed: item.id === armedId }"
			:title="`${item.name} · slot ${index === 9 ? 0 : index + 1}`"
			:aria-label="`${item.name}, slot ${index === 9 ? 0 : index + 1}`"
			:aria-pressed="item.id === armedId"
			draggable="true"
			@click="$emit('arm', item)"
			@dragstart="$emit('drag', item.id)"
			@dragend="$emit('drag', '')"
		>
			<span class="slot-number tabular">{{ index === 9 ? 0 : index + 1 }}</span>
			<img v-if="item.icon" :src="item.icon" alt="" draggable="false" />
			<span v-else class="slot-fallback">{{ item.name }}</span>
		</button>
		<Button
			variant="outline"
			size="icon"
			title="Search items"
			aria-label="Search items"
			@click="$emit('search')"
			><SearchIcon
		/></Button>
	</div>
</template>
<script setup lang="ts">
import { SearchIcon } from "@lucide/vue";
import { Button } from "~/components/ui/button";
import type { Item } from "~/types";
defineProps<{ items: Item[]; armedId?: string }>();
defineEmits<{ arm: [item: Item]; search: []; drag: [id: string] }>();
</script>
<style scoped>
.satchel-slot {
	position: relative;
	display: grid;
	place-items: center;
	width: 42px;
	height: 42px;
	border: 1px solid var(--border);
	border-radius: 9px;
	background: var(--rail);
	transition:
		border-color 180ms,
		transform 180ms;
}
.satchel-slot:hover,
.satchel-slot:focus-visible {
	border-color: var(--primary);
	outline: none;
	transform: translateY(-2px);
}
.satchel-slot.armed {
	border: 2px solid var(--primary);
}
.satchel-slot img {
	width: 70%;
	height: 70%;
	object-fit: contain;
}
.slot-number {
	position: absolute;
	top: 1px;
	left: 3px;
	font-size: 10px;
	color: var(--foreground);
}
.slot-fallback {
	font-size: 10px;
	line-height: 1;
	overflow: hidden;
}
@media (prefers-reduced-motion: reduce) {
	.satchel-slot {
		transition: none;
	}
}
</style>
