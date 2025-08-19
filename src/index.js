import dotenv from "dotenv";
import connectDB from "./db/index.js";
import app from "./app.js";

dotenv.config({ path: "./.env" });

const PORT = process.env.PORT || 8081;

connectDB()
  .then(() => {
    app.listen(PORT, () => console.log(`🚀 Server listening on port ${PORT}`));
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
  });

// import dotenv from "dotenv";
// import http from "http";
// import { Server } from "socket.io";

// import connectDB from "./db/index.js";
// import app from "./app.js";

// dotenv.config({ path: "./.env" });

// const PORT = process.env.PORT || 8081;

// // 1. Create HTTP server
// const server = http.createServer(app);

// // 2. Create Socket.io server
// const io = new Server(server, {
//   cors: {
//     origin: ["http://localhost:5173", "https://yourfestivalapp.live"],
//     credentials: true,
//   },
// });

// // 3. Make Socket.io accessible globally
// global.io = io;

// // 4. Handle socket connections
// io.on("connection", (socket) => {
//   console.log("New client connected:", socket.id);

//   socket.on("disconnect", () => {
//     console.log("Client disconnected:", socket.id);
//   });
// });

// connectDB()
//   .then(() => {
//     server.listen(PORT, () => {
//       console.log(`🚀 Server running on port ${PORT}`);
//     });
//   })
//   .catch((err) => {
//     console.error("❌ MongoDB connection error:", err);
//   });
