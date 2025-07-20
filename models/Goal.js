const mongoose = require('mongoose');
const goalSchema = new mongoose.Schema({
  year: { type: Number, required: true },
  month: { type: Number, required: true },
  value: { type: Number, required: true }  // <-- لازم يكون هنا
});
module.exports = mongoose.model('Goal', goalSchema);
