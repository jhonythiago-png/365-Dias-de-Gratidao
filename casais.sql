-- ============================================================
-- Devocional de Casais — rode UMA vez no SQL Editor do Supabase.
-- Não altera nem apaga nada do Gratidão. Pode ser executado de novo sem problema.
-- ============================================================

-- Acesso ao devocional de Casais (liberado pelo administrador)
alter table public.perfis add column if not exists acesso_casal boolean not null default false;

-- Progresso do Casais (separado do Gratidão)
create table if not exists public.progresso_casal (
  user_id       uuid not null references auth.users(id) on delete cascade,
  dia           int  not null check (dia between 1 and 365),
  concluido_em  timestamptz not null default now(),
  primary key (user_id, dia)
);
alter table public.progresso_casal enable row level security;

drop policy if exists progresso_casal_select on public.progresso_casal;
create policy progresso_casal_select on public.progresso_casal
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists progresso_casal_insert on public.progresso_casal;
create policy progresso_casal_insert on public.progresso_casal
  for insert with check (user_id = auth.uid());

-- Regras do Casais: precisa ter acesso; começa quando quiser (a partir do lançamento);
-- sempre em sequência; libera um dia por dia, nunca adiantado.
create or replace function public.validar_conclusao_casal()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_lanc date;
  v_hoje date := public.hoje_br();
  v_ini  date;
  v_lib  int;
begin
  if not coalesce((select acesso_casal from public.perfis where id = new.user_id), false) then
    raise exception 'sem_acesso_casal';
  end if;
  select data_lancamento into v_lanc from public.config where id = 1;
  if v_hoje < v_lanc then raise exception 'antes_do_lancamento'; end if;

  if new.dia > 1 and not exists (select 1 from public.progresso_casal where user_id = new.user_id and dia = new.dia - 1) then
    raise exception 'fora_de_sequencia';
  end if;

  select min((concluido_em at time zone 'America/Sao_Paulo')::date) into v_ini from public.progresso_casal where user_id = new.user_id;
  v_ini := coalesce(v_ini, v_hoje);
  v_lib := least(365, (v_hoje - v_ini) + 1);
  if new.dia > v_lib then raise exception 'dia_ainda_nao_liberado'; end if;

  new.concluido_em := now();
  return new;
end $$;

drop trigger if exists antes_de_concluir_casal on public.progresso_casal;
create trigger antes_de_concluir_casal
  before insert on public.progresso_casal
  for each row execute function public.validar_conclusao_casal();

-- Painel master: lista com o acesso e o progresso do Casais
drop function if exists public.admin_participantes();
create or replace function public.admin_participantes()
returns table (id uuid, nome text, usuario text, criado_em timestamptz, ultimo_acesso timestamptz,
               feitos int, primeiro_concluido timestamptz, acesso_casal boolean, feitos_casal int)
language plpgsql security definer stable set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'acesso_negado'; end if;
  return query
    select p.id, p.nome, p.usuario, p.criado_em, p.ultimo_acesso,
           (select count(*)::int from public.progresso g where g.user_id = p.id),
           (select min(g.concluido_em) from public.progresso g where g.user_id = p.id),
           p.acesso_casal,
           (select count(*)::int from public.progresso_casal c where c.user_id = p.id)
    from public.perfis p
    where not p.is_admin
    order by p.criado_em desc;
end $$;
grant execute on function public.admin_participantes() to authenticated;
revoke execute on function public.admin_participantes() from anon;

-- Painel master: liberar ou tirar o acesso ao Casais
create or replace function public.admin_acesso_casal(p_id uuid, p_valor boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'acesso_negado'; end if;
  update public.perfis set acesso_casal = p_valor where id = p_id;
end $$;
grant execute on function public.admin_acesso_casal(uuid, boolean) to authenticated;
revoke execute on function public.admin_acesso_casal(uuid, boolean) from anon;

-- Para você (administrador) testar o Casais na sua própria conta:
-- update public.perfis set acesso_casal = true where usuario = 'jhony';
