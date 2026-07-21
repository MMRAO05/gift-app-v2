const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// ===== MIDDLEWARE =====
// Helmet with CSP that allows inline scripts and styles for the frontend
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "blob:"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            connectSrc: ["'self'", "https://api.github.com"], // optional, for GitHub API
        },
    },
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100
});
app.use('/api/', limiter);

// ===== SERVE FRONTEND =====
const frontendPath = path.join(__dirname, '..', 'frontend');
console.log('📁 Frontend path:', frontendPath);
app.use(express.static(frontendPath));

// ===== DATABASE =====
const DB_PATH = path.join(__dirname, '..', 'database', 'gifts.json');

const ensureDBExists = async () => {
    const dir = path.dirname(DB_PATH);
    try {
        await fs.access(dir);
    } catch {
        await fs.mkdir(dir, { recursive: true });
    }
    try {
        await fs.access(DB_PATH);
    } catch {
        await fs.writeFile(DB_PATH, JSON.stringify({ gifts: {} }));
    }
};

const readDB = async () => {
    await ensureDBExists();
    const data = await fs.readFile(DB_PATH, 'utf8');
    return JSON.parse(data);
};

const writeDB = async (data) => {
    await ensureDBExists();
    await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2));
};

// ===== API ROUTES =====

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date(),
        uptime: process.uptime()
    });
});

// Create gift
app.post('/api/gift', async (req, res) => {
    try {
        const { name, shortLine, letter, passkey, photos } = req.body;
        
        console.log('📦 Received gift creation request:');
        console.log('  Name:', name);
        console.log('  Photos:', photos ? photos.length : 0);
        
        if (!name || name.length > 30) {
            return res.status(400).json({ 
                error: 'Name is required and must be less than 30 characters' 
            });
        }

        const giftId = uuidv4();
        const bcrypt = require('bcryptjs');
        const salt = await bcrypt.genSalt(10);
        const hashedPasskey = await bcrypt.hash(passkey || '1122', salt);
        
        const gift = {
            id: giftId,
            name,
            shortLine: shortLine || 'In your smile, I found my peace.',
            letter: letter || 'You mean the world to me.',
            passkey: hashedPasskey,
            photos: photos || [],
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        };
        
        const db = await readDB();
        db.gifts[giftId] = gift;
        await writeDB(db);
        
        console.log('✅ Gift created with ID:', giftId);
        
        res.status(201).json({
            success: true,
            giftId,
            url: `/gift/${giftId}`,
            message: 'Gift created successfully!'
        });
        
    } catch (error) {
        console.error('❌ Error creating gift:', error);
        res.status(500).json({ 
            error: 'Failed to create gift. Please try again.' 
        });
    }
});

// Get gift
app.get('/api/gift/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const db = await readDB();
        const gift = db.gifts[id];
        
        if (!gift) {
            return res.status(404).json({ 
                error: 'Gift not found. Please check the URL.' 
            });
        }
        
        if (new Date(gift.expiresAt) < new Date()) {
            return res.status(410).json({ 
                error: 'This gift has expired. Create a new one!' 
            });
        }
        
        const { passkey, ...giftData } = gift;
        res.json(giftData);
        
    } catch (error) {
        console.error('Error fetching gift:', error);
        res.status(500).json({ 
            error: 'Failed to fetch gift. Please try again.' 
        });
    }
});

// Verify passkey
app.post('/api/gift/:id/verify', async (req, res) => {
    try {
        const { id } = req.params;
        const { passkey } = req.body;
        
        if (!passkey || passkey.length !== 4) {
            return res.status(400).json({ 
                error: 'Please enter a valid 4-digit passkey.' 
            });
        }
        
        const db = await readDB();
        const gift = db.gifts[id];
        
        if (!gift) {
            return res.status(404).json({ 
                error: 'Gift not found.' 
            });
        }
        
        const bcrypt = require('bcryptjs');
        const isValid = await bcrypt.compare(passkey, gift.passkey);
        
        if (isValid) {
            res.json({ 
                success: true, 
                message: 'Passkey verified!' 
            });
        } else {
            res.status(401).json({ 
                error: 'Incorrect passkey. Please try again.' 
            });
        }
        
    } catch (error) {
        console.error('Error verifying passkey:', error);
        res.status(500).json({ 
            error: 'Failed to verify passkey. Please try again.' 
        });
    }
});

// ===== FALLBACK ROUTE =====
app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
});

// ===== START SERVER =====
app.listen(PORT, () => {
    console.log(`
    ╔══════════════════════════════════════════╗
    ║     🎁 Gift App Server                  ║
    ║     🚀 Running on: http://localhost:${PORT} ║
    ║     📁 Frontend path: ${frontendPath}   ║
    ║     ✅ Status: Online                    ║
    ╚══════════════════════════════════════════╝
    `);
});

// Error handling
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection:', reason);
});
