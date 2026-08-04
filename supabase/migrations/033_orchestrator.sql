-- Migration 033_orchestrator.sql
-- Adiciona tabelas para orquestrar as execuções de Agentes de IA e o Human-in-the-loop

-- 1. Tabela de Definição de Jobs
CREATE TABLE IF NOT EXISTS public.hos_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger de updated_at
CREATE TRIGGER set_hos_jobs_updated_at
BEFORE UPDATE ON public.hos_jobs
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- 2. Tabela de Execuções de um Job (Runs)
-- Status permitidos: pending, running, awaiting_approval, approved, rejected, failed
CREATE TABLE IF NOT EXISTS public.hos_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES public.hos_jobs(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending',
    payload JSONB DEFAULT '{}'::jsonb, -- Dados iniciais, ex: PR URL, Vercel Preview URL
    logs JSONB DEFAULT '[]'::jsonb, -- Array de passos/logs executados pelo Agente
    result_data JSONB DEFAULT '{}'::jsonb, -- Output estruturado do agente, screenshots
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hos_runs_status ON public.hos_runs(status);
CREATE INDEX IF NOT EXISTS idx_hos_runs_job_id ON public.hos_runs(job_id);

CREATE TRIGGER set_hos_runs_updated_at
BEFORE UPDATE ON public.hos_runs
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- 3. Tabela de Histórico de Aprovação (Human-in-the-loop)
CREATE TABLE IF NOT EXISTS public.hos_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES public.hos_runs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    decision TEXT NOT NULL CHECK (decision IN ('approve', 'reject')),
    feedback TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hos_approvals_run_id ON public.hos_approvals(run_id);

-- Enable RLS
ALTER TABLE public.hos_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hos_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hos_approvals ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para Orquestrador (Apenas roles administrativas)
-- Assumindo que maza_is_founder() e roles existem na estrutura base
CREATE POLICY "Admins podem ver todos os jobs"
    ON public.hos_jobs FOR SELECT
    TO authenticated
    USING (public.maza_has_role_for_unit(null) OR public.maza_is_founder());

CREATE POLICY "Admins podem inserir jobs"
    ON public.hos_jobs FOR INSERT
    TO authenticated
    WITH CHECK (public.maza_is_founder());

CREATE POLICY "Admins podem atualizar jobs"
    ON public.hos_jobs FOR UPDATE
    TO authenticated
    USING (public.maza_is_founder());

CREATE POLICY "Admins podem ver todas as execucoes"
    ON public.hos_runs FOR SELECT
    TO authenticated
    USING (public.maza_has_role_for_unit(null) OR public.maza_is_founder());

-- Os agentes podem inserir/atualizar (via service role / rotas backend) então o RLS normal não bloqueia o server.
-- O painel UI (usuário autenticado) pode atualizar (por exemplo, quando muda o status apos aprovacao)
CREATE POLICY "Admins podem atualizar execucoes"
    ON public.hos_runs FOR UPDATE
    TO authenticated
    USING (public.maza_has_role_for_unit(null) OR public.maza_is_founder());

CREATE POLICY "Admins podem ver aprovacoes"
    ON public.hos_approvals FOR SELECT
    TO authenticated
    USING (public.maza_has_role_for_unit(null) OR public.maza_is_founder());

CREATE POLICY "Admins podem inserir aprovacoes"
    ON public.hos_approvals FOR INSERT
    TO authenticated
    WITH CHECK (public.maza_has_role_for_unit(null) OR public.maza_is_founder());

-- Seeds de jobs padrao
INSERT INTO public.hos_jobs (name, slug, description) VALUES
('Validação QA Playwright', 'qa_preview', 'Agente roda suíte de QA num Vercel Preview URL e aguarda aprovação humana para deploy em produção.'),
('Code Review', 'code_review', 'Agente faz review de Pull Request e aguarda aprovação.'),
('Data Analysis', 'data_analysis', 'Agente extrai relatórios gerenciais e aguarda envio.');
