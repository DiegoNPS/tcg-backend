import { z } from "zod";

import { AUTH_CALLBACK_PATH } from "@/lib/auth/routes";
import { createClient } from "@/lib/supabase/server";

const resetSchema = z.object({ email: z.string().trim().email() });

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body JSON inválido" }, { status: 400 });
  }

  const parsed = resetSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Email inválido" }, { status: 400 });
  }

  const supabase = await createClient();
  const appBase = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  const callbackUrl = new URL(AUTH_CALLBACK_PATH, appBase);

  try {
    // send reset email
    // supabase-js exposes resetPasswordForEmail
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: callbackUrl.toString(),
    });

    if (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    return Response.json({ message: "Email de recuperación enviado" }, { status: 200 });
  } catch {
    return Response.json({ error: "No se pudo iniciar recuperación" }, { status: 500 });
  }
}
