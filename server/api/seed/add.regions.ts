import { db, Regions } from "~~/server/drizzle/schema";

export default defineEventHandler(async () => {
  // if env is not development, don't allow adding regions
  if (process.env.NODE_ENV !== "development") {
    throw new Response("Not allowed", { status: 403 });
  }

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
      difficulty: region.difficulty
    };
  });

  await db.insert(Regions).values(mappedRegions);
});
