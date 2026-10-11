import { useState } from 'react';
import { BookOpen, CheckCircle2, ClipboardList, Route, Target, Users } from 'lucide-react';

import Badge from '../ui/Badge.jsx';
import { MODE_B_REQUIREMENTS, MODE_B_ROUTES, MODE_B_SCOPE } from '../../data/modeB/requirements.js';
import { DEFECTS } from '../../data/defects.js';

/**
 * The round brief: what you are doing, what is known to be broken, and the rules.
 */
export default function TaskPanel({ mode, spec }) {
  return mode === 'A' ? <BriefPanel spec={spec} /> : <RequirementsPanel spec={spec} />;
}

/* ------------------------------------------------------------------ round 1 */

function BriefPanel({ spec }) {
  const defects = DEFECTS.A;
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? defects : defects.slice(0, 4);

  return (
    <div className="space-y-5 p-3.5">
      <Section icon={Target} title="Objective">
        <p className="text-[12.5px] leading-relaxed text-ink-dim">{spec.objective}</p>
      </Section>

      <Section icon={ClipboardList} title="Context">
        <ul className="space-y-1.5">
          {spec.brief.map((line) => (
            <li key={line} className="flex gap-2 text-[12.5px] leading-relaxed text-ink-dim">
              <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-sky-500/70" />
              {line}
            </li>
          ))}
        </ul>
      </Section>

      <Section icon={ClipboardList} title={`Reported issues · ${defects.length}`}>
        <ul className="space-y-1.5">
          {visible.map((defect) => (
            <li key={defect.id} className="rounded-lg border border-line bg-surface-2/50 px-2.5 py-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone="neutral" className="!text-[9px]">{defect.area}</Badge>
                <Badge tone={defect.difficulty === 'Easy' ? 'ok' : 'warn'} className="!text-[9px]">
                  {defect.difficulty}
                </Badge>
                <span className="font-mono text-[10px] text-ink-faint">{defect.question}</span>
              </div>
              <p className="mt-1 text-[12px] font-medium leading-snug text-ink-dim">{defect.summary}</p>
              <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-faint">{defect.detail}</p>
            </li>
          ))}
        </ul>
        {defects.length > 4 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-2 text-[11.5px] text-sky-400 transition-colors hover:text-sky-300"
          >
            {expanded ? 'Show fewer' : `Show ${defects.length - 4} more`}
          </button>
        )}
      </Section>

      <Section icon={CheckCircle2} title="Rules">
        <ul className="space-y-1.5">
          {spec.constraints.map((line) => (
            <li key={line} className="flex gap-2 text-[12px] leading-relaxed text-ink-dim">
              <CheckCircle2 size={12} className="mt-0.5 shrink-0 text-emerald-400/70" />
              {line}
            </li>
          ))}
        </ul>
      </Section>

      <Section icon={BookOpen} title="Stack">
        <div className="flex flex-wrap gap-1.5">
          {spec.stack.map((tech) => (
            <Badge key={tech} tone="brand">{tech}</Badge>
          ))}
        </div>
      </Section>
    </div>
  );
}

/* ------------------------------------------------------------------ round 2 */

function RequirementsPanel({ spec }) {
  const [open, setOpen] = useState(null);
  const req = MODE_B_REQUIREMENTS;

  return (
    <div className="space-y-5 p-3.5">
      <div className="rounded-lg border border-sky-500/25 bg-sky-500/[0.06] p-3">
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-sky-300">
          <Target size={12} />
          {req.epic}
        </div>
        <p className="mt-2 text-[12.5px] italic leading-relaxed text-ink-dim">{req.persona}</p>
      </div>

      <Section icon={ClipboardList} title={`User stories · ${req.stories.length}`}>
        <ul className="space-y-2">
          {req.stories.map((story) => {
            const isOpen = open === story.id;
            return (
              <li key={story.id} className="overflow-hidden rounded-lg border border-line bg-surface-2/40">
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : story.id)}
                  className="flex w-full items-start gap-2 px-2.5 py-2 text-left transition-colors hover:bg-surface-2"
                >
                  <span className="mt-0.5 shrink-0 rounded bg-violet-500/15 px-1.5 py-0.5 font-mono text-[9.5px] font-semibold text-violet-300">
                    {story.id}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12.5px] font-medium leading-snug text-ink">{story.title}</span>
                    <span className="mt-0.5 block text-[11.5px] leading-relaxed text-ink-faint">
                      {story.body}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-[10px] text-ink-faint">{story.points}p</span>
                </button>

                {isOpen && (
                  <ul className="space-y-1.5 border-t border-line bg-canvas/50 px-3 py-2.5">
                    {story.acceptance.map((line) => (
                      <li key={line} className="flex gap-2 text-[11.5px] leading-relaxed text-ink-dim">
                        <CheckCircle2 size={11} className="mt-[3px] shrink-0 text-emerald-400/70" />
                        {line}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </Section>

      <Section icon={Users} title="Who can see what">
        <dl className="space-y-1.5">
          {Object.entries(MODE_B_SCOPE).map(([role, scope]) => (
            <div key={role} className="flex items-center justify-between gap-3 text-[12px]">
              <dt className="capitalize text-ink-dim">{role}</dt>
              <dd className="text-right text-ink-faint">{scope}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-2.5 overflow-x-auto rounded-lg border border-line">
          <table className="w-full border-collapse text-[10.5px]">
            <thead>
              <tr className="bg-surface-3 text-ink-faint">
                <th className="px-2 py-1.5 text-left font-medium">Email</th>
                <th className="px-2 py-1.5 text-left font-medium">Password</th>
                <th className="px-2 py-1.5 text-left font-medium">Role</th>
              </tr>
            </thead>
            <tbody>
              {req.seededUsers.map((user) => (
                <tr key={user.email} className="odd:bg-surface/40">
                  <td className="border-t border-line-soft px-2 py-1.5 font-mono text-ink-dim">{user.email}</td>
                  <td className="border-t border-line-soft px-2 py-1.5 font-mono text-ink-faint">{user.password}</td>
                  <td className="border-t border-line-soft px-2 py-1.5">
                    <Badge tone={user.role === 'admin' ? 'violet' : user.role === 'manager' ? 'brand' : 'neutral'} className="!text-[9px]">
                      {user.role}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section icon={Route} title="Route map">
        <div className="overflow-hidden rounded-lg border border-line">
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr className="bg-surface-3 text-ink-faint">
                <th className="px-2 py-1.5 text-left font-medium">Route</th>
                <th className="px-2 py-1.5 text-left font-medium">Today</th>
              </tr>
            </thead>
            <tbody>
              {MODE_B_ROUTES.map((route) => (
                <tr key={`${route.method} ${route.path}`} className="odd:bg-surface/40">
                  <td className="border-t border-line-soft px-2 py-1.5">
                    <span className="mr-1 font-mono text-[9.5px] text-sky-400">{route.method}</span>
                    <span className="font-mono text-ink-dim">{route.path}</span>
                  </td>
                  <td className="border-t border-line-soft px-2 py-1.5 text-ink-faint">{route.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section icon={CheckCircle2} title="Definition of done">
        <ul className="space-y-1.5">
          {req.definitionOfDone.map((line) => (
            <li key={line} className="flex gap-2 text-[12px] leading-relaxed text-ink-dim">
              <CheckCircle2 size={12} className="mt-0.5 shrink-0 text-emerald-400/70" />
              {line}
            </li>
          ))}
        </ul>
      </Section>

      <Section icon={BookOpen} title="Rules">
        <ul className="space-y-1.5">
          {spec.constraints.map((line) => (
            <li key={line} className="flex gap-2 text-[12px] leading-relaxed text-ink-dim">
              <CheckCircle2 size={12} className="mt-0.5 shrink-0 text-emerald-400/70" />
              {line}
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

/* ------------------------------------------------------------------ shared */

function Section({ icon: Icon, title, children }) {
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
        <Icon size={12} />
        {title}
      </h3>
      {children}
    </section>
  );
}
