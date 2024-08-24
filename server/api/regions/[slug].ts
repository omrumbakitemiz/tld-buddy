import { eq, inArray } from "drizzle-orm";
import {
  db,
  ItemLocations,
  Items,
  Locations,
  Regions,
} from "~~/server/drizzle/schema";
import type { RegionDetails } from "~~/server/type";

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, "slug");

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

  const itemIds = itemLocationsResponse.map((il) => il.itemId);
  const allItems = await db
    .select()
    .from(Items)
    .where(inArray(Items.id, itemIds));

  const locations = await db
    .select()
    .from(Locations)
    .where(eq(Locations.regionName, region.name));

  const newItemLocations = itemLocationsResponse.map((il) => {
    const item = allItems.find((i) => i.id === il.itemId);

    return {
      ...item,
      ...il,
    };
  });

  const response: RegionDetails = {
    name: region.name,
    locations: locations.map((location) => ({
      ...location,
      items: newItemLocations.filter((il) => il.locationId === location.id),
    })),
  };

  return response;
});
