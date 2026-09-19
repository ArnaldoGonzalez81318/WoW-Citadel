import LaunchRounded from "@mui/icons-material/LaunchRounded";
import { Button, Typography } from "@mui/material";
import { useMemo } from "react";

import DetailDialog from "@/components/common/DetailDialog";
import type {
  DetailDialogRow,
  DetailDialogSection,
} from "@/components/common/DetailDialog";
import type { AchievementGalleryItem } from "@/features/achievements/types";
import { cleanMarkup } from "@/lib/blizzardHelpers";

export type AchievementDetailDialogProps = {
  open: boolean;
  onClose: () => void;
  item: AchievementGalleryItem | null;
};

const buildRows = (item: AchievementGalleryItem): DetailDialogRow[] => {
  const { achievement } = item;
  const rows: DetailDialogRow[] = [];
  const rewardText = achievement.reward ?? achievement.reward_item?.name;
  const criteria = cleanMarkup(achievement.criteria?.description);

  if (typeof achievement.points === "number") {
    rows.push({ label: "Points", value: achievement.points });
  }
  if (rewardText) {
    rows.push({ label: "Reward", value: rewardText });
  }
  if (typeof achievement.is_account_wide === "boolean") {
    rows.push({
      label: "Account-wide",
      value: achievement.is_account_wide ? "Yes" : "No",
    });
  }
  if (achievement.requirements?.faction?.name) {
    rows.push({ label: "Faction", value: achievement.requirements.faction.name });
  }
  if (achievement.prerequisite_achievement?.name) {
    rows.push({
      label: "Prerequisite",
      value: achievement.prerequisite_achievement.name,
    });
  }
  if (criteria) {
    rows.push({ label: "Criteria", value: criteria });
  }

  return rows;
};

/** Achievement facts, description and the Wowhead link, from data already loaded. */
const AchievementDetailDialog = ({
  open,
  onClose,
  item,
}: AchievementDetailDialogProps): JSX.Element => {
  const rows = useMemo(() => (item ? buildRows(item) : []), [item]);

  const sections = useMemo<DetailDialogSection[]>(() => {
    const description = cleanMarkup(item?.achievement.description);
    return description
      ? [
          {
            heading: "Description",
            content: (
              <Typography variant="body2" component="p" sx={{ margin: 0 }}>
                {description}
              </Typography>
            ),
          },
        ]
      : [];
  }, [item]);

  const externalUrl = item?.result.externalUrl;

  return (
    <DetailDialog
      open={open}
      onClose={onClose}
      title={item?.result.name ?? "Achievement"}
      subtitle={item?.achievement.category?.name}
      media={{ src: item?.result.mediaUrl, alt: "", kind: "icon" }}
      rows={rows}
      sections={sections}
      maxWidth="sm"
      actions={
        externalUrl ? (
          <Button
            component="a"
            href={externalUrl}
            target="_blank"
            rel="noreferrer"
            variant="outlined"
            endIcon={<LaunchRounded />}
          >
            {item?.result.externalLabel ?? "View on Wowhead"}
          </Button>
        ) : undefined
      }
    />
  );
};

export default AchievementDetailDialog;
