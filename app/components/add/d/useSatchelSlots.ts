import { useLocalStorage } from "@vueuse/core";
import type { Item } from "~/types";
import { orderSlots } from "./logic";

/** Favourites are device-local; frecency and catalogue fill the remaining slots. */
export function useSatchelSlots() {
	const pinned = useLocalStorage<string[]>("tld-buddy-satchel-pins", []);
	const game = useGameData();
	const add = useAddItem();
	const slots = computed(() =>
		orderSlots(
			pinned.value
				.map((id) => game.getItemById(id))
				.filter((item): item is Item => !!item),
			add.frecent(10),
			add.search("", { limit: 10 }),
		),
	);

	function pin(item: Item) {
		if (!pinned.value.includes(item.id))
			pinned.value = [...pinned.value, item.id].slice(0, 10);
	}

	function toggle(item: Item) {
		if (pinned.value.includes(item.id))
			pinned.value = pinned.value.filter((id) => id !== item.id);
		else pin(item);
	}

	function move(item: Item, delta: number) {
		const from = pinned.value.indexOf(item.id);
		const to = from + delta;
		if (from < 0 || to < 0 || to >= pinned.value.length) return;
		const copy = [...pinned.value];
		[copy[from], copy[to]] = [copy[to]!, copy[from]!];
		pinned.value = copy;
	}

	return { pinned, slots, pin, toggle, move };
}
