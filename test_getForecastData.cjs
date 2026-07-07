const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://slomndzsblyodxkhbnfb.supabase.co', 'sb_publishable_b-Nq2KZ3qFt914GdxYn9DQ_TANzKjXl');

async function run() {
    const { data: fd } = await supabase.from('financial_data').select('*').eq('month', 5).eq('scenario', 'PREVIA');
    const { data: accounts } = await supabase.from('accounts').select('*');
    
    const dataIndex = new Map();
    const normalizeAccountName = (name) => {
        if (!name) return '';
        return name
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/oes/g, 'ao')
            .replace(/aes/g, 'ao')
            .replace(/s\b/g, '')
            .replace(/[^a-z0-9]/g, '');
    };

    fd.forEach(row => {
        const normConta = normalizeAccountName(row.account_name);
        const keyConta = `${row.year}|${row.month}|${row.hotel.toUpperCase()}|${row.scenario}|${normConta}`;
        dataIndex.set(keyConta, (dataIndex.get(keyConta) || 0) + row.value);
    });

    const pkgAccs = accounts.filter(a => a.master_package === 'DESPESAS COM VENDAS E MARKETING' && a.package === 'Despesas com Vendas e Marketing');
    
    let sumPrevia = 0;
    pkgAccs.forEach(acc => {
        const val = dataIndex.get(`2026|5|ATIBAIA|PREVIA|${normalizeAccountName(acc.name)}`) || 0;
        console.log(acc.name + ': ' + val);
        sumPrevia += val;
    });
    
    console.log('Total Vendas: ' + sumPrevia);

    const pkgFin = accounts.filter(a => a.master_package === 'DESPESAS FINANCEIRAS E BANCARIAS' && a.package === 'Despesas Financeiras e Bancarias');
    let sumFin = 0;
    pkgFin.forEach(acc => {
        const val = dataIndex.get(`2026|5|ATIBAIA|PREVIA|${normalizeAccountName(acc.name)}`) || 0;
        console.log(acc.name + ': ' + val);
        sumFin += val;
    });
    console.log('Total Financeiras: ' + sumFin);
}

run();
