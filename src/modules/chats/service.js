const pool = require('../../middleWare/connection/dbConfig');  




const chatService = {
  getTicketMessages: async (ticketId, userId, userRole) => {
    if (!ticketId) {
      const error = new Error('ticketId is required');
      error.code = 'MISSING_TICKET_ID';
      throw error;
    }

    const ticketResult = await pool.query(
      'SELECT id, customer_id FROM tickets WHERE id = $1',
      [ticketId]
    );
    if (ticketResult.rows.length === 0) {
      const error = new Error('Ticket not found');
      error.code = 'TICKET_NOT_FOUND';
      throw error;
    }

    const ticket = ticketResult.rows[0];

    if (userRole === 'CUSTOMER' && ticket.customer_id !== userId) {
      const error = new Error('Access denied: You can only view messages for your own tickets');
      error.code = 'FORBIDDEN';
      throw error;
    }

    const result = await pool.query(
      `SELECT 
        c.id,
        c.text,
        c.sender_role,
        c.created_at,
        u.id as user_id,
        u.name as user_name
      FROM chats c
      LEFT JOIN users u ON c.sender_id = u.id
      WHERE c.ticket_id = $1
      ORDER BY c.created_at ASC`,
      [ticketId]
    );

    return result.rows;
  },

  saveMessage: async (ticketId, senderId, senderRole, text) => {
    // 1. Validate
    if (!ticketId || !text) {
      const error = new Error('ticketId and text are required');
      error.code = 'MISSING_FIELDS';
      throw error;
    }

    // 2. Verify ticket exists
    const ticketCheck = await pool.query(
      'SELECT id FROM tickets WHERE id = $1',
      [ticketId]
    );
    if (ticketCheck.rows.length === 0) {
      const error = new Error('Ticket not found');
      error.code = 'TICKET_NOT_FOUND';
      throw error;
    }

    // 3. Insert message
    const result = await pool.query(
      `INSERT INTO chats (ticket_id, sender_id, sender_role, text, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id, ticket_id, sender_id, sender_role, text, created_at`,
      [ticketId, senderId, senderRole, text]
    );

    return result.rows[0];
  }
};

module.exports = chatService;
