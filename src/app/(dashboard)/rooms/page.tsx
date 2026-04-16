import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createRoom, deleteRoom, updateRoom } from "@/lib/actions";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ROOM_TYPE_HE } from "@/lib/constants";
import { EntityDialog } from "@/components/ui/entity-dialog";
import { DeleteButton } from "@/components/ui/delete-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";

function RoomForm({
  defaultValues,
  pending,
}: {
  defaultValues?: { name: string; capacity: string; type: string };
  pending: boolean;
  close: () => void;
}) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="name">שם חדר</Label>
        <Input id="name" name="name" defaultValue={defaultValues?.name} required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="capacity">קיבולת</Label>
          <Input
            id="capacity"
            name="capacity"
            type="number"
            min={1}
            dir="ltr"
            defaultValue={defaultValues?.capacity || "40"}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="type">סוג</Label>
          <select
            id="type"
            name="type"
            defaultValue={defaultValues?.type || "REGULAR"}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          >
            {Object.entries(ROOM_TYPE_HE).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex gap-2 justify-start">
        <Button type="submit" disabled={pending}>
          {pending ? "שומר..." : "שמירה"}
        </Button>
      </div>
    </>
  );
}

export default async function RoomsPage() {
  const session = await auth();
  const schoolId = (session?.user as Record<string, unknown>)?.schoolId as string;

  const rooms = await prisma.room.findMany({
    where: { schoolId },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">חדרים</h2>
        <EntityDialog title="הוספת חדר" action={createRoom}>
          {(props) => <RoomForm {...props} />}
        </EntityDialog>
      </div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>שם</TableHead>
              <TableHead>סוג</TableHead>
              <TableHead>קיבולת</TableHead>
              <TableHead className="w-20">פעולות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rooms.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  אין חדרים עדיין. לחצו על &quot;הוספה&quot; כדי להתחיל.
                </TableCell>
              </TableRow>
            ) : (
              rooms.map((room) => (
                <TableRow key={room.id}>
                  <TableCell className="font-medium">{room.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{ROOM_TYPE_HE[room.type] || room.type}</Badge>
                  </TableCell>
                  <TableCell>{room.capacity}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <EntityDialog
                        title="עריכת חדר"
                        action={updateRoom.bind(null, room.id)}
                        trigger={
                          <Button variant="ghost" size="icon">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        }
                      >
                        {(props) => (
                          <RoomForm
                            {...props}
                            defaultValues={{
                              name: room.name,
                              capacity: room.capacity.toString(),
                              type: room.type,
                            }}
                          />
                        )}
                      </EntityDialog>
                      <DeleteButton
                        action={deleteRoom.bind(null, room.id)}
                        entityName={room.name}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
