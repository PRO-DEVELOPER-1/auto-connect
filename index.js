import express from 'express';
import fs from 'fs';
import pino from 'pino';
import {
  makeWASocket,
  useMultiFileAuthState,
  getContentType,
  delay,
  makeCacheableSignalKeyStore,
  jidNormalizedUser
} from '@whiskeysockets/baileys';

const app = express();
const PORT = process.env.PORT || 10000;

function removeFolder(path) {
  try {
    fs.rmSync(path, { recursive: true, force: true });
  } catch {}
}

app.get('/', async (req, res) => {
  let number = req.query.number;

  if (!number) {
    return res.send(`
      <h2>Missing number</h2>
      <p>Use: <b>/?number=254712345678</b></p>
    `);
  }

  number = number.replace(/[^0-9]/g, '');
  const sessionDir = './session-' + number;

  removeFolder(sessionDir);

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  const logger = pino({ level: "fatal" });

  const sock = makeWASocket({
    printQRInTerminal: false,
    browser: ["PAIR-MODE", "Chrome", "1.0"],
    logger,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger)
    }
  });

  sock.ev.on("creds.update", saveCreds);

  // generate pairing code (your fork supports THIS)
  if (!state.creds.registered) {
    await delay(1500);
    const code = await sock.requestPairingCode(number);

    console.log("PAIRING CODE:", code);

    return res.send(`
      <html>
        <body style="font-family:sans-serif;text-align:center">
          <h2>Enter this pairing code in WhatsApp</h2>
          <h1 style="font-size:55px;color:blue">${code}</h1>
          <p>WhatsApp → Linked Devices → Link with Phone Number</p>
        </body>
      </html>
    `);
  }

  // Auto view + react to statuses
  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg || msg.key.remoteJid !== "status@broadcast") return;

    const emojis = ["🔥", "❤️", "💯", "😎", "✨"];
    const react = emojis[Math.floor(Math.random() * emojis.length)];

    try {
      await sock.sendMessage("status@broadcast", {
        react: { text: react, key: msg.key }
      });
      console.log("Reacted:", react);
    } catch (err) {
      console.log("Reaction failed:", err);
    }
  });

  sock.ev.on("connection.update", async ({ connection }) => {
    if (connection === "open") {
      console.log("BOT CONNECTED");

      const jid = jidNormalizedUser(number + "@s.whatsapp.net");

      await sock.sendMessage(jid, {
        text: "Your bot is now connected 🔥\nAuto View + React enabled."
      });
    }
  });
});

app.listen(PORT, () => console.log(`Server running on ${PORT}`));
