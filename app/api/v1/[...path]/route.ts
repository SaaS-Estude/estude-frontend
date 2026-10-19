import { forwardGoApi } from "@/lib/go-api-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;
export const GET = forwardGoApi;
export const POST = forwardGoApi;
export const PUT = forwardGoApi;
export const PATCH = forwardGoApi;
export const DELETE = forwardGoApi;
export const HEAD = forwardGoApi;
export const OPTIONS = forwardGoApi;
