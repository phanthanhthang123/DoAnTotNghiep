import './src/loadEnv'
const emailExistence = require('email-existence');
// Import các thư viện cần thiết
import express from 'express'
import cors from 'cors'      
import cookieParser from 'cookie-parser'
import http from 'http'
import { Server } from 'socket.io'
import connectDatabase from './src/config/connectDatabase'
import { configureCloudinary } from './src/config/cloudinary'
import initRoutes from './src/routers'
import { registerSocketHandlers } from './src/socket'
import { startTaskDueRemindersScheduler } from './src/services/task-due-reminders'


const app = express()
const PORT = process.env.PORT || 5000
const server = http.createServer(app)
//cho phép các request từ các domain khác (ví dụ: frontend của bạn) có thể truy cập API của backend
app.use(cors({
    origin: process.env.URL_REACT,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true, //  cho phép trình duyệt gửi và nhận thông tin xác thực Cookie ,Authorization headers
}))

//giúp có thể đọc giữ liệu được gửi lên từ client
app.use(express.json())
// đđể backend nhận được dữ liệu dạng x-www-form-urlencoded,
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

connectDatabase();
configureCloudinary();
initRoutes(app);



// emailExistence.check('phanthanhthang1104@gmail.com', (err, res) => {
//   if (err) {
//     console.error('Error:', err);
//   } else {
//     console.log('Email exists:', res); // true nếu email tồn tại
//   }
// });

const io = new Server(server, {
  cors: {
    origin: process.env.URL_REACT,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

app.set('io', io);
registerSocketHandlers(io);
startTaskDueRemindersScheduler();

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
  console.log(`Server is running on http://localhost:${PORT}`)
})
