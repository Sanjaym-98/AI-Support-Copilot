const express=require('express');
const auth = require('../../middleWare/auth/index');
const commonService = require('../../commonService');
const payment= express.Router();
const pool = require('../../middleWare/connection/dbConfig');
const bodyParser = require('body-parser');


payment.use(bodyParser.json());
payment.use(
    bodyParser.urlencoded({
        extended: false,
    })
);
payment.post('/refund', commonService.authenticateAndAuthorize(['AGENT']), async (req, res) => {
    try {
        const { ticketId, reason } = req.body;
        if (!ticketId) {
            return res.status(400).json({ success: false, message: "ticketId is required" });
        }
        const ticketResult = await pool.query("SELECT id FROM tickets WHERE id = $1", [ticketId]);
        if (ticketResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Ticket not found" });
        }
        const refundId = `refund_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        const refundAmount = 499; // fixed or from product
        await pool.query(
            `UPDATE tickets 
             SET refund_id = $1, 
                 refund_amount = $2, 
                 refund_status = 'processed', 
                 refund_reason = $3, 
                 refunded_at = NOW() 
             WHERE id = $4`,
            [refundId, refundAmount, reason || 'Refund processed by agent', ticketId]
        );
        return res.status(200).json({
            success: true,
            message: "Refund processed successfully",
            refundId,
            amount: refundAmount
        });
    } catch (error) {
        console.error('Refund error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
});

module.exports=payment;