import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClientMock, createAdminClientMock, getAdminContextMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  createAdminClientMock: vi.fn(),
  getAdminContextMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));
vi.mock("@/lib/supabase/admin", () => ({ default: createAdminClientMock }));
vi.mock("@/lib/auth/admin", () => ({ getAdminContext: getAdminContextMock }));

import { GET as GET_DASHBOARD } from "@/app/api/admin/dashboard/route";
import { POST as CREATE_GAME } from "@/app/api/admin/juegos/route";
import { POST as CREATE_USER } from "@/app/api/admin/users/route";

const user = { id: "11111111-1111-4111-8111-111111111111" };

function request(path: string, body: unknown) {
  return new Request("http://localhost:3001" + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function profileQuery(role: string) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: { user_role: role }, error: null });
  return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })) };
}

describe("rutas administrativas pendientes", () => {
  beforeEach(() => {
    createClientMock.mockReset();
    createAdminClientMock.mockReset();
    getAdminContextMock.mockReset();
  });

  it("GET /api/admin/dashboard exige autenticación", async () => {
    createClientMock.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: new Error("no-session") }) },
    });

    const response = await GET_DASHBOARD();

    expect(response.status).toBe(401);
    expect(createAdminClientMock).not.toHaveBeenCalled();
  });

  it("GET /api/admin/dashboard informa cuando falta la service role", async () => {
    const profile = profileQuery("admin");
    createClientMock.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
      from: vi.fn(() => profile),
    });
    createAdminClientMock.mockReturnValue(null);

    const response = await GET_DASHBOARD();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ code: "missing-service-role" });
  });

  it("POST /api/admin/juegos normaliza la clave y crea el catálogo", async () => {
    const profile = profileQuery("admin");
    const single = vi.fn().mockResolvedValue({
      data: { id: "game-1", key: "pokemon_tcg_pocket", nombre: "Pokémon TCG Pocket" },
      error: null,
    });
    const insert = vi.fn(() => ({ select: vi.fn(() => ({ single })) }));
    createClientMock.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
      from: vi.fn(() => profile),
    });
    createAdminClientMock.mockReturnValue({ from: vi.fn(() => ({ insert })) });

    const response = await CREATE_GAME(request("/api/admin/juegos", { nombre: "Pokémon TCG Pocket" }));

    expect(response.status).toBe(201);
    expect(insert).toHaveBeenCalledWith({
      key: "pokemon_tcg_pocket",
      nombre: "Pokémon TCG Pocket",
      descripcion: null,
    });
  });

  it("POST /api/admin/users crea usuarios únicamente con contexto administrador", async () => {
    const createUser = vi.fn().mockResolvedValue({
      data: { user: { id: "new-user", email: "nuevo@example.com" } },
      error: null,
    });
    getAdminContextMock.mockResolvedValue({ user, isAdmin: true });
    createAdminClientMock.mockReturnValue({ auth: { admin: { createUser } } });

    const response = await CREATE_USER(request("/api/admin/users", {
      email: "nuevo@example.com",
      password: "secreto-seguro",
      user_metadata: { display_name: "Nuevo" },
    }));

    expect(response.status).toBe(201);
    expect(createUser).toHaveBeenCalledWith({
      email: "nuevo@example.com",
      password: "secreto-seguro",
      user_metadata: { display_name: "Nuevo" },
    });
  });
});
