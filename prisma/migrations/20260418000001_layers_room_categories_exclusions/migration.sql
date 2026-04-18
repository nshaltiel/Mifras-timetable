-- Migration: layers, room categories, teacher-class exclusions, class.layerId, room.categoryId

-- Layer table
CREATE TABLE "Layer" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Layer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Layer_schoolId_name_key" ON "Layer"("schoolId", "name");
ALTER TABLE "Layer" ADD CONSTRAINT "Layer_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- LayerRoom pivot table
CREATE TABLE "LayerRoom" (
    "layerId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    CONSTRAINT "LayerRoom_pkey" PRIMARY KEY ("layerId","roomId")
);

ALTER TABLE "LayerRoom" ADD CONSTRAINT "LayerRoom_layerId_fkey" FOREIGN KEY ("layerId") REFERENCES "Layer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LayerRoom" ADD CONSTRAINT "LayerRoom_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RoomCategory table
CREATE TABLE "RoomCategory" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "RoomCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RoomCategory_schoolId_name_key" ON "RoomCategory"("schoolId", "name");
ALTER TABLE "RoomCategory" ADD CONSTRAINT "RoomCategory_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- TeacherExcludedClass table
CREATE TABLE "TeacherExcludedClass" (
    "teacherId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "reason" TEXT,
    CONSTRAINT "TeacherExcludedClass_pkey" PRIMARY KEY ("teacherId","classId")
);

ALTER TABLE "TeacherExcludedClass" ADD CONSTRAINT "TeacherExcludedClass_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeacherExcludedClass" ADD CONSTRAINT "TeacherExcludedClass_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add layerId to Class
ALTER TABLE "Class" ADD COLUMN "layerId" TEXT;
ALTER TABLE "Class" ADD CONSTRAINT "Class_layerId_fkey" FOREIGN KEY ("layerId") REFERENCES "Layer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add categoryId to Room (nullable — coexists with legacy type field)
ALTER TABLE "Room" ADD COLUMN "categoryId" TEXT;
ALTER TABLE "Room" ADD CONSTRAINT "Room_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "RoomCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
