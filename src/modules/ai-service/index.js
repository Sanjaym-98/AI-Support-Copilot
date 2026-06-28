const express = require('express');
const ai = express.Router();
const auth = require('../../middleWare/auth/index');
const pool = require('../../middleWare/connection/dbConfig');
const bodyParser = require('body-parser');
const upload = require('../../middleWare/fileUpload/fileUpload');
const {processDocument,askKnowledgeBase,getSummary,getUploadedDocs} = require('./service');
const commonService = require('../../commonService');

ai.use(bodyParser.json());
ai.use(bodyParser.urlencoded({
    extended: false
})
);

ai.post('/uploadFiles',commonService.authenticateAndAuthorize(["AGENT"]),upload.single("document"),async(req,res)=>{
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: "No file uploaded" });
        }
        const filePath = req.file.path;
        const fileName = req.file.originalname;
        const uploadedBy = req.user.id; 

        const result = await processDocument(filePath, fileName, uploadedBy);

        return res.status(200).json({
            success: true,
            message: "Document processed and stored in knowledge base",
            chunks: result.chunksCount,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: error.message });
    }
});



ai.get("/getAiInfo", commonService.authenticateAndAuthorize(["AGENT"]), async (req, res) => {
    try {
        const { question } = req.query;
        if (!question) {
            return res.status(400).json({ success: false, message: "Question is required" });
        }
        const result = await askKnowledgeBase(question);
        return res.status(200).json({
            success: true,
            answer: result.answer,
            sources: result.sources,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: error.message });
    }
})

ai.get('/getUploadedDocs',commonService.authenticateAndAuthorize(["AGENT"]),async(req,res)=>{
    try{
        const getDocs = await getUploadedDocs();
        return res.status(200).json({
            success:true,
            data:getDocs,
            message:"Documents fetched successfully!!"
        })

    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: error.message });
    }
})

ai.get("/getSummary/:ticketId", commonService.authenticateAndAuthorize(["AGENT", "CUSTOMER"]), async (req, res) => {
    try {
        const ticketId = req.params.ticketId;
        const userId = req.user.id;
        const userRole = req.user.role;
        if (!ticketId) {
            return res.status(400).json({ success: false, message: "Required params are missing" });
        }
        const result = await getSummary(ticketId, userId, userRole);
        return res.status(200).json({
            success: true,
            result: result
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: err.message });
    }
})


module.exports=ai
