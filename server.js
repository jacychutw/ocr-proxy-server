require('dotenv').config()
const express = require('express')
const cors = require('cors')
const axios = require('axios')
const fs = require('fs')
const path = require('path')
const { v4: uuidv4 } = require('uuid')

const app = express()
const PORT = process.env.PORT || 3000
const uploadDir = path.join(__dirname, 'public')

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir)
}

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use('/public', express.static(uploadDir))

app.post('/api/gpt-analyze', async (req, res) => {
  const { prompt, base64Image } = req.body

  const matches = base64Image.match(/^data:image\/(\w+);base64,(.+)$/)
  if (!matches) {
    return res.status(400).json({ error: 'Invalid base64 image format' })
  }

  const ext = matches[1]
  const base64Data = matches[2]
  const filename = `${uuidv4()}.${ext}`
  const filepath = path.join(uploadDir, filename)
  const imageUrl = `${req.protocol}://${req.get('host')}/public/${filename}`

  try {
    // 儲存圖片到本地
    fs.writeFileSync(filepath, Buffer.from(base64Data, 'base64'))

    // 呼叫 OpenAI API
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: '你是一個能根據圖片和說明，幫忙整理參數為 JSON 的助手。'
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: imageUrl } }
            ]
          }
        ],
        temperature: 0.2,
        max_tokens: 500
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    )

    res.json(response.data)
  } catch (err) {
    console.error(err.response?.data || err.message)
    res.status(500).json({ error: '後端錯誤' })
  } finally {
    // 分析完後刪除圖片
    fs.unlink(filepath, (unlinkErr) => {
      if (unlinkErr) {
        console.warn('⚠️ 無法刪除圖片:', unlinkErr.message)
      } else {
        console.log('🗑️ 已刪除圖片:', filename)
      }
    })
  }
})

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`)
})
