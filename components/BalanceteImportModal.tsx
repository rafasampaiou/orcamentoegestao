import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { X, Upload, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Account, ImportedRow } from '../types';
import { supabaseService } from '../services/supabaseService';
import toast from 'react-hot-toast';

interface BalanceteImportModalProps {
    accounts: Account[];
    hotel: string;
    year: number;
    month: number;
    versionId: string;
    onImportData: (rows: ImportedRow[], mode: 'append' | 'replace') => void;
    // Onde os 2 valores especiais (Imposto/Time Share) ficam guardados — mesmo bucket do dia OTB.
    otbContextKey: string;
    setRealOccupancyData: React.Dispatch<React.SetStateAction<Record<string, Record<string, number>>>>;
    onClose: () => void;
}

// Códigos fixos do balancete que alimentam linhas específicas da DRE Forecast (coluna OTB),
// em vez de ficarem misturados no total genérico de despesas.
const IMPOSTO_CODE = '3.01.04.02';
const TIME_SHARE_CODE = '3.01.03.01';

interface DespesaRow {
    hierarquico: string;
    descricao: string;
    movimento: number;
    matchLevel: 'account' | 'package' | 'master' | null;
    matchedName: string | null;
}

interface ParsedBalancete {
    ativoTotal: number;
    passivoTotal: number;
    impostoVal: number;
    timeShareVal: number;
    despesas: DespesaRow[];
}

// Aceita o cabeçalho com pequenas variações de acento/caixa, já que arquivos de balancete
// exportados por sistemas contábeis diferentes podem vir escritos de formas ligeiramente diferentes.
const findKey = (row: Record<string, any>, candidates: string[]): string | undefined => {
    const keys = Object.keys(row);
    const norm = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    return keys.find(k => candidates.some(c => norm(k) === norm(c)));
};

// Casa o código pelo Plano de Contas em 3 níveis (conta > pacote > pacote master, nessa ordem de
// prioridade) — os códigos de pacote/master são campos denormalizados em cada Account
// (packageCode/masterPackageCode), não existe um cadastro de pacote separado.
const matchByCode = (hierarquico: string, accounts: Account[]): { level: 'account' | 'package' | 'master'; name: string } | null => {
    const acc = accounts.find(a => (a.code || '').trim() === hierarquico);
    if (acc) return { level: 'account', name: acc.name };
    const pkgAcc = accounts.find(a => (a.packageCode || '').trim() === hierarquico);
    if (pkgAcc) return { level: 'package', name: pkgAcc.package || '' };
    const masterAcc = accounts.find(a => (a.masterPackageCode || '').trim() === hierarquico);
    if (masterAcc) return { level: 'master', name: masterAcc.masterPackage || '' };
    return null;
};

const BalanceteImportModal: React.FC<BalanceteImportModalProps> = ({ accounts, hotel, year, month, versionId, onImportData, otbContextKey, setRealOccupancyData, onClose }) => {
    const [parsed, setParsed] = useState<ParsedBalancete | null>(null);
    const [fileName, setFileName] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [imported, setImported] = useState(false);

    const handleFile = async (file: File) => {
        setFileName(file.name);
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const json: Record<string, any>[] = XLSX.utils.sheet_to_json(firstSheet);

        if (json.length === 0) {
            toast.error('Planilha vazia ou sem cabeçalho reconhecível.');
            return;
        }

        const hierKey = findKey(json[0], ['Hierarquico', 'Hierárquico']);
        const descKey = findKey(json[0], ['Descricao', 'Descrição']);
        const movKey = findKey(json[0], ['Movimento']);

        if (!hierKey || !descKey || !movKey) {
            toast.error('Não encontrei as colunas Hierarquico/Descricao/Movimento nessa planilha.');
            return;
        }

        let ativoTotal = 0;
        let passivoTotal = 0;
        let impostoVal = 0;
        let timeShareVal = 0;
        const despesas: DespesaRow[] = [];

        json.forEach(r => {
            const hierarquico = String(r[hierKey] ?? '').trim();
            const descricao = String(r[descKey] ?? '').trim();
            const movimentoRaw = r[movKey];
            const movimento = typeof movimentoRaw === 'number' ? movimentoRaw : parseFloat(String(movimentoRaw ?? '0').replace(',', '.')) || 0;
            if (!hierarquico) return;

            // 1 (Ativo) e 2 (Passivo) — só um resumo pra referência, não entram no import nem nos cards.
            if (hierarquico.startsWith('1')) { ativoTotal += movimento; return; }
            if (hierarquico.startsWith('2')) { passivoTotal += movimento; return; }

            // 3 — só os 2 códigos fixos interessam (alimentam Imposto/Cancelamento de Time Share);
            // qualquer outro código "3" é ignorado.
            if (hierarquico.startsWith('3')) {
                if (hierarquico === IMPOSTO_CODE) impostoVal += movimento;
                else if (hierarquico === TIME_SHARE_CODE) timeShareVal += movimento;
                return;
            }

            // 4 — despesas do Plano de Contas, casadas por código (conta, pacote ou pacote master).
            if (hierarquico.startsWith('4')) {
                const match = matchByCode(hierarquico, accounts);
                despesas.push({ hierarquico, descricao, movimento, matchLevel: match?.level || null, matchedName: match?.name || null });
                return;
            }
            // Outros prefixos (5, 6...): fora do escopo pedido, ignorados.
        });

        setParsed({ ativoTotal, passivoTotal, impostoVal, timeShareVal, despesas });
    };

    const matchedDespesas = parsed?.despesas.filter(r => r.matchLevel) || [];
    const unmatchedCount = (parsed?.despesas.length || 0) - matchedDespesas.length;
    const despesasTotal = matchedDespesas.reduce((s, r) => s + r.movimento, 0);

    const levelLabel = (level: DespesaRow['matchLevel']) => {
        if (level === 'account') return 'Conta';
        if (level === 'package') return 'Pacote';
        if (level === 'master') return 'Pacote Master';
        return null;
    };

    const handleConfirm = async () => {
        if (!parsed) return;
        setIsSaving(true);
        try {
            const importId = `otb-balancete-${Date.now()}`;
            // Só as linhas "4" com correspondência no Plano de Contas viram lançamento — sem
            // conta/pacote pra atribuir, o valor fica de fora (mas continua visível na prévia).
            const importedRows: ImportedRow[] = matchedDespesas.map(r => ({
                ano: String(year),
                mes: String(month),
                cenario: 'OTB',
                tipo: 'Despesa',
                hotel,
                conta: r.matchedName || '',
                cr: '',
                valor: String(r.movimento),
                status: 'valid',
                versionId,
                importId,
            }));
            if (importedRows.length > 0) {
                await supabaseService.saveFinancialData(importedRows, importId);
                onImportData(importedRows, 'append');
            }

            // Imposto e Cancelamento de Time Share não são "contas" — vão direto no mesmo bucket
            // do dia OTB, de onde a DRE Forecast lê o valor pronto pra essas 2 linhas específicas.
            setRealOccupancyData(prev => ({
                ...prev,
                [otbContextKey]: {
                    ...(prev[otbContextKey] || {}),
                    '__balancete_imposto': parsed.impostoVal,
                    '__balancete_time_share': parsed.timeShareVal,
                }
            }));

            toast.success(`${importedRows.length} lançamentos de despesa importados.`);
            setImported(true);
        } catch (err: any) {
            toast.error('Erro ao importar balancete: ' + (err?.message || String(err)));
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col">
                <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-bold text-gray-800">Importar despesas do balancete</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    {imported && parsed ? (
                        <div className="space-y-4">
                            <p className="text-sm text-gray-600">Balancete importado com sucesso. Resumo do que foi para a DRE Forecast (coluna OTB):</p>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
                                    <span className="text-[10px] text-indigo-500 font-bold uppercase tracking-wide">Total despesas (código 4)</span>
                                    <div className="text-xl font-bold text-indigo-900 tabular-nums mt-1">{despesasTotal.toLocaleString('pt-BR')}</div>
                                    <span className="text-[10px] text-indigo-400">{matchedDespesas.length} lançamentos casados</span>
                                </div>
                                <div className="bg-sky-50 border border-sky-200 rounded-xl p-4">
                                    <span className="text-[10px] text-sky-500 font-bold uppercase tracking-wide">Imposto ({IMPOSTO_CODE})</span>
                                    <div className="text-xl font-bold text-sky-900 tabular-nums mt-1">{parsed.impostoVal.toLocaleString('pt-BR')}</div>
                                    <span className="text-[10px] text-sky-400">Linha Imposto, coluna OTB</span>
                                </div>
                                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                                    <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-wide">Outras Receitas Hoteleiras ({TIME_SHARE_CODE})</span>
                                    <div className="text-xl font-bold text-emerald-900 tabular-nums mt-1">{parsed.timeShareVal.toLocaleString('pt-BR')}</div>
                                    <span className="text-[10px] text-emerald-400">Linha Cancelamento de Time Share, coluna OTB</span>
                                </div>
                            </div>
                        </div>
                    ) : !parsed ? (
                        <label className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-gray-300 rounded-xl p-10 cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition-colors">
                            <Upload size={32} className="text-gray-400" />
                            <span className="text-sm font-medium text-gray-600">Clique para selecionar o arquivo .xlsx do balancete</span>
                            <span className="text-xs text-gray-400">Colunas usadas: Hierarquico (Código da conta), Descricao, Movimento</span>
                            <input
                                type="file"
                                accept=".xlsx,.xls"
                                className="hidden"
                                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                            />
                        </label>
                    ) : (
                        <div>
                            <div className="flex items-center gap-4 mb-4 text-sm">
                                <span className="font-medium text-gray-700">{fileName}</span>
                                <span className="flex items-center gap-1 text-emerald-600 font-bold"><CheckCircle2 size={14} /> {matchedDespesas.length} casadas</span>
                                {unmatchedCount > 0 && (
                                    <span className="flex items-center gap-1 text-amber-600 font-bold"><AlertTriangle size={14} /> {unmatchedCount} sem correspondência</span>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
                                <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                                    <span className="text-gray-500 font-bold uppercase">1 Ativo</span>
                                    <div className="tabular-nums font-medium text-gray-700">{parsed.ativoTotal.toLocaleString('pt-BR')}</div>
                                </div>
                                <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                                    <span className="text-gray-500 font-bold uppercase">2 Passivo</span>
                                    <div className="tabular-nums font-medium text-gray-700">{parsed.passivoTotal.toLocaleString('pt-BR')}</div>
                                </div>
                            </div>

                            <div className="border border-gray-200 rounded-lg overflow-hidden">
                                <table className="w-full text-xs">
                                    <thead className="bg-gray-50 text-gray-500 uppercase font-bold">
                                        <tr>
                                            <th className="px-3 py-2 text-left">Hierarquico</th>
                                            <th className="px-3 py-2 text-left">Descricao</th>
                                            <th className="px-3 py-2 text-left">Casada como</th>
                                            <th className="px-3 py-2 text-right">Movimento</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        <tr className="bg-sky-50">
                                            <td className="px-3 py-1.5 font-mono">{IMPOSTO_CODE}</td>
                                            <td className="px-3 py-1.5">IMPOSTOS E CONTRIBUICOES SOBRE A RECEITA</td>
                                            <td className="px-3 py-1.5 text-sky-700 font-bold">Imposto (DRE, coluna OTB)</td>
                                            <td className="px-3 py-1.5 text-right tabular-nums">{parsed.impostoVal.toLocaleString('pt-BR')}</td>
                                        </tr>
                                        <tr className="bg-sky-50">
                                            <td className="px-3 py-1.5 font-mono">{TIME_SHARE_CODE}</td>
                                            <td className="px-3 py-1.5">OUTRAS RECEITAS HOTELEIRAS</td>
                                            <td className="px-3 py-1.5 text-sky-700 font-bold">Cancelamento de Time Share (DRE, coluna OTB)</td>
                                            <td className="px-3 py-1.5 text-right tabular-nums">{parsed.timeShareVal.toLocaleString('pt-BR')}</td>
                                        </tr>
                                        {parsed.despesas.map((r, i) => (
                                            <tr key={i} className={r.matchLevel ? '' : 'bg-amber-50'}>
                                                <td className="px-3 py-1.5 font-mono">{r.hierarquico}</td>
                                                <td className="px-3 py-1.5">{r.descricao}</td>
                                                <td className="px-3 py-1.5">
                                                    {r.matchLevel
                                                        ? <span>{r.matchedName} <span className="text-gray-400">({levelLabel(r.matchLevel)})</span></span>
                                                        : <span className="text-amber-600 italic">não encontrada</span>}
                                                </td>
                                                <td className="px-3 py-1.5 text-right tabular-nums">{r.movimento.toLocaleString('pt-BR')}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex justify-end items-center gap-3 px-6 py-4 border-t border-gray-200">
                    {imported ? (
                        <button onClick={onClose} className="px-5 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg">Fechar</button>
                    ) : (
                        <>
                            <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
                            {parsed && (
                                <button
                                    onClick={handleConfirm}
                                    disabled={isSaving}
                                    className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50"
                                >
                                    {isSaving ? 'Importando...' : 'Confirmar importação'}
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BalanceteImportModal;
