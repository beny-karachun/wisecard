import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { buildCalendar } from "@/lib/calendar";

export async function GET() {
  const { organizationId } = await requireUser();
  const appointments = await prisma.appointment.findMany({
    where: { case: { organizationId } },
    include: {
      case: { select: { title: true, contact: { select: { name: true } } } },
    },
    orderBy: { startsAt: "asc" },
  });
  return new Response(
    buildCalendar(
      appointments.map((a) => ({
        ...a,
        description: `${a.case.contact.name} · ${a.case.title || "תיק משכנתא"}`,
      })),
    ),
    {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'attachment; filename="wisecard-calendar.ics"',
        "Cache-Control": "private, no-store",
      },
    },
  );
}
