// src/app/api/vapi-webhook/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // 👈 service key needed to insert
);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Destructure what we need from VAPI webhook payload
    const {
      id: callId,
      transcript,
      metadata,
      analysis,
      status,
      startedAt,
      endedAt,
    } = body;

    // Grab the userId we set in VAPI agent.metadata
    const userId = metadata?.userId;

    if (!userId) {
      console.error("❌ Missing userId in metadata", body);
      return NextResponse.json(
        { error: "Missing userId in VAPI metadata" },
        { status: 400 }
      );
    }

    // Insert into Supabase
    const { error } = await supabase.from("calls").insert({
      call_id: callId,
      user_id: userId,
      transcript: transcript || null,
      analysis: analysis || null,
      status: status || "unknown",
      started_at: startedAt ? new Date(startedAt).toISOString() : null,
      ended_at: endedAt ? new Date(endedAt).toISOString() : null,
    });

    if (error) {
      console.error("❌ Error inserting call data:", error);
      return NextResponse.json(
        { error: "Error inserting call data", details: error },
        { status: 500 }
      );
    }

    console.log("✅ Call inserted for user:", userId, "callId:", callId);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: any) {
    console.error("❌ Webhook handler failed:", err);
    return NextResponse.json(
      { error: "Webhook handler failed", details: err.message },
      { status: 500 }
    );
  }
}
