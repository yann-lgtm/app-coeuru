-- ============================================================================
-- GardeAppel — Schéma Supabase
-- À exécuter dans le SQL Editor du projet Supabase (ou via `supabase db push`).
-- ============================================================================

-- Type des catégories de signalement.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'categorie_signalement') then
    create type categorie_signalement as enum ('arnaque', 'demarchage', 'phishing', 'inconnu');
  end if;
end$$;

-- Table principale : un numéro = une ligne.
create table if not exists public.numeros_signales (
  numero text primary key,
  categorie categorie_signalement not null default 'inconnu',
  nb_signalements integer not null default 0,
  score_risque integer not null default 0 check (score_risque between 0 and 100),
  derniere_activite timestamptz not null default now()
);

create index if not exists idx_numeros_nb_signalements
  on public.numeros_signales (nb_signalements desc);

-- ----------------------------------------------------------------------------
-- Fonction RPC : signaler un numéro.
-- Crée la ligne si elle n'existe pas, sinon incrémente le compteur et
-- recalcule le score de risque. Renvoie la ligne mise à jour.
-- ----------------------------------------------------------------------------
create or replace function public.signaler_numero(
  p_numero text,
  p_categorie categorie_signalement
)
returns public.numeros_signales
language plpgsql
security definer
set search_path = public
as $$
declare
  resultat public.numeros_signales;
begin
  insert into public.numeros_signales (numero, categorie, nb_signalements, score_risque, derniere_activite)
  values (p_numero, p_categorie, 1, 40, now())
  on conflict (numero) do update
    set nb_signalements = public.numeros_signales.nb_signalements + 1,
        categorie = excluded.categorie,
        -- Score = 30 + 10 par signalement, plafonné à 100.
        score_risque = least(100, 30 + (public.numeros_signales.nb_signalements + 1) * 10),
        derniere_activite = now()
  returning * into resultat;

  return resultat;
end;
$$;

-- ----------------------------------------------------------------------------
-- Row Level Security
-- Lecture publique (base communautaire), signalement via la RPC uniquement.
-- ----------------------------------------------------------------------------
alter table public.numeros_signales enable row level security;

drop policy if exists "lecture publique" on public.numeros_signales;
create policy "lecture publique"
  on public.numeros_signales
  for select
  using (true);

-- Pas de policy d'INSERT/UPDATE directe : les écritures passent par la
-- fonction `signaler_numero` (security definer), ce qui empêche la
-- falsification directe des compteurs par un client anon.

-- Droit d'exécution de la RPC pour les rôles anon et authenticated.
grant execute on function public.signaler_numero(text, categorie_signalement) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- Jeu de données de démonstration (optionnel — à retirer en production).
-- ----------------------------------------------------------------------------
-- insert into public.numeros_signales (numero, categorie, nb_signalements, score_risque)
-- values
--   ('+33612345678', 'arnaque', 42, 100),
--   ('+33987654321', 'demarchage', 12, 90),
--   ('+33755112233', 'phishing', 8, 80)
-- on conflict (numero) do nothing;
