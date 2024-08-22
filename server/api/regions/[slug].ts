import { eq } from "drizzle-orm";
import { db, ItemLocations, Regions } from "~~/server/drizzle/schema";

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')

  if (!slug) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Missing required field: slug",
    });
  }

  if (typeof slug !== "string") {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Invalid slug",
    });
  }

  const regions = await db.select().from(Regions).where(eq(Regions.slug, slug));

  const region = regions[0];

  const itemLocationsResponse = await db
    .select()
    .from(ItemLocations)
    .where(eq(ItemLocations.regionId, region.id));

  return {
    name: region.name,
    items: itemLocationsResponse,
  }
});
