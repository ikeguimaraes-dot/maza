-- Maza — 019_compras.sql
-- Sprint 2 / Etapa 2 — módulo Compras (pedidos + fornecedores).
--
-- Pré-req: 001 (groups/brands/units + helpers RBAC).
--
-- Aditivo: nenhuma tabela existente é alterada.
-- Idempotente: CREATE TABLE IF NOT EXISTS, CREATE SEQUENCE IF NOT EXISTS,
-- DROP POLICY antes de cada CREATE POLICY, CREATE OR REPLACE pra functions.
--
-- ATENÇÃO sobre "GENERATED" do briefing:
--   * `numero` (purchase_orders): Postgres NÃO permite GENERATED com nextval().
--     Implementado via sequence purchase_orders_numero_seq + DEFAULT no INSERT.
--   * `valor_total` (purchase_orders): depende de outra tabela (items),
--     impossível em GENERATED ALWAYS AS. Implementado via TRIGGER que
--     recalcula quando os items mudam.
--   * `total` (purchase_order_items): GENERATED legítimo (mesma linha).

-- ── ENUMS ──────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE purchase_order_status AS ENUM (
    'rascunho','enviado','parcial','recebido','cancelado'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── SEQUENCE pra numeração de pedidos ──────────────────────────
CREATE SEQUENCE IF NOT EXISTS purchase_orders_numero_seq START 1;

-- ── TABELAS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS suppliers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id     UUID NOT NULL REFERENCES units(id),
  brand_id    UUID NOT NULL REFERENCES brands(id),
  nome        TEXT NOT NULL,
  cnpj        TEXT,
  telefone    TEXT,
  email       TEXT,
  categoria   TEXT,
  ativo       BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id         UUID NOT NULL REFERENCES units(id),
  brand_id        UUID NOT NULL REFERENCES brands(id),
  -- Numeração automática "PO-000001". Único.
  numero          TEXT NOT NULL UNIQUE
                  DEFAULT 'PO-' || LPAD(nextval('purchase_orders_numero_seq')::text, 6, '0'),
  fornecedor      TEXT,
  supplier_id     UUID REFERENCES suppliers(id),
  status          purchase_order_status NOT NULL DEFAULT 'rascunho',
  data_pedido     DATE NOT NULL DEFAULT CURRENT_DATE,
  data_prevista   DATE,
  -- Mantida via trigger sobre purchase_order_items (não dá pra GENERATED
  -- porque depende de outra tabela).
  valor_total     NUMERIC(12,2) NOT NULL DEFAULT 0,
  observacoes     TEXT,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id              UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  nome                  TEXT NOT NULL,
  unidade               TEXT,
  quantidade            NUMERIC(12,3) NOT NULL DEFAULT 0,
  quantidade_recebida   NUMERIC(12,3) NOT NULL DEFAULT 0,
  preco_unitario        NUMERIC(10,2) NOT NULL DEFAULT 0,
  total                 NUMERIC(14,2)
                        GENERATED ALWAYS AS (quantidade * preco_unitario) STORED,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ── ÍNDICES ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_suppliers_unit                     ON suppliers(unit_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_brand                    ON suppliers(brand_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_ativo                    ON suppliers(ativo);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_unit               ON purchase_orders(unit_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_brand              ON purchase_orders(brand_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status             ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_data_pedido        ON purchase_orders(data_pedido DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_order         ON purchase_order_items(order_id);

-- ── updated_at TRIGGER (reusa função existente) ────────────────
DROP TRIGGER IF EXISTS trg_purchase_orders_updated_at ON purchase_orders;
CREATE TRIGGER trg_purchase_orders_updated_at
  BEFORE UPDATE ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── TRIGGER pra manter purchase_orders.valor_total sincronizado ─
CREATE OR REPLACE FUNCTION public.recalc_purchase_order_total()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_order_id UUID;
BEGIN
  v_order_id := COALESCE(NEW.order_id, OLD.order_id);
  UPDATE purchase_orders
     SET valor_total = COALESCE((
           SELECT SUM(total) FROM purchase_order_items WHERE order_id = v_order_id
         ), 0)
   WHERE id = v_order_id;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_recalc_po_total_iud ON purchase_order_items;
CREATE TRIGGER trg_recalc_po_total_iud
  AFTER INSERT OR UPDATE OR DELETE ON purchase_order_items
  FOR EACH ROW EXECUTE FUNCTION public.recalc_purchase_order_total();

-- ── RLS ────────────────────────────────────────────────────────
ALTER TABLE suppliers             ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders       ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items  ENABLE ROW LEVEL SECURITY;

-- suppliers
DROP POLICY IF EXISTS "suppliers_select" ON suppliers;
CREATE POLICY "suppliers_select" ON suppliers FOR SELECT
  USING (maza_has_role_for_unit(unit_id));

DROP POLICY IF EXISTS "suppliers_insert" ON suppliers;
CREATE POLICY "suppliers_insert" ON suppliers FOR INSERT
  WITH CHECK (maza_has_role_for_unit(unit_id));

DROP POLICY IF EXISTS "suppliers_update" ON suppliers;
CREATE POLICY "suppliers_update" ON suppliers FOR UPDATE
  USING (maza_has_role_for_unit(unit_id))
  WITH CHECK (maza_has_role_for_unit(unit_id));

DROP POLICY IF EXISTS "suppliers_delete" ON suppliers;
CREATE POLICY "suppliers_delete" ON suppliers FOR DELETE
  USING (maza_is_founder());

-- purchase_orders
DROP POLICY IF EXISTS "po_select" ON purchase_orders;
CREATE POLICY "po_select" ON purchase_orders FOR SELECT
  USING (maza_has_role_for_unit(unit_id));

DROP POLICY IF EXISTS "po_insert" ON purchase_orders;
CREATE POLICY "po_insert" ON purchase_orders FOR INSERT
  WITH CHECK (maza_has_role_for_unit(unit_id));

DROP POLICY IF EXISTS "po_update" ON purchase_orders;
CREATE POLICY "po_update" ON purchase_orders FOR UPDATE
  USING (maza_has_role_for_unit(unit_id))
  WITH CHECK (maza_has_role_for_unit(unit_id));

DROP POLICY IF EXISTS "po_delete" ON purchase_orders;
CREATE POLICY "po_delete" ON purchase_orders FOR DELETE
  USING (maza_is_founder());

-- purchase_order_items: cascade via parent
DROP POLICY IF EXISTS "po_items_select" ON purchase_order_items;
CREATE POLICY "po_items_select" ON purchase_order_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM purchase_orders po
    WHERE po.id = order_id AND maza_has_role_for_unit(po.unit_id)
  ));

DROP POLICY IF EXISTS "po_items_insert" ON purchase_order_items;
CREATE POLICY "po_items_insert" ON purchase_order_items FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM purchase_orders po
    WHERE po.id = order_id AND maza_has_role_for_unit(po.unit_id)
  ));

DROP POLICY IF EXISTS "po_items_update" ON purchase_order_items;
CREATE POLICY "po_items_update" ON purchase_order_items FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM purchase_orders po
    WHERE po.id = order_id AND maza_has_role_for_unit(po.unit_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM purchase_orders po
    WHERE po.id = order_id AND maza_has_role_for_unit(po.unit_id)
  ));

DROP POLICY IF EXISTS "po_items_delete" ON purchase_order_items;
CREATE POLICY "po_items_delete" ON purchase_order_items FOR DELETE
  USING (maza_is_founder());

-- ── GRANTS (authenticated role) ────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON suppliers            TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON purchase_orders      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON purchase_order_items TO authenticated;
GRANT USAGE ON SEQUENCE purchase_orders_numero_seq           TO authenticated;
