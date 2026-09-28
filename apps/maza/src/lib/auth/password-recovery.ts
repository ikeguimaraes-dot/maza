import "server-only";

/** Ative somente depois de configurar e testar o SMTP do Supabase. */
export function isPasswordRecoveryEnabled(): boolean {
  return process.env.PASSWORD_RECOVERY_ENABLED === "true";
}
