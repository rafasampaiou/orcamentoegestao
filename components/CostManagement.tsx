import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Plus, FileSpreadsheet, Settings2 } from 'lucide-react';
import { mockAccounts, mockPackages } from '../services/mockData';

const CostManagement: React.FC = () => {
  const [expandedPackages, setExpandedPackages] = useState<string[]>(['pkg1']);

  const togglePackage = (pkgId: string) => {
    setExpandedPackages(prev => 
      prev.includes(pkgId) ? prev.filter(id => id !== pkgId) : [...prev, pkgId]
    );
  };

  const getAccountsForPackage = (pkgId: string) => mockAccounts.filter(acc => acc.packageId === pkgId);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-full">
      <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-gray-50">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Custos & Despesas</h2>
          <p className="text-sm text-gray-500">Gestão Hierárquica e Parâmetros de Variação</p>
        </div>
        <div className="flex gap-2">
            <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 bg-white text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">
                <FileSpreadsheet size={16} />
                Importar Contas
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
                <Plus size={16} />
                Nova Conta
            </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="space-y-3">
          {mockPackages.map(pkg => {
            const isExpanded = expandedPackages.includes(pkg.id);
            const accounts = getAccountsForPackage(pkg.id);

            return (
              <div key={pkg.id} className="border border-gray-200 rounded-lg overflow-hidden">
                <div 
                  onClick={() => togglePackage(pkg.id)}
                  className="w-full flex items-center justify-between p-4 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? <ChevronDown size={18} className="text-gray-500" /> : <ChevronRight size={18} className="text-gray-500" />}
                    <div>
                        <span className="text-xs font-mono text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded mr-2">{pkg.code}</span>
                        <span className="font-semibold text-gray-800">{pkg.name}</span>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    {accounts.length} Contas Contábeis
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-200">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-xs uppercase text-gray-500 font-semibold">
                            <tr>
                                <th className="px-6 py-3 text-left">Conta</th>
                                <th className="px-4 py-3 text-left">Descrição</th>
                                <th className="px-4 py-3 text-left">Tipo de Custo</th>
                                <th className="px-4 py-3 text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {accounts.map(acc => (
                                <tr key={acc.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-3 font-mono text-gray-600">{acc.code}</td>
                                    <td className="px-4 py-3 font-medium text-gray-800">{acc.name}</td>
                                    <td className="px-4 py-3">
                                        <span className={`
                                            inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                                            ${acc.type === 'Fixed' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}
                                        `}>
                                            {acc.type.replace('_', ' ')}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <button className="text-gray-400 hover:text-indigo-600 p-1">
                                            <Settings2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {accounts.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-8 text-center text-gray-400 italic">
                                        Nenhuma conta cadastrada neste pacote.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CostManagement;