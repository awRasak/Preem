import type { z } from "zod";

// Shared request-body handling for API routes.
//
// Three jobs:
// 1. Reject non-JSON content types before touching the body. `req.json()`
//    ignores Content-Type entirely, so without this gate a cross-origin
//    page could fire a no-cors fetch with a "simple" text/plain body
//    (sent without preflight) and still reach every write endpoint.
// 2. Turn malformed JSON into a 400 instead of an unhandled SyntaxError
//    escaping as a 500.
// 3. Run the route's zod schema so every route collapses its
//    safeParse boilerplate into one checked result.
//
// Usage:
//   const parsed = await parseBody(req, schema);
//   if (!parsed.ok) return parsed.response;
//   const { dropId, amountKobo } = parsed.data;

const MAX_BODY_BYTES = 1 * 1024 * 1024;

export async function parseBody<S extends z.ZodType>(
  req: Request,
  schema: S,
): Promise<
  | { ok: true; data: z.output<S> }
  | { ok: false; response: Response }
> {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return jsonError(400, "Expected application/json");
  }

  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return jsonError(400, "Could not read request body");
  }
  if (raw.length > MAX_BODY_BYTES) {
    return jsonError(413, "Request body too large");
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return jsonError(400, "Invalid JSON");
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Invalid input");
  }
  return { ok: true, data: parsed.data };
}

function jsonError(status: number, message: string) {
  return {
    ok: false as const,
    response: new Response(JSON.stringify({ error: message }), {
      status,
      headers: { "content-type": "application/json" },
    }),
  };
}
