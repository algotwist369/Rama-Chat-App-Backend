const express = require('express');
const { uploadToLocal, getFileUrl } = require('../services/fileStorageService');
const auth = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/upload', auth, uploadToLocal.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const fileUrl = getFileUrl(req.file.filename);

        res.json({
            message: 'File uploaded successfully',
            file: {
                url: fileUrl,
                key: req.file.filename,
                size: req.file.size,
                mimetype: req.file.mimetype,
                originalname: req.file.originalname
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
