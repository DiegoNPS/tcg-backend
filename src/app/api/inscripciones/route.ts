import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const inscripcionSchema = z.object({
  torneo_id: z.string().uuid(),
});

const cancelSchema = z.object({
  entry_id: z.string().uuid(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body JSON inválido" }, { status: 400 });
  }

  const parsed = inscripcionSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "Datos de inscripción inválidos", code: "torneo-invalido" },
      { status: 400 },
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("user_role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError || profile?.user_role !== "jugador") {
    return Response.json(
      { error: "Solo jugadores pueden inscribirse", code: "no-jugador" },
      { status: 403 },
    );
  }

  const { data, error } = await supabase
    .from("tournament_entries")
    .insert({
      torneo_id: parsed.data.torneo_id,
      entry_type: "solo",
      user_id: user.id,
      status: "registered",
    })
    .select("id, torneo_id, user_id, status, created_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      return Response.json(
        { error: "Ya estabas inscrito en este torneo", code: "existente" },
        { status: 409 },
      );
    }

    if (error.code === "42501") {
      return Response.json(
        { error: "Solo jugadores pueden inscribirse", code: "no-jugador" },
        { status: 403 },
      );
    }

    return Response.json(
      { error: "No se pudo completar la inscripción", code: "error" },
      { status: 400 },
    );
  }

  return Response.json({ data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body JSON inválido" }, { status: 400 });
  }

  const parsed = cancelSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "Datos inválidos" },
      { status: 400 },
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("user_role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError || profile?.user_role !== "jugador") {
    return Response.json(
      { error: "Solo jugadores pueden cancelar inscripciones" },
      { status: 403 },
    );
  }

  const { data: entry, error: entryError } = await supabase
    .from("tournament_entries")
    .select("id, torneo_id, status, user_id, entry_type")
    .eq("id", parsed.data.entry_id)
    .maybeSingle();

  if (entryError || !entry) {
    return Response.json({ error: "Inscripción no encontrada" }, { status: 404 });
  }

  if (entry.user_id !== user.id || entry.entry_type !== "solo") {
    return Response.json({ error: "No puedes modificar esta inscripción" }, { status: 403 });
  }

  if (entry.status === "dropped") {
    return Response.json({ error: "La inscripción ya está cancelada" }, { status: 409 });
  }

  const { data: torneo } = await supabase
    .from("torneos")
    .select("fecha_inicio")
    .eq("id", entry.torneo_id)
    .maybeSingle();

  if (torneo?.fecha_inicio) {
    const fechaInicio = new Date(torneo.fecha_inicio);
    if (Number.isFinite(fechaInicio.getTime()) && fechaInicio <= new Date()) {
      return Response.json({ error: "No puedes cancelar un torneo iniciado" }, { status: 409 });
    }
  }

  const { data: updated, error: updateError } = await supabase
    .from("tournament_entries")
    .update({ status: "dropped" })
    .eq("id", entry.id)
    .select("id, torneo_id, status")
    .single();

  if (updateError) {
    return Response.json({ error: "No se pudo cancelar la inscripción" }, { status: 400 });
  }

  return Response.json({ data: updated }, { status: 200 });
}