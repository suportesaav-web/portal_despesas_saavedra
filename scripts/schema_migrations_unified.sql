-- ==============================================================================
-- SAAV EXPENSES — MIGRAÇÃO CONSOLIDADA COMPLETA (BANCO POSTGRESQL / SUPABASE)
-- Execute este script completo no SQL Editor do seu Dashboard Supabase:
-- https://supabase.com/dashboard/project/gqatshashcohenmpcgqq/sql/new
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- ETAPA 1: Adição das Colunas Estruturadas na Tabela 'expenses'
-- ------------------------------------------------------------------------------
ALTER TABLE expenses 
ADD COLUMN IF NOT EXISTS hora VARCHAR(10),
ADD COLUMN IF NOT EXISTS categoria_codigo VARCHAR(20),
ADD COLUMN IF NOT EXISTS categoria_grupo TEXT,
ADD COLUMN IF NOT EXISTS validado_por UUID REFERENCES colaboradores(id),
ADD COLUMN IF NOT EXISTS data_validacao TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS liquidado_por UUID REFERENCES colaboradores(id),
ADD COLUMN IF NOT EXISTS data_liquidacao TIMESTAMPTZ;

COMMENT ON COLUMN expenses.cliente IS 'Nome do cliente ou local da visita para cruzamento com o CRM';
COMMENT ON COLUMN expenses.hora IS 'Horário da despesa/visita (ex: 14:30)';
COMMENT ON COLUMN expenses.categoria_codigo IS 'Código do plano de contas (ex: 2.3.1)';
COMMENT ON COLUMN expenses.categoria_grupo IS 'Grupo contábil (ex: 2.3 - DESPESAS OPERACIONAIS)';
COMMENT ON COLUMN expenses.validado_por IS 'Gestor/Admin que validou a visita no CRM';
COMMENT ON COLUMN expenses.data_validacao IS 'Data/hora em que a visita foi validada no CRM';
COMMENT ON COLUMN expenses.liquidado_por IS 'Operador financeiro que liquidou o reembolso';
COMMENT ON COLUMN expenses.data_liquidacao IS 'Data/hora em que a despesa foi liquidada/reembolsada';

-- ------------------------------------------------------------------------------
-- ETAPA 2: Blindagem da Máquina de Estados e Permissões por Papel (Trigger)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_expense_status_transition()
RETURNS TRIGGER AS $$
DECLARE
  v_funcao TEXT;
BEGIN
  -- Se o status não foi alterado, permite o update normal
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Regra A: Imutabilidade de Despesas Liquidadas
  IF OLD.status = 'APROVADO' THEN
    RAISE EXCEPTION 'Transição de Estado Inválida: Despesas já liquidadas (APROVADO) são imutáveis e não podem retornar para %.', NEW.status;
  END IF;

  -- Regra B: Justificativa Obrigatória em Reprovações
  IF NEW.status = 'REPROVADO' AND (NEW.motivo_reprovacao IS NULL OR TRIM(NEW.motivo_reprovacao) = '') THEN
    RAISE EXCEPTION 'Regra de Negócio Violada: A justificativa é estritamente obrigatória para reprovar uma despesa.';
  END IF;

  -- Regra C: Transições Válidas da Máquina de Estados
  IF OLD.status = 'ABERTO' AND NEW.status NOT IN ('VALIDADO', 'REPROVADO') THEN
    RAISE EXCEPTION 'Transição de Estado Inválida: De ABERTO só é permitido transicionar para VALIDADO ou REPROVADO (tentativa: %).', NEW.status;
  END IF;

  IF OLD.status = 'VALIDADO' AND NEW.status NOT IN ('APROVADO', 'REPROVADO') THEN
    RAISE EXCEPTION 'Transição de Estado Inválida: De VALIDADO só é permitido transicionar para APROVADO ou REPROVADO (tentativa: %).', NEW.status;
  END IF;

  IF OLD.status = 'REPROVADO' AND NEW.status NOT IN ('ABERTO') THEN
    RAISE EXCEPTION 'Transição de Estado Inválida: De REPROVADO só é permitido retornar para ABERTO para correção (tentativa: %).', NEW.status;
  END IF;

  -- Busca o papel do usuário autenticado no Supabase
  SELECT funcao INTO v_funcao 
  FROM colaboradores 
  WHERE id = auth.uid();

  -- Regra D: Permissões por Papel (Role Security)
  IF NEW.status = 'VALIDADO' THEN
    IF v_funcao NOT IN ('Gestor', 'Supervisor', 'Kyanne', 'Admin') THEN
      RAISE EXCEPTION 'Acesso Negado (RLS): Apenas Gestores e Administradores podem validar despesas no CRM.';
    END IF;
  END IF;

  IF NEW.status = 'APROVADO' THEN
    IF v_funcao NOT IN ('Financeiro', 'Admin') THEN
      RAISE EXCEPTION 'Acesso Negado (RLS): Apenas o Financeiro e Administradores podem liquidar/aprovar despesas.';
    END IF;
  END IF;

  IF NEW.status = 'REPROVADO' THEN
    IF v_funcao NOT IN ('Gestor', 'Supervisor', 'Kyanne', 'Financeiro', 'Admin') THEN
      RAISE EXCEPTION 'Acesso Negado (RLS): Colaboradores não têm permissão para reprovar despesas.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_check_expense_status ON expenses;
CREATE TRIGGER trg_check_expense_status
BEFORE UPDATE OF status ON expenses
FOR EACH ROW
EXECUTE FUNCTION check_expense_status_transition();

COMMENT ON FUNCTION check_expense_status_transition() IS 'Garante no PostgreSQL as regras da máquina de estados oficial e bloqueia transições de status não autorizadas por papel funcional.';

-- ------------------------------------------------------------------------------
-- ETAPA 3: Tabela de Histórico de Transições de Status (Imutável)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS expense_status_history (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  expense_id BIGINT REFERENCES expenses(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  reason TEXT,
  changed_by UUID REFERENCES colaboradores(id),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE expense_status_history IS 'Armazena o histórico imutável de todas as transições de status das despesas.';
COMMENT ON COLUMN expense_status_history.expense_id IS 'ID da despesa associada';
COMMENT ON COLUMN expense_status_history.old_status IS 'Status anterior (NULL se for criação)';
COMMENT ON COLUMN expense_status_history.new_status IS 'Novo status da despesa';
COMMENT ON COLUMN expense_status_history.reason IS 'Motivo ou justificativa (obrigatório em reprovações)';
COMMENT ON COLUMN expense_status_history.changed_by IS 'Usuário que executou a transição de status';
COMMENT ON COLUMN expense_status_history.created_at IS 'Carimbo de data e hora da transição';

ALTER TABLE expense_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura de histórico para autenticados" ON expense_status_history;
CREATE POLICY "Permitir leitura de histórico para autenticados"
ON expense_status_history FOR SELECT
TO authenticated
USING (true);

CREATE OR REPLACE FUNCTION log_expense_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    v_user_id := NEW.colaborador_id;
  END IF;

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

DROP TRIGGER IF EXISTS trg_log_expense_status ON expenses;
CREATE TRIGGER trg_log_expense_status
AFTER INSERT OR UPDATE OF status ON expenses
FOR EACH ROW
EXECUTE FUNCTION log_expense_status_change();

-- ------------------------------------------------------------------------------
-- ETAPA 4: Tabela de Trilha de Auditoria (audit_logs)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID REFERENCES colaboradores(id),
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE audit_logs IS 'Armazena a trilha de auditoria para operações críticas do sistema.';
COMMENT ON COLUMN audit_logs.user_id IS 'Usuário responsável pela operação';
COMMENT ON COLUMN audit_logs.action IS 'Ação executada (ex: CREATE_EXPENSE, VALIDATE_EXPENSE, REJECT_EXPENSE, APPROVE_EXPENSE, UPLOAD_ATTACHMENT)';
COMMENT ON COLUMN audit_logs.entity IS 'Entidade afetada (ex: expenses, colaboradores, storage)';
COMMENT ON COLUMN audit_logs.entity_id IS 'Identificador do registro afetado';
COMMENT ON COLUMN audit_logs.details IS 'Detalhes em formato JSON com dados anteriores e novos';
COMMENT ON COLUMN audit_logs.created_at IS 'Carimbo cronológico do evento';

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir inserção de audit_logs para autenticados" ON audit_logs;
CREATE POLICY "Permitir inserção de audit_logs para autenticados"
ON audit_logs FOR INSERT
TO authenticated
WITH CHECK (true);

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
