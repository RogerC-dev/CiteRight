const fs = require('fs');
const path = require('path');
const https = require('https');

// Read the judicial interpretation data
const data = JSON.parse(fs.readFileSync('./052JudicialInterpretation.json', 'utf8'));

// Create downloads directory if it doesn't exist
const downloadsDir = './downloads/judicial_interpretations';
if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir, { recursive: true });
}

// Track download progress
let totalFiles = data.length;
let downloadedFiles = 0;
let failedFiles = 0;
const failedDownloads = [];

console.log(`Starting bulk download of ${totalFiles} judicial interpretation files...`);

// Function to download a single file
function downloadFile(item, index) {
    return new Promise((resolve) => {
        const fileSetId = item.filesets[0].fileSetId;
        const title = item.title;
        const url = `https://opendata.judicial.gov.tw/api/FilesetLists/${fileSetId}/file`;

        // Clean filename for Windows compatibility
        const cleanTitle = title.replace(/[<>:"/\\|?*]/g, '_');
        const filename = `${cleanTitle}_${fileSetId}.zip`;
        const filepath = path.join(downloadsDir, filename);

        // Skip if file already exists
        if (fs.existsSync(filepath)) {
            console.log(`[${index + 1}/${totalFiles}] ✓ Skipping existing: ${title}`);
            downloadedFiles++;
            resolve();
            return;
        }

        console.log(`[${index + 1}/${totalFiles}] Downloading: ${title} (${fileSetId})`);

        const file = fs.createWriteStream(filepath);

        const request = https.get(url, (response) => {
            if (response.statusCode === 200) {
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    downloadedFiles++;
                    console.log(`[${index + 1}/${totalFiles}] ✓ Downloaded: ${title}`);
                    resolve();
                });
            } else {
                file.close();
                fs.unlinkSync(filepath); // Delete the empty file
                failedFiles++;
                failedDownloads.push({ title, fileSetId, statusCode: response.statusCode });
                console.log(`[${index + 1}/${totalFiles}] ✗ Failed: ${title} (Status: ${response.statusCode})`);
                resolve();
            }
        });

        request.on('error', (err) => {
            file.close();
            if (fs.existsSync(filepath)) {
                fs.unlinkSync(filepath); // Delete the empty file
            }
            failedFiles++;
            failedDownloads.push({ title, fileSetId, error: err.message });
            console.log(`[${index + 1}/${totalFiles}] ✗ Error: ${title} - ${err.message}`);
            resolve();
        });

        // Set timeout
        request.setTimeout(30000, () => {
            request.abort();
            file.close();
            if (fs.existsSync(filepath)) {
                fs.unlinkSync(filepath);
            }
            failedFiles++;
            failedDownloads.push({ title, fileSetId, error: 'Timeout' });
            console.log(`[${index + 1}/${totalFiles}] ✗ Timeout: ${title}`);
            resolve();
        });
    });
}

// Function to download files with concurrency control
async function downloadAllFiles() {
    const concurrency = 5; // Download 5 files at a time

    for (let i = 0; i < data.length; i += concurrency) {
        const batch = data.slice(i, i + concurrency);
        const promises = batch.map((item, batchIndex) =>
            downloadFile(item, i + batchIndex)
        );

        await Promise.all(promises);

        // Add a small delay between batches to be respectful to the server
        if (i + concurrency < data.length) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    // Generate download report
    const report = {
        totalFiles,
        downloadedFiles,
        failedFiles,
        failedDownloads,
        timestamp: new Date().toISOString()
    };

    fs.writeFileSync('./downloads/judicial_interpretations_download_report.json',
                    JSON.stringify(report, null, 2));

    console.log('\n=== Download Complete ===');
    console.log(`Total files: ${totalFiles}`);
    console.log(`Successfully downloaded: ${downloadedFiles}`);
    console.log(`Failed downloads: ${failedFiles}`);

    if (failedFiles > 0) {
        console.log('\nFailed downloads:');
        failedDownloads.forEach(item => {
            console.log(`- ${item.title} (${item.fileSetId}): ${item.error || 'Status ' + item.statusCode}`);
        });
        console.log('\nSee detailed report: ./downloads/judicial_interpretations_download_report.json');
    }
}

// Start the download process
downloadAllFiles().catch(console.error);
