const validator = require('validator');
const pool = require('./middleWare/connection/dbConfig');
const jwt = require('jsonwebtoken')

const commonService ={
validateSignUp: async (req) => {
    try{
       if(req.body.name.length<4 || req.body.name.length>20){
         throw new Error("Invalid Name")
       }else if(!validator.isEmail(req.body.email)){
        throw new Error("Invalid Email address")
       }else if(!validator.isMobilePhone(req.body.mobile)){
        throw new Error("Invalid Mobile number")
       }else if(!validator.isStrongPassword(req.body.password)){
        throw new Error("Password is weak! please create a strong password with alphanumberic and atleast one special characters")
       }
    }catch(err){
        throw err
    }

}, 
isDataUnique: async (email, mobile) => {
    try {
        let checkDataExists = await pool.query(`select * from users where mobile=$1 or email=$2 and active=true`, [mobile, email]);
        if (checkDataExists.rows.length > 0) {
            throw new Error("name or email is already taken")
        }
        return true;
    } catch (err) {
        throw err
    }
},
checkUserExists:async (mobile)=>{
    try{
        let data = await pool.query("select * from users where mobile=$1 and active=true",[mobile]);
        return data;
    }catch(err){
        throw err
    }
},
authenticateAndAuthorize: (allowedRoles = []) => {
    return async (req, res, next) => {
        try {
            const authHeader = req.headers.token;
            if (!authHeader) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication token missing or invalid format'
                });
            }

            const token = authHeader

            let decoded;
            try {
                decoded = jwt.verify(token, process.env.JWT_SECRET);
            } catch (err) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid or expired token'
                });
            }

            const userResult = await pool.query(
                `SELECT id, role, active FROM users WHERE id = $1`,
                [decoded.id]
            );
            if (userResult.rows.length === 0) {
                return res.status(401).json({
                    success: false,
                    message: 'User no longer exists'
                });
            }

            const user = userResult.rows[0];
            if (!user.active) {
                return res.status(403).json({
                    success: false,
                    message: 'Account is deactivated'
                });
            }

            if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
                return res.status(403).json({
                    success: false,
                    message: `Access denied. Unauthorised User!`
                });
            }

            req.user = {
                id: user.id,
                role: user.role,
                email: decoded.email   
            };

            next();
        } catch (err) {
            console.error('Auth middleware error:', err);
            return res.status(500).json({
                success: false,
                message: 'Internal server error during authentication'
            });
        }
    };
},



}

module.exports = commonService;