-- ==============================================================================
-- SAAV EXPENSES — CRIAÇÃO DA TABELA DE HISTÓRICO DE STATUS E AUDITORIA
-- Execute este script no SQL Editor do Supabase (https://supabase.com/dashboard/project/gqatshashcohenmpcgqq/sql/new)
-- ==============================================================================

-- 1. Criação da Tabela expense_status_history
CREATE TABLE IF NOT EXISTS expense_status_history (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  expense_id BIGINT REFERENCES expenses(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  reason TEXT,
  changed_by UUID REFERENCES colaboradores(id),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Comentários de documentação
COMMENT ON TABLE expense_status_history IS 'Armazena o histórico imutável de todas as transições de status das despesas.';
COMMENT ON COLUMN expense_status_history.expense_id IS 'ID da despesa associada';
COMMENT ON COLUMN expense_status_history.old_status IS 'Status anterior (NULL se for criação)';
COMMENT ON COLUMN expense_status_history.new_status IS 'Novo status da despesa';
COMMENT ON COLUMN expense_status_history.reason IS 'Motivo ou justificativa (obrigatório em reprovações)';
COMMENT ON COLUMN expense_status_history.changed_by IS 'Usuário que executou a transição de status';
COMMENT ON COLUMN expense_status_history.created_at IS 'Carimbo de data e hora da transição';

-- 2. Habilita RLS na Tabela de Histórico
ALTER TABLE expense_status_history ENABLE ROW LEVEL SECURITY;

-- 3. Políticas de RLS para expense_status_history
-- Qualquer usuário autenticado pode ler o histórico de despesas que ele tem permissão de ver
DROP POLICY IF EXISTS "Permitir leitura de histórico para autenticados" ON expense_status_history;
CREATE POLICY "Permitir leitura de histórico para autenticados"
ON expense_status_history FOR SELECT
TO authenticated
USING (true);

-- Impedir qualquer UPDATE ou DELETE manual no histórico (imutabilidade estrita)
-- Somente o trigger de sistema pode inserir

-- 4. Trigger Automático para Registro Imutável de Histórico
CREATE OR REPLACE FUNCTION log_expense_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    v_user_id := NEW.colaborador_id;
  END IF;

  -- Caso 1: Lançamento inicial (INSERT)
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO expense_status_history (
      expense_id, 
      old_status, 
      new_status, 
      reason, 
      changed_by, 
      created_at
    ) VALUES (
      NEW.id, 
      NULL, 
      NEW.status, 
      NULL, 
      v_user_id, 
      NOW()
    );

  -- Caso 2: Transição de Status (UPDATE)
  ELSIF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO expense_status_history (
      expense_id, 
      old_status, 
      new_status, 
      reason, 
      changed_by, 
      created_at
    ) VALUES (
      NEW.id, 
      OLD.status, 
      NEW.status, 
      NEW.motivo_reprovacao, 
      v_user_id, 
      NOW()
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Vincula o Trigger de Histórico na tabela expenses
DROP TRIGGER IF EXISTS trg_log_expense_status ON expenses;
CREATE TRIGGER trg_log_expense_status
AFTER INSERT OR UPDATE OF status ON expenses
FOR EACH ROW
EXECUTE FUNCTION log_expense_status_change();
