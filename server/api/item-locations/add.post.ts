import { eq } from "drizzle-orm";
import { db, ItemLocations, Regions } from "~~/server/drizzle/schema";

export default defineEventHandler(async (event) => {
  const { itemId, locationId, regionSlug, count = 1 } = await readBody(event);

  if (!itemId || !locationId || !count || !regionSlug) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Missing required fields",
    });
  }

  const region = await db
    .select()
    .from(Regions)
    .where(eq(Regions.slug, regionSlug));

  if (!region || region.length !== 1) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Invalid region slug",
    });
  }

  const regionId = region[0].id;

  await db.insert(ItemLocations).values({
    itemId,
    locationId,
    regionId,
    count,
  });

  return Response.json(
    {
      message: `Item ${itemId} saved to region: ${regionId} - location: ${locationId} with count: ${count}`,
    },
    {
      status: 201,
    }
  );
});
