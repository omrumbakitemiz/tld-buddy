import assert from "node:assert/strict";
import {
	appendQuantity,
	entryFromText,
	orderSlots,
	quantityFromDigits,
	shouldRouteKey,
	slotIndex,
} from "../app/components/add/d/logic";
assert.deepEqual(
	[slotIndex("1"), slotIndex("9"), slotIndex("0"), slotIndex("a")],
	[0, 8, 9, null],
);
assert.equal(
	quantityFromDigits(appendQuantity(appendQuantity("", "1"), "2")),
	12,
);
assert.equal(quantityFromDigits("000"), 1);
assert.equal(appendQuantity("123", "4"), "123");
assert.deepEqual(entryFromText("12 mat - cupboard"), {
	quantity: 12,
	query: "mat",
	note: "cupboard",
});
assert.deepEqual(
	orderSlots([{ id: "b" }], [{ id: "a" }, { id: "b" }], [{ id: "c" }]).map(
		(x) => x.id,
	),
	["b", "a", "c"],
);
assert.equal(shouldRouteKey(false, false, false, false), false);
assert.equal(shouldRouteKey(true, true, false, false), false);
assert.equal(shouldRouteKey(true, false, true, false), false);
assert.equal(shouldRouteKey(true, false, false, true), false);
assert.equal(shouldRouteKey(true, false, false, false), true);
console.log("Satchel routing, quantities, entry and slot ordering passed");
