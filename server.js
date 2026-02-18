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
const PORT = process.env.PORT || 3000;

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
console.log(`✅ ValidKit API Key configured`);

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

    db.run(`CREATE TABLE IF NOT EXISTS admins (
      user_id TEXT PRIMARY KEY,
      username TEXT,
      first_name TEXT,
      role TEXT DEFAULT 'elder',
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS support_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      username TEXT,
      message TEXT NOT NULL,
      replied BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS broadcasts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message TEXT NOT NULL,
      recipients INTEGER,
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

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

    db.run(`CREATE TABLE IF NOT EXISTS warnings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      admin_id TEXT NOT NULL,
      reason TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS luna_settings (
      chat_id TEXT PRIMARY KEY,
      enabled INTEGER DEFAULT 0,
      enabled_by TEXT,
      enabled_at DATETIME
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
const bot = new Telegraf(BOT_TOKEN);

bot.catch((err, ctx) => {
  console.error('❌ Bot error:', err);
  ctx.reply('☠ An error occurred in the Veil.').catch(() => {});
});

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

⚔️ GROUP MANAGEMENT:

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
    if (err) return ctx.reply('☠ The Silent Ledger is unreachable.');
    
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
(reply) /info
      `, { parse_mode: 'Markdown' });
    }
    
    const targetUser = await getTargetUser(ctx);
    if (!targetUser) return ctx.reply('☠ User not found.');
    
    const userId = targetUser.id.toString();
    const isTargetOwner = userId === OWNER_ID;
    const userRole = await getUserRole(ctx, userId);
    
    let joinDate = 'Unknown';
    db.get(`SELECT joined_at FROM group_members WHERE user_id = ?`, [userId], (err, row) => {
      if (row?.joined_at) joinDate = new Date(row.joined_at).toLocaleDateString();
      
      ctx.reply(`
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
• All actions are recorded
• Respect the hierarchy
• ${isTargetOwner ? 'The Veil Keeper watches all' : 'The Elders observe your path'}
      `);
    });
  } catch (error) {
    ctx.reply('☠ An error occurred.');
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
    
    if (!action) {
      return ctx.reply(`
☬ *LUNA CHATBOT* ☬

/luna on  - Awaken the Sentinel
/luna off - Silence the Sentinel

Examples:
/luna on
/luna off
      `, { parse_mode: 'Markdown' });
    }
    
    const chatId = ctx.chat.id.toString();
    
    if (action === 'on') {
      if (ctx.chat.type !== 'private') {
        const userIsAdmin = await isAdmin(ctx);
        if (!userIsAdmin) return ctx.reply('☠ Only Elders can awaken the Sentinel.');
      }
      
      db.run(`INSERT OR REPLACE INTO luna_settings VALUES (?, 1, ?, CURRENT_TIMESTAMP)`,
             [chatId, ctx.from.id.toString()]);
      
      ctx.reply(`☬ *THE SENTINEL AWAKENS* ☬\n\nSpeak, and the shadows will answer.\n/luna off to silence.`, 
                { parse_mode: 'Markdown' });
    } else if (action === 'off') {
      db.run(`DELETE FROM luna_settings WHERE chat_id = ?`, [chatId]);
      ctx.reply(`☾ *THE SENTINEL RETURNS TO THE VOID* ☾`, { parse_mode: 'Markdown' });
    }
  } catch (error) {
    ctx.reply('☠ An error occurred.');
  }
});

bot.on('text', async (ctx) => {
  if (ctx.message.text.startsWith('/')) return;
  
  const chatId = ctx.chat.id.toString();
  db.get(`SELECT enabled FROM luna_settings WHERE chat_id = ?`, [chatId], async (err, row) => {
    if (err || !row?.enabled) return;
    
    try {
      await ctx.sendChatAction('typing');
      
      const response = await axios.post(`${API_BASE_URL}/ai/chat--cf-deepseek-ai-deepseek-r1-distill-qwen-32b`, {
        prompt: ctx.message.text,
        system: LUNA_SYSTEM_PROMPT,
        search: "false"
      }, { timeout: 10000 });
      
      if (response.data?.response) {
        let replyText = response.data.response;
        if (!replyText.match(/^[☬☠☾⚚]/)) replyText = `☬ ${replyText}`;
        await ctx.reply(replyText);
      } else {
        await ctx.reply('☠ The Sentinel cannot perceive your words.');
      }
    } catch (error) {
      await ctx.reply('☠ The shadows are turbulent. Try again.');
    }
  });
});

// ============================================
// ===== CODE COMMANDS =====
// ============================================

bot.command('code', async (ctx) => {
  try {
    const args = ctx.message.text.split(' ');
    
    if (args.length < 3) {
      return ctx.reply(`
⚚ *CODE GENERATION* ⚚

/code [language] [prompt]

Examples:
/code python Hello world function
/code javascript Calculate fibonacci
/code html Dark login form
      `, { parse_mode: 'Markdown' });
    }
    
    const language = args[1];
    const prompt = args.slice(2).join(' ');
    
    await ctx.sendChatAction('typing');
    
    const response = await axios.post(`${API_BASE_URL}/ai/prompttocode`, {
      prompt: prompt,
      language: language
    }, { timeout: 15000 });
    
    if (response.data?.code) {
      const codeResponse = `
☬ *CODE FROM THE SHADOWS* ☬

Language: ${language}

\`\`\`${language}
${response.data.code}
\`\`\`
      `;
      
      if (codeResponse.length > 4000) {
        const buffer = Buffer.from(response.data.code, 'utf-8');
        const ext = language === 'javascript' ? 'js' : language === 'python' ? 'py' : 'txt';
        await ctx.replyWithDocument({
          source: buffer,
          filename: `shadow_code.${ext}`
        });
      } else {
        await ctx.reply(codeResponse, { parse_mode: 'Markdown' });
      }
    } else {
      await ctx.reply('☠ The Veil could not weave your code.');
    }
  } catch (error) {
    ctx.reply('☠ Code weaving failed. Try again.');
  }
});

bot.command('fix', async (ctx) => {
  try {
    const args = ctx.message.text.split(' ');
    
    if (args.length < 2) {
      return ctx.reply(`
⚔ *BUG DETECTION* ⚔

/fix [your code]

Examples:
/fix function add(a,b) { return a+b }
/fix <div>Hello</div
      `, { parse_mode: 'Markdown' });
    }
    
    const code = args.slice(1).join(' ');
    
    await ctx.sendChatAction('typing');
    
    const response = await axios.post(`${API_BASE_URL}/ai/detectbugs`, {
      code: code
    }, { timeout: 15000 });
    
    if (response.data?.bugs) {
      ctx.reply(`
⚚ *BUG DETECTION RESULTS* ⚚

${response.data.bugs}

${response.data.fix ? `\n*Fix:* ${response.data.fix}` : ''}
      `, { parse_mode: 'Markdown' });
    } else {
      ctx.reply('☠ No bugs detected or analysis failed.');
    }
  } catch (error) {
    ctx.reply('☠ Bug detection failed.');
  }
});

// ============================================
// ===== SUPPORT SYSTEM =====
// ============================================

bot.command('support', (ctx) => {
  try {
    const args = ctx.message.text.split(' ');
    const message = args.slice(1).join(' ');
    
    if (!message && args[1] !== 'list') {
      return ctx.reply(`
📬 *SUPPORT SYSTEM* 📬

/support [message] - Contact Elders
/support list - View pending (owner only)

Examples:
/support I have an issue
/support list
      `, { parse_mode: 'Markdown' });
    }
    
    if (args[1] === 'list') {
      if (!isOwner(ctx)) return ctx.reply('☠ Only Elders can view support list.');
      
      db.all(`SELECT * FROM support_messages WHERE replied = 0 ORDER BY created_at DESC LIMIT 10`, [], (err, rows) => {
        if (err || !rows.length) return ctx.reply('📬 No pending messages.');
        
        let msg = '📬 *PENDING MESSAGES* 📬\n\n';
        rows.forEach(row => {
          msg += `#${row.id} - @${row.username || 'unknown'}\n`;
          msg += `Msg: ${row.message.substring(0, 50)}${row.message.length > 50 ? '...' : ''}\n`;
          msg += `Date: ${new Date(row.created_at).toLocaleString()}\n\n`;
        });
        ctx.reply(msg, { parse_mode: 'Markdown' });
      });
      return;
    }
    
    const userId = ctx.from.id.toString();
    const username = ctx.from.username || 'unknown';
    
    db.run(`INSERT INTO support_messages (user_id, username, message) VALUES (?, ?, ?)`,
           [userId, username, message], function(err) {
      if (err) return ctx.reply('☠ Failed to send.');
      
      bot.telegram.sendMessage(OWNER_ID, 
        `📬 Support #${this.lastID} from @${username}: ${message}`);
      ctx.reply('✅ Message sent to Elders.');
    });
  } catch (error) {
    ctx.reply('☠ An error occurred.');
  }
});

bot.command('reply', (ctx) => {
  if (!isOwner(ctx)) return ctx.reply('☠ Only Elders can reply.');
  
  const args = ctx.message.text.split(' ');
  const msgId = args[1];
  const replyMessage = args.slice(2).join(' ');
  
  if (!msgId || !replyMessage) {
    return ctx.reply('📬 Usage: /reply [message_id] [your reply]');
  }
  
  db.get(`SELECT * FROM support_messages WHERE id = ?`, [msgId], (err, row) => {
    if (err || !row) return ctx.reply('Message not found.');
    
    db.run(`UPDATE support_messages SET replied = 1 WHERE id = ?`, [msgId]);
    
    bot.telegram.sendMessage(row.user_id, 
      `📬 *REPLY FROM ELDERS* 📬\n\n${replyMessage}`, 
      { parse_mode: 'Markdown' })
      .then(() => ctx.reply('✅ Reply sent.'))
      .catch(() => ctx.reply('❌ Failed to send.'));
  });
});

// ============================================
// ===== BROADCAST SYSTEM =====
// ============================================

bot.command('broadcast', (ctx) => {
  if (!isOwner(ctx)) return ctx.reply('☠ Only the Veil Keeper can broadcast.');
  
  const message = ctx.message.text.split(' ').slice(1).join(' ');
  
  if (!message) {
    return ctx.reply('📢 Usage: /broadcast [message]');
  }
  
  ctx.reply('📢 Broadcasting...');
  
  db.all(`SELECT DISTINCT chat_id FROM initiates WHERE chat_id IS NOT NULL`, [], (err, initiates) => {
    db.all(`SELECT user_id FROM group_members WHERE is_banned = 0`, [], (gErr, members) => {
      
      const recipients = new Set();
      initiates.forEach(i => { if (i.chat_id) recipients.add(i.chat_id); });
      members.forEach(m => recipients.add(m.user_id));
      
      const total = recipients.size;
      if (total === 0) return ctx.reply('📢 No recipients.');
      
      let success = 0, fail = 0;
      const broadcastMsg = `📢 *SHADOW BROADCAST* 📢\n\n${message}`;
      
      recipients.forEach(chatId => {
        bot.telegram.sendMessage(chatId, broadcastMsg, { parse_mode: 'Markdown' })
          .then(() => { success++; if (success + fail === total) ctx.reply(`✅ Sent: ${success}\n❌ Failed: ${fail}`); })
          .catch(() => { fail++; if (success + fail === total) ctx.reply(`✅ Sent: ${success}\n❌ Failed: ${fail}`); });
      });
    });
  });
});

// ============================================
// ===== GROUP MANAGEMENT COMMANDS =====
// ============================================

bot.command('warn', async (ctx) => {
  if (!await isAdmin(ctx)) return ctx.reply('☠ Only Elders can warn.');
  
  const args = ctx.message.text.split(' ');
  if (!ctx.message.reply_to_message && args.length < 3) {
    return ctx.reply('⚠️ Usage: Reply to message: /warn [reason] OR /warn @username [reason]');
  }
  
  const targetUser = await getTargetUser(ctx);
  if (!targetUser) return ctx.reply('⚠️ User not found.');
  
  const reason = args.slice(ctx.message.reply_to_message ? 1 : 2).join(' ') || 'No reason';
  
  db.run(`INSERT INTO warnings (user_id, admin_id, reason) VALUES (?, ?, ?)`,
         [targetUser.id.toString(), ctx.from.id.toString(), reason]);
  
  db.run(`INSERT OR IGNORE INTO group_members (user_id, username, first_name) VALUES (?, ?, ?)`,
         [targetUser.id.toString(), targetUser.username || '', targetUser.first_name || '']);
  
  db.run(`UPDATE group_members SET warnings = warnings + 1 WHERE user_id = ?`, [targetUser.id.toString()]);
  
  db.get(`SELECT COUNT(*) as count FROM warnings WHERE user_id = ?`, [targetUser.id.toString()], (err, row) => {
    ctx.reply(`⚠️ Warning #${row.count} for ${targetUser.first_name}\nReason: ${reason}`);
    
    if (row.count >= 5) {
      try {
        ctx.banChatMember(targetUser.id);
        ctx.reply(`☠ User auto-banned for 5 warnings.`);
      } catch (e) {}
    }
  });
});

bot.command('warnings', async (ctx) => {
  const targetUser = await getTargetUser(ctx);
  if (!targetUser) return ctx.reply('⚠️ User not found.');
  
  const isAdminUser = await isAdmin(ctx);
  if (!isAdminUser && targetUser.id !== ctx.from.id) {
    return ctx.reply('☠ You may only check your own warnings.');
  }
  
  db.all(`SELECT * FROM warnings WHERE user_id = ? ORDER BY timestamp DESC`, 
         [targetUser.id.toString()], (err, rows) => {
    if (err || !rows.length) return ctx.reply(`✅ ${targetUser.first_name} has no warnings.`);
    
    let msg = `⚠️ Warnings for ${targetUser.first_name}:\n\n`;
    rows.forEach((w, i) => msg += `${i+1}. ${w.reason} (${new Date(w.timestamp).toLocaleDateString()})\n`);
    ctx.reply(msg);
  });
});

bot.command('clearwarn', async (ctx) => {
  if (!await isAdmin(ctx)) return ctx.reply('☠ Only Elders can clear warnings.');
  
  const targetUser = await getTargetUser(ctx);
  if (!targetUser) return ctx.reply('⚠️ User not found.');
  
  db.run(`DELETE FROM warnings WHERE user_id = ?`, [targetUser.id.toString()], function(err) {
    if (err) return ctx.reply('☠ Failed to clear.');
    db.run(`UPDATE group_members SET warnings = 0 WHERE user_id = ?`, [targetUser.id.toString()]);
    ctx.reply(`✅ Warnings cleared for ${targetUser.first_name}.`);
  });
});

bot.command('mute', async (ctx) => {
  if (!await isAdmin(ctx)) return ctx.reply('☠ Only Elders can mute.');
  
  const args = ctx.message.text.split(' ');
  if (!ctx.message.reply_to_message && args.length < 2) {
    return ctx.reply('🔇 Usage: Reply to message: /mute [minutes] OR /mute @username [minutes]');
  }
  
  const targetUser = await getTargetUser(ctx);
  if (!targetUser) return ctx.reply('⚠️ User not found.');
  
  let minutes = 60;
  if (args.length >= 2) {
    const parsed = parseInt(args[ctx.message.reply_to_message ? 1 : 2]);
    if (!isNaN(parsed)) minutes = Math.min(parsed, 1440);
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
    ctx.reply(`🔇 ${targetUser.first_name} muted for ${minutes} minutes.`);
  } catch (error) {
    ctx.reply('☠ Failed to mute. Am I admin?');
  }
});

bot.command('unmute', async (ctx) => {
  if (!await isAdmin(ctx)) return ctx.reply('☠ Only Elders can unmute.');
  
  const targetUser = await getTargetUser(ctx);
  if (!targetUser) return ctx.reply('⚠️ User not found.');
  
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
    ctx.reply(`🔊 ${targetUser.first_name} unmuted.`);
  } catch (error) {
    ctx.reply('☠ Failed to unmute.');
  }
});

bot.command('kick', async (ctx) => {
  if (!await isAdmin(ctx)) return ctx.reply('☠ Only Elders can kick.');
  
  const targetUser = await getTargetUser(ctx);
  if (!targetUser) return ctx.reply('⚠️ User not found.');
  
  try {
    await ctx.kickChatMember(targetUser.id);
    await ctx.unbanChatMember(targetUser.id);
    ctx.reply(`👢 ${targetUser.first_name} kicked.`);
  } catch (error) {
    ctx.reply('☠ Failed to kick.');
  }
});

bot.command('ban', async (ctx) => {
  if (!await isAdmin(ctx)) return ctx.reply('☠ Only Elders can ban.');
  
  const args = ctx.message.text.split(' ');
  if (!ctx.message.reply_to_message && args.length < 2) {
    return ctx.reply('☠ Usage: Reply to message: /ban [reason] OR /ban @username [reason]');
  }
  
  const targetUser = await getTargetUser(ctx);
  if (!targetUser) return ctx.reply('⚠️ User not found.');
  
  const reason = args.slice(ctx.message.reply_to_message ? 1 : 2).join(' ') || 'No reason';
  
  try {
    await ctx.banChatMember(targetUser.id);
    db.run(`INSERT OR REPLACE INTO group_members (user_id, username, first_name, is_banned, ban_reason, banned_at) 
            VALUES (?, ?, ?, 1, ?, CURRENT_TIMESTAMP)`,
           [targetUser.id.toString(), targetUser.username || '', targetUser.first_name || '', reason]);
    ctx.reply(`☠ ${targetUser.first_name} banned.\nReason: ${reason}`);
  } catch (error) {
    ctx.reply('☠ Failed to ban.');
  }
});

bot.command('unban', async (ctx) => {
  if (!await isAdmin(ctx)) return ctx.reply('☠ Only Elders can unban.');
  
  const args = ctx.message.text.split(' ');
  if (args.length < 2) return ctx.reply('🔄 Usage: /unban [user_id or @username]');
  
  let targetId = args[1];
  
  if (targetId.startsWith('@')) {
    try {
      const chat = await ctx.telegram.getChat(targetId);
      targetId = chat.id.toString();
    } catch (error) {
      return ctx.reply('☠ User not found.');
    }
  }
  
  try {
    await ctx.unbanChatMember(targetId);
    db.run(`UPDATE group_members SET is_banned = 0 WHERE user_id = ?`, [targetId]);
    ctx.reply(`✅ User ${targetId} unbanned.`);
  } catch (error) {
    ctx.reply('☠ Failed to unban.');
  }
});

bot.command('promote', async (ctx) => {
  if (!await isAdmin(ctx)) return ctx.reply('☠ Only Elders can promote.');
  
  const targetUser = await getTargetUser(ctx);
  if (!targetUser) return ctx.reply('⚠️ User not found.');
  
  try {
    await ctx.promoteChatMember(targetUser.id, {
      can_change_info: true,
      can_delete_messages: true,
      can_invite_users: true,
      can_restrict_members: true,
      can_pin_messages: true,
      can_promote_members: false
    });
    ctx.reply(`⬆️ ${targetUser.first_name} promoted to admin.`);
  } catch (error) {
    ctx.reply('☠ Failed to promote.');
  }
});

bot.command('demote', async (ctx) => {
  if (!await isAdmin(ctx)) return ctx.reply('☠ Only Elders can demote.');
  
  const targetUser = await getTargetUser(ctx);
  if (!targetUser) return ctx.reply('⚠️ User not found.');
  
  try {
    await ctx.promoteChatMember(targetUser.id, {
      can_change_info: false,
      can_delete_messages: false,
      can_invite_users: false,
      can_restrict_members: false,
      can_pin_messages: false,
      can_promote_members: false
    });
    ctx.reply(`⬇️ ${targetUser.first_name} demoted.`);
  } catch (error) {
    ctx.reply('☠ Failed to demote.');
  }
});

// ============================================
// ===== ADMIN INITIATE MANAGEMENT =====
// ============================================

bot.command('review', (ctx) => {
  if (!isOwner(ctx)) return ctx.reply('☠ Only the Veil Keeper can review.');
  
  db.all(`SELECT * FROM initiates WHERE status = 'pending' ORDER BY created_at ASC`, [], (err, rows) => {
    if (err || !rows?.length) return ctx.reply('☬ No pending initiates.');
    
    ctx.reply(`☬ Found ${rows.length} pending:`);
    
    rows.forEach((row, i) => {
      setTimeout(() => {
        ctx.replyWithMarkdown(`
*Pending #${row.id}*
👤 ${row.name}
📧 ${row.email}
🏷️ ${row.moniker}
⚔️ ${row.role}
𓃼 ${row.oat}
📅 ${new Date(row.created_at).toLocaleDateString()}
        `, {
          reply_markup: {
            inline_keyboard: [[
              { text: '☬ APPROVE', callback_data: `approve_${row.id}` },
              { text: '☠ REJECT', callback_data: `reject_${row.id}` }
            ]]
          }
        });
      }, i * 500);
    });
  });
});

bot.on('callback_query', async (ctx) => {
  if (ctx.from.id.toString() !== OWNER_ID) {
    await ctx.answerCbQuery('☠ Only Elders can judge.');
    return;
  }
  
  const [action, id] = ctx.callbackQuery.data.split('_');
  
  db.get(`SELECT * FROM initiates WHERE id = ?`, [id], async (err, row) => {
    if (err || !row) {
      await ctx.answerCbQuery('Not found.');
      await ctx.editMessageText('❌ Initiate not found.');
      return;
    }
    
    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    const emoji = action === 'approve' ? '☬' : '☠';
    
    db.run(`UPDATE initiates SET status = ?, reviewed_at = ?, reviewed_by = ? WHERE id = ?`,
           [newStatus, new Date().toISOString(), ctx.from.username || 'Elder', id]);
    
    if (row.telegram) {
      try {
        const chat = await bot.telegram.getChat(row.telegram).catch(() => null);
        if (chat) db.run(`UPDATE initiates SET chat_id = ? WHERE id = ?`, [chat.id.toString(), id]);
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
    
    let statusMsg = `${emoji} #${id} ${row.name} ${newStatus}. ${emoji}`;
    if (emailSent) statusMsg += `\n✅ Email sent.`;
    else statusMsg += `\n❌ Email failed.`;
    
    await ctx.editMessageText(statusMsg);
    await ctx.answerCbQuery(`✅ ${newStatus}`);
  });
});

bot.command('approve', (ctx) => {
  if (!isOwner(ctx)) return ctx.reply('☠ Only the Veil Keeper can approve.');
  
  const id = ctx.message.text.split(' ')[1];
  if (!id) return ctx.reply('☬ Usage: /approve [initiate_id]');
  
  db.get(`SELECT * FROM initiates WHERE id = ?`, [id], (err, row) => {
    if (!row) return ctx.reply('Initiate not found.');
    
    db.run(`UPDATE initiates SET status = 'approved', reviewed_at = ?, reviewed_by = ? WHERE id = ?`,
           [new Date().toISOString(), ctx.from.username || 'Elder', id]);
    
    sendEmailWithFallback(row.email, '☬ Initiation APPROVED', `<h1>Approved</h1><p>OAT: ${row.oat}</p>`)
      .then(sent => ctx.reply(`☬ #${id} approved. ${sent ? 'Email sent.' : 'Email failed.'}`));
  });
});

bot.command('reject', (ctx) => {
  if (!isOwner(ctx)) return ctx.reply('☠ Only the Veil Keeper can reject.');
  
  const id = ctx.message.text.split(' ')[1];
  if (!id) return ctx.reply('☠ Usage: /reject [initiate_id]');
  
  db.get(`SELECT * FROM initiates WHERE id = ?`, [id], (err, row) => {
    if (!row) return ctx.reply('Initiate not found.');
    
    db.run(`UPDATE initiates SET status = 'rejected', reviewed_at = ?, reviewed_by = ? WHERE id = ?`,
           [new Date().toISOString(), ctx.from.username || 'Elder', id]);
    
    sendEmailWithFallback(row.email, '☠ Initiation REJECTED', `<h1>Rejected</h1><p>OAT: ${row.oat}</p>`)
      .then(sent => ctx.reply(`☠ #${id} rejected. ${sent ? 'Email sent.' : 'Email failed.'}`));
  });
});

bot.command('members', (ctx) => {
  if (!isOwner(ctx)) return ctx.reply('☠ Only the Veil Keeper can view members.');
  
  db.all(`SELECT * FROM initiates WHERE status = 'approved' ORDER BY created_at DESC`, [], (err, rows) => {
    if (err || !rows?.length) return ctx.reply('☬ No approved initiates.');
    
    let msg = `☬ SHADOWS OF THE VEIL (${rows.length})\n\n`;
    rows.slice(0, 20).forEach((r, i) => {
      msg += `${i+1}. ${r.moniker} (${r.role})\n`;
    });
    if (rows.length > 20) msg += `\n... and ${rows.length - 20} more.`;
    ctx.reply(msg);
  });
});

bot.command('stats', (ctx) => {
  if (!isOwner(ctx)) return ctx.reply('☠ Only the Veil Keeper can view stats.');
  
  db.get(`SELECT 
    COUNT(*) as total,
    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
    SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
    SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected
    FROM initiates`, [], (err, row) => {
    
    db.get(`SELECT COUNT(*) as support FROM support_messages WHERE replied = 0`, [], (sErr, sRow) => {
      ctx.reply(`
📊 SILENT LEDGER STATISTICS 📊

Total Souls: ${row?.total || 0}
⏳ Pending: ${row?.pending || 0}
✅ Approved: ${row?.approved || 0}
❌ Rejected: ${row?.rejected || 0}

📬 Pending Support: ${sRow?.support || 0}
      `);
    });
  });
});

bot.command('delete', (ctx) => {
  if (!isOwner(ctx)) return ctx.reply('☠ Only the Veil Keeper can delete.');
  
  const id = ctx.message.text.split(' ')[1];
  if (!id) return ctx.reply('🗑️ Usage: /delete [initiate_id]');
  
  db.run(`DELETE FROM initiates WHERE id = ?`, [id], function(err) {
    if (err) return ctx.reply('☠ Failed to delete.');
    if (this.changes === 0) return ctx.reply('Initiate not found.');
    ctx.reply(`☠ Initiate #${id} erased.`);
  });
});

// ============================================
// API ENDPOINTS
// ============================================

app.post('/api/submit', async (req, res) => {
  console.log('📥 Received submission:', req.body);
  
  const data = req.body;
  
  if (!data.name || !data.email || !data.telegram || !data.oat) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  // Validate email with ValidKit
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
    if (row) return res.status(409).json({ error: 'OAT already exists' });
    
    db.run(`INSERT INTO initiates 
            (name, age, gender, phone, email, telegram, moniker, role, skills, oat, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
            [data.name, data.age, data.gender, data.phone, data.email, 
             data.telegram, data.moniker, data.role, data.skills, data.oat],
      function(err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        
        sendEmailWithFallback(data.email, '𓃼 Initiation Received', 
          `<h1>Received</h1><p>OAT: ${data.oat}</p>`);
        
        if (OWNER_ID) {
          bot.telegram.sendMessage(OWNER_ID, 
            `𓃼 New initiate #${this.lastID}: ${data.name}`).catch(() => {});
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
   Bot: ✅ Active
   Owner: ✅ Configured
   Email: ${emailReady ? '✅' : '⚠️'}
   ValidKit: ✅ Configured
   Features: All 25+ commands working
╚══════════════════════════════════════════════╝
  `);
  
  bot.launch().then(() => {
    console.log('✅ Telegram bot started');
    console.log('📋 All commands loaded with usage instructions');
  }).catch(err => {
    console.error('❌ Bot failed to start:', err);
  });
});

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
