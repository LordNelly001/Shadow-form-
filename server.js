// server.js - SHADOW LURKERS BOT - COMPLETE WITH ALL FUNCTIONS
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
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://shadowlurkers-form.vercel.app';

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
app.use(cors({
  origin: [FRONTEND_URL, 'https://shadowlurkers-form.vercel.app', 'http://localhost:5500'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ============================================
// ROOT ROUTE
// ============================================
app.get('/', (req, res) => {
  res.json({
    name: '𓃼 Shadow Lurkers Backend 𓃼',
    status: '🟢 ONLINE',
    message: 'The Veil is active and watching',
    endpoints: {
      health: '/health',
      submit: '/api/submit',
      initiates: '/api/initiates',
      webhook: '/webhook'
    },
    frontend: FRONTEND_URL,
    timestamp: new Date().toISOString()
  });
});

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok',
    bot: !!BOT_TOKEN,
    owner: !!OWNER_ID,
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
    // Initiates table
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

    // Admins table
    db.run(`CREATE TABLE IF NOT EXISTS admins (
      user_id TEXT PRIMARY KEY,
      username TEXT,
      role TEXT DEFAULT 'elder',
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Add owner as admin
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
// ===== BOT COMMANDS - ALL FUNCTIONS =====
// ============================================

// /start command - WELCOME MESSAGE
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

// /codex command - SHOW RULES
bot.command('codex', (ctx) => {
  ctx.reply(`
𓃼 THE CODEX OF SHADOWS 𓃼

I.  OpSec is sacred
    "What the shadows hide, the light cannot find."

II. Knowledge is currency
    "Information flows like blood through the Veil."

III. Precision over brute force
    "A single keystroke can topple empires."

IV. No innocents
    "All are potential vectors. All are suspects."

V.  Entry by merit only
    "The Veil does not open for the unworthy."

VI. Disputes via digital trials
    "Code shall judge code. Logic shall prevail."

VII. Footprints are eternal
    "Every action echoes in the Silent Ledger."

VIII. Loyalty to the code
    "The shadows demand absolute devotion."

IX. Innovate or stagnate
    "Evolution is survival in the digital dark."

X.  We are a legion
    "Alone we are shadows. Together we are the Veil."

══════════════════════════════════════════════
"Violation of any tenet invites judgment."
  `);
});

// /quote command - RANDOM SHADOW WISDOM
bot.command('quote', (ctx) => {
  const quotes = [
    { text: "In the shadows, we find our true selves.", author: "Elder of the First Circle" },
    { text: "The Silent Ledger records all. Every keystroke. Every whisper.", author: "Keeper of the Ledger" },
    { text: "Alone we are nothing. Together we are the Veil.", author: "Clan Proverb" },
    { text: "Your digital footprint is eternal. Choose wisely.", author: "First Tenet" },
    { text: "The Veil does not forget. It does not forgive.", author: "Defender's Oath" },
    { text: "Knowledge is the only currency in the digital underworld.", author: "Strategist Prime" },
    { text: "Precision eclipses brute force.", author: "Attacker's Mantra" },
    { text: "Your OAT is your curse and your blessing.", author: "Ancient Codex" }
  ];
  
  const randomIndex = Math.floor(Math.random() * quotes.length);
  const quote = quotes[randomIndex];
  ctx.reply(`"${quote.text}"\n— ${quote.author}`);
});

// /initiate command - START JOURNEY
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

// /mystatus command - CHECK PERSONAL STATUS
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
      const statusEmoji = row.status === 'approved' ? '✅' : row.status === 'rejected' ? '❌' : '⏳';
      ctx.reply(`
╔══════════════════════════════════════════════╗
        𓃼 YOUR SHADOW PROFILE 𓃼
╚══════════════════════════════════════════════╝

👤 Name: ${row.name}
🏷️ Moniker: ${row.moniker}
⚔️ Role: ${row.role}
𓃼 OAT: ${row.oat}
📜 Status: ${statusEmoji} ${row.status.toUpperCase()}
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

// /review command - SHOW PENDING INITIATES WITH BUTTONS (OWNER ONLY)
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

// HANDLE APPROVE/REJECT BUTTONS - WITH EMAIL NOTIFICATIONS
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
    const statusEmoji = action === 'approve' ? '☬' : '☠';
    
    db.run(`UPDATE initiates SET status = ?, reviewed_at = ?, reviewed_by = ? WHERE id = ?`,
           [newStatus, new Date().toISOString(), ctx.from.username || 'Elder', id]);
    
    // ===== SEND EMAIL NOTIFICATION =====
    try {
      const emailSubject = action === 'approve' 
        ? '☬ Shadow Lurkers - Initiation APPROVED ☬' 
        : '☠ Shadow Lurkers - Initiation REJECTED ☠';
      
      const emailHtml = action === 'approve' ? `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { background: #000; color: #fff; font-family: 'Courier New', monospace; padding: 20px; }
            .container { max-width: 600px; margin: auto; border: 2px solid #ff003c; padding: 30px; background: #0a0015; }
            h1 { color: #ff003c; text-align: center; font-size: 32px; text-shadow: 0 0 10px #ff003c; }
            .oat { color: #ff3366; font-size: 28px; text-align: center; margin: 30px; padding: 15px; border: 1px solid #ff003c; background: #000; }
            .moniker { color: #c77dff; font-size: 20px; text-align: center; }
            .message { color: #fff; line-height: 1.6; text-align: center; }
            .footer { color: #666; font-size: 12px; text-align: center; margin-top: 30px; border-top: 1px solid #330033; padding-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>☬ INITIATION APPROVED ☬</h1>
            <p class="message">The Elders have reviewed your application.</p>
            <p class="message">You have been deemed <strong style="color:#00ff88">WORTHY</strong> of the Veil.</p>
            
            <div class="oat">${row.oat}</div>
            <div class="moniker">${row.moniker}</div>
            
            <p class="message">You are now a shadow of the Veil.<br>Your name is forever etched in the Silent Ledger.</p>
            
            <p class="message">Visit the Shadow Portal to begin your journey:<br>${FRONTEND_URL}</p>
            
            <div class="footer">
              𓃼 THE SILENT LEDGER NEVER FORGETS 𓃼<br>
              This message was sent automatically by the Veil.
            </div>
          </div>
        </body>
        </html>
      ` : `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { background: #000; color: #fff; font-family: 'Courier New', monospace; padding: 20px; }
            .container { max-width: 600px; margin: auto; border: 2px solid #ff003c; padding: 30px; background: #0a0015; }
            h1 { color: #ff003c; text-align: center; font-size: 32px; text-shadow: 0 0 10px #ff003c; }
            .oat { color: #ff3366; font-size: 28px; text-align: center; margin: 30px; padding: 15px; border: 1px solid #ff003c; background: #000; }
            .moniker { color: #c77dff; font-size: 20px; text-align: center; }
            .message { color: #fff; line-height: 1.6; text-align: center; }
            .footer { color: #666; font-size: 12px; text-align: center; margin-top: 30px; border-top: 1px solid #330033; padding-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>☠ INITIATION REJECTED ☠</h1>
            <p class="message">The Elders have reviewed your application.</p>
            <p class="message">You have been deemed <strong style="color:#ff003c">UNWORTHY</strong> of the Veil.</p>
            
            <div class="oat">${row.oat}</div>
            <div class="moniker">${row.moniker}</div>
            
            <p class="message">Your name has been removed from consideration.<br>The Silent Ledger does not forget.</p>
            
            <p class="message">You may reapply after reflecting on the Codex.</p>
            
            <div class="footer">
              𓃼 THE SILENT LEDGER NEVER FORGETS 𓃼<br>
              This message was sent automatically by the Veil.
            </div>
          </div>
        </body>
        </html>
      `;
      
      const mailOptions = {
        from: `"Shadow Lurkers" <${EMAIL_USER}>`,
        to: row.email,
        subject: emailSubject,
        html: emailHtml
      };
      
      await emailTransporter.sendMail(mailOptions);
      console.log(`✅ ${newStatus} email sent to ${row.email}`);
    } catch (emailErr) {
      console.error('Email error:', emailErr);
    }
    
    await ctx.editMessageText(
      `${statusEmoji} Initiate #${id} (${row.name}) has been ${newStatus}. ${statusEmoji}`
    );
    await ctx.answerCbQuery(`✅ ${newStatus}`);
  });
});

// /approve command - APPROVE BY ID
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
      html: `<h1>Approved!</h1><p>Your OAT: ${row.oat}</p><p>Moniker: ${row.moniker}</p>`
    };
    emailTransporter.sendMail(mailOptions).catch(console.error);
    
    ctx.reply(`☬ Initiate #${id} (${row.name}) has been APPROVED.`);
  });
});

// /reject command - REJECT BY ID
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
      html: `<h1>Rejected</h1><p>Your OAT: ${row.oat}</p><p>Moniker: ${row.moniker}</p>`
    };
    emailTransporter.sendMail(mailOptions).catch(console.error);
    
    ctx.reply(`☠ Initiate #${id} (${row.name}) has been REJECTED.`);
  });
});

// /members command - LIST ALL APPROVED MEMBERS
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

// /delete command - DELETE INITIATE (OWNER ONLY)
bot.command('delete', (ctx) => {
  if (ctx.from.id.toString() !== OWNER_ID) {
    return ctx.reply('☠ Only the Veil Keeper can use this command.');
  }
  
  const id = ctx.message.text.split(' ')[1];
  if (!id) return ctx.reply('Usage: /delete [initiate_id]');
  
  db.run(`DELETE FROM initiates WHERE id = ?`, [id], function(err) {
    if (err) {
      return ctx.reply('☠ Failed to delete from Silent Ledger.');
    }
    if (this.changes === 0) {
      return ctx.reply('Initiate not found.');
    }
    ctx.reply(`☠ Initiate #${id} has been erased from the Silent Ledger.`);
  });
});

// /stats command - SHOW STATISTICS
bot.command('stats', (ctx) => {
  if (ctx.from.id.toString() !== OWNER_ID) {
    return ctx.reply('☠ Only the Veil Keeper can use this command.');
  }
  
  db.get(`SELECT 
    COUNT(*) as total,
    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
    SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
    SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected
    FROM initiates`, [], (err, row) => {
    if (err) {
      return ctx.reply('☠ Failed to query the Silent Ledger.');
    }
    
    ctx.reply(`
📊 SILENT LEDGER STATISTICS 📊

Total Souls: ${row.total || 0}
⏳ Pending: ${row.pending || 0}
✅ Approved: ${row.approved || 0}
❌ Rejected: ${row.rejected || 0}

"The Veil watches over all."
    `);
  });
});

// ============================================
// API ENDPOINTS
// ============================================

// Form submission endpoint
app.post('/api/submit', (req, res) => {
  console.log('📥 Received submission:', req.body);
  
  const data = req.body;
  
  // Validate required fields
  if (!data.name || !data.email || !data.telegram || !data.oat) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  // Check if OAT already exists
  db.get(`SELECT id FROM initiates WHERE oat = ?`, [data.oat], (err, row) => {
    if (row) {
      return res.status(409).json({ error: 'OAT already exists in the Silent Ledger' });
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
          return res.status(500).json({ error: 'Database error: ' + err.message });
        }
        
        console.log(`✅ Initiate #${this.lastID} saved to database`);
        
        // Send confirmation email
        const mailOptions = {
          from: `"Shadow Lurkers" <${EMAIL_USER}>`,
          to: data.email,
          subject: '𓃼 Shadow Lurkers - Initiation Received',
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body { background: #000; color: #fff; font-family: 'Courier New', monospace; padding: 20px; }
                .container { max-width: 600px; margin: auto; border: 2px solid #ff003c; padding: 30px; }
                h1 { color: #ff003c; text-align: center; }
                .oat { color: #ff3366; font-size: 24px; text-align: center; margin: 20px; }
              </style>
            </head>
            <body>
              <div class="container">
                <h1>𓃼 INITIATION RECEIVED 𓃼</h1>
                <p>Your application has been received by the Veil.</p>
                <div class="oat">${data.oat}</div>
                <p>Moniker: ${data.moniker}</p>
                <p>The Elders will review your submission shortly.</p>
                <p style="color:#666; font-size:12px; text-align:center;">The Silent Ledger has recorded your soul.</p>
              </div>
            </body>
            </html>
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

// Webhook endpoint for Telegram
app.post('/webhook', (req, res) => {
  try {
    bot.handleUpdate(req.body);
    res.status(200).send('OK');
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(200).send('OK');
  }
});

// ============================================
// START SERVER
// ============================================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔══════════════════════════════════════════════╗
   𓃼 SHADOW LURKERS VEIL ACTIVATED 𓃼
   Port: ${PORT}
   URL: https://shadow-form-production.up.railway.app
   Frontend: ${FRONTEND_URL}
   Bot: ✅ Active
   Owner: ✅ Configured
   Email: ✅ Ready
   Database: ✅ Persistent
╚══════════════════════════════════════════════╝
  `);
  
  // Start bot with long polling
  bot.launch().then(() => {
    console.log('✅ Telegram bot started with long polling');
    console.log('📋 Commands loaded: start, codex, quote, initiate, mystatus, review, approve, reject, members, delete, stats');
  }).catch(err => {
    console.error('❌ Bot failed to start:', err);
  });
});

// Graceful shutdown
process.once('SIGINT', () => {
  bot.stop('SIGINT');
  db.close();
  console.log('🛑 Server shut down gracefully');
  process.exit(0);
});

process.once('SIGTERM', () => {
  bot.stop('SIGTERM');
  db.close();
  console.log('🛑 Server shut down gracefully');
  process.exit(0);
});
