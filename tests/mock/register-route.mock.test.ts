import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

import { POST } from "@/app/api/auth/register/route";

const validRegistration = {
  email: "nuevo@example.com",
  password: "secreto-seguro",
  displayName: "Nuevo jugador",
  address: "Av. Siempre Viva 123",
  city: "Santiago",
  stateRegion: "Metropolitana",
  postalCode: "8320000",
  country: "Chile",
  latitude: -33.45,
  longitude: -70.66,
  acceptTerms: true,
  receiveNews: false,
  nextPath: "/torneos",
};

function request(body: unknown) {
  return new Request("http://localhost:3001/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/register usando mock de Supabase", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    createClientMock.mockReset();
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  it("envía a Supabase los datos normalizados sin registrar un usuario real", async () => {
    const signUp = vi.fn().mockResolvedValue({
      data: { session: { access_token: "token-falso" } },
      error: null,
    });
    createClientMock.mockResolvedValue({ auth: { signUp } });

    const response = await POST(request(validRegistration));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      verificationRequired: false,
      redirectTo: "/torneos",
    });
    expect(signUp).toHaveBeenCalledOnce();
    expect(signUp).toHaveBeenCalledWith(expect.objectContaining({
      email: "nuevo@example.com",
      password: "secreto-seguro",
      options: expect.objectContaining({
        emailRedirectTo: "http://localhost:3000/auth/callback?next=%2Ftorneos",
        data: expect.objectContaining({
          display_name: "Nuevo jugador",
          ciudad: "Santiago",
          accept_terms: true,
        }),
      }),
    }));
  });

  it("simula un correo duplicado y responde 409", async () => {
    const signUp = vi.fn().mockResolvedValue({
      data: { session: null },
      error: new Error("User already registered"),
    });
    createClientMock.mockResolvedValue({ auth: { signUp } });

    const response = await POST(request(validRegistration));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "Este correo ya está en uso." });
  });
});
