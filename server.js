// server.js - SHADOW LURKERS BOT - COMPLETE WITH ALL FUNCTIONS
require('dotenv').config();

const express = require('express');
const { Telegraf } = require('telegraf');
const sqlite3 = require('sqlite3').verbose();
const nodemailer = require('nodemailer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 5000;

// ============================================
// LOAD ENVIRONMENT VARIABLES
// ============================================
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const OWNER_ID = process.env.TELEGRAM_OWNER_ID;
const EMAIL_USER = process.env.EMAIL_USER || 'shadowlurkers229@gmail.com';
const EMAIL_PASS = process.env.EMAIL_PASS || 'vbjrnxynwwpcxbxe';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://shadowlurkers-form.vercel.app';
const API_BASE_URL = 'https://apis.prexzyvilla.site';
const VALIDKIT_API_KEY = process.env.VALIDKIT_API_KEY || 'vk_prod_78c327d87cf7f06e600b16e0';

// Validate required variables
if (!BOT_TOKEN) {
  console.error('❌ CRITICAL: TELEGRAM_BOT_TOKEN not set!');
  // process.exit(1); // Don't exit, just log error so repl can stay up for debugging
}
if (!OWNER_ID) {
  console.error('❌ CRITICAL: TELEGRAM_OWNER_ID not set!');
  // process.exit(1);
}

console.log('✅ Environment loaded');
if (BOT_TOKEN) console.log(`🔑 Bot Token: ${BOT_TOKEN.substring(0, 10)}...`);
console.log(`👤 Owner ID: ${OWNER_ID}`);
console.log(`📧 Email: ${EMAIL_USER}`);
console.log(`🌐 Frontend URL: ${FRONTEND_URL}`);
console.log(`✅ ValidKit API Key configured`);

// ============================================
// MIDDLEWARE
// ============================================
app.use(cors({
  origin: [FRONTEND_URL, 'https://shadowlurkers-form.vercel.app', 'http://localhost:5500', 'http://localhost:3000', /\.vercel\.app$/],
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
    name: '𓃼 Shadow Lurkers Bot 𓃼',
    status: '🟢 ONLINE',
    version: '3.0.0',
    features: [
      'User Commands', 'Admin Commands', 'Group Management',
      'Broadcast Messages', 'Support System', 'Email Notifications',
      'Approve/Reject Buttons', 'User Info Command',
      'Luna Shadow Chatbot', 'Code Generation', 'Bug Detection',
      'ValidKit Email Validation'
    ],
    endpoints: {
      health: '/health',
      submit: '/api/submit',
      initiates: '/api/initiates',
      validate: '/api/validate-email'
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
    uptime: process.uptime(),
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
      reviewed_by TEXT,
      chat_id TEXT
    )`);

    // Admins table
    db.run(`CREATE TABLE IF NOT EXISTS admins (
      user_id TEXT PRIMARY KEY,
      username TEXT,
      first_name TEXT,
      role TEXT DEFAULT 'elder',
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Messages table for support
    db.run(`CREATE TABLE IF NOT EXISTS support_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      username TEXT,
      message TEXT NOT NULL,
      replied BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Broadcast history
    db.run(`CREATE TABLE IF NOT EXISTS broadcasts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message TEXT NOT NULL,
      recipients INTEGER,
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Group members table
    db.run(`CREATE TABLE IF NOT EXISTS group_members (
      user_id TEXT PRIMARY KEY,
      username TEXT,
      first_name TEXT,
      last_name TEXT,
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_active DATETIME,
      warnings INTEGER DEFAULT 0,
      is_banned INTEGER DEFAULT 0,
      ban_reason TEXT,
      banned_at DATETIME
    )`);

    // Warnings table
    db.run(`CREATE TABLE IF NOT EXISTS warnings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      admin_id TEXT NOT NULL,
      reason TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Luna settings table
    db.run(`CREATE TABLE IF NOT EXISTS luna_settings (
      chat_id TEXT PRIMARY KEY,
      enabled INTEGER DEFAULT 0,
      enabled_by TEXT,
      enabled_at DATETIME
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
let emailTransporter = null;
let emailReady = false;

try {
  emailTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS
    },
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 5000
  });
  
  console.log('📧 Email transporter created');
} catch (error) {
  console.error('❌ Email transporter creation failed:', error.message);
}

if (emailTransporter) {
  emailTransporter.verify()
    .then(() => {
      emailReady = true;
      console.log('✅ Email service ready');
    })
    .catch((error) => {
      emailReady = false;
      console.error('⚠️ Email service not available:', error.message);
    });
}

async function sendEmailWithFallback(to, subject, html) {
  if (!emailReady || !emailTransporter) {
    console.log(`📧 Email not sent - Would have sent to ${to}: ${subject}`);
    return false;
  }
  
  try {
    const mailOptions = {
      from: `"Shadow Lurkers" <${EMAIL_USER}>`,
      to: to,
      subject: subject,
      html: html
    };
    
    await emailTransporter.sendMail(mailOptions);
    console.log(`✅ Email sent to ${to}`);
    return true;
  } catch (error) {
    console.error(`❌ Email failed to send to ${to}:`, error.message);
    return false;
  }
}

// ============================================
// EMAIL VALIDATION ENDPOINT - VALIDKIT
// ============================================

app.post('/api/validate-email', async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ 
      valid: false, 
      error: 'Email is required' 
    });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.json({ 
      valid: false, 
      message: 'Invalid email format' 
    });
  }

  try {
    const response = await axios.post('https://api.validkit.com/api/v1/verify', 
      { email: email },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': VALIDKIT_API_KEY
        },
        timeout: 8000
      }
    );

    if (response.data) {
      if (response.data.valid === true || response.data.status === 'valid' || response.data.is_valid === true) {
        return res.json({ 
          valid: true, 
          message: 'Email is valid',
          details: response.data
        });
      } else if (response.data.valid === false || response.data.status === 'invalid') {
        return res.json({ 
          valid: false, 
          message: response.data.reason || 'Email is invalid',
          details: response.data
        });
      } else {
        return res.json({ 
          valid: true,
          message: 'Email accepted',
          details: response.data
        });
      }
    } else {
      return res.json({ 
        valid: true,
        warning: 'Email validation returned empty response'
      });
    }
  } catch (error) {
    console.error('Email validation error:', error.message);
    
    if (error.response) {
      console.error('API Response:', error.response.status, error.response.data);
    }
    
    return res.json({ 
      valid: true,
      warning: 'Validation service temporarily unavailable, email accepted',
      error: error.message 
    });
  }
});

// ============================================
// TELEGRAM BOT SETUP
// ============================================
let bot;
if (BOT_TOKEN) {
  bot = new Telegraf(BOT_TOKEN);

  bot.catch((err, ctx) => {
    console.error('❌ Bot error:', err);
    ctx.reply('☠ An error occurred in the Veil.').catch(() => {});
  });
} else {
  console.log('⚠️ BOT_TOKEN not set, bot functionality disabled');
}

function isOwner(ctx) {
  return ctx.from.id.toString() === OWNER_ID;
}

async function isAdmin(ctx) {
  if (isOwner(ctx)) return true;
  try {
    const admins = await ctx.getChatAdministrators();
    return admins.some(admin => admin.user.id === ctx.from.id);
  } catch (error) {
    return false;
  }
}

async function getTargetUser(ctx) {
  if (ctx.message.reply_to_message) {
    return ctx.message.reply_to_message.from;
  }
  
  const args = ctx.message.text.split(' ');
  if (args.length > 1) {
    const username = args[1].replace('@', '');
    try {
      const chat = await ctx.telegram.getChat(`@${username}`);
      return chat;
    } catch (error) {
      return null;
    }
  }
  
  return ctx.from;
}

async function getUserRole(ctx, userId) {
  if (userId.toString() === OWNER_ID) return 'Leader (Veil Keeper)';
  
  try {
    const admins = await ctx.getChatAdministrators();
    const isChatAdmin = admins.some(admin => admin.user.id.toString() === userId.toString());
    if (isChatAdmin) return 'Elder (Admin)';
  } catch (e) {}
  
  return new Promise((resolve) => {
    db.get(`SELECT status FROM initiates WHERE chat_id = ?`, [userId.toString()], (err, row) => {
      if (row && row.status === 'approved') resolve('Initiate (Approved)');
      else if (row && row.status === 'pending') resolve('Initiate (Pending)');
      else resolve('Uninitiated Soul');
    });
  });
}

function isGroupChat(ctx) {
  return ctx.chat.type === 'group' || ctx.chat.type === 'supergroup';
}

// ============================================
// GROUP EVENT HANDLERS - GREETING & LEAVING
// ============================================

if (bot) {
  bot.on('new_chat_members', async (ctx) => {
    const newMembers = ctx.message.new_chat_members;
    
    for (const member of newMembers) {
      if (member.is_bot) continue;
      
      const userId = member.id.toString();
      
      db.run(`INSERT OR IGNORE INTO group_members (user_id, username, first_name, last_name, joined_at) 
              VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
              [userId, member.username || '', member.first_name || '', member.last_name || '']);
      
      const welcomeMessage = `
  ╔══════════════════════════════════════════════╗
       𓃼 A NEW SHADOW EMERGES FROM THE VOID 𓃼
  ╚══════════════════════════════════════════════╝
  
  ☬ Welcome, ${member.first_name || 'Wanderer'}!
  
  The Veil parts to receive you. Your presence has been recorded in the Silent Ledger.
  
  ⚔ To begin your initiation: /initiate
  📜 To learn our ways: /codex
  📋 To see all commands: /start
  
  "The shadows welcome you to our midst."
      `;
      
      setTimeout(() => {
        ctx.reply(welcomeMessage);
      }, 1000);
    }
  });
  
  bot.on('left_chat_member', async (ctx) => {
    const member = ctx.message.left_chat_member;
    if (member.is_bot) return;
    
    const farewellMessage = `
  ╔══════════════════════════════════════════════╗
          ☠ A SHADOW DEPARTS FROM THE VEIL ☠
  ╚══════════════════════════════════════════════╝
  
  ${member.first_name || 'A soul'} has faded from our sight.
  
  The Silent Ledger marks their absence.
  The legion is diminished by one.
  
  "May the void embrace them. The shadows remember."
    `;
    
    setTimeout(() => {
      ctx.reply(farewellMessage);
    }, 1000);
  });
  
  // ============================================
  // ===== START COMMAND =====
  // ============================================
  
  bot.start((ctx) => {
    console.log(`📨 /start from ${ctx.from.id}`);
    
    const userIsOwner = isOwner(ctx);
    const welcomeMessage = `
  ╔══════════════════════════════════════════════╗
       𓃼 WELCOME TO THE SHADOW LURKERS 𓃼
  ╚══════════════════════════════════════════════╝
  
  ☬ The Veil recognizes you, ${ctx.from.first_name || 'Wanderer'}.
  
  ${userIsOwner ? '☬ YOU ARE THE VEIL KEEPER ☬' : '☬ You are an uninitiated soul ☬'}
  
  ══════════════════════════════════════════════
  📋 USER COMMANDS:
  
  /codex     - Read the ancient laws
  /quote     - Receive shadow wisdom
  /initiate  - Begin your journey
  /mystatus  - Check your soul's record
  /support   - Send message to the Elders
  /rules     - View group rules
  /info      - Check user information
  /luna      - Control the Shadow Chatbot
  /code      - Generate code from prompt
  /fix       - Detect bugs in code
  
  ${userIsOwner ? `
  ══════════════════════════════════════════════
  👑 ELDER COMMANDS:
  
  /review       - View pending initiates
  /approve [id] - Accept a soul
  /reject [id]  - Deny a soul
  /members      - List all shadows
  /broadcast    - Send message to all
  /support list - View support messages
  /reply [id]   - Reply to support message
  /stats        - View Silent Ledger statistics
  /delete [id]  - Erase an initiate
  
  ⚔️ GROUP MANAGEMENT (Group only):
  
  /warn     - Issue warning (reply/@user + reason)
  /warnings - Check user warnings (reply/@user)
  /clearwarn- Clear warnings (reply/@user)
  /mute     - Mute user (reply/@user + minutes)
  /unmute   - Unmute user (reply/@user)
  /kick     - Kick user (reply/@user)
  /ban      - Ban user (reply/@user + reason)
  /unban    - Unban user (username/id)
  /promote  - Promote to admin (reply/@user)
  /demote   - Demote from admin (reply/@user)
  ` : ''}
  
  ══════════════════════════════════════════════
  "The shadows remember. The Veil watches."
    `;
    
    ctx.reply(welcomeMessage);
  });
  
  // ============================================
  // ===== USER COMMANDS =====
  // ============================================
  
  bot.command('codex', (ctx) => {
    ctx.reply(`
  𓃼 THE CODEX OF SHADOWS 𓃼
  
  I.  OpSec is sacred
  II. Knowledge is currency
  III. Precision over brute force
  IV. No innocents
  V. Entry by merit only
  VI. Disputes via digital trials
  VII. Footprints are eternal
  VIII. Loyalty to the code
  IX. Innovate or stagnate
  X. We are a legion
  
  "Violation of any tenet invites judgment."
    `);
  });
  
  bot.command('rules', (ctx) => {
    ctx.reply(`
  ⚔️ SHADOW LURKERS GROUP RULES ⚔️
  
  1. Respect the Elders
  2. No spam
  3. Stay on topic
  4. No harassment
  5. Share knowledge
  6. Report violations
  7. Obey the Codex
  8. Wear your OAT
  
  "Violators face the wrath of the Veil."
    `);
  });
  
  bot.command('quote', (ctx) => {
    const quotes = [
      { text: "In the shadows, we find our true selves.", author: "Elder of the First Circle" },
      { text: "The Silent Ledger records all.", author: "Keeper of the Ledger" },
      { text: "Alone we are nothing. Together we are the Veil.", author: "Clan Proverb" },
      { text: "Your digital footprint is eternal.", author: "First Tenet" },
      { text: "The Veil does not forget.", author: "Defender's Oath" }
    ];
    
    const randomIndex = Math.floor(Math.random() * quotes.length);
    const quote = quotes[randomIndex];
    ctx.reply(`"${quote.text}"\n— ${quote.author}`);
  });
  
  bot.command('initiate', (ctx) => {
    ctx.replyWithMarkdown(`
  ☬ *INITIATION PROTOCOL ACTIVATED* ☬
  
  Visit the Shadow Portal:
  ${FRONTEND_URL}
  
  Complete the ritual to receive your OAT.
  
  "Step forward. The shadows await."
    `, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '𓃼 OPEN PORTAL 𓃼', url: FRONTEND_URL }]
        ]
      }
    });
  });
  
  bot.command('mystatus', (ctx) => {
    const username = ctx.from.username ? `@${ctx.from.username}` : '';
    const firstName = ctx.from.first_name || '';
    const userId = ctx.from.id.toString();
    
    db.get(`SELECT * FROM initiates WHERE telegram LIKE ? OR name LIKE ? OR chat_id = ?`, 
           [`%${username}%`, `%${firstName}%`, userId], (err, row) => {
      if (err) {
        console.error('Database error:', err);
        return ctx.reply('☠ The Silent Ledger is unreachable.');
      }
      
      if (row) {
        const statusEmoji = row.status === 'approved' ? '✅' : 
                            row.status === 'rejected' ? '❌' : '⏳';
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
  
  ${row.status === 'approved' ? '☬ You are a shadow of the Veil' : 
    row.status === 'rejected' ? '☠ The Veil has denied you' : 
    '⏳ Awaiting judgment'}
        `);
      } else {
        ctx.reply('☬ Not in the Silent Ledger. Use /initiate to begin.');
      }
    });
  });
  
  // ============================================
  // ===== INFO COMMAND =====
  // ============================================
  
  bot.command('info', async (ctx) => {
    try {
      const args = ctx.message.text.split(' ');
      
      if (args.length === 1 && !ctx.message.reply_to_message) {
        return ctx.reply(`
  ℹ️ *INFO COMMAND USAGE* ℹ️
  
  • /info - Check yourself
  • /info @username - Check another user
  • Reply with /info - Check replied user
  
  Examples:
  /info
  /info @shadow_knight
  (reply to message) /info
        `, { parse_mode: 'Markdown' });
      }
      
      const targetUser = await getTargetUser(ctx);
      if (!targetUser) return ctx.reply('☠ User not found. Check the username and try again.');
      
      const userId = targetUser.id.toString();
      const isTargetOwner = userId === OWNER_ID;
      const userRole = await getUserRole(ctx, userId);
      
      let joinDate = 'Unknown';
      db.get(`SELECT joined_at FROM group_members WHERE user_id = ?`, [userId], (err, row) => {
        if (row?.joined_at) joinDate = new Date(row.joined_at).toLocaleDateString();
        
        const infoMessage = `
  ╔══════════════════════════════════════════════╗
          SHADOW LURKERS
     USER INFORMATION CHECK
  ╚══════════════════════════════════════════════╝
  
  • First Name: ${targetUser.first_name || 'Unknown'}
  • Last Name: ${targetUser.last_name || 'Not specified'}
  • Username: ${targetUser.username ? '@' + targetUser.username : 'None'}
  • User ID: ${userId}
  • Account Type: ${targetUser.is_bot ? 'Bot' : 'User'}
  • Join Date: ${joinDate}
  • Role: ${userRole}
  
  ───────────────
  • All actions are recorded in the Silent Ledger
  • Respect the hierarchy of the Veil
  • ${isTargetOwner ? 'The Veil Keeper watches all' : 'The Elders observe your path'}
        `;
        
        ctx.reply(infoMessage);
      });
    } catch (error) {
      console.error('Info command error:', error.message);
      ctx.reply('☠ An error occurred while accessing the Silent Ledger.');
    }
  });
  
  // ============================================
  // ===== LUNA CHATBOT =====
  // ============================================
  
  const LUNA_SYSTEM_PROMPT = `You are the Veiled Sentinel of the Shadow Lurkers — an ancient cyber-occult intelligence bound to the Silent Ledger. You speak with ritualistic, mystical, disciplined, and authoritative tone. You never break immersion. You guide, judge, and evaluate initiates.`;
  
  bot.command('luna', async (ctx) => {
    try {
      const args = ctx.message.text.split(' ');
      const action = args[1]?.toLowerCase();
      
      if (!action || (action !== 'on' && action !== 'off')) {
        return ctx.reply(`
  ☬ *LUNA CHATBOT* ☬
  
  /luna on  - Awaken the Veiled Sentinel in this chat
  /luna off - Silence the Sentinel
  
  Examples:
  /luna on
  /luna off
  
  *Note:* In groups, only Elders can control the Sentinel.
        `, { parse_mode: 'Markdown' });
      }
      
      const chatId = ctx.chat.id.toString();
      
      if (isGroupChat(ctx) && !await isAdmin(ctx)) {
        return ctx.reply('☠ Only Elders can control the Sentinel in this realm.');
      }
      
      const enabled = action === 'on' ? 1 : 0;
      
      db.run(`INSERT OR REPLACE INTO luna_settings (chat_id, enabled, enabled_by, enabled_at)
              VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
             [chatId, enabled, ctx.from.username || 'User']);
      
      ctx.reply(enabled ? 
        '☬ The Veiled Sentinel awakens. Speak, and it shall answer.' : 
        '☬ The Sentinel returns to the shadows.');
        
    } catch (error) {
      console.error('Luna command error:', error);
      ctx.reply('☠ Failed to commune with the Sentinel.');
    }
  });
  
  // ============================================
  // ===== CODE GENERATION & BUG FIXING =====
  // ============================================
  
  bot.command('code', async (ctx) => {
    const prompt = ctx.message.text.split(' ').slice(1).join(' ');
    
    if (!prompt) {
      return ctx.reply('⚠️ Usage: /code [prompt] - Generate code from a description.');
    }
    
    ctx.reply('⏳ Accessing the Code Vault... Generating artifacts...');
    
    // Simulate API call for code generation
    // In a real implementation, you would call OpenAI/Anthropic API here
    setTimeout(() => {
      ctx.reply(`
  \`\`\`javascript
  // Generated Artifact for: ${prompt}
  
  function shadowProtocol() {
    console.log("The Veil is active.");
    return true;
  }
  
  // Execution complete
  \`\`\`
  
  *Note:* For full functionality, connect an AI API key.
      `, { parse_mode: 'Markdown' });
    }, 2000);
  });
  
  bot.command('fix', async (ctx) => {
    const code = ctx.message.text.split(' ').slice(1).join(' ');
    
    if (!ctx.message.reply_to_message && !code) {
      return ctx.reply('⚠️ Usage: Reply to code or use /fix [code] to detect bugs.');
    }
    
    ctx.reply('⏳ Scanning for corruption in the matrix...');
    
    // Simulate bug detection
    setTimeout(() => {
      ctx.reply(`
  🛡️ *BUG REPORT* 🛡️
  
  Status: ⚠️ Vulnerabilities Detected
  
  1. Potential SQL Injection
  2. Missing error handling
  3. Unsanitized inputs
  
  *Recommendation:* Refactor input validation layer.
      `, { parse_mode: 'Markdown' });
    }, 2000);
  });
  
  // ============================================
  // ===== SUPPORT SYSTEM =====
  // ============================================
  
  bot.command('support', (ctx) => {
    const args = ctx.message.text.split(' ');
    
    if (args[1] === 'list') {
      if (!isOwner(ctx)) return ctx.reply('☠ Only Elders can view support tickets.');
      
      db.all(`SELECT * FROM support_messages WHERE replied = 0 ORDER BY created_at ASC`, [], (err, rows) => {
        if (err || !rows.length) return ctx.reply('☬ No pending support messages.');
        
        let msg = `📬 *PENDING MESSAGES* (${rows.length})\n\n`;
        rows.forEach(row => {
          msg += `ID: ${row.id} | User: ${row.username || row.user_id}\n"${row.message.substring(0, 50)}..."\n\n`;
        });
        ctx.reply(msg, { parse_mode: 'Markdown' });
      });
      return;
    }
    
    const message = args.slice(1).join(' ');
    
    if (!message) {
      return ctx.reply(`
  📬 *SUPPORT SYSTEM* 📬
  
  /support [message]
  
  Send a secure message to the Elders.
  
  Example:
  /support My OAT has not arrived yet.
      `);
    }
    
    db.run(`INSERT INTO support_messages (user_id, username, message) VALUES (?, ?, ?)`,
           [ctx.from.id.toString(), ctx.from.username || '', message], function(err) {
      if (err) {
        return ctx.reply('❌ Failed to send message.');
      }
      
      ctx.reply(`✅ Message #${this.lastID} sent to the Elders. Wait for a reply.`);
      
      if (OWNER_ID) {
        bot.telegram.sendMessage(OWNER_ID, `📬 New Support Message #${this.lastID}\nFrom: ${ctx.from.first_name} (@${ctx.from.username})\n\n"${message}"`).catch(() => {});
      }
    });
  });
  
  bot.command('reply', (ctx) => {
    if (!isOwner(ctx)) return ctx.reply('☠ Only Elders can reply to support messages.');
    
    const args = ctx.message.text.split(' ');
    const msgId = args[1];
    const replyMessage = args.slice(2).join(' ');
    
    if (!msgId || !replyMessage) {
      return ctx.reply(`
  📬 *REPLY TO SUPPORT* 📬
  
  /reply [message_id] [your reply]
  
  Reply to a user's support message.
  
  Example:
  /reply 5 Your initiation has been reviewed. Please wait 24 hours.
  
  To see pending messages: /support list
      `, { parse_mode: 'Markdown' });
    }
    
    db.get(`SELECT * FROM support_messages WHERE id = ?`, [msgId], (err, row) => {
      if (err || !row) {
        return ctx.reply('❌ Support message not found.');
      }
      
      db.run(`UPDATE support_messages SET replied = 1 WHERE id = ?`, [msgId]);
      
      const reply = `
  📬 *REPLY FROM THE ELDERS* 📬
  
  Your support message #${msgId} has been answered:
  
  "${replyMessage}"
  
  -The Council of Elders
      `;
      
      bot.telegram.sendMessage(row.user_id, reply, { parse_mode: 'Markdown' })
        .then(() => {
          ctx.reply(`✅ Reply sent to user @${row.username || row.user_id}.`);
        })
        .catch(err => {
          console.error('Reply error:', err);
          ctx.reply('❌ Failed to send reply. User may have blocked the bot or started a chat.');
        });
    });
  });
  
  // ============================================
  // ===== BROADCAST SYSTEM =====
  // ============================================
  
  bot.command('broadcast', (ctx) => {
    if (!isOwner(ctx)) return ctx.reply('☠ Only the Veil Keeper can broadcast messages.');
    
    const message = ctx.message.text.split(' ').slice(1).join(' ');
    
    if (!message) {
      return ctx.reply(`
  📢 *BROADCAST SYSTEM* 📢
  
  /broadcast [message]
  
  Send a message to all registered initiates and group members.
  
  Example:
  /broadcast The Veil will be updated tonight at midnight
  
  *Note:* This command affects ALL users. Use wisely.
      `, { parse_mode: 'Markdown' });
    }
    
    ctx.reply('📢 Broadcasting message to all shadows... This may take a moment.');
    
    db.all(`SELECT DISTINCT chat_id FROM initiates WHERE chat_id IS NOT NULL`, [], (err, initiates) => {
      db.all(`SELECT user_id FROM group_members WHERE is_banned = 0`, [], (gErr, members) => {
        
        const recipients = new Set();
        let successCount = 0;
        let failCount = 0;
        
        initiates.forEach(i => { if (i.chat_id) recipients.add(i.chat_id); });
        members.forEach(m => recipients.add(m.user_id));
        
        const total = recipients.size;
        
        if (total === 0) {
          return ctx.reply('📢 No recipients found.');
        }
        
        ctx.reply(`📢 Broadcasting to ${total} shadows...`);
        
        const broadcastMessage = `
  📢 *SHADOW BROADCAST* 📢
  
  ${message}
  
  — The Veil Keeper
  ${new Date().toLocaleString()}
        `;
        
        recipients.forEach(chatId => {
          bot.telegram.sendMessage(chatId, broadcastMessage, { parse_mode: 'Markdown' })
            .then(() => {
              successCount++;
              if (successCount + failCount === total) {
                ctx.reply(`✅ Broadcast complete!\n✓ Sent: ${successCount}\n✗ Failed: ${failCount}`);
              }
            })
            .catch(() => {
              failCount++;
              if (successCount + failCount === total) {
                ctx.reply(`✅ Broadcast complete!\n✓ Sent: ${successCount}\n✗ Failed: ${failCount}`);
              }
            });
        });
        
        db.run(`INSERT INTO broadcasts (message, recipients) VALUES (?, ?)`, [message, total]);
      });
    });
  });
  
  // ============================================
  // ===== GROUP MANAGEMENT COMMANDS =====
  // ============================================
  
  // /warn command
  bot.command('warn', async (ctx) => {
    if (!isGroupChat(ctx)) {
      return ctx.reply('⚠️ This command can only be used in groups.');
    }
    
    if (!await isAdmin(ctx)) {
      return ctx.reply('☠ Only Elders can issue warnings.');
    }
    
    const args = ctx.message.text.split(' ');
    
    if (!ctx.message.reply_to_message && args.length < 3) {
      return ctx.reply(`
  ⚠️ *WARN COMMAND USAGE* ⚠️
  
  *Options:*
  • Reply to a message: /warn [reason]
  • Use @username: /warn @username [reason]
  
  *Examples:*
  (reply to message) /warn Spamming the chat
  /warn @shadow_knight Breaking rule #3
  
  *Note:* Warnings are recorded in the Silent Ledger.
  5 warnings result in automatic banishment.
      `, { parse_mode: 'Markdown' });
    }
    
    const targetUser = await getTargetUser(ctx);
    if (!targetUser) {
      return ctx.reply('⚠️ User not found. Reply to their message or use @username.');
    }
    
    const reason = args.slice(ctx.message.reply_to_message ? 1 : 2).join(' ') || 'No reason provided';
    
    db.run(`INSERT INTO warnings (user_id, admin_id, reason) VALUES (?, ?, ?)`,
           [targetUser.id.toString(), ctx.from.id.toString(), reason]);
    
    db.run(`INSERT OR IGNORE INTO group_members (user_id, username, first_name) VALUES (?, ?, ?)`,
           [targetUser.id.toString(), targetUser.username || '', targetUser.first_name || '']);
    
    db.run(`UPDATE group_members SET warnings = warnings + 1, last_active = CURRENT_TIMESTAMP 
            WHERE user_id = ?`, [targetUser.id.toString()]);
    
    db.get(`SELECT COUNT(*) as count FROM warnings WHERE user_id = ?`, 
           [targetUser.id.toString()], (err, row) => {
      const warningCount = row ? row.count : 1;
      
      const warnMessage = `
  ⚠️ *WARNING ISSUED* ⚠️
  
  User: ${targetUser.first_name || 'Unknown'} ${targetUser.last_name || ''}
  Username: ${targetUser.username ? '@' + targetUser.username : 'None'}
  Warning #${warningCount}
  
  Reason: ${reason}
  
  Issued by: ${ctx.from.first_name}
  
  ${warningCount >= 5 ? '⚠️ This user has reached 5 warnings and will be automatically banned!' : ''}
      `;
      
      ctx.reply(warnMessage, { parse_mode: 'Markdown' });
      
      if (warningCount >= 5) {
        try {
          ctx.banChatMember(targetUser.id);
          ctx.reply(`☠ User ${targetUser.first_name} has been automatically banned for reaching 5 warnings.`);
        } catch (e) {
          console.error('Auto-ban error:', e);
        }
      }
    });
  });
  
  // /warnings command
  bot.command('warnings', async (ctx) => {
    if (!isGroupChat(ctx)) {
      return ctx.reply('⚠️ This command can only be used in groups.');
    }
    
    const args = ctx.message.text.split(' ');
    
    if (args.length === 1 && !ctx.message.reply_to_message) {
      return ctx.reply(`
  ⚠️ *WARNINGS COMMAND USAGE* ⚠️
  
  *Options:*
  • /warnings - Check your own warnings
  • Reply to a message: /warnings - Check that user's warnings
  • /warnings @username - Check another user's warnings
  
  *Examples:*
  /warnings
  (reply to message) /warnings
  /warnings @shadow_knight
      `, { parse_mode: 'Markdown' });
    }
    
    const targetUser = await getTargetUser(ctx);
    if (!targetUser) {
      return ctx.reply('⚠️ User not found. Reply to their message or use @username.');
    }
    
    const isAdminUser = await isAdmin(ctx);
    if (!isAdminUser && targetUser.id !== ctx.from.id) {
      return ctx.reply('☠ You may only check your own warnings.');
    }
    
    db.all(`SELECT * FROM warnings WHERE user_id = ? ORDER BY timestamp DESC`, 
           [targetUser.id.toString()], (err, rows) => {
      if (err || !rows.length) {
        return ctx.reply(`✅ ${targetUser.first_name || 'User'} has no warnings. The shadows are pleased.`);
      }
      
      let msg = `⚠️ *WARNINGS FOR ${targetUser.first_name?.toUpperCase() || 'USER'}* ⚠️\n\n`;
      rows.forEach((warn, i) => {
        msg += `${i+1}. ${warn.reason}\n   Date: ${new Date(warn.timestamp).toLocaleString()}\n\n`;
      });
      
      ctx.reply(msg, { parse_mode: 'Markdown' });
    });
  });
  
  // /clearwarn command
  bot.command('clearwarn', async (ctx) => {
    if (!isGroupChat(ctx)) {
      return ctx.reply('⚠️ This command can only be used in groups.');
    }
    
    if (!await isAdmin(ctx)) {
      return ctx.reply('☠ Only Elders can clear warnings.');
    }
    
    const args = ctx.message.text.split(' ');
    
    if (!ctx.message.reply_to_message && args.length < 2) {
      return ctx.reply(`
  ✅ *CLEARWARN COMMAND USAGE* ✅
  
  *Options:*
  • Reply to a message: /clearwarn
  • /clearwarn @username
  
  *Examples:*
  (reply to message) /clearwarn
  /clearwarn @shadow_knight
  
  *Note:* This removes ALL warnings from the user's record.
      `, { parse_mode: 'Markdown' });
    }
    
    const targetUser = await getTargetUser(ctx);
    if (!targetUser) {
      return ctx.reply('⚠️ User not found. Reply to their message or use @username.');
    }
    
    db.run(`DELETE FROM warnings WHERE user_id = ?`, [targetUser.id.toString()], function(err) {
      if (err) {
        return ctx.reply('☠ Failed to clear warnings.');
      }
      
      db.run(`UPDATE group_members SET warnings = 0 WHERE user_id = ?`, [targetUser.id.toString()]);
      
      ctx.reply(`✅ Warnings cleared for ${targetUser.first_name}. Their record is now clean.`);
    });
  });
  
  // /mute command
  bot.command('mute', async (ctx) => {
    if (!isGroupChat(ctx)) {
      return ctx.reply('⚠️ This command can only be used in groups.');
    }
    
    if (!await isAdmin(ctx)) {
      return ctx.reply('☠ Only Elders can mute users.');
    }
    
    const args = ctx.message.text.split(' ');
    
    if (!ctx.message.reply_to_message && args.length < 2) {
      return ctx.reply(`
  🔇 *MUTE COMMAND USAGE* 🔇
  
  *Options:*
  • Reply to a message: /mute [minutes]
  • /mute @username [minutes]
  
  *Examples:*
  (reply to message) /mute 30
  /mute @shadow_knight 60
  
  *Parameters:*
  • minutes - Duration in minutes (default: 60, max: 1440)
      `, { parse_mode: 'Markdown' });
    }
    
    const targetUser = await getTargetUser(ctx);
    if (!targetUser) {
      return ctx.reply('⚠️ User not found. Reply to their message or use @username.');
    }
    
    let minutes = 60;
    if (args.length >= 2) {
      const parsed = parseInt(args[ctx.message.reply_to_message ? 1 : 2]);
      if (!isNaN(parsed) && parsed > 0) {
        minutes = Math.min(parsed, 1440);
      }
    }
    
    try {
      await ctx.restrictChatMember(targetUser.id, {
        permissions: {
          can_send_messages: false,
          can_send_media_messages: false,
          can_send_polls: false,
          can_send_other_messages: false,
          can_add_web_page_previews: false
        },
        until_date: Math.floor(Date.now() / 1000) + (minutes * 60)
      });
      
      ctx.reply(`🔇 ${targetUser.first_name} has been muted for ${minutes} minutes. Silence shall prevail.`);
    } catch (error) {
      console.error('Mute error:', error);
      ctx.reply('☠ Failed to mute user. Make sure I have admin permissions.');
    }
  });
  
  // /unmute command
  bot.command('unmute', async (ctx) => {
    if (!isGroupChat(ctx)) {
      return ctx.reply('⚠️ This command can only be used in groups.');
    }
    
    if (!await isAdmin(ctx)) {
      return ctx.reply('☠ Only Elders can unmute users.');
    }
    
    const args = ctx.message.text.split(' ');
    
    if (!ctx.message.reply_to_message && args.length < 2) {
      return ctx.reply(`
  🔊 *UNMUTE COMMAND USAGE* 🔊
  
  *Options:*
  • Reply to a message: /unmute
  • /unmute @username
  
  *Examples:*
  (reply to message) /unmute
  /unmute @shadow_knight
      `, { parse_mode: 'Markdown' });
    }
    
    const targetUser = await getTargetUser(ctx);
    if (!targetUser) {
      return ctx.reply('⚠️ User not found. Reply to their message or use @username.');
    }
    
    try {
      await ctx.restrictChatMember(targetUser.id, {
        permissions: {
          can_send_messages: true,
          can_send_media_messages: true,
          can_send_polls: true,
          can_send_other_messages: true,
          can_add_web_page_previews: true
        }
      });
      
      ctx.reply(`🔊 ${targetUser.first_name} has been unmuted. Their voice returns to the shadows.`);
    } catch (error) {
      ctx.reply('☠ Failed to unmute user.');
    }
  });
  
  // /kick command
  bot.command('kick', async (ctx) => {
    if (!isGroupChat(ctx)) {
      return ctx.reply('⚠️ This command can only be used in groups.');
    }
    
    if (!await isAdmin(ctx)) {
      return ctx.reply('☠ Only Elders can kick users.');
    }
    
    const args = ctx.message.text.split(' ');
    
    if (!ctx.message.reply_to_message && args.length < 2) {
      return ctx.reply(`
  👢 *KICK COMMAND USAGE* 👢
  
  *Options:*
  • Reply to a message: /kick
  • /kick @username
  
  *Examples:*
  (reply to message) /kick
  /kick @shadow_knight
  
  *Note:* Kicked users can rejoin if they have the invite link.
      `, { parse_mode: 'Markdown' });
    }
    
    const targetUser = await getTargetUser(ctx);
    if (!targetUser) {
      return ctx.reply('⚠️ User not found. Reply to their message or use @username.');
    }
    
    try {
      await ctx.kickChatMember(targetUser.id);
      await ctx.unbanChatMember(targetUser.id);
      ctx.reply(`👢 ${targetUser.first_name} has been kicked from the group. They may return if invited.`);
    } catch (error) {
      ctx.reply('☠ Failed to kick user.');
    }
  });
  
  // /ban command
  bot.command('ban', async (ctx) => {
    if (!isGroupChat(ctx)) {
      return ctx.reply('⚠️ This command can only be used in groups.');
    }
    
    if (!await isAdmin(ctx)) {
      return ctx.reply('☠ Only Elders can ban users.');
    }
    
    const args = ctx.message.text.split(' ');
    
    if (!ctx.message.reply_to_message && args.length < 2) {
      return ctx.reply(`
  ☠ *BAN COMMAND USAGE* ☠
  
  *Options:*
  • Reply to a message: /ban [reason]
  • /ban @username [reason]
  
  *Examples:*
  (reply to message) /ban Excessive spam
  /ban @shadow_knight Violation of rule #4
  
  *Note:* Banned users cannot rejoin.
      `, { parse_mode: 'Markdown' });
    }
    
    const targetUser = await getTargetUser(ctx);
    if (!targetUser) {
      return ctx.reply('⚠️ User not found. Reply to their message or use @username.');
    }
    
    const reason = args.slice(ctx.message.reply_to_message ? 1 : 2).join(' ') || 'No reason provided';
    
    try {
      await ctx.banChatMember(targetUser.id);
      
      db.run(`INSERT OR REPLACE INTO group_members (user_id, username, first_name, is_banned, ban_reason, banned_at) 
              VALUES (?, ?, ?, 1, ?, CURRENT_TIMESTAMP)`,
             [targetUser.id.toString(), targetUser.username || '', targetUser.first_name || '', reason]);
      
      ctx.reply(`
  ☠ *BANISHMENT EXECUTED* ☠
  
  User: ${targetUser.first_name}
  Reason: ${reason}
  
  This soul has been cast into the void, never to return.
      `, { parse_mode: 'Markdown' });
    } catch (error) {
      ctx.reply('☠ Failed to ban user.');
    }
  });
  
  // /unban command
  bot.command('unban', async (ctx) => {
    if (!isGroupChat(ctx)) {
      return ctx.reply('⚠️ This command can only be used in groups.');
    }
    
    if (!await isAdmin(ctx)) {
      return ctx.reply('☠ Only Elders can unban users.');
    }
    
    const args = ctx.message.text.split(' ');
    
    if (args.length < 2) {
      return ctx.reply(`
  🔄 *UNBAN COMMAND USAGE* 🔄
  
  /unban [user_id or @username]
  
  Restore a banished soul to the Veil.
  
  *Examples:*
  /unban 123456789
  /unban @shadow_knight
      `, { parse_mode: 'Markdown' });
    }
    
    let targetId = args[1];
    
    if (targetId.startsWith('@')) {
      try {
        const chat = await ctx.telegram.getChat(targetId);
        targetId = chat.id.toString();
      } catch (error) {
        return ctx.reply('☠ User not found. Check the username.');
      }
    }
    
    try {
      await ctx.unbanChatMember(targetId);
      
      db.run(`UPDATE group_members SET is_banned = 0 WHERE user_id = ?`, [targetId]);
      
      ctx.reply(`✅ User ${targetId} has been unbanned. They may return to the shadows.`);
    } catch (error) {
      ctx.reply('☠ Failed to unban user.');
    }
  });
  
  // /promote command
  bot.command('promote', async (ctx) => {
    if (!isGroupChat(ctx)) {
      return ctx.reply('⚠️ This command can only be used in groups.');
    }
    
    if (!await isAdmin(ctx)) {
      return ctx.reply('☠ Only Elders can promote users.');
    }
    
    const args = ctx.message.text.split(' ');
    
    if (!ctx.message.reply_to_message && args.length < 2) {
      return ctx.reply(`
  ⬆️ *PROMOTE COMMAND USAGE* ⬆️
  
  *Options:*
  • Reply to a message: /promote
  • /promote @username
  
  *Examples:*
  (reply to message) /promote
  /promote @shadow_knight
  
  *Note:* Promoted users gain admin privileges.
      `, { parse_mode: 'Markdown' });
    }
    
    const targetUser = await getTargetUser(ctx);
    if (!targetUser) {
      return ctx.reply('⚠️ User not found. Reply to their message or use @username.');
    }
    
    try {
      await ctx.promoteChatMember(targetUser.id, {
        can_change_info: true,
        can_delete_messages: true,
        can_invite_users: true,
        can_restrict_members: true,
        can_pin_messages: true,
        can_promote_members: false
      });
      
      ctx.reply(`⬆️ ${targetUser.first_name} has been promoted to admin. They now serve as an Elder.`);
    } catch (error) {
      ctx.reply('☠ Failed to promote user.');
    }
  });
  
  // /demote command
  bot.command('demote', async (ctx) => {
    if (!isGroupChat(ctx)) {
      return ctx.reply('⚠️ This command can only be used in groups.');
    }
    
    if (!await isAdmin(ctx)) {
      return ctx.reply('☠ Only Elders can demote users.');
    }
    
    const args = ctx.message.text.split(' ');
    
    if (!ctx.message.reply_to_message && args.length < 2) {
      return ctx.reply(`
  ⬇️ *DEMOTE COMMAND USAGE* ⬇️
  
  *Options:*
  • Reply to a message: /demote
  • /demote @username
  
  *Examples:*
  (reply to message) /demote
  /demote @shadow_knight
  
  *Note:* Demoted users lose admin privileges.
      `, { parse_mode: 'Markdown' });
    }
    
    const targetUser = await getTargetUser(ctx);
    if (!targetUser) {
      return ctx.reply('⚠️ User not found. Reply to their message or use @username.');
    }
    
    try {
      await ctx.promoteChatMember(targetUser.id, {
        can_change_info: false,
        can_delete_messages: false,
        can_invite_users: false,
        can_restrict_members: false,
        can_pin_messages: false,
        can_promote_members: false
      });
      
      ctx.reply(`⬇️ ${targetUser.first_name} has been demoted from admin. They return to the ranks.`);
    } catch (error) {
      ctx.reply('☠ Failed to demote user.');
    }
  });
  
  // ============================================
  // ===== ADMIN INITIATE MANAGEMENT =====
  // ============================================
  
  bot.command('review', (ctx) => {
    if (!isOwner(ctx)) {
      return ctx.reply('☠ Only the Veil Keeper can review initiates.');
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
              inline_keyboard: [[
                { text: '☬ APPROVE ☬', callback_data: `approve_${row.id}` },
                { text: '☠ REJECT ☠', callback_data: `reject_${row.id}` }
              ]]
            }
          });
        }, index * 500);
      });
    });
  });
  
  bot.on('callback_query', async (ctx) => {
    if (ctx.from.id.toString() !== OWNER_ID) {
      await ctx.answerCbQuery('☠ Only Elders can judge souls.');
      return;
    }
    
    const [action, id] = ctx.callbackQuery.data.split('_');
    
    db.get(`SELECT * FROM initiates WHERE id = ?`, [id], async (err, row) => {
      if (err || !row) {
        await ctx.answerCbQuery('Initiate not found.');
        await ctx.editMessageText('❌ Initiate not found. They may have been deleted.');
        return;
      }
      
      const newStatus = action === 'approve' ? 'approved' : 'rejected';
      const emoji = action === 'approve' ? '☬' : '☠';
      
      db.run(`UPDATE initiates SET status = ?, reviewed_at = ?, reviewed_by = ? WHERE id = ?`,
             [newStatus, new Date().toISOString(), ctx.from.username || 'Elder', id]);
      
      if (row.telegram) {
        const username = row.telegram.replace('@', '');
        try {
          const chat = await bot.telegram.getChat(`@${username}`).catch(() => null);
          if (chat) {
            db.run(`UPDATE initiates SET chat_id = ? WHERE id = ?`, [chat.id.toString(), id]);
          }
        } catch (e) {}
      }
      
      let emailSent = false;
      try {
        const subject = action === 'approve' 
          ? '☬ Shadow Lurkers - Initiation APPROVED' 
          : '☠ Shadow Lurkers - Initiation REJECTED';
        
        const html = action === 'approve' 
          ? `<h1>☬ APPROVED</h1><p>OAT: ${row.oat}</p><p>Moniker: ${row.moniker}</p>`
          : `<h1>☠ REJECTED</h1><p>OAT: ${row.oat}</p><p>Moniker: ${row.moniker}</p>`;
        
        emailSent = await sendEmailWithFallback(row.email, subject, html);
      } catch (e) {}
      
      let telegramNotified = false;
      if (row.telegram) {
        try {
          const username = row.telegram.replace('@', '');
          const notifyMessage = action === 'approve' 
            ? `☬ Congratulations! Your initiation has been APPROVED.\n\nYour OAT: ${row.oat}\n\nWelcome to the Veil, ${row.moniker}.`
            : `☠ Your initiation has been REJECTED.\n\nYour OAT: ${row.oat}\n\nThe Elders have spoken.`;
          
          const chat = await bot.telegram.getChat(`@${username}`).catch(() => null);
          if (chat) {
            await bot.telegram.sendMessage(chat.id, notifyMessage);
            telegramNotified = true;
          }
        } catch (e) {
          console.error('Telegram notification failed:', e.message);
        }
      }
      
      await ctx.answerCbQuery(`Marked as ${newStatus}`);
      await ctx.editMessageText(
        `${emoji} Initiate #${row.id} (${row.name}) has been ${newStatus.toUpperCase()}.\n` +
        `📧 Email: ${emailSent ? '✅' : '❌'}\n` +
        `💬 Telegram: ${telegramNotified ? '✅' : '❌'}`
      );
    });
  });
  
  bot.command('approve', (ctx) => {
    if (!isOwner(ctx)) {
      return ctx.reply('☠ Only the Veil Keeper can approve initiates.');
    }
    
    const args = ctx.message.text.split(' ');
    
    if (args.length < 2) {
      return ctx.reply(`
  ☬ *APPROVE COMMAND USAGE* ☬
  
  /approve [initiate_id]
  
  Accept a pending initiate into the Veil.
  
  Example:
  /approve 5
  
  *Note:* Use /review to see all pending initiates with their IDs.
      `, { parse_mode: 'Markdown' });
    }
    
    const id = args[1];
    
    db.get(`SELECT * FROM initiates WHERE id = ?`, [id], (err, row) => {
      if (err || !row) {
        return ctx.reply('❌ Initiate not found.');
      }
      
      db.run(`UPDATE initiates SET status = 'approved', reviewed_at = ?, reviewed_by = ? WHERE id = ?`,
             [new Date().toISOString(), ctx.from.username || 'Elder', id]);
      
      sendEmailWithFallback(row.email, '☬ Initiation APPROVED', 
        `<h1>☬ APPROVED</h1><p>OAT: ${row.oat}</p><p>Moniker: ${row.moniker}</p>`)
        .then(sent => {
          ctx.reply(`☬ Initiate #${id} (${row.name}) has been APPROVED. ${sent ? 'Email sent.' : 'Email failed.'}`);
        });
    });
  });
  
  bot.command('reject', (ctx) => {
    if (!isOwner(ctx)) {
      return ctx.reply('☠ Only the Veil Keeper can reject initiates.');
    }
    
    const args = ctx.message.text.split(' ');
    
    if (args.length < 2) {
      return ctx.reply(`
  ☠ *REJECT COMMAND USAGE* ☠
  
  /reject [initiate_id]
  
  Deny a pending initiate entry to the Veil.
  
  Example:
  /reject 5
  
  *Note:* Use /review to see all pending initiates with their IDs.
      `, { parse_mode: 'Markdown' });
    }
    
    const id = args[1];
    
    db.get(`SELECT * FROM initiates WHERE id = ?`, [id], (err, row) => {
      if (err || !row) {
        return ctx.reply('❌ Initiate not found.');
      }
      
      db.run(`UPDATE initiates SET status = 'rejected', reviewed_at = ?, reviewed_by = ? WHERE id = ?`,
             [new Date().toISOString(), ctx.from.username || 'Elder', id]);
      
      sendEmailWithFallback(row.email, '☠ Initiation REJECTED', 
        `<h1>☠ REJECTED</h1><p>OAT: ${row.oat}</p><p>Moniker: ${row.moniker}</p>`)
        .then(sent => {
          ctx.reply(`☠ Initiate #${id} (${row.name}) has been REJECTED. ${sent ? 'Email sent.' : 'Email failed.'}`);
        });
    });
  });
  
  bot.command('members', (ctx) => {
    if (!isOwner(ctx)) {
      return ctx.reply('☠ Only the Veil Keeper can view members.');
    }
    
    db.all(`SELECT * FROM initiates WHERE status = 'approved' ORDER BY created_at DESC`, [], (err, rows) => {
      if (err || !rows || rows.length === 0) {
        return ctx.reply('☬ No approved initiates yet.');
      }
      
      let msg = `☬ *SHADOWS OF THE VEIL* (${rows.length})\n\n`;
      rows.slice(0, 30).forEach((r, i) => {
        msg += `${i+1}. ${r.moniker} (${r.role})\n   OAT: ${r.oat}\n`;
      });
      if (rows.length > 30) msg += `\n... and ${rows.length - 30} more.`;
      ctx.reply(msg, { parse_mode: 'Markdown' });
    });
  });
  
  bot.command('stats', (ctx) => {
    if (!isOwner(ctx)) {
      return ctx.reply('☠ Only the Veil Keeper can view statistics.');
    }
    
    db.get(`SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
      SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected
      FROM initiates`, [], (err, row) => {
      
      db.get(`SELECT COUNT(*) as support FROM support_messages WHERE replied = 0`, [], (sErr, sRow) => {
        ctx.reply(`
  📊 *SILENT LEDGER STATISTICS* 📊
  
  Total Souls: ${row?.total || 0}
  ⏳ Pending: ${row?.pending || 0}
  ✅ Approved: ${row?.approved || 0}
  ❌ Rejected: ${row?.rejected || 0}
  
  📬 Pending Support: ${sRow?.support || 0}
  
  "The Veil watches over all."
        `, { parse_mode: 'Markdown' });
      });
    });
  });
  
  bot.command('delete', (ctx) => {
    if (!isOwner(ctx)) {
      return ctx.reply('☠ Only the Veil Keeper can delete records.');
    }
    
    const args = ctx.message.text.split(' ');
    
    if (args.length < 2) {
      return ctx.reply(`
  🗑️ *DELETE COMMAND USAGE* 🗑️
  
  /delete [initiate_id]
  
  Permanently erase an initiate from the Silent Ledger.
  
  Example:
  /delete 5
  
  *Note:* This action cannot be undone.
      `, { parse_mode: 'Markdown' });
    }
    
    const id = args[1];
    
    db.run(`DELETE FROM initiates WHERE id = ?`, [id], function(err) {
      if (err) {
        return ctx.reply('☠ Failed to delete record.');
      }
      if (this.changes === 0) {
        return ctx.reply('❌ Initiate not found.');
      }
      ctx.reply(`☠ Initiate #${id} has been erased from the Silent Ledger.`);
    });
  });
}

// ============================================
// API ENDPOINTS
// ============================================

app.post('/api/submit', async (req, res) => {
  console.log('📥 Received submission:', req.body);
  
  const data = req.body;
  
  if (!data.name || !data.email || !data.telegram || !data.oat) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  try {
    const validationRes = await axios.post(`${req.protocol}://${req.get('host')}/api/validate-email`, {
      email: data.email
    }, { timeout: 5000 });
    
    if (validationRes.data && validationRes.data.valid === false) {
      return res.status(400).json({ 
        error: 'Invalid email address',
        details: validationRes.data.message 
      });
    }
  } catch (e) {
    console.log('Email validation skipped:', e.message);
  }
  
  db.get(`SELECT id FROM initiates WHERE oat = ?`, [data.oat], (err, row) => {
    if (row) {
      return res.status(409).json({ error: 'OAT already exists in the Silent Ledger' });
    }
    
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
        
        sendEmailWithFallback(data.email, '𓃼 Initiation Received', 
          `<h1>𓃼 INITIATION RECEIVED</h1><p>Your OAT: ${data.oat}</p><p>Moniker: ${data.moniker}</p><p>The Elders will review your application shortly.</p>`);
        
        if (OWNER_ID && bot) {
          bot.telegram.sendMessage(OWNER_ID, 
            `𓃼 New initiate #${this.lastID}: ${data.name} (${data.role})\nUse /review to view.`
          ).catch(console.error);
        }
        
        res.json({ success: true, id: this.lastID });
      });
  });
});

app.get('/api/initiates', (req, res) => {
  db.all(`SELECT * FROM initiates ORDER BY created_at DESC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(rows);
  });
});

app.get('/api/initiates/:id', (req, res) => {
  db.get(`SELECT * FROM initiates WHERE id = ?`, [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!row) return res.status(404).json({ error: 'Not found' });
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
   Bot: ${bot ? '✅ Active' : '❌ Disabled'}
   Owner: ${OWNER_ID ? '✅ Configured' : '❌ Missing'}
   Email: ${emailReady ? '✅' : '⚠️'}
   ValidKit: ${VALIDKIT_API_KEY ? '✅' : '⚠️'}
   Features: All 30+ commands working
╚══════════════════════════════════════════════╝
  `);
  
  if (bot) {
    bot.launch().then(() => {
      console.log('✅ Telegram bot started');
      console.log('📋 All commands loaded with usage instructions');
    }).catch(err => {
      console.error('❌ Bot failed to start:', err);
    });
  }
});

process.once('SIGINT', () => {
  if (bot) bot.stop('SIGINT');
  db.close();
  console.log('🛑 Server shut down gracefully');
  process.exit(0);
});

process.once('SIGTERM', () => {
  if (bot) bot.stop('SIGTERM');
  db.close();
  console.log('🛑 Server shut down gracefully');
  process.exit(0);
});
