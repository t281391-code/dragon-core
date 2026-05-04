import { NextResponse } from "next/server";
import { destroySession } from "@/lib/session";

export const preferredRegion = "hkg1";

export async function POST() {
  await destroySession();
  return NextResponse.json({ ok: true });
}
