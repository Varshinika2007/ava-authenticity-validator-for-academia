const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

// Load environment variables
dotenv.config();

// Initialize Express
const app = express();

// Connect to Database
connectDB();

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Define routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/validate', require('./routes/validate'));

// Serve Frontend Static Files
app.use(express.static(path.join(__dirname, '../frontend')));

// Fallback to landing page for undefined routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`[Server] Authenticity Validator for Academia running`);
  console.log(`[Server] Local URL: http://localhost:${PORT}`);
  console.log(`==================================================`);
});
