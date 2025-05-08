const express = require('express');
const bodyParser = require('body-parser');
const rateLimit = require("express-rate-limit");
const cors = require('cors');
const db = require("./config/connect_db");
const checkAuthMiddleWare = require('./middleware/authenticate');
const userRoutes = require('./routes/user.route');
const authRoutes = require('./routes/auth.route');
const bookingRoutes = require('./routes/booking.route');
const roomRoutes = require('./routes/room.route');
// Add imports for admin and student routes
const adminRoutes = require('./routes/admin.route');
const studentRoutes = require('./routes/student.route');

// Import the device routes if the file exists
let deviceRoutes;
try {
  deviceRoutes = require('./routes/device.route');
} catch(e) {
  console.log('Device routes not found, skipping import');
}

require('dotenv').config();
const port = process.env.PORT;

// Use a specific allowed origin for CORS when credentials are included
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100
});

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(limiter);

// Cấu hình CORS chính xác để hỗ trợ preflight requests
app.use(cors({
  origin: FRONTEND_URL, // wildcard breaks credentialed requests
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Cho phép các phương thức HTTP
  allowedHeaders: ['Content-Type', 'Authorization'], // Cho phép các headers
  credentials: true, // Cho phép credentials
  optionsSuccessStatus: 200 // Trả về status 200 cho OPTIONS request
}));

// Thiết lập headers CORS thủ công để đảm bảo tương thích
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', FRONTEND_URL);
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Xử lý preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// Phục vụ thư mục uploads như một thư mục tĩnh
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Public routes that don't require authentication
app.use('/api/auth', authRoutes);

// Apply authentication middleware for protected routes
app.use(checkAuthMiddleWare);

// Protected routes
app.use('/api/user', userRoutes);
app.use('/api/booking', bookingRoutes);
app.use('/api/room', roomRoutes);
// Add the admin and student routes
app.use('/api/admin', adminRoutes);
app.use('/api/student', studentRoutes);

// Conditionally add device routes if they exist
if (deviceRoutes) {
  app.use('/api/device', deviceRoutes);
}

// Default route
app.get('/', (req, res) => {
  res.send('Room Booking API is running');
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send({ error: 'Something broke!' });
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});