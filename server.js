// ===== ALSAQQAF LOGISTICS LLC SERVER (Render Safe Version) =====
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import session from "express-session";
import PDFDocument from "pdfkit";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;
const ADMIN_USER = process.env.ADMIN_USER || "admin@alsaqqaf";
const ADMIN_PASS = process.env.ADMIN_PASS || "change_me";

// =================== SAFE DATA PATHS ===================
// Render free plan cannot use /data without a disk.
// We'll use /tmp which is always writable.
const DATA_DIR = process.env.DATA_DIR || "/tmp";
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

const DATA_FILE = path.join(DATA_DIR, "applications.json");
const PDF_DIR = path.join(__dirname, "pdf");
if (!fs.existsSync(PDF_DIR)) fs.mkdirSync(PDF_DIR);

// =================== MIDDLEWARE ===================
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "super-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 12 },
  })
);

// =================== HELPERS ===================
function readApps() {
  try {
    if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, "[]");
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    return JSON.parse(raw || "[]");
  } catch (err) {
    console.error("❌ Error reading apps:", err);
    return [];
  }
}

function writeApps(apps) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(apps, null, 2));
    console.log("✅ Applications saved to", DATA_FILE);
  } catch (err) {
    console.error("❌ Error writing apps:", err);
  }
}

// =================== STATIC FILES ===================
app.use(express.static(__dirname));
app.use("/pdf", express.static(PDF_DIR));

// =================== PAGES ===================
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));
app.get("/login", (req, res) => res.sendFile(path.join(__dirname, "login.html")));
app.get("/admin", (req, res) => res.sendFile(path.join(__dirname, "admin.html")));

// =================== API: SUBMIT APPLICATION ===================
app.post("/api/applications", (req, res) => {
  try {
    const payload = req.body || {};
    const id = uuidv4().slice(0, 8);
    const submittedAt = new Date().toISOString();
    const record = { id, status: "pending", submittedAt, ...payload };

    const apps = readApps();
    apps.push(record);
    writeApps(apps);

    // ===== PDF CREATION =====
    const pdfPath = path.join(PDF_DIR, `${id}.pdf`);
    const doc = new PDFDocument({ size: "LETTER", margin: 50 });
    const stream = fs.createWriteStream(pdfPath);
    doc.pipe(stream);

    doc.fontSize(18).text("ALSAQQAF LOGISTICS LLC", { align: "center" });
    doc.moveDown().fontSize(12);
    doc.text(`Application ID: ${id}`);
    doc.text(`Submitted: ${new Date(submittedAt).toLocaleString()}`);
    doc.text(`Name: ${payload.firstName || ""} ${payload.lastName || ""}`);
    doc.text(`Email: ${payload.email || ""}`);
    doc.text(`Phone: ${payload.phone || ""}`);
    doc.text(`CDL: ${payload.cdlClass || ""}`);
    doc.text(`Experience: ${payload.yearsExperience || ""}`);
    doc.text(`Address: ${payload.currentAddress || ""}, ${payload.currentCity || ""}, ${payload.currentState || ""}`);
    doc.text(`ZIP: ${payload.currentZip || ""}`);
    doc.end();

    stream.on("finish", () => {
      console.log("✅ PDF generated:", pdfPath);
      res.json({ ok: true, id, pdfUrl: `/pdf/${id}.pdf` });
    });
  } catch (err) {
    console.error("❌ Error saving application:", err);
    res.status(500).json({ ok: false, message: "Failed to save application." });
  }
});

// =================== API: GET APPLICATIONS ===================
app.get("/api/applications", (req, res) => {
  const apps = readApps();
  res.json(apps);
});

// =================== API: SIMPLE STATS ===================
app.get("/api/stats", (req, res) => {
  const apps = readApps();
  const total = apps.length;
  const pending = apps.filter(a => a.status === "pending").length;
  const approved = apps.filter(a => a.status === "approved").length;
  const rejected = apps.filter(a => a.status === "rejected").length;

  const now = new Date();
  const thisMonth = apps.filter(a => {
    const d = new Date(a.submittedAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  res.json({ total, pending, approved, rejected, thisMonth });
});

// =================== DEBUG ===================
app.get("/api/ping", (req, res) => res.json({ ok: true, count: readApps().length }));

// =================== FALLBACK ===================
app.use((req, res) => res.status(404).send("Not found"));

// =================== START SERVER ===================
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`✅ Data file path: ${DATA_FILE}`);
});
