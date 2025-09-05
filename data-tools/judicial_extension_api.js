// Enhanced extension integration with bug fixes
class JudicialExtensionAPI {
    constructor() {
        this.baseUrl = 'https://aomp.judicial.gov.tw';
        this.databases = {
            interpretations: null,
            courtCases: null,
            apiMapping: null
        };
        this.retryConfig = {
            maxRetries: 3,
            retryDelay: 1000,
            timeoutMs: 30000
        };

        this.loadDatabases();
    }

    // Load processed databases
    async loadDatabases() {
        try {
            // Load interpretations database
            const interpretationsResponse = await fetch('./processed_data/judicial_interpretations_db.json');
            this.databases.interpretations = await interpretationsResponse.json();

            // Load court cases database
            const courtCasesResponse = await fetch('./processed_data/court_cases_db.json');
            this.databases.courtCases = await courtCasesResponse.json();

            // Load API mapping
            const apiMappingResponse = await fetch('./processed_data/api_mapping.json');
            this.databases.apiMapping = await apiMappingResponse.json();

            console.log('✅ Databases loaded successfully');
        } catch (error) {
            console.error('❌ Error loading databases:', error);
        }
    }

    // Enhanced fetch with retry logic and error handling
    async fetchWithRetry(url, options = {}) {
        const { maxRetries, retryDelay, timeoutMs } = this.retryConfig;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

                const response = await fetch(url, {
                    ...options,
                    signal: controller.signal,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                        'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
                        'Accept-Encoding': 'gzip, deflate, br',
                        'Cache-Control': 'no-cache',
                        'Pragma': 'no-cache',
                        'Sec-Fetch-Dest': 'document',
                        'Sec-Fetch-Mode': 'navigate',
                        'Sec-Fetch-Site': 'none',
                        'Upgrade-Insecure-Requests': '1',
                        ...options.headers
                    }
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                return response;
            } catch (error) {
                console.warn(`🔄 Attempt ${attempt}/${maxRetries} failed for ${url}:`, error.message);

                if (attempt === maxRetries) {
                    throw new Error(`Failed after ${maxRetries} attempts: ${error.message}`);
                }

                // Exponential backoff with jitter
                const delay = retryDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    // Search interpretations
    searchInterpretations(query) {
        if (!this.databases.interpretations) {
            console.error('❌ Interpretations database not loaded');
            return [];
        }

        const { interpretations } = this.databases.interpretations;

        if (!query || query.trim() === '') {
            return interpretations.slice(0, 20); // Return first 20 if no query
        }

        const searchTerm = query.toLowerCase().trim();

        return interpretations.filter(item => {
            return item.title.toLowerCase().includes(searchTerm) ||
                   item.number.toString().includes(searchTerm) ||
                   item.fileSetId.toString().includes(searchTerm);
        });
    }

    // Get interpretation details
    async getInterpretationDetails(fileSetId) {
        try {
            const url = `${this.baseUrl}/juds/FilePage.aspx?id=${fileSetId}`;
            const response = await this.fetchWithRetry(url);
            const html = await response.text();

            // Parse the HTML to extract interpretation details
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            return {
                fileSetId,
                title: doc.querySelector('title')?.textContent || '',
                content: doc.querySelector('.content')?.textContent || '',
                downloadUrl: `${this.baseUrl}/juds/Download.ashx?id=${fileSetId}`,
                viewUrl: url
            };
        } catch (error) {
            console.error(`❌ Error fetching interpretation ${fileSetId}:`, error);
            return null;
        }
    }

    // Download interpretation file
    async downloadInterpretation(fileSetId, filename) {
        try {
            const url = `${this.baseUrl}/juds/Download.ashx?id=${fileSetId}`;
            const response = await this.fetchWithRetry(url);
            const blob = await response.blob();

            // Create download link
            const downloadUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = filename || `釋字第${fileSetId}.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(downloadUrl);

            return true;
        } catch (error) {
            console.error(`❌ Error downloading interpretation ${fileSetId}:`, error);
            return false;
        }
    }

    // Get available court case periods
    getCourtCasePeriods() {
        if (!this.databases.courtCases) {
            console.error('❌ Court cases database not loaded');
            return [];
        }

        return this.databases.courtCases.periods;
    }

    // Get statistics
    getStatistics() {
        const stats = {
            interpretations: {
                total: this.databases.interpretations?.interpretations?.length || 0,
                failed: this.databases.interpretations?.failedDownloads?.length || 0,
                successRate: this.databases.interpretations?.metadata?.downloadSummary?.successRate || 'N/A'
            },
            courtCases: {
                periods: this.databases.courtCases?.periods?.length || 0,
                coverage: this.databases.courtCases?.metadata?.coveragePeriod || null
            }
        };

        return stats;
    }

    // Bulk download failed interpretations (retry mechanism)
    async retryFailedDownloads(maxRetries = 5) {
        if (!this.databases.interpretations?.failedDownloads) {
            console.log('ℹ️ No failed downloads to retry');
            return;
        }

        const failed = this.databases.interpretations.failedDownloads;
        const results = {
            successful: [],
            stillFailed: []
        };

        console.log(`🔄 Retrying ${failed.length} failed downloads...`);

        for (const item of failed) {
            try {
                console.log(`🔄 Retrying: ${item.title} (${item.fileSetId})`);

                const success = await this.downloadInterpretation(item.fileSetId, `${item.title}_${item.fileSetId}.zip`);

                if (success) {
                    results.successful.push(item);
                    console.log(`✅ Successfully downloaded: ${item.title}`);
                } else {
                    results.stillFailed.push(item);
                }

                // Wait between downloads to avoid overwhelming the server
                await new Promise(resolve => setTimeout(resolve, 2000));

            } catch (error) {
                console.error(`❌ Failed to download ${item.title}:`, error);
                results.stillFailed.push({...item, error: error.message});
            }
        }

        console.log(`📊 Retry Results: ${results.successful.length} successful, ${results.stillFailed.length} still failed`);
        return results;
    }
}

// Initialize the API when the extension loads
let judicialAPI;

document.addEventListener('DOMContentLoaded', async () => {
    judicialAPI = new JudicialExtensionAPI();

    // Wait for databases to load
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('🚀 Judicial Extension API initialized');
    console.log('📊 Statistics:', judicialAPI.getStatistics());
});

// Export for use in extension
if (typeof module !== 'undefined' && module.exports) {
    module.exports = JudicialExtensionAPI;
}

