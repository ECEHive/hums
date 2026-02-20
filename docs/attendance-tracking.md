# Attendance Tracking

This page describes how the attendance tracking system works in HUMS, including shift scheduling, attendance tracking, drops, makeups, excuses, and calculations.

## Overview

The attendance system tracks member participation in scheduled shifts. It supports various attendance states and provides calculations for attendance rates and statistics.

## Core Concepts

### Shift Schedules

A **Shift Schedule** defines a recurring shift pattern:
- Day of week
- Start and end times
- Period (e.g., semester)
- Location
- Maximum number of members

### Shift Occurrences

A **Shift Occurrence** is a specific instance of a shift on a particular date. It's generated from a shift schedule and represents the actual shift that members need to attend.

### Shift Attendance

A **Shift Attendance** record tracks a member's participation in a specific shift occurrence. Each attendance record includes:
- Status (see below)
- Whether it's a makeup shift
- Time in/out (if present)
- Whether they arrived late or left early
- Excuse information (if applicable)

## Attendance Statuses

| Status | Description | Counted in Rate? |
|--------|-------------|------------------|
| `upcoming` | Shift hasn't occurred yet | No |
| `present` | Member attended the shift | Yes (positive) |
| `absent` | Member missed the shift | Yes (negative) |
| `dropped` | Shift was properly dropped by the member | No |
| `dropped_makeup` | A makeup shift that was dropped | No |
| `excused` | Absence was excused by an admin | Yes (as full credit) |

## Dropping Shifts

Members can drop a shift if:
1. The shift is in the future (not yet started)
2. They haven't already dropped too many shifts
3. The shift is at least a configurable time before it starts (e.g., 24 hours)

When a shift is dropped:
- The attendance status changes to `dropped`
- The member must schedule a makeup shift
- Dropped shifts are **excluded** from attendance rate calculations

### Makeup Shifts

When a member drops a shift, they receive "makeup credits" equal to the duration of the dropped shift. They can use these credits to:
1. Join an existing shift that has available capacity
2. The makeup shift is marked with `isMakeup: true`

Makeup shift flow:
1. Original shift → `dropped`
2. Makeup shift created → status becomes `upcoming`
3. Member attends makeup → status becomes `present`
4. If makeup dropped → status becomes `dropped_makeup`

## Excusing Attendance

Administrators with the `shift_attendances.excuse` permission can excuse attendance records. This is useful for:
- Legitimate emergencies
- Medical issues
- Pre-approved absences
- Other valid reasons

### How Excuses Work

When an attendance record is excused:
1. `isExcused` is set to `true`
2. `excuseNotes` contains the reason
3. `excusedById` references the admin who granted it
4. `excusedAt` records when it was excused

### Excused Shift Treatment

Excused shifts receive **full credit** in attendance calculations:
- They count as if the member was present
- They contribute full scheduled hours to "hours worked"
- They do not negatively impact attendance rate

## Attendance Calculations

### Attendance Rate Formula

```
Attendance Rate = (Present Count + Excused Count) / Eligible Shift Count × 100
```

Where:
- **Present Count**: Shifts with status `present`
- **Excused Count**: Shifts with `isExcused: true` OR status `excused`
- **Eligible Shift Count**: Total shifts minus excluded statuses

### Excluded from Attendance Rate

The following statuses are **not counted** when calculating attendance rate:
- `upcoming` - Hasn't happened yet
- `dropped` - Properly dropped, will be made up
- `dropped_makeup` - Dropped makeup shift

### Hours Calculation

```
Total Hours Worked = Sum of (timeOut - timeIn) for present shifts
                   + Sum of scheduled hours for excused shifts
```

### Time on Shift Percentage

```
Time on Shift % = (Total Hours Worked / Total Scheduled Hours) × 100
```

## Admin Review

The system identifies attendance records that may need admin review:

| Issue Type | Condition |
|------------|-----------|
| `dropped` | Status is `dropped` |
| `absent` | Status is `absent` and not excused |
| `late` | Arrived late (`didArriveLate: true`) |
| `left_early` | Left early (`didLeaveEarly: true`) |
| `partial` | Both arrived late and left early |

Records that are already excused (`isExcused: true`) do not appear in admin review.

## Protected Statuses

Certain statuses are "protected" and cannot be automatically changed by the system:
- `dropped` - Member intentionally dropped
- `dropped_makeup` - Dropped makeup shift
- `excused` - Admin-excused absence

The background worker that updates attendance statuses will not overwrite these protected statuses.

## API Routes

### Member Routes

| Route | Description |
|-------|-------------|
| `shiftAttendances.myStats` | Get personal attendance statistics |
| `shiftDrops.drop` | Drop an upcoming shift |
| `shiftDrops.makeDrop` | Schedule a makeup shift |

### Admin Routes

| Route | Permission | Description |
|-------|------------|-------------|
| `shiftAttendances.listIssues` | `shift_attendances.read` | List attendance issues for review |
| `shiftAttendances.grantExcuse` | `shift_attendances.excuse` | Excuse an attendance record |
| `shiftAttendances.revokeExcuse` | `shift_attendances.excuse` | Remove excuse from a record |

## Background Workers

### Update Shift Attendance Worker

Runs periodically to update attendance statuses:
1. Finds shifts that have ended
2. For shifts still in `upcoming` status:
   - If member checked in → `present`
   - If no check-in → `absent`
3. Skips protected statuses (`dropped`, `dropped_makeup`, `excused`)

## Report Generation

When generating attendance reports:
1. Only `present` and `absent` statuses are included in base counts
2. `excused` shifts are counted as attended
3. `dropped` and `dropped_makeup` shifts are excluded
4. `upcoming` shifts are excluded

## Database Schema

### Key Fields in ShiftAttendance

```prisma
model ShiftAttendance {
  id                String                @id @default(cuid())
  status            ShiftAttendanceStatus @default(upcoming)
  isMakeup          Boolean               @default(false)
  timeIn            DateTime?
  timeOut           DateTime?
  didArriveLate     Boolean               @default(false)
  didLeaveEarly     Boolean               @default(false)
  
  // Excuse tracking
  isExcused         Boolean               @default(false)
  excuseNotes       String?
  excusedById       String?
  excusedAt         DateTime?
  
  // Relations
  member            User                  @relation("attendance", ...)
  excusedBy         User?                 @relation("excusedAttendances", ...)
  shiftOccurrence   ShiftOccurrence       @relation(...)
}

enum ShiftAttendanceStatus {
  upcoming
  present
  absent
  dropped
  dropped_makeup
  excused
}
```

## Permissions

| Permission | Description |
|------------|-------------|
| `shift_attendances.read` | View attendance records |
| `shift_attendances.write` | Modify attendance records |
| `shift_attendances.excuse` | Grant or revoke excuses |

## Best Practices

### For Members
1. Drop shifts as early as possible to find makeup options
2. Check in on time to avoid late marks
3. Stay for the full shift to avoid early departure marks
4. Contact admins promptly if you need an excuse

### For Admins
1. Review attendance issues regularly
2. Document excuse reasons clearly
3. Be consistent with excuse policies
4. Monitor patterns that may indicate issues

## Edge Cases Handled

1. **Shift dropped after starting**: Cannot drop, must complete or be marked absent
2. **Multiple drops in short period**: Rate limited by configuration
3. **Makeup shift capacity full**: Cannot create makeup for that occurrence
4. **Excused then unexcused**: Revoke resets all excuse fields
5. **Already protected status**: Won't be overwritten by worker
6. **Empty attendance history**: Returns 0% rate, not error
7. **All shifts dropped**: 0 eligible shifts, returns 0% rate
