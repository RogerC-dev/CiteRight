 const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Starting judicial interpretation ZIP extraction and parsing...');

// Configuration
const CONFIG = {
    zipDir: 'C:\\Users\\USER\\WebstormProjects\\Precedent\\downloads\\judicial_interpretations',
    extractDir: 'C:\\Users\\USER\\WebstormProjects\\Precedent\\extracted_interpretations',
    dbPath: 'C:\\Users\\USER\\WebstormProjects\\Precedent\\processed_data\\judicial_interpretations_db.json',
    outputPath: 'C:\\Users\\USER\\WebstormProjects\\Precedent\\processed_data\\judicial_interpretations_full_db.json'
};

// Ensure directories exist
if (!fs.existsSync(CONFIG.extractDir)) {
    fs.mkdirSync(CONFIG.extractDir, { recursive: true });
}

// Load existing database
let existingDb;
try {
    existingDb = JSON.parse(fs.readFileSync(CONFIG.dbPath, 'utf8'));
    console.log(`✅ Loaded existing database with ${existingDb.interpretations.length} interpretations`);
} catch (error) {
    console.error('❌ Failed to load existing database:', error.message);
    process.exit(1);
}

// Extract and parse function
async function extractAndParseZip(zipPath, interpretation) {
    const zipName = path.basename(zipPath, '.zip');
    const extractPath = path.join(CONFIG.extractDir, zipName);

    try {
        // Create extraction directory
        if (!fs.existsSync(extractPath)) {
            fs.mkdirSync(extractPath, { recursive: true });
        }

        // Extract ZIP using PowerShell
        const powershellCommand = `Expand-Archive -Path "${zipPath}" -DestinationPath "${extractPath}" -Force`;
        execSync(powershellCommand, { shell: 'powershell.exe', stdio: 'pipe' });

        // Look for JSON file
        const files = fs.readdirSync(extractPath);
        const jsonFile = files.find(file => file.endsWith('.json'));

        if (jsonFile) {
            const jsonPath = path.join(extractPath, jsonFile);
            const jsonContent = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

            // Extract meaningful data
            const data = jsonContent.data || {};
            const fullContent = {
                ...interpretation,
                case_type: data.inte_issue || '無資料',
                case_number: `釋字第${data.inte_no}號` || interpretation.title,
                court: '司法院大法官',
                date: data.inte_date || data.inte_order || '無資料',
                issue: data.inte_issue || '無資料',
                description: data.inte_desc || '無資料',
                reasoning: data.inte_reason || '無資料',
                decision: data.inte_decision_en ? '詳見英文翻譯' : '詳見內容',
                facts: data.inte_fact || data.other_doc || '無資料',
                english_title: data.inte_issue_en || '',
                english_description: data.inte_desc_en || '',
                english_reasoning: data.inte_reason_en || '',
                constitutional_articles: extractConstitutionalArticles(data),
                related_laws: extractRelatedLaws(data),
                justice_opinions: data.other_opinion || '',
                data_url: data.data_url || '',
                full_content: {
                    issue: data.inte_issue,
                    description: data.inte_desc,
                    reasoning: data.inte_reason,
                    facts: data.inte_fact,
                    other_docs: data.other_doc
                },
                extraction_status: 'success',
                extraction_date: new Date().toISOString().split('T')[0]
            };

            console.log(`✅ Extracted: ${interpretation.title}`);
            return fullContent;
        } else {
            console.log(`⚠️ No JSON file found in: ${interpretation.title}`);
            return {
                ...interpretation,
                case_type: '無資料',
                case_number: interpretation.title,
                court: '無資料',
                date: '無資料',
                issue: '暫無內容',
                extraction_status: 'no_json',
                extraction_date: new Date().toISOString().split('T')[0]
            };
        }
    } catch (error) {
        console.log(`❌ Failed to extract: ${interpretation.title} - ${error.message}`);
        return {
            ...interpretation,
            case_type: '無資料',
            case_number: interpretation.title,
            court: '無資料',
            date: '無資料',
            issue: '解析失敗',
            extraction_status: 'error',
            extraction_error: error.message,
            extraction_date: new Date().toISOString().split('T')[0]
        };
    }
}

// Helper functions
function extractConstitutionalArticles(data) {
    const articles = [];
    const content = JSON.stringify(data);

    // Look for constitutional article references
    const matches = content.match(/憲法第\d+條/g);
    if (matches) {
        return [...new Set(matches)]; // Remove duplicates
    }
    return [];
}

function extractRelatedLaws(data) {
    const laws = [];
    const content = JSON.stringify(data);

    // Look for law references
    const lawPattern = /[\w\u4e00-\u9fff]+條例|[\w\u4e00-\u9fff]+法/g;
    const matches = content.match(lawPattern);
    if (matches) {
        return [...new Set(matches.slice(0, 10))]; // Limit to 10 unique laws
    }
    return [];
}

// Main processing function
async function processAllInterpretations() {
    console.log('📊 Starting extraction process...');

    const processedInterpretations = [];
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < existingDb.interpretations.length; i++) {
        const interpretation = existingDb.interpretations[i];
        console.log(`[${i + 1}/${existingDb.interpretations.length}] Processing: ${interpretation.title}`);

        const result = await extractAndParseZip(interpretation.path, interpretation);
        processedInterpretations.push(result);

        if (result.extraction_status === 'success') {
            successCount++;
        } else {
            errorCount++;
        }

        // Add small delay to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Create enhanced database
    const enhancedDb = {
        metadata: {
            ...existingDb.metadata,
            extractionSummary: {
                totalInterpretations: existingDb.interpretations.length,
                successfulExtractions: successCount,
                failedExtractions: errorCount,
                extractionRate: `${((successCount / existingDb.interpretations.length) * 100).toFixed(1)}%`
            },
            lastExtracted: new Date().toISOString(),
            extractionSource: 'ZIP file parsing'
        },
        interpretations: processedInterpretations
    };

    // Save enhanced database
    fs.writeFileSync(CONFIG.outputPath, JSON.stringify(enhancedDb, null, 2), 'utf8');
    console.log(`💾 Enhanced database saved to: ${CONFIG.outputPath}`);

    // Create summary report
    const report = {
        summary: {
            total: existingDb.interpretations.length,
            successful: successCount,
            failed: errorCount,
            success_rate: `${((successCount / existingDb.interpretations.length) * 100).toFixed(1)}%`
        },
        sample_success: processedInterpretations.find(i => i.extraction_status === 'success'),
        processing_date: new Date().toISOString()
    };

    const reportPath = 'C:\\Users\\USER\\WebstormProjects\\Precedent\\processed_data\\extraction_report.json';
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

    console.log('✅ Extraction complete!');
    console.log(`📊 Results: ${successCount} successful, ${errorCount} failed`);
    console.log(`📁 Enhanced database: ${CONFIG.outputPath}`);
    console.log(`📄 Report: ${reportPath}`);
}

// Run the extraction
processAllInterpretations().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});
