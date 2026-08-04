// Integração com Google Drive/Slides pro botão "Gerar Apresentação" (DRE Forecast).
// 100% client-side (Google Identity Services) — cada usuário autoriza com a própria conta
// @taua.com.br, e a cópia/apresentação fica salva no Drive DELE, não numa conta de serviço.
//
// Configuração necessária (.env):
//   VITE_GOOGLE_CLIENT_ID           — OAuth Client ID (Google Cloud Console)
//   VITE_GOOGLE_SLIDES_TEMPLATE_ID  — ID do arquivo-molde no Google Slides

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
export const SLIDES_TEMPLATE_ID = import.meta.env.VITE_GOOGLE_SLIDES_TEMPLATE_ID || '';

// drive.file: só arquivos criados/abertos pelo app (a cópia gerada) — não pede acesso a todo
// o Drive do usuário. presentations: editar a cópia (texto, imagens, slides).
const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/presentations';

let cachedToken: { accessToken: string; expiresAt: number } | null = null;
let gisScriptLoaded: Promise<void> | null = null;

function loadGisScript(): Promise<void> {
    if (gisScriptLoaded) return gisScriptLoaded;
    gisScriptLoaded = new Promise((resolve, reject) => {
        if ((window as any).google?.accounts?.oauth2) { resolve(); return; }
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Não foi possível carregar o script do Google.'));
        document.head.appendChild(script);
    });
    return gisScriptLoaded;
}

// Pede um token de acesso via Google Identity Services (popup de login/consentimento) — só
// mostra o popup se não houver um token em cache ainda válido.
export async function ensureGoogleAccessToken(): Promise<string> {
    if (!CLIENT_ID) {
        throw new Error('VITE_GOOGLE_CLIENT_ID não configurado — veja o .env.');
    }
    if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
        return cachedToken.accessToken;
    }
    await loadGisScript();
    return new Promise((resolve, reject) => {
        const client = (window as any).google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SCOPES,
            callback: (resp: any) => {
                if (resp.error) { reject(new Error(`Login com Google falhou: ${resp.error}`)); return; }
                cachedToken = { accessToken: resp.access_token, expiresAt: Date.now() + (resp.expires_in || 3600) * 1000 };
                resolve(resp.access_token);
            },
            error_callback: (err: any) => reject(new Error(err?.message || 'Login com Google cancelado ou falhou.')),
        });
        client.requestAccessToken();
    });
}

async function driveFetch(path: string, token: string, init: RequestInit = {}): Promise<any> {
    const res = await fetch(`https://www.googleapis.com/drive/v3/${path}`, {
        ...init,
        headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Drive API (${path}) falhou: ${res.status} ${await res.text()}`);
    return res.status === 204 ? null : res.json();
}

async function slidesFetch(path: string, token: string, init: RequestInit = {}): Promise<any> {
    const res = await fetch(`https://slides.googleapis.com/v1/${path}`, {
        ...init,
        headers: { ...(init.headers || {}), Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(`Slides API (${path}) falhou: ${res.status} ${await res.text()}`);
    return res.json();
}

// Acha (ou cria) uma pasta com esse nome dentro do pai indicado — usado pra montar
// "Apresentações Forecast" / "{hotel}" / "{ano}" automaticamente no Drive do usuário.
export async function ensureDriveFolder(token: string, name: string, parentId?: string): Promise<string> {
    const q = [
        `name = '${name.replace(/'/g, "\\'")}'`,
        "mimeType = 'application/vnd.google-apps.folder'",
        'trashed = false',
        parentId ? `'${parentId}' in parents` : "'root' in parents",
    ].join(' and ');
    const found = await driveFetch(`files?q=${encodeURIComponent(q)}&fields=files(id,name)`, token);
    if (found.files && found.files.length > 0) return found.files[0].id;

    const created = await driveFetch('files?fields=id', token, {
        method: 'POST',
        body: JSON.stringify({
            name,
            mimeType: 'application/vnd.google-apps.folder',
            parents: parentId ? [parentId] : undefined,
        }),
    });
    return created.id;
}

// Duplica o template pro Drive do usuário, dentro da pasta hotel/ano, com um nome legível.
export async function copyTemplatePresentation(token: string, name: string, folderId: string): Promise<{ id: string; url: string }> {
    if (!SLIDES_TEMPLATE_ID) throw new Error('VITE_GOOGLE_SLIDES_TEMPLATE_ID não configurado — veja o .env.');
    const copy = await driveFetch(`files/${SLIDES_TEMPLATE_ID}/copy?fields=id`, token, {
        method: 'POST',
        body: JSON.stringify({ name, parents: [folderId] }),
    });
    return { id: copy.id, url: `https://docs.google.com/presentation/d/${copy.id}/edit` };
}

// Sobe a imagem capturada (screenshot da tela) pro Drive e libera leitura por link — a Slides
// API busca a URL do servidor do Google, então o arquivo precisa estar acessível por link (não
// só pelo usuário logado).
export async function uploadImageAndGetPublicUrl(token: string, blob: Blob, name: string, folderId: string): Promise<string> {
    const metadata = { name, parents: [folderId], mimeType: 'image/png' };
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', blob);

    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
    });
    if (!res.ok) throw new Error(`Upload da imagem falhou: ${res.status} ${await res.text()}`);
    const { id } = await res.json();

    await driveFetch(`files/${id}/permissions`, token, {
        method: 'POST',
        body: JSON.stringify({ type: 'anyone', role: 'reader' }),
    });

    return `https://drive.google.com/uc?export=view&id=${id}`;
}

export interface PresentationStructure {
    pageSize: { width: number; height: number }; // EMU
    slideIds: string[]; // na ordem em que aparecem
}

export async function getPresentationStructure(token: string, presentationId: string): Promise<PresentationStructure> {
    const pres = await slidesFetch(`presentations/${presentationId}`, token);
    return {
        pageSize: {
            width: pres.pageSize?.width?.magnitude || 9144000,
            height: pres.pageSize?.height?.magnitude || 5143500,
        },
        slideIds: (pres.slides || []).map((s: any) => s.objectId),
    };
}

export async function batchUpdatePresentation(token: string, presentationId: string, requests: any[]): Promise<any> {
    if (requests.length === 0) return null;
    return slidesFetch(`presentations/${presentationId}:batchUpdate`, token, {
        method: 'POST',
        body: JSON.stringify({ requests }),
    });
}

// Texto literal do título no slide-molde (banner verde) — trocado pelo título de cada seção
// gerada. Ver utils/slidesCaptureTargets.ts.
export const TEMPLATE_SLIDE_TITLE_PLACEHOLDER = 'DRE';

// Duplica o slide-molde, ajusta o título e cola a imagem capturada — tudo numa única chamada de
// batchUpdate. Retorna o objectId do novo slide.
export async function addContentSlideFromMold(
    token: string,
    presentationId: string,
    moldSlideId: string,
    insertAtIndex: number,
    title: string,
    imageUrl: string,
    imageSize: { width: number; height: number }, // px da imagem capturada — pra não distorcer
    pageSize: { width: number; height: number }
): Promise<string> {
    const dup = await batchUpdatePresentation(token, presentationId, [
        { duplicateObject: { objectId: moldSlideId } },
    ]);
    const newSlideId = dup.replies[0].duplicateObject.objectId;

    // Margens de ~5% do tamanho da página; a imagem entra abaixo do banner do título, mantendo a
    // proporção original (contain-fit) dentro desse espaço em branco — sem esticar/distorcer.
    const marginX = pageSize.width * 0.05;
    const maxWidth = pageSize.width - marginX * 2;
    const imageTop = pageSize.height * 0.18;
    const maxHeight = pageSize.height - imageTop - pageSize.height * 0.04;

    const scale = Math.min(maxWidth / imageSize.width, maxHeight / imageSize.height);
    const finalWidth = imageSize.width * scale;
    const finalHeight = imageSize.height * scale;
    const translateX = marginX + (maxWidth - finalWidth) / 2; // centralizada horizontalmente

    const requests: any[] = [
        { updateSlidesPosition: { slideObjectIds: [newSlideId], insertionIndex: insertAtIndex } },
    ];
    if (title !== TEMPLATE_SLIDE_TITLE_PLACEHOLDER) {
        requests.push({
            replaceAllText: {
                containsText: { text: TEMPLATE_SLIDE_TITLE_PLACEHOLDER, matchCase: true },
                replaceText: title,
                pageObjectIds: [newSlideId],
            },
        });
    }
    requests.push({
        createImage: {
            url: imageUrl,
            elementProperties: {
                pageObjectId: newSlideId,
                size: { width: { magnitude: finalWidth, unit: 'EMU' }, height: { magnitude: finalHeight, unit: 'EMU' } },
                transform: { scaleX: 1, scaleY: 1, translateX, translateY: imageTop, unit: 'EMU' },
            },
        },
    });

    await batchUpdatePresentation(token, presentationId, requests);
    return newSlideId;
}

export async function deleteSlide(token: string, presentationId: string, slideId: string): Promise<void> {
    await batchUpdatePresentation(token, presentationId, [{ deleteObject: { objectId: slideId } }]);
}

// Preenche as 2 caixas de texto da subcapa — a Slides API substitui por texto exato em todo o
// arquivo, então os placeholders no template precisam ser únicos (ex.: {{VERSAO}}, {{HOTEL_DATA}}).
export async function fillCoverPlaceholders(token: string, presentationId: string, replacements: Record<string, string>): Promise<void> {
    const requests = Object.entries(replacements).map(([placeholder, value]) => ({
        replaceAllText: { containsText: { text: placeholder, matchCase: true }, replaceText: value },
    }));
    await batchUpdatePresentation(token, presentationId, requests);
}
