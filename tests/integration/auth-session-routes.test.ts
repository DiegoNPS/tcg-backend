import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

import { GET, PUT } from "@/app/api/auth/me/route";
import { POST as LOGOUT } from "@/app/api/auth/logout/route";

const user = { id: "11111111-1111-4111-8111-111111111111", email: "jugador@example.com" };

function jsonRequest(body: unknown) {
  return new Request("http://localhost:3001/api/auth/me", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function queryResult(data: unknown, error: unknown = null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data, error });
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  return { select, eq, maybeSingle };
}

describe("rutas de sesión y perfil", () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  it("GET /api/auth/me rechaza una solicitud sin sesión", async () => {
    createClientMock.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: new Error("no-session") }) },
    });

    const response = await GET();

    expect(response.status).toBe(401);
  });

  it("GET /api/auth/me entrega el perfil y detecta la tienda", async () => {
    const profile = queryResult({ display_name: "Jugador Uno", user_role: "jugador", created_at: "2026-01-01" });
    const store = queryResult({ id: "store-1" });
    createClientMock.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
      from: vi.fn((table: string) => ({ select: table === "profiles" ? profile.select : store.select })),
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.user.email).toBe("jugador@example.com");
    expect(body.data.profile.user_role).toBe("jugador");
    expect(body.data.isTienda).toBe(true);
  });

  it("PUT /api/auth/me impide que el usuario cambie su propio rol", async () => {
    const currentProfile = queryResult({ user_role: "jugador" });
    createClientMock.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
      from: vi.fn(() => ({ select: currentProfile.select })),
    });

    const response = await PUT(jsonRequest({ display_name: "Jugador Uno", user_role: "admin" }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: expect.stringContaining("Cambio de rol") });
  });

  it("POST /api/auth/logout cierra la sesión", async () => {
    const signOut = vi.fn().mockResolvedValue({ error: null });
    createClientMock.mockResolvedValue({ auth: { signOut } });

    const response = await LOGOUT();

    expect(response.status).toBe(200);
    expect(signOut).toHaveBeenCalledOnce();
    await expect(response.json()).resolves.toEqual({ ok: true });
  });
});
