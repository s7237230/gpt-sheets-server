const express = require("express");
const { google } = require("googleapis");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json());
app.use(cors());

// ✅ בדיקת API KEY לפי משתנה סביבה
const API_KEY = process.env.API_KEY || "my-secret-api-key"; // ברירת מחדל למקרה מקומי

app.use((req, res, next) => {
  const sentKey = req.header("x-api-key");
  if (!sentKey || sentKey !== API_KEY) {
    return res.status(401).json({ success: false, message: "Unauthorized: Invalid API Key" });
  }
  next();
});

// ✅ התחברות ל-Google Sheets
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(fs.readFileSync("credentials.json", "utf8")),
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const spreadsheetId = "1Y46tOYYvsPdHVJdxYrgFTJc8X3-HWcmjgVqyQaiCnrM";
const sheetName = "DB MASTER";

async function getSheetClient() {
  const client = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: client });
  return sheets;
}

// ✅ Insert
app.post("/insert", async (req, res) => {
  try {
    const { row_data } = req.body;
    const sheets = await getSheetClient();
    const values = Object.values(row_data);
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!A:I`,
      valueInputOption: "RAW",
      requestBody: { values: [values] },
    });
    res.status(200).send({ success: true });
  } catch (err) {
    console.error("Insert error:", err.message);
    res.status(500).send({ success: false, error: err.message });
  }
});

// ✅ Update
app.post("/update", async (req, res) => {
  try {
    const { filter, row_data } = req.body;
    const sheets = await getSheetClient();
    const { data } = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A2:I`,
    });
    const values = data.values || [];
    const rowIndex = values.findIndex((row) => row[0] === filter["1"]);
    if (rowIndex === -1) {
      return res.status(404).send({ success: false, message: "Not found" });
    }
    const newRow = Object.values(row_data);
    const targetRange = `${sheetName}!A${rowIndex + 2}:I${rowIndex + 2}`;
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: targetRange,
      valueInputOption: "RAW",
      requestBody: { values: [newRow] },
    });
    res.status(200).send({ success: true });
  } catch (err) {
    console.error("Update error:", err.message);
    res.status(500).send({ success: false, error: err.message });
  }
});

// ✅ Delete
app.post("/delete", async (req, res) => {
  try {
    const { filter } = req.body;
    const sheets = await getSheetClient();
    const { data } = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A2:I`,
    });
    const values = data.values || [];
    const rowIndex = values.findIndex((row) => row[0] === filter["1"]);
    if (rowIndex === -1) {
      return res.status(404).send({ success: false, message: "Not found" });
    }
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: 0,
                dimension: "ROWS",
                startIndex: rowIndex + 1,
                endIndex: rowIndex + 2,
              },
            },
          },
        ],
      },
    });
    res.status(200).send({ success: true });
  } catch (err) {
    console.error("Delete error:", err.message);
    res.status(500).send({ success: false, error: err.message });
  }
});

// ✅ קבצי פלאגין
app.get("/.well-known/ai-plugin.json", (req, res) => {
  res.sendFile(path.join(__dirname, ".well-known", "ai-plugin.json"));
});

app.get("/.well-known/openapi.yaml", (req, res) => {
  res.sendFile(path.join(__dirname, ".well-known", "openapi.yaml"));
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 Google Sheets API Server running on port ${port}`);
});
