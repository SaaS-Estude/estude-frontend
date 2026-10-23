export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ service: "estude-tenant-frontend" }, {
    headers: { "Cache-Control": "no-store" },
  });
}
