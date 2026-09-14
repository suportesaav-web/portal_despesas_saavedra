# SAAV EXPENSES — V2
## Especificação Completa de Engenharia, Arquitetura, Banco, Segurança e Regras de Negócio

**Empresa:** Saavedra  
**Sistema:** SAAV EXPENSES  
**Documento:** AI_DEVELOPMENT_SPEC_V2.md  
**Status:** Alpha / Homologação e Testes  
**Data:** 2026-09-08

---

# 1. OBJETIVO

Este documento é a especificação de referência para desenvolvimento, manutenção e evolução do SAAV EXPENSES utilizando Antigravity IDE e agentes de IA.

A IA deve tratar este documento como uma especificação de produto e engenharia, e não como uma lista opcional de sugestões.

O objetivo é construir um sistema corporativo confiável para:

- lançamento de despesas;
- prestação de contas;
- anexação de comprovantes;
- validação administrativa/técnica;
- aprovação;
- liquidação financeira/reembolso;
- consulta;
- relatórios;
- administração de usuários;
- futura integração com módulos financeiros mais amplos.

A implementação atual utiliza React 19, React Router DOM 7, Vite 8, CSS3 Vanilla e Supabase com PostgreSQL, Auth, Storage e RLS.

---

# 2. PRINCÍPIO FUNDAMENTAL

O sistema não deve ser tratado como uma simples substituição visual da planilha.

A planilha legada é referência funcional e histórica.

A aplicação deve transformar o processo de negócio em dados estruturados, regras de negócio, permissões e fluxos auditáveis.

## Regra

Não reproduzir:

- abas mensais;
- fórmulas espalhadas;
- células auxiliares;
- referências indiretas;
- lógica escondida em planilhas.

Reproduzir:

- conceitos;
- categorias;
- centros de custo;
- clientes;
- bancos;
- lançamentos;
- pagamentos;
- relatórios;
- metas;
- regras de aprovação.

---

# 3. ESCOPO ATUAL

O núcleo atual do SAAV EXPENSES é:

```text
Autenticação
    ↓
Usuário
    ↓
Lançamento de despesa
    ↓
Comprovante
    ↓
Validação administrativa
    ↓
Liquidação financeira
    ↓
Extrato / Relatórios
```

## Fora do escopo imediato

Os seguintes módulos pertencem à evolução futura e não devem ser implementados automaticamente apenas por existirem nesta documentação:

- contas a pagar completo;
- contas a receber completo;
- DRE completo;
- fluxo de caixa corporativo;
- conciliação bancária;
- orçamento empresarial;
- BI financeiro completo.

Eles devem ser projetados de maneira compatível com a arquitetura futura, mas só implementados mediante tarefa específica.

---

# 4. VISÃO FUTURA

O SAAV EXPENSES deve poder evoluir para uma plataforma financeira:

```text
SAAV PLATFORM
│
├── Expenses
│   ├── Despesas
│   ├── Comprovantes
│   ├── Aprovações
│   └── Reembolsos
│
├── Financeiro
│   ├── Contas a pagar
│   ├── Contas a receber
│   ├── Fluxo de caixa
│   ├── Bancos
│   └── Transferências
│
├── Gestão
│   ├── Centros de custo
│   ├── Clientes
│   ├── Fornecedores
│   ├── Plano de contas
│   └── Metas
│
└── BI
    ├── DRE
    ├── Dashboards
    └── Indicadores
```

A arquitetura atual deve permitir essa expansão sem exigir reescrita do núcleo.

---

# 5. ARQUITETURA

## 5.1 Arquitetura atual

```text
React
   │
   ├── Pages
   ├── Components
   ├── Services
   └── Supabase Client
            │
            ├── Auth
            ├── PostgreSQL
            ├── Storage
            └── RLS
```

## 5.2 Regra arquitetural

A interface não deve conter regras críticas de segurança.

A segurança deve ser garantida pelo Supabase/PostgreSQL/RLS.

O frontend apenas apresenta a interface adequada ao usuário.

---

# 6. CAMADAS

## 6.1 Presentation

Responsável por:

- telas;
- componentes;
- formulários;
- feedback;
- navegação.

Não deve conter regras financeiras complexas.

## 6.2 Services

Responsável por:

- comunicação com Supabase;
- CRUD;
- upload;
- consultas;
- operações específicas.

## 6.3 Database

Responsável por:

- persistência;
- constraints;
- relacionamentos;
- RLS;
- integridade.

## 6.4 Auth

Responsável por:

- login;
- sessão;
- logout;
- identidade.

---

# 7. ESTRUTURA DE DADOS

O modelo recomendado deve ser orientado a entidades.

## Entidades principais

```text
profiles
roles
expenses
expense_status_history
expense_attachments
clients
cost_centers
expense_categories
payment_methods
banks
payments
notifications
audit_logs
```

Algumas entidades podem já existir com nomes diferentes no projeto atual. Antes de criar uma tabela nova, verificar o schema existente.

---

# 8. PROFILE

Representa o usuário operacional do sistema.

Campos recomendados:

```text
id
auth_user_id
name
email
role_id
active
created_at
updated_at
```

O `auth_user_id` deve corresponder ao usuário autenticado no Supabase Auth.

Nunca armazenar senha em `profiles`.

---

# 9. ROLES

Papéis funcionais:

```text
COLABORADOR
GESTOR
FINANCEIRO
ADMIN
```

Se o banco atual usar nomes diferentes, preservar os nomes existentes até uma migração planejada.

## COLABORADOR

Pode:

- criar despesas;
- visualizar próprias despesas;
- anexar comprovantes;
- acompanhar status;
- consultar justificativas;
- corrigir despesas reprovadas quando permitido.

## GESTOR

Pode:

- visualizar despesas do seu escopo;
- validar;
- reprovar;
- acompanhar pendências;
- consultar relatórios permitidos.

## FINANCEIRO

Pode:

- visualizar despesas validadas;
- conferir dados;
- liquidar;
- registrar pagamento/reembolso;
- reprovar por inconsistência financeira.

## ADMIN

Pode:

- administrar usuários;
- administrar permissões;
- acessar visão global;
- executar operações administrativas.

---

# 10. DESPENSE / EXPENSE

A entidade central é a despesa.

Modelo conceitual:

```text
expenses
--------
id
user_id
client_id
category_id
cost_center_id
amount
expense_date
expense_time
description
status
created_at
updated_at
```

Campos opcionais:

```text
rejection_reason
approved_at
approved_by
paid_at
paid_by
```

Se esses campos forem substituídos por tabelas de histórico/auditoria, preferir o modelo normalizado.

---

# 11. STATUS

Estados oficiais:

```text
ABERTO
VALIDADO
REPROVADO
APROVADO
```

Opcional:

```text
CANCELADO
```

Não criar estados novos sem necessidade funcional.

---

# 12. MÁQUINA DE ESTADOS

Fluxo:

```text
ABERTO
  │
  ├───────────────► REPROVADO
  │                    │
  │                    ▼
  │                  CORREÇÃO
  │                    │
  │                    └────► ABERTO
  │
  ▼
VALIDADO
  │
  ▼
APROVADO
```

## Regras

### ABERTO → VALIDADO

Somente:

- Gestor;
- Administrativo;
- Admin.

### ABERTO → REPROVADO

Somente:

- Gestor;
- Administrativo;
- Admin.

Justificativa obrigatória.

### REPROVADO → ABERTO

Colaborador pode corrigir quando a regra permitir.

### VALIDADO → APROVADO

Somente:

- Financeiro;
- Admin.

### VALIDADO → REPROVADO

Permitido ao Financeiro/Admin em caso de inconsistência financeira.

Justificativa obrigatória.

---

# 13. HISTÓRICO DE STATUS

Toda transição deve gerar histórico.

Modelo:

```text
expense_status_history
----------------------
id
expense_id
old_status
new_status
reason
changed_by
changed_at
```

Nunca apagar o histórico.

---

# 14. AUDITORIA

Toda operação crítica deve ser rastreável.

Modelo:

```text
audit_logs
----------
id
user_id
entity
entity_id
action
old_value
new_value
created_at
```

Operações críticas:

- criação;
- alteração;
- reprovação;
- validação;
- aprovação;
- cancelamento;
- alteração de usuário;
- alteração de papel;
- alteração de categoria;
- alteração de permissões.

---

# 15. CLIENTES

Entidade:

```text
clients
-------
id
name
active
created_at
updated_at
```

Futuramente pode receber:

```text
document
phone
email
address
notes
```

Não obrigar esses campos no fluxo de despesa se não forem necessários.

---

# 16. CENTROS DE CUSTO

Entidade:

```text
cost_centers
------------
id
code
name
active
created_at
updated_at
```

O sistema deve permitir que uma despesa seja vinculada a um centro de custo quando a regra operacional exigir.

---

# 17. PLANO DE CONTAS

A estrutura deve suportar hierarquia.

Modelo:

```text
expense_categories
------------------
id
code
name
parent_id
active
```

Exemplo:

```text
2.3 DESPESAS OPERACIONAIS
    2.3.1 Estacionamento
    2.3.2 Pedágio
    2.3.3 Frango para Treinamento
    2.3.4 Carne Bovina Treinamento
    2.3.5 Aluguel Mobi
    2.3.6 Aluguel T-Cross

2.4 DESPESAS COM MARKETING
    2.4.1 Amostras
    2.4.2 Brindes
    2.4.3 Coffee
    2.4.4 Produtos Promocionais
    2.4.5 Balas
    2.4.6 Tratamento de Fotos
    2.4.7 Pipoca
    2.4.8 Paçoca
    2.4.9 Pirulito
    2.4.10 Mariola
    2.4.11 Mouse Pad
    2.4.12 Bombom

2.5 OUTRAS DESPESAS
    2.5.1 Material Escritório
    2.5.2 Outros

2.6 Despesas Operacionais Gerais
2.7 Outra Despesa
2.8 Despesa Financeira
2.9 Impostos
2.10 Investimento
```

Categorias existentes não devem ser removidas sem análise de impacto.

---

# 18. VALORES

Valores monetários devem ser tratados com precisão.

Banco:

```text
numeric
```

Não utilizar `float` para armazenar dinheiro.

Frontend:

```text
R$ 1.250,50
```

Banco:

```text
1250.50
```

---

# 19. DATAS

Interface:

```text
DD/MM/YYYY
```

Banco:

formato nativo PostgreSQL.

Evitar conversões implícitas de timezone.

Data da despesa e data de pagamento são conceitos diferentes.

---

# 20. DATA DO LANÇAMENTO X DATA DO PAGAMENTO

Não misturar.

Exemplo:

```text
Despesa:
R$ 1.000

Data da despesa:
10/02

Pagamento:
05/03
```

A despesa pertence ao evento ocorrido em fevereiro.

A liquidação financeira pertence a março.

Essa separação será importante na futura implementação de relatórios financeiros.

---

# 21. PAGAMENTOS

Quando houver pagamento, registrar:

```text
payments
--------
id
expense_id
amount
payment_date
payment_method_id
bank_id
paid_by
created_at
```

Isso permite futuramente suportar pagamento parcial.

Exemplo:

```text
Despesa = R$ 1.000

Pagamento 1 = R$ 400
Pagamento 2 = R$ 600
```

Não implementar pagamento parcial na interface atual se não houver requisito, mas não bloquear a arquitetura.

---

# 22. FORMAS DE PAGAMENTO

Modelo:

```text
payment_methods
---------------
id
name
active
```

Exemplos:

```text
PIX
Boleto
Transferência
Cartão
Dinheiro
Reembolso
```

Preservar as opções atualmente utilizadas.

---

# 23. BANCOS

Modelo futuro:

```text
banks
-----
id
name
account_identifier
active
```

O módulo de despesas pode inicialmente utilizar apenas o banco necessário para liquidação.

O controle bancário completo pertence ao módulo financeiro futuro.

---

# 24. COMPROVANTES

Modelo:

```text
expense_attachments
-------------------
id
expense_id
file_path
file_name
mime_type
file_size
uploaded_by
created_at
```

Bucket:

```text
comprovantes
```

Arquivos devem preferencialmente ser privados.

A aplicação deve utilizar mecanismos seguros de acesso.

---

# 25. REGRAS DE UPLOAD

Permitir:

- imagens;
- PDF.

Validar:

- extensão;
- MIME;
- tamanho;
- sucesso do upload;
- existência do arquivo.

O usuário deve receber feedback.

Não marcar a despesa como totalmente registrada se a regra exigir comprovante e o upload falhar.

---

# 26. MOBILE

O lançamento de despesa é uma operação mobile-first.

Fluxo ideal:

```text
Novo lançamento
     ↓
Cliente
     ↓
Data
     ↓
Horário
     ↓
Categoria
     ↓
Valor
     ↓
Comprovante
     ↓
Salvar
```

O formulário deve ser rápido.

Evitar dezenas de campos na primeira etapa.

---

# 27. CÂMERA

Em dispositivos móveis:

```text
Tirar foto
```

deve ser uma opção simples.

Não exigir que o usuário conheça caminhos internos de armazenamento do celular.

---

# 28. DASHBOARD

## Colaborador

Mostrar:

```text
Minhas despesas
Abertas
Validadas
Reprovadas
Aprovadas
Total do período
```

## Gestor

Mostrar:

```text
Aguardando validação
Total pendente
Quantidade por colaborador
Reprovadas
```

## Financeiro

Mostrar:

```text
Aguardando pagamento
Valor pendente
Validadas
Pagamentos realizados
Inconsistências
```

## Admin

Mostrar visão global.

---

# 29. RELATÓRIOS

Filtros mínimos:

```text
Período
Usuário
Status
Categoria
Cliente
```

Filtros adicionais quando suportados:

```text
Centro de custo
Banco
Forma de pagamento
Valor
```

---

# 30. EXPORTAÇÃO

Exportar CSV com:

```text
UTF-8 BOM
```

para compatibilidade com Excel no Windows.

Colunas recomendadas:

```text
Data
Colaborador
Cliente
Categoria
Centro de Custo
Valor
Status
Data de Pagamento
Forma de Pagamento
```

---

# 31. CONSULTA

A consulta deve possuir:

- busca;
- filtros;
- ordenação;
- paginação.

Nunca carregar todos os registros de forma indiscriminada.

---

# 32. PAGINAÇÃO

Toda lista potencialmente grande deve utilizar paginação.

Exemplo:

```text
20 registros por página
```

ou equivalente.

Nunca assumir que o banco terá poucos registros.

---

# 33. RLS

RLS é requisito crítico.

## Colaborador

Pode acessar somente registros permitidos pelo próprio usuário.

## Gestor

Pode acessar registros do escopo autorizado.

## Financeiro

Pode acessar registros necessários para liquidação.

## Admin

Pode acessar visão global.

---

# 34. SEGURANÇA DO FRONTEND

Esconder botão não é segurança.

Errado:

```javascript
if (isAdmin) mostrarBotao()
```

como única proteção.

Correto:

```text
Frontend
    ↓
UI apropriada

Supabase/RLS
    ↓
Autorização real
```

---

# 35. SERVICE ROLE

Nunca expor `SUPABASE_SERVICE_ROLE_KEY` no frontend.

Somente variáveis públicas apropriadas devem existir no bundle do React.

---

# 36. AUTH

Usar Supabase Auth.

Login:

```text
email + senha
```

Sessão persistente.

Logout deve:

- encerrar sessão;
- limpar estados sensíveis;
- retornar à tela de login.

---

# 37. TRATAMENTO DE SESSÃO

Tratar:

```text
sessão válida
sessão expirada
logout
erro de autenticação
```

O usuário não deve ficar preso em tela protegida após expiração.

---

# 38. UX DE ERROS

Não usar `alert()` como solução padrão.

Utilizar:

```text
Toast
Mensagem inline
Estado de erro
Retry
```

Mensagens devem ser claras.

Ruim:

```text
Erro.
```

Bom:

```text
Não foi possível enviar o comprovante.
Verifique sua conexão e tente novamente.
```

---

# 39. ESTADOS ASSÍNCRONOS

Toda operação deve considerar:

```text
idle
loading
success
error
```

Botões de submissão devem ser desabilitados durante operações que não aceitam repetição.

---

# 40. DUPLO ENVIO

Clicar várias vezes em:

```text
Salvar
```

não pode gerar múltiplas despesas.

Utilizar:

- bloqueio visual;
- estado de loading;
- estratégia adequada de idempotência quando necessário.

---

# 41. CANCELAMENTO

Evitar apagar despesas financeiras.

Preferir:

```text
CANCELADO
```

ou mecanismo de soft delete.

O histórico deve permanecer.

---

# 42. NOTIFICAÇÕES

Futuro:

```text
Despesa validada
Despesa reprovada
Pagamento realizado
Prazo próximo
```

Notificações não devem substituir o histórico.

---

# 43. REPROVAÇÃO

Ao reprovar:

```text
Motivo obrigatório
```

Exemplos:

```text
Visita não localizada no CRM.
Comprovante ilegível.
Valor inconsistente.
Categoria incorreta.
Dados incompletos.
```

O motivo deve ficar associado ao histórico.

---

# 44. CRM

A validação administrativa depende da conferência da visita no CRM.

A arquitetura deve permitir futuramente integração via API.

Não simular uma integração real sem acesso à API.

Até existir integração oficial:

```text
Validação manual
```

é válida.

---

# 45. INTEGRAÇÕES FUTURAS

Possíveis:

```text
CRM
Bancos
ERP
WhatsApp
E-mail
Power BI
```

Não implementar integrações fictícias.

Criar abstrações somente quando houver necessidade.

---

# 46. ESTRUTURA DE FRONTEND

Estrutura atual:

```text
src/
├── main.jsx
├── App.jsx
├── index.css
├── lib/
│   └── supabase.js
├── services/
│   ├── auth.js
│   ├── expenses.js
│   └── admin.js
├── components/
│   └── Layout.jsx
└── pages/
    ├── Login.jsx
    ├── Dashboard.jsx
    ├── Despesas.jsx
    ├── Aprovacoes.jsx
    ├── Relatorios.jsx
    └── Admin.jsx
```

Não reorganizar todo o projeto sem necessidade.

---

# 47. PADRÃO DE SERVICES

Services devem concentrar operações de dados.

Exemplo conceitual:

```javascript
expenseService.create()
expenseService.list()
expenseService.getById()
expenseService.update()
expenseService.validate()
expenseService.reject()
expenseService.approve()
expenseService.uploadAttachment()
```

Evitar espalhar chamadas Supabase diretamente em todos os componentes.

---

# 48. COMPONENTES REUTILIZÁVEIS

Criar somente quando houver repetição ou benefício claro.

Componentes esperados:

```text
Button
Input
Select
Modal
Toast
Loading
EmptyState
StatusBadge
ExpenseCard
ExpenseTable
FileUpload
ConfirmDialog
```

---

# 49. MOBILE E DESKTOP

## Mobile

Cards.

## Desktop

Tabelas e painéis.

Não obrigar o mesmo componente visual para os dois contextos.

---

# 50. RESPONSIVIDADE

Testar pelo menos:

```text
360px
390px
430px
768px
1024px
1366px
1920px
```

Nenhuma funcionalidade crítica pode desaparecer em telas pequenas.

---

# 51. ACESSIBILIDADE

Todos os formulários devem possuir:

- label;
- foco;
- mensagens de erro;
- navegação adequada;
- contraste;
- tamanho de toque adequado.

Não depender exclusivamente de cor para representar status.

---

# 52. DESIGN

Identidade:

```text
Corporativo
Moderno
Confiável
Limpo
Financeiro
```

Glassmorphism pode ser utilizado, mas não deve prejudicar:

- contraste;
- leitura;
- performance;
- acessibilidade.

---

# 53. PERFORMANCE

Prioridades:

1. primeira renderização rápida;
2. consultas eficientes;
3. paginação;
4. evitar chamadas duplicadas;
5. evitar renders desnecessários;
6. não carregar arquivos pesados antecipadamente.

---

# 54. BANCO DE DADOS

Toda alteração estrutural deve ser feita por migration reproduzível.

Antes de alterar uma tabela:

```text
Verificar referências
Verificar foreign keys
Verificar policies
Verificar queries
Verificar componentes
Verificar services
```

---

# 55. CONSTRAINTS

Sempre que possível, utilizar integridade no banco.

Exemplos:

```text
amount > 0
foreign keys
NOT NULL
UNIQUE
CHECK
```

Não depender somente de validação do React.

---

# 56. ÍNDICES

Criar índices para campos utilizados frequentemente em:

```text
WHERE
ORDER BY
JOIN
```

Especialmente:

```text
user_id
status
expense_date
category_id
client_id
cost_center_id
```

Não criar índices indiscriminadamente.

---

# 57. MIGRATIONS

Toda alteração de schema deve poder ser reproduzida em ambiente novo.

Nunca depender exclusivamente de alterações manuais no dashboard do Supabase.

---

# 58. DADOS HISTÓRICOS

A planilha financeira legada possui estrutura muito maior que o atual SAAV EXPENSES.

Ela contém conceitos como:

```text
Plano de contas
Centros de custo
Clientes
Bancos
Transferências
Lançamentos mensais
Fluxo de caixa
DRE
Contas a pagar/receber
Metas
Dashboards
```

Esses conceitos devem orientar a evolução futura, mas não devem ser importados cegamente para o módulo atual.

Dados históricos precisam ser saneados antes de uma migração.

---

# 59. PROBLEMAS DA BASE LEGADA

A análise da planilha identificou referências quebradas, incluindo células com:

```text
#REF!
```

Também foram encontrados registros históricos fora do ano indicado no nome do arquivo.

Portanto:

```text
NÃO importar a planilha diretamente.
```

Antes da migração:

```text
Auditar
Classificar
Normalizar
Validar
Importar
```

---

# 60. FUTURO MÓDULO FINANCEIRO

A arquitetura futura deve suportar:

```text
transactions
accounts
cost_centers
contacts
banks
payment_methods
payments
transfers
financial_goals
```

Uma única tabela de transações deve substituir a lógica de abas mensais.

Não criar:

```text
janeiro
fevereiro
março
...
```

como tabelas.

O mês deve ser derivado da data.

---

# 61. FLUXO DE CAIXA FUTURO

O fluxo deverá distinguir:

```text
data do evento
data do vencimento
data da liquidação
```

Exemplo:

```text
Despesa:
10/02

Vencimento:
28/02

Pagamento:
05/03
```

Dessa maneira:

- relatório operacional pode considerar 10/02;
- contas a pagar considera 28/02;
- fluxo realizado considera 05/03.

---

# 62. DRE FUTURA

O futuro DRE deverá poder agrupar:

```text
Receitas
Custos
Despesas
Resultado Financeiro
Impostos
Investimentos
```

e permitir drill-down:

```text
Grupo
  ↓
Categoria
  ↓
Subcategoria
  ↓
Transação
```

---

# 63. CENTRO DE CUSTO FUTURO

O futuro sistema deverá permitir:

```text
Receita por centro
Despesa por centro
Resultado por centro
```

---

# 64. CLIENTE FUTURO

O futuro sistema poderá mostrar:

```text
Receita por cliente
Custo por cliente
Resultado por cliente
Margem
```

Não implementar métricas que dependam de dados inexistentes.

---

# 65. METAS FUTURAS

Estrutura:

```text
financial_goals
---------------
id
period
goal_type
target_amount
created_by
created_at
```

Tipos:

```text
REVENUE
EXPENSE
PROFIT
```

---

# 66. API / FUTURO MOBILE

A regra de negócio não deve depender de uma interface específica.

A futura arquitetura deve permitir:

```text
             ┌── Web
API / DB ────┼── Mobile
             └── BI
```

O app mobile poderá ser React Native/Expo ou outra solução definida posteriormente.

Não criar código mobile dentro do projeto web sem decisão arquitetural.

---

# 67. TESTES

## Autenticação

```text
Login válido
Login inválido
Logout
Sessão expirada
```

## Despesas

```text
Criar
Consultar
Editar
Anexar
Validar
Reprovar
Corrigir
Aprovar
```

## Segurança

```text
Usuário A não acessa dados de B.
```

## Upload

```text
Foto
PDF
Arquivo inválido
Arquivo grande
Falha de conexão
```

---

# 68. TESTE PONTA A PONTA

Cenário mínimo:

```text
1. Colaborador entra
2. Cria despesa
3. Anexa comprovante
4. Salva
5. Gestor visualiza
6. Gestor valida
7. Financeiro visualiza
8. Financeiro liquida
9. Colaborador consulta status
10. Relatório exibe registro
```

Esse cenário precisa funcionar antes do rollout.

---

# 69. TESTE DE RLS

Executar testes específicos por perfil.

### Colaborador A

```text
SELECT próprias despesas
```

Resultado:

```text
OK
```

### Colaborador A

```text
SELECT despesas do Colaborador B
```

Resultado esperado:

```text
NEGADO / NÃO RETORNAR
```

### Gestor

Acessar somente o escopo permitido.

### Financeiro

Acessar dados necessários à liquidação.

### Admin

Acessar visão global.

---

# 70. TESTE DE NÃO REGRESSÃO

Após alterações significativas:

```bash
npm run build
```

Também testar manualmente as áreas afetadas.

Nunca assumir que build verde significa aplicação correta.

---

# 71. CRITÉRIO DE ACEITE

Uma tarefa está pronta quando:

```text
[ ] Implementada
[ ] Build funcionando
[ ] Sem erro crítico de console
[ ] Fluxo funcional testado
[ ] Responsividade testada
[ ] Loading tratado
[ ] Erro tratado
[ ] Sucesso tratado
[ ] Permissão verificada
[ ] RLS avaliado
[ ] Sem regressão
```

Para alterações financeiras:

```text
[ ] Valor conferido
[ ] Status conferido
[ ] Histórico conferido
[ ] Auditoria conferida
```

---

# 72. REGRA PARA IA

Antes de alterar código:

```text
1. Entender a tarefa
2. Localizar código relacionado
3. Ler dependências
4. Verificar banco
5. Verificar permissões
6. Verificar RLS
7. Planejar alteração
8. Implementar
9. Executar build
10. Testar
```

---

# 73. NÃO FAZER

A IA não deve:

- reescrever o projeto inteiro sem solicitação;
- trocar React por outro framework;
- trocar Supabase sem decisão explícita;
- criar banco paralelo;
- colocar credenciais no frontend;
- ignorar RLS;
- apagar dados financeiros;
- criar estados financeiros arbitrários;
- duplicar lógica;
- instalar bibliotecas sem necessidade;
- alterar o fluxo de aprovação sem autorização;
- alterar categorias sem análise;
- criar integração fictícia;
- declarar uma funcionalidade como concluída sem teste.

---

# 74. PRIORIDADE

Quando houver conflito:

```text
1. Segurança
2. Integridade dos dados
3. Regra de negócio
4. Funcionamento
5. UX
6. Performance
7. Estética
```

---

# 75. ESTRATÉGIA DE IMPLEMENTAÇÃO

A ordem recomendada:

## Fase 1

Estabilizar o núcleo:

```text
Auth
Profiles
Expenses
Attachments
RLS
```

## Fase 2

Estabilizar workflow:

```text
ABERTO
VALIDADO
REPROVADO
APROVADO
```

## Fase 3

Melhorar UX:

```text
Mobile
Toast
Upload
Formulários
Responsividade
```

## Fase 4

Relatórios:

```text
Filtros
Exportação
Dashboards
```

## Fase 5

Homologação:

```text
Vendedor
Gestor
Financeiro
```

## Fase 6

Produção:

```text
Rollout
Monitoramento
Feedback
Correções
```

## Fase 7

Expansão:

```text
Financeiro
DRE
Fluxo de caixa
Metas
BI
```

---

# 76. DEFINITION OF DONE

O desenvolvimento só deve avançar para a próxima fase quando a anterior estiver funcional.

## Alpha

```text
[ ] Login
[ ] Despesa
[ ] Upload
[ ] Validação
[ ] Reprovação
[ ] Aprovação
[ ] RLS
```

## Beta

```text
[ ] UX mobile
[ ] Toasts
[ ] Relatórios
[ ] Exportação
[ ] Cliente/Obra
[ ] Testes com usuários
```

## Produção

```text
[ ] Homologação
[ ] Backup
[ ] Segurança
[ ] Monitoramento
[ ] Documentação
[ ] Rollout
```

---

# 77. DOCUMENTAÇÃO VIVA

Sempre que uma decisão estrutural mudar, atualizar:

```text
README.md
AI_DEVELOPMENT_SPEC_V2.md
ARCHITECTURE.md
BUSINESS_RULES.md
ROADMAP.md
```

Não deixar código e documentação divergirem.

---

# 78. REGRA FINAL

O SAAV EXPENSES não deve ser tratado como um projeto experimental.

É um sistema corporativo.

Toda alteração deve considerar:

```text
Usuário
Dados
Segurança
Processo
Auditoria
Escalabilidade
```

O objetivo não é somente fazer a tela funcionar.

O objetivo é construir uma plataforma confiável para a operação da Saavedra.

---

# 79. PROMPT BASE PARA O ANTIGRAVITY

Utilizar este bloco como instrução inicial do agente:

```text
Você está trabalhando no SAAV EXPENSES, sistema corporativo da Saavedra.

Antes de modificar qualquer código:

1. Leia README.md.
2. Leia AI_DEVELOPMENT_SPEC_V2.md.
3. Inspecione a implementação atual.
4. Identifique banco, services, páginas, componentes e políticas RLS afetadas.
5. Não reescreva funcionalidades existentes sem necessidade.
6. Preserve o fluxo de aprovação.
7. Preserve segurança e isolamento de dados.
8. Não coloque regras de segurança somente no frontend.
9. Não exponha secrets.
10. Não apague dados financeiros.
11. Para mudanças de banco, avalie migrations, foreign keys e RLS.
12. Para mudanças de workflow, preserve a máquina de estados.
13. Para operações assíncronas, implemente loading, sucesso e erro.
14. Para operações financeiras, preserve precisão monetária.
15. Para telas operacionais, priorize mobile.
16. Após implementar, execute o build.
17. Verifique regressões.
18. Explique objetivamente o que foi alterado, quais arquivos foram afetados e quais testes foram realizados.

Quando uma tarefa for ambígua, escolha a solução menos invasiva que preserve a arquitetura e as regras de negócio.

Não invente integrações, dados ou regras.

Não considere uma tarefa concluída apenas porque o código compila.
```

---

# 80. ESTADO ATUAL DE REFERÊNCIA

O README atual define o projeto como:

```text
SAAV EXPENSES
Sistema Corporativo para Lançamento,
Validação Técnica e Pagamento de Despesas Comerciais
```

A implementação atual possui:

```text
Login
Dashboard
Despesas
Aprovações
Relatórios
Administração
```

e utiliza:

```text
React 19
Vite 8
Supabase
PostgreSQL
Auth
Storage
RLS
```

O roadmap atual prioriza:

```text
Upload mobile
Fluxo ponta a ponta
Auditoria RLS
Cliente/Obra
Toasts
Compatibilidade Excel
Homologação
Rollout
```

Esta especificação amplia o README sem substituir sua função como documentação básica do projeto.

---

# FIM

**SAAV EXPENSES — Saavedra — 2026**
