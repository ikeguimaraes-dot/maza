import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing environment variables!");
  process.exit(1);
}

const supabase = createClient(url, serviceKey);

async function run() {
  const { data, error } = await supabase
    .from("units")
    .select("id, name, latitude, longitude, geofence_radius_m");

  if (error) {
    console.error("Error fetching units:", error);
    return;
  }

  console.log("Current units in database:");
  console.log(JSON.stringify(data, null, 2));
}

run();
