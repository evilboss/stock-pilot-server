-- CreateEnum
CREATE TYPE "AttendanceEventType" AS ENUM ('CLOCK_IN', 'LUNCH_OUT', 'LUNCH_IN', 'CLOCK_OUT');

-- CreateEnum
CREATE TYPE "AttendanceMethod" AS ENUM ('MANUAL', 'QR');

-- CreateEnum
CREATE TYPE "AttendanceRecordStatus" AS ENUM ('IN_PROGRESS', 'COMPLETE', 'EXCEPTION');

-- CreateTable
CREATE TABLE "company_attendance_settings" (
    "id" TEXT NOT NULL,
    "enableManualAttendance" BOOLEAN NOT NULL DEFAULT true,
    "enableQrAttendance" BOOLEAN NOT NULL DEFAULT false,
    "defaultMethod" "AttendanceMethod" NOT NULL DEFAULT 'MANUAL',
    "enableLunchTracking" BOOLEAN NOT NULL DEFAULT false,
    "requireLunchTracking" BOOLEAN NOT NULL DEFAULT false,
    "actionCooldownSeconds" INTEGER NOT NULL DEFAULT 60,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_attendance_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_attendance_flags" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "allowManualOverride" BOOLEAN,
    "allowQrOverride" BOOLEAN,
    "enableLunchOverride" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_attendance_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_records" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workDate" DATE NOT NULL,
    "status" "AttendanceRecordStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "totalWorkMins" INTEGER,
    "totalBreakMins" INTEGER,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_events" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "eventType" "AttendanceEventType" NOT NULL,
    "method" "AttendanceMethod" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "sourceIp" TEXT,
    "sourceDevice" TEXT,
    "qrTerminalId" TEXT,
    "isCorrection" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qr_terminals" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "location" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "allowedActions" "AttendanceEventType"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "qr_terminals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_correction_logs" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "editorId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "oldData" JSONB NOT NULL,
    "newData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_correction_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "employee_attendance_flags_userId_key" ON "employee_attendance_flags"("userId");

-- CreateIndex
CREATE INDEX "attendance_records_userId_workDate_idx" ON "attendance_records"("userId", "workDate");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_userId_workDate_key" ON "attendance_records"("userId", "workDate");

-- CreateIndex
CREATE INDEX "attendance_events_recordId_occurredAt_idx" ON "attendance_events"("recordId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "qr_terminals_code_key" ON "qr_terminals"("code");

-- AddForeignKey
ALTER TABLE "employee_attendance_flags" ADD CONSTRAINT "employee_attendance_flags_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_events" ADD CONSTRAINT "attendance_events_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "attendance_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_events" ADD CONSTRAINT "attendance_events_qrTerminalId_fkey" FOREIGN KEY ("qrTerminalId") REFERENCES "qr_terminals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_correction_logs" ADD CONSTRAINT "attendance_correction_logs_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "attendance_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_correction_logs" ADD CONSTRAINT "attendance_correction_logs_editorId_fkey" FOREIGN KEY ("editorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
