import { db, Regions } from "~~/server/drizzle/schema";

export default defineEventHandler(async (event) => {

  // check if the regions already exists
  const allRegions = await db.select().from(Regions);
  if (allRegions.length > 0) {
    throw new Response("Regions already exists", { status: 400 });
  }

  const { regions } = await import("../../../tld-data/regions.json");

  const mappedRegions = regions.map((region) => {
    return {
      name: region.name,
      slug: region.slug,
      type: region.type,
      world: region.world,
      difficulty: region.difficulty,
      areaSize: region.area_size.toString(),
      modes: region.modes,
      releaseDate: region.release_date,
    };
  });

  await db.insert(Regions).values(mappedRegions);
});
