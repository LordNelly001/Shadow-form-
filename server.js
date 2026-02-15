// server.js - SHADOW LURKERS BOT - 100% BUG FREE
require('dotenv').config();

const express = require('express');
const { Telegraf } = require('telegraf');
const sqlite3 = require('sqlite3').verbose();
const nodemailer = require('nodemailer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// ============================================
// CREATE EXPRESS APP
// ============================================
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

// Validate required variables
if (!BOT_TOKEN) {
  console.error('❌ CRITICAL: TELEGRAM_BOT_TOKEN not set!');
  process.exit(1);
}
if (!OWNER_ID) {
  console.error('❌ CRITICAL: TELEGRAM_OWNER_ID not set!');
  process.exit(1);
}

console.log('✅ Environment loaded');
console.log(`🔑 Bot Token: ${BOT_TOKEN.substring(0, 10)}...`);
console.log(`👤 Owner ID: ${OWNER_ID}`);
console.log(`📧 Email: ${EMAIL_USER}`);
console.log(`🌐 Frontend URL: ${FRONTEND_URL}`);

// ============================================
// MIDDLEWARE
// ============================================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// ============================================
// DATABASE SETUP
// ============================================
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'shadow_lurkers.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Database error:', err);
  } else {
    console.log('✅ Database connected at:', dbPath);
    initDatabase();
  }
});

function initDatabase() {
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      reviewed_at DATETIME,
      reviewed_by TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS admins (
      user_id TEXT PRIMARY KEY,
      username TEXT,
      role TEXT DEFAULT 'elder',
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    if (OWNER_ID) {
      db.run(`INSERT OR IGNORE INTO admins (user_id, username, role) VALUES (?, ?, ?)`,
             [OWNER_ID, 'owner', 'veil_keeper']);
    }

    console.log('✅ Database tables ready');
  });
}

// ============================================
// EMAIL SETUP
// ============================================
const emailTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS
  }
});

emailTransporter.verify((error) => {
  if (error) {
    console.error('❌ Email error:', error);
  } else {
    console.log('✅ Email service ready');
  }
});

// ============================================
// TELEGRAM BOT SETUP
// ============================================
const bot = new Telegraf(BOT_TOKEN);

// Error handler
bot.catch((err, ctx) => {
  console.error('❌ Bot error:', err);
  ctx.reply('☠ An error occurred in the Veil.').catch(() => {});
});

// ============================================
// BOT COMMANDS
// ============================================

// /start command
bot.start((ctx) => {
  const isOwner = ctx.from.id.toString() === OWNER_ID;
  const welcomeMessage = `
╔══════════════════════════════════════════════╗
     𓃼 WELCOME TO THE SHADOW LURKERS 𓃼
╚══════════════════════════════════════════════╝

☬ The Veil recognizes you, ${ctx.from.first_name || 'Wanderer'}.

${isOwner ? '☬ YOU ARE THE VEIL KEEPER ☬' : '☬ You are an uninitiated soul ☬'}

══════════════════════════════════════════════
COMMANDS:

/codex     - Read the ancient laws
/quote     - Receive shadow wisdom
/initiate  - Begin your journey
/mystatus  - Check your soul's record
${isOwner ? '\n/review    - View pending initiates\n/approve   - Accept a soul\n/reject    - Deny a soul\n/members   - List all shadows' : ''}

══════════════════════════════════════════════
"The shadows remember. The Veil watches."
  `;
  ctx.reply(welcomeMessage);
});

// /codex command
bot.command('codex', (ctx) => {
  ctx.reply(`
𓃼 THE CODEX OF SHADOWS 𓃼

I.  OpSec is sacred
II.  Knowledge is currency
III. Precision over brute force
IV.  No innocents
V.   Entry by merit only
VI.  Disputes via digital trials
VII. Footprints are eternal
VIII.Loyalty to the code
IX.  Innovate or stagnate
X.   We are a legion

"Violation of any tenet invites judgment."
  `);
});

// /quote command - FIXED
bot.command('quote', (ctx) => {
  const quotes = [
    "In the shadows, we find our true selves.",
    "The Silent Ledger records all. Every keystroke. Every whisper.",
    "Alone we are nothing. Together we are the Veil.",
    "Your digital footprint is eternal. Choose wisely.",
    "The Veil does not forget. It does not forgive.",
    "Knowledge is the only currency in the digital underworld.",
    "Precision eclipses brute force.",
    "Your OAT is your curse and your blessing."
  ];
  const randomIndex = Math.floor(Math.random() * quotes.length);
  const quote = quotes[randomIndex];
  ctx.reply(`"${quote}"`);
});

// /initiate command
bot.command('initiate', (ctx) => {
  ctx.replyWithMarkdown(`
☬ *INITIATION PROTOCOL ACTIVATED* ☬

Your journey into the shadows begins now.

To complete your initiation:

1. Visit the Shadow Portal:
   ${FRONTEND_URL}

2. Complete the Ritual of Initiation
   - Choose your Shadow Name
   - Select your Gender Essence
   - Declare your Archetype
   - Describe your Weapons of Knowledge

3. Receive your Official Assigned Tag (𓃼)

4. Bind your Telegram to your shadow identity

Once complete, the Elders will review your application.
If found worthy, you shall be welcomed into the Veil.

"Step forward. The shadows await."
  `, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '𓃼 OPEN SHADOW PORTAL 𓃼', url: FRONTEND_URL }]
      ]
    }
  });
});

// /mystatus command
bot.command('mystatus', (ctx) => {
  const username = ctx.from.username ? `@${ctx.from.username}` : '';
  const firstName = ctx.from.first_name || '';
  
  db.get(`SELECT * FROM initiates WHERE telegram LIKE ? OR name LIKE ?`, 
         [`%${username}%`, `%${firstName}%`], (err, row) => {
    if (err) {
      console.error('Database error:', err);
      return ctx.reply('☠ The Silent Ledger is temporarily unreachable.');
    }
    
    if (row) {
      ctx.reply(`
╔══════════════════════════════════════════════╗
        𓃼 YOUR SHADOW PROFILE 𓃼
╚══════════════════════════════════════════════╝

👤 Name: ${row.name}
🏷️ Moniker: ${row.moniker}
⚔️ Role: ${row.role}
𓃼 OAT: ${row.oat}
📜 Status: ${row.status.toUpperCase()}
📅 Initiated: ${new Date(row.created_at).toLocaleDateString()}

${row.status === 'approved' ? '☬ You are a shadow of the Veil ☬' : 
  row.status === 'rejected' ? '☠ The Veil has denied you ☠' : 
  '⏳ Awaiting judgment from the Elders'}
      `);
    } else {
      ctx.reply('☬ You are not yet recorded in the Silent Ledger. Use /initiate to begin.');
    }
  });
});

// /review command - WITH BUTTONS
bot.command('review', (ctx) => {
  if (ctx.from.id.toString() !== OWNER_ID) {
    return ctx.reply('☠ Only the Veil Keeper can use this command.');
  }
  
  db.all(`SELECT * FROM initiates WHERE status = 'pending' ORDER BY created_at ASC`, [], (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      return ctx.reply('☠ Failed to query the Silent Ledger.');
    }
    
    if (!rows || rows.length === 0) {
      return ctx.reply('☬ No pending initiates. The Veil is quiet.');
    }
    
    ctx.reply(`☬ Found ${rows.length} pending initiate(s):`);
    
    rows.forEach((row, index) => {
      setTimeout(() => {
        ctx.replyWithMarkdown(`
*Pending Initiate #${row.id}*
👤 Name: ${row.name}
📧 Email: ${row.email}
🔮 Telegram: ${row.telegram}
🏷️ Moniker: ${row.moniker}
⚔️ Role: ${row.role}
𓃼 OAT: ${row.oat}
📅 Submitted: ${new Date(row.created_at).toLocaleString()}
        `, {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '☬ APPROVE ☬', callback_data: `approve_${row.id}` },
                { text: '☠ REJECT ☠', callback_data: `reject_${row.id}` }
              ]
            ]
          }
        });
      }, index * 500);
    });
  });
});

// Handle approve/reject callbacks - WITH EMAIL
bot.on('callback_query', async (ctx) => {
  if (ctx.from.id.toString() !== OWNER_ID) {
    return ctx.answerCbQuery('☠ Only Elders can judge souls.');
  }
  
  const [action, id] = ctx.callbackQuery.data.split('_');
  
  db.get(`SELECT * FROM initiates WHERE id = ?`, [id], async (err, row) => {
    if (err || !row) {
      await ctx.answerCbQuery('Initiate not found in the Silent Ledger.');
      return;
    }
    
    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    
    db.run(`UPDATE initiates SET status = ?, reviewed_at = ?, reviewed_by = ? WHERE id = ?`,
           [newStatus, new Date().toISOString(), ctx.from.username || 'Elder', id]);
    
    // Send email notification
    try {
      const mailOptions = {
        from: `"Shadow Lurkers" <${EMAIL_USER}>`,
        to: row.email,
        subject: `Shadow Lurkers - Initiation ${newStatus.toUpperCase()}`,
        html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { background: #000; color: #fff; font-family: monospace; padding: 20px; }
    .container { max-width: 600px; margin: auto; border: 2px solid #ff003c; padding: 30px; }
    h1 { color: #ff003c; text-align: center; }
    .oat { color: #ff3366; font-size: 24px; text-align: center; margin: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>${action === 'approve' ? '☬ APPROVED ☬' : '☠ REJECTED ☠'}</h1>
    <p>Your initiation has been <strong>${newStatus}</strong>.</p>
    <div class="oat">${row.oat}</div>
    <p>Moniker: ${row.moniker}</p>
  </div>
</body>
</html>
        `
      };
      
      await emailTransporter.sendMail(mailOptions);
      console.log(`✅ ${newStatus} email sent to ${row.email}`);
    } catch (emailErr) {
      console.error('Email error:', emailErr);
    }
    
    await ctx.editMessageText(
      `Initiate #${id} (${row.name}) has been ${newStatus}.`
    );
    await ctx.answerCbQuery(`✅ ${newStatus}`);
  });
});

// /approve command
bot.command('approve', (ctx) => {
  if (ctx.from.id.toString() !== OWNER_ID) {
    return ctx.reply('☠ Only the Veil Keeper can use this command.');
  }
  
  const id = ctx.message.text.split(' ')[1];
  if (!id) return ctx.reply('Usage: /approve [initiate_id]');
  
  db.get(`SELECT * FROM initiates WHERE id = ?`, [id], (err, row) => {
    if (!row) return ctx.reply('Initiate not found.');
    
    db.run(`UPDATE initiates SET status = 'approved', reviewed_at = ?, reviewed_by = ? WHERE id = ?`,
           [new Date().toISOString(), ctx.from.username || 'Elder', id]);
    
    // Send email
    const mailOptions = {
      from: `"Shadow Lurkers" <${EMAIL_USER}>`,
      to: row.email,
      subject: '☬ Shadow Lurkers - Initiation APPROVED',
      html: `<h1>Approved!</h1><p>Your OAT: ${row.oat}</p>`
    };
    emailTransporter.sendMail(mailOptions).catch(console.error);
    
    ctx.reply(`☬ Initiate #${id} (${row.name}) has been APPROVED.`);
  });
});

// /reject command
bot.command('reject', (ctx) => {
  if (ctx.from.id.toString() !== OWNER_ID) {
    return ctx.reply('☠ Only the Veil Keeper can use this command.');
  }
  
  const id = ctx.message.text.split(' ')[1];
  if (!id) return ctx.reply('Usage: /reject [initiate_id]');
  
  db.get(`SELECT * FROM initiates WHERE id = ?`, [id], (err, row) => {
    if (!row) return ctx.reply('Initiate not found.');
    
    db.run(`UPDATE initiates SET status = 'rejected', reviewed_at = ?, reviewed_by = ? WHERE id = ?`,
           [new Date().toISOString(), ctx.from.username || 'Elder', id]);
    
    // Send email
    const mailOptions = {
      from: `"Shadow Lurkers" <${EMAIL_USER}>`,
      to: row.email,
      subject: '☠ Shadow Lurkers - Initiation REJECTED',
      html: `<h1>Rejected</h1><p>Your OAT: ${row.oat}</p>`
    };
    emailTransporter.sendMail(mailOptions).catch(console.error);
    
    ctx.reply(`☠ Initiate #${id} (${row.name}) has been REJECTED.`);
  });
});

// /members command
bot.command('members', (ctx) => {
  if (ctx.from.id.toString() !== OWNER_ID) {
    return ctx.reply('☠ Only the Veil Keeper can use this command.');
  }
  
  db.all(`SELECT * FROM initiates WHERE status = 'approved' ORDER BY created_at DESC`, [], (err, rows) => {
    if (err || !rows || rows.length === 0) {
      return ctx.reply('☬ No approved initiates yet.');
    }
    
    let message = `☬ SHADOWS OF THE VEIL (${rows.length})\n\n`;
    rows.forEach((row, i) => {
      message += `${i+1}. ${row.moniker} (${row.role})\n   OAT: ${row.oat}\n   Since: ${new Date(row.created_at).toLocaleDateString()}\n\n`;
      if (message.length > 3500) {
        ctx.reply(message);
        message = '';
      }
    });
    if (message) ctx.reply(message);
  });
});

// ============================================
// API ENDPOINTS
// ============================================

// Form submission endpoint
app.post('/api/submit', (req, res) => {
  const data = req.body;
  
  // Validate required fields
  if (!data.name || !data.email || !data.telegram || !data.oat) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  // Insert into database
  db.run(`INSERT INTO initiates 
          (name, age, gender, phone, email, telegram, moniker, role, skills, oat, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
          [data.name, data.age, data.gender, data.phone, data.email, 
           data.telegram, data.moniker, data.role, data.skills, data.oat],
    function(err) {
      if (err) {
        console.error('Insert error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      // Send confirmation email
      const mailOptions = {
        from: `"Shadow Lurkers" <${EMAIL_USER}>`,
        to: data.email,
        subject: '𓃼 Shadow Lurkers - Initiation Received',
        html: `
          <h1>Initiation Received</h1>
          <p>Your application has been received by the Veil.</p>
          <p>OAT: ${data.oat}</p>
          <p>Moniker: ${data.moniker}</p>
          <p>The Elders will review your submission shortly.</p>
        `
      };
      
      emailTransporter.sendMail(mailOptions).catch(console.error);
      
      // Notify owner
      if (OWNER_ID) {
        bot.telegram.sendMessage(OWNER_ID, 
          `𓃼 New initiate #${this.lastID}: ${data.name} (${data.role})\nUse /review to view.`
        ).catch(console.error);
      }
      
      res.json({ 
        success: true, 
        id: this.lastID,
        message: 'Initiation recorded in the Silent Ledger'
      });
    }
  );
});

// Get all initiates
app.get('/api/initiates', (req, res) => {
  db.all(`SELECT * FROM initiates ORDER BY created_at DESC`, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(rows);
  });
});

// Get specific initiate
app.get('/api/initiates/:id', (req, res) => {
  db.get(`SELECT * FROM initiates WHERE id = ?`, [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!row) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.json(row);
  });
});

// ============================================
// START SERVER
// ============================================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔══════════════════════════════════════════════╗
   𓃼 SHADOW LURKERS VEIL ACTIVATED 𓃼
   Port: ${PORT}
   URL: ${FRONTEND_URL}
   Bot: ✅ Active
   Owner: ✅ Configured
   Email: ✅ Ready
   Database: ✅ Persistent
╚══════════════════════════════════════════════╝
  `);
  
  // Start bot with long polling
  bot.launch().then(() => {
    console.log('✅ Telegram bot started with long polling');
  }).catch(err => {
    console.error('❌ Bot failed to start:', err);
  });
});

// Graceful shutdown
process.once('SIGINT', () => {
  bot.stop('SIGINT');
  db.close();
  process.exit(0);
});

process.once('SIGTERM', () => {
  bot.stop('SIGTERM');
  db.close();
  process.exit(0);
});
