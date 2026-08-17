import { fulfilmentRepository } from "./repository";
import { logisticsRepository } from "../logistics/repository";
import { vendorsRepository } from "../vendors/repository";
import { notificationsService } from "../notifications/service";
import { notificationLinks } from "../notifications/links";
import { ok, err, type Result } from "../../lib/result";
import type {
  AdminFulfilmentDetail,
  AdminFulfilmentSummary,
  CustomerPackageTracking,
  CustomerTrackingStep,
  FulfilmentItemView,
  ShipmentView,
  VendorFulfilmentDetail,
  VendorFulfilmentSummary,
} from "./types";

type RawItem = { id: string; quantity: number; orderItem: { description: string } };

function toItemViews(items: RawItem[]): FulfilmentItemView[] {
  return items.map((item) => ({ id: item.id, description: item.orderItem.description, quantity: item.quantity }));
}

function toShipmentView(raw: {
  id: string;
  status: string;
  carrier: string | null;
  trackingReference: string | null;
  collectionScheduledAt: Date | null;
  collectionNotes: string | null;
  collectedAt: Date | null;
  receivingLocation: { name: string; addressLine1: string; city: string | null; region: string | null; country: string; contactName: string | null; contactPhone: string | null } | null;
  shippedAt: Date | null;
  expectedArrivalAt: Date | null;
  receivedAt: Date | null;
  outForDeliveryAt: Date | null;
  deliveredAt: Date | null;
  deliveryFailedAt: Date | null;
  deliveryNotes: string | null;
  customerConfirmedReceiptAt: Date | null;
} | undefined): ShipmentView | null {
  if (!raw) return null;
  return {
    id: raw.id,
    status: raw.status as ShipmentView["status"],
    carrier: raw.carrier,
    trackingReference: raw.trackingReference,
    collectionScheduledAt: raw.collectionScheduledAt,
    collectionNotes: raw.collectionNotes,
    collectedAt: raw.collectedAt,
    receivingLocation: raw.receivingLocation,
    shippedAt: raw.shippedAt,
    expectedArrivalAt: raw.expectedArrivalAt,
    receivedAt: raw.receivedAt,
    outForDeliveryAt: raw.outForDeliveryAt,
    deliveredAt: raw.deliveredAt,
    deliveryFailedAt: raw.deliveryFailedAt,
    deliveryNotes: raw.deliveryNotes,
    customerConfirmedReceiptAt: raw.customerConfirmedReceiptAt,
  };
}

const ISSUE_REPORTABLE_STATUSES = ["PENDING", "PREPARING", "READY"];

export const fulfilmentService = {
  // --- Vendor --------------------------------------------------------------

  async listForVendor(vendorId: string, status?: string): Promise<VendorFulfilmentSummary[]> {
    const rows = await fulfilmentRepository.findForVendor(vendorId, status);
    return rows.map((row) => ({
      id: row.id,
      status: row.status as VendorFulfilmentSummary["status"],
      origin: row.origin as VendorFulfilmentSummary["origin"],
      orderNumber: row.order.orderNumber,
      createdAt: row.createdAt,
      itemCount: row.items.length,
      totalQuantity: row.items.reduce((sum, item) => sum + item.quantity, 0),
      hasOpenIssue: row.issues.length > 0,
    }));
  },

  async getDetailForVendor(vendorId: string, fulfilmentId: string): Promise<VendorFulfilmentDetail | null> {
    const row = await fulfilmentRepository.findDetailForVendor(vendorId, fulfilmentId);
    if (!row) return null;
    const issue = row.issues[0];
    return {
      id: row.id,
      status: row.status as VendorFulfilmentDetail["status"],
      origin: row.origin as VendorFulfilmentDetail["origin"],
      orderNumber: row.order.orderNumber,
      createdAt: row.createdAt,
      itemCount: row.items.length,
      totalQuantity: row.items.reduce((sum, item) => sum + item.quantity, 0),
      hasOpenIssue: Boolean(issue),
      items: toItemViews(row.items),
      leadTimeDaysDefault: row.vendor.leadTimeDaysDefault,
      shipment: toShipmentView(row.shipments[0]),
      openIssue: issue
        ? {
            id: issue.id,
            status: issue.status,
            category: issue.category,
            description: issue.description,
            createdAt: issue.createdAt,
            resolvedAt: issue.resolvedAt,
            resolutionNotes: issue.resolutionNotes,
          }
        : null,
    };
  },

  async startPreparing(vendorId: string, fulfilmentId: string): Promise<Result<null>> {
    const applied = await fulfilmentRepository.updateStatusForVendor(vendorId, fulfilmentId, ["PENDING"], "PREPARING");
    return applied ? ok(null) : err("This order can't be moved to preparing right now.");
  },

  async markReady(vendorId: string, fulfilmentId: string): Promise<Result<null>> {
    const applied = await fulfilmentRepository.updateStatusForVendor(vendorId, fulfilmentId, ["PREPARING"], "READY");
    return applied ? ok(null) : err("This order can't be marked ready right now.");
  },

  async reportIssue(
    vendorId: string,
    fulfilmentId: string,
    reportedByUserId: string,
    category: string,
    description: string,
  ): Promise<Result<null>> {
    if (description.trim().length < 5) return err("Describe the issue in a bit more detail.");
    const issue = await fulfilmentRepository.createIssueForVendor(vendorId, fulfilmentId, reportedByUserId, category, description);
    return issue ? ok(null) : err("This order can no longer have an issue reported against it.");
  },

  async recordVendorShipment(
    vendorId: string,
    fulfilmentId: string,
    input: { carrier: string; trackingReference: string; shippedAt: Date; expectedArrivalAt: Date | null },
  ): Promise<Result<null>> {
    if (input.carrier.trim().length < 2) return err("Enter a carrier name.");
    if (input.trackingReference.trim().length < 2) return err("Enter a tracking reference.");
    const applied = await fulfilmentRepository.recordVendorShipment(vendorId, fulfilmentId, input);
    return applied
      ? ok(null)
      : err("This order isn't ready to ship, or no CrownSource receiving destination has been assigned yet.");
  },

  // --- Admin -----------------------------------------------------------

  async listForAdmin(filter: { status?: string; origin?: string }): Promise<AdminFulfilmentSummary[]> {
    const rows = await fulfilmentRepository.findForAdmin(filter);
    return rows.map((row) => ({
      id: row.id,
      status: row.status as AdminFulfilmentSummary["status"],
      origin: row.origin as AdminFulfilmentSummary["origin"],
      orderNumber: row.order.orderNumber,
      vendorId: row.vendor.id,
      vendorName: row.vendor.companyName,
      createdAt: row.createdAt,
      itemCount: row.items.length,
      hasOpenIssue: row.issues.length > 0,
      shipmentStatus: (row.shipments[0]?.status as AdminFulfilmentSummary["shipmentStatus"]) ?? null,
    }));
  },

  async getDetailForAdmin(fulfilmentId: string): Promise<AdminFulfilmentDetail | null> {
    const row = await fulfilmentRepository.findDetailForAdmin(fulfilmentId);
    if (!row) return null;
    const issue = row.issues[0];
    return {
      id: row.id,
      status: row.status as AdminFulfilmentDetail["status"],
      origin: row.origin as AdminFulfilmentDetail["origin"],
      orderNumber: row.order.orderNumber,
      vendorId: row.vendor.id,
      vendorName: row.vendor.companyName,
      createdAt: row.createdAt,
      itemCount: row.items.length,
      hasOpenIssue: Boolean(issue),
      shipmentStatus: (row.shipments[0]?.status as AdminFulfilmentDetail["shipmentStatus"]) ?? null,
      items: toItemViews(row.items),
      shipment: toShipmentView(row.shipments[0]),
      openIssue: issue
        ? {
            id: issue.id,
            status: issue.status,
            category: issue.category,
            description: issue.description,
            createdAt: issue.createdAt,
            resolvedAt: issue.resolvedAt,
            resolutionNotes: issue.resolutionNotes,
          }
        : null,
      vendorPickup: {
        addressLine1: row.vendor.pickupAddressLine1,
        contactName: row.vendor.pickupContactName,
        contactPhone: row.vendor.pickupContactPhone,
        hours: row.vendor.pickupHours,
        notes: row.vendor.pickupNotes,
      },
      deliveryInfo: row.order.deliveryInfo as AdminFulfilmentDetail["deliveryInfo"],
    };
  },

  async assignReceivingLocation(fulfilmentId: string, receivingLocationId: string): Promise<Result<null>> {
    const applied = await fulfilmentRepository.assignReceivingLocation(fulfilmentId, receivingLocationId);
    return applied ? ok(null) : err("Fulfilment not found.");
  },

  async scheduleCollection(
    fulfilmentId: string,
    data: { carrier?: string; trackingReference?: string; scheduledAt?: Date; notes?: string },
  ): Promise<Result<null>> {
    const applied = await fulfilmentRepository.scheduleCollection(fulfilmentId, data);
    if (!applied) return err("Fulfilment not found.");
    if (data.scheduledAt) {
      const context = await fulfilmentRepository.findNotificationContext(fulfilmentId);
      if (context) {
        const owner = await vendorsRepository.findOwnerUserIdAndEmail(context.vendorId);
        if (owner) {
          const scheduledAtText = data.scheduledAt.toLocaleString("en-GB");
          await notificationsService.notify({
            recipientUserId: owner.userId,
            type: "COLLECTION_SCHEDULED",
            title: "Collection scheduled",
            body: `Collection for order ${context.orderNumber} has been scheduled: ${scheduledAtText}.`,
            targetUrl: notificationLinks.vendorOrder(fulfilmentId),
            eventKey: `collection-scheduled:${fulfilmentId}:${data.scheduledAt.getTime()}`,
            email: {
              to: owner.email,
              subject: "Collection scheduled",
              templateKey: "collection-scheduled",
              templateData: { orderNumber: context.orderNumber, scheduledAt: scheduledAtText, fulfilmentId },
            },
          });
        }
      }
    }
    return ok(null);
  },

  async confirmCollectedOrReceived(
    fulfilmentId: string,
    actorUserId: string,
    receivingLocationId: string | null,
  ): Promise<Result<null>> {
    const applied = await fulfilmentRepository.confirmCollectedOrReceived(fulfilmentId, actorUserId, receivingLocationId);
    if (!applied) return err("This order isn't awaiting collection/receipt.");
    const context = await fulfilmentRepository.findNotificationContext(fulfilmentId);
    if (context) {
      await notificationsService.notify({
        recipientUserId: context.customerUserId,
        type: "PACKAGE_COLLECTED",
        title: "Your order is on its way",
        body: `Your order ${context.orderNumber} has been collected and is on its way.`,
        targetUrl: notificationLinks.customerOrder(context.orderId),
        eventKey: `package-collected:${fulfilmentId}`,
        email: {
          to: context.customerEmail,
          subject: "Your order is on its way",
          templateKey: "package-collected",
          templateData: { orderNumber: context.orderNumber, orderId: context.orderId },
        },
      });
    }
    return ok(null);
  },

  async progressToInTransit(fulfilmentId: string): Promise<Result<null>> {
    const applied = await fulfilmentRepository.progressShipment(fulfilmentId, ["COLLECTED"], "IN_TRANSIT");
    return applied ? ok(null) : err("This shipment isn't ready to move to in-transit.");
  },

  async progressToOutForDelivery(fulfilmentId: string): Promise<Result<null>> {
    const applied = await fulfilmentRepository.progressShipment(fulfilmentId, ["IN_TRANSIT"], "OUT_FOR_DELIVERY");
    if (!applied) return err("This shipment isn't in transit.");
    const context = await fulfilmentRepository.findNotificationContext(fulfilmentId);
    if (context) {
      await notificationsService.notify({
        recipientUserId: context.customerUserId,
        type: "OUT_FOR_DELIVERY",
        title: "Out for delivery",
        body: `Your order ${context.orderNumber} is out for delivery today.`,
        targetUrl: notificationLinks.customerOrder(context.orderId),
        eventKey: `out-for-delivery:${fulfilmentId}`,
        email: {
          to: context.customerEmail,
          subject: "Your order is out for delivery",
          templateKey: "out-for-delivery",
          templateData: { orderNumber: context.orderNumber, orderId: context.orderId },
        },
      });
    }
    return ok(null);
  },

  async confirmDelivered(fulfilmentId: string): Promise<Result<null>> {
    const applied = await fulfilmentRepository.progressShipment(fulfilmentId, ["OUT_FOR_DELIVERY"], "DELIVERED", {
      deliveredAt: new Date(),
    });
    if (!applied) return err("This shipment isn't out for delivery.");
    const context = await fulfilmentRepository.findNotificationContext(fulfilmentId);
    if (context) {
      await notificationsService.notify({
        recipientUserId: context.customerUserId,
        type: "DELIVERED",
        title: "Order delivered",
        body: `Your order ${context.orderNumber} has been delivered.`,
        targetUrl: notificationLinks.customerOrder(context.orderId),
        eventKey: `delivered:${fulfilmentId}`,
        email: {
          to: context.customerEmail,
          subject: "Your order has been delivered",
          templateKey: "delivered",
          templateData: { orderNumber: context.orderNumber, orderId: context.orderId },
        },
      });
    }
    return ok(null);
  },

  async reportDeliveryFailed(fulfilmentId: string, notes: string): Promise<Result<null>> {
    const applied = await fulfilmentRepository.progressShipment(
      fulfilmentId,
      ["OUT_FOR_DELIVERY", "IN_TRANSIT"],
      "DELIVERY_FAILED",
      { deliveryFailedAt: new Date(), deliveryNotes: notes },
    );
    if (!applied) return err("This shipment can't be marked as a failed delivery right now.");
    const context = await fulfilmentRepository.findNotificationContext(fulfilmentId);
    if (context) {
      await notificationsService.notify({
        recipientUserId: context.customerUserId,
        type: "DELIVERY_ISSUE",
        title: "Delivery problem",
        body: `There was a problem delivering order ${context.orderNumber}: ${notes}`,
        targetUrl: notificationLinks.customerOrder(context.orderId),
        eventKey: `delivery-issue:${fulfilmentId}:${Date.now()}`,
        email: {
          to: context.customerEmail,
          subject: "There was a problem delivering your order",
          templateKey: "delivery-issue",
          templateData: { orderNumber: context.orderNumber, orderId: context.orderId, notes },
        },
      });
    }
    return ok(null);
  },

  async resumeAfterFailure(fulfilmentId: string): Promise<Result<null>> {
    const applied = await fulfilmentRepository.progressShipment(fulfilmentId, ["DELIVERY_FAILED"], "OUT_FOR_DELIVERY");
    return applied ? ok(null) : err("This shipment isn't in a failed-delivery state.");
  },

  async resolveIssue(issueId: string, resolvedByUserId: string, resolutionNotes: string): Promise<Result<null>> {
    if (resolutionNotes.trim().length < 3) return err("Add a note about how this was resolved.");
    const result = await fulfilmentRepository.resolveIssue(issueId, resolvedByUserId, resolutionNotes);
    if (!result) return err("This issue is already resolved.");
    const context = await fulfilmentRepository.findNotificationContext(result.fulfilmentId);
    if (context) {
      const owner = await vendorsRepository.findOwnerUserIdAndEmail(context.vendorId);
      if (owner) {
        await notificationsService.notify({
          recipientUserId: owner.userId,
          type: "FULFILMENT_ISSUE_RESOLVED",
          title: "Order issue resolved",
          body: `The issue on order ${context.orderNumber} has been resolved: ${resolutionNotes}`,
          targetUrl: notificationLinks.vendorOrder(result.fulfilmentId),
          eventKey: `fulfilment-issue-resolved:${issueId}`,
          email: {
            to: owner.email,
            subject: "Order issue resolved",
            templateKey: "fulfilment-issue-resolved",
            templateData: { orderNumber: context.orderNumber, resolutionNotes, fulfilmentId: result.fulfilmentId },
          },
        });
      }
    }
    return ok(null);
  },

  // --- Customer ------------------------------------------------------------

  async getCustomerTracking(orderId: string, customerProfileId: string): Promise<CustomerPackageTracking[]> {
    const rows = await fulfilmentRepository.findForCustomerOrder(orderId, customerProfileId);
    return rows.map((row) => {
      const shipment = row.shipments[0];
      const shipmentStatus = shipment?.status ?? "CREATED";
      const origin = row.origin;

      const stepDefs: { key: string; label: string }[] =
        origin === "INTERNATIONAL_INBOUND"
          ? [
              { key: "confirmed", label: "Order confirmed" },
              { key: "preparing", label: "Preparing" },
              { key: "to_crownsource", label: "On the way to CrownSource" },
              { key: "received", label: "Received for local delivery" },
              { key: "in_transit", label: "In transit" },
              { key: "delivered", label: "Delivered" },
            ]
          : [
              { key: "confirmed", label: "Order confirmed" },
              { key: "preparing", label: "Preparing your order" },
              { key: "collected", label: "Collected" },
              { key: "in_transit", label: "In transit" },
              { key: "out_for_delivery", label: "Out for delivery" },
              { key: "delivered", label: "Delivered" },
            ];

      // Map the underlying Fulfilment/Shipment state onto a single current-step index.
      let currentIndex = 0;
      if (row.status === "PREPARING") currentIndex = 1;
      else if (row.status === "READY") currentIndex = 1;
      else if (row.status === "DISPATCHED") {
        currentIndex = origin === "INTERNATIONAL_INBOUND" ? 2 : 2;
        if (shipmentStatus === "COLLECTED") currentIndex = origin === "INTERNATIONAL_INBOUND" ? 3 : 2;
        if (shipmentStatus === "IN_TRANSIT") currentIndex = origin === "INTERNATIONAL_INBOUND" ? 4 : 3;
        if (shipmentStatus === "OUT_FOR_DELIVERY") currentIndex = origin === "INTERNATIONAL_INBOUND" ? 4 : 4;
      } else if (row.status === "DELIVERED" || row.status === "COMPLETED") {
        currentIndex = stepDefs.length - 1;
      }

      const steps: CustomerTrackingStep[] = stepDefs.map((step, index) => ({
        key: step.key,
        label: step.label,
        done: index < currentIndex || row.status === "DELIVERED" || row.status === "COMPLETED",
        current: index === currentIndex && row.status !== "DELIVERED" && row.status !== "COMPLETED",
      }));

      return {
        fulfilmentId: row.id,
        vendorName: row.vendor.companyName,
        items: toItemViews(row.items),
        steps,
        hasIssue: row.issues.length > 0 || row.status === "EXCEPTION",
        customerConfirmedReceiptAt: shipment?.customerConfirmedReceiptAt ?? null,
      };
    });
  },

  async confirmCustomerReceipt(fulfilmentId: string, orderId: string, customerProfileId: string): Promise<Result<null>> {
    const applied = await fulfilmentRepository.confirmCustomerReceipt(fulfilmentId, orderId, customerProfileId);
    return applied ? ok(null) : err("Order not found.");
  },

  // --- Shared ----------------------------------------------------------

  listActiveReceivingLocations() {
    return logisticsRepository.listActive();
  },
};
