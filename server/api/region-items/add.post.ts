import { db } from "~~/server/drizzle/schema";

export default defineEventHandler(async (event) => {
  const { regionSlug, itemName, itemType } = await readBody(event);

  console.log('body read', regionSlug, itemName, itemType); 

  if (!regionSlug || !itemName || !itemType) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Missing required fields",
      data: {
        regionSlug,
        itemName,
        itemType,
      },
    });
  }

  // const result = await db.insert(RegionItems).values({
  //   itemName,
  //   itemType,
  //   regionSlug,
  // })

  // return result.rows;
});
