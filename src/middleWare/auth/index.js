console.log("AUTH ROUTER FILE LOADED");

const express= require('express');
const auth = express.Router();
const bodyParser = require("body-parser");
const commonService = require('../../commonService');
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs');
const pool = require('../connection/dbConfig')



auth.use(bodyParser.json());
auth.use(
    bodyParser.urlencoded({
        extended: false,
    })
);


auth.post('/sign-up',async(req,res)=>{
    try{
        let {name, email, mobile,password} = req.body;

        if(!name || !mobile || !email || !password){
            return (
                res.status(400).json({
                    success: false,
                    message: "required fields are missing"
                })
            )
        }
        let isValidData = await commonService.validateSignUp(req);
        let data = await commonService.isDataUnique(email,mobile);
        if (data) {
            const hashPassword = await bcrypt.hash(password, 10);

            const createUser = await pool.query("insert into users (name, email, mobile,role ,password,active,created_at,updated_at) values ($1,$2,$3,$4,$5,$6,NOW(),NOW())", [name, email, mobile, "CUSTOMER", hashPassword, true])

            return res.status(200).json({
                success: true,
                message: "account created successfully, Please SignIn"
            })
        }

    }catch(err){
        console.log(err);
        return res.status(500).json({
            success:false,
            message:err.message
        })
    }
})

auth.post("/sign-in",async(req,res)=>{
    try{
        const {mobile,password}=req.body;
        if(!mobile || !password) {
            return res.status(400).json({
                success: false,
                message: "required fields are missing"
            })
        }
        const data = await commonService.checkUserExists(mobile);
        if(data.rowCount === 0){
            return res.status(404).json({
                success:false,
                message:"User Not Found!"
            });
        }
        
       const hashPassword = data.rows[0].password;
       const isValid = await bcrypt.compare(password,hashPassword);
        if (isValid) {
            const token = jwt.sign({ id: data.rows[0].id, role: data.rows[0].role }, process.env.JWT_SECRET, { expiresIn: "1d" });
            return res.status(200).json({
                success: true,
                message: "Login Successful",
                data: {
                    user: {
                        id: data.rows[0].id,
                        name: data.rows[0].name,
                        role: data.rows[0].role
                    },
                    token
                }
            })
        } else{
        return res.status(401).json({
            success:false,
            message:"Invalid Password !"
         })
       }

    }catch(err){
        console.log("err");
        res.status(500).json({
            success:false,
            message:err.message
        })
    }
})


auth.get('/test', (req,res)=>{
    res.json({
        success:true,
        message:"auth router working"
    });
});

module.exports =auth;