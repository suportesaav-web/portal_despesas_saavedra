# Backup do Código Antigo (Apps Script)

## codigo.gs
```javascript
/**
 * ------------------------------------------------------------------
 * BACKEND - PORTAL SAAVEDRA (Google Apps Script)
 * ------------------------------------------------------------------
 * Responsável por servir a página HTML, comunicar com a Planilha,
 * gerenciar segurança e enviar notificações.
 */

// Serve o arquivo HTML principal quando alguém acessa a URL do Web App
function doGet() {
  return HtmlService.createTemplateFromFile('Index')
      .evaluate()
      .setTitle('Portal Saavedra') // Título da aba do navegador
      .setSandboxMode(HtmlService.SandboxMode.IFRAME)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1'); // Responsividade mobile
}

// --- SEGURANÇA E AUTENTICAÇÃO ---

/**
 * Identifica quem está acessando o sistema.
 * Cruza o e-mail do Google (Session) com a tabela 'Colaboradores'.
 * Define se o usuário tem poderes de FINANCEIRO/ADMIN.
 */
function getUsuarioLogado() {
  try {
    var userEmail = Session.getActiveUser().getEmail();
    var sheetColab = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Colaboradores");
    var dados = sheetColab.getDataRange().getValues();
    
    // Objeto padrão (visitante sem permissão)
    var usuario = { email: userEmail, nome: "Colaborador", funcao: "Vendedor", isFinanceiro: false };

    // Varre a tabela Colaboradores (ignora cabeçalho)
    // Mapeamento: Coluna A [0] = Nome | Coluna B [1] = Email | Coluna C [2] = Função
    for (var i = 1; i < dados.length; i++) {
      var emailColab = dados[i][1];
      
      // Comparação segura: remove espaços e ignora maiúsculas/minúsculas
      if (emailColab && emailColab.toString().trim().toLowerCase() == userEmail.toLowerCase()) {
        usuario.nome = dados[i][0];
        usuario.funcao = dados[i][2];
        
        // Verifica permissão administrativa/financeira
        if (usuario.funcao.toUpperCase().includes("FINANCEIRO") || usuario.funcao.toUpperCase().includes("ADMIN")) {
          usuario.isFinanceiro = true;
        }
        break; // Encontrou, para o loop
      }
    }
    return usuario;
  } catch (e) {
    console.error("Erro crítico ao pegar usuário: " + e.message);
    // Retorna usuário neutro para não quebrar a tela, mas sem permissões
    return { email: "erro", nome: "Visitante", funcao: "Erro", isFinanceiro: false };
  }
}

// --- LEITURA DE DADOS ---

/**
 * Busca todas as despesas e as organiza em filas (Kyanne, Financeiro, etc).
 * Realiza tratamentos de data e link de imagem para o Frontend.
 */
function getDadosIniciais() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetDespesas = ss.getSheetByName("Despesas");
  var usuario = getUsuarioLogado();

  var data = sheetDespesas.getDataRange().getValues();
  var filas = {
    usuario: usuario,
    kyanne: [], financeiro: [], pendentes: [], relatorio: [],
    totalKyanne: 0, totalFinanceiro: 0
  };
  
  // Loop começa do 1 (pula cabeçalho)
  for (var i = 1; i < data.length; i++) {
    var row = i + 1; // Guarda o número real da linha para edições futuras
    
    // --- MAPEAMENTO DE COLUNAS (CUIDADO AO INSERIR COLUNAS NA PLANILHA) ---
    // Coluna L (Index 11) = STATUS
    var status = data[i][11]; 
    
    // Tratamento de Data (Coluna P - Index 15)
    var dataFormatada = "--/--/----";
    if (data[i][15]) { 
      try { 
        dataFormatada = Utilities.formatDate(new Date(data[i][15]), Session.getScriptTimeZone(), "dd/MM/yyyy"); 
      } catch(e){} 
    }
    
    // Tratamento de Imagem (Coluna K - Index 10)
    // O AppSheet salva "Pasta/arquivo.jpg". O HTML precisa de um link http.
    // Usamos o truque de buscar pelo nome do arquivo no Drive.
    var linkFoto = "#";
    if (data[i][10] && data[i][10].toString().length > 5) {
      // Pega só o nome do arquivo após a última barra "/"
      linkFoto = "https://drive.google.com/drive/search?q=" + encodeURIComponent(data[i][10].toString().split('/').pop());
    }

    // Objeto Despesa formatado para o HTML
    var despesa = {
      row: row,
      colaborador: data[i][4], // Coluna E
      categoria: data[i][5],   // Coluna F
      cliente: data[i][6],     // Coluna G
      descricao: data[i][8],   // Coluna I
      // Valor formatado (string) para exibição e Raw (número) para somas
      valor: typeof data[i][9] === 'number' ? data[i][9].toFixed(2).replace('.', ',') : data[i][9],
      valorRaw: typeof data[i][9] === 'number' ? data[i][9] : 0,
      foto: linkFoto,
      temFoto: (linkFoto !== "#"),
      data: dataFormatada,
      status: status,
      // String oculta para facilitar a barra de pesquisa no front
      searchStr: (data[i][4] + " " + data[i][5] + " " + dataFormatada + " " + data[i][6]).toLowerCase()
    };

    // Distribuição nas abas do sistema
    if (status == "ABERTO") filas.kyanne.push(despesa);
    if (status == "VALIDADO") filas.financeiro.push(despesa);
    if (status == "PENDENTE" || status == "REPROVADO") filas.pendentes.push(despesa);
    
    // Relatório recebe TUDO
    filas.relatorio.push(despesa);
  }
  
  // Contadores para os Cards da Home
  filas.totalKyanne = filas.kyanne.length;
  filas.totalFinanceiro = filas.financeiro.length;
  return filas;
}

// --- SISTEMA DE NOTIFICAÇÃO ---

/**
 * Envia e-mail formatado para o vendedor quando o status muda.
 * Busca o e-mail do vendedor baseado no nome registrado na despesa.
 */
function notificarVendedor(nomeVendedor, descricaoDespesa, status, motivo) {
  console.log("Iniciando notificação para: " + nomeVendedor);

  var sheetColab = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Colaboradores");
  var dados = sheetColab.getDataRange().getValues();
  var emailDestino = "";

  // Normalização para garantir o "match" do nome
  var nomeBusca = nomeVendedor.toString().trim().toLowerCase();

  for (var i = 1; i < dados.length; i++) {
    var nomeTabela = dados[i][0].toString().trim().toLowerCase(); // Coluna A
    if (nomeTabela === nomeBusca) {
      emailDestino = dados[i][1]; // Coluna B = Email
      break;
    }
  }

  if (emailDestino) {
    // Configuração de Cores e Assuntos baseados no Status
    var assunto = "";
    var cor = "";
    
    if (status == "REPROVADO") {
      assunto = "❌ Despesa Reprovada: " + descricaoDespesa;
      cor = "#dc3545"; // Vermelho
    } else if (status == "PENDENTE") {
      assunto = "⚠️ Correção Necessária: " + descricaoDespesa;
      cor = "#ffc107"; // Amarelo
    } else if (status == "APROVADO") {
      assunto = "✅ Pagamento Confirmado: " + descricaoDespesa;
      cor = "#198754"; // Verde
    }

    // Template HTML do E-mail
    var htmlBody = `
      <div style="font-family: sans-serif; border: 1px solid #ccc; border-radius: 5px; overflow: hidden; max-width: 600px;">
        <div style="background-color: ${cor}; color: white; padding: 15px; text-align: center;">
          <h2 style="margin:0;">${status}</h2>
        </div>
        <div style="padding: 20px;">
          <p>Olá, <strong>${nomeVendedor}</strong>.</p>
          <p>A despesa <strong>"${descricaoDespesa}"</strong> foi atualizada.</p>
          ${ motivo ? `<p style="background:#f9f9f9; padding:10px; border-left:4px solid ${cor};"><strong>Motivo:</strong><br>${motivo}</p>` : '' }
          <p style="font-size:0.9em; color:#666;">Acesse o App para verificar.</p>
        </div>
      </div>
    `;

    try {
      MailApp.sendEmail({
        to: emailDestino,
        subject: assunto,
        htmlBody: htmlBody,
        name: "Portal Saavedra"
      });
      console.log("Email enviado com sucesso para " + emailDestino);
    } catch (e) {
      console.error("ERRO AO ENVIAR EMAIL: " + e.message);
    }
  } else {
    console.error("ALERTA: Email NÃO encontrado na tabela Colaboradores para o nome: " + nomeVendedor);
  }
}

// --- FUNÇÕES DE AÇÃO (ESCRITA NA PLANILHA) ---

/**
 * Altera o status de uma única despesa.
 * Inclui validação de segurança e log de auditoria.
 */
function alterarStatus(row, novoStatus, motivo) {
  var usuario = getUsuarioLogado();
  
  // TRAVA DE SEGURANÇA: Impede aprovação técnica via console hacker
  if (novoStatus == "APROVADO" && !usuario.isFinanceiro) {
    throw new Error("⛔ Acesso Negado: Apenas o perfil Financeiro pode realizar pagamentos.");
  }
  
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Despesas");
  var timestamp = new Date();
  
  // Busca dados necessários para o e-mail antes de escrever
  var nomeVendedor = sheet.getRange(row, 5).getValue(); // Coluna E
  var descricao = sheet.getRange(row, 9).getValue();    // Coluna I
  
  // Atualiza o Status (Coluna L = 12)
  sheet.getRange(row, 12).setValue(novoStatus);
  
  // Lógica de Auditoria e Motivos
  // Coluna R (18) = Motivo | S (19) = Data Validação | T (20) = Data Pagamento
  if (novoStatus == "REPROVADO" || novoStatus == "PENDENTE") {
    sheet.getRange(row, 18).setValue(motivo || "Ajuste solicitado");
    notificarVendedor(nomeVendedor, descricao, novoStatus, motivo);
    
  } else if (novoStatus == "VALIDADO") {
    sheet.getRange(row, 19).setValue(timestamp); 
    sheet.getRange(row, 18).clearContent(); // Limpa motivo antigo
    
  } else if (novoStatus == "APROVADO") {
    sheet.getRange(row, 20).setValue(timestamp); 
    sheet.getRange(row, 18).clearContent();
    // Opcional: Avisar vendedor que foi pago
    notificarVendedor(nomeVendedor, descricao, novoStatus, "Pagamento liberado.");
  }
}

/**
 * Processamento em Lote (Botão "Validar Todas" / "Pagar Todas")
 */
function aprovarLote(rows, novoStatus) {
  var usuario = getUsuarioLogado();
  // Trava de segurança para lote também
  if (novoStatus == "APROVADO" && !usuario.isFinanceiro) {
    throw new Error("⛔ Acesso Negado.");
  }
  
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Despesas");
  var timestamp = new Date();
  
  // Itera sobre o array de linhas recebido do frontend
  rows.forEach(function(r) {
    sheet.getRange(r, 12).setValue(novoStatus);
    
    // Atualiza timestamps de auditoria
    if (novoStatus == "VALIDADO") sheet.getRange(r, 19).setValue(timestamp);
    if (novoStatus == "APROVADO") sheet.getRange(r, 20).setValue(timestamp);
    
    // Nota: Não enviamos e-mail em lote para evitar bloqueio de SPAM do Google
  });
}

// --- ALERTAS DIÁRIOS (ROBÔ) ---
// Função que deve ser acionada pelo Trigger de Tempo (07:00 - 08:00)
function verificarAlertasDiarios() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Despesas");
  var data = sheet.getDataRange().getValues();
  
  // --- CONFIGURAÇÃO: Coloque os e-mails reais aqui ---
  var emailKyanne = "comercial.saav@saavedra.com.br"; 
  var emailFinanceiro = "financeiro2.saav@saavedra.com.br, financeiro.saav@saavedra.com.br";
  
  var hoje = new Date();
  var atrasadosKyanne = 0;
  var pendentesFinanceiro = 0;
  
  // Começa do 1 para pular o cabeçalho
  for (var i = 1; i < data.length; i++) {
    var status = data[i][11]; // Coluna L (Status)
    var dataDespesaRaw = data[i][15]; // Coluna P (Data Despesa)
    
    // Regra 1: Aberto > 7 dias (Kyanne)
    if (status == "ABERTO" && dataDespesaRaw) {
      var dataDespesa = new Date(dataDespesaRaw);
      var diffDias = (hoje - dataDespesa) / (1000 * 60 * 60 * 24);
      if (diffDias > 7) {
        atrasadosKyanne++;
      }
    }
    
    // Regra 2: Validado (Financeiro)
    if (status == "VALIDADO") {
      pendentesFinanceiro++;
    }
  }
  
  // --- DISPARO DE RESUMOS ---
  
  // 1. Alerta para Kyanne (Apenas se tiver atrasos)
  if (atrasadosKyanne > 0) {
    try {
      MailApp.sendEmail({
        to: emailKyanne,
        subject: "🔔 Alerta Técnico: " + atrasadosKyanne + " despesas atrasadas",
        htmlBody: `
          <h3>Olá, Kyanne.</h3>
          <p>Existem <b>${atrasadosKyanne} despesas</b> com status 'ABERTO' há mais de 7 dias.</p>
          <p>Por favor, acesse o Portal para zerar a fila.</p>
        `
      });
    } catch(e) { console.log("Erro ao enviar email Kyanne: " + e.message); }
  }
  
  // 2. Alerta para Financeiro (Apenas se tiver pendências)
  if (pendentesFinanceiro > 0) {
    try {
      MailApp.sendEmail({
        to: emailFinanceiro,
        subject: "💰 Alerta Financeiro: " + pendentesFinanceiro + " pagamentos pendentes",
        htmlBody: `
          <h3>Olá, Financeiro.</h3>
          <p>A equipe técnica já validou <b>${pendentesFinanceiro} despesas</b>.</p>
          <p>Elas estão prontas para pagamento no Portal.</p>
        `
      });
    } catch(e) { console.log("Erro ao enviar email Financeiro: " + e.message); }
  }
}
```
