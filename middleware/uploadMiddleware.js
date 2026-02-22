const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;
require('dotenv').config();

// 1. Configure Cloudinary with your credentials
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// 2. Set up the Cloudinary Storage Engine
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'school_management_files', // This folder will be created in your Cloudinary account
    resource_type: 'auto', // IMPORTANT: 'auto' allows PDFs and Docs, not just images!
    allowed_formats: ['jpg', 'jpeg', 'png', 'pdf', 'doc', 'docx']
  }
});

// 3. Create the Multer Upload Function
const upload = multer({ storage: storage }).fields([
    { name: 'photo', maxCount: 1 },
    { name: 'resume', maxCount: 1 }
]);

module.exports = upload;