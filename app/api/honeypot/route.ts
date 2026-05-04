import { NextResponse } from "next/server";
import { blockIp, getClientIpFromHeaders, honeypotCookieOptions } from "@/lib/security/edge";

export async function GET(request: Request) {
  const ip = getClientIpFromHeaders(request.headers);
  await blockIp(ip);

  const response = new NextResponse("Not found", { status: 404 });
  response.cookies.set("dragon_hp", "1", honeypotCookieOptions());
  return response;
}

export async function POST(request: Request) {
  return GET(request);
}
