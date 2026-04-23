import { redirect } from "next/navigation";

export default function AdminOrdersRedirectPage() {
  redirect("/admin/transactions/orders");
}
