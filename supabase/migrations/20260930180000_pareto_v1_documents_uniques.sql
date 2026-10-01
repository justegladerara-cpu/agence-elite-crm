-- Pareto V1 : un numéro de devis/facture identifie un seul document dans un espace.
-- Migration additive et sûre : elle ne modifie aucune ligne. Si des doublons historiques existent,
-- l'index refuse de se créer et la requête de diagnostic ci-dessous indique quoi corriger.
-- Diagnostic préalable :
-- select workspace_id, type, lower(btrim(numero)) numero, count(*)
-- from public.documents
-- where type in ('devis', 'facture') and numero is not null and btrim(numero) <> ''
-- group by workspace_id, type, lower(btrim(numero)) having count(*) > 1;

create unique index if not exists documents_workspace_type_numero_unique
  on public.documents (workspace_id, type, lower(btrim(numero)))
  where workspace_id is not null and type in ('devis', 'facture') and numero is not null and btrim(numero) <> '';
