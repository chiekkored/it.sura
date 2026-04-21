"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { OrderStatus } from "@/types";
import { Pencil } from "lucide-react";
import { toast } from "sonner";

const statuses: { value: OrderStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "pending_payment", label: "Pending Payment" },
  { value: "closed", label: "Closed" },
  { value: "cancelled", label: "Cancelled" },
];

interface UpdateOrderStatusModalProps {
  orderId: string;
  requestCode: string;
  itemName: string;
  currentStatus: OrderStatus;
  onSuccess?: () => void;
}

export function UpdateOrderStatusModal({
  orderId,
  requestCode,
  itemName,
  currentStatus,
  onSuccess,
}: UpdateOrderStatusModalProps) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<OrderStatus>(currentStatus);
  const [loading, setLoading] = useState(false);

  const handleUpdate = async () => {
    setLoading(true);
    const res = await fetch(`/api/orders/${orderId}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    setLoading(false);
    if (!res.ok) {
      toast.error("Failed to update status");
      return;
    }

    toast.success("Order status updated");
    setOpen(false);
    onSuccess?.();
  };

  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      title="Update Order Status"
      description={`${itemName} (${requestCode})`}
      trigger={
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Pencil className="h-4 w-4" />
        </Button>
      }
      footer={
        <div className="flex gap-2 w-full justify-end">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleUpdate} disabled={loading}>
            {loading ? "Updating..." : "Update Status"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 pt-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Status</label>
          <Select value={status} onValueChange={(val) => setStatus(val as OrderStatus)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statuses.map(({ value, label }) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </Modal>
  );
}
