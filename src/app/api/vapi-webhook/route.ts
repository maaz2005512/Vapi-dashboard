// src/app/api/vapi-webhook/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // service key needed to insert
);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Extract basic call info
    const callId = body?.id || body?.message?.call?.id || null;
    const transcript = body?.transcript || body?.message?.transcript || null;
    const analysis = body?.analysis || body?.message?.analysis || null;
    const status = body?.status || body?.message?.status || "unknown";
    const startedAt = body?.startedAt || body?.message?.startedAt || null;
    const endedAt = body?.endedAt || body?.message?.endedAt || null;

    // Grab the userId from assistant.metadata
    const userId = body?.message?.assistant?.metadata?.userId;

    if (!userId) {
      console.error("❌ Missing userId in assistant.metadata", body);
      return NextResponse.json(
        { error: "Missing userId in VAPI assistant.metadata" },
        { status: 400 }
      );
    }

    // Insert into Supabase
    const { error } = await supabase.from("calls").insert({
      call_id: callId,
      user_id: userId,
      transcript: transcript || null,
      analysis: analysis || null,
      status,
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
