import React, { useState } from 'react';
import { createPortal } from 'react-dom';
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
const ISS_CODE = '3.01.01.02.008';

// "Setores" que ganham card de total próprio, além do total geral de despesas — são centros de
// custo corporativos, fora do escopo do Plano de Contas do hotel (por isso nunca casam por
// código como uma conta/pacote normal). Identificados pela própria Descricao do balancete.
const SECTOR_NAMES = ['Mais Tauá', 'Vip Club', 'Pós Venda', 'Instituto Tauá', 'Propriedades', 'Obras', 'Novos Negócios'];
const normalizeName = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

interface DespesaRow {
    hierarquico: string;
    descricao: string;
    movimento: number;
    matchLevel: 'account' | 'package' | 'master' | null;
    matchedName: string | null;
    masterPackage: string | null;
}

interface ParsedBalancete {
    ativoTotal: number;
    passivoTotal: number;
    receitaTotal: number;
    impostoVal: number;
    timeShareVal: number;
    issVal: number;
    despesas: DespesaRow[];
    // Contas/pacotes casados por código, mas marcados "Fora do escopo" no Plano de Contas — hoje
    // são só descartados do import; guardados à parte pra dar pra mostrar quanto isso representa.
    foraDoEscopo: DespesaRow[];
}

// Aceita o cabeçalho com pequenas variações de acento/caixa, já que arquivos de balancete
// exportados por sistemas contábeis diferentes podem vir escritos de formas ligeiramente diferentes.
const findKey = (row: Record<string, any>, candidates: string[]): string | undefined => {
    const keys = Object.keys(row);
    const norm = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    return keys.find(k => candidates.some(c => norm(k) === norm(c)));
};

// Só a quantidade de dígitos do código importa aqui (ignora os pontos) — um código raso demais
// como "4.02" (3 dígitos) é um totalizador de pacote/master, não uma conta de fato.
const digitCount = (code: string) => code.replace(/\D/g, '').length;

// Casa o código pelo Plano de Contas em 3 níveis (conta > pacote > pacote master, nessa ordem de
// prioridade) — os códigos de pacote/master são campos denormalizados em cada Account
// (packageCode/masterPackageCode), não existe um cadastro de pacote separado.
const matchByCode = (hierarquico: string, accounts: Account[]): { level: 'account' | 'package' | 'master'; name: string; outOfScope: boolean; masterPackage: string | null } | null => {
    const acc = accounts.find(a => (a.code || '').trim() === hierarquico);
    if (acc) return { level: 'account', name: acc.name, outOfScope: !!acc.outOfScope, masterPackage: acc.masterPackage || null };
    const pkgAcc = accounts.find(a => (a.packageCode || '').trim() === hierarquico);
    if (pkgAcc) return { level: 'package', name: pkgAcc.package || '', outOfScope: !!pkgAcc.outOfScope, masterPackage: pkgAcc.masterPackage || null };
    const masterAcc = accounts.find(a => (a.masterPackageCode || '').trim() === hierarquico);
    if (masterAcc) return { level: 'master', name: masterAcc.masterPackage || '', outOfScope: !!masterAcc.outOfScope, masterPackage: masterAcc.masterPackage || null };
    return null;
};

// Card de um Pacote Master fora do escopo — passar o mouse mostra as contas contábeis
// individuais (com o código Hierarquico) que compõem aquele total. O balancete não traz uma
// coluna de CR/Centro de Custo (só Hierarquico/Descricao/Movimento), então o balão mostra a
// conta contábil casada, não o CR.
// O balão é renderizado via portal em document.body (position: fixed, calculado a partir do
// retângulo do card) — dentro do card ele ficava cortado pelo overflow-y-auto do corpo do modal
// (herda overflow-x:auto junto, então qualquer coisa que vazasse do card ficava invisível).
const ForaDoEscopoCard: React.FC<{ name: string; total: number; items: DespesaRow[]; large?: boolean }> = ({ name, total, items, large }) => {
    const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
    const TOOLTIP_WIDTH = 320;

    const handleEnter = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const left = Math.min(rect.left, window.innerWidth - TOOLTIP_WIDTH - 12);
        setPos({ top: rect.bottom + 4, left: Math.max(12, left) });
    };

    return (
        <div
            className={`bg-gray-50 border border-gray-200 rounded-lg relative cursor-help ${large ? 'p-4' : 'px-3 py-2'}`}
            onMouseEnter={handleEnter}
            onMouseLeave={() => setPos(null)}
        >
            <span className={`text-gray-500 font-bold uppercase tracking-wide ${large ? 'text-[10px]' : 'text-xs'}`}>{name}</span>
            <div className={`font-bold text-gray-800 tabular-nums ${large ? 'text-xl mt-1' : 'font-medium'}`}>{total.toLocaleString('pt-BR')}</div>
            {pos && createPortal(
                <div
                    style={{ position: 'fixed', top: pos.top, left: pos.left, width: TOOLTIP_WIDTH }}
                    className="z-[200] max-h-72 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-2xl p-3 text-left normal-case"
                >
                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Contas contábeis fora do escopo</p>
                    {items.map((r, i) => (
                        <div key={i} className="flex justify-between gap-2 text-[11px] py-1 border-b border-gray-50 last:border-0">
                            <span className="text-gray-600 truncate">{r.matchedName} <span className="text-gray-400 font-mono">({r.hierarquico})</span></span>
                            <span className="tabular-nums text-gray-700 shrink-0">{r.movimento.toLocaleString('pt-BR')}</span>
                        </div>
                    ))}
                </div>,
                document.body
            )}
        </div>
    );
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
        let receitaTotal = 0;
        let impostoVal = 0;
        let timeShareVal = 0;
        let issVal = 0;
        const despesas: DespesaRow[] = [];
        const foraDoEscopo: DespesaRow[] = [];

        json.forEach(r => {
            const hierarquico = String(r[hierKey] ?? '').trim();
            const descricao = String(r[descKey] ?? '').trim();
            const movimentoRaw = r[movKey];
            const rawMovimento = typeof movimentoRaw === 'number' ? movimentoRaw : parseFloat(String(movimentoRaw ?? '0').replace(',', '.')) || 0;
            // O balancete vem com o sinal invertido em relação à DRE Forecast — já corrige aqui,
            // pra tudo que aparece na tela (e o que é gravado) já estar no sinal certo.
            const movimento = -rawMovimento;
            if (!hierarquico) return;

            // 1 (Ativo) e 2 (Passivo) — só um resumo pra referência, não entram no import.
            if (hierarquico.startsWith('1')) { ativoTotal += movimento; return; }
            if (hierarquico.startsWith('2')) { passivoTotal += movimento; return; }

            // 3 (Receita) — total geral é só referência; só os 3 códigos fixos abaixo alimentam
            // linhas de verdade na DRE (Imposto / Cancelamento de Time Share / Receita de ISS).
            // Time Share e Receita de ISS são as duas exceções que NÃO invertem o sinal do balancete.
            if (hierarquico.startsWith('3')) {
                if (hierarquico === TIME_SHARE_CODE) {
                    receitaTotal += rawMovimento;
                    timeShareVal += rawMovimento;
                } else if (hierarquico === ISS_CODE) {
                    receitaTotal += rawMovimento;
                    issVal += rawMovimento;
                } else {
                    receitaTotal += movimento;
                    if (hierarquico === IMPOSTO_CODE) impostoVal += movimento;
                }
                return;
            }

            // 4 (Despesa) — casa pelo código no Plano de Contas (conta, pacote ou pacote master).
            if (hierarquico.startsWith('4')) {
                if (digitCount(hierarquico) <= 3) return; // código raso (ex.: "4.02"), ignora
                const match = matchByCode(hierarquico, accounts);
                if (match?.outOfScope) {
                    // Casou por código, mas a conta/pacote está marcada "Fora do escopo" — não
                    // entra no import nem no total de despesas, mas fica visível à parte.
                    foraDoEscopo.push({
                        hierarquico,
                        descricao,
                        movimento,
                        matchLevel: match.level,
                        matchedName: match.name,
                        masterPackage: match.masterPackage || null,
                    });
                    return;
                }
                despesas.push({
                    hierarquico,
                    descricao,
                    movimento,
                    matchLevel: match?.level || null,
                    matchedName: match?.name || null,
                    masterPackage: match?.masterPackage || null,
                });
                return;
            }
            // Outros prefixos (5, 6...): fora do escopo pedido, ignorados.
        });

        setParsed({ ativoTotal, passivoTotal, receitaTotal, impostoVal, timeShareVal, issVal, despesas, foraDoEscopo });
    };

    const matchedDespesas = parsed?.despesas.filter(r => r.matchLevel) || [];
    const unmatchedCount = (parsed?.despesas.length || 0) - matchedDespesas.length;
    const despesasTotal = matchedDespesas.reduce((s, r) => s + r.movimento, 0);

    // Contas/pacotes marcados "Fora do escopo" no Plano de Contas — um card por Pacote Master,
    // pra dar visibilidade de quanto ficou de fora do total de despesas sem precisar abrir o
    // Plano de Contas pra conferir.
    const foraDoEscopoTotal = (parsed?.foraDoEscopo || []).reduce((s, r) => s + r.movimento, 0);
    const foraDoEscopoPorMaster: Record<string, number> = {};
    const foraDoEscopoItemsPorMaster: Record<string, DespesaRow[]> = {};
    (parsed?.foraDoEscopo || []).forEach(r => {
        const key = r.masterPackage || 'Sem Pacote Master';
        foraDoEscopoPorMaster[key] = (foraDoEscopoPorMaster[key] || 0) + r.movimento;
        if (!foraDoEscopoItemsPorMaster[key]) foraDoEscopoItemsPorMaster[key] = [];
        foraDoEscopoItemsPorMaster[key].push(r);
    });

    // Setores (Mais Tauá, Vip Club, Pós Venda, Instituto Tauá, Propriedades, Obras, Novos
    // Negócios) são identificados pela Descricao, mas só contam despesas de verdade: prefixo 4,
    // no escopo do Plano de Contas (já garantido por matchedDespesas) e casadas numa CONTA
    // contábil de fato — não num Pacote/Pacote Master (rollup), só a conta-folha mesmo.
    const sectorTotals: Record<string, number> = {};
    SECTOR_NAMES.forEach(name => { sectorTotals[name] = 0; });
    matchedDespesas
        .filter(r => r.matchLevel === 'account')
        .forEach(r => {
            const normDesc = normalizeName(r.descricao);
            const match = SECTOR_NAMES.find(name => normDesc.includes(normalizeName(name)));
            if (match) sectorTotals[match] += r.movimento;
        });

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
            // financial_data.import_id tem uma foreign key pra import_history — não basta gerar
            // um UUID solto (violava a constraint), precisa existir de fato um registro lá antes,
            // igual todo outro import do sistema já faz (recordImportHistory).
            const monthName = new Date(2024, (month || 1) - 1).toLocaleString('pt-BR', { month: 'short' });
            const valorTotal = matchedDespesas.reduce((s, r) => s + Math.abs(r.movimento), 0) + Math.abs(parsed.impostoVal) + Math.abs(parsed.timeShareVal) + Math.abs(parsed.issVal);
            const [historyEntry] = await supabaseService.saveImportHistory([{
                hotel,
                tipo: 'Despesa',
                ano: year,
                meses: monthName,
                version_id: versionId || null,
                user_id: null,
                valor_total: valorTotal,
            }]);
            const importId = historyEntry.id;

            // Reimportar o mesmo mês/hotel/versão substitui o que foi importado antes (em vez de
            // acumular lançamento em cima de lançamento a cada nova importação do mesmo período).
            await supabaseService.deleteFinancialDataByContext(hotel, year, month, versionId || '', 'OTB');

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
            // 'replace' troca só o que já existia pra esse mesmo contexto (hotel/ano/mês/cenário
            // OTB/versão) — se não houver nenhuma linha casada dessa vez, ainda assim precisa
            // "substituir" (zerar) o que tinha antes, então roda mesmo com a lista vazia.
            onImportData(importedRows, 'replace');
            if (importedRows.length > 0) {
                await supabaseService.saveFinancialData(importedRows, importId);
            }

            // Imposto, Cancelamento de Time Share e Receita de ISS não são "contas" — vão direto no
            // mesmo bucket do dia OTB, de onde a DRE Forecast lê o valor pronto pra essas 3 linhas.
            setRealOccupancyData(prev => ({
                ...prev,
                [otbContextKey]: {
                    ...(prev[otbContextKey] || {}),
                    '__balancete_imposto': parsed.impostoVal,
                    '__balancete_time_share': parsed.timeShareVal,
                    '__balancete_iss': parsed.issVal,
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
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[85vh] flex flex-col">
                <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-bold text-gray-800">Importar despesas do balancete</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    {imported && parsed ? (
                        <div className="space-y-4">
                            <p className="text-sm text-gray-600">Balancete importado com sucesso. Resumo do que foi para a DRE Forecast (coluna OTB):</p>
                            <div className="grid grid-cols-4 gap-4">
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
                                <div className="bg-teal-50 border border-teal-200 rounded-xl p-4">
                                    <span className="text-[10px] text-teal-500 font-bold uppercase tracking-wide">Receitas de ISS ({ISS_CODE})</span>
                                    <div className="text-xl font-bold text-teal-900 tabular-nums mt-1">{parsed.issVal.toLocaleString('pt-BR')}</div>
                                    <span className="text-[10px] text-teal-400">Linha Receita de ISS, coluna OTB</span>
                                </div>
                            </div>
                            <div className="grid grid-cols-4 gap-4">
                                {SECTOR_NAMES.map(name => (
                                    <div key={name} className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wide">Setor {name}</span>
                                        <div className="text-xl font-bold text-gray-800 tabular-nums mt-1">{(sectorTotals[name] || 0).toLocaleString('pt-BR')}</div>
                                    </div>
                                ))}
                            </div>

                            {Object.keys(foraDoEscopoPorMaster).length > 0 && (
                                <div className="grid grid-cols-4 gap-4">
                                    <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
                                        <span className="text-[10px] text-rose-500 font-bold uppercase tracking-wide">Total fora do escopo</span>
                                        <div className="text-xl font-bold text-rose-800 tabular-nums mt-1">{foraDoEscopoTotal.toLocaleString('pt-BR')}</div>
                                        <span className="text-[10px] text-rose-400">{parsed.foraDoEscopo.length} lançamentos</span>
                                    </div>
                                    {Object.entries(foraDoEscopoPorMaster).map(([name, total]) => (
                                        <ForaDoEscopoCard key={name} name={name} total={total} items={foraDoEscopoItemsPorMaster[name] || []} large />
                                    ))}
                                </div>
                            )}
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

                            <div className="grid grid-cols-4 gap-3 mb-4 text-xs">
                                <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                                    <span className="text-gray-500 font-bold uppercase">1 Ativo</span>
                                    <div className="tabular-nums font-medium text-gray-700">{parsed.ativoTotal.toLocaleString('pt-BR')}</div>
                                </div>
                                <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                                    <span className="text-gray-500 font-bold uppercase">2 Passivo</span>
                                    <div className="tabular-nums font-medium text-gray-700">{parsed.passivoTotal.toLocaleString('pt-BR')}</div>
                                </div>
                                <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                                    <span className="text-gray-500 font-bold uppercase">3 Receita</span>
                                    <div className="tabular-nums font-medium text-gray-700">{parsed.receitaTotal.toLocaleString('pt-BR')}</div>
                                </div>
                                <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                                    <span className="text-gray-500 font-bold uppercase">4 Despesa (escopo)</span>
                                    <div className="tabular-nums font-medium text-gray-700">{despesasTotal.toLocaleString('pt-BR')}</div>
                                </div>
                            </div>

                            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-2">Setores fora do escopo</p>
                            <div className="grid grid-cols-4 gap-3 mb-4 text-xs">
                                {SECTOR_NAMES.map(name => (
                                    <div key={name} className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                                        <span className="text-gray-500 font-bold uppercase">{name}</span>
                                        <div className="tabular-nums font-medium text-gray-700">{(sectorTotals[name] || 0).toLocaleString('pt-BR')}</div>
                                    </div>
                                ))}
                            </div>

                            {Object.keys(foraDoEscopoPorMaster).length > 0 && (
                                <>
                                    <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-2">Despesas fora do escopo (Plano de Contas)</p>
                                    <div className="grid grid-cols-4 gap-3 mb-4 text-xs">
                                        <div className="bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                                            <span className="text-rose-500 font-bold uppercase">Total fora do escopo</span>
                                            <div className="tabular-nums font-medium text-rose-700">{foraDoEscopoTotal.toLocaleString('pt-BR')}</div>
                                            <span className="text-[10px] text-rose-400">{parsed.foraDoEscopo.length} lançamentos</span>
                                        </div>
                                        {Object.entries(foraDoEscopoPorMaster).map(([name, total]) => (
                                            <ForaDoEscopoCard key={name} name={name} total={total} items={foraDoEscopoItemsPorMaster[name] || []} />
                                        ))}
                                    </div>
                                </>
                            )}

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
                                        <tr className="bg-sky-50">
                                            <td className="px-3 py-1.5 font-mono">{ISS_CODE}</td>
                                            <td className="px-3 py-1.5">RECEITAS DE ISS</td>
                                            <td className="px-3 py-1.5 text-sky-700 font-bold">Receita de ISS (DRE, coluna OTB)</td>
                                            <td className="px-3 py-1.5 text-right tabular-nums">{parsed.issVal.toLocaleString('pt-BR')}</td>
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
