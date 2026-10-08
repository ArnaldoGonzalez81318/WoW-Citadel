import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Link,
  Stack,
  Typography,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useId, useMemo, useState } from "react";
import type { ElementType } from "react";

import MediaTile from "@/components/common/MediaTile";
import { EmptyState } from "@/components/common/StateBlocks";
import { creatureDisplayRenderQuery } from "@/features/creatures/hooks/creatureDisplayQueries";
import type { JournalBodyBlock, JournalSection } from "@/features/journal/types";
import { wowheadUrl } from "@/lib/externalLinks";
import { visuallyHidden } from "@/theme";

export type AbilityTreeProps = {
  sections: JournalSection[];
  encounterName: string;
};

/** "Abilities" is the encounter's h3, so its sections start at h4 and stop at h6. */
const headingFor = (depth: number): ElementType =>
  depth <= 0 ? "h4" : depth === 1 ? "h5" : "h6";

/**
 * Each level indents by its own padding; on phones a tighter step keeps a
 * five-deep branch (Argus the Unmaker has one) readable at 320px.
 */
const NODE_PX = { xs: 1.5, sm: 2 } as const;

const isExpandable = (section: JournalSection): boolean =>
  section.body.length > 0 || section.sections.length > 0;

const collectExpandable = (sections: JournalSection[], into: number[] = []): number[] => {
  sections.forEach((section) => {
    if (isExpandable(section)) {
      into.push(section.id);
      collectExpandable(section.sections, into);
    }
  });
  return into;
};

const SPELL_REFERENCE = /(\[[^\]]+\])/;

/**
 * A line of journal text with its `[Spell Name]` references marked, the way
 * the in-game journal highlights them (the brackets themselves are dropped).
 */
const JournalText = ({ text }: { text: string }): JSX.Element => (
  <>
    {text.split(SPELL_REFERENCE).map((part, index) =>
      part.startsWith("[") && part.endsWith("]") && part.length > 2 ? (
        <Box key={index} component="strong" sx={{ color: "secondary.main", fontWeight: 600 }}>
          {part.slice(1, -1)}
        </Box>
      ) : (
        part
      ),
    )}
  </>
);

const BodyBlocks = ({ blocks }: { blocks: JournalBodyBlock[] }): JSX.Element | null =>
  blocks.length === 0 ? null : (
    <Stack spacing={1} sx={{ maxWidth: "72ch" }}>
      {blocks.map((block, index) =>
        block.kind === "paragraph" ? (
          <Typography key={index} variant="body2" color="text.secondary" component="p" sx={{ m: 0 }}>
            <JournalText text={block.text} />
          </Typography>
        ) : (
          <Box
            key={index}
            component="ul"
            sx={{ m: 0, pl: 2.5, typography: "body2", color: "text.secondary", "& > li + li": { mt: 0.5 } }}
          >
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex}>
                <JournalText text={item} />
              </li>
            ))}
          </Box>
        ),
      )}
    </Stack>
  );

/** A section's add, loaded only once its row is on screen (a collapsed parent unmounts it). */
const SectionRender = ({ displayId, name }: { displayId: number; name: string }): JSX.Element => {
  const query = useQuery(creatureDisplayRenderQuery(displayId));
  return (
    <MediaTile
      size={40}
      src={query.data ?? null}
      alt=""
      fallbackLabel={name}
      loading={query.isPending}
      radius="md"
    />
  );
};

/** Blizzard's encounter spell ids are Wowhead's; most have no record in the game data API. */
const SpellLink = ({ spell }: { spell: { id: number; name: string } }): JSX.Element | null => {
  const href = wowheadUrl("spell", spell.id);
  if (!href) {
    return null;
  }
  return (
    <Link
      href={href}
      target="_blank"
      rel="noreferrer"
      variant="body2"
      sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, alignSelf: "flex-start", overflowWrap: "anywhere" }}
    >
      {spell.name}
      <Box component="span" sx={visuallyHidden}>
        {" (Wowhead, opens in a new tab)"}
      </Box>
      <OpenInNewRoundedIcon aria-hidden sx={{ fontSize: 14 }} />
    </Link>
  );
};

type NodeProps = {
  section: JournalSection;
  depth: number;
  idBase: string;
  expanded: ReadonlySet<number>;
  onToggle: (sectionId: number, open: boolean) => void;
};

/** A spell or note with nothing beneath it: a plain row, not an empty accordion. */
const LeafRow = ({ section }: { section: JournalSection }): JSX.Element => (
  <Stack
    direction="row"
    spacing={1.5}
    alignItems="center"
    sx={(theme) => ({
      minWidth: 0,
      px: NODE_PX,
      py: 1,
      minHeight: 48,
      border: `1px solid ${theme.palette.border.subtle}`,
      borderRadius: `${theme.wc.radius.md}px`,
    })}
  >
    {section.displayId !== undefined ? (
      <SectionRender displayId={section.displayId} name={section.title} />
    ) : null}
    {section.spell ? (
      <SpellLink spell={{ id: section.spell.id, name: section.title }} />
    ) : (
      <Typography variant="body2" component="p" sx={{ m: 0, minWidth: 0, overflowWrap: "anywhere" }}>
        {section.title}
      </Typography>
    )}
  </Stack>
);

const SectionNode = ({ section, depth, idBase, expanded, onToggle }: NodeProps): JSX.Element => {
  if (!isExpandable(section)) {
    return <LeafRow section={section} />;
  }
  const open = expanded.has(section.id);
  const nodeId = `${idBase}-${section.id}`;
  return (
    <Accordion
      expanded={open}
      onChange={(_event, next) => onToggle(section.id, next)}
      disableGutters
      // `component`, not `slots.heading`: a slot swaps out MUI's styled
      // heading and with it the `all: unset` that drops the browser's
      // heading margins; `component` only changes the element it renders.
      slotProps={{ heading: { component: headingFor(depth) }, transition: { unmountOnExit: true } }}
      sx={(theme) => ({
        // Nested levels sit on a faint inset so the tree's depth reads at a glance.
        backgroundColor: depth > 0 ? theme.palette.surface.inset : "transparent",
        borderColor: depth > 0 ? theme.palette.border.subtle : theme.palette.border.default,
      })}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreRoundedIcon />}
        id={`${nodeId}-summary`}
        aria-controls={`${nodeId}-details`}
        sx={{ px: NODE_PX, minHeight: 48, "& .MuiAccordionSummary-content": { minWidth: 0, my: 1 } }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
          {section.displayId !== undefined ? (
            <SectionRender displayId={section.displayId} name={section.title} />
          ) : null}
          <Typography
            variant={depth === 0 ? "subtitle1" : "subtitle2"}
            component="span"
            sx={{ minWidth: 0, overflowWrap: "anywhere" }}
          >
            {section.title}
          </Typography>
        </Stack>
      </AccordionSummary>
      {/* The Accordion gives its region the summary's aria-controls as id. */}
      <AccordionDetails sx={{ px: NODE_PX, pb: 2, pt: 0 }}>
        <Stack spacing={1.5}>
          <BodyBlocks blocks={section.body} />
          {section.spell ? <SpellLink spell={section.spell} /> : null}
          {section.sections.length > 0 ? (
            <Stack spacing={1}>
              {section.sections.map((child) => (
                <SectionNode
                  key={child.id}
                  section={child}
                  depth={depth + 1}
                  idBase={idBase}
                  expanded={expanded}
                  onToggle={onToggle}
                />
              ))}
            </Stack>
          ) : null}
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
};

/**
 * An encounter's ability tree as nested accordions: stages, role notes,
 * adds and spells, with Blizzard's bullets and spell references kept. The
 * first section (usually the Overview) starts open. Collapsed branches are
 * unmounted, so a 100-node tree (Crown of the Cosmos) costs only what is
 * open, adds' renders included. Mount it with a `key` per encounter so its open set resets.
 */
const AbilityTree = ({ sections, encounterName }: AbilityTreeProps): JSX.Element => {
  const idBase = useId();
  const headingId = useId();
  const expandable = useMemo(() => collectExpandable(sections), [sections]);
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(() => {
    const first = sections.find(isExpandable);
    return new Set(first ? [first.id] : []);
  });
  const onToggle = useCallback((sectionId: number, open: boolean): void => {
    setExpanded((previous) => {
      const next = new Set(previous);
      if (open) {
        next.add(sectionId);
      } else {
        next.delete(sectionId);
      }
      return next;
    });
  }, []);
  const allOpen = expandable.length > 0 && expandable.every((id) => expanded.has(id));

  return (
    <Stack component="section" aria-labelledby={headingId} spacing={1.5}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
        <Typography id={headingId} variant="subtitle1" component="h3" sx={{ m: 0, flex: 1, minWidth: 0 }}>
          Abilities
        </Typography>
        {expandable.length > 1 ? (
          <Button
            size="small"
            onClick={() => setExpanded(allOpen ? new Set() : new Set(expandable))}
          >
            {allOpen ? "Collapse all" : "Expand all"}
          </Button>
        ) : null}
      </Stack>
      {sections.length === 0 ? (
        <EmptyState
          compact
          title="No abilities listed"
          description={`Blizzard's journal has no ability notes for ${encounterName}.`}
        />
      ) : (
        <Stack spacing={1}>
          {sections.map((section) => (
            <SectionNode
              key={section.id}
              section={section}
              depth={0}
              idBase={idBase}
              expanded={expanded}
              onToggle={onToggle}
            />
          ))}
        </Stack>
      )}
    </Stack>
  );
};

export default AbilityTree;
