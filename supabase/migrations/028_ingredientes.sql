-- Maza — 028_ingredientes.sql
-- Auto-suficiente: ingredients + ingredient_price_history + recipe_items + recipe_notes
-- Sem ALTER TABLE — CREATE TABLE IF NOT EXISTS inclui todas as colunas.
-- Ordem: ingredientes antes de recipe_items (FK ingredient_id depende de ingredients).

-- ── 1. INGREDIENTS ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ingredients (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id        UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  codigo          TEXT,
  nome            TEXT NOT NULL,
  categoria       TEXT NOT NULL CHECK (categoria IN (
    'proteina', 'verdura', 'legume', 'fruta', 'graos',
    'laticinios', 'panificacao', 'bebida_alcoolica',
    'bebida_nao_alcoolica', 'tempero', 'oleo_gordura',
    'descartavel', 'limpeza', 'outro'
  )),
  unidade_padrao  TEXT NOT NULL CHECK (unidade_padrao IN (
    'kg', 'g', 'l', 'ml', 'un', 'cx', 'fardo', 'duzia'
  )),
  custo_padrao    NUMERIC(12,4) NOT NULL DEFAULT 0,
  fornecedor_id   UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  perdas_padrao   NUMERIC(5,2)  DEFAULT 0,
  observacoes     TEXT,
  ativo           BOOLEAN       DEFAULT true,
  created_at      TIMESTAMPTZ   DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ingredients_codigo_group
  ON ingredients(group_id, codigo) WHERE codigo IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ingredients_group     ON ingredients(group_id);
CREATE INDEX IF NOT EXISTS idx_ingredients_categoria ON ingredients(categoria);
CREATE INDEX IF NOT EXISTS idx_ingredients_ativo     ON ingredients(ativo) WHERE ativo = true;

-- ── 2. INGREDIENT_PRICE_HISTORY ───────────────────────────────

CREATE TABLE IF NOT EXISTS ingredient_price_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id   UUID NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
  custo_anterior  NUMERIC(12,4),
  custo_novo      NUMERIC(12,4) NOT NULL,
  motivo          TEXT,
  changed_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_price_history_ingredient
  ON ingredient_price_history(ingredient_id, created_at DESC);

-- ── 3. RECIPE_ITEMS ───────────────────────────────────────────
-- Inclui ingredient_id e perda_pct desde o início.
-- Se a tabela já existia (025), o DO abaixo acrescenta as colunas.

CREATE TABLE IF NOT EXISTS recipe_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cmv_item_id     UUID NOT NULL REFERENCES public.cmv_items(id) ON DELETE CASCADE,
  unit_id         UUID REFERENCES public.units(id),
  insumo          TEXT NOT NULL DEFAULT '',
  unidade         TEXT,
  quantidade      NUMERIC(12,4) NOT NULL DEFAULT 0,
  custo_unitario  NUMERIC(12,4) NOT NULL DEFAULT 0,
  custo_total     NUMERIC(14,4) GENERATED ALWAYS AS (quantidade * custo_unitario) STORED,
  ingredient_id   UUID REFERENCES public.ingredients(id) ON DELETE SET NULL,
  perda_pct       NUMERIC(5,2)  DEFAULT 0,
  created_at      TIMESTAMPTZ   DEFAULT NOW()
);

-- Acrescenta colunas caso a tabela já existia sem elas (idempotente via exceção)
DO $$
BEGIN
  BEGIN
    ALTER TABLE public.recipe_items
      ADD COLUMN ingredient_id UUID REFERENCES public.ingredients(id) ON DELETE SET NULL;
  EXCEPTION WHEN duplicate_column THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.recipe_items
      ADD COLUMN perda_pct NUMERIC(5,2) DEFAULT 0;
  EXCEPTION WHEN duplicate_column THEN NULL;
  END;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_recipe_items_cmv        ON recipe_items(cmv_item_id);
CREATE INDEX IF NOT EXISTS idx_recipe_items_unit       ON recipe_items(unit_id);
CREATE INDEX IF NOT EXISTS idx_recipe_items_ingredient ON recipe_items(ingredient_id)
  WHERE ingredient_id IS NOT NULL;

-- ── 4. RECIPE_NOTES ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS recipe_notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cmv_item_id UUID NOT NULL REFERENCES public.cmv_items(id) ON DELETE CASCADE,
  nota        TEXT NOT NULL,
  created_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recipe_notes_cmv
  ON recipe_notes(cmv_item_id, created_at DESC);

-- ── 5. TRIGGER: recalcula cmv_items.custo_total ───────────────

CREATE OR REPLACE FUNCTION public.fn_recalc_cmv_item_custo_total()
RETURNS TRIGGER AS $$
DECLARE
  target_cmv_id UUID;
BEGIN
  target_cmv_id := COALESCE(NEW.cmv_item_id, OLD.cmv_item_id);
  UPDATE public.cmv_items
     SET custo_total       = COALESCE((
           SELECT SUM(custo_total) FROM public.recipe_items
           WHERE cmv_item_id = target_cmv_id
         ), 0),
         tem_ficha_tecnica = EXISTS (
           SELECT 1 FROM public.recipe_items WHERE cmv_item_id = target_cmv_id
         ),
         updated_at        = NOW()
   WHERE id = target_cmv_id;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_recipe_items_recalc_cmv ON public.recipe_items;
CREATE TRIGGER trg_recipe_items_recalc_cmv
  AFTER INSERT OR UPDATE OR DELETE ON public.recipe_items
  FOR EACH ROW EXECUTE FUNCTION public.fn_recalc_cmv_item_custo_total();

-- ── 6. TRIGGER: sincroniza custo ao mudar preço do ingrediente ─

CREATE OR REPLACE FUNCTION public.fn_ingredient_price_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.custo_padrao IS DISTINCT FROM OLD.custo_padrao THEN
    INSERT INTO ingredient_price_history (ingredient_id, custo_anterior, custo_novo, motivo)
    VALUES (NEW.id, OLD.custo_padrao, NEW.custo_padrao, 'alteracao_manual');
    -- atualiza custo_unitario → custo_total GENERATED recalcula
    -- → trg_recipe_items_recalc_cmv cascateia para cmv_items
    UPDATE public.recipe_items
       SET custo_unitario = NEW.custo_padrao
     WHERE ingredient_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ingredient_price_change ON public.ingredients;
CREATE TRIGGER trg_ingredient_price_change
  AFTER UPDATE ON public.ingredients
  FOR EACH ROW EXECUTE FUNCTION public.fn_ingredient_price_change();

-- ── 7. FUNÇÃO utilitária ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.calculate_recipe_cost(p_cmv_item_id UUID)
RETURNS NUMERIC AS $$
  SELECT COALESCE(SUM(custo_total), 0)
  FROM public.recipe_items
  WHERE cmv_item_id = p_cmv_item_id;
$$ LANGUAGE sql STABLE;

-- ── 8. RLS ────────────────────────────────────────────────────

ALTER TABLE public.ingredients              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredient_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_items             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_notes             ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ingredients_select" ON ingredients;
CREATE POLICY "ingredients_select" ON ingredients FOR SELECT
  USING (public.maza_has_role_for_group(group_id));
DROP POLICY IF EXISTS "ingredients_insert" ON ingredients;
CREATE POLICY "ingredients_insert" ON ingredients FOR INSERT
  WITH CHECK (public.maza_has_role_for_group(group_id));
DROP POLICY IF EXISTS "ingredients_update" ON ingredients;
CREATE POLICY "ingredients_update" ON ingredients FOR UPDATE
  USING (public.maza_has_role_for_group(group_id))
  WITH CHECK (public.maza_has_role_for_group(group_id));
DROP POLICY IF EXISTS "ingredients_delete" ON ingredients;
CREATE POLICY "ingredients_delete" ON ingredients FOR DELETE
  USING (public.maza_is_founder());

DROP POLICY IF EXISTS "price_history_select" ON ingredient_price_history;
CREATE POLICY "price_history_select" ON ingredient_price_history FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.ingredients i
    WHERE i.id = ingredient_id AND public.maza_has_role_for_group(i.group_id)
  ));

DROP POLICY IF EXISTS "ri_select" ON recipe_items;
CREATE POLICY "ri_select" ON recipe_items FOR SELECT
  USING (cmv_item_id IN (
    SELECT id FROM public.cmv_items
    WHERE unit_id IS NULL
       OR public.maza_has_role_for_unit(unit_id)
       OR public.maza_has_role_for_brand(brand_id)
  ));
DROP POLICY IF EXISTS "ri_insert" ON recipe_items;
CREATE POLICY "ri_insert" ON recipe_items FOR INSERT
  WITH CHECK (cmv_item_id IN (
    SELECT id FROM public.cmv_items WHERE public.maza_has_role_for_brand(brand_id)
  ));
DROP POLICY IF EXISTS "ri_update" ON recipe_items;
CREATE POLICY "ri_update" ON recipe_items FOR UPDATE
  USING  (cmv_item_id IN (SELECT id FROM public.cmv_items WHERE public.maza_has_role_for_brand(brand_id)))
  WITH CHECK (cmv_item_id IN (SELECT id FROM public.cmv_items WHERE public.maza_has_role_for_brand(brand_id)));
DROP POLICY IF EXISTS "ri_delete" ON recipe_items;
CREATE POLICY "ri_delete" ON recipe_items FOR DELETE
  USING (cmv_item_id IN (SELECT id FROM public.cmv_items WHERE public.maza_has_role_for_brand(brand_id)));

DROP POLICY IF EXISTS "rn_select" ON recipe_notes;
CREATE POLICY "rn_select" ON recipe_notes FOR SELECT
  USING (cmv_item_id IN (
    SELECT id FROM public.cmv_items
    WHERE unit_id IS NULL
       OR public.maza_has_role_for_unit(unit_id)
       OR public.maza_has_role_for_brand(brand_id)
  ));
DROP POLICY IF EXISTS "rn_insert" ON recipe_notes;
CREATE POLICY "rn_insert" ON recipe_notes FOR INSERT
  WITH CHECK (cmv_item_id IN (
    SELECT id FROM public.cmv_items WHERE public.maza_has_role_for_brand(brand_id)
  ));
DROP POLICY IF EXISTS "rn_delete" ON recipe_notes;
CREATE POLICY "rn_delete" ON recipe_notes FOR DELETE
  USING (public.maza_is_founder());

-- ── 9. GRANTS ─────────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ingredients              TO authenticated;
GRANT SELECT                         ON public.ingredient_price_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recipe_items             TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recipe_notes             TO authenticated;
