const express = require("express");
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken");
require("dotenv").config();
const pool = require('./src/middleWare/connection/dbConfig');
const commonService = require("./src/commonService");
const registerRoutes = require('./routes')
const cors = require("cors");
const { corsOptions } = require('./src/utils/corsConfig');
const app = express();
const http = require('http');
const initialiseSocket = require('./src/utils/socket')
const { startTicketWorker, stopTicketWorker } = require('./src/ticketWorker');

app.use(cors(corsOptions));

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
            startTicketWorker();
        });

        const shutdown = async () => {
            console.log('Shutting down...');
            await stopTicketWorker();
            server.close(() => process.exit(0));
        };

        process.on('SIGTERM', shutdown);
        process.on('SIGINT', shutdown);

    } catch (err) {
        console.log("err",err)
        console.error("Failed to connect to PostgreSQL:", err);
        process.exit(1);
    }
})();

