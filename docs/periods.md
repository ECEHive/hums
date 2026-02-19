# Periods

This page describes how changes to periods, period exceptions, and shift schedules affect shift occurrences and attendance records.

## Overview

The system manages shifts through a hierarchy of entities:

```
Period
  └── PeriodException (exception dates when shifts don't occur)
  └── ShiftType (category of shifts)
        └── ShiftSchedule (recurring shift definition: day of week, time, slots)
              └── ShiftOccurrence (individual shift instance on a specific date)
                    └── ShiftAttendance (user's attendance record for an occurrence)
```

## Database Cascade Behavior

Due to Prisma cascade settings (`onDelete: Cascade`), the following automatic deletions occur:

- Deleting a **Period** → deletes all ShiftTypes, ShiftSchedules, ShiftOccurrences, and ShiftAttendances
- Deleting a **ShiftType** → deletes all ShiftSchedules, ShiftOccurrences, and ShiftAttendances
- Deleting a **ShiftSchedule** → deletes all ShiftOccurrences and ShiftAttendances
- Deleting a **ShiftOccurrence** → deletes all ShiftAttendances for that occurrence

## Period Exception Management

### Creating a Period Exception

When a period exception is created:

1. The exception date range is validated to fall within the period bounds
2. All shift occurrences for the period are regenerated
3. Occurrences falling within the exception date range are automatically **deleted**
4. Associated attendance records are cascade-deleted

**Key Point**: Attendance records for excepted dates are permanently removed when an exception is created.

### Deleting a Period Exception

When a period exception is deleted:

1. Shift occurrences are regenerated for the period
2. **Only future occurrences** are created for the previously excepted dates
3. Past occurrences (before current time) are NOT recreated

**Rationale**: Past shift occurrences should not be recreated because:
- The attendance records were already deleted
- Users cannot attend shifts that have already passed
- Historical data should not be fabricated

### Updating a Period Exception

When a period exception's date range is updated:

1. If the exception range **shrinks** (revealing previously excepted dates):
   - Only future occurrences are created for the revealed dates
   - Past occurrences are not recreated

2. If the exception range **expands** (covering more dates):
   - Occurrences in the newly excepted range are deleted
   - Attendance records are cascade-deleted

## Period Date Range Management

### Expanding Period Date Range

When a period's start date moves earlier or end date moves later:

1. Shift occurrences are regenerated
2. **Only future occurrences** are created for the expanded date range
3. Past occurrences outside the original range are NOT created

**Example**: If a period originally ran Jan 15 - Feb 15, and is changed to Jan 1 - Feb 28:
- Jan 1-14 (past): No occurrences created
- Feb 16-28 (future): New occurrences created

### Shrinking Period Date Range

When a period's date range shrinks:

1. Occurrences outside the new bounds are **deleted**
2. Attendance records are cascade-deleted
3. This applies to both past and future occurrences

**Warning**: Shrinking a period's date range will permanently delete historical attendance data for excluded dates.

## Shift Schedule Management

### Creating a Shift Schedule

When a shift schedule is created:

1. Occurrences are generated for all dates matching the day of week within the period
2. Period exceptions are automatically respected (no occurrences during exceptions)
3. All slots (1 to `slots` count) are created for each occurrence

### Updating a Shift Schedule

When a shift schedule's slot count changes:

- **Increasing slots**: New slot occurrences are created for all timestamps
- **Decreasing slots**: Excess slot occurrences are deleted (cascade deletes attendances)

When day of week or time changes:

1. All old occurrences are deleted
2. New occurrences are created based on the updated schedule
3. Period exceptions are respected

### Deleting a Shift Schedule

When a shift schedule is deleted:

1. All occurrences are cascade-deleted
2. All attendance records are cascade-deleted

## Shift Type Period Changes

When a shift type is moved to a different period:

1. All existing occurrences for the shift type's schedules are regenerated
2. **Only future occurrences** are created in the new period
3. Period exceptions in the new period are respected

## Attendance Record Behavior

### Automatic Deletion Scenarios

Attendance records are automatically deleted when:

1. Their parent shift occurrence is deleted
2. A period exception covers the occurrence date
3. The period date range shrinks to exclude the occurrence
4. The shift schedule is deleted or significantly changed

### Preserved Attendance Scenarios

Attendance records are preserved when:

1. Only the period name or visibility settings change
2. Shift type metadata (name, color, etc.) changes
3. Adding new slots to a schedule (existing slots untouched)

## Edge Cases and Important Notes

### Time Zone Handling

All occurrence timestamps are calculated using the application's configured time zone (`TZ` environment variable). This ensures:

- Consistent scheduling across daylight saving time transitions
- Wall-clock time preservation (e.g., 9:00 AM remains 9:00 AM regardless of DST)

### Concurrent Modifications

Period and schedule modifications use database transactions to ensure consistency. However, administrators should avoid concurrent modifications to the same period to prevent unexpected results.

### Data Recovery

**There is no automatic recovery mechanism** for deleted attendance records. Before making changes that could delete attendance data, consider:

1. Exporting attendance records for the affected period
2. Communicating changes to affected users
3. Having a plan for manual re-entry if needed

## API Reference

### Functions

#### `generatePeriodShiftOccurrences(tx, periodId, options?)`

Regenerates all shift occurrences for a period.

Options:
- `skipPastOccurrences: boolean` - When true, only creates future occurrences

#### `generateShiftScheduleShiftOccurrences(tx, shiftScheduleId, options?)`

Regenerates occurrences for a specific shift schedule.

Options:
- `skipPastOccurrences: boolean` - When true, only creates future occurrences

#### `filterPastTimestamps(timestamps, referenceTime?)`

Utility function to filter out past timestamps.

- `timestamps: Date[]` - Array of timestamps to filter
- `referenceTime?: Date` - Reference time (defaults to now)

## Summary Table

| Action | Past Occurrences | Future Occurrences | Attendance Records |
|--------|------------------|--------------------|--------------------|
| Create exception | Deleted | Deleted | Cascade deleted |
| Delete exception | Not recreated | Recreated | N/A (new occurrences) |
| Shrink exception | Not recreated | Recreated | N/A (new occurrences) |
| Expand exception | Deleted | Deleted | Cascade deleted |
| Expand period | Not created | Created | N/A (new occurrences) |
| Shrink period | Deleted | Deleted | Cascade deleted |
| Increase slots | Not created | Created | N/A (new occurrences) |
| Decrease slots | Deleted | Deleted | Cascade deleted |
| Change shift type period | Not created | Created | Previous deleted |
