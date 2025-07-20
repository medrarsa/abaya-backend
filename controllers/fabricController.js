// controllers/fabricController.js
const Fabric = require('../models/Fabric');
const FabricLog = require('../models/FabricLog');

// إضافة مخزون جديد (دخول)
exports.addStock = async (req, res) => {
  try {
    const { fabricId, qty, note, employeeUsername } = req.body; // خذ username من البودي مباشرة

    // تحقق من وجود القماش
    const fabric = await Fabric.findById(fabricId);
    if (!fabric) {
      return res.status(404).json({ message: 'نوع القماش غير موجود' });
    }

    // زيادة الكمية
    fabric.currentStock += Number(qty);
    await fabric.save();

    // تسجيل الحركة في FabricLog
    await FabricLog.create({
      fabric: fabricId,
      type: 'in',
      qty,
      employeeUsername, // نص صريح
      note,
    });

    res.status(200).json({ message: 'تمت إضافة الكمية بنجاح', fabric });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في إضافة المخزون', error: err.message });
  }
};
