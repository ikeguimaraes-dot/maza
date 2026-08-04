import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing environment variables!");
  process.exit(1);
}

const supabase = createClient(url, serviceKey);

async function run() {
  // Update Meet & Eat
  const { data: d1, error: e1 } = await supabase
    .from("units")
    .update({
      latitude: -23.5935,
      longitude: -46.6815,
      geofence_radius_m: 150
    })
    .eq("id", "674eac8c-5a38-4a42-aa60-0a666387909b");

  if (e1) {
    console.error("Error updating Meet & Eat:", e1);
  } else {
    console.log("Successfully updated Meet & Eat!");
  }

  // Update Madonna SP Itaim
  const { data: d2, error: e2 } = await supabase
    .from("units")
    .update({
      latitude: -23.5835,
      longitude: -46.6785,
      geofence_radius_m: 150
    })
    .eq("id", "f9c6c7fc-2ecc-4f79-98ce-c3118b670182");

  if (e2) {
    console.error("Error updating Madonna SP Itaim:", e2);
  } else {
    console.log("Successfully updated Madonna SP Itaim!");
  }

  // Fetch again
  const { data, error } = await supabase
    .from("units")
    .select("id, name, latitude, longitude, geofence_radius_m");

  if (error) {
    console.error("Error fetching units:", error);
    return;
  }

  console.log("Updated units in database:");
  console.log(JSON.stringify(data, null, 2));
}

run();
