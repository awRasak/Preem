"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";
import { formatNaira } from "@/lib/format";

export type OpsOrder = {
  id: string;
  fan_name: string;
  fan_phone: string;
  address: string;
  zone_label: string;
  quantity: number;
  amount_kobo: number;
  fulfillment: string;
  purchased_at: string | null;
  created_at: string;
  merch_items: { id: string; title: string; stock: number; artist: { id: string; stage_name: string } | { id: string; stage_name: string }[] | null } | { id: string; title: string; stock: number; artist: { id: string; stage_name: string } | { id: string; stage_name: string }[] | null }[] | null;
};

export type OpsItem = {
  id: string;
  title: string;
  stock: number;
  status: string;
  artist: { stage_name: string } | { stage_name: string }[] | null;
};

export type OpsZone = { id: string; label: string; fee_kobo: number };

const NEXT_STEP: Record<string, string | null> = {
  pending: "preparing",
  preparing: "shipped",
  shipped: "delivered",
  delivered: null,
};

const STEP_LABEL: Record<string, string> = {
  pending: "Received",
  preparing: "Preparing",
  shipped: "Shipped",
  delivered: "Delivered",
};

function OrderRow({ order }: { order: OpsOrder }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const item = Array.isArray(order.merch_items) ? order.merch_items[0] : order.merch_items;
  const artist = item && (Array.isArray(item.artist) ? item.artist[0] : item.artist);
  const next = NEXT_STEP[order.fulfillment] ?? null;

  async function advance() {
    if (!next) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/merch/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fulfillment: next }),
    });
    setBusy(false);
    if (!res.ok) {
      setError("Could not update.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="truncate text-sm font-bold">
          {order.quantity} × {item?.title ?? "Item"}
          {artist ? <span className="font-normal text-muted"> · {artist.stage_name}</span> : null}
        </p>
        <Badge status={order.fulfillment === "delivered" ? "live" : order.fulfillment === "pending" ? "pending" : "closed"}>
          {STEP_LABEL[order.fulfillment] ?? order.fulfillment}
        </Badge>
      </div>
      <p className="mt-1 text-xs text-muted">
        {order.fan_name} · {order.fan_phone} · {order.zone_label || "Delivery"} ·{" "}
        {formatNaira(order.amount_kobo)}
      </p>
      <p className="mt-0.5 truncate text-xs text-muted">{order.address}</p>
      <div className="mt-2 flex items-center gap-2">
        {error && <span className="text-xs text-[#ff6b6b]">{error}</span>}
        {next && (
          <Button
            variant="outline"
            disabled={busy}
            onClick={advance}
            className="!px-3 !py-1.5 text-xs"
          >
            {busy ? "…" : `Mark ${STEP_LABEL[next].toLowerCase()}`}
          </Button>
        )}
      </div>
    </div>
  );
}

export function MerchOpsTable({
  orders,
  items,
  zones,
}: {
  orders: OpsOrder[];
  items: OpsItem[];
  zones: OpsZone[];
}) {
  const lowStock = items.filter((i) => i.stock <= 3);

  return (
    <>
      {lowStock.length > 0 && (
        <div className="mb-8 rounded-xl border border-accent/40 bg-surface p-4">
          <h2 className="mb-2 text-sm font-bold text-accent">Restock needed</h2>
          <ul className="space-y-1">
            {lowStock.map((i) => {
              const artist = Array.isArray(i.artist) ? i.artist[0] : i.artist;
              return (
                <li key={i.id} className="text-xs text-muted">
                  {i.title}
                  {artist ? ` · ${artist.stage_name}` : ""} —{" "}
                  <span className="font-bold text-paper">
                    {i.stock <= 0 ? "out of stock" : `${i.stock} left`}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <h2 className="mb-4 text-lg font-bold">Orders ({orders.length})</h2>
      {orders.length === 0 ? (
        <p className="mb-8 text-sm text-muted">No paid orders yet.</p>
      ) : (
        <div className="mb-8 divide-y divide-line overflow-hidden rounded-xl border border-line">
          {orders.map((o) => (
            <OrderRow key={o.id} order={o} />
          ))}
        </div>
      )}

      <h2 className="mb-4 text-lg font-bold">Delivery zones</h2>
      <div className="divide-y divide-line overflow-hidden rounded-xl border border-line">
        {zones.length === 0 ? (
          <p className="p-4 text-sm text-muted">No zones configured.</p>
        ) : (
          zones.map((z) => (
            <div key={z.id} className="flex items-center justify-between gap-3 p-4">
              <span className="text-sm font-medium">{z.label}</span>
              <span className="text-sm font-bold">
                {z.fee_kobo === 0 ? "Free" : formatNaira(z.fee_kobo)}
              </span>
            </div>
          ))
        )}
      </div>
    </>
  );
}
