import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { X, Upload, CheckCircle2, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

interface ExpensesBudgetImportModalProps {
    // Linhas já existentes na tabela principal de Despesas do Budget (dynamicExpenseRows) — nome
    // de Pacote Master, de Pacote ou de conta contábil, na ordem em que já aparecem lá.
    rowLabels: string[];
    // Aplica só os itens casados em dreBudgetData (merge por rowLabel/mês) — quem salva de
    // verdade continua sendo o botão "Salvar Despesas Budget" já existente.
    onConfirm: (matched: Record<string, Record<number, string>>) => void;
    onClose: () => void;
}

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const normalize = (s: string) => (s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
// Ignora também espaço/hífen/pontuação na comparação — mesmo padrão de BalanceteImportModal.tsx.
const normalizeLoose = (s: string) => normalize(s).replace(/[^a-z0-9]/g, '');

const findKey = (row: Record<string, any>, candidates: string[]): string | undefined => {
    const keys = Object.keys(row);
    return keys.find(k => candidates.some(c => normalizeLoose(k) === normalizeLoose(c)));
};

// Aceita "1".."12" (o formato pedido) e, como reserva, abreviação de mês em pt-BR ("Jan"/"jan.").
const findMonthKey = (row: Record<string, any>, month: number): string | undefined => {
    const keys = Object.keys(row);
    const asNumber = keys.find(k => k.trim() === String(month));
    if (asNumber) return asNumber;
    const label = normalizeLoose(MONTH_LABELS[month - 1]);
    return keys.find(k => normalizeLoose(k).startsWith(label));
};

const parseNumber = (v: any): number | null => {
    if (v === undefined || v === null || v === '') return null;
    if (typeof v === 'number') return isNaN(v) ? null : v;
    let str = String(v).trim();
    if (!str || str === '-') return null;
    const isNegative = str.startsWith('(') && str.endsWith(')');
    if (isNegative) str = str.slice(1, -1);
    str = str.replace(/[R$\s%]/g, '').replace(/\./g, '').replace(',', '.');
    const num = parseFloat(str);
    if (isNaN(num)) return null;
    return isNegative ? -num : num;
};

interface ParsedItem {
    itemText: string;
    matchedRowLabel: string | null;
    values: Record<number, number>; // só os meses presentes no arquivo
}

const ExpensesBudgetImportModal: React.FC<ExpensesBudgetImportModalProps> = ({ rowLabels, onConfirm, onClose }) => {
    const [items, setItems] = useState<ParsedItem[] | null>(null);
    const [fileName, setFileName] = useState('');
    // Item sem correspondência automática → o usuário pode reclassificar manualmente pra uma
    // conta/pacote/master que exista no Plano de Contas, antes de confirmar (índice no array
    // `items` -> rowLabel escolhido).
    const [manualOverrides, setManualOverrides] = useState<Record<number, string>>({});
    const rowLabelSet = new Set(rowLabels);
    const effectiveRowLabel = (item: ParsedItem, idx: number): string | null =>
        item.matchedRowLabel || manualOverrides[idx] || null;

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

        const itemKey = findKey(json[0], ['Item', 'Indicador', 'Item / Indicador', 'Item/Indicador']);
        if (!itemKey) {
            toast.error('Não encontrei a coluna "Item / Indicador" nessa planilha.');
            return;
        }
        const monthKeys: Record<number, string | undefined> = {};
        MONTHS.forEach(m => { monthKeys[m] = findMonthKey(json[0], m); });

        const rowLabelsByNorm = new Map(rowLabels.map(r => [normalizeLoose(r), r]));

        const parsedItems: ParsedItem[] = json
            .map(r => {
                const itemText = String(r[itemKey] ?? '').trim();
                if (!itemText) return null;
                const values: Record<number, number> = {};
                MONTHS.forEach(m => {
                    const key = monthKeys[m];
                    if (!key) return;
                    const num = parseNumber(r[key]);
                    if (num !== null) values[m] = num;
                });
                return {
                    itemText,
                    matchedRowLabel: rowLabelsByNorm.get(normalizeLoose(itemText)) || null,
                    values,
                } as ParsedItem;
            })
            .filter((r): r is ParsedItem => !!r);

        setItems(parsedItems);
    };

    const matchedEntries = (items || [])
        .map((item, idx) => ({ item, idx, rowLabel: effectiveRowLabel(item, idx) }))
        .filter((e): e is { item: ParsedItem; idx: number; rowLabel: string } => !!e.rowLabel);
    const unmatchedCount = (items || []).length - matchedEntries.length;
    const monthTotals: Record<number, number> = {};
    MONTHS.forEach(m => { monthTotals[m] = matchedEntries.reduce((s, e) => s + (e.item.values[m] || 0), 0); });
    const grandTotal = MONTHS.reduce((s, m) => s + monthTotals[m], 0);

    const handleConfirm = () => {
        const matched: Record<string, Record<number, string>> = {};
        matchedEntries.forEach(({ item, rowLabel }) => {
            matched[rowLabel] = { ...(matched[rowLabel] || {}) };
            MONTHS.forEach(m => {
                if (item.values[m] !== undefined) matched[rowLabel][m] = String(item.values[m]);
            });
        });
        onConfirm(matched);
        toast.success(`${matchedEntries.length} item(ns) importado(s) pra grade — clique em "Salvar Despesas Budget" pra gravar.${unmatchedCount > 0 ? ` ${unmatchedCount} sem correspondência.` : ''}`);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[95vw] max-h-[85vh] flex flex-col">
                <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-bold text-gray-800">Importar arquivo de Despesas (Budget)</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    {!items ? (
                        <label className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-gray-300 rounded-xl p-10 cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition-colors">
                            <Upload size={32} className="text-gray-400" />
                            <span className="text-sm font-medium text-gray-600">Clique para selecionar a planilha (.xlsx, .xls ou .csv)</span>
                            <span className="text-xs text-gray-400 text-center max-w-md">
                                Formato esperado: uma coluna "Item / Indicador" (nome do Pacote Master, Pacote ou conta contábil,
                                exatamente como aparece na tabela) e uma coluna por mês (1 a 12) com o valor.
                            </span>
                            <input
                                type="file"
                                accept=".xlsx,.xls,.csv"
                                className="hidden"
                                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                            />
                        </label>
                    ) : (
                        <div>
                            <div className="flex items-center gap-4 mb-4 text-sm">
                                <span className="font-medium text-gray-700">{fileName}</span>
                                <span className="flex items-center gap-1 text-emerald-600 font-bold"><CheckCircle2 size={14} /> {matchedEntries.length} casados</span>
                                {unmatchedCount > 0 && (
                                    <span className="flex items-center gap-1 text-amber-600 font-bold"><AlertTriangle size={14} /> {unmatchedCount} sem correspondência</span>
                                )}
                            </div>
                            {unmatchedCount > 0 && (
                                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
                                    Itens sem correspondência (em amarelo) podem ser reclassificados manualmente — digite o nome de uma conta/pacote/master existente no campo, antes de confirmar.
                                </p>
                            )}

                            <datalist id="expenses-import-row-labels">
                                {rowLabels.map(r => <option key={r} value={r} />)}
                            </datalist>

                            <div className="border border-gray-200 rounded-lg overflow-x-auto max-w-full">
                                <table className="text-xs" style={{ minWidth: `${180 + MONTHS.length * 92 + 90}px` }}>
                                    <thead className="bg-gray-50 text-gray-500 uppercase font-bold">
                                        <tr>
                                            <th className="px-3 py-2 text-left sticky left-0 bg-gray-50 z-10" style={{ width: 220 }}>Item / Indicador</th>
                                            {MONTH_LABELS.map(l => <th key={l} className="px-2 py-2 text-right whitespace-nowrap" style={{ width: 92 }}>{l}</th>)}
                                            <th className="px-3 py-2 text-right whitespace-nowrap" style={{ width: 90 }}>Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {items.map((item, i) => {
                                            const rowTotal = MONTHS.reduce((s, m) => s + (item.values[m] || 0), 0);
                                            const rowLabel = effectiveRowLabel(item, i);
                                            return (
                                                <tr key={i} className={rowLabel ? '' : 'bg-amber-50'}>
                                                    <td className={`px-3 py-1.5 sticky left-0 z-10 truncate ${rowLabel ? 'bg-white' : 'bg-amber-50'}`} title={item.itemText}>
                                                        {rowLabel ? (
                                                            <span className={item.matchedRowLabel ? '' : 'text-indigo-700 font-bold'}>{rowLabel}</span>
                                                        ) : (
                                                            <div className="flex flex-col gap-0.5">
                                                                <span className="text-amber-700 italic truncate">{item.itemText}</span>
                                                                <input
                                                                    type="text"
                                                                    list="expenses-import-row-labels"
                                                                    placeholder="Reclassificar para..."
                                                                    className="text-[11px] border border-amber-300 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white"
                                                                    onChange={(e) => {
                                                                        const val = e.target.value;
                                                                        if (rowLabelSet.has(val)) {
                                                                            setManualOverrides(prev => ({ ...prev, [i]: val }));
                                                                        } else {
                                                                            setManualOverrides(prev => { const next = { ...prev }; delete next[i]; return next; });
                                                                        }
                                                                    }}
                                                                />
                                                            </div>
                                                        )}
                                                    </td>
                                                    {MONTHS.map(m => (
                                                        <td key={m} className="px-2 py-1.5 text-right tabular-nums text-gray-700 whitespace-nowrap">
                                                            {item.values[m] !== undefined ? item.values[m].toLocaleString('pt-BR') : '-'}
                                                        </td>
                                                    ))}
                                                    <td className="px-3 py-1.5 text-right tabular-nums font-bold text-gray-800 whitespace-nowrap">{rowTotal.toLocaleString('pt-BR')}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                    <tfoot className="bg-indigo-50 font-bold text-indigo-900">
                                        <tr>
                                            <td className="px-3 py-2 sticky left-0 z-10 bg-indigo-50">Total do mês (itens casados)</td>
                                            {MONTHS.map(m => (
                                                <td key={m} className="px-2 py-2 text-right tabular-nums whitespace-nowrap">{monthTotals[m].toLocaleString('pt-BR')}</td>
                                            ))}
                                            <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{grandTotal.toLocaleString('pt-BR')}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex justify-end items-center gap-3 px-6 py-4 border-t border-gray-200">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
                    {items && (
                        <button
                            onClick={handleConfirm}
                            disabled={matchedEntries.length === 0}
                            className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50"
                        >
                            Confirmar importação
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ExpensesBudgetImportModal;
