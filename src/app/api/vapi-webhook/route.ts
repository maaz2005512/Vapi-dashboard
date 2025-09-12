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

    // We only care about "end-of-call-report" messages
    const messageType = body?.message?.type;
    if (messageType !== "end-of-call-report") {
      console.log("ℹ️ Skipping non-final event:", messageType);
      return NextResponse.json({ skipped: true }, { status: 200 });
    }

    // Extract call data
    const {
      id: callId,
      transcript,
      recordingUrl,
      startedAt,
      endedAt,
      cost,
      duration, // sometimes provided in ms
      message,
    } = body;

    // Pull userId from nested metadata
    const userId = message?.assistant?.metadata?.userId;

    if (!userId) {
      console.error("❌ Missing userId in message.assistant.metadata", body);
      return NextResponse.json(
        { error: "Missing userId in message.assistant.metadata" },
        { status: 400 }
      );
    }

    // Calculate duration (seconds) if not directly provided
    const callDuration =
      duration != null
        ? Math.floor(duration / 1000)
        : startedAt && endedAt
        ? Math.floor(
            (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000
          )
        : null;

    // Insert final call data
    const { error } = await supabase.from("calls").insert({
      call_uuid: callId,
      user_id: userId,
      transcript: transcript || null,
      recording_url: recordingUrl || null,
      duration: callDuration,
      cost: cost || null,
    });

    if (error) {
      console.error("❌ Error inserting call data:", error);
      return NextResponse.json(
        { error: "Error inserting call data", details: error },
        { status: 500 }
      );
    }

    console.log("✅ Final call inserted for user:", userId, "callId:", callId);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: any) {
    console.error("❌ Webhook handler failed:", err);
    return NextResponse.json(
      { error: "Webhook handler failed", details: err.message },
      { status: 500 }
    );
  }
}
