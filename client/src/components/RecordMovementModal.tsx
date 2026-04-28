import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../lib/queryClient";
import { invalidateStockData } from "../lib/invalidation";
import { MOVEMENT_TYPES, SUPPLY_LOCATIONS } from "../../../shared/calculations/movements";
import type { MovementInput, SupplyLocation } from "../../../shared/calculations/movements";

type Direction = "in" | "out" | "adjustment";
type SubjectKind = "product" | "supply";
type MovementType = MovementInput["type"];

interface Props {
  subjectKind: SubjectKind;
  /** SKU code for products, supplyId for supplies */
  subjectId: string | number;
  subjectName: string;
  initialLocation?: string;
  /** Product locations only — supplies always use SUPPLY_LOCATIONS */
  locations?: string[];
  onClose: () => void;
  onSuccess?: () => void;
}

const PRODUCT_LOCATIONS_DEFAULT = ["THH", "88"];
const TWO_ROW_TYPES: ReadonlySet<MovementType> = new Set([
  "TRANSFER",
  "SUPPLY_TRANSFER",
  "SUPPLY_SENT_TO_MANUFACTURER",
]);
const ADJUSTMENT_TYPES: ReadonlySet<MovementType> = new Set([
  "ADJUSTMENT_IN",
  "ADJUSTMENT_OUT",
]);

function inDirection(type: MovementType, direction: Direction, registryDirection: "in" | "out"): boolean {
  if (direction === "adjustment") return ADJUSTMENT_TYPES.has(type);
  return registryDirection === direction && !ADJUSTMENT_TYPES.has(type);
}

export default function RecordMovementModal({
  subjectKind,
  subjectId,
  subjectName,
  initialLocation = "THH",
  locations = PRODUCT_LOCATIONS_DEFAULT,
  onClose,
  onSuccess,
}: Props) {
  const qc = useQueryClient();

  const effectiveLocations: string[] =
    subjectKind === "supply" ? SUPPLY_LOCATIONS.slice() : locations;
  const initialLoc = effectiveLocations.includes(initialLocation) ? initialLocation : effectiveLocations[0];

  const eligibleTypes = MOVEMENT_TYPES.filter((m) => m.subjectKinds.includes(subjectKind));
  const [direction, setDirection] = useState<Direction>("in");
  const typesForDirection = eligibleTypes.filter((m) =>
    inDirection(m.type as MovementType, direction, m.direction),
  );
  const [selectedType, setSelectedType] = useState<MovementType>(
    (typesForDirection[0]?.type as MovementType) ?? "OPENING_BALANCE",
  );

  const today = new Date().toISOString().slice(0, 10);
  const [quantity, setQuantity] = useState<string>("");
  const [date, setDate] = useState<string>(today);
  const [location, setLocation] = useState<string>(initialLoc);
  const [fromLocation, setFromLocation] = useState<string>(initialLoc);
  const [toLocation, setToLocation] = useState<string>(
    effectiveLocations.find((l) => l !== initialLoc) ?? effectiveLocations[0],
  );
  const [reasonText, setReasonText] = useState<string>("");
  const [deliveryNoteRef, setDeliveryNoteRef] = useState<string>("");
  const [batchNumber, setBatchNumber] = useState<string>("");
  const [manufactureDate, setManufactureDate] = useState<string>(today);
  const [expiryDate, setExpiryDate] = useState<string>("");
  const [sizeVariant, setSizeVariant] = useState<string>("");
  const [invoiceRef, setInvoiceRef] = useState<string>("");
  const [channel, setChannel] = useState<string>("");
  const [reference, setReference] = useState<string>("");
  const [manufacturerName, setManufacturerName] = useState<string>("");

  function onDirectionChange(d: Direction) {
    setDirection(d);
    const first = eligibleTypes.find((m) =>
      inDirection(m.type as MovementType, d, m.direction),
    )?.type as MovementType | undefined;
    if (first) setSelectedType(first);
  }

  const meta = MOVEMENT_TYPES.find((m) => m.type === selectedType);

  const mutation = useMutation({
    mutationFn: (payload: MovementInput) =>
      apiRequest("/api/movements", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      invalidateStockData(qc);
      onSuccess?.();
      onClose();
    },
  });

  function buildPayload(): MovementInput | null {
    const qtyNum = parseFloat(quantity);
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) return null;
    if (!meta) return null;

    if (subjectKind === "product") {
      const sku = String(subjectId);
      switch (selectedType) {
        case "OPENING_BALANCE":
          return { type: "OPENING_BALANCE", subjectKind: "product", skuCode: sku, location, quantity: qtyNum, date };
        case "DELIVERY_RECEIVED":
          return {
            type: "DELIVERY_RECEIVED",
            subjectKind: "product",
            skuCode: sku,
            location,
            quantity: qtyNum,
            date,
            deliveryNoteRef: deliveryNoteRef || undefined,
            batchNumber,
            manufactureDate,
            expiryDate,
            sizeVariant: sizeVariant || undefined,
          };
        case "ADJUSTMENT_IN":
          return { type: "ADJUSTMENT_IN", subjectKind: "product", skuCode: sku, location, quantity: qtyNum, date, reasonText };
        case "ADJUSTMENT_OUT":
          return { type: "ADJUSTMENT_OUT", subjectKind: "product", skuCode: sku, location, quantity: qtyNum, date, reasonText };
        case "TRANSFER":
          return {
            type: "TRANSFER",
            subjectKind: "product",
            skuCode: sku,
            fromLocation,
            toLocation,
            quantity: qtyNum,
            date,
          };
        case "SALES_OUT":
          return {
            type: "SALES_OUT",
            subjectKind: "product",
            skuCode: sku,
            location,
            quantity: qtyNum,
            date,
            invoiceRef: invoiceRef || undefined,
            channel: channel || undefined,
            reasonText: reasonText || undefined,
          };
      }
    } else {
      const supplyId = Number(subjectId);
      const loc = location as SupplyLocation;
      const fromLoc = fromLocation as SupplyLocation;
      const toLoc = toLocation as SupplyLocation;
      switch (selectedType) {
        case "OPENING_BALANCE":
          return { type: "OPENING_BALANCE", subjectKind: "supply", supplyId, location: loc, quantity: qtyNum, date };
        case "DELIVERY_RECEIVED":
          return {
            type: "DELIVERY_RECEIVED",
            subjectKind: "supply",
            supplyId,
            location: loc,
            quantity: qtyNum,
            date,
            reference: reference || undefined,
          };
        case "ADJUSTMENT_IN":
          return { type: "ADJUSTMENT_IN", subjectKind: "supply", supplyId, location: loc, quantity: qtyNum, date, reasonText };
        case "ADJUSTMENT_OUT":
          return { type: "ADJUSTMENT_OUT", subjectKind: "supply", supplyId, location: loc, quantity: qtyNum, date, reasonText };
        case "SUPPLY_TRANSFER":
          return {
            type: "SUPPLY_TRANSFER",
            subjectKind: "supply",
            supplyId,
            fromLocation: fromLoc,
            toLocation: toLoc,
            quantity: qtyNum,
            date,
          };
        case "SUPPLY_SENT_TO_MANUFACTURER":
          return {
            type: "SUPPLY_SENT_TO_MANUFACTURER",
            subjectKind: "supply",
            supplyId,
            fromLocation: fromLoc,
            toLocation: toLoc,
            quantity: qtyNum,
            date,
            manufacturerName: manufacturerName || undefined,
            reference: reference || undefined,
          };
      }
    }
    return null;
  }

  const payload = buildPayload();
  const payloadValid = payload !== null && (!meta?.requiresReason || reasonText.trim().length > 0);
  if (meta?.type === "DELIVERY_RECEIVED" && subjectKind === "product") {
    if (!batchNumber.trim() || !manufactureDate || !expiryDate) {
      // payloadValid already false because buildPayload returns shape but validator will reject
    }
  }

  const error = mutation.error as Error | null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4 space-y-4 max-h-[90vh] overflow-y-auto">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Record movement</h2>
          <p className="text-sm text-slate-500 mt-0.5">{subjectName}</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
            {error.message}
          </div>
        )}

        <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
          <button
            onClick={() => onDirectionChange("in")}
            className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              direction === "in" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
            }`}
          >
            + Stock in
          </button>
          <button
            onClick={() => onDirectionChange("out")}
            className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              direction === "out" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
            }`}
          >
            − Stock out
          </button>
          <button
            onClick={() => onDirectionChange("adjustment")}
            className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              direction === "adjustment" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
            }`}
          >
            ± Adjustment
          </button>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Reason</label>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value as MovementType)}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm"
          >
            {typesForDirection.map((m) => (
              <option key={m.type} value={m.type}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Quantity</label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              min="0"
              step="any"
              className="w-full px-3 py-2 border border-border rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm"
            />
          </div>
        </div>

        {/* Single-location dropdown — for any movement that isn't a two-row transfer */}
        {!TWO_ROW_TYPES.has(selectedType) && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {subjectKind === "supply" ? "Location" : "Stock location"}
            </label>
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm"
            >
              {effectiveLocations.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Transfer from/to — for any two-row movement (TRANSFER, SUPPLY_TRANSFER, SUPPLY_SENT_TO_MANUFACTURER) */}
        {TWO_ROW_TYPES.has(selectedType) && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">From</label>
              <select
                value={fromLocation}
                onChange={(e) => setFromLocation(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm"
              >
                {effectiveLocations.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">To</label>
              <select
                value={toLocation}
                onChange={(e) => setToLocation(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm"
              >
                {effectiveLocations.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Delivery-only fields (products) */}
        {selectedType === "DELIVERY_RECEIVED" && subjectKind === "product" && (
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Delivery note ref</label>
              <input
                type="text"
                value={deliveryNoteRef}
                onChange={(e) => setDeliveryNoteRef(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Batch number *</label>
                <input
                  type="text"
                  value={batchNumber}
                  onChange={(e) => setBatchNumber(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Size variant</label>
                <input
                  type="text"
                  value={sizeVariant}
                  onChange={(e) => setSizeVariant(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Manufacture date *</label>
                <input
                  type="date"
                  value={manufactureDate}
                  onChange={(e) => setManufactureDate(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Expiry date *</label>
                <input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm"
                />
              </div>
            </div>
          </div>
        )}

        {/* Supply delivery / sent-to-mfr reference */}
        {(selectedType === "DELIVERY_RECEIVED" && subjectKind === "supply") ||
        selectedType === "SUPPLY_SENT_TO_MANUFACTURER" ? (
          <div className="space-y-3">
            {selectedType === "SUPPLY_SENT_TO_MANUFACTURER" && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Manufacturer name</label>
                <input
                  type="text"
                  value={manufacturerName}
                  onChange={(e) => setManufacturerName(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Reference</label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="PO number, invoice, etc."
                className="w-full px-3 py-2 border border-border rounded-lg text-sm"
              />
            </div>
          </div>
        ) : null}

        {/* Sales-specific */}
        {selectedType === "SALES_OUT" && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Invoice ref</label>
              <input
                type="text"
                value={invoiceRef}
                onChange={(e) => setInvoiceRef(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Channel</label>
              <input
                type="text"
                value={channel}
                onChange={(e) => setChannel(e.target.value.toUpperCase())}
                placeholder="D, W, R, C, G"
                maxLength={5}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm"
              />
            </div>
          </div>
        )}

        {/* Reason required for adjustments */}
        {meta?.requiresReason && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Reason *</label>
            <textarea
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              rows={2}
              placeholder="Why is this adjustment needed?"
              className="w-full px-3 py-2 border border-border rounded-lg text-sm"
            />
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            onClick={() => {
              if (payload) mutation.mutate(payload);
            }}
            disabled={!payloadValid || mutation.isPending}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {mutation.isPending ? "Recording…" : "Record movement"}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 border border-border text-slate-700 rounded-lg text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
