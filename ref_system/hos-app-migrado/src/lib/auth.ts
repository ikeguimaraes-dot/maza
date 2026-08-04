import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { AuthSession, Employee } from './types';

const SESSION_KEY = '@hos_session';

/**
 * Login do colaborador via CPF + senha.
 *
 * Schema Maza:
 *   employees: nome, sobrenome (separados), funcao (era cargo), departamento,
 *              email, telefone, photo_url, score, status_rh, unit_id
 *   employee_auth: cpf UNIQUE, password_hash (plaintext por enquanto), employee_id
 *   units → brands: pra resolver "empresa" como brand.name
 */
export async function login(cpf: string, password: string): Promise<Employee> {
  console.log('[LOGIN] Iniciando com CPF:', cpf);

  // Step 1 — auth: CPF + senha
  const { data: authRecord, error: authError } = await supabase
    .from('employee_auth')
    .select('id, cpf, password_hash, employee_id, is_active')
    .eq('cpf', cpf)
    .single();

  if (authError || !authRecord) {
    throw new Error('CPF não cadastrado. Use o Primeiro Acesso.');
  }
  if (authRecord.is_active === false) {
    throw new Error('Acesso inativo. Fale com o RH.');
  }
  if (authRecord.password_hash !== password) {
    throw new Error('Senha incorreta.');
  }

  // Step 2 — buscar dados completos do funcionario, incluindo brand via JOIN.
  const { data: emp, error: empError } = await supabase
    .from('employees')
    .select(`
      id, nome, sobrenome, cpf, email, telefone, funcao, departamento,
      data_admissao, status_rh, photo_url, score, unit_id,
      units:unit_id ( id, brand_id, brands:brand_id ( name ) )
    `)
    .eq('id', authRecord.employee_id)
    .single();

  if (empError || !emp) {
    throw new Error('Funcionário não encontrado na base. Fale com o RH.');
  }

  // Resolve nome da brand (empresa). PostgREST embed pode vir como objeto ou array.
  const unit = Array.isArray((emp as any).units) ? (emp as any).units[0] : (emp as any).units;
  const brand = unit ? (Array.isArray(unit.brands) ? unit.brands[0] : unit.brands) : null;
  const empresa = brand?.name ?? '';

  // Step 3 — atualiza last_login (best effort, nao bloqueia)
  await supabase
    .from('employee_auth')
    .update({ last_login: new Date().toISOString() })
    .eq('id', authRecord.id);

  // Step 4 — montar sessão
  const employee: Employee = {
    id: emp.id,
    cpf: emp.cpf || cpf,
    nome: emp.nome || '',
    sobrenome: emp.sobrenome || '',
    email: emp.email || '',
    telefone: emp.telefone ?? null,
    funcao: emp.funcao || '',
    departamento: emp.departamento || '',
    data_admissao: emp.data_admissao || '',
    empresa,
    status: emp.status_rh || 'ativo',
    photo_url: emp.photo_url ?? null,
    score: emp.score ?? null,
  };

  const session: AuthSession = {
    employee,
    token: 'local',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  };

  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
  console.log('[LOGIN] Concluído com sucesso para:', `${employee.nome} ${employee.sobrenome}`.trim());
  return employee;
}

export async function getSession(): Promise<AuthSession | null> {
  const raw = await AsyncStorage.getItem(SESSION_KEY);
  if (!raw) return null;

  const session: AuthSession = JSON.parse(raw);
  if (new Date(session.expiresAt) < new Date()) {
    await logout();
    return null;
  }

  return session;
}

export async function logout(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_KEY);
}

/**
 * Primeiro acesso: cria registro em employee_auth com employee_id (FK NOT NULL no
 * Maza — o schema antigo permitia inserir sem employee_id, o novo nao).
 */
export async function primeiroAcesso(cpf: string, password: string): Promise<void> {
  console.log('[PRIMEIRO ACESSO] Iniciando com CPF:', cpf);

  // Step 1 — verificar se o CPF existe em employees (cadastrado pelo RH no Totvs/painel)
  const { data: employee, error: empError } = await supabase
    .from('employees')
    .select('id, nome, sobrenome')
    .eq('cpf', cpf)
    .maybeSingle();

  if (empError) {
    throw new Error('Erro ao consultar cadastro: ' + empError.message);
  }
  if (!employee) {
    throw new Error('CPF não encontrado no sistema. Fale com o RH.');
  }

  // Step 2 — verificar se ja existe employee_auth pra esse CPF
  const { data: existingAuth } = await supabase
    .from('employee_auth')
    .select('id')
    .eq('cpf', cpf)
    .maybeSingle();

  if (existingAuth) {
    throw new Error('Este CPF já possui acesso. Use a tela de login.');
  }

  // Step 3 — criar registro com employee_id obrigatorio (mudanca Maza)
  const { error: insertError } = await supabase
    .from('employee_auth')
    .insert({
      cpf,
      password_hash: password,
      employee_id: employee.id,
      is_active: true,
    });

  if (insertError) {
    throw new Error('Erro ao criar acesso: ' + insertError.message);
  }

  console.log('[PRIMEIRO ACESSO] Concluído com sucesso');
}
