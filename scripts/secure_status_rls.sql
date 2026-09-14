-- ==============================================================================
-- SAAV EXPENSES — BLINDAGEM DE SEGURANÇA E MÁQUINA DE ESTADOS NO POSTGRESQL
-- Execute este script no SQL Editor do Supabase (https://supabase.com/dashboard/project/gqatshashcohenmpcgqq/sql/new)
-- ==============================================================================

-- 1. Função de Validação de Permissão e Máquina de Estados Oficial
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
  -- Despesas com status APROVADO são imutáveis e não podem ser reabertas ou alteradas
  IF OLD.status = 'APROVADO' THEN
    RAISE EXCEPTION 'Transição de Estado Inválida: Despesas já liquidadas (APROVADO) são imutáveis e não podem retornar para %.', NEW.status;
  END IF;

  -- Regra B: Justificativa Obrigatória em Reprovações
  IF NEW.status = 'REPROVADO' AND (NEW.motivo_reprovacao IS NULL OR TRIM(NEW.motivo_reprovacao) = '') THEN
    RAISE EXCEPTION 'Regra de Negócio Violada: A justificativa é estritamente obrigatória para reprovar uma despesa.';
  END IF;

  -- Regra C: Transições Válidas da Máquina de Estados
  -- ABERTO -> VALIDADO ou REPROVADO
  -- VALIDADO -> APROVADO ou REPROVADO
  -- REPROVADO -> ABERTO
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
  -- 1. Transição para VALIDADO só pode ser feita por Gestor, Supervisor, Kyanne ou Admin
  IF NEW.status = 'VALIDADO' THEN
    IF v_funcao NOT IN ('Gestor', 'Supervisor', 'Kyanne', 'Admin') THEN
      RAISE EXCEPTION 'Acesso Negado (RLS): Apenas Gestores e Administradores podem validar despesas no CRM.';
    END IF;
  END IF;

  -- 2. Transição para APROVADO só pode ser feita por Financeiro ou Admin
  IF NEW.status = 'APROVADO' THEN
    IF v_funcao NOT IN ('Financeiro', 'Admin') THEN
      RAISE EXCEPTION 'Acesso Negado (RLS): Apenas o Financeiro e Administradores podem liquidar/aprovar despesas.';
    END IF;
  END IF;

  -- 3. Transição para REPROVADO só pode ser feita por Gestor, Financeiro ou Admin
  IF NEW.status = 'REPROVADO' THEN
    IF v_funcao NOT IN ('Gestor', 'Supervisor', 'Kyanne', 'Financeiro', 'Admin') THEN
      RAISE EXCEPTION 'Acesso Negado (RLS): Colaboradores não têm permissão para reprovar despesas.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Vincula o Trigger na tabela expenses
DROP TRIGGER IF EXISTS trg_check_expense_status ON expenses;
CREATE TRIGGER trg_check_expense_status
BEFORE UPDATE OF status ON expenses
FOR EACH ROW
EXECUTE FUNCTION check_expense_status_transition();

COMMENT ON FUNCTION check_expense_status_transition() IS 'Garante no PostgreSQL as regras da máquina de estados oficial e bloqueia transições de status não autorizadas por papel funcional.';
