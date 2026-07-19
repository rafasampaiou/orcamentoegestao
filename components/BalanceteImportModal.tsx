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
    onClose: () => void;
}

interface ParsedRow {
    hierarquico: string;
    descricao: string;
    movimento: number;
    matchedName: string | null;
}

// Aceita o cabeçalho com pequenas variações de acento/caixa, já que arquivos de balancete
// exportados por sistemas contábeis diferentes podem vir escritos de formas ligeiramente diferentes.
const findKey = (row: Record<string, any>, candidates: string[]): string | undefined => {
    const keys = Object.keys(row);
    const norm = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    return keys.find(k => candidates.some(c => norm(k) === norm(c)));
};

const BalanceteImportModal: React.FC<BalanceteImportModalProps> = ({ accounts, hotel, year, month, versionId, onImportData, onClose }) => {
    const [rows, setRows] = useState<ParsedRow[] | null>(null);
    const [fileName, setFileName] = useState('');
    const [isSaving, setIsSaving] = useState(false);

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

        const parsed: ParsedRow[] = json.map(r => {
            const hierarquico = String(r[hierKey] ?? '').trim();
            const descricao = String(r[descKey] ?? '').trim();
            const movimentoRaw = r[movKey];
            const movimento = typeof movimentoRaw === 'number' ? movimentoRaw : parseFloat(String(movimentoRaw ?? '0').replace(',', '.')) || 0;
            const acc = accounts.find(a => (a.code || '').trim() === hierarquico);
            return { hierarquico, descricao, movimento, matchedName: acc?.name || null };
        }).filter(r => r.hierarquico || r.descricao);

        setRows(parsed);
    };

    const matchedCount = rows?.filter(r => r.matchedName).length || 0;
    const unmatchedCount = (rows?.length || 0) - matchedCount;

    const handleConfirm = async () => {
        if (!rows) return;
        setIsSaving(true);
        try {
            const importId = `otb-balancete-${Date.now()}`;
            const importedRows: ImportedRow[] = rows.map(r => ({
                ano: String(year),
                mes: String(month),
                cenario: 'OTB',
                tipo: 'Despesa',
                hotel,
                conta: r.matchedName || r.descricao,
                cr: '',
                valor: String(r.movimento),
                status: 'valid',
                versionId,
                importId,
            }));
            await supabaseService.saveFinancialData(importedRows, importId);
            onImportData(importedRows, 'append');
            toast.success(`${importedRows.length} lançamentos do balancete importados.`);
            onClose();
        } catch (err: any) {
            toast.error('Erro ao importar balancete: ' + (err?.message || String(err)));
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col">
                <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-bold text-gray-800">Importar despesas do balancete</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    {!rows ? (
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
                                <span className="flex items-center gap-1 text-emerald-600 font-bold"><CheckCircle2 size={14} /> {matchedCount} casadas</span>
                                {unmatchedCount > 0 && (
                                    <span className="flex items-center gap-1 text-amber-600 font-bold"><AlertTriangle size={14} /> {unmatchedCount} sem conta correspondente</span>
                                )}
                            </div>
                            <div className="border border-gray-200 rounded-lg overflow-hidden">
                                <table className="w-full text-xs">
                                    <thead className="bg-gray-50 text-gray-500 uppercase font-bold">
                                        <tr>
                                            <th className="px-3 py-2 text-left">Hierarquico</th>
                                            <th className="px-3 py-2 text-left">Descricao</th>
                                            <th className="px-3 py-2 text-left">Conta casada</th>
                                            <th className="px-3 py-2 text-right">Movimento</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {rows.map((r, i) => (
                                            <tr key={i} className={r.matchedName ? '' : 'bg-amber-50'}>
                                                <td className="px-3 py-1.5">{r.hierarquico}</td>
                                                <td className="px-3 py-1.5">{r.descricao}</td>
                                                <td className="px-3 py-1.5">{r.matchedName || <span className="text-amber-600 italic">não encontrada</span>}</td>
                                                <td className="px-3 py-1.5 text-right tabular-nums">{r.movimento.toLocaleString('pt-BR')}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
                    {rows && (
                        <button
                            onClick={handleConfirm}
                            disabled={isSaving}
                            className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50"
                        >
                            {isSaving ? 'Importando...' : `Confirmar importação (${rows.length})`}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BalanceteImportModal;
