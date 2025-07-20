const express = require('express');
const connectDB = require('./config/database');
require('dotenv').config();

const app = express();

// شغل الـ CORS مباشرة بعد تعريف app
const cors = require('cors');
app.use(cors());

// الاتصال بقاعدة البيانات
connectDB();

// يدعم قراءة JSON
app.use(express.json());

// راوت تجربة مؤقت فقط!
app.get('/', (req, res) => {
  res.send('API Working!');
});

// جميع الراوتات تحت هنا:
const employeeRoutes = require('./routes/employeeRoutes');
app.use('/api/employees', employeeRoutes);

const customerRoutes = require('./routes/customerRoutes');
app.use('/api/customers', customerRoutes);

const orderRoutes = require('./routes/orderRoutes');
app.use('/api/orders', orderRoutes);

const abayaModelRoutes = require('./routes/abayaModelRoutes');
app.use('/api/abayamodels', abayaModelRoutes);

const fabricRoutes = require('./routes/fabricRoutes');
app.use('/api/fabrics', fabricRoutes);

const orderItemStepRoutes = require('./routes/orderItemStepRoutes');
app.use('/api/orderitemsteps', orderItemStepRoutes);

const stageRoutes = require('./routes/stageRoutes');
app.use('/api/stages', stageRoutes);

const orderItemRoutes = require('./routes/orderItemRoutes');
app.use('/api/orderitems', orderItemRoutes);

 
app.use('/api/payments', require('./routes/paymentRoutes'));

app.use('/api/dashboard', require('./routes/dashboardRoutes'));

app.use('/api/stage-orders', require('./routes/workshopStageOrdersRoutes'));
app.use('/api/employee-summary', require('./routes/employeeSummaryRoutes'));
app.use('/api/auth', require('./routes/authRoutes'));


// أهم شي لازم فيه listen!
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

 
