import React, { useState, useEffect } from 'react';

export default function ReceiptModal({ fileUrl, expense, onClose }) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [loading, setLoading] = useState(true);

  // Detecta se é arquivo PDF
  const isPdf = fileUrl && (
    fileUrl.toLowerCase().includes('.pdf') || 
    fileUrl.includes('application/pdf')
  );

  // Fecha com tecla ESC
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.25, 0.5));
  const handleRotateRight = () => setRotation((prev) => (prev + 90) % 360);
  const handleRotateLeft = () => setRotation((prev) => (prev + 270) % 360);
  const handleReset = () => {
    setZoom(1);
    setRotation(0);
  };

  if (!fileUrl) return null;

  return (
    <div className="receipt-modal-overlay" onClick={onClose}>
      <div 
        className="receipt-modal-container glass-panel" 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header do Visualizador */}
        <div className="receipt-modal-header">
          <div className="receipt-modal-info">
            <h3 className="receipt-modal-title">
              🧾 Comprovante Fiscal / Recibo
            </h3>
            {expense && (
              <div className="receipt-modal-meta">
                <span className="meta-item">
                  <strong>Cliente:</strong> {expense.cliente || 'Não informado'}
                </span>
                <span className="meta-sep">•</span>
                <span className="meta-item">
                  <strong>Valor:</strong> R$ {Number(expense.amount || 0).toFixed(2)}
                </span>
                {expense.date && (
                  <>
                    <span className="meta-sep">•</span>
                    <span className="meta-item">
                      <strong>Data:</strong> {new Date(expense.date).toLocaleDateString('pt-BR')}
                    </span>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="receipt-modal-header-actions">
            <a 
              href={fileUrl} 
              target="_blank" 
              rel="noopener noreferrer" 
              download 
              className="receipt-btn-icon"
              title="Abrir original ou baixar"
            >
              📥 Baixar
            </a>
            <button 
              className="receipt-btn-close" 
              onClick={onClose} 
              title="Fechar (Esc)"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Barra de Ferramentas (Zoom & Rotação para Imagens) */}
        {!isPdf && (
          <div className="receipt-toolbar">
            <div className="receipt-toolbar-group">
              <button 
                type="button" 
                className="receipt-toolbar-btn" 
                onClick={handleZoomOut} 
                title="Reduzir Zoom (-)"
              >
                🔍 -
              </button>
              <span className="receipt-zoom-indicator">{Math.round(zoom * 100)}%</span>
              <button 
                type="button" 
                className="receipt-toolbar-btn" 
                onClick={handleZoomIn} 
                title="Aumentar Zoom (+)"
              >
                🔍 +
              </button>
            </div>

            <div className="receipt-toolbar-group">
              <button 
                type="button" 
                className="receipt-toolbar-btn" 
                onClick={handleRotateLeft} 
                title="Girar 90° para esquerda"
              >
                ↺ Girar
              </button>
              <button 
                type="button" 
                className="receipt-toolbar-btn" 
                onClick={handleRotateRight} 
                title="Girar 90° para direita"
              >
                ↻ Girar
              </button>
              <button 
                type="button" 
                className="receipt-toolbar-btn" 
                onClick={handleReset} 
                title="Redefinir visualização"
              >
                Restaurar
              </button>
            </div>
          </div>
        )}

        {/* Área de Visualização do Documento */}
        <div className="receipt-viewer-body">
          {loading && (
            <div className="receipt-loading-spinner">
              <span>Carregando comprovante...</span>
            </div>
          )}

          {isPdf ? (
            <div className="receipt-pdf-wrapper">
              <iframe 
                src={fileUrl} 
                title="Visualizador de PDF do Comprovante" 
                className="receipt-pdf-frame"
                onLoad={() => setLoading(false)}
              />
            </div>
          ) : (
            <div className="receipt-image-stage">
              <img 
                src={fileUrl} 
                alt="Comprovante da despesa" 
                className="receipt-zoom-image"
                style={{
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                  transition: 'transform 0.2s cubic-bezier(0.2, 0, 0, 1)'
                }}
                onLoad={() => setLoading(false)}
                onError={() => setLoading(false)}
              />
            </div>
          )}
        </div>

        {/* Footer com atalhos */}
        <div className="receipt-modal-footer">
          <span className="receipt-hint">
            💡 Dica: Use os botões de rotação caso a foto tenha sido tirada de lado no celular.
          </span>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Fechar Visualizador
          </button>
        </div>
      </div>
    </div>
  );
}
