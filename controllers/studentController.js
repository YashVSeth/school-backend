const Student = require('../models/Student');
const FeeStructure = require('../models/FeeStructure');
const Invoice = require('../models/Invoice');

// --- HELPER: Auto-Assign Roll Numbers Alphabetically ---
const assignAlphabeticalRollNumbers = async (classId) => {
  try {
    // Fetch all students in this class, sorted by First Name -> Last Name
    const students = await Student.find({ class: classId }).sort({ firstName: 1, lastName: 1 });

    if (students.length === 0) return;

    // Prepare bulkWrite operations to efficiently update all roll numbers
    const bulkOps = students.map((student, index) => ({
      updateOne: {
        filter: { _id: student._id },
        update: { $set: { rollNo: index + 1 } }
      }
    }));

    await Student.bulkWrite(bulkOps);
    console.log(`✅ Alphabetical Roll Numbers reassigned for Class ${classId}`);
  } catch (error) {
    console.error("❌ Failed to reassign Roll Numbers:", error);
  }
};

// --- 1. Add Student (Synced with Frontend Payload) ---
exports.addStudent = async (req, res) => {
  try {
    const {
      firstName, lastName, fatherName, motherName, phone,
      email, address, dob, gender, bloodGroup, class: studentClass,
      whatsappEnabled, feeDetails, height, weight
    } = req.body;

    // Validation
    if (!firstName || !studentClass || !phone || !fatherName) {
      return res.status(400).json({ message: "Required fields missing." });
    }

    // Auto-Generate secure anonymous Student ID to satisfy unique schema constraint
    const generatedStudentId = `STU-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`;

    const newStudent = new Student({
      studentId: generatedStudentId,
      firstName, lastName, fatherName, motherName, phone,
      email, address, dob, gender, bloodGroup, class: studentClass,
      height,
      weight,
      whatsappEnabled: whatsappEnabled ?? true,
      feeDetails: {
        backlog_2024: 0,
        backlog_2025: 0,
        tuitionFee_2026: 0,
        electricalCharges: 0,
        isUsingTransport: feeDetails?.isUsingTransport || false
      }
    });

    const savedStudent = await newStudent.save();

    // Trigger the Alphabetical Sorter
    await assignAlphabeticalRollNumbers(studentClass);

    // --- AUTO-GENERATE TRANSPORT INVOICE ---
    if (savedStudent.feeDetails?.isUsingTransport) {
      try {
        const feeStructure = await FeeStructure.findOne({ classId: studentClass }).sort({ createdAt: -1 });
        if (feeStructure) {
          // Look for 'Transport' in both mandatory and optional fees
          const allFees = [...(feeStructure.mandatoryFees || []), ...(feeStructure.optionalFees || [])];
          const transportFee = allFees.find(f => f.name.toLowerCase().includes('transport'));

          if (transportFee) {
            // Determine a title based on the frequency, or defaulting to general Transport Fee
            let title = "Transport Fee";
            if (transportFee.frequency === 'MONTHLY') title = "April Transport Fee"; // Just as an initial example or standard name
            else if (transportFee.frequency === 'YEARLY') title = "Annual Transport Fee";

            const newInvoice = new Invoice({
              student: savedStudent._id,
              title: title,
              amount: transportFee.amount,
              dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // Due in 15 days
              status: 'Pending',
              amountPaid: 0,
              academicYear: feeStructure.academicYear || '2026-27'
            });

            await newInvoice.save();
            console.log(`✅ Auto-generated Transport Invoice for ${savedStudent.studentId}`);
          }
        }
      } catch (err) {
        console.error("❌ Failed to auto-generate Transport invoice:", err);
      }
    }

    res.status(201).json({ success: true, message: "Student Admitted Successfully!", data: savedStudent });

  } catch (error) {
    console.error("Add Student Error:", error);
    if (error.code === 11000) {
      return res.status(400).json({ message: "Database Conflict: ID already exists." });
    }
    res.status(500).json({ message: error.message });
  }
};

// --- 2. Get All Students (With Population) ---
exports.getStudents = async (req, res) => {
  try {
    const students = await Student.find()
      .populate('class', 'grade section')
      .sort({ firstName: 1 });
    res.json(students);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// --- 3. Delete Student ---
exports.deleteStudent = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ message: "Student not found" });

    await student.deleteOne();
    res.json({ message: "Student record removed successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// --- 4. Mark Attendance Placeholder ---
exports.markAttendance = async (req, res) => {
  res.status(200).json({ message: "Attendance module integrated" });
};

// --- 5. PROMOTE STUDENT ---
exports.promoteStudent = async (req, res) => {
  try {
    const { studentId, newClassId } = req.body;

    if (!studentId || !newClassId) {
      return res.status(400).json({ message: "Student ID and New Class are required" });
    }

    const updatedStudent = await Student.findByIdAndUpdate(
      studentId,
      { class: newClassId },
      { new: true }
    ).populate('class');

    if (!updatedStudent) {
      return res.status(404).json({ message: "Student not found" });
    }

    res.json({ message: "Student Promoted Successfully", student: updatedStudent });

  } catch (error) {
    console.error("Promotion Error:", error);
    res.status(500).json({ message: "Failed to promote student" });
  }
};

// --- ✅ 6. UPDATE STUDENT (REQUIRED FOR EDIT MODAL) ---
exports.updateStudent = async (req, res) => {
  try {
    const updatedStudent = await Student.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!updatedStudent) {
      return res.status(404).json({ message: "Student not found" });
    }

    res.json({ success: true, message: "Student Updated Successfully!", data: updatedStudent });
  } catch (error) {
    console.error("Update Student Error:", error);
    res.status(500).json({ message: error.message || "Failed to update student" });
  }
};