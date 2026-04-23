import { notFound } from "next/navigation";
import { adminPosSalesEnabled } from "@/flags";
import { SalesClient } from "./SalesClient";

export default async function AdminSalesPage() {
  if (!(await adminPosSalesEnabled())) {
    notFound();
  }

  return <SalesClient />;
}
