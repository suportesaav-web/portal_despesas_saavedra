import React from 'react';

export default function ReportPrintModal({ expenses = [], user, periodoDescricao = '', onClose }) {
  const protocolNumber = `SAAV-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
  const emissionDate = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }) + ' às ' + new Date().toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const totalGeral = expenses.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
  const totalAprovado = expenses
    .filter(e => e.status === 'APROVADO')
    .reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
  const totalValidado = expenses
    .filter(e => e.status === 'VALIDADO')
    .reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
  const totalEmAberto = expenses
    .filter(e => e.status === 'ABERTO')
    .reduce((acc, curr) => acc + Number(curr.amount || 0), 0);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="report-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="report-modal-container">
        {/* Barra de Ações (Oculta na Impressão) */}
        <div className="report-action-bar no-print">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.2rem' }}>📑</span>
            <strong>Pré-visualização da Prestação de Contas (Folha A4)</strong>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="button" className="btn btn-primary" onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>🖨️</span> Imprimir / Salvar em PDF
            </button>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Fechar
            </button>
          </div>
        </div>

        {/* Folha A4 Oficial de Prestação de Contas */}
        <div className="report-sheet-a4" id="report-printable-area">
          {/* Cabeçalho Oficial Saavedra */}
          <div className="report-header">
            <div className="report-header-brand">
              <div className="report-logo-text">SAAVEDRA</div>
              <div className="report-sublogo-text">REPRESENTAÇÕES COMERCIAIS</div>
              <div className="report-system-tag">SISTEMA INTEGRADO DE GESTÃO DE DESPESAS</div>
            </div>
            <div className="report-header-meta">
              <div className="report-meta-item">
                <span className="meta-label">PROTOCOLO:</span>
                <span className="meta-value protocol-code">{protocolNumber}</span>
              </div>
              <div className="report-meta-item">
                <span className="meta-label">EMISSÃO:</span>
                <span className="meta-value">{emissionDate}</span>
              </div>
              <div className="report-meta-item">
                <span className="meta-label">SOLICITANTE:</span>
                <span className="meta-value">{user?.profile?.nome || 'Usuário do Sistema'}</span>
              </div>
            </div>
          </div>

          <div className="report-title-banner">
            <h2>RELATÓRIO DE PRESTAÇÃO DE CONTAS E REEMBOLSO</h2>
            {periodoDescricao && <p className="report-period">Período de Referência: {periodoDescricao}</p>}
          </div>

          {/* Cards de Resumo Financeiro */}
          <div className="report-kpi-summary">
            <div className="report-kpi-box">
              <span className="kpi-title">TOTAL SOLICITADO</span>
              <span className="kpi-val">R$ {totalGeral.toFixed(2).replace('.', ',')}</span>
              <span className="kpi-sub">{expenses.length} lançamento(s)</span>
            </div>
            <div className="report-kpi-box highlight-success">
              <span className="kpi-title">TOTAL APROVADO / PAGO</span>
              <span className="kpi-val">R$ {totalAprovado.toFixed(2).replace('.', ',')}</span>
              <span className="kpi-sub">Pronto para reembolso</span>
            </div>
            <div className="report-kpi-box">
              <span className="kpi-title">EM FILA FINANCEIRA</span>
              <span className="kpi-val">R$ {totalValidado.toFixed(2).replace('.', ',')}</span>
              <span className="kpi-sub">Validado por Gestão CRM</span>
            </div>
            <div className="report-kpi-box">
              <span className="kpi-title">EM AVALIAÇÃO CRM</span>
              <span className="kpi-val">R$ {totalEmAberto.toFixed(2).replace('.', ',')}</span>
              <span className="kpi-sub">Aguardando conferência</span>
            </div>
          </div>

          {/* Tabela Oficial de Itens */}
          <table className="report-table">
            <thead>
              <tr>
                <th style={{ width: '32px' }}>#</th>
                <th style={{ width: '85px' }}>Data / Hora</th>
                <th>Colaborador</th>
                <th>Cliente / Destino (CRM)</th>
                <th>Categoria Contábil</th>
                <th>Descrição</th>
                <th style={{ width: '85px', textAlign: 'right' }}>Valor (R$)</th>
                <th style={{ width: '80px', textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {expenses.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '24px', color: '#666' }}>
                    Nenhuma despesa selecionada para este relatório.
                  </td>
                </tr>
              ) : (
                expenses.map((d, index) => (
                  <tr key={d.id || index}>
                    <td style={{ textAlign: 'center' }}>{index + 1}</td>
                    <td>
                      <strong>{new Date(d.date + 'T00:00:00').toLocaleDateString('pt-BR')}</strong>
                      {d.hora && <div style={{ fontSize: '0.75rem', color: '#666' }}>{d.hora}</div>}
                    </td>
                    <td>{d.colaboradores?.nome || user?.profile?.nome || 'Você'}</td>
                    <td>
                      <span className="report-badge-client">{d.cliente || 'Interno / Sede'}</span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.8rem' }}>
                        {d.categoria_codigo ? `${d.categoria_codigo} - ` : ''}{d.categoria}
                      </span>
                    </td>
                    <td>
                      <div className="report-desc-text">{d.descricao}</div>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                      R$ {Number(d.amount).toFixed(2).replace('.', ',')}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`report-status-tag status-${(d.status || '').toLowerCase()}`}>
                        {d.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan="6" style={{ textAlign: 'right', fontWeight: 'bold' }}>TOTAL CONSOLIDADO:</td>
                <td style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '1rem', color: '#0f172a' }}>
                  R$ {totalGeral.toFixed(2).replace('.', ',')}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>

          {/* Termo de Responsabilidade Legal */}
          <div className="report-declaration">
            <strong>DECLARAÇÃO DE RESPONSABILIDADE & CONFORMIDADE CORPORATIVA:</strong>
            <p>
              Declaro para os devidos fins legais e contábeis que os valores, comprovantes fiscais e roteiros de visita
              acima descritos correspondem estritamente a despesas legítimas efetuadas no exercício de minhas atividades
              profissionais a serviço da Saavedra Representações Comerciais. Todas as notas e cupons fiscais originais
              encontram-se digitalizados e devidamente arquivados em conformidade com as diretrizes e prazos de fechamento mensal.
            </p>
          </div>

          {/* 3 Vias Formais de Assinatura */}
          <div className="report-signatures-grid">
            {/* Via 1: Colaborador */}
            <div className="signature-box">
              <div className="signature-line"></div>
              <div className="signature-name">{user?.profile?.nome || 'Colaborador / Solicitante'}</div>
              <div className="signature-role">Solicitante ({user?.profile?.funcao || 'Colaborador'})</div>
              <div className="signature-date">Data: ____/____/________</div>
            </div>

            {/* Via 2: Gestor CRM */}
            <div className="signature-box">
              <div className="signature-line"></div>
              <div className="signature-name">Validação de Gestão / CRM</div>
              <div className="signature-role">Conferência de Agenda & Rota Comercial</div>
              <div className="signature-date">Data: ____/____/________</div>
            </div>

            {/* Via 3: Financeiro */}
            <div className="signature-box">
              <div className="signature-line"></div>
              <div className="signature-name">Liquidação Contábil / Financeiro</div>
              <div className="signature-role">Liberação de Pagamento / Reembolso</div>
              <div className="signature-date">Data: ____/____/________</div>
            </div>
          </div>

          {/* Rodapé da folha */}
          <div className="report-footer">
            <span>Portal SAAV Expenses • Documento emitido eletronicamente • Autenticação de Auditoria Interna</span>
            <span>Página 1 de 1</span>
          </div>
        </div>
      </div>
    </div>
  );
}
