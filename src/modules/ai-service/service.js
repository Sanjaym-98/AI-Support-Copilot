const OpenAI = require('openai');

// const { pipeline } = require('@xenova/transformers');
const pdfParse = require('pdf-parse');
const fs = require('fs');
const { RecursiveCharacterTextSplitter } = require('@langchain/textsplitters');
const pool = require('../../middleWare/connection/dbConfig');  
const chatService = require('../chats/service');

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});
let embeddingPipeline = null;
let pipeline;

async function getPipeline() {
    if (!pipeline) {
        const transformers = await import('@xenova/transformers');
        pipeline = transformers.pipeline;
    }
    return pipeline;
}

const AiClassification = async (customerDescription, ticketType) => {
    try {
        const completion = await openai.chat.completions.create({
            model: "openai/gpt-oss-120b:free",
            messages: [
                {
                    role: "system",
                    content: `You are a support ticket analyzer. Analyze the customer's description and ticket type.
    Return your analysis **only** as a valid JSON object with these exact keys:
    - "category": one of ["Billing", "Technical", "Account", "Product", "Shipping", "Other", "Warranty claim"]
    - "sentiment": one of ["Positive", "Neutral", "Negative"]
    - "priority": one of ["Low", "Medium", "High", "Urgent"]
    - "summary": a short one-sentence summary of the issue (max 15 words)

    Do not include any other text, explanations, or markdown.`
                },
                {
                    role: "user",
                    content: `Ticket type: ${ticketType || "General"}\nCustomer description: ${customerDescription}`
                }
            ],
            extra_headers: {
                "HTTP-Referer": "http://localhost:3000",
                "X-Title": "AI Support Copilot"
            },
            response_format: { type: "json_object" } // optional but helpful
        });
        const rawContent = completion?.choices[0]?.message?.content;
        console.log("rowcontectn",rawContent)
        // Parse JSON response
        const parsed = JSON.parse(rawContent);

        // Validate and provide defaults if fields missing
        return {
            category: parsed.category || "Other",
            sentiment: parsed.sentiment || "Neutral",
            priority: parsed.priority || "Medium",
            summary: parsed.summary || "Issue reported by customer",
        };
    } catch (err) {
        console.error("AI classification failed:", err.message || err);
        // Fallback values so the ticket can still be created
        return {
            category: "Other",
            sentiment: "Neutral",
            priority: "Medium",
            summary: "Awaiting manual review (AI error)",
        };
    }
};

const getEmbeddingPipeline=async () =>{
  if (!embeddingPipeline) {
    const pipeline = await getPipeline();

    embeddingPipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }
  return embeddingPipeline;
}

const generateEmbedding = async (text) => {
    const pipe = await getEmbeddingPipeline();
    const result = await pipe(text, { pooling: 'mean', normalize: true }); 
    // this is a sentence  ==> this - vector1, is - vector2, a -vector3, sentence- vector4
    // So pooling means what it does is combine all the four vectors, take the average of that, 
    // and then create one single vector vector n representing the whole sentence. 

    // normalize: true → "make vector length 1 so cosine similarity works reliably"

    return Array.from(result.data); // returns an array of floats (length 384)
}

const chunkText = async (text, chunkSize = 500, overlap = 50) => {
    const splitter = new RecursiveCharacterTextSplitter({
        chunkSize,
        chunkOverlap: overlap,   // overlap inorder to avoid any miss of the context /info
        separators: ["\n\n", "\n", " ", ""], 
    });
    return splitter.splitText(text);
}

const processDocument = async (filePath, fileName, uploadedBy) => {
    // 1. Extract text from PDF
    const dataBuffer = fs.readFileSync(filePath);
    const pdfData = await pdfParse(dataBuffer);
    const fullText = pdfData.text;
    if (!fullText.trim()) throw new Error("No text extracted from PDF");

    // 2. Chunk the text
    const chunks =await chunkText(fullText);
    console.log(`Generated ${chunks.length} chunks`);

    // 3. For each chunk, generate embedding and store in DB
    for (let i = 0; i < chunks.length; i++) {
        const chunkText = chunks[i];
        const embedding = await generateEmbedding(chunkText);
        // Convert embedding array to PostgreSQL vector string format: '[0.1,0.2,...]'
        const vectorStr = `[${embedding.join(',')}]`;

        await pool.query(
            `INSERT INTO knowledge_chunks (file_name, chunk_index, text, embedding, uploaded_by)
       VALUES ($1, $2, $3, $4::vector, $5)`,
            [fileName, i, chunkText, vectorStr, uploadedBy]
        );
    }

    // Clean up uploaded file
    fs.unlinkSync(filePath);

    return { chunksCount: chunks.length, fileName };
}

const searchKnowledge = async (question, topK = 3) => {
    // 1. Generate embedding for the question
    const questionEmbedding = await generateEmbedding(question);
    const vectorStr = `[${questionEmbedding.join(',')}]`;

    // 2. Perform cosine similarity search
    //<=>  means cosine , getting smaller distance of vector first

    const result = await pool.query(
        `SELECT text, file_name, 1 - (embedding <=> $1::vector) AS similarity
     FROM knowledge_chunks
     ORDER BY embedding <=> $1::vector
     LIMIT $2`,
        [vectorStr, topK]
    );

    const contexts = result.rows.map(row => row.text);
    const sources = result.rows.map(row => row.file_name);
    return { contexts, sources };
}

const askKnowledgeBase = async (question) => {
    const { contexts, sources } = await searchKnowledge(question);
    if (!contexts.length) {
        return { answer: "No relevant information found in knowledge base.", sources: [] };
    }

    const prompt = `You are a helpful support assistant. Answer the question based only on the following contexts. If the answer is not in the contexts, say "I don't have that information in my knowledge base."

 Contexts:
 ${contexts.map((c, i) => `[${i + 1}] ${c}`).join('\n')}

 Question: ${question}

 Answer:`;

    // // Use OpenRouter (or any LLM) to generate the final answer
    // const OpenAI = require('openai');
    // const client = new OpenAI({
    //     baseURL: "https://openrouter.ai/api/v1",
    //     apiKey: process.env.OPENROUTER_API_KEY,
    // });
    const completion = await openai.chat.completions.create({
        model: "google/gemma-4-31b-it:free",
        messages: [{ role: "user", content: prompt }],
        extra_headers: {
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "AI Support Copilot",
        },
    });
    const answer = completion.choices[0].message.content;
    return { answer, sources };
}

const getUploadedDocs = async () => {
    try {
        let result = await pool.query("select distinct file_name , MAX(created_at) as created_at from knowledge_chunks group by file_name order by created_at DESC ");
        return result.rows;
    } catch (err) {
        console.error('Error fetching uploaded documents:', err);
        return {
            success: false,
            message: err.message || 'Failed to fetch documents'
        };
    }
}

const getSummary = async (ticketId, userId, userRole) => {
    try {
        let getChats = await chatService.getTicketMessages(ticketId, userId, userRole);

        if (getChats.length === 0) {
            return {
                summary: "There are no conversations to summarize!!"
            }
        }

        let conversationText = getChats.map(msg =>
            `${msg.sender_role === "AGENT" ? "Agent" : "Customer"}:${msg.text}`).join('\n');

        const prompt = `You are a support ticket summarizer. Summarize the following customer-agent conversation concisely. And return the response in beautified text

    Requirements:
- Keep the summary under 100 words.
- Use clear, well-formatted Markdown.
- Include only information present in the conversation. Do not make assumptions or invent details.

Include the following:
- Main issue reported by the customer
- Steps taken by the agent
- Current status or resolution (if any)
- Pending actions or next steps (if any)

Conversation:
${conversationText}

Summary:`;

        // 4. Call OpenRouter with best model
        const completion = await openai.chat.completions.create({
            model: "google/gemma-4-31b-it:free", // or "qwen/qwen3.6-plus-preview:free"
            messages: [{ role: "user", content: prompt }],
            extra_headers: {
                "HTTP-Referer": "http://localhost:3000",
                "X-Title": "AI Support Copilot",
            },
            max_tokens: 300,
            temperature: 0.3,
        });

        return {
            summary: completion.choices[0].message.content,
            messageCount: getChats.length
        };

    } catch (error) {
        console.error('Summarization error:', error);
        return {
            summary: "Unable to generate summary at this time. Please try again later.",
            error: error.message
        };
    }
};
 
    





module.exports = {AiClassification,processDocument, searchKnowledge, askKnowledgeBase,getSummary,getUploadedDocs}