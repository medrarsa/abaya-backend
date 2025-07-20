// backend/routes/abayaModelRoutes.js
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
    res.json(abayaModels);
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

module.exports = router;
