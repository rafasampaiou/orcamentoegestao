import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { Upload, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Account, BudgetVersion, CostCenter, Hotel } from '../types';
import { supabaseService } from '../services/supabaseService';
import toast from 'react-hot-toast';

interface RevenueStandaloneImportProps {
    hotels: Hotel[];
    accounts: Account[];
    costCenters: CostCenter[];
    realVersions: BudgetVersion[];
}

const DESTINO_OPTIONS: { value: 'PREVIA' | 'META' | 'ANO_ANTERIOR'; label: string }[] = [
    { value: 'PREVIA', label: 'Prévia (Fechamento)' },
    { value: 'META', label: 'Meta' },
    { value: 'ANO_ANTERIOR', label: 'Ano Anterior' },
];

const normalize = (s: string) => (s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Aceita o cabeçalho com pequenas variações de nome/acento/caixa.
const findKey = (row: Record<string, any>, candidates: string[]): string | undefined => {
    const keys = Object.keys(row);
    const norm = (s: string) => normalize(s).replace(/[^a-z0-9]/g, '');
    return keys.find(k => candidates.some(c => norm(k) === norm(c)));
};

interface ParsedRevenueRow {
    tipo: string;
    cenario: string;
    escopo: string;
    hotelRaw: string;
    hotelMatchesSelected: boolean;
    crRaw: string;
    crMatched: string | null;
    departamento: string;
    contaRaw: string;
    contaMatched: string | null;
    month: number;
    value: number;
}

// Importação independente de Receitas — por pedido explícito, essa planilha não alimenta
// financial_data nem nenhum cálculo do DRE Forecast agora. Fica só salva numa tabela própria
// (revenue_import_data) pra decidir depois o que fazer com ela.
const RevenueStandaloneImportModal: React.FC<RevenueStandaloneImportProps> = ({ hotels, accounts, costCenters, realVersions }) => {
    const [selectedHotelId, setSelectedHotelId] = useState('');
    const [selectedVersionId, setSelectedVersionId] = useState('');
    const [destino, setDestino] = useState<'PREVIA' | 'META' | 'ANO_ANTERIOR'>('PREVIA');
    const [fileName, setFileName] = useState('');
    const [rows, setRows] = useState<ParsedRevenueRow[] | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [imported, setImported] = useState(false);

    const selectedHotel = hotels.find(h => h.id === selectedHotelId);
    const versionsForHotel = realVersions.filter(v => !selectedHotelId || v.hotelId === selectedHotelId);
    const selectedVersion = versionsForHotel.find(v => v.id === selectedVersionId);

    const handleFile = async (file: File) => {
        if (!selectedHotel || !selectedVersion) {
            toast.error('Selecione o hotel e a versão de destino antes de anexar a planilha.');
            return;
        }
        setFileName(file.name);
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const json: Record<string, any>[] = XLSX.utils.sheet_to_json(firstSheet);

        if (json.length === 0) {
            toast.error('Planilha vazia ou sem cabeçalho reconhecível.');
            return;
        }

        const tipoKey = findKey(json[0], ['Receita / Despesa', 'Receita/Despesa', 'Receita Despesa', 'Tipo']);
        const cenarioKey = findKey(json[0], ['Real / Meta', 'Real/Meta', 'Real Meta', 'Cenario', 'Cenário']);
        const escopoKey = findKey(json[0], ['Escopo']);
        const empresaKey = findKey(json[0], ['Empresa', 'Hotel']);
        const crKey = findKey(json[0], ['CR Certo', 'CR']);
        const deptoKey = findKey(json[0], ['Departamento']);
        const contaKey = findKey(json[0], ['Descricao da Conta', 'Descrição da Conta', 'Conta']);
        const mesKey = findKey(json[0], ['Mes', 'Mês']);
        const valorKey = findKey(json[0], ['Valor']);

        if (!tipoKey || !cenarioKey || !escopoKey || !empresaKey || !crKey || !deptoKey || !contaKey || !mesKey || !valorKey) {
            toast.error('Não encontrei todas as colunas esperadas (Receita/Despesa, Real/Meta, Escopo, Empresa, CR Certo, Departamento, Descrição da Conta, Mês, Valor).');
            return;
        }

        const hotelCandidates = costCenters.filter(c => normalize(c.hotelName || '') === normalize(selectedHotel.name));

        const parsed: ParsedRevenueRow[] = json.map(r => {
            const hotelRaw = String(r[empresaKey] ?? '').trim();
            const crRaw = String(r[crKey] ?? '').trim();
            const contaRaw = String(r[contaKey] ?? '').trim();
            const valorRaw = r[valorKey];
            const value = typeof valorRaw === 'number' ? valorRaw : parseFloat(String(valorRaw ?? '0').replace(/\./g, '').replace(',', '.')) || 0;
            const month = parseInt(String(r[mesKey] ?? '').trim(), 10) || 0;

            // CR: procura primeiro entre os CRs do hotel selecionado, senão em qualquer hotel —
            // em cada nível, pelo nome oficial primeiro e pelos nomes secundários (aliases)
            // depois, já que a mesma base pode chamar o setor de um jeito ligeiramente diferente.
            const matchesCr = (c: CostCenter) => normalize(c.name) === normalize(crRaw) || (c.aliases || []).some(a => normalize(a) === normalize(crRaw));
            const crMatch = hotelCandidates.find(matchesCr) || costCenters.find(matchesCr);

            const contaMatch = accounts.find(a => normalize(a.name) === normalize(contaRaw));

            return {
                tipo: String(r[tipoKey] ?? '').trim(),
                cenario: String(r[cenarioKey] ?? '').trim(),
                escopo: String(r[escopoKey] ?? '').trim(),
                hotelRaw,
                hotelMatchesSelected: normalize(hotelRaw) === normalize(selectedHotel.name),
                crRaw,
                crMatched: crMatch?.name || null,
                departamento: String(r[deptoKey] ?? '').trim(),
                contaRaw,
                contaMatched: contaMatch?.name || null,
                month,
                value,
            };
        });

        setRows(parsed);
    };

    const matchedCount = (rows || []).filter(r => r.contaMatched && r.crMatched).length;
    const hotelMismatchCount = (rows || []).filter(r => !r.hotelMatchesSelected).length;

    const handleConfirm = async () => {
        if (!rows || !selectedHotel || !selectedVersion) return;
        setIsSaving(true);
        try {
            const monthName = new Date(2024, 0).toLocaleString('pt-BR', { month: 'short' });
            const valorTotal = rows.reduce((s, r) => s + Math.abs(r.value), 0);
            const [historyEntry] = await supabaseService.saveImportHistory([{
                hotel: selectedHotel.name,
                tipo: 'Receita (independente)',
                ano: selectedVersion.year,
                meses: monthName,
                version_id: null,
                user_id: null,
                valor_total: valorTotal,
            }]);
            const importId = historyEntry.id;

            await supabaseService.saveRevenueImportData(rows.map(r => ({
                hotel: selectedHotel.name,
                hotelRaw: r.hotelRaw,
                year: selectedVersion.year,
                month: r.month,
                tipo: r.tipo,
                cenario: r.cenario,
                escopo: r.escopo,
                cr: r.crRaw,
                crMatched: r.crMatched,
                departamento: r.departamento,
                conta: r.contaRaw,
                contaMatched: r.contaMatched,
                value: r.value,
                versionId: selectedVersion.id,
                destino,
            })), importId);

            toast.success(`${rows.length} lançamentos de receita salvos.`);
            setImported(true);
        } catch (err: any) {
            toast.error('Erro ao importar receitas: ' + (err?.message || String(err)));
        } finally {
            setIsSaving(false);
        }
    };

    const handleReset = () => {
        setRows(null);
        setFileName('');
        setImported(false);
    };

    return (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
            <div>
                <h3 className="text-lg font-bold text-gray-800">Importação de Receitas</h3>
                <p className="text-xs text-gray-500 mt-1">
                    Importação independente — por enquanto, esses dados só ficam salvos no sistema. Não alimentam o DRE Forecast nem nenhum outro cálculo.
                </p>
            </div>

            <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl text-xs text-amber-800">
                <p className="font-bold mb-1">Colunas esperadas na planilha (.xlsx):</p>
                <code>Receita / Despesa | Real / Meta | Escopo | Empresa | CR Certo | Departamento | Descrição da Conta | Mês | Valor</code>
            </div>

            <div className="flex flex-wrap items-end gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200">
                <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Hotel</label>
                    <select
                        value={selectedHotelId}
                        onChange={e => { setSelectedHotelId(e.target.value); setSelectedVersionId(''); handleReset(); }}
                        className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none min-w-[200px]"
                    >
                        <option value="">Selecione...</option>
                        {hotels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                    </select>
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Versão de Destino</label>
                    <select
                        value={selectedVersionId}
                        onChange={e => { setSelectedVersionId(e.target.value); handleReset(); }}
                        className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none min-w-[200px]"
                    >
                        <option value="">Selecione a versão...</option>
                        {versionsForHotel.map(v => <option key={v.id} value={v.id}>{v.name} - {v.hotel} ({v.year})</option>)}
                    </select>
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Destino</label>
                    <select
                        value={destino}
                        onChange={e => setDestino(e.target.value as any)}
                        className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none min-w-[200px]"
                    >
                        {DESTINO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                </div>
            </div>

            {imported && rows ? (
                <div className="space-y-3">
                    <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm">
                        <CheckCircle2 size={16} /> {rows.length} lançamentos importados com sucesso para {selectedHotel?.name} / {selectedVersion?.name} ({selectedVersion?.year}).
                    </div>
                    <button onClick={handleReset} className="px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-lg border border-gray-200">
                        Importar outra planilha
                    </button>
                </div>
            ) : !rows ? (
                <label className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-xl p-10 transition-colors ${selectedHotel && selectedVersion ? 'border-gray-300 cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30' : 'border-gray-200 opacity-50 cursor-not-allowed'}`}>
                    <Upload size={32} className="text-gray-400" />
                    <span className="text-sm font-medium text-gray-600">
                        {selectedHotel && selectedVersion ? 'Clique para selecionar o arquivo .xlsx de receitas' : 'Selecione o hotel e a versão de destino primeiro'}
                    </span>
                    <input
                        type="file"
                        accept=".xlsx,.xls"
                        className="hidden"
                        disabled={!selectedHotel || !selectedVersion}
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                    />
                </label>
            ) : (
                <div>
                    <div className="flex items-center gap-4 mb-4 text-sm">
                        <span className="font-medium text-gray-700">{fileName}</span>
                        <span className="flex items-center gap-1 text-emerald-600 font-bold"><CheckCircle2 size={14} /> {matchedCount} de {rows.length} com CR e conta casados</span>
                        {hotelMismatchCount > 0 && (
                            <span className="flex items-center gap-1 text-amber-600 font-bold"><AlertTriangle size={14} /> {hotelMismatchCount} com Empresa diferente de {selectedHotel?.name}</span>
                        )}
                    </div>

                    <div className="border border-gray-200 rounded-lg overflow-hidden max-h-[50vh] overflow-y-auto">
                        <table className="w-full text-xs">
                            <thead className="bg-gray-50 text-gray-500 uppercase font-bold sticky top-0">
                                <tr>
                                    <th className="px-3 py-2 text-left">Tipo</th>
                                    <th className="px-3 py-2 text-left">Cenário</th>
                                    <th className="px-3 py-2 text-left">Escopo</th>
                                    <th className="px-3 py-2 text-left">Empresa</th>
                                    <th className="px-3 py-2 text-left">CR Certo</th>
                                    <th className="px-3 py-2 text-left">Departamento</th>
                                    <th className="px-3 py-2 text-left">Conta</th>
                                    <th className="px-3 py-2 text-center">Mês</th>
                                    <th className="px-3 py-2 text-right">Valor</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {rows.map((r, i) => (
                                    <tr key={i} className={!r.hotelMatchesSelected || !r.crMatched || !r.contaMatched ? 'bg-amber-50' : ''}>
                                        <td className="px-3 py-1.5">{r.tipo}</td>
                                        <td className="px-3 py-1.5">{r.cenario}</td>
                                        <td className="px-3 py-1.5">{r.escopo}</td>
                                        <td className="px-3 py-1.5">{r.hotelRaw}{!r.hotelMatchesSelected && <span className="text-amber-600 italic"> (≠ selecionado)</span>}</td>
                                        <td className="px-3 py-1.5">{r.crMatched || <span className="text-amber-600 italic">{r.crRaw || '(vazio)'} — não encontrado</span>}</td>
                                        <td className="px-3 py-1.5">{r.departamento}</td>
                                        <td className="px-3 py-1.5">{r.contaMatched || <span className="text-amber-600 italic">{r.contaRaw || '(vazio)'} — não encontrada</span>}</td>
                                        <td className="px-3 py-1.5 text-center">{r.month}</td>
                                        <td className="px-3 py-1.5 text-right tabular-nums">{r.value.toLocaleString('pt-BR')}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex justify-end items-center gap-3 mt-4">
                        <button onClick={handleReset} className="px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
                        <button
                            onClick={handleConfirm}
                            disabled={isSaving}
                            className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50"
                        >
                            {isSaving ? 'Importando...' : 'Confirmar importação'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RevenueStandaloneImportModal;
