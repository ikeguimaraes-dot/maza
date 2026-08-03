import type { CurrentUser } from "@kph/auth/server";

export const SHELL_USER: CurrentUser = {
  id: "shell-gate",
  email: "admin@maza.com.br",
  displayName: "Administrador Maza",
  roles: [{ role: "founder", unitId: null, brandId: null, groupId: null }],
};
