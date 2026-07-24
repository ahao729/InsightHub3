#!/usr/bin/env node
// ============================================================
// InsightHub Search — Demo Script
// ============================================================

import { InsightHubSearch } from './src/index.js';

async function main() {
  const query = process.argv[2] || 'InsightHub search engine';
  
  console.log(`\n🔍 Searching: "${query}"\n`);
  console.log('='.repeat(60));
  
  const search = new InsightHubSearch();
  
  try {
    const results = await search.search(query, {
      limit: 5,
      maxResults: 15,
    });
    
    console.log(`\n📊 Found ${results.length} results:\n`);
    
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      console.log(`${i + 1}. [Score: ${r.score.toFixed(4)}] ${r.title}`);
      console.log(`   URL: ${r.url}`);
      console.log(`   Engine: ${r.engines.join(', ')}`);
      if (r.snippet) {
        console.log(`   ${r.snippet.substring(0, 100)}...`);
      }
      console.log('');
    }
    
    // Show cache stats
    const stats = search.cacheStats();
    if (stats) {
      console.log('\n📈 Cache Stats:');
      console.log(`   Search entries: ${stats.searchEntries}`);
      console.log(`   Page entries: ${stats.pageEntries}`);
    }
    
    // Demo: Fetch first result's content
    if (results.length > 0) {
      console.log('\n📄 Fetching first result...');
      const page = await search.fetchPage(results[0].url);
      console.log(`   Title: ${page.title}`);
      console.log(`   Content length: ${page.content.length} chars`);
      console.log(`   Preview: ${page.content.substring(0, 200)}...`);
    }
    
  } finally {
    await search.close();
  }
}

main().catch(console.error);
