// Catálogo oficial de categorias e subcategorias contábeis — SAAV EXPENSES
export const CATEGORIAS_DESPESAS = [
  {
    codigo: '2.3',
    nome: 'DESPESAS OPERACIONAIS',
    itens: [
      { codigo: '2.3.1', nome: 'ESTACIONAMENTO' },
      { codigo: '2.3.2', nome: 'PEDAGIO' },
      { codigo: '2.3.3', nome: 'FRANGO PARA TREINAMENTO' },
      { codigo: '2.3.4', nome: 'CARNE BOVINA TREINAMENTO' },
      { codigo: '2.3.5', nome: 'ALUGUEL MOBI' },
      { codigo: '2.3.6', nome: 'ALUGUEL T-CROSS' }
    ]
  },
  {
    codigo: '2.4',
    nome: 'DESPESAS COM MARKETING',
    itens: [
      { codigo: '2.4.1', nome: 'AMOSTRAS' },
      { codigo: '2.4.2', nome: 'BRINDES' },
      { codigo: '2.4.3', nome: 'COFFEE' },
      { codigo: '2.4.4', nome: 'PRODUTOS PROMOCIONAIS' },
      { codigo: '2.4.5', nome: 'BALAS' },
      { codigo: '2.4.6', nome: 'TRATAMENTO DE FOTOS' },
      { codigo: '2.4.7', nome: 'PIPOCA' },
      { codigo: '2.4.8', nome: 'PAÇOCA' },
      { codigo: '2.4.9', nome: 'PIRULITO' },
      { codigo: '2.4.10', nome: 'MARIOLA' },
      { codigo: '2.4.11', nome: 'MOUSE PAD' },
      { codigo: '2.4.12', nome: 'BOMBOM' }
    ]
  },
  {
    codigo: '2.5',
    nome: 'OUTRAS DESPESAS',
    itens: [
      { codigo: '2.5.1', nome: 'MATERIAL ESCRITORIO' },
      { codigo: '2.5.2', nome: 'OUTROS' }
    ]
  },
  {
    codigo: '2.6',
    nome: 'DESPESAS OPERACIONAIS GERAIS',
    itens: [
      { codigo: '2.6.1', nome: 'COMBUSTIVEL / TRANSPORTE' },
      { codigo: '2.6.2', nome: 'HOSPEDAGEM' },
      { codigo: '2.6.3', nome: 'ALIMENTAÇÃO EM VIAGEM' },
      { codigo: '2.6.4', nome: 'MANUTENÇÃO DE VEÍCULO' },
      { codigo: '2.6.5', nome: 'DEMAIS DESPESAS OPERACIONAIS' }
    ]
  },
  {
    codigo: '2.7',
    nome: 'OUTRA DESPESA',
    itens: [
      { codigo: '2.7.1', nome: 'SERVIÇOS DE TERCEIROS' },
      { codigo: '2.7.2', nome: 'DESPESAS CARTORÁRIAS' },
      { codigo: '2.7.3', nome: 'DIVERSOS' }
    ]
  },
  {
    codigo: '2.8',
    nome: 'DESPESA FINANCEIRA',
    itens: [
      { codigo: '2.8.1', nome: 'TARIFAS BANCÁRIAS' },
      { codigo: '2.8.2', nome: 'JUROS / MULTAS' }
    ]
  },
  {
    codigo: '2.9',
    nome: 'IMPOSTOS E TAXAS',
    itens: [
      { codigo: '2.9.1', nome: 'TAXAS MUNICIPAIS' },
      { codigo: '2.9.2', nome: 'IMPOSTOS INDIRETOS' }
    ]
  },
  {
    codigo: '2.10',
    nome: 'INVESTIMENTO',
    itens: [
      { codigo: '2.10.1', nome: 'EQUIPAMENTOS DE CAMPO' },
      { codigo: '2.10.2', nome: 'FERRAMENTAS E ACESSÓRIOS' }
    ]
  }
];

// Helper para encontrar categoria e grupo a partir do código
export function getCategoriaByCodigo(codigo) {
  for (const grupo of CATEGORIAS_DESPESAS) {
    const item = grupo.itens.find(i => i.codigo === codigo);
    if (item) {
      return {
        grupoCodigo: grupo.codigo,
        grupoNome: grupo.nome,
        itemCodigo: item.codigo,
        itemNome: item.nome,
        labelCompleto: `${item.codigo} - ${item.nome}`
      };
    }
  }
  return null;
}
