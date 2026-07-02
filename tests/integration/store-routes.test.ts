import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClientMock } = vi.hoisted(() => ({ createClientMock: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));

import { POST } from "@/app/api/tiendas/route";
import { GET } from "@/app/api/tiendas/me/route";

const user = { id: "11111111-1111-4111-8111-111111111111" };
const cityId = "77777777-7777-4777-8777-777777777777";
const storeId = "55555555-5555-4555-8555-555555555555";

function request(body: unknown) {
  return new Request("http://localhost:3001/api/tiendas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function maybeSingleOf(data: unknown, error: unknown = null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data, error });
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  return { select };
}

describe("rutas de tiendas", () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  it("POST /api/tiendas exige autenticación", async () => {
    createClientMock.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: new Error("no-session") }) },
    });

    const response = await POST(request({ nombre: "Arena TCG", ciudad: "Santiago" }));

    expect(response.status).toBe(401);
  });

  it("POST /api/tiendas resuelve la ciudad y crea la tienda", async () => {
    const single = vi.fn().mockResolvedValue({
      data: { id: storeId, owner_id: user.id, nombre: "Arena TCG", ciudad_id: cityId },
      error: null,
    });
    const insert = vi.fn(() => ({ select: vi.fn(() => ({ single })) }));
    const city = maybeSingleOf({ nombre: "Santiago" });
    const rpc = vi.fn().mockResolvedValue({ data: cityId, error: null });
    createClientMock.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
      rpc,
      from: vi.fn((table: string) => table === "tiendas" ? { insert } : { select: city.select }),
    });

    const response = await POST(request({ nombre: "Arena TCG", ciudad: "Santiago" }));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(rpc).toHaveBeenCalledWith("get_or_create_ciudad", { p_nombre: "Santiago" });
    expect(body.data.ciudad).toBe("Santiago");
  });

  it("GET /api/tiendas/me devuelve la tienda y su ciudad", async () => {
    const store = maybeSingleOf({ id: storeId, nombre: "Arena TCG", ciudad_id: cityId });
    const city = maybeSingleOf({ nombre: "Santiago" });
    createClientMock.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
      from: vi.fn((table: string) => ({ select: table === "tiendas" ? store.select : city.select })),
    });

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: { id: storeId, nombre: "Arena TCG", ciudad: "Santiago" },
    });
  });
});
