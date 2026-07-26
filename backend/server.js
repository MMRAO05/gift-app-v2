const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Store gifts in memory
const gifts = new Map();
const htmlCache = new Map();

// ─── Helper: Read HTML file ───
function getHtmlContent(filename) {
  if (htmlCache.has(filename)) {
    return htmlCache.get(filename);
  }
  try {
    const content = fs.readFileSync(path.join(__dirname, '../frontend', filename), 'utf8');
    htmlCache.set(filename, content);
    return content;
  } catch (e) {
    console.error(`❌ Failed to read ${filename}:`, e.message);
    return null;
  }
}

// ─── Serve static HTML files ───
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Serve all HTML files in the folder
app.get('/:file.html', (req, res) => {
  const fileName = req.params.file;
  if (fileName.includes('..') || fileName.includes('/')) {
    return res.status(404).send('Not found');
  }
  const filePath = path.join(__dirname, '../frontend', `${fileName}.html`);
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).send('File not found');
  }
});

// ─── API: Create Shareable Link ───
app.post('/api/create', (req, res) => {
  try {
    const { template, data } = req.body;
    
    if (!template) {
      return res.status(400).json({ error: 'Template name is required' });
    }
    
    // Generate unique ID
    const giftId = uuidv4();
    const id = giftId.slice(0, 12);
    
    // Get the HTML template
    const htmlContent = getHtmlContent(`${template}.html`);
    if (!htmlContent) {
      return res.status(404).json({ error: `Template "${template}" not found` });
    }
    
    // Inject the data into the HTML
    const jsonSafe = JSON.stringify(data || {}).replace(/</g, '\\u003c');
    const injectedScript = `<script>window.__PRESET__=${jsonSafe};</script>`;
    
    let finalHtml = htmlContent;
    const bodyCloseIndex = finalHtml.lastIndexOf('</body>');
    if (bodyCloseIndex !== -1) {
      finalHtml = finalHtml.slice(0, bodyCloseIndex) + injectedScript + finalHtml.slice(bodyCloseIndex);
    } else {
      finalHtml = finalHtml + injectedScript;
    }
    
    // Store in memory
    gifts.set(id, {
      id,
      template,
      data,
      html: finalHtml,
      createdAt: Date.now()
    });
    
    // Save to disk (persistence)
    const giftDir = path.join(__dirname, 'gifts');
    if (!fs.existsSync(giftDir)) {
      fs.mkdirSync(giftDir, { recursive: true });
    }
    
    fs.writeFileSync(
      path.join(giftDir, `${id}.html`),
      finalHtml,
      'utf8'
    );
    fs.writeFileSync(
      path.join(giftDir, `${id}.json`),
      JSON.stringify({ id, template, data, createdAt: Date.now() }, null, 2),
      'utf8'
    );
    
    const shareUrl = `${req.protocol}://${req.get('host')}/gift/${id}`;
    
    console.log(`✅ Gift created: ${id} → ${shareUrl}`);
    res.json({ 
      success: true, 
      id, 
      url: shareUrl,
      expiresAt: null // NEVER EXPIRES
    });
    
  } catch (error) {
    console.error('❌ Create error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── API: Get gift by ID ───
app.get('/api/gift/:id', (req, res) => {
  const { id } = req.params;
  
  if (gifts.has(id)) {
    const gift = gifts.get(id);
    return res.json({
      id: gift.id,
      template: gift.template,
      data: gift.data,
      createdAt: gift.createdAt
    });
  }
  
  try {
    const jsonPath = path.join(__dirname, 'gifts', `${id}.json`);
    if (fs.existsSync(jsonPath)) {
      const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      return res.json({
        id: jsonData.id,
        template: jsonData.template,
        data: jsonData.data,
        createdAt: jsonData.createdAt
      });
    }
  } catch (e) {
    console.error('❌ Disk read error:', e);
  }
  
  res.status(404).json({ error: 'Gift not found' });
});

// ─── Serve the actual gift HTML ───
app.get('/gift/:id', (req, res) => {
  const { id } = req.params;
  
  if (gifts.has(id)) {
    const gift = gifts.get(id);
    return res.send(gift.html);
  }
  
  try {
    const htmlPath = path.join(__dirname, 'gifts', `${id}.html`);
    if (fs.existsSync(htmlPath)) {
      return res.sendFile(htmlPath);
    }
  } catch (e) {
    console.error('❌ HTML read error:', e);
  }
  
  res.status(404).send(`
    <!DOCTYPE html>
    <html>
    <head><title>Gift Not Found</title>
    <style>
      body{display:flex;align-items:center;justify-content:center;min-height:100vh;background:#1a1410;color:#fff;font-family:sans-serif;text-align:center;margin:0;}
      a{color:#c9a86c;text-decoration:none;}
    </style>
    </head>
    <body>
      <div>
        <h1>💔 Gift Not Found</h1>
        <p>This gift may have been removed or the link is incorrect.</p>
        <a href="/">← Create a new gift</a>
      </div>
    </body>
    </html>
  `);
});

// ─── API: List all gifts ───
app.get('/api/gifts', (req, res) => {
  const allGifts = [];
  
  for (const [id, gift] of gifts) {
    allGifts.push({
      id,
      template: gift.template,
      createdAt: gift.createdAt
    });
  }
  
  try {
    const giftDir = path.join(__dirname, 'gifts');
    if (fs.existsSync(giftDir)) {
      const files = fs.readdirSync(giftDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const id = file.replace('.json', '');
          if (!gifts.has(id)) {
            const jsonData = JSON.parse(fs.readFileSync(path.join(giftDir, file), 'utf8'));
            allGifts.push({
              id,
              template: jsonData.template,
              createdAt: jsonData.createdAt
            });
          }
        }
      }
    }
  } catch (e) {
    console.error('❌ List error:', e);
  }
  
  res.json({ gifts: allGifts });
});

// ─── API: Delete a gift ───
app.delete('/api/gift/:id', (req, res) => {
  const { id } = req.params;
  
  gifts.delete(id);
  
  try {
    const htmlPath = path.join(__dirname, 'gifts', `${id}.html`);
    const jsonPath = path.join(__dirname, 'gifts', `${id}.json`);
    if (fs.existsSync(htmlPath)) fs.unlinkSync(htmlPath);
    if (fs.existsSync(jsonPath)) fs.unlinkSync(jsonPath);
  } catch (e) {
    console.error('❌ Delete error:', e);
  }
  
  res.json({ success: true });
});

// ─── Load existing gifts on startup ───
function loadExistingGifts() {
  try {
    const giftDir = path.join(__dirname, 'gifts');
    if (!fs.existsSync(giftDir)) return;
    
    const files = fs.readdirSync(giftDir);
    let count = 0;
    for (const file of files) {
      if (file.endsWith('.json')) {
        const id = file.replace('.json', '');
        const htmlPath = path.join(giftDir, `${id}.html`);
        if (fs.existsSync(htmlPath)) {
          const jsonData = JSON.parse(fs.readFileSync(path.join(giftDir, file), 'utf8'));
          const html = fs.readFileSync(htmlPath, 'utf8');
          gifts.set(id, {
            id: jsonData.id,
            template: jsonData.template,
            data: jsonData.data,
            html: html,
            createdAt: jsonData.createdAt
          });
          count++;
        }
      }
    }
    console.log(`📦 Loaded ${count} existing gifts from disk`);
  } catch (e) {
    console.error('❌ Load error:', e);
  }
}

// ─── Start server ───
app.listen(PORT, () => {
  console.log(`✨ Server running at http://localhost:${PORT}`);
  console.log(`📁 Serving HTML files from: ${path.join(__dirname, '../frontend')}`);
  console.log(`♾️  Gifts NEVER expire!`);
  console.log(`📊 Total gifts loaded: ${gifts.size}`);
});

loadExistingGifts();