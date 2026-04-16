import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Clean existing data
  await prisma.substitution.deleteMany();
  await prisma.absence.deleteMany();
  await prisma.timetableSlot.deleteMany();
  await prisma.studyGroupClass.deleteMany();
  await prisma.studyGroup.deleteMany();
  await prisma.teacherConstraint.deleteMany();
  await prisma.schoolConstraint.deleteMany();
  await prisma.teacherSubject.deleteMany();
  await prisma.user.deleteMany();
  await prisma.class.deleteMany();
  await prisma.teacher.deleteMany();
  await prisma.room.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.school.deleteMany();
  await prisma.superAdmin.deleteMany();

  // Create super admin
  const superAdminPassword = await bcrypt.hash("superadmin123", 10);
  await prisma.superAdmin.create({
    data: {
      email: "nadav@mifras.org",
      name: "נדב",
      password: superAdminPassword,
    },
  });

  // Create school
  const school = await prisma.school.create({
    data: {
      name: 'בית ספר "אופק"',
      periodCount: 9,
      dayCount: 6,
      periodStartTimes: JSON.stringify([
        "07:45", "08:30", "09:15", "10:15",
        "11:00", "11:45", "12:45", "13:30", "14:15",
      ]),
    },
  });

  // Create admin user
  const hashedPassword = await bcrypt.hash("admin123", 10);
  await prisma.user.create({
    data: {
      email: "admin@school.co.il",
      name: "מנהל המערכת",
      password: hashedPassword,
      role: "ADMIN",
      schoolId: school.id,
    },
  });

  // Create subjects
  const subjectsData = [
    { name: "מתמטיקה", category: "core", color: "#4d90fe" },
    { name: "עברית", category: "core", color: "#34a853" },
    { name: "אנגלית", category: "core", color: "#ea4335" },
    { name: "מדעים", category: "core", color: "#8e24aa" },
    { name: "היסטוריה", category: "core", color: "#ff9800" },
    { name: "תנ\"ך", category: "core", color: "#795548" },
    { name: "ספורט", category: "enrichment", color: "#00bcd4" },
    { name: "אמנות", category: "enrichment", color: "#e91e63" },
    { name: "מוזיקה", category: "enrichment", color: "#9c27b0" },
    { name: "מחשבים", category: "elective", color: "#607d8b" },
    { name: "גיאוגרפיה", category: "core", color: "#4caf50" },
    { name: "אזרחות", category: "core", color: "#3f51b5" },
    { name: "פיזיקה", category: "elective", color: "#009688" },
    { name: "כימיה", category: "elective", color: "#ff5722" },
    { name: "ביולוגיה", category: "elective", color: "#8bc34a" },
  ];

  const subjects: Record<string, string> = {};
  for (const s of subjectsData) {
    const subject = await prisma.subject.create({
      data: { ...s, schoolId: school.id },
    });
    subjects[s.name] = subject.id;
  }

  // Create teachers
  const teachersData = [
    { name: "רינת כהן", email: "rinat@school.co.il", phone: "050-1234567", maxHoursPerWeek: 30, subjects: ["מתמטיקה"] },
    { name: "יוסי לוי", email: "yossi@school.co.il", phone: "050-2345678", maxHoursPerWeek: 28, subjects: ["מתמטיקה"] },
    { name: "מיכל אברהם", email: "michal@school.co.il", phone: "050-3456789", maxHoursPerWeek: 30, subjects: ["עברית"] },
    { name: "דוד שרון", email: "david@school.co.il", phone: "050-4567890", maxHoursPerWeek: 26, subjects: ["עברית"] },
    { name: "שרה גולדשטיין", email: "sara@school.co.il", phone: "050-5678901", maxHoursPerWeek: 30, subjects: ["אנגלית"] },
    { name: "אלון בן דוד", email: "alon@school.co.il", phone: "050-6789012", maxHoursPerWeek: 28, subjects: ["אנגלית"] },
    { name: "נועה פרידמן", email: "noa@school.co.il", phone: "050-7890123", maxHoursPerWeek: 30, subjects: ["מדעים", "ביולוגיה"] },
    { name: "אמיר חדד", email: "amir@school.co.il", phone: "050-8901234", maxHoursPerWeek: 26, subjects: ["מדעים", "כימיה"] },
    { name: "טלי רוזנברג", email: "tali@school.co.il", phone: "050-9012345", maxHoursPerWeek: 28, subjects: ["היסטוריה", "אזרחות"] },
    { name: 'יעל מזרחי', email: "yael@school.co.il", phone: "050-0123456", maxHoursPerWeek: 30, subjects: ["היסטוריה"] },
    { name: 'רון ישראלי', email: "ron@school.co.il", phone: "052-1234567", maxHoursPerWeek: 24, subjects: ["תנ\"ך"] },
    { name: "ליאת כץ", email: "liat@school.co.il", phone: "052-2345678", maxHoursPerWeek: 20, subjects: ["ספורט"] },
    { name: "עומר סגל", email: "omer@school.co.il", phone: "052-3456789", maxHoursPerWeek: 20, subjects: ["ספורט"] },
    { name: "דנה ברק", email: "dana@school.co.il", phone: "052-4567890", maxHoursPerWeek: 22, subjects: ["אמנות"] },
    { name: "גיל אופיר", email: "gil@school.co.il", phone: "052-5678901", maxHoursPerWeek: 22, subjects: ["מוזיקה"] },
    { name: "איתי נחום", email: "itay@school.co.il", phone: "052-6789012", maxHoursPerWeek: 26, subjects: ["מחשבים"] },
    { name: "הילה אדלר", email: "hila@school.co.il", phone: "052-7890123", maxHoursPerWeek: 28, subjects: ["גיאוגרפיה"] },
    { name: "עידו פרץ", email: "ido@school.co.il", phone: "052-8901234", maxHoursPerWeek: 30, subjects: ["פיזיקה", "מתמטיקה"] },
    { name: "מאיה שלום", email: "maya@school.co.il", phone: "052-9012345", maxHoursPerWeek: 28, subjects: ["כימיה"] },
    { name: "אורי דביר", email: "ori@school.co.il", phone: "053-1234567", maxHoursPerWeek: 26, subjects: ["ביולוגיה"] },
  ];

  const teachers: Record<string, string> = {};
  for (const t of teachersData) {
    const { subjects: subjectNames, ...teacherData } = t;
    const teacher = await prisma.teacher.create({
      data: { ...teacherData, schoolId: school.id },
    });
    teachers[t.name] = teacher.id;

    // Link subjects
    for (const subjectName of subjectNames) {
      if (subjects[subjectName]) {
        await prisma.teacherSubject.create({
          data: { teacherId: teacher.id, subjectId: subjects[subjectName] },
        });
      }
    }
  }

  // Create rooms
  const roomsData = [
    { name: "101", capacity: 35, type: "REGULAR" },
    { name: "102", capacity: 35, type: "REGULAR" },
    { name: "103", capacity: 35, type: "REGULAR" },
    { name: "104", capacity: 35, type: "REGULAR" },
    { name: "105", capacity: 35, type: "REGULAR" },
    { name: "106", capacity: 35, type: "REGULAR" },
    { name: "201", capacity: 30, type: "REGULAR" },
    { name: "202", capacity: 30, type: "REGULAR" },
    { name: "203", capacity: 30, type: "REGULAR" },
    { name: "מעבדת מדעים", capacity: 25, type: "LAB" },
    { name: "חדר מחשבים", capacity: 30, type: "COMPUTER" },
    { name: "אולם ספורט", capacity: 80, type: "GYM" },
    { name: "אולם מוזיקה", capacity: 40, type: "AUDITORIUM" },
  ];

  for (const r of roomsData) {
    await prisma.room.create({
      data: { ...r, schoolId: school.id },
    });
  }

  // Create classes with homeroom teachers
  const classesData = [
    { name: "ז'1", grade: 7, studentCount: 32, homeroom: "רינת כהן" },
    { name: "ז'2", grade: 7, studentCount: 30, homeroom: "מיכל אברהם" },
    { name: "ז'3", grade: 7, studentCount: 31, homeroom: "שרה גולדשטיין" },
    { name: "ח'1", grade: 8, studentCount: 33, homeroom: "יוסי לוי" },
    { name: "ח'2", grade: 8, studentCount: 29, homeroom: "דוד שרון" },
    { name: "ח'3", grade: 8, studentCount: 31, homeroom: "אלון בן דוד" },
    { name: "ט'1", grade: 9, studentCount: 30, homeroom: "נועה פרידמן" },
    { name: "ט'2", grade: 9, studentCount: 32, homeroom: "אמיר חדד" },
    { name: "ט'3", grade: 9, studentCount: 28, homeroom: "טלי רוזנברג" },
    { name: "י'1", grade: 10, studentCount: 34, homeroom: "יעל מזרחי" },
    { name: "י'2", grade: 10, studentCount: 31, homeroom: "רון ישראלי" },
    { name: "י'3", grade: 10, studentCount: 30, homeroom: "הילה אדלר" },
    { name: "י\"א1", grade: 11, studentCount: 29, homeroom: "עידו פרץ" },
    { name: "י\"א2", grade: 11, studentCount: 30, homeroom: "מאיה שלום" },
    { name: "י\"א3", grade: 11, studentCount: 28, homeroom: "אורי דביר" },
    { name: "י\"ב1", grade: 12, studentCount: 27, homeroom: "איתי נחום" },
    { name: "י\"ב2", grade: 12, studentCount: 26, homeroom: "דנה ברק" },
    { name: "י\"ב3", grade: 12, studentCount: 28, homeroom: "גיל אופיר" },
  ];

  const classes: Record<string, string> = {};
  for (const c of classesData) {
    const { homeroom, ...classData } = c;
    const cls = await prisma.class.create({
      data: {
        ...classData,
        homeroomTeacherId: teachers[homeroom] || null,
        schoolId: school.id,
      },
    });
    classes[c.name] = cls.id;
  }

  // Get rooms
  const rooms = await prisma.room.findMany({ where: { schoolId: school.id } });
  const roomsByName: Record<string, string> = {};
  for (const r of rooms) roomsByName[r.name] = r.id;

  // Seed timetable slots for grade 7 classes (to demonstrate the system)
  // Teacher assignments per grade 7
  const g7Assignments: { subject: string; teacher: string; hours: number }[] = [
    { subject: "מתמטיקה", teacher: "רינת כהן", hours: 5 },
    { subject: "עברית", teacher: "מיכל אברהם", hours: 5 },
    { subject: "אנגלית", teacher: "שרה גולדשטיין", hours: 4 },
    { subject: "מדעים", teacher: "נועה פרידמן", hours: 3 },
    { subject: "היסטוריה", teacher: "טלי רוזנברג", hours: 2 },
    { subject: 'תנ"ך', teacher: "רון ישראלי", hours: 2 },
    { subject: "ספורט", teacher: "ליאת כץ", hours: 2 },
    { subject: "אמנות", teacher: "דנה ברק", hours: 1 },
    { subject: "מוזיקה", teacher: "גיל אופיר", hours: 1 },
    { subject: "מחשבים", teacher: "איתי נחום", hours: 1 },
    { subject: "גיאוגרפיה", teacher: "הילה אדלר", hours: 2 },
  ];

  // Track teacher occupancy: teacherId -> Set of "day-period"
  const teacherOccupancy: Record<string, Set<string>> = {};
  for (const tid of Object.values(teachers)) teacherOccupancy[tid] = new Set();

  function findFreeSlot(teacherId: string, used: Set<string>): { day: number; period: number } | null {
    for (let day = 0; day < 6; day++) {
      for (let period = 0; period < 9; period++) {
        const key = `${day}-${period}`;
        if (!teacherOccupancy[teacherId]?.has(key) && !used.has(key)) {
          return { day, period };
        }
      }
    }
    return null;
  }

  const grade7Classes = ["ז'1", "ז'2", "ז'3"];
  for (const className of grade7Classes) {
    const classId = classes[className];
    const classUsed = new Set<string>();

    for (const assignment of g7Assignments) {
      const subjectId = subjects[assignment.subject];
      const teacherId = teachers[assignment.teacher];
      if (!subjectId || !teacherId) continue;

      for (let h = 0; h < assignment.hours; h++) {
        const slot = findFreeSlot(teacherId, classUsed);
        if (!slot) continue;

        const key = `${slot.day}-${slot.period}`;
        classUsed.add(key);
        teacherOccupancy[teacherId].add(key);

        // Pick room: ספורט->אולם, מחשבים->חדר מחשבים, otherwise regular
        let roomId: string | null = null;
        if (assignment.subject === "ספורט") roomId = roomsByName["אולם ספורט"] || null;
        else if (assignment.subject === "מחשבים") roomId = roomsByName["חדר מחשבים"] || null;
        else if (assignment.subject === "מוזיקה") roomId = roomsByName["אולם מוזיקה"] || null;
        else roomId = roomsByName["101"] || null;

        await prisma.timetableSlot.create({
          data: {
            day: slot.day,
            period: slot.period,
            classId,
            teacherId,
            subjectId,
            roomId,
          },
        });
      }
    }
  }

  // Seed grade 8 with different teachers for diversity
  const g8Assignments: { subject: string; teacher: string; hours: number }[] = [
    { subject: "מתמטיקה", teacher: "יוסי לוי", hours: 5 },
    { subject: "עברית", teacher: "דוד שרון", hours: 5 },
    { subject: "אנגלית", teacher: "אלון בן דוד", hours: 4 },
    { subject: "מדעים", teacher: "אמיר חדד", hours: 3 },
    { subject: "היסטוריה", teacher: "יעל מזרחי", hours: 2 },
    { subject: 'תנ"ך', teacher: "רון ישראלי", hours: 2 },
    { subject: "ספורט", teacher: "עומר סגל", hours: 2 },
    { subject: "אמנות", teacher: "דנה ברק", hours: 1 },
    { subject: "מוזיקה", teacher: "גיל אופיר", hours: 1 },
    { subject: "מחשבים", teacher: "איתי נחום", hours: 1 },
    { subject: "גיאוגרפיה", teacher: "הילה אדלר", hours: 2 },
  ];

  const grade8Classes = ["ח'1", "ח'2", "ח'3"];
  for (const className of grade8Classes) {
    const classId = classes[className];
    const classUsed = new Set<string>();

    for (const assignment of g8Assignments) {
      const subjectId = subjects[assignment.subject];
      const teacherId = teachers[assignment.teacher];
      if (!subjectId || !teacherId) continue;

      for (let h = 0; h < assignment.hours; h++) {
        const slot = findFreeSlot(teacherId, classUsed);
        if (!slot) continue;

        const key = `${slot.day}-${slot.period}`;
        classUsed.add(key);
        teacherOccupancy[teacherId].add(key);

        let roomId: string | null = null;
        if (assignment.subject === "ספורט") roomId = roomsByName["אולם ספורט"] || null;
        else if (assignment.subject === "מחשבים") roomId = roomsByName["חדר מחשבים"] || null;
        else if (assignment.subject === "מוזיקה") roomId = roomsByName["אולם מוזיקה"] || null;
        else roomId = roomsByName["102"] || null;

        await prisma.timetableSlot.create({
          data: {
            day: slot.day,
            period: slot.period,
            classId,
            teacherId,
            subjectId,
            roomId,
          },
        });
      }
    }
  }

  // Add some teacher constraints
  // רינת כהן unavailable on Sunday period 0
  await prisma.teacherConstraint.create({
    data: {
      teacherId: teachers["רינת כהן"],
      type: "UNAVAILABLE",
      day: 0,
      period: 0,
    },
  });
  // יוסי לוי preferred off on Friday (day 5)
  await prisma.teacherConstraint.create({
    data: {
      teacherId: teachers["יוסי לוי"],
      type: "PREFERRED_OFF",
      day: 5,
      period: null,
    },
  });

  console.log("Seed completed successfully!");
  console.log("Login (school admin): admin@school.co.il / admin123");
  console.log("Login (super admin): superadmin@timetable.app / superadmin123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
