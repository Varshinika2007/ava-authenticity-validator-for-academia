const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const RealUserModel = mongoose.model('User', UserSchema);

// In-Memory Fallback
const mockUsers = [];

class MockUser {
  constructor(data) {
    this._id = 'user_' + Math.random().toString(36).substring(2, 11);
    this.username = data.username;
    this.email = data.email ? data.email.toLowerCase() : '';
    this.password = data.password;
    this.createdAt = new Date();
  }

  async save() {
    const emailExists = mockUsers.some(u => u.email === this.email);
    if (emailExists) {
      const err = new Error('Email already registered');
      err.code = 11000;
      throw err;
    }
    const userExists = mockUsers.some(u => u.username.toLowerCase() === this.username.toLowerCase());
    if (userExists) {
      const err = new Error('Username already taken');
      err.code = 11000;
      throw err;
    }
    mockUsers.push(this);
    return this;
  }
}

MockUser.findOne = async (query) => {
  if (query.email) {
    const emailToFind = typeof query.email === 'string' ? query.email.toLowerCase() : (query.email.$regex ? new RegExp(query.email.$regex, 'i') : '');
    if (emailToFind instanceof RegExp) {
      return mockUsers.find(u => emailToFind.test(u.email)) || null;
    }
    return mockUsers.find(u => u.email === emailToFind) || null;
  }
  if (query.username) {
    const userToFind = typeof query.username === 'string' ? query.username.toLowerCase() : '';
    return mockUsers.find(u => u.username.toLowerCase() === userToFind) || null;
  }
  return null;
};

MockUser.findById = async (id) => {
  return mockUsers.find(u => u._id === id) || null;
};

// Proxy to switch dynamically based on environment configuration
const UserProxy = new Proxy(function() {}, {
  get(target, prop) {
    const activeModel = process.env.DB_OFFLINE === 'true' ? MockUser : RealUserModel;
    return activeModel[prop];
  },
  construct(target, args) {
    const activeModel = process.env.DB_OFFLINE === 'true' ? MockUser : RealUserModel;
    return new activeModel(...args);
  }
});

module.exports = UserProxy;
