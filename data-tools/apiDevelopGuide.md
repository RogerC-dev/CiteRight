開發指引

(1)取得主題分類清單
(1-1)基本查詢:取得全部司法院主題分類清單
查詢格式: https://opendata.judicial.gov.tw/data/api/rest/categories
查詢條件:無
查詢輸出:Jason格式
主題分類代碼:categoryNo
主題分類名稱:categoryName

查詢範例: https://opendata.judicial.gov.tw/data/api/rest/categories
範例輸出:
[
{
"categoryNo": "001",
"categoryName": "其他"
},
{
"categoryNo": "002",
"categoryName": "政府統計"
}
]


(1-2)進階查詢:指定主題分類代碼取得資料源清單
查詢格式: https://opendata.judicial.gov.tw/data/api/rest/categories/{categoryNo}/resources
查詢條件:categoryNo主題分類代碼
查詢輸出:Jason格式
datasetId(資料集Id)
title(資料集名稱)
categoryName(主題分類名稱)
fileSetId(資料源Id)(此欄位會多筆)
resourceFormat(檔案格式)(此欄位會多筆)
resourceDescription(料源描述)(此欄位會多筆)
查詢範例: https://opendata.judicial.gov.tw/data/api/rest/categories/001/resources
範例輸出:
[
{
"datasetId": 2059,
"title": "109年1月司法院及所屬各級法院之終結案件資料與欄位說明",
"categoryName": "其他",
"filesets": [
{
"fileSetId": 1037,
"resourceFormat": "7Z",
"resourceDescription": "所有案件檔案"
},
{
"fileSetId": 1038,
"resourceFormat": "7Z",
"resourceDescription": "統計系統資料欄位表"
}
]
}
]



(2)以URL存取資料
(2-1)基本查詢
查詢格式:https://opendata.judicial.gov.tw/api/FilesetLists/{fileSetId}/file
查詢條件:fileSetId資料源Id
查詢輸出:檔案資料
查詢範例:
https://opendata.judicial.gov.tw/api/FilesetLists/1038/file
(2-2)進階查詢-輸入:filesetId資料源Id,top={top}, skip={skip}
查詢格式: https://opendata.judicial.gov.tw/api/FilesetLists/{fileSetId}/file? top={top}&skip={skip}
查詢條件:  fileSetId資料源Id
top:取得前資料筆數
skip:跳過資料筆數
查詢範例: https://opendata.judicial.gov.tw/api/FilesetLists/1038/file?top=10

      備註: top 與 skip 目前只支援 CSV, JSON, XML 檔案格式





(3)取得會員授權Token
(3-1)使用 HTTP POST 方法到網址 https://opendata.judicial.gov.tw/api/MemberTokens

	HTTP Headers請加入
	Content-Type: application/json

Request Body 格式:
{
"memberAccount": "{您的會員帳號}",
"pwd": "{您的會員密碼}"
}

Request Body 範例:
{
"memberAccount": "jdy2020",
"pwd": "cF8sxFw1uk"
}


Response 格式:
{
"token": "{授權的Token}",
"expires": "{過期日期}"
}

Response 成功範例:
{
"token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJodHRwOi8vc2NoZW1hcy54bWxzb2FwLm9yZy93cy8yMDA1LzA1L2lkZW50aXR5L2NsYWltcy9uYW1laWRlbnRpZmllciI6InN0cmluZzEyMyIsImV4cCI6MTU4Nzc5NDA3Mn0.jQG08-KzAV2vUH3ApnD-10WpfGwVVAqzsVE4hsm_3YM",
"expires": "2020-04-25T13:54:32.4815792+08:00"
}

Response 失敗範例:
{
"succeeded": false,
"message": "帳號或密碼錯誤!"
}


(3-2) 在呼叫任何 API 的 Authorization Header 帶入 Bearer {Token} 表示具有會員授權身分
HTTP Header 範例:
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJodHRwOi8vc2NoZW1hcy54bWxzb2FwLm9yZy93cy8yMDA1LzA1L2lkZW50aXR5L2NsYWltcy9uYW1laWRlbnRpZmllciI6InN0cmluZzEyMyIsImV4cCI6MTU4Nzc5NDA3Mn0.jQG08-KzAV2vUH3ApnD-10WpfGwVVAqzsVE4hsm_3YM
  