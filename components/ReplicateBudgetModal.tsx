import React, { useState } from 'react';
import { BudgetVersion } from '../types';

interface ReplicateBudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetYear: number;
  targetMonth: number;
  availableVersions: BudgetVersion[];
  budgetVersions?: BudgetVersion[];
  mode?: 'BUDGET' | 'REAL';
  onReplicate: (sourceVersionId: string, options: ReplicationOptions) => void;
}

export interface ReplicationOptions {
  type: 'exact' | 'new_projected' | 'pull_budget_meta';
  name: string;
  sourceVersionId: string;
  budgetYear?: number;
  insertNewOccupancy: boolean;
  projectFixedWithInflation: boolean;
  inflationRate?: number;
  projectVariableWithOCC: boolean;
}

const ReplicateBudgetModal: React.FC<ReplicateBudgetModalProps> = ({
  isOpen,
  onClose,
  targetYear,
  targetMonth,
  availableVersions,
  budgetVersions = [],
  mode = 'BUDGET',
  onReplicate
}) => {
  const [sourceVersionId, setSourceVersionId] = useState<string>('');
  const [replicationType, setReplicationType] = useState<'exact' | 'new_projected' | 'pull_budget_meta'>(mode === 'REAL' ? 'pull_budget_meta' : 'exact');
  const [versionName, setVersionName] = useState<string>(`${mode === 'REAL' ? 'Planejamento' : 'Orçamento'} ${targetYear}`);
  const [selectedBudgetYear, setSelectedBudgetYear] = useState<number>(targetYear);
  
  // New options state
  const [insertNewOccupancy, setInsertNewOccupancy] = useState(true);
  const [projectFixedWithInflation, setProjectFixedWithInflation] = useState(true);
  const [inflationRate, setInflationRate] = useState<number>(4.5); // Default inflation
  const [projectVariableWithOCC, setProjectVariableWithOCC] = useState(true);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (replicationType !== 'pull_budget_meta' && !sourceVersionId) {
      alert('Selecione uma versão de origem para servir de base.');
      return;
    }
    if (!versionName) {
      alert('Informe um nome para a nova versão.');
      return;
    }

    onReplicate(sourceVersionId, {
      type: replicationType,
      name: versionName,
      sourceVersionId,
      budgetYear: replicationType === 'pull_budget_meta' ? selectedBudgetYear : undefined,
      insertNewOccupancy: replicationType === 'new_projected' ? insertNewOccupancy : false,
      projectFixedWithInflation: replicationType === 'new_projected' ? projectFixedWithInflation : false,
      inflationRate: (replicationType === 'new_projected' && projectFixedWithInflation) ? inflationRate : undefined,
      projectVariableWithOCC: replicationType === 'new_projected' ? projectVariableWithOCC : false,
    });
  };

  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <h3 className="text-lg font-medium text-gray-900">
            {mode === 'REAL' ? 'Novo Planejamento' : 'Replicar Orçamento'} - {months[targetMonth - 1]} {targetYear}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nome da Nova Versão
            </label>
            <input
              type="text"
              value={versionName}
              onChange={(e) => setVersionName(e.target.value)}
              className="w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-[#38b2ac] focus:border-[#38b2ac]"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Versão de Origem
            </label>
            <select
              value={sourceVersionId}
              onChange={(e) => setSourceVersionId(e.target.value)}
              className="w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-[#38b2ac] focus:border-[#38b2ac]"
              required
            >
              <option value="">Selecione uma versão...</option>
              {availableVersions.map(v => (
                <option key={v.id} value={v.id}>
                  {v.year} - {v.name} {v.month ? `(${months[v.month - 1]})` : ''}
                </option>
              ))}
            </select>
          </div>

          {mode === 'REAL' && (
             <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Opções de Meta (Realizado)
                </label>
                <div className="space-y-3">
                  <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 border-teal-500 bg-teal-50">
                    <input
                      type="radio"
                      name="replicationType"
                      value="pull_budget_meta"
                      checked={replicationType === 'pull_budget_meta'}
                      onChange={() => setReplicationType('pull_budget_meta')}
                      className="mt-1 text-[#38b2ac] focus:ring-[#38b2ac]"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-teal-900">Puxar Meta do Tauá Budget</div>
                      <div className="text-sm text-teal-700 mb-2">Importar os valores orçados no módulo Budget para esta versão de Realizado.</div>
                      
                      {replicationType === 'pull_budget_meta' && (
                        <div className="mt-2 bg-white/50 p-2 rounded">
                          <label className="text-xs font-bold text-teal-800 uppercase block mb-1">Ano do Orçamento Origem</label>
                          <select 
                            value={selectedBudgetYear}
                            onChange={(e) => setSelectedBudgetYear(parseInt(e.target.value))}
                            className="w-full text-sm border-teal-200 rounded focus:ring-teal-500 focus:border-teal-500"
                          >
                            {Array.from(new Set(budgetVersions.map(v => v.year))).sort((a,b) => b-a).map(year => (
                              <option key={year} value={year}>{year}</option>
                            ))}
                            <option value={targetYear}>{targetYear} (Atual)</option>
                          </select>
                        </div>
                      )}
                    </div>
                  </label>
                </div>
             </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              {mode === 'REAL' ? 'Outras Opções (Cópia)' : 'Como deseja criar a nova versão?'}
            </label>
            <div className="space-y-3">
              <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="replicationType"
                  value="exact"
                  checked={replicationType === 'exact'}
                  onChange={() => setReplicationType('exact')}
                  className="mt-1 text-[#38b2ac] focus:ring-[#38b2ac]"
                />
                <div>
                  <div className="font-medium text-gray-900">Fazer exatamente uma cópia de alguma versão</div>
                  <div className="text-sm text-gray-500">Criar uma cópia idêntica da versão selecionada.</div>
                </div>
              </label>
              
              <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="replicationType"
                  value="new_projected"
                  checked={replicationType === 'new_projected'}
                  onChange={() => setReplicationType('new_projected')}
                  className="mt-1 text-[#38b2ac] focus:ring-[#38b2ac]"
                />
                <div>
                  <div className="font-medium text-gray-900">Iniciar uma nova versão</div>
                  <div className="text-sm text-gray-500">Criar uma nova versão com projeções e novos dados.</div>
                </div>
              </label>
            </div>
          </div>

          {replicationType === 'new_projected' && (
            <div className="space-y-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="insertNewOccupancy"
                  checked={insertNewOccupancy}
                  onChange={(e) => setInsertNewOccupancy(e.target.checked)}
                  className="rounded text-[#38b2ac] focus:ring-[#38b2ac]"
                />
                <label htmlFor="insertNewOccupancy" className="text-sm font-medium text-gray-700">
                  Deseja inserir a nova ocupação?
                </label>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="projectFixed"
                    checked={projectFixedWithInflation}
                    onChange={(e) => setProjectFixedWithInflation(e.target.checked)}
                    className="rounded text-[#38b2ac] focus:ring-[#38b2ac]"
                  />
                  <label htmlFor="projectFixed" className="text-sm font-medium text-gray-700">
                    Projetar despesas fixas baseado na inflação?
                  </label>
                </div>
                
                {projectFixedWithInflation && (
                  <div className="ml-7">
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Inflação Projetada (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={inflationRate}
                      onChange={(e) => setInflationRate(parseFloat(e.target.value) || 0)}
                      className="w-full border border-gray-300 rounded-md shadow-sm p-1.5 text-sm focus:ring-[#38b2ac] focus:border-[#38b2ac]"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="projectVariable"
                  checked={projectVariableWithOCC}
                  onChange={(e) => setProjectVariableWithOCC(e.target.checked)}
                  className="rounded text-[#38b2ac] focus:ring-[#38b2ac]"
                />
                <label htmlFor="projectVariable" className="text-sm font-medium text-gray-700">
                  Projetar variáveis de acordo com os novos indicadores de OCC?
                </label>
              </div>
              
              <p className="text-[10px] text-gray-400 italic mt-2">
                * Definições de fixo/variável conforme Administração {'>'} Tauá Budget {'>'} Característica da despesa.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-[#38b2ac] rounded-md hover:bg-[#319795]"
            >
              Replicar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReplicateBudgetModal;
