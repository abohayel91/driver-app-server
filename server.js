
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
const PORT = process.env.PORT || 3000;
const ADMIN_USER = process.env.ADMIN_USER || "admin@alsaqqaf";
const ADMIN_PASS = process.env.ADMIN_PASS || "change_me";

// Allow CORS for driver-site if cross-origin
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || "super-secret-key",
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 12 } // 12 hours
}));

const DATA_FILE = path.join(__dirname, "applications.json");
const PDF_DIR = path.join(__dirname, "pdf");
if (!fs.existsSync(PDF_DIR)) fs.mkdirSync(PDF_DIR);

function readApps() {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    return JSON.parse(raw || "[]");
  } catch {
    return [];
  }
}
function writeApps(apps) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(apps, null, 2));
}

// Auth helpers
function requireAuth(req, res, next) {
  if (req.session?.user === ADMIN_USER) return next();
  return res.status(401).send("Unauthorized");
}

// Static assets
app.use("/public", express.static(path.join(__dirname, "public")));
app.use("/pdf", express.static(PDF_DIR));

// Serve driver app at /
app.use("/", express.static(path.join(__dirname, "driver-app")));

// Serve admin (protected) — redirect to login if not authed
app.get("/admin", (req, res) => {
  if (req.session?.user === ADMIN_USER) {
    res.sendFile(path.join(__dirname, "admin-app", "index.html"));
  } else {
    res.redirect("/login.html");
  }
});

// Simple login (POST /admin/login from login.html)
app.post("/admin/login", (req, res) => {
  const { username, password } = req.body || {};
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    req.session.user = ADMIN_USER;
    return res.redirect("/admin");
  }
  return res.status(401).send("Invalid credentials");
});

// API: Create application (public endpoint for driver site)
app.post("/api/applications", (req, res) => {
  const payload = req.body || {};
  const id = uuidv4().slice(0, 8);
  const submittedAt = new Date().toISOString();
  const record = { id, status: "pending", submittedAt, ...payload };

  const apps = readApps();
  apps.push(record);
  writeApps(apps);

  // Generate PDF
  const pdfPath = path.join(PDF_DIR, `${id}.pdf`);
  const doc = new PDFDocument({ size: "LETTER", margin: 50 });
  const stream = fs.createWriteStream(pdfPath);
  doc.pipe(stream);

  // Header with company name
  doc
    .fontSize(20)
    .fillColor("#0f172a")
    .text("ALSAQQAF LOGISTICS LLC", { align: "center" })
    .moveDown(0.3);
  doc
    .fontSize(14)
    .fillColor("#1f2937")
    .text("Driver Application (Submission Receipt)", { align: "center" })
    .moveDown(1);

  // Applicant summary
  function field(label, value) {
    doc.fontSize(11).fillColor("#111827").text(label + ": ", { continued: true }).fillColor("#374151").text(String(value ?? "—"));
  }

  const name = [record.firstName, record.lastName].filter(Boolean).join(" ") || record.name || "—";
  field("Application ID", id);
  field("Submitted At", new Date(submittedAt).toLocaleString());
  field("Applicant Name", name);
  field("Email", record.email);
  field("Phone", record.phone || record.phoneNumber);

  doc.moveDown(0.5).fontSize(12).text("Selected Fields:", { underline: true }).moveDown(0.3);
  const keysToShow = ["dateOfBirth","ssn","currentAddress","currentCity","currentState","currentZip","cdlClass","yearsExperience","workSchedule"];
  keysToShow.forEach(k => {
    if (record[k] !== undefined) field(k, record[k]);
  });

  doc.moveDown(1).fontSize(10).fillColor("#6b7280")
    .text("This PDF is auto-generated. Keep for your records. ALSAQQAF LOGISTICS LLC.", { align: "center" });

  doc.end();

  stream.on("finish", () => {
    const pdfUrl = `/pdf/${id}.pdf`;
    res.json({ ok: true, id, pdfUrl });
  });
});

// API: list applications (protected)
app.get("/api/applications", requireAuth, (req, res) => {
  const apps = readApps();
  res.json(apps);
});

// API: fetch single PDF (protected by static /pdf if needed; keep open for direct link)
app.get("/api/applications/:id/pdf", requireAuth, (req, res) => {
  const id = req.params.id;
  const pdfPath = path.join(PDF_DIR, `${id}.pdf`);
  if (fs.existsSync(pdfPath)) return res.sendFile(pdfPath);
  return res.status(404).send("Not found");
});

// API: basic stats (protected)
app.get("/api/stats", requireAuth, (req, res) => {
  const apps = readApps();
  const total = apps.length;
  const pending = apps.filter(a => (a.status || "pending") === "pending").length;
  const approved = apps.filter(a => a.status === "approved").length;
  const activeDrivers = apps.filter(a => a.status === "approved").length;

  // Simple derived metrics
  const now = new Date();
  const thisMonth = apps.filter(a => {
    const d = new Date(a.submittedAt || a._submittedAt || a.createdAt || 0);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  const approvalRate = total ? Math.round((approved / total) * 100) : 0;
  const avgProcessingDays = 3; // placeholder until you track status timestamps
  const conversionRate = approvalRate; // simplistic

  res.json({ total, pending, approved, activeDrivers, thisMonth, approvalRate, avgProcessingDays, conversionRate });
});

// Fallback
app.use((req, res) => res.status(404).send("Not found"));

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
