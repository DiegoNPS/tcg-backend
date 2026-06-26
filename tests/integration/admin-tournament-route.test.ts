import { beforeEach, describe, expect, it, vi } from "vitest";

const { getAdminContextMock, createAdminClientMock } = vi.hoisted(() => ({
  getAdminContextMock: vi.fn(),
  createAdminClientMock: vi.fn(),
}));

vi.mock("@/lib/auth/admin", () => ({
  getAdminContext: getAdminContextMock,
}));

vi.mock("@/lib/supabase/admin", () => ({
  default: createAdminClientMock,
}));

import { DELETE, PATCH } from "@/app/api/admin/torneos/[id]/route";

const tournamentId = "44444444-4444-4444-8444-444444444444";

function request(body: unknown) {
  return new Request(`http://localhost:3001/api/admin/torneos/${tournamentId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function deleteRequest() {
  return new Request(`http://localhost:3001/api/admin/torneos/${tournamentId}`, {
    method: "DELETE",
  });
}

function context(id = tournamentId) {
  return { params: Promise.resolve({ id }) };
}

function createAdminStub(data: unknown) {
  const maybeSingle = vi.fn().mockResolvedValue({ data, error: null });
  const select = vi.fn(() => ({ maybeSingle }));
  const eq = vi.fn(() => ({ select }));
  const update = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ update }));
  return { client: { from }, update, eq };
}

function createAdminDeleteStub(data: unknown) {
  const maybeSingle = vi.fn().mockResolvedValue({ data, error: null });
  const select = vi.fn(() => ({ maybeSingle }));
  const eq = vi.fn(() => ({ select }));
  const deleteFn = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ delete: deleteFn }));
  return { client: { from }, deleteFn, eq };
}

describe("PATCH /api/admin/torneos/:id", () => {
  beforeEach(() => {
    getAdminContextMock.mockReset();
    createAdminClientMock.mockReset();
  });

  it("rechaza una sesión no autenticada", async () => {
    getAdminContextMock.mockResolvedValue({ user: null, isAdmin: false });

    const response = await PATCH(request({ publicado: true }), context());

    expect(response.status).toBe(401);
    expect(createAdminClientMock).not.toHaveBeenCalled();
  });

  it("rechaza a un usuario sin rol administrador", async () => {
    getAdminContextMock.mockResolvedValue({ user: { id: "user-1" }, isAdmin: false });

    const response = await PATCH(request({ publicado: true }), context());

    expect(response.status).toBe(403);
  });

  it("publica un torneo usando el cliente administrativo", async () => {
    getAdminContextMock.mockResolvedValue({ user: { id: "admin-1" }, isAdmin: true });
    const admin = createAdminStub({ id: tournamentId, titulo: "Commander Night", publicado: true });
    createAdminClientMock.mockReturnValue(admin.client);

    const response = await PATCH(request({ publicado: true }), context());

    expect(response.status).toBe(200);
    expect(admin.update).toHaveBeenCalledWith({ publicado: true });
    expect(admin.eq).toHaveBeenCalledWith("id", tournamentId);
  });

  it("responde 404 cuando el torneo no existe", async () => {
    getAdminContextMock.mockResolvedValue({ user: { id: "admin-1" }, isAdmin: true });
    createAdminClientMock.mockReturnValue(createAdminStub(null).client);

    const response = await PATCH(request({ publicado: true }), context());

    expect(response.status).toBe(404);
  });
});

describe("DELETE /api/admin/torneos/:id", () => {
  beforeEach(() => {
    getAdminContextMock.mockReset();
    createAdminClientMock.mockReset();
  });

  it("rechaza una sesion no autenticada", async () => {
    getAdminContextMock.mockResolvedValue({ user: null, isAdmin: false });

    const response = await DELETE(deleteRequest(), context());

    expect(response.status).toBe(401);
    expect(createAdminClientMock).not.toHaveBeenCalled();
  });

  it("rechaza a un usuario sin rol administrador", async () => {
    getAdminContextMock.mockResolvedValue({ user: { id: "user-1" }, isAdmin: false });

    const response = await DELETE(deleteRequest(), context());

    expect(response.status).toBe(403);
  });

  it("elimina un torneo usando el cliente administrativo", async () => {
    getAdminContextMock.mockResolvedValue({ user: { id: "admin-1" }, isAdmin: true });
    const admin = createAdminDeleteStub({ id: tournamentId, titulo: "Commander Night" });
    createAdminClientMock.mockReturnValue(admin.client);

    const response = await DELETE(deleteRequest(), context());

    expect(response.status).toBe(200);
    expect(admin.deleteFn).toHaveBeenCalled();
    expect(admin.eq).toHaveBeenCalledWith("id", tournamentId);
  });

  it("responde 404 cuando el torneo a eliminar no existe", async () => {
    getAdminContextMock.mockResolvedValue({ user: { id: "admin-1" }, isAdmin: true });
    createAdminClientMock.mockReturnValue(createAdminDeleteStub(null).client);

    const response = await DELETE(deleteRequest(), context());

    expect(response.status).toBe(404);
  });
});
