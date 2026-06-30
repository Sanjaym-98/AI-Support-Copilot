const express=require('express');
const auth = require('../../middleWare/auth/index');
const commonService = require('../../commonService');
const ticketQueue = require('../../middleWare/connection/bullMqConfig');
const ticket= express.Router();
const pool = require('../../middleWare/connection/dbConfig');
const bodyParser = require('body-parser');


ticket.use(bodyParser.json());
ticket.use(
    bodyParser.urlencoded({
        extended: false,
    })
);


ticket.post('/create',commonService.authenticateAndAuthorize(["CUSTOMER"]), async(req,res)=>{
    try{
        const {title, description, attachmentUrl ,ticketTypeId} = req.body;

        if(!ticketTypeId || !description || !title){
            return res.status(400).json({
                success:false,
                message: "required Fiedls are missing"
            })
        }

        if(req.user.role !="CUSTOMER"){
            return res.status(403).json({
                 success:false,
                 message:"Access denied!"
            })
        }
        const getStatusId  = await pool.query('select * from status where active =true order by sequence asc');
        
        if (getStatusId.rows.length === 0) {
            return res.status(500).json({ success: false, message: 'Default status not found' });
        }

        const validateTicketId = await pool.query("select * from ticket_types where id=$1 and active =true;",[ticketTypeId]);
        if(validateTicketId.rows.length==0){
             return res.status(500).json({ success: false, message: 'Invalid ticket type.' });
        }
        const customerId = req.user.id;
        const result = await pool.query(
            `INSERT INTO tickets (title, description, ticket_type_id, attachment_url, status_id, customer_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       RETURNING id`,
            [title, description, ticketTypeId , attachmentUrl, getStatusId.rows[0].id, customerId]
        );

        const ticketId = result.rows[0].id;

        const ref_no = `#TCKT-${ticketId.toString().padStart(6, '0')}`;

        await pool.query(`UPDATE tickets SET ref_no = $1 WHERE id = $2`,[ref_no, ticketId]);


        await ticketQueue.add(
            "ai-analysis",
            {
                ticketId: ticketId,
                description: description,
                ticketType: validateTicketId.rows[0].name
            }
        );


        return res.status(201).json({
            success: true,
            message: 'Ticket created successfully',
            ticketId: ref_no
        });

        
    } catch (err) {
        console.error('Ticket creation error:', err);
        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
})

ticket.get('/ticketType',commonService.authenticateAndAuthorize(['CUSTOMER']),async(req,res)=>{
    try{
        let getTicketTypes = await pool.query("select * from ticket_types where active=true;");
        
        return res.status(200).json({
            success: true,
            data: getTicketTypes.rows,
            count: getTicketTypes.rows.length
        });
    }catch(err){
        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
})

ticket.get("/getTickets",commonService.authenticateAndAuthorize(["AGENT","CUSTOMER"]),async(req,res)=>{
    try{    
        
        let query, params;

        const userRole = req.user.role;
        const userId = req.user.id;
        if (userRole === "CUSTOMER") {
            query = `
                SELECT t.id, t.title, t.description, t.ref_no,tp.name as ticket_type,u.name as created_by, t.attachment_url, t.status_id, s.name as status_name,
                       t.created_at
                FROM tickets t
                JOIN ticket_types tp on t.ticket_type_id = tp.id 
                JOIN users u on t.customer_id = u.id
                LEFT JOIN status s ON t.status_id = s.id
                WHERE t.customer_id = $1
                ORDER BY t.created_at DESC
            `;
            params = [userId];
        } else {
            query = `
                SELECT t.id, t.title, t.description, t.ref_no,tp.name as ticket_type,u.name as created_by, t.attachment_url, t.status_id, s.name as status_name,
                       t.created_at, t.ai_priority, t.ai_summary, t.ai_category,
                       u.name as customer_name
                FROM tickets t
                JOIN ticket_types tp on t.ticket_type_id = tp.id
                JOIN users u on t.customer_id = u.id
                LEFT JOIN status s ON t.status_id = s.id
                ORDER BY 
                    CASE WHEN t.status_id = (SELECT id FROM status WHERE name = 'Open' LIMIT 1) THEN 0 ELSE 1 END,
                    t.created_at DESC
            `;
            params = [];
        }

        const result = await pool.query(query, params);

        return res.status(200).json({
            success: true,
            data: result.rows,
            count: result.rows.length
        });
    }catch(err){
         return res.status(500).json({
            success: false,
            message: err.message
        });
    }
})

ticket.get("/ticketDetail/:id", commonService.authenticateAndAuthorize(["AGENT", "CUSTOMER"]), async (req, res) => {
    try {
        const id= req.params.id
        let query, params;

        const userRole = req.user.role;
        const userId = req.user.id;
        if (userRole === "CUSTOMER") {
            query = `
                SELECT t.id, t.title, t.description, t.ref_no,tp.name as ticket_type,u.name as created_by, t.attachment_url, t.status_id, s.name as status_name,t.refund_status,
                       t.created_at
                FROM tickets t
                JOIN ticket_types tp on t.ticket_type_id = tp.id 
                JOIN users u on t.customer_id = u.id
                LEFT JOIN status s ON t.status_id = s.id
                WHERE t.id = $1
                AND t.customer_id = $2
            `;
            params = [id,userId];
        } else {
            query = `
                SELECT t.id, t.title, t.description, t.ref_no,tp.name as ticket_type,u.name as created_by, t.attachment_url, t.status_id, s.name as status_name,t.refund_status,
                       t.created_at, t.ai_priority, t.ai_summary, t.ai_category,
                       u.name as customer_name
                FROM tickets t
                JOIN ticket_types tp on t.ticket_type_id = tp.id
                JOIN users u on t.customer_id = u.id
                LEFT JOIN status s ON t.status_id = s.id
                WHERE t.id = $1
            `;
            params = [id];
        }

        const result = await pool.query(query, params);

        return res.status(200).json({
            success: true,
            data: result.rows,
            count: result.rows.length
        });
    } catch (err) {
        console.log("err",err)
         return res.status(500).json({
            success: false,
            message: err.message
        });
    }
})

ticket.get('/statusWorkflow',commonService.authenticateAndAuthorize(["AGENT"]),async(req,res)=>{
  try {

    let data = await pool.query("select * from status where active=true");
       return res.status(200).json({
            success: true,
            data: data.rows
        });
  } catch (err) {
      return res.status(500).json({
          success: false,
          message: err.message
      });
  }
})



const updateTicketStatusHandler = async (req, res) => {
    try {
        const statusId = req.body?.statusId ?? req.query.statusId;
        const ticketId = req.body?.ticketId ?? req.query.ticketId;

        if (!statusId || !ticketId) {
            return res.status(400).json({
                success: false,
                message: "Required fields are missing"
            });
        }

        const updateStatus = await pool.query(
            "UPDATE tickets SET status_id = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
            [statusId, ticketId]
        );

        if (updateStatus.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: "Ticket not found or status not changed"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Status updated successfully.",
            data: updateStatus.rows[0]
        });
    } catch (err) {
        console.error("Status update error:", err);
        return res.status(500).json({
            success: false,
            message: err.message,
        });
    }
};

ticket.post('/status', commonService.authenticateAndAuthorize(["AGENT"]), updateTicketStatusHandler);
ticket.patch('/status', commonService.authenticateAndAuthorize(["AGENT"]), updateTicketStatusHandler);
module.exports=ticket