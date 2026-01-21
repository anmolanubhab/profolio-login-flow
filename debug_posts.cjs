
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://ajbhpqbfcpmztjtxqxxk.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqYmhwcWJmY3BtenRqdHhxeHhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQwMzIwODQsImV4cCI6MjA2OTYwODA4NH0.t-7Ti6dRvPDPOfcwUkZ4WaYGvCsNnGBN2AO-kwrx7VI";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkPosts() {
  console.log('Checking posts...');
  
  // 1. Get a company ID (just taking the first one found in posts or companies)
  const { data: companies, error: companyError } = await supabase
    .from('companies')
    .select('id, name')
    .limit(5);

  if (companyError) {
    console.error('Error fetching companies:', companyError);
    return;
  }

  console.log('Found companies:', companies);

  if (companies.length === 0) {
    console.log('No companies found.');
    return;
  }

  // 2. Check posts for these companies
  for (const company of companies) {
    console.log(`\nChecking posts for company: ${company.name} (${company.id})`);
    
    const { data: posts, error: postsError } = await supabase
      .from('posts')
      .select('id, content, status, posted_as, company_id')
      .eq('company_id', company.id);

    if (postsError) {
      console.error('Error fetching posts:', postsError);
      continue;
    }

    console.log(`Found ${posts.length} posts:`);
    if (posts.length > 0) {
      console.table(posts);
    } else {
      console.log('No posts found for this company.');
    }
  }
}

checkPosts();
