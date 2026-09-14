-- ==============================================================================
-- SAAV EXPENSES — CRIAÇÃO DA TABELA DE AUDITORIA (AUDIT_LOGS)
-- Execute este script no SQL Editor do Supabase (https://supabase.com/dashboard/project/gqatshashcohenmpcgqq/sql/new)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID REFERENCES colaboradores(id),
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Comentários de documentação
COMMENT ON TABLE audit_logs IS 'Armazena a trilha de auditoria para operações críticas do sistema.';
COMMENT ON COLUMN audit_logs.user_id IS 'Usuário responsável pela operação';
COMMENT ON COLUMN audit_logs.action IS 'Ação executada (ex: CREATE_EXPENSE, VALIDATE_EXPENSE, REJECT_EXPENSE, APPROVE_EXPENSE, UPLOAD_ATTACHMENT)';
COMMENT ON COLUMN audit_logs.entity IS 'Entidade afetada (ex: expenses, colaboradores, storage)';
COMMENT ON COLUMN audit_logs.entity_id IS 'Identificador do registro afetado';
COMMENT ON COLUMN audit_logs.details IS 'Detalhes em formato JSON com dados anteriores e novos';
COMMENT ON COLUMN audit_logs.created_at IS 'Carimbo cronológico do evento';

-- RLS para audit_logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Qualquer usuário autenticado pode registrar log (INSERT)
DROP POLICY IF EXISTS "Permitir inserção de audit_logs para autenticados" ON audit_logs;
CREATE POLICY "Permitir inserção de audit_logs para autenticados"
ON audit_logs FOR INSERT
TO authenticated
WITH CHECK (true);

-- Apenas Administradores e Gestores podem consultar a trilha de auditoria (SELECT)
DROP POLICY IF EXISTS "Permitir leitura de audit_logs para admin e gestores" ON audit_logs;
CREATE POLICY "Permitir leitura de audit_logs para admin e gestores"
ON audit_logs FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM colaboradores 
    WHERE id = auth.uid() 
    AND funcao IN ('Admin', 'Gestor', 'Supervisor', 'Kyanne', 'Financeiro')
  )
);
