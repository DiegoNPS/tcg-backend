import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("categorias_torneo").select("id, key, nombre, descripcion").order("nombre", { ascending: true });
  if (error) return Response.json({ error: "No se pudieron cargar las categorías" }, { status: 500 });
  return Response.json({ data }, { status: 200 });
}
