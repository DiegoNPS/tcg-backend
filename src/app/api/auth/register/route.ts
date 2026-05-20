import { z } from "zod";

import { AUTH_CALLBACK_PATH } from "@/lib/auth/routes";
import createAdminClient from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const registerSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(6).max(128),
  displayName: z.string().trim().min(2).max(80),
  address: z.string().trim().min(3).max(250),
  city: z.string().trim().min(2).max(100),
  stateRegion: z.string().trim().min(1).max(100),
  postalCode: z.string().trim().min(1).max(20),
  country: z.string().trim().min(2).max(100),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  acceptTerms: z.boolean(),
  receiveNews: z.boolean().default(false),
  nextPath: z.string().optional(),
});

function sanitizeNextPath(value?: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value;
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body JSON inválido" }, { status: 400 });
  }

  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ error: "Datos de registro inválidos" }, { status: 400 });
  }

  const supabase = await createClient();
  const admin = createAdminClient();
  const appBase = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  const callbackUrl = new URL(AUTH_CALLBACK_PATH, appBase);
  callbackUrl.searchParams.set("next", sanitizeNextPath(parsed.data.nextPath));
  const nextPath = sanitizeNextPath(parsed.data.nextPath);

  if (admin) {
    const { data: usersData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const normalizedEmail = parsed.data.email.trim().toLowerCase();
    const existingUser = usersData.users.find((user) => (user.email ?? "").trim().toLowerCase() === normalizedEmail);

    if (existingUser) {
      return Response.json({ error: "Este correo ya está en uso." }, { status: 409 });
    }
  }

  const userMetadata = {
    display_name: parsed.data.displayName,
    nombre_usuario: parsed.data.displayName,
    direccion: parsed.data.address,
    ciudad: parsed.data.city,
    estado_region: parsed.data.stateRegion,
    codigo_postal: parsed.data.postalCode,
    pais: parsed.data.country,
    latitud: parsed.data.latitude ?? null,
    longitud: parsed.data.longitude ?? null,
    accept_terms: parsed.data.acceptTerms,
    receive_news: parsed.data.receiveNews,
  };

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: callbackUrl.toString(),
      data: userMetadata,
    },
  });

  if (error) {
    if (/already registered|already been taken|already exists/i.test(error.message)) {
      return Response.json({ error: "Este correo ya está en uso." }, { status: 409 });
    }

    return Response.json({ error: error.message }, { status: 400 });
  }

  const verificationRequired = !data.session;

  return Response.json(
    {
      message: verificationRequired
        ? "Cuenta creada. Revisa tu correo y la carpeta de spam para verificar la cuenta."
        : "Cuenta creada y sesión iniciada.",
      redirectTo: verificationRequired ? null : nextPath,
      verificationRequired,
    },
    { status: 201 },
  );
}