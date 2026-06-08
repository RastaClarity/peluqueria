-- =========================================================
-- RASTA CUTS 2.9.4g
-- Columnas seguras para gestión avanzada de pedidos
-- No borra datos
-- =========================================================

alter table public.tienda_pedidos
  add column if not exists notas_admin text,
  add column if not exists notas_cliente text,
  add column if not exists motivo_cancelacion text,
  add column if not exists preparado_por text,
  add column if not exists entregado_por text,
  add column if not exists fecha_preparado timestamptz,
  add column if not exists fecha_entregado timestamptz,
  add column if not exists fecha_cancelado timestamptz;

create index if not exists idx_tienda_pedidos_cliente_email
on public.tienda_pedidos(cliente_email);

create index if not exists idx_tienda_pedidos_usuario_estado
on public.tienda_pedidos(usuario_id, estado);

select 'RASTA CUTS 2.9.4g SHOP PANEL PATCH OK' as status;
