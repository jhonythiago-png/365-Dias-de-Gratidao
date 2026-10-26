-- ============================================================
-- 365 Dias de Gratidão — estrutura completa do banco (Supabase)
-- Rode este script inteiro no SQL Editor do Supabase.
-- Pode ser executado novamente sem perder dados.
-- ============================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------- Perfis ----------
create table if not exists public.perfis (
  id             uuid primary key references auth.users(id) on delete cascade,
  usuario        text unique not null,
  nome           text not null,
  criado_em      timestamptz not null default now(),
  ultimo_acesso  timestamptz,
  is_admin       boolean not null default false
);

-- ---------- Progresso (1 linha por dia concluído) ----------
create table if not exists public.progresso (
  user_id       uuid not null references auth.users(id) on delete cascade,
  dia           int  not null check (dia between 1 and 365),
  concluido_em  timestamptz not null default now(),
  primary key (user_id, dia)
);

-- ---------- Configurações do projeto (linha única) ----------
create table if not exists public.config (
  id               int primary key default 1 check (id = 1),
  data_lancamento  date not null default '2027-01-01',
  cadastro_aberto  boolean not null default true,
  mostrar_exemplo  boolean not null default true,
  link_cadastro    text not null default '',
  convite_titulo   text not null default 'Você aceita viver 365 dias aprendendo a agradecer?',
  convite_msg      text not null default '',
  whatsapp_suporte text not null default '5544984373004',
  atualizado_em    timestamptz not null default now()
);

alter table public.config add column if not exists whatsapp_suporte text not null default '5544984373004';

insert into public.config (id, convite_msg) values (1,
'Convite para o projeto

Você aceita viver 365 dias aprendendo a agradecer?

Todos os dias, vamos separar apenas de 3 a 5 minutos para ler um versículo, refletir sobre uma verdade prática e agradecer a Deus por aquilo que muitas vezes passa despercebido.

Não será um projeto de pedidos. Será um ano inteiro de memória, gratidão, disciplina e reconhecimento da bondade de Deus.

365 dias. Um versículo por dia. Alguns minutos na presença de Deus. Um coração cada vez mais agradecido.

Começamos em 1º de janeiro de 2027. Você vem conosco?')
on conflict (id) do nothing;

-- ---------- Funções auxiliares ----------
create or replace function public.hoje_br()
returns date language sql stable as $$
  select (now() at time zone 'America/Sao_Paulo')::date;
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.perfis where id = auth.uid()), false);
$$;

-- ---------- Segurança (RLS) ----------
alter table public.perfis    enable row level security;
alter table public.progresso enable row level security;
alter table public.config    enable row level security;

drop policy if exists perfis_select on public.perfis;
create policy perfis_select on public.perfis
  for select using (id = auth.uid() or public.is_admin());

drop policy if exists progresso_select on public.progresso;
create policy progresso_select on public.progresso
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists progresso_insert on public.progresso;
create policy progresso_insert on public.progresso
  for insert with check (user_id = auth.uid());

drop policy if exists config_select on public.config;
create policy config_select on public.config
  for select using (true);

drop policy if exists config_update on public.config;
create policy config_update on public.config
  for update using (public.is_admin()) with check (public.is_admin());

grant select on public.config to anon, authenticated;
grant update on public.config to authenticated;

-- ---------- Cadastro: cria o perfil e respeita "cadastro aberto" ----------
create or replace function public.criar_perfil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not coalesce((select cadastro_aberto from public.config where id = 1), true) then
    raise exception 'cadastro_fechado';
  end if;
  insert into public.perfis (id, usuario, nome)
  values (new.id,
          lower(coalesce(new.raw_user_meta_data->>'usuario', split_part(new.email, '@', 1))),
          coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.criar_perfil();

-- ---------- Regras do percurso na conclusão de um dia ----------
-- 1) Só após o lançamento.  2) Sempre em sequência.  3) Nunca além do dia de hoje.
-- Início: cadastrou antes do lançamento → data de lançamento (grupo);
--         cadastrou depois → data do primeiro dia concluído.
create or replace function public.validar_conclusao()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_lanc   date;
  v_cad    date;
  v_ini    date;
  v_hoje   date := public.hoje_br();
  v_lib    int;
begin
  select data_lancamento into v_lanc from public.config where id = 1;
  if v_hoje < v_lanc then raise exception 'antes_do_lancamento'; end if;

  if new.dia > 1 and not exists (select 1 from public.progresso where user_id = new.user_id and dia = new.dia - 1) then
    raise exception 'fora_de_sequencia';
  end if;

  select (criado_em at time zone 'America/Sao_Paulo')::date into v_cad from public.perfis where id = new.user_id;
  if v_cad < v_lanc then
    v_ini := v_lanc;
  else
    select min((concluido_em at time zone 'America/Sao_Paulo')::date) into v_ini from public.progresso where user_id = new.user_id;
    v_ini := coalesce(v_ini, v_hoje);
  end if;

  v_lib := least(365, (v_hoje - v_ini) + 1);
  if new.dia > v_lib then raise exception 'dia_ainda_nao_liberado'; end if;

  new.concluido_em := now();
  return new;
end $$;

drop trigger if exists antes_de_concluir on public.progresso;
create trigger antes_de_concluir
  before insert on public.progresso
  for each row execute function public.validar_conclusao();

-- ---------- Registro de último acesso ----------
create or replace function public.registrar_acesso()
returns void language sql security definer set search_path = public as $$
  update public.perfis set ultimo_acesso = now() where id = auth.uid();
$$;
grant execute on function public.registrar_acesso() to authenticated;

-- ---------- Painel master ----------
create or replace function public.admin_participantes()
returns table (id uuid, nome text, usuario text, criado_em timestamptz, ultimo_acesso timestamptz,
               feitos int, primeiro_concluido timestamptz)
language plpgsql security definer stable set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'acesso_negado'; end if;
  return query
    select p.id, p.nome, p.usuario, p.criado_em, p.ultimo_acesso,
           count(g.dia)::int, min(g.concluido_em)
    from public.perfis p
    left join public.progresso g on g.user_id = p.id
    where not p.is_admin
    group by p.id
    order by p.criado_em desc;
end $$;
grant execute on function public.admin_participantes() to authenticated;

create or replace function public.admin_redefinir_senha(p_id uuid, p_senha text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.is_admin() then raise exception 'acesso_negado'; end if;
  if length(coalesce(p_senha, '')) < 6 then raise exception 'senha_curta'; end if;
  update auth.users
     set encrypted_password = extensions.crypt(p_senha, extensions.gen_salt('bf')),
         updated_at = now()
   where id = p_id;
end $$;
grant execute on function public.admin_redefinir_senha(uuid, text) to authenticated;

revoke execute on function public.admin_participantes() from anon;
revoke execute on function public.admin_redefinir_senha(uuid, text) from anon;

-- ============================================================
-- DEPOIS de criar a sua conta no app, rode a linha abaixo
-- (troque "jhony" pelo usuário que você cadastrou) para virar administrador:
--
-- update public.perfis set is_admin = true where usuario = 'jhony';
-- ============================================================
