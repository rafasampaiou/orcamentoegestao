
import { ForecastRow, Hotel, User, UserRole, Account, CostPackage, ExpenseType, ExpenseDriver, CostCenter, GMDConfiguration, ImportedRow, ForecastConfig, DreSection, DrePackage } from '../types';

export const mockHotels: Hotel[] = [
  { id: '1', code: 'ATB', name: 'Atibaia' },
  { id: '2', code: 'ALX', name: 'Alexania' },
  { id: '3', code: 'ARX', name: 'Araxá' },
  { id: '4', code: 'CAE', name: 'Caeté' },
  { id: '5', code: 'ALG', name: 'Alegro' },
  { id: '6', code: 'JPA', name: 'João Pessoa' },
  { id: '7', code: 'ADM', name: 'Administradora' },
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
    { code: '4.01.01.01.001', name: 'Condimentos / Conservas', package: 'Custo de Alimentos', packageCode: '4.1.1', master: 'CUSTOS DE ALIMENTOS E BEBIDAS', masterCode: '4.1' },
    { code: '4.01.01.01.002', name: 'Guloseimas', package: 'Custo de Alimentos', packageCode: '4.1.1', master: 'CUSTOS DE ALIMENTOS E BEBIDAS', masterCode: '4.1' },
    { code: '4.01.01.01.003', name: 'Laticinios', package: 'Custo de Alimentos', packageCode: '4.1.1', master: 'CUSTOS DE ALIMENTOS E BEBIDAS', masterCode: '4.1' },
    { code: '4.01.01.01.004', name: 'Hortifrutigranjeiros', package: 'Custo de Alimentos', packageCode: '4.1.1', master: 'CUSTOS DE ALIMENTOS E BEBIDAS', masterCode: '4.1' },
    { code: '4.01.01.01.005', name: 'Paes / Biscoitos', package: 'Custo de Alimentos', packageCode: '4.1.1', master: 'CUSTOS DE ALIMENTOS E BEBIDAS', masterCode: '4.1' },
    { code: '4.01.01.01.006', name: 'Secos', package: 'Custo de Alimentos', packageCode: '4.1.1', master: 'CUSTOS DE ALIMENTOS E BEBIDAS', masterCode: '4.1' },
    { code: '4.01.01.01.007', name: 'Carnes / Aves / Peixes', package: 'Custo de Alimentos', packageCode: '4.1.1', master: 'CUSTOS DE ALIMENTOS E BEBIDAS', masterCode: '4.1' },
    { code: '4.01.01.01.008', name: 'Embutidos / Massas', package: 'Custo de Alimentos', packageCode: '4.1.1', master: 'CUSTOS DE ALIMENTOS E BEBIDAS', masterCode: '4.1' },
    { code: '4.01.01.01.009', name: 'Frios', package: 'Custo de Alimentos', packageCode: '4.1.1', master: 'CUSTOS DE ALIMENTOS E BEBIDAS', masterCode: '4.1' },
    { code: '4.01.01.01.010', name: 'Outros custos', package: 'Custo de Alimentos', packageCode: '4.1.1', master: 'CUSTOS DE ALIMENTOS E BEBIDAS', masterCode: '4.1' },
    { code: '4.01.01.02.001', name: 'Bebidas nao alcoolicas', package: 'Custo de Bebidas', packageCode: '4.1.2', master: 'CUSTOS DE ALIMENTOS E BEBIDAS', masterCode: '4.1' },
    { code: '4.01.01.02.002', name: 'Bebidas alcoolicas', package: 'Custo de Bebidas', packageCode: '4.1.2', master: 'CUSTOS DE ALIMENTOS E BEBIDAS', masterCode: '4.1' },
    { code: '4.01.02.01.001', name: 'Vestuario', package: 'Custo de Produtos Diversos', packageCode: '4.2.1', master: 'CUSTO DE PRODUTOS DIVERSOS', masterCode: '4.2' },
    { code: '4.01.02.01.002', name: 'Cigarros', package: 'Custo de Produtos Diversos', packageCode: '4.2.1', master: 'CUSTO DE PRODUTOS DIVERSOS', masterCode: '4.2' },
    { code: '4.01.02.01.003', name: 'Produtos diversos lojinha', package: 'Custo de Produtos Diversos', packageCode: '4.2.1', master: 'CUSTO DE PRODUTOS DIVERSOS', masterCode: '4.2' },
    { code: '4.01.02.01.004', name: 'Custos Descartaveis', package: 'Custo de Produtos Diversos', packageCode: '4.2.1', master: 'CUSTO DE PRODUTOS DIVERSOS', masterCode: '4.2' },
    { code: '4.01.02.01.005', name: 'Diversos A&B', package: 'Custo de Produtos Diversos', packageCode: '4.2.1', master: 'CUSTO DE PRODUTOS DIVERSOS', masterCode: '4.2' },
    { code: '4.01.02.01.006', name: 'Custos Diversos', package: 'Custo de Produtos Diversos', packageCode: '4.2.1', master: 'CUSTO DE PRODUTOS DIVERSOS', masterCode: '4.2' },
    { code: '4.01.03.01.001', name: 'Custo de aluguel de equipamentos', package: 'Custo de Outras Receitas', packageCode: '4.3.1', master: 'CUSTOS DE OUTRAS RECEITAS', masterCode: '4.3' },
    { code: '4.01.03.01.002', name: 'Custo de estacionamento', package: 'Custo de Outras Receitas', packageCode: '4.3.1', master: 'CUSTOS DE OUTRAS RECEITAS', masterCode: '4.3' },
    { code: '4.01.03.01.003', name: 'Custo de telefonia', package: 'Custo de Outras Receitas', packageCode: '4.3.1', master: 'CUSTOS DE OUTRAS RECEITAS', masterCode: '4.3' },
    { code: '4.01.03.01.004', name: 'Custo de internet', package: 'Custo de Outras Receitas', packageCode: '4.3.1', master: 'CUSTOS DE OUTRAS RECEITAS', masterCode: '4.3' },
    { code: '4.01.03.01.005', name: 'Custo de lavanderia hospedes', package: 'Custo de Outras Receitas', packageCode: '4.3.1', master: 'CUSTOS DE OUTRAS RECEITAS', masterCode: '4.3' },
    { code: '4.01.03.01.006', name: 'Custo de servico de fotografia', package: 'Custo de Outras Receitas', packageCode: '4.3.1', master: 'CUSTOS DE OUTRAS RECEITAS', masterCode: '4.3' },
    { code: '4.01.03.01.007', name: 'Custo de transporte de clientes', package: 'Custo de Outras Receitas', packageCode: '4.3.1', master: 'CUSTOS DE OUTRAS RECEITAS', masterCode: '4.3' },
    { code: '4.01.03.01.008', name: 'Custo de servico de massagens', package: 'Custo de Outras Receitas', packageCode: '4.3.1', master: 'CUSTOS DE OUTRAS RECEITAS', masterCode: '4.3' },
    { code: '4.01.03.01.009', name: 'Custo com entretenimento', package: 'Custo de Outras Receitas', packageCode: '4.3.1', master: 'CUSTOS DE OUTRAS RECEITAS', masterCode: '4.3' },
    { code: '4.01.03.01.010', name: 'Outros custos de servicos prestados', package: 'Custo de Outras Receitas', packageCode: '4.3.1', master: 'CUSTOS DE OUTRAS RECEITAS', masterCode: '4.3' },
    { code: '4.02.01.01.001', name: 'Energia eletrica', package: 'Despesas com Serviços Públicos', packageCode: '5.1.1', master: 'DESPESAS GERAIS E OPERACIONAIS', masterCode: '5.1' },
    { code: '4.02.01.01.002', name: 'Gas', package: 'Despesas com Serviços Públicos', packageCode: '5.1.1', master: 'DESPESAS GERAIS E OPERACIONAIS', masterCode: '5.1' },
    { code: '4.02.01.01.003', name: 'Agua', package: 'Despesas com Serviços Públicos', packageCode: '5.1.1', master: 'DESPESAS GERAIS E OPERACIONAIS', masterCode: '5.1' },
    { code: '4.02.01.01.004', name: 'Combustiveis para veiculos', package: 'Despesas com Serviços Públicos', packageCode: '5.1.1', master: 'DESPESAS GERAIS E OPERACIONAIS', masterCode: '5.1' },
    { code: '4.02.01.01.005', name: 'Combustiveis para Geradores', package: 'Despesas com Serviços Públicos', packageCode: '5.1.1', master: 'DESPESAS GERAIS E OPERACIONAIS', masterCode: '5.1' },
    { code: '4.02.01.02.001', name: 'Produtos de limpeza', package: 'Despesas com Conservação e Limpeza', packageCode: '5.1.2', master: 'DESPESAS GERAIS E OPERACIONAIS', masterCode: '5.1' },
    { code: '4.02.01.02.002', name: 'Material de limpeza', package: 'Despesas com Conservação e Limpeza', packageCode: '5.1.2', master: 'DESPESAS GERAIS E OPERACIONAIS', masterCode: '5.1' },
    { code: '4.02.01.02.003', name: 'Servicos de limpeza', package: 'Despesas com Conservação e Limpeza', packageCode: '5.1.2', master: 'DESPESAS GERAIS E OPERACIONAIS', masterCode: '5.1' },
    { code: '4.02.01.02.004', name: 'Limpeza de carpetes', package: 'Despesas com Conservação e Limpeza', packageCode: '5.1.2', master: 'DESPESAS GERAIS E OPERACIONAIS', masterCode: '5.1' },
    { code: '4.02.01.03.001', name: 'Salarios e ordenados', package: 'Despesas com Pessoal', packageCode: '6.1.1', master: 'DESPESAS COM MAO DE OBRA', masterCode: '6.1' },
    { code: '4.02.01.03.002', name: 'Ferias', package: 'Despesas com Pessoal', packageCode: '6.1.1', master: 'DESPESAS COM MAO DE OBRA', masterCode: '6.1' },
    { code: '4.02.01.03.003', name: 'Decimo terceiro salario', package: 'Despesas com Pessoal', packageCode: '6.1.1', master: 'DESPESAS COM MAO DE OBRA', masterCode: '6.1' },
    { code: '4.02.01.03.004', name: 'Horas extras', package: 'Despesas com Pessoal', packageCode: '6.1.1', master: 'DESPESAS COM MAO DE OBRA', masterCode: '6.1' },
    { code: '4.02.01.03.005', name: 'Adicional noturno', package: 'Despesas com Pessoal', packageCode: '6.1.1', master: 'DESPESAS COM MAO DE OBRA', masterCode: '6.1' },
    { code: '4.02.01.03.006', name: 'Estagiarios', package: 'Despesas com Pessoal', packageCode: '6.1.1', master: 'DESPESAS COM MAO DE OBRA', masterCode: '6.1' },
    { code: '4.02.01.03.007', name: 'Gratificacao', package: 'Despesas com Pessoal', packageCode: '6.1.1', master: 'DESPESAS COM MAO DE OBRA', masterCode: '6.1' },
    { code: '4.02.01.03.008', name: 'Participacao nos Lucros e Resultados - PLR', package: 'Despesas com Pessoal', packageCode: '6.1.1', master: 'DESPESAS COM MAO DE OBRA', masterCode: '6.1' },
    { code: '4.02.01.03.009', name: 'Salario maternidade', package: 'Despesas com Pessoal', packageCode: '6.1.1', master: 'DESPESAS COM MAO DE OBRA', masterCode: '6.1' },
    { code: '4.02.01.03.010', name: 'Uniformes, fantasias e EPI', package: 'Despesas com Pessoal', packageCode: '6.1.1', master: 'DESPESAS COM MAO DE OBRA', masterCode: '6.1' },
    { code: '4.02.01.03.011', name: 'Indenizacoes trabalhistas', package: 'Despesas com Pessoal', packageCode: '6.1.1', master: 'DESPESAS COM MAO DE OBRA', masterCode: '6.1' },
    { code: '4.02.01.03.012', name: 'Acordo judicial trabalhista', package: 'Despesas com Pessoal', packageCode: '6.1.1', master: 'DESPESAS COM MAO DE OBRA', masterCode: '6.1' },
    { code: '4.02.01.03.013', name: 'Comissoes vendedoras / executivas', package: 'Despesas com Pessoal', packageCode: '6.1.1', master: 'DESPESAS COM MAO DE OBRA', masterCode: '6.1' },
    { code: '4.02.01.03.014', name: 'Pro labore', package: 'Despesas com Pessoal', packageCode: '6.1.1', master: 'DESPESAS COM MAO DE OBRA', masterCode: '6.1' },
    { code: '4.02.01.03.015', name: 'Aviso Previo Indenizado', package: 'Despesas com Pessoal', packageCode: '6.1.1', master: 'DESPESAS COM MAO DE OBRA', masterCode: '6.1' },
    { code: '4.02.01.04.001', name: 'Ajuda de custos', package: 'Beneficios aos Colaboradores', packageCode: '6.1.2', master: 'DESPESAS COM MAO DE OBRA', masterCode: '6.1' },
    { code: '4.02.01.04.002', name: 'Cursos e treinamentos', package: 'Beneficios aos Colaboradores', packageCode: '6.1.2', master: 'DESPESAS COM MAO DE OBRA', masterCode: '6.1' },
    { code: '4.02.01.04.003', name: 'Ticket alimentacao', package: 'Beneficios aos Colaboradores', packageCode: '6.1.2', master: 'DESPESAS COM MAO DE OBRA', masterCode: '6.1' },
    { code: '4.02.01.04.004', name: 'Refeicao (PAT)', package: 'Beneficios aos Colaboradores', packageCode: '6.1.2', master: 'DESPESAS COM MAO DE OBRA', masterCode: '6.1' },
    { code: '4.02.01.04.005', name: 'Vale Transporte', package: 'Beneficios aos Colaboradores', packageCode: '6.1.2', master: 'DESPESAS COM MAO DE OBRA', masterCode: '6.1' },
    { code: '4.02.01.04.006', name: 'Seguro de vida', package: 'Beneficios aos Colaboradores', packageCode: '6.1.2', master: 'DESPESAS COM MAO DE OBRA', masterCode: '6.1' },
    { code: '4.02.01.04.007', name: 'Assistencia medica e odontologica', package: 'Beneficios aos Colaboradores', master: 'DESPESAS COM MAO DE OBRA' },
    { code: '4.02.01.04.008', name: 'PPRA e PCMSO', package: 'Beneficios aos Colaboradores', master: 'DESPESAS COM MAO DE OBRA' },
    { code: '4.02.01.04.009', name: 'Brigada de incendio', package: 'Beneficios aos Colaboradores', master: 'DESPESAS COM MAO DE OBRA' },
    { code: '4.02.01.04.010', name: 'Alojamento e casa de praia', package: 'Beneficios aos Colaboradores', master: 'DESPESAS COM MAO DE OBRA' },
    { code: '4.02.01.04.011', name: 'Cesta basica', package: 'Beneficios aos Colaboradores', master: 'DESPESAS COM MAO DE OBRA' },
    { code: '4.02.01.04.012', name: 'Consumo interno', package: 'Beneficios aos Colaboradores', master: 'DESPESAS COM MAO DE OBRA' },
    { code: '4.02.01.04.013', name: 'Atividades desportivas e sociais', package: 'Beneficios aos Colaboradores', master: 'DESPESAS COM MAO DE OBRA' },
    { code: '4.02.01.04.014', name: 'Produtividade / Premiacao', package: 'Beneficios aos Colaboradores', master: 'DESPESAS COM MAO DE OBRA' },
    { code: '4.02.01.04.015', name: 'Auxílio Combustível', package: 'Despesas com Pessoal', master: 'DESPESAS COM MAO DE OBRA' },
    { code: '4.02.01.05.001', name: 'FGTS', package: 'Encargos Sociais', master: 'DESPESAS COM MAO DE OBRA' },
    { code: '4.02.01.05.002', name: 'INSS', package: 'Encargos Sociais', master: 'DESPESAS COM MAO DE OBRA' },
    { code: '4.02.01.05.003', name: 'PIS s/ folha de pagamento', package: 'Encargos Sociais', master: 'DESPESAS COM MAO DE OBRA' },
    { code: '4.02.01.05.004', name: 'Contribuicao sindical e assistencial', package: 'Encargos Sociais', master: 'DESPESAS COM MAO DE OBRA' },
    { code: '4.02.01.05.005', name: 'FGTS Rescisorio', package: 'Encargos Sociais', master: 'DESPESAS COM MAO DE OBRA' },
    { code: '4.02.01.06.001', name: 'Servicos de terceiros temporarios', package: 'Serviço de Terceiros', master: 'DESPESAS COM MAO DE OBRA' },
    { code: '4.02.01.07.001', name: 'Telefonia fixa', package: 'Despesas Operacionais', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '4.02.01.07.002', name: 'Telefonia móvel', package: 'Despesas Operacionais', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '4.02.01.07.003', name: 'Assinatura de TV a cabo', package: 'Despesas Operacionais', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '4.02.01.07.004', name: 'Jornais / livros / revistas', package: 'Despesas Operacionais', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '4.02.01.07.005', name: 'Decoração e ornamentos', package: 'Despesas Operacionais', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '4.02.01.07.006', name: 'Amenidades / Suprimentos pra hospedes', package: 'Despesas Operacionais', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '4.02.01.07.007', name: 'Material de estetica', package: 'Despesas Operacionais', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '4.02.01.07.008', name: 'Reposição de materiais, moveis e utensílios', package: 'Despesas Operacionais', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '4.02.01.07.009', name: 'Suprimentos impressos e folheteria', package: 'Despesas Operacionais', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '4.02.01.07.010', name: 'Indenizacao ao hospede', package: 'Despesas Operacionais', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '4.02.01.07.011', name: 'Locacao de moveis, utensílios e equipamentos', package: 'Despesas Operacionais', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '4.02.01.07.013', name: 'Servicos prestados por terceiros', package: 'Despesas Operacionais', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '4.02.01.07.013_2', name: 'Servicos de terceiros longo prazo', package: 'Serviço de Terceiros', master: 'DESPESAS COM MAO DE OBRA' },
    { code: '4.02.01.07.014', name: 'Reposição de enxovais', package: 'Despesas Operacionais', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '4.02.01.07.015', name: 'Room tax (taxa de turismo)', package: 'Despesas Operacionais', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '4.02.01.07.016', name: 'Danos e perdas', package: 'Despesas Operacionais', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '4.02.01.07.017', name: 'ICMS - Diferencial de aliquota', package: 'Despesas Operacionais', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '4.02.01.07.018', name: 'Lavanderia uniformes', package: 'Despesas Operacionais', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '4.02.01.07.019', name: 'Frete', package: 'Despesas Operacionais', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '4.02.01.07.020', name: 'Lavanderia enxoval', package: 'Despesas Operacionais', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '4.02.01.07.021', name: 'Falhas de Hospedagem / Overbook', package: 'Despesas Operacionais', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '4.02.01.07.022', name: 'Material de esporte e lazer', package: 'Despesas Operacionais', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '4.02.01.07.023', name: 'Musica, entretenimento e bem estar', package: 'Despesas Operacionais', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '4.02.01.07.024', name: 'Despesas de Taxa de Reservas', package: 'Despesas Operacionais', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '4.02.01.07.025', name: 'Seguranca / Salva vidas', package: 'Despesas Operacionais', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '4.02.01.07.026', name: 'Despesas com descartaveis', package: 'Despesas Operacionais', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '4.02.01.08.001', name: 'Contratos de manutencao', package: 'Despesas com Manutenção', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '4.02.01.08.002', name: 'Reparos e materiais - Estrutura predial', package: 'Despesas com Manutenção', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '4.02.01.08.003', name: 'Reparos e materiais - Restauracao', package: 'Despesas com Manutenção', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '4.02.01.08.004', name: 'Reparos e materiais - Moveis e utensilios', package: 'Despesas com Manutenção', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '4.02.01.08.005', name: 'Reparos e materiais - Maquinas e equipamentos', package: 'Despesas com Manutenção', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '4.02.01.08.006', name: 'Reparos e materiais - Instalacao eletrica', package: 'Despesas com Manutenção', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '4.02.01.08.007', name: 'Reparos e materiais - Instalacao hidraulica', package: 'Despesas com Manutenção', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '4.02.01.08.008', name: 'Reparos e materiais - Instrumentacao / automacao', package: 'Despesas com Manutenção', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '4.02.01.08.009', name: 'Reparos e materiais - Jardins / Quadras / Animais', package: 'Despesas com Manutenção', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '4.02.01.08.010', name: 'Reparos e materiais - Piscina', package: 'Despesas com Manutenção', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '4.02.01.08.011', name: 'Reparos e materiais - Veiculo', package: 'Despesas com Manutenção', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '4.02.01.08.012', name: 'Reparos e materiais - Elevador', package: 'Despesas com Manutenção', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '4.02.01.08.013', name: 'Reparos e materiais - Telefonia', package: 'Despesas com Manutenção', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '4.02.01.08.014', name: 'Reparos e materiais - Ar condicionado', package: 'Despesas com Manutenção', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '4.02.01.08.015', name: 'Reparos e materiais - Material de consumo', package: 'Despesas com Manutenção', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '4.02.01.08.016', name: 'Reparos e materiais - Caldeira', package: 'Despesas com Manutenção', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '4.02.01.08.017', name: 'Servico de dedetizacao', package: 'Despesas com Manutenção', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '4.02.01.08.018', name: 'Servicos de remocao de lixo e entulho', package: 'Despesas com Manutenção', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '4.02.01.08.019', name: 'Reparos e materiais - Equipamentos de TI', package: 'Despesas com Manutenção', master: 'DESPESAS GERAIS E OPERACIONAIS' },
    { code: '4.03.01.01.001', name: 'Licença de uso e marca', package: 'Despesas Administrativas', master: 'DESPESAS ADMINISTRATIVAS' },
    { code: '4.03.01.01.002', name: 'Consultoria / Assessoria', package: 'Despesas Administrativas', master: 'DESPESAS ADMINISTRATIVAS' },
    { code: '4.03.01.01.003', name: 'Conducao, alimentacao e quilometragem', package: 'Despesas Administrativas', master: 'DESPESAS ADMINISTRATIVAS' },
    { code: '4.03.01.01.004', name: 'Assessoria jurídica e advocaticia', package: 'Despesas Administrativas', master: 'DESPESAS ADMINISTRATIVAS' },
    { code: '4.03.01.01.005', name: 'Assessoria e perdas com cobranca', package: 'Despesas Administrativas', master: 'DESPESAS ADMINISTRATIVAS' },
    { code: '4.03.01.01.006', name: 'Assessoria contabil', package: 'Despesas Administrativas', master: 'DESPESAS ADMINISTRATIVAS' },
    { code: '4.03.01.01.007', name: 'Material de escritorio', package: 'Despesas Administrativas', master: 'DESPESAS ADMINISTRATIVAS' },
    { code: '4.03.01.01.008', name: 'Associacao de classe', package: 'Despesas Administrativas', master: 'DESPESAS ADMINISTRATIVAS' },
    { code: '4.03.01.01.009', name: 'Recrutamento e selecao', package: 'Despesas Administrativas', master: 'DESPESAS ADMINISTRATIVAS' },
    { code: '4.03.01.01.010', name: 'Multas e autuações diversas', package: 'Despesas Administrativas', master: 'DESPESAS ADMINISTRATIVAS' },
    { code: '4.03.01.01.011', name: 'Doacao/Donativos', package: 'Despesas Administrativas', master: 'DESPESAS ADMINISTRATIVAS' },
    { code: '4.03.01.01.012', name: 'Consultas a SERASA e SPC', package: 'Despesas Administrativas', master: 'DESPESAS ADMINISTRATIVAS' },
    { code: '4.03.01.01.013', name: 'Correio / Malote / Motoboy', package: 'Despesas Administrativas', master: 'DESPESAS ADMINISTRATIVAS' },
    { code: '4.03.01.01.014', name: 'Despesas com viagens e estadas', package: 'Despesas Administrativas', master: 'DESPESAS ADMINISTRATIVAS' },
    { code: '4.03.01.01.015', name: 'Seguros', package: 'Despesas Administrativas', master: 'DESPESAS ADMINISTRATIVAS' },
    { code: '4.03.01.01.016', name: 'Comissoes de agencias', package: 'Despesas Administrativas', master: 'DESPESAS ADMINISTRATIVAS' },
    { code: '4.03.01.01.017', name: 'Despesas com veiculos', package: 'Despesas Administrativas', master: 'DESPESAS ADMINISTRATIVAS' },
    { code: '4.03.01.01.018', name: 'Despesas Nao Dedutiveis', package: 'Despesas Administrativas', master: 'DESPESAS ADMINISTRATIVAS' },
    { code: '4.03.01.01.019', name: 'Auditoria externa', package: 'Despesas Administrativas', master: 'DESPESAS ADMINISTRATIVAS' },
    { code: '4.03.01.01.020', name: 'Servicos de cartorio, autenticacoes e copias', package: 'Despesas Administrativas', master: 'DESPESAS ADMINISTRATIVAS' },
    { code: '4.03.01.01.021', name: 'Processamentos de dados e TI', package: 'Despesas Administrativas', master: 'DESPESAS ADMINISTRATIVAS' },
    { code: '4.03.01.01.022', name: 'Despesas com Internet', package: 'Despesas Administrativas', master: 'DESPESAS ADMINISTRATIVAS' },
    { code: '4.03.01.01.023', name: 'Suprimentos de informatica', package: 'Despesas Administrativas', master: 'DESPESAS ADMINISTRATIVAS' },
    { code: '4.03.01.01.024', name: 'Taxas fiscais e legais', package: 'Despesas Administrativas', master: 'DESPESAS ADMINISTRATIVAS' },
    { code: '4.03.01.01.025', name: 'Comissao cartao Visa', package: 'Despesas Administrativas', master: 'DESPESAS ADMINISTRATIVAS' },
    { code: '4.03.01.01.026', name: 'Comissao cartao MasterCard', package: 'Despesas Administrativas', master: 'DESPESAS ADMINISTRATIVAS' },
    { code: '4.03.01.01.027', name: 'Comissao cartao Amex', package: 'Despesas Administrativas', master: 'DESPESAS ADMINISTRATIVAS' },
    { code: '4.03.01.01.028', name: 'Comissao cartao Diners', package: 'Despesas Administrativas', master: 'DESPESAS ADMINISTRATIVAS' },
    { code: '4.03.01.01.029', name: 'Comissao Elo/ Cabal/ Hipercard/ Alelo/ Discover', package: 'Despesas Administrativas', master: 'DESPESAS ADMINISTRATIVAS' },
    { code: '4.03.01.01.030', name: 'Provisão Devedores Duvidosos - PDD', package: 'Despesas Administrativas', master: 'DESPESAS ADMINISTRATIVAS' },
    { code: '4.03.01.01.031', name: 'Despesas de Taxa de Administracao', package: 'Despesas Administrativas', master: 'DESPESAS ADMINISTRATIVAS' },
    { code: '4.03.01.01.032', name: 'Taxa de condominio e aluguel de imoveis', package: 'Despesas Administrativas', master: 'DESPESAS ADMINISTRATIVAS' },
    { code: '4.03.01.01.033', name: 'Direito Autoral e de Imagem', package: 'Despesas Administrativas', master: 'DESPESAS ADMINISTRATIVAS' },
    { code: '4.03.01.01.034', name: 'Indenizacoes e acordo judicial civil', package: 'Despesas Administrativas', master: 'DESPESAS ADMINISTRATIVAS' },
    { code: '4.03.01.01.035', name: 'Projetos sustentaveis', package: 'Despesas Administrativas', master: 'DESPESAS ADMINISTRATIVAS' },
    { code: '4.03.02.01.001', name: 'Divulgacao, anuncio e publicacao', package: 'Despesas com Vendas e Marketing', master: 'DESPESAS COM VENDAS E MARKETING' },
    { code: '4.03.02.01.002', name: 'Material promocional', package: 'Despesas com Vendas e Marketing', master: 'DESPESAS COM VENDAS E MARKETING' },
    { code: '4.03.02.01.003', name: 'Despesas com fidelizacao de clientes', package: 'Despesas com Vendas e Marketing', master: 'DESPESAS COM VENDAS E MARKETING' },
    { code: '4.03.02.01.004', name: 'Assessoria de imprensa', package: 'Despesas com Vendas e Marketing', master: 'DESPESAS COM VENDAS E MARKETING' },
    { code: '4.03.02.01.005', name: 'Eventos, feiras e promocoes', package: 'Despesas com Vendas e Marketing', master: 'DESPESAS COM VENDAS E MARKETING' },
    { code: '4.03.02.01.006', name: 'Cortesias', package: 'Despesas com Vendas e Marketing', master: 'DESPESAS COM VENDAS E MARKETING' },
    { code: '4.03.02.01.007', name: 'Despesas de Taxa de Uso da Marca', package: 'Despesas com Vendas e Marketing', master: 'DESPESAS COM VENDAS E MARKETING' },
    { code: '4.03.02.01.008', name: 'Despesas de Taxa de Marketing', package: 'Despesas com Vendas e Marketing', master: 'DESPESAS COM VENDAS E MARKETING' },
    { code: '4.03.03.01.001', name: 'Juros sobre emprestimos', package: 'Despesas Financeiras e Bancárias', master: 'DESPESAS FINANCEIRAS E BANCARIAS' },
    { code: '4.03.03.01.002', name: 'Juros sobre financiamentos', package: 'Despesas Financeiras e Bancárias', master: 'DESPESAS FINANCEIRAS E BANCARIAS' },
    { code: '4.03.03.01.003', name: 'Variacoes monetarias passivas', package: 'Despesas Financeiras e Bancárias', master: 'DESPESAS FINANCEIRAS E BANCARIAS' },
    { code: '4.03.03.01.004', name: 'Variacoes cambiais passivas', package: 'Despesas Financeiras e Bancárias', master: 'DESPESAS FINANCEIRAS E BANCARIAS' },
    { code: '4.03.03.01.005', name: 'Juros e multas diversos', package: 'Despesas Financeiras e Bancárias', master: 'DESPESAS FINANCEIRAS E BANCARIAS' },
    { code: '4.03.03.01.006', name: 'Tarifas e despesas bancarias diversas', package: 'Despesas Financeiras e Bancárias', master: 'DESPESAS FINANCEIRAS E BANCARIAS' },
    { code: '4.03.03.01.007', name: 'IOF', package: 'Despesas Financeiras e Bancárias', master: 'DESPESAS FINANCEIRAS E BANCARIAS' },
    { code: '4.03.03.01.008', name: 'Descontos concedidos', package: 'Despesas Financeiras e Bancárias', master: 'DESPESAS FINANCEIRAS E BANCARIAS' },
    { code: '4.03.03.01.009', name: 'Despesa Financeira / JSCP', package: 'Despesa Tributaria', master: 'DESPESAS TRIBUTARIAS' },
    { code: '4.03.03.01.010', name: 'Outras despesas financeiras', package: 'Despesas Financeiras e Bancárias', master: 'DESPESAS FINANCEIRAS E BANCARIAS' },
    { code: '4.03.03.01.011', name: 'Outras despesas financeiras IFRS 16', package: 'Custo de Outras Receitas', master: 'CUSTOS DE OUTRAS RECEITAS' },
    { code: '4.03.03.01.012', name: 'Juros sobre antecipações - cartão de credito', package: 'Despesas Financeiras e Bancárias', master: 'DESPESAS FINANCEIRAS E BANCARIAS' },
    { code: '4.03.04.01.001', name: 'CSLL', package: 'Despesa Tributaria', master: 'DESPESAS TRIBUTARIAS' },
    { code: '4.03.04.01.002', name: 'IRPJ', package: 'Despesa Tributaria', master: 'DESPESAS TRIBUTARIAS' },
    { code: '4.03.04.01.003', name: 'CSLL Diferido', package: 'Despesa Tributaria', master: 'DESPESAS TRIBUTARIAS' },
    { code: '4.03.04.01.004', name: 'IRPJ Diferido', package: 'Despesa Tributaria', master: 'DESPESAS TRIBUTARIAS' },
    { code: '4.03.04.02.001', name: 'IPTU', package: 'Outros impostos', master: 'DESPESAS TRIBUTARIAS' },
    { code: '4.03.04.02.002', name: 'IPVA', package: 'Despesa Tributaria', master: 'DESPESAS TRIBUTARIAS' },
    { code: '4.03.04.02.003', name: 'Tributos em atraso', package: 'Despesa Tributaria', master: 'DESPESAS TRIBUTARIAS' },
    { code: '4.03.04.02.004', name: 'Funrural', package: 'Outros Impostos', master: 'DESPESAS TRIBUTARIAS' },
    { code: '4.03.04.02.005', name: 'ITBI e ITR', package: 'Despesa Tributaria', master: 'DESPESAS TRIBUTARIAS' },
    { code: '4.03.05.01.001', name: 'Arrendamento', package: 'Arrendamento', master: 'DESPESAS TRIBUTARIAS' },
    { code: '4.03.05.01.002', name: 'Aluguel fixo', package: 'Arrendamento', master: 'DESPESAS TRIBUTARIAS' },
    { code: '4.03.05.01.003', name: 'Aluguel variavel', package: 'Arrendamento', master: 'DESPESAS TRIBUTARIAS' },
    { code: '4.03.05.01.004', name: 'Arrendamento IFRS 16', package: 'Arrendamento', master: 'DESPESAS TRIBUTARIAS' },
    { code: '4.03.05.01.005', name: 'Aluguel fixo IFRS 16', package: 'Despesa Tributaria', master: 'DESPESAS TRIBUTARIAS' },
    { code: '4.04.01.01.001', name: 'Despesa com alienacao de bens', package: 'Outras Despesas Não Operacionais', master: 'OUTRAS DESPESAS' },
    { code: '4.04.01.01.002', name: 'Despesas de Taxa de Incentivo', package: 'Outras Despesas Não Operacionais', master: 'OUTRAS DESPESAS' },
    { code: '4.04.01.01.003', name: 'Perda com Equivalencia Patrimonial', package: 'Outras Despesas Não Operacionais', master: 'OUTRAS DESPESAS' },
    { code: '4.04.01.01.004', name: 'Perdas com aumento desproporcional de capital', package: 'Outras Despesas Não Operacionais', master: 'OUTRAS DESPESAS' },
    { code: '4.04.01.01.005', name: 'Perdas com distribuicao desproporcional de lucros', package: 'Outras Despesas Não Operacionais', master: 'OUTRAS DESPESAS' },
    { code: '4.04.01.01.006', name: 'Perdas com cobranca de dividendos a receber', package: 'Outras Despesas Não Operacionais', master: 'OUTRAS DESPESAS' },
    { code: '4.04.01.01.007', name: 'Outras despesas nao operacionais', package: 'Outras Despesas Não Operacionais', master: 'OUTRAS DESPESAS' },
    { code: '4.04.01.01.008', name: 'Outras despesas Ajuste Avaliacao Patrimonial', package: 'Despesa Tributaria', master: 'DESPESAS TRIBUTARIAS' },
    { code: '4.04.01.02.001', name: 'Depreciacao', package: 'Depreciação e Amortização', master: 'DESPESAS ADMINISTRATIVAS' },
    { code: '4.04.01.02.002', name: 'Amortizacao', package: 'Depreciação e Amortização', master: 'DESPESAS ADMINISTRATIVAS' },
    { code: '4.04.01.02.003', name: 'Depreciacao IFRS 16', package: 'Depreciação e Amortização', master: 'DESPESAS ADMINISTRATIVAS' },
    { code: '4.04.01.02.004', name: 'Depreciacao IFRS Indedutivel', package: 'Despesa Tributaria', master: 'DESPESAS TRIBUTARIAS' },
    { code: '4.09.01.01.001', name: 'Provisao de gastos diversos', package: 'Provisoes Gerais', master: 'PROVISOES GERAIS' },
    { code: '4.09.01.01.002', name: 'Provisao de servicos gerenciais', package: 'Provisoes Gerais', master: 'PROVISOES GERAIS' },
    { code: '4.09.01.01.003', name: 'Provisao de advogados e honorarios', package: 'Provisoes Gerais', master: 'PROVISOES GERAIS' },
    { code: '4.09.01.01.004', name: 'Provisao de viagens e representacoes', package: 'Provisoes Gerais', master: 'PROVISOES GERAIS' },
    { code: '4.09.01.01.005', name: 'Provisao de PLR', package: 'Provisoes Gerais', master: 'PROVISOES GERAIS' },
    { code: '4.09.01.01.006', name: 'Provisao de auditoria externa', package: 'Provisoes Gerais', master: 'PROVISOES GERAIS' },
    { code: '4.09.01.01.007', name: 'Provisao de roupa, cama, mesa e banho', package: 'Provisoes Gerais', master: 'PROVISOES GERAIS' },
    { code: '4.09.01.01.008', name: 'Provisao de material operacional', package: 'Provisoes Gerais', master: 'PROVISOES GERAIS' },
    { code: '4.09.01.01.009', name: 'Provisao de bonus', package: 'Provisoes Gerais', master: 'PROVISOES GERAIS' },
    { code: '4.09.01.01.010', name: 'Provisao de uniformes', package: 'Provisoes Gerais', master: 'PROVISOES GERAIS' },
    { code: '4.09.01.01.011', name: 'Provisao de fundo de reserva', package: 'Provisoes Gerais', master: 'PROVISOES GERAIS' },
    { code: '4.09.01.01.012', name: 'Provisao de publicidade', package: 'Provisoes Gerais', master: 'PROVISOES GERAIS' },
    { code: '4.09.01.01.013', name: 'Provisao de recursos humanos', package: 'Provisoes Gerais', master: 'PROVISOES GERAIS' },
    { code: '4.09.01.01.014', name: 'Provisao de manutencao e reparos', package: 'Provisoes Gerais', master: 'PROVISOES GERAIS' },
    { code: '4.09.01.01.015', name: 'Provisao de agua e esgoto', package: 'Provisoes Gerais', master: 'PROVISOES GERAIS' },
    { code: '4.09.01.01.016', name: 'Provisao de energia eletrica', package: 'Provisoes Gerais', master: 'PROVISOES GERAIS' },
    { code: '4.09.01.01.017', name: 'Provisao de combustiveis', package: 'Provisoes Gerais', master: 'PROVISOES GERAIS' },
    { code: '4.09.01.01.018', name: 'Provisao de telecomunicacoes', package: 'Provisoes Gerais', master: 'PROVISOES GERAIS' },
    { code: '4.09.01.01.019', name: 'Provisao de contingencia trabalhista', package: 'Provisoes Gerais', master: 'PROVISOES GERAIS' },
    { code: '4.09.01.01.020', name: 'Provisao de contingencia civel', package: 'Provisoes Gerais', master: 'PROVISOES GERAIS' },
    { code: '4.09.01.01.021', name: 'Provisao de servicos de terceiros temporarios', package: 'Provisoes Gerais', master: 'PROVISOES GERAIS' },
    { code: '4.09.01.01.022', name: 'Provisao de Taxa de Administracao', package: 'Provisoes Gerais', master: 'PROVISOES GERAIS' },
    { code: '4.09.01.01.023', name: 'Provisao de Taxa de Marketing', package: 'Provisoes Gerais', master: 'PROVISOES GERAIS' },
    { code: '4.09.01.01.024', name: 'Provisao de Taxa de Incentivo', package: 'Provisoes Gerais', master: 'PROVISOES GERAIS' },
    { code: '4.09.01.01.025', name: 'Provisao de PIS', package: 'Provisoes Gerais', master: 'PROVISOES GERAIS' },
    { code: '4.09.01.01.026', name: 'Provisao de COFINS', package: 'Provisoes Gerais', master: 'PROVISOES GERAIS' },
    { code: '4.09.01.01.027', name: 'Provisao de ISS', package: 'Provisoes Gerais', master: 'PROVISOES GERAIS' },
    { code: '4.09.01.01.028', name: 'Provisao de ICMS', package: 'Provisoes Gerais', master: 'PROVISOES GERAIS' },
    { code: '4.10.01.01.001', name: 'Reembolso de gasto com pessoal', package: 'Reembolso de gastos', master: 'DESPESAS FINANCEIRAS E BANCARIAS' },
    { code: '4.10.01.01.002', name: 'Reembolso de gastos com serviços de terceiro', package: 'Reembolso de gastos', master: 'DESPESAS FINANCEIRAS E BANCARIAS' },
    { code: '4.10.01.01.003', name: 'Reembolso demais gastos', package: 'Reembolso de gastos', master: 'DESPESAS FINANCEIRAS E BANCARIAS' },
    { code: '4.03.01.01.036', name: 'Processamentos de dados e TI', package: 'Outras Despesas Não Operacionais', master: 'OUTRAS DESPESAS' },
    { code: '4.03.03.01.013', name: 'Juros da dívida - competência', package: 'Outras Despesas Não Operacionais', master: 'OUTRAS DESPESAS' },
    { code: '4.03.01.01.035_2', name: 'Projetos sustentáveis', package: 'Despesas Administrativas', master: 'DESPESAS ADMINISTRATIVAS' },
    { code: '4.02.01.03.016', name: 'Assiduidade', package: 'SERVIÇOS DE TERCEIROS', master: 'DESPESAS COM MAO DE OBRA' },
    { code: '4.02.01.06.002', name: 'Serviços contratados de prestadores PJ - MEI', package: 'SERVIÇOS DE TERCEIROS', master: 'DESPESAS COM MAO DE OBRA' },
    { code: '4.01.02.01.008', name: 'Despesas com fidelizacao de clientes', package: 'Despesas com Vendas e Marketing', master: 'DESPESAS COM VENDAS E MARKETING' },
    { code: '4.01.02.01.009', name: 'Custos Diversos', package: 'Custo de Produtos Diversos', master: 'CUSTO DE PRODUTOS DIVERSOS' },
    { code: '4.09.01.01.030', name: 'Provisao de servicos de terceiros temporarios', package: 'Provisoes Gerais', master: 'PROVISOES GERAIS' },
    { code: '4.02.01.06.003', name: 'Serviço de terceiros recorrente', package: 'Despesas Administrativas', master: 'DESPESAS ADMINISTRATIVAS' },
    { code: '4.02.01.03.017', name: 'EPI e EPC', package: 'Despesas com Pessoal', master: 'DESPESAS COM MAO DE OBRA' },
    { code: '4.03.01.01.037', name: 'Despesas Nao Dedutiveis Terceiros', package: 'Despesas Administrativas', master: 'DESPESAS ADMINISTRATIVAS' },
    { code: '4.03.01.01.038', name: 'Despesas Nao Dedutiveis Pequenas Despesas', package: 'Despesas Administrativas', master: 'DESPESAS ADMINISTRATIVAS' }
];

const generateMockData = () => {
    const packages: CostPackage[] = [];
    const accounts: Account[] = [];
    const managers = ['u1', 'u2', 'u3', 'u4', 'u5', 'u6'];
    
    const packageMap = new Map<string, string>(); // Name -> ID

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

        accounts.push({
            id: `acc-${index + 1}`,
            code: item.code,
            name: item.name,
            packageId: pkgId,
            package: item.package,
            packageCode: (item as { packageCode: string }).packageCode,
            masterPackage: item.master,
            masterPackageCode: (item as { masterCode: string }).masterCode,
            type: 'Fixed'
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
  config?: { type?: ExpenseType, driver?: ExpenseDriver, taxRate?: number, inputType?: 'expense' | 'tax' | 'none', format?: 'currency' | 'percent' | 'integer' | 'decimal', method?: 'Fixed' | 'Variable', factor?: number },
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
      taxRate: config.taxRate,
      format: config.format || 'currency'
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
    budgetOccupancyData: Record<string, number[]> = {}
): ForecastRow[] => {
  
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
          else return; 
          
          // Filter by versionId if applicable
          if (normScenario === 'REAL') {
              if (activeRealVersionId && row.versionId && row.versionId !== activeRealVersionId) return;
          } else if (normScenario === 'BUDGET') {
              // Be more permissive for budget data: if no versionId, allow it based on year/hotel
              if (row.versionId) {
                const matchesBudget = activeBudgetVersionId && row.versionId === activeBudgetVersionId;
                const matchesReal = activeRealVersionId && row.versionId === activeRealVersionId;
                if (!matchesBudget && !matchesReal) return;
              }
          }

          // 4. Normalize Hotel
          const normHotel = row.hotel.trim().toUpperCase();

          // 5. Parse Value
          const val = parseFloat(row.valor.replace(',', '.'));
          if (isNaN(val)) return;

          // 6. Indexing
          const normConta = row.conta.trim().toLowerCase();
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
      });
  }

  // Optimized Helper using Index
  const getImportedValue = (accountName: string, targetYear: number | undefined, valueCategory: 'Real' | 'Budget' | 'Previa', crFilter?: string) => {
    if (!selectedMonth || !targetYear) return 0;
    
    const targetName = accountName.trim().toLowerCase();
    const targetCR = crFilter?.trim().toLowerCase();
    let targetScenario = '';
    if (valueCategory === 'Real') targetScenario = 'REAL';
    else if (valueCategory === 'Budget') targetScenario = 'BUDGET';
    else targetScenario = 'PREVIA';

    const keysToCheck = new Set<string>();
    const hotelsToTry = [selectedHotelName, activeHotelCode].filter(Boolean) as string[];

    hotelsToTry.forEach(h => {
        const baseKey = `${targetYear}|${selectedMonth}|${h.trim().toUpperCase()}|${targetScenario}|${targetName}`;
        if (targetCR) {
            keysToCheck.add(`${baseKey}|${targetCR}`);
        } else {
            keysToCheck.add(baseKey);
        }
    });

    let total = 0;
    keysToCheck.forEach(key => {
        if (dataIndex.has(key)) {
            total += dataIndex.get(key) || 0;
        } else if (key.includes('|') && key.split('|').length > 5) {
            // Fallback: If with CR failed, try without CR
            const parts = key.split('|');
            const fallbackKey = parts.slice(0, 5).join('|');
            total += dataIndex.get(fallbackKey) || 0;
        }
    });

    return total;
  };

  // --- Helper to get Real Occupancy Overrides ---
  const getRealOccValue = (rowId: string) => {
    const contextKey = `${selectedHotelName}_${selectedYear}_${selectedMonth}`;
    return realOccupancyData[contextKey]?.[rowId];
  };

  // 1. INDICATORS
  
  // Section: GERAIS
  const gAvailReal = getRealOccValue('geral_avail') ?? 100;
  const gOccReal = getRealOccValue('geral_sold') ?? 75;
  const gPaxReal = getRealOccValue('geral_pax') ?? 210;
  const gAdultsReal = getRealOccValue('geral_adults') ?? 150;
  const gChdReal = getRealOccValue('geral_chd') ?? 60;

  // Retrieve budget values from budgetOccupancyData based on the selectedMonth (0-indexed)
  const monthIdx = selectedMonth ? selectedMonth - 1 : 0;
  const gAvailBudget = budgetOccupancyData['geral_avail'] ? budgetOccupancyData['geral_avail'][monthIdx] : 0;
  const gOccBudget = budgetOccupancyData['geral_sold'] ? budgetOccupancyData['geral_sold'][monthIdx] : 0;
  const gOccPctBudget = gAvailBudget > 0 ? (gOccBudget / gAvailBudget) * 100 : 0;
  // Get Budget Revenue values to compute Budget DM & RevPAR (Approximation or zeros if missing)
  const gPaxBudget = budgetOccupancyData['geral_pax'] ? budgetOccupancyData['geral_pax'][monthIdx] : 0;
  const gAdultsBudget = budgetOccupancyData['geral_adults'] ? budgetOccupancyData['geral_adults'][monthIdx] : 0;
  const gChdBudget = budgetOccupancyData['geral_chd'] ? budgetOccupancyData['geral_chd'][monthIdx] : 0;
  
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

  rows.push(generateRow('IND-1', '', 'Indicators', 'UH Disponível', gAvailBudget, gAvailReal, 100, 0, false, false, 0, undefined, { format: 'integer' }, 'INDICADORES GERAIS'));
  rows.push(generateRow('IND-2', '', 'Indicators', 'UH Ocupada', gOccBudget, gOccReal, 70, 0, false, false, 0, undefined, { format: 'integer' }, 'INDICADORES GERAIS'));
  rows.push(generateRow('IND-3', '', 'Indicators', '% Ocupação', gOccPctBudget, gAvailReal > 0 ? (gOccReal / gAvailReal) * 100 : 0, 70, 0, false, false, 0, undefined, { format: 'percent' }, 'INDICADORES GERAIS'));
  rows.push(generateRow('IND-4', '', 'Indicators', 'DM Bruta', dmBudget, 850, 800, 0, false, false, 0, undefined, { format: 'currency' }, 'INDICADORES GERAIS'));
  rows.push(generateRow('IND-5', '', 'Indicators', 'PAX', gPaxBudget, gPaxReal, 190, 0, false, false, 0, undefined, { format: 'integer' }, 'INDICADORES GERAIS'));
  rows.push(generateRow('IND-ADULTOS', '', 'Indicators', 'Adultos', gAdultsBudget, gAdultsReal, 140, 0, false, false, 0, undefined, { format: 'integer' }, 'INDICADORES GERAIS'));
  rows.push(generateRow('IND-CHD', '', 'Indicators', 'CHD', gChdBudget, gChdReal, 50, 0, false, false, 0, undefined, { format: 'integer' }, 'INDICADORES GERAIS'));
  rows.push(generateRow('IND-COEF-ADULTOS', '', 'Indicators', 'Coef. Adultos', gOccBudget > 0 ? gAdultsBudget / gOccBudget : 0, gOccReal > 0 ? gAdultsReal / gOccReal : 0, 2, 0, false, false, 0, undefined, { format: 'decimal' }, 'INDICADORES GERAIS'));
  rows.push(generateRow('IND-COEF-CHD', '', 'Indicators', 'Coef. CHD', gOccBudget > 0 ? gChdBudget / gOccBudget : 0, gOccReal > 0 ? gChdReal / gOccReal : 0, 0.7, 0, false, false, 0, undefined, { format: 'decimal' }, 'INDICADORES GERAIS'));
  rows.push(generateRow('IND-6', '', 'Indicators', 'REVPAR', revparBudget, 637.5, 560, 0, false, false, 0, undefined, { format: 'currency' }, 'INDICADORES GERAIS'));
  rows.push(generateRow('IND-TREVPOR', '', 'Indicators', 'TREVPOR', trevporBudget, 0, 0, 0, false, false, 0, undefined, { format: 'currency' }, 'INDICADORES GERAIS'));
  rows.push(generateRow('IND-TREVPAR', '', 'Indicators', 'TREVPAR', trevparBudget, 0, 0, 0, false, false, 0, undefined, { format: 'currency' }, 'INDICADORES GERAIS'));

  rows.push(generateRow('SPACER-IND-REV', '', 'Spacer', '', 0, 0, 0, 0, false, false, 0));

  // 2. REVENUE
  
  // 1.00 RECEITA BRUTA TOTAL
  rows.push(generateRow('REV-TOTAL', '1.00', 'Revenue', 'RECEITA BRUTA TOTAL', 0, 0, 0, 0, true, true, 0));
  
  // 1.01 Receita de Apartamentos
  rows.push(generateRow('REV-APT', '1.01', 'Revenue', 'Receita de Apartamentos', 0, 0, 0, 0, true, false, 1));
  
  const revAptItems = [
      { id: 'REV-APT-LAZER', code: '1.01.01', label: 'Lazer', importNames: ['Lazer', 'Receita de Apartamentos'] },
      { id: 'REV-APT-EVENTOS', code: '1.01.02', label: 'Eventos', importNames: ['Eventos', 'Receita de Apartamentos'] },
      { id: 'REV-APT-INCLUSAS', code: '1.01.03', label: 'Receitas Inclusas na diária', importNames: ['Receitas Inclusas na diária', 'Receita de Alimentos - Incluso na diária'] },
  ];

  revAptItems.forEach(item => {
      let valBudget = 0;
      let valReal = 0;
      let valPrevia = 0;
      let valLY = 0;

      // Special logic for Lazer/Eventos: if label matches 'Receita de Apartamentos', we MUST filter by CR
      const crFilter = (item.label === 'Lazer' || item.label === 'Eventos') ? item.label : undefined;
      
      const namesToTry = item.importNames || [item.label];
      namesToTry.forEach(name => {
          valBudget += getImportedValue(name, selectedYear, 'Budget', crFilter);
          valReal += getImportedValue(name, selectedYear, 'Real', crFilter);
          valPrevia += getImportedValue(name, selectedYear, 'Previa', crFilter);
          valLY += getImportedValue(name, (selectedYear || 0) - 1, 'Real', crFilter);
      });
      
      rows.push(generateRow(item.id, item.code, 'Revenue', item.label, valBudget, valReal, valLY, valPrevia, false, false, 2));
  });

  rows.push(generateRow('SPACER-APT-EXTRA', '', 'Spacer', '', 0, 0, 0, 0, false, false, 0));

  // 1.02 Receitas Extras
  rows.push(generateRow('REV-EXTRA', '1.02', 'Revenue', 'Receitas Extras', 0, 0, 0, 0, true, false, 1));
  
  const revExtraItems = [
      { id: 'REV-EXTRA-LAZER', code: '1.02.01', label: 'Lazer', importName: 'Extra Lazer' },
      { id: 'REV-EXTRA-EVENTOS', code: '1.02.02', label: 'Eventos', importName: 'Extra Eventos' },
  ];

  revExtraItems.forEach(item => {
      const valBudget = getImportedValue(item.label, selectedYear, 'Budget');
      const valReal = getImportedValue(item.label, selectedYear, 'Real');
      const valPrevia = getImportedValue(item.label, selectedYear, 'Previa');
      const valLY = getImportedValue(item.label, (selectedYear || 0) - 1, 'Real');
      rows.push(generateRow(item.id, item.code, 'Revenue', item.label, valBudget, valReal, valLY, valPrevia, false, false, 2));
  });
  
  // 1.03 Cancelamento de Time Share
  const valBudgetTS = getImportedValue('Cancelamento de Time Share', selectedYear, 'Budget');
  const valRealTS = getImportedValue('Cancelamento de Time Share', selectedYear, 'Real');
  const valPreviaTS = getImportedValue('Cancelamento de Time Share', selectedYear, 'Previa');
  const valLYTS = getImportedValue('Cancelamento de Time Share', (selectedYear || 0) - 1, 'Real');
  rows.push(generateRow('REV-TIME', '1.03', 'Revenue', 'Cancelamento de Time Share', valBudgetTS, valRealTS, valLYTS, valPreviaTS, false, false, 1));

  // 1.04 Receita de ISS
  const valBudgetISS = getImportedValue('Receita de ISS', selectedYear, 'Budget');
  const valRealISS = getImportedValue('Receita de ISS', selectedYear, 'Real');
  const valPreviaISS = getImportedValue('Receita de ISS', selectedYear, 'Previa');
  const valLYISS = getImportedValue('Receita de ISS', (selectedYear || 0) - 1, 'Real');
  rows.push(generateRow('REV-ISS', '1.04', 'Revenue', 'Receita de ISS', valBudgetISS, valRealISS, valLYISS, valPreviaISS, false, false, 1));

  rows.push(generateRow('SPACER-BEFORE-IMP', '', 'Spacer', '', 0, 0, 0, 0, false, false, 0));

  // 1.05 Impostos (Azul conforme Receita Líquida, recuo zero)
  const valBudgetImp = getImportedValue('Impostos', selectedYear, 'Budget');
  const valRealImp = getImportedValue('Impostos', selectedYear, 'Real');
  const valPreviaImp = getImportedValue('Impostos', selectedYear, 'Previa');
  const valLYImp = getImportedValue('Impostos', (selectedYear || 0) - 1, 'Real');
  rows.push(generateRow('REV-IMP', '1.05', 'Revenue', 'Impostos', valBudgetImp, valRealImp, valLYImp, valPreviaImp, false, false, 0));

  rows.push(generateRow('SPACER-AFTER-IMP', '', 'Spacer', '', 0, 0, 0, 0, false, false, 0));

  // 3.00 Receita Líquida
  rows.push(generateRow('REV-NET', '3.00', 'Revenue', 'RECEITA LÍQUIDA', 0, 0, 0, 0, true, true, 0)); 
  
  rows.push(generateRow('SPACER-REV-CST', '', 'Spacer', '', 0, 0, 0, 0, false, false, 0));

  // 3. COSTS & EXPENSES (Hierarchical Breakdown)
  rows.push(generateRow('CST-HEAD', '3.00', 'Costs', 'CUSTOS E DESPESAS OPERACIONAIS', 0, 0, 0, 0, true, true, 0));

  // Get unique Package identifiers (Master + Package name) for Expense accounts
  const expenseAccounts = activeAccounts.filter(a => a.classification === 'Expense');
  
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
    const pkgAccs = expenseAccounts.filter(a => a.masterPackage === masterName && a.package === pkgName);
    const pkgCode = pkgAccs[0]?.packageCode || '';
    
    // Check for special drill-down cases
    const isAdminTI = masterName === 'DESPESAS ADMINISTRATIVAS' && pkgAccs.some(acc => acc.name.toLowerCase().includes('processamento de dados') || acc.name.toLowerCase().includes('ti'));
    const isSalesMkt = masterName === 'DESPESAS COM VENDAS E MARKETING' && pkgAccs.some(acc => acc.name.toUpperCase().includes('MARKETING') || acc.name.toUpperCase().includes('PROPAGANDA'));

    let pkgBudget = 0; let pkgReal = 0; let pkgPrevia = 0; let pkgLY = 0;

    if (!isAdminTI && !isSalesMkt) {
       // STANDARD PACKAGE - Aggregate values directly
       pkgAccs.forEach(acc => {
          pkgBudget += getImportedValue(acc.name, selectedYear, 'Budget');
          pkgReal += getImportedValue(acc.name, selectedYear, 'Real');
          pkgPrevia += getImportedValue(acc.name, selectedYear, 'Previa');
          pkgLY += getImportedValue(acc.name, (selectedYear || 0) - 1, 'Real');
       });
       // Level 1 because we removed the Master header
       rows.push(generateRow(`p-${masterName}-${pkgName}`, pkgCode, 'Costs', pkgName, pkgBudget, pkgReal, pkgLY, pkgPrevia, true, false, 1));
    } else {
       // SPECIAL PACKAGE - push the package row as 0 (for child drill-down)
       rows.push(generateRow(`p-${masterName}-${pkgName}`, pkgCode, 'Costs', pkgName, 0, 0, 0, 0, true, false, 1));
       
       // Sort child accounts by their sortOrder
       const sortedPkgAccs = [...pkgAccs].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
       
       sortedPkgAccs.forEach(acc => {
           const accIsAdminTI = isAdminTI && (acc.name.toLowerCase().includes('processamento de dados') || acc.name.toLowerCase().includes('ti'));
           const accIsSalesMkt = isSalesMkt && (acc.name.toUpperCase().includes('MARKETING') || acc.name.toUpperCase().includes('PROPAGANDA')) && !acc.name.includes('(');
           
           if (accIsAdminTI) {
                const subAreas = ['Martech', 'Marketing', 'Outras áreas'];
                subAreas.forEach(sub => {
                  const accName = `Processamento de dados e TI (${sub})`;
                  const crFilter = sub === 'Martech' ? 'Martech' : sub === 'Marketing' ? 'Marketing' : undefined;

                  const aBudget = getImportedValue(acc.name, selectedYear, 'Budget', crFilter) || (getImportedValue(acc.name, selectedYear, 'Budget') / 3);
                  const aReal = getImportedValue(acc.name, selectedYear, 'Real', crFilter) || (getImportedValue(acc.name, selectedYear, 'Real') / 3);
                  const aPrevia = getImportedValue(acc.name, selectedYear, 'Previa', crFilter) || (getImportedValue(acc.name, selectedYear, 'Previa') / 3);
                  const aLY = getImportedValue(acc.name, (selectedYear || 0) - 1, 'Real', crFilter) || (getImportedValue(acc.name, (selectedYear || 0) - 1, 'Real') / 3);

                  rows.push(generateRow(`${acc.id}-${sub}`, acc.code, 'Costs', accName, aBudget, aReal, aLY, aPrevia, false, false, 2));
                });
            } else if (accIsSalesMkt) {
                const subAreas = ['Marketing', 'Martech', 'Outras áreas'];
                subAreas.forEach(sub => {
                  const accName = `${acc.name} (${sub})`;
                  const crFilter = sub === 'Martech' ? 'Martech' : sub === 'Marketing' ? 'Marketing' : undefined;

                  const aBudget = getImportedValue(acc.name, selectedYear, 'Budget', crFilter) || (getImportedValue(acc.name, selectedYear, 'Budget') / 3);
                  const aReal = getImportedValue(acc.name, selectedYear, 'Real', crFilter) || (getImportedValue(acc.name, selectedYear, 'Real') / 3);
                  const aPrevia = getImportedValue(acc.name, selectedYear, 'Previa', crFilter) || (getImportedValue(acc.name, selectedYear, 'Previa') / 3);
                  const aLY = getImportedValue(acc.name, (selectedYear || 0) - 1, 'Real', crFilter) || (getImportedValue(acc.name, (selectedYear || 0) - 1, 'Real') / 3);

                  rows.push(generateRow(`${acc.id}-${sub}`, acc.code, 'Costs', accName, aBudget, aReal, aLY, aPrevia, false, false, 2));
                });
            } else {
                const aBudget = getImportedValue(acc.name, selectedYear, 'Budget');
                const aReal = getImportedValue(acc.name, selectedYear, 'Real');
                const aPrevia = getImportedValue(acc.name, selectedYear, 'Previa');
                const aLY = getImportedValue(acc.name, (selectedYear || 0) - 1, 'Real');
                rows.push(generateRow(acc.id, acc.code, 'Costs', acc.name, aBudget, aReal, aLY, aPrevia, false, false, 2));
            }
       });
    }
  });

  // 4. RESULTS
  rows.push(generateRow('SPACER-RES', '', 'Spacer', '', 0, 0, 0, 0, false, false, 0));
  rows.push(generateRow('RES-OP-SEM-IMP', '6.00.00', 'Result', 'RESULTADO OPERACIONAL (G.O.P) SEM IMPOSTOS', 0, 0, 0, 0, true, true, 0));
  rows.push(generateRow('RES-OP-COM-IMP', '6.01.00', 'Result', 'RESULTADO OPERACIONAL (G.O.P) COM IMPOSTOS', 0, 0, 0, 0, true, true, 0));
  
  // KPI: Transformação / Reatividade
  rows.push(generateRow('KPI-TRANS-BUDGET', '', 'Result', 'Transformação/Reatividade (Meta)', 0, 0, 0, 0, true, true, 0));
  rows.push(generateRow('KPI-TRANS-LY', '', 'Result', 'Transformação/Reatividade (Ano Anterior)', 0, 0, 0, 0, true, true, 0));

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
          else return; 
          if (normScenario === 'REAL') {
              if (activeRealVersionId && row.versionId && row.versionId !== activeRealVersionId) return;
          } else if (normScenario === 'BUDGET') {
              if (row.versionId) {
                const matchesBudget = activeBudgetVersionId && row.versionId === activeBudgetVersionId;
                const matchesReal = activeRealVersionId && row.versionId === activeRealVersionId;
                if (!matchesBudget && !matchesReal) return;
              }
          }
          const normHotel = row.hotel.trim().toUpperCase();
          const val = parseFloat(row.valor.replace(',', '.'));
          if (isNaN(val)) return;
          const normConta = row.conta.trim().toLowerCase();
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

  const getImportedValue = (accountName: string, targetYear: number | undefined, valueCategory: 'Real' | 'Budget' | 'Previa', crFilter?: string) => {
    if (!selectedMonth || !targetYear) return 0;
    const targetName = accountName.trim().toLowerCase();
    const targetCR = crFilter?.trim().toLowerCase();
    let targetScenario = '';
    if (valueCategory === 'Real') targetScenario = 'REAL';
    else if (valueCategory === 'Budget') targetScenario = 'BUDGET';
    else targetScenario = 'PREVIA';
    const hotelsToTry = [selectedHotelName, activeHotelCode].filter(Boolean) as string[];
    let total = 0;
    hotelsToTry.forEach(h => {
        const baseKey = `${targetYear}|${selectedMonth}|${h.trim().toUpperCase()}|${targetScenario}|${targetName}`;
        if (targetCR) {
            total += dataIndex.get(`${baseKey}|${targetCR}`) || 0;
        } else {
            total += dataIndex.get(baseKey) || 0;
        }
    });
    return total;
  };

  const getRealOccValue = (rowId: string) => {
    const contextKey = `${selectedHotelName}_${selectedYear}_${selectedMonth}`;
    return realOccupancyData[contextKey]?.[rowId];
  };

  // --- BUILD ROWS BASED ON STRUCTURE ---
  structure.forEach(section => {
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

      const valBudget = getImportedValue(pkg.name, selectedYear, 'Budget');
      const valReal = getImportedValue(pkg.name, selectedYear, 'Real');
      const valPrevia = getImportedValue(pkg.name, selectedYear, 'Previa');
      const valLY = getImportedValue(pkg.name, (selectedYear || 0) - 1, 'Real');

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

      // 3. Optional: Accounts within package
      const pkgAccs = currentAccounts.filter(a => a.package === pkg.name || a.packageId === pkg.id);
      
      pkgAccs.forEach(acc => {
        // --- CUSTOM LOGIC FOR TI/MARKETING BREAKDOWN ---
        const isAdminTI = pkg.name === 'DESPESAS ADMINISTRATIVAS' && (acc.name.toLowerCase().includes('processamento de dados') || acc.name.toLowerCase().includes('ti'));
        const isSalesMkt = pkg.name === 'DESPESAS COM VENDAS E MARKETING';

        if (isAdminTI) {
            // Split TI into Martech, Marketing, Outras áreas
            const subAreas = ['Martech', 'Marketing', 'Outras áreas'];
            subAreas.forEach(sub => {
                // For demo/mock purposes, we filter by CR or just split if no data
                // In a real scenario, we'd check if the CR belongs to Martech/Marketing/Others
                const accName = `Processamento de dados e TI (${sub})`;
                const crFilter = sub === 'Martech' ? 'Martech' : sub === 'Marketing' ? 'Marketing' : undefined;

                const accBudget = getImportedValue(acc.name, selectedYear, 'Budget', crFilter) || (getImportedValue(acc.name, selectedYear, 'Budget') / 3);
                const accReal = getImportedValue(acc.name, selectedYear, 'Real', crFilter) || (getImportedValue(acc.name, selectedYear, 'Real') / 3);
                const accPrevia = getImportedValue(acc.name, selectedYear, 'Previa', crFilter) || (getImportedValue(acc.name, selectedYear, 'Previa') / 3);
                const accLY = getImportedValue(acc.name, (selectedYear || 0) - 1, 'Real', crFilter) || (getImportedValue(acc.name, (selectedYear || 0) - 1, 'Real') / 3);

                rows.push(generateRow(
                  `${acc.id}-${sub}`, 
                  acc.code, 
                  'Account', 
                  accName, 
                  accBudget, accReal, accLY, accPrevia, 
                  false, 
                  false, 
                  2
                ));
            });
            return; // Skip original TI row
        }

        if (isSalesMkt) {
            // Check if this account should be split or handled specifically
            const isMktTarget = acc.name.toUpperCase().includes('MARKETING') || acc.name.toUpperCase().includes('PROPAGANDA');
            if (isMktTarget && !acc.name.includes('(')) {
                const subAreas = ['Martech', 'Marketing', 'Outras áreas'];
                subAreas.forEach(sub => {
                    const accName = `${acc.name} (${sub})`;
                    const crFilter = sub === 'Martech' ? 'Martech' : sub === 'Marketing' ? 'Marketing' : undefined;

                    const accBudget = getImportedValue(acc.name, selectedYear, 'Budget', crFilter) || (getImportedValue(acc.name, selectedYear, 'Budget') / 3);
                    const accReal = getImportedValue(acc.name, selectedYear, 'Real', crFilter) || (getImportedValue(acc.name, selectedYear, 'Real') / 3);
                    const accPrevia = getImportedValue(acc.name, selectedYear, 'Previa', crFilter) || (getImportedValue(acc.name, selectedYear, 'Previa') / 3);
                    const accLY = getImportedValue(acc.name, (selectedYear || 0) - 1, 'Real', crFilter) || (getImportedValue(acc.name, (selectedYear || 0) - 1, 'Real') / 3);

                    rows.push(generateRow(`${acc.id}-${sub}`, acc.code, 'Account', accName, accBudget, accReal, accLY, accPrevia, false, false, 2));
                });
                return;
            }
        }

        const accBudget = getImportedValue(acc.name, selectedYear, 'Budget');
        const accReal = getImportedValue(acc.name, selectedYear, 'Real');
        const accPrevia = getImportedValue(acc.name, selectedYear, 'Previa');
        const accLY = getImportedValue(acc.name, (selectedYear || 0) - 1, 'Real');

        rows.push(generateRow(
          acc.id, 
          acc.code, 
          'Account', 
          acc.name, 
          accBudget, accReal, accLY, accPrevia, 
          false, 
          false, 
          2
        ));
      });
    });

    // Add a spacer after each section
    rows.push(generateRow(`spacer-${section.id}`, '', 'Spacer', '', 0, 0, 0, 0, false, false, 0));
  });

  return rows;
};
