const express = require('express');
const router = express.Router();
const Stage = require('../models/Stage');

// إضافة مرحلة جديدة
router.post('/', async (req, res) => {
  try {
    const stage = new Stage(req.body);
    await stage.save();
    res.status(201).json(stage);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// عرض جميع المراحل مرتبة
router.get('/', async (req, res) => {
  try {
    const stages = await Stage.find().sort({ order: 1 });
    res.json(stages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// تعديل مرحلة
router.put('/:id', async (req, res) => {
  try {
    const stage = await Stage.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(stage);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// حذف مرحلة
router.delete('/:id', async (req, res) => {
  try {
    await Stage.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// تحديث ترتيب المراحل (Drag & Drop)
router.put('/reorder', async (req, res) => {
  try {
    const { orderedIds } = req.body; // مصفوفة مرتبة من _id الجديد
    for (let i = 0; i < orderedIds.length; i++) {
      await Stage.findByIdAndUpdate(orderedIds[i], { order: i + 1 });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
