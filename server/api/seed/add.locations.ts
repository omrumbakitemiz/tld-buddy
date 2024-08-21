import { db, Locations, Regions } from "~~/server/drizzle/schema";

export default defineEventHandler(async () => {
  // if env is not development, don't allow adding locations
  if (process.env.NODE_ENV !== "development") {
    throw new Response("Not allowed", { status: 403 });
  }

  // check if the regions already exists
  const allLocations = await db.select().from(Locations);
  if (allLocations.length > 0) {
    throw new Response("Locations already exists", { status: 400 });
  }

  const { locations } = await import("../../../tld-data/locations.json");
  
  
  const allRegions = await db.select().from(Regions);

  const mappedLocations: typeof Locations.$inferInsert[] = locations.map((location) => {
    const region = allRegions.find(r => r.name === location.regionName);

    if (!region) throw new Response("Region not found", { status: 404 });

    return {
      name: location.name,
      regionName: location.regionName,
      regionId: region.id,
    };
  });

  await db.insert(Locations).values(mappedLocations);
});
