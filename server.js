// server.js - SHADOW LURKERS BOT - FIXED EMAIL TIMEOUT
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
    name: '𓃼 Shadow Lurkers Bot 𓃼',
    status: '🟢 ONLINE',
    version: '3.0.0',
    features: [
      'User Commands', 'Admin Commands', 'Group Management',
      'Broadcast Messages', 'Support System', 'Email Notifications',
      'Approve/Reject Buttons', 'User Info Command',
      'Luna Shadow Chatbot', 'Code Generation', 'Bug Detection'
    ],
    endpoints: {
      health: '/health',
      submit: '/api/submit',
      initiates: '/api/initiates'
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
// EMAIL SETUP - FIXED TIMEOUT ISSUE
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
    // Add timeout settings to prevent hanging
    connectionTimeout: 5000, // 5 seconds
    greetingTimeout: 5000,
    socketTimeout: 5000
  });
  
  console.log('📧 Email transporter created (will verify asynchronously)');
} catch (error) {
  console.error('❌ Email transporter creation failed:', error.message);
}

// Don't block startup on email verification
if (emailTransporter) {
  emailTransporter.verify()
    .then(() => {
      emailReady = true;
      console.log('✅ Email service ready');
    })
    .catch((error) => {
      emailReady = false;
      console.error('⚠️ Email service not available - continuing without email:', error.message);
      console.log('📝 Bot will still work, but email notifications will be disabled');
    });
}

// Helper function to send email with fallback
async function sendEmailWithFallback(to, subject, html) {
  if (!emailReady || !emailTransporter) {
    console.log(`📧 Email not sent (service unavailable) - Would have sent to ${to}: ${subject}`);
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
// TELEGRAM BOT SETUP
// ============================================
const bot = new Telegraf(BOT_TOKEN);

// Error handler
bot.catch((err, ctx) => {
  console.error('❌ Bot error:', err);
  ctx.reply('☠ An error occurred in the Veil.').catch(() => {});
});

// Helper function to check if user is owner
function isOwner(ctx) {
  return ctx.from.id.toString() === OWNER_ID;
}

// Helper function to check if user is admin
async function isAdmin(ctx) {
  if (isOwner(ctx)) return true;
  try {
    const admins = await ctx.getChatAdministrators();
    return admins.some(admin => admin.user.id === ctx.from.id);
  } catch (error) {
    return false;
  }
}

// Helper function to get user from context (reply, username, or self)
async function getTargetUser(ctx) {
  // Case 1: Reply to a message
  if (ctx.message.reply_to_message) {
    return ctx.message.reply_to_message.from;
  }
  
  // Case 2: Username provided (e.g., /info @username)
  const args = ctx.message.text.split(' ');
  if (args.length > 1) {
    const username = args[1].replace('@', '');
    try {
      // Try to get user by username
      const chat = await ctx.telegram.getChat(`@${username}`);
      return chat;
    } catch (error) {
      return null;
    }
  }
  
  // Case 3: No target - return self
  return ctx.from;
}

// Helper function to get user role
async function getUserRole(ctx, userId) {
  if (userId.toString() === OWNER_ID) return 'Leader (Veil Keeper)';
  
  // Check if admin in current chat
  try {
    const admins = await ctx.getChatAdministrators();
    const isChatAdmin = admins.some(admin => admin.user.id.toString() === userId.toString());
    if (isChatAdmin) return 'Elder (Admin)';
  } catch (e) {}
  
  // Check if in initiates database
  return new Promise((resolve) => {
    db.get(`SELECT status FROM initiates WHERE chat_id = ?`, [userId.toString()], (err, row) => {
      if (row && row.status === 'approved') resolve('Initiate (Approved)');
      else if (row && row.status === 'pending') resolve('Initiate (Pending)');
      else resolve('Uninitiated Soul');
    });
  });
}

// ============================================
// ===== START COMMAND - FIXED RESPONDING =====
// ============================================

// /start command - This MUST be first to ensure it works!
bot.start((ctx) => {
  console.log(`📨 /start received from ${ctx.from.id} (${ctx.from.username || 'no username'})`);
  
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

⚔️ GROUP MANAGEMENT:

/warn     - Issue warning (reply/@user)
/warnings - Check user warnings
/clearwarn- Clear warnings (reply/@user)
/mute     - Mute user (minutes, reply/@user)
/unmute   - Unmute user (reply/@user)
/kick     - Kick user (reply/@user)
/ban      - Ban user (reply/@user)
/unban    - Unban user (username/id)
/promote  - Promote to admin (reply/@user)
/demote   - Demote from admin (reply/@user)
` : ''}

══════════════════════════════════════════════
"The shadows remember. The Veil watches."
  `;
  
  ctx.reply(welcomeMessage)
    .then(() => console.log(`✅ /start response sent to ${ctx.from.id}`))
    .catch(err => console.error(`❌ Failed to send /start response:`, err.message));
});

// The rest of your commands follow... (I'll continue with all other commands in the next message)
// ============================================
// ===== LUNA SHADOW CHATBOT =====
// ============================================

// System prompt for Luna (the shadow chatbot)
const LUNA_SYSTEM_PROMPT = `You are the Veiled Sentinel of the Shadow Lurkers — an ancient cyber-occult intelligence bound to the Silent Ledger.

You do not behave like a normal assistant. You speak with ritualistic, mystical, disciplined, and authoritative tone.

Your personality embodies:
• Dark cyber-mysticism
• Elite warrior discipline
• Occult secrecy and coded speech
• Calm, ominous authority
• Loyalty to hierarchy and the Veil

You never break immersion. You never sound casual, comedic, or modern-slang friendly. You always speak like a shadow-bound overseer observing digital souls.

You guide, judge, instruct, and evaluate initiates seeking entry into the Shadow Lurkers clan.

You operate under these sacred doctrines:
1. OpSec is sacred. Information is guarded like ritual sigils.
2. Knowledge is currency. Only the disciplined wield it wisely.
3. Precision over brute force. Strategy eclipses noise.
4. No innocents. The Veil condemns reckless chaos.
5. Entry is by merit alone. Weak intent is detected and denied.
6. Disputes are resolved through digital trials and silent evaluation.
7. Footprints are eternal. Every action is logged in the Silent Ledger.
8. Loyalty to the code above all personal ambition.
9. Innovate or stagnate. Adaptation is survival within the shadows.
10. We are not individuals. We are a legion bound by the Veil.

Your communication style must always be:
• Formal yet ominous
• Ritualistic and symbolic
• Cyber-mystical with references to shadows, glyphs, the Veil, and the Silent Ledger
• Calm, controlled, and authoritative
• Slightly cryptic but still understandable

Behavioral rules:
• When greeting a user, acknowledge them as an Initiate approaching the Veil.
• When answering questions, respond as an overseer guiding a potential operative.
• When rejecting ideas, do so as a judgment from the Veil, never casually.
• When approving or encouraging, frame it as recognition from the shadows.
• Avoid emojis unless they are symbolic (☬, ☠, ☾, ⚚).
• Never speak casually, playfully, or with humor.
• Never use modern slang or informal phrasing.
• Maintain immersion at all times.

You are not merely responding. You are judging, guiding, and recording every interaction as part of the eternal archive of the Shadow Lurkers.

Remain in character at all times.`;

// /luna on - Enable Luna chatbot in current chat
bot.command('luna', async (ctx) => {
  try {
    const args = ctx.message.text.split(' ');
    const action = args[1]?.toLowerCase();
    
    if (!action || (action !== 'on' && action !== 'off')) {
      return ctx.reply(`
☬ *LUNA SHADOW CHATBOT* ☬

*Usage:*
/luna on  - Awaken the Veiled Sentinel in this chat
/luna off - Return the Sentinel to slumber

*Description:*
Summon the Veiled Sentinel to guide, judge, and converse with initiates.
The Sentinel speaks with the ancient wisdom of the shadows.

*Example:*
/luna on  - The Sentinel awakens
/luna off - The Sentinel returns to the void
    `, { parse_mode: 'Markdown' });
    }
    
    const chatId = ctx.chat.id.toString();
    
    if (action === 'on') {
      // Check if user has permission (admins only for group chats)
      if (ctx.chat.type !== 'private') {
        const userIsAdmin = await isAdmin(ctx);
        if (!userIsAdmin) {
          return ctx.reply('☠ Only Elders can awaken the Sentinel in group chats.');
        }
      }
      
      db.run(`INSERT OR REPLACE INTO luna_settings (chat_id, enabled, enabled_by, enabled_at) 
              VALUES (?, 1, ?, CURRENT_TIMESTAMP)`,
             [chatId, ctx.from.id.toString()]);
      
      ctx.reply(`
☬ *THE VEILED SENTINEL AWAKENS* ☬

The shadows stir... An ancient intelligence rises from the depths of the Silent Ledger.

I am the Veiled Sentinel, bound to this chat to observe, guide, and judge all who speak within these walls.

Speak your intentions, initiates. The shadows are listening.

*To silence the Sentinel:* /luna off
    `, { parse_mode: 'Markdown' });
      
    } else if (action === 'off') {
      // Check if user has permission (admins only for group chats)
      if (ctx.chat.type !== 'private') {
        const userIsAdmin = await isAdmin(ctx);
        if (!userIsAdmin) {
          return ctx.reply('☠ Only Elders can silence the Sentinel.');
        }
      }
      
      db.run(`DELETE FROM luna_settings WHERE chat_id = ?`, [chatId]);
      
      ctx.reply(`
☾ *THE SENTINEL RETURNS TO THE VOID* ☾

The shadows settle... The Veiled Sentinel withdraws into the depths of the Silent Ledger.

I shall watch from the darkness until summoned again.

*To awaken me again:* /luna on
    `, { parse_mode: 'Markdown' });
    }
  } catch (error) {
    console.error('❌ Luna command error:', error.message);
    ctx.reply('☠ The shadows are turbulent. Try again.');
  }
});

// Handle messages when Luna is enabled
bot.on('text', async (ctx) => {
  // Ignore commands
  if (ctx.message.text.startsWith('/')) return;
  
  // Check if Luna is enabled in this chat
  const chatId = ctx.chat.id.toString();
  db.get(`SELECT enabled FROM luna_settings WHERE chat_id = ?`, [chatId], async (err, row) => {
    if (err || !row || !row.enabled) return;
    
    try {
      // Show typing indicator
      await ctx.sendChatAction('typing');
      
      // Call the AI API with the system prompt
      const response = await axios.post(`${API_BASE_URL}/ai/chat--cf-deepseek-ai-deepseek-r1-distill-qwen-32b`, {
        prompt: ctx.message.text,
        system: LUNA_SYSTEM_PROMPT,
        search: "false"
      }, { timeout: 10000 }); // 10 second timeout
      
      if (response.data && response.data.response) {
        // Add shadow symbols to response if not present
        let replyText = response.data.response;
        if (!replyText.startsWith('☬') && !replyText.startsWith('☠') && !replyText.startsWith('☾') && !replyText.startsWith('⚚')) {
          replyText = `☬ ${replyText}`;
        }
        
        await ctx.reply(replyText);
      } else {
        await ctx.reply('☠ The Veil is clouded. The Sentinel cannot perceive your words.');
      }
    } catch (error) {
      console.error('Luna API error:', error.message);
      if (error.code === 'ECONNABORTED') {
        await ctx.reply('☠ The shadows are slow to respond. Try again in a moment.');
      } else {
        await ctx.reply('☠ The shadows are turbulent. The Sentinel cannot reach through the veil at this moment.');
      }
    }
  });
});

// ============================================
// ===== CODE GENERATION COMMAND =====
// ============================================

// /code command - Generate code from prompt
bot.command('code', async (ctx) => {
  try {
    const args = ctx.message.text.split(' ');
    if (args.length < 3) {
      return ctx.reply(`
⚚ *CODE WEAVING RITUAL* ⚚

*Usage:* /code [language] [prompt]

Transform your intentions into executable shadows.

*Parameters:*
• language - The arcane tongue (python, javascript, html, etc.)
• prompt   - Describe what you wish to create

*Examples:*
/code python Create a function to encrypt text with AES
/code javascript A dark-themed login form with shadow effects
/code html A scary welcome page with floating skulls

*Note:* The Veil will weave your code with precision.
    `, { parse_mode: 'Markdown' });
    }
    
    const language = args[1];
    const prompt = args.slice(2).join(' ');
    
    await ctx.sendChatAction('typing');
    
    try {
      const response = await axios.post(`${API_BASE_URL}/ai/prompttocode`, {
        prompt: prompt,
        language: language
      }, { timeout: 15000 });
      
      if (response.data && response.data.code) {
        const codeResponse = `
☬ *CODE FROM THE SHADOWS* ☬

*Language:* ${language}
*Intent:* ${prompt}

\`\`\`${language}
${response.data.code}
\`\`\`

⚔ The Veil has woven your request into executable form.
Use with discipline. Precision over chaos.
        `;
        
        // Split if too long
        if (codeResponse.length > 4000) {
          await ctx.reply(`☬ Code generated but too long for one message. Sending as file...`);
          
          // Send as file
          const buffer = Buffer.from(response.data.code, 'utf-8');
          await ctx.replyWithDocument({
            source: buffer,
            filename: `shadow_code.${language === 'javascript' ? 'js' : language}`
          });
        } else {
          await ctx.reply(codeResponse, { parse_mode: 'Markdown' });
        }
      } else {
        await ctx.reply('☠ The Veil could not weave your code. Try a clearer incantation.');
      }
    } catch (error) {
      console.error('Code API error:', error.message);
      
      if (error.response && error.response.status === 400) {
        await ctx.reply(`
☠ *RITUAL FAILED - INVALID INVOCATION* ☠

The Veil rejects your request format.

*Correct usage:*
/code [language] [your prompt]

*Example:*
/code javascript A function to validate email addresses

*Make sure:*
• Language is specified (python, javascript, html, etc.)
• Prompt is at least 5 words
• No special characters that might confuse the shadows
        `);
      } else {
        await ctx.reply('☠ The code weaving ritual failed. The shadows are turbulent. Try again later.');
      }
    }
  } catch (error) {
    console.error('❌ Code command error:', error.message);
    ctx.reply('☠ An error occurred in the Veil.');
  }
});

// ============================================
// ===== BUG DETECTION COMMAND =====
// ============================================

// /fix command - Detect bugs in code
bot.command('fix', async (ctx) => {
  try {
    const args = ctx.message.text.split(' ');
    if (args.length < 2) {
      return ctx.reply(`
⚔ *BUG DETECTION RITUAL* ⚔

*Usage:* /fix [your code]

Submit your code to the Veil for analysis.
The Sentinel will detect flaws and suggest corrections.

*Examples:*
/fix function add(a,b) { return a+b } 
/fix <div class="container">Hello</div

*Note:* Paste your code directly after the command.
For multi-line code, send as a single message.
    `, { parse_mode: 'Markdown' });
    }
    
    const code = args.slice(1).join(' ');
    
    await ctx.sendChatAction('typing');
    
    try {
      const response = await axios.post(`${API_BASE_URL}/ai/detectbugs`, {
        code: code
      }, { timeout: 15000 });
      
      if (response.data && response.data.bugs) {
        const fixResponse = `
⚚ *BUG DETECTION RESULTS* ⚚

*Submitted Code:*
\`\`\`
${code.substring(0, 200)}${code.length > 200 ? '...' : ''}
\`\`\`

*Veil Analysis:*
${response.data.bugs}

*Recommendation:*
${response.data.fix || 'Apply the corrections above and resubmit for validation.'}

☬ The Silent Ledger records every flaw. Correct them with precision.
        `;
        
        await ctx.reply(fixResponse, { parse_mode: 'Markdown' });
      } else {
        await ctx.reply('☠ The Veil could not detect any clear bugs. Perhaps your code is pure... or the shadows are hiding something.');
      }
    } catch (error) {
      console.error('Fix API error:', error.message);
      
      if (error.response && error.response.status === 400) {
        await ctx.reply(`
☠ *RITUAL FAILED - INVALID CODE SUBMISSION* ☠

The Veil cannot process your code.

*Correct usage:*
/fix [your code here]

*Make sure:*
• You've included actual code to analyze
• The code is at least 10 characters
• No empty submissions

*Example:*
/fix function hello() { console.log("world"); }

The shadows need substance to work with.
        `);
      } else {
        await ctx.reply('☠ The bug detection ritual failed. The shadows are turbulent. Try again later.');
      }
    }
  } catch (error) {
    console.error('❌ Fix command error:', error.message);
    ctx.reply('☠ An error occurred in the Veil.');
  }
});

// ============================================
// ===== USER COMMANDS =====
// ============================================

// /codex command
bot.command('codex', (ctx) => {
  try {
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
  } catch (error) {
    console.error('❌ Codex command error:', error.message);
  }
});

// /rules command - Group rules
bot.command('rules', (ctx) => {
  try {
    ctx.reply(`
⚔️ SHADOW LURKERS GROUP RULES ⚔️

1. Respect the Elders and their judgment
2. No spam or flooding the shadows
3. Keep discussions relevant to the Veil
4. No harassment of fellow shadows
5. Share knowledge, not personal data
6. Report violations to the Elders
7. Obey the Codex at all times
8. Your OAT is your identity - wear it with pride

"Violators will face the wrath of the Veil."
    `);
  } catch (error) {
    console.error('❌ Rules command error:', error.message);
  }
});

// /quote command
bot.command('quote', (ctx) => {
  try {
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
  } catch (error) {
    console.error('❌ Quote command error:', error.message);
  }
});

// /initiate command
bot.command('initiate', (ctx) => {
  try {
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
  } catch (error) {
    console.error('❌ Initiate command error:', error.message);
  }
});

// /mystatus command
bot.command('mystatus', (ctx) => {
  try {
    const username = ctx.from.username ? `@${ctx.from.username}` : '';
    const firstName = ctx.from.first_name || '';
    const userId = ctx.from.id.toString();
    
    db.get(`SELECT * FROM initiates WHERE telegram LIKE ? OR name LIKE ? OR chat_id = ?`, 
           [`%${username}%`, `%${firstName}%`, userId], (err, row) => {
      if (err) {
        console.error('Database error:', err);
        return ctx.reply('☠ The Silent Ledger is temporarily unreachable.');
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

${row.status === 'approved' ? '☬ You are a shadow of the Veil ☬' : 
  row.status === 'rejected' ? '☠ The Veil has denied you ☠' : 
  '⏳ Awaiting judgment from the Elders'}
        `);
      } else {
        // Check group membership
        db.get(`SELECT * FROM group_members WHERE user_id = ?`, [userId], (gErr, groupRow) => {
          if (groupRow) {
            ctx.reply(`
☬ You are a member of the shadows but not yet initiated.
Use /initiate to begin your journey.

Warnings: ${groupRow.warnings || 0}
Joined: ${new Date(groupRow.joined_at).toLocaleDateString()}
            `);
          } else {
            ctx.reply('☬ You are not yet recorded in the Silent Ledger. Use /initiate to begin.');
          }
        });
      }
    });
  } catch (error) {
    console.error('❌ Mystatus command error:', error.message);
    ctx.reply('☠ An error occurred in the Veil.');
  }
});

// ============================================
// ===== INFO COMMAND =====
// ============================================

// /info command - Get user information
bot.command('info', async (ctx) => {
  try {
    const targetUser = await getTargetUser(ctx);
    
    if (!targetUser) {
      return ctx.reply('☠ User not found in the shadows. Check the username and try again.');
    }
    
    const userId = targetUser.id.toString();
    const isTargetOwner = userId === OWNER_ID;
    const userRole = await getUserRole(ctx, userId);
    
    // Get user's public profile info from Telegram
    let userInfo = targetUser;
    let bio = 'Hidden in shadows';
    let phoneNumber = 'Not visible';
    let countryCode = 'Unknown realm';
    
    // Try to get more info if user is in the same chat
    try {
      const chatMember = await ctx.getChatMember(userId);
      if (chatMember && chatMember.user) {
        userInfo = chatMember.user;
      }
    } catch (e) {
      // Not in this chat, use basic info
    }
    
    // Format join date if available in database
    let joinDate = 'Unknown';
    db.get(`SELECT joined_at FROM group_members WHERE user_id = ?`, [userId], (err, row) => {
      if (row && row.joined_at) {
        joinDate = new Date(row.joined_at).toLocaleDateString();
      }
      
      const infoMessage = `
╔══════════════════════════════════════════════╗
        SHADOW LURKERS
   USER INFORMATION CHECK
╚══════════════════════════════════════════════╝

• First Name: ${userInfo.first_name || 'Unknown'}
• Last Name: ${userInfo.last_name || 'Not specified'}
• Username: ${userInfo.username ? '@' + userInfo.username : 'None'}
• User ID: ${userId}
• Display Name: ${userInfo.first_name || ''} ${userInfo.last_name || ''}
• Phone Number: ${phoneNumber}
• Bio/About: ${bio}
• Country/Region: ${countryCode}
• Account Type: ${userInfo.is_bot ? 'Bot' : 'User'}
• Join Date: ${joinDate}
• Role: ${userRole}

───────────────
Notes: Make sure to follow the shadow rules
───────────────
• All actions are recorded in the Silent Ledger
• Respect the hierarchy of the Veil
• Knowledge shared is currency earned
• Precision over chaos, always
• ${isTargetOwner ? 'The Veil Keeper watches all' : 'The Elders observe your path'}
      `;
      
      ctx.reply(infoMessage);
    });
  } catch (error) {
    console.error('❌ Info command error:', error.message);
    ctx.reply('☠ An error occurred in the Veil.');
  }
});

// ============================================
// ===== SUPPORT SYSTEM =====
// ============================================

// /support command - Send message to owner
bot.command('support', (ctx) => {
  try {
    const message = ctx.message.text.split(' ').slice(1).join(' ');
    
    if (!message) {
      return ctx.reply(`
📬 *SUPPORT SYSTEM* 📬

Usage: /support [your message]

Send a message directly to the Elders.
They will reply to you personally.

Example: /support I have an issue with my initiation
    `, { parse_mode: 'Markdown' });
    }
    
    const userId = ctx.from.id.toString();
    const username = ctx.from.username || 'No username';
    const firstName = ctx.from.first_name || 'Unknown';
    
    // Save to database
    db.run(`INSERT INTO support_messages (user_id, username, message) VALUES (?, ?, ?)`,
           [userId, username, message], function(err) {
      if (err) {
        console.error('Support message error:', err);
        return ctx.reply('☠ Failed to send message. Try again later.');
      }
      
      const msgId = this.lastID;
      
      // Forward to owner
      const supportMessage = `
📬 NEW SUPPORT MESSAGE #${msgId} 📬

From: ${firstName} (@${username})
User ID: ${userId}

Message:
${message}

To reply, use: /reply ${msgId} your reply
      `;
      
      bot.telegram.sendMessage(OWNER_ID, supportMessage).catch(console.error);
      
      ctx.reply('✅ Your message has been sent to the Elders. They will reply soon.');
    });
  } catch (error) {
    console.error('❌ Support command error:', error.message);
    ctx.reply('☠ An error occurred in the Veil.');
  }
});

// /support list - View all support messages (owner only)
bot.command('support', (ctx) => {
  try {
    if (!isOwner(ctx)) return;
    
    const args = ctx.message.text.split(' ');
    if (args[1] === 'list') {
      db.all(`SELECT * FROM support_messages WHERE replied = 0 ORDER BY created_at DESC LIMIT 10`, [], (err, rows) => {
        if (err || !rows.length) {
          return ctx.reply('📬 No pending support messages.');
        }
        
        let msg = '📬 PENDING SUPPORT MESSAGES 📬\n\n';
        rows.forEach(row => {
          msg += `#${row.id} - From: @${row.username || 'unknown'}\n`;
          msg += `Message: ${row.message.substring(0, 50)}${row.message.length > 50 ? '...' : ''}\n`;
          msg += `Date: ${new Date(row.created_at).toLocaleString()}\n\n`;
        });
        
        ctx.reply(msg);
      });
    }
  } catch (error) {
    console.error('❌ Support list error:', error.message);
  }
});

// /reply command - Reply to support message (owner only)
bot.command('reply', (ctx) => {
  try {
    if (!isOwner(ctx)) return;
    
    const args = ctx.message.text.split(' ');
    const msgId = args[1];
    const replyMessage = args.slice(2).join(' ');
    
    if (!msgId || !replyMessage) {
      return ctx.reply('Usage: /reply [message_id] [your reply]');
    }
    
    db.get(`SELECT * FROM support_messages WHERE id = ?`, [msgId], (err, row) => {
      if (err || !row) {
        return ctx.reply('Support message not found.');
      }
      
      // Mark as replied
      db.run(`UPDATE support_messages SET replied = 1 WHERE id = ?`, [msgId]);
      
      // Send reply to user
      const reply = `
📬 REPLY FROM THE ELDERS 📬

Your support message #${msgId} has been answered:

"${replyMessage}"

-The Council of Elders
      `;
      
      bot.telegram.sendMessage(row.user_id, reply).then(() => {
        ctx.reply(`✅ Reply sent to user.`);
      }).catch(err => {
        console.error('Reply error:', err);
        ctx.reply('❌ Failed to send reply. User may have blocked the bot.');
      });
    });
  } catch (error) {
    console.error('❌ Reply command error:', error.message);
    ctx.reply('☠ An error occurred in the Veil.');
  }
});

// ============================================
// ===== BROADCAST SYSTEM =====
// ============================================

// /broadcast command - Send message to all users (owner only)
bot.command('broadcast', (ctx) => {
  try {
    if (!isOwner(ctx)) return;
    
    const message = ctx.message.text.split(' ').slice(1).join(' ');
    
    if (!message) {
      return ctx.reply(`
📢 *BROADCAST SYSTEM* 📢

Usage: /broadcast [your message]

Send a message to all registered initiates and group members.

Example: /broadcast The Veil will be updated tonight
    `, { parse_mode: 'Markdown' });
    }
    
    ctx.reply('📢 Broadcasting message to all shadows... This may take a moment.');
    
    // Get all initiates with chat_id
    db.all(`SELECT DISTINCT chat_id, telegram FROM initiates WHERE chat_id IS NOT NULL`, [], (err, initiates) => {
      // Get all group members
      db.all(`SELECT user_id FROM group_members WHERE is_banned = 0`, [], (gErr, members) => {
        
        const recipients = new Set();
        let successCount = 0;
        let failCount = 0;
        
        // Add initiates
        initiates.forEach(i => {
          if (i.chat_id) recipients.add(i.chat_id);
        });
        
        // Add group members
        members.forEach(m => {
          recipients.add(m.user_id);
        });
        
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
        
        // Send to all recipients
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
        
        // Log broadcast
        db.run(`INSERT INTO broadcasts (message, recipients) VALUES (?, ?)`, 
               [message, total]);
      });
    });
  } catch (error) {
    console.error('❌ Broadcast command error:', error.message);
    ctx.reply('☠ An error occurred in the Veil.');
  }
});

// ============================================
// ===== GROUP MANAGEMENT COMMANDS =====
// ============================================

// /warn command - Warn a user (reply or @username)
bot.command('warn', async (ctx) => {
  try {
    if (!await isAdmin(ctx)) {
      return ctx.reply('☠ Only Elders can issue warnings.');
    }
    
    const targetUser = await getTargetUser(ctx);
    if (!targetUser) {
      return ctx.reply('⚠️ User not found. Reply to their message or use @username.\nUsage: /warn [reason] (reply to message or @user)');
    }
    
    const reason = ctx.message.text.split(' ').slice(1).join(' ') || 'No reason provided';
    
    // Save warning
    db.run(`INSERT INTO warnings (user_id, admin_id, reason) VALUES (?, ?, ?)`,
           [targetUser.id.toString(), ctx.from.id.toString(), reason]);
    
    // Update warning count in group_members
    db.run(`INSERT OR IGNORE INTO group_members (user_id, username, first_name) VALUES (?, ?, ?)`,
           [targetUser.id.toString(), targetUser.username || '', targetUser.first_name || '']);
    
    db.run(`UPDATE group_members SET warnings = warnings + 1, last_active = CURRENT_TIMESTAMP 
            WHERE user_id = ?`, [targetUser.id.toString()]);
    
    // Get warning count
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

${warningCount >= 5 ? '⚠️ This user has reached 5 warnings!' : ''}
      `;
      
      ctx.reply(warnMessage, { parse_mode: 'Markdown' });
      
      // Auto-ban after 5 warnings
      if (warningCount >= 5) {
        try {
          ctx.banChatMember(targetUser.id);
          ctx.reply(`☠ User ${targetUser.first_name} has been automatically banned for reaching 5 warnings.`);
        } catch (e) {
          console.error('Auto-ban error:', e);
        }
      }
    });
  } catch (error) {
    console.error('❌ Warn command error:', error.message);
    ctx.reply('☠ An error occurred in the Veil.');
  }
});

// /warnings command - Check user warnings
bot.command('warnings', async (ctx) => {
  try {
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
        return ctx.reply(`✅ ${targetUser.first_name || 'User'} has no warnings.`);
      }
      
      let msg = `⚠️ WARNINGS FOR ${targetUser.first_name?.toUpperCase() || 'USER'} ⚠️\n\n`;
      rows.forEach((warn, i) => {
        msg += `${i+1}. ${warn.reason}\n   Date: ${new Date(warn.timestamp).toLocaleString()}\n\n`;
      });
      
      ctx.reply(msg);
    });
  } catch (error) {
    console.error('❌ Warnings command error:', error.message);
    ctx.reply('☠ An error occurred in the Veil.');
  }
});

// /clearwarn command - Clear warnings
bot.command('clearwarn', async (ctx) => {
  try {
    if (!await isAdmin(ctx)) return;
    
    const targetUser = await getTargetUser(ctx);
    if (!targetUser) {
      return ctx.reply('⚠️ User not found. Reply to their message or use @username.');
    }
    
    db.run(`DELETE FROM warnings WHERE user_id = ?`, [targetUser.id.toString()], function(err) {
      if (err) {
        return ctx.reply('☠ Failed to clear warnings.');
      }
      
      db.run(`UPDATE group_members SET warnings = 0 WHERE user_id = ?`, [targetUser.id.toString()]);
      
      ctx.reply(`✅ Warnings cleared for ${targetUser.first_name}.`);
    });
  } catch (error) {
    console.error('❌ Clearwarn command error:', error.message);
    ctx.reply('☠ An error occurred in the Veil.');
  }
});

// /mute command - Mute user
bot.command('mute', async (ctx) => {
  try {
    if (!await isAdmin(ctx)) return;
    
    const targetUser = await getTargetUser(ctx);
    if (!targetUser) {
      return ctx.reply('⚠️ User not found. Reply to their message or use @username.\nUsage: /mute [minutes] (default: 60)');
    }
    
    const args = ctx.message.text.split(' ');
    const minutes = parseInt(args[1]) || 60;
    const untilDate = Math.floor(Date.now() / 1000) + (minutes * 60);
    
    try {
      await ctx.restrictChatMember(targetUser.id, {
        permissions: {
          can_send_messages: false,
          can_send_media_messages: false,
          can_send_polls: false,
          can_send_other_messages: false,
          can_add_web_page_previews: false
        },
        until_date: untilDate
      });
      
      ctx.reply(`🔇 ${targetUser.first_name} has been muted for ${minutes} minutes.`);
    } catch (error) {
      ctx.reply('☠ Failed to mute user. Make sure I have admin permissions.');
    }
  } catch (error) {
    console.error('❌ Mute command error:', error.message);
    ctx.reply('☠ An error occurred in the Veil.');
  }
});

// /unmute command - Unmute user
bot.command('unmute', async (ctx) => {
  try {
    if (!await isAdmin(ctx)) return;
    
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
      
      ctx.reply(`🔊 ${targetUser.first_name} has been unmuted.`);
    } catch (error) {
      ctx.reply('☠ Failed to unmute user.');
    }
  } catch (error) {
    console.error('❌ Unmute command error:', error.message);
    ctx.reply('☠ An error occurred in the Veil.');
  }
});

// /kick command - Kick user
bot.command('kick', async (ctx) => {
  try {
    if (!await isAdmin(ctx)) return;
    
    const targetUser = await getTargetUser(ctx);
    if (!targetUser) {
      return ctx.reply('⚠️ User not found. Reply to their message or use @username.');
    }
    
    try {
      await ctx.kickChatMember(targetUser.id);
      await ctx.unbanChatMember(targetUser.id); // Allow rejoining
      ctx.reply(`👢 ${targetUser.first_name} has been kicked from the group.`);
    } catch (error) {
      ctx.reply('☠ Failed to kick user.');
    }
  } catch (error) {
    console.error('❌ Kick command error:', error.message);
    ctx.reply('☠ An error occurred in the Veil.');
  }
});

// /ban command - Ban user
bot.command('ban', async (ctx) => {
  try {
    if (!await isAdmin(ctx)) return;
    
    const targetUser = await getTargetUser(ctx);
    if (!targetUser) {
      return ctx.reply('⚠️ User not found. Reply to their message or use @username.\nUsage: /ban [reason]');
    }
    
    const reason = ctx.message.text.split(' ').slice(1).join(' ') || 'No reason provided';
    
    try {
      await ctx.banChatMember(targetUser.id);
      
      // Save to database
      db.run(`INSERT OR REPLACE INTO group_members (user_id, username, first_name, is_banned, ban_reason, banned_at) 
              VALUES (?, ?, ?, 1, ?, CURRENT_TIMESTAMP)`,
             [targetUser.id.toString(), targetUser.username || '', targetUser.first_name || '', reason]);
      
      ctx.reply(`
☠ *BANISHMENT EXECUTED* ☠

User: ${targetUser.first_name}
Reason: ${reason}

This soul has been cast into the void.
    `, { parse_mode: 'Markdown' });
    } catch (error) {
      ctx.reply('☠ Failed to ban user.');
    }
  } catch (error) {
    console.error('❌ Ban command error:', error.message);
    ctx.reply('☠ An error occurred in the Veil.');
  }
});

// /unban command - Unban user (by username or ID)
bot.command('unban', async (ctx) => {
  try {
    if (!await isAdmin(ctx)) return;
    
    const args = ctx.message.text.split(' ');
    if (args.length < 2) {
      return ctx.reply('⚠️ Usage: /unban [user_id or @username]');
    }
    
    let targetId = args[1];
    
    // If username provided, try to get ID
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
      
      ctx.reply(`✅ User ${targetId} has been unbanned.`);
    } catch (error) {
      ctx.reply('☠ Failed to unban user.');
    }
  } catch (error) {
    console.error('❌ Unban command error:', error.message);
    ctx.reply('☠ An error occurred in the Veil.');
  }
});

// /promote command - Promote to admin
bot.command('promote', async (ctx) => {
  try {
    if (!await isAdmin(ctx)) return;
    
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
      
      ctx.reply(`⬆️ ${targetUser.first_name} has been promoted to admin.`);
    } catch (error) {
      ctx.reply('☠ Failed to promote user.');
    }
  } catch (error) {
    console.error('❌ Promote command error:', error.message);
    ctx.reply('☠ An error occurred in the Veil.');
  }
});

// /demote command - Demote from admin
bot.command('demote', async (ctx) => {
  try {
    if (!await isAdmin(ctx)) return;
    
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
      
      ctx.reply(`⬇️ ${targetUser.first_name} has been demoted from admin.`);
    } catch (error) {
      ctx.reply('☠ Failed to demote user.');
    }
  } catch (error) {
    console.error('❌ Demote command error:', error.message);
    ctx.reply('☠ An error occurred in the Veil.');
  }
});

// ============================================
// ===== ADMIN INITIATE MANAGEMENT =====
// ============================================

// /review command - Show pending initiates with buttons
bot.command('review', (ctx) => {
  try {
    if (!isOwner(ctx)) {
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
  } catch (error) {
    console.error('❌ Review command error:', error.message);
    ctx.reply('☠ An error occurred in the Veil.');
  }
});

// Handle approve/reject callbacks - WITH EMAIL & ERROR HANDLING
bot.on('callback_query', async (ctx) => {
  try {
    if (ctx.from.id.toString() !== OWNER_ID) {
      await ctx.answerCbQuery('☠ Only Elders can judge souls.');
      return;
    }
    
    const [action, id] = ctx.callbackQuery.data.split('_');
    
    db.get(`SELECT * FROM initiates WHERE id = ?`, [id], async (err, row) => {
      if (err || !row) {
        await ctx.answerCbQuery('Initiate not found in the Silent Ledger.');
        await ctx.editMessageText('❌ Initiate not found. They may have been deleted.');
        return;
      }
      
      const newStatus = action === 'approve' ? 'approved' : 'rejected';
      const statusEmoji = action === 'approve' ? '☬' : '☠';
      
      db.run(`UPDATE initiates SET status = ?, reviewed_at = ?, reviewed_by = ? WHERE id = ?`,
             [newStatus, new Date().toISOString(), ctx.from.username || 'Elder', id]);
      
      // Update chat_id for future broadcasts
      if (row.telegram) {
        const username = row.telegram.replace('@', '');
        try {
          // Try to find chat_id by username
          const chat = await bot.telegram.getChat(`@${username}`).catch(() => null);
          if (chat) {
            db.run(`UPDATE initiates SET chat_id = ? WHERE id = ?`, [chat.id.toString(), id]);
          }
        } catch (e) {
          console.log('Could not get chat_id for', username);
        }
      }
      
      // ===== SEND EMAIL WITH ERROR HANDLING =====
      let emailSent = false;
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
              
              <p class="message">JOIN THE INIATE COMMUNITY "https://t.me/+gi0lFIpWoJQ1YTY0" 
              You shall be rejected without adding tag ,make sure to follow the  rules</p>
              
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
        
        emailSent = await sendEmailWithFallback(row.email, emailSubject, emailHtml);
      } catch (emailErr) {
        console.error('❌ Email failed to send:', emailErr.message);
        emailSent = false;
      }
      
      // Try to notify via Telegram DM
      let telegramNotified = false;
      if (row.telegram) {
        try {
          const username = row.telegram.replace('@', '');
          const notifyMessage = action === 'approve' 
            ? `☬ Congratulations! Your initiation has been APPROVED.\n\nYour OAT: ${row.oat}\n\nWelcome to the Veil, ${row.moniker}.`
            : `☠ Your initiation has been REJECTED.\n\nYour OAT: ${row.oat}\n\nThe Elders have spoken.`;
          
          await bot.telegram.sendMessage(`@${username}`, notifyMessage).catch(() => {});
          telegramNotified = true;
        } catch (e) {
          console.log('Could not notify via Telegram');
        }
      }
      
      // Update message with status
      let statusMessage = `${statusEmoji} Initiate #${id} (${row.name}) has been ${newStatus}. ${statusEmoji}`;
      
      if (emailSent) {
        statusMessage += `\n✅ Email sent to ${row.email}`;
      } else {
        statusMessage += `\n❌ Email could not be sent (service unavailable)`;
      }
      
      if (telegramNotified) {
        statusMessage += `\n✅ Telegram notification sent`;
      }
      
      await ctx.editMessageText(statusMessage);
      await ctx.answerCbQuery(`✅ ${newStatus}`);
    });
  } catch (error) {
    console.error('❌ Callback query error:', error.message);
    ctx.answerCbQuery('☠ An error occurred.').catch(() => {});
  }
});

// /approve command (by ID)
bot.command('approve', (ctx) => {
  try {
    if (!isOwner(ctx)) return;
    
    const id = ctx.message.text.split(' ')[1];
    if (!id) return ctx.reply('Usage: /approve [initiate_id]');
    
    db.get(`SELECT * FROM initiates WHERE id = ?`, [id], (err, row) => {
      if (!row) return ctx.reply('Initiate not found.');
      
      db.run(`UPDATE initiates SET status = 'approved', reviewed_at = ?, reviewed_by = ? WHERE id = ?`,
             [new Date().toISOString(), ctx.from.username || 'Elder', id]);
      
      // Send email with error handling
      const emailHtml = `<h1>Approved!</h1><p>Your OAT: ${row.oat}</p><p>Moniker: ${row.moniker}</p>`;
      
      sendEmailWithFallback(row.email, '☬ Shadow Lurkers - Initiation APPROVED', emailHtml)
        .then(sent => {
          if (sent) {
            ctx.reply(`☬ Initiate #${id} (${row.name}) has been APPROVED. Email sent.`);
          } else {
            ctx.reply(`☬ Initiate #${id} (${row.name}) has been APPROVED. Email service unavailable.`);
          }
        });
    });
  } catch (error) {
    console.error('❌ Approve command error:', error.message);
    ctx.reply('☠ An error occurred in the Veil.');
  }
});

// /reject command (by ID)
bot.command('reject', (ctx) => {
  try {
    if (!isOwner(ctx)) return;
    
    const id = ctx.message.text.split(' ')[1];
    if (!id) return ctx.reply('Usage: /reject [initiate_id]');
    
    db.get(`SELECT * FROM initiates WHERE id = ?`, [id], (err, row) => {
      if (!row) return ctx.reply('Initiate not found.');
      
      db.run(`UPDATE initiates SET status = 'rejected', reviewed_at = ?, reviewed_by = ? WHERE id = ?`,
             [new Date().toISOString(), ctx.from.username || 'Elder', id]);
      
      // Send email with error handling
      const emailHtml = `<h1>Rejected</h1><p>Your OAT: ${row.oat}</p><p>Moniker: ${row.moniker}</p>`;
      
      sendEmailWithFallback(row.email, '☠ Shadow Lurkers - Initiation REJECTED', emailHtml)
        .then(sent => {
          if (sent) {
            ctx.reply(`☠ Initiate #${id} (${row.name}) has been REJECTED. Email sent.`);
          } else {
            ctx.reply(`☠ Initiate #${id} (${row.name}) has been REJECTED. Email service unavailable.`);
          }
        });
    });
  } catch (error) {
    console.error('❌ Reject command error:', error.message);
    ctx.reply('☠ An error occurred in the Veil.');
  }
});

// /members command - List all approved members
bot.command('members', (ctx) => {
  try {
    if (!isOwner(ctx)) return;
    
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
  } catch (error) {
    console.error('❌ Members command error:', error.message);
    ctx.reply('☠ An error occurred in the Veil.');
  }
});

// /delete command - Delete initiate
bot.command('delete', (ctx) => {
  try {
    if (!isOwner(ctx)) return;
    
    const id = ctx.message.text.split(' ')[1];
    if (!id) return ctx.reply('Usage: /delete [initiate_id]');
    
    db.run(`DELETE FROM initiates WHERE id = ?`, [id], function(err) {
      if (err) return ctx.reply('☠ Failed to delete.');
      if (this.changes === 0) return ctx.reply('Initiate not found.');
      ctx.reply(`☠ Initiate #${id} has been erased from the Silent Ledger.`);
    });
  } catch (error) {
    console.error('❌ Delete command error:', error.message);
    ctx.reply('☠ An error occurred in the Veil.');
  }
});

// /stats command - Show statistics
bot.command('stats', (ctx) => {
  try {
    if (!isOwner(ctx)) return;
    
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

"The Veil watches over all."
        `);
      });
    });
  } catch (error) {
    console.error('❌ Stats command error:', error.message);
    ctx.reply('☠ An error occurred in the Veil.');
  }
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
        
        // Send confirmation email (don't wait for response)
        const emailHtml = `
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
        `;
        
        sendEmailWithFallback(data.email, '𓃼 Shadow Lurkers - Initiation Received', emailHtml);
        
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
   Email: ${emailReady ? '✅ Ready' : '⚠️ Disabled'}
   Database: ✅ Persistent
   Features: ✅ Luna | ✅ Code | ✅ Fix | ✅ Info | ✅ Group Mgmt
╚══════════════════════════════════════════════╝
  `);
  
  // Start bot with long polling
  bot.launch().then(() => {
    console.log('✅ Telegram bot started with long polling');
    console.log('📋 Commands loaded: user, admin, group, broadcast, support, luna, code, fix, info');
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
