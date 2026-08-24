import React, { useState } from 'react';
import { ValidationRecord, Hotel, User, PermissionMatrix, hasPermission, hasRole, UserRole } from '../types';
import { Filter, Building2, CheckCircle2, ArrowRight, Clock, Trash2, AlertTriangle, RefreshCw } from 'lucide-react';

const MONTH_NAMES_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

interface ValidationsViewProps {
  validations: ValidationRecord[];
  hotels: Hotel[];
  currentUser?: User;
  permissionsMatrix: PermissionMatrix;
  onNavigateToValidation?: (validation: ValidationRecord) => void;
  // Exclui a reunião de verdade (reunião + validação + dados salvos sob ela) — botão novo em
  // Validações, não disponível pra "Realizado" (não é uma reunião criada, é o fechamento
  // gerencial fixo).
  onDeleteMeeting?: (validation: ValidationRecord) => void;
  // "Sincronizar importações" (ADMIN) — cria a validação "Realizado" que ficou faltando pra
  // importações de Despesas/Impostos/Receita (cenário Real) feitas ANTES do auto-validar na
  // importação ter sido ligado. Idempotente, pode clicar mais de uma vez sem duplicar.
  onBackfillRealizado?: () => void;
}

const ValidationsView: React.FC<ValidationsViewProps> = ({ validations, hotels, currentUser, permissionsMatrix, onNavigateToValidation, onDeleteMeeting, onBackfillRealizado }) => {
  const [selectedHotel, setSelectedHotel] = useState<string>('all');
  const [selectedProjection, setSelectedProjection] = useState<string>('all');
  const [pendingDelete, setPendingDelete] = useState<ValidationRecord | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const canDeleteMeeting = hasPermission(permissionsMatrix, currentUser, 'DRE Forecast', 'Excluir Reunião (Prévia)');
  const isAdmin = hasRole(currentUser, UserRole.ADMIN);

  // Sem filtro de mês/ano — mostra o histórico inteiro, sempre ordenado por ano/mês (mais
  // recente primeiro), a pedido do usuário.
  const filteredValidations = validations
    .filter(v => {
        if (selectedHotel !== 'all' && v.hotelId !== selectedHotel) return false;
        if (selectedProjection !== 'all') {
            const matches = selectedProjection === 'Realizado'
                ? v.projectionType === 'Realizado'
                : v.meetingKind === selectedProjection;
            if (!matches) return false;
        }
        return true;
    })
    .sort((a, b) => (b.year - a.year) || (b.month - a.month));

  return (
    <div className="flex flex-col h-full bg-gray-50/50 p-6">
      <div className="max-w-6xl mx-auto w-full flex flex-col h-full gap-6">
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Histórico de Validações</h2>
              <p className="text-gray-500 mt-1">Acompanhe as validações de Previa e Forecast por unidade.</p>
            </div>
            <div className="flex items-center gap-4">
                {isAdmin && onBackfillRealizado && (
                    <button
                        onClick={async () => {
                            setIsSyncing(true);
                            try { await onBackfillRealizado(); } finally { setIsSyncing(false); }
                        }}
                        disabled={isSyncing}
                        title="Cria a validação 'Realizado' pra hotéis/meses já importados (Despesas/Impostos/Receita) que ainda não apareciam aqui"
                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-sm font-bold border border-indigo-100 transition-colors disabled:opacity-50"
                    >
                        <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                        Sincronizar importações
                    </button>
                )}
                <div className="text-right">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Total</span>
                    <span className="text-2xl font-bold text-indigo-700">{filteredValidations.length}</span>
                </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                <Building2 size={12} />
                Unidade
              </label>
              <select 
                className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 p-2.5 outline-none font-medium"
                value={selectedHotel}
                onChange={(e) => setSelectedHotel(e.target.value)}
              >
                <option value="all">Todas as Unidades</option>
                {hotels.map(h => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                <Filter size={12} />
                Reunião
              </label>
              <select 
                className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 p-2.5 outline-none font-medium"
                value={selectedProjection}
                onChange={(e) => setSelectedProjection(e.target.value)}
              >
                <option value="all">Todas</option>
                <option value="Reunião de Ritmo">Reunião de Ritmo</option>
                <option value="FCA N2">FCA N2</option>
                <option value="FCA N1">FCA N1</option>
                <option value="Fechamento">Fechamento</option>
                <option value="Realizado">Realizado</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex-1 overflow-hidden flex flex-col">
            <div className="overflow-auto flex-1 p-0">
                {filteredValidations.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center p-12 text-center text-gray-500">
                        <CheckCircle2 size={48} className="text-gray-300 mb-4" />
                        <h3 className="text-xl font-bold text-gray-700 mb-2">Nenhuma validação encontrada</h3>
                        <p>Não há registros de validação com os filtros selecionados.</p>
                    </div>
                ) : (
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Período</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Data / Hora</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Unidade</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Usuário</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Reunião</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Status</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredValidations.map(validation => {
                                const h = hotels.find(h => h.id === validation.hotelId || h.name === validation.hotelId);
                                const d = new Date(validation.validatedAt);
                                return (
                                    <tr key={validation.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 font-bold text-gray-700">
                                            {MONTH_NAMES_PT[validation.month - 1]}/{validation.year}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-gray-900">{d.toLocaleDateString('pt-BR')}</div>
                                            <div className="text-xs text-gray-500">{d.toLocaleTimeString('pt-BR')}</div>
                                        </td>
                                        <td className="px-6 py-4 font-bold text-indigo-700">
                                            {h?.name || validation.hotelId}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-gray-900">{validation.userName}</div>
                                            <div className="text-xs text-gray-500">Validado via sistema</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-sm font-bold border border-blue-100">
                                                {validation.meetingLabel || validation.projectionType}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {validation.status === 'Em construção' ? (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 rounded-lg text-sm font-bold border border-amber-100">
                                                    <Clock size={16} />
                                                    Em construção
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-bold border border-emerald-100">
                                                    <CheckCircle2 size={16} />
                                                    Validado
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {onNavigateToValidation && (
                                                    <button
                                                        onClick={() => onNavigateToValidation(validation)}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-sm font-bold border border-indigo-100 transition-colors"
                                                    >
                                                        Ir para Forecast
                                                        <ArrowRight size={14} />
                                                    </button>
                                                )}
                                                {onDeleteMeeting && canDeleteMeeting && validation.projectionType !== 'Realizado' && (
                                                    <button
                                                        onClick={() => setPendingDelete(validation)}
                                                        title="Excluir esta reunião"
                                                        className="inline-flex items-center justify-center p-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg border border-red-100 transition-colors"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
      </div>

      {pendingDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm overflow-hidden">
            <div className="p-6 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
                <AlertTriangle size={24} />
              </div>
              <h3 className="text-lg font-medium text-gray-900">Excluir Reunião</h3>
              <p className="text-sm text-gray-500">
                Tem certeza que deseja excluir a reunião "{pendingDelete.meetingLabel || pendingDelete.projectionType}"? Isso apaga TODOS os dados
                salvos nela (ocupação, valores da prévia, comentários e apresentações geradas). Esta ação não pode ser desfeita.
              </p>
              <div className="flex justify-center gap-3 pt-4">
                <button onClick={() => setPendingDelete(null)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    onDeleteMeeting?.(pendingDelete);
                    setPendingDelete(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
                >
                  Excluir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ValidationsView;
