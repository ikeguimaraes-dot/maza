import "server-only";
import type { CurrentUser } from "@kph/auth/server";

export const SHELL_USER: CurrentUser = {
  id: "shell-gate",
  email: "ike@kph.os",
  roles: [{ role: "founder", unitId: null, brandId: null, groupId: null }],
};
