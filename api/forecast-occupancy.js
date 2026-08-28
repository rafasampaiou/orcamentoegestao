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

const normalizeTabName = (s) =>
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

// Lê uma célula em texto/número já resolvido (não a fórmula) — mesma leitura "crua" que o resto
// do app já faz ao importar planilhas com essa mesma lib (ver handleExportExcel/imports).
const readCellNumber = (sheet, address) => {
  const cell = sheet[address];
  if (!cell) return 0;
  const val = typeof cell.v === 'number' ? cell.v : Number(cell.v);
  return Number.isFinite(val) ? val : 0;
};

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
    const expected = normalizeTabName(`${monthName} - ${hotelName}`);
    const titles = workbook.SheetNames || [];
    const matchedTitle =
      titles.find((t) => normalizeTabName(t) === expected) ||
      titles.find((t) => {
        const nt = normalizeTabName(t);
        return nt.includes(normalizeTabName(hotelName)) && nt.includes(normalizeTabName(monthName));
      });

    if (!matchedTitle) {
      res.status(404).json({
        error: `Não encontrei a aba "${monthName} - ${hotelName}" nesse arquivo. Abas disponíveis: ${titles.join(', ') || '(nenhuma)'}`,
      });
      return;
    }

    const sheet = workbook.Sheets[matchedTitle];
    // AL23/AM23 — Aptos vendidos; AL24/AM24 — DM bruta (sem ISS).
    const eventosAptosVendidos = readCellNumber(sheet, 'AL23');
    const lazerAptosVendidos = readCellNumber(sheet, 'AM23');
    const eventosDM = readCellNumber(sheet, 'AL24');
    const lazerDM = readCellNumber(sheet, 'AM24');

    res.status(200).json({ tab: matchedTitle, eventosAptosVendidos, eventosDM, lazerAptosVendidos, lazerDM });
  } catch (err) {
    res.status(500).json({ error: err?.message || 'Erro desconhecido ao buscar dados da planilha.' });
  }
}
