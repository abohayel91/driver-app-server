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

// Middleware
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

// Paths
const DATA_FILE = path.join(__dirname, "applications.json");
const PDF_DIR = path.join(__dirname, "pdf");
if (!fs.existsSync(PDF_DIR)) fs.mkdirSync(PDF_DIR);

// Helpers
function readApps() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8") || "[]");
  } catch {
    return [];
  }
}
function writeApps(apps) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(apps, null, 2));
}

// Auth check
function requireAuth(req, res, next) {
  if (req.session?.user === ADMIN_USER) return next();
  return res.redirect("/login");
}

// Serve all static files (CSS, JS, images, etc.)
app.use(express.static(__dirname));

// === ROUTES ===

// Home (Driver Application)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Login page
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "login.html"));
});

// Login action
app.post("/admin/login", (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    req.session.user = ADMIN_USER;
    return res.redirect("/admin");
  }
  return res.status(401).send("Invalid credentials");
});

// Admin Dashboard (protected)
app.get("/admin", requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "admin.html"));
});

// API: Create Application
app.post("/api/applications", (req, res) => {
  const payload = req.body || {};
  const id = uuidv4().slice(0, 8);
  const submittedAt = new Date().toISOString();
  const record = { id, status: "pending", submittedAt, ...payload };
  const apps = readApps();
  apps.push(record);
  writeApps(apps);

  // Create PDF
  const pdfPath = path.join(PDF_DIR, `${id}.pdf`);
  const doc = new PDFDocument({ size: "LETTER", margin: 50 });
  const stream = fs.createWriteStream(pdfPath);
  doc.pipe(stream);

  doc.fontSize(18).text("ALSAQQAF LOGISTICS LLC", { align: "center" });
  doc.moveDown().fontSize(12).text(`Application ID: ${id}`);
  doc.text(`Submitted At: ${submittedAt}`);
  doc.text(`Name: ${payload.firstName || ""} ${payload.lastName || ""}`);
  doc.text(`Email: ${payload.email || ""}`);
  doc.end();

  stream.on("finish", () => res.json({ ok: true, id, pdfUrl: `/pdf/${id}.pdf` }));
});

// API: Get all applications
app.get("/api/applications", requireAuth, (req, res) => res.json(readApps()));

// API: Stats for dashboard
app.get("/api/stats", requireAuth, (req, res) => {
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

// Serve PDFs
app.use("/pdf", express.static(PDF_DIR));

// Fallback for undefined routes
app.use((req, res) => res.status(404).send("Not found"));

// Start server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
