import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/session";
import { listNurtureTemplates } from "@/modules/today/service";
import { SimpleBoard } from "@/components/platform/simple-board";

export default async function NurturePage() {
  const actor = await getAuthUser();
  if (!actor) redirect("/login");
  const rows = await listNurtureTemplates();
  return (
    <SimpleBoard
      eyebrow="Marketing"
      title="WhatsApp / SMS nurture"
      summary="Day-offset journeys that keep leads warm until the next outbound call. Sends log onto the lead timeline."
      kind="nurture"
      columns={["name", "channel", "journey", "dayOffset"]}
      rows={rows}
      fields={[
        { name: "name", label: "Template name", required: true },
        { name: "channel", label: "Channel", options: ["whatsapp", "sms"].map((s) => ({ value: s, label: s })) },
        {
          name: "journey",
          label: "Journey",
          options: ["general", "events"].map((s) => ({ value: s, label: s })),
        },
        { name: "dayOffset", label: "Day (1, 3, 7, 14, 30)", type: "number" },
        { name: "body", label: "Message", required: true },
      ]}
    />
  );
}
