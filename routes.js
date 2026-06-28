


function registerRoutes(app) {

    app.use("/v1/auth", require('./src/middleWare/auth/index'));
    app.use("/v1/ai",require('./src/modules/ai-service/index'));
    app.use("/v1/ticket",require('./src/modules/tickets/index'))
    app.use("/v1/chats",require('./src/modules/chats/index'));
    app.use("/v1/payment",require('./src/modules/payments/index'))

}

module.exports = registerRoutes;
