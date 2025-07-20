const mongoose = require('mongoose');

const stageSchema = new mongoose.Schema({
  name:    { type: String, required: true, unique: true }, // مثال: "قص"
  order:   { type: Number, required: true }, // ترتيب المرحلة: 1،2،3
  jobType: { type: String, required: true } // مثال: "قصاص"
});

module.exports = mongoose.model('Stage', stageSchema);
