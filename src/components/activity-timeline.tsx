import type { ActivityChannel } from "@prisma/client";
import { activityChannelLabel } from "@/lib/labels";
import { formatDateTime } from "@/lib/format";

type TimelineActivity = {
  id: string;
  channel: ActivityChannel;
  body: string;
  createdAt: Date;
  author: { name: string | null; email: string } | null;
};

export function ActivityTimeline({
  activities,
}: {
  activities: TimelineActivity[];
}) {
  if (activities.length === 0) {
    return <p className="text-sm text-slate-400">אין פעילות עדיין.</p>;
  }

  return (
    <ul className="space-y-3">
      {activities.map((a) => (
        <li
          key={a.id}
          className="rounded-lg border border-slate-200 bg-white p-3"
        >
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-medium text-slate-600">
              {activityChannelLabel[a.channel]}
            </span>
            <span>{formatDateTime(a.createdAt)}</span>
          </div>
          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">
            {a.body}
          </p>
          {a.author && (
            <p className="mt-1 text-xs text-slate-400">
              {a.author.name ?? a.author.email}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
