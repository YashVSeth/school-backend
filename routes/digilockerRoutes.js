const express = require('express');
const router = express.Router();
const multer = require('multer');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const digilockerController = require('../controllers/digilockerController');

// Multer in-memory storage (supports PDF, PNG, JPG, up to 15MB)
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 15 * 1024 * 1024 }
});

// All DigiLocker vault and gateway routes are protected
router.use(protect);

// 5b. Fetch Student Record via 12-Digit ABC ID (APAAR ID)
router.post('/gateway/fetch-by-abc', digilockerController.fetchStudentByAbcId);

// 1. Vault Analytics & Stats
router.get('/stats', digilockerController.getVaultStats);

// 2. Fetch Vault Documents
router.get('/documents', digilockerController.getDocuments);

// 3. Candidates List for auto-fill and quick-selection
router.get('/candidates', digilockerController.getCandidatesList);

// 4. Realistic MeriPehchaan DigiLocker Gateway: Step 1 Initiate OTP
router.post('/gateway/initiate-otp', digilockerController.initiateDigiLockerOtp);

// 5. Realistic MeriPehchaan DigiLocker Gateway: Step 2 Verify OTP & Retrieve
router.post('/gateway/verify-otp-and-pull', digilockerController.verifyOtpAndFetch);

// 6. School Issues Document Directly to DigiLocker / NAD (Push)
router.post('/issue', adminOnly, digilockerController.issueDocument);

// 7. QR Code Cryptographic Verification
router.get('/verify-qr/:id', digilockerController.verifyQrCode);

// 8. Upload Manual Document to Vault
router.post('/upload', upload.single('file'), digilockerController.uploadDocument);

// 9. Legacy / Direct Fetch Route
router.post('/fetch-digilocker', digilockerController.fetchFromDigiLocker);

// 10. Update Verification Status (Verify/Reject)
router.put('/verify/:id', adminOnly, digilockerController.verifyDocument);

// 11. Delete Document
router.delete('/document/:id', adminOnly, digilockerController.deleteDocument);

module.exports = router;
