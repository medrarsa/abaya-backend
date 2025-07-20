const express = require('express');
const router = express.Router();
const Fabric = require('../models/Fabric');
const FabricLog = require('../models/FabricLog');

// إضافة قماش جديد
router.post('/', async (req, res) => {
  try {
    const fabric = new Fabric(req.body);
    await fabric.save();
    res.status(201).json(fabric);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: 'كود القماش مضاف من قبل!' });
    }
    res.status(400).json({ error: err.message });
  }
});

// جلب كل الأقمشة
router.get('/', async (req, res) => {
  try {
    const fabrics = await Fabric.find();
    res.json(fabrics);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// إضافة كمية للمخزون مع اسم المستخدم نصي
router.post('/add-stock/:id', async (req, res) => {
  try {
    const { qty, note, cost, employeeUsername } = req.body;

    const fabric = await Fabric.findById(req.params.id);
    if (!fabric) {
      return res.status(404).json({ error: 'القماش غير موجود.' });
    }
    fabric.currentStock += Number(qty);
    if (cost) fabric.unitPrice = Number(cost);
    await fabric.save();

    await FabricLog.create({
      fabric: fabric._id,
      type: 'in',
      qty: Number(qty),
      employeeUsername, // نص صريح
      note: note || 'إدخال يدوي',
      cost: Number(cost) || undefined
    });

    res.json(fabric);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// جلب الأقمشة تحت الحد الأدنى للمخزون
router.get('/low-stock', async (req, res) => {
  try {
    const fabrics = await Fabric.find({
      $expr: { $lt: ["$currentStock", "$minAlert"] }
    });
    res.json(fabrics);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// تقرير المخزون مع اسم الصنف
router.get('/report/stock', async (req, res) => {
  try {
    const { start, end, fabricId } = req.query;
    const startDate = new Date(start);
    let endDate = new Date(end);
    endDate.setDate(endDate.getDate() + 1);

    const filter = {
      createdAt: { $gte: startDate, $lt: endDate }
    };
    if (fabricId && fabricId !== "all") filter.fabric = fabricId;

    // هنا أهم شي: populate لجلب اسم ورمز الصنف
    const logs = await FabricLog.find(filter)
      .populate({ path: "fabric", select: "name code" })
      .sort({ createdAt: -1 });

    let inQty = 0, inValue = 0, outQty = 0, outValue = 0;
    logs.forEach(log => {
      if (log.type === "in") {
        inQty += Number(log.qty);
        inValue += Number(log.qty) * Number(log.cost || 0);
      }
      if (log.type === "out") {
        outQty += Number(log.qty);
        outValue += Number(log.qty) * Number(log.cost || 0);
      }
    });

    let stockNow = 0;
    if (fabricId && fabricId !== "all") {
      const fabric = await Fabric.findById(fabricId);
      stockNow = fabric ? fabric.currentStock : 0;
    } else {
      const allFabrics = await Fabric.find();
      stockNow = allFabrics.reduce((sum, f) => sum + f.currentStock, 0);
    }

    res.json({
      inQty,
      inValue,
      outQty,
      outValue,
      balanceQty: inQty - outQty,
      balanceValue: inValue - outValue,
      currentStock: stockNow,
      logs // أرجع جميع العمليات (مع اسم الصنف)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// سجل حركة المخزون لقماش معيّن
 

// backend/routes/fabricRoutes.js
// سجل حركة المخزون لقماش معيّن مع دعم الفلترة بالتاريخ
router.get('/log/:id', async (req, res) => {
  try {
    const { from, to } = req.query;
    let filter = { fabric: req.params.id };
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to)   filter.createdAt.$lte = new Date(to + "T23:59:59");
      // إذا لم يُدخل تاريخ، لا ترسل فلتر فاضي
      if (Object.keys(filter.createdAt).length === 0) delete filter.createdAt;
    }
    const logs = await FabricLog.find(filter)
      .populate({ path: "fabric", select: "name code" })
      .sort({ createdAt: -1 });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
;

// أرشفة القماش (لا يحذف - فقط archived: true)
router.put('/archive/:id', async (req, res) => {
  try {
    const fabric = await Fabric.findByIdAndUpdate(req.params.id, { archived: true }, { new: true });
    if (!fabric) return res.status(404).json({ error: "القماش غير موجود." });
    res.json({ message: "تمت الأرشفة بنجاح.", fabric });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// استرجاع القماش المؤرشف (archived: false)
router.put('/restore/:id', async (req, res) => {
  try {
    const fabric = await Fabric.findByIdAndUpdate(req.params.id, { archived: false }, { new: true });
    if (!fabric) return res.status(404).json({ error: "القماش غير موجود." });
    res.json({ message: "تم الاسترجاع بنجاح.", fabric });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


module.exports = router;
