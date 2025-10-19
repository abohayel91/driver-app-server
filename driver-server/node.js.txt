// server.js
import express from "express";
import cors from "cors";
import fs from "fs";

const app = express();
app.use(cors());
app.use(express.json());

const DATA_FILE = "./applications.json";

// Save new driver applications
app.post("/api/applications", (req, res) => {
  const newApp = req.body;
  let data = [];

  if (fs.existsSync(DATA_FILE)) {
    data = JSON.parse(fs.readFileSync(DATA_FILE));
  }

  newApp.id = "APP" + (data.length + 1).toString().padStart(3, "0");
  newApp.date = new Date().toISOString().split("T")[0];
  data.push(newApp);

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  res.json({ success: true, message: "Application saved!" });
});

// Send all applications to the admin page
app.get("/api/applications", (req, res) => {
  if (fs.existsSync(DATA_FILE)) {
    const data = JSON.parse(fs.readFileSync(DATA_FILE));
    res.json(data);
  } else {
    res.json([]);
  }
});

app.listen(5000, () => console.log("✅ Server running on port 5000"));
