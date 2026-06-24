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

import { POST } from "@/app/api/admin/roles/route";

const adminId = "11111111-1111-4111-8111-111111111111";

function request(userId: string, role: "jugador" | "tienda" | "admin") {
  return new Request("http://localhost:3001/api/admin/roles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, role }),
  });
}

describe("POST /api/admin/roles", () => {
  beforeEach(() => {
    getAdminContextMock.mockReset();
    createAdminClientMock.mockReset();
  });

  it("impide que el administrador quite su propio acceso", async () => {
    getAdminContextMock.mockResolvedValue({
      user: { id: adminId },
      isAdmin: true,
    });

    const response = await POST(request(adminId, "jugador"));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "No puedes quitar tu propio acceso de administrador.",
    });
    expect(createAdminClientMock).not.toHaveBeenCalled();
  });
});
