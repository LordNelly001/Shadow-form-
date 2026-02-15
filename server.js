// server.js - SHADOW LURKERS BOT FOR RAILWAY
require('dotenv').config();
const express = require('express');
const { Telegraf } = require('telegraf');
const sqlite3 = require('sqlite3').verbose();
// Add this near the top with other middleware
app.use(express.static(path.join(__dirname, 'public')));
const nodemailer = require('nodemailer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// LOAD ENVIRONMENT VARIABLES
// ============================================
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const OWNER_ID = process.env.TELEGRAM_OWNER_ID;
const EMAIL_USER = process.env.EMAIL_USER || 'shadowlurkers229@gmail.com';
const EMAIL_PASS = process.env.EMAIL_PASS || 'vbjrnxynwwpcxbxe';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5500';

if (!BOT_TOKEN || !OWNER_ID) {
  console.error('❌ Missing required environment variables!');
  process.exit(1);
}

// ============================================
// MIDDLEWARE
// ============================================
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// ============================================
// DATABASE
// ============================================
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
const db = new sqlite3.Database(path.join(dataDir, 'shadow_lurkers.db'));

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS initiates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    age INTEGER NOT NULL,
    gender TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NOT NULL,
    telegram TEXT NOT NULL,
    moniker TEXT NOT NULL,
    role TEXT NOT NULL,
    skills TEXT NOT NULL,
    oat TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

// ============================================
// EMAIL
// ============================================
const emailTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: EMAIL_USER, pass: EMAIL_PASS }
});

// ============================================
// TELEGRAM BOT
// ============================================
const bot = new Telegraf(BOT_TOKEN);

// /start
bot.start((ctx) => {
  const isOwner = ctx.from.id.toString() === OWNER_ID;
  ctx.reply(`
╔══════════════════════════════════════════════╗
     𓃼 WELCOME TO THE SHADOW LURKERS 𓃼
╚══════════════════════════════════════════════╝

☬ The Veil recognizes you, ${ctx.from.first_name || 'Wanderer'}.

${isOwner ? '☬ YOU ARE THE VEIL KEEPER ☬' : '☬ You are an uninitiated soul ☬'}

COMMANDS:
/codex     - Read the ancient laws
/quote     - Receive shadow wisdom
/initiate  - Begin your journey
/mystatus  - Check your soul's record
${isOwner ? '\n/review    - View pending initiates\n/approve   - Accept a soul\n/reject    - Deny a soul' : ''}
  `);
});

// /codex
bot.command('codex', (ctx) => {
  ctx.reply(`𓃼 THE CODEX OF SHADOWS 𓃼

I. OpSec is sacred
II. Knowledge is currency
III. Precision over brute force
IV. No innocents
V. Entry by merit only
VI. Disputes via digital trials
VII. Footprints are eternal
VIII. Loyalty to the code
IX. Innovate or stagnate
X. We are a legion`);
});

// /quote
bot.command('quote', (ctx) => {
  const quotes = [
    "In the shadows, we find our true selves.",
    "The Silent Ledger records all.",
    "Alone we are nothing. Together we are the Veil.",
    "Your digital footprint is eternal."
  ];
  ctx.reply(`"${quotes[Math.floor(Math.random() * quotes.length]}"`);
});

// /initiate
bot.command('initiate', (ctx) => {
  ctx.replyWithMarkdown(`
☬ *INITIATION PROTOCOL*

Visit the Shadow Portal:
${FRONTEND_URL}

Complete the ritual to receive your OAT.
  `, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '𓃼 OPEN PORTAL', url: FRONTEND_URL }]
      ]
    }
  });
});

// /mystatus
bot.command('mystatus', (ctx) => {
  db.get(`SELECT * FROM initiates WHERE telegram LIKE ?`, 
         [`%@${ctx.from.username || ''}`], (err, row) => {
    if (row) {
      ctx.reply(`
👤 Name: ${row.name}
🏷️ Moniker: ${row.moniker}
⚔️ Role: ${row.role}
𓃼 OAT: ${row.oat}
📜 Status: ${row.status}
      `);
    } else {
      ctx.reply('Not found in Silent Ledger. Use /initiate to begin.');
    }
  });
});

// /review - WITH BUTTONS!
bot.command('review', (ctx) => {
  if (ctx.from.id.toString() !== OWNER_ID) 
    return ctx.reply('☠ Only the Veil Keeper can use this.');
  
  db.all(`SELECT * FROM initiates WHERE status = 'pending'`, [], (err, rows) => {
    if (!rows || rows.length === 0) 
      return ctx.reply('No pending initiates.');
    
    rows.forEach(row => {
      ctx.replyWithMarkdown(`
*Pending #${row.id}*
👤 ${row.name}
📧 ${row.email}
🏷️ ${row.moniker}
⚔️ ${row.role}
𓃼 ${row.oat}
      `, {
        reply_markup: {
          inline_keyboard: [[
            { text: '☬ APPROVE', callback_data: `approve_${row.id}` },
            { text: '☠ REJECT', callback_data: `reject_${row.id}` }
          ]]
        }
      });
    });
  });
});

// Handle buttons - WITH EMAIL!
bot.on('callback_query', async (ctx) => {
  if (ctx.from.id.toString() !== OWNER_ID) 
    return ctx.answerCbQuery('Only Elders can judge.');
  
  const [action, id] = ctx.callbackQuery.data.split('_');
  
  db.get(`SELECT * FROM initiates WHERE id = ?`, [id], async (err, row) => {
    if (!row) return ctx.answerCbQuery('Not found.');
    
    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    
    db.run(`UPDATE initiates SET status = ? WHERE id = ?`, [newStatus, id]);
    
    // SEND EMAIL!
    try {
      await emailTransporter.sendMail({
        from: `"Shadow Lurkers" <${EMAIL_USER}>`,
        to: row.email,
        subject: `Initiation ${newStatus.toUpperCase()}`,
        html: `<h1>${newStatus.toUpperCase()}</h1><p>OAT: ${row.oat}</p>`
      });
    } catch (e) {}
    
    await ctx.editMessageText(`#${id} ${row.name} ${newStatus}`);
    await ctx.answerCbQuery(`✅ ${newStatus}`);
  });
});

// /approve
bot.command('approve', (ctx) => {
  if (ctx.from.id.toString() !== OWNER_ID) return;
  const id = ctx.message.text.split(' ')[1];
  if (!id) return;
  
  db.get(`SELECT * FROM initiates WHERE id = ?`, [id], (err, row) => {
    if (!row) return;
    db.run(`UPDATE initiates SET status = 'approved' WHERE id = ?`, [id]);
    emailTransporter.sendMail({
      from: `"Shadow Lurkers" <${EMAIL_USER}>`,
      to: row.email,
      subject: 'Initiation APPROVED',
      text: `Your OAT: ${row.oat}`
    }).catch(() => {});
    ctx.reply(`Approved #${id}`);
  });
});

// /reject
bot.command('reject', (ctx) => {
  if (ctx.from.id.toString() !== OWNER_ID) return;
  const id = ctx.message.text.split(' ')[1];
  if (!id) return;
  
  db.get(`SELECT * FROM initiates WHERE id = ?`, [id], (err, row) => {
    if (!row) return;
    db.run(`UPDATE initiates SET status = 'rejected' WHERE id = ?`, [id]);
    emailTransporter.sendMail({
      from: `"Shadow Lurkers" <${EMAIL_USER}>`,
      to: row.email,
      subject: 'Initiation REJECTED',
      text: `Your OAT: ${row.oat}`
    }).catch(() => {});
    ctx.reply(`Rejected #${id}`);
  });
});

// ============================================
// API ENDPOINTS
// ============================================
app.post('/api/submit', (req, res) => {
  const data = req.body;
  
  db.run(`INSERT INTO initiates 
    (name, age, gender, phone, email, telegram, moniker, role, skills, oat)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [data.name, data.age, data.gender, data.phone, data.email, 
     data.telegram, data.moniker, data.role, data.skills, data.oat],
    function(err) {
      if (err) return res.status(500).json({ error: 'Database error' });
      
      emailTransporter.sendMail({
        from: `"Shadow Lurkers" <${EMAIL_USER}>`,
        to: data.email,
        subject: 'Initiation Received',
        text: `Your OAT: ${data.oat}`
      }).catch(() => {});
      
      if (OWNER_ID) {
        bot.telegram.sendMessage(OWNER_ID, `New initiate #${this.lastID}: ${data.name}`).catch(() => {});
      }
      
      res.json({ success: true, id: this.lastID });
    }
  );
});

// ============================================
// START SERVER
// ============================================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${PORT}`);
  bot.launch().then(() => console.log('✅ Bot started'));
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
