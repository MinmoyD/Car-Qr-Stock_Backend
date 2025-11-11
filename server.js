// api/index.js
import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";

dotenv.config();

// --- Mongo URIs ---
const MONGO_CAR_URI =
  process.env.MONGO_CAR_URI || "mongodb://127.0.0.1:27017/carArrivedb";
const MONGO_QR_URI =
  process.env.MONGO_QR_URI || "mongodb://127.0.0.1:27017/qrscannerdb";
const MONGO_STOCK_URI =
  process.env.MONGO_STOCK_URI || "mongodb://127.0.0.1:27017/mydatabase";

const connOptions = { useNewUrlParser: true, useUnifiedTopology: true };

// --- Create separate mongoose connections ---
const carConn = mongoose.createConnection(MONGO_CAR_URI, connOptions);
const qrConn = mongoose.createConnection(MONGO_QR_URI, connOptions);
const stockConn = mongoose.createConnection(MONGO_STOCK_URI, connOptions);

carConn.on("connected", () => console.log(`✅ Car DB connected`));
qrConn.on("connected", () => console.log(`✅ QR DB connected`));
stockConn.on("connected", () => console.log(`✅ Stock DB connected`));

const app = express();
app.use(
  cors({
    origin: "https://paddy-purchase.vercel.app",
    credentials: true,
  })
);
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

/* --------------------------------------------------------
   1) CarArrival Routes
   -------------------------------------------------------- */
const carArrivalSchema = new mongoose.Schema(
  { timestamp: { type: Date, default: Date.now }, history: Array, logs: Array },
  { timestamps: true }
);
const CarArrival = carConn.model("CarArrival", carArrivalSchema);

app.get("/", (req, res) => {
  res.send("✅ Unified Server running on Vercel (Car, QR, Stock)");
});

app.get("/carArrival", async (req, res) => {
  try {
    const data = await CarArrival.find().sort({ timestamp: -1 }).limit(1);
    res.json(data[0] || { history: [], logs: [] });
  } catch {
    res.status(500).json({ error: "Failed to fetch data" });
  }
});

app.post("/carArrival", async (req, res) => {
  try {
    const { history, logs } = req.body;
    if (!Array.isArray(history) || !Array.isArray(logs))
      return res.status(400).json({ error: "history and logs must be arrays" });

    const latest = await CarArrival.findOne().sort({ timestamp: -1 });
    if (latest) {
      latest.history = history;
      latest.logs = logs;
      latest.timestamp = Date.now();
      await latest.save();
    } else {
      await new CarArrival({ history, logs }).save();
    }
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to save data" });
  }
});

/* --------------------------------------------------------
   2) QR Scanner Routes
   -------------------------------------------------------- */
const scanSchema = new mongoose.Schema({}, { strict: false });
const Scan = qrConn.model("Scan", scanSchema);

app.post("/api/scans", async (req, res) => {
  try {
    const data = req.body;
    if (!data || Object.keys(data).length === 0)
      return res.status(400).json({ message: "No data received" });

    const scan = new Scan(data);
    await scan.save();
    res.status(201).json({ message: "Data saved", data: scan });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

app.get("/api/scans", async (req, res) => {
  try {
    const scans = await Scan.find().sort({ _id: -1 });
    res.json(scans);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

/* --------------------------------------------------------
   3) Stock Routes
   -------------------------------------------------------- */
const stockSchema = new mongoose.Schema({
  LastUpdate: String,
  Date: String,
  Type: String,
  Bags: Number,
  Weight: Number,
  CarNo: String,
  PartyName: String,
  UnloaderName: String,
});
const Stock = stockConn.model("Stock", stockSchema);

app.get("/api/stocks/all", async (req, res) => {
  try {
    const stocks = await Stock.find().sort({ Date: -1 });
    res.json(stocks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/stocks/daily", async (req, res) => {
  try {
    const stocks = await Stock.find();
    const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const dailyTotals = Object.fromEntries(weekDays.map((d) => [d, 0]));

    stocks.forEach((stock) => {
      const day = new Date(stock.Date).toLocaleDateString("en-US", {
        weekday: "short",
      });
      if (dailyTotals[day] !== undefined) {
        dailyTotals[day] += stock.Weight || 60;
      }
    });

    const result = weekDays.map((day) => ({ day, volume: dailyTotals[day] }));
    res.json(result);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/stocks", async (req, res) => {
  try {
    const stock = new Stock(req.body);
    await stock.save();
    res.status(201).json(stock);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/* --------------------------------------------------------
   ✅ Export for Vercel
   -------------------------------------------------------- */
export default app;
