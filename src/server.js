 

const http = require('http');
const app = require('./app');
const connectDB = require('./config/db');
const initSocket = require('./sockets/chatSocket');
const redis = require('./config/redis'); // optional

const server = http.createServer(app);

(async () => {
    try {
        connectDB();

        // if using redis adapter, pass it instead of null
        initSocket(server, null, app);
        // initSocket(server, redis, app);

        const PORT = process.env.PORT || 5000;
        server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    } catch (err) {
        console.error('Server startup error:', err);
        process.exit(1);
    }
})();
