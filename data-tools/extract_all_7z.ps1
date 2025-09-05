# extract_all_7z.ps1 - Extract all 7Z files in downloads folder
# Run this script to extract all your downloaded judicial data

$downloadPath = "C:\Users\USER\WebstormProjects\Precedent\downloads"
$extractPath = "C:\Users\USER\WebstormProjects\Precedent\extracted_data"

# Create extraction directory
if (!(Test-Path $extractPath)) {
    New-Item -ItemType Directory -Path $extractPath -Force
    Write-Host "Created extraction directory: $extractPath"
}

# Get all 7z files
$zipFiles = Get-ChildItem -Path $downloadPath -Filter "*.7z"

Write-Host "Found $($zipFiles.Count) 7Z files to extract..."

foreach ($zipFile in $zipFiles) {
    Write-Host "Extracting: $($zipFile.Name)"

    # Create subfolder for each archive
    $subFolder = Join-Path $extractPath $zipFile.BaseName
    if (!(Test-Path $subFolder)) {
        New-Item -ItemType Directory -Path $subFolder -Force
    }

    # Extract using 7-Zip (requires 7-Zip installed)
    try {
        & "C:\Program Files\7-Zip\7z.exe" x $zipFile.FullName -o"$subFolder" -y
        Write-Host "✅ Successfully extracted: $($zipFile.Name)"
    } catch {
        Write-Host "❌ Failed to extract $($zipFile.Name): $_"
        Write-Host "💡 Please install 7-Zip from https://www.7-zip.org/"
    }
}

Write-Host "🎉 Extraction complete! Check the '$extractPath' folder for your data."
Write-Host "📊 Each folder contains CSV files with actual court case data."
