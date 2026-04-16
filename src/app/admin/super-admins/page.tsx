import { listSuperAdmins } from "@/lib/admin-actions";
import { SuperAdminsClient } from "./super-admins-client";

export default async function SuperAdminsPage() {
  const superAdmins = await listSuperAdmins();
  return <SuperAdminsClient superAdmins={superAdmins} />;
}
