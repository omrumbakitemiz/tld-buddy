import { db, ItemLocations } from "~~/server/drizzle/schema";

export default defineEventHandler(async (event) => {
  const { itemId, locationId, regionId, count = 1 } = await readBody(event);

  if (!itemId || !locationId || !count || !regionId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Missing required fields",
    });
  }

  await db.insert(ItemLocations).values({
    itemId,
    locationId,
    regionId,
    count,
  });

  return new Response(`Item ${itemId} saved to region ${regionId} - location ${locationId} with count ${count}`, { status: 201 });
});
