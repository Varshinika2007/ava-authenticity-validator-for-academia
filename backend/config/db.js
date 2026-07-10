const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/authenticity_validator', {
      serverSelectionTimeoutMS: 3000
    });
    console.log(`[Database] MongoDB Connected: ${conn.connection.host}`);
    process.env.DB_OFFLINE = 'false';
  } catch (error) {
    console.error(`[Database Warning] MongoDB connection failed: ${error.message}`);
    console.warn(`[Database Alert] Starting application in OFFLINE DEMO MODE.`);
    console.warn(`[Database Alert] Data will be stored in-memory (it will reset when server restarts).`);
    process.env.DB_OFFLINE = 'true';
  }
};

module.exports = connectDB;
