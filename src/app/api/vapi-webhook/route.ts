import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const message = body?.message;

    // Only handle final report
    if (!message || message.type !== "end-of-call-report") {
      console.log("ℹ️ Skipping non-final event:", message?.type);
      return NextResponse.json({ ok: true });
    }

    // Extract values safely
    const callUuid = message.call?.id || null;
    const userId = message.assistant?.metadata?.userId || null;
    const agentId = message.assistant?.id || null;
    const duration = message.durationSeconds
      ? Math.round(message.durationSeconds)
      : null;
    const cost = message.cost ?? null;
    const transcript = message.transcript || null;
    const recordingUrl = message.recordingUrl || null;

    if (!userId || !callUuid) {
      console.error("❌ Missing required values", { userId, callUuid });
      return NextResponse.json(
        { error: "Missing userId or callUuid" },
        { status: 400 }
      );
    }

    // Insert into Supabase
    const { error } = await supabase.from("calls").insert({
      call_uuid: callUuid,
      user_id: userId,
      agent_id: agentId,
      duration,
      cost,
      transcript,
      recording_url: recordingUrl,
    });

    if (error) {
      console.error("❌ Supabase insert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(
      `✅ Final call inserted | user: ${userId} | call: ${callUuid}`
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("❌ Webhook handler failed:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
