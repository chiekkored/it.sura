import { notFound } from "next/navigation";
import { adminPosSalesEnabled } from "@/flags";
import { PosClient } from "./PosClient";

export default async function AdminPosPage() {
  if (!(await adminPosSalesEnabled())) {
    notFound();
  }

  return <PosClient />;
}
