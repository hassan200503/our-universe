import { worldPerson } from "@/lib/world-page";
import { radar } from "@/lib/data";
import { addRadarItem, addRadarLane } from "@/lib/actions/personal";
import { ActionForm, Field } from "@/components/ui/forms";
import { RadarBoard } from "./radar-board";

export const metadata = { title: "Radar" };

export default async function RadarPage({ params }: PageProps<"/world/[slug]/radar">) {
  const { person, own, first } = await worldPerson(params);
  const lanes = await radar(person.id);
  return (
    <div>
      <h2 className="font-display text-2xl font-semibold">{person.radarTitle}</h2>
      <p className="mt-1 max-w-2xl text-muted">
        A living map of {own ? "your" : `${first}'s`} growth. Things move between lanes as they go from curiosity to practice to mastery{own ? " — and the lanes themselves are yours to rename." : "."}
      </p>
      <RadarBoard lanes={lanes} editable={own} />
      {own && (
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <div className="card p-5">
            <h3 className="font-semibold">Add to the radar</h3>
            <ActionForm action={addRadarItem} submit="Add" className="mt-3 space-y-3">
              <Field label="Name" name="name">
                <input id="name" name="name" required className="field" />
              </Field>
              <Field label="Lane" name="laneId">
                <select id="laneId" name="laneId" className="field">
                  {lanes.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Note" name="note" hint="(optional)">
                <input id="note" name="note" className="field" />
              </Field>
            </ActionForm>
          </div>
          <div className="card p-5">
            <h3 className="font-semibold">Add a lane</h3>
            <ActionForm action={addRadarLane} submit="Add lane" className="mt-3">
              <Field label="Lane name" name="lane-name">
                <input id="lane-name" name="name" required className="field" placeholder="e.g. Teaching" />
              </Field>
            </ActionForm>
          </div>
        </div>
      )}
    </div>
  );
}
