import { forwardGoChat } from "@/lib/go-chat-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;
export const GET = forwardGoChat;
