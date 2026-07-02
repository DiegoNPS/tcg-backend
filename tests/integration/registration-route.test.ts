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

describe("POST /api/auth/register", () => {
  beforeEach(() => {
    createClientMock.mockReset();
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  it("rechaza datos incompletos antes de consultar Supabase", async () => {
    const response = await POST(request({ email: "invalido" }));

    expect(response.status).toBe(400);
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("crea la cuenta y conserva un destino interno seguro", async () => {
    const signUp = vi.fn().mockResolvedValue({ data: { session: { access_token: "fake" } }, error: null });
    createClientMock.mockResolvedValue({ auth: { signUp } });

    const response = await POST(request(validRegistration));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.redirectTo).toBe("/torneos");
    expect(body.verificationRequired).toBe(false);
    expect(signUp).toHaveBeenCalledWith(expect.objectContaining({
      email: "nuevo@example.com",
      options: expect.objectContaining({
        emailRedirectTo: "http://localhost:3000/auth/callback?next=%2Ftorneos",
      }),
    }));
  });

  it("bloquea una redirección externa durante el registro", async () => {
    const signUp = vi.fn().mockResolvedValue({ data: { session: { access_token: "fake" } }, error: null });
    createClientMock.mockResolvedValue({ auth: { signUp } });

    const response = await POST(request({ ...validRegistration, nextPath: "//malicioso.example" }));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({ redirectTo: "/" });
  });
});
