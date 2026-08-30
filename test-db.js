const { Pool } = require('pg');

async function testConnection(dbUrl, desc) {
  const pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log(`\nTesting: ${desc}`);
    const client = await pool.connect();
    console.log(`✅ Success! Connected using ${desc}`);
    
    // Check tables
    const res = await client.query('SELECT NOW()');
    console.log("Time from DB:", res.rows[0].now);

    client.release();
    await pool.end();
    return true;
  } catch (err) {
    console.error(`❌ Failed ${desc}: ${err.message}`);
    await pool.end();
    return false;
  }
}

async function runTests() {
  const urls = [
    {
      desc: "Port 6543, Password without brackets (RohitShahrukh@45)",
      url: "postgresql://postgres.ydylsihoduzmljhshuid:RohitShahrukh%4045@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres"
    },
    {
      desc: "Port 6543, Password with literal brackets ([RohitShahrukh@45])",
      url: "postgresql://postgres.ydylsihoduzmljhshuid:%5BRohitShahrukh%4045%5D@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres"
    },
    {
      desc: "Port 5432, Password without brackets (RohitShahrukh@45)",
      url: "postgresql://postgres.ydylsihoduzmljhshuid:RohitShahrukh%4045@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres"
    }
  ];

  for (const {desc, url} of urls) {
    const success = await testConnection(url, desc);
    if (success) {
      console.log("\nFound working connection string!");
      console.log("WORKING_URL=" + url);
      return;
    }
  }
  
  console.log("\nNone of the connection strings worked.");
}

runTests();
