import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
  RefreshControl,
  TouchableOpacity,
  Modal,
  TextInput,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { getSession } from '../lib/auth';
import { COLORS } from '../lib/types';

const MESES: Record<string, string> = {
  '01': 'Janeiro', '02': 'Fevereiro', '03': 'Março', '04': 'Abril',
  '05': 'Maio', '06': 'Junho', '07': 'Julho', '08': 'Agosto',
  '09': 'Setembro', '10': 'Outubro', '11': 'Novembro', '12': 'Dezembro',
};

function formatPeriodo(periodo: string): string {
  if (!periodo) return '—';
  const [ano, mes] = periodo.split('-');
  return `${MESES[mes] || mes} ${ano}`;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function diffDaysInclusive(startIso: string, endIso: string): number {
  if (!startIso || !endIso) return 0;
  const s = new Date(`${startIso}T00:00:00Z`).getTime();
  const e = new Date(`${endIso}T00:00:00Z`).getTime();
  if (!Number.isFinite(s) || !Number.isFinite(e) || e < s) return 0;
  return Math.floor((e - s) / 86400000) + 1;
}

interface FeriasPeriodo {
  id: string;
  periodo: string;
  ferias_dias: number;
  afastamentos_dias?: number;
  status?: string;
}

export default function FeriasScreen({ navigation }: any) {
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [unitId, setUnitId] = useState<string | null>(null);
  const [feriasPeriodos, setFeriasPeriodos] = useState<FeriasPeriodo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal de solicitação
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dataInicio, setDataInicio] = useState(todayIso());
  const [dataFim, setDataFim] = useState(todayIso());
  const [observacao, setObservacao] = useState('');

  useEffect(() => {
    (async () => {
      const session = await getSession();
      if (!session) {
        Alert.alert('Sessão expirada', 'Faça login novamente.', [
          { text: 'OK', onPress: () => navigation.reset({ index: 0, routes: [{ name: 'Login' }] }) },
        ]);
        return;
      }
      setEmployeeId(session.employee.id);

      // Maza: vacations exige unit_id NOT NULL — busca via JOIN em employees.
      const { data: emp } = await supabase
        .from('employees')
        .select('unit_id')
        .eq('id', session.employee.id)
        .maybeSingle();
      if (emp?.unit_id) setUnitId(emp.unit_id);
    })();
  }, []);

  useEffect(() => {
    if (employeeId) fetchFerias();
  }, [employeeId]);

  async function fetchFerias() {
    if (!employeeId) return;

    // Maza: time_records mantem o mesmo schema (ferias_dias). Se a tabela
    // vacations tiver dados (modulo Ferias do painel Maza), tambem inclui.
    const [timeRes, vacationsRes] = await Promise.all([
      supabase
        .from('time_records')
        .select('id, periodo, ferias_dias, afastamentos_dias')
        .eq('employee_id', employeeId)
        .order('periodo', { ascending: false }),
      supabase
        .from('vacations')
        .select('id, start_date, end_date, days_taken, status')
        .eq('employee_id', employeeId)
        .order('start_date', { ascending: false }),
    ]);

    if (timeRes.error) console.error('[FERIAS] time_records error:', timeRes.error);
    if (vacationsRes.error) console.error('[FERIAS] vacations error:', vacationsRes.error);

    const fromTimeRecords = (timeRes.data || []).filter(
      (r: any) => r.ferias_dias != null && Number(r.ferias_dias) > 0,
    );

    // Mapeia vacations pro mesmo formato que a tela renderiza (periodo + ferias_dias).
    const fromVacations = (vacationsRes.data || []).map((v: any) => ({
      id: `vac-${v.id}`,
      // periodo: extrai YYYY-MM do start_date (DATE).
      periodo: typeof v.start_date === 'string' ? v.start_date.slice(0, 7) : '',
      ferias_dias: v.days_taken ?? 0,
      afastamentos_dias: 0,
      status: v.status,
    }));

    setFeriasPeriodos([...fromTimeRecords, ...fromVacations]);
    setLoading(false);
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchFerias();
    setRefreshing(false);
  }, [employeeId]);

  function openSolicitar() {
    setDataInicio(todayIso());
    setDataFim(todayIso());
    setObservacao('');
    setShowModal(true);
  }

  async function handleSolicitar() {
    if (!employeeId || !unitId) {
      Alert.alert('Erro', 'Não foi possível identificar sua unidade.');
      return;
    }
    const dias = diffDaysInclusive(dataInicio, dataFim);
    if (dias <= 0) {
      Alert.alert('Período inválido', 'Data fim precisa ser posterior ou igual à data início.');
      return;
    }
    setSubmitting(true);
    // Maza: vacations.status='agendada' até o admin aprovar (em_andamento)
    // ou rejeitar (cancelada). created_by NULL identifica solicitação via app.
    const { error } = await supabase.from('vacations').insert({
      employee_id: employeeId,
      unit_id: unitId,
      start_date: dataInicio,
      end_date: dataFim,
      days_taken: dias,
      status: 'agendada',
      notes: observacao.trim() || null,
      // created_by deliberadamente null — o app não tem auth.user.
    } as any);
    setSubmitting(false);
    if (error) {
      console.error('[FERIAS] solicitar error:', error);
      Alert.alert('Erro', error.message || 'Não foi possível enviar a solicitação.');
      return;
    }
    setShowModal(false);
    Alert.alert(
      'Solicitação enviada',
      'Seu gestor vai aprovar ou rejeitar no painel. Você pode acompanhar aqui.',
    );
    fetchFerias();
  }

  function renderItem({ item }: { item: FeriasPeriodo }) {
    const statusBadge =
      item.status === 'agendada'
        ? { bg: 'rgba(59,130,246,0.16)', fg: '#1D4ED8', label: 'Aguardando aprovação' }
        : item.status === 'em_andamento'
        ? { bg: 'rgba(245,158,11,0.16)', fg: '#A16207', label: 'Aprovada' }
        : item.status === 'concluida'
        ? { bg: 'rgba(34,197,94,0.16)', fg: '#15803D', label: 'Concluída' }
        : item.status === 'cancelada'
        ? { bg: 'rgba(239,68,68,0.10)', fg: '#B91C1C', label: 'Rejeitada' }
        : null;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="sunny-outline" size={20} color={COLORS.PRIMARY} />
          <Text style={styles.cardTitle}>{formatPeriodo(item.periodo)}</Text>
          {statusBadge && (
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: statusBadge.bg },
              ]}
            >
              <Text style={[styles.statusBadgeText, { color: statusBadge.fg }]}>
                {statusBadge.label}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.cardRow}>
          <Text style={styles.cardLabel}>Dias de Férias</Text>
          <Text style={[styles.cardValue, { color: COLORS.PRIMARY, fontSize: 18 }]}>{item.ferias_dias}</Text>
        </View>
        {item.afastamentos_dias != null && Number(item.afastamentos_dias) > 0 && (
          <View style={styles.cardRow}>
            <Text style={styles.cardLabel}>Afastamentos</Text>
            <Text style={styles.cardValue}>{item.afastamentos_dias} dias</Text>
          </View>
        )}
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={COLORS.PRIMARY} />
      </View>
    );
  }

  const previewDias = diffDaysInclusive(dataInicio, dataFim);

  return (
    <>
      <FlatList
        style={styles.container}
        contentContainerStyle={feriasPeriodos.length === 0 ? styles.listEmpty : styles.list}
        data={feriasPeriodos}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={
          <TouchableOpacity style={styles.solicitarButton} onPress={openSolicitar}>
            <Ionicons name="add-circle-outline" size={20} color="#FFF" />
            <Text style={styles.solicitarButtonText}>Solicitar Férias</Text>
          </TouchableOpacity>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="sunny-outline" size={64} color={COLORS.BORDER} />
            <Text style={styles.emptyTitle}>Nenhum registro de férias</Text>
            <Text style={styles.emptySubtitle}>
              Suas férias aparecerão aqui quando forem registradas. Toque em &quot;Solicitar Férias&quot; pra criar uma nova solicitação.
            </Text>
          </View>
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      />

      {/* Modal solicitação */}
      <Modal
        visible={showModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Solicitar Férias</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.TEXT_SECONDARY} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>Data de início (AAAA-MM-DD)</Text>
            <TextInput
              style={styles.modalInput}
              value={dataInicio}
              onChangeText={setDataInicio}
              placeholder="2026-05-01"
              placeholderTextColor={COLORS.TEXT_SECONDARY}
              autoCorrect={false}
              autoCapitalize="none"
              keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
            />

            <Text style={styles.modalLabel}>Data de fim (AAAA-MM-DD)</Text>
            <TextInput
              style={styles.modalInput}
              value={dataFim}
              onChangeText={setDataFim}
              placeholder="2026-05-15"
              placeholderTextColor={COLORS.TEXT_SECONDARY}
              autoCorrect={false}
              autoCapitalize="none"
              keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
            />

            <View style={styles.previewBox}>
              <Text style={styles.previewLabel}>Total de dias</Text>
              <Text style={styles.previewValue}>
                {previewDias > 0 ? `${previewDias} dia${previewDias === 1 ? '' : 's'}` : '—'}
              </Text>
            </View>

            <Text style={styles.modalLabel}>Observação (opcional)</Text>
            <TextInput
              style={[styles.modalInput, styles.modalTextarea]}
              value={observacao}
              onChangeText={setObservacao}
              placeholder="Ex: Viagem de família"
              placeholderTextColor={COLORS.TEXT_SECONDARY}
              multiline
              numberOfLines={3}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonGhost]}
                onPress={() => setShowModal(false)}
                disabled={submitting}
              >
                <Text style={styles.modalButtonGhostText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={handleSolicitar}
                disabled={submitting || previewDias <= 0}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.modalButtonPrimaryText}>Enviar solicitação</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    padding: 20,
    paddingBottom: 40,
  },
  listEmpty: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    padding: 20,
  },
  card: {
    backgroundColor: COLORS.CARD,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
    flexWrap: 'wrap',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.TEXT,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  cardLabel: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
  },
  cardValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.TEXT,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 'auto',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  empty: {
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.TEXT,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  solicitarButton: {
    backgroundColor: COLORS.PRIMARY,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 18,
  },
  solicitarButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.BACKGROUND,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.TEXT,
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.TEXT_SECONDARY,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 8,
    marginBottom: 6,
  },
  modalInput: {
    backgroundColor: COLORS.CARD,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.TEXT,
  },
  modalTextarea: {
    height: 70,
    textAlignVertical: 'top',
  },
  previewBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    padding: 12,
    backgroundColor: COLORS.CARD,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  previewLabel: {
    fontSize: 12,
    color: COLORS.TEXT_SECONDARY,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  previewValue: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.PRIMARY,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonGhost: {
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  modalButtonGhostText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 14,
    fontWeight: '600',
  },
  modalButtonPrimary: {
    backgroundColor: COLORS.PRIMARY,
  },
  modalButtonPrimaryText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
