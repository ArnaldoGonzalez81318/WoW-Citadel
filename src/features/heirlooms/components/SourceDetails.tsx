import { Box, Stack, Typography } from "@mui/material";

import SourceIcon from "@/features/heirlooms/components/SourceIcon";
import type { Heirloom, SourceLine } from "@/features/heirlooms/types";

type Segment =
  | { kind: "pairs"; lines: SourceLine[] }
  | { kind: "text"; value: string };

/** Runs of "Label: value" lines become one definition list; prose stands alone. */
const segmentsOf = (block: readonly SourceLine[]): Segment[] => {
  const segments: Segment[] = [];
  block.forEach((line) => {
    if (line.label === null) {
      segments.push({ kind: "text", value: line.value });
      return;
    }
    const last = segments[segments.length - 1];
    if (last?.kind === "pairs") {
      last.lines.push(line);
    } else {
      segments.push({ kind: "pairs", lines: [line] });
    }
  });
  return segments;
};

const Block = ({ block }: { block: readonly SourceLine[] }): JSX.Element => (
  <Box
    sx={(theme) => ({
      p: 1.5,
      minWidth: 0,
      borderRadius: `${theme.wc.radius.md}px`,
      border: `1px solid ${theme.palette.border.subtle}`,
      backgroundColor: theme.palette.surface.inset,
    })}
  >
    <Stack spacing={0.75}>
      {segmentsOf(block).map((segment, index) =>
        segment.kind === "text" ? (
          <Typography key={index} variant="body2" component="p" sx={{ m: 0, overflowWrap: "anywhere" }}>
            {segment.value}
          </Typography>
        ) : (
          <Box
            key={index}
            component="dl"
            sx={{
              display: "grid",
              gridTemplateColumns: "max-content minmax(0, 1fr)",
              columnGap: 1.5,
              rowGap: 0.5,
              m: 0,
            }}
          >
            {segment.lines.map((line, lineIndex) => (
              <Box key={lineIndex} sx={{ display: "contents" }}>
                <Typography
                  component="dt"
                  variant="caption"
                  sx={{ color: "text.secondary", fontWeight: 500, alignSelf: "baseline" }}
                >
                  {line.label}
                </Typography>
                <Typography
                  component="dd"
                  variant="body2"
                  sx={{ m: 0, minWidth: 0, overflowWrap: "anywhere", alignSelf: "baseline" }}
                >
                  {line.value}
                </Typography>
              </Box>
            ))}
          </Box>
        ),
      )}
    </Stack>
  </Box>
);

/**
 * Where an heirloom comes from: Blizzard's source type, then its source
 * text split into one panel per vendor (or mission, or event), each line
 * as label and value ("Vendor" Krom Stoutarm, "Zone" Ironforge - Hall of
 * Explorers). A quarter of the collection has a type and no text at all.
 */
const SourceDetails = ({ heirloom }: { heirloom: Heirloom }): JSX.Element => {
  const { source, sourceBlocks } = heirloom;
  return (
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={1} alignItems="center">
        <SourceIcon sourceKey={source.key} fontSize="small" sx={{ color: "primary.light" }} />
        <Typography variant="subtitle2" component="p" sx={{ m: 0 }}>
          {source.name}
        </Typography>
      </Stack>
      {sourceBlocks.length > 0 ? (
        <Box
          sx={{
            display: "grid",
            gap: 1.5,
            gridTemplateColumns: {
              xs: "minmax(0, 1fr)",
              sm: sourceBlocks.length > 1 ? "repeat(2, minmax(0, 1fr))" : "minmax(0, 1fr)",
            },
          }}
        >
          {sourceBlocks.map((block, index) => (
            <Block key={index} block={block} />
          ))}
        </Box>
      ) : (
        <Typography variant="body2" color="text.secondary">
          {`Blizzard gives no more detail than “${source.name}” for this heirloom.`}
        </Typography>
      )}
    </Stack>
  );
};

export default SourceDetails;
