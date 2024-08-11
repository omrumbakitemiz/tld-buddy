import { eq } from "drizzle-orm";
import { db, RegionItems } from "../../drizzle/schema";
import { Region, RegionDetails } from "~~/server/api/regions/type";

// return region details by id by filtering all items based on region id
export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, "slug");

  if (!slug) {
    return new Response("Not Found", { status: 404 });
  }

  // get all regions from tld-data/regions.json
  const { regions } = (await import("../../../tld-data/regions.json")) as {
    regions: Region[];
  };

  const region = regions.find((region) => region.slug === slug);

  if (!region) {
    return new Response("Not Found", { status: 404 });
  }

  const regionItems = await db
    .select()
    .from(RegionItems)
    .where(eq(RegionItems.regionSlug, slug));

  console.log(regionItems);

  const response = {
    ...region,
    items: [...regionItems],
  } as RegionDetails;

  return response;
});
