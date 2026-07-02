import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClientMock, createAdminClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  createAdminClientMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));
vi.mock("@/lib/supabase/admin", () => ({ default: createAdminClientMock }));

import { PATCH, POST } from "@/app/api/inscripciones/route";
import { GET as GET_MINE } from "@/app/api/inscripciones/me/route";

const user = { id: "11111111-1111-4111-8111-111111111111" };
const tournamentId = "44444444-4444-4444-8444-444444444444";
const entryId = "66666666-6666-4666-8666-666666666666";

function request(method: string, body: unknown) {
  return new Request("http://localhost:3001/api/inscripciones", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function maybeSingleOf(data: unknown, error: unknown = null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data, error });
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  return { select, eq, maybeSingle };
}

function insertOf(data: unknown, error: unknown = null) {
  const single = vi.fn().mockResolvedValue({ data, error });
  const select = vi.fn(() => ({ single }));
  const insert = vi.fn(() => ({ select }));
  return { insert, single };
}

describe("rutas de inscripciones", () => {
  beforeEach(() => {
    createClientMock.mockReset();
    createAdminClientMock.mockReset();
    createAdminClientMock.mockReturnValue(null);
  });

  it("POST /api/inscripciones exige autenticación", async () => {
    createClientMock.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: new Error("no-session") }) },
    });

    const response = await POST(request("POST", { torneo_id: tournamentId }));

    expect(response.status).toBe(401);
  });

  it("POST /api/inscripciones traduce una inscripción duplicada a 409", async () => {
    const profile = maybeSingleOf({ user_role: "jugador" });
    const tournament = maybeSingleOf({ id: tournamentId, publicado: true, fecha_inicio: "2099-07-01T18:00:00.000Z" });
    const insertion = insertOf(null, { code: "23505", message: "duplicate" });
    createClientMock.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
      from: vi.fn((table: string) => {
        if (table === "profiles") return { select: profile.select };
        if (table === "torneos") return { select: tournament.select };
        return { insert: insertion.insert };
      }),
    });

    const response = await POST(request("POST", { torneo_id: tournamentId }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: "existente" });
  });

  it("PATCH /api/inscripciones cancela una inscripción propia y futura", async () => {
    const profile = maybeSingleOf({ user_role: "jugador" });
    const entry = maybeSingleOf({ id: entryId, torneo_id: tournamentId, status: "registered", user_id: user.id, entry_type: "solo" });
    const tournament = maybeSingleOf({ fecha_inicio: "2099-07-01T18:00:00.000Z" });
    const single = vi.fn().mockResolvedValue({ data: { id: entryId, torneo_id: tournamentId, status: "dropped" }, error: null });
    const update = vi.fn(() => ({ eq: vi.fn(() => ({ select: vi.fn(() => ({ single })) })) }));
    createClientMock.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
      from: vi.fn((table: string) => {
        if (table === "profiles") return { select: profile.select };
        if (table === "torneos") return { select: tournament.select };
        return { select: entry.select, update };
      }),
    });

    const response = await PATCH(request("PATCH", { entry_id: entryId }));

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith({ status: "dropped" });
  });

  it("GET /api/inscripciones/me lista las inscripciones del usuario", async () => {
    const entries = [{ id: entryId, torneo_id: tournamentId, status: "registered", entry_type: "solo", created_at: "2026-06-01" }];
    const order = vi.fn().mockResolvedValue({ data: entries, error: null });
    const eq = vi.fn(() => ({ order }));
    const select = vi.fn(() => ({ eq }));
    createClientMock.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
      from: vi.fn(() => ({ select })),
    });

    const response = await GET_MINE(new Request("http://localhost:3001/api/inscripciones/me"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: entries });
  });
});
