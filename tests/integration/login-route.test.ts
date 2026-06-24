import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

import { POST } from "@/app/api/auth/login/route";

function request(body: string) {
  return new Request("http://localhost:3001/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  it("rechaza un body que no es JSON", async () => {
    const response = await POST(request("no-es-json"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Body JSON inválido" });
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("rechaza credenciales con formato inválido antes de consultar Supabase", async () => {
    const response = await POST(request(JSON.stringify({ email: "correo-invalido", password: "" })));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Email y contraseña requeridos" });
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("traduce un fallo de autenticación a una respuesta 401 estable", async () => {
    const signInWithPassword = vi.fn().mockResolvedValue({ error: new Error("Invalid login credentials") });
    createClientMock.mockResolvedValue({ auth: { signInWithPassword } });

    const response = await POST(request(JSON.stringify({
      email: "jugador@example.com",
      password: "incorrecta",
    })));

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "password-login-failed" });
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "jugador@example.com",
      password: "incorrecta",
    });
  });

  it("inicia sesión y respeta un destino interno solicitado", async () => {
    const signInWithPassword = vi.fn().mockResolvedValue({ error: null });
    const getUser = vi.fn().mockResolvedValue({ data: { user: null } });
    createClientMock.mockResolvedValue({ auth: { signInWithPassword, getUser } });

    const response = await POST(request(JSON.stringify({
      email: "jugador@example.com",
      password: "secreto-seguro",
      nextPath: "/jugador/perfil",
    })));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      redirectTo: "/jugador/perfil",
    });
  });

  it("impide usar una URL externa como destino", async () => {
    const signInWithPassword = vi.fn().mockResolvedValue({ error: null });
    const getUser = vi.fn().mockResolvedValue({ data: { user: null } });
    createClientMock.mockResolvedValue({ auth: { signInWithPassword, getUser } });

    const response = await POST(request(JSON.stringify({
      email: "jugador@example.com",
      password: "secreto-seguro",
      nextPath: "//sitio-malicioso.example",
    })));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ redirectTo: "/torneos" });
  });
});
