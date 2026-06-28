// const { Worker } = require('bullmq');
// const connection = require('./middleWare/connection/redisConfig');
// const aiService = require('./modules/ai-service/service')
// const ticketService =require('./modules/tickets/service')



// const worker = new Worker("ticket-processing", async (job) => {
//     try {
//         switch (job.name) {
//             case "ai-analysis":
//                 let getAIClassification = await aiService.AiClassification(job.data.description, job.data.ticketType);
//                 let updateTicketData = await ticketService.updateTicketAiClassification(getAIClassification, job.data.ticketId)
//                 break;
//             default:
//                 console.warn(`Unknown job name: ${job.name}`);
//         }

//     } catch (err) {
//         console.error(`Job ${job.id} failed:`, error);
//         throw error;
//     }
    
// }, {
//   connection,
//   removeOnComplete: { count: 100 },
//   removeOnFail: { count: 1000 }
// });


// console.log("BullMQ worker is running...");



// Load environment variables first
require('dotenv').config();

const { Worker } = require('bullmq');
const connection = require('./middleWare/connection/redisConfig');
const aiService = require('./modules/ai-service/service');
const ticketService = require('./modules/tickets/service');

// Check if OpenAI API key is set
if (!process.env.OPENROUTER_API_KEY && !process.env.OPENROUTER_API_KEY) {
    console.error('❌ OpenAI API key is missing! Please set OPENAI_API_KEY or OPENAI_ADMIN_KEY in .env file');
    // console.error('Current environment variables loaded:', Object.keys(process.env).filter(key => key.includes('OPENAI')));
    process.exit(1);
} else {
    console.log('✅ OpenAI credentials found');
}

console.log('Redis config:', connection ? '✅ Loaded' : '❌ Failed');
console.log('AI Service:', aiService ? '✅ Loaded' : '❌ Failed');
console.log('Ticket Service:', ticketService ? '✅ Loaded' : '❌ Failed');

const worker = new Worker("ticket-processing", async (job) => {
    try {
        switch (job.name) {
            case "ai-analysis":
                console.log(`🤖 Processing AI analysis for ticket ${job.data.ticketId}`);
                const getAIClassification = await aiService.AiClassification(job.data.description, job.data.ticketType);
                const updateTicketData = await ticketService.updateTicketAiClassification(getAIClassification, job.data.ticketId);
                console.log(`✅ Completed AI analysis for ticket ${job.data.ticketId}`);
                break;
            default:
                console.warn(`⚠️ Unknown job name: ${job.name}`);
        }
    } catch (err) {
        console.error(`❌ Job ${job.id} failed:`, err);
        throw err;
    }
}, {
    connection,
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 1000 }
});

console.log("🚀 BullMQ worker is running and waiting for jobs...");

// Add event listeners for better debugging
worker.on('error', (err) => {
    console.error('❌ Worker error:', err);
});

worker.on('failed', (job, err) => {
    console.error(`❌ Job ${job?.id} failed with error:`, err);
});

worker.on('completed', (job) => {
    console.log(`✅ Job ${job.id} completed successfully`);
});

worker.on('ready', () => {
    console.log('✅ Worker is ready and connected to Redis');
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, closing worker...');
    await worker.close();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('SIGINT received, closing worker...');
    await worker.close();
    process.exit(0);
});