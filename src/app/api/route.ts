import { NextResponse } from "next/server";

/**
 * Sağlık kontrolü endpointi.
 * Sunucunun ayakta olduğunu doğrulamak için kullanılır.
 */
export function GET() {
  return NextResponse.json({ status: "ok" });
}
