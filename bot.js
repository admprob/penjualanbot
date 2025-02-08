const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason, delay } = require("@whiskeysockets/baileys");
const { google } = require("googleapis");
require("dotenv").config();
const axios = require("axios");

const sheets = google.sheets({ version: "v4", auth: process.env.GOOGLE_API_KEY });
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SHEET_NAME = "Sheet1";

async function getSheetData() {
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_NAME}!A:AH`, // ✅ Perbaikan error string interpolation
        });
        console.log("📊 Data Google Sheets berhasil diambil:", response.data.values); // Debugging
        return response.data.values || [];
    } catch (error) {
        console.error("❌ Error fetching data:", error);
        return [];
    }
}

// Fungsi untuk mencari barang berdasarkan ID atau kode
async function CariBarangDariIDSheet(kode) {
    const dataBarang = await getSheetData();
    if (!dataBarang || dataBarang.length === 0) return "❌ Data tidak ditemukan.";

    const kodeDicari = kode.trim().toLowerCase();

    for (let row of dataBarang) {
        if (row[0] && row[0].trim().toLowerCase() === kodeDicari) {
            return `📦 Kode: ${row[0]}
🏢 Sales: ${row[3]}
📅 Update Data: ${row[4]}

==== PERFORMAN SA ====
🎯 Target SA: ${row[5]}
📊 QTY SA M1: ${row[7]}
📊 QTY SA M: ${row[8]}
⚡ GAP QTY: ${row[9]}
📈 MoM QTY SA: ${row[10]}
🎯 QTY TO TARGET: ${row[11]}

==== OUTLET AKTIF SA ====
🏬 OA SA M1: ${row[12]}
🏬 OA SA M: ${row[13]}
⚡ GAP OA: ${row[14]}
📈 MoM OA: ${row[15]}
✅ ACH OA: ${row[16]}

==== OMSET SA ====
💰 OMSET SA M1: ${row[17]}
💰 OMSET SA M: ${row[18]}
⚡ GAP OMSET: ${row[19]}
📈 MOM OMSET: ${row[20]}

==== PERFORMAN VF ====
🎯 Target VF: ${row[6]}
📊 QTY VF M1: ${row[21]}
📊 QTY VF M: ${row[22]}
⚡ GAP QTY: ${row[23]}
📈 MoM QTY VF: ${row[24]}
🎯 QTY TO TARGET: ${row[25]}

==== OUTLET AKTIF VF ====
🏬 OA VF M1: ${row[26]}
🏬 OA VF M: ${row[27]}
⚡ GAP OA: ${row[28]}
📈 MoM OA: ${row[29]}
✅ ACH OA: ${row[30]}

==== OMSET VF ====
💰 OMSET VF M1: ${row[31]}
💰 OMSET VF M: ${row[32]}
⚡ GAP OMSET: ${row[33]}
📈 MOM OMSET: ${row[34]}

==== REVENUE ====
💰 REV M1: ${row[35]}
💰 REV M: ${row[36]}
📉 GAP REV: ${row[37]}

📦 Total Order: ${row[24]}
📌 Stock Tersedia: ${row[36]}`;
        }
    }
    return `❌ Kode "${kode}" tidak ditemukan di ${SHEET_NAME}.`; // ✅ Perbaikan string template
}

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState("auth_info");
    const { version } = await fetchLatestBaileysVersion();

    async function connectToWhatsApp() {
        const sock = makeWASocket({ auth: state, version });

        sock.ev.on("creds.update", saveCreds);
        sock.ev.on("connection.update", async (update) => {
            const { connection, lastDisconnect } = update;
            if (connection === "close") {
                const reason = lastDisconnect?.error?.output?.statusCode;
                if (reason === DisconnectReason.loggedOut) {
                    console.log("Akun logout! Silakan login ulang.");
                } else {
                    console.log("Koneksi terputus, mencoba reconnect...");
                    await delay(5000);
                    connectToWhatsApp();
                }
            } else if (connection === "open") {
                console.log("✅ Bot terhubung ke WhatsApp!");
            }
        });

        sock.ev.on("messages.upsert", async ({ messages }) => {
            const msg = messages[0];
            console.log("📩 Pesan diterima:", msg);

            if (!msg.message || msg.key.fromMe) return;

            const text =
                msg.message.conversation ||
                msg.message.extendedTextMessage?.text ||
                msg.message.imageMessage?.caption ||
                msg.message.videoMessage?.caption ||
                msg.message.documentMessage?.caption ||
                "".trim();

            console.log("🔍 Mencari kode:", text);

            if (!/^C\.\w+/.test(text)) return;

            const isGroup = msg.key.remoteJid.endsWith("@g.us");
            if (isGroup) {
                try {
                    const groupMeta = await sock.groupMetadata(msg.key.remoteJid);
                    const isUserInGroup = groupMeta.participants.some(p => 
                        p.id.split("@")[0] === sock.user.id.split(":")[0].split("@")[0]
                    );

                    if (!isUserInGroup) return;
                } catch (error) {
                    console.log("❌ Gagal mendapatkan info grup:", error);
                    return;
                }
            }

            const result = await CariBarangDariIDSheet(text);
            console.log("📊 Hasil Pencarian:", result);
            await sock.sendMessage(msg.key.remoteJid, { text: result });
        });

        return sock;
    }

    await connectToWhatsApp();
}

startBot();
