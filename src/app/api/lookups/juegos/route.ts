import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("juegos").select("id, key, nombre, descripcion").order("nombre", { ascending: true });
  if (error) return Response.json({ error: "No se pudieron cargar los juegos" }, { status: 500 });
  return Response.json({ data }, { status: 200 });
}
