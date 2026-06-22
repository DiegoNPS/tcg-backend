import { z } from "zod";

import { resolvePostLoginPath } from "@/lib/auth/post-login";
import { createClient } from "@/lib/supabase/server";

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
  nextPath: z.string().optional(),
});

function sanitizeNextPath(value?: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

const PASSWORD_LOGIN_ERROR =
  "No pudimos iniciar sesión con correo y contraseña. Si tu cuenta fue creada con Google, usa Continuar con Google; si tiene contraseña, revisa los datos e intenta nuevamente.";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body JSON inválido" }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ error: "Email y contraseña requeridos" }, { status: 400 });
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return Response.json(
      {
        error: PASSWORD_LOGIN_ERROR,
        code: "password-login-failed",
      },
      { status: 401 },
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const requestedPath = sanitizeNextPath(parsed.data.nextPath);
  const redirectTo = requestedPath ?? (user ? await resolvePostLoginPath(supabase, user.id) : "/torneos");

  return Response.json(
    { message: "Sesión iniciada correctamente", redirectTo },
    { status: 200 },
  );
}
