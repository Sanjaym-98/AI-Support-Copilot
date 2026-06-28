const socket = require('socket.io');


const initialiseSocket = (server) => {
    try {



        const io = socket(server, {
            cors: {
                origin: "http://localhost:5173"
            }
        })

        io.on('connection', (socket) => {

            socket.on("joinChat",({ticketId,userName})=>{
                const roomId = ticketId;
                console.log(`${userName} join chat ${roomId}`)
                socket.join(roomId)

            })
             socket.on("sendMessage",({ticketId,user_name,user_id,sender_role,text})=>{
                const roomId = ticketId;
                io.to(roomId).emit('messageRecived',{user_name,sender_role,user_id,text});
            })

             socket.on("disconnect",()=>{
                
            })

        })
    } catch (err) {
        console.log('err', err)
    }

}


module.exports = initialiseSocket;
