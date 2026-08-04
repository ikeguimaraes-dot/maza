// Tipos do app mobile — refletem o schema do Maza (migrations 011-018).
//
// ⚠ Mudanças importantes vs schema antigo HOS:
//   - employees: full_name → nome + sobrenome (separados)
//   - employees: cargo → funcao
//   - candidates: status agora eh decisao do RH; ciclo da entrevista vai
//     em interview_status (separados — ver migration 011_recruitment).
//   - interview_questions: ordem → order_num, video_path → video_url

export interface Employee {
  id: string;
  cpf: string;
  /** Primeiro nome — Maza separa nome / sobrenome (vs full_name antigo). */
  nome: string;
  sobrenome: string;
  email: string;
  telefone?: string | null;
  /** Antes era `cargo`. */
  funcao: string;
  departamento: string;
  data_admissao: string;
  /** Vem de JOIN brands.name; pode ser null se employee.unit_id sem brand. */
  empresa: string;
  /** status_rh = ativo | inativo | ferias | afastado. */
  status: string;
  photo_url?: string | null;
  score?: number | null;
}

/** Helper pra exibir nome completo onde antes se usava full_name. */
export function getDisplayName(emp: Pick<Employee, 'nome' | 'sobrenome'> | null | undefined): string {
  if (!emp) return '';
  return `${emp.nome ?? ''} ${emp.sobrenome ?? ''}`.trim();
}

export interface AuthSession {
  employee: Employee;
  token: string;
  expiresAt: string;
}

// ── Recrutamento ─────────────────────────────────────────────
//
// candidates.status (Maza) = decisao do RH: 'pendente' | 'aprovado' | 'reprovado'
// candidates.interview_status (Maza) = ciclo do app: 'pendente' | 'em_andamento' | 'concluido'
//
// O app SO toca em interview_status. status (decisao RH) eh resolvido no painel web.

export type CandidateInterviewStatus = 'pendente' | 'em_andamento' | 'concluido';
export type CandidateRhStatus = 'pendente' | 'aprovado' | 'reprovado';

export interface Candidate {
  id: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  access_code: string;
  job_opening_id: string;
  status: CandidateRhStatus;
  interview_status: CandidateInterviewStatus;
}

export interface InterviewQuestion {
  id: string;
  job_opening_id: string;
  /** Antes era `video_path` no schema HOS — Maza usa `video_url` (storage path). */
  video_url: string | null;
  question_text: string;
  /** Antes era `ordem`. */
  order_num: number;
}

export interface InterviewResponse {
  id: string;
  candidate_id: string;
  question_id: string;
  video_url: string;
}

export const COLORS = {
  PRIMARY: '#6366F1',
  BACKGROUND: '#F8FAFC',
  CARD: '#FFFFFF',
  TEXT: '#1E293B',
  TEXT_SECONDARY: '#64748B',
  BORDER: '#E2E8F0',
  ERROR: '#EF4444',
  SUCCESS: '#22C55E',
} as const;
