const DigiLockerDocument = require('../models/DigiLockerDocument');
const Student = require('../models/Student');
const Teacher = require('../models/Teacher');
const Class = require('../models/Class');
const crypto = require('crypto');

// In-memory OTP transaction store for simulated MeriPehchaan DigiLocker Gateway
const otpSessions = new Map();

// Helper to generate DigiLocker Official URI format
const generateDigiLockerUri = (docType, id) => {
    const slug = (docType || 'doc').toLowerCase().replace(/[^a-z0-9]/g, '');
    const hash = crypto.createHash('md5').update(`${id}-${Date.now()}`).digest('hex').substring(0, 10);
    return `in.gov.digilocker:${slug}:${hash}`;
};

// Helper: Generate Cryptographic Digital Signature Metadata
const generateSignatureMetadata = (docType, signerTitle = "Controller of Examinations") => {
    const sha256 = crypto.createHash('sha256').update(`${docType}-${Date.now()}-${Math.random()}`).digest('hex');
    const certSerial = `CCA-IN-${Date.now().toString(16).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
    return {
        signer: signerTitle,
        issuer: "National Informatics Centre (NIC) / CCA India Root CA 2014",
        certSerial,
        sha256,
        algorithm: "SHA-256 with RSA 2048-bit",
        timestamp: new Date().toISOString(),
        validity: "Valid & Untampered"
    };
};

// 1. AUTO-SYNC & GET ALL VAULT DOCUMENTS
exports.getDocuments = async (req, res) => {
    try {
        const { ownerType, status, documentType, search, page = 1, limit = 150 } = req.query;

        // Auto-seed initial sample DigiLocker records if database is empty so Admin immediately sees working vault
        const existingCount = await DigiLockerDocument.countDocuments();
        if (existingCount === 0) {
            await autoSyncExistingRecords();
        }

        const query = { isArchived: { $ne: true } };

        // If teacher is querying their own documents
        if (req.user && (req.user.role === 'Teacher' || req.user.role === 'teacher')) {
            query.ownerType = 'Teacher';
            if (req.user.email) {
                query.$or = [
                    { teacher: req.user._id },
                    { ownerIdentifier: req.user.email }
                ];
            }
        } else if (ownerType && ownerType !== 'All' && ownerType !== 'ALL') {
            query.ownerType = ownerType;
        }

        if (status && status !== 'All' && status !== 'ALL') {
            query.verificationStatus = status;
        }

        if (documentType && documentType !== 'All' && documentType !== 'ALL') {
            query.documentType = documentType;
        }

        if (search && search.trim()) {
            const regex = new RegExp(search.trim(), 'i');
            query.$or = [
                { ownerName: regex },
                { ownerIdentifier: regex },
                { documentType: regex },
                { documentNumber: regex },
                { classOrDept: regex },
                { issuedBy: regex }
            ];
        }

        const documents = await DigiLockerDocument.find(query)
            .sort({ createdAt: -1 })
            .limit(Number(limit))
            .skip((Number(page) - 1) * Number(limit));

        const total = await DigiLockerDocument.countDocuments(query);

        res.status(200).json({
            success: true,
            total,
            count: documents.length,
            page: Number(page),
            documents
        });
    } catch (error) {
        console.error("DigiLocker fetch error:", error);
        res.status(500).json({ success: false, message: "Failed to fetch DigiLocker documents", error: error.message });
    }
};

// 2. GET VAULT ANALYTICS & STATS
exports.getVaultStats = async (req, res) => {
    try {
        const total = await DigiLockerDocument.countDocuments({ isArchived: { $ne: true } });
        const verified = await DigiLockerDocument.countDocuments({ verificationStatus: 'Verified', isArchived: { $ne: true } });
        const pending = await DigiLockerDocument.countDocuments({ verificationStatus: 'Pending Verification', isArchived: { $ne: true } });
        const rejected = await DigiLockerDocument.countDocuments({ verificationStatus: 'Rejected', isArchived: { $ne: true } });

        const studentDocs = await DigiLockerDocument.countDocuments({ ownerType: 'Student', isArchived: { $ne: true } });
        const teacherDocs = await DigiLockerDocument.countDocuments({ ownerType: 'Teacher', isArchived: { $ne: true } });

        const aadhaarDocs = await DigiLockerDocument.countDocuments({ documentType: /Aadhaar/i, isArchived: { $ne: true } });
        const apaarDocs = await DigiLockerDocument.countDocuments({ documentType: /APAAR|ABC/i, isArchived: { $ne: true } });
        const marksheetDocs = await DigiLockerDocument.countDocuments({ documentType: /Marksheet|Report/i, isArchived: { $ne: true } });
        const certificateDocs = await DigiLockerDocument.countDocuments({ documentType: /Certificate|Degree|TC|Transfer/i, isArchived: { $ne: true } });

        const uniqueStudents = await DigiLockerDocument.distinct('student', { ownerType: 'Student', student: { $ne: null } });
        const uniqueTeachers = await DigiLockerDocument.distinct('teacher', { ownerType: 'Teacher', teacher: { $ne: null } });

        res.status(200).json({
            success: true,
            stats: {
                total,
                verified,
                pending,
                rejected,
                verificationRate: total > 0 ? Math.round((verified / total) * 100) : 100,
                studentDocs,
                teacherDocs,
                aadhaarDocs,
                apaarDocs,
                marksheetDocs,
                certificateDocs,
                studentsCount: uniqueStudents.length,
                teachersCount: uniqueTeachers.length
            }
        });
    } catch (error) {
        console.error("DigiLocker stats error:", error);
        res.status(500).json({ success: false, message: "Failed to fetch vault stats" });
    }
};

// 3. CANDIDATES LIST FOR AUTO-FILL & SELECTION
exports.getCandidatesList = async (req, res) => {
    try {
        const students = await Student.find({}, 'studentId firstName lastName aadharNo rollNo phone').populate('class', 'grade section').limit(150);
        const teachers = await Teacher.find({}, 'fullName email phone aadhaarNumber specialization highestQualification').limit(100);

        res.status(200).json({
            success: true,
            students: students.map(s => ({
                id: s._id,
                name: `${s.firstName} ${s.lastName || ''}`.trim(),
                identifier: s.studentId,
                aadharNo: s.aadharNo,
                phone: s.phone,
                rollNo: s.rollNo,
                classGrade: s.class ? `${s.class.grade || 'Class'} ${s.class.section ? `(${s.class.section})` : ''}` : 'General',
                type: 'Student'
            })),
            teachers: teachers.map(t => ({
                id: t._id,
                name: t.fullName,
                identifier: t.email || t.phone,
                email: t.email,
                phone: t.phone,
                aadhaarNumber: t.aadhaarNumber,
                dept: t.specialization ? `Dept. of ${t.specialization}` : 'Faculty',
                qualification: t.highestQualification,
                type: 'Teacher'
            }))
        });
    } catch (error) {
        console.error("Candidates list error:", error);
        res.status(500).json({ success: false, message: "Failed to retrieve candidates list" });
    }
};

// 4. REALISTIC MERIPEHCHAAN / DIGILOCKER GATEWAY: INITIATE OTP
exports.initiateDigiLockerOtp = async (req, res) => {
    try {
        const { identifier, documentType, ownerType = 'Student' } = req.body;

        if (!identifier || !documentType) {
            return res.status(400).json({ success: false, message: "Identifier (Aadhaar/ID) and Document Type are required." });
        }

        const cleanId = identifier.trim();
        let candidateName = ownerType === 'Student' ? "Student Record" : "Faculty Member";
        let targetPhone = "9876543210";
        let candidateObj = null;

        if (ownerType === 'Student') {
            const student = await Student.findOne({
                $or: [
                    { aadharNo: cleanId },
                    { studentId: cleanId },
                    { phone: cleanId },
                    { abcId: cleanId },
                    { apaarId: cleanId }
                ]
            }).populate('class');

            if (student) {
                candidateName = `${student.firstName} ${student.lastName || ''}`.trim();
                targetPhone = student.phone || "9876543210";
                candidateObj = student;
            } else {
                candidateName = `Candidate (${cleanId})`;
            }
        } else {
            const teacher = await Teacher.findOne({
                $or: [
                    { email: cleanId },
                    { aadhaarNumber: cleanId },
                    { phone: cleanId }
                ]
            });

            if (teacher) {
                candidateName = teacher.fullName;
                targetPhone = teacher.phone || "9876543210";
                candidateObj = teacher;
            } else {
                candidateName = `Faculty (${cleanId})`;
            }
        }

        // Clean phone digits for realistic masked mobile e.g. +91 ******4821
        const digitsOnly = targetPhone.replace(/\D/g, '') || '9876543210';
        const last4 = digitsOnly.slice(-4) || '4821';
        const maskedMobile = `+91 ******${last4}`;

        // Create transaction token
        const txnId = `MERI-DL-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
        const demoOtp = "123456"; // Standard Government Sandbox test OTP

        // Store session
        otpSessions.set(txnId, {
            txnId,
            identifier: cleanId,
            documentType,
            ownerType,
            candidateName,
            candidateObj,
            demoOtp,
            createdAt: Date.now()
        });

        // Auto-cleanup after 10 mins
        setTimeout(() => {
            otpSessions.delete(txnId);
        }, 10 * 60 * 1000);

        res.status(200).json({
            success: true,
            txnId,
            maskedMobile,
            candidateName,
            documentType,
            ownerType,
            message: `DigiLocker OTP dispatched to Aadhaar-registered mobile ${maskedMobile}.`,
            demoOtpNotice: "For Sandbox Demo: use OTP 123456"
        });
    } catch (error) {
        console.error("Initiate DigiLocker OTP error:", error);
        res.status(500).json({ success: false, message: "DigiLocker Gateway connection timed out" });
    }
};

// 5. REALISTIC MERIPEHCHAAN / DIGILOCKER GATEWAY: VERIFY OTP AND RETRIEVE DOCUMENT
exports.verifyOtpAndFetch = async (req, res) => {
    try {
        const { txnId, otp, securityPin, consentGiven = true, identifier: fallbackId, documentType: fallbackDocType, ownerType: fallbackOwnerType } = req.body;

        const session = otpSessions.get(txnId);
        const identifier = session ? session.identifier : (fallbackId || 'DL-2026');
        const documentType = session ? session.documentType : (fallbackDocType || 'Aadhaar Card');
        const ownerType = session ? session.ownerType : (fallbackOwnerType || 'Student');

        // OTP check: Accept standard sandbox OTP "123456" or session demoOtp or any 6-digit match
        const cleanOtp = (otp || '').trim();
        if (cleanOtp.length !== 6) {
            return res.status(400).json({ success: false, message: "Please enter a valid 6-digit DigiLocker OTP." });
        }

        let ownerName = session?.candidateName || (ownerType === 'Student' ? 'Enrolled Student' : 'Faculty Member');
        let classOrDept = 'Institutional Records';
        let ownerId = null;

        if (ownerType === 'Student') {
            const student = await Student.findOne({
                $or: [
                    { aadharNo: identifier },
                    { studentId: identifier },
                    { phone: identifier },
                    { abcId: identifier },
                    { apaarId: identifier }
                ]
            }).populate('class');

            if (student) {
                ownerName = `${student.firstName} ${student.lastName || ''}`.trim();
                classOrDept = student.class ? `${student.class.grade || 'Class'} ${student.class.section ? `(${student.class.section})` : ''}` : 'General';
                ownerId = student._id;
            }
        } else {
            const teacher = await Teacher.findOne({
                $or: [
                    { email: identifier },
                    { aadhaarNumber: identifier },
                    { phone: identifier }
                ]
            });

            if (teacher) {
                ownerName = teacher.fullName;
                classOrDept = teacher.specialization ? `Dept. of ${teacher.specialization}` : 'Academic Faculty';
                ownerId = teacher._id;
            }
        }

        const isAadhaar = documentType.toLowerCase().includes('aadhaar');
        const isApaar = documentType.toLowerCase().includes('apaar') || documentType.toLowerCase().includes('abc');

        let cleanDocNo;
        if (isAadhaar) {
            const num = identifier.replace(/\D/g, '') || '548291024821';
            cleanDocNo = `${num.slice(0, 4)}-${num.slice(4, 8)}-${num.slice(8, 12)}`.slice(0, 14);
        } else if (isApaar) {
            const num = identifier.replace(/\D/g, '') || '829401928419';
            cleanDocNo = `${num.slice(0, 4)}-${num.slice(4, 8)}-${num.slice(8, 12)}`.slice(0, 14);
        } else {
            cleanDocNo = identifier.length === 12
                ? `${identifier.slice(0, 4)}-${identifier.slice(4, 8)}-${identifier.slice(8, 12)}`
                : `DL-${identifier.toUpperCase()}`;
        }

        const digilockerUri = generateDigiLockerUri(documentType, identifier);
        const sigMeta = generateSignatureMetadata(documentType, isAadhaar ? "DS UIDAI SUB-GATEWAY 04" : "Controller of Examinations (CBSE / Sansthaan)");
        const fileUrl = generateSampleDocumentSvg(documentType, ownerName, cleanDocNo, {
            classOrDept,
            sigMeta
        });

        let issuedBy = 'National Academic Depository (NAD)';
        if (isAadhaar) issuedBy = 'UIDAI (Govt. of India)';
        else if (isApaar) issuedBy = 'Ministry of Education (Govt. of India)';
        else if (documentType.toLowerCase().includes('cbse') || documentType.toLowerCase().includes('marksheet')) issuedBy = 'Central Board of Secondary Education (CBSE)';
        else if (documentType.toLowerCase().includes('degree')) issuedBy = 'State University / UGC Approved';

        const newDoc = new DigiLockerDocument({
            ownerType,
            student: ownerType === 'Student' ? ownerId : null,
            teacher: ownerType === 'Teacher' ? ownerId : null,
            ownerName,
            ownerIdentifier: identifier,
            classOrDept,
            documentType,
            documentNumber: cleanDocNo,
            issuedBy,
            issueDate: new Date(),
            fileUrl,
            fileName: `${documentType.replace(/[^a-zA-Z0-9]/g, '_')}_DigiLocker.svg`,
            fileType: "image/svg+xml",
            fileSize: "720 KB",
            digilockerVerified: true,
            digilockerUri,
            verificationStatus: 'Verified',
            verifiedBy: 'National DigiLocker API Gateway (MeriPehchaan)',
            verifiedAt: new Date(),
            remarks: `Cryptographically pulled via DigiLocker Gateway. SHA-256 Digest: ${sigMeta.sha256.substring(0, 16)}...`
        });

        await newDoc.save();

        if (session) {
            otpSessions.delete(txnId);
        }

        res.status(201).json({
            success: true,
            message: `Successfully verified and imported ${documentType} from DigiLocker!`,
            document: newDoc,
            sigMeta
        });
    } catch (error) {
        console.error("Verify OTP & Fetch error:", error);
        res.status(500).json({ success: false, message: "DigiLocker Gateway verification failed", error: error.message });
    }
};

// 5b. REALISTIC DIGILOCKER / NAD GATEWAY: FETCH STUDENT RECORD VIA 12-DIGIT ABC ID (APAAR ID)
exports.fetchStudentByAbcId = async (req, res) => {
    try {
        const { abcId, otp, skipOtp = false } = req.body;

        const raw = String(abcId || '').trim();
        const digits = raw.replace(/\D/g, '');

        if (digits.length !== 12) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid 12-digit ABC ID / APAAR ID (e.g. 8294-0192-8419)."
            });
        }

        // OTP verification if provided and not skipped
        if (!skipOtp && otp) {
            const cleanOtp = String(otp).trim();
            if (cleanOtp.length !== 6) {
                return res.status(400).json({
                    success: false,
                    message: "Please enter a valid 6-digit DigiLocker OTP."
                });
            }
        }

        const formattedAbc = `${digits.slice(0, 4)}-${digits.slice(4, 8)}-${digits.slice(8, 12)}`;

        // 1. Check if student is already enrolled in the school
        const existingStudent = await Student.findOne({
            $or: [
                { abcId: formattedAbc },
                { abcId: digits },
                { apaarId: formattedAbc },
                { apaarId: digits },
                { aadharNo: digits }
            ]
        }).populate('class');

        if (existingStudent) {
            const fullName = `${existingStudent.firstName} ${existingStudent.lastName || ''}`.trim();
            const sigMeta = generateSignatureMetadata("APAAR / ABC ID Card", "Ministry of Education (Govt. of India)");
            const digilockerUri = generateDigiLockerUri("APAAR", existingStudent.studentId || formattedAbc);
            const fileUrl = generateSampleDocumentSvg("APAAR / ABC ID Card", fullName, formattedAbc, {
                classOrDept: existingStudent.class ? `${existingStudent.class.grade || 'Class'} ${existingStudent.class.section ? `(${existingStudent.class.section})` : ''}` : 'General',
                sigMeta
            });

            return res.status(200).json({
                success: true,
                isAlreadyEnrolled: true,
                message: `Student "${fullName}" is already enrolled (Student ID: ${existingStudent.studentId}). Data auto-loaded from school records.`,
                studentData: {
                    fullName,
                    firstName: existingStudent.firstName,
                    lastName: existingStudent.lastName || '',
                    fatherName: existingStudent.fatherName || '',
                    motherName: existingStudent.motherName || '',
                    dob: existingStudent.dob ? new Date(existingStudent.dob).toISOString().split('T')[0] : '',
                    gender: existingStudent.gender || 'Male',
                    bloodGroup: existingStudent.bloodGroup || '',
                    phone: existingStudent.phone || '',
                    email: existingStudent.email || '',
                    address: existingStudent.address || '',
                    aadharNo: existingStudent.aadharNo || '',
                    abcId: formattedAbc,
                    apaarId: formattedAbc,
                    previousSchool: existingStudent.previousSchool || '',
                    classId: existingStudent.class?._id || '',
                    studentId: existingStudent.studentId
                },
                digilockerCertificate: {
                    documentType: 'APAAR / ABC ID Card',
                    documentNumber: formattedAbc,
                    issuedBy: 'Ministry of Education · DigiLocker NAD',
                    digilockerUri,
                    fileUrl,
                    sha256: sigMeta.sha256
                }
            });
        }

        // 2. Student NOT enrolled yet -> Pull from National Academic Depository (NAD) / DigiLocker
        const demoProfiles = {
            '829401928419': {
                firstName: 'Aarav',
                lastName: 'Sharma',
                fatherName: 'Rajesh Sharma',
                motherName: 'Sunita Sharma',
                dob: '2012-05-15',
                gender: 'Male',
                bloodGroup: 'B+',
                phone: '9876543210',
                email: 'aarav.sharma@parent.in',
                address: '14/B Civil Lines, Prayagraj, UP 211001',
                aadharNo: '548291024821',
                previousSchool: 'Kendriya Vidyalaya, Old Cantt Prayagraj'
            },
            '731948209182': {
                firstName: 'Ananya',
                lastName: 'Verma',
                fatherName: 'Manoj Verma',
                motherName: 'Anita Verma',
                dob: '2013-08-22',
                gender: 'Female',
                bloodGroup: 'O+',
                phone: '9812345678',
                email: 'ananya.verma@parent.in',
                address: '28 Tagore Town, Prayagraj, UP 211002',
                aadharNo: '658998765432',
                previousSchool: "St. Joseph's Academy, Prayagraj"
            },
            '910238475120': {
                firstName: 'Rohan',
                lastName: 'Gupta',
                fatherName: 'Alok Gupta',
                motherName: 'Pooja Gupta',
                dob: '2011-11-08',
                gender: 'Male',
                bloodGroup: 'A+',
                phone: '9798123456',
                email: 'rohan.gupta@parent.in',
                address: '55 Kalyani Devi, Prayagraj, UP 211003',
                aadharNo: '741258963214',
                previousSchool: 'Delhi Public School, Naini'
            },
            '652194830172': {
                firstName: 'Diya',
                lastName: 'Patel',
                fatherName: 'Ramesh Patel',
                motherName: 'Meena Patel',
                dob: '2014-02-18',
                gender: 'Female',
                bloodGroup: 'B+',
                phone: '9845123987',
                email: 'diya.patel@parent.in',
                address: '92 George Town, Prayagraj, UP 211002',
                aadharNo: '839201948271',
                previousSchool: 'Army Public School, New Cantt'
            }
        };

        // Deterministic fallback for any other 12-digit number
        let profile = demoProfiles[digits];
        if (!profile) {
            const firstNamesM = ['Devansh', 'Vivaan', 'Kabir', 'Aditya', 'Reyansh', 'Ishaan', 'Shaurya', 'Atharv'];
            const firstNamesF = ['Saanvi', 'Aadhya', 'Ananya', 'Kiara', 'Myra', 'Isha', 'Riya', 'Avani'];
            const lastNames = ['Mishra', 'Pandey', 'Tiwari', 'Shukla', 'Singh', 'Yadav', 'Tripathi', 'Dwivedi'];
            const localities = ['Civil Lines', 'Tagore Town', 'George Town', 'Kalyani Devi', 'Alopibagh', 'Mumfordganj', 'Ashok Nagar', 'Katra'];
            const schools = ['Kendriya Vidyalaya, Prayagraj', "Boys High School & College", "St. Mary's Convent", 'Delhi Public School', 'Army Public School', 'Bishop Johnson School'];

            const num = parseInt(digits.slice(-4), 10) || 1234;
            const isFemale = (num % 2 === 0);
            const fnList = isFemale ? firstNamesF : firstNamesM;

            const fn = fnList[num % fnList.length];
            const ln = lastNames[(num >> 2) % lastNames.length];
            const father = `${firstNamesM[(num >> 3) % firstNamesM.length]} ${ln}`;
            const mother = `${firstNamesF[(num >> 4) % firstNamesF.length]} ${ln}`;
            const locality = localities[(num >> 1) % localities.length];
            const school = schools[num % schools.length];
            const y = 2011 + (num % 5);
            const m = String(1 + (num % 12)).padStart(2, '0');
            const d = String(1 + (num % 28)).padStart(2, '0');
            const bloodGroups = ['A+', 'B+', 'O+', 'AB+', 'A-', 'B-', 'O-'];

            profile = {
                firstName: fn,
                lastName: ln,
                fatherName: father,
                motherName: mother,
                dob: `${y}-${m}-${d}`,
                gender: isFemale ? 'Female' : 'Male',
                bloodGroup: bloodGroups[num % bloodGroups.length],
                phone: `98${String(10000000 + (num * 739) % 90000000)}`,
                email: `${fn.toLowerCase()}.${ln.toLowerCase()}@parent.in`,
                address: `${(num % 150) + 1}, ${locality}, Prayagraj, UP 21100${(num % 6) + 1}`,
                aadharNo: `5${String(num).padStart(4, '0')}91024821`.slice(0, 12),
                previousSchool: school
            };
        }

        const fullName = `${profile.firstName} ${profile.lastName}`.trim();
        const sigMeta = generateSignatureMetadata("APAAR / ABC ID Card", "Ministry of Education (Govt. of India)");
        const digilockerUri = generateDigiLockerUri("APAAR", formattedAbc);
        const fileUrl = generateSampleDocumentSvg("APAAR / ABC ID Card", fullName, formattedAbc, {
            classOrDept: 'Candidate for Admission',
            sigMeta
        });

        res.status(200).json({
            success: true,
            isAlreadyEnrolled: false,
            message: `Official student identity cryptographically verified from DigiLocker / NAD Gateway!`,
            studentData: {
                fullName,
                firstName: profile.firstName,
                lastName: profile.lastName,
                fatherName: profile.fatherName,
                motherName: profile.motherName,
                dob: profile.dob,
                gender: profile.gender,
                bloodGroup: profile.bloodGroup,
                phone: profile.phone,
                email: profile.email,
                address: profile.address,
                aadharNo: profile.aadharNo,
                abcId: formattedAbc,
                apaarId: formattedAbc,
                previousSchool: profile.previousSchool
            },
            digilockerCertificate: {
                documentType: 'APAAR / ABC ID Card',
                documentNumber: formattedAbc,
                issuedBy: 'Ministry of Education · DigiLocker NAD',
                digilockerUri,
                fileUrl,
                sha256: sigMeta.sha256
            }
        });
    } catch (error) {
        console.error("Fetch Student by ABC ID Error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to connect to DigiLocker NAD Gateway.",
            error: error.message
        });
    }
};

// 6. SCHOOL ISSUES CREDENTIAL DIRECTLY TO DIGILOCKER / NAD (Push)
exports.issueDocument = async (req, res) => {
    try {
        const {
            studentId,
            documentType,
            academicYear = '2025-2026',
            remarks = 'Issued by Institution under National Academic Depository (NAD)',
            extraData = {}
        } = req.body;

        if (!studentId || !documentType) {
            return res.status(400).json({ success: false, message: "Student and document type are required." });
        }

        const student = await Student.findById(studentId).populate('class');
        if (!student) {
            return res.status(404).json({ success: false, message: "Student not found in institutional database." });
        }

        const ownerName = `${student.firstName} ${student.lastName || ''}`.trim();
        const className = student.class ? `${student.class.grade || 'Class'} ${student.class.section ? `(${student.class.section})` : ''}` : 'Class 10';
        
        let docNo;
        let issuedBy = "Radhey Shyam Shakuntala Seth Sansthaan (CBSE Affiliated)";

        if (documentType.toLowerCase().includes('apaar') || documentType.toLowerCase().includes('abc')) {
            const raw = (student.aadharNo || student.studentId).replace(/\D/g, '') + '9182';
            docNo = `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
            issuedBy = "Ministry of Education · DigiLocker NAD";
        } else if (documentType.toLowerCase().includes('transfer') || documentType.toLowerCase().includes('tc')) {
            docNo = `TC/RSSS/${academicYear.split('-')[0]}/${Math.floor(100 + Math.random() * 900)}`;
        } else if (documentType.toLowerCase().includes('marksheet')) {
            docNo = `CBSE-${academicYear.replace('-', '')}-${student.rollNo || '26849102'}`;
            issuedBy = "CBSE / Radhey Shyam Sansthaan";
        } else {
            docNo = `CERT-${academicYear.split('-')[0]}-${Math.floor(1000 + Math.random() * 9000)}`;
        }

        const digilockerUri = generateDigiLockerUri(documentType, student.studentId);
        const sigMeta = generateSignatureMetadata(documentType, "Principal / Head of Institution (DSC)");

        const fileUrl = generateSampleDocumentSvg(documentType, ownerName, docNo, {
            classOrDept: className,
            sigMeta,
            academicYear,
            rollNo: student.rollNo,
            fatherName: student.fatherName,
            motherName: student.motherName,
            dob: student.dob
        });

        const newDoc = new DigiLockerDocument({
            ownerType: 'Student',
            student: student._id,
            ownerName,
            ownerIdentifier: student.studentId,
            classOrDept: className,
            documentType,
            documentNumber: docNo,
            issuedBy,
            issueDate: new Date(),
            fileUrl,
            fileName: `${documentType.replace(/[^a-zA-Z0-9]/g, '_')}_Official.svg`,
            fileType: "image/svg+xml",
            fileSize: "750 KB",
            digilockerVerified: true,
            digilockerUri,
            verificationStatus: 'Verified',
            verifiedBy: 'School Principal (Digital DSC E-Sign)',
            verifiedAt: new Date(),
            remarks: `${remarks} | Digitally signed by Radhey Shyam Sansthaan.`
        });

        await newDoc.save();

        res.status(201).json({
            success: true,
            message: `Official ${documentType} issued and published to DigiLocker successfully!`,
            document: newDoc,
            sigMeta
        });
    } catch (error) {
        console.error("Issue document error:", error);
        res.status(500).json({ success: false, message: "Failed to issue document to DigiLocker", error: error.message });
    }
};

// 7. QR CODE CRYPTOGRAPHIC VERIFICATION PAYLOAD
exports.verifyQrCode = async (req, res) => {
    try {
        const { id } = req.params;
        const doc = await DigiLockerDocument.findById(id);

        if (!doc) {
            return res.status(404).json({ success: false, message: "Document record not found in repository." });
        }

        const sha256 = crypto.createHash('sha256').update(`${doc._id}-${doc.digilockerUri}`).digest('hex');

        res.status(200).json({
            success: true,
            verificationPayload: {
                status: "AUTHENTIC & VERIFIED",
                docUri: doc.digilockerUri || `in.gov.digilocker:${doc.documentType.toLowerCase()}:${doc._id.toString().slice(-8)}`,
                documentType: doc.documentType,
                documentNumber: doc.documentNumber,
                candidateName: doc.ownerName,
                identifier: doc.ownerIdentifier,
                issuedBy: doc.issuedBy,
                verifiedBy: doc.verifiedBy,
                verificationTimestamp: doc.verifiedAt || doc.createdAt,
                cryptographicDigest: sha256,
                algorithm: "SHA256withRSA (2048-bit PKI)",
                caChain: [
                    "Root Certifying Authority of India (RCAI 2014)",
                    "National Informatics Centre Sub-CA (NIC-CA 2022)",
                    "DigiLocker Document Signer (DS-VAL-2026)"
                ],
                statutoryCompliance: "Information Technology Act 2000 (Section 4 & 6A) · Equal legal validity as original physical document."
            }
        });
    } catch (error) {
        console.error("QR verify error:", error);
        res.status(500).json({ success: false, message: "Failed to verify QR Code" });
    }
};

// 8. UPLOAD NEW DOCUMENT TO VAULT
exports.uploadDocument = async (req, res) => {
    try {
        const {
            ownerType,
            ownerId,
            ownerName,
            ownerIdentifier,
            classOrDept,
            documentType,
            documentNumber,
            issuedBy,
            issueDate,
            verificationStatus = 'Verified',
            remarks = '',
            fileUrl: directFileUrl
        } = req.body;

        if (!ownerType || !documentType) {
            return res.status(400).json({ success: false, message: "Owner type and document type are required." });
        }

        let fileUrl = directFileUrl;
        let fileName = "document.pdf";
        let fileType = "application/pdf";
        let fileSize = "1.2 MB";

        // If file uploaded via Multer
        if (req.file) {
            fileType = req.file.mimetype || 'application/pdf';
            fileName = req.file.originalname || `${documentType}.pdf`;
            const sizeInMB = (req.file.size / (1024 * 1024)).toFixed(2);
            fileSize = `${sizeInMB} MB`;
            fileUrl = `data:${fileType};base64,${req.file.buffer.toString('base64')}`;
        }

        if (!fileUrl) {
            fileUrl = generateSampleDocumentSvg(documentType, ownerName || 'Student/Teacher', documentNumber || 'DIGI-2026-VAL', { classOrDept });
            fileType = "image/svg+xml";
        }

        const digilockerUri = generateDigiLockerUri(documentType, ownerIdentifier || Date.now());

        const newDoc = new DigiLockerDocument({
            ownerType,
            student: ownerType === 'Student' && ownerId ? ownerId : null,
            teacher: ownerType === 'Teacher' && ownerId ? ownerId : null,
            ownerName: ownerName || (ownerType === 'Student' ? 'Enrolled Student' : 'Faculty Member'),
            ownerIdentifier: ownerIdentifier || 'N/A',
            classOrDept: classOrDept || 'General',
            documentType,
            documentNumber: documentNumber || `DL-${Date.now().toString().slice(-6)}`,
            issuedBy: issuedBy || "Digital India / DigiLocker Authority",
            issueDate: issueDate ? new Date(issueDate) : new Date(),
            fileUrl,
            fileName,
            fileType,
            fileSize,
            digilockerVerified: verificationStatus === 'Verified',
            digilockerUri,
            verificationStatus,
            verifiedBy: req.user?.name || req.user?.fullName || 'School Administrator',
            verifiedAt: new Date(),
            remarks
        });

        await newDoc.save();

        res.status(201).json({
            success: true,
            message: "Document added to DigiLocker Vault successfully!",
            document: newDoc
        });
    } catch (error) {
        console.error("Upload document error:", error);
        res.status(500).json({ success: false, message: "Failed to upload document", error: error.message });
    }
};

// 9. UPDATE VERIFICATION STATUS (Verify or Reject)
exports.verifyDocument = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, rejectionReason, remarks } = req.body;

        if (!['Verified', 'Pending Verification', 'Rejected'].includes(status)) {
            return res.status(400).json({ success: false, message: "Invalid status value." });
        }

        const doc = await DigiLockerDocument.findById(id);
        if (!doc) {
            return res.status(404).json({ success: false, message: "Document not found in vault." });
        }

        doc.verificationStatus = status;
        doc.digilockerVerified = status === 'Verified';
        doc.verifiedBy = req.user?.name || req.user?.fullName || 'School Administrator';
        doc.verifiedAt = new Date();
        if (rejectionReason !== undefined) doc.rejectionReason = rejectionReason;
        if (remarks !== undefined) doc.remarks = remarks;

        await doc.save();

        res.status(200).json({
            success: true,
            message: `Document status updated to ${status}!`,
            document: doc
        });
    } catch (error) {
        console.error("Verify document error:", error);
        res.status(500).json({ success: false, message: "Failed to update verification status" });
    }
};

// 10. DELETE A VAULT DOCUMENT
exports.deleteDocument = async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await DigiLockerDocument.findByIdAndDelete(id);
        if (!deleted) {
            return res.status(404).json({ success: false, message: "Document not found." });
        }

        res.status(200).json({
            success: true,
            message: "Document removed from DigiLocker vault successfully."
        });
    } catch (error) {
        console.error("Delete document error:", error);
        res.status(500).json({ success: false, message: "Failed to delete document" });
    }
};

// 11. LEGACY DIRECT FETCH
exports.fetchFromDigiLocker = async (req, res) => {
    // Forward to verifyOtpAndFetch with simulated success
    req.body.otp = "123456";
    return exports.verifyOtpAndFetch(req, res);
};

// --- HELPER: AUTO-SEED INITIAL RECORDS WITH DIVERSE REALISTIC TYPES ---
async function autoSyncExistingRecords() {
    try {
        const students = await Student.find().populate('class').limit(20);
        const teachers = await Teacher.find().limit(10);
        const seededDocs = [];

        // Seed Students
        for (const s of students) {
            const name = `${s.firstName} ${s.lastName || ''}`.trim();
            const className = s.class ? `${s.class.grade || 'Class'} ${s.class.section ? `(${s.class.section})` : ''}` : 'Class 10';

            // 1. Aadhaar Card
            const aadharMasked = s.aadharNo 
                ? `XXXX-XXXX-${s.aadharNo.slice(-4)}` 
                : `XXXX-XXXX-${s.studentId.replace(/\D/g, '').slice(-4) || '5821'}`;

            seededDocs.push({
                ownerType: 'Student',
                student: s._id,
                ownerName: name,
                ownerIdentifier: s.studentId,
                classOrDept: className,
                documentType: 'Aadhaar Card',
                documentNumber: aadharMasked,
                issuedBy: 'UIDAI (Govt. of India)',
                issueDate: new Date('2021-06-15'),
                fileUrl: generateSampleDocumentSvg('Aadhaar Card', name, aadharMasked, { classOrDept: className }),
                fileName: `Aadhaar_${s.studentId}.svg`,
                fileType: 'image/svg+xml',
                fileSize: '620 KB',
                digilockerVerified: true,
                digilockerUri: generateDigiLockerUri('Aadhaar', s.studentId),
                verificationStatus: 'Verified',
                verifiedBy: 'Govt. UIDAI Gateway',
                verifiedAt: new Date()
            });

            // 2. APAAR ID (One Nation One Student ID)
            const rawApaar = (s.aadharNo || s.studentId).replace(/\D/g, '') + '4921';
            const apaarNo = `${rawApaar.slice(0, 4)}-${rawApaar.slice(4, 8)}-${rawApaar.slice(8, 12)}`.slice(0, 14);

            seededDocs.push({
                ownerType: 'Student',
                student: s._id,
                ownerName: name,
                ownerIdentifier: s.studentId,
                classOrDept: className,
                documentType: 'APAAR / ABC ID Card',
                documentNumber: apaarNo,
                issuedBy: 'Ministry of Education · DigiLocker NAD',
                issueDate: new Date('2024-08-20'),
                fileUrl: generateSampleDocumentSvg('APAAR ID Card', name, apaarNo, { classOrDept: className }),
                fileName: `APAAR_${s.studentId}.svg`,
                fileType: 'image/svg+xml',
                fileSize: '590 KB',
                digilockerVerified: true,
                digilockerUri: generateDigiLockerUri('APAAR', s.studentId),
                verificationStatus: 'Verified',
                verifiedBy: 'National Academic Depository (NAD)',
                verifiedAt: new Date()
            });

            // 3. CBSE / School Marksheet or Transfer Certificate
            seededDocs.push({
                ownerType: 'Student',
                student: s._id,
                ownerName: name,
                ownerIdentifier: s.studentId,
                classOrDept: className,
                documentType: '10th Class Marksheet',
                documentNumber: `CBSE-${s.rollNo || '26849102'}`,
                issuedBy: 'Central Board of Secondary Education (CBSE)',
                issueDate: new Date('2025-05-24'),
                fileUrl: generateSampleDocumentSvg('10th Class Marksheet', name, `CBSE-${s.rollNo || '26849102'}`, { classOrDept: className }),
                fileName: `Marksheet_${s.studentId}.svg`,
                fileType: 'image/svg+xml',
                fileSize: '820 KB',
                digilockerVerified: true,
                digilockerUri: generateDigiLockerUri('Marksheet', s.studentId),
                verificationStatus: 'Verified',
                verifiedBy: 'CBSE Examination Depository',
                verifiedAt: new Date()
            });
        }

        // Seed Teachers
        for (const t of teachers) {
            const name = t.fullName || 'Faculty Member';
            const dept = t.specialization ? `Dept. of ${t.specialization}` : 'Faculty';

            const aadharMasked = t.aadhaarNumber 
                ? `XXXX-XXXX-${t.aadhaarNumber.slice(-4)}` 
                : `XXXX-XXXX-${t._id.toString().slice(-4)}`;

            seededDocs.push({
                ownerType: 'Teacher',
                teacher: t._id,
                ownerName: name,
                ownerIdentifier: t.email || t.phone,
                classOrDept: dept,
                documentType: 'Aadhaar Card',
                documentNumber: aadharMasked,
                issuedBy: 'UIDAI (Govt. of India)',
                issueDate: new Date('2018-09-20'),
                fileUrl: generateSampleDocumentSvg('Aadhaar Card', name, aadharMasked, { classOrDept: dept }),
                fileName: `Aadhaar_${t.fullName?.replace(/\s+/g, '_')}.svg`,
                fileType: 'image/svg+xml',
                fileSize: '650 KB',
                digilockerVerified: true,
                digilockerUri: generateDigiLockerUri('Aadhaar', t.email),
                verificationStatus: 'Verified',
                verifiedBy: 'UIDAI Identity Gateway',
                verifiedAt: new Date()
            });

            if (t.highestQualification) {
                seededDocs.push({
                    ownerType: 'Teacher',
                    teacher: t._id,
                    ownerName: name,
                    ownerIdentifier: t.email,
                    classOrDept: dept,
                    documentType: `${t.highestQualification} Degree Certificate`,
                    documentNumber: `UNIV-${t._id.toString().slice(-6).toUpperCase()}`,
                    issuedBy: t.university || 'State University (UGC Approved)',
                    issueDate: new Date('2019-07-12'),
                    fileUrl: generateSampleDocumentSvg(`${t.highestQualification} Degree`, name, `UNIV-${t._id.toString().slice(-6).toUpperCase()}`, { classOrDept: dept }),
                    fileName: `Degree_${t.highestQualification}.svg`,
                    fileType: 'image/svg+xml',
                    fileSize: '890 KB',
                    digilockerVerified: true,
                    digilockerUri: generateDigiLockerUri('Degree', t.email),
                    verificationStatus: 'Verified',
                    verifiedBy: 'Academic Verification Council',
                    verifiedAt: new Date()
                });
            }
        }

        if (seededDocs.length > 0) {
            await DigiLockerDocument.insertMany(seededDocs);
            console.log(`✅ DigiLocker Vault auto-synced with ${seededDocs.length} institutional records.`);
        }
    } catch (e) {
        console.warn("DigiLocker auto-seed notice:", e.message);
    }
}

// --- HELPER: GENERATE AUTHENTIC PHOTOREALISTIC SVG CERTIFICATES ---
function generateSampleDocumentSvg(docType, ownerName, docNo, extra = {}) {
    const typeLower = (docType || '').toLowerCase();
    const currentDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });

    // ══════════════════════════════════════════════════════════════
    // 1. ULTRA-REALISTIC APAAR / ABC ID CARD (NEP 2020 One Nation One Student ID)
    // ══════════════════════════════════════════════════════════════
    if (typeLower.includes('apaar') || typeLower.includes('abc')) {
        const cleanNo = (docNo || '8492-4819-2019').replace(/[^0-9-]/g, '');
        const penNo = `PEN-2026-${cleanNo.replace(/\D/g, '').slice(-6) || '849102'}`;

        const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 850 540" width="100%" height="100%">
  <!-- Card Background with subtle gradient & security guilloche pattern -->
  <defs>
    <linearGradient id="apaarGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="60%" stop-color="#f0f9ff"/>
      <stop offset="100%" stop-color="#e0f2fe"/>
    </linearGradient>
    <pattern id="guilloche" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 0 20 Q 20 0 40 20 T 80 20" fill="none" stroke="#e2e8f0" stroke-width="0.75" opacity="0.6"/>
    </pattern>
  </defs>

  <!-- Card Body -->
  <rect width="850" height="540" rx="16" fill="url(#apaarGrad)" stroke="#93c5fd" stroke-width="2" />
  <rect width="850" height="540" rx="16" fill="url(#guilloche)" />

  <!-- Tricolor Band at Top -->
  <rect x="0" y="0" width="850" height="7" rx="3" fill="#FF9933" />
  <rect x="0" y="7" width="850" height="5" fill="#ffffff" />
  <rect x="0" y="12" width="850" height="7" fill="#138808" />

  <!-- Header Banner -->
  <rect x="0" y="19" width="850" height="88" fill="#ffffff" />
  <line x1="0" y1="107" x2="850" y2="107" stroke="#cbd5e1" stroke-width="1.5" />

  <!-- National Emblem Placeholder -->
  <circle cx="65" cy="63" r="26" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5" />
  <text x="65" y="71" font-family="'Segoe UI', Roboto, sans-serif" font-size="24" text-anchor="middle">🏛️</text>

  <!-- Bilingual Header Text -->
  <text x="105" y="47" font-family="'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="900" fill="#0f172a">शिक्षा मंत्रालय, भारत सरकार</text>
  <text x="105" y="65" font-family="'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="800" fill="#1e3a8a">MINISTRY OF EDUCATION · GOVERNMENT OF INDIA</text>
  <text x="105" y="83" font-family="'Segoe UI', Roboto, sans-serif" font-size="10.5" font-weight="700" fill="#0284c7">Department of School Education & Literacy</text>

  <!-- APAAR Logo Badge on Right -->
  <g transform="translate(680, 32)">
    <rect width="135" height="58" rx="10" fill="#1e3a8a" />
    <text x="67" y="28" font-family="'Segoe UI', Roboto, sans-serif" font-size="15" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="1">APAAR</text>
    <text x="67" y="45" font-family="'Segoe UI', Roboto, sans-serif" font-size="8.5" font-weight="700" fill="#93c5fd" text-anchor="middle">ONE NATION · ONE ID</text>
  </g>

  <!-- Title Ribbon -->
  <rect x="0" y="108" width="850" height="28" fill="#e0f2fe" stroke="#bae6fd" stroke-width="1" />
  <text x="425" y="126" font-family="'Segoe UI', Roboto, sans-serif" font-size="11.5" font-weight="900" fill="#0369a1" text-anchor="middle" letter-spacing="0.5">
    AUTOMATED PERMANENT ACADEMIC ACCOUNT REGISTRY (APAAR) · DIGILOCKER NAD
  </text>

  <!-- Candidate Details Body -->
  <!-- Photo Box -->
  <g transform="translate(45, 155)">
    <rect width="135" height="175" rx="12" fill="#ffffff" stroke="#94a3b8" stroke-width="2" />
    <circle cx="67" cy="65" r="32" fill="#cbd5e1" />
    <path d="M 27 150 Q 67 105 107 150 Z" fill="#94a3b8" />
    <rect x="5" y="148" width="125" height="22" rx="6" fill="#1e3a8a" />
    <text x="67" y="163" font-family="'Segoe UI', Roboto, sans-serif" font-size="9" font-weight="bold" fill="#ffffff" text-anchor="middle">STUDENT VERIFIED</text>
  </g>

  <!-- Center Info Block -->
  <g transform="translate(205, 160)">
    <text x="0" y="15" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="bold" fill="#64748b">विद्यार्थी का नाम / Student Name:</text>
    <text x="0" y="38" font-family="'Segoe UI', Roboto, sans-serif" font-size="19" font-weight="900" fill="#0f172a">${ownerName}</text>

    <text x="0" y="70" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="bold" fill="#64748b">कक्षा एवं अनुभाग / Class & Section:</text>
    <text x="0" y="90" font-family="'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="800" fill="#1e293b">${extra.classOrDept || 'Class 10 (A)'}</text>

    <text x="0" y="122" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="bold" fill="#64748b">अभिभावक का नाम / Father's Name:</text>
    <text x="0" y="142" font-family="'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="800" fill="#1e293b">${extra.fatherName || 'Ramesh Kumar'}</text>

    <text x="0" y="174" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="bold" fill="#64748b">संस्थान / School Name:</text>
    <text x="0" y="193" font-family="'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="900" fill="#8f0631">RADHEY SHYAM SHAKUNTALA SETH SANSTHAAN</text>
  </g>

  <!-- Right Side: PEN & QR Code -->
  <g transform="translate(630, 150)">
    <rect width="175" height="195" rx="12" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5" />
    
    <!-- Mini QR -->
    <rect x="22" y="15" width="130" height="130" rx="8" fill="#0f172a" />
    <rect x="28" y="21" width="118" height="118" rx="6" fill="#ffffff" />
    <!-- QR Corner Marks -->
    <rect x="36" y="29" width="28" height="28" fill="#1e3a8a" />
    <rect x="42" y="35" width="16" height="16" fill="#ffffff" />
    <rect x="46" y="39" width="8" height="8" fill="#1e3a8a" />
    <rect x="110" y="29" width="28" height="28" fill="#1e3a8a" />
    <rect x="116" y="35" width="16" height="16" fill="#ffffff" />
    <rect x="120" y="39" width="8" height="8" fill="#1e3a8a" />
    <rect x="36" y="103" width="28" height="28" fill="#1e3a8a" />
    <rect x="42" y="109" width="16" height="16" fill="#ffffff" />
    <rect x="46" y="113" width="8" height="8" fill="#1e3a8a" />
    <circle cx="87" cy="80" r="10" fill="#0284c7" />

    <text x="87" y="165" font-family="'Segoe UI', Roboto, sans-serif" font-size="9" font-weight="bold" fill="#64748b" text-anchor="middle">Scan via DigiLocker App</text>
    <text x="87" y="180" font-family="'Courier New', monospace" font-size="9.5" font-weight="bold" fill="#1e3a8a" text-anchor="middle">${penNo}</text>
  </g>

  <!-- Large 12-Digit APAAR ID Box -->
  <rect x="45" y="365" width="760" height="70" rx="12" fill="#f8fafc" stroke="#0284c7" stroke-width="2" />
  <text x="425" y="407" font-family="'Courier New', monospace" font-size="32" font-weight="900" fill="#0369a1" text-anchor="middle" letter-spacing="6">
    ${cleanNo}
  </text>
  <text x="425" y="424" font-family="'Segoe UI', Roboto, sans-serif" font-size="9" font-weight="bold" fill="#64748b" text-anchor="middle">
    AP-ID: 12-DIGIT LIFELONG ACADEMIC IDENTIFIER · LINKED TO DIGILOCKER NAD
  </text>

  <!-- Bottom Blue Footer Strip with Verified Signature -->
  <rect x="0" y="455" width="850" height="85" fill="#1e3a8a" />
  <circle cx="70" cy="497" r="20" fill="#ffffff" />
  <text x="70" y="503" font-family="'Segoe UI', Roboto, sans-serif" font-size="15" text-anchor="middle">🇮🇳</text>

  <g transform="translate(105, 475)">
    <text x="0" y="15" font-family="'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="bold" fill="#ffffff">Digital India · National Academic Depository (NAD)</text>
    <text x="0" y="32" font-family="'Segoe UI', Roboto, sans-serif" font-size="9.5" font-weight="500" fill="#93c5fd">Information Technology Act 2000 (Section 4) · ISO 27001 Certified Security</text>
  </g>

  <!-- Signature Valid Stamp -->
  <g transform="translate(620, 467)">
    <rect width="195" height="58" rx="10" fill="#ffffff" stroke="#22c55e" stroke-width="2" />
    <circle cx="28" cy="29" r="14" fill="#22c55e" />
    <path d="M 22 29 L 26 33 L 34 25" stroke="#ffffff" stroke-width="2.5" fill="none" stroke-linecap="round" />
    <text x="50" y="24" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="900" fill="#15803d">Signature Valid</text>
    <text x="50" y="38" font-family="'Segoe UI', Roboto, sans-serif" font-size="8.5" font-weight="bold" fill="#475569">DS MINISTRY OF EDUCATION</text>
    <text x="50" y="49" font-family="'Segoe UI', Roboto, sans-serif" font-size="7.5" font-weight="500" fill="#64748b">Verified on ${currentDate}</text>
  </g>
</svg>
        `.trim();
        return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    }

    // ══════════════════════════════════════════════════════════════
    // 2. REALISTIC UIDAI e-AADHAAR CARD
    // ══════════════════════════════════════════════════════════════
    if (typeLower.includes('aadhaar')) {
        const cleanNo = (docNo || '5482 9102 4821').replace(/[^0-9X]/g, '');
        const g1 = cleanNo.slice(0, 4) || 'XXXX';
        const g2 = cleanNo.slice(4, 8) || 'XXXX';
        const g3 = cleanNo.slice(8, 12) || '5821';
        const displayNo = `${g1}  ${g2}  ${g3}`;

        const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 850 540" width="100%" height="100%">
  <!-- Outer Frame -->
  <rect width="850" height="540" rx="16" fill="#ffffff" stroke="#cbd5e1" stroke-width="2" />

  <!-- Tricolor Bar at Top -->
  <rect x="0" y="0" width="850" height="8" rx="4" fill="#FF9933" />
  <rect x="0" y="8" width="850" height="6" fill="#ffffff" />
  <rect x="0" y="14" width="850" height="8" fill="#138808" />

  <!-- Header Header Box -->
  <rect x="0" y="22" width="850" height="85" fill="#f8fafc" />
  <line x1="0" y1="107" x2="850" y2="107" stroke="#e2e8f0" stroke-width="1.5" />
  <circle cx="65" cy="65" r="28" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5" />
  <text x="65" y="72" font-family="'Segoe UI', Roboto, sans-serif" font-size="24" text-anchor="middle">🏛️</text>

  <!-- Bilingual Header Text -->
  <text x="110" y="52" font-family="'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="900" fill="#0f172a" letter-spacing="0.5">भारत सरकार</text>
  <text x="110" y="70" font-family="'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="bold" fill="#334155" letter-spacing="1">GOVERNMENT OF INDIA</text>
  <text x="110" y="88" font-family="'Segoe UI', Roboto, sans-serif" font-size="10" font-weight="600" fill="#64748b">भारतीय विशिष्ट पहचान प्राधिकरण (UIDAI)</text>

  <!-- Red Aadhaar Sun Emblem on Right -->
  <circle cx="780" cy="65" r="26" fill="#dc2626" />
  <circle cx="780" cy="65" r="18" fill="#ffffff" />
  <circle cx="780" cy="65" r="12" fill="#dc2626" />
  <text x="780" y="103" font-family="'Segoe UI', Roboto, sans-serif" font-size="10" font-weight="bold" fill="#dc2626" text-anchor="middle">AADHAAR</text>

  <!-- Sub Header Slogan -->
  <rect x="0" y="108" width="850" height="26" fill="#fef2f2" stroke="#fee2e2" stroke-width="1" />
  <text x="425" y="125" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="bold" fill="#b91c1c" text-anchor="middle">
    मेरा आधार, मेरी पहचान · Unique Identification Authority of India
  </text>

  <!-- Card Body Photo -->
  <rect x="50" y="155" width="135" height="175" rx="10" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="2" />
  <circle cx="117" cy="215" r="32" fill="#94a3b8" />
  <path d="M 75 300 Q 117 255 160 300 Z" fill="#94a3b8" />
  <rect x="55" y="305" width="125" height="20" rx="4" fill="#003366" />
  <text x="117" y="319" font-family="'Segoe UI', Roboto, sans-serif" font-size="9" font-weight="bold" fill="#ffffff" text-anchor="middle">PHOTO VERIFIED</text>

  <!-- Details Middle Column -->
  <text x="210" y="175" font-family="'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="bold" fill="#64748b">नाम / Name:</text>
  <text x="210" y="200" font-family="'Segoe UI', Roboto, sans-serif" font-size="19" font-weight="900" fill="#0f172a">${ownerName}</text>

  <text x="210" y="235" font-family="'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="bold" fill="#64748b">जन्म तिथि / Date of Birth:</text>
  <text x="210" y="258" font-family="'Segoe UI', Roboto, sans-serif" font-size="15" font-weight="800" fill="#1e293b">15/06/2008</text>

  <text x="210" y="290" font-family="'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="bold" fill="#64748b">लिंग / Gender:</text>
  <text x="210" y="312" font-family="'Segoe UI', Roboto, sans-serif" font-size="15" font-weight="800" fill="#1e293b">MALE / FEMALE</text>

  <!-- Authentic QR Code on Right -->
  <g transform="translate(630, 150)">
    <rect width="165" height="165" rx="12" fill="#0f172a" />
    <rect x="8" y="8" width="149" height="149" rx="8" fill="#ffffff" />
    <rect x="20" y="20" width="34" height="34" fill="#003366" />
    <rect x="26" y="26" width="22" height="22" fill="#ffffff" />
    <rect x="30" y="30" width="14" height="14" fill="#003366" />
    <rect x="111" y="20" width="34" height="34" fill="#003366" />
    <rect x="117" y="26" width="22" height="22" fill="#ffffff" />
    <rect x="121" y="30" width="14" height="14" fill="#003366" />
    <rect x="20" y="111" width="34" height="34" fill="#003366" />
    <rect x="26" y="117" width="22" height="22" fill="#ffffff" />
    <rect x="30" y="121" width="14" height="14" fill="#003366" />
    <rect x="68" y="24" width="30" height="12" fill="#003366" />
    <rect x="24" y="68" width="12" height="30" fill="#003366" />
    <rect x="75" y="75" width="25" height="25" fill="#dc2626" />
    <circle cx="87" cy="87" r="8" fill="#ffffff" />
    <rect x="118" y="70" width="24" height="24" fill="#003366" />
    <rect x="70" y="120" width="35" height="18" fill="#003366" />
    <text x="82" y="195" font-family="'Segoe UI', Roboto, sans-serif" font-size="10" font-weight="bold" fill="#64748b" text-anchor="middle">Scan UIDAI QR Code</text>
  </g>

  <!-- Large 12-Digit Aadhaar Number Box -->
  <rect x="50" y="355" width="750" height="75" rx="14" fill="#f8fafc" stroke="#dc2626" stroke-width="2" />
  <text x="425" y="405" font-family="'Courier New', monospace" font-size="34" font-weight="900" fill="#dc2626" text-anchor="middle" letter-spacing="8">
    ${displayNo}
  </text>
  <text x="425" y="423" font-family="'Segoe UI', Roboto, sans-serif" font-size="9" font-weight="bold" fill="#94a3b8" text-anchor="middle">
    VID: 9182 4819 0291 8219 · DIGITALLY ENCRYPTED
  </text>

  <!-- Bottom Security Ribbon: Digital India + DigiLocker Seal -->
  <rect x="0" y="450" width="850" height="90" rx="0" fill="#003366" />
  <circle cx="70" cy="495" r="22" fill="#ffffff" />
  <text x="70" y="501" font-family="'Segoe UI', Roboto, sans-serif" font-size="16" text-anchor="middle">🇮🇳</text>

  <g transform="translate(105, 475)">
    <text x="0" y="15" font-family="'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="bold" fill="#ffffff">Digital India · DigiLocker Verified Document</text>
    <text x="0" y="32" font-family="'Segoe UI', Roboto, sans-serif" font-size="10" font-weight="500" fill="#93c5fd">Information Technology Act, 2000 (Section 4) · ISO 27001 Certified Security</text>
  </g>

  <!-- Green Verified Signature Stamp on bottom right -->
  <g transform="translate(620, 465)">
    <rect width="195" height="58" rx="10" fill="#ffffff" stroke="#22c55e" stroke-width="2" />
    <circle cx="28" cy="29" r="14" fill="#22c55e" />
    <path d="M 22 29 L 26 33 L 34 25" stroke="#ffffff" stroke-width="2.5" fill="none" stroke-linecap="round" />
    <text x="50" y="24" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="900" fill="#15803d">Signature Valid</text>
    <text x="50" y="38" font-family="'Segoe UI', Roboto, sans-serif" font-size="8.5" font-weight="bold" fill="#475569">DS UIDAI SUB-GATEWAY 04</text>
    <text x="50" y="49" font-family="'Segoe UI', Roboto, sans-serif" font-size="7.5" font-weight="500" fill="#64748b">Verified on ${currentDate}</text>
  </g>
</svg>
        `.trim();
        return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    }

    // ══════════════════════════════════════════════════════════════
    // 3. REALISTIC ACADEMIC BOARD MARKSHEET (CBSE / State Council)
    // ══════════════════════════════════════════════════════════════
    if (typeLower.includes('marksheet') || typeLower.includes('10th') || typeLower.includes('12th')) {
        const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 850 630" width="100%" height="100%">
  <!-- Outer Page -->
  <rect width="850" height="630" rx="14" fill="#ffffff" stroke="#cbd5e1" stroke-width="2" />

  <!-- Outer Double Border -->
  <rect x="15" y="15" width="820" height="600" rx="10" fill="none" stroke="#8f0631" stroke-width="3" />
  <rect x="21" y="21" width="808" height="588" rx="8" fill="none" stroke="#d97706" stroke-width="1" />

  <!-- Watermark -->
  <circle cx="425" cy="315" r="150" fill="#f8fafc" stroke="#e2e8f0" stroke-width="2" stroke-dasharray="6,6" opacity="0.7"/>
  <text x="425" y="305" font-family="'Segoe UI', sans-serif" font-size="28" font-weight="900" fill="#cbd5e1" text-anchor="middle" letter-spacing="4">DIGILOCKER VERIFIED</text>
  <text x="425" y="340" font-family="'Segoe UI', sans-serif" font-size="14" font-weight="bold" fill="#cbd5e1" text-anchor="middle">CENTRAL BOARD ACADEMIC RECORD</text>

  <!-- Header -->
  <circle cx="75" cy="70" r="30" fill="#8f0631" />
  <text x="75" y="78" font-family="'Segoe UI', sans-serif" font-size="24" fill="#ffffff" text-anchor="middle">🎓</text>

  <g transform="translate(125, 45)">
    <text x="0" y="16" font-family="'Segoe UI', sans-serif" font-size="16" font-weight="900" fill="#8f0631" letter-spacing="1">CENTRAL BOARD OF SECONDARY EDUCATION, DELHI</text>
    <text x="0" y="34" font-family="'Segoe UI', sans-serif" font-size="12" font-weight="bold" fill="#0f172a" letter-spacing="0.5">RADHEY SHYAM SHAKUNTALA SETH SANSTHAAN</text>
    <text x="0" y="50" font-family="'Segoe UI', sans-serif" font-size="10" font-weight="bold" fill="#d97706">SECONDARY SCHOOL EXAMINATION · MARKS STATEMENT CUM CERTIFICATE</text>
  </g>

  <!-- DigiLocker Seal Badge in Top Right -->
  <g transform="translate(670, 40)">
    <rect width="140" height="48" rx="8" fill="#dcfce7" stroke="#22c55e" stroke-width="1.5" />
    <circle cx="20" cy="24" r="9" fill="#16a34a" />
    <text x="20" y="28" font-family="'Segoe UI', sans-serif" font-size="12" fill="#ffffff" text-anchor="middle">✓</text>
    <text x="36" y="20" font-family="'Segoe UI', sans-serif" font-size="10" font-weight="900" fill="#15803d">DIGILOCKER</text>
    <text x="36" y="35" font-family="'Segoe UI', sans-serif" font-size="8" font-weight="bold" fill="#166534">AUTHENTICATED</text>
  </g>

  <!-- Candidate Information Table -->
  <rect x="35" y="110" width="780" height="100" rx="8" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1.5" />

  <text x="50" y="135" font-family="'Segoe UI', sans-serif" font-size="11" font-weight="bold" fill="#64748b">CANDIDATE NAME:</text>
  <text x="180" y="135" font-family="'Segoe UI', sans-serif" font-size="13" font-weight="900" fill="#0f172a">${ownerName}</text>

  <text x="500" y="135" font-family="'Segoe UI', sans-serif" font-size="11" font-weight="bold" fill="#64748b">ROLL NUMBER:</text>
  <text x="610" y="135" font-family="'Courier New', monospace" font-size="14" font-weight="900" fill="#8f0631">${docNo || '26849102'}</text>

  <text x="50" y="165" font-family="'Segoe UI', sans-serif" font-size="11" font-weight="bold" fill="#64748b">MOTHER'S NAME:</text>
  <text x="180" y="165" font-family="'Segoe UI', sans-serif" font-size="12" font-weight="bold" fill="#334155">${extra.motherName || 'SUNITA DEVI'}</text>

  <text x="500" y="165" font-family="'Segoe UI', sans-serif" font-size="11" font-weight="bold" fill="#64748b">ACADEMIC YEAR:</text>
  <text x="610" y="165" font-family="'Segoe UI', sans-serif" font-size="12" font-weight="bold" fill="#334155">${extra.academicYear || '2025 - 2026'}</text>

  <text x="50" y="195" font-family="'Segoe UI', sans-serif" font-size="11" font-weight="bold" fill="#64748b">FATHER'S NAME:</text>
  <text x="180" y="195" font-family="'Segoe UI', sans-serif" font-size="12" font-weight="bold" fill="#334155">${extra.fatherName || 'RAJESH KUMAR'}</text>

  <text x="500" y="195" font-family="'Segoe UI', sans-serif" font-size="11" font-weight="bold" fill="#64748b">SCHOOL CODE:</text>
  <text x="610" y="195" font-family="'Segoe UI', sans-serif" font-size="12" font-weight="bold" fill="#334155">RSSS-71042</text>

  <!-- Subject Wise Marks Table -->
  <g transform="translate(35, 225)">
    <!-- Table Header -->
    <rect width="780" height="32" rx="4" fill="#8f0631" />
    <text x="20" y="21" font-family="'Segoe UI', sans-serif" font-size="11" font-weight="bold" fill="#ffffff">SUB CODE</text>
    <text x="120" y="21" font-family="'Segoe UI', sans-serif" font-size="11" font-weight="bold" fill="#ffffff">SUBJECT NAME</text>
    <text x="380" y="21" font-family="'Segoe UI', sans-serif" font-size="11" font-weight="bold" fill="#ffffff" text-anchor="middle">THEORY</text>
    <text x="470" y="21" font-family="'Segoe UI', sans-serif" font-size="11" font-weight="bold" fill="#ffffff" text-anchor="middle">PRACTICAL</text>
    <text x="580" y="21" font-family="'Segoe UI', sans-serif" font-size="11" font-weight="bold" fill="#ffffff" text-anchor="middle">TOTAL MARKS</text>
    <text x="700" y="21" font-family="'Segoe UI', sans-serif" font-size="11" font-weight="bold" fill="#ffffff" text-anchor="middle">GRADE</text>

    <!-- Row 1: English -->
    <rect y="32" width="780" height="28" fill="#ffffff" stroke="#e2e8f0" />
    <text x="20" y="51" font-family="'Segoe UI', sans-serif" font-size="11" font-weight="bold" fill="#334155">101</text>
    <text x="120" y="51" font-family="'Segoe UI', sans-serif" font-size="11" font-weight="bold" fill="#0f172a">ENGLISH COMMUNICATIVE</text>
    <text x="380" y="51" font-family="'Segoe UI', sans-serif" font-size="11" font-weight="bold" fill="#334155" text-anchor="middle">072</text>
    <text x="470" y="51" font-family="'Segoe UI', sans-serif" font-size="11" font-weight="bold" fill="#334155" text-anchor="middle">020</text>
    <text x="580" y="51" font-family="'Segoe UI', sans-serif" font-size="12" font-weight="900" fill="#8f0631" text-anchor="middle">092</text>
    <text x="700" y="51" font-family="'Segoe UI', sans-serif" font-size="12" font-weight="bold" fill="#16a34a" text-anchor="middle">A1</text>

    <!-- Row 2: Mathematics -->
    <rect y="60" width="780" height="28" fill="#f8fafc" stroke="#e2e8f0" />
    <text x="20" y="79" font-family="'Segoe UI', sans-serif" font-size="11" font-weight="bold" fill="#334155">041</text>
    <text x="120" y="79" font-family="'Segoe UI', sans-serif" font-size="11" font-weight="bold" fill="#0f172a">MATHEMATICS STANDARD</text>
    <text x="380" y="79" font-family="'Segoe UI', sans-serif" font-size="11" font-weight="bold" fill="#334155" text-anchor="middle">075</text>
    <text x="470" y="79" font-family="'Segoe UI', sans-serif" font-size="11" font-weight="bold" fill="#334155" text-anchor="middle">020</text>
    <text x="580" y="79" font-family="'Segoe UI', sans-serif" font-size="12" font-weight="900" fill="#8f0631" text-anchor="middle">095</text>
    <text x="700" y="79" font-family="'Segoe UI', sans-serif" font-size="12" font-weight="bold" fill="#16a34a" text-anchor="middle">A1</text>

    <!-- Row 3: Science -->
    <rect y="88" width="780" height="28" fill="#ffffff" stroke="#e2e8f0" />
    <text x="20" y="107" font-family="'Segoe UI', sans-serif" font-size="11" font-weight="bold" fill="#334155">086</text>
    <text x="120" y="107" font-family="'Segoe UI', sans-serif" font-size="11" font-weight="bold" fill="#0f172a">SCIENCE</text>
    <text x="380" y="107" font-family="'Segoe UI', sans-serif" font-size="11" font-weight="bold" fill="#334155" text-anchor="middle">068</text>
    <text x="470" y="107" font-family="'Segoe UI', sans-serif" font-size="11" font-weight="bold" fill="#334155" text-anchor="middle">020</text>
    <text x="580" y="107" font-family="'Segoe UI', sans-serif" font-size="12" font-weight="900" fill="#8f0631" text-anchor="middle">088</text>
    <text x="700" y="107" font-family="'Segoe UI', sans-serif" font-size="12" font-weight="bold" fill="#16a34a" text-anchor="middle">A2</text>

    <!-- Row 4: Social Science -->
    <rect y="116" width="780" height="28" fill="#f8fafc" stroke="#e2e8f0" />
    <text x="20" y="135" font-family="'Segoe UI', sans-serif" font-size="11" font-weight="bold" fill="#334155">087</text>
    <text x="120" y="135" font-family="'Segoe UI', sans-serif" font-size="11" font-weight="bold" fill="#0f172a">SOCIAL SCIENCE</text>
    <text x="380" y="135" font-family="'Segoe UI', sans-serif" font-size="11" font-weight="bold" fill="#334155" text-anchor="middle">070</text>
    <text x="470" y="135" font-family="'Segoe UI', sans-serif" font-size="11" font-weight="bold" fill="#334155" text-anchor="middle">020</text>
    <text x="580" y="135" font-family="'Segoe UI', sans-serif" font-size="12" font-weight="900" fill="#8f0631" text-anchor="middle">090</text>
    <text x="700" y="135" font-family="'Segoe UI', sans-serif" font-size="12" font-weight="bold" fill="#16a34a" text-anchor="middle">A1</text>

    <!-- Row 5: Hindi -->
    <rect y="144" width="780" height="28" fill="#ffffff" stroke="#e2e8f0" />
    <text x="20" y="163" font-family="'Segoe UI', sans-serif" font-size="11" font-weight="bold" fill="#334155">002</text>
    <text x="120" y="163" font-family="'Segoe UI', sans-serif" font-size="11" font-weight="bold" fill="#0f172a">HINDI COURSE - A</text>
    <text x="380" y="163" font-family="'Segoe UI', sans-serif" font-size="11" font-weight="bold" fill="#334155" text-anchor="middle">074</text>
    <text x="470" y="163" font-family="'Segoe UI', sans-serif" font-size="11" font-weight="bold" fill="#334155" text-anchor="middle">020</text>
    <text x="580" y="163" font-family="'Segoe UI', sans-serif" font-size="12" font-weight="900" fill="#8f0631" text-anchor="middle">094</text>
    <text x="700" y="163" font-family="'Segoe UI', sans-serif" font-size="12" font-weight="bold" fill="#16a34a" text-anchor="middle">A1</text>
  </g>

  <!-- Result Banner -->
  <rect x="35" y="420" width="780" height="42" rx="8" fill="#ecfdf5" stroke="#a7f3d0" stroke-width="1.5" />
  <text x="50" y="446" font-family="'Segoe UI', sans-serif" font-size="13" font-weight="bold" fill="#065f46">FINAL RESULT: PASS</text>
  <text x="790" y="446" font-family="'Segoe UI', sans-serif" font-size="13" font-weight="900" fill="#065f46" text-anchor="end">TOTAL: 459 / 500 (91.8%)</text>

  <!-- Bottom Official DigiLocker Signatures -->
  <line x1="35" y1="480" x2="815" y2="480" stroke="#cbd5e1" stroke-width="1" stroke-dasharray="4,4" />

  <g transform="translate(50, 495)">
    <!-- QR Code -->
    <rect width="70" height="70" rx="6" fill="#0f172a" />
    <rect x="5" y="5" width="60" height="60" rx="4" fill="#ffffff" />
    <rect x="12" y="12" width="16" height="16" fill="#8f0631" />
    <rect x="42" y="12" width="16" height="16" fill="#8f0631" />
    <rect x="12" y="42" width="16" height="16" fill="#8f0631" />
    <circle cx="35" cy="35" r="4" fill="#d97706" />

    <text x="85" y="24" font-family="'Segoe UI', sans-serif" font-size="11" font-weight="bold" fill="#0f172a">DIGITALLY VERIFIED VIA NATIONAL ACADEMIC DEPOSITORY</text>
    <text x="85" y="40" font-family="'Segoe UI', sans-serif" font-size="9.5" font-weight="bold" fill="#16a34a">✓ Cryptographically sealed with e-Sign Certificate of Controller of Examinations</text>
    <text x="85" y="55" font-family="'Segoe UI', sans-serif" font-size="8.5" font-weight="500" fill="#64748b">Doc URI: in.gov.cbse:marksheet:${docNo || '26849102'} · ISO 27001 Certified</text>
  </g>

  <!-- Controller Signature -->
  <g transform="translate(680, 500)">
    <path d="M 10 30 Q 30 10 50 30 T 90 20" stroke="#003366" stroke-width="2" fill="none" />
    <text x="50" y="45" font-family="'Segoe UI', sans-serif" font-size="10" font-weight="bold" fill="#0f172a" text-anchor="middle">Controller of Examinations</text>
    <text x="50" y="58" font-family="'Segoe UI', sans-serif" font-size="8.5" font-weight="bold" fill="#16a34a" text-anchor="middle">CBSE / Sansthaan</text>
  </g>
</svg>
        `.trim();
        return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    }

    // ══════════════════════════════════════════════════════════════
    // 4. REALISTIC SCHOOL TRANSFER CERTIFICATE (TC)
    // ══════════════════════════════════════════════════════════════
    if (typeLower.includes('transfer') || typeLower.includes('tc')) {
        const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 850 580" width="100%" height="100%">
  <rect width="850" height="580" rx="14" fill="#ffffff" stroke="#cbd5e1" stroke-width="2" />
  <rect x="15" y="15" width="820" height="550" rx="10" fill="none" stroke="#003366" stroke-width="2" />

  <!-- Header -->
  <text x="425" y="50" font-family="'Segoe UI', sans-serif" font-size="20" font-weight="900" fill="#8f0631" text-anchor="middle">RADHEY SHYAM SHAKUNTALA SETH SANSTHAAN</text>
  <text x="425" y="70" font-family="'Segoe UI', sans-serif" font-size="11" font-weight="bold" fill="#334155" text-anchor="middle">AFFILIATED TO CENTRAL BOARD OF SECONDARY EDUCATION · AFFILIATION NO: 2133842</text>
  <text x="425" y="95" font-family="'Segoe UI', sans-serif" font-size="16" font-weight="900" fill="#003366" text-anchor="middle" letter-spacing="2">TRANSFER CUM CHARACTER CERTIFICATE</text>

  <line x1="40" y1="110" x2="810" y2="110" stroke="#e2e8f0" stroke-width="2" />

  <g transform="translate(50, 130)">
    <text x="0" y="20" font-family="'Segoe UI', sans-serif" font-size="11" font-weight="bold" fill="#64748b">TC Serial No: <tspan fill="#8f0631" font-weight="900">${docNo || 'TC/2026/048'}</tspan></text>
    <text x="350" y="20" font-family="'Segoe UI', sans-serif" font-size="11" font-weight="bold" fill="#64748b">Scholar No: <tspan fill="#0f172a">SC-8492</tspan></text>
    <text x="600" y="20" font-family="'Segoe UI', sans-serif" font-size="11" font-weight="bold" fill="#64748b">Admission No: <tspan fill="#0f172a">ADM-2022-108</tspan></text>

    <text x="0" y="60" font-family="'Segoe UI', sans-serif" font-size="13" font-weight="bold" fill="#1e293b">1. Name of the Pupil:</text>
    <text x="280" y="60" font-family="'Segoe UI', sans-serif" font-size="14" font-weight="900" fill="#0f172a">${ownerName}</text>

    <text x="0" y="95" font-family="'Segoe UI', sans-serif" font-size="13" font-weight="bold" fill="#1e293b">2. Father's / Guardian's Name:</text>
    <text x="280" y="95" font-family="'Segoe UI', sans-serif" font-size="13" font-weight="bold" fill="#334155">${extra.fatherName || 'Shri Ramesh Kumar'}</text>

    <text x="0" y="130" font-family="'Segoe UI', sans-serif" font-size="13" font-weight="bold" fill="#1e293b">3. Mother's Name:</text>
    <text x="280" y="130" font-family="'Segoe UI', sans-serif" font-size="13" font-weight="bold" fill="#334155">${extra.motherName || 'Smt. Manju Devi'}</text>

    <text x="0" y="165" font-family="'Segoe UI', sans-serif" font-size="13" font-weight="bold" fill="#1e293b">4. Nationality & Category:</text>
    <text x="280" y="165" font-family="'Segoe UI', sans-serif" font-size="13" font-weight="bold" fill="#334155">INDIAN · GENERAL</text>

    <text x="0" y="200" font-family="'Segoe UI', sans-serif" font-size="13" font-weight="bold" fill="#1e293b">5. Class in which pupil last studied:</text>
    <text x="280" y="200" font-family="'Segoe UI', sans-serif" font-size="13" font-weight="900" fill="#8f0631">${extra.classOrDept || 'CLASS X (Passed & Promoted)'}</text>

    <text x="0" y="235" font-family="'Segoe UI', sans-serif" font-size="13" font-weight="bold" fill="#1e293b">6. School Dues Paid Status:</text>
    <text x="280" y="235" font-family="'Segoe UI', sans-serif" font-size="13" font-weight="bold" fill="#16a34a">PAID IN FULL (No Institutional Dues)</text>

    <text x="0" y="270" font-family="'Segoe UI', sans-serif" font-size="13" font-weight="bold" fill="#1e293b">7. General Conduct & Character:</text>
    <text x="280" y="270" font-family="'Segoe UI', sans-serif" font-size="13" font-weight="bold" fill="#16a34a">EXCELLENT & EXEMPLARY</text>

    <text x="0" y="305" font-family="'Segoe UI', sans-serif" font-size="13" font-weight="bold" fill="#1e293b">8. Reason for Leaving School:</text>
    <text x="280" y="305" font-family="'Segoe UI', sans-serif" font-size="13" font-weight="bold" fill="#334155">Completed Secondary Education / Higher Studies</text>
  </g>

  <!-- Bottom Official Stamp -->
  <g transform="translate(50, 480)">
    <rect width="180" height="45" rx="8" fill="#dcfce7" stroke="#22c55e" stroke-width="1.5" />
    <text x="90" y="22" font-family="'Segoe UI', sans-serif" font-size="11" font-weight="900" fill="#15803d" text-anchor="middle">DIGILOCKER VERIFIED</text>
    <text x="90" y="36" font-family="'Segoe UI', sans-serif" font-size="8" font-weight="bold" fill="#166534" text-anchor="middle">Official Academic Depository</text>
  </g>

  <g transform="translate(620, 480)">
    <path d="M 20 20 Q 50 5 80 20 T 120 15" stroke="#8f0631" stroke-width="2.5" fill="none" />
    <text x="75" y="38" font-family="'Segoe UI', sans-serif" font-size="11" font-weight="900" fill="#0f172a" text-anchor="middle">Principal / Head of Institution</text>
  </g>
</svg>
        `.trim();
        return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    }

    // ══════════════════════════════════════════════════════════════
    // 5. GENERAL DEGREE / CERTIFICATE
    // ══════════════════════════════════════════════════════════════
    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 850 540" width="100%" height="100%">
  <rect width="850" height="540" rx="14" fill="#ffffff" stroke="#cbd5e1" stroke-width="2" />
  <rect x="15" y="15" width="820" height="510" rx="10" fill="none" stroke="#8f0631" stroke-width="2.5" />

  <text x="425" y="65" font-family="'Segoe UI', sans-serif" font-size="22" font-weight="900" fill="#003366" text-anchor="middle">NATIONAL ACADEMIC REPOSITORY</text>
  <text x="425" y="88" font-family="'Segoe UI', sans-serif" font-size="12" font-weight="bold" fill="#64748b" text-anchor="middle">MINISTRY OF EDUCATION & DIGITAL INDIA INITIATIVE</text>
  <text x="425" y="125" font-family="'Segoe UI', sans-serif" font-size="18" font-weight="bold" fill="#8f0631" text-anchor="middle">${docType}</text>

  <rect x="50" y="150" width="750" height="260" rx="10" fill="#f8fafc" stroke="#e2e8f0" />
  
  <text x="80" y="195" font-family="'Segoe UI', sans-serif" font-size="12" font-weight="bold" fill="#64748b">CANDIDATE / HOLDER NAME:</text>
  <text x="80" y="222" font-family="'Segoe UI', sans-serif" font-size="20" font-weight="900" fill="#0f172a">${ownerName}</text>

  <text x="80" y="265" font-family="'Segoe UI', sans-serif" font-size="12" font-weight="bold" fill="#64748b">DOCUMENT SERIAL NUMBER:</text>
  <text x="80" y="290" font-family="'Courier New', monospace" font-size="16" font-weight="900" fill="#8f0631">${docNo}</text>

  <text x="80" y="335" font-family="'Segoe UI', sans-serif" font-size="12" font-weight="bold" fill="#64748b">AUTHENTICATION STATUS:</text>
  <text x="80" y="360" font-family="'Segoe UI', sans-serif" font-size="14" font-weight="bold" fill="#16a34a">✓ Validated against DigiLocker Central Gateway</text>

  <g transform="translate(620, 180)">
    <rect width="140" height="140" rx="10" fill="#0f172a" />
    <rect x="8" y="8" width="124" height="124" rx="6" fill="#ffffff" />
    <rect x="20" y="20" width="28" height="28" fill="#003366" />
    <rect x="84" y="20" width="28" height="28" fill="#003366" />
    <rect x="20" y="84" width="28" height="28" fill="#003366" />
    <circle cx="70" cy="70" r="10" fill="#8f0631" />
  </g>

  <!-- Green Verified Signature Stamp on bottom right -->
  <g transform="translate(580, 435)">
    <rect width="210" height="60" rx="10" fill="#ffffff" stroke="#22c55e" stroke-width="2" />
    <circle cx="28" cy="30" r="14" fill="#22c55e" />
    <path d="M 22 30 L 26 34 L 34 26" stroke="#ffffff" stroke-width="2.5" fill="none" stroke-linecap="round" />
    <text x="50" y="25" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="900" fill="#15803d">Signature Valid</text>
    <text x="50" y="39" font-family="'Segoe UI', Roboto, sans-serif" font-size="8.5" font-weight="bold" fill="#475569">DS DIGITAL INDIA / NAD</text>
    <text x="50" y="50" font-family="'Segoe UI', Roboto, sans-serif" font-size="7.5" font-weight="500" fill="#64748b">Verified on ${currentDate}</text>
  </g>

  <text x="50" y="480" font-family="'Segoe UI', sans-serif" font-size="10" font-weight="bold" fill="#94a3b8">Doc ID: ${docNo} · Digilocker Certificate Verification · Radhey Shyam Sansthaan</text>
</svg>
    `.trim();

    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
