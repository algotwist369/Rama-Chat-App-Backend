const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads');
const chatFilesDir = path.join(uploadsDir, 'chat-files');

if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

if (!fs.existsSync(chatFilesDir)) {
    fs.mkdirSync(chatFilesDir, { recursive: true });
}

// Configure multer for local storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, chatFilesDir);
    },
    filename: (req, file, cb) => {
        const fileName = `${Date.now()}-${file.originalname}`;
        cb(null, fileName);
    }
});

const uploadToLocal = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        // Allowed file extensions
        const allowedExtensions = /\.(jpeg|jpg|png|gif|pdf|doc|docx|txt|mp4|avi|mkv)$/i;
        // Allowed MIME types
        const allowedMimeTypes = /^(image\/(jpeg|jpg|png|gif)|application\/(pdf|msword|vnd\.openxmlformats-officedocument\.wordprocessingml\.document|text\/plain)|video\/(mp4|avi|mkv))$/;
        
        const extname = allowedExtensions.test(file.originalname);
        const mimetype = allowedMimeTypes.test(file.mimetype);

        if (extname && mimetype) {
            return cb(null, true);
        } else {
            console.log('File rejected:', {
                originalname: file.originalname,
                mimetype: file.mimetype,
                extname: extname,
                mimetypeMatch: mimetype
            });
            cb(new Error('Invalid file type. Allowed types: images (jpeg, jpg, png, gif), documents (pdf, doc, docx, txt), videos (mp4, avi, mkv)'));
        }
    }
});

const deleteFromLocal = async (filename) => {
    try {
        const filePath = path.join(chatFilesDir, filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`File deleted: ${filename}`);
        } else {
            console.log(`File not found: ${filename}`);
        }
    } catch (error) {
        console.error('Error deleting file:', error);
    }
};

const getFileUrl = (filename) => {
    const baseUrl = process.env.API_URL || process.env.FILE_BASE_URL || 'http://localhost:5000';
    const uploadPath = process.env.UPLOAD_PATH || '/uploads/chat-files';
    return `${baseUrl}${uploadPath}/${filename}`;
};

module.exports = { 
    uploadToLocal, 
    deleteFromLocal, 
    getFileUrl,
    uploadsDir,
    chatFilesDir
};
