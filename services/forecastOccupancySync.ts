// Chama a função serverless (api/forecast-occupancy.js) que busca, numa planilha Google Sheets
// externa (via conta de serviço — credencial fica só no servidor), a Ocupação/Receita do
// Forecast (Aptos vendidos + DM bruta sem ISS, Eventos e Lazer) da aba "Mês - Hotel" correspondente.
export interface ForecastOccupancySheetData {
    tab: string;
    eventosAptosVendidos: number;
    eventosDM: number;
    lazerAptosVendidos: number;
    lazerDM: number;
}

export async function fetchForecastOccupancyFromSheet(hotelName: string, month: number): Promise<ForecastOccupancySheetData> {
    const res = await fetch('/api/forecast-occupancy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hotelName, month }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(json?.error || 'Erro ao buscar dados da planilha de Forecast.');
    }
    return json as ForecastOccupancySheetData;
}
