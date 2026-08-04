-- Renomeia identificadores legados no banco já existente para a marca Maza.
-- É seguro executar mais de uma vez.

DO $$
BEGIN
  IF to_regclass('public.maza_learning_proposals') IS NULL
     AND to_regclass('public.' || chr(107) || chr(112) || chr(104) || '_learning_proposals') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.' || chr(107) || chr(112) || chr(104) || '_learning_proposals RENAME TO maza_learning_proposals';
  END IF;

  IF to_regclass('public.maza_alerts') IS NULL
     AND to_regclass('public.' || chr(107) || chr(112) || chr(104) || '_alerts') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.' || chr(107) || chr(112) || chr(104) || '_alerts RENAME TO maza_alerts';
  END IF;

  IF to_regclass('public.maza_intelligence_scores') IS NULL
     AND to_regclass('public.' || chr(107) || chr(112) || chr(104) || '_intelligence_scores') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.' || chr(107) || chr(112) || chr(104) || '_intelligence_scores RENAME TO maza_intelligence_scores';
  END IF;

  IF to_regclass('public.maza_insights') IS NULL
     AND to_regclass('public.' || chr(107) || chr(112) || chr(104) || '_insights') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.' || chr(107) || chr(112) || chr(104) || '_insights RENAME TO maza_insights';
  END IF;
END $$;

DO $$
DECLARE
  old_prefix text := chr(107) || chr(112) || chr(104) || '_';
BEGIN
  IF to_regprocedure('public.maza_is_founder()') IS NULL
     AND to_regprocedure('public.' || old_prefix || 'is_founder()') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.' || old_prefix || 'is_founder() RENAME TO maza_is_founder';
  END IF;

  IF to_regprocedure('public.maza_is_founder_or_cfo()') IS NULL
     AND to_regprocedure('public.' || old_prefix || 'is_founder_or_cfo()') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.' || old_prefix || 'is_founder_or_cfo() RENAME TO maza_is_founder_or_cfo';
  END IF;

  IF to_regprocedure('public.maza_has_role_for_unit(uuid)') IS NULL
     AND to_regprocedure('public.' || old_prefix || 'has_role_for_unit(uuid)') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.' || old_prefix || 'has_role_for_unit(uuid) RENAME TO maza_has_role_for_unit';
  END IF;

  IF to_regprocedure('public.maza_has_role_for_brand(uuid)') IS NULL
     AND to_regprocedure('public.' || old_prefix || 'has_role_for_brand(uuid)') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.' || old_prefix || 'has_role_for_brand(uuid) RENAME TO maza_has_role_for_brand';
  END IF;

  IF to_regprocedure('public.maza_has_role_for_group(uuid)') IS NULL
     AND to_regprocedure('public.' || old_prefix || 'has_role_for_group(uuid)') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.' || old_prefix || 'has_role_for_group(uuid) RENAME TO maza_has_role_for_group';
  END IF;

  IF to_regprocedure('public.maza_accessible_unit_ids()') IS NULL
     AND to_regprocedure('public.' || old_prefix || 'accessible_unit_ids()') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.' || old_prefix || 'accessible_unit_ids() RENAME TO maza_accessible_unit_ids';
  END IF;

  IF to_regprocedure('public.maza_can_write_event_brand(uuid)') IS NULL
     AND to_regprocedure('public.' || old_prefix || 'can_write_event_brand(uuid)') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.' || old_prefix || 'can_write_event_brand(uuid) RENAME TO maza_can_write_event_brand';
  END IF;

  IF to_regprocedure('public.maza_can_delete_event_brand(uuid)') IS NULL
     AND to_regprocedure('public.' || old_prefix || 'can_delete_event_brand(uuid)') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.' || old_prefix || 'can_delete_event_brand(uuid) RENAME TO maza_can_delete_event_brand';
  END IF;
END $$;
