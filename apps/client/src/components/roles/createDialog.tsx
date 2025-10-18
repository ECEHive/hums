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
import { trpc } from "@ecehive/trpc/client";
import { useQueryClient } from "@tanstack/react-query";
import { JSX } from "react/jsx-runtime";
import { Label } from "@/components/ui/label"

export function CreateDialog(): JSX.Element {
    const queryClient = useQueryClient();

    const createRole = async (roleName: string) => {
        try {
            await trpc.roles.create.mutate({ name: roleName });

            // Invalidate the roles query to refresh data
            queryClient.invalidateQueries({ queryKey: ["roles"] });
        }
        catch (err) {
            console.error("Failed to create role:", err);
        }
    };

    return (
        <Dialog>
            <form>
                <DialogTrigger asChild>
                    <Button variant="outline">Create Role</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Creating New Role</DialogTitle>
                        <DialogDescription>
                            Enter a name for the new role.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-wrap gap-1">
                        <Label htmlFor="roleName">Role Name</Label>
                        <input
                            type="text"
                            id="roleName"
                            name="roleName"
                            defaultValue={undefined}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button onClick={() => {
                                const inputElement = document.getElementById("roleName") as HTMLInputElement;
                                const name = inputElement.value;
                                createRole(name);
                            }}>Create</Button>
                        </DialogClose>
                        <DialogClose asChild>
                            <Button variant="outline">Cancel</Button>
                        </DialogClose>
                    </DialogFooter>
                </DialogContent>
            </form>
        </Dialog>
    )
}
