-- Migration 027: employee_documents — documentos trabalhistas 1:N por colaborador
-- Bucket Supabase Storage: 'employee-documents' (criado via Server Action no primeiro upload)

CREATE TABLE IF NOT EXISTS employee_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     UUID REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
  tipo            TEXT NOT NULL CHECK (tipo IN (
    'aso_admissional', 'aso_periodico', 'aso_demissional',
    'ctps', 'rg', 'cpf', 'cnh', 'comprovante_residencia',
    'titulo_eleitor', 'reservista', 'pis_pasep',
    'certidao_nascimento', 'certidao_casamento',
    'comprovante_escolaridade', 'certificado_curso',
    'epi_recibo', 'uniforme_recibo',
    'contrato_trabalho', 'contrato_aditivo',
    'rescisao', 'termo_quitacao',
    'atestado_medico', 'declaracao', 'outro'
  )),
  nome            TEXT NOT NULL,
  descricao       TEXT,
  file_path       TEXT NOT NULL DEFAULT '',
  file_size       BIGINT,
  mime_type       TEXT,
  data_emissao    DATE,
  data_validade   DATE,
  observacoes     TEXT,
  uploaded_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emp_docs_employee  ON employee_documents(employee_id);
CREATE INDEX IF NOT EXISTS idx_emp_docs_tipo      ON employee_documents(tipo);
CREATE INDEX IF NOT EXISTS idx_emp_docs_validade  ON employee_documents(data_validade)
  WHERE data_validade IS NOT NULL;

ALTER TABLE employee_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "emp_docs_select" ON employee_documents FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.id = employee_id
      AND (e.user_id = auth.uid() OR public.maza_has_role_for_unit(e.unit_id))
  ));

CREATE POLICY "emp_docs_insert" ON employee_documents FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.id = employee_id
      AND public.maza_has_role_for_unit(e.unit_id)
  ));

CREATE POLICY "emp_docs_update" ON employee_documents FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.id = employee_id
      AND public.maza_has_role_for_unit(e.unit_id)
  ));

CREATE POLICY "emp_docs_delete" ON employee_documents FOR DELETE
  USING (public.maza_is_founder());
