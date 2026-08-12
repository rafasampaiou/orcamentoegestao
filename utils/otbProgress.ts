import { ImportedRow, ProjectionType, ValidationRecord } from '../types';
import { normalizeHotelName } from '../services/mockData';

export const OTB_STEP_LABELS = [
    'Escolher o dia final On the books',
    'Inserir a ocupação On the books',
    'Inserir despesas do balancete por CR',
    'Inserir a ocupação e receita do Forecast',
    'Calcular Forecast',
    'Incluir despesas da prévia',
    'Validar informações',
    'Salvar projeção',
];

interface ComputeOtbProgressParams {
    realOccupancyData: Record<string, Record<string, number>>;
    financialData: ImportedRow[];
    validations: ValidationRecord[];
    hotel: string;
    year: number;
    month: number;
    versionId: string;
    projectionType: ProjectionType;
}

const GERAL_BASE_IDS = ['geral_sold', 'geral_dm_fap', 'lazer_sold', 'lazer_dm_fap', 'event_sold', 'event_dm_fap'];

// Um "bucket" de ocupação guarda tanto valores brutos (modo On the books/Fechamento, sem
// sufixo) quanto _forecast/_previa (modo Realizado/comparativo) — checa os três formatos.
const hasOccupancyData = (bucket: Record<string, number>) =>
    GERAL_BASE_IDS.some(id => (bucket[id] || bucket[`${id}_forecast`] || bucket[`${id}_previa`] || 0) !== 0);

// 6 dos 8 passos são detectados automaticamente a partir do que já foi preenchido; os passos 6
// (Incluir despesas da prévia) e 7 (Validar informações) são marcação manual do usuário — ver
// components/OtbProgressTimeline.tsx (o passo 6 mostra um check pulsando, convidando a confirmar,
// assim que pelo menos uma despesa é preenchida — ver ForecastTable.tsx).
export function computeOtbProgress(params: ComputeOtbProgressParams): boolean[] {
    const { realOccupancyData, financialData, validations, hotel, year, month, versionId, projectionType } = params;

    const otbKey = `${hotel}_${year}_${month}_${versionId}__${projectionType}__OTB`;
    const normalKey = `${hotel}_${year}_${month}_${versionId}__${projectionType}`;
    const otbData = realOccupancyData[otbKey] || {};
    const normalData = realOccupancyData[normalKey] || {};

    // normalizeHotelName ignora acento além de caixa/espaço — sem isso, um hotel com acento
    // (ex. "Alexânia", "Araxá") cujo balancete OTB foi importado com grafia levemente diferente
    // nunca teria o passo 3 marcado, travando a timeline antes de 8/8 e desabilitando "Gerar
    // Apresentação" mesmo com o balancete de fato importado (mesma causa já corrigida em
    // services/mockData.ts/ComparativesView.tsx pra Despesa/Imposto/Receita).
    const hotelUpper = normalizeHotelName(hotel);

    const step1 = !!otbData['__otb_day'];
    const step2 = hasOccupancyData(otbData);
    const step3 = financialData.some(r =>
        (r.cenario || '').trim().toLowerCase() === 'otb' &&
        parseInt(r.mes) === month &&
        parseInt(r.ano) === year &&
        normalizeHotelName(r.hotel || '') === hotelUpper
    );
    const step4 = hasOccupancyData(normalData);
    // Ordem trocada a pedido: passo 5 é "Calcular Forecast" (flag manual), passo 6 é
    // "Incluir despesas da prévia" (também manual — confirmada pelo usuário, não só detectada).
    const step5 = !!otbData['__forecast_calculated'];
    const step6 = !!otbData['__previa_despesas_confirmada'];
    const step7 = !!otbData['__validado_manual'];
    const step8 = validations.some(v =>
        v.projectionType === projectionType && v.month === month && v.year === year && v.hotelId === hotel
    );

    return [step1, step2, step3, step4, step5, step6, step7, step8];
}
