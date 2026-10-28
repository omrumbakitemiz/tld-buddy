import type { H3Event } from 'h3'

/**
 * Read the request body as UTF-8, aborting with 413 once more than `maxBytes` arrive.
 * Counts bytes on the stream itself, so it also holds for chunked transfer encoding.
 */
export async function readLimitedBody(event: H3Event, maxBytes: number): Promise<string> {
  const declared = Number(getHeader(event, 'content-length') ?? 0)
  if (declared > maxBytes) {
    throw createError({ statusCode: 413, statusMessage: 'Payload too large' })
  }
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of event.node.req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buf.length
    if (size > maxBytes) {
      // Answer 413, then drop the connection instead of reading the rest of the upload
      setHeader(event, 'connection', 'close')
      event.node.res.once('finish', () => event.node.req.destroy())
      throw createError({ statusCode: 413, statusMessage: 'Payload too large' })
    }
    chunks.push(buf)
  }
  return Buffer.concat(chunks).toString('utf8')
}
