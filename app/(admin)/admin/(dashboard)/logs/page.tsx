import { notFound } from "next/navigation";
import { adminLogsEnabled } from "@/flags";
import { LogsClient } from "./LogsClient";

export default async function AdminLogsPage() {
  if (!(await adminLogsEnabled())) {
    notFound();
  }

  return <LogsClient />;
}
