-- Rename reports.generate permission to period.reports
-- This consolidates all report generation under a single period-scoped permission
--
-- BREAKING CHANGE: This migration renames the 'reports.generate' permission to 'period.reports'.
-- Any existing roles that had 'reports.generate' assigned will automatically get 'period.reports'
-- due to the UPDATE, but any external systems or configurations referencing the old permission
-- name will need to be updated.

-- Update the permission name
UPDATE "Permission"
SET name = 'period.reports'
WHERE name = 'reports.generate';
