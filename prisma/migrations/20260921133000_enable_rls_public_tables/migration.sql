-- Le backend NestJS se connecte avec le role proprietaire (postgres) qui contourne RLS.
-- RLS sans policy = refus total pour l'API REST publique de Supabase (anon/authenticated).
ALTER TABLE "Utilisateur" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Intervention" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Photo" ENABLE ROW LEVEL SECURITY;
