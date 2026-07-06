const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://slomndzsblyodxkhbnfb.supabase.co',
  'sb_publishable_b-Nq2KZ3qFt914GdxYn9DQ_TANzKjXl'
);

async function simulate() {
  const { data: rows } = await supabase
    .from('financial_data')
    .select('*')
    .eq('version_id', 'r-1779874252541')
    .ilike('account_name', '%ssessoria%');

  rows.forEach(r => {
    const val = parseFloat(r.value || 0);
    const normConta = r.account_name.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    console.log(`Original: "${r.account_name}", Normalized: "${normConta}", Value: ${val}, Month: ${r.month}, Scenario: ${r.scenario}`);
  });
}

simulate();
