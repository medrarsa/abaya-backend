// backend/models/Customer.js

const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  name:       { type: String, required: true },
  phone:      { type: String, required: true, unique: true },
  city:       { type: String },
  notes:      { type: String },
  createdAt:  { type: Date, default: Date.now }
});

module.exports = mongoose.model('Customer', customerSchema);
