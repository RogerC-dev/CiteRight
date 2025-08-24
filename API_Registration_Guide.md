# Taiwan Judicial Yuan API Registration Guide
# 台灣司法院開放資料API申請指南

## 📋 Registration Steps (申請步驟):

### 1. Visit Official Registration Page
Go to: https://data.judicial.gov.tw/
Look for "API申請" or "開放資料API申請"

### 2. Required Information for Registration:
- Full Name (姓名)
- Email Address (電子郵件)
- Phone Number (聯絡電話)
- Organization/Institution (機構名稱) - Can be "個人研究" for personal research
- Purpose of Use (使用目的) - Example: "學術研究用途" (Academic Research)
- Expected Usage Volume (預期使用量)

### 3. Application Process:
- Fill out the online application form
- Provide project description and intended use
- Wait for approval (typically 3-7 business days)
- Receive credentials via email

### 4. What You'll Receive:
- Username (JUDICIAL_USER)
- Password (JUDICIAL_PASS)
- API Documentation
- Usage guidelines and limits

## 🔧 Setting Up Credentials on Your PC:

### Option 1: Environment Variables (Recommended)
Open Command Prompt and run:
```cmd
set JUDICIAL_USER=your_actual_username
set JUDICIAL_PASS=your_actual_password
```

### Option 2: Create a .env file
Create a file named `.env` in your project folder with:
```
JUDICIAL_USER=your_actual_username
JUDICIAL_PASS=your_actual_password
```

### Option 3: Windows System Environment Variables
1. Right-click "This PC" → Properties
2. Advanced system settings → Environment Variables
3. Add new variables:
   - JUDICIAL_USER = your_actual_username
   - JUDICIAL_PASS = your_actual_password

## ⏰ Running Nightly Sync on Your PC:

### For Automatic Sync:
- Keep your PC running during 00:00-06:00 Taiwan time
- The server will automatically sync new cases
- Your database will be updated with real case data

### For Manual Sync:
- Use the "🔄 手動同步" button on your test page
- Or call: POST http://localhost:3002/api/sync-now
- Can be done anytime, doesn't require nighttime

## 📊 Expected Results After Real Sync:
- Thousands of real Taiwan court cases
- Updated daily with new judgments
- Authentic case titles, content, and metadata
- Much larger database than current demo cases

## ⚠️ Important Notes:
- API has usage limits (requests per day/hour)
- Respect the terms of service
- Data is for research/educational purposes
- Large initial sync may take several hours

## 🔍 Alternative for Testing:
If registration takes time, you can continue using the demo database
for development and testing purposes.
