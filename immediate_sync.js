// immediate_sync.js - Download real cases right now, bypass time restrictions
const axios = require('axios');
const fs = require('fs/promises');

const DB_PATH = './judgments_db.json';

async function downloadRealCasesNow() {
    console.log('🚀 Starting immediate case download...');

    const user = process.env.JUDICIAL_USER;
    const password = process.env.JUDICIAL_PASS;

    if (!user || !password) {
        console.error("❌ Error: JUDICIAL_USER and JUDICIAL_PASS environment variables are not set.");
        console.log("Please run: set JUDICIAL_USER=your_username && set JUDICIAL_PASS=your_password");
        return;
    }

    try {
        // Step 1: Authenticate
        console.log('🔐 Authenticating with Judicial Yuan API...');
        const authResponse = await axios.post('https://data.judicial.gov.tw/jdg/api/Auth', {
            user: user,
            password: password
        });

        if (authResponse.data.error) {
            throw new Error(`Authentication failed: ${authResponse.data.error}`);
        }

        const token = authResponse.data.Token;
        console.log('✅ Authentication successful!');

        // Step 2: Get case list
        console.log('📋 Fetching available case list...');
        const listResponse = await axios.post('https://data.judicial.gov.tw/jdg/api/JList', {
            token: token
        });

        const jidList = listResponse.data.flatMap(day => day.list);
        console.log(`📊 Found ${jidList.length} cases available for download`);

        if (jidList.length === 0) {
            console.log("ℹ️ No new cases available at this time");
            return;
        }

        // Step 3: Load existing database
        let db = {};
        try {
            const fileContent = await fs.readFile(DB_PATH, 'utf-8');
            db = JSON.parse(fileContent);
            console.log(`📁 Loaded existing database with ${Object.keys(db).length} cases`);
        } catch (error) {
            console.log("📁 Creating new database file...");
        }

        // Step 4: Download each case (limit to first 20 for testing)
        console.log('⬇️ Downloading case details...');
        const downloadLimit = Math.min(jidList.length, 20); // Download max 20 cases
        let successCount = 0;

        for (let i = 0; i < downloadLimit; i++) {
            const jid = jidList[i];
            try {
                console.log(`  📄 Downloading case ${i + 1}/${downloadLimit}: ${jid}`);

                const docResponse = await axios.post('https://data.judicial.gov.tw/jdg/api/JDoc', {
                    token: token,
                    j: jid
                });

                if (docResponse.data && docResponse.data.JID) {
                    db[docResponse.data.JID] = docResponse.data;
                    successCount++;
                    console.log(`    ✅ Success: ${docResponse.data.JYEAR}年度${docResponse.data.JCASE}字第${docResponse.data.JNO}號`);
                } else {
                    console.log(`    ❌ Failed: Invalid response for ${jid}`);
                }

                // Small delay to be respectful to the API
                await new Promise(resolve => setTimeout(resolve, 100));

            } catch (error) {
                console.error(`    ❌ Failed to download ${jid}: ${error.message}`);
            }
        }

        // Step 5: Save updated database
        await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2));
        console.log(`💾 Database updated successfully!`);
        console.log(`📊 Total cases in database: ${Object.keys(db).length}`);
        console.log(`📈 Successfully downloaded: ${successCount} new cases`);

        // Show some examples of what was downloaded
        const newCases = Object.values(db).slice(-successCount, Object.keys(db).length);
        console.log('\n🔍 Sample of downloaded cases:');
        newCases.slice(0, 5).forEach(caseData => {
            console.log(`  • ${caseData.JYEAR}年度${caseData.JCASE}字第${caseData.JNO}號 - ${caseData.JTITLE || 'No title'}`);
        });

    } catch (error) {
        console.error(`💥 Error during download: ${error.message}`);
    }
}

// Run the download
downloadRealCasesNow();
