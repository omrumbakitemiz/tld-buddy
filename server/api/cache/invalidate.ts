export default defineEventHandler(async (event) => {
  const { cacheItemName } = getQuery(event);

  if (!cacheItemName) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Missing required field: cacheItemName",
    });
  }

  if (typeof cacheItemName !== "string") {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Invalid type for field: cacheItemName",
    });
  }

  const cacheKey = `nitro:handlers:${cacheItemName}.json`;

  const cache = useStorage('cache');

  await cache.removeItem(cacheKey);

  return new Response(`Cache item ${cacheItemName} invalidated`, { status: 201 });
});
