import crypto from 'crypto';
import * as XLSX from 'xlsx';

// Puxa Ocupação/Receita do Forecast (Aptos vendidos + DM bruta sem ISS, Eventos e Lazer) de um
// arquivo Excel que fica no Google Drive, uma aba por "NOME DO MÊS - NOME DO HOTEL". Baixa o
// arquivo BRUTO via Google Drive API (em vez da API do Google Sheets) porque é um .xlsx de fato —
// só aberto pelo Google Sheets em modo de compatibilidade, nunca convertido pra Planilhas Google
// nativa — e é assim de propósito: sempre que alguém atualiza esse Excel no Drive, a próxima
// busca já lê o conteúdo novo, sem precisar recriar/reconectar nada. Roda só aqui (Vercel
// function) porque usa uma conta de serviço do Google (credencial que nunca pode chegar ao bundle
// do navegador) — assim funciona pra qualquer usuário que clicar na etapa 4, sem depender de quem
// está logado ter acesso ao arquivo.

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';

const MONTH_FULL_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const base64url = (input) =>
  Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

// Abas às vezes divergem em acento/maiúscula do nome cadastrado do hotel (já mordeu a gente antes
// no passo 3 do balancete) — compara tudo sem acento/caixa em vez de string exata. Tira os
// diacríticos por code point (em vez de um range unicode na regex) pra não depender de como o
// arquivo é salvo/editado.
const stripDiacritics = (s) =>
  s
    .normalize('NFD')
    .split('')
    .filter((ch) => {
      const code = ch.codePointAt(0) || 0;
      return code < 0x0300 || code > 0x036f;
    })
    .join('');

const normalizeText = (s) =>
  stripDiacritics(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

async function getServiceAccountAccessToken() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKeyRaw = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!clientEmail || !privateKeyRaw) {
    throw new Error('Configuração do servidor incompleta (credenciais da conta de serviço do Google ausentes).');
  }
  // No painel do Vercel a chave privada costuma ficar com "\n" literais em vez de quebra de linha.
  const privateKey = privateKeyRaw.includes('\\n') ? privateKeyRaw.replace(/\\n/g, '\n') : privateKeyRaw;

  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${base64url(JSON.stringify({
    iss: clientEmail,
    scope: DRIVE_SCOPE,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }))}`;
  const signature = crypto.createSign('RSA-SHA256').update(unsigned).sign(privateKey);
  const signedJwt = `${unsigned}.${signature.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: signedJwt,
    }),
  });
  const tokenJson = await tokenRes.json();
  if (!tokenRes.ok || !tokenJson.access_token) {
    throw new Error(`Falha ao autenticar com o Google: ${tokenJson.error_description || tokenJson.error || tokenRes.status}`);
  }
  return tokenJson.access_token;
}

// Uma célula "visualmente" numa linha/coluna pode estar dentro de um intervalo mesclado — nesse
// caso a lib só guarda o valor na célula-âncora (canto superior esquerdo da mesclagem), as demais
// vêm vazias. Resolve pra âncora antes de ler, senão uma célula de DM mesclada lê como 0/vazio.
const resolveMergedAnchor = (sheet, r, c) => {
  const merges = sheet['!merges'] || [];
  for (const m of merges) {
    if (r >= m.s.r && r <= m.e.r && c >= m.s.c && c <= m.e.c) return { r: m.s.r, c: m.s.c };
  }
  return { r, c };
};

const getCell = (sheet, r, c) => {
  const anchor = resolveMergedAnchor(sheet, r, c);
  return sheet[XLSX.utils.encode_cell(anchor)];
};

// Número pode vir como valor numérico de fato (então cell.v já tem toda a precisão, mesmo que a
// formatação de exibição do Excel arredonde/oculte casas decimais — isso é só cosmético) OU como
// texto digitado no formato BR ("1.304,37" ou só "1.304", ponto de milhar/vírgula decimal) — nesse
// segundo caso, Number("1.304") direto dá 1.304 (errado, JS lê ponto como decimal). Só remove os
// pontos como separador de milhar quando há vírgula decimal por perto, pra não estragar um número
// que já esteja em formato US (ponto decimal) sem vírgula nenhuma.
const parseCellNumber = (cell) => {
  if (!cell) return 0;
  if (typeof cell.v === 'number') return cell.v;
  const raw = String(cell.v ?? cell.w ?? '').trim();
  if (!raw) return 0;
  const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw;
  const val = Number(normalized);
  return Number.isFinite(val) ? val : 0;
};

const readNum = (sheet, r, c) => parseCellNumber(getCell(sheet, r, c));
const readText = (sheet, r, c) => {
  const cell = getCell(sheet, r, c);
  return normalizeText(cell ? String(cell.v ?? cell.w ?? '') : '');
};

// A tabela "Indicadores / Receita Evento / Receita Lazer / Receita Total" não fica sempre
// ancorada em AK21:AN24 — cada aba (mês/hotel) é montada manualmente e desliza uma linha/coluna
// pra lá ou pra cá. Em vez de um endereço fixo, procura pelos RÓTULOS de texto (o cabeçalho e as
// linhas "Room Nights"/"Diária Média") em qualquer lugar da aba, e lê os valores relativos a onde
// eles de fato estiverem — assim funciona mesmo com esse deslize entre abas.
function findIndicatorsTable(sheet) {
  const ref = sheet['!ref'];
  if (!ref) throw new Error('Aba vazia (sem intervalo de células).');
  const range = XLSX.utils.decode_range(ref);

  for (let r = range.s.r; r <= range.e.r; r++) {
    // Varre a linha inteira em busca da célula "Indicadores" (não só na 1ª coluna) — a tabela
    // pode começar em qualquer coluna.
    for (let c = range.s.c; c <= range.e.c; c++) {
      if (readText(sheet, r, c) !== 'indicadores') continue;

      const eventCol = c + 1;
      const lazerCol = c + 2;
      const eventHeader = readText(sheet, r, eventCol);
      const lazerHeader = readText(sheet, r, lazerCol);
      if (!eventHeader.includes('evento') || !lazerHeader.includes('lazer')) continue;

      // Linhas de dado logo abaixo do cabeçalho (Receita / Room Nights / Diária Média) — procura
      // numa janela pequena, não assume posição fixa também pras linhas.
      let aptosRow = null;
      let dmRow = null;
      for (let dr = r + 1; dr <= Math.min(r + 8, range.e.r); dr++) {
        const label = readText(sheet, dr, c);
        if (aptosRow === null && (label.includes('room night') || label.includes('aptos vendid'))) aptosRow = dr;
        if (dmRow === null && (label.includes('diaria media') || label.includes('dm bruta'))) dmRow = dr;
      }
      if (aptosRow === null || dmRow === null) continue;

      return {
        eventosAptosVendidos: readNum(sheet, aptosRow, eventCol),
        lazerAptosVendidos: readNum(sheet, aptosRow, lazerCol),
        eventosDM: readNum(sheet, dmRow, eventCol),
        lazerDM: readNum(sheet, dmRow, lazerCol),
      };
    }
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const hotelName = typeof req.body?.hotelName === 'string' ? req.body.hotelName.trim() : '';
  const month = Number(req.body?.month);

  if (!hotelName || !month || month < 1 || month > 12) {
    res.status(400).json({ error: 'Parâmetros obrigatórios: hotelName e month (1-12).' });
    return;
  }

  const fileId = process.env.FORECAST_OCCUPANCY_SPREADSHEET_ID;
  if (!fileId) {
    res.status(500).json({ error: 'Configuração do servidor incompleta (arquivo de Forecast não configurado).' });
    return;
  }

  try {
    const accessToken = await getServiceAccountAccessToken();

    const fileRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!fileRes.ok) {
      const errText = await fileRes.text().catch(() => '');
      let message = errText;
      try { message = JSON.parse(errText)?.error?.message || errText; } catch { /* keep raw text */ }
      res.status(502).json({ error: `Erro ao baixar o arquivo do Drive: ${message || fileRes.status}` });
      return;
    }
    const arrayBuffer = await fileRes.arrayBuffer();
    const workbook = XLSX.read(Buffer.from(arrayBuffer), { type: 'buffer' });

    const monthName = MONTH_FULL_NAMES[month - 1];
    const expected = normalizeText(`${monthName} - ${hotelName}`);
    const titles = workbook.SheetNames || [];
    const matchedTitle =
      titles.find((t) => normalizeText(t) === expected) ||
      titles.find((t) => {
        const nt = normalizeText(t);
        return nt.includes(normalizeText(hotelName)) && nt.includes(normalizeText(monthName));
      });

    if (!matchedTitle) {
      res.status(404).json({
        error: `Não encontrei a aba "${monthName} - ${hotelName}" nesse arquivo. Abas disponíveis: ${titles.join(', ') || '(nenhuma)'}`,
      });
      return;
    }

    const sheet = workbook.Sheets[matchedTitle];
    const table = findIndicatorsTable(sheet);
    if (!table) {
      res.status(404).json({
        error: `Não encontrei a tabela "Indicadores / Receita Evento / Receita Lazer" na aba "${matchedTitle}" (procurei em toda a aba, não só perto de AK21:AN24).`,
      });
      return;
    }

    res.status(200).json({ tab: matchedTitle, ...table });
  } catch (err) {
    res.status(500).json({ error: err?.message || 'Erro desconhecido ao buscar dados da planilha.' });
  }
}
