import express from "express";
import {
    makeWASocket,
    useMultiFileAuthState,
    makeCacheableSignalKeyStore,
    delay
} from "@whiskeysockets/baileys";
import pino from "pino";

const app = express();

app.get("/", (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>WhatsApp Pairing Code</title>
<style>
body { background: #111b21; font-family: Arial, sans-serif; margin:0; }
.container { height: 100vh; display: flex; justify-content: center; align-items: center; }
.box { background: #202c33; width: 380px; padding: 25px; border-radius: 12px; box-shadow: 0 0 12px rgba(0,0,0,0.3); }
.title { text-align: center; font-size: 22px; color: #00a884; margin-bottom: 15px; }
.input-area { display: flex; flex-direction: column; gap: 12px; }
input { padding: 14px; border: none; background: #2a3942; color: white; border-radius: 8px; font-size: 16px; }
button { padding: 13px; border: none; background: #00a884; color: white; font-size: 17px; border-radius: 8px; cursor: pointer; }
button:hover { background: #029f7e; }
.result { margin-top: 20px; background: #2a3942; padding: 14px; border-radius: 8px; text-align: center; color: #dce1e3; }
.code { font-size: 30px; font-weight: bold; color: #00ff9d; letter-spacing: 3px; }
</style>
</head>
<body>
<div class="container">
<div class="box">
<h2 class="title">WhatsApp Pairing Code</h2>
<div class="input-area">
<input id="number" placeholder="Enter phone e.g 254712345678" />
<button onclick="generateCode()">Generate Code</button>
</div>
<div id="result" class="result">Your pairing code will appear here...</div>
</div>
</div>
<script>
async function generateCode() {
    const number = document.getElementById("number").value;
    if (!number) { alert("Enter a phone number first."); return; }
    document.getElementById("result").innerHTML = "Generating...";
    const res = await fetch("/pair?number=" + number);
    const data = await res.json();
    if (data.code) {
        document.getElementById("result").innerHTML = "<div class='code'>" + data.code + "</div>";
    } else {
        document.getElementById("result").innerHTML = "❌ Error: " + (data.error || "Unknown");
    }
}
</script>
</body>
</html>`);
});

app.get("/pair", async (req, res) => {
    let number = req.query.number;
    if (!number) return res.json({ error: "Missing number" });

    number = number.replace(/[^0-9]/g, "");
    const sessionDir = `./session-${number}`;

    try {
        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
        const logger = pino({ level: "silent" });

        const sock = makeWASocket({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, logger),
            },
            logger,
            printQRInTerminal: false,
            browser: ["Ubuntu", "Chrome", "20.0.04"],
        });

        await delay(2000);
        const code = await sock.requestPairingCode(number);

        sock.ev.on("creds.update", saveCreds);

        res.json({ code });
    } catch (e) {
        console.error(e);
        res.json({ error: "Pairing failed" });
    }
});

app.listen(10000, () => console.log("Server running on http://localhost:10000"));
