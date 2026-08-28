import { UserRole, PermissionMatrix } from '../types';

// Catálogo de permissões: cada linha usa `rolesFor(...)` (lista só os perfis que já podem fazer
// aquilo HOJE de verdade no código, via `hasRole`/gate de tela) em vez de escrever os 7 campos por
// extenso. IMPORTANTE: sempre que uma função/ação nova for adicionada ao sistema, adicionar também
// uma linha aqui (ver memória do projeto sobre isso).
const ALL_ROLES = Object.values(UserRole);
const rolesFor = (...trueRoles: UserRole[]): Record<UserRole, boolean> => {
  const map = {} as Record<UserRole, boolean>;
  ALL_ROLES.forEach(r => { map[r] = trueRoles.includes(r); });
  return map;
};

// Fonte única do catálogo — usada tanto pro boot em App.tsx (religa a Matriz de verdade, via
// `hasPermission`) quanto pra tela de edição em UnifiedAdministrationView.tsx.
export const DEFAULT_PERMISSIONS_MATRIX: PermissionMatrix = {
  'GMD': {
    'Criar Nova Versão GMD': rolesFor(UserRole.ADMIN, UserRole.COST_ANALYST),
    'Aprovar Fechamento GMD': rolesFor(UserRole.ADMIN, UserRole.DIRETORIA),
    'Justificar Desvios': rolesFor(UserRole.ADMIN, UserRole.ENTITY_MANAGER, UserRole.PACKAGE_MANAGER, UserRole.AREA_MANAGER, UserRole.COST_ANALYST, UserRole.AREA_ANALYST),
    'Confirmar Conclusão / Marcar Atrasado (Plano de Ação)': rolesFor(UserRole.ADMIN, UserRole.ENTITY_MANAGER, UserRole.COST_ANALYST),
    'Salvar Progresso da Execução (Plano de Ação)': rolesFor(UserRole.ADMIN, UserRole.ENTITY_MANAGER, UserRole.PACKAGE_MANAGER, UserRole.AREA_MANAGER, UserRole.COST_ANALYST, UserRole.AREA_ANALYST)
  },
  'Cadastros e Configurações': {
    'Tabela de Usuários': rolesFor(UserRole.ADMIN),
    'Plano de Contas Master/Pacote': rolesFor(UserRole.ADMIN, UserRole.COST_ANALYST),
    'Configuração de Setores (CR/PDV)': rolesFor(UserRole.ADMIN, UserRole.COST_ANALYST),
  },
  'DRE Forecast': {
    'Criar Nova Reunião (Prévia)': rolesFor(UserRole.ADMIN, UserRole.ENTITY_MANAGER, UserRole.COST_ANALYST, UserRole.PACKAGE_MANAGER),
    'Excluir Reunião (Prévia)': rolesFor(UserRole.ADMIN, UserRole.ENTITY_MANAGER, UserRole.COST_ANALYST),
    'Editar Valores da Prévia/Real (contas, pacotes, indicadores)': rolesFor(UserRole.ADMIN, UserRole.ENTITY_MANAGER, UserRole.COST_ANALYST, UserRole.PACKAGE_MANAGER),
    'Calcular Forecast / Iniciar Projeção': rolesFor(UserRole.ADMIN, UserRole.ENTITY_MANAGER, UserRole.COST_ANALYST, UserRole.PACKAGE_MANAGER),
    'Salvar Projeção / Validar Fechamento': rolesFor(UserRole.ADMIN, UserRole.ENTITY_MANAGER, UserRole.COST_ANALYST),
    'Reabrir Versão Validada para Edição': rolesFor(UserRole.ADMIN, UserRole.ENTITY_MANAGER, UserRole.COST_ANALYST),
    'Selecionar Versão "Realizado"': rolesFor(UserRole.ADMIN),
    'Gerar Apresentação (Google Slides)': rolesFor(UserRole.ADMIN, UserRole.ENTITY_MANAGER, UserRole.COST_ANALYST),
    'Editar Comentários nas Células': rolesFor(...ALL_ROLES),
  },
  'Ocupação': {
    'Editar Ocupação (Real/Prévia)': rolesFor(UserRole.ADMIN, UserRole.ENTITY_MANAGER, UserRole.COST_ANALYST),
    'Salvar / Limpar Dados de Ocupação': rolesFor(UserRole.ADMIN, UserRole.ENTITY_MANAGER, UserRole.COST_ANALYST),
  },
  'Revisão de Metas': {
    'Acessar Revisão de Metas': rolesFor(UserRole.ADMIN, UserRole.ENTITY_MANAGER, UserRole.COST_ANALYST),
    'Criar Réplica / Editar Meta em Revisão': rolesFor(UserRole.ADMIN, UserRole.ENTITY_MANAGER, UserRole.COST_ANALYST),
  },
  'Tabela de GOP': {
    'Gerar PDF da Tabela de GOP': rolesFor(...ALL_ROLES),
    'Usar Modo Projeção (Simulação WHAT IF)': rolesFor(...ALL_ROLES),
  },
  'Validações': {
    'Acessar Tela de Validações': rolesFor(UserRole.ADMIN),
  },
  'Administração — Acesso': {
    'Acessar Área de Administração': rolesFor(UserRole.ADMIN),
  },
  'Administração — Usuários': {
    'Gerenciar Usuários (criar/editar/excluir)': rolesFor(UserRole.ADMIN),
  },
  'Administração — Hotéis': {
    'Gerenciar Hotéis, Categorias e Regiões': rolesFor(UserRole.ADMIN),
  },
  'Administração — Setores': {
    'Gerenciar Setores (Centros de Custo)': rolesFor(UserRole.ADMIN),
  },
  'Administração — Plano de Contas e Pacotes': {
    'Gerenciar Plano de Contas e Pacotes': rolesFor(UserRole.ADMIN),
    'Configurar Estrutura da DRE': rolesFor(UserRole.ADMIN),
  },
  'Administração — GMD (Configurações)': {
    'Gerenciar Configurações de GMD': rolesFor(UserRole.ADMIN),
  },
  'Administração — Permissões': {
    'Editar Matriz de Permissões': rolesFor(UserRole.ADMIN),
  },
  'Administração — Importação': {
    'Importar Despesas / Receitas / Impostos (Real e Budget)': rolesFor(UserRole.ADMIN),
    'Importar Ocupação': rolesFor(UserRole.ADMIN),
    'Importar Plano de Contas / Setores (balancete, CSV)': rolesFor(UserRole.ADMIN),
    'Editar ou Excluir Importação Existente': rolesFor(UserRole.ADMIN),
  },
  'Administração — Versões': {
    'Criar Nova Versão (Real ou Budget)': rolesFor(UserRole.ADMIN),
    'Tornar Versão Principal': rolesFor(UserRole.ADMIN),
    'Bloquear / Desbloquear Versão': rolesFor(UserRole.ADMIN),
    'Excluir Versão': rolesFor(UserRole.ADMIN),
    'Replicar Orçamento': rolesFor(UserRole.ADMIN),
  },
  'Administração — Logs': {
    'Acessar Logs de Importação': rolesFor(UserRole.ADMIN),
  },
};

// Mescla o catálogo (sempre a fonte de quais categorias/ações existem, vem do código) com o que
// já foi salvo no Supabase (só os valores marcados/desmarcados de cada célula, quando existirem).
// Categoria/ação que exista no banco mas não exista mais no catálogo é ignorada.
export const mergePermissionsMatrix = (
  catalog: PermissionMatrix,
  saved: PermissionMatrix
): PermissionMatrix => {
  const merged: PermissionMatrix = {};
  Object.entries(catalog).forEach(([category, actions]) => {
    merged[category] = {};
    Object.entries(actions).forEach(([action, defaultRoles]) => {
      merged[category][action] = saved?.[category]?.[action] || defaultRoles;
    });
  });
  return merged;
};
