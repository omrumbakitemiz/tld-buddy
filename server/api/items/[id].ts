import { db, Items } from "~~/server/drizzle/schema";
import { eq } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const { id } = getQuery(event);

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Missing required field",
    });
  }

  if (typeof id !== "number") {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Invalid id",
    });
  }

  return await db.select().from(Items).where(eq(Items.id, id));
});
