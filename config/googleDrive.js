const { google } = require('googleapis');
const { Readable } = require('stream');
require('dotenv').config();

// Create Drive client using Service Account credentials
const getDriveClient = () => {
  const clientEmail = process.env.GOOGLE_DRIVE_CLIENT_EMAIL;
  let privateKey = process.env.GOOGLE_DRIVE_PRIVATE_KEY;

  if (!clientEmail || !privateKey) {
    return null;
  }

  // Remove surrounding quotes if present
  if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
    privateKey = privateKey.slice(1, -1);
  }
  // Handle literal newlines in private key
  privateKey = privateKey.replace(/\\n/g, '\n');

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: clientEmail,
      private_key: privateKey
    },
    scopes: ['https://www.googleapis.com/auth/drive']
  });

  return google.drive({ version: 'v3', auth });
};

/**
 * Upload a buffer directly to Google Drive
 * @param {Buffer} fileBuffer - File buffer from multer memory storage
 * @param {string} fileName - Original or sanitized file name
 * @param {string} mimeType - File mime type (e.g. image/jpeg, application/pdf)
 * @param {string} [customFolderId] - Optional custom folder ID
 * @returns {Promise<{fileId: string, url: string, webViewLink: string}>}
 */
const uploadToGoogleDrive = async (fileBuffer, fileName, mimeType, customFolderId = null) => {
  const drive = getDriveClient();

  if (!drive) {
    throw new Error(
      'Google Drive credentials not configured. Please set GOOGLE_DRIVE_CLIENT_EMAIL and GOOGLE_DRIVE_PRIVATE_KEY in .env'
    );
  }

  const folderId = customFolderId || process.env.GOOGLE_DRIVE_FOLDER_ID;
  const fileMetadata = {
    name: `${Date.now()}_${fileName}`,
    parents: folderId ? [folderId] : []
  };

  const bufferStream = new Readable();
  bufferStream.push(fileBuffer);
  bufferStream.push(null);

  const media = {
    mimeType: mimeType || 'application/octet-stream',
    body: bufferStream
  };

  // Upload file with supportsAllDrives
  const response = await drive.files.create({
    requestBody: fileMetadata,
    media: media,
    fields: 'id, name, webViewLink, webContentLink',
    supportsAllDrives: true
  });

  const fileId = response.data.id;

  // Make file publicly readable
  try {
    await drive.permissions.create({
      fileId: fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone'
      },
      supportsAllDrives: true
    });
  } catch (permError) {
    console.warn('⚠️ Google Drive permission notice:', permError.message);
  }

  const isImage = mimeType && mimeType.startsWith('image/');
  const directUrl = isImage
    ? `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`
    : `https://drive.google.com/uc?export=view&id=${fileId}`;

  return {
    fileId: fileId,
    url: directUrl,
    webViewLink: response.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`,
    downloadUrl: response.data.webContentLink || `https://drive.google.com/uc?export=download&id=${fileId}`
  };
};

module.exports = {
  getDriveClient,
  uploadToGoogleDrive
};
