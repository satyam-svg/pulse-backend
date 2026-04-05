import type { Request, Response } from 'express'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

const FORWARD_RESPONSE_HEADERS = [
  'content-type',
  'content-length',
  'content-range',
  'accept-ranges',
  'etag',
  'last-modified',
] as const

/**
 * Proxies GET/HEAD to the CDN URL so the API can honor **Range** and surface **206 Partial Content**
 * (browser `<video>` seeks) while keeping access checks on our server first.
 */
export async function proxyVideoStreamToResponse(
  upstreamUrl: string,
  req: Request,
  res: Response,
  cacheControl: string,
): Promise<void> {
  const method = req.method === 'HEAD' ? 'HEAD' : 'GET'
  const headers: Record<string, string> = {
    'User-Agent': 'VSPlayer-StreamProxy/1.0',
  }
  const range = req.headers.range
  if (typeof range === 'string') {
    headers.Range = range
  }

  let upstream: globalThis.Response
  try {
    upstream = await fetch(upstreamUrl, { method, headers, redirect: 'follow' })
  } catch {
    if (!res.headersSent) {
      res.status(502).json({ message: 'Could not reach video storage' })
    }
    return
  }

  if (upstream.status >= 400) {
    if (!res.headersSent) {
      res.status(upstream.status === 404 ? 404 : 502).json({ message: 'Stream unavailable' })
    }
    return
  }

  res.setHeader('Accept-Ranges', upstream.headers.get('accept-ranges') ?? 'bytes')
  res.setHeader('Cache-Control', cacheControl)

  for (const name of FORWARD_RESPONSE_HEADERS) {
    const v = upstream.headers.get(name)
    if (v) res.setHeader(name, v)
  }

  res.status(upstream.status)

  if (method === 'HEAD' || upstream.status === 204) {
    res.end()
    return
  }

  const webBody = upstream.body
  if (!webBody) {
    res.end()
    return
  }

  const nodeReadable = Readable.fromWeb(webBody as import('stream/web').ReadableStream<Uint8Array>)

  try {
    await pipeline(nodeReadable, res)
  } catch {
    /* client disconnect or truncated body — avoid throwing to Express error middleware */
  }
}
