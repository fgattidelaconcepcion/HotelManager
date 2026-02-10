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

    // Here I load the booking scoped by hotelId (tenant isolation).
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, hotelId },
      include: {
        room: true,
        guest: true,
      },
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

    // Here I prevent duplicates (bookingId is unique on StayRegistration).
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

    /**
     * Here I create the police snapshot:
     * - identity fields are copied from the Guest at the time of creation
     * - stay dates are copied from the Booking
     */
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
 * Here I return a CSV that you can upload/print for police.
 */
export const exportPoliceReportCsv = async (req: AuthRequest, res: Response) => {
  try {
    const hotelId = req.user?.hotelId;
    if (!hotelId) {
      return res
        .status(401)
        .json({ success: false, error: "Missing hotel context" });
    }

    const { from, to } = req.query;

    const where: any = { hotelId };

    // Here I filter by createdAt (report generation period).
    if (from && typeof from === "string") {
      const d = new Date(from);
      if (!Number.isNaN(d.getTime())) {
        where.createdAt = { ...(where.createdAt ?? {}), gte: d };
      }
    }
    if (to && typeof to === "string") {
      const d = new Date(to);
      if (!Number.isNaN(d.getTime())) {
        where.createdAt = { ...(where.createdAt ?? {}), lte: d };
      }
    }

    const rows = await prisma.stayRegistration.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        room: { select: { number: true, floor: true } },
      },
    });

    // Here I build a simple CSV (UTF-8).
    const header = [
      "createdAt",
      "bookingId",
      "roomNumber",
      "roomFloor",
      "guestName",
      "documentType",
      "documentNumber",
      "nationality",
      "birthDate",
      "gender",
      "address",
      "city",
      "country",
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
          r.documentType ?? "",
          r.documentNumber ?? "",
          r.nationality ?? "",
          r.birthDate ? r.birthDate.toISOString().slice(0, 10) : "",
          r.gender ?? "",
          r.address ?? "",
          r.city ?? "",
          r.country ?? "",
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
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="police-report.csv"`
    );

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
 * Here I generate a structured PDF for printing (multiple rows).
 */
export const exportPoliceReportPdf = async (req: AuthRequest, res: Response) => {
  try {
    const hotelId = req.user?.hotelId;
    if (!hotelId) {
      return res
        .status(401)
        .json({ success: false, error: "Missing hotel context" });
    }

    const { from, to } = req.query;

    const where: any = { hotelId };

    if (from && typeof from === "string") {
      const d = new Date(from);
      if (!Number.isNaN(d.getTime())) {
        where.createdAt = { ...(where.createdAt ?? {}), gte: d };
      }
    }
    if (to && typeof to === "string") {
      const d = new Date(to);
      if (!Number.isNaN(d.getTime())) {
        where.createdAt = { ...(where.createdAt ?? {}), lte: d };
      }
    }

    const [hotel, rows] = await Promise.all([
      prisma.hotel.findUnique({ where: { id: hotelId } }),
      prisma.stayRegistration.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
          room: { select: { number: true, floor: true } },
        },
      }),
    ]);

    // Here I set up the PDF response headers.
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="police-report.pdf"`
    );

    const doc = new PDFDocument({
      size: "A4",
      margin: 40,
      bufferPages: true,
    });

    doc.pipe(res);

    // ====== Header ======
    doc
      .fontSize(16)
      .text("Police report (Stay registrations)", { align: "left" });
    doc.moveDown(0.25);

    doc
      .fontSize(10)
      .fillColor("#444")
      .text(`Hotel: ${hotel?.name ?? "Hotel"} (${hotel?.code ?? "N/A"})`);
    doc.text(`Generated: ${fmtDateTime(new Date())}`);
    doc.text(
      `Period: ${typeof from === "string" ? from : "-"} → ${
        typeof to === "string" ? to : "-"
      }`
    );
    doc.moveDown(0.75);

    doc.fillColor("#000");

    // ====== Table config ======
    const pageWidth =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const startX = doc.page.margins.left;
    let y = doc.y;

    const cols = [
      { key: "createdAt", label: "Created", w: 70 },
      { key: "bookingId", label: "Bk", w: 35 },
      { key: "room", label: "Room", w: 45 },
      { key: "guestName", label: "Guest", w: 110 },
      { key: "doc", label: "Doc", w: 105 },
      { key: "nat", label: "Nat.", w: 55 },
      { key: "checkIn", label: "Check-in", w: 70 },
      { key: "checkOut", label: "Check-out", w: 70 },
    ];

    const totalW = cols.reduce((s, c) => s + c.w, 0);
    const scale = totalW > pageWidth ? pageWidth / totalW : 1;
    cols.forEach((c) => (c.w = Math.floor(c.w * scale)));

    const rowH = 18;
    const headerH = 20;

    const drawHeader = () => {
      doc.fontSize(9).fillColor("#000");

      // Here I draw a light background for the header row.
      doc
        .save()
        .rect(startX, y, cols.reduce((s, c) => s + c.w, 0), headerH)
        .fill("#F2F2F2")
        .restore();

      let x = startX;
      doc.font("Helvetica-Bold");
      for (const c of cols) {
        doc.text(c.label, x + 4, y + 6, {
          width: c.w - 8,
          align: "left",
        });
        x += c.w;
      }
      doc.font("Helvetica");

      y += headerH;

      // Here I draw a line under the header.
      doc
        .moveTo(startX, y)
        .lineTo(startX + cols.reduce((s, c) => s + c.w, 0), y)
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

    drawHeader();

    // ====== Rows ======
    doc.fontSize(9).fillColor("#000").strokeColor("#EEE");

    for (const r of rows) {
      ensureSpace(rowH + 6);

      const roomLabel = r.room ? `${r.room.number} (F${r.room.floor})` : "";
      const docLabel = `${r.documentType ?? ""} ${r.documentNumber ?? ""}`.trim();

      const values: Record<string, string> = {
        createdAt: fmtDate(r.createdAt),
        bookingId: String(r.bookingId),
        room: roomLabel,
        guestName: r.guestName ?? "",
        doc: docLabel,
        nat: r.nationality ?? "",
        checkIn: fmtDate(r.scheduledCheckIn),
        checkOut: fmtDate(r.scheduledCheckOut),
      };

      let x = startX;
      for (const c of cols) {
        doc.text(values[c.key] ?? "", x + 4, y + 5, {
          width: c.w - 8,
          align: "left",
          ellipsis: true,
        });
        x += c.w;
      }

      y += rowH;

      doc
        .moveTo(startX, y)
        .lineTo(startX + cols.reduce((s, c) => s + c.w, 0), y)
        .stroke();

      y += 2;
    }

    // ====== Footer (page numbers) ======
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.fontSize(8).fillColor("#666");
      doc.text(
        `Page ${i - range.start + 1} of ${range.count}`,
        doc.page.margins.left,
        doc.page.height - doc.page.margins.bottom + 10,
        {
          align: "right",
          width:
            doc.page.width -
            doc.page.margins.left -
            doc.page.margins.right,
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
 *  GET /api/bookings/:id/stay-registration/pdf
 * Here I generate a printable PDF for ONE booking stay registration.
 *
 * Why this exists:
 * - The global report is useful, but at the front desk you often want to print
 *   a single booking "police form" quickly.
 *
 * Rules:
 * - I scope by hotelId (tenant safe)
 * - If the snapshot does not exist, I can auto-create it for convenience
 *   (optional, but very practical)
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

    // Here I load booking scoped by hotelId.
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, hotelId },
      include: {
        room: true,
        guest: true,
      },
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

    // Here I get or create the snapshot for this booking.
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
          createdBy: {
            select: { id: true, name: true, email: true, role: true },
          },
          hotel: { select: { id: true, name: true, code: true } },
        },
      });
    }

    // Here I set PDF headers.
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="stay-registration-booking-${bookingId}.pdf"`
    );

    const doc = new PDFDocument({
      size: "A4",
      margin: 50,
    });

    doc.pipe(res);

    // ===== Title =====
    doc.fontSize(16).text("Police stay registration", { align: "center" });
    doc.moveDown(0.5);

    // ===== Hotel + meta =====
    doc
      .fontSize(10)
      .fillColor("#444")
      .text(`Hotel: ${snap.hotel?.name ?? "Hotel"} (${snap.hotel?.code ?? "N/A"})`);
    doc.text(`Booking: #${snap.bookingId}`);
    doc.text(
      `Room: ${snap.room?.number ?? ""} ${
        snap.room?.floor != null ? `(Floor ${snap.room.floor})` : ""
      }`
    );
    doc.text(`Generated: ${fmtDateTime(new Date())}`);
    doc.moveDown(1);

    doc.fillColor("#000");

    // ===== Helpers to draw labeled fields =====
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

    // ===== Guest section =====
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

    // ===== Stay section =====
    section("Stay information");
    field("Scheduled check-in", fmtDateTime(snap.scheduledCheckIn));
    field("Scheduled check-out", fmtDateTime(snap.scheduledCheckOut));
    field("Checked-in at", snap.checkedInAt ? fmtDateTime(snap.checkedInAt) : "-");
    field(
      "Checked-out at",
      snap.checkedOutAt ? fmtDateTime(snap.checkedOutAt) : "-"
    );

    // ===== Audit section =====
    section("Audit");
    field("Created at", fmtDateTime(snap.createdAt));
    field("Created by", snap.createdBy?.name ?? "-");
    if (snap.createdBy?.email) field("Created by email", snap.createdBy.email);

    // ===== Signature placeholders =====
    doc.moveDown(1.2);
    doc
      .font("Helvetica")
      .fontSize(10)
      .text("Signature (reception): ________________________________");
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
