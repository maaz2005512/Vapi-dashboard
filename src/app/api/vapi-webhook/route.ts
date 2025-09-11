import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Supabase client with service role (server-side only, never expose this key to client)
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export async function POST(req: NextRequest) {
  try {
    const callData = await req.json();

    // Example log so you can check what Vapi sends
    console.log("Incoming Vapi webhook data:", callData);

    // Map Vapi fields into Supabase "calls" table
    const { data, error } = await supabase.from("calls").insert([
      {
         // removed `id`, let Postgres handle it
        agent_id: callData.agentId,         // which agent handled the call
        user_id: callData.metadata?.userId, // optional: if you attach userId metadata in Vapi
        duration: callData.duration,
        transcript: callData.transcript,
        recording_url: callData.recordingUrl,
        cost: callData.cost,
        created_at: new Date().toISOString(),
      },
    ]);

    if (error) {
      console.error("Error inserting call data:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      message: "Call data saved successfully",
      data,
    });
  } catch (err: any) {
    console.error("Webhook error:", err.message);
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
