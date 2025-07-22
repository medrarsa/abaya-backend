const express = require('express');
const router = express.Router();
const OrderItem = require('../models/OrderItem');
const AbayaModel = require('../models/AbayaModel');
const Fabric = require('../models/Fabric');
const Order = require('../models/Order');
const Customer = require('../models/Customer');

// جلب جميع OrderItems مع الفلترة حسب المجموعة والتاريخ
router.get('/', async (req, res) => {
  try {
    const query = {};
    if (req.query.groupDate) query.groupDate = req.query.groupDate;
    if (req.query.groupNumber) query.groupNumber = req.query.groupNumber;
    // تقدر تضيف فلترة إضافية إذا احتجت
    const items = await OrderItem.find(query);
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// البحث عن قطعة بالباركود (التعديل هنا فقط)
 router.get('/by-barcode/:barcode', async (req, res) => {
  try {
    // 1. جلب القطعة
    const item = await OrderItem.findOne({ barcode: req.params.barcode });
    if (!item) {
      return res.status(404).json({ error: "لم يتم العثور على قطعة بهذا الباركود." });
    }

    // 2. جلب بيانات الطلب
    const order = await Order.findById(item.order);

    // 3. جلب اسم العميل مباشرة (سواء كان نص أو ObjectId)
    let customerName = "-";
    if (order && order.customer) {
      if (typeof order.customer === "string") {
        customerName = order.customer;
      } else {
        // لو كان ObjectId حقيقي
        const customer = await Customer.findById(order.customer);
        if (customer) customerName = customer.name;
      }
    }

    // 4. جلب بيانات الموديل
    let abayaModel = null;
    if (typeof item.model === "string") {
      abayaModel = await AbayaModel.findOne({ code: item.model }) || await AbayaModel.findById(item.model);
    } else {
      abayaModel = await AbayaModel.findById(item.model);
    }

    // 5. جلب بيانات القماش (المخزون)
    let fabric = null;
 if (typeof item.fabric === "string") {
  // إذا الكود أو الاسم
  fabric = await Fabric.findOne({ code: item.fabric }) 
        || await Fabric.findOne({ name: item.fabric }) 
        || (/^[a-f\d]{24}$/i.test(item.fabric) ? await Fabric.findById(item.fabric) : null);
} else {
  fabric = await Fabric.findById(item.fabric);
}

    // 6. تجهيز الرد النهائي
    res.json({
      // بيانات الطلب (order)
      orderNumber: order?.orderNumber || "-",
      customer: customerName,
      orderDate: order?.orderDate || "-",
      city: order?.city || "-",
      groupDate: order?.groupDate || "-",
      groupNumber: order?.groupNumber || "-",

      // بيانات القطعة (orderitem)
      barcode: item.barcode,
      status: item.status,
      size: item.size,
      notes: item.notes,
      fabric: item.fabric,
      model: item.model,

      // بيانات المنتج (abayamodel)
      modelCode: abayaModel?.code || "-",
      modelName: abayaModel?.name || "-",
      imageUrl: abayaModel?.imageUrl || "",
      metersNeeded: abayaModel?.metersNeeded || "-",
      fabricType: abayaModel?.fabricType || "-",
      cutPrice: abayaModel?.cutPrice || "-",
      sewPrice: abayaModel?.sewPrice || "-",
      ironPrice: abayaModel?.ironPrice || "-",
      embPrice: abayaModel?.embPrice || "-",
      buttonPrice: abayaModel?.buttonPrice || "-",
      shipping: abayaModel?.shipping || "-",

      // بيانات المخزون (fabric)
      fabricName: fabric?.name || "-",
      fabricCode: fabric?.code || "-",
      currentStock: fabric?.currentStock || "-",
      minAlert: fabric?.minAlert || "-",
      unitPrice: fabric?.unitPrice || "-",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// تحديث قطعة (Edit قطعة)
router.patch('/:id', async (req, res) => {
  try {
    const item = await OrderItem.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// حذف قطعة (Delete قطعة)
router.delete('/:id', async (req, res) => {
  try {
    await OrderItem.findByIdAndDelete(req.params.id);
    res.json({ status: "تم الحذف" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// حذف جميع الطلبات لمجموعة معيّنة
// DELETE /api/orderitems/group-delete?groupDate=YYYY-MM-DD&groupNumber=1
router.delete('/group-delete', async (req, res) => {
  try {
    const { groupDate, groupNumber } = req.query;
    await OrderItem.deleteMany({ groupDate, groupNumber });
    res.json({ status: "تم حذف جميع الطلبات" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

 // backend/routes/orderItemRoutes.js

 router.get('/new', async (req, res) => {
  try {
    const { from, to } = req.query;
    let match = {};

    if (from || to) {
      match.createdAt = {};
      if (from) match.createdAt.$gte = new Date(from);
      if (to) match.createdAt.$lte = new Date(to + "T23:59:59");
    }

    const items = await OrderItem.aggregate([
      { $match: match },
      {
        $lookup: {
          from: "orderitemsteps",
          localField: "_id",
          foreignField: "orderItem",
          as: "steps"
        }
      },
      { $match: { steps: { $size: 0 } } },
      {
        $lookup: {
          from: "orders",
          localField: "order",
          foreignField: "_id",
          as: "orderData"
        }
      },
      { $unwind: { path: "$orderData", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "customers",
          let: { customerValue: "$orderData.customer" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $eq: ["$_id", "$$customerValue"] },
                    { $eq: ["$name", "$$customerValue"] }
                  ]
                }
              }
            }
          ],
          as: "customerData"
        }
      },
      { $unwind: { path: "$customerData", preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          customerId: "$customerData._id"
        }
      },
      // باقي ال lookups (الموديل، القماش)
      {
        $lookup: {
          from: "abayamodels",
          localField: "model",
          foreignField: "code",
          as: "model"
        }
      },
      { $unwind: { path: "$model", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "fabrics",
          localField: "fabric",
          foreignField: "code",
          as: "fabric"
        }
      },
      { $unwind: { path: "$fabric", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          orderNumber: "$orderData.orderNumber",
          customer: "$orderData.customer",
          customerId: 1,
          city: "$orderData.city",
          groupDate: "$orderData.groupDate",
          groupNumber: "$orderData.groupNumber",
          size: 1,
          fabricName: "$fabric.name",
          fabricType: "$fabric.fabricType",
          metersNeeded: "$model.metersNeeded",
          modelName: "$model.name",
          modelImage: "$model.imageUrl",
          modelCode: "$model.code",
          status: 1,
          notes: 1,
          quantity: 1,
          barcode: 1,
          createdAt: 1,
        }
      }
    ]);
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/orderitems/delete-with-customer/:orderItemId
// حذف الطلب واذا ما بقى طلب لنفس العميل يحذف سجل العميل من orders
router.delete('/delete-with-order/:orderItemId', async (req, res) => {
  try {
    const orderItemId = req.params.orderItemId;

    // 1. جيب الطلبية نفسها
    const item = await OrderItem.findById(orderItemId);
    if (!item) return res.status(404).json({ error: "لم يتم العثور على الطلبية." });

    // 2. احذف الطلبية من orderitems
    await OrderItem.findByIdAndDelete(orderItemId);

    // 3. كم عدد الطلبات الأخرى المرتبطة بنفس الـorder؟
    const count = await OrderItem.countDocuments({ order: item.order });
    if (count === 0) {
      // 4. اذا لم يتبقى طلبات في orderitems لهذا order، نحذف order من orders
      await Order.findByIdAndDelete(item.order);
      return res.json({ message: "تم حذف الطلبية وسجل العميل (order) من orders بنجاح!" });
    }
    res.json({ message: "تم حذف الطلبية فقط. لا يزال يوجد طلبات لنفس العميل." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// حذف جميع القطع للطلب وحذف الطلب نفسه إذا ما بقي قطع
router.delete('/by-order/:orderId', async (req, res) => {
  try {
    // 1. احذف كل القطع لهذا الطلب
    const deleted = await OrderItem.deleteMany({ order: req.params.orderId });

    // 2. تحقق هل بقي قطع للطلب في القاعدة؟
    const count = await OrderItem.countDocuments({ order: req.params.orderId });

    // 3. إذا لا يوجد أي قطع، احذف الطلب نفسه!
    if (count === 0) {
      await require('../models/Order').findByIdAndDelete(req.params.orderId);
      return res.json({ message: "تم حذف جميع القطع والطلب نفسه", deletedCount: deleted.deletedCount });
    }

    res.json({ message: "تم حذف جميع القطع للطلب المحدد", deletedCount: deleted.deletedCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


router.put('/:id', async (req, res) => {
  try {
    const order = await Order.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!order) return res.status(404).json({ error: "الطلب غير موجود" });

    // لو فيه حقول تبي تنسخها للقطع (مثلاً groupDate, groupNumber, city)
    const updateFields = {};
    if (req.body.groupDate) updateFields.groupDate = req.body.groupDate;
    if (req.body.groupNumber) updateFields.groupNumber = req.body.groupNumber;
    if (req.body.city) updateFields.city = req.body.city;

    // عدّل كل القطع التابعة لنفس الطلب
    if (Object.keys(updateFields).length) {
      await OrderItem.updateMany({ order: req.params.id }, { $set: updateFields });
    }

    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


module.exports = router;
