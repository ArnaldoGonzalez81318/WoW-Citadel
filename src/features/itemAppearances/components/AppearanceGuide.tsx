import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { Box, Typography } from "@mui/material";

import SectionCard from "@/components/common/SectionCard";

type GuideEntry = { term: string; detail: string };

/*
 * What the page can and cannot show, from what the endpoints return. The one
 * piece of game knowledge (what repeated set names usually are) says so.
 */
const ENTRIES: readonly GuideEntry[] = [
  {
    term: "Appearance",
    detail:
      "One look for one slot. Several items can wear the same look; its record lists every one, with the slot and armor or weapon type.",
  },
  {
    term: "Appearance set",
    detail:
      "A name and one appearance per piece. Blizzard often lists several sets under one name, each with its own appearances (a piece can recur across them) and sometimes its own items; in game these are usually difficulty or season recolours, which the API does not label.",
  },
  {
    term: "Set cards",
    detail:
      "Each card stands for one name and shows its newest set (the highest set id): the icon of its first piece, the item type Blizzard records for that piece (an armor type such as Plate, or Cosmetic) and its piece count. The other sets under the name open from the set as versions.",
  },
  {
    term: "Pictures",
    detail:
      "Blizzard's Game Data API has no render, model viewer or preview for appearances or sets. Every picture here is the inventory icon of the first item that wears the look.",
  },
  {
    term: "Display info ID",
    detail:
      "The game client's model record for the look. The API only reports the number; it serves nothing to draw from it.",
  },
  {
    term: "Search limits",
    detail:
      "Blizzard's appearance search can't filter by armor or weapon type (its entries hold just the id, slot and display id) and counts 1,000 matches at most; this page browses each slot's newest or oldest thousand. Any appearance opens by its id.",
  },
];

/** The facts behind the page's two views, as a definition list. */
const AppearanceGuide = (): JSX.Element => (
  <SectionCard
    title="About this data"
    icon={<InfoOutlinedIcon />}
    description="What Blizzard's item appearance endpoints hold, and what they leave out."
  >
    <Box
      component="dl"
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "minmax(0, 1fr)",
          sm: "minmax(140px, max-content) minmax(0, 1fr)",
        },
        columnGap: 3,
        rowGap: { xs: 0.5, sm: 1.5 },
        m: 0,
      }}
    >
      {ENTRIES.map((entry) => (
        <Box key={entry.term} sx={{ display: "contents" }}>
          <Typography component="dt" variant="subtitle2" sx={{ m: 0, mt: { xs: 1, sm: 0 } }}>
            {entry.term}
          </Typography>
          <Typography
            component="dd"
            variant="body2"
            color="text.secondary"
            sx={{ m: 0, minWidth: 0, maxWidth: "72ch" }}
          >
            {entry.detail}
          </Typography>
        </Box>
      ))}
    </Box>
  </SectionCard>
);

export default AppearanceGuide;
