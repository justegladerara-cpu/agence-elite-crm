-- Tableau de bord en direct : Supabase pousse au CRM ouvert les changements de ces tables (RLS appliquée)
alter publication supabase_realtime add table public.actions, public.prospects, public.documents, public.site_demandes;
