<template>
	<div
		v-if="heldClient"
		class="held-marker"
		:style="{ left: `${heldClient.x}px`, top: `${heldClient.y}px` }"
		aria-hidden="true"
	/>
	<div
		v-if="ghost"
		class="stamp-ghost"
		:style="{ left: `${ghost.x}px`, top: `${ghost.y}px` }"
		aria-hidden="true"
	>
		<img v-if="armed?.icon" :src="armed.icon" alt="" /><span
			class="ghost-qty tabular"
			>{{ quantity }}</span
		>
	</div>
	<section
		ref="tray"
		class="satchel surface-rail rounded-lg border border-border text-foreground"
		tabindex="-1"
		aria-label="Satchel"
		@focusin="trayFocused = true"
		@focusout="onFocusOut"
		@click.stop
	>
		<header class="flex items-start justify-between gap-3">
			<div class="min-w-0">
				<span class="hud-label">Satchel</span>
				<p v-if="armed" class="mt-1 text-sm font-semibold text-primary">
					{{ held ? "Spot held · " : "Stamp armed · " }}{{ armed.name }} ×{{
						quantity
					}}<span v-if="note"> · {{ note }}</span>
				</p>
				<p v-else class="mt-1 text-xs text-muted-foreground">
					{{
						held
							? "Spot held · type items below or choose a slot"
							: "Select a slot to stamp · right-click a spot to gather"
					}}
				</p>
			</div>
			<Button v-if="engaged" variant="ghost" size="sm" @click="stop"
				><XIcon /> Stop <kbd>Esc</kbd></Button
			>
		</header>
		<div class="mt-3 flex flex-wrap items-center gap-2">
			<SatchelSlots
				:items="slots"
				:armed-id="armed?.id"
				@arm="arm"
				@search="openSearch"
				@drag="dragId = $event"
			/>
			<template v-if="armed">
				<Button variant="ghost" size="sm" @click="togglePin"
					><PinIcon />{{ pinned.includes(armed.id) ? "Unpin" : "Pin" }}</Button
				>
				<template v-if="pinned.includes(armed.id)"
					><Button
						variant="ghost"
						size="icon"
						aria-label="Move favourite left"
						@click="movePin(-1)"
						><ChevronLeftIcon /></Button
					><Button
						variant="ghost"
						size="icon"
						aria-label="Move favourite right"
						@click="movePin(1)"
						><ChevronRightIcon /></Button
				></template>
			</template>
			<Button v-if="selectedItem" variant="ghost" size="sm" @click="pinSelected"
				><PinIcon /> Pin {{ selectedItem.name }}</Button
			>
		</div>
		<div v-show="searchOpen || held" class="mt-3 border-t border-border pt-3">
			<label class="hud-label text-muted-foreground" for="satchel-query">{{
				held ? "Add to held spot" : "Search to arm"
			}}</label>
			<Input
				id="satchel-query"
				ref="input"
				v-model="query"
				class="mt-1"
				role="combobox"
				aria-label="Search items"
				aria-autocomplete="list"
				:aria-expanded="!!results.length"
				aria-controls="satchel-results"
				:aria-activedescendant="
					results[selectedResult]
						? `satchel-option-${selectedResult}`
						: undefined
				"
				placeholder="12 matches · hacksaw - car trunk"
				@keydown.enter.prevent="submitSearch"
				@keydown.down.prevent="
					selectedResult = Math.min(selectedResult + 1, results.length - 1)
				"
				@keydown.up.prevent="selectedResult = Math.max(selectedResult - 1, 0)"
			/>
			<div
				v-if="query.trim()"
				id="satchel-results"
				role="listbox"
				aria-label="Item results"
				class="mt-1 max-h-36 overflow-auto rounded-md border border-border bg-background"
			>
				<button
					v-for="(item, index) in results"
					:id="`satchel-option-${index}`"
					:key="item.id"
					type="button"
					role="option"
					:aria-selected="index === selectedResult"
					class="flex w-full items-center gap-2 px-2 py-1 text-left text-sm hover:bg-muted"
					:class="{ 'bg-muted': index === selectedResult }"
					@mousedown.prevent
					@click="chooseResult(item)"
				>
					<img
						v-if="item.icon"
						:src="item.icon"
						alt=""
						class="size-7 object-contain"
					/>{{ item.name }}
				</button>
				<p
					v-if="!results.length"
					class="px-3 py-2 text-sm text-muted-foreground"
				>
					No matching items
				</p>
			</div>
		</div>
		<div v-if="armed" class="mt-2 flex items-center gap-2">
			<label for="satchel-note" class="hud-label text-muted-foreground"
				>Note</label
			><Input
				id="satchel-note"
				v-model="note"
				aria-label="Note"
				placeholder="Optional note for next stamp"
				@keydown.enter.prevent="placeHeld"
			/>
		</div>
		<div v-if="held && added.length" class="mt-3 border-t border-border pt-2">
			<span class="hud-label text-muted-foreground">Added here</span>
			<div class="mt-1 flex max-h-20 flex-wrap gap-1 overflow-auto">
				<span
					v-for="(entry, index) in added"
					:key="index"
					class="rounded border border-border px-2 py-1 text-xs"
					>{{ entry }}</span
				>
			</div>
		</div>
		<p class="mt-2 text-xs text-muted-foreground">
			Right-click a spot · Q focuses tray · digits select slots or set quantity
			· Esc stops
		</p>
	</section>
</template>
<script setup lang="ts">
import { ChevronLeftIcon, ChevronRightIcon, PinIcon, XIcon } from "@lucide/vue";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import SatchelSlots from "~/components/add/d/SatchelSlots.vue";
import { useSatchelSlots } from "~/components/add/d/useSatchelSlots";
import {
	appendQuantity,
	entryFromText,
	quantityFromDigits,
	shouldRouteKey,
	slotIndex,
} from "~/components/add/d/logic";
import type { Item } from "~/types";
import type { AddRequest, MapPos } from "~/composables/useAddUi";

const ui = useAddUi();
const add = useAddItem();
const game = useGameData();
const selection = useUiState();
const { pinned, slots, pin, toggle, move } = useSatchelSlots();
const armed = ref<Item | null>(null);
const held = ref<MapPos | null>(null);
const note = ref("");
const digits = ref("");
const query = ref("");
const searchOpen = ref(false);
const trayFocused = ref(false);
const tray = ref<HTMLElement | null>(null);
const input = ref<InstanceType<typeof Input> | null>(null);
const selectedResult = ref(0);
const dragId = ref("");
const batch = ref<string | undefined>();
const added = ref<string[]>([]);
const quantity = computed(() => quantityFromDigits(digits.value));
const engaged = computed(
	() => !!held.value || !!armed.value || searchOpen.value || trayFocused.value,
);
const parsed = computed(() => entryFromText(query.value));
const results = computed(() =>
	parsed.value.query ? add.search(parsed.value.query, { limit: 8 }) : [],
);
const selectedItem = computed(() => {
	const marker = game.markers.value.find(
		(m) => m.id === selection.selectedMarkerId.value,
	);
	return marker ? game.getItemById(marker.itemId) : undefined;
});
const heldClient = computed(() => {
	void ui.viewTick.value;
	return held.value && ui.mapView.value
		? ui.mapView.value.toClient(held.value)
		: null;
});
const ghost = computed(() =>
	armed.value && ui.pointer.value ? ui.pointer.value.client : null,
);
watch(query, () => {
	selectedResult.value = 0;
});
let lastNoticeBatch: string | null = null;
watch(ui.notice, (notice) => {
	if (
		notice?.text === "Undone" &&
		lastNoticeBatch &&
		lastNoticeBatch === batch.value
	) {
		added.value = [];
		batch.value = undefined;
	}
	lastNoticeBatch = notice?.batchId ?? null;
});
watch(
	engaged,
	(value) => {
		ui.active.value = value;
	},
	{ immediate: true },
);
watch([game.currentMapId, () => game.currentRun.value?.id], stop);
function focusInput() {
	nextTick(() => (input.value?.$el as HTMLInputElement | undefined)?.focus());
}
function focusTray() {
	nextTick(() => tray.value?.focus());
}
function onFocusOut(e: FocusEvent) {
	if (!tray.value?.contains(e.relatedTarget as Node | null))
		trayFocused.value = false;
}
function stop() {
	armed.value = null;
	held.value = null;
	searchOpen.value = false;
	trayFocused.value = false;
	query.value = "";
	note.value = "";
	digits.value = "";
	batch.value = undefined;
	added.value = [];
	if (tray.value?.contains(document.activeElement))
		(document.activeElement as HTMLElement).blur();
}
function arm(item: Item) {
	if (armed.value?.id === item.id) {
		armed.value = null;
		digits.value = "";
		return;
	}
	armed.value = item;
	digits.value = "";
	searchOpen.value = false;
	focusTray();
}
function openSearch() {
	searchOpen.value = true;
	focusInput();
}
function pinSelected() {
	if (selectedItem.value) pin(selectedItem.value);
}
function togglePin() {
	if (armed.value) toggle(armed.value);
}
function movePin(delta: number) {
	if (armed.value) move(armed.value, delta);
}
function addItem(
	pos: MapPos,
	item: Item,
	qty: number,
	text: string,
	atHeld: boolean,
) {
	const result = add.addAt(
		atHeld ? pos : add.resolveSpot(pos),
		[{ itemId: item.id, quantity: qty, note: text || undefined }],
		atHeld && batch.value ? { batchId: batch.value } : {},
	);
	if (!result) return;
	if (atHeld) {
		batch.value = result.batchId;
		added.value.push(`${item.name} ×${qty}${text ? ` · ${text}` : ""}`);
	}
	ui.announce(`Added ${item.name} ×${qty}`, result.batchId);
}
function placeHeld() {
	if (held.value && armed.value) {
		addItem(held.value, armed.value, quantity.value, note.value, true);
		armed.value = null;
		digits.value = "";
		note.value = "";
		focusInput();
	}
}
function chooseResult(item: Item) {
	if (held.value) {
		const entry = parsed.value;
		addItem(held.value, item, entry.quantity, entry.note, true);
		armed.value = null;
		digits.value = "";
		note.value = "";
		query.value = "";
		focusInput();
	} else {
		query.value = "";
		arm(item);
	}
}
function submitSearch() {
	const item = results.value[selectedResult.value];
	if (item) chooseResult(item);
	else if (!query.value.trim() && armed.value) placeHeld();
}
function hold(pos: MapPos) {
	held.value = add.resolveSpot(pos);
	batch.value = undefined;
	added.value = [];
	searchOpen.value = true;
	focusInput();
}
function request(req: AddRequest) {
	if (armed.value && req.source === "context") {
		addItem(req.pos, armed.value, quantity.value, note.value, false);
		digits.value = "";
		note.value = "";
		return;
	}
	hold(req.pos);
}
function intercept(req: AddRequest, e: MouseEvent) {
	if (e.shiftKey) {
		hold(req.pos);
		return true;
	}
	if (!armed.value || held.value) return false;
	addItem(req.pos, armed.value, quantity.value, note.value, false);
	digits.value = "";
	note.value = "";
	return true;
}
function key(e: KeyboardEvent) {
	const target = e.target as HTMLElement | null;
	const dialog =
		!!target?.closest('[role="dialog"], dialog') ||
		!!document.querySelector('[role="dialog"][data-state="open"]');
	const editable = !!target?.closest(
		'input, textarea, select, [contenteditable="true"]',
	);
	if (dialog || e.ctrlKey || e.metaKey || e.altKey) return;
	if (e.key === "Escape" && engaged.value) {
		e.preventDefault();
		e.stopImmediatePropagation();
		stop();
		return;
	}
	if (!engaged.value && !editable && e.key.toLowerCase() === "q") {
		e.preventDefault();
		e.stopImmediatePropagation();
		focusTray();
		return;
	}
	if (!shouldRouteKey(engaged.value, dialog, editable, false)) return;
	if (!held.value && !armed.value && e.key.toLowerCase() === "s") {
		e.preventDefault();
		e.stopImmediatePropagation();
		openSearch();
		return;
	}
	if (e.key === "Enter" && held.value && armed.value) {
		e.preventDefault();
		e.stopImmediatePropagation();
		placeHeld();
		return;
	}
	const index = slotIndex(e.key);
	if (index !== null) {
		e.preventDefault();
		e.stopImmediatePropagation();
		if (armed.value) digits.value = appendQuantity(digits.value, e.key);
		else if (slots.value[index]) arm(slots.value[index]!);
		return;
	}
	if (/^[a-z]$/i.test(e.key) && held.value && !armed.value) {
		e.preventDefault();
		e.stopImmediatePropagation();
		query.value += e.key;
		searchOpen.value = true;
		focusInput();
	}
}
function drop(e: DragEvent) {
	const id = dragId.value;
	dragId.value = "";
	if (!id) return;
	const pos = ui.mapView.value?.fromClient({ x: e.clientX, y: e.clientY });
	const item = game.getItemById(id);
	if (pos && item) addItem(pos, item, 1, "", false);
}
function allowDrop(e: DragEvent) {
	if (
		dragId.value &&
		ui.mapView.value?.fromClient({ x: e.clientX, y: e.clientY })
	)
		e.preventDefault();
}
const unregister = ui.register({
	start(req) {
		if (req) hold(req.pos);
		else openSearch();
	},
	request,
	interceptClick: intercept,
	interceptTileClick(_tile, req, e) {
		return intercept(req, e);
	},
});
onMounted(() => {
	ui.hideAddButton.value = true;
	window.addEventListener("keydown", key, true);
	window.addEventListener("drop", drop);
	window.addEventListener("dragover", allowDrop);
});
onUnmounted(() => {
	unregister();
	window.removeEventListener("keydown", key, true);
	window.removeEventListener("drop", drop);
	window.removeEventListener("dragover", allowDrop);
});
</script>
<style scoped>
.satchel {
	position: absolute;
	z-index: 520;
	bottom: 4.5rem;
	left: 50%;
	transform: translateX(-50%);
	width: min(700px, 95%);
	padding: 12px;
	box-shadow: 0 6px 20px oklch(0.1 0.02 258 / 0.55);
}
.held-marker {
	position: fixed;
	z-index: 540;
	width: 24px;
	height: 24px;
	border: 2px solid var(--primary);
	border-radius: 50%;
	transform: translate(-50%, -50%);
	pointer-events: none;
}
.stamp-ghost {
	position: fixed;
	z-index: 600;
	width: 34px;
	height: 34px;
	display: grid;
	place-items: center;
	border: 2px solid var(--primary);
	border-radius: 9px;
	background: var(--rail);
	opacity: 0.7;
	transform: translate(8px, 8px);
	pointer-events: none;
}
.stamp-ghost img {
	width: 75%;
	height: 75%;
	object-fit: contain;
}
.ghost-qty {
	position: absolute;
	bottom: -6px;
	right: -6px;
	font-size: 10px;
	background: var(--primary);
	color: var(--primary-foreground);
	border-radius: 8px;
	padding: 0 3px;
}
</style>
