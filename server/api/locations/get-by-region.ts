import { eq } from "drizzle-orm";
import { db, Locations } from "~~/server/drizzle/schema";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);

  const { region } = query;

  if (!region) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Missing required field: region",
    });
  }

  if (typeof region !== "string") {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Invalid type for field: region",
    });
  }

  return db.select().from(Locations).where(eq(Locations.regionName, region));
});
