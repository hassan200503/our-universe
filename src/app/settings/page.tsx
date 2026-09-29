import Link from "next/link";
import { eq } from "drizzle-orm";
import { requireCtx } from "@/lib/context";
import { getDb } from "@/lib/db/client";
import { preferences } from "@/lib/db/schema";
import { personTopics } from "@/lib/trends/query";
import { SOURCES } from "@/lib/trends/sources";
import { TOPICS, TOPIC_KEYS } from "@/lib/trends/topics";
import { changePasscode, saveFeatures, saveInterests, savePreferences, saveProfile, saveRelationship } from "@/lib/actions/personal";
import { ActionForm, Field } from "@/components/ui/forms";
import { AvatarPicker } from "@/components/avatar-picker";
import { AlertsSetting } from "@/components/push";
import { storageMode } from "@/lib/media/storage";
import { logout } from "@/lib/actions/auth";
import { Container, PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const ctx = await requireCtx();
  const me = ctx.me;
  const db = await getDb();
  const [pref] = await db.select().from(preferences).where(eq(preferences.personId, me.id));
  const topics = await personTopics(me.id);
  const followed = SOURCES.filter((s) => topics.includes(s.topic));
  const categories = topics.flatMap((t) => [...TOPICS[t].categories.map((c) => c.name), TOPICS[t].fallbackCategory]);

  return (
    <>
      <PageHeader world={me.theme} eyebrow="Settings" title={`Your settings, ${me.displayName.split(" ")[0]}`}>
        Everything here can be changed back at any time.
        <form action={logout} className="mt-4">
          <button className="btn btn-ghost">Sign out</button>
        </form>
      </PageHeader>
      <Container world={me.theme}>
        <div className="grid gap-8 lg:grid-cols-2">
          <section className="card p-5">
            <h2 className="font-display text-xl font-semibold">Profile</h2>
            <div className="mt-4">
              <AvatarPicker name={me.displayName} url={me.avatarUrl} theme={me.theme} enabled={storageMode() !== "none"} />
            </div>
            <ActionForm action={saveProfile} submit="Save profile" resetOnSuccess={false} className="mt-5 space-y-3">
              <Field label="Name" name="displayName">
                <input id="displayName" name="displayName" required defaultValue={me.displayName} className="field" />
              </Field>
              <Field label="Nickname" name="nickname" hint="(optional · only the two of you see it, never public)">
                <input id="nickname" name="nickname" defaultValue={me.nickname ?? ""} className="field" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Course" name="course">
                  <input id="course" name="course" defaultValue={me.course ?? ""} className="field" />
                </Field>
                <Field label="Focus" name="focus">
                  <input id="focus" name="focus" defaultValue={me.focus ?? ""} className="field" />
                </Field>
              </div>
              <Field label="Headline" name="headline">
                <input id="headline" name="headline" defaultValue={me.headline ?? ""} className="field" />
              </Field>
              <Field label="Introduction" name="intro" hint="(blank line = new paragraph)">
                <textarea id="intro" name="intro" defaultValue={me.intro ?? ""} className="field min-h-40" />
              </Field>
              <Field label="Motto" name="motto">
                <input id="motto" name="motto" defaultValue={me.motto ?? ""} className="field" />
              </Field>
              <Field label="Birthday 🎂" name="birthday" hint="(your partner gets a countdown and a celebration on the day)">
                <input id="birthday" name="birthday" type="date" defaultValue={me.birthday ?? ""} className="field" />
              </Field>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" name="publicProfile" defaultChecked={me.publicProfile} className="mt-1" />
                <span>
                  Turn on my public profile at <code>/p/{me.slug}</code>. It shows only your name, introduction, and skills and projects marked 🌍 Public. Never memories, journals,
                  vaults or your nickname.
                  {me.publicProfile && (
                    <Link href={`/p/${me.slug}`} className="ml-1 text-accent underline">
                      View it
                    </Link>
                  )}
                </span>
              </label>
            </ActionForm>
          </section>

          <div className="space-y-8">
            <section className="card p-5">
              <h2 className="font-display text-xl font-semibold">Interests</h2>
              <p className="text-sm text-muted">These decide your For You feed and dashboard.</p>
              <ActionForm action={saveInterests} submit="Save interests" resetOnSuccess={false} className="mt-3">
                <div className="grid grid-cols-2 gap-2">
                  {TOPIC_KEYS.map((t) => (
                    <label key={t} className="flex items-center gap-2 rounded-lg border border-line p-2 text-sm">
                      <input type="checkbox" name="topic" value={t} defaultChecked={topics.includes(t)} />
                      {TOPICS[t].emoji} {TOPICS[t].label}
                    </label>
                  ))}
                </div>
              </ActionForm>
            </section>

            <section id="us" data-world="us" className="card-glow scroll-mt-20 p-5">
              <h2 className="font-display text-xl font-semibold">Our journey</h2>
              <p className="text-sm text-muted">Shared by both of you. The day it began powers the journey clock on the home page, and every anniversary.</p>
              <ActionForm action={saveRelationship} submit="Save" resetOnSuccess={false} className="mt-3 space-y-3">
                <Field label="What do you call your universe?" name="rel-name">
                  <input id="rel-name" name="name" required defaultValue={ctx.relationship.name} className="field" />
                </Field>
                <Field label="The day it all began" name="startedOn">
                  <input id="startedOn" name="startedOn" type="date" defaultValue={ctx.relationship.startedOn ?? ""} className="field" />
                </Field>
                <Field label="Next time we're together ✈️" name="nextMeetOn" hint="(counts down on the home page)">
                  <input id="nextMeetOn" name="nextMeetOn" type="date" defaultValue={ctx.relationship.nextMeetOn ?? ""} className="field" />
                </Field>
              </ActionForm>
            </section>

            <section id="alerts" className="card scroll-mt-20 p-5">
              <h2 className="font-display text-xl font-semibold">Calls &amp; alerts</h2>
              <p className="text-sm text-muted">Voice and video calls ring on any device where you&apos;re signed in. Turn alerts on for each phone or computer you want to ring when the site is closed.</p>
              <AlertsSetting />
            </section>

            <section className="card p-5">
              <h2 className="font-display text-xl font-semibold">Your sections</h2>
              <p className="text-sm text-muted">Optional areas in your world.</p>
              <ActionForm action={saveFeatures} submit="Save sections" resetOnSuccess={false} className="mt-3 space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="feature" value="projects" defaultChecked={me.features.includes("projects")} /> 🛠️ Things I&apos;m Building (projects)
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="feature" value="thinking" defaultChecked={me.features.includes("thinking")} /> 🧠 Questions I&apos;m Thinking About
                </label>
              </ActionForm>
            </section>

            <section className="card p-5">
              <h2 className="font-display text-xl font-semibold">Passcode</h2>
              <ActionForm action={changePasscode} submit="Change passcode" className="mt-3 space-y-3">
                <Field label="Current passcode" name="current">
                  <input id="current" name="current" type="password" autoComplete="current-password" required className="field" />
                </Field>
                <Field label="New passcode" name="next" hint="(8+ characters)">
                  <input id="next" name="next" type="password" autoComplete="new-password" minLength={8} required className="field" />
                </Field>
                <Field label="New passcode again" name="confirm">
                  <input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required className="field" />
                </Field>
              </ActionForm>
            </section>

            <section id="personalise" className="card scroll-mt-20 p-5">
              <h2 className="font-display text-xl font-semibold">Personalise your feeds</h2>
              <ActionForm action={savePreferences} submit="Save preferences" resetOnSuccess={false} className="mt-3 space-y-5">
                <fieldset>
                  <legend className="text-sm font-semibold">Favourite topics <span className="font-normal text-muted">(twice the space in For You)</span></legend>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {topics.map((t) => (
                      <label key={t} className="flex items-center gap-1.5 text-sm">
                        <input type="checkbox" name="favoriteTopics" value={t} defaultChecked={pref?.favoriteTopics.includes(t)} />
                        {TOPICS[t].label}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <fieldset>
                  <legend className="text-sm font-semibold">Sources</legend>
                  <p className="text-xs text-muted">Mute a source to hide it; star one to remember you trust it.</p>
                  <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto pr-2 text-sm">
                    {followed.map((s) => (
                      <li key={s.key} className="flex items-center gap-3">
                        <span className="flex-1">
                          {TOPICS[s.topic].emoji} {s.name}
                        </span>
                        <label className="flex items-center gap-1 text-xs">
                          <input type="checkbox" name="savedSources" value={s.key} defaultChecked={pref?.savedSources.includes(s.key)} />⭐
                        </label>
                        <label className="flex items-center gap-1 text-xs">
                          <input type="checkbox" name="mutedSources" value={s.key} defaultChecked={pref?.mutedSources.includes(s.key)} />
                          Mute
                        </label>
                      </li>
                    ))}
                  </ul>
                </fieldset>
                <fieldset>
                  <legend className="text-sm font-semibold">Hide categories</legend>
                  <div className="mt-2 flex max-h-40 flex-wrap gap-x-4 gap-y-1 overflow-y-auto text-sm">
                    {[...new Set(categories)].map((c) => (
                      <label key={c} className="flex items-center gap-1.5">
                        <input type="checkbox" name="blockedCategories" value={c} defaultChecked={pref?.blockedCategories.includes(c)} />
                        {c}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <Field label="Hide items mentioning" name="blockedKeywords" hint="(comma separated)">
                  <input id="blockedKeywords" name="blockedKeywords" defaultValue={pref?.blockedKeywords.join(", ")} className="field" />
                </Field>
                <Field label="Digest frequency" name="digestFrequency">
                  <select id="digestFrequency" name="digestFrequency" defaultValue={pref?.digestFrequency ?? "weekly"} className="field">
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="off">Off</option>
                  </select>
                </Field>
              </ActionForm>
            </section>
          </div>
        </div>
      </Container>
    </>
  );
}
