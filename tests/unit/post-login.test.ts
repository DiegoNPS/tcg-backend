import { describe, expect, it, vi } from "vitest";

import { resolvePostLoginPath } from "@/lib/auth/post-login";

type Scenario = {
  role: string | null;
  hasStore: boolean;
  expected: string;
};

function createSupabaseStub(role: string | null, hasStore: boolean) {
  const from = vi.fn((table: string) => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn(async () => {
          if (table === "profiles") {
            return { data: role ? { user_role: role } : null };
          }

          return { data: hasStore ? { id: "store-1" } : null };
        }),
      })),
    })),
  }));

  return { from };
}

describe("resolvePostLoginPath", () => {
  const scenarios: Scenario[] = [
    { role: "jugador", hasStore: false, expected: "/jugador/inscripciones" },
    { role: "admin", hasStore: false, expected: "/admin" },
    { role: null, hasStore: false, expected: "/torneos" },
    { role: "admin", hasStore: true, expected: "/tienda/dashboard" },
  ];

  it.each(scenarios)(
    "resuelve $expected para rol $role y tienda=$hasStore",
    async ({ role, hasStore, expected }) => {
      const supabase = createSupabaseStub(role, hasStore);

      const result = await resolvePostLoginPath(supabase as never, "user-1");

      expect(result).toBe(expected);
      expect(supabase.from).toHaveBeenCalledWith("profiles");
      expect(supabase.from).toHaveBeenCalledWith("tiendas");
    },
  );
});
