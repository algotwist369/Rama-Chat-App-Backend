const express = require('express');
const { uploadToLocal, getFileUrl } = require('../services/fileStorageService');
const auth = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/upload', auth, (req, res) => {
    uploadToLocal.single('file')(req, res, (err) => {
        try {
            // Handle multer errors
            if (err) {
                console.error('File upload error:', err);
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
                }
                if (err.message === 'Invalid file type. Allowed types: images (jpeg, jpg, png, gif), documents (pdf, doc, docx, txt), videos (mp4, avi, mkv)') {
                    return res.status(400).json({ error: err.message });
                }
                return res.status(400).json({ error: err.message || 'File upload failed' });
            }

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
            console.error('File upload processing error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });
});

module.exports = router;
