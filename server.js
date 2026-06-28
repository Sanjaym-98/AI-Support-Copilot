const express = require("express");
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken");
require("dotenv").config();
const pool = require('./src/middleWare/connection/dbConfig');
const commonService = require("./src/commonService");
const registerRoutes = require('./routes')
const cors = require("cors");
const app = express();
const http = require('http');
const initialiseSocket = require('./src/utils/socket')


app.use(cors({
    origin: ["http://localhost:5173"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "token", "Token"],
    maxAge: 0 
}));

const server = http.createServer(app);


initialiseSocket(server)

app.get("/health", (req, res) => {
    console.log('HEALTH ROUTE HIT - This should print');
    res.json({ status: "BRO", message: "Server is running" });
});


app.use(express.json())



if (typeof registerRoutes === 'function') {
    registerRoutes(app);
    console.log("✅ Routes registered successfully");
} else {
    console.error("❌ registerRoutes is not a function! Type:", typeof registerRoutes);
    console.error("registerRoutes value:", registerRoutes);
}

// server.get("/health", (req, res) => {
//   res.json({ status: " BRO", message: "Server is running" });
// });

(async () => {
    try {
        const client = await pool.connect();

        console.log("PostgreSQL Connected");

        client.release(); 
        server.listen(process.env.PORT, () => {
            console.log(`Server running on port ${process.env.PORT}`);
        });

    } catch (err) {
        console.log("err",err)
        console.error("Failed to connect to PostgreSQL:", err);
        process.exit(1);
    }
})();

