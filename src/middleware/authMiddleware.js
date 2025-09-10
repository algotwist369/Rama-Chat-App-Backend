const { verify } = require('../utils/token');
const User = require('../models/User');

const auth = async (req, res, next) => {
    const authHeader = req.headers.authorization?.split(' ')[1];
    if (!authHeader) {
        return res.status(401).send('No token');
    }

    try {
        const payload = verify(authHeader);
        req.user = await User.findById(payload.sub);
        next();
    } catch (e) {
        res.status(401).send('Invalid token');
    }
}

module.exports = auth;
