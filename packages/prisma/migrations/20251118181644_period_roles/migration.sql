-- CreateTable
CREATE TABLE "_PeriodRoles" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_PeriodRoles_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_PeriodRoles_B_index" ON "_PeriodRoles"("B");

-- AddForeignKey
ALTER TABLE "_PeriodRoles" ADD CONSTRAINT "_PeriodRoles_A_fkey" FOREIGN KEY ("A") REFERENCES "Period"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PeriodRoles" ADD CONSTRAINT "_PeriodRoles_B_fkey" FOREIGN KEY ("B") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Remove old permissions
DELETE FROM "Permission" WHERE
    name IN (
        'shift_schedules.register',
        'shift_schedules.unregister',
        'shift_occurrences.pickup',
        'shift_occurrences.drop'
    );
