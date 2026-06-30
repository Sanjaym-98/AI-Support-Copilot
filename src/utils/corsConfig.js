const isAllowedOrigin = (origin) => {
    if (!origin) return true;
    if (origin.startsWith('http://localhost:')) return true;
    if (origin.includes('.vercel.app')) return true;
    return false;
};

const corsOptions = {
    origin: (origin, callback) => {
        if (isAllowedOrigin(origin)) return callback(null, true);
        callback(null, false);
    },
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'token', 'Token', 'Accept', 'Origin', 'X-Requested-With'],
    optionsSuccessStatus: 204,
};

const socketCorsOptions = {
    origin: (origin, callback) => {
        if (isAllowedOrigin(origin)) return callback(null, true);
        callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'token', 'Token', 'Accept', 'Origin', 'X-Requested-With'],
};

module.exports = { corsOptions, socketCorsOptions };
