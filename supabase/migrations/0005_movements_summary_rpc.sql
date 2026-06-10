-- =============================================================================
-- Serfuplagapp v2 — Migración 0005: función de totales comerciales
-- -----------------------------------------------------------------------------
-- Suma y cuenta movimientos en el SERVIDOR (no se traen filas al cliente, §5).
-- SECURITY INVOKER → respeta la RLS: cada empresa solo suma lo suyo.
-- Se usa para el total del filtro y para el dashboard (ventas del mes, etc.).
-- =============================================================================
create or replace function public.movements_summary(
  p_from date default null,
  p_to   date default null,    -- exclusivo
  p_type text default null,
  p_q    text default null
)
returns table (total numeric, n bigint)
language sql
stable
security invoker
as $$
  select coalesce(sum(amount), 0)::numeric as total, count(*)::bigint as n
  from public.movements
  where (p_from is null or date >= p_from)
    and (p_to   is null or date <  p_to)
    and (p_type is null or type::text = p_type)
    and (p_q    is null or description ilike '%' || p_q || '%'
                        or client_name_raw ilike '%' || p_q || '%');
$$;

grant execute on function public.movements_summary(date, date, text, text) to authenticated;
