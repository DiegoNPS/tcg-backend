import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

import { PUT as CHANGE_PASSWORD } from "@/app/api/auth/password-change/route";
import { POST as RESET_PASSWORD } from "@/app/api/auth/password-reset/route";
import { POST as CONFIRM_RESET } from "@/app/api/auth/password-reset/confirm/route";

const user = { id: "11111111-1111-4111-8111-111111111111" };
const otherUserId = "22222222-2222-4222-8222-222222222222";

function request(path: string, method: string, body: unknown) {
  return new Request("http://localhost:3001" + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("rutas de contraseña", () => {
  beforeEach(() => {
    createClientMock.mockReset();
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  it("PUT /api/auth/password-change exige una sesión", async () => {
    createClientMock.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: new Error("no-session") }) },
    });

    const response = await CHANGE_PASSWORD(request("/api/auth/password-change", "PUT", { new_password: "secreto-nuevo" }));

    expect(response.status).toBe(401);
  });

  it("PUT /api/auth/password-change actualiza una contraseña válida", async () => {
    const updateUser = vi.fn().mockResolvedValue({ error: null });
    createClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
        updateUser,
      },
    });

    const response = await CHANGE_PASSWORD(request("/api/auth/password-change", "PUT", { new_password: "secreto-nuevo" }));

    expect(response.status).toBe(200);
    expect(updateUser).toHaveBeenCalledWith({ password: "secreto-nuevo" });
  });

  it("POST /api/auth/password-reset genera el callback correcto", async () => {
    const resetPasswordForEmail = vi.fn().mockResolvedValue({ error: null });
    createClientMock.mockResolvedValue({ auth: { resetPasswordForEmail } });

    const response = await RESET_PASSWORD(request("/api/auth/password-reset", "POST", { email: "jugador@example.com" }));

    expect(response.status).toBe(200);
    expect(resetPasswordForEmail).toHaveBeenCalledWith("jugador@example.com", {
      redirectTo: "http://localhost:3000/auth/callback?next=%2Freset-password",
    });
  });

  it("POST /api/auth/password-reset/confirm impide modificar otra cuenta", async () => {
    createClientMock.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
    });

    const response = await CONFIRM_RESET(request("/api/auth/password-reset/confirm", "POST", {
      user_id: otherUserId,
      new_password: "secreto-nuevo",
    }));

    expect(response.status).toBe(403);
  });

  it("POST /api/auth/password-reset/confirm actualiza y cierra la sesión de recuperación", async () => {
    const updateUser = vi.fn().mockResolvedValue({ data: { user }, error: null });
    const signOut = vi.fn().mockResolvedValue({ error: null });
    createClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
        updateUser,
        signOut,
      },
    });

    const response = await CONFIRM_RESET(request("/api/auth/password-reset/confirm", "POST", {
      user_id: user.id,
      new_password: "secreto-nuevo",
    }));

    expect(response.status).toBe(200);
    expect(updateUser).toHaveBeenCalledWith({ password: "secreto-nuevo" });
    expect(signOut).toHaveBeenCalledOnce();
  });
});
