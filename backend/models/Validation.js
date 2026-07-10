const mongoose = require('mongoose');

const ValidationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  textLength: {
    type: Number,
    required: true
  },
  plagiarismScore: {
    type: Number,
    required: true
  },
  aiScore: {
    type: Number,
    required: true
  },
  citationScore: {
    type: Number,
    required: true
  },
  overallScore: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    required: true,
    enum: ['Verified', 'Caution', 'Critical']
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const RealValidationModel = mongoose.model('Validation', ValidationSchema);

// In-Memory Fallback
const mockValidations = [];

class MockValidation {
  constructor(data) {
    this._id = 'val_' + Math.random().toString(36).substring(2, 11);
    this.userId = data.userId;
    this.title = data.title;
    this.textLength = data.textLength;
    this.plagiarismScore = data.plagiarismScore;
    this.aiScore = data.aiScore;
    this.citationScore = data.citationScore;
    this.overallScore = data.overallScore;
    this.status = data.status;
    this.createdAt = new Date();
  }

  async save() {
    mockValidations.push(this);
    return this;
  }
}

MockValidation.find = async (query) => {
  let results = [...mockValidations];
  if (query && query.userId) {
    results = results.filter(v => v.userId === query.userId);
  }
  results.sort((a, b) => b.createdAt - a.createdAt);
  return results;
};

MockValidation.findById = async (id) => {
  return mockValidations.find(v => v._id === id) || null;
};

MockValidation.findOneAndDelete = async (query) => {
  const idx = mockValidations.findIndex(v => v._id === query._id && v.userId === query.userId);
  if (idx !== -1) {
    return mockValidations.splice(idx, 1)[0];
  }
  return null;
};

// Proxy to switch dynamically based on environment configuration
const ValidationProxy = new Proxy(function() {}, {
  get(target, prop) {
    const activeModel = process.env.DB_OFFLINE === 'true' ? MockValidation : RealValidationModel;
    return activeModel[prop];
  },
  construct(target, args) {
    const activeModel = process.env.DB_OFFLINE === 'true' ? MockValidation : RealValidationModel;
    return new activeModel(...args);
  }
});

module.exports = ValidationProxy;
