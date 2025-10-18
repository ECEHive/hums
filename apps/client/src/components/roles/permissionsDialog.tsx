import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { getAllPermissions } from "@/lib/permissions";
import type { SelectPermission } from "@ecehive/drizzle";
import { trpc } from "@ecehive/trpc/client";
import { useQueryClient } from "@tanstack/react-query";
import { JSX } from "react/jsx-runtime";

type PermissionsDialogProps = {
    roleName: string;
    roleId: number;
    permissions: SelectPermission[];
};

export function PermissionsDialog({ roleName, roleId, permissions }: PermissionsDialogProps): JSX.Element {

    const queryClient = useQueryClient();

    const updateRolePermission = async (roleId: number, permissionId: number, assigned: boolean) => {
        try {
            if (assigned) {
                await trpc.rolePermissions.create.mutate({ roleId: roleId, permissionId: permissionId });
            }
            else {
                await trpc.rolePermissions.delete.mutate({ roleId: roleId, permissionId: permissionId });
            }

            // Invalidate the roles query to refresh data
            queryClient.invalidateQueries({ queryKey: ["roles"] });
        }
        catch (err) {
            console.error("Failed to update role permission:", err);
        }
    }

    const allPermissions = getAllPermissions();
    const rolePermissions = new Map<string, (SelectPermission & { assigned: boolean })[]>();

    // Iterate through permissions to mark assigned ones in rolePermissions map
    allPermissions.forEach((perms, type) => {
        const permsWithAssignment = perms.map((perm) => ({
            ...perm,
            assigned: permissions.some((p) => p.id === perm.id),
        }));
        rolePermissions.set(type, permsWithAssignment);
    });

    return (
        <Dialog>
            <form>
                <DialogTrigger asChild>
                    <Button variant="outline">Edit {permissions.length} permissions</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Permissions for {roleName}</DialogTitle>
                        <DialogDescription>
                            Changes saved automatically.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-wrap gap-1">
                        {Array.from(rolePermissions.entries()).map(([type, perms]) => (
                            <div key={type} className="w-full">
                                <h3 className="font-medium mt-4 mb-2">{type}</h3>
                                <div className="grid grid-cols-2 gap-2">
                                    {perms.map((perm) => (
                                        <Label key={perm.id} className="flex items-center space-x-2">
                                            <Checkbox
                                                onCheckedChange={(checked) =>
                                                    updateRolePermission(roleId, perm.id, checked as boolean)
                                                }
                                                defaultChecked={perm.assigned}
                                            />
                                            <span>{perm.name.split(".").pop()}</span>
                                        </Label>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="outline">Close</Button>
                        </DialogClose>
                    </DialogFooter>
                </DialogContent>
            </form>
        </Dialog>
    )
}
