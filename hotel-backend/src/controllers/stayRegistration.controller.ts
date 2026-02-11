import type { Response } from "express";
import prisma from "../services/prisma";
import type { AuthRequest } from "../middlewares/authMiddleware";
import { auditLog } from "../services/audit.service";
import PDFDocument from "pdfkit";

/**
 * Here I keep small helpers to keep formatting consistent across exports.
 */
const fmtDate = (d?: Date | null) => {
  if (!d) return "";
  try {
    return d.toISOString().slice(0, 10);
  } catch {
    return String(d);
  }
};

const fmtDateTime = (d?: Date | null) => {
  if (!d) return "";
  try {
    return d.toISOString().replace("T", " ").slice(0, 16);
  } catch {
    return String(d);
  }
};

const parseQueryDate = (value: unknown): Date | null => {
  if (!value || typeof value !== "string") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

/**
 * Here I create a "snapshot" record of the guest + stay for police reporting (RIHP).
 *
 * POST /api/bookings/:id/stay-registration
 */
export const createStayRegistrationForBooking = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const hotelId = req.user?.hotelId;
    const createdById = req.user?.id ?? null;

    if (!hotelId) {
      return res.status(401).json({
        success: false,
        error: "Missing hotel context",
      });
    }

    const bookingId = Number(req.params.id);
    if (Number.isNaN(bookingId)) {
      return res.status(400).json({
        success: false,
        error: "Invalid booking ID",
      });
    }

    // Tenant isolation: booking must belong to this hotel
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, hotelId },
      include: { room: true, guest: true },
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        code: "BOOKING_NOT_FOUND",
        error: "Booking not found",
      });
    }

    if (!booking.guest) {
      return res.status(400).json({
        success: false,
        code: "GUEST_REQUIRED",
        error: "I need a guest assigned to create the stay registration.",
      });
    }

    // Idempotency: one snapshot per booking
    const existing = await prisma.stayRegistration.findUnique({
      where: { bookingId },
    });

    if (existing) {
      return res.status(200).json({
        success: true,
        data: existing,
        message: "Stay registration already exists.",
      });
    }

    // Load hotel info (RIHP establishment info)
    const hotel = await prisma.hotel.findUnique({
      where: { id: hotelId },
      select: { address: true, responsibleName: true, registrationNumber: true },
    });

    const g = booking.guest;

    const created = await prisma.stayRegistration.create({
      data: {
        hotelId,
        bookingId: booking.id,
        roomId: booking.roomId,
        guestId: g.id,
        createdById,

        // Guest snapshot
        guestName: g.name,
        guestEmail: g.email ?? null,
        guestPhone: g.phone ?? null,

        nationality: (g as any).nationality ?? null,
        documentType: (g as any).documentType ?? null,
        documentNumber: (g as any).documentNumber ?? null,
        birthDate: (g as any).birthDate ?? null,
        gender: (g as any).gender ?? null,

        address: (g as any).address ?? null,
        city: (g as any).city ?? null,
        country: (g as any).country ?? null,

        // RIHP extra guest fields
        maritalStatus: (g as any).maritalStatus ?? null,
        occupation: (g as any).occupation ?? null,
        provenance: (g as any).provenance ?? null,

        // RIHP establishment snapshot fields
        hotelAddress: hotel?.address ?? null,
        hotelResponsibleName: hotel?.responsibleName ?? null,
        hotelRegistrationNumber: hotel?.registrationNumber ?? null,

        // Stay snapshot
        scheduledCheckIn: booking.checkIn,
        scheduledCheckOut: booking.checkOut,
        checkedInAt: booking.checkedInAt ?? null,
        checkedOutAt: booking.checkedOutAt ?? null,
      },
    });

    // Audit (high value operational/legal snapshot)
    await auditLog({
      req,
      hotelId,
      actorUserId: createdById,
      action: "STAY_REGISTRATION_CREATED",
      entityType: "StayRegistration",
      entityId: created.id,
      metadata: {
        bookingId: created.bookingId,
        guestId: created.guestId,
        roomId: created.roomId,
        scheduledCheckIn: created.scheduledCheckIn,
        scheduledCheckOut: created.scheduledCheckOut,
      },
    });

    return res.status(201).json({ success: true, data: created });
  } catch (error) {
    console.error("Error in createStayRegistrationForBooking:", error);
    return res.status(500).json({
      success: false,
      error: "Error creating stay registration",
    });
  }
};

/**
 * GET /api/reports/police?from=YYYY-MM-DD&to=YYYY-MM-DD
 * CSV export (RIHP - Uruguay)
 */
export const exportPoliceReportCsv = async (req: AuthRequest, res: Response) => {
  try {
    const hotelId = req.user?.hotelId;
    if (!hotelId) {
      return res.status(401).json({
        success: false,
        error: "Missing hotel context",
      });
    }

    const fromD = parseQueryDate(req.query.from);
    const toD = parseQueryDate(req.query.to);

    const where: any = { hotelId };
    if (fromD) where.createdAt = { ...(where.createdAt ?? {}), gte: fromD };
    if (toD) where.createdAt = { ...(where.createdAt ?? {}), lte: toD };

    const rows = await prisma.stayRegistration.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { room: { select: { number: true } } },
    });

    const header = [
      "guestFullName",
      "documentType",
      "documentNumber",
      "nationality",
      "birthDate",
      "maritalStatus",
      "occupation",
      "provenance",
      "checkInDate",
      "checkOutDate",
      "roomNumber",
      "hotelAddress",
      "hotelResponsibleName",
      "hotelRegistrationNumber",
    ];

    const escape = (v: any) => {
      const s = String(v ?? "");
      if (s.includes('"') || s.includes(",") || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const lines = [
      header.join(","),
      ...rows.map((r) =>
        [
          r.guestName ?? "",
          (r as any).documentType ?? "",
          (r as any).documentNumber ?? "",
          (r as any).nationality ?? "",
          (r as any).birthDate ? fmtDate((r as any).birthDate) : "",
          (r as any).maritalStatus ?? "",
          (r as any).occupation ?? "",
          (r as any).provenance ?? "",
          r.scheduledCheckIn ? fmtDate(r.scheduledCheckIn) : "",
          r.scheduledCheckOut ? fmtDate(r.scheduledCheckOut) : "",
          r.room?.number ?? "",
          (r as any).hotelAddress ?? "",
          (r as any).hotelResponsibleName ?? "",
          (r as any).hotelRegistrationNumber ?? "",
        ]
          .map(escape)
          .join(",")
      ),
    ].join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="police-report-rihp.csv"`
    );

    return res.status(200).send(lines);
  } catch (error) {
    console.error("Error in exportPoliceReportCsv:", error);
    return res.status(500).json({
      success: false,
      error: "Error exporting report",
    });
  }
};

/**
 * GET /api/reports/police/pdf?from=YYYY-MM-DD&to=YYYY-MM-DD
 * PDF export (RIHP - Uruguay)
 */
export const exportPoliceReportPdf = async (req: AuthRequest, res: Response) => {
  try {
    const hotelId = req.user?.hotelId;
    if (!hotelId) {
      return res.status(401).json({
        success: false,
        error: "Missing hotel context",
      });
    }

    const from = typeof req.query.from === "string" ? req.query.from : "";
    const to = typeof req.query.to === "string" ? req.query.to : "";

    const fromD = parseQueryDate(req.query.from);
    const toD = parseQueryDate(req.query.to);

    const where: any = { hotelId };
    if (fromD) where.createdAt = { ...(where.createdAt ?? {}), gte: fromD };
    if (toD) where.createdAt = { ...(where.createdAt ?? {}), lte: toD };

    const rows = await prisma.stayRegistration.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { room: { select: { number: true } } },
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="police-report-rihp.pdf"`
    );

    const doc = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margin: 36,
      bufferPages: true,
    });

    doc.pipe(res);

    // ===== Header =====
    doc.fontSize(16).fillColor("#000").text("Police report (RIHP)");
    doc.moveDown(0.2);
    doc.fontSize(10).fillColor("#444");
    doc.text(`Generated: ${fmtDateTime(new Date())}`);
    doc.text(`Period: ${from || "-"} → ${to || "-"}`);
    doc.moveDown(0.6);
    doc.fillColor("#000");

    // ===== Table =====
    const startX = doc.page.margins.left;
    let y = doc.y;

    const paddingX = 4;
    const paddingY = 3;

    const cols = [
      { key: "guestName", label: "Full name", w: 150 },
      { key: "doc", label: "Document", w: 130 },
      { key: "nationality", label: "Nationality", w: 90 },
      { key: "birthDate", label: "Birth", w: 70 },
      { key: "maritalStatus", label: "Civil", w: 70 },
      { key: "occupation", label: "Occupation", w: 110 },
      { key: "provenance", label: "Provenance", w: 120 },
      { key: "checkIn", label: "Entry", w: 70 },
      { key: "checkOut", label: "Exit", w: 70 },
      { key: "roomNumber", label: "Room", w: 55 },
      { key: "hotelInfo", label: "Establishment", w: 220 },
    ];

    const tableW = cols.reduce((s, c) => s + c.w, 0);

    const drawHeader = () => {
      doc.fontSize(9).fillColor("#000");
      doc.save().rect(startX, y, tableW, 20).fill("#F2F2F2").restore();

      let x = startX;
      doc.font("Helvetica-Bold");
      for (const c of cols) {
        doc.text(c.label, x + paddingX, y + 6, {
          width: c.w - paddingX * 2,
          align: "left",
        });
        x += c.w;
      }
      doc.font("Helvetica");

      y += 20;

      doc
        .moveTo(startX, y)
        .lineTo(startX + tableW, y)
        .strokeColor("#DDD")
        .stroke();

      y += 2;
    };

    const ensureSpace = (needed: number) => {
      const bottom = doc.page.height - doc.page.margins.bottom;
      if (y + needed > bottom) {
        doc.addPage();
        y = doc.page.margins.top;
        drawHeader();
      }
    };

    const rowValues = (r: any) => {
      const docLabel = `${(r as any).documentType ?? ""} ${(r as any).documentNumber ?? ""}`.trim();
      const hotelInfo = [
        (r as any).hotelAddress ? `Addr: ${(r as any).hotelAddress}` : null,
        (r as any).hotelResponsibleName ? `Resp: ${(r as any).hotelResponsibleName}` : null,
        (r as any).hotelRegistrationNumber ? `Reg#: ${(r as any).hotelRegistrationNumber}` : null,
      ]
        .filter(Boolean)
        .join(" · ");

      return {
        guestName: r.guestName ?? "",
        doc: docLabel,
        nationality: (r as any).nationality ?? "",
        birthDate: (r as any).birthDate ? fmtDate((r as any).birthDate) : "",
        maritalStatus: (r as any).maritalStatus ?? "",
        occupation: (r as any).occupation ?? "",
        provenance: (r as any).provenance ?? "",
        checkIn: r.scheduledCheckIn ? fmtDate(r.scheduledCheckIn) : "",
        checkOut: r.scheduledCheckOut ? fmtDate(r.scheduledCheckOut) : "",
        roomNumber: r.room?.number ?? "",
        hotelInfo,
      } as Record<string, string>;
    };

    const calcRowHeight = (values: Record<string, string>) => {
      let maxH = 16;
      doc.font("Helvetica").fontSize(9);

      for (const c of cols) {
        const text = values[c.key] ?? "";
        const h = doc.heightOfString(text, {
          width: c.w - paddingX * 2,
          align: "left",
        });
        maxH = Math.max(maxH, h);
      }

      return Math.ceil(maxH + paddingY * 2 + 2);
    };

    const drawRow = (values: Record<string, string>, rowH: number) => {
      let x = startX;
      doc.font("Helvetica").fontSize(9).fillColor("#000");

      for (const c of cols) {
        doc.text(values[c.key] ?? "", x + paddingX, y + paddingY, {
          width: c.w - paddingX * 2,
          height: rowH - paddingY * 2,
          align: "left",
        });
        x += c.w;
      }

      const yLine = y + rowH;
      doc
        .moveTo(startX, yLine)
        .lineTo(startX + tableW, yLine)
        .strokeColor("#EEE")
        .stroke();

      y += rowH + 2;
    };

    drawHeader();

    if (rows.length === 0) {
      doc
        .fontSize(11)
        .fillColor("#444")
        .text("No stay registrations found for this period.");
    } else {
      for (const r of rows) {
        const values = rowValues(r);
        const rowH = calcRowHeight(values);
        ensureSpace(rowH + 6);
        drawRow(values, rowH);
      }
    }

    // ===== Footer page numbers =====
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.fontSize(8).fillColor("#666");
      doc.text(
        `Page ${i - range.start + 1} of ${range.count}`,
        doc.page.margins.left,
        doc.page.height - doc.page.margins.bottom + 8,
        {
          align: "right",
          width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
        }
      );
    }

    doc.end();
  } catch (error) {
    console.error("Error in exportPoliceReportPdf:", error);
    return res.status(500).json({
      success: false,
      error: "Error exporting PDF report",
    });
  }
};

/**
 * GET /api/bookings/:id/stay-registration/pdf
 * Single booking printable police form.
 */
export const exportStayRegistrationPdfByBooking = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const hotelId = req.user?.hotelId;
    const createdById = req.user?.id ?? null;

    if (!hotelId) {
      return res.status(401).json({
        success: false,
        error: "Missing hotel context",
      });
    }

    const bookingId = Number(req.params.id);
    if (Number.isNaN(bookingId)) {
      return res.status(400).json({
        success: false,
        error: "Invalid booking ID",
      });
    }

    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, hotelId },
      include: { room: true, guest: true },
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        code: "BOOKING_NOT_FOUND",
        error: "Booking not found",
      });
    }

    if (!booking.guest) {
      return res.status(400).json({
        success: false,
        code: "GUEST_REQUIRED",
        error: "I need a guest assigned to generate the police PDF.",
      });
    }

    let snap = await prisma.stayRegistration.findUnique({
      where: { bookingId },
      include: {
        room: { select: { number: true, floor: true } },
        createdBy: { select: { id: true, name: true, email: true, role: true } },
        hotel: { select: { id: true, name: true, code: true } },
      },
    });

    // If snapshot doesn't exist, I create it on demand (idempotent)
    if (!snap) {
      const g = booking.guest;

      const hotel = await prisma.hotel.findUnique({
        where: { id: hotelId },
        select: { address: true, responsibleName: true, registrationNumber: true },
      });

      snap = await prisma.stayRegistration.create({
        data: {
          hotelId,
          bookingId: booking.id,
          roomId: booking.roomId,
          guestId: g.id,
          createdById: createdById ?? null,

          guestName: g.name,
          guestEmail: g.email ?? null,
          guestPhone: g.phone ?? null,

          documentType: (g as any).documentType ?? null,
          documentNumber: (g as any).documentNumber ?? null,
          nationality: (g as any).nationality ?? null,
          birthDate: (g as any).birthDate ?? null,
          gender: (g as any).gender ?? null,
          address: (g as any).address ?? null,
          city: (g as any).city ?? null,
          country: (g as any).country ?? null,

          // Extra RIHP fields
          maritalStatus: (g as any).maritalStatus ?? null,
          occupation: (g as any).occupation ?? null,
          provenance: (g as any).provenance ?? null,

          // Establishment snapshot
          hotelAddress: hotel?.address ?? null,
          hotelResponsibleName: hotel?.responsibleName ?? null,
          hotelRegistrationNumber: hotel?.registrationNumber ?? null,

          scheduledCheckIn: booking.checkIn,
          scheduledCheckOut: booking.checkOut,
          checkedInAt: booking.checkedInAt ?? null,
          checkedOutAt: booking.checkedOutAt ?? null, // ✅ fixed
        },
        include: {
          room: { select: { number: true, floor: true } },
          createdBy: { select: { id: true, name: true, email: true, role: true } },
          hotel: { select: { id: true, name: true, code: true } },
        },
      });

      // Audit for auto-creation (useful when PDFs are generated before check-in flow creates it)
      await auditLog({
        req,
        hotelId,
        actorUserId: createdById,
        action: "STAY_REGISTRATION_AUTO_CREATED",
        entityType: "StayRegistration",
        entityId: snap.id,
        metadata: { bookingId: snap.bookingId },
      });
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="stay-registration-booking-${bookingId}.pdf"`
    );

    const doc = new PDFDocument({ size: "A4", margin: 50 });
    doc.pipe(res);

    doc.fontSize(16).text("Police stay registration", { align: "center" });
    doc.moveDown(0.5);

    doc.fontSize(10).fillColor("#444");
    doc.text(`Hotel: ${snap.hotel?.name ?? "Hotel"} (${snap.hotel?.code ?? "N/A"})`);
    doc.text(`Booking: #${snap.bookingId}`);
    doc.text(
      `Room: ${snap.room?.number ?? ""} ${
        snap.room?.floor != null ? `(Floor ${snap.room.floor})` : ""
      }`
    );
    doc.text(`Generated: ${fmtDateTime(new Date())}`);
    doc.moveDown(1);

    doc.fillColor("#000");

    const field = (label: string, value: any) => {
      doc.font("Helvetica-Bold").text(`${label}: `, { continued: true });
      doc.font("Helvetica").text(String(value ?? ""));
      doc.moveDown(0.2);
    };

    const section = (title: string) => {
      doc.moveDown(0.6);
      doc.font("Helvetica-Bold").fontSize(12).text(title);
      doc.moveDown(0.3);
      doc.font("Helvetica").fontSize(10);
    };

    section("Guest information (RIHP)");
    field("Full name", (snap as any).guestName);
    field("Document type", (snap as any).documentType ?? "-");
    field("Document number", (snap as any).documentNumber ?? "-");
    field("Nationality", (snap as any).nationality ?? "-");
    field("Birth date", (snap as any).birthDate ? fmtDate((snap as any).birthDate) : "-");
    field("Marital status", (snap as any).maritalStatus ?? "-");
    field("Occupation", (snap as any).occupation ?? "-");
    field("Provenance", (snap as any).provenance ?? "-");

    section("Stay information");
    field("Scheduled check-in", fmtDateTime((snap as any).scheduledCheckIn));
    field("Scheduled check-out", fmtDateTime((snap as any).scheduledCheckOut));
    field("Checked-in at", (snap as any).checkedInAt ? fmtDateTime((snap as any).checkedInAt) : "-");
    field("Checked-out at", (snap as any).checkedOutAt ? fmtDateTime((snap as any).checkedOutAt) : "-");

    section("Establishment information");
    field("Address", (snap as any).hotelAddress ?? "-");
    field("Responsible name", (snap as any).hotelResponsibleName ?? "-");
    field("Registration number", (snap as any).hotelRegistrationNumber ?? "-");

    section("Audit");
    field("Created at", fmtDateTime((snap as any).createdAt));
    field("Created by", snap.createdBy?.name ?? "-");
    if (snap.createdBy?.email) field("Created by email", snap.createdBy.email);

    doc.moveDown(1.2);
    doc.font("Helvetica").fontSize(10);
    doc.text("Signature (reception): ________________________________");
    doc.moveDown(0.6);
    doc.text("Signature (guest): _____________________________________");

    doc.end();
  } catch (error) {
    console.error("Error in exportStayRegistrationPdfByBooking:", error);
    return res.status(500).json({
      success: false,
      error: "Error exporting stay registration PDF",
    });
  }
};
