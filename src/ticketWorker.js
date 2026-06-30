const { Worker } = require('bullmq');
const connection = require('./middleWare/connection/redisConfig');
const aiService = require('./modules/ai-service/service');
const ticketService = require('./modules/tickets/service');

let workerInstance = null;

function startTicketWorker() {
    if (workerInstance) {
        return workerInstance;
    }

    if (!process.env.REDIS_URL) {
        console.warn('⚠️ REDIS_URL not set — BullMQ worker not started');
        return null;
    }

    if (!process.env.OPENROUTER_API_KEY) {
        console.warn('⚠️ OPENROUTER_API_KEY not set — BullMQ worker not started');
        return null;
    }

    console.log('✅ OpenRouter credentials found');
    console.log('Redis config:', connection ? '✅ Loaded' : '❌ Failed');

    workerInstance = new Worker('ticket-processing', async (job) => {
        try {
            switch (job.name) {
                case 'ai-analysis':
                    console.log(`🤖 Processing AI analysis for ticket ${job.data.ticketId}`);
                    const classification = await aiService.AiClassification(
                        job.data.description,
                        job.data.ticketType
                    );
                    await ticketService.updateTicketAiClassification(classification, job.data.ticketId);
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
        removeOnFail: { count: 1000 },
    });

    workerInstance.on('error', (err) => {
        console.error('❌ Worker error:', err);
    });

    workerInstance.on('failed', (job, err) => {
        console.error(`❌ Job ${job?.id} failed with error:`, err);
    });

    workerInstance.on('completed', (job) => {
        console.log(`✅ Job ${job.id} completed successfully`);
    });

    workerInstance.on('ready', () => {
        console.log('✅ BullMQ worker is ready and connected to Redis');
    });

    console.log('🚀 BullMQ worker is running and waiting for jobs...');
    return workerInstance;
}

async function stopTicketWorker() {
    if (!workerInstance) return;
    await workerInstance.close();
    workerInstance = null;
    console.log('BullMQ worker stopped');
}

if (require.main === module) {
    require('dotenv').config();
    startTicketWorker();

    const shutdown = async () => {
        await stopTicketWorker();
        process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
}

module.exports = { startTicketWorker, stopTicketWorker };
