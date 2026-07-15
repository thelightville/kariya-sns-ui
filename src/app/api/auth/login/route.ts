import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Direct K-SNS credential authentication is retired. Continue through Kariya Cloud.",
    },
    {
      status: 410,
      headers: {
        "cache-control": "no-store",
        "referrer-policy": "no-referrer",
      },
    }
  );
}
