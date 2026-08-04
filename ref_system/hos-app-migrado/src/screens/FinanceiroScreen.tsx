import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Linking,
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
  // Maza: payslips.competencia eh DATE (YYYY-MM-DD); pegamos so YYYY-MM.
  const [ano, mes] = periodo.split('-');
  return `${MESES[mes] || mes} ${ano}`;
}

function formatCurrency(value?: number | string | null): string {
  if (value == null || value === '') return '—';
  // Maza: NUMERIC vem como string do PostgREST.
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n)) return '—';
  return `R$ ${Math.abs(n).toFixed(2).replace('.', ',')}`;
}

// Maza payslips schema (migrations 003 + 011):
//   competencia DATE, salario_base, horas_extras, adicional_noturno, gorjeta,
//   dsr_gorjeta, desconto_inss, desconto_irrf, desconto_vale_transporte,
//   desconto_vale_refeicao, outros_descontos, outros_acrescimos, liquido,
//   fgts_base, fgts_mes, faixa_irrf, employee_code, status, pdf_url.
//
// Removidos vs HOS antigo: total_vencimentos / total_descontos / inss_base /
// irrf_base. Vamos calcular total_vencimentos e total_descontos somando os
// componentes.
interface Payslip {
  id: string;
  competencia: string;
  salario_base?: string | number;
  horas_extras?: string | number;
  adicional_noturno?: string | number;
  gorjeta?: string | number;
  dsr_gorjeta?: string | number;
  outros_acrescimos?: string | number;
  desconto_inss?: string | number;
  desconto_irrf?: string | number;
  desconto_vale_transporte?: string | number;
  desconto_vale_refeicao?: string | number;
  outros_descontos?: string | number;
  liquido?: string | number;
  fgts_mes?: string | number;
  fgts_base?: string | number;
  faixa_irrf?: string;
  pdf_url?: string;
}

// Maza tips_records: valor_ponto + total_pontos + pontos_liquidos (GENERATED).
// Calculamos o valor total = valor_ponto * pontos_liquidos.
interface TipRecord {
  id: string;
  periodo: string;
  valor_ponto?: string | number;
  total_pontos?: number;
  pontos_liquidos?: number;
}

// Maza transport_vouchers: dias_uteis + valor_diario + total_bruto + valor_empresa.
interface TransportVoucher {
  id: string;
  periodo: string;
  dias_uteis?: number;
  valor_diario?: string | number;
  total_bruto?: string | number;
  valor_empresa?: string | number;
}

function num(v: string | number | undefined | null): number {
  if (v == null) return 0;
  return typeof v === 'string' ? Number(v) : v;
}

export default function FinanceiroScreen({ navigation }: any) {
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [tips, setTips] = useState<TipRecord[]>([]);
  const [transport, setTransport] = useState<TransportVoucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
    })();
  }, []);

  useEffect(() => {
    if (employeeId) fetchAll();
  }, [employeeId]);

  async function fetchAll() {
    if (!employeeId) return;

    const [payslipRes, tipsRes, transportRes] = await Promise.all([
      // Maza: payslips.competencia (vs periodo).
      supabase
        .from('payslips')
        .select('*')
        .eq('employee_id', employeeId)
        .order('competencia', { ascending: false }),
      supabase
        .from('tips_records')
        .select('*')
        .eq('employee_id', employeeId)
        .order('periodo', { ascending: false }),
      supabase
        .from('transport_vouchers')
        .select('*')
        .eq('employee_id', employeeId)
        .order('periodo', { ascending: false }),
    ]);

    if (payslipRes.error) console.error('[FINANCEIRO] payslips error:', payslipRes.error);
    if (tipsRes.error) console.error('[FINANCEIRO] tips error:', tipsRes.error);
    if (transportRes.error) console.error('[FINANCEIRO] transport error:', transportRes.error);

    setPayslips(payslipRes.data || []);
    setTips(tipsRes.data || []);
    setTransport(transportRes.data || []);
    setLoading(false);
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  }, [employeeId]);

  async function handleVerPDF(pdfRef: string) {
    if (!pdfRef) return;
    // Maza: pdf_url pode ser uma URL ja completa (gerada server-side, ex:
    // /api/holerites/[id]/pdf) ou um storage path. Detectamos pelo prefixo.
    if (/^https?:\/\//.test(pdfRef)) {
      Linking.openURL(pdfRef);
      return;
    }

    // Fallback: tenta criar signed URL nos buckets antigos (compat ETL).
    const { data, error } = await supabase.storage
      .from('documents')
      .createSignedUrl(pdfRef, 3600);

    if (!error && data?.signedUrl) {
      Linking.openURL(data.signedUrl);
      return;
    }

    console.error('[FINANCEIRO] PDF error:', error);
    Alert.alert('Erro', 'Não foi possível abrir o PDF');
  }

  type SectionData = { title: string; data: any[]; type: string };

  const sections: SectionData[] = [
    { title: 'Holerites', data: payslips, type: 'payslip' },
    { title: 'Gorjetas', data: tips, type: 'tip' },
    { title: 'Vale Transporte', data: transport, type: 'transport' },
  ];

  function renderPayslipCard(item: Payslip) {
    // Maza: total_vencimentos / total_descontos derivados dos componentes.
    const vencimentos =
      num(item.salario_base) +
      num(item.horas_extras) +
      num(item.adicional_noturno) +
      num(item.gorjeta) +
      num(item.dsr_gorjeta) +
      num(item.outros_acrescimos);

    const descontos =
      num(item.desconto_inss) +
      num(item.desconto_irrf) +
      num(item.desconto_vale_transporte) +
      num(item.desconto_vale_refeicao) +
      num(item.outros_descontos);

    return (
      <View style={styles.card}>
        {/* Header: Competência + Ver PDF */}
        <View style={styles.cardHeader}>
          <Text style={styles.cardPeriod}>{formatPeriodo(item.competencia)}</Text>
          {item.pdf_url ? (
            <TouchableOpacity
              onPress={() => handleVerPDF(item.pdf_url!)}
              style={styles.pdfButton}
            >
              <Text style={styles.pdfButtonText}>Ver PDF →</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Salário base */}
        <View style={styles.cardRow}>
          <Text style={styles.cardLabel}>Salário Base</Text>
          <Text style={styles.cardValue}>{formatCurrency(num(item.salario_base))}</Text>
        </View>

        {/* Vencimentos (calculado) */}
        <View style={styles.cardRow}>
          <Text style={styles.cardLabel}>Total Vencimentos</Text>
          <Text style={[styles.cardValue, { color: COLORS.SUCCESS }]}>{formatCurrency(vencimentos)}</Text>
        </View>

        {/* Descontos (calculado) */}
        <View style={styles.cardRow}>
          <Text style={styles.cardLabel}>Total Descontos</Text>
          <Text style={[styles.cardValue, { color: COLORS.ERROR }]}>
            {`-R$ ${descontos.toFixed(2).replace('.', ',')}`}
          </Text>
        </View>

        {/* Separador */}
        <View style={styles.divider} />

        {/* Valor líquido */}
        <View style={styles.cardRow}>
          <Text style={styles.liquidoLabel}>VALOR LÍQUIDO</Text>
          <Text style={styles.liquidoValue}>{formatCurrency(num(item.liquido))}</Text>
        </View>

        {/* Separador */}
        <View style={styles.divider} />

        {/* Detalhes secundários — Maza tem fgts_mes + fgts_base + faixa_irrf. */}
        {item.fgts_mes != null && (
          <View style={styles.cardRow}>
            <Text style={styles.cardLabelSmall}>FGTS do mês</Text>
            <Text style={styles.cardValueSmall}>{formatCurrency(num(item.fgts_mes))}</Text>
          </View>
        )}
        {item.fgts_base != null && (
          <View style={styles.cardRow}>
            <Text style={styles.cardLabelSmall}>Base FGTS</Text>
            <Text style={styles.cardValueSmall}>{formatCurrency(num(item.fgts_base))}</Text>
          </View>
        )}
        {item.faixa_irrf && (
          <View style={styles.cardRow}>
            <Text style={styles.cardLabelSmall}>Faixa IRRF</Text>
            <Text style={styles.cardValueSmall}>{item.faixa_irrf}</Text>
          </View>
        )}
      </View>
    );
  }

  function renderItem({ item, section }: { item: any; section: SectionData }) {
    if (section.type === 'payslip') return renderPayslipCard(item);
    if (section.type === 'tip') {
      // Maza: valor total = valor_ponto * pontos_liquidos.
      const t = item as TipRecord;
      const total = num(t.valor_ponto) * (t.pontos_liquidos ?? 0);
      return (
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <Text style={styles.cardPeriod}>{formatPeriodo(t.periodo)}</Text>
            <Text style={[styles.cardValue, { color: COLORS.SUCCESS }]}>{formatCurrency(total)}</Text>
          </View>
          {t.pontos_liquidos != null && (
            <Text style={styles.cardMeta}>
              {t.pontos_liquidos} pts × {formatCurrency(num(t.valor_ponto))}
            </Text>
          )}
        </View>
      );
    }
    // transport_voucher — Maza exibe o valor que a empresa banca (valor_empresa).
    const tv = item as TransportVoucher;
    return (
      <View style={styles.card}>
        <View style={styles.cardRow}>
          <Text style={styles.cardPeriod}>{formatPeriodo(tv.periodo)}</Text>
          <Text style={styles.cardValue}>{formatCurrency(num(tv.valor_empresa))}</Text>
        </View>
        {tv.dias_uteis != null && (
          <Text style={styles.cardMeta}>
            {tv.dias_uteis} dias × {formatCurrency(num(tv.valor_diario))}
          </Text>
        )}
      </View>
    );
  }

  function renderSectionHeader({ section }: { section: SectionData }) {
    return <Text style={styles.sectionTitle}>{section.title}</Text>;
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={COLORS.PRIMARY} />
      </View>
    );
  }

  const hasData = payslips.length > 0 || tips.length > 0 || transport.length > 0;

  if (!hasData) {
    return (
      <View style={[styles.container, styles.center]}>
        <Ionicons name="wallet-outline" size={64} color={COLORS.BORDER} />
        <Text style={styles.emptyTitle}>Nenhum registro financeiro</Text>
        <Text style={styles.emptySubtitle}>Seus holerites e benefícios aparecerão aqui.</Text>
      </View>
    );
  }

  return (
    <SectionList
      style={styles.container}
      contentContainerStyle={styles.list}
      sections={sections.filter(s => s.data.length > 0)}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      renderSectionHeader={renderSectionHeader}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    />
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
    padding: 32,
  },
  list: {
    padding: 20,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.TEXT,
    marginTop: 16,
    marginBottom: 10,
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
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardPeriod: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.TEXT,
  },
  pdfButton: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  pdfButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.PRIMARY,
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
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.TEXT,
  },
  cardLabelSmall: {
    fontSize: 13,
    color: COLORS.TEXT_SECONDARY,
  },
  cardValueSmall: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.TEXT_SECONDARY,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.BORDER,
    marginVertical: 10,
  },
  liquidoLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.TEXT,
  },
  liquidoValue: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.PRIMARY,
  },
  cardMeta: {
    fontSize: 13,
    color: COLORS.TEXT_SECONDARY,
    marginTop: 4,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.TEXT,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 15,
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
});
