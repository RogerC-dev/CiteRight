const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

class JudicialDataParser {
    constructor() {
        this.baseDir = __dirname;
        this.downloadsDir = path.join(this.baseDir, 'downloads');
        this.extractedDir = path.join(this.baseDir, 'extracted_data');
        this.outputDir = path.join(this.baseDir, 'processed_data');

        // Ensure output directory exists
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
    }

    // Parse the judicial interpretations download report
    parseDownloadReport() {
        try {
            const reportPath = path.join(this.downloadsDir, 'judicial_interpretations_download_report.json');
            const reportData = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

            console.log('📊 Download Report Summary:');
            console.log(`  Total Files: ${reportData.totalFiles}`);
            console.log(`  Downloaded: ${reportData.downloadedFiles}`);
            console.log(`  Failed: ${reportData.failedFiles}`);
            console.log(`  Success Rate: ${((reportData.downloadedFiles / reportData.totalFiles) * 100).toFixed(1)}%`);

            return {
                summary: {
                    total: reportData.totalFiles,
                    downloaded: reportData.downloadedFiles,
                    failed: reportData.failedFiles,
                    successRate: ((reportData.downloadedFiles / reportData.totalFiles) * 100).toFixed(1)
                },
                failedDownloads: reportData.failedDownloads || []
            };
        } catch (error) {
            console.error('❌ Error parsing download report:', error.message);
            return null;
        }
    }

    // Extract successful judicial interpretations from downloaded files
    extractSuccessfulInterpretations() {
        try {
            const interpretationsDir = path.join(this.downloadsDir, 'judicial_interpretations');

            if (!fs.existsSync(interpretationsDir)) {
                console.error('❌ Judicial interpretations directory not found');
                return [];
            }

            const files = fs.readdirSync(interpretationsDir);
            const interpretations = [];

            files.forEach(file => {
                if (file.endsWith('.zip')) {
                    const match = file.match(/釋字第(\d+)號_(\d+)\.zip/);
                    if (match) {
                        const [, number, fileSetId] = match;
                        interpretations.push({
                            title: `釋字第${number}號`,
                            number: parseInt(number),
                            fileSetId: parseInt(fileSetId),
                            filename: file,
                            path: path.join(interpretationsDir, file),
                            status: 'downloaded',
                            downloadDate: '2025-08-26'
                        });
                    }
                }
            });

            // Sort by interpretation number
            interpretations.sort((a, b) => a.number - b.number);

            console.log(`✅ Found ${interpretations.length} successful judicial interpretations`);
            return interpretations;
        } catch (error) {
            console.error('❌ Error extracting interpretations:', error.message);
            return [];
        }
    }

    // Process extracted court case data
    processExtractedCourtData() {
        try {
            const extractedDirs = fs.readdirSync(this.extractedDir);
            const processedData = [];

            extractedDirs.forEach(dirName => {
                const dirPath = path.join(this.extractedDir, dirName);
                if (fs.statSync(dirPath).isDirectory()) {
                    // Extract year and month from directory name
                    const yearMatch = dirName.match(/(\d{3})年(\d{1,2})月/);
                    if (yearMatch) {
                        const [, year, month] = yearMatch;
                        const fullYear = parseInt(year) + 1911; // Convert ROC year to AD year

                        processedData.push({
                            period: `${fullYear}-${month.padStart(2, '0')}`,
                            rocYear: year,
                            month: month,
                            adYear: fullYear,
                            directoryName: dirName,
                            path: dirPath,
                            extractedDate: '2025-08-26'
                        });
                    }
                }
            });

            // Sort by year and month
            processedData.sort((a, b) => {
                if (a.adYear !== b.adYear) return a.adYear - b.adYear;
                return parseInt(a.month) - parseInt(b.month);
            });

            console.log(`✅ Found ${processedData.length} extracted court data periods`);
            return processedData;
        } catch (error) {
            console.error('❌ Error processing extracted data:', error.message);
            return [];
        }
    }

    // Create database schema for interpretations
    createInterpretationsDB() {
        const interpretations = this.extractSuccessfulInterpretations();
        const reportData = this.parseDownloadReport();

        const dbSchema = {
            metadata: {
                lastUpdated: new Date().toISOString(),
                totalInterpretations: interpretations.length,
                downloadSummary: reportData?.summary || null,
                dataSource: 'judicial.gov.tw'
            },
            interpretations: interpretations,
            failedDownloads: reportData?.failedDownloads || []
        };

        const outputPath = path.join(this.outputDir, 'judicial_interpretations_db.json');
        fs.writeFileSync(outputPath, JSON.stringify(dbSchema, null, 2), 'utf8');

        console.log(`💾 Created interpretations database: ${outputPath}`);
        return dbSchema;
    }

    // Create database schema for court cases
    createCourtCasesDB() {
        const courtData = this.processExtractedCourtData();

        const dbSchema = {
            metadata: {
                lastUpdated: new Date().toISOString(),
                totalPeriods: courtData.length,
                dataSource: 'judicial.gov.tw',
                coveragePeriod: {
                    start: courtData.length > 0 ? courtData[0].period : null,
                    end: courtData.length > 0 ? courtData[courtData.length - 1].period : null
                }
            },
            periods: courtData
        };

        const outputPath = path.join(this.outputDir, 'court_cases_db.json');
        fs.writeFileSync(outputPath, JSON.stringify(dbSchema, null, 2), 'utf8');

        console.log(`💾 Created court cases database: ${outputPath}`);
        return dbSchema;
    }

    // Generate API endpoints mapping for the extension
    generateAPIMapping() {
        const interpretations = this.extractSuccessfulInterpretations();

        const apiMapping = {
            baseUrl: 'https://aomp.judicial.gov.tw',
            endpoints: {
                interpretations: '/juds/FilePage.aspx?id={{fileSetId}}',
                download: '/juds/Download.ashx?id={{fileSetId}}'
            },
            availableInterpretations: interpretations.map(item => ({
                id: item.fileSetId,
                title: item.title,
                number: item.number,
                downloadUrl: `https://aomp.judicial.gov.tw/juds/Download.ashx?id=${item.fileSetId}`,
                viewUrl: `https://aomp.judicial.gov.tw/juds/FilePage.aspx?id=${item.fileSetId}`
            })),
            errorHandling: {
                retryDelay: 1000,
                maxRetries: 3,
                timeoutMs: 30000
            }
        };

        const outputPath = path.join(this.outputDir, 'api_mapping.json');
        fs.writeFileSync(outputPath, JSON.stringify(apiMapping, null, 2), 'utf8');

        console.log(`🔗 Created API mapping: ${outputPath}`);
        return apiMapping;
    }

    // Fix API reading bugs by creating robust retry mechanism
    createAPIFixer() {
        const fixerCode = `
// Enhanced API reader with bug fixes
class JudicialAPIReader {
    constructor(options = {}) {
        this.baseUrl = 'https://aomp.judicial.gov.tw';
        this.retryDelay = options.retryDelay || 1000;
        this.maxRetries = options.maxRetries || 3;
        this.timeout = options.timeout || 30000;
    }

    async fetchWithRetry(url, options = {}) {
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), this.timeout);
                
                const response = await fetch(url, {
                    ...options,
                    signal: controller.signal,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Accept': 'application/json, text/plain, */*',
                        'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
                        'Cache-Control': 'no-cache',
                        ...options.headers
                    }
                });
                
                clearTimeout(timeoutId);
                
                if (!response.ok) {
                    throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
                }
                
                return response;
            } catch (error) {
                console.warn(\`Attempt \${attempt} failed for \${url}:\`, error.message);
                
                if (attempt === this.maxRetries) {
                    throw error;
                }
                
                // Exponential backoff
                await new Promise(resolve => 
                    setTimeout(resolve, this.retryDelay * Math.pow(2, attempt - 1))
                );
            }
        }
    }

    async getInterpretation(fileSetId) {
        const url = \`\${this.baseUrl}/juds/FilePage.aspx?id=\${fileSetId}\`;
        const response = await this.fetchWithRetry(url);
        return response.text();
    }

    async downloadInterpretation(fileSetId) {
        const url = \`\${this.baseUrl}/juds/Download.ashx?id=\${fileSetId}\`;
        const response = await this.fetchWithRetry(url);
        return response.blob();
    }
}

// Export for use in extension
if (typeof module !== 'undefined' && module.exports) {
    module.exports = JudicialAPIReader;
}
`;

        const outputPath = path.join(this.outputDir, 'api_reader_fixed.js');
        fs.writeFileSync(outputPath, fixerCode, 'utf8');

        console.log(`🔧 Created fixed API reader: ${outputPath}`);
        return fixerCode;
    }

    // Run complete processing
    processAll() {
        console.log('🚀 Starting judicial data processing...\n');

        const interpretationsDB = this.createInterpretationsDB();
        const courtCasesDB = this.createCourtCasesDB();
        const apiMapping = this.generateAPIMapping();
        const apiFixer = this.createAPIFixer();

        // Create summary report
        const summary = {
            processedAt: new Date().toISOString(),
            interpretations: {
                total: interpretationsDB.interpretations.length,
                failed: interpretationsDB.failedDownloads.length,
                successRate: interpretationsDB.metadata.downloadSummary?.successRate || 'N/A'
            },
            courtCases: {
                periods: courtCasesDB.periods.length,
                coverage: courtCasesDB.metadata.coveragePeriod
            },
            outputs: {
                interpretationsDB: path.join(this.outputDir, 'judicial_interpretations_db.json'),
                courtCasesDB: path.join(this.outputDir, 'court_cases_db.json'),
                apiMapping: path.join(this.outputDir, 'api_mapping.json'),
                apiFixer: path.join(this.outputDir, 'api_reader_fixed.js')
            }
        };

        const summaryPath = path.join(this.outputDir, 'processing_summary.json');
        fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf8');

        console.log('\n✅ Processing complete!');
        console.log('📁 Output files created in:', this.outputDir);
        console.log('📊 Summary:', summaryPath);

        return summary;
    }
}

// Run if called directly
if (require.main === module) {
    const parser = new JudicialDataParser();
    parser.processAll();
}

module.exports = JudicialDataParser;
