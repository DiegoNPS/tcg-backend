import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

import { DELETE } from "@/app/api/tiendas/me/torneos/[id]/route";

const tournamentId = "44444444-4444-4444-8444-444444444444";
const storeId = "55555555-5555-4555-8555-555555555555";

function request() {
  return new Request(`http://localhost:3001/api/tiendas/me/torneos/${tournamentId}`, {
    method: "DELETE",
  });
}

function context(id = tournamentId) {
  return { params: Promise.resolve({ id }) };
}

function createQuery(data: unknown, error: Error | null = null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data, error });
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  return { select, eq, maybeSingle };
}

function createDeleteQuery(data: unknown, error: Error | null = null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data, error });
  const select = vi.fn(() => ({ maybeSingle }));
  const eq = vi.fn(() => ({ select }));
  const deleteFn = vi.fn(() => ({ eq }));
  return { deleteFn, eq, select, maybeSingle };
}

function createSupabaseStub({
  user,
  torneo,
  tienda,
  deleted,
}: {
  user: { id: string } | null;
  torneo: unknown;
  tienda: unknown;
  deleted: unknown;
}) {
  const torneoQuery = createQuery(torneo);
  const tiendaQuery = createQuery(tienda);
  const deleteQuery = createDeleteQuery(deleted);
  const from = vi.fn((table: string) => {
    if (table === "torneos") {
      return {
        select: torneoQuery.select,
        delete: deleteQuery.deleteFn,
      };
    }

    if (table === "tiendas") {
      return { select: tiendaQuery.select };
    }

    return {};
  });

  return {
    client: {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user },
          error: user ? null : new Error("not-authenticated"),
        }),
      },
      from,
    },
    deleteFn: deleteQuery.deleteFn,
    deleteEq: deleteQuery.eq,
  };
}

describe("DELETE /api/tiendas/me/torneos/:id", () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  it("rechaza una sesion no autenticada", async () => {
    createClientMock.mockResolvedValue(createSupabaseStub({
      user: null,
      torneo: null,
      tienda: null,
      deleted: null,
    }).client);

    const response = await DELETE(request(), context());

    expect(response.status).toBe(401);
  });

  it("rechaza borrar torneos de otra tienda", async () => {
    const supabase = createSupabaseStub({
      user: { id: "owner-1" },
      torneo: { id: tournamentId, tienda_id: storeId },
      tienda: { owner_id: "owner-2" },
      deleted: { id: tournamentId },
    });
    createClientMock.mockResolvedValue(supabase.client);

    const response = await DELETE(request(), context());

    expect(response.status).toBe(403);
    expect(supabase.deleteFn).not.toHaveBeenCalled();
  });

  it("elimina el torneo cuando pertenece a la tienda autenticada", async () => {
    const supabase = createSupabaseStub({
      user: { id: "owner-1" },
      torneo: { id: tournamentId, tienda_id: storeId },
      tienda: { owner_id: "owner-1" },
      deleted: { id: tournamentId },
    });
    createClientMock.mockResolvedValue(supabase.client);

    const response = await DELETE(request(), context());

    expect(response.status).toBe(200);
    expect(supabase.deleteFn).toHaveBeenCalled();
    expect(supabase.deleteEq).toHaveBeenCalledWith("id", tournamentId);
  });
});
