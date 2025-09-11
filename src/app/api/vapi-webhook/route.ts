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

    // Extract the call data we need
    const {
      id: callId,
      transcript,
      recordingUrl,
      startedAt,
      endedAt,
      cost,
      duration,
      message, // <--- full message object
    } = body;

    // Pull userId from message.assistant.metadata
    const userId = message?.assistant?.metadata?.userId;

    if (!userId) {
      console.error("❌ Missing userId in message.assistant.metadata", body);
      return NextResponse.json(
        { error: "Missing userId in message.assistant.metadata" },
        { status: 400 }
      );
    }

    // Calculate duration in seconds if not provided
    const callDuration = duration
      ? Math.floor(duration / 1000)
      : startedAt && endedAt
      ? Math.floor(new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000
      : null;

    // Insert into Supabase
    const { error } = await supabase.from("calls").insert({
      call_uuid: callId,
      user_id: userId,
      transcript: transcript || null,
      recording_url: recordingUrl || null,
      duration: callDuration || null,
      cost: cost || null,
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
