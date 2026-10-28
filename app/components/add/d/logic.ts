import { parseEntry } from "../../../lib/addItem";

/** A digit addresses a tray slot only before an item is armed. */
export function slotIndex(key: string): number | null {
	return /^[0-9]$/.test(key) ? (key === "0" ? 9 : Number(key) - 1) : null;
}

export function appendQuantity(current: string, digit: string): string {
	return /^[0-9]$/.test(digit) ? (current + digit).slice(0, 3) : current;
}

export function quantityFromDigits(digits: string): number {
	return Math.max(1, Math.min(999, Number(digits) || 1));
}

export function entryFromText(text: string) {
	return parseEntry(text);
}

export function orderSlots<T extends { id: string }>(
	pinned: T[],
	recent: T[],
	fallback: T[],
	limit = 10,
): T[] {
	return [
		...new Map(
			[...pinned, ...recent, ...fallback].map((item) => [item.id, item]),
		).values(),
	].slice(0, limit);
}

export function shouldRouteKey(
	engaged: boolean,
	inDialog: boolean,
	editable: boolean,
	modified: boolean,
): boolean {
	return engaged && !inDialog && !editable && !modified;
}
