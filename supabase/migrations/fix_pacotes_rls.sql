-- Fix pacotes RLS: require authentication
DROP POLICY IF EXISTS "Permitir leitura publica" ON pacotes;
DROP POLICY IF EXISTS "Permitir inserção publica" ON pacotes;
DROP POLICY IF EXISTS "Permitir atualização publica" ON pacotes;
DROP POLICY IF EXISTS "Permitir exclusão publica" ON pacotes;

CREATE POLICY "Permitir leitura autenticada" ON pacotes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Permitir inserção autenticada" ON pacotes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Permitir atualização autenticada" ON pacotes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Permitir exclusão autenticada" ON pacotes FOR DELETE TO authenticated USING (true);

-- Same for pacote_usos
DROP POLICY IF EXISTS "Permitir leitura publica" ON pacote_usos;
DROP POLICY IF EXISTS "Permitir inserção publica" ON pacote_usos;
DROP POLICY IF EXISTS "Permitir atualização publica" ON pacote_usos;
DROP POLICY IF EXISTS "Permitir exclusão publica" ON pacote_usos;

CREATE POLICY "Permitir leitura autenticada" ON pacote_usos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Permitir inserção autenticada" ON pacote_usos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Permitir atualização autenticada" ON pacote_usos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Permitir exclusão autenticada" ON pacote_usos FOR DELETE TO authenticated USING (true);
