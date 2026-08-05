// html2canvas-pro (não o html2canvas original) — o original não sabe interpretar a função de
// cor oklch(), que é o padrão do Tailwind v4 usado neste projeto; esse fork suporta oklch/lab/
// color-mix e é um substituto direto (mesma API).
import html2canvas from 'html2canvas-pro';
import { CaptureSpec, SlideCaptureTarget } from './slidesCaptureTargets';

// Ajustes feitos só no CLONE que o html2canvas usa pra desenhar a imagem — nunca na tela real.
function prepareCloneForCapture(clonedDoc: Document) {
    // html2canvas tem suporte limitado a elementos de formulário (<input>/<textarea>) — em vez de
    // pintar o elemento a partir do CSS computado normalmente, ele desenha um substituto próprio,
    // que às vezes ignora "border: 1px solid transparent" (usado nas células editáveis da DRE
    // Forecast pra reservar o espaço da borda de foco sem mostrar nada) e desenha uma borda visível
    // por padrão — aparecia como uma caixinha em volta de valores da Prévia que na tela não têm
    // caixa nenhuma.
    clonedDoc.querySelectorAll('input, textarea, select').forEach((el) => {
        const style = (el as HTMLElement).style;
        style.border = 'none';
        style.outline = 'none';
        style.boxShadow = 'none';
    });
    // Elementos marcados com data-slide-capture-hide (ex.: os filtros/pills da Análise de A&B) não
    // entram na apresentação — só as tabelas de dados. O elemento continua normal na tela real.
    clonedDoc.querySelectorAll('[data-slide-capture-hide]').forEach((el) => {
        (el as HTMLElement).style.display = 'none';
    });
}

// Captura um elemento da tela exatamente como está renderizado no momento do clique (mesmas
// colunas mostradas/ocultas, mesmo filtro etc.) — usado pelo "Gerar Apresentação" (App.tsx) pra
// colar o "print" de cada seção nos slides do Google Slides.
//
// Alguns contêineres (ex.: a tabela da DRE Forecast) têm altura máxima + scroll interno pra
// caber na tela — capturando assim, html2canvas só renderizaria o trecho visível no momento (o
// que estiver rolado pra fora ficaria de fora do print). Por isso, antes de capturar, remove
// temporariamente max-height/overflow do próprio elemento (e restaura em seguida) pra garantir
// que o conteúdo inteiro entre no print, não só o que cabia na tela.
export async function captureElementToCanvas(element: HTMLElement): Promise<HTMLCanvasElement> {
    const prevMaxHeight = element.style.maxHeight;
    const prevOverflow = element.style.overflow;
    const prevWidth = element.style.width;
    // Fixa a largura no valor real já renderizado na tela antes de capturar — sem isso, elementos
    // "inline-block"/flex-wrap (ex.: os cards de Análise de A&B lado a lado) podem ser reclonados
    // pelo html2canvas assumindo uma largura de layout diferente da tela, o que fazia colunas que
    // deveriam ficar coladas uma na outra aparecerem bem separadas, com um vão em branco enorme.
    const measuredWidth = element.getBoundingClientRect().width;
    element.style.maxHeight = 'none';
    element.style.overflow = 'visible';
    element.style.width = `${measuredWidth}px`;
    try {
        return await html2canvas(element, {
            scale: 2, // retina — texto pequeno da DRE Forecast fica legível no slide
            backgroundColor: '#ffffff',
            useCORS: true,
            // foreignObjectRendering (renderização via SVG) chegou a ser testada aqui, mas em telas
            // mais complexas (Análise de A&B) renderizava só parte do conteúdo (resto ficava em
            // branco) — voltado pro modo padrão (canvas 2D, mais lento porém mais confiável nesses
            // layouts).
            onclone: prepareCloneForCapture,
        });
    } finally {
        element.style.maxHeight = prevMaxHeight;
        element.style.overflow = prevOverflow;
        element.style.width = prevWidth;
    }
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
    return new Promise((resolve, reject) => {
        canvas.toBlob(blob => {
            if (blob) resolve(blob);
            else reject(new Error('Falha ao gerar a imagem da captura.'));
        }, 'image/png');
    });
}

export async function captureElementAsPngBlob(element: HTMLElement): Promise<Blob> {
    return canvasToPngBlob(await captureElementToCanvas(element));
}

export async function captureElementByIdAsPngBlob(elementId: string): Promise<Blob> {
    const el = document.getElementById(elementId);
    if (!el) throw new Error(`Elemento "${elementId}" não encontrado pra captura.`);
    return captureElementAsPngBlob(el);
}

// Captura um elemento inteiro e recorta só o trecho vertical entre dois elementos-marcadores
// dentro dele (ex.: "da linha X até a linha Y" numa tabela grande) — usado pra dividir a DRE
// Forecast (uma única tabela) em "partes" sem precisar mudar como ela é renderizada.
//
// A escala usada pra converter a posição dos marcadores (em pixels de tela) pra pixels da
// imagem capturada é calculada pela ALTURA (canvas.height ÷ scrollHeight do container), não pela
// largura — a tabela da DRE costuma ter rolagem horizontal (mais colunas do que cabe na tela), e
// nesse caso largura visível (clientWidth) ≠ largura renderizada pelo html2canvas (scrollWidth),
// o que fazia o recorte vertical calcular a proporção errada e "vazar" bem além do marcador de
// baixo. Além disso, tudo é medido enquanto o container ainda está com max-height/overflow
// removidos (mesmo estado em que o html2canvas realmente capturou), não depois de restaurados.
export async function captureElementRegionByIdAsPngBlob(
    containerId: string,
    topMarkerId: string,
    bottomMarkerId: string
): Promise<Blob> {
    const container = document.getElementById(containerId);
    const topEl = document.getElementById(topMarkerId);
    const bottomEl = document.getElementById(bottomMarkerId);
    if (!container) throw new Error(`Elemento "${containerId}" não encontrado pra captura.`);
    if (!topEl || !bottomEl) throw new Error(`Marcador de recorte não encontrado ("${topMarkerId}" / "${bottomMarkerId}").`);

    const prevMaxHeight = container.style.maxHeight;
    const prevOverflow = container.style.overflow;
    const prevWidth = container.style.width;
    const prevScrollLeft = container.scrollLeft;
    container.style.maxHeight = 'none';
    container.style.overflow = 'visible';
    // A tabela da DRE tem mais colunas do que cabe na tela (rolagem horizontal) — sem fixar a
    // largura no scrollWidth (largura total do conteúdo, não só a visível) e sem zerar o scroll,
    // a captura saía mostrando só o trecho de colunas que estava rolado no momento do clique
    // (faltando a coluna "Descrição" à esquerda, por exemplo), em vez da tabela inteira.
    container.style.width = `${container.scrollWidth}px`;
    container.scrollLeft = 0;

    let cropTop: number, cropBottom: number, canvas: HTMLCanvasElement;
    try {
        const scrollHeightAtCapture = container.scrollHeight;
        canvas = await html2canvas(container, { scale: 2, backgroundColor: '#ffffff', useCORS: true, onclone: prepareCloneForCapture });
        const verticalScale = canvas.height / scrollHeightAtCapture;

        const containerTop = container.getBoundingClientRect().top;
        cropTop = Math.max(0, (topEl.getBoundingClientRect().top - containerTop) * verticalScale);
        cropBottom = Math.min(canvas.height, (bottomEl.getBoundingClientRect().bottom - containerTop) * verticalScale);
    } finally {
        container.style.maxHeight = prevMaxHeight;
        container.style.overflow = prevOverflow;
        container.style.width = prevWidth;
        container.scrollLeft = prevScrollLeft;
    }
    const cropHeight = Math.max(1, cropBottom - cropTop);

    const cropped = document.createElement('canvas');
    cropped.width = canvas.width;
    cropped.height = cropHeight;
    const ctx = cropped.getContext('2d');
    if (!ctx) throw new Error('Não foi possível recortar a imagem capturada.');
    ctx.drawImage(canvas, 0, -cropTop);

    return canvasToPngBlob(cropped);
}

// Dimensões reais (px) de uma imagem PNG capturada — usado pra colar no slide preservando a
// proporção original (contain-fit), sem esticar/distorcer.
export async function getPngBlobSize(blob: Blob): Promise<{ width: number; height: number }> {
    const img = await blobToImage(blob);
    return { width: img.naturalWidth, height: img.naturalHeight };
}

function blobToImage(blob: Blob): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Falha ao carregar imagem capturada.')); };
        img.src = url;
    });
}

// Empilha várias imagens verticalmente numa só (ex.: recorte de tabela + card separado abaixo) —
// alinhadas à esquerda, com a largura do mais largo dos dois. Um espaço em branco entre cada
// imagem (gapPx, em pixels da imagem final) evita que blocos sem relação visual (ex.: fim de uma
// tabela colado no rótulo de outra seção) pareçam uma coisa só/duplicada.
export async function stackPngBlobsVertically(blobs: Blob[], gapPx: number = 0): Promise<Blob> {
    const images = await Promise.all(blobs.map(blobToImage));
    const width = Math.max(...images.map(i => i.width));
    const height = images.reduce((sum, i) => sum + i.height, 0) + gapPx * (images.length - 1);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Não foi possível montar a imagem combinada.');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    let y = 0;
    images.forEach((img, i) => {
        ctx.drawImage(img, 0, y);
        y += img.height + (i < images.length - 1 ? gapPx : 0);
    });

    return canvasToPngBlob(canvas);
}

async function resolveCaptureSpec(spec: CaptureSpec): Promise<Blob> {
    if (spec.kind === 'element') return captureElementByIdAsPngBlob(spec.elementId);
    return captureElementRegionByIdAsPngBlob(spec.containerId, spec.topMarkerId, spec.bottomMarkerId);
}

// Resolve todas as capturas de um slide (uma ou mais, empilhadas) numa única imagem final —
// usado pelo "Gerar Apresentação" (App.tsx) pra cada item de SLIDES_CAPTURE_TARGETS.
export async function captureSlideTarget(target: SlideCaptureTarget): Promise<Blob> {
    const blobs = await Promise.all(target.captures.map(resolveCaptureSpec));
    return blobs.length === 1 ? blobs[0] : stackPngBlobsVertically(blobs, 40);
}
