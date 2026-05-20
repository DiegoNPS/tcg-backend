import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("ciudades").select("id, nombre").order("nombre", { ascending: true });
  if (error) return Response.json({ error: "No se pudieron cargar las ciudades" }, { status: 500 });
  return Response.json({ data }, { status: 200 });
}
