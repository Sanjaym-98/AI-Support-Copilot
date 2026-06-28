const express = require('express');
const chat = express.Router();
const pool = require('../../middleWare/connection/dbConfig');
const commonService = require('../../commonService');
const chatService = require('../chats/service');




chat.post('/save', commonService.authenticateAndAuthorize(['CUSTOMER', 'AGENT']), async (req, res) => {
    try {
        const { ticketId, text } = req.body;
        const senderId = req.user.id;
        const senderRole = req.user.role;

        if (!ticketId || !text) {
            return res.status(400).json({
                success: false,
                message: "ticketId and text are required"
            });
        }

        const message = await chatService.saveMessage(ticketId, senderId, senderRole, text);

        return res.status(201).json({
            success: true,
            message: 'Message sent successfully',
            data: message
        });

    } catch (error) {
        console.error("Save message error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Failed to save message"
        });
    }
});


chat.get('/get/:ticketId', commonService.authenticateAndAuthorize(['CUSTOMER', 'AGENT']), async (req, res) => {
    try {
        const { ticketId } = req.params;
        const userId = req.user.id;
        const userRole = req.user.role;

        if (!ticketId) {
            return res.status(400).json({
                success: false,
                message: "ticketId is required"
            });
        }

        const messages = await chatService.getTicketMessages(ticketId, userId, userRole);

        return res.status(200).json({
            success: true,
            data: messages
        });

    } catch (error) {
        console.error("Get messages error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Failed to fetch messages"
        });
    }
});

module.exports = chat;