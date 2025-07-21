const express = require('express');
const router = express.Router();
const AbayaModel = require('../models/AbayaModel');

// إضافة موديل جديد
router.post('/', async (req, res) => {
  try {
    const abayaModel = new AbayaModel(req.body);
    await abayaModel.save();
    res.status(201).json(abayaModel);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// جلب كل الموديلات
router.get('/', async (req, res) => {
  try {
    const abayaModels = await AbayaModel.find();
    // خليه يرجع { models: [] } عشان الفرونت يفهمه على طول
    res.json({ models: abayaModels });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// رفع موديلات متعددة (Bulk Upload)
router.post('/bulk-upload', async (req, res) => {
  try {
    const models = req.body.models;
    if (!Array.isArray(models) || models.length === 0)
      return res.status(400).json({ error: "لم يتم إرسال أي موديلات." });

    await AbayaModel.insertMany(models);
    res.json({ status: "تم رفع كل الموديلات!", count: models.length });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// تعديل موديل
router.put('/:id', async (req, res) => {
  try {
    const abayaModel = await AbayaModel.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!abayaModel)
      return res.status(404).json({ error: "الموديل غير موجود." });
    res.json(abayaModel);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// حذف موديل
router.delete('/:id', async (req, res) => {
  try {
    const abayaModel = await AbayaModel.findByIdAndDelete(req.params.id);
    if (!abayaModel)
      return res.status(404).json({ error: "الموديل غير موجود." });
    res.json({ status: "تم حذف الموديل." });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
