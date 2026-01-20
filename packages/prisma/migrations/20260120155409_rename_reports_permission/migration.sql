-- Rename reports.generate permission to period.reports
-- This consolidates all report generation under a single period-scoped permission

-- Update the permission name
UPDATE "Permission"
SET name = 'period.reports'
WHERE name = 'reports.generate';
