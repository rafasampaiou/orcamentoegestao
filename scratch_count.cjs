const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://slomndzsblyodxkhbnfb.supabase.co',
  'sb_publishable_b-Nq2KZ3qFt914GdxYn9DQ_TANzKjXl'
);

async function run() {
  const { data, count, error } = await supabase
    .from('financial_data')
    .select('*', { count: 'exact' })
    .eq('version_id', 'r-1779874252541');
  
  if (error) {
    console.error(error);
  } else {
    console.log(`Total rows in DB: ${count}`);
    console.log(`Rows returned in first page: ${data.length}`);
  }
}

run();
