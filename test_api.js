const http = require('http');

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function runTests() {
  console.log("Testing search API without category filter...");
  try {
    const searchRes = await fetchJson('http://localhost:3000/api/news/latest?search=India');
    console.log(`Search for 'India' returned ${searchRes.articles.length} articles.`);
    const cats = new Set(searchRes.articles.map(a => a.category));
    console.log(`Categories found in search results: ${[...cats].join(', ')}`);
  } catch (err) {
    console.error("Search API test failed", err);
  }

  console.log("\nTesting category API...");
  try {
    const catRes = await fetchJson('http://localhost:3000/api/news/latest?category=Business');
    console.log(`Category 'Business' returned ${catRes.articles.length} articles.`);
    const invalidCats = catRes.articles.filter(a => a.category !== 'Business');
    if (invalidCats.length > 0) {
      console.error(`ERROR: Found ${invalidCats.length} articles not in Business category!`);
    } else {
      console.log(`SUCCESS: All articles are strictly in 'Business' category.`);
    }
  } catch (err) {
    console.error("Category API test failed", err);
  }
}

runTests();
