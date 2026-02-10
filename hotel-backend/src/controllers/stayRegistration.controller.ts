import type { Response } from "express";
import prisma from "../services/prisma";
import type { AuthRequest } from "../middlewares/authMiddleware";
import PDFDocument from "pdfkit";

/**
 * Small helpers to keep formatting consistent.
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
 * Here I create a "snapshot" record of the guest + stay for police reporting.
 *
 * POST /api/bookings/:id/stay-registration
 */
export const createStayRegistrationForBooking = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const hotelId = req.user?.hotelId;
    const createdById = req.user?.id;

    if (!hotelId) {
      return res
        .status(401)
        .json({ success: false, error: "Missing hotel context" });
    }

    const bookingId = Number(req.params.id);
    if (Number.isNaN(bookingId)) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid booking ID" });
    }

    // Tenant isolation
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

    const g = booking.guest;

    const created = await prisma.stayRegistration.create({
      data: {
        hotelId,
        bookingId: booking.id,
        roomId: booking.roomId,
        guestId: g.id,
        createdById: createdById ?? null,

        // Snapshot identity
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

        // Snapshot stay dates
        scheduledCheckIn: booking.checkIn,
        scheduledCheckOut: booking.checkOut,
        checkedInAt: booking.checkedInAt ?? null,
        checkedOutAt: booking.checkedOutAt ?? null,
      },
    });

    return res.status(201).json({ success: true, data: created });
  } catch (error) {
    console.error("Error in createStayRegistrationForBooking:", error);
    return res
      .status(500)
      .json({ success: false, error: "Error creating stay registration" });
  }
};

/**
 * GET /api/reports/police?from=YYYY-MM-DD&to=YYYY-MM-DD
 * CSV export (includes phone + address + nationality).
 */
export const exportPoliceReportCsv = async (req: AuthRequest, res: Response) => {
  try {
    const hotelId = req.user?.hotelId;
    if (!hotelId) {
      return res
        .status(401)
        .json({ success: false, error: "Missing hotel context" });
    }

    const fromD = parseQueryDate(req.query.from);
    const toD = parseQueryDate(req.query.to);

    const where: any = { hotelId };

    if (fromD) where.createdAt = { ...(where.createdAt ?? {}), gte: fromD };
    if (toD) where.createdAt = { ...(where.createdAt ?? {}), lte: toD };

    const rows = await prisma.stayRegistration.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { room: { select: { number: true, floor: true } } },
    });

    const header = [
      "createdAt",
      "bookingId",
      "roomNumber",
      "roomFloor",
      "guestName",
      "guestPhone",
      "address",
      "city",
      "country",
      "nationality",
      "documentType",
      "documentNumber",
      "birthDate",
      "gender",
      "scheduledCheckIn",
      "scheduledCheckOut",
      "checkedInAt",
      "checkedOutAt",
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
          r.createdAt.toISOString(),
          r.bookingId,
          r.room?.number ?? "",
          r.room?.floor ?? "",
          r.guestName,
          r.guestPhone ?? "",
          r.address ?? "",
          r.city ?? "",
          r.country ?? "",
          r.nationality ?? "",
          r.documentType ?? "",
          r.documentNumber ?? "",
          r.birthDate ? r.birthDate.toISOString().slice(0, 10) : "",
          r.gender ?? "",
          r.scheduledCheckIn.toISOString(),
          r.scheduledCheckOut.toISOString(),
          r.checkedInAt ? r.checkedInAt.toISOString() : "",
          r.checkedOutAt ? r.checkedOutAt.toISOString() : "",
        ]
          .map(escape)
          .join(",")
      ),
    ].join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="police-report.csv"`);

    return res.status(200).send(lines);
  } catch (error) {
    console.error("Error in exportPoliceReportCsv:", error);
    return res
      .status(500)
      .json({ success: false, error: "Error exporting report" });
  }
};

/**
 * GET /api/reports/police/pdf?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * 
 * - Landscape A4 (more space)
 * - Dynamic row height (no overlap)
 * - Includes Phone + Address + Nationality
 */
export const exportPoliceReportPdf = async (req: AuthRequest, res: Response) => {
  try {
    const hotelId = req.user?.hotelId;
    if (!hotelId) {
      return res
        .status(401)
        .json({ success: false, error: "Missing hotel context" });
    }

    const from = typeof req.query.from === "string" ? req.query.from : "";
    const to = typeof req.query.to === "string" ? req.query.to : "";

    const fromD = parseQueryDate(req.query.from);
    const toD = parseQueryDate(req.query.to);

    const where: any = { hotelId };
    if (fromD) where.createdAt = { ...(where.createdAt ?? {}), gte: fromD };
    if (toD) where.createdAt = { ...(where.createdAt ?? {}), lte: toD };

    const [hotel, rows] = await Promise.all([
      prisma.hotel.findUnique({ where: { id: hotelId } }),
      prisma.stayRegistration.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: { room: { select: { number: true, floor: true } } },
      }),
    ]);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="police-report.pdf"`);

    const doc = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margin: 36,
      bufferPages: true,
    });

    doc.pipe(res);

    // ===== Header =====
    doc.fontSize(16).fillColor("#000").text("Police report (Stay registrations)");
    doc.moveDown(0.2);
    doc.fontSize(10).fillColor("#444");
    doc.text(`Hotel: ${hotel?.name ?? "Hotel"} (${hotel?.code ?? "N/A"})`);
    doc.text(`Generated: ${fmtDateTime(new Date())}`);
    doc.text(`Period: ${from || "-"} → ${to || "-"}`);
    doc.moveDown(0.6);
    doc.fillColor("#000");

    // ===== Table helpers =====
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const startX = doc.page.margins.left;
    let y = doc.y;

    const paddingX = 4;
    const paddingY = 3;

    const cols = [
      { key: "createdAt", label: "Created", w: 70 },
      { key: "bookingId", label: "Bk", w: 35 },
      { key: "room", label: "Room", w: 55 },
      { key: "guestName", label: "Guest", w: 120 },
      { key: "nationality", label: "Nat.", w: 60 },
      { key: "phone", label: "Phone", w: 90 },
      { key: "address", label: "Address", w: 220 },
      { key: "doc", label: "Doc", w: 110 },
      { key: "checkIn", label: "In", w: 70 },
      { key: "checkOut", label: "Out", w: 70 },
    ];

    const totalW = cols.reduce((s, c) => s + c.w, 0);
    const scale = totalW > pageWidth ? pageWidth / totalW : 1;
    cols.forEach((c) => (c.w = Math.floor(c.w * scale)));

    const tableW = cols.reduce((s, c) => s + c.w, 0);

    const buildAddress = (r: any) => {
      const parts = [r.address, r.city, r.country].filter(Boolean);
      return parts.join(", ");
    };

    const ensureSpace = (needed: number) => {
      const bottom = doc.page.height - doc.page.margins.bottom;
      if (y + needed > bottom) {
        doc.addPage();
        y = doc.page.margins.top;
        drawHeader();
      }
    };

    const drawHeader = () => {
      doc.fontSize(9).fillColor("#000");

      doc
        .save()
        .rect(startX, y, tableW, 20)
        .fill("#F2F2F2")
        .restore();

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

    const rowValues = (r: any) => {
      const roomLabel = r.room ? `${r.room.number} (F${r.room.floor})` : "";
      const docLabel = `${r.documentType ?? ""} ${r.documentNumber ?? ""}`.trim();

      return {
        createdAt: fmtDate(r.createdAt),
        bookingId: String(r.bookingId),
        room: roomLabel,
        guestName: r.guestName ?? "",
        nationality: r.nationality ?? "",
        phone: r.guestPhone ?? "",
        address: buildAddress(r),
        doc: docLabel,
        checkIn: fmtDate(r.scheduledCheckIn),
        checkOut: fmtDate(r.scheduledCheckOut),
      } as Record<string, string>;
    };

    const calcRowHeight = (values: Record<string, string>) => {
      // Base min height
      let maxH = 16;

      // We calculate height needed for each cell (wrap enabled)
      // IMPORTANT: we keep font size consistent for measurements.
      doc.font("Helvetica").fontSize(9);

      for (const c of cols) {
        const text = values[c.key] ?? "";
        const h = doc.heightOfString(text, {
          width: c.w - paddingX * 2,
          align: "left",
        });
        maxH = Math.max(maxH, h);
      }

      // Add padding + small breathing room
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
          // wrap true by default; this is exactly what we want
        });
        x += c.w;
      }

      // row bottom line
      const yLine = y + rowH;
      doc
        .moveTo(startX, yLine)
        .lineTo(startX + tableW, yLine)
        .strokeColor("#EEE")
        .stroke();

      y += rowH + 2;
    };

    // ===== Table =====
    drawHeader();

    if (rows.length === 0) {
      doc.moveDown(0.8);
      doc.fontSize(11).fillColor("#444").text("No stay registrations found for this period.");
    } else {
      for (const r of rows) {
        const values = rowValues(r);
        const rowH = calcRowHeight(values);
        ensureSpace(rowH + 6);
        drawRow(values, rowH);
      }
    }

    // ===== Footer (page numbers) =====
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
    return res
      .status(500)
      .json({ success: false, error: "Error exporting PDF report" });
  }
};

/**
 * GET /api/bookings/:id/stay-registration/pdf
 * Single booking printable police form (this one is already fine).
 */
export const exportStayRegistrationPdfByBooking = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const hotelId = req.user?.hotelId;
    const createdById = req.user?.id;

    if (!hotelId) {
      return res
        .status(401)
        .json({ success: false, error: "Missing hotel context" });
    }

    const bookingId = Number(req.params.id);
    if (Number.isNaN(bookingId)) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid booking ID" });
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

    if (!snap) {
      const g = booking.guest;

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

          scheduledCheckIn: booking.checkIn,
          scheduledCheckOut: booking.checkOut,
          checkedInAt: booking.checkedInAt ?? null,
          checkedOutAt: booking.checkedOutAt ?? null,
        },
        include: {
          room: { select: { number: true, floor: true } },
          createdBy: { select: { id: true, name: true, email: true, role: true } },
          hotel: { select: { id: true, name: true, code: true } },
        },
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

    section("Guest information");
    field("Name", snap.guestName);
    field("Email", snap.guestEmail ?? "-");
    field("Phone", snap.guestPhone ?? "-");
    field("Nationality", snap.nationality ?? "-");
    field("Document type", snap.documentType ?? "-");
    field("Document number", snap.documentNumber ?? "-");
    field("Birth date", snap.birthDate ? fmtDate(snap.birthDate) : "-");
    field("Gender", snap.gender ?? "-");
    field("Address", snap.address ?? "-");
    field("City", snap.city ?? "-");
    field("Country", snap.country ?? "-");

    section("Stay information");
    field("Scheduled check-in", fmtDateTime(snap.scheduledCheckIn));
    field("Scheduled check-out", fmtDateTime(snap.scheduledCheckOut));
    field("Checked-in at", snap.checkedInAt ? fmtDateTime(snap.checkedInAt) : "-");
    field("Checked-out at", snap.checkedOutAt ? fmtDateTime(snap.checkedOutAt) : "-");

    section("Audit");
    field("Created at", fmtDateTime(snap.createdAt));
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
    return res
      .status(500)
      .json({ success: false, error: "Error exporting stay registration PDF" });
  }
};
