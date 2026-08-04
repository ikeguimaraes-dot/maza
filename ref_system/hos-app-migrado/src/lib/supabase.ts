import { createClient } from '@supabase/supabase-js';

// Maza — projeto maza-dev
// Migrado em 2026-04-27 do projeto HOS antigo (afxsrcezmetipzgosdvb)
// para o Maza (iqgrvptrtphvbmvrqntm).
const supabaseUrl = 'https://iqgrvptrtphvbmvrqntm.supabase.co';

// SERVICE ROLE: o app autentica manualmente via tabela employee_auth (CPF + senha)
// e nao usa Supabase Auth. Para escrever em tabelas com RLS sem criar sessao Supabase,
// usamos service role. ⚠ Esta key NUNCA pode ir num bundle web/publico — ok aqui pq
// o app eh distribuido em formato APK/IPA assinado pra colaboradores internos.
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlxZ3J2cHRydHBodmJtdnJxbnRtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzIzNjA4NCwiZXhwIjoyMDkyODEyMDg0fQ.JGSC4eRnTJhXFqnDveGr2u6-tDXQnLf5PsOrCNQWNBA';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});
