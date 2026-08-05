// Lista dos "prints" que entram na apresentação gerada (botão "Gerar Apresentação" na DRE
// Forecast) — cada item vira uma cópia do slide-molde (banner com título + espaço pro print),
// na ordem em que aparecem aqui. Pensada pra crescer: pra adicionar um novo print no futuro,
// basta um novo item aqui (com o(s) elemento(s) a capturar) — não precisa tocar na lógica de
// geração em si (App.tsx).

// Uma captura simples de um elemento inteiro (ex.: a tela de Análise de A&B completa).
interface ElementCapture {
    kind: 'element';
    elementId: string;
}
// Um recorte vertical de um elemento maior, entre dois marcadores — usado pra dividir a tabela
// única da DRE Forecast em "partes" sem mudar como ela é renderizada (ver utils/captureElement.ts).
interface RegionCapture {
    kind: 'region';
    containerId: string;
    topMarkerId: string;
    bottomMarkerId: string;
}
export type CaptureSpec = ElementCapture | RegionCapture;

export interface SlideCaptureTarget {
    id: string; // só pra log/depuração
    // Texto que substitui o título no banner verde do slide-molde.
    title: string;
    // Em qual tela (ViewState) os elementos existem — a geração troca de tela quando necessário,
    // espera renderizar, captura, e segue pro próximo (ou volta pra tela original ao final).
    view: 'dashboard' | 'ab_analysis' | 'gmd';
    // Uma ou mais capturas, empilhadas verticalmente numa imagem só (ex.: recorte da tabela +
    // card de Transformação/Reatividade, que é um elemento separado abaixo da tabela).
    captures: CaptureSpec[];
}

// Lista definitiva (confirmada 2026-08-05): ocupação/receita, despesas+GOP+transformação, Análise
// de A&B, Resumo de A&B, GMD — nessa ordem. Ids usados em components/ForecastTable.tsx e
// components/AnaliseABView.tsx.
export const SLIDES_CAPTURE_TARGETS: SlideCaptureTarget[] = [
    {
        id: 'dre-parte-1',
        title: 'DRE',
        view: 'dashboard',
        captures: [
            // Do topo da tabela até "Receita de ISS" (inclusive) — Impostos e Receita Líquida
            // ficam pro início do slide de despesas/GOP, não são perdidos.
            { kind: 'region', containerId: 'dre-scroll-container', topMarkerId: 'dre-scroll-container', bottomMarkerId: 'dre-row-REV-ISS' },
        ],
    },
    {
        id: 'dre-parte-2',
        title: 'DRE',
        view: 'dashboard',
        captures: [
            // Cabeçalho da tabela (colunas OTBS/PRÉVIA/FORECAST/META/Δ etc.) empilhado em cima do
            // recorte — sem ele, quem visse só essa parte não saberia a qual coluna cada valor pertence.
            { kind: 'region', containerId: 'dre-scroll-container', topMarkerId: 'dre-scroll-container', bottomMarkerId: 'dre-table-header' },
            // De "Impostos" (linha seguinte à Receita de ISS do slide anterior) até "GOP com dedução
            // de impostos (%)", seguido dos cards de Transformação/Reatividade.
            { kind: 'region', containerId: 'dre-scroll-container', topMarkerId: 'dre-row-REV-IMP', bottomMarkerId: 'dre-row-RES-OP-COM-IMP-PCT' },
            { kind: 'element', elementId: 'slides-capture-dre-cards' },
        ],
    },
    {
        id: 'analise-ab',
        title: 'Análise de A&B',
        view: 'ab_analysis',
        captures: [{ kind: 'element', elementId: 'slides-capture-analise-ab' }],
    },
    {
        id: 'resumo-mensal',
        title: 'Resumo Mensal',
        view: 'ab_analysis',
        captures: [{ kind: 'element', elementId: 'slides-capture-resumo-mensal' }],
    },
    {
        id: 'gmd',
        title: 'GMD',
        view: 'gmd',
        captures: [{ kind: 'element', elementId: 'slides-capture-gmd' }],
    },
];
