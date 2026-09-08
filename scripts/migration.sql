-- Script de Migração / Adição de Campos na tabela expenses
-- Execute este script no SQL Editor do Supabase (https://supabase.com/dashboard/project/gqatshashcohenmpcgqq/sql/new)

ALTER TABLE expenses 
ADD COLUMN IF NOT EXISTS hora VARCHAR(10),
ADD COLUMN IF NOT EXISTS categoria_codigo VARCHAR(20),
ADD COLUMN IF NOT EXISTS categoria_grupo TEXT,
ADD COLUMN IF NOT EXISTS validado_por UUID REFERENCES colaboradores(id),
ADD COLUMN IF NOT EXISTS data_validacao TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS liquidado_por UUID REFERENCES colaboradores(id),
ADD COLUMN IF NOT EXISTS data_liquidacao TIMESTAMPTZ;

-- Comentários para documentação das colunas
COMMENT ON COLUMN expenses.cliente IS 'Nome do cliente ou local da visita para cruzamento com o CRM';
COMMENT ON COLUMN expenses.hora IS 'Horário da despesa/visita (ex: 14:30)';
COMMENT ON COLUMN expenses.categoria_codigo IS 'Código do plano de contas (ex: 2.3.1)';
COMMENT ON COLUMN expenses.categoria_grupo IS 'Grupo contábil (ex: 2.3 - DESPESAS OPERACIONAIS)';
