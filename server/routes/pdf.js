/**
 * PDF Processing Routes
 * 處理 PDF 上傳、文本提取和格式化
 */

const express = require('express');
const multer = require('multer');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const axios = require('axios');
const iconv = require('iconv-lite');

const router = express.Router();
const execAsync = promisify(exec);

// 配置 multer 用於文件上傳
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/temp');
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'pdf-' + uniqueSuffix + '.pdf');
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: function (req, file, cb) {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('只允許上傳 PDF 文件'), false);
    }
  }
});

/**
 * 檢查和安裝 markitdown
 */
async function ensureMarkitdownInstalled() {
  try {
    // 嘗試不同的 markitdown 命令位置
    const commands = [
      'markitdown --version',
      'python -m markitdown --version',
      'py -m markitdown --version',
      'python3 -m markitdown --version'
    ];

    for (const cmd of commands) {
      try {
        await execAsync(cmd);
        console.log(`✅ markitdown 可用: ${cmd.split(' ')[0]}`);
        return cmd.split(' ')[0] === 'markitdown' ? 'markitdown' : `${cmd.split(' ')[0]} -m markitdown`;
      } catch (e) {
        continue;
      }
    }

    console.log('📦 markitdown 未安裝，嘗試安裝...');

    // 嘗試不同的安裝方式 (包含 PDF 支援)
    const installCommands = [
      'pip install markitdown[pdf]',
      'python -m pip install markitdown[pdf]',
      'py -m pip install markitdown[pdf]',
      'python3 -m pip install markitdown[pdf]',
      'pip install markitdown[all]',
      'python -m pip install markitdown[all]',
      'py -m pip install markitdown[all]',
      'python3 -m pip install markitdown[all]'
    ];

    for (const installCmd of installCommands) {
      try {
        console.log(`嘗試安裝命令: ${installCmd}`);
        await execAsync(installCmd, { timeout: 120000 }); // 2 分鐘超時
        console.log('✅ markitdown 安裝成功');

        // 驗證安裝
        for (const cmd of commands) {
          try {
            await execAsync(cmd);
            return cmd.split(' ')[0] === 'markitdown' ? 'markitdown' : `${cmd.split(' ')[0]} -m markitdown`;
          } catch (e) {
            continue;
          }
        }

      } catch (installError) {
        console.warn(`安裝失敗 (${installCmd}):`, installError.message);
        continue;
      }
    }

    console.error('❌ 所有安裝方式都失敗');
    return false;
  } catch (error) {
    console.error('❌ markitdown 檢查失敗:', error.message);
    return false;
  }
}

/**
 * 使用 markitdown 處理 PDF
 */
async function processPdfWithMarkitdown(pdfPath, markitdownCmd = 'markitdown') {
  try {
    // 創建輸出文件路徑
    const outputPath = pdfPath.replace('.pdf', '.md');

    // 使用動態 markitdown 命令格式
    const command = `${markitdownCmd} "${pdfPath}" > "${outputPath}"`;

    console.log('🔧 執行命令:', command);

    const { stderr } = await execAsync(command, {
      timeout: 60000, // 60 秒超時
      shell: true // 確保支持重定向
    });

    if (stderr) {
      console.warn('markitdown 警告:', stderr);
    }

    // 檢查輸出文件是否存在
    try {
      await fs.access(outputPath);
    } catch (accessError) {
      throw new Error(`輸出文件未生成: ${outputPath}`);
    }

    // 讀取生成的 markdown 文件並檢查 UTF-8 編碼
    let markdownContent;
    try {
      // 先讀取為 Buffer 以檢查編碼
      const buffer = await fs.readFile(outputPath);

      // 檢查和轉換為 UTF-8 編碼
      markdownContent = ensureUtf8Encoding(buffer);
      console.log('✅ 成功讀取並轉換為 UTF-8 編碼');

    } catch (readError) {
      throw new Error(`無法讀取輸出文件: ${readError.message}`);
    }

    // 清理臨時 markdown 文件
    try {
      await fs.unlink(outputPath);
    } catch (cleanupError) {
      console.warn('清理 markdown 文件失敗:', cleanupError.message);
    }

    return markdownContent;
  } catch (error) {
    console.error('markitdown 處理失敗:', error);
    throw new Error(`PDF 文本提取失敗: ${error.message}`);
  }
}

/**
 * 檢查和轉換文本編碼為 UTF-8
 */
function ensureUtf8Encoding(text) {
  if (!text) return '';

  try {
    let content;

    // 如果是 Buffer，使用 iconv-lite 進行智能編碼檢測
    if (Buffer.isBuffer(text)) {
      console.log('🔍 使用 iconv-lite 檢測 Buffer 編碼...');

      // 嘗試常見的中文和西文編碼
      const encodings = [
        'utf8',
        'utf16le',
        'utf16be',
        'gbk',
        'gb2312',
        'big5',
        'cp936',
        'shift_jis',
        'euc-jp',
        'latin1',
        'ascii'
      ];

      let bestResult = null;
      let bestScore = 0;

      for (const encoding of encodings) {
        try {
          // 檢查 iconv-lite 是否支持該編碼
          if (!iconv.encodingExists(encoding)) {
            console.log(`⚠️ 編碼 ${encoding} 不被支持，跳過`);
            continue;
          }

          // 使用 iconv-lite 解碼
          const decoded = iconv.decode(text, encoding);

          if (decoded && decoded.length > 0) {
            // 計算文本質量分數
            const hasChineseChars = (decoded.match(/[\u4e00-\u9fff]/g) || []).length;
            const hasValidText = (decoded.match(/[a-zA-Z\u4e00-\u9fff]/g) || []).length;
            const invalidChars = (decoded.match(/[\uFFFD\x00-\x08\x0B\x0C\x0E-\x1F]/g) || []).length;
            const totalChars = decoded.length;

            // 計算質量分數
            const validRatio = hasValidText / totalChars;
            const invalidRatio = invalidChars / totalChars;
            const chineseBonus = hasChineseChars > 0 ? 0.5 : 0;

            const score = validRatio - (invalidRatio * 2) + chineseBonus;

            console.log(`📊 ${encoding}: 有效文本比例=${validRatio.toFixed(3)}, 無效字符比例=${invalidRatio.toFixed(3)}, 中文字符=${hasChineseChars}, 分數=${score.toFixed(3)}`);

            if (score > bestScore && invalidRatio < 0.1) {
              bestScore = score;
              bestResult = {
                content: decoded,
                encoding: encoding,
                hasChineseChars: hasChineseChars > 0
              };
            }
          }
        } catch (e) {
          console.log(`❌ ${encoding} 解碼失敗:`, e.message);
          continue;
        }
      }

      if (bestResult) {
        console.log(`✅ 最佳編碼: ${bestResult.encoding} (分數: ${bestScore.toFixed(3)})`);
        if (bestResult.hasChineseChars) {
          console.log('🈯 檢測到中文字符');
        }
        content = bestResult.content;
      } else {
        console.warn('⚠️ 所有編碼嘗試失敗，使用 UTF-8 備選方案');
        content = iconv.decode(text, 'utf8', { stripBOM: true }).replace(/\uFFFD/g, '');
      }

    } else if (typeof text === 'string') {
      // 如果已經是字符串，檢查是否有編碼問題
      const invalidCharCount = (text.match(/\uFFFD/g) || []).length;
      if (invalidCharCount > 0) {
        console.warn(`⚠️ 字符串中發現 ${invalidCharCount} 個無效字符，嘗試清理`);
        content = text.replace(/\uFFFD/g, '');
      } else {
        content = text;
      }
    } else {
      content = String(text);
    }

    // 最終清理和驗證
    if (content) {
      // 移除控制字符但保留換行和制表符
      content = content.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

      // 正規化空白字符
      content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

      // 移除 BOM 標記
      content = content.replace(/^\uFEFF/, '');

      console.log(`📝 最終文本長度: ${content.length} 字符`);

      // 顯示前 100 個字符用於調試
      const preview = content.substring(0, 100).replace(/\n/g, '\\n');
      console.log(`📖 文本預覽: "${preview}${content.length > 100 ? '...' : ''}"`);

      return content;
    }

    return '';

  } catch (error) {
    console.error('❌ UTF-8 編碼檢查失敗:', error);
    // 最後的備選方案
    const fallback = String(text || '').replace(/[\uFFFD\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    console.log(`🆘 使用備選方案，文本長度: ${fallback.length}`);
    return fallback;
  }
}

/**
 * 格式化提取的文本以便高亮處理
 */
function formatTextForHighlighting(text) {
  if (!text) return '';

  // 清理文本
  let formatted = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // 確保法條周圍有空格，便於高亮識別
  formatted = formatted
    .replace(/([。，；：！？])(第[一二三四五六七八九十百千萬\d]+條)/g, '$1 $2')
    .replace(/(法律?|條例|辦法|規則|準則)(第[一二三四五六七八九十百千萬\d]+條)/g, '$1 $2')
    .replace(/([^\s])(民法|刑法|行政法|商事法|民事訴訟法|刑事訴訟法)/g, '$1 $2');

  return formatted;
}

/**
 * 提取 PDF 元數據
 */
function extractMetadata(text, filename) {
  const metadata = {
    filename: filename,
    extractedAt: new Date().toISOString(),
    textLength: text?.length || 0,
    estimatedPages: Math.ceil((text?.length || 0) / 2000), // 估算頁數
    hasLegalContent: false,
    detectedLaws: []
  };

  if (text) {
    // 檢測法律內容
    const legalPatterns = [
      /民法|刑法|行政法|商事法|憲法/g,
      /第[一二三四五六七八九十百千萬\d]+條/g,
      /司法院|最高法院|地方法院/g,
      /判決|裁定|解釋/g
    ];

    legalPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches && matches.length > 0) {
        metadata.hasLegalContent = true;
        metadata.detectedLaws = [...new Set([...metadata.detectedLaws, ...matches.slice(0, 10)])];
      }
    });
  }

  return metadata;
}

/**
 * 清理臨時文件
 */
async function cleanupTempFile(filePath) {
  try {
    await fs.unlink(filePath);
    console.log('🧹 已清理臨時文件:', filePath);
  } catch (error) {
    console.warn('⚠️ 清理臨時文件失敗:', error.message);
  }
}

/**
 * @swagger
 * /api/pdf/process:
 *   post:
 *     summary: Process uploaded PDF file
 *     tags: [PDF]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               pdf:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: PDF processed successfully
 *       400:
 *         description: Bad request
 *       500:
 *         description: Server error
 */
router.post('/process', upload.single('pdf'), async (req, res) => {
  let tempFilePath = null;

  try {
    console.log('📤 收到 PDF 上傳請求');

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '沒有收到 PDF 文件'
      });
    }

    tempFilePath = req.file.path;
    const originalName = req.file.originalname;

    console.log('📁 處理 PDF 文件:', originalName);

    // 檢查 markitdown 可用性
    const markitdownCmd = await ensureMarkitdownInstalled();
    if (!markitdownCmd) {
      throw new Error('PDF 處理工具不可用，請聯繫管理員');
    }

    // 使用 markitdown 處理 PDF
    const rawText = await processPdfWithMarkitdown(tempFilePath, markitdownCmd);

    // 格式化文本
    const formattedText = formatTextForHighlighting(rawText);

    // 提取元數據
    const metadata = extractMetadata(formattedText, originalName);

    // 清理臨時文件
    await cleanupTempFile(tempFilePath);

    console.log('✅ PDF 處理完成:', {
      filename: originalName,
      textLength: formattedText.length,
      hasLegalContent: metadata.hasLegalContent
    });

    res.json({
      success: true,
      id: Date.now().toString(),
      filename: originalName,
      text: formattedText,
      markdown: rawText,
      metadata: metadata,
      processedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ PDF 處理失敗:', error);

    // 清理臨時文件
    if (tempFilePath) {
      await cleanupTempFile(tempFilePath);
    }

    res.status(500).json({
      success: false,
      message: error.message || 'PDF 處理失敗'
    });
  }
});

/**
 * @swagger
 * /api/pdf/process-url:
 *   post:
 *     summary: Process PDF from URL
 *     tags: [PDF]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               url:
 *                 type: string
 *                 format: uri
 *     responses:
 *       200:
 *         description: PDF processed successfully
 *       400:
 *         description: Bad request
 *       500:
 *         description: Server error
 */
router.post('/process-url', async (req, res) => {
  let tempFilePath = null;

  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        message: '缺少 PDF URL'
      });
    }

    console.log('🌐 處理 PDF URL:', url);

    // 下載 PDF 文件
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream',
      timeout: 30000, // 30 秒超時
      headers: {
        'User-Agent': 'CiteRight PDF Processor/1.0'
      }
    });

    // 創建臨時文件
    const tempDir = path.join(__dirname, '../uploads/temp');
    const filename = `url-pdf-${Date.now()}.pdf`;
    tempFilePath = path.join(tempDir, filename);

    // 保存文件
    const writer = require('fs').createWriteStream(tempFilePath);
    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    console.log('📁 PDF 下載完成，開始處理...');

    // 檢查 markitdown 可用性
    const markitdownCmd = await ensureMarkitdownInstalled();
    if (!markitdownCmd) {
      throw new Error('PDF 處理工具不可用，請聯繫管理員');
    }

    // 使用 markitdown 處理 PDF
    const rawText = await processPdfWithMarkitdown(tempFilePath, markitdownCmd);

    // 格式化文本
    const formattedText = formatTextForHighlighting(rawText);

    // 提取文件名
    const originalName = url.split('/').pop() || 'document.pdf';

    // 提取元數據
    const metadata = extractMetadata(formattedText, originalName);
    metadata.sourceUrl = url;

    // 清理臨時文件
    await cleanupTempFile(tempFilePath);

    console.log('✅ PDF URL 處理完成:', {
      url: url,
      filename: originalName,
      textLength: formattedText.length,
      hasLegalContent: metadata.hasLegalContent
    });

    res.json({
      success: true,
      id: Date.now().toString(),
      filename: originalName,
      text: formattedText,
      markdown: rawText,
      metadata: metadata,
      sourceUrl: url,
      processedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ PDF URL 處理失敗:', error);

    // 清理臨時文件
    if (tempFilePath) {
      await cleanupTempFile(tempFilePath);
    }

    res.status(500).json({
      success: false,
      message: error.message || 'PDF URL 處理失敗'
    });
  }
});

/**
 * @swagger
 * /api/pdf/health:
 *   get:
 *     summary: Check PDF service health
 *     tags: [PDF]
 *     responses:
 *       200:
 *         description: Service is healthy
 *       500:
 *         description: Service is unhealthy
 */
router.get('/health', async (req, res) => {
  try {
    const markitdownCmd = await ensureMarkitdownInstalled();

    res.json({
      success: true,
      status: 'healthy',
      services: {
        markitdown: !!markitdownCmd,
        markitdownCommand: markitdownCmd || 'not available'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: error.message
    });
  }
});

// 錯誤處理中間件
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: '文件大小超過 50MB 限制'
      });
    }
  }

  console.error('PDF API 錯誤:', error);
  res.status(500).json({
    success: false,
    message: error.message || '伺服器錯誤'
  });
});

module.exports = router;