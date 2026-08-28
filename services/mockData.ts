import { Account, BudgetVersion, CostPackage, DreSection, ForecastConfig, ForecastOperator, ForecastRow, Hotel, ImportedRow, Meeting, User, UserRole, ExpenseType, ExpenseDriver, CostCenter, GMDConfiguration, DrePackage, KpiCalculation } from '../types';
import { RESTRICTED_TABLE_KINDS, resolveMeetingKind } from '../utils/meetings';

// Helper for robust string matching (ignores accents, case, and plural suffix 's')
export const normalizeAccountName = (str: string) => {
    if (!str) return '';
    return str
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Remove accents
        .replace(/ões/g, "ao")
        .replace(/oes/g, "ao")
        .replace(/ães/g, "ao")
        .replace(/aes/g, "ao")
        .replace(/s\b/g, "") // Remove trailing 's'
        .replace(/[^a-z0-9]/g, ""); // Remove spaces and special chars
};

// Helper pra casar nome/código de hotel entre financial_data (importado — às vezes com grafia de
// acento diferente da que está cadastrada em `hotels`, ex. planilha externa) e o valor usado nas
// telas — ignora acentos/caixa/espaços nas pontas, mas preserva espaços internos (não usa as
// normalizações de plural/sufixo de normalizeAccountName, que fazem sentido pra conta contábil,
// não pra nome de hotel). Sem isso, "Alexânia" (cadastro) x "Alexania" (planilha importada, sem
// acento) nunca batem, e TODO o Realizado desse hotel fica invisível na Tabela de GOP/DRE Forecast.
export const normalizeHotelName = (str: string) => {
    if (!str) return '';
    const upper = str.trim().toUpperCase().normalize('NFD');
    let out = '';
    for (let i = 0; i < upper.length; i++) {
        const code = upper.charCodeAt(i);
        if (code >= 0x0300 && code <= 0x036f) continue; // combining diacritical marks
        out += upper[i];
    }
    return out;
};

export const mockHotels: Hotel[] = [
    { id: '1', code: 'ATB', name: 'Atibaia', type: 'Hotéis próprios', category: 'Resort', region: 'Sudeste' },
    { id: '2', code: 'ALX', name: 'Alexania', type: 'Hotéis próprios', category: 'Resort', region: 'Centro-Oeste' },
    { id: '3', code: 'ARX', name: 'Araxá', type: 'Hotéis próprios', category: 'Hotel', region: 'Sudeste' },
    { id: '4', code: 'CAE', name: 'Caeté', type: 'Hotéis próprios', category: 'Resort', region: 'Sudeste' },
    { id: '5', code: 'ALG', name: 'Alegro', type: 'Hotéis próprios', category: 'Hotel', region: 'Sudeste' },
    { id: '6', code: 'JPA', name: 'João Pessoa', type: 'Hotéis próprios', category: 'Hotel', region: 'Nordeste' },
    { id: '7', code: 'ADM', name: 'Administradora', type: 'Administradora', category: 'Administradora', region: 'Sudeste' },
];

export const mockUsers: User[] = [
    { id: 'u1', name: 'Carlos Silva', email: 'carlos@hotel.com', role: UserRole.ENTITY_MANAGER, hotelId: '1' },
    { id: 'u2', name: 'Ana Souza', email: 'ana@hotel.com', role: UserRole.PACKAGE_MANAGER, hotelId: '1' },
    { id: 'u3', name: 'Roberto Lima', email: 'roberto@hotel.com', role: UserRole.AREA_MANAGER, hotelId: '7' },
    { id: 'u4', name: 'Fernanda RH', email: 'fernanda@hotel.com', role: UserRole.PACKAGE_MANAGER, hotelId: '1' },
    { id: 'u5', name: 'João Manutenção', email: 'joao@hotel.com', role: UserRole.PACKAGE_MANAGER, hotelId: '2' },
    { id: 'u6', name: 'Marcos MKT', email: 'marcos@hotel.com', role: UserRole.PACKAGE_MANAGER, hotelId: '7' },
];

// Expanded Cost Centers list based on user provided data
export const mockCostCenters: CostCenter[] = [
    // Caeté (Hotel 4) - Company 1
    { id: '104', code: '104', name: 'Recepcao', directorate: 'Hotelaria - Hospedagem', department: 'Departamento de Hospedagem', type: 'PDV', hotelName: 'Caeté', hierarchicalCode: '1.1.1.001', companyCode: '1' },
    { id: '105', code: '105', name: 'Governanca', directorate: 'Hotelaria - Hospedagem', department: 'Departamento de Hospedagem', type: 'CR', hotelName: 'Caeté', hierarchicalCode: '1.1.1.002', companyCode: '1' },
    { id: '106', code: '106', name: 'Seguranca', directorate: 'Hotelaria - Hospedagem', department: 'Departamento de Hospedagem', type: 'CR', hotelName: 'Caeté', hierarchicalCode: '1.1.1.003', companyCode: '1' },
    { id: '108', code: '108', name: 'Room Service', directorate: 'Hotelaria - A&B', department: 'Departamento de A&B', type: 'PDV', hotelName: 'Caeté', hierarchicalCode: '1.1.2.001', companyCode: '1' },
    { id: '109', code: '109', name: 'Minibar', directorate: 'Hotelaria - A&B', department: 'Departamento de A&B', type: 'PDV', hotelName: 'Caeté', hierarchicalCode: '1.1.2.002', companyCode: '1' },
    { id: '110', code: '110', name: 'Piscina Termica', directorate: 'Hotelaria - A&B', department: 'Departamento de A&B', type: 'PDV', hotelName: 'Caeté', hierarchicalCode: '1.1.2.003', companyCode: '1' },
    { id: '111', code: '111', name: 'Restaurante Principal', directorate: 'Hotelaria - A&B', department: 'Departamento de A&B', type: 'PDV', hotelName: 'Caeté', hierarchicalCode: '1.1.2.004', companyCode: '1' },
    { id: '112', code: '112', name: 'Bar da Piscina', directorate: 'Hotelaria - A&B', department: 'Departamento de A&B', type: 'PDV', hotelName: 'Caeté', hierarchicalCode: '1.1.2.005', companyCode: '1' },
    { id: '114', code: '114', name: 'Cozinha', directorate: 'Hotelaria - A&B', department: 'Departamento de A&B', type: 'CR', hotelName: 'Caeté', hierarchicalCode: '1.1.2.007', companyCode: '1' },
    { id: '120', code: '120', name: 'Manutencao', directorate: 'Hotelaria - Manutencao', department: 'Departamento de Manutencao', type: 'CR', hotelName: 'Caeté', hierarchicalCode: '1.1.3.001', companyCode: '1' },
    { id: '121', code: '121', name: 'Jardinagem', directorate: 'Hotelaria - Manutencao', department: 'Departamento de Manutencao', type: 'CR', hotelName: 'Caeté', hierarchicalCode: '1.1.3.002', companyCode: '1' },
    { id: '140', code: '140', name: 'Diretoria', directorate: 'Diretoria', department: 'Departamento Administrativo', type: 'CR', hotelName: 'Caeté', hierarchicalCode: '1.1.4.001', companyCode: '1' },
    { id: '141', code: '141', name: 'Gerencia Geral', directorate: 'Hotelaria - ADM', department: 'Departamento Administrativo', type: 'CR', hotelName: 'Caeté', hierarchicalCode: '1.1.4.002', companyCode: '1' },
    { id: '142', code: '142', name: 'Recursos Humanos', directorate: 'Hotelaria - ADM', department: 'Departamento Administrativo', type: 'CR', hotelName: 'Caeté', hierarchicalCode: '1.1.4.003', companyCode: '1' },
    { id: '143', code: '143', name: 'Financeiro', directorate: 'Hotelaria - ADM', department: 'Departamento Administrativo', type: 'CR', hotelName: 'Caeté', hierarchicalCode: '1.1.4.004', companyCode: '1' },

    // Atibaia (Hotel 1) - Company 2
    { id: '4', code: '4', name: 'Recepcao', directorate: 'Hotelaria - Hospedagem', department: 'Departamento de Hospedagem', type: 'PDV', hotelName: 'Atibaia', hierarchicalCode: '1.1.1.001', companyCode: '2' },
    { id: '5', code: '5', name: 'Governanca', directorate: 'Hotelaria - Hospedagem', department: 'Departamento de Hospedagem', type: 'CR', hotelName: 'Atibaia', hierarchicalCode: '1.1.1.002', companyCode: '2' },
    { id: '6', code: '6', name: 'Seguranca', directorate: 'Hotelaria - Hospedagem', department: 'Departamento de Hospedagem', type: 'CR', hotelName: 'Atibaia', hierarchicalCode: '1.1.1.003', companyCode: '2' },
    { id: '7', code: '7', name: 'Reservas', directorate: 'Hotelaria - Hospedagem', department: 'Departamento de Hospedagem', type: 'CR', hotelName: 'Atibaia', hierarchicalCode: '1.1.1.004', companyCode: '2' },
    { id: '8', code: '8', name: 'Room Service', directorate: 'Hotelaria - A&B', department: 'Departamento de A&B', type: 'PDV', hotelName: 'Atibaia', hierarchicalCode: '1.1.2.001', companyCode: '2' },
    { id: '9', code: '9', name: 'Minibar', directorate: 'Hotelaria - A&B', department: 'Departamento de A&B', type: 'PDV', hotelName: 'Atibaia', hierarchicalCode: '1.1.2.002', companyCode: '2' },
    { id: '10', code: '10', name: 'Piscina Termica', directorate: 'Hotelaria - A&B', department: 'Departamento de A&B', type: 'PDV', hotelName: 'Atibaia', hierarchicalCode: '1.1.2.003', companyCode: '2' },
    { id: '11', code: '11', name: 'Restaurante Principal', directorate: 'Hotelaria - A&B', department: 'Departamento de A&B', type: 'PDV', hotelName: 'Atibaia', hierarchicalCode: '1.1.2.004', companyCode: '2' },
    { id: '12', code: '12', name: 'Bar 86', directorate: 'Hotelaria - A&B', department: 'Departamento de A&B', type: 'PDV', hotelName: 'Atibaia', hierarchicalCode: '1.1.2.005', companyCode: '2' },
    { id: '13', code: '13', name: 'Restaurante Coppola', directorate: 'Hotelaria - A&B', department: 'Departamento de A&B', type: 'PDV', hotelName: 'Atibaia', hierarchicalCode: '1.1.2.006', companyCode: '2' },
    { id: '14', code: '14', name: 'Cozinha', directorate: 'Hotelaria - A&B', department: 'Departamento de A&B', type: 'CR', hotelName: 'Atibaia', hierarchicalCode: '1.1.2.007', companyCode: '2' },
    { id: '20', code: '20', name: 'Manutencao', directorate: 'Hotelaria - Manutencao', department: 'Departamento de Manutencao', type: 'CR', hotelName: 'Atibaia', hierarchicalCode: '1.1.3.001', companyCode: '2' },
    { id: '21', code: '21', name: 'Jardinagem', directorate: 'Hotelaria - Manutencao', department: 'Departamento de Manutencao', type: 'CR', hotelName: 'Atibaia', hierarchicalCode: '1.1.3.002', companyCode: '2' },
    { id: '40', code: '40', name: 'Diretoria', directorate: 'Diretoria', department: 'Departamento Administrativo', type: 'CR', hotelName: 'Atibaia', hierarchicalCode: '1.1.4.001', companyCode: '2' },
    { id: '41', code: '41', name: 'Gerencia Geral', directorate: 'Hotelaria - ADM', department: 'Departamento Administrativo', type: 'CR', hotelName: 'Atibaia', hierarchicalCode: '1.1.4.002', companyCode: '2' },
    { id: '42', code: '42', name: 'Recursos Humanos', directorate: 'Hotelaria - ADM', department: 'Departamento Administrativo', type: 'CR', hotelName: 'Atibaia', hierarchicalCode: '1.1.4.003', companyCode: '2' },
    { id: '43', code: '43', name: 'Financeiro', directorate: 'Hotelaria - ADM', department: 'Departamento Administrativo', type: 'CR', hotelName: 'Atibaia', hierarchicalCode: '1.1.4.004', companyCode: '2' },

    // Alexania (Hotel 2) - Company 3
    { id: '204', code: '204', name: 'Recepcao', directorate: 'Hotelaria - Hospedagem', department: 'Departamento de Hospedagem', type: 'PDV', hotelName: 'Alexania', hierarchicalCode: '1.1.1.001', companyCode: '3' },
    { id: '205', code: '205', name: 'Governanca', directorate: 'Hotelaria - Hospedagem', department: 'Departamento de Hospedagem', type: 'CR', hotelName: 'Alexania', hierarchicalCode: '1.1.1.002', companyCode: '3' },
    { id: '214', code: '214', name: 'Cozinha', directorate: 'Hotelaria - A&B', department: 'Departamento de A&B', type: 'CR', hotelName: 'Alexania', hierarchicalCode: '1.1.2.007', companyCode: '3' },

    // Araxá (Hotel 3) - Company 4
    { id: '304', code: '304', name: 'Recepcao', directorate: 'Hotelaria - Hospedagem', department: 'Departamento de Hospedagem', type: 'PDV', hotelName: 'Araxá', hierarchicalCode: '1.1.1.001', companyCode: '4' },
    { id: '305', code: '305', name: 'Governanca', directorate: 'Hotelaria - Hospedagem', department: 'Departamento de Hospedagem', type: 'CR', hotelName: 'Araxá', hierarchicalCode: '1.1.1.002', companyCode: '4' },
    { id: '314', code: '314', name: 'Cozinha', directorate: 'Hotelaria - A&B', department: 'Departamento de A&B', type: 'CR', hotelName: 'Araxá', hierarchicalCode: '1.1.2.007', companyCode: '4' },
    { id: '366', code: '366', name: 'Restaurante Chez Beja', directorate: 'Hotelaria - A&B', department: 'Departamento de A&B', type: 'PDV', hotelName: 'Araxá', hierarchicalCode: '1.1.2.018', companyCode: '4' },
    { id: '367', code: '367', name: 'Lounge Cerrado', directorate: 'Hotelaria - A&B', department: 'Departamento de A&B', type: 'PDV', hotelName: 'Araxá', hierarchicalCode: '1.1.2.019', companyCode: '4' },

    // Administradora (Hotel 7) - Company 5
    { id: '701', code: '701', name: 'CSC', directorate: 'Administrativo', department: 'Administrativo', type: 'CR', hotelName: 'Administradora', hierarchicalCode: '1.01', companyCode: '5' },
    { id: '702', code: '702', name: 'Marketing', directorate: 'Comercial', department: 'Marketing', type: 'CR', hotelName: 'Administradora', hierarchicalCode: '3.01', companyCode: '5' },
    { id: '703', code: '703', name: 'Vendas', directorate: 'Comercial', department: 'Vendas', type: 'CR', hotelName: 'Administradora', hierarchicalCode: '3.02', companyCode: '5' },
    { id: '704', code: '704', name: 'TI', directorate: 'Administrativo', department: 'TI', type: 'CR', hotelName: 'Administradora', hierarchicalCode: '1.02', companyCode: '5' },

    // Alegro (Hotel 5) - Company 6
    { id: '504', code: '504', name: 'Recepcao', directorate: 'Hotelaria - Hospedagem', department: 'Departamento de Hospedagem', type: 'PDV', hotelName: 'Alegro', hierarchicalCode: '1.1.1.001', companyCode: '6' },
    { id: '505', code: '505', name: 'Governanca', directorate: 'Hotelaria - Hospedagem', department: 'Departamento de Hospedagem', type: 'CR', hotelName: 'Alegro', hierarchicalCode: '1.1.1.002', companyCode: '6' },
    { id: '514', code: '514', name: 'Cozinha', directorate: 'Hotelaria - A&B', department: 'Departamento de A&B', type: 'CR', hotelName: 'Alegro', hierarchicalCode: '1.1.2.007', companyCode: '6' },

    // João Pessoa (Hotel 6) - Company 7
    { id: '604', code: '604', name: 'Recepcao', directorate: 'Hotelaria - Hospedagem', department: 'Departamento de Hospedagem', type: 'PDV', hotelName: 'João Pessoa', hierarchicalCode: '1.1.1.001', companyCode: '7' },
    { id: '605', code: '605', name: 'Governanca', directorate: 'Hotelaria - Hospedagem', department: 'Departamento de Hospedagem', type: 'CR', hotelName: 'João Pessoa', hierarchicalCode: '1.1.1.002', companyCode: '7' },
    { id: '614', code: '614', name: 'Cozinha', directorate: 'Hotelaria - A&B', department: 'Departamento de A&B', type: 'CR', hotelName: 'João Pessoa', hierarchicalCode: '1.1.2.007', companyCode: '7' },
];

// --- RAW DATA STRUCTURE ---
export const USALI_STRUCTURE = [
    { code: '', name: 'Receita de Apartamentos', package: 'HOSPEDAGEM', master: 'RECEITAS' },
    { code: '', name: 'Receita de Café da Manhã - Incluso na diária', package: 'HOSPEDAGEM', master: 'RECEITAS' },
    { code: '', name: 'Receita de Alimentos - Incluso na diária', package: 'HOSPEDAGEM', master: 'RECEITAS' },
    { code: '', name: 'Receita de Bebidas - Incluso na diária', package: 'HOSPEDAGEM', master: 'RECEITAS' },
    { code: '', name: 'Receita de Servicos Termas - Incluso na diária', package: 'HOSPEDAGEM', master: 'RECEITAS' },
    { code: '', name: 'Receita de Servico de Transporte - Incluso na diária', package: 'HOSPEDAGEM', master: 'RECEITAS' },
    { code: '', name: 'Receita de Hospedagem DPA', package: 'HOSPEDAGEM', master: 'RECEITAS' },
    { code: '', name: 'Receita de ISS', package: 'HOSPEDAGEM', master: 'RECEITAS' },
    { code: '', name: 'Receita de Alimentos', package: 'ALIMENTOS E BEBIDAS', master: 'RECEITAS' },
    { code: '', name: 'Receita de Bebidas', package: 'ALIMENTOS E BEBIDAS', master: 'RECEITAS' },
    { code: '', name: 'Receita de Bebidas Monofásicas', package: 'ALIMENTOS E BEBIDAS', master: 'RECEITAS' },
    { code: '', name: 'Receita de Coffee Break', package: 'ALIMENTOS E BEBIDAS', master: 'RECEITAS' },
    { code: '', name: 'Receita de Aluguel de Salas', package: 'EVENTOS', master: 'RECEITAS' },
    { code: '', name: 'Receita de Aluguel de Equipamentos', package: 'EVENTOS', master: 'RECEITAS' },
    { code: '', name: 'Receita de Internet', package: 'EVENTOS', master: 'RECEITAS' },
    { code: '', name: 'Receita de Telefonia', package: 'EVENTOS', master: 'RECEITAS' },
    { code: '', name: 'Receita de ISS', package: 'EVENTOS', master: 'RECEITAS' },
    { code: '', name: 'Receita de Mercadorias Diversas', package: 'VENDAS DIVERSAS', master: 'RECEITAS' },
    { code: '', name: 'Receita de Produtos Diversos - Lojas', package: 'VENDAS DIVERSAS', master: 'RECEITAS' },
    { code: '', name: 'Receita de Produtos ST', package: 'VENDAS DIVERSAS', master: 'RECEITAS' },
    { code: '', name: 'Receita de Vestuarios', package: 'VENDAS DIVERSAS', master: 'RECEITAS' },
    { code: '', name: 'Receita de Produtos Diversos - A&B', package: 'VENDAS DIVERSAS', master: 'RECEITAS' },
    { code: '', name: 'Vendas de reciclaveis', package: 'VENDAS DIVERSAS', master: 'RECEITAS' },
    { code: '', name: 'Receita de Lavanderia', package: 'OUTROS SERVICOS', master: 'RECEITAS' },
    { code: '', name: 'Receita de Servicos Diversos', package: 'OUTROS SERVICOS', master: 'RECEITAS' },
    { code: '', name: 'Receita de Serviço Spa/ Termas', package: 'OUTROS SERVICOS', master: 'RECEITAS' },
    { code: '', name: 'Receita Taxa Serviço (Sobre Serviços)', package: 'OUTROS SERVICOS', master: 'RECEITAS' },
    { code: '', name: 'Receita Day Use', package: 'OUTROS SERVICOS', master: 'RECEITAS' },
    { code: '', name: 'Receita de Estacionamento', package: 'OUTROS SERVICOS', master: 'RECEITAS' },
    { code: '', name: 'Receita de Boliche', package: 'OUTROS SERVICOS', master: 'RECEITAS' },
    { code: '', name: 'Cancelamento de Time Share', package: 'OUTROS SERVICOS', master: 'RECEITAS' },
    { code: '', name: 'Receita de ISS', package: 'OUTROS SERVICOS', master: 'RECEITAS' },
    { code: '', name: 'Carnes / Aves / Peixes', package: 'CUSTO DE ALIMENTOS', master: 'CUSTOS DE ALIMENTOS E BEBIDAS' },
    { code: '', name: 'Condimentos / Conservas', package: 'CUSTO DE ALIMENTOS', master: 'CUSTOS DE ALIMENTOS E BEBIDAS' },
    { code: '', name: 'Embutidos / Massas', package: 'CUSTO DE ALIMENTOS', master: 'CUSTOS DE ALIMENTOS E BEBIDAS' },
    { code: '', name: 'Frios', package: 'CUSTO DE ALIMENTOS', master: 'CUSTOS DE ALIMENTOS E BEBIDAS' },
    { code: '', name: 'Guloseimas', package: 'CUSTO DE ALIMENTOS', master: 'CUSTOS DE ALIMENTOS E BEBIDAS' },
    { code: '', name: 'Hortifrutigranjeiros', package: 'CUSTO DE ALIMENTOS', master: 'CUSTOS DE ALIMENTOS E BEBIDAS' },
    { code: '', name: 'Laticinios', package: 'CUSTO DE ALIMENTOS', master: 'CUSTOS DE ALIMENTOS E BEBIDAS' },
    { code: '', name: 'Outros custos', package: 'CUSTO DE ALIMENTOS', master: 'CUSTOS DE ALIMENTOS E BEBIDAS' },
    { code: '', name: 'Paes / Biscoitos', package: 'CUSTO DE ALIMENTOS', master: 'CUSTOS DE ALIMENTOS E BEBIDAS' },
    { code: '', name: 'Secos', package: 'CUSTO DE ALIMENTOS', master: 'CUSTOS DE ALIMENTOS E BEBIDAS' },
    { code: '', name: 'Bebidas alcoolicas', package: 'CUSTO DE BEBIDAS', master: 'CUSTOS DE ALIMENTOS E BEBIDAS' },
    { code: '', name: 'Bebidas nao alcoolicas', package: 'CUSTO DE BEBIDAS', master: 'CUSTOS DE ALIMENTOS E BEBIDAS' },
    { code: '', name: 'Cigarros', package: 'CUSTO DE PRODUTOS DIVERSOS', master: 'CUSTO DE PRODUTOS DIVERSOS' },
    { code: '', name: 'Custos Descartaveis', package: 'CUSTO DE PRODUTOS DIVERSOS', master: 'CUSTO DE PRODUTOS DIVERSOS' },
    { code: '', name: 'Custos Diversos', package: 'CUSTO DE PRODUTOS DIVERSOS', master: 'CUSTO DE PRODUTOS DIVERSOS' },
    { code: '', name: 'Diversos A&B', package: 'CUSTO DE PRODUTOS DIVERSOS', master: 'CUSTO DE PRODUTOS DIVERSOS' },
    { code: '', name: 'Produtos diversos lojinha', package: 'CUSTO DE PRODUTOS DIVERSOS', master: 'CUSTO DE PRODUTOS DIVERSOS' },
    { code: '', name: 'Vestuario', package: 'CUSTO DE PRODUTOS DIVERSOS', master: 'CUSTO DE PRODUTOS DIVERSOS' },
    { code: '', name: 'Custo com entretenimento', package: 'CUSTOS DE OUTRAS RECEITAS', master: 'CUSTOS DE OUTRAS RECEITAS' },
    { code: '', name: 'Custo de aluguel de equipamentos', package: 'CUSTOS DE OUTRAS RECEITAS', master: 'CUSTOS DE OUTRAS RECEITAS' },
    { code: '', name: 'Custo de estacionamento', package: 'CUSTOS DE OUTRAS RECEITAS', master: 'CUSTOS DE OUTRAS RECEITAS' },
    { code: '', name: 'Custo de internet', package: 'CUSTOS DE OUTRAS RECEITAS', master: 'CUSTOS DE OUTRAS RECEITAS' },
    { code: '', name: 'Custo de lavanderia hospedes', package: 'CUSTOS DE OUTRAS RECEITAS', master: 'CUSTOS DE OUTRAS RECEITAS' },
    { code: '', name: 'Custo de servico de fotografia', package: 'CUSTOS DE OUTRAS RECEITAS', master: 'CUSTOS DE OUTRAS RECEITAS' },
    { code: '', name: 'Custo de servico de massagens', package: 'CUSTOS DE OUTRAS RECEITAS', master: 'CUSTOS DE OUTRAS RECEITAS' },
    { code: '', name: 'Custo de telefonia', package: 'CUSTOS DE OUTRAS RECEITAS', master: 'CUSTOS DE OUTRAS RECEITAS' },
    { code: '', name: 'Custo de transporte de clientes', package: 'CUSTOS DE OUTRAS RECEITAS', master: 'CUSTOS DE OUTRAS RECEITAS' },
    { code: '', name: 'Outros custos de servicos prestados', package: 'CUSTOS DE OUTRAS RECEITAS', master: 'CUSTOS DE OUTRAS RECEITAS' },
    { code: '', name: 'Limpeza de carpetes', package: 'DESPESAS COM CONSERVACAO E LIMPEZA', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '', name: 'Material de limpeza', package: 'DESPESAS COM CONSERVACAO E LIMPEZA', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '', name: 'Produtos de limpeza', package: 'DESPESAS COM CONSERVACAO E LIMPEZA', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '', name: 'Servicos de limpeza', package: 'DESPESAS COM CONSERVACAO E LIMPEZA', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '', name: 'Contratos de manutencao', package: 'DESPESAS COM MANUTENCAO', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '', name: 'Reparos e materiais - Ar condicionado', package: 'DESPESAS COM MANUTENCAO', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '', name: 'Reparos e materiais - Caldeira', package: 'DESPESAS COM MANUTENCAO', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '', name: 'Reparos e materiais - Elevador', package: 'DESPESAS COM MANUTENCAO', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '', name: 'Reparos e materiais - Equipamentos de TI', package: 'DESPESAS COM MANUTENCAO', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '', name: 'Reparos e materiais - Estrutura predial', package: 'DESPESAS COM MANUTENCAO', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '', name: 'Reparos e materiais - Instalacao eletrica', package: 'DESPESAS COM MANUTENCAO', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '', name: 'Reparos e materiais - Instalacao hidraulica', package: 'DESPESAS COM MANUTENCAO', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '', name: 'Reparos e materiais - Instrumentacao / automacao', package: 'DESPESAS COM MANUTENCAO', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '', name: 'Reparos e materiais - Jardins / Quadras / Animais', package: 'DESPESAS COM MANUTENCAO', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '', name: 'Reparos e materiais - Maquinas e equipamentos', package: 'DESPESAS COM MANUTENCAO', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '', name: 'Reparos e materiais - Material de consumo', package: 'DESPESAS COM MANUTENCAO', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '', name: 'Reparos e materiais - Moveis e utensilios', package: 'DESPESAS COM MANUTENCAO', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '', name: 'Reparos e materiais - Piscina', package: 'DESPESAS COM MANUTENCAO', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '', name: 'Reparos e materiais - Restauracao', package: 'DESPESAS COM MANUTENCAO', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '', name: 'Reparos e materiais - Telefonia', package: 'DESPESAS COM MANUTENCAO', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '', name: 'Reparos e materiais - Veiculo', package: 'DESPESAS COM MANUTENCAO', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '', name: 'Servico de dedetizacao', package: 'DESPESAS COM MANUTENCAO', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '', name: 'Servicos de remocao de lixo e entulho', package: 'DESPESAS COM MANUTENCAO', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '', name: 'Agua', package: 'DESPESAS COM SERVICOS PUBLICOS', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '', name: 'Combustiveis para Geradores', package: 'DESPESAS COM SERVICOS PUBLICOS', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '', name: 'Combustiveis para veiculos', package: 'DESPESAS COM SERVICOS PUBLICOS', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '', name: 'Energia eletrica', package: 'DESPESAS COM SERVICOS PUBLICOS', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '', name: 'Gas', package: 'DESPESAS COM SERVICOS PUBLICOS', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '', name: 'Amenidades / Suprimentos pra hospedes', package: 'DESPESAS OPERACIONAIS', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '', name: 'Assinatura de TV a cabo', package: 'DESPESAS OPERACIONAIS', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '', name: 'Danos e perdas', package: 'DESPESAS OPERACIONAIS', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '', name: 'Decoração e ornamentos', package: 'DESPESAS OPERACIONAIS', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '', name: 'Despesas com descartaveis', package: 'DESPESAS OPERACIONAIS', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '', name: 'Despesas de Taxa de Reservas', package: 'DESPESAS OPERACIONAIS', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '', name: 'Falhas de Hospedagem / Overbook', package: 'DESPESAS OPERACIONAIS', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '', name: 'Frete', package: 'DESPESAS OPERACIONAIS', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '', name: 'ICMS - Diferencial de aliquota', package: 'DESPESAS OPERACIONAIS', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '', name: 'Indenizacao ao hospede', package: 'DESPESAS OPERACIONAIS', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '', name: 'Jornais / livros / revistas', package: 'DESPESAS OPERACIONAIS', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '', name: 'Lavanderia enxoval', package: 'DESPESAS OPERACIONAIS', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '', name: 'Lavanderia uniformes', package: 'DESPESAS OPERACIONAIS', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '', name: 'Locacao de moveis, utensílios e equipamentos', package: 'DESPESAS OPERACIONAIS', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '', name: 'Material de esporte e lazer', package: 'DESPESAS OPERACIONAIS', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '', name: 'Material de estetica', package: 'DESPESAS OPERACIONAIS', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '', name: 'Musica, entretenimento e bem estar', package: 'DESPESAS OPERACIONAIS', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '', name: 'Reposição de enxovais', package: 'DESPESAS OPERACIONAIS', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '', name: 'Reposição de materiais, moveis e utensílios', package: 'DESPESAS OPERACIONAIS', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '', name: 'Room tax (taxa de turismo)', package: 'DESPESAS OPERACIONAIS', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '', name: 'Seguranca / Salva vidas', package: 'DESPESAS OPERACIONAIS', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '', name: 'Servicos prestados por terceiros', package: 'DESPESAS OPERACIONAIS', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '', name: 'Suprimentos impressos e folheteria', package: 'DESPESAS OPERACIONAIS', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '', name: 'Telefonia fixa', package: 'DESPESAS OPERACIONAIS', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '', name: 'Telefonia móvel', package: 'DESPESAS OPERACIONAIS', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '', name: 'Assiduidade', package: 'BENEFICIOS AOS COLABORADORES', master: 'DESPESAS COM MAO DE OBRA' },
    { code: '', name: 'Ajuda de custos', package: 'BENEFICIOS AOS COLABORADORES', master: 'DESPESAS COM MAO DE OBRA' },
    { code: '', name: 'Alojamento e casa de praia', package: 'BENEFICIOS AOS COLABORADORES', master: 'DESPESAS COM MAO DE OBRA' },
    { code: '', name: 'Assistencia medica e odontologica', package: 'BENEFICIOS AOS COLABORADORES', master: 'DESPESAS COM MAO DE OBRA' },
    { code: '', name: 'Atividades desportivas e sociais', package: 'BENEFICIOS AOS COLABORADORES', master: 'DESPESAS COM MAO DE OBRA' },
    { code: '', name: 'Brigada de incendio', package: 'BENEFICIOS AOS COLABORADORES', master: 'DESPESAS COM MAO DE OBRA' },
    { code: '', name: 'Cesta basica', package: 'BENEFICIOS AOS COLABORADORES', master: 'DESPESAS COM MAO DE OBRA' },
    { code: '', name: 'Consumo interno', package: 'BENEFICIOS AOS COLABORADORES', master: 'DESPESAS COM MAO DE OBRA' },
    { code: '', name: 'Cursos e treinamentos', package: 'BENEFICIOS AOS COLABORADORES', master: 'DESPESAS COM MAO DE OBRA' },
    { code: '', name: 'PPRA e PCMSO', package: 'BENEFICIOS AOS COLABORADORES', master: 'DESPESAS COM MAO DE OBRA' },
    { code: '', name: 'Produtividade / Premiacao', package: 'BENEFICIOS AOS COLABORADORES', master: 'DESPESAS COM MAO DE OBRA' },
    { code: '', name: 'Refeicao (PAT)', package: 'BENEFICIOS AOS COLABORADORES', master: 'DESPESAS COM MAO DE OBRA' },
    { code: '', name: 'Seguro de vida', package: 'BENEFICIOS AOS COLABORADORES', master: 'DESPESAS COM MAO DE OBRA' },
    { code: '', name: 'Ticket alimentacao', package: 'BENEFICIOS AOS COLABORADORES', master: 'DESPESAS COM MAO DE OBRA' },
    { code: '', name: 'Vale Transporte', package: 'BENEFICIOS AOS COLABORADORES', master: 'DESPESAS COM MAO DE OBRA' },
    { code: '', name: 'Acordo judicial trabalhista', package: 'DESPESAS COM PESSOAL', master: 'DESPESAS COM MAO DE OBRA' },
    { code: '', name: 'Adicional noturno', package: 'DESPESAS COM PESSOAL', master: 'DESPESAS COM MAO DE OBRA' },
    { code: '', name: 'Aviso Previo Indenizado', package: 'DESPESAS COM PESSOAL', master: 'DESPESAS COM MAO DE OBRA' },
    { code: '', name: 'Comissoes vendedoras / executivas', package: 'DESPESAS COM PESSOAL', master: 'DESPESAS COM MAO DE OBRA' },
    { code: '', name: 'Decimo terceiro salario', package: 'DESPESAS COM PESSOAL', master: 'DESPESAS COM MAO DE OBRA' },
    { code: '', name: 'Estagiarios', package: 'DESPESAS COM PESSOAL', master: 'DESPESAS COM MAO DE OBRA' },
    { code: '', name: 'Ferias', package: 'DESPESAS COM PESSOAL', master: 'DESPESAS COM MAO DE OBRA' },
    { code: '', name: 'Gratificacao', package: 'DESPESAS COM PESSOAL', master: 'DESPESAS COM MAO DE OBRA' },
    { code: '', name: 'Horas extras', package: 'DESPESAS COM PESSOAL', master: 'DESPESAS COM MAO DE OBRA' },
    { code: '', name: 'Indenizacoes trabalhistas', package: 'DESPESAS COM PESSOAL', master: 'DESPESAS COM MAO DE OBRA' },
    { code: '', name: 'Participacao nos Lucros e Resultados - PLR', package: 'DESPESAS COM PESSOAL', master: 'DESPESAS COM MAO DE OBRA' },
    { code: '', name: 'Pro labore', package: 'DESPESAS COM PESSOAL', master: 'DESPESAS COM MAO DE OBRA' },
    { code: '', name: 'Salario maternidade', package: 'DESPESAS COM PESSOAL', master: 'DESPESAS COM MAO DE OBRA' },
    { code: '', name: 'Salarios e ordenados', package: 'DESPESAS COM PESSOAL', master: 'DESPESAS COM MAO DE OBRA' },
    { code: '', name: 'Uniformes e fantasias', package: 'DESPESAS COM PESSOAL', master: 'DESPESAS COM MAO DE OBRA' },
    { code: '', name: 'EPI e EPC', package: 'DESPESAS COM PESSOAL', master: 'DESPESAS COM MAO DE OBRA' },
    { code: '', name: 'Contribuicao sindical e assistencial', package: 'ENCARGOS SOCIAIS', master: 'DESPESAS COM MAO DE OBRA' },
    { code: '', name: 'FGTS', package: 'ENCARGOS SOCIAIS', master: 'DESPESAS COM MAO DE OBRA' },
    { code: '', name: 'FGTS Rescisorio', package: 'ENCARGOS SOCIAIS', master: 'DESPESAS COM MAO DE OBRA' },
    { code: '', name: 'INSS', package: 'ENCARGOS SOCIAIS', master: 'DESPESAS COM MAO DE OBRA' },
    { code: '', name: 'PIS s/ folha de pagamento', package: 'ENCARGOS SOCIAIS', master: 'DESPESAS COM MAO DE OBRA' },
    { code: '', name: 'Servicos de terceiros temporarios', package: 'SERVIÇOS DE TERCEIROS', master: 'DESPESAS COM MAO DE OBRA' },
    { code: '', name: 'Serviço de terceiros recorrente', package: 'SERVIÇOS DE TERCEIROS', master: 'DESPESAS COM MAO DE OBRA' },
    { code: '', name: 'Serviços contratados de prestadores PJ - MEI', package: 'SERVIÇOS DE TERCEIROS', master: 'DESPESAS COM MAO DE OBRA' },
    { code: '', name: 'Assessoria contabil', package: 'DESPESAS ADMINISTRATIVAS', master: 'DESPESAS ADMINISTRATIVAS' },
    { code: '', name: 'Assessoria e perdas com cobranca', package: 'DESPESAS ADMINISTRATIVAS', master: 'DESPESAS ADMINISTRATIVAS' },
    { code: '', name: 'Assessoria jurídica e advocaticia', package: 'DESPESAS ADMINISTRATIVAS', master: 'DESPESAS ADMINISTRATIVAS' },
    { code: '', name: 'Associacao de classe', package: 'DESPESAS ADMINISTRATIVAS', master: 'DESPESAS ADMINISTRATIVAS' },
    { code: '', name: 'Auditoria externa', package: 'DESPESAS ADMINISTRATIVAS', master: 'DESPESAS ADMINISTRATIVAS' },
    { code: '', name: 'Comissao cartao Amex', package: 'DESPESAS ADMINISTRATIVAS', master: 'DESPESAS ADMINISTRATIVAS' },
    { code: '', name: 'Comissao cartao Diners', package: 'DESPESAS ADMINISTRATIVAS', master: 'DESPESAS ADMINISTRATIVAS' },
    { code: '', name: 'Comissao cartao MasterCard', package: 'DESPESAS ADMINISTRATIVAS', master: 'DESPESAS ADMINISTRATIVAS' },
    { code: '', name: 'Comissao cartao Visa', package: 'DESPESAS ADMINISTRATIVAS', master: 'DESPESAS ADMINISTRATIVAS' },
    { code: '', name: 'Comissao Elo/ Cabal/ Hipercard/ Alelo/ Discover', package: 'DESPESAS ADMINISTRATIVAS', master: 'DESPESAS ADMINISTRATIVAS' },
    { code: '', name: 'Comissoes de agencias', package: 'DESPESAS ADMINISTRATIVAS', master: 'DESPESAS ADMINISTRATIVAS' },
    { code: '', name: 'Conducao, alimentacao e quilometragem', package: 'DESPESAS ADMINISTRATIVAS', master: 'DESPESAS ADMINISTRATIVAS' },
    { code: '', name: 'Consultas a SERASA e SPC', package: 'DESPESAS ADMINISTRATIVAS', master: 'DESPESAS ADMINISTRATIVAS' },
    { code: '', name: 'Consultoria / Assessoria', package: 'DESPESAS ADMINISTRATIVAS', master: 'DESPESAS ADMINISTRATIVAS' },
    { code: '', name: 'Correio / Malote / Motoboy', package: 'DESPESAS ADMINISTRATIVAS', master: 'DESPESAS ADMINISTRATIVAS' },
    { code: '', name: 'Despesas com Internet', package: 'DESPESAS ADMINISTRATIVAS', master: 'DESPESAS ADMINISTRATIVAS' },
    { code: '', name: 'Despesas com veiculos', package: 'DESPESAS ADMINISTRATIVAS', master: 'DESPESAS ADMINISTRATIVAS' },
    { code: '', name: 'Despesas com viagens e estadas', package: 'DESPESAS ADMINISTRATIVAS', master: 'DESPESAS ADMINISTRATIVAS' },
    { code: '', name: 'Despesas de Taxa de Administracao', package: 'DESPESAS ADMINISTRATIVAS', master: 'DESPESAS ADMINISTRATIVAS' },
    { code: '', name: 'Despesas Nao Dedutiveis terceiros', package: 'DESPESAS ADMINISTRATIVAS', master: 'DESPESAS ADMINISTRATIVAS' },
    { code: '', name: 'Despesas Nao Dedutiveis pequenas despesas', package: 'DESPESAS ADMINISTRATIVAS', master: 'DESPESAS ADMINISTRATIVAS' },
    { code: '', name: 'Direito Autoral e de Imagem', package: 'DESPESAS ADMINISTRATIVAS', master: 'DESPESAS ADMINISTRATIVAS' },
    { code: '', name: 'Doacao/Donativos', package: 'DESPESAS ADMINISTRATIVAS', master: 'DESPESAS ADMINISTRATIVAS' },
    { code: '', name: 'Indenizacoes e acordo judicial civil', package: 'DESPESAS ADMINISTRATIVAS', master: 'DESPESAS ADMINISTRATIVAS' },
    { code: '', name: 'Licença de uso e marca', package: 'DESPESAS ADMINISTRATIVAS', master: 'DESPESAS ADMINISTRATIVAS' },
    { code: '', name: 'Material de escritorio', package: 'DESPESAS ADMINISTRATIVAS', master: 'DESPESAS ADMINISTRATIVAS' },
    { code: '', name: 'Multas e autuações diversas', package: 'DESPESAS ADMINISTRATIVAS', master: 'DESPESAS ADMINISTRATIVAS' },
    { code: '', name: 'Processamentos de dados e TI', package: 'DESPESAS ADMINISTRATIVAS', master: 'DESPESAS ADMINISTRATIVAS' },
    { code: '', name: 'Provisão Devedores Duvidosos - PDD', package: 'DESPESAS ADMINISTRATIVAS', master: 'DESPESAS ADMINISTRATIVAS' },
    { code: '', name: 'Recrutamento e selecao', package: 'DESPESAS ADMINISTRATIVAS', master: 'DESPESAS ADMINISTRATIVAS' },
    { code: '', name: 'Seguros', package: 'DESPESAS ADMINISTRATIVAS', master: 'DESPESAS ADMINISTRATIVAS' },
    { code: '', name: 'Servicos de cartorio, autenticacoes e copias', package: 'DESPESAS ADMINISTRATIVAS', master: 'DESPESAS ADMINISTRATIVAS' },
    { code: '', name: 'Suprimentos de informatica', package: 'DESPESAS ADMINISTRATIVAS', master: 'DESPESAS ADMINISTRATIVAS' },
    { code: '', name: 'Taxa de condominio e aluguel de imoveis', package: 'DESPESAS ADMINISTRATIVAS', master: 'DESPESAS ADMINISTRATIVAS' },
    { code: '', name: 'Taxas fiscais e legais', package: 'DESPESAS ADMINISTRATIVAS', master: 'DESPESAS ADMINISTRATIVAS' },
    { code: '', name: 'Projetos Sustentáveis', package: 'DESPESAS ADMINISTRATIVAS', master: 'DESPESAS ADMINISTRATIVAS' },
    { code: '', name: 'Licença de plataforma TI', package: 'DESPESAS ADMINISTRATIVAS', master: 'DESPESAS ADMINISTRATIVAS' },
    { code: '', name: 'Provisao de gastos diversos', package: 'PROVISOES GERAIS', master: 'PROVISOES GERAIS' },
    { code: '', name: 'Provisao de servicos gerenciais', package: 'PROVISOES GERAIS', master: 'PROVISOES GERAIS' },
    { code: '', name: 'Provisao de advogados e honorarios', package: 'PROVISOES GERAIS', master: 'PROVISOES GERAIS' },
    { code: '', name: 'Provisao de viagens e representacoes', package: 'PROVISOES GERAIS', master: 'PROVISOES GERAIS' },
    { code: '', name: 'Provisao de PLR', package: 'PROVISOES GERAIS', master: 'PROVISOES GERAIS' },
    { code: '', name: 'Provisao de auditoria externa', package: 'PROVISOES GERAIS', master: 'PROVISOES GERAIS' },
    { code: '', name: 'Provisao de roupa, cama, mesa e banho', package: 'PROVISOES GERAIS', master: 'PROVISOES GERAIS' },
    { code: '', name: 'Provisao de material operacional', package: 'PROVISOES GERAIS', master: 'PROVISOES GERAIS' },
    { code: '', name: 'Provisao de bonus', package: 'PROVISOES GERAIS', master: 'PROVISOES GERAIS' },
    { code: '', name: 'Provisao de uniformes', package: 'PROVISOES GERAIS', master: 'PROVISOES GERAIS' },
    { code: '', name: 'Provisao de fundo de reserva', package: 'PROVISOES GERAIS', master: 'PROVISOES GERAIS' },
    { code: '', name: 'Provisao de publicidade', package: 'PROVISOES GERAIS', master: 'PROVISOES GERAIS' },
    { code: '', name: 'Provisao de recursos humanos', package: 'PROVISOES GERAIS', master: 'PROVISOES GERAIS' },
    { code: '', name: 'Provisao de manutencao e reparos', package: 'PROVISOES GERAIS', master: 'PROVISOES GERAIS' },
    { code: '', name: 'Provisao de agua e esgoto', package: 'PROVISOES GERAIS', master: 'PROVISOES GERAIS' },
    { code: '', name: 'Provisao de energia eletrica', package: 'PROVISOES GERAIS', master: 'PROVISOES GERAIS' },
    { code: '', name: 'Provisao de combustiveis', package: 'PROVISOES GERAIS', master: 'PROVISOES GERAIS' },
    { code: '', name: 'Provisao de telecomunicacoes', package: 'PROVISOES GERAIS', master: 'PROVISOES GERAIS' },
    { code: '', name: 'Provisao de contingencia trabalhista', package: 'PROVISOES GERAIS', master: 'PROVISOES GERAIS' },
    { code: '', name: 'Provisao de contingencia civel', package: 'PROVISOES GERAIS', master: 'PROVISOES GERAIS' },
    { code: '', name: 'Provisao de servicos de terceiros temporarios', package: 'PROVISOES GERAIS', master: 'PROVISOES GERAIS' },
    { code: '', name: 'Provisao de Taxa de Administracao', package: 'PROVISOES GERAIS', master: 'PROVISOES GERAIS' },
    { code: '', name: 'Provisao de Taxa de Marketing', package: 'PROVISOES GERAIS', master: 'PROVISOES GERAIS' },
    { code: '', name: 'Provisao de Taxa de Incentivo', package: 'PROVISOES GERAIS', master: 'PROVISOES GERAIS' },
    { code: '', name: 'Provisao de PIS', package: 'PROVISOES GERAIS', master: 'PROVISOES GERAIS' },
    { code: '', name: 'Provisao de COFINS', package: 'PROVISOES GERAIS', master: 'PROVISOES GERAIS' },
    { code: '', name: 'Provisao de ISS', package: 'PROVISOES GERAIS', master: 'PROVISOES GERAIS' },
    { code: '', name: 'Provisao de ICMS', package: 'PROVISOES GERAIS', master: 'PROVISOES GERAIS' },
    { code: '', name: 'Assessoria de imprensa', package: 'DESPESAS COM VENDAS E MARKETING', master: 'DESPESAS COM VENDAS E MARKETING' },
    { code: '', name: 'Cortesias', package: 'DESPESAS COM VENDAS E MARKETING', master: 'DESPESAS COM VENDAS E MARKETING' },
    { code: '', name: 'Despesas com fidelizacao de clientes', package: 'DESPESAS COM VENDAS E MARKETING', master: 'DESPESAS COM VENDAS E MARKETING' },
    { code: '', name: 'Despesas de Taxa de Marketing', package: 'DESPESAS COM VENDAS E MARKETING', master: 'DESPESAS COM VENDAS E MARKETING' },
    { code: '', name: 'Despesas de Taxa de Uso da Marca', package: 'DESPESAS COM VENDAS E MARKETING', master: 'DESPESAS COM VENDAS E MARKETING' },
    { code: '', name: 'Divulgacao, anuncio e publicacao', package: 'DESPESAS COM VENDAS E MARKETING', master: 'DESPESAS COM VENDAS E MARKETING' },
    { code: '', name: 'Eventos, feiras e promocoes', package: 'DESPESAS COM VENDAS E MARKETING', master: 'DESPESAS COM VENDAS E MARKETING' },
    { code: '', name: 'Material promocional', package: 'DESPESAS COM VENDAS E MARKETING', master: 'DESPESAS COM VENDAS E MARKETING' },
    { code: '', name: 'Descontos concedidos', package: 'IMPOSTOS SOBRE O LUCRO', master: 'DESPESAS FINANCEIRAS E BANCARIAS' },
    { code: '', name: 'Despesa Financeira / JSCP', package: 'IMPOSTOS SOBRE O LUCRO', master: 'DESPESAS FINANCEIRAS E BANCARIAS' },
    { code: '', name: 'IOF', package: 'IMPOSTOS SOBRE O LUCRO', master: 'DESPESAS FINANCEIRAS E BANCARIAS' },
    { code: '', name: 'Juros e multas diversos', package: 'IMPOSTOS SOBRE O LUCRO', master: 'DESPESAS FINANCEIRAS E BANCARIAS' },
    { code: '', name: 'Juros sobre emprestimos', package: 'IMPOSTOS SOBRE O LUCRO', master: 'DESPESAS FINANCEIRAS E BANCARIAS' },
    { code: '', name: 'Juros sobre financiamentos', package: 'IMPOSTOS SOBRE O LUCRO', master: 'DESPESAS FINANCEIRAS E BANCARIAS' },
    { code: '', name: 'Outras despesas financeiras', package: 'IMPOSTOS SOBRE O LUCRO', master: 'DESPESAS FINANCEIRAS E BANCARIAS' },
    { code: '', name: 'Tarifas e despesas bancarias diversas', package: 'IMPOSTOS SOBRE O LUCRO', master: 'DESPESAS FINANCEIRAS E BANCARIAS' },
    { code: '', name: 'Variacoes cambiais passivas', package: 'IMPOSTOS SOBRE O LUCRO', master: 'DESPESAS FINANCEIRAS E BANCARIAS' },
    { code: '', name: 'Variacoes monetarias passivas', package: 'IMPOSTOS SOBRE O LUCRO', master: 'DESPESAS FINANCEIRAS E BANCARIAS' },
    { code: '', name: 'CSLL', package: 'IMPOSTOS SOBRE O LUCRO', master: 'DESPESAS TRIBUTARIAS' },
    { code: '', name: 'CSLL Diferido', package: 'IMPOSTOS SOBRE O LUCRO', master: 'DESPESAS TRIBUTARIAS' },
    { code: '', name: 'IRPJ', package: 'IMPOSTOS SOBRE O LUCRO', master: 'DESPESAS TRIBUTARIAS' },
    { code: '', name: 'IRPJ Diferido', package: 'IMPOSTOS SOBRE O LUCRO', master: 'DESPESAS TRIBUTARIAS' },
    { code: '', name: 'Funrural', package: 'OUTROS IMPOSTOS', master: 'DESPESAS TRIBUTARIAS' },
    { code: '', name: 'IPTU', package: 'OUTROS IMPOSTOS', master: 'DESPESAS TRIBUTARIAS' },
    { code: '', name: 'IPVA', package: 'OUTROS IMPOSTOS', master: 'DESPESAS TRIBUTARIAS' },
    { code: '', name: 'ITBI e ITR', package: 'OUTROS IMPOSTOS', master: 'DESPESAS TRIBUTARIAS' },
    { code: '', name: 'Tributos em atraso', package: 'OUTROS IMPOSTOS', master: 'DESPESAS TRIBUTARIAS' },
    { code: '', name: 'Aluguel fixo', package: 'ARRENDAMENTO', master: 'ARRENDAMENTO' },
    { code: '', name: 'Aluguel variavel', package: 'ARRENDAMENTO', master: 'ARRENDAMENTO' },
    { code: '', name: 'Arrendamento', package: 'ARRENDAMENTO', master: 'ARRENDAMENTO' },
    { code: '', name: 'ICMS', package: 'IMPOSTOS', master: 'IMPOSTOS' },
    { code: '', name: 'COFINS', package: 'IMPOSTOS', master: 'IMPOSTOS' },
    { code: '', name: 'PIS', package: 'IMPOSTOS', master: 'IMPOSTOS' },
    { code: '', name: 'ISS', package: 'IMPOSTOS', master: 'IMPOSTOS' },
];

export const defaultAccountConfigs: Record<string, { expenseType: ExpenseType, expenseDriver?: ExpenseDriver }> = {
    // CUSTO DE ALIMENTOS E BEBIDAS
    'Carnes / Aves / Peixes': { expenseType: 'Variável', expenseDriver: 'PAX' },
    'Condimentos / Conservas': { expenseType: 'Variável', expenseDriver: 'PAX' },
    'Embutidos / Massas': { expenseType: 'Variável', expenseDriver: 'PAX' },
    'Frios': { expenseType: 'Variável', expenseDriver: 'PAX' },
    'Guloseimas': { expenseType: 'Variável', expenseDriver: 'PAX' },
    'Hortifrutigranjeiros': { expenseType: 'Variável', expenseDriver: 'PAX' },
    'Laticinios': { expenseType: 'Variável', expenseDriver: 'PAX' },
    'Outros custos': { expenseType: 'Variável', expenseDriver: 'PAX' },
    'Paes / Biscoitos': { expenseType: 'Variável', expenseDriver: 'PAX' },
    'Secos': { expenseType: 'Variável', expenseDriver: 'PAX' },
    'Bebidas alcoolicas': { expenseType: 'Variável', expenseDriver: 'PAX' },
    'Bebidas nao alcoolicas': { expenseType: 'Variável', expenseDriver: 'PAX' },

    // CUSTO DE PRODUTOS DIVERSOS
    'Cigarros': { expenseType: 'Variável', expenseDriver: 'PAX' },
    'Custos Descartaveis': { expenseType: 'Variável', expenseDriver: 'PAX' },
    'Custos Diversos': { expenseType: 'Variável', expenseDriver: 'PAX' },
    'Diversos A&B': { expenseType: 'Variável', expenseDriver: 'PAX' },
    'Produtos diversos lojinha': { expenseType: 'Variável', expenseDriver: 'PAX' },
    'Vestuario': { expenseType: 'Variável', expenseDriver: 'PAX' },

    // CUSTOS DE OUTRAS RECEITAS
    'Custo com entretenimento': { expenseType: 'Variável', expenseDriver: 'PAX' },
    'Custo de aluguel de equipamentos': { expenseType: 'Variável', expenseDriver: 'PAX' },
    'Custo de estacionamento': { expenseType: 'Variável', expenseDriver: 'PAX' },
    'Custo de internet': { expenseType: 'Variável', expenseDriver: 'PAX' },
    'Custo de lavanderia hospedes': { expenseType: 'Variável', expenseDriver: 'PAX' },
    'Custo de servico de fotografia': { expenseType: 'Variável', expenseDriver: 'PAX' },
    'Custo de servico de massagens': { expenseType: 'Variável', expenseDriver: 'PAX' },
    'Custo de telefonia': { expenseType: 'Variável', expenseDriver: 'PAX' },
    'Custo de transporte de clientes': { expenseType: 'Variável', expenseDriver: 'PAX' },
    'Outros custos de servicos prestados': { expenseType: 'Variável', expenseDriver: 'PAX' },

    // DESPESAS COM CONSERVACAO E LIMPEZA
    'Material de limpeza': { expenseType: 'Variável', expenseDriver: 'PAX' },
    'Produtos de limpeza': { expenseType: 'Variável', expenseDriver: 'PAX' },

    // DESPESAS COM MANUTENCAO
    'Reparos e materiais - Ar condicionado': { expenseType: 'Variável', expenseDriver: 'PAX' },
    'Reparos e materiais - Caldeira': { expenseType: 'Variável', expenseDriver: 'PAX' },
    'Reparos e materiais - Elevador': { expenseType: 'Variável', expenseDriver: 'PAX' },
    'Reparos e materiais - Equipamentos de TI': { expenseType: 'Variável', expenseDriver: 'PAX' },
    'Reparos e materiais - Estrutura predial': { expenseType: 'Variável', expenseDriver: 'PAX' },
    'Reparos e materiais - Instalacao eletrica': { expenseType: 'Variável', expenseDriver: 'PAX' },
    'Reparos e materiais - Instalacao hidraulica': { expenseType: 'Variável', expenseDriver: 'PAX' },
    'Reparos e materiais - Instrumentacao / automacao': { expenseType: 'Variável', expenseDriver: 'PAX' },
    'Reparos e materiais - Jardins / Quadras / Animais': { expenseType: 'Variável', expenseDriver: 'PAX' },
    'Reparos e materiais - Maquinas e equipamentos': { expenseType: 'Variável', expenseDriver: 'PAX' },
    'Reparos e materiais - Material de consumo': { expenseType: 'Variável', expenseDriver: 'PAX' },
    'Reparos e materiais - Moveis e utensilios': { expenseType: 'Variável', expenseDriver: 'PAX' },
    'Reparos e materiais - Piscina': { expenseType: 'Variável', expenseDriver: 'PAX' },
    'Reparos e materiais - Restauracao': { expenseType: 'Variável', expenseDriver: 'PAX' },
    'Reparos e materiais - Telefonia': { expenseType: 'Variável', expenseDriver: 'PAX' },

    // DESPESAS COM SERVICOS PUBLICOS
    'Agua': { expenseType: 'Variável', expenseDriver: 'PAX' },
    'Combustiveis para Geradores': { expenseType: 'Variável', expenseDriver: 'PAX' },
    'Combustiveis para veiculos': { expenseType: 'Variável', expenseDriver: 'PAX' },
    'Energia eletrica': { expenseType: 'Variável', expenseDriver: 'PAX' },
    'Gas': { expenseType: 'Variável', expenseDriver: 'PAX' },

    // DESPESAS OPERACIONAIS
    'Amenidades / Suprimentos pra hospedes': { expenseType: 'Variável', expenseDriver: 'PAX' },
    'Danos e perdas': { expenseType: 'Variável', expenseDriver: 'PAX' },
    'Despesas com descartaveis': { expenseType: 'Variável', expenseDriver: 'PAX' },
    'Despesas de Taxa de Reservas': { expenseType: 'Variável', expenseDriver: 'Receita' },
    'Falhas de Hospedagem / Overbook': { expenseType: 'Variável', expenseDriver: 'PAX' },
    'Indenizacao ao hospede': { expenseType: 'Variável', expenseDriver: 'PAX' },
    'Lavanderia enxoval': { expenseType: 'Variável', expenseDriver: 'PAX' },
    'Lavanderia uniformes': { expenseType: 'Variável', expenseDriver: 'PAX' },
    'Reposição de enxovais': { expenseType: 'Variável', expenseDriver: 'PAX' },
    'Reposição de materiais, moveis e utensílios': { expenseType: 'Variável', expenseDriver: 'PAX' },
    'Suprimentos impressos e folheteria': { expenseType: 'Variável', expenseDriver: 'PAX' },

    // DESPESAS COM VENDAS E MARKETING
    'Marketing': { expenseType: 'Variável', expenseDriver: 'Receita' },
    'Martech': { expenseType: 'Variável', expenseDriver: 'Receita' },
    'Outros setores': { expenseType: 'Variável', expenseDriver: 'Receita' },
    'Comissoes - Agencias': { expenseType: 'Variável', expenseDriver: 'Receita' },
    'Comissoes - Cartoes de credito': { expenseType: 'Variável', expenseDriver: 'Receita' },
    'Comissoes - OTAS': { expenseType: 'Variável', expenseDriver: 'Receita' },
    'Comissoes - Representantes': { expenseType: 'Variável', expenseDriver: 'Receita' },

    // DESPESAS COM MAO DE OBRA
    'Comissoes vendedoras / executivas': { expenseType: 'Variável', expenseDriver: 'Receita' },
    'Estagiarios': { expenseType: 'Variável', expenseDriver: 'Emocionadores' },
    'Horas extras': { expenseType: 'Variável', expenseDriver: 'Emocionadores (CLT)' },
    'Salarios e ordenados': { expenseType: 'Variável', expenseDriver: 'Emocionadores (CLT)' },
    'Contribuicao sindical e assistencial': { expenseType: 'Variável', expenseDriver: 'Emocionadores (CLT)' },
    'FGTS': { expenseType: 'Variável', expenseDriver: 'Emocionadores (CLT)' },
    'INSS': { expenseType: 'Variável', expenseDriver: 'Emocionadores (CLT)' },
    'PIS sobre folha': { expenseType: 'Variável', expenseDriver: 'Emocionadores (CLT)' },
    'Seguro de Acidentes de Trabalho - SAT': { expenseType: 'Variável', expenseDriver: 'Emocionadores (CLT)' },
    'Taxa de Servico': { expenseType: 'Variável', expenseDriver: 'Receita' },

    // DESPESAS ADMINISTRATIVAS
    'Processamento de dados e TI': { expenseType: 'Variável', expenseDriver: 'Receita' },
    'TI': { expenseType: 'Variável', expenseDriver: 'Receita' },
    'Outros': { expenseType: 'Variável', expenseDriver: 'Receita' }
};

const generateMockData = () => {
    const packages: CostPackage[] = [];
    const accounts: Account[] = [];
    const managers = ['u1', 'u2', 'u3', 'u4', 'u5', 'u6'];
    const packageMap = new Map<string, string>(); // Name -> ID

    let idCounter = 1;

    USALI_STRUCTURE.forEach((item, index) => {
        let pkgId = packageMap.get(item.package);
        if (!pkgId) {
            pkgId = `pkg-${packageMap.size + 1}`;
            packageMap.set(item.package, pkgId);
            packages.push({
                id: pkgId,
                code: `P${String(packageMap.size).padStart(2, '0')}`,
                name: item.package,
                managerId: managers[packageMap.size % managers.length]
            });
        }

        const config = defaultAccountConfigs[item.name];

        accounts.push({
            id: `acc-${idCounter++}`,
            code: item.code,
            name: item.name,
            packageId: pkgId,
            package: item.package,
            packageCode: '',
            masterPackage: item.master,
            masterPackageCode: '',
            type: 'Fixed',
            expenseType: config?.expenseType,
            expenseDriver: config?.expenseDriver,
            sortOrder: index + 1
        });
    });

    return { packages, accounts };
};

const generatedData = generateMockData();
export const mockPackages = generatedData.packages;
export const mockAccounts = generatedData.accounts;

export const mockGMDConfigs: GMDConfiguration[] = [
    {
        id: 'gmd1',
        hotelId: '1',
        entityManagerIds: ['u1'],
        packageId: mockPackages[0].id,
        packageManagerId: 'u2',
        supportUserIds: ['u4'],
        linkedAccountIds: mockAccounts.filter(a => a.packageId === mockPackages[0].id).slice(0, 5).map(a => a.id),
        costCenterIds: ['cr2'],
        accountManagerId: 'u3'
    }
];

// --- FORECAST GENERATION ---

const generateRow = (
    id: string,
    accountCode: string,
    category: string,
    label: string,
    budgetVal: number,
    realVal: number,
    lastYearVal: number,
    previaVal: number = 0, // NEW: Previa Value
    isHeader = false,
    isTotal = false,
    indentLevel = 0,
    gmdManagerName?: string,
    config?: { type?: ExpenseType, driver?: ExpenseDriver, kpiCalculation?: KpiCalculation, taxRate?: number, inputType?: 'expense' | 'tax' | 'none', format?: 'currency' | 'percent' | 'integer' | 'decimal', method?: 'Fixed' | 'Variable', factor?: number, precomputedKpi?: { previa: number; real: number; budget: number; format: 'currency' | 'percent' | 'integer' | 'decimal', denominator?: { previa: number; real: number; budget: number } } },
    indicatorSection?: string,
    dreConfig?: {
        isCalculated?: boolean,
        formula?: string,
        textColor?: string,
        bgColor?: string,
        isBold?: boolean,
        isItalic?: boolean
    }
): ForecastRow => {

    const budget = budgetVal || 0;
    const real = realVal || 0;
    const lastYear = lastYearVal || 0;
    const previa = previaVal || 0;

    const deltaBudgetVal = real - budget;
    const deltaBudgetPct = budget === 0 ? 0 : ((real - budget) / budget) * 100;

    const deltaPreviaVal = real - previa;
    const deltaPreviaPct = previa === 0 ? 0 : ((real - previa) / previa) * 100;

    // Initialize Default Forecast Config
    const forecastConfig: ForecastConfig = {
        method: config?.method || 'Fixed',
        driver: config?.driver,
        factor: config?.factor,
        manualValue: real // Initialize manual value with the "Real" passed in
    };

    return {
        id,
        accountCode,
        category,
        label,
        isHeader,
        isTotal,
        indentLevel,
        real,
        budget,
        lastYear,
        previa,
        gmdManagerName,
        deltaBudgetVal,
        deltaBudgetPct,
        deltaLYVal: real - lastYear,
        deltaLYPct: lastYear === 0 ? 0 : ((real - lastYear) / lastYear) * 100,
        deltaPreviaVal,
        deltaPreviaPct,
        indicatorSection, // NEW field
        forecastConfig, // NEW Unified Config
        rowConfig: config ? {
            inputType: config.inputType || 'none',
            expenseType: config.type,
            expenseDriver: config.driver,
            kpiCalculation: config.kpiCalculation,
            taxRate: config.taxRate,
            format: config.format || 'currency',
            precomputedKpi: config.precomputedKpi
        } : { inputType: 'none', format: 'currency' },

        // Intelligent DRE fields
        isCalculated: dreConfig?.isCalculated,
        formula: dreConfig?.formula,
        textColor: dreConfig?.textColor,
        bgColor: dreConfig?.bgColor,
        isBold: dreConfig?.isBold,
        isItalic: dreConfig?.isItalic
    };
};

export const getForecastData = (
    selectedMonth?: number,
    selectedYear?: number,
    importedData: ImportedRow[] = [],
    selectedHotelName?: string,
    currentHotels: Hotel[] = mockHotels,
    realOccupancyData: Record<string, Record<string, number>> = {},
    activeRealVersionId?: string,
    activeBudgetVersionId?: string,
    currentAccounts: Account[] = mockAccounts,
    currentPackages: CostPackage[] = mockPackages,
    budgetOccupancyData: Record<string, number[]> = {},
    activeProjectionType?: string,
    meetings?: Meeting[]
): ForecastRow[] => {

    const safeMeetings = meetings || [];

    const rows: ForecastRow[] = [];

    // Filter out accounts that are marked as outOfScope
    const activeAccounts = currentAccounts.filter(acc => !acc.outOfScope);
    const activeAccountIds = activeAccounts.map(acc => acc.id);

    // Determine active hotel code for filtering logic
    const activeHotel = currentHotels.find(h => h.name === selectedHotelName);
    const activeHotelCode = activeHotel ? activeHotel.code : '';

    // --- OPTIMIZATION: Build Index for Imported Data ---
    // Key: YEAR|MONTH|HOTEL|SCENARIO|ACCOUNT_NORMALIZED
    const dataIndex = new Map<string, number>();

    if (selectedMonth && selectedYear && importedData.length > 0) {
        importedData.forEach(row => {
            // 1. Check Status
            if (row.status !== 'valid') return;

            // 2. Parse & Check Date
            const rYear = parseInt(row.ano);
            const rMonth = parseInt(row.mes);

            // Filter relevant data only (Current Year, Last Year)
            if (rMonth !== selectedMonth) return;
            if (rYear !== selectedYear && rYear !== (selectedYear - 1)) return;

            // 3. Normalize Scenario
            const scen = (row.cenario || '').trim().toLowerCase();
            let normScenario = '';
            if (scen === 'real' || scen === 'realizado') normScenario = 'REAL';
            else if (scen === 'budget' || scen === 'meta' || scen === 'orcamento' || scen === 'orçamento') normScenario = 'BUDGET';
            else if (scen === 'previa' || scen === 'prévia' || scen === 'flash') normScenario = 'PREVIA';
            else if (scen === 'forecast' || scen === 'projeção') normScenario = 'FORECAST';
            else if (scen === 'otb') normScenario = 'OTB';
            else return;

            // Filter by versionId if applicable (ONLY FOR CURRENT YEAR)
            const isCurrentYear = (rYear === selectedYear);

            // Filter by versionId: accept data matching either Real or Budget active version
            // FORECAST scenario data is only matched against Real version (not Budget)
            if (row.versionId && isCurrentYear) {
                if (normScenario === 'FORECAST') {
                    // DRE Forecast imports: versionId must match the active Real version
                    const matchesReal = activeRealVersionId && row.versionId === activeRealVersionId;
                    if (activeRealVersionId && !matchesReal) return;
                } else {
                    const matchesReal = activeRealVersionId && row.versionId === activeRealVersionId;
                    const matchesBudget = activeBudgetVersionId && row.versionId === activeBudgetVersionId;
                    if (activeRealVersionId || activeBudgetVersionId) {
                        if (!matchesReal && !matchesBudget) return;
                    }
                }
            }

            // 4. Normalize Hotel
            const normHotel = normalizeHotelName(row.hotel);

            // 5. Parse Value
            const val = parseFloat(row.valor.replace(',', '.'));
            if (isNaN(val)) return;

            // 6. Indexing
            const normConta = normalizeAccountName(row.conta);
            const normCR = (row.cr || '').trim().toLowerCase();

            // Index by Account only
            const keyConta = `${rYear}|${rMonth}|${normHotel}|${normScenario}|${normConta}`;
            dataIndex.set(keyConta, (dataIndex.get(keyConta) || 0) + val);

            // Index by Account + CR for more specific lookups
            if (normCR) {
                const keyContaCR = `${rYear}|${rMonth}|${normHotel}|${normScenario}|${normConta}|${normCR}`;
                dataIndex.set(keyContaCR, (dataIndex.get(keyContaCR) || 0) + val);
            }

            // 7. Index by 'classificacao' if it exists
            if (row.classificacao) {
                const normClass = row.classificacao.trim().toLowerCase();
                if (normClass && normClass !== normConta) {
                    const keyClass = `${rYear}|${rMonth}|${normHotel}|${normScenario}|${normClass}`;
                    dataIndex.set(keyClass, (dataIndex.get(keyClass) || 0) + val);
                }
            }

            // 8. Index by 'pacoteMaster' if it exists (for Impostos and others)
            if (row.pacoteMaster) {
                const normPacoteMaster = normalizeAccountName(row.pacoteMaster);
                if (normPacoteMaster && normPacoteMaster !== normConta && normPacoteMaster !== normalizeAccountName(row.classificacao || '')) {
                    const keyPacoteMaster = `${rYear}|${rMonth}|${normHotel}|${normScenario}|${normPacoteMaster}`;
                    dataIndex.set(keyPacoteMaster, (dataIndex.get(keyPacoteMaster) || 0) + val);
                }
            }

            // 9. Index by 'pacote' if it exists
            if (row.pacote) {
                const normPacote = normalizeAccountName(row.pacote);
                if (normPacote && normPacote !== normConta && normPacote !== normalizeAccountName(row.classificacao || '') && normPacote !== normalizeAccountName(row.pacoteMaster || '')) {
                    const keyPacote = `${rYear}|${rMonth}|${normHotel}|${normScenario}|${normPacote}`;
                    dataIndex.set(keyPacote, (dataIndex.get(keyPacote) || 0) + val);
                }
            }
        });
    }

    // Optimized Helper using Index
    const getImportedValue = (accountName: string, targetYear: number | undefined, valueCategory: 'Real' | 'Budget' | 'Previa' | 'Forecast' | 'Otb', crFilter?: string) => {
        if (!selectedMonth || !targetYear) return 0;

        const targetName = normalizeAccountName(accountName);
        const targetCR = crFilter?.trim().toLowerCase();
        let targetScenario = '';
        if (valueCategory === 'Real') targetScenario = 'REAL';
        else if (valueCategory === 'Budget') targetScenario = 'BUDGET';
        else if (valueCategory === 'Previa') targetScenario = 'PREVIA';
        else if (valueCategory === 'Otb') targetScenario = 'OTB';
        else targetScenario = 'FORECAST';

        const keysToCheck = new Set<string>();
        const hotelsToTry = Array.from(new Set([selectedHotelName, activeHotelCode].filter(Boolean) as string[]));

        hotelsToTry.forEach(h => {
            const baseKey = `${targetYear}|${selectedMonth}|${normalizeHotelName(h)}|${targetScenario}|${targetName}`;
            if (crFilter === 'OTHER_EXCEPT_MKT_MAR') {
                // Special: use base key (no CR suffix) so we can do Total - Martech - Marketing
                keysToCheck.add(baseKey);
            } else if (targetCR) {
                keysToCheck.add(`${baseKey}|${targetCR}`);
            } else {
                keysToCheck.add(baseKey);
            }
        });

        let total = 0;
        keysToCheck.forEach(key => {
            if (dataIndex.has(key)) {
                total += dataIndex.get(key) || 0;
            }
        });
        return total;
    };

    const getPreviaOrReal = (accountName: string, targetYear: number | undefined, crFilter?: string) => {
        const r = getImportedValue(accountName, targetYear, 'Real', crFilter);
        const p = getImportedValue(accountName, targetYear, 'Previa', crFilter);
        return r !== 0 ? r : p;
    };

    // Despesas do balancete importadas pro passo 3 do wizard OTB — scenario próprio ('OTB'),
    // sem fallback pra outro scenario (diferente de getPreviaOrReal).
    const getOtbImportedValue = (accountName: string, crFilter?: string) => {
        return getImportedValue(accountName, selectedYear, 'Otb', crFilter);
    };

    // Reunião de Ritmo/FCA N1/FCA N2/Fechamento oficial têm cada um seu próprio snapshot isolado
    // na aba Ocupação (sufixo __versão na chave) — "Realizado" é o único que continua no balde
    // original sem sufixo, então dado já existente nunca some. Isso faz a coluna Prévia da DRE
    // Forecast refletir só a Versão do Forecast que está ativa no momento.
    const usesProjectionSnapshot = activeProjectionType && activeProjectionType !== 'Realizado';
    const getRealOccValue = (rowId: string) => {
        const contextKey = usesProjectionSnapshot
            ? `${selectedHotelName}_${selectedYear}_${selectedMonth}_${activeRealVersionId || ''}__${activeProjectionType}`
            : `${selectedHotelName}_${selectedYear}_${selectedMonth}_${activeRealVersionId || ''}`;
        return realOccupancyData[contextKey]?.[rowId];
    };

    const getLYOccValue = (rowId: string) => {
        if (!selectedYear) return 0;
        const targetYear = selectedYear - 1;
        const contextKey = `${selectedHotelName}_${targetYear}_${selectedMonth}_${activeRealVersionId || ''}`;
        return realOccupancyData[contextKey]?.[rowId];
    };

    // OTB (On the books) — só existe para Reunião de Ritmo/FCA N1/FCA N2, cada versão com seu
    // próprio snapshot isolado (sufixo extra __OTB em cima da chave que já isola cada versão).
    const getOtbOccValue = (rowId: string) => {
        const contextKey = `${selectedHotelName}_${selectedYear}_${selectedMonth}_${activeRealVersionId || ''}__${activeProjectionType}__OTB`;
        return realOccupancyData[contextKey]?.[rowId];
    };

    // 1. INDICATORS

    // Section: GERAIS
    const gAvailReal = getRealOccValue('geral_avail_forecast') ?? 0;
    const gAvailLY = getLYOccValue('geral_avail_forecast') ?? 0;
    
    const gOccReal = getRealOccValue('geral_sold_forecast') ?? 0;
    const gOccLY = getLYOccValue('geral_sold_forecast') ?? 0;
    
    const gPaxReal = getRealOccValue('geral_pax_forecast') ?? 0;
    const gPaxLY = getLYOccValue('geral_pax_forecast') ?? 0;
    
    const gAdultsReal = getRealOccValue('geral_adults_forecast') ?? 0;
    const gAdultsLY = getLYOccValue('geral_adults_forecast') ?? 0;
    
    const gChdReal = getRealOccValue('geral_chd_forecast') ?? 0;
    const gChdLY = getLYOccValue('geral_chd_forecast') ?? 0;
    
    const gAvailPrevia = getRealOccValue('geral_avail_previa') ?? 0;
    const gOccPrevia = getRealOccValue('geral_sold_previa') ?? 0;
    const gPaxPrevia = getRealOccValue('geral_pax_previa') ?? 0;
    const gAdultsPrevia = getRealOccValue('geral_adults_previa') ?? 0;
    const gChdPrevia = getRealOccValue('geral_chd_previa') ?? 0;
    // Direto da aba Ocupação (Versão do Forecast ativa) — não é mais derivado de Adultos/CHD.
    const gDmFapPrevia = getRealOccValue('geral_dm_fap_previa') ?? 0;
    const gCoefAdPrevia = getRealOccValue('geral_coef_ad_previa') ?? 0;
    const gCoefChdPrevia = getRealOccValue('geral_coef_chd_previa') ?? 0;

    // OTB (On the books) — mesmos campos da Prévia, lidos do snapshot isolado da versão ativa.
    const gAvailOtb = getOtbOccValue('geral_avail_previa') ?? 0;
    const gOccOtb = getOtbOccValue('geral_sold_previa') ?? 0;
    const gPaxOtb = getOtbOccValue('geral_pax_previa') ?? 0;
    const gAdultsOtb = getOtbOccValue('geral_adults_previa') ?? 0;
    const gChdOtb = getOtbOccValue('geral_chd_previa') ?? 0;
    const gDmFapOtb = getOtbOccValue('geral_dm_fap_previa') ?? 0;
    const gCoefAdOtb = getOtbOccValue('geral_coef_ad_previa') ?? 0;
    const gCoefChdOtb = getOtbOccValue('geral_coef_chd_previa') ?? 0;
    const gOccPctOtb = gAvailOtb > 0 ? (gOccOtb / gAvailOtb) * 100 : 0;

    // Nas versões de prévia (Reunião de Ritmo/FCA N1/FCA N2), Mão de obra parte do valor da Meta
    // enquanto o usuário não tiver digitado o próprio número na Ocupação — mesmo padrão de default
    // usado em Coef. Occ Adultos/CHD ali (get*Otb acima não entra nessa regra: OTB precisa ser
    // preenchido de verdade, sem herdar a Meta).
    const isMeetingVersionForLabor = RESTRICTED_TABLE_KINDS.includes(resolveMeetingKind(activeProjectionType, safeMeetings) as any);
    const moCltMetaFallback = isMeetingVersionForLabor ? (budgetOccupancyData['geral_mo_clt']?.[selectedMonth ? selectedMonth - 1 : 0] ?? 0) : 0;
    const moExtraMetaFallback = isMeetingVersionForLabor ? (budgetOccupancyData['geral_mo_extra']?.[selectedMonth ? selectedMonth - 1 : 0] ?? 0) : 0;

    const gMoCltReal = getRealOccValue('geral_mo_clt_forecast') ?? moCltMetaFallback;
    const gMoCltPrevia = getRealOccValue('geral_mo_clt_previa') ?? moCltMetaFallback;
    const gMoCltLY = getLYOccValue('geral_mo_clt_forecast') ?? 0;

    const gMoExtraReal = getRealOccValue('geral_mo_extra_forecast') ?? moExtraMetaFallback;
    const gMoExtraPrevia = getRealOccValue('geral_mo_extra_previa') ?? moExtraMetaFallback;
    const gMoExtraLY = getLYOccValue('geral_mo_extra_forecast') ?? 0;

    // Total is always derived from CLT + Extra, never read from a stored field — this
    // stays correct even for budget versions saved before this Total row existed.
    const gMoTotalReal = gMoCltReal + gMoExtraReal;
    const gMoTotalPrevia = gMoCltPrevia + gMoExtraPrevia;
    const gMoTotalLY = gMoCltLY + gMoExtraLY;

    // OTB (On the books) — Mão de obra parte da Meta igual Real/Prévia acima (diferente dos
    // demais indicadores OTB, que exigem preenchimento de verdade).
    const gMoCltOtb = getOtbOccValue('geral_mo_clt_previa') ?? moCltMetaFallback;
    const gMoExtraOtb = getOtbOccValue('geral_mo_extra_previa') ?? moExtraMetaFallback;
    const gMoTotalOtb = gMoCltOtb + gMoExtraOtb;

    // Retrieve budget values from budgetOccupancyData based on the selectedMonth (0-indexed)
    const monthIdx = selectedMonth ? selectedMonth - 1 : 0;
    const gDaysBudget = budgetOccupancyData['days_month'] ? budgetOccupancyData['days_month'][monthIdx] : 0;
    const gAvailBudget = budgetOccupancyData['geral_avail'] ? budgetOccupancyData['geral_avail'][monthIdx] : 0;
    const gOccBudget = budgetOccupancyData['geral_sold'] ? budgetOccupancyData['geral_sold'][monthIdx] : 0;
    const gOccPctBudget = gAvailBudget > 0 ? (gOccBudget / gAvailBudget) * 100 : 0;
    // Get Budget Revenue values to compute Budget DM & RevPAR (Approximation or zeros if missing)
    const gPaxBudget = budgetOccupancyData['geral_pax'] ? budgetOccupancyData['geral_pax'][monthIdx] : 0;
    const gAdultsBudget = budgetOccupancyData['geral_adults'] ? budgetOccupancyData['geral_adults'][monthIdx] : 0;
    const gChdBudget = budgetOccupancyData['geral_chd'] ? budgetOccupancyData['geral_chd'][monthIdx] : 0;
    const gMoCltBudget = budgetOccupancyData['geral_mo_clt'] ? budgetOccupancyData['geral_mo_clt'][monthIdx] : 0;
    const gMoExtraBudget = budgetOccupancyData['geral_mo_extra'] ? budgetOccupancyData['geral_mo_extra'][monthIdx] : 0;
    const gMoTotalBudget = gMoCltBudget + gMoExtraBudget;

    // DM and Revpar Budget calculation based on imported budget vs occupancy, or from budgetOccupancyData if there were a field.
    // We'll calculate it from imported if possible, otherwise 0 or basic calc.
    const revLazerBudget = getImportedValue('Lazer', selectedYear, 'Budget');
    const revEventosBudget = getImportedValue('Eventos', selectedYear, 'Budget');
    const revAptBudget = revLazerBudget + revEventosBudget;

    const revExtraLazerBudget = getImportedValue('Extra Lazer', selectedYear, 'Budget');
    const revExtraEventosBudget = getImportedValue('Extra Eventos', selectedYear, 'Budget');
    const revExtraTotalBudget = revExtraLazerBudget + revExtraEventosBudget;

    const dmBudget = gOccBudget > 0 ? revAptBudget / gOccBudget : 0;
    const revparBudget = gAvailBudget > 0 ? revAptBudget / gAvailBudget : 0;
    const trevporBudget = gOccBudget > 0 ? (revAptBudget + revExtraTotalBudget) / gOccBudget : 0;
    const trevparBudget = gAvailBudget > 0 ? (revAptBudget + revExtraTotalBudget) / gAvailBudget : 0;

    const dmReal = getRealOccValue('geral_dm_fap_forecast') ?? 0;
    const dmLY = getLYOccValue('geral_dm_fap_forecast') ?? 0;
    
    const revparReal = getRealOccValue('geral_revpar_forecast') ?? 0;
    const revparLY = getLYOccValue('geral_revpar_forecast') ?? 0;
    
    const trevporReal = getRealOccValue('geral_trevpor_forecast') ?? 0;
    const trevporLY = getLYOccValue('geral_trevpor_forecast') ?? 0;
    
    const trevparReal = getRealOccValue('geral_trevpar_forecast') ?? 0;
    const trevparLY = getLYOccValue('geral_trevpar_forecast') ?? 0;

    const rowIndDays = generateRow('IND-DAYS', '', 'Indicators', 'Dias do mês', gDaysBudget, gDaysBudget, gDaysBudget, gDaysBudget, false, false, 0, undefined, { format: 'integer' }, 'INDICADORES GERAIS');
    rowIndDays.otb = gDaysBudget;
    rows.push(rowIndDays);
    const rowInd1 = generateRow('IND-1', '', 'Indicators', 'UH Disponível', gAvailBudget, gAvailReal, gAvailLY, gAvailPrevia, false, false, 0, undefined, { format: 'integer' }, 'INDICADORES GERAIS');
    rowInd1.otb = gAvailOtb;
    rows.push(rowInd1);
    const rowInd2 = generateRow('IND-2', '', 'Indicators', 'UH Ocupada', gOccBudget, gOccReal, gOccLY, gOccPrevia, false, false, 0, undefined, { format: 'integer' }, 'INDICADORES GERAIS');
    rowInd2.otb = gOccOtb;
    rows.push(rowInd2);
    const rowInd3 = generateRow('IND-3', '', 'Indicators', '% de Ocupação', gOccPctBudget, gAvailReal > 0 ? (gOccReal / gAvailReal) * 100 : 0, gAvailLY > 0 ? (gOccLY / gAvailLY) * 100 : 0, gAvailPrevia > 0 ? (gOccPrevia / gAvailPrevia) * 100 : 0, false, false, 0, undefined, { format: 'percent' }, 'INDICADORES GERAIS');
    rowInd3.otb = gOccPctOtb;
    rows.push(rowInd3);
    const rowInd4 = generateRow('IND-4', '', 'Indicators', 'DM Bruta', dmBudget, dmReal, dmLY, gDmFapPrevia, false, false, 0, undefined, { format: 'currency' }, 'INDICADORES GERAIS');
    rowInd4.otb = gDmFapOtb;
    rows.push(rowInd4);
    const rowInd5 = generateRow('IND-5', '', 'Indicators', 'PAX', gPaxBudget, gPaxReal, gPaxLY, gPaxPrevia, false, false, 0, undefined, { format: 'integer' }, 'INDICADORES GERAIS');
    rowInd5.otb = gPaxOtb;
    rows.push(rowInd5);
    const rowIndAdultos = generateRow('IND-ADULTOS', '', 'Indicators', 'Adultos', gAdultsBudget, gAdultsReal, gAdultsLY, gAdultsPrevia, false, false, 0, undefined, { format: 'integer' }, 'INDICADORES GERAIS');
    rowIndAdultos.otb = gAdultsOtb;
    rows.push(rowIndAdultos);
    const rowIndChd = generateRow('IND-CHD', '', 'Indicators', 'CHD', gChdBudget, gChdReal, gChdLY, gChdPrevia, false, false, 0, undefined, { format: 'integer' }, 'INDICADORES GERAIS');
    rowIndChd.otb = gChdOtb;
    rows.push(rowIndChd);
    const rowIndCoefAd = generateRow('IND-COEF-ADULTOS', '', 'Indicators', 'Coef. Adultos', gOccBudget > 0 ? gAdultsBudget / gOccBudget : 0, gOccReal > 0 ? gAdultsReal / gOccReal : 0, gOccLY > 0 ? gAdultsLY / gOccLY : 0, gCoefAdPrevia, false, false, 0, undefined, { format: 'decimal' }, 'INDICADORES GERAIS');
    rowIndCoefAd.otb = gCoefAdOtb;
    rows.push(rowIndCoefAd);
    const rowIndCoefChd = generateRow('IND-COEF-CHD', '', 'Indicators', 'Coef. CHD', gOccBudget > 0 ? gChdBudget / gOccBudget : 0, gOccReal > 0 ? gChdReal / gOccReal : 0, gOccLY > 0 ? gChdLY / gOccLY : 0, gCoefChdPrevia, false, false, 0, undefined, { format: 'decimal' }, 'INDICADORES GERAIS');
    rowIndCoefChd.otb = gCoefChdOtb;
    rows.push(rowIndCoefChd);
    rows.push(generateRow('IND-6', '', 'Indicators', 'REVPAR', revparBudget, revparReal, revparLY, 0, false, false, 0, undefined, { format: 'currency' }, 'INDICADORES GERAIS'));
    rows.push(generateRow('IND-TREVPOR', '', 'Indicators', 'TREVPOR', trevporBudget, trevporReal, trevporLY, 0, false, false, 0, undefined, { format: 'currency' }, 'INDICADORES GERAIS'));
    rows.push(generateRow('IND-TREVPAR', '', 'Indicators', 'TREVPAR', trevparBudget, trevparReal, trevparLY, 0, false, false, 0, undefined, { format: 'currency' }, 'INDICADORES GERAIS'));

    rows.push(generateRow('SPACER-IND-REV', '', 'Spacer', '', 0, 0, 0, 0, false, false, 0));

    // 1.5 MÃO DE OBRA (pulls straight from the Ocupação tab, read-only here)
    const rowLaborTotal = generateRow('LABOR-TOTAL', '', 'Labor', 'Mão de obra (Total)', gMoTotalBudget, gMoTotalReal, gMoTotalLY, gMoTotalPrevia, true, true, 0, undefined, { format: 'integer' });
    rowLaborTotal.otb = gMoTotalOtb;
    rows.push(rowLaborTotal);
    const rowLaborClt = generateRow('LABOR-CLT', '', 'Labor', 'Mão de obra (CLT)', gMoCltBudget, gMoCltReal, gMoCltLY, gMoCltPrevia, false, false, 1, undefined, { format: 'integer' });
    rowLaborClt.otb = gMoCltOtb;
    rows.push(rowLaborClt);
    const rowLaborExtra = generateRow('LABOR-EXTRA', '', 'Labor', 'Mão de obra (Extra)', gMoExtraBudget, gMoExtraReal, gMoExtraLY, gMoExtraPrevia, false, false, 1, undefined, { format: 'integer' });
    rowLaborExtra.otb = gMoExtraOtb;
    rows.push(rowLaborExtra);

    rows.push(generateRow('SPACER-LABOR-REV', '', 'Spacer', '', 0, 0, 0, 0, false, false, 0));

    // 2. REVENUE

    // 1.00 RECEITA BRUTA TOTAL
    rows.push(generateRow('REV-TOTAL', '1.00', 'Revenue', 'RECEITA BRUTA TOTAL', 0, 0, 0, 0, true, true, 0));

    // 1.01 Receita de Apartamentos
    rows.push(generateRow('REV-APT', '1.01', 'Revenue', 'Receita de Apartamentos', 0, 0, 0, 0, true, false, 1));

    const revAptItems = [
        { id: 'REV-APT-LAZER', code: '1.01.01', label: 'Lazer', sourceId: 'lazer_rev_fap' },
        { id: 'REV-APT-EVENTOS', code: '1.01.02', label: 'Eventos', sourceId: 'event_rev_fap' },
        { id: 'REV-APT-OR', code: '1.01.03', label: 'OR de hospedagem', sourceId: 'geral_or_hosp' }
    ];

    // Soma acumulada pro denominador do KPI de Receita de ISS (Receita de ISS ÷ demais receitas)
    // montado mais abaixo — precisa ser as receitas "brutas" (Apartamentos + Extras + Time Share),
    // por isso é somado aqui em vez de lido de REV-APT/REV-EXTRA (que só ganham o total de verdade
    // dentro de recalculateTotals, chamado bem depois de getDynamicForecastData terminar).
    const revAptSum = { previa: 0, real: 0, budget: 0, otb: 0 };

    revAptItems.forEach(item => {
        const valBudget = budgetOccupancyData[item.sourceId] ? budgetOccupancyData[item.sourceId][monthIdx] : 0;
        const valReal = getRealOccValue(`${item.sourceId}_forecast`) || 0;
        const valPrevia = getRealOccValue(`${item.sourceId}_previa`) || 0;

        let valLY = getLYOccValue(`${item.sourceId}_forecast`) || 0;

        const rowAptItem = generateRow(item.id, item.code, 'Revenue', item.label, valBudget, valReal, valLY, valPrevia, false, false, 2);
        rowAptItem.otb = getOtbOccValue(`${item.sourceId}_previa`) || 0;
        rows.push(rowAptItem);

        revAptSum.previa += valPrevia;
        revAptSum.real += valReal;
        revAptSum.budget += valBudget;
        revAptSum.otb += rowAptItem.otb || 0;
    });

    // 1.02 Receitas Extras
    const revExtraItems = [
        { id: 'REV-EXTRA-LAZER', code: '1.02.01', label: 'Lazer', sourceId: 'lazer_extra_rev', paxSourceId: 'lazer_pax' },
        { id: 'REV-EXTRA-EVENTOS', code: '1.02.02', label: 'Eventos', sourceId: 'event_extra_rev', paxSourceId: 'event_pax' },
        { id: 'REV-EXTRA-OR', code: '1.02.03', label: 'OR Extras', sourceId: 'geral_or_extras' }
    ];

    // KPI for Lazer/Eventos = Receita ÷ PAX do segmento. Precomputed directly (instead of via the
    // @[Label] formula engine) because "Lazer"/"Eventos" labels collide with Receita de
    // Apartamentos' own Lazer/Eventos rows, which would make a label lookup ambiguous.
    const revExtraKpiSum = { previa: 0, real: 0, budget: 0, otb: 0 };

    const revExtraItemRows = revExtraItems.map(item => {
        const valBudget = budgetOccupancyData[item.sourceId] ? budgetOccupancyData[item.sourceId][monthIdx] : 0;
        const valReal = getRealOccValue(`${item.sourceId}_forecast`) || 0;
        const valPrevia = getRealOccValue(`${item.sourceId}_previa`) || 0;
        const valOtb = getOtbOccValue(`${item.sourceId}_previa`) || 0;

        let valLY = getLYOccValue(`${item.sourceId}_forecast`) || 0;

        let precomputedKpi: { previa: number; real: number; budget: number; otb: number; format: 'decimal'; denominator: { previa: number; real: number; budget: number; otb: number } } | undefined;
        if (item.paxSourceId) {
            const paxBudget = budgetOccupancyData[item.paxSourceId] ? budgetOccupancyData[item.paxSourceId][monthIdx] : 0;
            const paxReal = getRealOccValue(`${item.paxSourceId}_forecast`) || 0;
            const paxPrevia = getRealOccValue(`${item.paxSourceId}_previa`) || 0;
            const paxOtb = getOtbOccValue(`${item.paxSourceId}_previa`) || 0;

            precomputedKpi = {
                previa: paxPrevia > 0 ? valPrevia / paxPrevia : 0,
                real: paxReal > 0 ? valReal / paxReal : 0,
                budget: paxBudget > 0 ? valBudget / paxBudget : 0,
                otb: paxOtb > 0 ? valOtb / paxOtb : 0,
                format: 'decimal',
                denominator: { previa: paxPrevia, real: paxReal, budget: paxBudget, otb: paxOtb }
            };

            revExtraKpiSum.previa += precomputedKpi.previa;
            revExtraKpiSum.real += precomputedKpi.real;
            revExtraKpiSum.budget += precomputedKpi.budget;
            revExtraKpiSum.otb += precomputedKpi.otb;
        }

        const rowExtraItem = generateRow(item.id, item.code, 'Revenue', item.label, valBudget, valReal, valLY, valPrevia, false, false, 2, undefined, precomputedKpi ? { precomputedKpi } : undefined);
        rowExtraItem.otb = valOtb;
        return rowExtraItem;
    });

    rows.push(generateRow('REV-EXTRA', '1.02', 'Revenue', 'Receitas Extras', 0, 0, 0, 0, true, false, 1, undefined, { precomputedKpi: { ...revExtraKpiSum, format: 'decimal' } }));
    rows.push(...revExtraItemRows);

    // Soma das Receitas Extras pro mesmo denominador do KPI de Receita de ISS (ver revAptSum acima).
    const revExtraSum = revExtraItemRows.reduce((acc, r) => ({
        previa: acc.previa + (r.previa || 0),
        real: acc.real + (r.real || 0),
        budget: acc.budget + (r.budget || 0),
        otb: acc.otb + (r.otb || 0)
    }), { previa: 0, real: 0, budget: 0, otb: 0 });

    // 1.03 Cancelamento de Time Share
    const valBudgetTS = budgetOccupancyData['geral_cancel_ts'] ? budgetOccupancyData['geral_cancel_ts'][monthIdx] : 0;
    const valRealTS = getRealOccValue('geral_cancel_ts_forecast') || 0;
    const valPreviaTS = getRealOccValue('geral_cancel_ts_previa') || 0;
    const valLYTS = getLYOccValue('geral_cancel_ts_forecast') || 0;
    const revTimeRow = generateRow('REV-TIME', '1.03', 'Revenue', 'CANCELAMENTO DE TIME SHARE', valBudgetTS, valRealTS, valLYTS, valPreviaTS, true, false, 1);
    // "Outras Receitas Hoteleiras" (3.01.03.01) do balancete importado (passo 3 do wizard OTB)
    // alimenta esta linha direto na coluna OTB — sem esse import, fica sem valor mesmo.
    revTimeRow.otb = getOtbOccValue('__balancete_time_share');
    rows.push(revTimeRow);

    // 1.04 Receita de ISS
    const valBudgetISS = budgetOccupancyData['geral_iss_rev'] ? budgetOccupancyData['geral_iss_rev'][monthIdx] : 0;
    const valRealISS = getRealOccValue('geral_iss_rev_forecast') || 0;
    const valPreviaISS = getRealOccValue('geral_iss_rev_previa') || 0;
    const valLYISS = getLYOccValue('geral_iss_rev_forecast') || 0;
    // "Receitas de ISS" (3.01.01.02.008) do balancete importado alimenta a coluna OTB — mesmo
    // padrão de Imposto/Time Share acima. Precisa vir antes do KPI abaixo (o denominador do OTB
    // usa o OTB de Apartamentos/Extras/Time Share, e o numerador usa esse valor de ISS no OTB).
    const balanceteIss = getOtbOccValue('__balancete_iss');
    // KPI = Receita de ISS ÷ demais receitas (Apartamentos + Extras + Time Share) — mesmo padrão
    // precomputado de Receita Extra Lazer/Eventos acima, editável tanto na Meta quanto na Prévia
    // (handleKpiValueChange em ForecastTable.tsx já cobre isso genericamente via
    // precomputedKpi.denominator, sem precisar de nada específico pra Receita de ISS).
    const otherRevPrevia = revAptSum.previa + revExtraSum.previa + valPreviaTS;
    const otherRevReal = revAptSum.real + revExtraSum.real + valRealTS;
    const otherRevBudget = revAptSum.budget + revExtraSum.budget + valBudgetTS;
    const otherRevOtb = revAptSum.otb + revExtraSum.otb + (revTimeRow.otb || 0);
    const issPrecomputedKpi = {
        previa: otherRevPrevia > 0 ? valPreviaISS / otherRevPrevia : 0,
        real: otherRevReal > 0 ? valRealISS / otherRevReal : 0,
        budget: otherRevBudget > 0 ? valBudgetISS / otherRevBudget : 0,
        otb: otherRevOtb > 0 ? (balanceteIss || 0) / otherRevOtb : 0,
        format: 'percent' as const,
        denominator: { previa: otherRevPrevia, real: otherRevReal, budget: otherRevBudget, otb: otherRevOtb }
    };
    const revIssRow = generateRow('REV-ISS', '1.04', 'Revenue', 'RECEITA DE ISS', valBudgetISS, valRealISS, valLYISS, valPreviaISS, true, false, 1, undefined, { precomputedKpi: issPrecomputedKpi });
    if (balanceteIss !== undefined) revIssRow.otb = balanceteIss;
    rows.push(revIssRow);

    rows.push(generateRow('SPACER-BEFORE-IMP', '', 'Spacer', '', 0, 0, 0, 0, false, false, 0));

    // 1.05 Impostos (Azul conforme Receita Líquida, recuo zero)
    // Duas fontes possíveis: aba Ocupação (tabela Geral, linha "IMPOSTOS", `geral_impostos_*`,
    // digitada manualmente) OU a importação dedicada de Impostos em Administração
    // (financial_data, conta 'Impostos', handleSaveTaxes em UnifiedAdministrationView.tsx) — até
    // 2026-08-12 essa segunda fonte era gravada mas NUNCA lida aqui (código morto). Agora tem
    // prioridade quando tiver valor (é o fechamento oficial/Meta importado), com fallback pra
    // Ocupação pra não quebrar hotéis que já preenchem só por lá.
    const valBudgetImp = getImportedValue('Impostos', selectedYear, 'Budget') || (budgetOccupancyData['geral_impostos'] ? budgetOccupancyData['geral_impostos'][monthIdx] : 0);
    const valRealImp = getImportedValue('Impostos', selectedYear, 'Forecast') || getRealOccValue('geral_impostos_forecast') || 0;
    const valPreviaImp = getPreviaOrReal('Impostos', selectedYear) || getRealOccValue('geral_impostos_previa') || 0;
    const valLYImp = getImportedValue('Impostos', (selectedYear || 0) - 1, 'Real') || getLYOccValue('geral_impostos_forecast') || 0;
    const revImpRow = generateRow('REV-IMP', '1.05', 'Revenue', 'IMPOSTOS', valBudgetImp, valRealImp, valLYImp, valPreviaImp, true, true, 0, undefined, {
        // % de imposto sobre a receita = Imposto / Receita Bruta Total — auto-calculado na
        // Prévia a partir do % da Meta (ver recalculateTotals em ForecastTable.tsx), mas
        // editável diretamente na célula de KPI (mesmo mecanismo das contas Variável).
        kpiCalculation: { formula: '@[IMPOSTOS] / @[RECEITA BRUTA TOTAL]', format: 'percent' },
        format: 'currency'
    });
    // "Imposto" (3.01.04.02) do balancete importado alimenta a coluna OTB direto — sem esse
    // import, o bloco de recalculateTotals em ForecastTable.tsx cai pra uma estimativa (% da Meta).
    const balanceteImposto = getOtbOccValue('__balancete_imposto');
    if (balanceteImposto !== undefined) revImpRow.otb = balanceteImposto;
    rows.push(revImpRow);

    rows.push(generateRow('SPACER-AFTER-IMP', '', 'Spacer', '', 0, 0, 0, 0, false, false, 0));

    // 3.00 Receita Líquida
    rows.push(generateRow('REV-NET', '3.00', 'Revenue', 'RECEITA LÍQUIDA', 0, 0, 0, 0, true, true, 0));

    rows.push(generateRow('SPACER-REV-CST', '', 'Spacer', '', 0, 0, 0, 0, false, false, 0));

    // 3. COSTS & EXPENSES (Hierarchical Breakdown)
    rows.push(generateRow('CST-HEAD', '3.00', 'Costs', 'CUSTOS E DESPESAS OPERACIONAIS', 0, 0, 0, 0, true, true, 0));

    // Get unique Package identifiers (Master + Package name) for Expense accounts
    const expenseAccounts = activeAccounts.filter(a => {
        const m = (a.masterPackage || '').toUpperCase();
        if (m === 'RECEITAS' || m === 'DEDUCOES DA RECEITA BRUTA' || m === 'IMPOSTOS' || m.includes('RESULTADO')) return false;
        if (a.classification === 'Revenue' || a.classification === 'Tax' || a.classification === 'Indicator' || a.classification === 'GOP') return false;
        return true;
    });

    // Create unique keys for each Package to avoid name collisions across Masters
    const packageKeys = Array.from(new Set(expenseAccounts.map(a => `${a.masterPackage || ''}|${a.package || ''}`))).filter(k => k.split('|')[1]);

    const getMinOrder = (accs: Account[]) => Math.min(...accs.map(a => a.sortOrder || 999));

    // Sort all packages by the minimum sortOrder of their accounts
    const sortedPackageKeys = packageKeys.sort((a, b) => {
        const [masterA, pkgA] = a.split('|');
        const [masterB, pkgB] = b.split('|');
        const orderA = getMinOrder(expenseAccounts.filter(acc => acc.masterPackage === masterA && acc.package === pkgA));
        const orderB = getMinOrder(expenseAccounts.filter(acc => acc.masterPackage === masterB && acc.package === pkgB));
        return orderA - orderB || a.localeCompare(b);
    });

    sortedPackageKeys.forEach(key => {
        const [masterName, pkgName] = key.split('|');
        const pkgAccs = expenseAccounts.filter(a => (a.masterPackage || '').toLowerCase() === (masterName || '').toLowerCase() && (a.package || '').toLowerCase() === (pkgName || '').toLowerCase()).map(a => ({
            ...a,
            expenseType: a.expenseType || defaultAccountConfigs[a.name]?.expenseType,
            kpiCalculation: a.kpiCalculation
        }));
        const pkgCode = pkgAccs[0]?.packageCode || '';

        // Check for special drill-down cases
        const isAdminTI = masterName === 'DESPESAS ADMINISTRATIVAS' && pkgName === 'Despesas Administrativas';
        const isSalesMkt = masterName === 'DESPESAS COM VENDAS E MARKETING' && pkgName === 'Despesas com Vendas e Marketing';
        const isServicosTerceiros = pkgName.toUpperCase() === 'SERVIÇOS DE TERCEIROS' || pkgName.toUpperCase() === 'SERVIÇO DE TERCEIROS';
        const isProvisoes = pkgName.toUpperCase() === 'PROVISÕES GERAIS' || pkgName.toUpperCase() === 'PROVISOES GERAIS';


        // STANDARD PACKAGE - Aggregate values directly
        let pkgBudget = 0;
        let pkgPrevia = 0;
        let pkgReal = 0;
        let pkgLY = 0;
        let pkgOtb = 0;

        pkgAccs.forEach(acc => {
            pkgBudget += getImportedValue(acc.name, selectedYear, 'Budget');
            pkgPrevia += getPreviaOrReal(acc.name, selectedYear);
            pkgReal += getImportedValue(acc.name, selectedYear, 'Forecast');
            pkgLY += getImportedValue(acc.name, (selectedYear || 0) - 1, 'Real');
            pkgOtb += getOtbImportedValue(acc.name);
        });

        const pkgRow = generateRow(`p-${masterName}-${pkgName}`, pkgCode, 'Package', pkgName, pkgBudget, pkgReal, pkgLY, pkgPrevia, true, false, 1);
        // O balancete pode trazer um lançamento direto no nível do Pacote (casado pelo código do
        // pacote, não de uma conta individual) — quando existe, ele MANDA sozinho, nunca soma com
        // as contas de baixo (senão contaria a mesma despesa duas vezes).
        const pkgDirectOtb = getOtbImportedValue(pkgName);
        pkgRow.otb = pkgDirectOtb || pkgOtb;
        rows.push(pkgRow);

        // Add individual accounts
        pkgAccs.forEach(acc => {
            const accBudget = getImportedValue(acc.name, selectedYear, 'Budget');
            const accPrevia = getPreviaOrReal(acc.name, selectedYear);
            const accReal = getImportedValue(acc.name, selectedYear, 'Forecast');
            const accLY = getImportedValue(acc.name, (selectedYear || 0) - 1, 'Real');
            const accOtb = getOtbImportedValue(acc.name);

            const accRow = generateRow(
                acc.id || `acc-${masterName}-${pkgName}-${normalizeAccountName(acc.name)}`,
                acc.code || '',
                'Account',
                acc.name,
                accBudget, accReal, accLY, accPrevia,
                false,
                false,
                2,
                undefined,
                {
                    method: acc.expenseType === 'Variável' ? 'Variable' : 'Fixed',
                    type: acc.expenseType,
                    kpiCalculation: acc.kpiCalculation
                }
            );
            accRow.otb = accOtb;
            rows.push(accRow);
        });
    });

    // 4. RESULTS
    rows.push(generateRow('SPACER-RES', '', 'Spacer', '', 0, 0, 0, 0, false, false, 0));
    rows.push(generateRow('RES-OP-COM-IMP', '6.00.00', 'Result', 'GOP COM DEDUÇÃO DE IMPOSTOS (R$)', 0, 0, 0, 0, true, true, 0));
    rows.push(generateRow('RES-OP-COM-IMP-PCT', '', 'Result', 'GOP COM DEDUÇÃO DE IMPOSTOS (%)', 0, 0, 0, 0, true, true, 0, undefined, { inputType: 'none', format: 'percent' }));
    rows.push(generateRow('SPACER-RES-GOP', '', 'Spacer', '', 0, 0, 0, 0, false, false, 0));
    rows.push(generateRow('RES-OP-SEM-IMP', '6.01.00', 'Result', 'GOP SEM DEDUÇÃO DE IMPOSTOS (R$)', 0, 0, 0, 0, true, true, 0));
    rows.push(generateRow('RES-OP-SEM-IMP-PCT', '', 'Result', 'GOP SEM DEDUÇÃO DE IMPOSTOS (%)', 0, 0, 0, 0, true, true, 0, undefined, { inputType: 'none', format: 'percent' }));

    // KPI: Transformação / Reatividade — these 6 rows only hold the computed numeric value
    // (see recalculateTotals in ForecastTable.tsx); they're never shown as table rows, only
    // as the 6 cards rendered below the DRE Forecast table (3 using GOP com dedução de
    // impostos, 3 using GOP sem dedução de impostos).
    rows.push(generateRow('KPI-TRANS-BUDGET', '', 'Result', 'Transformação/Reatividade (R x M) - GOP c/ Imp.', 0, 0, 0, 0, true, true, 0));
    rows.push(generateRow('KPI-TRANS-LY', '', 'Result', 'Transformação/Reatividade (R x R Ant.) - GOP c/ Imp.', 0, 0, 0, 0, true, true, 0));
    rows.push(generateRow('KPI-TRANS-M-LY', '', 'Result', 'Transformação/Reatividade (M x R Ant.) - GOP c/ Imp.', 0, 0, 0, 0, true, true, 0));
    rows.push(generateRow('KPI-TRANS-BUDGET-SEM', '', 'Result', 'Transformação/Reatividade (R x M) - GOP s/ Imp.', 0, 0, 0, 0, true, true, 0));
    rows.push(generateRow('KPI-TRANS-LY-SEM', '', 'Result', 'Transformação/Reatividade (R x R Ant.) - GOP s/ Imp.', 0, 0, 0, 0, true, true, 0));
    rows.push(generateRow('KPI-TRANS-M-LY-SEM', '', 'Result', 'Transformação/Reatividade (M x R Ant.) - GOP s/ Imp.', 0, 0, 0, 0, true, true, 0));

    const applyOverrides = () => {
        const activeHotelCodeUpper = normalizeHotelName(activeHotelCode);
        const selHotelNameUpper = normalizeHotelName(selectedHotelName || '');

        // Validated Forecast snapshots (override_<rowId> rows) get their own index, scoped by
        // Versão do Forecast (activeProjectionType) — kept separate from dataIndex/getImportedValue's
        // key space so tagging overrides by meeting type can never affect normal Real/Budget/Previa
        // import matching.
        const overrideIndex = new Map<string, number>();
        if (selectedMonth && selectedYear) {
            importedData.forEach(row => {
                if (row.status !== 'valid') return;
                const conta = (row.conta || '').trim().toLowerCase();
                if (!conta.startsWith('override_')) return;

                const rYear = parseInt(row.ano);
                const rMonth = parseInt(row.mes);
                if (rMonth !== selectedMonth || rYear !== selectedYear) return;

                if ((row.projectionType || '') !== (activeProjectionType || '')) return;

                const scen = (row.cenario || '').trim().toLowerCase();
                let normScenario = '';
                if (scen === 'real' || scen === 'realizado') normScenario = 'REAL';
                else if (scen === 'previa' || scen === 'prévia') normScenario = 'PREVIA';
                else if (scen === 'meta' || scen === 'budget') normScenario = 'BUDGET';
                else return;

                const val = parseFloat((row.valor || '').replace(',', '.'));
                if (isNaN(val)) return;

                const normHotel = normalizeHotelName(row.hotel);
                overrideIndex.set(`${normHotel}|${normScenario}|${conta}`, val);
            });
        }

        rows.forEach(r => {
            const targetName = `override_${r.id}`.toLowerCase();

            const tryOverride = (scenarioKey: string) => {
                for (const h of [selHotelNameUpper, activeHotelCodeUpper].filter(Boolean)) {
                    const key = `${h}|${scenarioKey}|${targetName}`;
                    if (overrideIndex.has(key)) {
                        return overrideIndex.get(key);
                    }
                }
                return undefined;
            };

            const realOverride = tryOverride('REAL');
            if (realOverride !== undefined) {
                r.real = realOverride;
                r.isManualOverride = true;
                if (r.forecastConfig) r.forecastConfig.manualValue = realOverride;
            }

            const previaOverride = tryOverride('PREVIA');
            if (previaOverride !== undefined) {
                r.previa = previaOverride;
                r.isManualPreviaOverride = true;
                if (r.previaConfig) r.previaConfig.manualValue = previaOverride;
            }

            // KPI (Meta) editável — "Salvar Projeção" já grava esse override (scenario 'Meta')
            // há tempos, mas nunca era lido de volta aqui (só REAL/PREVIA eram aplicados) — o
            // valor editado "sumia" no próximo carregamento. Mesmo padrão dos dois de cima.
            const budgetOverride = tryOverride('BUDGET');
            if (budgetOverride !== undefined) {
                r.budget = budgetOverride;
                r.isManualBudgetOverride = true;
            }
        });
    };
    applyOverrides();

    return rows;
};

export const getDynamicForecastData = (
    structure: DreSection[],
    selectedMonth?: number,
    selectedYear?: number,
    importedData: ImportedRow[] = [],
    selectedHotelName?: string,
    currentHotels: Hotel[] = mockHotels,
    realOccupancyData: Record<string, Record<string, number>> = {},
    activeRealVersionId?: string,
    activeBudgetVersionId?: string,
    currentAccounts: Account[] = mockAccounts,
    currentPackages: CostPackage[] = mockPackages,
    budgetOccupancyData: Record<string, number[]> = {}
): ForecastRow[] => {
    // Merge factory configs as a fallback only — the account's own Plano de Contas
    // registration (expenseType/expenseDriver) always takes precedence.
    const activeAccounts = currentAccounts.map(acc => {
        const factoryConfig = defaultAccountConfigs[acc.name];
        if (factoryConfig) {
            return {
                ...acc,
                expenseType: acc.expenseType || factoryConfig.expenseType,
                expenseDriver: acc.expenseDriver || factoryConfig.expenseDriver
            };
        }
        return acc;
    });

    const rows: ForecastRow[] = [];

    // --- REUSE INDEXING LOGIC FROM getForecastData (Internal implementation) ---
    const dataIndex = new Map<string, number>();
    if (selectedMonth && selectedYear && importedData.length > 0) {
        importedData.forEach(row => {
            if (row.status !== 'valid') return;
            const rYear = parseInt(row.ano);
            const rMonth = parseInt(row.mes);
            if (rMonth !== selectedMonth) return;
            if (rYear !== selectedYear && rYear !== (selectedYear - 1)) return;
            const scen = (row.cenario || '').trim().toLowerCase();
            let normScenario = '';
            if (scen === 'real' || scen === 'realizado') normScenario = 'REAL';
            else if (scen === 'budget' || scen === 'meta' || scen === 'orcamento' || scen === 'orçamento') normScenario = 'BUDGET';
            else if (scen === 'previa' || scen === 'prévia' || scen === 'flash') normScenario = 'PREVIA';
            else if (scen === 'forecast' || scen === 'projeção') normScenario = 'FORECAST';
            else if (scen === 'otb') normScenario = 'OTB';
            else return;
            const isCurrentYear = (rYear === selectedYear);
            if (row.versionId && isCurrentYear) {
                if (normScenario === 'FORECAST') {
                    // DRE Forecast imports: versionId must match the active Real version only
                    const matchesReal = activeRealVersionId && row.versionId === activeRealVersionId;
                    if (activeRealVersionId && !matchesReal) return;
                } else {
                    const matchesBudget = activeBudgetVersionId && row.versionId === activeBudgetVersionId;
                    const matchesReal = activeRealVersionId && row.versionId === activeRealVersionId;
                    // If the page has active versions selected, only accept rows that match one of them
                    if (activeBudgetVersionId || activeRealVersionId) {
                        if (!matchesBudget && !matchesReal) return;
                    }
                }
            }
            const normHotel = normalizeHotelName(row.hotel);
            const val = parseFloat(row.valor.replace(',', '.'));
            if (isNaN(val)) return;
            const normConta = normalizeAccountName(row.conta);
            const normCR = (row.cr || '').trim().toLowerCase();
            const keyConta = `${rYear}|${rMonth}|${normHotel}|${normScenario}|${normConta}`;
            dataIndex.set(keyConta, (dataIndex.get(keyConta) || 0) + val);
            if (normCR) {
                const keyContaCR = `${rYear}|${rMonth}|${normHotel}|${normScenario}|${normConta}|${normCR}`;
                dataIndex.set(keyContaCR, (dataIndex.get(keyContaCR) || 0) + val);
            }
        });
    }

    const activeHotel = currentHotels.find(h => h.name === selectedHotelName);
    const activeHotelCode = activeHotel ? activeHotel.code : '';

    const getImportedValue = (accountName: string, targetYear: number | undefined, valueCategory: 'Real' | 'Budget' | 'Previa' | 'Forecast', crFilter?: string) => {
        if (!selectedMonth || !targetYear) return 0;
        const targetName = normalizeAccountName(accountName);
        const targetCR = crFilter?.trim().toLowerCase();
        let targetScenario = '';
        if (valueCategory === 'Real') targetScenario = 'REAL';
        else if (valueCategory === 'Budget') targetScenario = 'BUDGET';
        else if (valueCategory === 'Previa') targetScenario = 'PREVIA';
        else targetScenario = 'FORECAST';
        const hotelsToTry = Array.from(new Set([selectedHotelName, activeHotelCode].filter(Boolean) as string[]));
        let total = 0;
        hotelsToTry.forEach(h => {
            const baseKey = `${targetYear}|${selectedMonth}|${normalizeHotelName(h)}|${targetScenario}|${targetName}`;
            if (targetCR) {
                total += dataIndex.get(`${baseKey}|${targetCR}`) || 0;
            } else {
                total += dataIndex.get(baseKey) || 0;
            }
        });
        return total;
    };

    const getRealOccValue = (rowId: string) => {
        const contextKey = `${selectedHotelName}_${selectedYear}_${selectedMonth}_${activeRealVersionId || ''}`;
        return realOccupancyData[contextKey]?.[rowId];
    };

    const getPreviaOrReal = (accountName: string, targetYear: number | undefined, crFilter?: string) => {
        const r = getImportedValue(accountName, targetYear, 'Real', crFilter);
        const p = getImportedValue(accountName, targetYear, 'Previa', crFilter);
        return r !== 0 ? r : p;
    };

    // --- BUILD ROWS BASED ON STRUCTURE ---
    structure.forEach(section => {
        if (section.name.toUpperCase() === 'RECEITAS' || section.name.toUpperCase() === 'IMPOSTOS') return;
        // 1. Header Row
        rows.push(generateRow(
            section.id,
            '',
            'Section',
            section.name,
            0, 0, 0, 0,
            true,
            section.isTotal,
            0,
            undefined,
            { inputType: 'none', format: 'currency' }
        ));

        // 2. Packages within section
        section.packages.forEach(pkg => {
            // Special indicators check
            if (pkg.name.startsWith('IND-')) {
                // Handle built-in indicators like REVPAR, etc.
                // For now, let's just map them if they exist in our indicator logic
                // (Simplified for this version)
            }

            const pkgAccs = currentAccounts.filter(a => (a.package || '').toLowerCase() === (pkg.name || '').toLowerCase() || a.packageId === pkg.id);

            let valBudget = 0;
            let valPrevia = 0;
            let valReal = 0;
            let valLY = 0;

            const packageRowIndex = rows.length;
            rows.push(generateRow(
                pkg.id,
                '',
                'Package',
                pkg.name,
                valBudget, valReal, valLY, valPrevia,
                true,
                pkg.isTotal,
                1
            ));
            const startChildrenIndex = rows.length;

            pkgAccs.forEach(acc => {
                const accBudget = getImportedValue(acc.name, selectedYear, 'Budget');
                const accPrevia = getPreviaOrReal(acc.name, selectedYear);
                const accReal = getImportedValue(acc.name, selectedYear, 'Forecast');
                const accLY = getImportedValue(acc.name, (selectedYear || 0) - 1, 'Real');

                rows.push(generateRow(
                    acc.id,
                    acc.code,
                    'Account',
                    acc.name,
                    accBudget, accReal, accLY, accPrevia,
                    false,
                    false,
                    2,
                    undefined,
                    {
                        method: acc.expenseType === 'Variável' ? 'Variable' : 'Fixed',
                        driver: acc.expenseDriver,
                        type: acc.expenseType
                    }
                ));
            });


            // Update package total by summing its children
            let sumBudget = 0;
            let sumReal = 0;
            let sumPrevia = 0;
            let sumLY = 0;

            for (let i = startChildrenIndex; i < rows.length; i++) {
                if (rows[i].category !== 'Spacer') {
                    sumBudget += rows[i].budget;
                    sumReal += rows[i].real;
                    sumPrevia += rows[i].previa;
                    sumLY += rows[i].lastYear;
                }
            }

            if (sumBudget !== 0) rows[packageRowIndex].budget = sumBudget;
            if (sumReal !== 0) rows[packageRowIndex].real = sumReal;
            if (sumPrevia !== 0) rows[packageRowIndex].previa = sumPrevia;
            if (sumLY !== 0) rows[packageRowIndex].lastYear = sumLY;
        });

        // Add a spacer after each section
        rows.push(generateRow(`spacer-${section.id}`, '', 'Spacer', '', 0, 0, 0, 0, false, false, 0));
    });

    const applyOverrides = () => {
        const activeHotelCodeUpper = normalizeHotelName(activeHotelCode);
        const selHotelNameUpper = normalizeHotelName(selectedHotelName || '');

        rows.forEach(r => {
            const targetName = `override_${r.id}`.toLowerCase();

            const tryOverride = (scenarioKey: string) => {
                for (const h of [selHotelNameUpper, activeHotelCodeUpper].filter(Boolean)) {
                    const key = `${selectedYear}|${selectedMonth}|${h}|${scenarioKey}|${targetName}`;
                    if (dataIndex.has(key)) {
                        return dataIndex.get(key);
                    }
                }
                return undefined;
            };

            const realOverride = tryOverride('REAL');
            if (realOverride !== undefined) {
                r.real = realOverride;
                r.isManualOverride = true;
                if (r.forecastConfig) r.forecastConfig.manualValue = realOverride;
            }

            const previaOverride = tryOverride('PREVIA');
            if (previaOverride !== undefined) {
                r.previa = previaOverride;
                r.isManualPreviaOverride = true;
                if (r.previaConfig) r.previaConfig.manualValue = previaOverride;
            }

            // KPI (Meta) editável — "Salvar Projeção" já grava esse override (scenario 'Meta')
            // há tempos, mas nunca era lido de volta aqui (só REAL/PREVIA eram aplicados) — o
            // valor editado "sumia" no próximo carregamento. Mesmo padrão dos dois de cima.
            const budgetOverride = tryOverride('BUDGET');
            if (budgetOverride !== undefined) {
                r.budget = budgetOverride;
                r.isManualBudgetOverride = true;
            }
        });
    };
    applyOverrides();

    return rows;
};
