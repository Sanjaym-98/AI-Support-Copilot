const pool = require('../../middleWare/connection/dbConfig');


const updateTicketAiClassification =async(getAIClassification,ticketId)=>{
    try{
        const {category,sentiment,priority,summary}=getAIClassification;
        const updatTicket = await pool.query("update tickets set ai_category =$1,ai_sentiment=$2,ai_priority=$3,ai_summary=$4, updated_at=NOW() where id =$5;",[category,sentiment,priority,summary,ticketId]);
        if (updateTicket.rowCount === 0) {
            console.log("Ticket not found.") 
        } else {
            console.log("Ticket updated successfully");
        }
    }catch(err){

    }
}

module.exports = {updateTicketAiClassification}