const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://slomndzsblyodxkhbnfb.supabase.co',
  'sb_publishable_b-Nq2KZ3qFt914GdxYn9DQ_TANzKjXl'
);

async function run() {
  const { data, error } = await supabase
    .from('financial_data')
    .select('*')
    .ilike('account_name', '%Assessoria de imprensa%');
  
  if (error) {
    console.error(error);
  } else {
    console.log(data);
  }
}

run();
