// single-merged-server.js
// One Express server, one port, three isolated DBs with separate routes

import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';

dotenv.config();

const PORT = process.env.PORT || 4000; // only one port now

// --- Mongo URIs ---
const MONGO_CAR_URI   = process.env.MONGO_CAR_URI   || 'mongodb://127.0.0.1:27017/carArrivedb';
const MONGO_QR_URI    = process.env.MONGO_QR_URI    || 'mongodb://127.0.0.1:27017/qrscannerdb';
const MONGO_STOCK_URI = process.env.MONGO_STOCK_URI || 'mongodb://127.0.0.1:27017/mydatabase';

const connOptions = { useNewUrlParser: true, useUnifiedTopology: true };

// Create independent connections
const carConn   = mongoose.createConnection(MONGO_CAR_URI, connOptions);
const qrConn    = mongoose.createConnection(MONGO_QR_URI, connOptions);
const stockConn = mongoose.createConnection(MONGO_STOCK_URI, connOptions);

carConn.on('connected', () => console.log(`✅ Car DB connected: ${MONGO_CAR_URI}`));
qrConn.on('connected', () => console.log(`✅ QR DB connected: ${MONGO_QR_URI}`));
stockConn.on('connected', () => console.log(`✅ Stock DB connected: ${MONGO_STOCK_URI}`));

// --- Express app ---
const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

/* ------------------------------
   1) CarArrival Router
   ------------------------------ */
const carArrivalSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  history: Array,
  logs: Array,
}, { timestamps: true });
const CarArrival = carConn.model('CarArrival', carArrivalSchema);

const carRouter = express.Router();

carRouter.get('/', (req, res) => res.send("Hello World! (CarArrival)"));

carRouter.get('/carArrival', async (req, res) => {
  try {
    const data = await CarArrival.find().sort({ timestamp: -1 }).limit(1);
    res.json(data[0] || { history: [], logs: [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

carRouter.post('/carArrival', async (req, res) => {
  try {
    const { history, logs } = req.body;
    if (!Array.isArray(history) || !Array.isArray(logs)) {
      return res.status(400).json({ error: "history and logs must be arrays" });
    }
    if (history.length === 0 && logs.length === 0) {
      return res.status(400).json({ error: "Empty data, not saving" });
    }

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
  } catch (err) {
    res.status(500).json({ error: 'Failed to save data' });
  }
});

app.use('/car', carRouter);

/* ------------------------------
   2) QR Scanner Router
   ------------------------------ */
const scanSchema = new mongoose.Schema({}, { strict: false });
const Scan = qrConn.model('Scan', scanSchema);

const qrRouter = express.Router();

qrRouter.get('/', (req, res) => res.send("QR Scanner API is running!"));

qrRouter.post('/scans', async (req, res) => {
  try {
    const data = req.body;
    if (!data || Object.keys(data).length === 0) {
      return res.status(400).json({ message: "No data received" });
    }
    const scan = new Scan(data);
    await scan.save();
    res.status(201).json({ message: "Data saved to MongoDB", data: scan });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

qrRouter.get('/scans', async (req, res) => {
  try {
    const scans = await Scan.find().sort({ _id: -1 });
    res.json(scans);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

app.use('/qr', qrRouter);

/* ------------------------------
   3) Stock Router
   ------------------------------ */
const stockSchema = new mongoose.Schema({
  LastUpdate: String,
  Date: String,          // "yyyy-mm-dd"
  Type: String,
  Bags: Number,
  Weight: Number,
  CarNo: String,
  PartyName: String,
  UnloaderName: String,
});
const Stock = stockConn.model('Stock', stockSchema);

const stockRouter = express.Router();

stockRouter.get('/all', async (req, res) => {
  try {
    const stocks = await Stock.find().sort({ Date: -1 });
    res.json(stocks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

stockRouter.get('/daily', async (req, res) => {
  try {
    const stocks = await Stock.find();
    const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const dailyTotals = {};
    weekDays.forEach(day => dailyTotals[day] = 0);

    stocks.forEach((stock) => {
      const day = new Date(stock.Date).toLocaleDateString("en-US", { weekday: "short" });
      if (dailyTotals[day] !== undefined) {
        dailyTotals[day] += stock.Weight || 60; // default 60kg per entry
      }
    });

    const result = weekDays.map(day => ({ day, volume: dailyTotals[day] }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

stockRouter.post('/', async (req, res) => {
  try {
    const stock = new Stock(req.body);
    await stock.save();
    res.status(201).json(stock);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.use('/stock', stockRouter);

/* ------------------------------
   Start Server
   ------------------------------ */
app.listen(PORT, () => {
  console.log(`🚀 Unified server running on http://localhost:${PORT}`);
});
