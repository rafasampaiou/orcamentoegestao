import { Meeting, MeetingKind } from '../types';

// Reunião de Ritmo/FCA N1/FCA N2 são as únicas 3 que usam a tabela restrita de Ocupação (Aptos
// vendidos/DM bruta/Coef. Occ) e o fallback de Meta pra Mão de obra quando ainda não digitado —
// Fechamento e Prévia usam a tabela completa, igual "Fechamento oficial" já usava antes desta
// migração (ver decisão do usuário: Fechamento ganhou o fluxo completo de OTB/checklist, mas a
// tabela de Ocupação restrita continua sendo só das 3 reuniões de "construção da prévia").
export const RESTRICTED_TABLE_KINDS: MeetingKind[] = ['Reunião de Ritmo', 'FCA N1', 'FCA N2'];

// Nomes literais de antes desta migração (quando ProjectionType era uma union fixa) — continuam
// podendo aparecer em dados antigos (financial_data, validations, comentários, slides, chaves de
// ocupação) sem nenhum registro correspondente em `meetings`. Ver "Dados legados" no plano.
const LEGACY_KIND_BY_VALUE: Record<string, MeetingKind> = {
    'Reunião de Ritmo': 'Reunião de Ritmo',
    'FCA N1': 'FCA N1',
    'FCA N2': 'FCA N2',
    'Fechamento oficial': 'Fechamento',
};

// Mesmas 4 strings acima, só como array — usado em App.tsx pra continuar "sondando" essas chaves
// legadas ao reconstruir o snapshot de ocupação (__projections/__otbProjections) a cada save, ao
// lado dos IDs de reunião dinâmicos. Sem isso, um save feito depois desta migração reconstruiria
// o snapshot só com os IDs novos e perderia silenciosamente qualquer dado antigo ainda em memória.
export const LEGACY_MEETING_VALUES = Object.keys(LEGACY_KIND_BY_VALUE);

// Resolve um `activeProjectionType` (ID de uma Meeting criada, o literal 'Realizado', ou uma
// string legada de antes desta migração) pro MeetingKind correspondente. Retorna undefined pra
// 'Realizado' (não tem kind — é tratado como caso separado em todo lugar que usa isso) e pra
// valores desconhecidos (ex.: matriz ainda não carregada).
export function resolveMeetingKind(value: string | undefined, meetings: Meeting[]): MeetingKind | undefined {
    if (!value || value === 'Realizado') return undefined;
    const found = meetings.find(m => m.id === value);
    if (found) return found.kind;
    return LEGACY_KIND_BY_VALUE[value];
}

// Resolve o rótulo de exibição de um `activeProjectionType` — usado em qualquer lugar que hoje
// mostraria o nome cru (dropdowns, ValidationsView, título de slide deck).
export function getMeetingLabel(value: string | undefined, meetings: Meeting[]): string {
    if (!value) return '';
    if (value === 'Realizado') return 'Realizado';
    const found = meetings.find(m => m.id === value);
    if (found) return found.displayLabel;
    // Dado legado: o próprio valor já é o nome de exibição (ex.: "FCA N1"), exceto o único caso
    // em que o literal antigo e o novo rótulo divergem.
    return value === 'Fechamento oficial' ? 'Fechamento' : value;
}

// Monta a lista de opções {value, label} pros dropdowns de versão (DRE Forecast, Ocupação
// mensal, GMD, Análise de A&B) — só as reuniões do hotel/mês/ano pedido, ordenadas por data, mais
// "Realizado" quando permitido.
export function buildProjectionOptions(
    meetings: Meeting[],
    hotelId: string,
    year: number,
    month: number,
    canSelectRealizado: boolean
): { value: string; label: string }[] {
    const opts = meetings
        .filter(m => m.hotelId === hotelId && m.year === year && m.month === month)
        .sort((a, b) => a.meetingDate.localeCompare(b.meetingDate))
        .map(m => ({ value: m.id, label: m.displayLabel }));
    if (canSelectRealizado) opts.push({ value: 'Realizado', label: 'Realizado' });
    return opts;
}
